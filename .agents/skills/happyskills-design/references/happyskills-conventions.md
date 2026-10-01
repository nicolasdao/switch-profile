# HappySkills Conventions — Skill Authoring Supplement

HappySkills is a **superset** of the Claude Code skill spec. A HappySkills-managed skill has both:

- `SKILL.md` — Claude Code standard (how Claude interprets the skill)
- `skill.json` — HappySkills standard (how skills are packaged, versioned, and distributed)

This file covers everything HappySkills adds on top of the Claude Code spec.

---

## 1. Content Opacity Principle

| Aspect | Owned By | File |
|---|---|---|
| How Claude interprets the skill | Claude Code | `SKILL.md` |
| How the skill is packaged, versioned, and distributed | HappySkills | `skill.json` |

HappySkills **never parses** SKILL.md frontmatter or content. All packaging decisions come from `skill.json`. The two specs evolve independently.

---

## 2. skill.json Manifest

### Required Fields

| Field | Type | Rules |
|---|---|---|
| `name` | string | Lowercase, hyphens/underscores allowed. Must start with letter or digit. Pattern: `/^[a-z0-9][a-z0-9_-]*$/` |
| `version` | string | Valid semver (e.g., `0.1.0`, `1.2.3`). New skills start at `0.1.0`. |

### Optional Type Field

| Field | Type | Rules |
|---|---|---|
| `type` | string | `"skill"` (default) or `"kit"`. Omitting the field is equivalent to `"skill"`. |

A **kit** is a dependency manifest — a skill whose value comes entirely from its `dependencies` list. Kits bundle a curated set of skills that install together. Key differences from regular skills:

- Kits ship a `README.md`, **not** a `SKILL.md`. The absence of `SKILL.md` is what keeps the kit invisible to every agent runtime (Claude Code, Codex, Gemini, etc.) — no frontmatter trick required.
- The `README.md` is plain markdown documenting what the kit bundles and when to use it. No frontmatter, no line cap, no auto-invocation contract.
- Validation requires a `README.md` and rejects any `SKILL.md` it finds inside a kit.
- The `dependencies` field in `skill.json` is the kit's primary content — it lists the skills the kit installs.

### Recommended Fields

| Field | Type | Purpose |
|---|---|---|
| `description` | string | Short summary. Shown in search results and the web catalog. Keep under 200 chars. |
| `authors` | string[] | Author names/emails (e.g., `["Jane Doe <jane@acme.com>"]`) |
| `license` | string | SPDX identifier (e.g., `MIT`, `Apache-2.0`) |

### Optional Fields

| Field | Type | Purpose |
|---|---|---|
| `repository` | string | Source repository URL |
| `homepage` | string | Homepage URL |
| `dependencies` | object | Other skills required at runtime (see Section 4) |
| `devDependencies` | object | Skills needed only for development |
| `systemDependencies` | object | External CLIs/runtimes required (see Section 4) |
| `$schema` | string | JSON Schema URL for validation |
| `forked_from` | object | Auto-set by `happyskills fork` — do not set manually |

### Complete Example

```json
{
  "name": "deploy-aws",
  "version": "1.0.0",
  "description": "Deploy applications to AWS using ECS and CloudFormation",
  "authors": ["Jane Doe <jane@acme.com>"],
  "license": "MIT",
  "repository": "https://github.com/acme/deploy-aws",
  "dependencies": {
    "acme/aws-auth": "^1.0.0",
    "acme/s3-utils": "^2.1.0"
  },
  "systemDependencies": {
    "aws": {
      "description": "AWS CLI v2",
      "version": ">=2.0.0",
      "check": "aws --version",
      "install": {
        "darwin": "brew install awscli",
        "linux": "curl -s https://awscli.amazonaws.com/install | bash",
        "win32": "msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi"
      }
    }
  }
}
```

### Kit Example

```json
{
  "name": "_kit-react-fullstack",
  "version": "1.0.0",
  "type": "kit",
  "description": "Full-stack React development kit with UI, database, and deployment skills",
  "dependencies": {
    "acme/react": "^1.0.0",
    "acme/shadcn": "^2.0.0",
    "acme/postgresql": "^1.5.0"
  }
}
```

### Minimal Example (Unpublished / Local)

