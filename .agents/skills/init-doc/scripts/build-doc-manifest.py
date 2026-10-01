#!/usr/bin/env python3
"""Generate doc-manifest.json — the derived, machine-first retrieval index for a
ProjectMemory documentation corpus.

The manifest is the single source of truth a reader (init-context recall,
project-memory query) loads to pinpoint docs in one read. This script is the ONLY
producer of doc-manifest.json — it is derived, never hand-edited. See
init-doc/references/standards.md § Documentation Manifest for the contract.

Python 3, standard library only (no third-party dependencies). The frontmatter
parser handles the strict description/tags/source/group subset by hand; anything
outside that subset is recorded as a parse_error rather than crashing the run.

Usage:
    build-doc-manifest.py [--root <project_root>] [--check | --drift | --affects]

    --root      Project root. Default: `git rev-parse --show-toplevel`, else cwd.
    --check     Recompute in memory, diff against the committed manifest + README
                block. Exit 0 = in sync, 1 = stale (regenerate), 2 = structural
                error (no README / no Documentation section). Writes nothing.
    --drift     Print advisory structural-drift signals (dangling docs; in a
                monorepo, undocumented and cross-group sub-projects) as JSON.
                Writes nothing.
    --affects   Read a newline-separated path list on stdin (e.g. the output of
                `git diff --name-only`) and print, as JSON, which docs each path
                maps to (the deterministic `match` test), the affected-doc union,
                and the changed paths no doc covers. Writes nothing.
"""

import argparse
import glob as globmod
import json
import os
import re
import subprocess
import sys

GENERATED_FROM = "README.md + docs/**/*.md (excl docs/manual/)"
MANIFEST_NAME = "doc-manifest.json"
BEGIN_MARKER = "<!-- BEGIN doc-index -->"
END_MARKER = "<!-- END doc-index -->"
TOC_BEGIN = "<!-- BEGIN toc -->"
TOC_END = "<!-- END toc -->"

SIZE_DEFAULT = 750
SIZE_MISSION = 150
SIZE_GOTCHAS_HUB = 50


# --------------------------------------------------------------------------- #
# Project root
# --------------------------------------------------------------------------- #
def resolve_root(arg_root):
    if arg_root:
        return os.path.abspath(arg_root)
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, check=True,
        )
        return out.stdout.strip()
    except Exception:
        sys.stderr.write(
            "Warning: not in a git repository and no --root given; "
            "assuming the current directory is the project root.\n"
        )
        return os.path.abspath(os.getcwd())


# --------------------------------------------------------------------------- #
# Scan set
# --------------------------------------------------------------------------- #
def collect_doc_paths(root):
    """README.md + every docs/**/*.md, excluding docs/manual/. Paths are
    project-root-relative and use forward slashes."""
    paths = []
    if os.path.isfile(os.path.join(root, "README.md")):
        paths.append("README.md")
    docs_dir = os.path.join(root, "docs")
    for dirpath, dirnames, filenames in os.walk(docs_dir):
        rel_dir = os.path.relpath(dirpath, root).replace(os.sep, "/")
        if rel_dir == "docs/manual" or rel_dir.startswith("docs/manual/"):
            dirnames[:] = []
            continue
        for fn in filenames:
            if fn.endswith(".md"):
                rel = os.path.relpath(os.path.join(dirpath, fn), root).replace(os.sep, "/")
                paths.append(rel)
    return sorted(set(paths))


def read_text(path):
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        return fh.read()


# --------------------------------------------------------------------------- #
# Frontmatter (strict subset, hand-parsed)
# --------------------------------------------------------------------------- #
def split_frontmatter(content):
    """Return (frontmatter_text_or_None, body, has_frontmatter)."""
    lines = content.split("\n")
    if lines and lines[0].strip() == "---":
        for k in range(1, len(lines)):
            if lines[k].strip() == "---":
                fm = "\n".join(lines[1:k])
                body = "\n".join(lines[k + 1:])
                return fm, body, True
    return None, content, False


