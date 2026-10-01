# SPEC.md template — canonical structure

This is the structure every SPEC.md produced by `init-spec` must follow. Section order matters. Adapt the **content** to the session, but do not reorder or omit sections without explicit reason (stated in the spec itself).

The template assumes the project has a typical mid-size codebase. For a single-file change, collapse §4 to one fix. For a multi-system effort, expand §4 but keep each fix under ~60 lines.

---

## Required sections (in order)

### §0 How to use this spec (read first)

The fresh-session preamble. Mandatory. Tells the reader what this is, what they should and should not do, and how to get oriented in their first 30 minutes.

Must include:

- **What this spec is** — one sentence.
- **Who you (the reader) are** — assume a fresh LLM session with no prior context.
- **DO list** — read this file end-to-end before editing; run `/init-context` if available; treat file:line as anchors, not gospel; grep cited symbols to confirm; implement Tier 1 first; verify each fix with the embedded commands.
- **DO NOT list** — do not re-explore the codebase; do not re-do investigations the session already did; do not refactor adjacent code; do not invent new files/abstractions/dependencies; do not commit/push/deploy without explicit confirmation; do not edit listed protected paths.
- **Suggested first 30 minutes** — concrete reading order and first action.

### §1 Goal

One paragraph. State the user's intent precisely. If the goal is multi-part, enumerate.

### §2 Context (brief)

Two or three paragraphs maximum. The "why this matters" and "what the situation is" framing. If supporting context is large (audit reports, chat logs, prior data), link to it — do **not** paste verbatim.

If a sibling `BACKGROUND.md` exists, this section is a 3-line summary and a link.

### §3 Acceptance criteria / verifiable finish lines

Bulleted checklist. Each item is something a fresh session can verify with a command, a curl, a DevTools observation, or a diff inspection. Examples:

- `npm test` passes.
- `curl -X POST https://api.example.com/foo -d '{}' -H 'Auth: $TOKEN'` returns HTTP 200 with `{"ok": true}` in the body.
- The Network panel on the master account landing shows fewer than 100 API calls (down from ~893).
- Grepping for `sort=undefined` returns no results in `src/`.
- Page-load wall-clock on the master account is under 10 s.

No "looks right" / "feels fast" / "improved" criteria. Numeric or observable only.

### §4 The work — fixes / tasks

One subsection per discrete fix or task. Each follows this micro-template:

```markdown
#### §4.N <short title>

**Symptom:** What the user/customer/test would observe.

**Where it lives:**
- Symbol anchors (grep-able), then file:line.
- e.g. `getSitesForFarms` in `src/app/sites/duck/siteService.js:174-177`.
- If discovery was uncertain, say so here verbatim.

**Why it happens:** One paragraph. The root cause, not the symptom.

**Verification step BEFORE editing (if applicable):**
- Concrete commands the implementer runs first to confirm the bug is still present and the fix target is correct.
- Required when the discovery agent flagged uncertainty.

**How to fix:**
1. Minimum-diff change. Reference the symbol, not just the line.
2. Pattern to follow (point at existing working code if possible).
3. What NOT to refactor while you're there.

**Done when:** Verifiable criterion from §3 OR a fix-specific one.

**Stop and ask if:** Concrete conditions under which the implementer must stop and surface back to the user instead of inventing a fix.
```

Order fixes by ROI (highest first). If there are more than ~6 fixes, group them into Tier 1 / Tier 2 / Tier 3 (Tier 1 = ship first, order-of-magnitude wins).

### §5 Non-goals

Explicit list of things the implementer must NOT do. Each item names a specific temptation. Examples:

- Do not migrate class components to hooks.
- Do not add TypeScript.
- Do not bump any package version.
- Do not refactor `src/app/common/duck/httpService.js` beyond removing the listed headers.
- Do not add new tests beyond the verification curls in §3.
- Do not delete or commit `temp/_chat.txt`.
- Do not modify any file under `specs/` (it is read-only history).
- Do not implement [feature the user requested but is out of scope] — see [reasoning].

### §6 Known uncertainties

A table or numbered list. Every uncertainty has a **safe behavior**.

| # | Uncertainty | Safe behavior |
|---|---|---|
| 1 | The exact loop site of the bug may not be at the cited line. | Grep `getFarmDetails` and `Promise.all(farms.map…)`. List call sites before editing. |
| 2 | Response shape of endpoint X vs Y has not been diffed. | Run the curls in §8. Diff JSON. If shapes differ, ask the user. |

