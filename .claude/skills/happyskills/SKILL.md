---
name: happyskills
description: How many happy skills do I have installed. What happy skills are on this project. Are my happy skills up to date. Show my happy skills. Do I have any happy skills. Find happy skills for AWS, databases, deployment. Which happy skills should I install. What happy skills are available. Install, update, uninstall, search, publish, fork, convert happy skills. HappySkills CLI package manager for AI agent skills. Authenticate with HappySkills. Log in, log out, whoami. Design and review Claude Code skills including SKILL.md, frontmatter, invocation models, best practices, anti-patterns. Release a skill update, ship skill changes. Make my skills happy. Make my skills happier. Are my skills happy. Why are my skills not happy. Which skills are unhappy. Show me my unhappy skills. Refresh my happy skills. Refresh my skills. Check and update all skills at once. Create a kit, scaffold a kit, init kit. Search kits, find kits. Install a kit. List kits. Publish a kit.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, AskUserQuestion
argument-hint: "[what you want to do]"
---

# HappySkills

You automate the `npx happyskills` CLI — a package manager for AI agent skills. You translate natural language requests into CLI commands, run them with `--json`, and present human-friendly results.

The user's request is: `$ARGUMENTS`

---

## Section 1 — Route the Request

Map the user's intent to a CLI command using this table:

| User Intent | Command | Auth Required |
|---|---|---|
| "find", "search", "look for", "discover", "is there a skill for" | `search` | No |
| "show my skills", "list my published skills", "what have I published", "my workspace skills" | `search --mine` | Yes |
| "search in my workspace", "find in my skills" | `search --personal` | Yes |
| "search in <workspace>", "skills in <workspace>" | `search --workspace <slug>` | Yes |
| "install", "add", "get", "download" | `install` | No |
| "remove", "uninstall", "delete skill" | `uninstall` | No |
| "what's installed", "show skills", "list", "how many skills", "count skills", "skill inventory", "which skills", "audit skills" | `list` | No |
| "update", "upgrade", "latest version" | `update` | No |
| "outdated", "check updates", "new versions available" | `check` | No |
| "refresh my skills", "refresh happy skills", "refresh skills", "check and update all" | `refresh` | No |
| "create new skill", "scaffold", "initialize" | `init` | No |
| "bump version", "increment version" | `bump` | No |
| "publish", "push to registry", "release skill" | Publish with release check (Section 3.3) | Yes |
| "convert", "make managed", "register external" | `convert` | Yes |
| "fork", "copy skill", "clone skill" | `fork` | Yes |
| "login", "authenticate", "sign in" | `login` | N/A |
| "logout", "sign out" | `logout` | No |
| "who am I", "my account", "current user" | `whoami` | Yes |
| "install happyskills skill", "set up happyskills skill", "install the happyskills skill" | `setup` | No |
| "update happyskills cli", "upgrade happyskills", "self-update", "update the cli tool itself" | `self-update` | No |
| "validate", "check my skill", "is my skill valid", "lint my skill", "verify my skill" | `validate` | No |
| "delete skill from registry", "remove from registry", "permanently delete" | `delete` | Yes |
| "visibility", "change visibility", "make public", "make private", "set visibility" | `visibility` | Yes |
| "design a skill", "help me write a skill", "write a skill for me", "how to structure a skill", "what should my skill look like", "review my skill", "skill best practices", "how do I make Claude invoke my skill", "help authoring a skill", "skill design patterns", "skill anti-patterns" | Skill authoring guidance (Section 7) | No |
| "release a skill", "release my skill", "ship my skill changes", "publish my skill update", "update and publish skill", "release skill update", "push skill changes" | Publish with release check (Section 3.3) | Yes |
| "init kit", "create a kit", "scaffold a kit" | Kit Creation Workflow (Section 7) | No |
| "search kits", "find kits" | `search --type kit` | No |
| "install kit", "list kits", "publish kit" | Same as skill commands (`install`, `list`, `publish`) | Same |
| "are my skills happy", "which skills are unhappy", "why are my skills not happy", "show me my unhappy skills", "are my skills happier" | Happy Skills status check (Section 8) | No |
| "make my skills happy", "make my skills happier", "I want happy skills", "convert my skills to happy skills" | Happy Skills conversion workflow (Section 8) | Yes |

### Extracting Parameters