def strip_scalar(value):
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]
    return value


def split_flow_list(inner):
    return [strip_scalar(part) for part in inner.split(",") if part.strip() != ""]


def parse_frontmatter(text):
    """Parse the strict `key: scalar`, `key: [a, b]`, and `key:\\n  - item`
    subset. Returns (data, error_or_None). Unsupported YAML (nested maps,
    anchors, multi-line scalars) yields an error note; the keys parsed so far
    are still returned."""
    data = {}
    error = None
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.strip() == "":
            i += 1
            continue
        m = re.match(r"^([A-Za-z0-9_-]+):(.*)$", line)
        if not m:
            error = error or "unparseable line: %s" % line.strip()[:40]
            i += 1
            continue
        key, rest = m.group(1), m.group(2).strip()
        if rest == "":
            # bare key: a block list may follow on subsequent `- ` lines
            items = []
            j = i + 1
            while j < len(lines):
                nxt = lines[j]
                if nxt.strip() == "":
                    j += 1
                    continue
                lm = re.match(r"^\s*-\s+(.*)$", nxt)
                if lm:
                    items.append(strip_scalar(lm.group(1)))
                    j += 1
                else:
                    break
            data[key] = items if items else None
            i = j if items else i + 1
            continue
        if rest.startswith("[") and rest.endswith("]"):
            data[key] = split_flow_list(rest[1:-1])
        elif rest[0] in "{&*|>":
            error = error or "unsupported YAML construct for key '%s'" % key
        else:
            data[key] = strip_scalar(rest)
        i += 1
    return data, error


def coerce_list(value):
    if isinstance(value, list):
        return [str(v) for v in value]
    if isinstance(value, str) and value != "":
        return [value]
    return []


# --------------------------------------------------------------------------- #
# Markdown extraction
# --------------------------------------------------------------------------- #
def extract_headings_with_levels(body):
    """[(level, text), ...] for h1-h4, in order, skipping fenced code blocks."""
    out = []
    in_fence = False
    fence = None
    for line in body.split("\n"):
        stripped = line.strip()
        if in_fence:
            if fence and stripped.startswith(fence):
                in_fence = False
            continue
        if stripped.startswith("```") or stripped.startswith("~~~"):
            in_fence = True
            fence = "```" if stripped.startswith("```") else "~~~"
            continue
        m = re.match(r"^(#{1,4})\s+(.*?)\s*#*\s*$", line)
        if m:
            out.append((len(m.group(1)), m.group(2).strip()))
    return out


def extract_headings(body):
    """All h1-h4 heading texts, in order (levels dropped)."""
    return [text for _, text in extract_headings_with_levels(body)]


LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")


def extract_links(body, doc_relpath):
    """Sorted, de-duplicated list of other docs this file cross-links to,
    as project-root-relative paths."""
    docdir = os.path.dirname(doc_relpath)
    targets = set()
    for m in LINK_RE.finditer(body):
        target = m.group(1).strip()
        if " " in target:  # strip optional link title: (path "title")
            target = target.split(" ", 1)[0]
        if target.startswith(("http://", "https://", "mailto:", "#")):
            continue
        target = target.split("#", 1)[0]
        if not target.endswith(".md"):
            continue
        norm = os.path.normpath(os.path.join(docdir, target)).replace(os.sep, "/")
        if norm.startswith(".."):
            continue
        targets.add(norm)
    return sorted(targets)


def github_slug(text):
    s = text.strip().lower()
    s = re.sub(r"[^\w\s-]", "", s)
    return s.replace(" ", "-")


def toc_entries(headings_with_levels):
    """The entries a Table of Contents should contain: (level, text, slug) for
    every h2-h4 heading, excluding the h1 title and any 'Table of Contents'
    heading, with GitHub-style duplicate-slug disambiguation (-1, -2, ...). The
    single source used by both TOC generation and staleness diagnosis, so the two
    can never disagree."""
    out, seen = [], {}
    for level, text in headings_with_levels:
        if level == 1:  # the h1 title is not listed in the TOC
            continue
        if text.strip().lower() == "table of contents":
            continue
        base = github_slug(text)
        if base in seen:
            seen[base] += 1
            slug = "%s-%d" % (base, seen[base])
        else:
            seen[base] = 0
            slug = base
        out.append((level, text, slug))
    return out


