# Project Reconnaissance Process

Map the project landscape. Do NOT read source code yet — just understand the shape.

## Steps

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

## Output Format

After completing all steps, produce a structured reconnaissance summary with these sections:

### Project Identity

- **Root path**: (from step 1)
- **Project type**: (from step 8)
- **Primary language(s)**: (from step 3)
- **Framework(s)**: (from step 3)

### Project Shape

- **Directory layout**: (annotated top-level tree from step 2)
- **Entry points**: (from step 6)
- **Build system**: (from step 3)

### Infrastructure

- **Deployment**: (from step 4)
- **Data layer**: (from step 5)
- **External services**: (from step 4)

### Existing Documentation

- **Status**: (none / partial / legacy / comprehensive)
- **Files found**: (from step 7)
- **Signal quality**: (from step 7)

This summary is the reconnaissance output. It is consumed by both init-doc (for documentation planning) and init-mission (for interview context).