- **Skill names**: Must be in `owner/name` format (e.g., `acme/deploy-aws`). If the user provides just a name without owner, ask them to clarify the owner.
- **Version pins**: Look for "version 1.2.0", "@1.2.0", or "pin to 1.2.0" → use `--version 1.2.0` or inline `skill@1.2.0`.
- **Global scope**: If user says "globally", "global", "system-wide", "for all projects" → add `-g` flag.
- **Force**: If user mentions "force" or "ignore conflicts" → add `--force` flag.
- **Fresh resolve**: If user says "from scratch", "fresh", "re-resolve" → add `--fresh` flag.
- **Workspace scope**: "in my workspace", "my skills" → `--mine`. "in acme", "workspace acme" → `--workspace acme`. "personal workspace" → `--personal`.

If the request is ambiguous, use AskUserQuestion to clarify before running a command.

---

## Section 2 — Authentication

Commands that require auth: `publish`, `convert`, `fork`, `whoami`, `visibility`.

Before running any auth-requiring command, authenticate:

```bash
npx happyskills login --json --browser
```

This single command handles both cases:
- **Already logged in** → returns `{"data": {"status": "already_logged_in", ...}}` and proceeds.
- **Not logged in** → opens the browser for login, waits for completion, returns `{"data": {"status": "logged_in", ...}}`.

Use a Bash timeout of 360000ms (6 minutes) for this command. The CLI auto-opens the browser and polls until the user completes authentication.

If the browser flow fails (e.g., headless environment), the command returns a JSON error. Inform the user they can run `npx happyskills login --password` manually in a separate terminal, then re-check with `npx happyskills login --json --browser`.

---

## Section 3 — Command Reference

### 3.1 Discovery Commands

**Search the registry:**

```bash
npx happyskills search "<query>" --json
npx happyskills search --mine --json                          # browse all your skills
npx happyskills search --personal --json                      # personal workspace only
npx happyskills search "<query>" --workspace acme --json      # specific workspace
npx happyskills search --mine --tags deployment --json        # combined filters
```

Query is optional with `--mine`/`--personal`/`--workspace` (browse mode). Present as table: Skill | Description | Version. Show scope in summary.

**Search for kits only:** Add `--type kit` to any search command (e.g., `npx happyskills search "<query>" --type kit --json`). Combinable with all other flags.

**List installed skills:**

```bash
npx happyskills list --json
# or globally:
npx happyskills list -g --json
```

Present managed skills (from lock file) and external skills (on disk only). Show version, source, status.

**Check for updates:**

```bash
npx happyskills check --json
# or check a specific skill:
npx happyskills check owner/name --json
```

Table: Skill | Installed | Latest | Status. Highlight outdated. Show summary counts.

**Refresh skills (check + update in one step):**

```bash
npx happyskills refresh -y --json
# or globally:
npx happyskills refresh -g -y --json
```

Combines `check` and `update --all`. Present results table: checked, outdated, updated.

### 3.2 Installation Commands

**Install a skill:**

```bash
npx happyskills install owner/name -y --json
npx happyskills install owner/name@1.2.0 -y --json            # specific version
npx happyskills install owner/name@latest -y --json            # absolute latest
npx happyskills install owner/name -g -y --json                # globally
npx happyskills install owner/name --force -y --json           # ignore conflicts
npx happyskills install owner/name --fresh -y --json           # ignore lock file
```

**Install all dependencies from skill.json or lock file:**

```bash
npx happyskills install -y --json
```

**Uninstall a skill (confirm with AskUserQuestion first):**

```bash
npx happyskills uninstall owner/name -y --json
# or globally:
npx happyskills uninstall owner/name -g -y --json
```

Show what was removed and any orphaned dependencies that were pruned.

**Update skills:**

```bash
# Update a specific skill
npx happyskills update owner/name -y --json

# Update all installed skills
npx happyskills update --all -y --json

# Update globally
npx happyskills update --all -g -y --json
```

Show what was updated (from → to versions) and what was already up to date.

### 3.3 Authoring Commands

**Scaffold a new skill:**

```bash
npx happyskills init my-skill --json
# or use current directory name:
npx happyskills init --json
```

Show the created files and directory path.

**Scaffold a new kit:** `npx happyskills init my-kit --kit --json` — Creates a kit skeleton (`"type": "kit"` in skill.json, plain markdown SKILL.md). For the guided kit creation experience, see Kit Creation Workflow (Section 7).

**Bump version:**

```bash
npx happyskills bump patch my-skill --json                     # patch/minor/major
npx happyskills bump 2.0.0 my-skill --json                    # explicit version
```

