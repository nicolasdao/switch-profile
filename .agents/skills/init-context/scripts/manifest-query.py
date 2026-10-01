#!/usr/bin/env python3
"""Read-side queries over a committed doc-manifest.json.

init-context is the *recall* skill: it must load the right docs at session start
and keep loading them as work moves into new areas. Both operations are lookups
against the manifest, and both are cheaper and more reliable as code than as
model judgment.

Two modes:

  --index     Print the lean retrieval index: every doc's path, description,
              tags, source globs and cross-links, plus the gotchas format and
              (in a monorepo) the groups block. Omits only the fields recall
              never reads. Roughly a quarter the size of the raw manifest, with
              no loss of triage signal.

  --affects   Read file paths on stdin (or as arguments) and print the docs
              whose `source` globs match them. This is the mid-session trigger:
              before touching a file, ask what documents it.

This script NEVER writes and NEVER regenerates the manifest. Freshness is the
producers' job (init-doc / update-doc / refactor-doc). If doc-manifest.json is
absent or unreadable, it exits non-zero so the caller falls back to reading the
manifest directly.

Standard library only. Python >= 3.8. Works on macOS, Linux and Windows.
"""

import argparse
import json
import os
import re
import subprocess
import sys

MANIFEST_NAME = "doc-manifest.json"

# Fields recall never reads. `headings` is the exception-with-a-condition: it is
# signal 3 in triage, but only for nodes whose frontmatter is missing or
# unparseable — for every other node the description/tags outrank it and it is
# pure bulk (about half the manifest). It is re-attached below for exactly the
# nodes that need it.
DROP_ALWAYS = ("toc", "over_size", "line_count", "source_unresolved")


def resolve_root(explicit=None):
    """Project root = git toplevel, matching every other skill in the family."""
    if explicit:
        return os.path.abspath(explicit)
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, check=False,
        )
        if out.returncode == 0 and out.stdout.strip():
            return out.stdout.strip()
    except (OSError, ValueError):
        pass
    return os.getcwd()


def glob_to_regex(pattern):
    """Compile a path glob to an anchored regex with the documented semantics:
    `*` matches within one path segment, `**` matches across segments at any
    depth (including zero), `?` one non-slash char, `[...]` a char class, and
    every other character literally.

    Copied verbatim from init-doc/scripts/build-doc-manifest.py so that the two
    skills agree on `match` by construction rather than by coincidence. See
    init-doc/references/standards.md - `source` semantics. If that definition
    ever changes, this copy must change with it.
    """
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


def load_manifest(root):
    path = os.path.join(root, MANIFEST_NAME)
    if not os.path.isfile(path):
        sys.stderr.write(
            "No %s at %s. Fall back to README-link triage; run /init-doc to "
            "generate one.\n" % (MANIFEST_NAME, root)
        )
        return None
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (ValueError, OSError) as exc:
        sys.stderr.write(
            "%s is present but unreadable (%s). Fall back to reading it "
            "directly.\n" % (MANIFEST_NAME, exc)
        )
        return None


def low_confidence(node):
    """Nodes whose own header cannot be trusted for triage."""
    return (
        node.get("parse_error") is not None
        or node.get("has_frontmatter") is False
        or node.get("dangling") is True
    )


def group_names(manifest):
    """`groups` is a LIST of {name, roots, parent} records, not a mapping — see
    init-doc/scripts/build-doc-manifest.py and standards.md - Groups. Present
    only in a monorepo; absent entirely for single-project repos."""
    out = []
    for g in manifest.get("groups") or []:
        if isinstance(g, dict) and g.get("name"):
            out.append(g)
    return sorted(out, key=lambda g: g["name"])


def render_index(manifest):
    """Field labels here deliberately match the names SKILL.md tells the model to
    read (`diagnostics.gotchas.format`, `links_to`, `parse_error`, ...), so the
    instructions and this output share one vocabulary."""
    nodes = manifest.get("nodes", [])
    groups = group_names(manifest)
    lines = []

    diag = (manifest.get("diagnostics") or {}).get("gotchas") or {}
    header = "# doc-index | nodes: %d | diagnostics.gotchas.format: %s" % (
        len(nodes), diag.get("format", "unknown"),
    )
    if groups:
        header += " | groups: %s" % ", ".join(g["name"] for g in groups)
    lines.append(header)
    lines.append(
        "# Fields: path :: description :: tags :: source :: links_to"
        + (" :: group" if groups else "")
        + "   (trailing !flags mark unreliable headers; `headings` is included "
        "only for those nodes, where it is the sole remaining triage signal)"
    )

    for node in nodes:
        parts = [node.get("path", "?")]
        desc = (node.get("description") or "").strip()
        parts.append(desc if desc else "-")
        for key in ("tags", "source", "links_to"):
            vals = node.get(key) or []
            parts.append(",".join(vals) if vals else "-")
        if groups:
            parts.append(node.get("group") or "-")
        line = " :: ".join(parts)

        if low_confidence(node):
            flags = []
            if node.get("parse_error") is not None:
                flags.append("parse_error")
            if node.get("has_frontmatter") is False:
                flags.append("has_frontmatter=false")
            if node.get("dangling") is True:
                flags.append("dangling=true")
            line += " :: !" + ",".join(flags)
            heads = node.get("headings") or []
            if heads:
                line += " :: headings=%s" % ",".join(
                    h if isinstance(h, str) else str(h) for h in heads
                )
        lines.append(line)

    for g in groups:
        lines.append(
            "# group %s :: roots=%s%s" % (
                g["name"],
                ",".join(g.get("roots") or []) or "-",
                " :: parent=%s" % g["parent"] if g.get("parent") else "",
            )
        )

    return "\n".join(lines) + "\n"


