# Documentation Mutation Safety: Backup & Review

This is the shared safety protocol for documentation skills that perform a **destructive mutation** of an existing corpus — rewriting, restructuring, splitting, or replacing files that already exist on disk. It is referenced by `init-doc` (which generates fresh docs and **deletes** legacy ones) and `refactor-doc` (which redistributes existing content across a new structure).

`update-doc` deliberately does **not** use this protocol. Its edits are incremental and small by design — a surgical sync to a code diff, not a big-bang rewrite. Wrapping every incremental update in a backup-and-review loop would be ceremony without payoff. If `update-doc` is being used to perform sweeping rewrites, that is a misuse to correct, not a reason to armor the skill.

## Table of Contents
- [Why this exists](#why-this-exists)
- [Part A — Decision gate](#part-a--decision-gate)
- [Part B — Backup](#part-b--backup)
- [Part C — Review loop](#part-c--review-loop)
- [Part D — Cleanup](#part-d--cleanup)
- [The review criterion](#the-review-criterion)

## Why this exists

A skill that overwrites an existing corpus in one pass **destroys the only reference against which "did we lose anything?" could ever be checked.** Once execute has run, the original is gone — so any post-hoc validation that claims to confirm "no content was lost" is aspirational, not real: the thing it needs to compare against no longer exists.

The backup closes that gap. It preserves the pre-mutation corpus as a **primary source**, which makes the review loop's central question — *did the new tree lose or fabricate anything relative to the old one?* — provable instead of asserted. No backup, no proof. The two are one mechanism.

The review loop itself is adapted from the `scrutinize` self-review discipline: a second pass with the new information you hold at the end, run by an agent that is now attached to its own freshly-written output. Its accumulated context is **fuel for the facts it learned, but fog for its objectivity** — so the loop is engineered to harvest the fuel while neutralizing the fog.

## Part A — Decision gate

Before any mutation: **analyze → reflect → decide.**

1. **Analyze** the existing corpus (and, for `init-doc`, the source code) per the calling skill's own analysis phase.
2. **Reflect** — given everything now known, *can this actually be made better, and is the improvement worth a rewrite?*
3. **Decide.** A **clean exit is a valid, honest terminal state**: if the existing docs are already in good shape, report that and stop — do not manufacture a mutation to look busy. This mirrors `scrutinize`'s "clean is a valid result" rule. Proceed only if a mutation is genuinely warranted — and, where the calling skill has a user-approval plan gate, only after the user approves.

The backup (Part B) happens **only once a mutation is committed to** — never before the decision gate clears.

## Part B — Backup

Once a mutation is committed to, and before the first file is written or deleted:

1. **Location.** Copy to `.project-memory-backup/` at the **project root** (not under `docs/`). Placing it outside `docs/` keeps it clear of every `docs/*.md` scan the constellation runs, so it can never be mistaken for a live doc.
2. **Contents.** Copy `README.md` and the entire `docs/` tree verbatim, **excluding `docs/manual/`** (human-authored, out of scope). Preserve relative structure so the review can compare path-for-path.
3. **Transience.** The backup is a working artifact, not a deliverable. It is excluded from all constellation traversal by convention (see [standards.md § Protected Files](standards.md#protected-files)) and is removed on clean convergence (Part D).
4. **Stale backups.** If `.project-memory-backup/` already exists from an aborted prior run, do not silently overwrite or merge it — surface it to the user and ask whether to discard it or restore from it first. A leftover backup means a previous run did not converge.

If there is **no existing corpus to protect** (e.g., `init-doc` bootstrapping a project that has no docs at all), there is nothing to back up — skip Parts B–D entirely. The protocol guards *mutations of existing content*, not greenfield creation.

## Part C — Review loop

The backup is the **primary source.** Every claim of loss or fabrication is proven against it; anything that cannot be proven against it is dropped, not fixed.

1. **Cold reader (spawn first, read-only).** Spawn a fresh sub-agent. Give it: the **backup tree**, the **new tree**, and the **review criterion** for this skill (below) — but **not** the calling skill's reasoning or its justifications for why the new structure is better. It holds the artifact without the attachment; that is the entire point. Instruct it to find, each grounded in evidence (`file:line` in backup or new tree, or a grep): (a) content present in the backup but absent from the new tree, (b) content present in the new tree but absent from the backup, and (c) structural breakage — dead cross-links, orphaned files, broken TOC anchors. No changes.
2. **Author's two passes (run independently of the cold reader, so neither anchors the other).**
   - **Simple pass — literal reader.** Read the new tree as a reader, not the writer: is every content unit from the backup actually on the page somewhere in the new tree? Are the accompaniments present (cross-links, `source` frontmatter)? Any seam breaks — inbound links from other docs to a section that moved?
   - **Harvest pass — distrust your mapping decisions.** The reasoning trail to mine is the redistribution itself: every "this gotcha belongs to the `database` domain," every "this `source` glob's home on the split is product A." Write each as a triple: **ASSUMED** (the mapping call and why) → **TRUE** (primary-source evidence from the backup, `file:line`) → **RODE ON IT** (what the new structure did because of it). Drop anything you cannot ground.
3. **Reconcile.** Merge the cold reader's findings with your own and **weight the disagreements heaviest** — anything only one of you caught is a blind spot.
4. **Prove (mandatory gate).** For each candidate, produce the proof its type admits: a **loss** claim → a grep showing the exact text present in the backup and absent from the new tree; a **fabrication** claim → the reverse; a **breakage** claim → the dead link or missing anchor. The proof is also the **false-positive filter**: if you cannot ground it against the backup, it was not real — drop it, do not fix it.
5. **Fix.** Auto-apply the proven fixes. **Surface** the risky or judgment-heavy ones (wide blast radius, a redistribution the user may want to weigh in on) and ask the user before applying.
6. **Confirm.** Re-run the calling skill's **structural validation phase** as the broad battery — sizes within guardrails, TOCs correct, cross-links resolve, `source` globs preserved/resolving. A content fix that breaks structure is not done.
7. **Converge.** Repeat steps 1–6 until a full pass surfaces **no new provable finding** (the lenses are exhausted), with a **hard cap of 3 passes**. The stop condition is *exhausted lenses, not felt certainty* — certainty never arrives, and infinite review is its own failure. If the loop has not converged by the cap, **do not declare success**: keep the backup (Part D) and surface the unresolved findings.
8. **Altitude check (surface, never act).** One level up: did doing the mutation reveal that the *structure or the problem itself* was wrong — the chosen domains don't match the real subsystems, the split boundaries cut across a single concern, the corpus needed something other than a restructure? That is a direction call, not a fix. Surface it to the user; never act on it unilaterally.

## Part D — Cleanup

- **Clean convergence** (a pass found nothing new and the structural battery is green) → **delete `.project-memory-backup/`** and state in the summary that it was taken and removed. A stray backup left in a converged repo is its own hazard (accidental commit, traversal confusion).
- **Non-convergence by the cap** → **keep `.project-memory-backup/`**, list the unresolved findings, and tell the user the backup path and how to restore from it. The backup persists exactly when something is still in doubt.

## The review criterion

The calling skill supplies one parameter: **what "no loss" means for it.** The two callers diverge here because their relationship to the backup is opposite.

- **`refactor-doc` — verbatim set-equality.** refactor-doc's invariant is "preserve content verbatim, only redistribute." So the criterion is near-exact: every content unit in the backup must appear in the new tree (**no loss**) **and** nothing in the new tree may exist that was not in the backup (**no fabrication**), allowing only for generated scaffolding — the navigational hub text and any in-file Table of Contents. (A TOC is derived scaffolding, not authored content: one added, regenerated, or **stripped** — including the legacy topic-doc TOCs `refactor-doc` now removes under the README-only TOC rule — counts as neither loss nor fabrication.) This is largely mechanical; a grep can prove most of it.

- **`init-doc` — no irreplaceable knowledge lost.** init-doc generates fresh docs from source and is *meant* to reword, reorganize, and improve — so set-equality would be nonsense and would false-positive on every improved sentence. The criterion is narrower and judgment-based: **does any irreplaceable hand-authored knowledge in the backup survive into the new tree?** Knowledge that the code itself reveals (API shapes, structure, config) is fine to "lose" — init-doc rewrote it from source, better. What must survive is what the code *cannot* tell you: gotchas, war stories, the reason a decision was made, non-obvious caveats. The cold reader is asked specifically: *"What did the old docs know that the source code does not, and is it still present in the new tree?"*
