# Project Type Discovery

How to identify a project's type and determine its version management strategy.

## Discovery Table

Scan the project root for these markers. Check in order — the first match determines the project type. If multiple markers exist (e.g., both `package.json` and `pyproject.toml`), prefer the one most specific to the project's primary language. Ask the user to confirm if ambiguous.

| Marker File | Project Type | Version Location | Read/Write Strategy |
|---|---|---|---|
| `package.json` | Node.js | `version` field in `package.json` | JSON: parse, update field, serialize back |
| `Cargo.toml` | Rust | `version` in `[package]` section | TOML: parse, update field, serialize back |
| `pyproject.toml` | Python (modern) | `version` in `[project]` or `[tool.poetry]` | TOML: parse, update field, serialize back |
| `setup.py` or `setup.cfg` | Python (legacy) | `version` in `setup()` call or `[metadata]` section | Regex replacement or INI parse |
| `go.mod` | Go | No version file convention | Use `VERSION` file (plain text) |
| `*.csproj` | .NET / C# | `<Version>` XML element in .csproj | XML: parse, update element, serialize back |
| `*.fsproj` | .NET / F# | `<Version>` XML element in .fsproj | XML: parse, update element, serialize back |
| `pom.xml` | Java (Maven) | `<version>` XML element | XML: parse, update element, serialize back |
| `build.gradle` or `build.gradle.kts` | Java/Kotlin (Gradle) | `version` property | Regex replacement |
| `mix.exs` | Elixir | `version` in `project/0` function | Regex replacement |
| `pubspec.yaml` | Dart / Flutter | `version` field | YAML: parse, update field, serialize back |
| `Package.swift` | Swift | No version file convention | Use `VERSION` file (plain text) |
| `*.gemspec` or `Gemfile` | Ruby | `version` in `.gemspec` if present | Regex replacement, or `VERSION` file fallback |
| `composer.json` | PHP | `version` field in `composer.json` | JSON: parse, update field, serialize back |
| `CMakeLists.txt` | C/C++ (CMake) | `project(... VERSION x.y.z)` | Regex replacement |
| `Makefile` (alone) | C/C++ (Make) | No convention | Use `VERSION` file (plain text) |
| `*.sln` | .NET Solution | Look for `<Version>` in .csproj files | XML parse |
| `Dockerfile` (alone) | Container | No convention | Use `VERSION` file (plain text) |
| None of the above | Non-programming | No convention | Use `VERSION` file (plain text) |

## Fallback: The VERSION File

When a project has no standard version file convention, create a plain `VERSION` file in the project root.

**Format:**

```
1.0.0
```

Rules:
- Contains ONLY the semver string (e.g., `1.0.0`), nothing else
- No `v` prefix — just the numbers
- Single line, no trailing content
- This is the universal fallback used by many projects without package manifests (Linux kernel, some Go projects, documentation projects, books, etc.)

## Non-Programming Projects

Documentation, books, novels, design systems, or any non-code project:
- Project type: "documentation" or "generic"
- Version file: `VERSION` (plain text)
- All other release conventions (changelog, git, semantic versioning) apply identically
- Semantic versioning still makes sense: major = restructure/incompatible change, minor = new content/chapter, patch = corrections/typos

## Discovery Process

1. List files in the project root
2. Walk the discovery table top-to-bottom, checking for each marker
3. On first match, read the version file and extract the current version
4. If the version file exists but has no version field (or is malformed), warn the user
5. If no marker matches, propose the `VERSION` file fallback
6. Present findings to the user for confirmation