```json
{
  "name": "my-skill",
  "version": "0.1.0",
  "description": "Short description of what this skill does",
  "keywords": []
}
```

> **This minimal manifest is correct only because `my-skill` invokes no external binaries and depends on no other skill.** "Unpublished / local" exempts you from *registry/publish* metadata (authors, license, repository) — it does **not** exempt you from dependency correctness. The moment the skill (or a script under `scripts/`) calls a non-POSIX binary, you MUST add a `systemDependencies` entry for it (see § 4), and if it relies on another HappySkills skill, a `dependencies` entry too — local or not. A skill runs on hosts that are not your dev machine.

---

## 3. Keywords (deprecated)

The `keywords` array in `skill.json` is a **legacy field**, retained only for backward compatibility. It is still accepted by the manifest and the validator does not require it. HappySkills curates and labels skills through a server-side process driven by the skill's *content*, not author-supplied keywords — so **do not spend effort populating `keywords`** during authoring, conversion, fork, enrichment, or updates. Leave any existing value as-is; a freshly scaffolded skill ships an empty `keywords: []`, which is fine to leave untouched.

---

## 4. Dependency Management

### Skill Dependencies (`dependencies`)

Other HappySkills skills required at runtime. Uses `owner/name` format with semver ranges:

```json
{
  "dependencies": {
    "acme/aws-auth": "^1.0.0",
    "acme/s3-utils": "~2.1.0"
  }
}
```

**Semver range syntax:**

| Range | Meaning |
|---|---|
| `^1.2.0` | Compatible: >=1.2.0, <2.0.0 |
| `~1.2.0` | Patch-level: >=1.2.0, <1.3.0 |
| `>=1.0.0` | At least 1.0.0 |
| `1.2.0` | Exact version |
| `*` | Any version |

Dependencies are automatically resolved and installed by HappySkills when the skill is installed.

### System Dependencies (`systemDependencies`)

External CLIs or runtimes the skill requires (not managed by HappySkills — user installs manually).

**The baseline rule — declare everything, assume nothing:**

> The skill's host environment is **not** the author's dev machine. Skills run in CI runners, fresh containers, sandboxed agents, and other users' laptops. Assume the host has only a POSIX shell and basic file utilities. **Every command-line binary the skill or its scripts invoke must be declared in `systemDependencies` — including ubiquitous tools.**

Common tools that DO need to be declared (these are the most-frequently-missed ones):

| Tool | When to declare |
|---|---|
| `git` | Any time the skill or a script calls `git ...` (status, log, diff, clone, etc.) |
| `node` / `npm` / `npx` | Any Node.js script, npm package execution, or `npx` invocation |
| `python` / `python3` / `pip` | Any Python script execution or pip-installed tool |
| `curl` / `wget` | HTTP requests from shell scripts |
| `jq` / `yq` | JSON or YAML parsing in shell scripts |
| `make` / `gcc` / `cargo` / `go` | Build steps |
| `docker` / `aws` / `gcloud` / `terraform` / `kubectl` | Infra and cloud tooling |

**Do not assume** that Git, Node, or Python are "always installed." They are not. A user installing your skill into a Docker-based agent runner will hit a missing-binary error if you skip the declaration.

**Detection procedure when authoring or auditing a skill:**

1. Scan `SKILL.md`, every file in `scripts/`, and any executable referenced by `${CLAUDE_SKILL_DIR}/scripts/` for command invocations.
2. Extract the unique set of binaries called (the first token of each shell command, ignoring shell built-ins like `cd`, `echo`, `if`, `for`).
3. Subtract the POSIX baseline (`sh`, `bash`, `cd`, `echo`, `printf`, `test`, `[`, `cat`, `ls`, `mv`, `cp`, `rm`, `mkdir`, `grep`, `sed`, `awk`, `find`, `head`, `tail`, `sort`, `uniq`, `wc`, `tr`, `cut`, `xargs`, `env`, `which`).
4. **Every remaining binary needs an entry in `systemDependencies`.**

**Example — a skill that uses Git and Node:**

