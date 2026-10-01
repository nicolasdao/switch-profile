# Documentation Diagnostic Checklist

This checklist enumerates the Phase 1 diagnostic checks. As of update-doc 1.7.0 the checks are split by **who produces them**:

- **🛠 Script-produced (mechanical).** Checks 1, 2, 3, 4, and 6 are computed deterministically by the manifest generator (`../../init-doc/scripts/build-doc-manifest.py`) and read by the master agent straight from `doc-manifest.json` — its per-node fields (`line_count`/`over_size`, `toc`, `links_to`, `source`/`source_unresolved`/`dangling`) and its top-level `diagnostics` block (gotchas hub↔domain sync, README orphans). The Phase 1 sub-agent does **not** run these. They remain documented here as the contract the script implements (and as the fallback checklist when Python is unavailable).
- **🧠 Sub-agent (judgment).** Check 5 (Content Staleness Indicators) requires LLM judgment the manifest cannot make — it is the only check the Phase 1 sub-agent runs.

The mapping of mechanical checks to manifest fields:

| Check | Manifest field(s) |
|---|---|
| 1. Line Count | per-node `line_count`, `over_size` |
| 2. Table of Contents (README only) | per-node `toc.present` / `toc.linked` / `toc.stale` (authoritative for `README.md`; informational elsewhere) |
| 3. Cross-Links | per-node `links_to` |
| 4. Gotchas Structure | top-level `diagnostics.gotchas` (`format`, `orphaned_domain_files`, `dead_hub_links`, `oversized_domain_files`) |
| 6. Frontmatter and Source Mapping | per-node `has_frontmatter`, `source`, `source_unresolved`, `dangling` |

## Per-File Checks

### 1. Line Count 🛠 script-produced

Count the total lines in the file.

| File | Guardrail | Action if exceeded |
|---|---|---|
| README.md | 750 lines | Must split — identify sub-concerns to extract into docs/ files |
| docs/*.md | 750 lines | Must split — extract sub-topics into new focused files |
| docs/gotchas.md (hub) | 50 lines | Hub is too large — it should be purely navigational |

Report: `{ file, line_count, limit, over_limit: true/false }`

### 2. Table of Contents 🛠 script-produced (README only)

**Only `README.md` carries a TOC, and the generator owns it** — it regenerates the README's `<!-- BEGIN toc -->…<!-- END toc -->` block from the README's headings, so the TOC is single-sourced and cannot go stale (see [../../init-doc/references/standards.md § Table of Contents Rule](../../init-doc/references/standards.md#table-of-contents-rule)). There is no per-file TOC action for the agent to take: the README TOC is fixed by re-running the generator, and **`docs/*.md`, `docs/mission.md`, and gotchas domain files carry no TOC**.

The manifest's per-node `toc` (`present` / `linked` / `stale`) is therefore **authoritative for `README.md`** (where `--check` enforces it) and **informational elsewhere** — a leftover legacy TOC in a topic doc is not a compliance issue and needs no fix.

Report (README): `{ file: "README.md", toc: { present, linked, stale } }` — `stale: true` only ever means "re-run the generator".

### 3. Cross-Links 🛠 script-produced

Check whether the file links to other docs/ files and whether other files link back to it.

- Every docs/ file should be linked from README.md
- docs/ files should cross-link to related docs/ files where relevant

Report: `{ file, linked_from_readme: true/false, cross_links_to: [files], cross_linked_from: [files] }`

### 4. Gotchas Structure 🛠 script-produced

Determine which gotchas architecture the project uses and audit its integrity.

**Step 4a — Detect format:**
- Check if `docs/gotchas/` directory exists with at least one `.md` file
  - YES → hub+domain format
  - NO → monolithic format (or missing entirely)

**Step 4b — Hub check:**
- Does `docs/gotchas.md` exist?
  - If NO → flag for creation (regardless of format)

**Step 4c — Hub+domain integrity** (only if hub+domain format detected):
- List all `.md` files in `docs/gotchas/`
- For each domain file: check if the hub `docs/gotchas.md` contains a link to it
- For each link in the hub: check if the target domain file exists
- Flag any domain file over 750 lines
- Report mismatches as deterministic fixes (not judgment calls)

**Step 4d — Monolithic size warning** (only if monolithic format):
- If `docs/gotchas.md` exists and exceeds 750 lines, report the line count (the master agent may suggest `/refactor-doc`)

Report:
```
{
  format: "hub+domain" / "monolithic" / "missing",
  hub_exists: true/false,
  domain_dir_exists: true/false,
  domain_files: [list],
  hub_links: [list],
  orphaned_domain_files: [files in dir but not in hub],
  dead_hub_links: [links in hub with no matching file],
  oversized_domain_files: [{ file, line_count }],
  monolithic_line_count: N (if monolithic),
  action: "none" / "create_hub" / "create_dir" / "sync_hub" / "create_hub_and_dir"
}
```

### 5. Content Staleness Indicators 🧠 sub-agent (judgment)

Scan each file for patterns that may be stale after code changes:

- **Numeric claims**: patterns like "N commands", "M endpoints", "K modules", "N options"
- **File references**: mentions of source files that may have been renamed or deleted
- **Feature descriptions**: descriptions of behavior that may have changed
- **Code examples**: inline code snippets that may no longer match the codebase

Report per file: `{ file, numeric_claims: [...], file_references: [...], potential_stale_sections: [...] }`

### 6. Frontmatter and Source Mapping 🛠 script-produced

Capture each doc's `source` mapping so the master agent can do deterministic diff→doc mapping and coverage checks without re-reading the corpus (per [../../init-doc/references/standards.md § Frontmatter](../../init-doc/references/standards.md#frontmatter)).

- Detect a YAML frontmatter block (delimited by `---`) before the h1.
- If present, extract the `source` globs (and `description`/`tags` if present).
- For each `source` glob, **resolve** it with the Glob tool — does it hit at least one real file on disk under the project root? (*Resolve* vs *match* are defined in [../../init-doc/references/standards.md § `source` semantics](../../init-doc/references/standards.md#source-semantics).)

Exempt files (`README.md`, the `docs/gotchas.md` hub, `docs/mission.md`) are expected to carry no `source` — report them as `has_frontmatter` per their actual state but never flag the absence.

Report per file: `{ file, has_frontmatter: true/false, source_globs: [...], unresolved_globs: [globs that do not resolve], dangling: true/false }`

`dangling` is true only when the file declares `source` globs and **none** of them resolve (the documented code is gone).

## Aggregate Report Structure

The diagnostic sub-agent should return a single structured summary:

```
DIAGNOSTIC REPORT
=================

FILES SCANNED: [list of all doc files found, including docs/gotchas/*.md]

COMPLIANCE ISSUES (deterministic — must fix):
- [file]: Over size limit / Not linked from README (the README TOC is generator-owned, not a per-file fix)

GOTCHAS STATUS:
  Format: hub+domain / monolithic / missing
  Hub: exists / missing (must create)
  Domain dir: exists / missing / N/A (monolithic)
  Domain files: [list] / N/A
  Sync issues: [orphaned files, dead links] / none / N/A
  Oversized domain files: [list] / none / N/A
  Monolithic line count: N / N/A

CONTENT REVIEW NEEDED (requires LLM judgment):
- [file]: [list of numeric claims, file references, potential stale sections]

CROSS-LINK MAP:
- README.md links to: [files]
- [doc file] links to: [files]
- ORPHANED (not linked from README): [files]

SOURCE MAP (frontmatter):
- [doc file]: source = [globs] | unresolved = [globs] | dangling: yes/no
- [doc file]: no frontmatter (prose-fallback)
```