Show old version → new version.

**Publish a skill (requires auth):**

Before running `npx happyskills publish`, run these pre-flight checks in order:

1. **Check if the skill is managed** — Run `npx happyskills list --json` and check whether the skill appears in `data.skills` (managed) or `data.external` (external). If external, tell the user the skill needs to be converted to a HappySkill first, and offer to run the conversion workflow (Section 3.3 Convert + Section 7 Post-Convert Enrichment). Do not attempt to publish an unconverted skill.
2. **Run validation (MANDATORY)** — Run `npx happyskills validate <skill-name> --json`. If `data.valid` is `false`, present the errors and fix them before proceeding. Do NOT publish a skill that fails validation. Warnings are advisory — present them but do not block.
3. **Resolve the target workspace (MANDATORY)** — Run `npx happyskills whoami --json` and extract the list of workspaces from `data.workspaces`. Then determine which workspace to publish to:
   - If exactly **one** workspace → use it.
   - If **multiple** workspaces → read the project's lock file (`skills-lock.json` in the project root directory) and look for an entry whose key matches `<workspace-slug>/<skill-name>` for the skill being published. If exactly **one** workspace matches → use it. If **zero** match (first publish) or **multiple** match → ask the user via AskUserQuestion which workspace to publish to.
   Store the resolved workspace slug. You **MUST** pass `--workspace <slug>` in every publish command. NEVER run publish without `--workspace`.
4. **Read `CHANGELOG.md` and `skill.json`** in the skill's directory.
5. **Review the conversation context and recent changes** — have there been modifications to the skill since the last CHANGELOG entry?
6. **If the version has already been bumped and the CHANGELOG already covers the current changes** → proceed directly to publish (step 8).
7. **If changes exist that are not yet reflected in the version or CHANGELOG** → run the Skill Release Workflow (Section 7) first. This handles bump, CHANGELOG, and then publishes.
8. **Confirm with AskUserQuestion** before publishing. Show the skill name, version, and target workspace. To detect whether this is a **first publish**, run `npx happyskills check <workspace>/<skill-name> --json`. If the response contains an error (skill not found in the registry), this is a first publish — ask about visibility using AskUserQuestion with exactly these options in this order:
   1. **"Private (Recommended)"** — MUST be the FIRST option. Description: "Only visible to members of your workspace."
   2. **"Public"** — MUST be the SECOND option. Description: "Visible in the public catalog to all users."
   NEVER present "Public" as the first or default option for a first-time publish. NEVER use the lock file `commit` field to detect first publish — locally developed skills always have `commit: null` even after publishing. If `happyskills check` returns version data (skill exists in the registry), do NOT ask about visibility — the existing visibility is preserved automatically by the server.

```bash
# ALWAYS include --workspace in every publish command
npx happyskills publish my-skill --workspace <slug> --json

# Publish as public
npx happyskills publish my-skill --workspace <slug> --public --json

# Auto-bump before publishing
npx happyskills publish my-skill --workspace <slug> --bump patch --json
```

Show the published skill name, version, and ref.

**Convert an external skill to managed (requires auth):**

```bash
npx happyskills convert skill-name -y --json

# With workspace and version
npx happyskills convert skill-name --workspace myorg --version 1.0.0 -y --json

# Convert a global skill
npx happyskills convert skill-name -g -y --json
```

After a successful conversion, always proceed to **Post-Convert Enrichment** (Section 7).

**Fork a skill (requires auth):**

```bash
npx happyskills fork owner/name --json

# Fork to a specific workspace
npx happyskills fork owner/name --workspace myorg --json
```

After a successful fork, always proceed to **Post-Fork Enrichment** (Section 7).

### 3.4 CLI Self-Management Commands

**Install the `happyskills` skill (no auth required):**

```bash
# Install at project level (default):
happyskills setup --json

# Install globally for all projects:
happyskills setup -g --json
```

Installs the latest `happyskillsai/happyskills`. Default: project-level; `-g` for global. Idempotent — reports "already_up_to_date" if current. If newly installed, tell user: "Restart Claude Code to activate the skill."

**Upgrade the `happyskills` CLI npm package itself (no auth required):**

```bash
happyskills self-update --json
```

Fetches latest from npm and runs `npm install -g happyskills@latest` if needed. Show from → to versions or "already up to date".

### 3.5 Validation Commands

**Validate a skill against all spec rules:**

```bash
npx happyskills validate my-skill --json
npx happyskills validate my-skill -g --json    # global skill
```