def build_toc(headings_with_levels):
    """Render a linked, h2-h4-indented Markdown TOC from a doc's headings."""
    return "\n".join(
        "%s- [%s](#%s)" % ("  " * (level - 2), text, slug)
        for level, text, slug in toc_entries(headings_with_levels)
    )


def toc_diagnostics(body, headings_with_levels):
    """{present, linked, stale} for the file's Table of Contents."""
    lines = body.split("\n")
    start = None
    for i, line in enumerate(lines):
        if re.match(r"^#{2,4}\s+Table of Contents\s*$", line):
            start = i
            break
    if start is None:
        return {"present": False, "linked": False, "stale": False}
    end = len(lines)
    for j in range(start + 1, len(lines)):
        if re.match(r"^#{1,4}\s+", lines[j]):
            end = j
            break
    block = "\n".join(lines[start + 1:end])
    toc_anchors = set(re.findall(r"\]\(#([^)]+)\)", block))
    expected = set(slug for _, _, slug in toc_entries(headings_with_levels))
    return {
        "present": True,
        "linked": len(toc_anchors) > 0,
        "stale": toc_anchors != expected,
    }


# --------------------------------------------------------------------------- #
# source glob resolution
# --------------------------------------------------------------------------- #
def glob_resolves(pattern, root):
    # recursive glob has a quirk: `dir/**` yields a phantom `dir/` even when
    # `dir` does not exist, so confirm each hit actually exists on disk.
    for hit in globmod.glob(os.path.join(root, pattern), recursive=True):
        if os.path.exists(hit):
            return True
    return False


def glob_prefix_dir(pattern):
    """Literal directory prefix of a glob, before the first metacharacter."""
    kept = []
    for seg in pattern.split("/"):
        if any(c in seg for c in "*?[]"):
            break
        kept.append(seg)
    return "/".join(kept)


# --------------------------------------------------------------------------- #
# source glob *match* (pure path-vs-pattern test — see standards.md
# § `source` semantics). Distinct from *resolve*: no filesystem lookup, so a
# deleted path still matches. This is the deterministic implementation of the
# diff->doc mapping that update-doc and init-context rely on.
# --------------------------------------------------------------------------- #
def glob_to_regex(pattern):
    """Compile a path glob to an anchored regex with the documented semantics:
    `*` matches within one path segment, `**` matches across segments at any
    depth (including zero), `?` one non-slash char, `[...]` a char class, and
    every other character literally."""
    i, n, out = 0, len(pattern), ["^"]
    while i < n:
        c = pattern[i]
        if c == "*":
            if i + 1 < n and pattern[i + 1] == "*":
                i += 2
                if i < n and pattern[i] == "/":
                    out.append("(?:.*/)?")  # `**/` -> zero or more segments
                    i += 1
                else:
                    out.append(".*")
            else:
                out.append("[^/]*")
                i += 1
        elif c == "?":
            out.append("[^/]")
            i += 1
        elif c == "[":
            j = i + 1
            if j < n and pattern[j] in "!^":
                j += 1
            if j < n and pattern[j] == "]":
                j += 1
            while j < n and pattern[j] != "]":
                j += 1
            if j >= n:  # unterminated class -> treat '[' literally
                out.append(re.escape(c))
                i += 1
            else:
                inner = pattern[i + 1:j]
                if inner and inner[0] in "!^":
                    inner = "^" + inner[1:]
                out.append("[" + inner + "]")
                i = j + 1
        else:
            out.append(re.escape(c))
            i += 1
    out.append("$")
    return "".join(out)


