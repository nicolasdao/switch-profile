# _kit-dev-essentials

This is a kit — a curated collection of skills installed together in one command.

Core developer workflow kit — bootstrap and maintain project documentation, load context from docs, and commit changes with conventional messages.

## What's Included

- **init-doc** — Generate comprehensive project documentation from scratch by analyzing source code. Creates a README.md hub and docs/ folder with detailed topic files.
- **update-doc** — Keep documentation in sync after code changes. Automatically updates relevant docs when features, APIs, or architecture change.
- **init-context** — Load project-specific knowledge by recursively reading README and following documentation links. Ensures Claude understands the project before making changes.
- **git-commit** — Commit session changes with conventional commit messages. Session-aware staging, changelog-friendly formatting.

## When to Use

Install this kit on any project where you want a complete documentation and version control workflow. It covers the full lifecycle:

1. **Create** — `/init-doc` bootstraps documentation from source code analysis
2. **Maintain** — `update-doc` auto-triggers after meaningful code changes to keep docs current
3. **Consume** — `/init-context` loads project knowledge before tackling new questions or tasks
4. **Commit** — `/commit` stages and commits with clean conventional messages

## Install

```bash
npx happyskills install nicolasdao/_kit-dev-essentials
```
