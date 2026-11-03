# Setting up profiles

How to create profiles and make the right decision at each step. In the commands below, `sp-cli` stands for `npx --yes switch-profile@latest`, and every call ends with `--no-input --json`.

## Contents

- [Start by looking](#start-by-looking)
- [Which kind of profile?](#which-kind-of-profile)
- [Path 1: import from an SSO portal](#path-1-import-from-an-sso-portal)
- [Path 2: a single SSO profile](#path-2-a-single-sso-profile)
- [Path 3: console sign-in](#path-3-console-sign-in)
- [Path 4: access keys](#path-4-access-keys)
- [Decisions](#decisions)

## Start by looking

```bash
sp-cli status --no-input --json
sp-cli portals --no-input --json
```

If the portal or profile already exists, reuse it. Two portals with the same start URL mean two logins for no benefit.

## Which kind of profile?

| The user has | Use | Why |
|---|---|---|
| An SSO start URL (usually `https://<name>.awsapps.com/start`) and several accounts or roles | **Path 1: import** (recommended) | One profile per account and role, in one go. One login covers them all, and credentials refresh on their own |
| An SSO portal, and wants one specific account and role | **Path 2: single SSO** | Same benefits. They must know the account id and role name |
| Accounts assigned through the IAM account access manager, or an IAM user or role with console access and no SSO | **Path 3: console sign-in** | Short-lived credentials with no keys. `aws sso login` cannot reach these accounts |
| Only a long-lived key pair, and no alternative | **Path 4: access keys** | Last resort: keys never expire and sit in plain text |

Not sure? Ask: "Do you sign in to AWS through a portal with a URL like `something.awsapps.com/start`?" Yes means Path 1.

`role` (`role_arn` + `source_profile`) and `process` (`credential_process`) profiles cannot be created by this CLI. It detects and switches to ones written in `~/.aws/config`, and logs a role profile in through its source profile.

## Path 1: import from an SSO portal

**1. Get the start URL** from the user, then read its region:

```bash
sp-cli portals --check --start-url https://acme.awsapps.com/start --no-input --json
# {"startUrl":"...","detectedRegion":"ap-southeast-2"}    or null if the page names none
```

**2. Confirm the SSO region.** Propose `detectedRegion` and let the user confirm. If it is `null`, ask where IAM Identity Center lives (Identity Center console, Settings). See [SSO region vs default region](#sso-region-vs-default-region).

**3. Choose the portal's short name**, usually the client. Default to the first part of the host (`acme`). Letters, numbers, `-` and `_`.

**4. Save the portal:**

```bash
sp-cli portals acme --create --start-url https://acme.awsapps.com/start --region ap-southeast-2 --no-input --json
```

**5. Log in**, in the background, relaying the URL and code ([SKILL.md section 4](../SKILL.md#4-logging-in)):

```bash
sp-cli login --sso-session acme --device --no-input --json
```

Exit 2 mentioning `invalid_request` means a wrong SSO region: fix it with `portals acme --region <r>` and log in again.

**6. Preview.** Ask for the default region (where they deploy), then:

```bash
sp-cli add --from-sso acme --prefix acme --region ap-southeast-2 --dry-run --no-input --json
```

Show `addedEntries` as a table (name, account, role), and mention `existing` and `stale`.

**7. Agree what to add.** Everything, or a subset? Many portals have roles nobody needs. Offer to skip them.

```bash
sp-cli add --from-sso acme --prefix acme --region ap-southeast-2 --no-input --json
sp-cli add --from-sso acme --prefix acme --region ap-southeast-2 --only acme-prod-admin,acme-dev-admin --no-input --json
```

Use the same `--prefix` and `--region` as the preview, since `--only` takes the names it showed. Unticked pairs are not remembered: the next import offers them again. Add `--prune` only if the user agreed to remove the `stale` profiles (backups are taken first), and none of them is the current default. Hand-written profiles are never stale.

**8. Verify and tidy.**

```bash
AWS_PROFILE=acme-prod-admin aws sts get-caller-identity
sp-cli rename acme-prod-workloads-administratoraccess acme-prod --no-input --json
```

Offer friendlier names for long generated ones. Renamed profiles are still recognized by later imports.

**Re-sync later:** repeat from step 6. Existing account and role pairs are never duplicated, whatever their name.

## Path 2: a single SSO profile

The portal must exist: if not, run steps 1 to 4 above. Then:

```bash
sp-cli add --sso acme --name acme-audit --account 111111111111 --role ReadOnly --region us-east-1 --no-input --json
```

AWS does not check the account or role until the first use. Verify right away, logging in first if needed: `AWS_PROFILE=acme-audit aws sts get-caller-identity`. If the account or role is unknown, a login plus `add --from-sso acme --dry-run` lists what the user can really access.

Unlike imported profiles, these are never treated as stale.

## Path 3: console sign-in

```bash
sp-cli add --console --name acme-console --region us-east-1 --no-input --json
```

Needs AWS CLI 2.32+. This opens a browser on this machine, so use it only when the user is at this machine, and run it in the background: it blocks until they sign in. If the sign-in fails, no profile is left behind. If you kill it midway, the section stays and looks like an access key profile: `remove` it before retrying.

Exit 3 saying a code must be pasted means there is no browser here (SSH, or Linux with no display). Hand off: the user runs `npx switch-profile add` in their own terminal.

## Path 4: access keys

Do not collect them. Recommend Path 1 or 3 first, and say why. If the user still wants keys, they run this in their own terminal and paste the secret there, never in this conversation:

```bash
npx switch-profile add     # then: Access keys
```

Afterwards verify with `AWS_PROFILE=<name> aws sts get-caller-identity`.

## Decisions

### SSO region vs default region

The most common setup mistake. They are unrelated:

| | SSO region | Default region |
|---|---|---|
| **What** | Where IAM Identity Center lives. One per organization | Where the user's resources are. Per profile |
| **Set with** | `portals --create --region`, `portals <name> --region` | `add ... --region` |
| **If wrong** | Logins fail with `Invalid request` or `Invalid start url provided`, even though the URL is right | Commands run against the wrong region |

Always pass `--region` to `add --from-sso`. Without it, the CLI uses the SSO region as the default region, which is rarely where someone deploys. When importing more accounts, reuse the region their existing profiles have.

### Names

- Profile names: lowercase letters, numbers, `-` and `_`, at least 2 characters, not `default`.
- Imports generate `<prefix>-<account-name>-<role>`. Use the client as the prefix.
- **Say "prod" in production profile names.** The CLI flags a profile as production when its name or account name contains `prod`, `prd`, `production` or `live` as a separate word (`client_prd` yes, `products-dev` no). That flag drives the warnings, including yours. If a production account would not be flagged, propose a rename.

### Default profile or per-command?

- **Per command** (`AWS_PROFILE=x aws ...`): the right answer for you, and for anything scripted. It cannot affect anything else.
- **Default** (`use`): for tools started outside a terminal, or when the user asks. It is machine-wide.
- **`sp`** (humans only): sets `AWS_PROFILE` per terminal.

### Login mode

The `settings --login-mode` value applies when no `--device` or `--browser` is passed.

| Mode | Use when |
|---|---|
| `auto` (default) | Almost always: device code over SSH or with no display, browser otherwise |
| `device` | The browser flow keeps hanging, for example on an unusual remote setup |
| `browser` | Local machine that `auto` wrongly sees as remote |

How often someone must log in is set by the IAM Identity Center administrator (8 hours by default, up to 90 days), not by this tool.

### The `sp` shortcut

Offer it to humans who switch often in their own terminals. `settings --shortcut on` adds a marked block to their shell startup file, and they must open a new terminal to get it. It adds nothing for you. If their dotfiles are managed elsewhere, tell them instead of editing.

### Legacy SSO profiles

Profiles with `"legacySso": true` have no `[sso-session]`, so they never refresh on their own. Propose `settings --upgrade-legacy-sso`. It backs up the AWS files, groups profiles by portal, and the user logs in once per portal afterwards.