def compute_affects(manifest, changed_paths):
    """Map each changed path to the docs whose `source` globs *match* it. Returns
    {affects: {path: [docs]}, docs: [union], orphaned_paths: [unmatched paths
    that are not themselves docs]}. Pure string test — a deleted path still maps
    to the doc that documented it."""
    compiled = []
    for node in manifest["nodes"]:
        regexes = [re.compile(glob_to_regex(g)) for g in node.get("source", []) if g]
        if regexes:
            compiled.append((node["path"], regexes))
    doc_paths = {node["path"] for node in manifest["nodes"]}
    affects, union, orphaned = {}, set(), []
    for raw in changed_paths:
        path = raw.strip().replace(os.sep, "/")
        if not path:
            continue
        hits = sorted(doc for doc, rx in compiled if any(r.match(path) for r in rx))
        if hits:
            affects[path] = hits
            union.update(hits)
        elif path not in doc_paths and not path.startswith("docs/"):
            # orphaned = unmatched paths that are not themselves documentation:
            # exclude manifest doc-nodes and anything under docs/ (incl. the
            # protected docs/manual/ tree) so the set means "undocumented code".
            orphaned.append(path)
    return {"affects": affects, "docs": sorted(union), "orphaned_paths": sorted(orphaned)}


# --------------------------------------------------------------------------- #
# Groups — derived from the repo's existing workspace manifest (no config file)
# --------------------------------------------------------------------------- #
def expand_workspace_glob(root, pattern):
    out = []
    for path in globmod.glob(os.path.join(root, pattern), recursive=True):
        if not os.path.isdir(path):
            continue
        rel = os.path.relpath(path, root).replace(os.sep, "/")
        name = os.path.basename(rel)
        pj = os.path.join(path, "package.json")
        if os.path.isfile(pj):
            try:
                nm = json.loads(read_text(pj)).get("name")
                if nm:
                    name = nm
            except Exception:
                pass
        out.append((name, rel))
    return out


def parse_pnpm_packages(path):
    globs = []
    in_packages = False
    for raw in read_text(path).split("\n"):
        if re.match(r"^packages:\s*$", raw):
            in_packages = True
            continue
        if in_packages:
            m = re.match(r"^\s*-\s+(.*\S)\s*$", raw)
            if m:
                globs.append(strip_scalar(m.group(1)))
            elif raw.strip() == "":
                continue
            elif not raw.startswith((" ", "\t")):
                break
    return globs


def parse_cargo_members(path):
    text = read_text(path)
    section = re.search(r"\[workspace\](.*?)(\n\[|\Z)", text, re.S)
    if not section:
        return []
    members = re.search(r"members\s*=\s*\[(.*?)\]", section.group(1), re.S)
    if not members:
        return []
    return re.findall(r"\"([^\"]+)\"", members.group(1))


def detect_groups(root):
    """Discover sub-projects from the repo's workspace tooling. Returns a list of
    {name, root_dir, roots, parent}, or [] when no workspace manifest exists."""
    pkgs = []
    pj = os.path.join(root, "package.json")
    if os.path.isfile(pj):
        try:
            ws = json.loads(read_text(pj)).get("workspaces")
            patterns = ws if isinstance(ws, list) else (ws or {}).get("packages", []) if isinstance(ws, dict) else []
            for g in patterns:
                pkgs += expand_workspace_glob(root, g)
        except Exception:
            pass
    if not pkgs and os.path.isfile(os.path.join(root, "pnpm-workspace.yaml")):
        for g in parse_pnpm_packages(os.path.join(root, "pnpm-workspace.yaml")):
            pkgs += expand_workspace_glob(root, g)
    if not pkgs and os.path.isfile(os.path.join(root, "lerna.json")):
        try:
            for g in json.loads(read_text(os.path.join(root, "lerna.json"))).get("packages", []):
                pkgs += expand_workspace_glob(root, g)
        except Exception:
            pass
    if not pkgs and os.path.isfile(os.path.join(root, "Cargo.toml")):
        for g in parse_cargo_members(os.path.join(root, "Cargo.toml")):
            pkgs += expand_workspace_glob(root, g)

    by_root = {}
    for name, root_dir in pkgs:
        by_root.setdefault(root_dir, name)
    groups = [
        {"name": name, "root_dir": root_dir, "roots": [root_dir + "/**"], "parent": None}
        for root_dir, name in by_root.items()
    ]
    for g in groups:
        best = None
        for h in groups:
            if h is g or h["root_dir"] == g["root_dir"]:
                continue
            if g["root_dir"].startswith(h["root_dir"] + "/"):
                if best is None or len(h["root_dir"]) > len(best["root_dir"]):
                    best = h
        g["parent"] = best["name"] if best else None
    groups.sort(key=lambda x: x["name"])
    return groups