If the session has no uncertainties, write: "No known uncertainties at spec time. If you discover one during implementation, stop and surface it before working around it."

### §7 Anti-hallucination guardrails

Numbered list. Each rule is concrete (names a file, command, or behavior). Avoid abstract rules like "be careful." Typical entries:

1. No new files unless listed in §4.
2. No dependency changes (`package.json` is read-only).
3. No "while I'm here" cleanups. A bug fix is a bug fix.
4. No new abstractions. Minimum diff.
5. No assumptions about API behavior — run the curl in §8 first.
6. No editing inside `specs/` — that is read-only history, INCLUDING THIS SPEC. If you find a gap in this spec during implementation, surface it to the user — do not patch the spec mid-implementation.
7. One fix per commit, conventional commit format (`fix(scope): …`) per `README.md`.
8. Do not run `<destructive command specific to this project>` (e.g. `npm run rls`).
9. Do not push or open PRs without user confirmation.
10. Do not re-run discovery work the original session already did (audits, sub-agents, codebase exploration). Trust the §4 anchors and grep to verify.

### §8 Verification commands (how to test locally)

Copy-pasteable commands the implementer runs to:
- Boot the app (e.g. `npm install --legacy-peer-deps && npm start`).
- Reproduce the bug (curl with placeholder auth, browser steps).
- Verify the fix (curl + expected response, or DevTools observation).

Include placeholder tokens (`$TOKEN`, `$USER_ID`) with a pointer to where the implementer finds the real value (e.g. `localStorage.token` in DevTools).

If reproduction requires special credentials (master account, admin role), say so and tell the implementer to **ask the user for credentials, not invent them.**

### §9 Domain glossary

A table of domain-specific terms. Include this section if the codebase uses jargon a fresh LLM won't know.

| Term | Meaning |
|---|---|
| Farm | A logical grouping of sites belonging to one grower. |
| Twig | The hardware sensor at a site. |
| Master account | A user role that sees the whole org tree. |

If no domain terms exist, omit this section AND state at the bottom of §0: "No domain glossary — terminology is industry-standard for [stack]."

### §10 References

Links to:

- Related specs in `specs/`.
- Audit reports, sub-reports, raw data files.
- Customer correspondence (chat logs, tickets).
- Project docs (`README.md`, `docs/architecture.md`, `docs/gotchas.md`, etc.).
- External docs (library versions, RFC links).
- A "code anchors" subsection: a flat list of the most-referenced symbol → file:line pairs from §4, so the implementer can scan them quickly.

---

## Optional sections

Add only if genuinely useful for this spec.

### §A Symbol anchor list

If §4 references many symbols across many files, consolidate them into a grep cheat sheet. One line per symbol:

```
getSitesForFarms              src/app/sites/duck/siteService.js
getParentRole                 src/app/user/duck/userActions.js
```

### §B Ownership matrix

If some fixes live in this repo and some require backend / infra / different-team coordination, surface the matrix here. One row per concern, columns: webapp / server / infra.

### §C Test plan / acceptance ceremony

If §3's acceptance criteria are dense enough to warrant a checklist (more than ~10 items), spin them out here. Group by tier.

### §D Sibling BACKGROUND.md pointer

If a `BACKGROUND.md` exists, state explicitly: "Read `BACKGROUND.md` only if you need historical context. It is NOT required to do the work in §4. Skip it on first pass."

---

## Anti-bloat checklist

Apply before finalizing:

- [ ] SPEC.md is under 700 lines (or background is split out).
- [ ] No section is purely historical without a "how this affects what you do" framing.
- [ ] No verbatim quotes from chat unless the wording is load-bearing.
- [ ] No copy-pasted audit tables — link instead.
- [ ] Every example, code block, and bullet earns its space.
- [ ] If a paragraph could be deleted without the implementer making a mistake, delete it.

---

## Length budget (rough guide)

| Section | Typical lines |
|---|---|
| §0 How to use | 40–80 |
| §1 Goal | 5–15 |
| §2 Context | 20–60 |
| §3 Acceptance criteria | 10–30 |
| §4 The work | 150–400 (scales with number of fixes) |
| §5 Non-goals | 10–25 |
| §6 Known uncertainties | 15–40 |
| §7 Guardrails | 15–30 |
| §8 Verification | 30–80 |
| §9 Glossary | 0–30 |
| §10 References | 15–40 |

Stay near the low end of each range unless the work genuinely requires more.