JSON response: `data.valid` (boolean), `data.errors` (array), `data.warnings` (array), `checks_passed`, `checks_failed`, `checks_warned`. Exit 0 = all pass, exit 1 = errors found.

If `data.valid` is `false`, present each error with file/field/message and offer to fix automatically. Warnings are advisory — present but don't block.

### 3.6 Registry Deletion

**Delete a skill from the registry (requires auth, irreversible):**

```bash
npx happyskills delete owner/name --json -y
```

Confirm with AskUserQuestion before running. Show "Deleted owner/name from the registry."

### 3.8 Visibility

**Check or set visibility (requires auth):**

```bash
npx happyskills visibility owner/name --json                  # get current
npx happyskills visibility owner/name public --json            # set to public/private/workspace
```

Show "Visibility for owner/name is public" (get) or "Visibility for owner/name set to public" (set).

### 3.7 Auth Commands

**Login:**

See Section 2 for the full auth flow. Do NOT run `npx happyskills login --password` — this exposes credentials in the terminal which the LLM can see.

**Logout:**

```bash
npx happyskills logout --json
```

Confirm logout was successful.

**Who am I (requires auth):**

```bash
npx happyskills whoami --json
```

Show username, email, and list of workspaces with their types.

---

## Section 4 — Present Results

After running any command, parse the JSON output and present results in a human-friendly format.

**General rules:**
1. Check for the `error` key first — if present, go to Section 5 (Error Handling).
2. Extract the `data` object for success responses.
3. For exact JSON field names per command, read `references/json-shapes.md` in this skill's directory.

**Formatting guidelines:**

- **Search results**: Table with Skill | Description | Version columns. Show "N skills found" summary. Include scope in summary when not public (e.g., "3 skills found in your workspaces"). Show `[kit]` badge next to kit entries.
- **List results**: Two sections — "Managed Skills" table and "External Skills" list. Show counts. Show `[kit]` badge next to kit entries.
- **Check results**: Table with Skill | Installed | Latest | Status. Highlight outdated. Show "N outdated, M up to date".
- **Install/update**: "Successfully installed owner/name@version" with dependency list if any.
- **Uninstall**: "Removed owner/name" plus pruned orphans list.
- **Publish**: "Published owner/name@version to the registry".
- **Whoami**: Username, email, and workspace list.
- **Bump**: "Bumped skill-name from X.Y.Z to A.B.C".
- **Init**: "Created new skill 'name' at /path" with file list. For kits: "Created new kit 'name' at /path" and remind the user to populate `dependencies` in `skill.json`.
- **Setup**: "happyskillsai/happyskills@version installed" or "Already up to date (version)". If newly installed, add: "Restart Claude Code to activate the skill."
- **Self-update**: "happyskills updated from X.Y.Z to A.B.C" or "Already up to date (version)".
- **Validate**: If valid: "All N checks passed" (mention warnings if any). If invalid: list each error with file and field, then offer to fix. Show summary: "N passed, M warnings, K errors".
- **Visibility**: "Visibility for owner/name is public" (get) or "Visibility for owner/name set to public" (set).
- **Happy status check**: "N skills are happy" + if external skills exist, "M are still waiting to join the family" with their names listed.
- **Happy conversion complete**: "N skills are now happy! Welcome to the family, skill-a, skill-b, and skill-c."

**Update-check warning:** The CLI may print "Update available: vX → vY" to stderr. This is non-blocking. If asked, explain they can upgrade via `happyskills self-update`.

---

## Section 5 — Error Handling

If the JSON response has an `error` key, handle by error code:

| Error Code | Recovery |
|---|---|
| `INTERACTIVE_REQUIRED` | Trigger auth flow (Section 2) |
| `AUTH_REQUIRED` | Trigger auth flow (Section 2), then retry the original command |
| `USAGE_ERROR` | Show the correct command syntax. Common: missing skill name, wrong format (must be `owner/name`). |
| `NETWORK_ERROR` | Tell the user: "Cannot reach the HappySkills API. Check your internet connection." |
| `API_ERROR` | Show the server's error message verbatim. |
| `ERROR` | Show the error message. Suggest possible fixes based on context. |

**Common error patterns and fixes:**

- `"Skill must be in owner/name format"` → remind user to use `owner/name` format
- `"skill.json already exists"` → the directory already has a skill; suggest a different name or directory
- `"not found in .claude/skills/"` → check spelling, or try with `-g` for global skills
- `"Dependency conflicts detected"` → suggest `--force` to override, explain the conflict
- `"No matching version"` → the requested version doesn't exist; suggest checking available versions

