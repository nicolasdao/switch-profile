# Deriving `source` Frontmatter via Source Analysis

Shared procedure for producing a doc's `source` globs by analyzing the codebase. The schema itself — the meaning of `source`, the granularity rule, and the *resolve* vs *match* definitions — lives in [standards.md § Frontmatter](standards.md#frontmatter) and [§ `source` semantics](standards.md#source-semantics). **This file is the *procedure*, not the rules; read those sections first.**

## Table of Contents
- [Who uses this](#who-uses-this)
- [Scope guard for refactor-doc](#scope-guard-for-refactor-doc)
- [Procedure](#procedure)
- [Output](#output)

## Who uses this

- **`init-doc`** — during bootstrap, to derive the `source` globs for every topic doc and gotchas domain file it writes (its Phases 2–4). For init-doc this is normal operation: it already reads source code.
- **`refactor-doc`** — **only** under its frontmatter-backfill **hard exception**: a legacy doc with **no frontmatter block at all**, predating the feature. (A doc that already has frontmatter but no `source` is *not* a candidate — that omission is deliberate, e.g. `docs/mission.md`.) This is the *single, bounded* case in which refactor-doc is permitted to read source code; in every other respect refactor-doc remains source-blind. See `refactor-doc` SKILL.md.

## Scope guard for refactor-doc

When `refactor-doc` invokes this procedure, reading source code is licensed for **one purpose only: deriving `source` globs.** It does **not** license rewriting, verifying, or fact-checking the doc's prose against the code. refactor-doc still preserves all existing content verbatim — it reads the code to *map paths*, never to *edit the body*. The moment the globs are derived and resolved, the source-reading is done.

## Procedure

1. **Establish the doc's subject.** From the doc's title, headings, and content, determine what subsystem or concern it documents. (init-doc already holds this from its analysis; refactor-doc reads the existing doc — which it has read anyway during its scan.)
2. **Targeted reconnaissance.** Locate the code that implements that subject. Start from the project shape (see [../../init-mission/reconnaissance.md](../../init-mission/reconnaissance.md)), then narrow to the specific files and directories for *this doc's* subject — its entry points, modules, routes, schemas, handlers, config. This is **targeted**, not a full project reverse-engineering: read only enough to know which paths the doc covers.
3. **Write the narrowest globs that cover the subject.** Apply the granularity rule in [standards.md § `source` semantics](standards.md#source-semantics): file-level paths (`src/auth/jwt.ts`) or tight directory globs (`src/auth/**`), never a catch-all like `src/**`. Several narrow globs beat one broad one. Overlap with other docs is expected and fine.
4. **Resolve every glob.** Use the Glob tool — a glob that resolves to nothing on disk is a defect; fix or drop it. (*Resolve* is defined in [standards.md § `source` semantics](standards.md#source-semantics).)
5. **Confidence / abstract docs.** If the doc is conceptual and maps to no specific code path (a philosophy, process, or overview doc), it is **legitimate to leave `source` absent** — `source` is optional, and an honest absence beats a fabricated or over-broad glob. **Never invent a glob just to fill the field.**

## Output

A `source` list (possibly empty) for the doc, with every glob resolving, written into the frontmatter block per [standards.md § Frontmatter](standards.md#frontmatter). `description` and `tags` are derived from the doc's own content and need no source analysis — carry them alongside.
