---
name: init-doc
description: Generate comprehensive project documentation from scratch by analyzing source code. Use when a project has no documentation, incomplete documentation, or legacy documentation that needs to be fully replaced. Creates a README.md hub and docs/ folder with detailed topic files. Works with any language, framework, or stack. This is a full documentation bootstrap — not incremental updates (use update-doc for that).
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
disable-model-invocation: true
argument-hint: "[optional: specific focus or context]"
---

# init-doc

Generate comprehensive project documentation by deeply analyzing source code. Works with any language, framework, or stack.

## Output Standard

Documentation produced by this skill:
1. **README.md** at project root — the documentation hub linking to all docs/ files
2. **docs/** folder — detailed topic files, one per concern
3. **docs/gotchas.md** — always created; captures non-obvious behavior and pitfalls

Every documentation file produced — README.md and every docs/ file — **MUST** include a Table of Contents immediately after the h1 heading, granular up to h4. No exceptions.

All docs must be cross-linked so `init-context` can recursively traverse the full knowledge graph, and structured so `update-doc` can maintain them going forward.

## Process

### Phase 1: Reconnaissance

Map the project landscape. Do NOT read source code yet — just understand the shape.

1. **Determine project root**: Run `git rev-parse --show-toplevel`
2. **Map directory structure**: List top-level directories and key subdirectories to understand the layout
3. **Identify the stack**: Read package manifests and build files to determine language(s), frameworks, and tooling. Look for:
   - `package.json`, `tsconfig.json` (Node.js/TypeScript)
   - `requirements.txt`, `pyproject.toml`, `setup.py`, `Pipfile` (Python)
   - `go.mod` (Go) / `Cargo.toml` (Rust) / `pom.xml`, `build.gradle` (Java/Kotlin)
   - `Gemfile` (Ruby) / `composer.json` (PHP) / `*.csproj` (.NET)
   - `Makefile`, `CMakeLists.txt`, or other build systems
4. **Catalog infrastructure**: Docker, CI/CD, IaC (Pulumi/Terraform/Serverless), deployment configs
5. **Identify data layer**: Database schemas, migrations, ORMs, seed scripts, API definitions (OpenAPI, GraphQL, protobuf)
6. **Find entry points**: Main files, index files, server files, CLI entry points, Lambda handlers
7. **Scan existing docs**: If legacy docs exist, skim them for useful signal but do NOT trust their accuracy
8. **Classify the project type**: Library, web app, API service, CLI tool, monorepo, infrastructure, or hybrid

### Phase 2: Deep Analysis

Read source code systematically. Focus on understanding behavior, not exhaustive line-by-line reading.

1. **Start at entry points** — Read main modules to understand the core purpose and execution flow
2. **Trace data flow** — Follow how data enters the system, transforms, and exits
3. **Map APIs and interfaces** — Endpoints, routes, CLI commands, exported functions, event handlers
4. **Understand configuration** — Environment variables (check `.env.example` or equivalent), config files, feature flags
5. **Read tests** — Tests reveal expected behavior, edge cases, and integration points
6. **Identify patterns** — Architecture style, error handling, auth model, logging, naming conventions
7. **Note gotchas** — Non-obvious behavior, surprising design choices, workarounds, known limitations
8. **Check scripts** — Build, test, deploy, and utility scripts in package manifests or Makefiles

### Phase 3: Documentation Plan

**STOP. Do NOT write any files until the user approves this plan.**

1. **Propose the docs/ file list** — Only files relevant to this project. Use the topic catalog below.
2. **Outline each file** — Draft the section headings for README.md and each docs/ file
3. **Note what will be replaced** — If legacy docs exist, explicitly list what will be removed
4. **Present the plan and wait for user approval**

#### Topic Catalog

Only create docs/ files that are warranted. Common topics:

| File | When to create |
|---|---|
| `docs/architecture.md` | Multi-component systems, non-trivial data flow, service interactions |
| `docs/database.md` | Schemas, migrations, data models, seed scripts |
| `docs/api.md` | REST, GraphQL, gRPC, or WebSocket endpoints |
| `docs/cli.md` | CLI tools with commands, flags, and usage patterns |
| `docs/deployment.md` | Non-trivial deploy process, CI/CD pipelines, environments |
| `docs/configuration.md` | Many env vars, config files, secrets management |
| `docs/testing.md` | Complex test setup, multiple test types, test data |
| `docs/infrastructure.md` | IaC resources, cloud services, networking, scaling |
| `docs/gotchas.md` | **Always created** — pitfalls, edge cases, non-obvious behavior |

Create additional topic files if the project demands it (e.g., `docs/auth.md`, `docs/etl.md`). Never create empty shells — every file must have substantive content.

### Phase 4: Writing

After user approves the plan:

1. **Create `docs/` directory** if it doesn't exist
2. **Write docs/ files first** — each topic file with:
   - Clear heading hierarchy (h1 through h4 max)
   - Table of Contents (up to h4) immediately after the h1
   - Cross-links to related docs/ files where relevant
   - Concrete examples from the actual codebase — not generic placeholders
3. **Write README.md last** — the hub document structured as:
   - Project name (h1) and one-line description
   - Table of Contents (up to h4)
   - **Overview** — what the project does, why it exists, who it's for
   - **Getting Started** — prerequisites, installation, configuration, running
   - **Project Structure** — brief annotated directory layout
   - **Documentation** — links to every docs/ file with a one-line summary per link
4. **Remove legacy docs** — delete any old README or outdated documentation files that were replaced. Only remove files you are replacing with new equivalents.

### Phase 5: Validation

After writing all documentation:

1. **Verify cross-links** — every docs/ file must be linked from README.md; cross-links between docs/ files must point to real files
2. **Spot-check accuracy** — re-read 2-3 key source files and verify documentation matches
3. **Summarize** — list what was created and what was removed

## Constraints

- NEVER modify `CLAUDE.md`, `MEMORY.md`, `.claude/`, `specs/`, or `docs/manual/`
- NEVER fabricate information — if something cannot be determined from source code, say so explicitly
- NEVER write documentation for code you haven't read
- NEVER skip Phase 3 — always get user approval before writing any files
- NEVER create empty documentation files
- NEVER omit a Table of Contents — every file (README.md and every docs/ file) must have a TOC immediately after its h1, granular up to h4
- Write for a developer who knows nothing about this project
- Use the project's actual terminology, variable names, and conventions — not generic placeholders
- Keep each docs/ file focused on a single concern — split rather than merge