WIN_DRIVE = re.compile(r"^[A-Za-z]:[\\/]")


def to_repo_relative(raw, root):
    """Reduce an input path to the repo-relative POSIX form the globs are written in.

    init-doc's --affects is fed `git diff` output, which is *always* repo-relative,
    so it normalises nothing. This script's mainline caller is different: Step 8
    runs immediately before an `Edit`/`Write`, and those carry **absolute** paths.
    An absolute path can never match a repo-relative glob, so without this every
    real edit would silently answer "no documented coverage" — the exact silent
    miss Step 8 exists to prevent.

    Repo-relative input is returned unchanged, so results stay identical to
    init-doc for every input init-doc actually receives. This is a strict
    extension of its behaviour, not a divergence from it.
    """
    path = raw.strip()
    if not path:
        return ""
    if WIN_DRIVE.match(path):
        path = path.replace("\\", "/")
    else:
        path = path.replace(os.sep, "/")
    if os.path.isabs(path) or WIN_DRIVE.match(path):
        try:
            path = os.path.relpath(path, root).replace(os.sep, "/")
        except ValueError:
            # Different drive on Windows — cannot be inside the repo.
            return path
    while path.startswith("./"):
        path = path[2:]
    return path


def compute_affects(manifest, changed_paths, root=""):
    """Map each path to the docs whose `source` globs match it.

    Pure string test, not a filesystem lookup — a deleted path still maps to the
    doc that documented it. Mirrors init-doc's --affects mode, plus the
    absolute-path normalisation described in to_repo_relative.
    """
    compiled = []
    for node in manifest.get("nodes", []):
        regexes = [re.compile(glob_to_regex(g)) for g in (node.get("source") or []) if g]
        if regexes:
            compiled.append((node["path"], regexes))
    doc_paths = {node["path"] for node in manifest.get("nodes", [])}

    affects, union, orphaned = {}, set(), []
    for raw in changed_paths:
        path = to_repo_relative(raw, root)
        if not path:
            continue
        hits = sorted(doc for doc, rx in compiled if any(r.match(path) for r in rx))
        if hits:
            affects[path] = hits
            union.update(hits)
        elif path not in doc_paths and not path.startswith("docs/"):
            orphaned.append(path)
    return {"affects": affects, "docs": sorted(union), "orphaned_paths": sorted(orphaned)}


def render_affects(result):
    if not result["affects"]:
        if result["orphaned_paths"]:
            return "no documented coverage for: %s\n" % ", ".join(result["orphaned_paths"])
        # Nothing matched and nothing was orphaned: the inputs were docs, or
        # under docs/, or empty. Say so rather than printing a dangling label
        # that reads like an authoritative "nothing documents this".
        return "no code paths to look up (inputs were documentation or empty)\n"
    lines = []
    for path in sorted(result["affects"]):
        lines.append("%s -> %s" % (path, ", ".join(result["affects"][path])))
    lines.append("READ THESE: %s" % ", ".join(result["docs"]))
    if result["orphaned_paths"]:
        lines.append("undocumented: %s" % ", ".join(result["orphaned_paths"]))
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(
        description="Read-side queries over a committed doc-manifest.json."
    )
    parser.add_argument("--root", default=None, help="project root (default: git toplevel)")
    parser.add_argument("--index", action="store_true", help="print the lean retrieval index")
    parser.add_argument("--affects", action="store_true", help="map file paths to the docs covering them")
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    parser.add_argument("paths", nargs="*", help="paths for --affects (else read stdin)")
    args = parser.parse_args()

    if args.index == args.affects:
        parser.error("choose exactly one of --index or --affects")

    root = resolve_root(args.root)
    manifest = load_manifest(root)
    if manifest is None:
        return 2

    if args.index:
        if args.json:
            slim = []
            for node in manifest.get("nodes", []):
                out = {k: v for k, v in node.items() if k not in DROP_ALWAYS}
                if not low_confidence(node):
                    out.pop("headings", None)
                slim.append(out)
            payload = {"nodes": slim}
            if manifest.get("groups"):
                payload["groups"] = manifest["groups"]
            if manifest.get("diagnostics"):
                payload["diagnostics"] = manifest["diagnostics"]
            sys.stdout.write(json.dumps(payload, separators=(",", ":"), sort_keys=True) + "\n")
        else:
            sys.stdout.write(render_index(manifest))
        return 0

    paths = args.paths if args.paths else sys.stdin.read().split("\n")
    result = compute_affects(manifest, paths, root)
    if args.json:
        sys.stdout.write(json.dumps(result, indent=2, sort_keys=True) + "\n")
    else:
        sys.stdout.write(render_affects(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
