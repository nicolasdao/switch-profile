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

- Kit SKILL.md has **no frontmatter** (plain markdown only). This makes the kit invisible to Claude's auto-invocation, which is intentional — kits don't contain agent instructions.
- Kit SKILL.md is a plain markdown description of what the kit contains and when to use it.
- Validation skips frontmatter checks for kits.
- The `dependencies` field in `skill.json` is the kit's primary content — it lists the skills the kit installs.

### Recommended Fields

| Field | Type | Purpose |
|---|---|---|
| `description` | string | Short summary. Shown in search results and the web catalog. Keep under 200 chars. |
| `keywords` | string[] | Searchable category slugs. Include at least one canonical slug (see Section 3). |
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
  "keywords": ["deployment", "aws", "cloud", "devops"],
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
  "keywords": ["kit"],
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

---

## 3. Keyword System

### Canonical Category Slugs

The HappySkills registry recognizes these slugs for filtering and discovery in the web catalog:

| Slug | Category |
|---|---|
| `deployment` | Deployment & release automation |
| `database` | Databases & migrations |
| `security` | Security & secret scanning |
| `ai` | AI / ML |
| `api` | APIs & integrations |
| `monitoring` | Monitoring & observability |
| `testing` | Testing & QA |
| `devops` | DevOps & CI/CD |
| `cloud` | Cloud infrastructure |
| `analytics` | Analytics & data |

**Best practice**: Include at least one canonical slug so the skill appears in the right filter category. Additional custom keywords are allowed.

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

External CLIs or runtimes the skill requires (not managed by HappySkills — user installs manually):

```json
{
  "systemDependencies": {
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
- `install` — platform-specific install commands. **Always include all three platforms:**

| Key | Platform |
|-----|----------|
| `darwin` | macOS |
| `linux` | Linux |
| `win32` | Windows |

If the install command for a platform is known, include it. If the tool is not available or the install method is unknown for a platform, set the value to a message explaining the situation:

```json
"install": {
  "darwin": "brew install mytool",
  "linux": "apt install mytool",
  "win32": "Not supported on Windows"
}
```

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

1. **skill.json is complete** — `name`, `version`, `description`, and `keywords` are set
2. **SKILL.md exists** — HappySkills validates its presence
3. **Version is bumped** — use `happyskills bump patch|minor|major` before publishing
4. **Dependencies are published** — all skills in `dependencies` must be published to the registry first
5. **No secrets** — `.env`, credentials, and sensitive files are automatically excluded
6. **Size limit** — total skill content must be under 10MB
7. **Visibility** — skills are **private by default** (workspace only). Pass `--public` to make the skill visible in the public catalog. Always confirm with the user before publishing publicly.

**Auto-excluded from publishing:**
```
node_modules, .git, .env, .env.*, .DS_Store, .tmp, *.log
```

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

The SKILL.md frontmatter `description` field has character restrictions that, if violated, silently break skills discovery.

| Character | Status | Effect |
|---|---|---|
| Semicolon (`;`) | **Forbidden** | Breaks the frontmatter parser. Skill is silently excluded from discovery and auto-invocation. |

**Always use commas, periods, or dashes instead of semicolons in the `description` field.**

```yaml
# ❌ WRONG
---
description: "Deploy apps to AWS; supports ECS and Lambda"
---

# ✅ CORRECT
---
description: "Deploy apps to AWS, supports ECS and Lambda"
---
```

---

## 10. Authoring Checklist — HappySkills Complete Skill

When creating a new skill for HappySkills, ensure you produce:

- [ ] `SKILL.md` — follows Claude Code spec (frontmatter + content, see `skill-authoring.md`)
- [ ] `skill.json` — valid manifest with `name`, `version`, `description`, `keywords`
- [ ] `description` in both files — skill.json description for registry search, SKILL.md description for Claude auto-invocation (they serve different purposes and can differ)
- [ ] Keywords include at least one canonical slug
- [ ] Dependencies declared if the skill relies on other published skills
- [ ] System dependencies declared if external CLIs are required
- [ ] Skill name is lowercase-with-hyphens, matching the directory name
- [ ] Version starts at `0.1.0` for new skills
