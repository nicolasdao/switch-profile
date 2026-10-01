# _kit-doc-essentials

This is a kit — a curated collection of skills installed together in one command.

A documentation-focused workflow kit built around the **Project Memory** constellation. It gives your codebase perpetual, AI-readable memory through living documentation that AI coding agents (Claude Code, Cursor, Codex) maintain and recall themselves — plus clean conventional commits to land doc updates in your git history.

## Why this kit — perpetual, source-controlled project memory

Treat well-organized local documentation as your project's memory. An LLM's context window is finite and ephemeral — every new session starts fresh, every long session decays — but a `docs/` folder lives in the repository forever. The more you invest in keeping it accurate and discoverable, the more "memory" your project accumulates.

Because that memory lives alongside the code, it inherits everything git already gives you: it is **versioned** (you can trace how understanding evolved), **reviewable** (changes go through PRs like any other code), **shareable** (every collaborator and every future AI session reads the same source of truth), and **portable** (no external service to host it). In effect, this kit gives your project an effectively unbounded memory that travels with the repo.

The kit pairs two things:

1. **The Project Memory constellation** — the structural and behavioral framework for AI-readable project memory. Defeats LLM amnesia, context rot, and hallucination at the project scope. A project-scoped peer to Karpathy's LLM Wiki concept, designed for one codebase deeply known rather than personal-KB cross-topic research.
2. **git-commit** — conventional-commit hygiene so doc updates land in history cleanly, reviewable like any other code change.

## What's Included

- **`nicolasdao/project-memory`** — the Project Memory constellation. Installing this single skill pulls the entire constellation:
  - **`project-memory`** (core) — entry point, identity, workflow contract, routing, and in-doc query via lazy progressive disclosure.
  - **`init-doc`** — bootstrap satellite. Generates the README hub + `docs/` topic files from source code analysis, or — when the same session created the project — from the session itself, so the reasoning behind the build survives the session closing.
  - **`update-doc`** — maintain satellite. Syncs documentation to code changes after a coding session. Sub-agent diagnostic detects drift.
  - **`refactor-doc`** — refactor satellite. Restructures existing documentation (splits oversized files, converts monolithic gotchas to hub+domain) without source code analysis.
  - **`init-context`** — recall satellite. Loads README + mandatory files (`docs/mission.md`, `docs/gotchas.md`) + question-relevant topic docs into the AI agent's working context at every session start.
  - **`init-mission`** — compass satellite. Interviews you to produce `docs/mission.md` as the project's decision-making compass (vision, values, non-goals, users, UX).

- **`nicolasdao/git-commit`** — Commit doc (and code) changes with conventional commit messages. Session-aware staging and changelog-friendly formatting, so doc updates land cleanly in your history.

## The Workflow

Install this kit on any project where:
- Your AI agent should never forget your codebase between sessions
- Documentation must stay current and discoverable
- Doc updates should land in git with clean, conventional messages

The non-negotiable lifecycle:

1. **Bootstrap (once)** — Say *"set up project memory"* → `init-doc` (transitively invokes `init-mission`) generates the README + `docs/` from source code. If the project was *just built in this session*, say *"document what we just built"* instead — init-doc then documents from the session, capturing the decisions and dead ends that exist nowhere on disk.
2. **Recall (every session start)** — Say *"load context"* or ask a question → `init-context` loads README + mission + gotchas + relevant topic docs into the AI agent's working memory.
3. **Maintain (every session end)** — Say *"update docs"* → `update-doc` syncs documentation to the code changes you made this session.
4. **Refactor (occasional)** — Say *"my docs are messy"* → `refactor-doc` splits oversized files or converts monolithic gotchas to hub+domain.
5. **Commit** — Say *"commit"* → `git-commit` packages the doc updates into a clean, conventional git history.
6. **Query (anytime)** — Ask *"where do we handle X?"* or *"what's our convention for Y?"* → `project-memory` finds the answer in your docs using lazy progressive disclosure, with citations.

Every step routes through auto-invocation — the AI agent loads the right skill based on what you say, no manual `/skill-name` needed (though manual invocation works too).

## When NOT to Use This Kit

- If you want a personal knowledge base across many topics, see Andrej Karpathy's LLM Wiki pattern (a different shape — multi-topic, browse-oriented).
- If you only need general developer tooling without the documentation focus, see `_kit-dev-essentials` instead.

## Install

```bash
npx happyskills install nicolasdao/_kit-doc-essentials
```

Installs two top-level skills plus all five satellites transitively — the full Project Memory constellation plus git-commit.