def assign_group(source, group_override, groups):
    if not groups:
        return None
    if not source:
        if group_override and any(g["name"] == group_override for g in groups):
            return group_override
        return None
    best = None
    for src in source:
        prefix = glob_prefix_dir(src)
        if not prefix:
            continue
        for g in groups:
            rd = g["root_dir"]
            if prefix == rd or prefix.startswith(rd + "/"):
                if best is None or len(rd) > len(best[1]):
                    best = (g["name"], rd)
    return best[0] if best else None


# --------------------------------------------------------------------------- #
# Node construction
# --------------------------------------------------------------------------- #
def build_node(root, relpath, content, hub_domain_mode):
    fm_text, body, has_fm = split_frontmatter(content)
    description, tags, source, group_override, parse_error = None, [], [], None, None
    if has_fm:
        data, parse_error = parse_frontmatter(fm_text)
        d = data.get("description")
        description = d if isinstance(d, str) and d != "" else None
        tags = coerce_list(data.get("tags"))
        source = coerce_list(data.get("source"))
        g = data.get("group")
        group_override = g if isinstance(g, str) and g != "" else None

    headings_wl = extract_headings_with_levels(body)
    headings = [text for _, text in headings_wl]
    resolved_unresolved = ([], [])
    for glob in source:
        resolved_unresolved[0 if glob_resolves(glob, root) else 1].append(glob)
    line_count = len(content.splitlines())
    limit = size_limit(relpath, hub_domain_mode)

    title = headings[0] if headings else filename_title(relpath)
    node = {
        "path": relpath,
        "description": description,
        "tags": tags,
        "source": source,
        "source_unresolved": resolved_unresolved[1],
        "dangling": bool(source) and not resolved_unresolved[0],
        "has_frontmatter": has_fm,
        "parse_error": parse_error,
        "headings": headings,
        "links_to": extract_links(body, relpath),
        "line_count": line_count,
        "toc": toc_diagnostics(body, headings_wl),
        "over_size": line_count > limit,
    }
    node["_title"] = title
    node["_group_override"] = group_override
    return node


def filename_title(relpath):
    base = os.path.basename(relpath)[:-3] if relpath.endswith(".md") else os.path.basename(relpath)
    return base.replace("-", " ").replace("_", " ").strip().title()


def size_limit(relpath, hub_domain_mode):
    if relpath == "README.md":
        return SIZE_DEFAULT
    if relpath == "docs/mission.md":
        return SIZE_MISSION
    if relpath == "docs/gotchas.md":
        return SIZE_GOTCHAS_HUB if hub_domain_mode else SIZE_DEFAULT
    return SIZE_DEFAULT


# --------------------------------------------------------------------------- #
# README managed block
# --------------------------------------------------------------------------- #
def build_doc_index(nodes_by_path):
    entries = []
    for path in sorted(nodes_by_path):
        if path == "README.md" or path.startswith("docs/gotchas/") or path.startswith("docs/manual/"):
            continue
        node = nodes_by_path[path]
        title = node["_title"]
        desc = node["description"]
        entries.append("- [%s](%s) — %s" % (title, path, desc) if desc else "- [%s](%s)" % (title, path))
    return "\n".join(entries)


