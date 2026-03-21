# HappySkills CLI — JSON Response Shapes

All responses from `npx happyskills <command> --json`.

## Envelopes

**Success**: `{ "data": { ... } }`
**Error**: `{ "error": { "code": "...", "message": "...", "exit_code": N } }`

Error codes: `ERROR` (1), `USAGE_ERROR` (2), `AUTH_REQUIRED` (3), `NETWORK_ERROR` (4), `INTERACTIVE_REQUIRED` (1), `API_ERROR` (1).

---

## login

```json
{ "data": { "status": "already_logged_in", "username": "...", "email": "..." } }
```

Or if not logged in:

```json
{ "error": { "code": "INTERACTIVE_REQUIRED", "message": "Login requires browser interaction...", "exit_code": 1 } }
```

## logout

```json
{ "data": { "status": "logged_out" } }
```

## whoami

```json
{ "data": { "username": "...", "email": "...", "workspaces": [{ "slug": "...", "type": "personal|org" }] } }
```

## search

```json
{ "data": { "query": "...", "scope": "all", "results": [{ "skill": "owner/name", "description": "...", "version": "...", "visibility": "public", "type": "skill" }], "count": 3 } }
```

- `query`: search term or `null` in browse mode
- `scope`: `public`, `mine`, `personal`, or `all`
- `visibility`: `public`, `workspace`, or `private`
- `version`: extracted from `latest_version` (API derives from `default_ref`)
- `type`: `"skill"` or `"kit"`. Filter with `--type kit` to show only kits.

## list

```json
{
  "data": {
    "skills": {
      "owner/name": { "version": "1.0.0", "source": "direct|dep", "status": "installed|missing", "type": "skill|kit" }
    },
    "external": [{ "name": "skill-name", "description": "..." }]
  }
}
```

`source`: "direct" = explicitly installed, "dep" = transitive dependency.
`type`: `"skill"` or `"kit"`. Kits are shown with a `[kit]` badge in the list output.
`external`: skills found on disk but not in lock file.

## install (with skill argument)

```json
{ "data": { "skill": "owner/name", "version": "1.0.0", "installed": [...], "skipped": [...], "warnings": [...], "forced": [...] } }
```

## install (no argument — from manifest/lock)

```json
{ "data": { "installed": [...], "skipped": [...] } }
```

## uninstall

```json
{ "data": { "skill": "owner/name", "removed": [...], "orphans_pruned": [...] } }
```

## check

```json
{
  "data": {
    "results": [{ "skill": "owner/name", "installed": "1.0.0", "latest": "1.1.0", "status": "up-to-date|outdated|unknown|error" }],
    "outdated_count": 2,
    "up_to_date_count": 3
  }
}
```

## update

```json
{
  "data": {
    "updated": [{ "skill": "owner/name", "from": "1.0.0", "to": "1.1.0" }],
    "already_up_to_date": [{ "skill": "owner/name", "version": "1.0.0" }],
    "count": 1
  }
}
```

## init

```json
{ "data": { "name": "skill-name", "type": "skill", "files_created": ["skill.json", "SKILL.md"], "directory": "/absolute/path" } }
```

`type`: `"skill"` (default) or `"kit"` (when `--kit` flag is used).

## bump

```json
{ "data": { "skill": "skill-name", "old_version": "1.0.0", "new_version": "1.1.0", "bump_type": "patch|minor|major|explicit" } }
```

## publish

```json
{ "data": { "skill": "owner/name", "version": "1.0.0", "ref": "refs/tags/v1.0.0", "bumped_from": "0.9.0"|null } }
```

## convert

```json
{ "data": { "skill": "owner/name", "version": "1.0.0", "workspace": "workspace-slug", "description": "..." } }
```

## fork

```json
{ "data": { "skill": "owner/name", "forked_version": "1.2.0", "new_version": "0.1.0", "workspace": "workspace-slug", "directory": "/absolute/path" } }
```

## setup

Installs `happyskillsai/happyskills` globally (`~/.claude/skills/`). Always installs the latest version.

```json
{ "data": { "skill": "happyskillsai/happyskills", "version": "1.2.0", "status": "installed" } }
```

Or if already current:

```json
{ "data": { "skill": "happyskillsai/happyskills", "version": "1.2.0", "status": "already_up_to_date" } }
```

`status`: "installed" = skill was freshly installed or upgraded, "already_up_to_date" = no change needed.

## self-update

Upgrades the `happyskills` CLI npm package itself to the latest version.

```json
{ "data": { "status": "already_up_to_date", "version": "0.2.0" } }
```

Or if an upgrade was applied:

```json
{ "data": { "status": "updated", "from": "0.2.0", "to": "0.3.0" } }
```

`status`: "already_up_to_date" = CLI is current, "updated" = CLI was upgraded. In non-json mode, npm install output streams directly to the terminal.

## delete

```json
{ "data": { "deleted": true, "skill": "owner/name" } }
```

Error — not found:

```json
{ "error": { "code": "NOT_FOUND", "message": "...", "exit_code": 1 } }
```

Error — forbidden:

```json
{ "error": { "code": "FORBIDDEN", "message": "...", "exit_code": 1 } }
```

Error — confirmation required (JSON mode without -y):

```json
{ "error": { "code": "CONFIRMATION_REQUIRED", "message": "...", "exit_code": 1 } }
```

## visibility

**Get current visibility:**

```json
{ "data": { "skill": "owner/name", "visibility": "public" } }
```

**Set visibility:**

```json
{ "data": { "skill": "owner/name", "visibility": "private" } }
```

**Error — not found:**

```json
{ "error": { "code": "NOT_FOUND", "message": "...", "exit_code": 1 } }
```

**Error — forbidden:**

```json
{ "error": { "code": "FORBIDDEN", "message": "...", "exit_code": 1 } }
```

## refresh

```json
{ "data": { "results": [{ "skill": "owner/name", "installed": "1.0.0", "latest": "1.1.0", "status": "outdated" }], "outdated_count": 1, "up_to_date_count": 2, "updated": [{ "skill": "owner/name", "from": "1.0.0", "to": "1.1.0" }], "already_up_to_date": [{ "skill": "owner/name2", "version": "2.0.0" }], "errors": [] } }
```

Combines `check` and `update --all`. `results` is the full check table. `updated` lists skills that were upgraded. `errors` lists skills that could not be checked or updated.
