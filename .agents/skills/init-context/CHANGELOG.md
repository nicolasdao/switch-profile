# Changelog

## [1.10.0] - 2026-08-08

Supersedes an unreleased 1.9.0; both are folded here. Where 1.9.0's reasoning was later found wrong, this entry states the corrected position rather than recording the round trip.

### Added
- **`scripts/manifest-query.py` — read-side queries over the committed manifest.** Standard library only, Python >= 3.8, macOS/Linux/Windows. `--index` prints the lean retrieval index; `--affects` maps file paths to the docs whose `source` globs cover them. Never writes, never regenerates — freshness stays the producers' job. Degrades gracefully: a missing or unreadable manifest exits non-zero so the caller falls back to reading it directly.
- **`scripts/test-manifest-query.py` — guards for the script.** Standard library, no network. Covers the two defect classes found while building it: (1) **untested manifest shapes** — `groups` is a *list* of `{name, roots, parent}` records, absent entirely from single-project repos, so the monorepo path never runs in ordinary use and silently rotted; (2) **vocabulary drift** — the suite reads `SKILL.md` and asserts that every manifest field name the instructions tell the model to read appears verbatim in `--index` output, so instruction and implementation cannot diverge unnoticed.
- **`python3 >= 3.8` declared in `skill.json` `systemDependencies`**, mirroring `init-doc`. This reverses 1.8.0's *"init-context reads the manifest as a file and never runs the generator, so it needs no python3 dependency"* — deliberately, and with a documented fallback when the script cannot run.
- **Inline grounding requirement (Step 7).** The answer must name the doc each substantive claim rests on, inline and in passing, and say plainly when something is not in the loaded corpus. The removed file list was bookkeeping *and* the only answer-to-source traceability; without a replacement, an answer drawn from training knowledge would be indistinguishable from a grounded one. Matches `project-memory`'s Query contract at a fraction of the output cost.
- **A silent-miss guard (Step 8).** If the lookup names a doc and the work proceeds without reading it, that is stated in one line. A skipped load that nobody sees never gets corrected.
- **`allowed-tools: Read, Grep, Glob, Bash` in the frontmatter.** Stripped in 1.2.0 *"to allow implementation after context loading"* — a rationale that died with the branch in 1.3.0, leaving the frontmatter out of step with the skill's own contract for seven releases. Note what it does and does not do: per the Claude Code documentation it **grants** permission for the listed tools during the invoking turn and **does not restrict** anything — every tool stays callable and the grant clears on the next message. It removes permission prompts during the load; it does not enforce Step 9, which remains an instruction.
- **Source-less gotchas domain files handled explicitly (Step 3b).** Where a source-blind producer left `source` absent, recall falls back to `description`/`tags` rather than assuming a `source` hit is always available.

