# happyskills-design — CLI Reference

Detailed CLI syntax and JSON response shapes for the commands design runs internally. SKILL.md has the workflows; this file has the exact flag semantics and response shapes.

Most of design's work is file editing (Write, Edit). The one CLI command design owns is `init`. Design also runs `validate` from within its workflows — `validate`'s flags and shape are documented in `happyskills-publish/references/cli-reference.md` (publish owns the `validate` verb).

## Envelopes

Every `--json` response is the canonical six-key envelope `{ ok, data, error, next_step, warnings, meta }`:

- `ok` — `true` on success, `false` on failure.
- `data` — **always an object** (never null, never a bare array; a top-level array payload is wrapped as `data.results`).
- `error` — `{}` on success, else `{ code, message, details? }`. The exit/HTTP status is in **`meta.exit_code`**, never inside `error`.
- `next_step` — `{}` when none, else a closed-enum `{ kind, action, instructions, context }`; dispatch on `next_step.action`.
- `warnings` — array of non-fatal advisories; surface them to the user.
- `meta` — includes `command`, `cli_version`, `exit_code`, `envelope_schema_version`.

The per-command examples below show only the `data` payload — assume the six-key wrapper around each.

---

## init

Scaffold a new skill or kit directory. Used by the Authoring Workflow (SKILL.md Section 2 step 3) and the Kit Workflows — Create (SKILL.md Section 6).

```bash
npx happyskills init my-skill --json              # named skill
npx happyskills init --json                        # use current directory name
npx happyskills init my-skill -g --json            # global
npx happyskills init my-kit --kit --json           # scaffold a kit
```

For kits, `--kit` flips the scaffolded `skill.json` to `"type": "kit"` and produces a plain `README.md` instead of a `SKILL.md`. Kits never ship a `SKILL.md` — its absence is what keeps the kit invisible to every agent runtime (Claude Code, Codex, Gemini, etc.). The user invokes a kit by name via `install`.

### JSON shape

```json
{
  "data": {
    "name": "skill-name",
    "type": "skill",
    "files_created": ["skill.json", "SKILL.md"],
    "directory": "/absolute/path"
  }
}
```

- `name`: the skill or kit name (lowercase-with-hyphens)
- `type`: `"skill"` (default) or `"kit"` (when `--kit` flag is used)
- `files_created`: list of files written by init
- `directory`: absolute path to the new skill/kit directory

### Result formatting

- For a skill: `"Created new skill '<name>' at <directory>"` with the file list (`files_created` — typically `["skill.json", "SKILL.md"]`).
- For a kit: `"Created new kit '<name>' at <directory>"` (`files_created` is `["skill.json", "README.md"]`). Remind the user that the next step is to populate `dependencies` in `skill.json` (or run the Kit Creation Workflow which does this for them).

### Common errors

- `"skill.json already exists"` — the directory already has a skill. Suggest a different name or directory.
- `USAGE_ERROR` (exit code 2) — the name is invalid (must be lowercase-with-hyphens) or the target path is not writable. Reformat and retry.