def update_readme(content, index_block):
    """Return (new_content, error). error is 'no-doc-section' when there is no
    managed block and no Documentation section to host one."""
    if BEGIN_MARKER in content and END_MARKER in content:
        pre = content.split(BEGIN_MARKER)[0]
        post = content.split(END_MARKER, 1)[1]
        return pre + BEGIN_MARKER + "\n" + index_block + "\n" + END_MARKER + post, None
    # Prefer a heading whose text is exactly "Documentation"; fall back to any
    # heading containing it. Exact-first means a real "## Documentation" wins
    # over a preceding "## API Documentation", while the fallback still hosts the
    # block under a legacy "## Project Documentation" section (no regression).
    heading = (
        re.search(r"^#{1,6}\s+Documentation\s*$", content, re.M | re.I)
        or re.search(r"^#{1,6}\s+.*\bDocumentation\b.*$", content, re.M | re.I)
    )
    if not heading:
        return content, "no-doc-section"
    idx = heading.end()
    insert = "\n\n" + BEGIN_MARKER + "\n" + index_block + "\n" + END_MARKER + "\n"
    return content[:idx] + insert + content[idx:], None


def update_readme_toc(content, toc_md):
    """Regenerate the README's Table of Contents inside a managed block (so it is
    derived, single-sourced, and can never go stale). Fills the
    <!-- BEGIN toc -->/<!-- END toc --> markers if present; else owns the body of
    a '## Table of Contents' section; else inserts the section after the h1.
    README is the only doc that carries a TOC."""
    block = TOC_BEGIN + "\n" + toc_md + "\n" + TOC_END
    if TOC_BEGIN in content and TOC_END in content:
        pre = content.split(TOC_BEGIN)[0]
        post = content.split(TOC_END, 1)[1]
        return pre + block + post
    m = re.search(r"^#{2,4}[ \t]+Table of Contents[ \t]*$", content, re.M | re.I)
    if m:
        start = m.end()
        rest = content[start:]
        nxt = re.search(r"^#{1,6}[ \t]+\S", rest, re.M)
        end = start + (nxt.start() if nxt else len(rest))
        return content[:start] + "\n\n" + block + "\n\n" + content[end:]
    h1 = re.search(r"^#[ \t]+\S.*$", content, re.M)
    if not h1:
        return content
    idx = h1.end()
    return content[:idx] + "\n\n## Table of Contents\n\n" + block + "\n" + content[idx:]


# --------------------------------------------------------------------------- #
# Diagnostics (top-level, mechanical)
# --------------------------------------------------------------------------- #
def gotchas_diagnostics(root, nodes_by_path, hub_domain_mode):
    domain_files = sorted(
        p for p in nodes_by_path if p.startswith("docs/gotchas/") and p.endswith(".md")
    )
    hub_exists = "docs/gotchas.md" in nodes_by_path
    if domain_files:
        fmt = "hub+domain"
    elif hub_exists:
        fmt = "monolithic"
    else:
        fmt = "missing"

    orphaned, dead, oversized = [], [], []
    if fmt == "hub+domain":
        hub = nodes_by_path.get("docs/gotchas.md")
        hub_links = set(hub["links_to"]) if hub else set()
        orphaned = [d for d in domain_files if d not in hub_links]
        dead = sorted(l for l in hub_links if l.startswith("docs/gotchas/") and l not in domain_files)
        for d in domain_files:
            if nodes_by_path[d]["line_count"] > SIZE_DEFAULT:
                oversized.append({"path": d, "line_count": nodes_by_path[d]["line_count"]})
    return {
        "format": fmt,
        "orphaned_domain_files": orphaned,
        "dead_hub_links": dead,
        "oversized_domain_files": oversized,
    }


# --------------------------------------------------------------------------- #
# Assembly
# --------------------------------------------------------------------------- #
def public_node(node, has_groups):
    keys = [
        "path", "description", "tags", "source", "source_unresolved", "dangling",
        "has_frontmatter", "parse_error", "headings", "links_to", "line_count",
        "toc", "over_size",
    ]
    out = {k: node[k] for k in keys}
    if has_groups:
        out["group"] = node["group"]
    return out


