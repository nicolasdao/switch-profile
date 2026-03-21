# Claude Code Skill Authoring — Complete Reference

Full specification for designing high-quality Claude Code skills. This covers the **Claude Code standard** (SKILL.md). For HappySkills-specific conventions (skill.json, dependencies, keywords, publishing), see [happyskills-conventions.md](happyskills-conventions.md).

---

## 1. File Structure

The [Agent Skills specification](https://agentskills.io/specification) defines three standard optional directories. HappySkills adds `skill.json` and `CHANGELOG.md` on top of this:

```
.claude/skills/<skill-name>/
├── SKILL.md                    # Required — main skill file
├── skill.json                  # HappySkills — manifest (name, version, description)
├── CHANGELOG.md                # HappySkills — version history
├── scripts/                    # Standard — executable code agents run
│   └── helper.sh               # Referenced via ${CLAUDE_SKILL_DIR}/scripts/helper.sh
├── references/                 # Standard — documentation loaded on demand
│   └── topic.md
├── assets/                     # Standard — static resources (templates, images, data files)
│   └── schema.json
└── ...                         # Custom directories are allowed when justified
```

### Standard directories

The spec defines three directories by **content type** ([source](https://agentskills.io/specification)):

| Directory | Purpose | Key trait |
|---|---|---|
| `scripts/` | Executable code (Python, Bash, JS) | **Executed** — code never loads into context, only output consumes tokens |
| `references/` | Documentation the agent reads when needed | **Read into context on demand** — not preloaded at activation |
| `assets/` | Static resources: templates, images, schemas, data files | **Copied/used in output** — not loaded into context |

> **Note on `templates/` vs `assets/`**: The Agent Skills spec uses `assets/` for templates and static resources. HappySkills and Claude Code docs also recognize `templates/` as a valid alternative when the directory exclusively contains boilerplate for Claude to fill in. Either name is acceptable — choose whichever is more descriptive for your content.

### Custom directories

The spec explicitly allows custom directories (`└── ...  # Any additional files or directories`). Use them when content genuinely does not fit `scripts/`, `references/`, or `assets/`. For example, Anthropic's official `skill-creator` skill uses an `agents/` directory for sub-agent prompt definitions — these aren't reference docs, scripts, or static assets, so a custom folder is justified ([source](https://github.com/anthropics/skills/tree/main/skills/skill-creator)).

**Decision framework — standard vs custom folder:**

1. Is it executable code the agent runs? → `scripts/`
2. Is it documentation the agent reads on demand? → `references/`
3. Is it a static resource used in output (template, image, schema)? → `assets/` (or `templates/`)
4. Does it not fit any of the above categories? → Custom directory with a self-documenting name
5. Is there only 1-2 supporting files? → Root level is fine (no subfolder needed)

**Common mistake**: Creating custom directories like `phases/`, `guides/`, or `protocols/` for content that is really reference documentation the agent reads on demand. If the agent reads a file into context during execution, it belongs in `references/` — possibly in a subdirectory like `references/phases/` for organization.

Keep `SKILL.md` under **500 lines**. Move heavy content to supporting files.

**Rule — All executable code goes in `scripts/`:** If the skill needs to execute code (Python, shell, Node.js, etc.) as part of its workflow, that code MUST live in actual executable files under `scripts/`. Code in markdown files is only for documentation, examples, and references to scripts — never for code that gets executed. This rule exists because:
- Scripts are executed directly — their code never loads into the context window, only their output consumes tokens
- Pre-made scripts don't drift, don't introduce variability, and don't waste context on code generation
- Embedded executable code gets manually transcribed by the LLM on each run, introducing subtle errors

Use `${CLAUDE_SKILL_DIR}` to reference bundled scripts at runtime. This variable resolves to the skill's directory path:

```bash
# Run a bundled Python script
python3 "${CLAUDE_SKILL_DIR}/scripts/extract_fields.py" --input form.pdf

# Run a bundled shell script
bash "${CLAUDE_SKILL_DIR}/scripts/deploy.sh" --env production
```

---

## 2. SKILL.md Structure

```yaml
---
name: skill-name
description: What this skill does and when to invoke it (auto-invocation trigger)
argument-hint: "[what arguments to pass]"
allowed-tools: Read, Grep, Glob, Bash
model: opus
context: fork
agent: Explore
# disable-model-invocation: true   ← ONLY add if user explicitly requests it
# user-invocable: false             ← ONLY add for background knowledge skills
---

# Skill Content

Your instructions, workflows, and knowledge here.
Use $ARGUMENTS, $0, $1, etc. for dynamic substitution.
```

---

## 3. Frontmatter Field Reference

| Field | Type | Default | Description |
|---|---|---|---|
| `name` | string | directory name | **Required.** Kebab-case name. Becomes `/skill-name` slash command. Max 64 chars. |
| `description` | string | — | **Required for auto-invocation.** What the skill does + when to use it. The #1 factor for auto-invocation quality. Without it, Claude cannot auto-invoke the skill. |
| `argument-hint` | string | — | Autocomplete hint, e.g. `[issue-number]` or `[source] [target]` |
| `disable-model-invocation` | boolean | `false` | If `true`, only the user can invoke. Claude cannot use automatically. Skill description hidden from context. |
| `user-invocable` | boolean | `true` | If `false`, hidden from `/` menu. Claude-only auto-invocation. |
| `allowed-tools` | string list | — | Tools usable without permission prompts when skill is active. |
| `model` | string | inherited | Model for this skill (e.g., `opus`, `sonnet`, `haiku`). |
| `context` | string | — | Set to `fork` to run in isolated subagent. |
| `agent` | string | — | Subagent type when `context: fork` (e.g., `Explore`, `Plan`, `general-purpose`). |

### Forbidden Characters in Frontmatter Values

YAML frontmatter values are **unquoted strings**. Several characters break the YAML parser or the skill discovery system, causing skills to be silently ignored with no error.

**Characters that MUST NOT appear anywhere in frontmatter values (especially `description`):**

| Character | Why It Breaks |
|---|---|
| `;` (semicolon) | Breaks skill discovery — skill is silently ignored |
| `:` (colon) | YAML key-value separator — causes parse errors or misinterpretation |
| `#` (hash) | YAML comment — everything after it is silently dropped |
| `{` `}` (braces) | YAML flow mapping — triggers object parsing |
| `[` `]` (brackets) | YAML flow sequence — triggers array parsing |
| `'` `"` (quotes) | Unmatched quotes cause parse errors |
| `!` (exclamation) | YAML tag indicator |
| `&` `*` (ampersand/asterisk) | YAML anchor/alias indicators |
| `%` (percent) | YAML directive indicator (at line start) |
| `|` `>` (pipe/angle) | YAML block scalar indicators (at start of value) |

**Safe characters:** letters, digits, spaces, periods (`.`), commas (`,`), hyphens (`-`), parentheses (`()`), forward slashes (`/`).

**Example:**

```yaml
# ❌ WRONG — colon and semicolon break the skill
description: Deploy apps to AWS: supports ECS; also Lambda

# ✅ CORRECT — use commas and natural phrasing
description: Deploy apps to AWS including ECS and Lambda
```

**Rule:** After writing any frontmatter value, scan it for the forbidden characters above. Replace colons with "including", "with", or restructure the sentence. Replace semicolons with periods or commas. Never use `#`, `{}`, `[]`, or unmatched quotes.

---

## 4. Invocation Models

Three modes for controlling who invokes a skill:

### Mode A — Default (both user and Claude)

```yaml
# No special flags needed
description: Explains code structure using diagrams
```

- User can run `/skill-name`
- Claude auto-invokes when description matches context
- **Use for**: Reference knowledge + helpful task automation

### Mode B — User-only (`disable-model-invocation: true`)

> **IMPORTANT — Do NOT set this by default.** When this flag is set, Claude cannot auto-invoke the skill AND the skill's description is completely hidden from Claude's context — Claude won't even know the skill exists. This is a common source of confusion ("why isn't my skill being invoked?"). Only set this when the user **explicitly** requests it. When creating, converting, or initializing a skill, always use AskUserQuestion to ask the user about their invocation preference with a clear explanation of the consequences (see Section 9, rule 5).

```yaml
disable-model-invocation: true
description: Deploy application to production
```

- Only the user can run `/skill-name`
- Claude CANNOT invoke automatically
- Skill description is NOT in context (Claude won't know it exists)
- **Use for**: Deployments, commits, releases, destructive operations — any workflow with side effects the user must consciously trigger

### Mode C — Claude-only (`user-invocable: false`)

```yaml
user-invocable: false
description: Background context about our legacy authentication system
```

- Skill is hidden from `/` menu (user cannot invoke directly)
- Claude auto-invokes when description matches
- **Use for**: Architectural context, coding conventions, domain knowledge, background that informs Claude's decisions without user action

---

## 5. Writing Effective Descriptions

The `description` field is the **#1 factor** in auto-invocation quality. Claude sees ONLY this one-line description when deciding whether to load the skill — it is the sole trigger signal.

**Good description formula:**
```
[Action verb] + [specific domain/tool] + [use case] + [natural-language trigger phrases]
```

**Example:**
```yaml
description: >
  Design RESTful API endpoints following project conventions. Use when
  creating new endpoints, standardizing APIs, or asking about naming
  conventions, HTTP methods, and status codes.
```

**What makes it good:**
- Action verb: "Design"
- Specific domain: "RESTful API endpoints"
- Use case context: "following project conventions"
- Natural-language triggers: "creating new endpoints", "naming conventions"

### Trigger Phrase Resilience

Users do NOT always phrase requests as imperative commands. A description that only matches "Extract X from Y" will miss "I extracted X from Y", "can you extract X?", or "I need X extracted from Y". The LLM matches descriptions semantically, but tense and phrasing variations can still cause misses — especially when the phrasing sounds like a status update rather than a request.

**Cover these phrasing families in your description or auto-discovery list:**

| Phrasing Family | Example | Why It Gets Missed |
|---|---|---|
| Past tense statement | "I extracted the style guide" | LLM reads it as "already done", not a request |
| Question form | "Can you analyze this design?" | Softer intent signal than a command |
| Declaration of need | "I need a style guide from this site" | No action verb at the start |
| Noun-phrase shorthand | "Style guide for this URL" | No verb at all |
| Progressive tense | "I'm extracting styles from..." | Ambiguous — in progress or requesting? |

**How to apply:**

1. **In the SKILL.md auto-discovery section**, list trigger phrases across multiple tenses and forms, not just imperative. Example:
   ```markdown
   **Auto-discovered when user says:**
   - "Extract a style guide from [URL]"
   - "Extracted the style guide for [URL]"
   - "I need a style guide from [URL]"
   - "Style guide for [URL]"
   - "Analyze the design of [URL]"
   ```

2. **In the frontmatter `description`**, include a mix of verb forms if space allows. Example:
   ```yaml
   description: >
     Extract style guides from website URLs. Use when extracting, analyzing,
     or creating style guides and design systems from any website URL.
   ```

3. **Mental test**: For each trigger phrase, ask: "If a user said this with a URL attached, would the LLM recognize my skill?" If not, add the missing phrasing.

**Common mistakes:**
- Too vague: `description: Technical coding tool` → Claude won't know when to use it
- No trigger phrases: Wall of prose with no keywords users would naturally say
- Wrong scope: Description says "deploy" but skill also handles monitoring
- Imperative-only triggers: Only matching "do X" but missing "I did X", "can you do X", "I need X done"

---

## 6. String Substitutions

| Variable | Description |
|---|---|
| `$ARGUMENTS` | All user-provided arguments as a single string |
| `$0`, `$1`, `$2` ... | Individual arguments by 0-based index |
| `$ARGUMENTS[N]` | Equivalent to `$N` |

**If `$ARGUMENTS` is NOT in SKILL.md**: Arguments are appended automatically as `ARGUMENTS: <input>`.

**If `$ARGUMENTS` IS present**: It's replaced with the full user input string.

**Example:**
```yaml
---
name: migrate
argument-hint: "[component-name] [from-format] [to-format]"
---
Migrate the $0 component from $1 to $2 format.
```

`/migrate Button React Vue` → "Migrate the Button component from React to Vue format."

---

## 7. Supporting Files & Progressive Disclosure

Skills use a **progressive disclosure** model — content loads in stages, not all at once ([source](https://agentskills.io/specification)):

| Level | What loads | When | Token budget |
|---|---|---|---|
| 1. Metadata | `name` + `description` from frontmatter | At startup, for ALL installed skills | ~100 tokens per skill |
| 2. Activation | Full SKILL.md body | When skill is invoked or auto-triggered | < 5,000 tokens recommended |
| 3. Execution | Files from `references/`, `scripts/`, `assets/`, etc. | Only when the agent determines they are needed | As needed |

This is why keeping SKILL.md under 500 lines matters — it loads entirely at Level 2. Supporting files only load at Level 3 when explicitly referenced.

### Referencing supporting files

Claude loads supporting files **on demand** — not every invocation. Reference them in SKILL.md with **conditional links** that tell the agent *when* to load each file ([source](https://agentskills.io/skill-creation/best-practices)):

```markdown
## Additional resources
- Read [references/api-errors.md](references/api-errors.md) if the API returns a non-200 status code
- For complete field details, see [references/api-reference.md](references/api-reference.md)
- For usage examples, see [examples.md](examples.md)
```

Conditional links ("read X **if** Y happens") are more effective than generic "see references/ for details" because they help the agent decide when loading is worthwhile.

### File reference depth

Keep file references **one level deep** from SKILL.md. Avoid deeply nested reference chains where file A references file B which references file C ([source](https://agentskills.io/specification)). Subdirectories within `references/` are fine (e.g., `references/phases/01.md`) — the rule is about chain depth, not directory depth.

### When to create supporting files

| Content Type | Location | Reasoning |
|---|---|---|
| Detailed specs, API docs, domain knowledge | `references/<topic>.md` | Documentation read into context on demand |
| Organized reference subdomain | `references/<category>/<topic>.md` | Subdirectories keep large reference sets manageable |
| Executable code (Python, shell, JS) | `scripts/<name>.py`, `.sh`, or `.js` | Executed, not loaded into context. Reference via `${CLAUDE_SKILL_DIR}/scripts/` |
| Templates, boilerplate for output | `assets/<name>.md` or `templates/<name>.md` | Static resources used in generated output |
| Images, schemas, data files | `assets/<name>` | Static resources, not loaded into context |
| Usage examples (1-2 files) | `examples.md` or `examples/<name>.md` | Root-level file is fine for small sets |

### Organizing large skills with many supporting files

For skills with 10+ supporting files, organize them into the standard directories rather than leaving them at the skill root. A flat list of 15+ `.md` files alongside SKILL.md makes it hard to understand the skill's structure at a glance.

**Example — a complex skill with well-organized supporting files:**

```
my-complex-skill/
├── SKILL.md                           # Routing + core instructions (< 500 lines)
├── skill.json
├── references/                        # All documentation the agent reads on demand
│   ├── philosophy.md
│   ├── api-reference.md
│   ├── error-handling.md
│   └── phases/                        # Subdirectory for sequential docs
│       ├── 01-analysis.md
│       ├── 02-extraction.md
│       └── 03-validation.md
├── scripts/                           # All executable code
│   ├── extract.py
│   └── validate.sh
└── templates/                         # Output boilerplate
    ├── report.md
    └── summary.md
```

Compare with what to **avoid** — everything dumped at root:

```
my-complex-skill/
├── SKILL.md
├── philosophy.md                      # Reference doc... at root
├── api-reference.md                   # Reference doc... at root
├── error-handling.md                  # Reference doc... at root
├── 01-analysis.md                     # Reference doc... at root
├── 02-extraction.md                   # Reference doc... at root
├── 03-validation.md                   # Reference doc... at root
├── extract.py                         # Script... at root
├── validate.sh                        # Script... at root
├── report.md                          # Template... at root
└── summary.md                         # Template... at root
```

The second structure provides no signal about what each file does or when to load it.

---

## 8. Advanced Patterns

### Shell Preprocessing (`!` backtick syntax)

Run shell commands BEFORE the skill is sent to Claude. Prefix with `!` followed by a backtick-quoted command:

```markdown
## Current State

Git status:
!`git status --short`

Last 5 commits:
!`git log --oneline -5`
```

Claude Code executes these `!`command`` expressions during preprocessing and replaces them with the command output. Claude sees the rendered result, not the command.

**Use for**: Live system state, config values, metrics, API responses injected at skill load time.

**Important**: The `!` prefix is required. Plain backtick-quoted text without `!` is treated as normal inline code, not a preprocessing command.

### Isolated Subagent (`context: fork`)

Run the skill in an isolated subagent with its own tools and model:

```yaml
---
name: security-audit
context: fork
agent: general-purpose
---
Audit this codebase for security vulnerabilities...
```

**Built-in agent types:**

| Agent | Tools Available | Use For |
|---|---|---|
| `Explore` | Read, Grep, Glob, WebFetch, Task | Read-only research, codebase investigation |
| `Plan` | Bash, Read, Glob, Task | Planning and analysis |
| `general-purpose` | All standard tools | Full implementation work |

**Use for**: Research tasks, large file scans, parallel work, isolation from main context.

### Extended Thinking

Include the word **`ultrathink`** anywhere in the skill content to enable Claude's extended reasoning mode:

```markdown
Use ultrathink to analyze the architectural trade-offs...
```

**Use for**: Complex analysis, architectural decisions, difficult debugging.

---

## 9. Best Practices

1. **SKILL.md under 500 lines** — Use supporting files for anything longer.
2. **Specific, keyword-rich descriptions** — Include words and phrases users would naturally say.
3. **Always add a Constraints section** — Prevents hallucinated commands and misuse.
4. **Include verification steps** — "Run tests", "check exit code", "show output". Silent failures are worse than visible errors.
5. **NEVER set `disable-model-invocation: true` unless the user explicitly asks for it.** When creating, converting, or initializing a skill, always ask the user with AskUserQuestion: "Should Claude be able to auto-invoke this skill, or should it be user-only (manual /slash command)?" with these options:
   - **"Auto-invoke (Recommended)"** — Claude invokes when relevant. Best for most skills.
   - **"User-only (/slash command)"** — Only you can trigger it. Claude won't know it exists. Use for deployments, releases, or destructive operations.
   Default to auto-invoke. Only set the flag if the user picks "User-only".
6. **Use `user-invocable: false` for background knowledge** — Architectural context, conventions, domain knowledge.
7. **Split large domains into a skill suite** — Three focused 150-line skills > one 500-line skill.
8. **Name supporting files clearly** — `json-shapes.md`, `api-reference.md`, not `stuff.md`.
9. **Organize supporting files by content type** — Use `references/` for docs, `scripts/` for code, `assets/`/`templates/` for static resources. Only create custom directories when content genuinely doesn't fit these standard categories.
10. **Use conditional file references** — "Read `references/errors.md` if the API returns non-200" is better than "see references/ for details."
11. **Idempotent workflows** — "Check if already done, skip if so." Safe to re-run.
12. **Show what will happen before doing it** — Use AskUserQuestion for destructive or irreversible ops.

---

## 10. Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Vague description (`"Coding tool"`) | Claude never auto-invokes | Add action verbs and specific domain keywords |
| SKILL.md > 500 lines | Context bloat, slow loading | Move content to supporting files |
| No Constraints section | Hallucinated flags and misuse | Add explicit "never do X" rules |
| No verification steps | Silent failures | Add "run tests / check output" after actions |
| `disable-model-invocation: true` on a safe reference skill | User must manually invoke every time | Remove flag for knowledge-only skills |
| Missing `argument-hint` when skill takes args | Poor UX — user doesn't know what to type | Add `argument-hint: "[what to pass]"` |
| Two skills with identical description topics | Both trigger or neither triggers | Differentiate descriptions; split by domain |
| Task skill with no clear end state | Claude doesn't know when it's done | Define explicit success criteria |
| Executable code embedded in markdown instead of `scripts/` | Code drifts from what works, wastes context tokens, introduces variability on every run | All executable code goes in `scripts/`. Code in markdown is only for documentation, examples, and references to scripts. Reference via `${CLAUDE_SKILL_DIR}/scripts/` |
| Many supporting files dumped at skill root | No signal about file purpose or when to load each file, hard to navigate | Organize into `references/`, `scripts/`, `assets/`/`templates/`. Use root only for 1-2 files |
| Custom directories for content that fits standard folders | Misleading structure — suggests a distinct content type when there isn't one | Use `references/` for docs, `scripts/` for code, `assets/` for static resources. Only create custom dirs for genuinely distinct content categories |
| Deeply nested reference chains (A → B → C → D) | Agent may lose context traversing multiple hops | Keep references one level deep from SKILL.md. Subdirectories are fine, but avoid chains of files referencing other files |

---

## 11. Design Patterns

### Pattern 1 — Reference Skill (Knowledge Only)

```yaml
---
name: api-conventions
description: Project API conventions for naming, HTTP methods, status codes, error format
user-invocable: false
---

When designing endpoints:
- Resources are plural nouns (users, not user)
- Properties use camelCase
- Errors follow { error: { code, message } } format
...
```

Claude consults this automatically when working on API code. User never needs to invoke it.

---

### Pattern 2 — Task Workflow (User-Controlled)

```yaml
---
name: release
description: Release a new version of the CLI
disable-model-invocation: true
allowed-tools: Bash, Read, Edit
argument-hint: "[patch|minor|major]"
---

1. Check git status is clean
2. Update CHANGELOG.md
3. Bump version ($0)
4. Commit and tag
5. Show release summary
```

User triggers `/release patch`. Claude won't do this accidentally.

---

### Pattern 3 — Hybrid (Knowledge + Workflow)

```yaml
---
name: code-review
description: Review code against project standards. Use when reviewing PRs or code quality.
---

## Our Standards

[conventions content]

## Review Process

1. Check against standards above
2. Look for edge cases
3. Verify test coverage
4. Output findings by severity
```

---

### Pattern 4 — CLI Wrapper

```yaml
---
name: my-tool
description: Automate my-tool CLI via natural language
allowed-tools: Bash, AskUserQuestion
---

## Routing

Map user intent → CLI commands:
| User Intent | Command |
|---|---|
| "search" | `my-tool search "<query>" --json` |
| "install" | `my-tool install <name> --json` |

## Constraints

- ALWAYS use `--json` flag
- NEVER run destructive commands without AskUserQuestion confirmation
- NEVER fabricate flags not listed above
```

---

### Pattern 5 — Skill Suite (Multiple Focused Skills)

Instead of one large skill:

```
.claude/skills/
├── react-patterns/       # Reference: component conventions (user-invocable: false)
├── react-testing/        # Reference: testing patterns (user-invocable: false)
├── react-migrate/        # Task: migration workflow (disable-model-invocation: true)
└── react-optimize/       # Task: performance optimization
```

Each skill is focused, small, and has a precise description for accurate auto-invocation.

---

## 12. Size Guidelines

| Skill Type | Target Size | Rule |
|---|---|---|
| Reference (knowledge only) | < 300 lines | Move details to `references/` |
| Task (workflow only) | < 300 lines | Each step should be a single line |
| Hybrid (both) | < 500 lines | Split into two skills if approaching limit |
| Supporting files | < 400 lines each | Split by topic if larger |

> Supporting files can be larger than SKILL.md because they only load on demand, not every invocation.

---

## 13. Skill Scoping & Locations

| Scope | Location | Who Can Use |
|---|---|---|
| Personal | `~/.claude/skills/` | You, across all projects |
| Project | `.claude/skills/` | Current project only |
| Enterprise | Managed settings | All org users |

**Precedence**: Enterprise > Personal > Project. When skill names conflict, higher priority wins.

**In monorepos**: Claude auto-discovers skills in parent directories. A skill in `packages/frontend/.claude/skills/` is available when editing files in that package.

---

## 14. Allowed Tools Syntax

```yaml
# Basic tools
allowed-tools: Read, Grep, Glob, Bash, Edit, Write

# With command restrictions
allowed-tools:
  - Bash(npm run *)
  - Bash(git commit *)
  - Read
  - Grep
```

Restricting to `Bash(npm run *)` means Claude can run `npm run test` but not arbitrary bash commands.

---

## 15. Context Budget for Descriptions

Claude allocates ~2% of its context window for all skill descriptions combined. If you have many skills:

- Descriptions that exceed the budget are excluded (least-used skills dropped first)
- Keep descriptions concise but keyword-rich — don't pad with filler
- Minimum budget: 16,000 characters (fallback)
- Override with `SLASH_COMMAND_TOOL_CHAR_BUDGET` env variable if needed

**Rule of thumb**: If you have 20+ skills, keep each description under 200 characters.

---

## 16. Testing Your Skill

### Verify Auto-Invocation

1. **Ask naturally**: Say something that should match your description
2. **Check if Claude loads the skill**: It should appear in the response context
3. **If not triggering**: Add more keywords to description that users would naturally say
4. **Use `/context`**: Run `/context` in Claude Code to see which skills are currently active

### Verify Manual Invocation

1. Run `/skill-name` and check that it loads
2. Run `/skill-name some arguments` and verify `$ARGUMENTS` substitution works
3. Check that `allowed-tools` grants the right permissions

### Common Debugging

| Symptom | Likely Cause | Fix |
|---|---|---|
| Skill never auto-invokes | No frontmatter or missing `description` field | Add YAML frontmatter with `name` and `description` |
| Skill never auto-invokes | Description too vague or missing trigger phrases | Add specific keywords users would say |
| Skill triggers for wrong requests | Description overlaps with another skill | Differentiate descriptions; narrow scope |
| Skill not in `/` menu | `user-invocable: false` is set | Remove the flag if user should invoke |
| Claude can't find skill | Wrong directory or naming | Check `.claude/skills/<name>/SKILL.md` path |
| Subagent mode fails | Missing `context: fork` or wrong `agent` type | Verify both fields are set correctly |

---

## 17. Sources

This document synthesizes guidance from the following authoritative sources:

| Source | URL | Covers |
|---|---|---|
| Agent Skills Specification | https://agentskills.io/specification | Directory structure, frontmatter fields, standard directories, progressive disclosure, file references |
| Agent Skills Best Practices | https://agentskills.io/skill-creation/best-practices | Context efficiency, progressive disclosure, conditional references, calibrating control |
| Claude Code Skills Documentation | https://code.claude.com/docs/en/skills | Skill locations, invocation control, supporting files, subagent execution, string substitutions |
| Anthropic Official Skills Repo | https://github.com/anthropics/skills | Reference implementations (skill-creator, pdf, docx, webapp-testing) |