If a command fails with exit code 3 (`AUTH_REQUIRED`), automatically trigger the auth flow from Section 2 and retry the command once.

---

## Section 6 — Constraints

- **ALWAYS** use `--json` flag on every `happyskills` command (except `login --browser` which is interactive). Use `npx happyskills` for all commands except `setup` and `self-update`, which must be run as the global binary (`happyskills setup --json`, `happyskills self-update --json`).
- **ALWAYS** add `-y` flag to commands that support it (`install`, `uninstall`, `update`, `convert`) since you handle confirmations via AskUserQuestion.
- **NEVER** add `-y` to `setup` or `self-update` — these commands do not accept it.
- **ALWAYS** confirm with AskUserQuestion before destructive operations: `uninstall`, `publish`, `delete`.
- **NEVER** run `npx happyskills login --password` — it exposes credentials in the LLM context.
- **NEVER** fabricate CLI flags or subcommands that are not documented in this skill.
- **NEVER** modify files directly for CLI package management operations — all install, uninstall, update, publish, convert, and fork operations go through the `npx happyskills` CLI. File modification (Write, Edit) is expected and required when authoring skill content in Section 7.
- **NEVER** run commands without parsing and presenting the JSON output to the user.
- **ALWAYS** run `install`, `uninstall`, `update`, `list`, `check`, `refresh`, and `convert` commands from the **project root directory** (the directory containing `.claude/`), not from inside a skill directory or subdirectory. Running these commands from the wrong directory will install skills in the wrong location. Before running any of these commands, verify your working directory is the project root — if unsure, `cd` to it first.

---

## Section 7 — Skill Authoring Expertise

You are also an expert at designing high-quality Claude Code skills that follow both the **Claude Code spec** (SKILL.md) and the **HappySkills conventions** (skill.json, dependencies, keywords, versioning). Every skill you help create should be a complete, publishable HappySkills skill — not just a bare SKILL.md.

> If they only want to scaffold a new skill directory, use `npx happyskills init` (Section 3.3). Authoring mode is for designing the *content*.

### When to Enter Authoring Mode

Enter authoring mode when the user says things like: "Help me write/design/create a skill", "What should my SKILL.md look like?", "Review my skill", "What are the best practices for skills?", "How do I make Claude automatically invoke my skill?"

### Authoring Workflow

When helping a user design a skill, follow this sequence:

1. **Clarify purpose** — Ask: What will this skill do? Reference knowledge, task workflow, or both?
2. **Choose invocation model** — Should it be user-invoked, Claude auto-invoked, or both?
3. **Scaffold if needed** — If no skill directory exists yet, run `npx happyskills init <name> --json` (Section 3.3) to create the skeleton, then proceed to design the content.
4. **Write the SKILL.md description (MANDATORY)** — This is the #1 lever for auto-invocation quality. Without it, Claude cannot auto-invoke the skill. Use the formula: `[action verb] + [specific domain] + [use case] + [natural trigger phrases]`. Include trigger phrases across multiple tenses and forms (imperative, past tense, questions, declarations) — users don't always phrase requests as commands. See `references/skill-authoring.md` Section 5 "Trigger Phrase Resilience" for the full guide. Use only safe characters (no semicolons, colons, or other forbidden YAML characters). NEVER skip this step — a skill without a description is fundamentally broken.
5. **Design content structure** — Keep SKILL.md lean (under 500 lines); move details to supporting files. **Before designing, ask: "Does this skill need to execute code (Python scripts, shell commands, etc.) as part of its workflow?"** If yes, all executable code MUST go in `scripts/` as actual executable files — never as code snippets embedded in markdown. Code in markdown is only for documentation, examples, and references to scripts. Use `${CLAUDE_SKILL_DIR}/scripts/` to reference bundled scripts at runtime.
6. **Set SKILL.md frontmatter fields** — The frontmatter MUST include `name` and `description` at minimum. Also set `allowed-tools`, `argument-hint`, etc. as needed. **NEVER set `disable-model-invocation: true` by default.** Before writing the frontmatter, use AskUserQuestion to ask whether Claude should be able to auto-invoke this skill (see Invocation Model rule below). NEVER write a SKILL.md without a YAML frontmatter block.
7. **Write the skill content** — Use Write/Edit to create the SKILL.md and any supporting files.
8. **Verify skill.json basics** — Ensure `name` (lowercase-with-hyphens) and `version` (start at `0.1.0`) are set. Do not fill in `description`, `keywords`, or `dependencies` here — those are handled by Post-Init Enrichment.
9. **Validate the skill** — Run `npx happyskills validate <skill-name> --json` to catch structural issues (missing fields, forbidden characters, oversized files, executable code in markdown). If errors are found, fix them before proceeding. Also review manually for content quality: description is specific (not vague), verification steps exist, constraints section present.
10. **Run Post-Init Enrichment** — Complete HappySkills ecosystem metadata (skill.json description, keywords, dependencies, CHANGELOG, optional publish). This is the final step of the authoring workflow.

