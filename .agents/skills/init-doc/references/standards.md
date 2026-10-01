# Documentation Standards

This file is the canonical source of truth for documentation standards used across the `init-doc`, `update-doc`, and `init-mission` skills. Each of those skills references this file rather than duplicating the rules. Edits here apply everywhere automatically.

## Table of Contents
- [File Structure](#file-structure)
- [Size Guardrails](#size-guardrails)
- [Frontmatter](#frontmatter)
- [Documentation Manifest](#documentation-manifest)
- [Table of Contents Rule](#table-of-contents-rule)
- [Cross-Linking](#cross-linking)
- [Gotchas Structure](#gotchas-structure)
- [Writing Standards](#writing-standards)
- [Protected Files](#protected-files)
- [Project Root Determination](#project-root-determination)

## File Structure

| Element | Required location |
|---|---|
| Documentation hub | `README.md` at the project root |
| Topic files | `docs/<topic>.md` — one concern per file |
| Mission document (optional) | `docs/mission.md` |
| Gotchas hub | `docs/gotchas.md` |
| Gotchas domain files | `docs/gotchas/<domain>.md` (hub+domain mode only) |
| Retrieval manifest (derived) | `doc-manifest.json` at the project root — generated, never hand-edited (see [§ Documentation Manifest](#documentation-manifest)) |

## Size Guardrails

Soft limits — exceeding signals the file covers multiple concerns and should be split.

| File | Soft limit | Rationale |
|---|---|---|
| `README.md` | 750 lines | Hub document — must be self-sufficient as entry point, especially for monorepos |
| `docs/*.md` | 750 lines | Technical docs need room for code examples, but single-concern coherence must hold |
| `docs/gotchas.md` (hub+domain mode) | 50 lines | Navigational index only — all content lives in domain files |
| `docs/gotchas.md` (monolithic / legacy mode) | 750 lines | Treated as a normal docs/ file. If exceeded, refactor to hub+domain via `/refactor-doc` |
| `docs/mission.md` | 150 lines | Mission must be concise and undiluted; stricter than other docs |

Guardrails are soft. A 780-line file covering one cohesive topic is fine; a file that keeps growing across maintenance cycles is a file that needs splitting. **Single-concern coherence is the primary driver — line count is the check-yourself moment.**

## Frontmatter

A documentation file MAY open with a YAML frontmatter block (delimited by `---`) before its h1. The block is machine-read — humans and the rendered markdown ignore it. It exists to make judgment calls deterministic. The **primary reader is the manifest generator** ([`build-doc-manifest.py`](../scripts/build-doc-manifest.py)): it parses every doc's frontmatter and folds it into `doc-manifest.json` (see [§ Documentation Manifest](#documentation-manifest)), the index the other skills actually load. Those downstream consumers — `update-doc` (uses `source` to map a code change to the docs it affects and to detect orphaned/dangling docs), `project-memory` Inspect (compares `source` against git history to flag staleness), and both `init-context` recall and `project-memory` query (rank a doc on `description`/`tags`) — read the **manifest** on the primary path, and read frontmatter headers directly only as a fallback when no manifest is present.

| Field | Type | Meaning |
|---|---|---|
| `description` | string | One-sentence summary of what the doc covers. Read by `init-context` (recall) and `project-memory` (query) to rank a doc from its header without opening it. |
| `tags` | list of strings | Cross-cutting labels (e.g. auth, payments, deployment) for retrieval that crosses the hub hierarchy. Read alongside `description` for relevance scoring. |
| `source` | list of glob patterns | The source files and directories this doc documents, relative to the project root (e.g. `src/billing/**`, `src/webhooks/stripe.ts`). **The load-bearing field** — it maps a doc to the code it describes. |
| `group` | string (optional) | Structural-cluster override for a **source-less** doc in a monorepo (see [§ Documentation Manifest](#documentation-manifest)). A doc's group is normally *derived* from where its `source` globs fall; set this only when a doc has no `source` yet must belong to a specific group. Ignored in single-project repos. |

Example header on a topic file:

```markdown
---
description: How charges are computed, retried, and reconciled.
tags: [payments, billing, stripe]
source:
  - src/billing/**
  - src/webhooks/stripe.ts
---

# Billing and Invoicing
...
```

Why `source` matters: a code change either intersects a doc's `source` globs or it does not. That lets `update-doc` map a `git diff` to the affected docs by set membership instead of inference, and detect both undocumented code (changed paths no doc covers) and orphaned docs (a doc whose `source` paths no longer exist).

Rules:

- **Optional, but validated when present.** A doc with no frontmatter is still conformant — the skills fall back to prose-based relevance and impact judgment. This keeps corpora bootstrapped before frontmatter existed fully usable.
- When present, the block MUST be parseable YAML, and a doc that documents specific code SHOULD declare `source`.
- `source` globs are project-root-relative and use standard glob syntax. Every glob SHOULD **resolve** at write time (hit at least one real file on disk) — a glob that resolves to nothing is a defect to fix or remove.
- **Unknown keys are preserved, not rejected.** Producers MAY add fields; consumers ignore what they do not recognize.
- **Exempt files:** `README.md` (documents the whole project), the gotchas hub `docs/gotchas.md` (purely navigational), and `docs/mission.md` (documents intent, not code) do not carry `source`. Gotchas domain files SHOULD declare `source` for the subsystem they cover (a source-aware producer like `init-doc` emits it; a source-blind one like `refactor-doc` may leave it absent).

### `source` semantics

The determinism of the whole feature rests on these definitions. Where a skill says "resolve" or "match," it means exactly one of the two operations below — they are different and must not be conflated.

- **Resolve** — does a glob hit a file that exists **on disk right now**? Performed with the Glob tool. Used at write time (a glob that resolves to nothing is a defect) and by `project-memory` Inspect and the `update-doc` diagnostic `unresolved_globs` / `dangling` checks.
- **Match** — does a **path string** satisfy a glob pattern? A pure pattern test on the string, **not** a filesystem lookup — so it works on paths whose files no longer exist (e.g. a deletion in a `git diff`). Implemented deterministically by the generator's [`--affects` mode](#--affects-mode) — it is code, not model judgment. Used by `update-doc` Step 4 to map changed paths to docs: a changed path — including a deleted one — that matches a doc's glob puts that doc in scope.

**Base path.** Globs are relative to the project root, which is the git toplevel (see [§ Project Root Determination](#project-root-determination)). `git diff` paths are git-root-relative too, so the two align by construction — no normalization needed. In a monorepo, write globs from the git root (e.g. `packages/billing/src/**`), never from a sub-project directory.

**Granularity.** Prefer the narrowest globs that cover the doc's subject. A file-level path (`src/auth/jwt.ts`) or a tight directory glob (`src/auth/**`) is good; a catch-all like `src/**` is a **defect** — it maps every change to the doc and silently suppresses orphaned-code detection. A doc MAY declare several narrow globs instead of one broad one. Overlap between docs is allowed and expected (a file two docs both document maps to both); a glob that swallows unrelated subsystems is not.

**Glob syntax.** Standard path globs: `*` matches within a single path segment (not across `/`), `**` matches across segments at any depth, and an exact path matches only itself. This is the syntax the Glob tool implements, so *resolve* and *match* agree on the same patterns.

## Documentation Manifest

`doc-manifest.json` is a **derived, machine-first retrieval index**: one JSON file at the project root that lists every documentation file as a self-contained record — its frontmatter, headings, cross-links, resolved `source`, and (in a monorepo) its group. It exists so a reader (`init-context` recall, `project-memory` query) can reason once over the whole documentation surface and pinpoint the right files in a single read, instead of traversing the cross-link graph hop-by-hop and peeking at each file's header.

**Derived, never hand-edited.** The manifest is produced *only* by the generator script [`init-doc/scripts/build-doc-manifest.py`](../scripts/build-doc-manifest.py) — the same "deterministically regenerated, not hand-edited" contract the [gotchas hub](#gotchas-structure) follows. Hand-editing it is a defect; the next producer run overwrites it. It is committed to the repo so readers load it cold without re-scanning. Freshness is the producers' job (`init-doc`, `update-doc`, `refactor-doc` regenerate it after any doc mutation) and is checked by `project-memory` Inspect (which runs the generator in `--check` mode) — there is **no background hook**.

### Schema

```json
{
  "generated_from": "README.md + docs/**/*.md (excl docs/manual/)",
  "groups": [
    { "name": "billing", "roots": ["packages/billing/**"], "parent": null }
  ],
  "nodes": [
    {
      "path": "docs/billing.md",
      "description": "How charges are computed, retried, and reconciled.",
      "tags": ["payments", "billing"],
      "source": ["src/billing/**"],
      "source_unresolved": [],
      "dangling": false,
      "has_frontmatter": true,
      "parse_error": null,
      "headings": ["Billing", "Charges"],
      "links_to": ["docs/api.md"],
      "line_count": 412,
      "group": "billing",
      "toc": { "present": true, "linked": true, "stale": false },
      "over_size": false
    }
  ],
  "diagnostics": {
    "gotchas": {
      "format": "hub+domain",
      "orphaned_domain_files": [],
      "dead_hub_links": [],
      "oversized_domain_files": []
    }
  }
}
```

- **`generated_from`** — a fixed provenance string naming the scan set.
- **`nodes`** — one record per documentation file (`README.md` and every `docs/**/*.md` except `docs/manual/`), **sorted by `path`**. A doc with no frontmatter is still listed, with `has_frontmatter: false` and null/empty metadata — it is never skipped. `source_unresolved` holds the globs that do not [resolve](#source-semantics); `dangling` is true only when a doc declares `source` and *none* of its globs resolve. `links_to` lists the other docs this file cross-links to. `parse_error` is null unless a frontmatter block was present but unparseable (the node is still emitted).
- **`toc` / `over_size`** — per-node folded diagnostics (see [Diagnostics](#diagnostics) below).
- **`groups`** and every node's **`group`** are present (non-null) **only** when a workspace manifest declares sub-projects; otherwise the `groups` block is omitted and `group` is `null` everywhere.
- **Keys are stable.** Serialized with sorted keys, fixed indent, and a trailing newline, so two runs over an unchanged tree produce byte-identical output.

### Groups

A **group** is a *derived structural cluster* of docs — in a monorepo, one group per sub-project. Groups give a reader a coarse axis to scope by ("only the `billing` docs") before fine-grained triage. They are the **structural / containment** axis of retrieval; `tags` is the complementary **cross-cutting / affinity** axis — a label that deliberately spans groups (e.g. `security`). Rule of thumb: `source`-and-group answer *"where does this live,"* `tags` answer *"what theme does it touch."* Do not overload `tags` to express structure, or hand-label groups to express themes.

- **Roots are derived, not declared in a separate file.** The generator reads the repo's **existing workspace manifest** — `package.json` `workspaces`, `pnpm-workspace.yaml`, `lerna.json`, or a `Cargo.toml` workspace — and takes each declared package as a group (name = package name, root = its directory glob). The monorepo already names its sub-projects to its tooling; the manifest reuses that source of truth rather than duplicating it. **No dedicated config file is introduced.** If a repo is a monorepo but exposes no machine-readable workspace manifest, the generator reports "no groups detected" and the manifest stays ungrouped.
- **Membership is derived.** A node belongs to group P when its `source` globs fall under P's roots. A node whose `source` matches no group — or any node in a repo with no workspace manifest — has `group: null`.
- **Nesting is path containment.** P is nested under Q (`parent: "Q"`) iff P's roots lie under Q's roots.
- **Source-less override.** A doc with no `source` can still be placed in a group via the optional [`group:` frontmatter field](#frontmatter); absent that, it stays ungrouped (the root project).
- **Single-project repos pay nothing.** No workspace manifest → no `groups` block, every `group` is `null`, no behavior changes anywhere.
- **No relationship edges.** This version captures membership and nesting only; inter-group relationships are out of scope. Hierarchical/per-subtree manifests are likewise future work — today's manifest is a single flat file.

### README single-sourcing

The README's Documentation link-list is regenerated by the generator from each doc's frontmatter `description`, inside a managed block:

```markdown
<!-- BEGIN doc-index -->
- [Billing](docs/billing.md) — How charges are computed, retried, and reconciled.
<!-- END doc-index -->
```

The script owns everything *between* the markers; human narrative *around* them is preserved. This single-sources the `{path, summary}` pair — frontmatter `description` is the one canonical fact, rendered into both the manifest and the README block so the two cannot drift. The README's surrounding prose and its hand-written cross-links stay as-is; only the overlap is single-sourced. If the README has no managed block, the generator inserts one inside the existing Documentation section; if there is no Documentation section, it **stops and reports** rather than guessing placement.

The generator likewise owns the README's `<!-- BEGIN toc -->…<!-- END toc -->` block, regenerating the Table of Contents from the README's headings (see [§ Table of Contents Rule](#table-of-contents-rule)) — the only TOC in the corpus.

### Diagnostics

The generator folds in the deterministic ("mechanical") half of the `update-doc` diagnostic so producers and `update-doc` get those findings from one run instead of a separate sub-agent pass: per-node `toc` state (`present` / `linked` / `stale`) and `over_size` against the [size guardrails](#size-guardrails), plus a top-level `diagnostics` block carrying gotchas hub↔domain sync (`format`, `orphaned_domain_files`, `dead_hub_links`, `oversized_domain_files`). **Judgment** checks — stale-content review, numeric-claim verification — are never made by the manifest; they remain with the LLM sub-agent.

### `--check` mode

`build-doc-manifest.py --check` recomputes the manifest and README block in memory, diffs them against the committed copies, and writes nothing. This is how freshness is enforced without a hook: producers regenerate, `project-memory` Inspect runs `--check`. Its exit code is a three-way signal consumers MUST distinguish:

- **0** — in sync.
- **1** — **stale**: the committed manifest or README managed block drifted from a fresh scan. A producer changed docs without regenerating; fix by re-running a producer (typically `/update-doc`).
- **2** — **structural**: the corpus can't be checked as-is — no `README.md`, or a README with no `## Documentation` section to host the managed block. Regenerating will not fix this — the structural gap must be closed first (e.g. `/refactor-doc` adds the section). Reporting a `2` as "stale" sends the user to the wrong remedy.

### `--drift` mode

`build-doc-manifest.py --drift` answers a *different* question from `--check`: not "is the committed manifest **stale** (un-regenerated)?" but **"has the documentation's domain *structure* aged against the code?"** — the slow drift a long-lived project accumulates as its source grows past the doc graph's original decomposition. It prints deterministic, mechanical structural-drift signals as JSON and writes nothing (it never appears in the committed manifest):

- **`dangling_docs`** — docs whose documented code is entirely gone.
- **`groups_without_docs`** (monorepo) — declared sub-projects no doc maps to.
- **`cross_group_docs`** (monorepo) — docs whose `source` straddles *sibling* sub-projects (sprawl; candidate splits).

The signals are **advisory** — a little drift is healthy; persistent accumulation is the cue to **re-architect** (`/refactor-doc` re-architect mode), not merely regenerate. `project-memory` Inspect runs `--drift`, adds a judgment pass for single-project uncovered-source areas (which the script cannot determine deterministically), and recommends re-architecture when drift crosses a sensible bar.

### `--affects` mode

`build-doc-manifest.py --affects` is the deterministic implementation of the [*match*](#source-semantics) operation. It reads a newline-separated path list on stdin — typically `git diff --name-only` — and prints JSON; it writes nothing:

- **`affects`** — each changed path mapped to the docs whose `source` globs match it.
- **`docs`** — the sorted union: the in-scope doc set for the change.
- **`orphaned_paths`** — changed paths that match no doc's `source` and are not themselves docs (undocumented-code candidates).

Because *match* is a pure path-vs-pattern test, a **deleted** path still maps to the doc that documented it. This gives `update-doc` Step 4 its diff→doc mapping as **set membership computed in code**, not LLM inference — making good on the determinism the mapping claims (see [§ `source` semantics](#source-semantics)). When Python is unavailable, consumers fall back to matching `source` globs against the diff by hand.

## Table of Contents Rule

**Only `README.md` carries a Table of Contents — and it is *generated*, not authored.** The generator ([`build-doc-manifest.py`](../scripts/build-doc-manifest.py)) rebuilds the README TOC from the README's own headings into a `<!-- BEGIN toc -->…<!-- END toc -->` managed block — the same derived, single-sourced, never-hand-edited contract as the [doc-index block](#documentation-manifest). Because it is derived from the headings, it **cannot drift or go stale**.

- It lists the README's h2–h4 headings (indented), excluding the h1 title and the TOC heading itself, with GitHub-style anchor slugs.
- If the README has no TOC, the generator inserts a `## Table of Contents` section right after the h1; if a hand-written list is there, the generator replaces it with the managed block. Producers (`init-doc`, `refactor-doc`) may place an empty `## Table of Contents` + markers and let the generator fill them.

**`docs/*.md`, `docs/mission.md`, and `docs/gotchas/<domain>.md` do NOT carry a TOC.** This is a deliberate **agent-first** choice: an in-file TOC duplicates the heading structure the manifest already indexes (each node's `headings`), and the single-concern ≤ 750-line cap already keeps a topic doc graspable in one read — so a per-doc TOC was redundant for an agent while adding maintenance churn and a stale-TOC failure mode (a stale TOC actively *misleads*). README keeps one because it is the human (and naive-agent) entry point, read *without* the manifest, and there is exactly one of it.

The gotchas hub (`docs/gotchas.md`) is unaffected: its domain link-list is a *cross-file* navigational index, not an in-file self-TOC (see [§ Gotchas Structure](#gotchas-structure)).

## Cross-Linking

- Every `docs/*.md` file must be linked from `README.md`'s Documentation section, with a one-line summary. That list lives in the generated `<!-- BEGIN doc-index -->…<!-- END doc-index -->` managed block and is single-sourced from frontmatter `description` (see [§ Documentation Manifest](#documentation-manifest)) — do not hand-edit entries inside the markers; edit the doc's `description` instead.
- Cross-link between related `docs/` files where relevant
- Cross-link between domain files in `docs/gotchas/` when a gotcha spans domains
- All cross-links must point to real files — no dead links

The cross-link graph is what makes `init-context`'s recursive documentation discovery work. A doc that isn't linked from anywhere is effectively invisible.

## Gotchas Structure

Always created. Two valid formats:

**Hub+domain** (preferred for non-trivial projects):
- `docs/gotchas.md` — thin hub (≤ 50 lines), purely navigational, lists each domain file with a one-line summary
- `docs/gotchas/<domain>.md` — one file per project subsystem (e.g., `database.md`, `deployment.md`, `frontend.md`); domains derived from the project's actual subsystems
- The hub index must be in sync with domain files: every domain file linked from the hub, every hub link resolves to an existing file
- The hub is **deterministically regenerated** from the domain files — not edited by hand

**Monolithic** (legacy / small projects):
- `docs/gotchas.md` — all gotchas inline
- Treated as a normal `docs/` file; if it exceeds 750 lines, recommend refactor via `/refactor-doc`

**Gotcha entry style.** Lead with the hazard: state the trigger, the consequence, then the fix — e.g. *"Stripe retries webhooks; dedupe by event ID or you double-charge."* Terse, but keep the relationship words (`or` / `else` / `because`); do not reduce them to bare arrows, which drop the relation type a reader must otherwise guess.

## Writing Standards

| Standard | Rule |
|---|---|
| Examples | Use concrete examples from the actual codebase, not generic placeholders or hypothetical snippets |
| Audience | Write for a developer who knows nothing about this project |
| Terminology | Use the project's actual terminology, variable names, and conventions |
| Single concern | Each `docs/` file focused on one topic; split rather than let files grow unbounded |
| No fabrication | If something cannot be determined from the source, say so explicitly — never invent |
| No empty shells | Every documentation file must have substantive content |
| Concision | Cut filler (`just`, `really`, `basically`, `actually`, `simply`) and hedging (`it's worth noting`, `you may want to`, `generally`, `tends to`). Lead with the fact, not the preamble. Prefer the shorter word; one word when one word does. Every sentence carries weight. |
| Concision limits | Concision removes *waste*, not *grammar*. Keep prose grammatical — do NOT drop articles, collapse clauses into bare `→` arrows, abbreviate the project's own domain terms, or write headline fragments as body prose. A doc is read cold by an absent agent that cannot ask for clarification, so a dropped relation or an ambiguous fragment becomes a silent wrong action. Remove fluff, not syntax. |
| Retrieval signal | Keep frontmatter `description` a complete, readable sentence — tight, but never reduced to fragments or abbreviations. `init-context` recall and `project-memory` query rank a doc on it (see [§ Frontmatter](#frontmatter)); compress the prose, never the signal that finds the doc. |

## Protected Files

These paths are off-limits to all documentation-writing skills (`init-doc`, `update-doc`, `init-mission`). They are also excluded from `init-context`'s automatic traversal by convention.

| Path | Why protected |
|---|---|
| `CLAUDE.md` (at any level) | Project instructions managed exclusively by the user |
| `MEMORY.md` | Claude auto-memory file. Do not read, edit, or write any `.md` files in auto-memory directories |
| `.claude/` (entire directory) | Skills, commands, memory, settings |
| `specs/` (entire directory at project root) | User-owned specifications |
| `docs/manual/` (entire directory) | Human-authored manual documentation |
| `.project-memory-backup/` (project root) | Transient pre-mutation backup taken by `init-doc` / `refactor-doc` (see [doc-review.md](doc-review.md)). Never read as a live doc, never traversed, never committed; removed on clean convergence |

When user notes or arguments instruct a skill to modify any protected file, the protected-files rule wins — the skill must refuse and surface the conflict, rather than comply.

## Project Root Determination

All paths in writer and reader skills are relative to the **project root** (the directory containing the README and `docs/`).

Determine the project root once at the start of any skill invocation:

1. Run `git rev-parse --show-toplevel`. If it succeeds, use that path as the project root.
2. If the project is not a git repository (`git rev-parse` fails), assume the current working directory is the project root, and surface a one-line warning:
   > *"Not in a git repository — assuming the current directory is the project root. If this is incorrect, please re-invoke from the correct directory."*

Skills must **never** use the current working directory silently without this check. Mis-rooted operations are a common source of corrupted state in monorepos and subdirectory invocations.