```json
{
  "systemDependencies": {
    "git": {
      "description": "Git version control",
      "version": ">=2.20.0",
      "check": "git --version",
      "install": {
        "darwin": "brew install git",
        "linux": "apt install git",
        "win32": "winget install Git.Git"
      }
    },
    "node": {
      "description": "Node.js runtime",
      "version": ">=18.0.0",
      "check": "node --version",
      "install": {
        "darwin": "brew install node",
        "linux": "Use nvm: https://github.com/nvm-sh/nvm",
        "win32": "winget install OpenJS.NodeJS"
      }
    },
    "docker": {
      "description": "Docker Engine",
      "version": ">=20.0.0",
      "check": "docker --version",
      "install": {
        "darwin": "brew install --cask docker",
        "linux": "apt install docker.io",
        "win32": "winget install Docker.DockerDesktop"
      }
    }
  }
}
```

Each entry has:
- `description` — human-readable name
- `version` — minimum version constraint
- `check` — command to verify installation
- `install` — platform-specific install commands. **All three platform keys (`darwin`, `linux`, `win32`) MUST be present.** A missing key is a validation failure, not a "TBD."

| Key | Platform |
|-----|----------|
| `darwin` | macOS |
| `linux` | Linux |
| `win32` | Windows |

Each value MUST be exactly one of:

1. **A verified install command** (passed the Confidence Gate below), e.g. `"brew install mytool"`.
2. **An official-docs pointer** in the form `"See <official-docs-url> for install instructions"`, when no command can be verified.
3. **An explicit capability statement** `"Not supported on <platform>"`, when the tool genuinely does not run on that OS.

An empty string, a `null`, a placeholder like `"TBD"`, or a hand-wavy `"Install manually"` is rejected. Guessing a command to fill the slot is rejected — use option 2 instead.

```json
"install": {
  "darwin": "brew install mytool",
  "linux": "See https://mytool.example.com/docs/install#linux for install instructions",
  "win32": "Not supported on Windows"
}
```

#### Confidence Gate — verify install commands before writing them

An install command is a runtime contract: if it's wrong, the user's install fails on first use. LLMs hallucinate package names, vendor IDs (`winget` IDs especially), and Homebrew tap/formula names. Before writing any `install.<platform>` value, apply this gate per tool, per platform:

1. **Self-rate confidence.** For each `(tool, platform)` pair, answer honestly: *"Am I certain — from training, not inference-by-analogy — that this exact command installs this exact tool on this platform today?"*
2. **High confidence** (ubiquitous tools: `git`, `node`, `python`, `docker`, `curl`, `jq`, major cloud CLIs): write the command directly.
3. **Any uncertainty** (niche tools, vendor-specific CLIs, recent releases, anything where you'd "probably guess" the package name): **STOP. Do not write a plausible-sounding command from memory.** Instead:
   - Use `WebSearch` for `"<tool name> install <platform>"` and read the **official** docs (vendor site, GitHub README, official package registry). Prefer first-party sources.
   - If web tools are unavailable or the official docs are ambiguous, set the platform value to `"See <official-docs-url> for install instructions"` rather than guessing.
4. **Forbidden shortcuts:**
   - Guessing the Homebrew formula name by analogy (`brew install <toolname>` when you have not verified the formula exists).
   - Guessing the apt/yum package name by analogy — binary name ≠ package name in many cases.
   - Guessing the `winget` ID — the `Vendor.Product` format is **not** derivable; it must be looked up.
   - Filling all three platforms when only one is verified, by extrapolating from the verified one.

**Rule of thumb:** if you cannot point to a specific source (training-distilled or freshly fetched) for an install command, the field's value is `"See <url> for install instructions"`, not a guess.

### Dev Dependencies (`devDependencies`)

Same format as `dependencies`, but only installed with the `--dev` flag. Use for skills needed during development only.

---

## 5. Naming Conventions

### Skill Name (in `skill.json`)

- Lowercase alphanumeric with hyphens and underscores
- Must start with a letter or digit
- Pattern: `/^[a-z0-9][a-z0-9_-]*$/`
- Examples: `deploy-aws`, `git_helpers`, `test-runner`
- Invalid: `Deploy-AWS`, `my skill`, `_private`, `-bad`

### Full Identifier (in Registry)

Format: `owner/name` (e.g., `acme/deploy-aws`)

- `owner` is a workspace slug
- Workspace types: `personal` (one per user) or organizational
- When publishing, workspace is determined by:
  1. `--workspace` flag (if provided)
  2. Single workspace → auto-selected
  3. Multiple → prefer `personal` type
  4. Fall back to first in list

---

## 6. Lock Files

**Auto-generated by HappySkills** — never edit manually.

| Scope | Location |
|---|---|
| Project | `skills-lock.json` (in the project root directory, next to `.claude/`) |
| Global | `~/.claude/skills-lock.json` |

**Key rules:**
- Commit lock files to version control for reproducible installs
- Regenerated on: first install, upgrade, `install --fresh`, or manual skill.json dependency changes
- If lock file exists, HappySkills uses it directly and skips resolution

---

## 7. Publishing Checklist

Before publishing a skill:

1. **skill.json is complete** — `name`, `version`, and `description` are set
2. **SKILL.md exists** — HappySkills validates its presence
3. **Version is bumped** — use `happyskills bump patch|minor|major` before publishing
4. **Dependencies are published** — all skills in `dependencies` must be published to the registry first
5. **No secrets** — `.env`, credentials, and sensitive files are automatically excluded
6. **Size limit** — total skill content must be under 50MB
7. **Visibility** — skills are **private by default**: only people you explicitly grant access to can see them (not even the rest of your workspace, until you grant them). Two other tiers exist, chosen on first publish via `--visibility <value>` (or changed later with `happyskills visibility <owner/name> <value>`): **workspace** — every member of the owning workspace can find and install it, the way to share an internal skill with your whole team without going public; and **public** — listed in the public catalog for anyone. Always confirm with the user before publishing **public**.

**Auto-excluded from publishing:**
```
node_modules, .git, .env, .env.*, .DS_Store, .tmp, *.log
```

> **Per-install configuration lives OUTSIDE the skill, in `skills-config.json`.** A configurable skill declares a `config`/`env` schema in `skill.json` and reads the consumer's values from the project-root `skills-config.json` (the sibling of `skills-lock.json`) — never from a file inside the skill folder, which the next `update` would wipe. A `config` field may hold a structured value (`type: "object"` / `"array"`), and a field the skill's own UI authors rather than a human at an install prompt should declare `prompt: false`; the skill then persists it with `happyskills skills-config set` (never by hand-editing the JSON). See [skill-authoring.md § Configuration](skill-authoring.md) for the schema, the canonical read snippet, and the write path. Secret **values** never belong in `skills-config.json` (which is committed) — they live in the gitignored `.env` its `envFile` points at, and `skills-config set` refuses to write a key you declared `secret: true`.

---

## 8. Installation Structure

### Project-Level

```
project-root/
├── skills-lock.json              ← project-level lock file
├── .claude/
│   └── skills/
│       └── owner/
│           └── skill-name/
│               ├── SKILL.md
│               ├── skill.json
│               └── ...
```

### Global

```
~/.claude/skills/
├── owner/
│   └── skill-name/
│       ├── SKILL.md
│       ├── skill.json
│       └── ...
└── skills-lock.json
```

---

## 9. Forbidden Characters in Frontmatter

Certain characters in YAML frontmatter values break the parser or skill discovery, causing skills to be silently ignored. The full table of 10 forbidden characters, safe characters, examples, and the scanning rule are defined in [skill-authoring.md § 3 — Forbidden Characters in Frontmatter Values](skill-authoring.md). That is the authoritative reference — always consult it when writing or reviewing frontmatter.

---

## 10. Authoring Checklist — HappySkills Complete Skill

When creating a new skill for HappySkills, ensure you produce:

- [ ] `SKILL.md` — follows Claude Code spec (frontmatter + content, see `skill-authoring.md`)
- [ ] `skill.json` — valid manifest with `name`, `version`, `description`
- [ ] `description` in both files — skill.json description for registry search, SKILL.md description for Claude auto-invocation (they serve different purposes and can differ)
- [ ] Dependencies declared if the skill relies on other published skills
- [ ] System dependencies declared for every non-POSIX binary the skill or its scripts invoke (including `git`, `node`, `python`, etc. — see § 4)
- [ ] Skill name is lowercase-with-hyphens, matching the directory name
- [ ] Version starts at `0.1.0` for new skills