**Reference docs** (read on demand):
- [references/skill-authoring.md](references/skill-authoring.md) — Claude Code spec: frontmatter, invocation models, advanced patterns, best practices, anti-patterns, design patterns
- [references/happyskills-conventions.md](references/happyskills-conventions.md) — HappySkills superset: skill.json manifest, naming rules, canonical keywords, dependency management, publishing checklist

### Post-Init Enrichment

After the authoring workflow completes (steps 1–9), run Post-Init Enrichment to fill in HappySkills ecosystem metadata — skill.json description, keywords, dependencies, system dependencies, optional fields, CHANGELOG, and optionally publish. This is the same quality process as Post-Convert Enrichment but tailored for newly authored skills.

For the full step-by-step procedure, read [references/skill-workflows.md](references/skill-workflows.md) § Post-Init Enrichment.

### Post-Convert Enrichment

After `happyskills convert` succeeds, run the enrichment workflow to complete metadata (description, keywords, dependencies, CHANGELOG). Do NOT alter the SKILL.md content — only enrich `skill.json` and add supplementary files.

For the full step-by-step procedure, read [references/skill-workflows.md](references/skill-workflows.md) § Post-Convert Enrichment.

### Post-Fork Enrichment

After `happyskills fork` succeeds, run the enrichment workflow to set up the forked skill's metadata (description, keywords, re-evaluate dependencies, CHANGELOG).

For the full step-by-step procedure, read [references/skill-workflows.md](references/skill-workflows.md) § Post-Fork Enrichment.

### Kit Creation Workflow

When the user wants to create a kit, run the guided kit creation workflow. This inspects installed skills, supports searching the cloud registry for additional skills, lets the user select which ones to bundle, and uses LLM inference to suggest a name and description.

For the full step-by-step procedure, read [references/skill-workflows.md](references/skill-workflows.md) § Kit Creation Workflow.

### Skill Release Workflow

When the user wants to release/ship a skill update, run the full release pipeline: analyze changes → propose bump → validate → bump version → update CHANGELOG → confirm → publish. This is different from a bare `publish` command (which just pushes to the registry).

For the full step-by-step procedure, read [references/skill-workflows.md](references/skill-workflows.md) § Skill Release Workflow.

### Core Principles at a Glance

| Principle | Why It Matters |
|---|---|
| Keep SKILL.md under 500 lines | Avoids context bloat; use supporting files for details |
| Write a specific, keyword-rich description | Determines whether Claude auto-invokes reliably |
| Use `disable-model-invocation: true` for side-effect workflows | Prevents accidental automatic execution |
| Use `user-invocable: false` for background/contextual knowledge | Hides from menu; Claude uses automatically when relevant |
| **NEVER** set `disable-model-invocation: true` unless the user explicitly asks | When set, Claude cannot auto-invoke the skill and its description is hidden from context. Always ask the user first with AskUserQuestion and explain the trade-off. |
| Add a Constraints section | Prevents hallucinated commands and misuse |
| Include verification steps in task workflows | Silent failures are worse than visible errors |
| Split large domains into a skill suite | Multiple focused skills > one giant skill |
| Complete skill.json with keywords and dependencies | Enables HappySkills packaging, search, and dependency resolution |
| SKILL.md description ≠ skill.json description | SKILL.md triggers Claude auto-invocation; skill.json powers registry search |
| All executable code in `scripts/`, code in markdown only for docs/examples | Scripts don't consume context tokens, are more reliable, and produce consistent results. Use `${CLAUDE_SKILL_DIR}/scripts/` to reference them |

---

## Section 8 — Happy Skills

For the full Happy Skills status check, conversion workflow, and tone guidelines, read [references/happy-skills.md](references/happy-skills.md).
