---
name: refactor-doc
description: ProjectMemory — Restructure existing docs without rewriting them. Use when files are oversized, gotchas are monolithic, or domains no longer fit the code. Not for authoring from source (init-doc) or post-change updates (update-doc).
allowed-tools: Read, Edit, Write, Grep, Glob, Bash, Agent, AskUserQuestion
argument-hint: "[structural|re-architect] [optional notes on which docs to prioritize]"
---

# refactor-doc

Reshape the structure of existing project documentation according to the standards in [../init-doc/references/standards.md](../init-doc/references/standards.md) — split oversized files, convert monolithic gotchas to hub+domain, strip legacy TOCs, fix cross-links, and (when the structure itself has aged) re-architect the whole knowledge graph. This skill **trusts existing content is accurate** and does not rewrite or fact-check it against the code.

**The one promise refactor-doc keeps, in every mode: it never authors or rewrites prose from code — it only changes where your words live.** Content is the asset it preserves; structure is the thing it reshapes. That — *content-preservation* — is the real invariant, not "never reads source." refactor-doc runs in two modes:

- **Structural (default) — source-blind.** Redistributes existing content into a better arrangement of the *existing* domain set: split oversized files, convert gotchas to hub+domain, strip legacy TOCs, repair cross-links. The everyday refactor.
- **Re-architect (deep) — reads source for structure only.** When the existing graph has gone **archaic** against the code — typical of a monorepo grown over months or years, whose original week-2 domain boundaries no longer match how the source is actually organized — re-architect mode reads the *source structure* to re-derive a better domain decomposition, then migrates the existing content **verbatim** into the better-shaped graph. Where it uncovers a subsystem with no existing documentation, it **flags a gap** for `init-doc`/`update-doc` to fill — it never authors the prose itself. See [Choosing the mode](#choosing-the-mode).

Both modes share one source-reading discipline, already established by the [Frontmatter Backfill](#frontmatter-backfill) exception below: **source is read only to derive structure or mapping (globs, domain boundaries), never to alter prose.** Re-architect mode is simply that principle applied to the whole graph instead of one doc's globs. A doc that already has frontmatter is never touched for its `source`; a present block means that choice was already made, including the deliberate omission on intent-only docs like `docs/mission.md`.

## Standards

All restructuring conforms to the canonical standards in [../init-doc/references/standards.md](../init-doc/references/standards.md) — file structure, size guardrails (README and `docs/*.md` ≤ 750 lines, gotchas hub ≤ 50 lines, monolithic gotchas ≤ 750 lines), frontmatter, TOC rules, cross-linking, gotchas structure (hub+domain preferred), writing standards, protected files, and project root determination. **Read that file before proceeding.**

## Safety: Backup & Review

Because refactor-doc mutates an existing corpus in one pass, it follows the shared **backup-and-review protocol** in [../init-doc/references/doc-review.md](../init-doc/references/doc-review.md). **Read that file before proceeding.** In short: a clean exit (no change needed) is valid; once a mutation is committed to, the existing docs are backed up to `.project-memory-backup/` *before* any write; after execute, a scrutinize-derived review loop proves the new tree against the backup, fixes what it can, and either cleans up the backup on clean convergence or keeps it and surfaces unresolved findings. The review **criterion for refactor-doc is verbatim set-equality** — every content unit in the backup appears in the new tree (no loss) and nothing exists in the new tree that was not in the backup (no fabrication), allowing only for generated scaffolding (hub text, regenerated TOCs). **This holds in re-architect mode too** — because re-architecture *moves* content into a re-derived shape but never authors prose from code, the same no-loss / no-fabrication proof applies; the only additional allowances are (a) the new structural scaffolding of the re-derived graph and (b) explicit **gap markers** for undocumented subsystems, neither of which is fabricated content. Phases 3–5 below are the operational application of that protocol.

**User notes:** `$ARGUMENTS`

**Explicit mode (optional first word).** If `$ARGUMENTS` begins with **`re-architect`** (or `rearchitect` / `deep`) or **`structural`** (or `shallow`), that first word **selects the mode explicitly** and is consumed — everything after it is notes. A bare invocation (no mode word) keeps the default: structural, auto-escalating to re-architect only if the scan shows the domains have gone archaic, and always confirming in the plan first. How an explicit choice interacts with what the scan finds is in [Choosing the mode](#choosing-the-mode).

Any remaining notes take precedence over the skill's own analysis in deciding which files to prioritize and how to redistribute content.

## When to Use This Skill

### DO use refactor-doc when

- Any `docs/*.md` file exceeds 750 lines and needs splitting by sub-concern
- `docs/gotchas.md` is monolithic (no `docs/gotchas/` directory) and needs converting to hub+domain format
- The gotchas hub is out of sync with its domain files (orphaned files, dead links)
- Cross-links between docs are broken or missing
- The project's documentation structure has drifted from the framework's standards
- The documentation's **domain structure itself has gone stale versus the code** — domains that no longer match how the source is organized, a single doc whose subject has sprawled across what are now separate subsystems, or a monorepo whose docs no longer mirror its packages (**re-architect mode** — typical of a long-lived project whose original structure has aged)

### Do NOT use refactor-doc for

- Bootstrapping documentation from scratch, or **authoring content for code that has none** — use `init-doc` (it writes docs from source). refactor-doc re-derives *structure* from source but never authors prose; where re-architecture uncovers undocumented code, it flags a gap rather than filling it.
- Updating docs after code changes — use `update-doc` (it reads the diff)
- Modifying gotcha **content** — refactor-doc preserves all existing content verbatim; it only redistributes content across files

## Process

### Step 0: Project Root

Determine the project root following the procedure in [../init-doc/references/standards.md § Project Root Determination](../init-doc/references/standards.md#project-root-determination). All file paths in this skill are relative to that root.

### Choosing the mode

**If the invocation named a mode explicitly** (the `$ARGUMENTS` first-word rule above — `re-architect` or `structural`), honor it as the user's intent. Judgment still surfaces a mismatch rather than acting blindly:

- **Asked for `re-architect`, but the scan finds the domains already fit the code well** → do not manufacture churn. Report that the structure is sound and propose only the lighter work that *is* warranted (or a clean exit), explaining why.
- **Asked for `structural`, but the scan reveals the domains are genuinely archaic** → do the requested structural work, and **surface** (advisory) that a deeper re-architecture is warranted — never silently escalate past an explicit structural request.

**With no mode named, infer it:**

**Default to structural mode.** Most refactors are structural: a file is too big, or gotchas are monolithic. Run those source-blind.

**Escalate to re-architect mode only when the problem is the *shape of the graph itself*, not the size of a file.** The tell is that no amount of source-blind shuffling would fix it — the *domains are wrong*: docs whose boundaries no longer match how the code is organized, a doc whose subject has sprawled across what are now separate subsystems, a monorepo whose doc structure no longer mirrors its packages. You often won't know which mode you need until Phase 1's scan (and, in re-architect mode, the source-structure map) reveals the divergence.

Re-architect mode is a **deliberate, heavier choice** — it reads source structure and reshapes the whole graph — so it is never silent: name it explicitly in the Phase 2 plan and get the user's approval for it specifically, the same way the plan surfaces frontmatter backfill. When in doubt, propose structural mode and note that a deeper re-architecture *may* be warranted, rather than re-architecting unasked.

### Phase 1: Structural Scan

Light scan — **no source code reading**:

1. **Scan project structure** — Run `ls` on the project root to understand directory layout and identify project domains/subsystems.
2. **Read ALL existing documentation** — `README.md`, every file in `docs/` (excluding `docs/manual/`).
3. **Inventory what exists** — File list, line counts, presence of any legacy in-file TOCs (topic docs carry none now), cross-link status, **and frontmatter state per doc** — does each `docs/*.md` carry a frontmatter block at all? Flag docs with **no frontmatter block** (legacy docs predating the feature) as backfill candidates (see [Frontmatter Backfill](#frontmatter-backfill)). A doc that already has frontmatter — even one with `description`/`tags` but no `source` — is **not** a candidate: a present block means the `source` choice was already made, and its absence there is deliberate (mission, abstract, and exempt docs carry no `source`). **Also record whether `doc-manifest.json` exists** at the project root (and whether the README carries a `<!-- BEGIN doc-index -->…<!-- END doc-index -->` managed block). A legacy corpus predating the [Documentation Manifest](../init-doc/references/standards.md#documentation-manifest) has **neither** — that absence is itself a modernization this skill must deliver, and it feeds the Phase 2 decision gate (a missing manifest is *not* "good shape," even when the structure is sound).
4. **Identify domains for gotchas** — From the existing gotchas content (not source code), group gotcha sections by the subsystem they describe. Each group becomes a `docs/gotchas/<domain>.md` file.

**Re-architect mode adds — derive the source-structure map.** In re-architect mode (and only then), additionally read the *source tree's current structure* to learn the code's real, present-day subsystem boundaries — its modules, packages, and the natural domains they form — following the reconnaissance half of [../init-doc/references/source-mapping.md](../init-doc/references/source-mapping.md) (the same structure analysis `init-doc` uses, scoped here to *shape*, not content). Then **compare** it against the docs' current domains — pairing with the manifest's `source`/`groups` when present — to produce a **divergence map**: where the code's real domains and the docs' current domains no longer line up. That divergence map is what Phase 2 proposes to fix. You are reading the **shape** of the code (what subsystems exist, where their boundaries fall), never its prose — you will not transcribe any source content into the docs.

Note: in **structural** mode, reading the doc bodies and the directory layout (`ls`) is in-scope but reading source-code *content* is not — except under the [Frontmatter Backfill](#frontmatter-backfill) exception (exercised in Phase 3). In **re-architect** mode, reading source *structure* (the step above) is additionally in-scope; reading source *prose to rewrite doc content* is never in scope, in any mode.

### Phase 2: Plan

**Decision gate first (see [../init-doc/references/doc-review.md § Part A](../init-doc/references/doc-review.md#part-a--decision-gate)).** Reflect on the scan: can the docs actually be made better, and is the improvement worth a rewrite? **A clean exit is a valid result** — if the documentation is already in good shape (within guardrails, hub+domain already in place, TOCs and cross-links sound), report that and stop. Do not manufacture a restructure to look busy.

**Legacy modernization is never a clean exit — even when the structure is sound.** The "good shape" test above is *structural*; it predates two later additions to the standard. A corpus that is structurally fine but (a) **lacks `doc-manifest.json`** (or has a stale one), or (b) **has docs with no frontmatter block**, is *not* fully conformant — those are modernizations this skill must deliver. When that is the only gap, do **not** clean-exit: plan a **minimal modernization pass** — backfill missing frontmatter (Phase 3 step 6) and generate the manifest + README managed block (Phase 3 step 9), skipping the structural steps (splits, hub conversion) that aren't needed. This is the one case where "no structural change" still produces writes. It is *not* manufacturing churn — you add metadata and a derived index, never touch existing prose — but because backfill reads source code and the README changes, it still goes through plan approval, backup, and the Phase 5 review like any other mutation.

If a restructure *or a minimal modernization pass* is warranted:

**STOP. Do NOT write any files until the user approves this plan.**

1. **Propose the restructured file list**:
   - Which existing files need splitting (over 750 lines)
   - For any file being split that carries `source` frontmatter, the proposed repartition of its `source` globs across the split products (per [../init-doc/references/standards.md § `source` semantics](../init-doc/references/standards.md#source-semantics)) — so the user approves how the doc→code mapping will be redistributed, including any glob kept on all products when its home is unclear
   - The `docs/gotchas/` domain files to create, with the proposed content mapping (which sections from the current gotchas go where)
   - The new `docs/gotchas.md` hub structure
   - **Frontmatter backfill** — for each doc flagged in Phase 1 as having **no frontmatter block**, state how its new block will be built: `description`/`tags` from the doc's own content, and `source` either via the source-mapping exception (list the proposed globs once derived) or left absent for abstract/exempt docs. This is one of the two places refactor-doc reads source (the other is re-architect mode's structure analysis), so the user approves it as part of the plan. See [Frontmatter Backfill](#frontmatter-backfill).

**Re-architect mode adds — the re-derived domain decomposition.** When the Phase 1 divergence map shows the existing domains no longer fit the code, the plan proposes the **new domain set** derived from the source structure, and for each new domain the **mapping of existing content into it** — which sections and files of the current docs move where. The plan must make three things explicit and get the user's approval for them:
   - **The mode itself** — state plainly that this is a re-architecture (source-structure read + whole-graph reshape), not a structural tidy.
   - **Every unit of existing content lands somewhere** — re-architecture *redistributes*, it never drops; show the full old-domain → new-domain content map so nothing falls through. (The Phase 5 review proves this against the backup.)
   - **Undocumented subsystems become flagged gaps, not invented docs.** Where the source structure reveals a subsystem with *no* existing doc content, list it as a **gap** to hand to `init-doc`/`update-doc`. refactor-doc will create at most an explicit placeholder marker for it, never authored prose — surface the full gap list so the user sees what the re-architecture exposed.

2. **Outline each new or modified file** — draft section headings.
3. **Estimate sizes** — line estimates for each proposed file.
4. **Show what changes** — explicitly list files that will be modified, created, or split.
5. **Present the plan and wait for user approval.**

### Phase 3: Execute

After user approves the plan:

0. **Back up the existing corpus first.** Before writing or moving any file, copy `README.md` and the entire `docs/` tree (excluding `docs/manual/`) to `.project-memory-backup/` at the project root, per [../init-doc/references/doc-review.md § Part B](../init-doc/references/doc-review.md#part-b--backup). This is the primary source the Phase 5 review proves against — no backup, no proof. If a stale `.project-memory-backup/` exists from an aborted run, surface it and ask before proceeding.
1. **Create `docs/gotchas/` directory** if converting from monolithic format.
2. **Write domain files** — For each domain identified in Phase 1 step 4:
   - Create `docs/gotchas/<domain>.md` with h1 heading and the gotcha entries moved from the original file (no TOC — topic and domain docs carry none).
   - **Preserve all existing content verbatim** — do not rewrite, verify, or remove anything.
   - Add cross-links between domain files when a gotcha references another domain.
3. **Rewrite `docs/gotchas.md` as a thin hub** (30–50 lines):
   - h1 heading and one-line description.
   - An index with links to each domain file and a one-line summary per domain (a cross-file index, not an in-file TOC).
   - No gotcha content in this file — it is purely navigational.
4. **Fix all affected cross-links** — update any docs/ file that linked to a specific section in the old gotchas.md to point to the new domain file.
5. **Apply general restructuring** — For any other file over 750 lines, split by sub-concern. Move extracted sub-concerns into focused new `docs/<topic>.md` files, then update README.md's Documentation section to link to them.
   - **Respect group boundaries (monorepos).** A split product must stay in the same documentation **group** as its parent — never relocate content (or repartition `source` globs) across a group boundary, since that would silently re-cluster the doc in the manifest (see [../init-doc/references/standards.md § Documentation Manifest](../init-doc/references/standards.md#documentation-manifest)). If the only sensible split would straddle two sub-projects, **stop and surface it** rather than moving content across the boundary.
   - **Preserve the `source` mapping across the split.** If the file being split carries `source` frontmatter (per [../init-doc/references/standards.md § Frontmatter](../init-doc/references/standards.md#frontmatter)), every split product must carry frontmatter too. Partition the original `source` globs across the products by best-effort match between each glob and the content that moved with it. When a glob's correct home is unclear, keep it on **all** products — over-coverage is safe (a later `update-doc` pass refines it), but dropping a glob silently breaks diff→doc mapping. **In structural mode, refactor-doc does not read source, so do not invent new globs — only redistribute the existing ones.** (Re-architect mode is the exception: having read the source structure, it *may* re-derive globs to the new domain boundaries via [source-mapping.md](../init-doc/references/source-mapping.md) — see the re-architect step below.) Also carry over `description`/`tags`, adjusting `description` to the narrower scope of each product.

   **Re-architect mode adds — migrate into the re-derived structure.** Working from the Phase 2-approved decomposition: create the new domain files and **move the existing content into them verbatim** — the same preserve-content rule as steps 2 and 5 (redistribute, never rewrite or fact-check against code). Because re-architect mode read the source *structure*, it may **re-derive each new file's `source` globs** to the boundaries the content now sits behind (via [source-mapping.md](../init-doc/references/source-mapping.md)) rather than only shuffling the old ones — still reading code for *mapping*, never for prose. For every **undocumented subsystem** the Phase 1 divergence map exposed, write an explicit **gap marker** — a short stub stating the subsystem is undocumented and recommending `/init-doc` or `/update-doc` to fill it — and **never** fabricate content for it. Record every gap in the Phase 5 summary so the user can act on it.
6. **Backfill missing frontmatter** — for each doc flagged in Phase 1 and approved in Phase 2, add a frontmatter block: `description` and `tags` derived from the doc's content, and `source` per the [Frontmatter Backfill](#frontmatter-backfill) procedure. This is the only step that may read source-code content.
7. **Strip legacy TOCs** — remove any in-file `## Table of Contents` from `docs/*.md` and gotchas domain files (topic docs carry none now; their structure is indexed by the manifest's `headings`). A TOC is generated scaffolding, not authored content, so this is not a content change. The README's TOC is regenerated by the generator in step 9 — never hand-write it.
8. **Update README.md, and guarantee a home for the managed block.** Update any human narrative in the Documentation section to reflect the new hub + domain structure. Do **not** hand-add link entries for the new docs/ files: the Documentation link-list lives in the `<!-- BEGIN doc-index -->…<!-- END doc-index -->` managed block and is regenerated from frontmatter in step 9. **The generator can only place that block inside a `## Documentation` section (or existing markers).** A legacy README often lists its docs under a differently-named heading (`## Docs`, `## Guides`) or none at all — in that case, **add a `## Documentation` section now**, migrating the existing doc links/narrative into it, so step 9 has somewhere to write. Without this, the generator stops and produces **nothing — not even the manifest** (it refuses to guess placement).
9. **Regenerate the manifest and README doc index** — after all restructuring is written (still within the backup/review flow), run the deterministic generator:

   ```bash
   python3 "${CLAUDE_SKILL_DIR}/../init-doc/scripts/build-doc-manifest.py" --root <project_root>
   ```

   (The generator is bundled in the sibling `init-doc` skill; `${CLAUDE_SKILL_DIR}` resolves to this skill's installed directory at runtime and `../init-doc/` reaches its sibling — the same layout this skill already uses for `../init-doc/references/standards.md`. Never invoke it by a project-relative path.) This rewrites `doc-manifest.json` and the README managed block from frontmatter `description` (see [../init-doc/references/standards.md § Documentation Manifest](../init-doc/references/standards.md#documentation-manifest)) — so new split products and the hub+domain structure are indexed and linked without hand-editing. On a legacy corpus this is the **first** time `doc-manifest.json` is created; the script creates it from scratch (no prior graph needed). The manifest is derived, committed, never hand-edited.

   **If the generator stops reporting "no Documentation section"** — the legacy README still lacks one. Go back to step 8, add a `## Documentation` section, and re-run. Never skip the manifest because the README lacked a section, and never let the script guess placement.

### Phase 4: Validate

1. **Verify the hub** — `docs/gotchas.md` is under 50 lines, all links resolve to real domain files.
2. **Verify domain files** — each is under 750 lines, no content was lost from the original (domain files carry no TOC).
3. **Verify cross-links** — all references to `gotchas.md#section-anchor` in other docs/ files now point to the correct domain file.
4. **Check file sizes** — all files under their respective guardrails.
5. **Verify `source` preservation** — for every file that was split, the union of the split products' `source` globs covers every glob the original declared. No glob may be dropped; flag any loss and restore it.
6. **Verify backfilled frontmatter** — every `source` glob added during backfill (Phase 3 step 6) **resolves** to at least one real file (Glob tool); drop or fix any that resolve to nothing. Confirm no glob is a catch-all like `src/**`.
7. **Verify the manifest** — `doc-manifest.json` was regenerated (Phase 3 step 9), is valid JSON, and `python3 "${CLAUDE_SKILL_DIR}/../init-doc/scripts/build-doc-manifest.py" --root <project_root> --check` exits clean (committed manifest + README managed block match a fresh scan). In a monorepo, confirm no split relocated a doc across a group boundary (every split product shares its parent's `group` in the manifest). If `--check` reports drift, re-run the generator and re-validate.

These structural checks are the **broad battery** the Phase 5 review loop re-runs after each round of content fixes.

**Note on the Phase 5 criterion and backfill:** the verbatim set-equality criterion governs the *existing doc content* — backfilled frontmatter is *new* metadata, not a content change, so it is exempt from the "no fabrication" half of the check. The review still verifies the backfilled globs resolve (above).

### Phase 5: Review & Cleanup

Run the scrutinize-derived review loop from [../init-doc/references/doc-review.md § Part C](../init-doc/references/doc-review.md#part-c--review-loop), proving the new tree against the `.project-memory-backup/` taken in Phase 3 — with the **verbatim set-equality criterion** for refactor-doc:

1. **Cold reader** — spawn a fresh read-only sub-agent with the backup tree, the new tree, and the verbatim criterion, *but not* your reasoning about why the new structure is better. It finds content present in the backup but missing from the new tree (loss), content in the new tree absent from the backup (fabrication beyond generated scaffolding), and structural breakage — each grounded in `file:line` or a grep. **In re-architect mode**, also hand it the list of gap markers and the re-derived structure as *allowed* additions, so it does not flag those as fabrication — but it still must confirm every unit of *backup content* landed somewhere in the new graph (re-architecture moves content; it must lose none).
2. **Your two passes** — the simple literal-reader pass (is every backup content unit on the page somewhere?) and the harvest pass (distrust each redistribution call: *ASSUMED this gotcha belongs to domain X → TRUE per backup `file:line` → the new structure RODE ON IT*). Run them independently of the cold reader.
3. **Reconcile** — weight disagreements heaviest.
4. **Prove (hard gate)** — every loss/fabrication claim proven by a grep against the backup; unprovable findings are dropped, not fixed.
5. **Fix** — auto-apply proven fixes; surface risky redistributions to the user before applying.
6. **Confirm** — re-run the Phase 4 structural battery.
7. **Converge** — repeat until a pass surfaces no new provable finding (lenses exhausted), hard cap 3 passes. Stop on exhausted lenses, not felt certainty.
8. **Altitude check** — surface (never act on) any discovery that the chosen domains or split boundaries are themselves wrong.

**Cleanup** ([§ Part D](../init-doc/references/doc-review.md#part-d--cleanup)): on clean convergence, delete `.project-memory-backup/` and note it in the summary. If the loop did not converge by the cap, keep the backup, list the unresolved findings, and tell the user the backup path and how to restore.

**Summarize** — list what was created, modified, how content was redistributed, what the review proved/fixed, and whether the backup was cleaned up or retained.

---

## Frontmatter Backfill

Legacy docs predating the frontmatter feature carry no frontmatter at all — and `source` is the one field that cannot be reconstructed from the doc's own text. This is one of refactor-doc's **two structure-only source reads** (the other is [re-architect mode](#choosing-the-mode)); in both, source is read only to derive structure or mapping — here, a doc's `source` globs — never to alter prose. It is a bounded exception to the *source-blind default*, not to the absolute *content-preservation* invariant, which holds in every mode.

**Trigger.** A `docs/*.md` (or gotchas domain file) that has **no frontmatter block at all** — a legacy doc predating the feature. The trigger is the *absence of the whole block*, not the absence of `source`. This distinction is the crux: a doc that already has a frontmatter block, even one with `description`/`tags` and **no** `source`, has already had its `source` choice made — and a missing `source` there is **deliberate**, not a gap. `docs/mission.md` is the canonical example: it documents intent, not code, so it carries `description`/`tags` but no `source` by design. Treating "no `source`" as the trigger would wrongly try to invent globs for it. So:

- **No frontmatter block** → backfill candidate (create the block; derive `source` if the doc maps to code).
- **Frontmatter present, no `source`** → leave it alone; the omission is intentional.
- **Frontmatter present, with `source`** → never re-derived; globs are only *redistributed* across splits (Phase 3 step 5).

**What is backfilled, and how:**

- **`description` and `tags`** — derived from the doc's own content. **Fully source-blind.** Always safe to add.
- **`source`** — derived by reading the codebase, following the shared procedure in [../init-doc/references/source-mapping.md](../init-doc/references/source-mapping.md) — the *same* methodology `init-doc` uses, so backfilled globs are first-class, not second-rate guesses. The proposed globs are surfaced in the Phase 2 plan for user approval before any code is read in earnest, and every glob must **resolve** (Phase 4 step 6).

**The hard scope guard.** Under this exception, source code is read for **one purpose only: deriving `source` globs.** It does **not** license rewriting, verifying, or fact-checking the doc's prose against the code — refactor-doc's "preserve content verbatim" invariant is absolute. Read the code to *map paths*, never to *edit the body*.

**Abstract and exempt docs.** Even when a no-frontmatter doc *is* a backfill candidate, `source` is only added if the doc maps to actual code. If it maps to no specific code path — a philosophy, process, or overview doc — leaving `source` absent is correct. And the standard's source-exempt files (`README.md`, the gotchas hub, `docs/mission.md`) get **no `source` ever**, by definition; at most they receive `description`/`tags`. `source` is optional; **never invent a glob just to fill the field** — a wrong or over-broad glob is a defect, worse than honest absence.

---

## Constraints

All standards rules (protected files, size guardrails, TOC, cross-linking, writing standards) are defined in [../init-doc/references/standards.md](../init-doc/references/standards.md). Workflow-specific rules for this skill:

- NEVER author or rewrite prose from code — this is the **absolute invariant, true in every mode** ("never touch your words — only change where they live"). Source is read in only two scoped, *structure-only* cases: (1) deriving `source` globs for a no-frontmatter doc ([Frontmatter Backfill](#frontmatter-backfill)), and (2) re-architect mode's source-*structure* analysis to re-derive the domain decomposition (per [../init-doc/references/source-mapping.md](../init-doc/references/source-mapping.md)). In both, code is read to decide *structure/mapping*, never to write, reword, or fact-check content.
- NEVER author content for an undocumented subsystem uncovered during re-architecture — flag it as a **gap** for `init-doc`/`update-doc`; refactor-doc writes at most an explicit placeholder marker, never prose.
- NEVER, even when reading source for structure, rewrite, verify, or fact-check doc content — the doc body stays verbatim; re-architecture *moves* content, it does not edit it. A doc that already has frontmatter is never re-derived for its `source` (globs are only redistributed, or re-derived to new boundaries in re-architect mode).
- NEVER invent a `source` glob to fill the field — leave it absent for abstract docs; every backfilled glob must resolve
- NEVER rewrite, verify, or remove existing content during execution — only redistribute it
- NEVER skip Phase 2 — always get user approval before writing any files
- NEVER produce empty domain files — every file created must have substantive content moved from the original
- NEVER mutate the corpus without first taking the `.project-memory-backup/` (Phase 3 step 0) — the backup is the primary source the Phase 5 review proves against
- NEVER skip Phase 5 — the "no content lost" guarantee is only real when proven against the backup
- NEVER fix a review finding you cannot prove against the backup (a grep showing the exact text), and NEVER delete the backup unless the review converged clean