### Changed
- **The answer is now the last thing in the output.** Step 7 was "Summarize your findings" — six numbered sections that buried the answer mid-page and closed on `"Context loaded. Ready for your next instruction."`, so users could not tell whether the question had been answered and routinely re-prompted with "so what's the answer?". Step 7 is now **Respond**: at most four parts — an optional one-line doc-health note, relevant gotchas, a one-line mission lens, and **the answer, always last and always the bulk of the response**.
- **Answering is unconditional and never branches on prompt type.** The skill always ends with a direct response whose *shape* follows the prompt's shape: question -> answer; topic -> orientation; action request -> the plan plus *"Say go and I'll implement it."*; empty -> project orientation. See **Why** below for the distinction that makes this safe.
- **Step 2 loads a lean index instead of the raw manifest.** Measured on a real 47-doc corpus: **~20,000 tokens -> ~5,200**, a 74% reduction, at every session start. Half the raw manifest is per-doc heading dumps that exist for the maintenance skills and that recall never reads. Five provably unreferenced fields are dropped (`toc`, `over_size`, `line_count`, `source_unresolved`, `headings`) — `headings` re-attached for exactly the nodes whose frontmatter is missing or unparseable, where it is the only triage signal left. A skill built to avoid filling the window with documentation was spending 20k tokens on the table of contents before reading a single doc.
- **The progressive-loading trigger is an action, not a judgment (Step 8).** It was *"before starting work on a new task or topic area, pause and ask yourself whether the work touches an area whose docs were not loaded."* It is now: **before your first `Edit`/`Write` to any file, run `--affects` on that path and read what it names.** The old form fails by construction — not having noticed a topic shift is self-concealing, so the state you must detect is the state that prevents you detecting it. An edit is unambiguous and cannot be missed, and the answer comes from a command rather than from recall. `Edit`/`Write` rather than `Read` is deliberate and measured: ~51% of source files in a real corpus are covered by some doc, so firing on every file *opened* would flood context — the waste this skill exists to prevent — while firing on the first *modification* is rare and lands where being wrong is expensive.
- **That rule moved into the numbered spine, ahead of the terminal stop.** It was an un-numbered appendix sitting immediately after *"**Stop there.** This is unconditional"* — the document's hardest imperative, with the standing rule parked behind it. It is now **Step 8**; "never act" is **Step 9**. The heading keeps the phrase "Ongoing progressive documentation loading" so `project-memory`'s by-name reference stays valid.
- **The "never branch" rule is stated precisely.** It read *"Never branch on what kind of prompt this is"* — an absolute the document then violated with Step 7's shape table, an inconsistency a future editor could reasonably resolve by *loosening* the rule (reintroducing the 1.3.0 regression). It now prohibits the branch that matters: one running **before or during the load**, or whose arms differ in **whether you act**. Step 7's table is explicitly excluded, with the reason inline.
- **Anomaly reporting consolidated.** Every scattered "note this in your summary" instruction — missing README, absent manifest, stale node pointer, `dangling` doc, missing mission, no-manifest triage, and Step 1's not-a-git-repository warning — routes to a single conditional Step 7 doc-health line, emitted **only** when something is broken. Step 7 is the sole outlet, so no step above emits its own.
- **The action-request hand-off is exempt from the sign-off ban.** *"Say go and I'll implement it."* is the operative last line of that answer, not a content-free sign-off.
- **Script invocations follow the family convention** — `python3 "${CLAUDE_SKILL_DIR}/scripts/manifest-query.py" --root <project_root> ...`, so the script cannot re-derive a project root that disagrees with the one Step 1 established.
- **Worked example rewritten and roughly halved**, demonstrating the edit-triggered lookup end to end.

### Removed
- **"List of files read" and "Why each was relevant."** Narration of the skill's internals. Nothing downstream consumed the list, and the files are already in context.
- **The "Documentation not yet loaded" index and the duplicate progressive-discovery reminder for unloaded gotcha domains.** Two renderings of the same state, printed on every invocation at roughly 3,000 output tokens. They are unnecessary because the lookup answers *"what documents this file?"*, never *"what have I missed?"* — so there is no read-set to record and no complement to compute. A forgotten re-read costs one cheap read.
- **The `"Context loaded. Ready for your next instruction."` sign-off.** With the answer last, a trailing sign-off exists only to bury it.

### Fixed
- **A legacy manifest with no `diagnostics` block now has a defined branch.** The gotchas format reads as `unknown`, a value Step 3b did not enumerate and had no fallback for; it now routes to Glob detection.
- **`__pycache__/` and `*.pyc` added to the repo `.gitignore`**, so bytecode generated by running the script or its tests is not committed alongside `scripts/`.

### Why
- **Ordering is not classification — this is the distinction that makes the output change safe.** 1.2.0 added a branch that asked the model *"is this an action request?"* and let the answer decide whether to implement. 1.3.0 removed it because that decision propagated *backwards*: having resolved to implement, the agent triaged toward the plan it already held, read fewer docs, and skipped gotchas that did not fit it. **This release changes only the order and content of the output; it never introduces a decision point before the load.** Answering is downstream of the load and therefore safe; acting is not, and remains forbidden.
- **The removed sections were the skill narrating itself.** Progressive disclosure is the whole point; spending output tokens announcing which files were and were not read inverted it and buried the payload.