def build_manifest(root):
    """Build (manifest_dict, new_readme_text_or_None, readme_error). The README
    node reflects the regenerated managed block so the manifest and README are
    mutually consistent."""
    paths = collect_doc_paths(root)
    hub_domain_mode = any(
        p.startswith("docs/gotchas/") and p.endswith(".md") for p in paths
    )

    nodes_by_path = {}
    for relpath in paths:
        content = read_text(os.path.join(root, relpath))
        nodes_by_path[relpath] = build_node(root, relpath, content, hub_domain_mode)

    # Regenerate the README managed block, then refresh the README node from it
    # so links_to / diagnostics reflect what we actually write.
    new_readme = None
    readme_error = None
    if "README.md" in nodes_by_path:
        original = read_text(os.path.join(root, "README.md"))
        new_readme, readme_error = update_readme(original, build_doc_index(nodes_by_path))
        if readme_error is None:
            # Regenerate the README's TOC from its own headings (single-sourced,
            # so it can never go stale). README is the only doc that carries one.
            _, readme_body, _ = split_frontmatter(new_readme)
            new_readme = update_readme_toc(new_readme, build_toc(extract_headings_with_levels(readme_body)))
            nodes_by_path["README.md"] = build_node(root, "README.md", new_readme, hub_domain_mode)

    groups = detect_groups(root)
    has_groups = bool(groups)
    for node in nodes_by_path.values():
        node["group"] = assign_group(node["source"], node["_group_override"], groups)

    manifest = {
        "generated_from": GENERATED_FROM,
        "nodes": [public_node(nodes_by_path[p], has_groups) for p in sorted(nodes_by_path)],
        "diagnostics": {
            "gotchas": gotchas_diagnostics(root, nodes_by_path, hub_domain_mode),
        },
    }
    if has_groups:
        manifest["groups"] = [
            {"name": g["name"], "roots": g["roots"], "parent": g["parent"]} for g in groups
        ]
    return manifest, new_readme, readme_error


def serialize(manifest):
    return json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


# --------------------------------------------------------------------------- #
# Structural drift (advisory) — consumed by project-memory Inspect via --drift
# --------------------------------------------------------------------------- #
def _group_root_dir(roots):
    r = roots[0] if roots else ""
    return r[:-3] if r.endswith("/**") else r


def _best_group(prefix, group_roots):
    """Most-specific group whose root dir contains `prefix`, or None."""
    best = None
    for name, rd in group_roots.items():
        if rd and (prefix == rd or prefix.startswith(rd + "/")):
            if best is None or len(rd) > len(group_roots[best]):
                best = name
    return best