### Notes
- **`--affects` normalises absolute paths, which `init-doc`'s does not need to.** `init-doc` is fed `git diff` output, always repo-relative. This script's mainline caller is Step 8, immediately before an `Edit`/`Write` — and those carry **absolute** paths, which can never match a repo-relative glob. Repo-relative input is untouched, so this is a strict extension of `init-doc`'s behaviour, verified identical across all 444 tracked paths in a real repository.
- **The `source`-matching logic is duplicated** between `init-doc/scripts/build-doc-manifest.py` and `init-context/scripts/manifest-query.py`. Accepted deliberately: it keeps `init-context` installable standalone rather than dependent on `init-doc`. `glob_to_regex` is copied verbatim so the two agree by construction. If [standards.md § `source` semantics](../init-doc/references/standards.md#source-semantics) changes, **both copies must change together**.

## [1.8.0] - 2026-06-15

### Changed
- **Example Process Flow rewritten to be manifest-first.** The worked example previously demonstrated the pre-manifest fallback end-to-end (README-link discovery + per-file frontmatter-header peek + cross-link recursion), contradicting the manifest-first Steps 2/4/6/8 added in 1.7.0. It now loads `doc-manifest.json` in Step 2, triages from the nodes in one reasoning pass, reads the gotchas format from the index, and shows the legacy header-peek only as a labeled no-manifest fallback.
- **Gotchas format read from the manifest (Step 3b).** When the manifest is loaded, the format comes from `diagnostics.gotchas.format` rather than re-globbing `docs/gotchas/` — honoring Step 2's "trust the index, don't re-scan."

### Added
- **Low-confidence-metadata caution (Step 2).** Recall now downweights nodes the manifest flags as unreliable — `parse_error`, `has_frontmatter: false`, or `dangling: true` — scoring them by `headings` and opening the file rather than trusting a wrong or empty header.
- **Cross-cutting `tags` widening (Step 4).** For themes that deliberately span sub-projects (auth, security, logging), triage scans all groups for `tags` matches instead of letting monorepo group-scoping prune them.

### Fixed
- **`skill.json` declares `systemDependencies`** (`git`) — Step 1 runs `git rev-parse` but it was previously undeclared. init-context reads the manifest as a file and never runs the generator, so it needs no `python3` dependency.
- **`skill.json` license changed MIT → `BSD-3-Clause` and author identity aligned** to match the rest of the constellation (previously mixed BSD-3-Clause, MIT, and none).

## [1.7.0] - 2026-06-14

### Added
- **Manifest-first recall.** Step 2 now loads `doc-manifest.json` (the derived machine index) right after the README. Step 4 triages from it in a single reasoning pass over the whole corpus — scoring every node by `source` → `description`/`tags` → `headings` — instead of a frontmatter-header peek per file. The manifest is the index, not content: the mandatory `docs/mission.md` + gotchas-hub content reads are unchanged.
- **Group-scoped triage (monorepos).** When the manifest has a `groups` block, Step 4 scopes to the relevant sub-project group(s) before per-doc scoring, pruning unrelated sub-projects up front.
- **Exact "Documentation not yet loaded" set.** Step 8 now computes the unloaded set as the manifest's `nodes` minus what was actually read — precise complement, no README-link approximation — emitting each unloaded node's `path`, `description`, `source` (and `group`).

### Changed
- **Cross-link recursion (Step 6) drops to a fallback** when a manifest is present (triage already saw the whole corpus); `links_to` is used only to confirm nothing closely related was missed. Without a manifest it remains the primary discovery path.
- **Graceful degradation.** With no `doc-manifest.json`, the skill falls back to the legacy per-file frontmatter-header triage and notes it in the summary. The manifest is trusted as-is and never re-scanned for freshness (that is the producers' / Inspect's job); a node pointing at a missing file is surfaced and handled by direct inspection for that entry only.

## [1.6.0] - 2026-06-14

### Added
- **Frontmatter-first recall — `source` is now the strongest relevance signal.** Step 4 is reworked from link-text evaluation into a cheap frontmatter triage (peek headers, not bodies) with an explicit priority order: **(1) `source` match** — when the question names a file, directory, or code area, the doc whose `source` globs cover it is a near-certain load; **(2) `description`/`tags`**; **(3) README link text** as fallback for docs without frontmatter. This is the precise code→doc map applied to recall. (Schema: `nicolasdao/init-doc` `references/standards.md § Frontmatter`.)
- **Gotchas domain selection via `source`** (Step 3b): gotchas domain files declare `source`, so when the user's work touches a subsystem's code, the matching domain file is flagged to load.
- **Precise ongoing progressive loading.** Step 8's "Documentation not yet loaded" index now records each unloaded doc's `source` globs; the Ongoing Progressive Documentation Loading rule matches the work's file paths against them, turning mid-session loading into a deterministic code→doc hit instead of a title guess.
- **Example Process Flow rewritten** to demonstrate `source` matching end-to-end (triage, gotchas selection, unloaded index, ongoing load).

## [1.5.1] - 2026-05-25

### Fixed
- `argument-hint` frontmatter value was parsed by YAML as a flow array (`[question or topic]`), causing validation to fail with `argument-hint must be a string (got array)`. Replaced with an unquoted plain-string form (`optional question or topic`) that satisfies the validator without introducing forbidden YAML characters.

## [1.5.0] - 2026-05-19

### Changed
- SKILL.md frontmatter description refactored to the five-slot grammar with `ProjectMemory —` Domain anchor, explicit `Use when` triggers (starting work on a project, asking how something works, before any task in a documented area), and `Not for` negative redirecting to `update-doc` and `init-doc`. Auto-invocation routing signal significantly strengthened — previously the description was compact but lacked any `Use when` or `Not for` clauses.
- skill.json description aligned with the Project Memory constellation positioning. Added `ai`, `memory`, `agent-memory`, and `project-memory` keywords to surface the skill for LLM amnesia / persistent context queries.

### Positioning
- This skill is now formally positioned as the **recall** satellite of the forthcoming `nicolasdao/project-memory` constellation.

## [1.4.0] - 2026-05-19

### Added
- Step 1: Project Root determination (`git rev-parse --show-toplevel` with CWD fallback), aligning init-context with the writer skills so all four skills agree on what "project root" means. Closes a silent-failure mode when invoked from a subdirectory of a monorepo.
- Step 3: Mandatory File Loading — an explicit procedural step for loading `docs/mission.md` (3a) and `docs/gotchas.md` (3b) before topic-driven traversal. Mission loading was previously asserted as mandatory in the preamble but had no procedural step, creating a gap where a reader following the steps mechanically might miss it.

### Changed
- All steps renumbered from the previous 1–7 (with an unnumbered "Gotchas Loading" sibling section) to a consistent 1–9. The prose steps and the Example Process Flow now agree on numbering.
- Example Process Flow updated to show the new Step 1 (project root) and Step 3 (mandatory file loading, including explicit mission load).

### Removed
- Uppercase fallback detection for `MISSION.md` and `GOTCHAS.md`. The writer skills in this framework (`init-doc`, `init-mission`, `update-doc`) only ever produce lowercase filenames, so the uppercase branches were unreachable code. Detection is now lowercase-only, simplifying the procedure.

## [1.3.1] - 2026-05-16

### Removed
- Hard-exclusion rules that blocked reading files under `specs/` and `docs/manual/`. The skill can now follow links into those directories when relevant to the user's question.

## [1.3.0] - 2026-05-14

### Changed
- Step 7 is now unconditional: the skill always stops and waits after the context-load summary, regardless of how the prompt is phrased. The "proceed with implementation" branch that allowed concrete action requests to chain straight into the task has been removed.
- Trailing reminder updated to reflect the unconditional stop.

### Why
- Concrete, confident-sounding prompts ("run X and check output", "add endpoint Y") were the exact case where the model self-justified skipping the documentation load. The conditional "proceed" branch was the rationalization vector. Removing it costs one extra turn per invocation and guarantees the load actually happens — which is precisely where unloaded gotchas matter most.

## [1.2.0] - 2026-04-23

### Added
- "Documentation not yet loaded" index in summary (Step 6) — lists all unread docs from README with paths and descriptions
- Ongoing Progressive Documentation Loading section — persistent instruction for the LLM to proactively load relevant unread documentation when the conversation shifts to new topic areas
- Updated example process flow showing ongoing progressive loading in action

### Changed
- Step 7 now conditionally proceeds or waits based on user intent: action requests proceed to implementation, analysis/question requests stop and wait
- Removed `allowed-tools` restriction from frontmatter to allow implementation after context loading
- "No modifications" guardrail scoped to Steps 1-6 (documentation discovery phase) instead of the entire skill execution

## [1.1.0] - 2026-04-08

### Added
- Smart gotchas loading with hub+domain architecture support (`docs/gotchas/` directory)
- Format detection: uses Glob to determine hub+domain vs monolithic gotchas format
- Selective domain file loading: only reads `docs/gotchas/<domain>.md` files relevant to the user's question
- Progressive discovery reminder: summary includes unloaded gotcha domains so the LLM knows to load them if the conversation shifts topics
- Prominent gotchas presentation: gotchas are presented as WARNINGS at the top of the summary, not buried in general findings
- Backward compatibility with monolithic `docs/gotchas.md` (legacy format loaded in full)
- Updated example process flow showing hub+domain gotchas loading

## [1.0.2] - 2026-04-02

### Added
- Always load docs/mission.md (or MISSION.md) alongside gotchas.md for foundational project context

## [1.0.0] - 2026-03-05

### Added
- Initial release
- Recursive documentation discovery from README.md
- Relevance-based link filtering for targeted context loading
- Safeguards against infinite loops and duplicate file reads