def compute_drift(manifest):
    """Deterministic structural-drift signals derived from the manifest — the
    mechanical inputs to project-memory Inspect's 'has the graph gone archaic?'
    judgment. All signals are advisory; a small amount of drift is healthy.

    - dangling_docs:      docs whose documented code is gone (all globs unresolved)
    - groups_without_docs (monorepo): declared sub-projects no doc maps to
    - cross_group_docs    (monorepo): docs whose source straddles sibling
                          sub-projects — candidate splits
    """
    nodes = manifest["nodes"]
    out = {"dangling_docs": sorted(n["path"] for n in nodes if n.get("dangling"))}
    groups = manifest.get("groups")
    if groups:
        group_roots = {g["name"]: _group_root_dir(g["roots"]) for g in groups}
        documented = set()
        cross = []
        for n in nodes:
            best_set = set()
            for src in n.get("source", []):
                prefix = glob_prefix_dir(src)
                if prefix:
                    g = _best_group(prefix, group_roots)
                    if g:
                        best_set.add(g)
            if n.get("group"):
                documented.add(n["group"])
            # sprawl = the doc's globs map to two groups that are siblings
            # (neither group's root dir is an ancestor of the other's — nesting
            # like billing / billing-api is not sprawl)
            members = sorted(best_set)
            sprawl = any(
                not (
                    group_roots[a] == group_roots[b]
                    or group_roots[a].startswith(group_roots[b] + "/")
                    or group_roots[b].startswith(group_roots[a] + "/")
                )
                for i, a in enumerate(members)
                for b in members[i + 1:]
            )
            if sprawl:
                cross.append({"path": n["path"], "groups": members})
        out["groups_without_docs"] = sorted(
            g["name"] for g in groups if g["name"] not in documented
        )
        out["cross_group_docs"] = cross
    return out


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #
def main():
    parser = argparse.ArgumentParser(description="Generate doc-manifest.json.")
    parser.add_argument("--root", default=None)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--drift", action="store_true")
    parser.add_argument("--affects", action="store_true")
    args = parser.parse_args()

    root = resolve_root(args.root)
    if not os.path.isfile(os.path.join(root, "README.md")):
        sys.stderr.write("Error: no README.md at project root %s\n" % root)
        return 2

    manifest, new_readme, readme_error = build_manifest(root)

    if args.drift:
        # Write-free structural-drift report (advisory). Works even on a legacy
        # corpus with no Documentation section — drift is about source coverage,
        # not the README block.
        report = {"drift": compute_drift(manifest)}
        sys.stdout.write(json.dumps(report, indent=2, sort_keys=True) + "\n")
        d = report["drift"]
        signals = (
            len(d["dangling_docs"])
            + len(d.get("groups_without_docs", []))
            + len(d.get("cross_group_docs", []))
        )
        sys.stderr.write("drift signals: %d\n" % signals)
        return 0

    if args.affects:
        # Deterministic diff->doc mapping. Independent of the README managed
        # block (it reads source globs), so it runs before the no-doc-section
        # gate below. A README at the project root is still required — the gate
        # near the top of main() — as in every mode.
        changed = sys.stdin.read().split("\n")
        sys.stdout.write(json.dumps(compute_affects(manifest, changed), indent=2, sort_keys=True) + "\n")
        return 0

    if readme_error == "no-doc-section":
        sys.stderr.write(
            "STOP: README.md has no doc-index managed block and no Documentation "
            "section to host one. Add a '## Documentation' section (or the "
            "<!-- BEGIN doc-index -->/<!-- END doc-index --> markers) and re-run.\n"
        )
        return 2

    manifest_text = serialize(manifest)
    manifest_path = os.path.join(root, MANIFEST_NAME)
    readme_path = os.path.join(root, "README.md")

    if args.check:
        drift = []
        committed = read_text(manifest_path) if os.path.isfile(manifest_path) else None
        if committed is None:
            drift.append("%s is missing" % MANIFEST_NAME)
        elif committed != manifest_text:
            drift.append("%s is stale (regenerate)" % MANIFEST_NAME)
        if new_readme is not None and read_text(readme_path) != new_readme:
            drift.append("README doc-index block is stale (regenerate)")
        if drift:
            sys.stderr.write("Manifest drift detected:\n  - " + "\n  - ".join(drift) + "\n")
            return 1
        sys.stdout.write("Manifest and README doc-index are in sync.\n")
        return 0

    with open(manifest_path, "w", encoding="utf-8") as fh:
        fh.write(manifest_text)
    wrote_readme = False
    if new_readme is not None and read_text(readme_path) != new_readme:
        with open(readme_path, "w", encoding="utf-8") as fh:
            fh.write(new_readme)
        wrote_readme = True

    node_count = len(manifest["nodes"])
    group_note = " | %d group(s)" % len(manifest["groups"]) if "groups" in manifest else ""
    sys.stdout.write(
        "Wrote %s (%d node%s)%s%s\n" % (
            MANIFEST_NAME, node_count, "" if node_count == 1 else "s", group_note,
            " | README doc-index updated" if wrote_readme else "",
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
