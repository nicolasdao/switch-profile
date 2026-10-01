#!/usr/bin/env python3
"""Guards for manifest-query.py.

Run from anywhere:  python3 <skill-dir>/scripts/test-manifest-query.py

Two classes of defect are guarded here because both have already occurred:

  1. Untested manifest shapes. `groups` is a LIST of records, not a mapping, and
     is absent from single-project repos — so the monorepo path never runs in a
     normal test and silently rotted (it raised TypeError).

  2. Vocabulary drift between SKILL.md and this script. SKILL.md tells the model
     to read specific field names; if --index prints different labels, the model
     is instructed to look for something it will never see. That is invisible in
     any test that only checks the script in isolation, so it is checked here
     against SKILL.md itself.

Standard library only. No network, no writes outside a temp dir.
"""

import importlib.util
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "manifest-query.py")
SKILL_MD = os.path.join(os.path.dirname(HERE), "SKILL.md")

failures = []


def check(name, condition, detail=""):
    print(("  PASS  " if condition else "  FAIL  ") + name + (" — " + detail if detail and not condition else ""))
    if not condition:
        failures.append(name)


def load_module():
    spec = importlib.util.spec_from_file_location("mq", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def sample_manifest(with_groups=False):
    manifest = {
        "diagnostics": {"gotchas": {"format": "hub+domain"}},
        "nodes": [
            {"path": "README.md", "description": None, "tags": [], "source": [],
             "links_to": ["docs/a.md"], "headings": ["Title"], "has_frontmatter": False,
             "parse_error": None, "dangling": False, "group": None},
            {"path": "docs/a.md", "description": "Alpha doc", "tags": ["x"],
             "source": ["src/a/**"], "links_to": [], "headings": ["A"],
             "has_frontmatter": True, "parse_error": None, "dangling": False,
             "group": "billing" if with_groups else None},
            {"path": "docs/broken.md", "description": None, "tags": [],
             "source": ["gone/**"], "links_to": [], "headings": ["Broken"],
             "has_frontmatter": True, "parse_error": "bad yaml at line 2",
             "dangling": True, "group": None},
        ],
    }
    if with_groups:
        manifest["groups"] = [
            {"name": "web", "roots": ["apps/web"], "parent": None},
            {"name": "billing", "roots": ["packages/billing"], "parent": None},
        ]
    return manifest


def main():
    mq = load_module()

    print("group rendering")
    # A monorepo manifest must render without raising. This is the exact shape
    # build-doc-manifest.py emits: a list of {name, roots, parent}.
    try:
        out = mq.render_index(sample_manifest(with_groups=True))
        rendered = True
    except Exception as exc:  # noqa: BLE001 - the point is that nothing escapes
        out, rendered = "", False
        check("monorepo manifest renders", False, "%s: %s" % (type(exc).__name__, exc))
    if rendered:
        check("monorepo manifest renders", True)
        check("group names in header", "groups: billing, web" in out, out.split("\n")[0])
        check("per-node group emitted", ":: billing" in out,
              "Step 4 scopes by group; without it monorepo scoping cannot work")
        check("group roots emitted", "roots=packages/billing" in out)
    check("single-project manifest renders",
          "groups" not in mq.render_index(sample_manifest(with_groups=False)))

    print("low-confidence flags")
    out = mq.render_index(sample_manifest())
    check("has_frontmatter=false flagged", "!has_frontmatter=false" in out)
    check("headings kept for unreliable nodes", "headings=Title" in out)
    check("parse_error flagged", "parse_error" in out)
    check("dangling flagged", "dangling=true" in out)
    # The invariant that matters: headings ride along ONLY for nodes whose header
    # cannot be trusted. `headings` is ~50% of the raw manifest, so emitting it
    # for a node that already has a description would undo the whole saving.
    reliable = [n for n in sample_manifest()["nodes"] if not mq.low_confidence(n)]
    check("headings dropped for every reliable node",
          all("headings=%s" % n["headings"][0] not in out for n in reliable),
          "reliable nodes: %s" % [n["path"] for n in reliable])
    check("headings emitted once per unreliable node only",
          out.count("headings=") == sum(
              1 for n in sample_manifest()["nodes"] if mq.low_confidence(n)))

    print("SKILL.md vocabulary parity")
    # Every field name the instructions tell the model to read must appear
    # verbatim in what --index actually prints.
    skill = open(SKILL_MD, encoding="utf-8").read()
    out = mq.render_index(sample_manifest(with_groups=True))
    for field in ("diagnostics.gotchas.format", "links_to", "parse_error",
                  "has_frontmatter", "dangling", "description", "tags", "source"):
        if field in skill:
            check("SKILL.md references %r -> appears in --index" % field, field in out)

    print("affects")
    manifest = sample_manifest()
    res = mq.compute_affects(manifest, ["src/a/deep/file.ts"])
    check("glob match across segments", res["docs"] == ["docs/a.md"], str(res))
    res = mq.compute_affects(manifest, ["src/b/other.ts"])
    check("unmatched path reported as orphaned",
          res["docs"] == [] and res["orphaned_paths"] == ["src/b/other.ts"], str(res))
    res = mq.compute_affects(manifest, ["src/a/deleted.ts"])
    check("deleted path still maps (pure string match)", res["docs"] == ["docs/a.md"])
    # Separator handling is host-relative, copied verbatim from init-doc: paths
    # are normalised with the running platform's os.sep. That is correct, not a
    # gap — on POSIX a backslash is a legal filename character, so rewriting it
    # would corrupt real paths. Assert the host's actual semantics.
    res = mq.compute_affects(manifest, ["src\\a\\win.ts"])
    expected = ["docs/a.md"] if os.sep == "\\" else []
    check("separators follow host os.sep (parity with init-doc)",
          res["docs"] == expected, str(res))
    check("blank lines ignored", mq.compute_affects(manifest, ["", "  "])["docs"] == [])

    # THE mainline case: Step 8 runs immediately before an Edit/Write, and those
    # carry ABSOLUTE paths. If this regresses, the whole progressive-loading
    # mechanism silently answers "no documented coverage" for every real edit
    # while exiting 0 — a silent miss in the one place built to prevent them.
    root = "/repo/project" if os.sep == "/" else "C:\\repo\\project"
    absolute = os.path.join(root, "src", "a", "deep", "file.ts")
    res = mq.compute_affects(manifest, [absolute], root)
    check("ABSOLUTE path matches (the Edit/Write case)",
          res["docs"] == ["docs/a.md"], str(res))
    res = mq.compute_affects(manifest, ["./src/a/file.ts"], root)
    check("./-prefixed path matches", res["docs"] == ["docs/a.md"], str(res))
    res = mq.compute_affects(manifest, ["src/a/file.ts"], root)
    check("repo-relative still matches (parity with init-doc preserved)",
          res["docs"] == ["docs/a.md"], str(res))
    outside = os.path.join(os.sep + "elsewhere" if os.sep == "/" else "C:\\elsewhere", "src", "a", "x.ts")
    res = mq.compute_affects(manifest, [outside], root)
    check("path outside the repo does not match", res["docs"] == [], str(res))

    print("affects rendering")
    empty = mq.compute_affects(manifest, ["docs/a.md"])
    out = mq.render_affects(empty)
    check("doc-only input does not print a dangling label",
          "no documented coverage for: \n" != out and out.strip().endswith(")"), repr(out))
    out = mq.render_affects(mq.compute_affects(manifest, ["src/zzz/none.ts"]))
    check("genuinely uncovered code path is named",
          "src/zzz/none.ts" in out, repr(out))

    print("cli contract")
    with tempfile.TemporaryDirectory() as tmp:
        p = subprocess.run([sys.executable, SCRIPT, "--root", tmp, "--index"],
                           capture_output=True, text=True)
        check("missing manifest exits non-zero", p.returncode != 0, "rc=%d" % p.returncode)
        check("missing manifest explains the fallback", "Fall back" in p.stderr)

        bad = os.path.join(tmp, "doc-manifest.json")
        with open(bad, "w", encoding="utf-8") as fh:
            fh.write("{not json")
        p = subprocess.run([sys.executable, SCRIPT, "--root", tmp, "--index"],
                           capture_output=True, text=True)
        check("unreadable manifest exits non-zero", p.returncode != 0)

        with open(bad, "w", encoding="utf-8") as fh:
            json.dump(sample_manifest(with_groups=True), fh)
        p = subprocess.run([sys.executable, SCRIPT, "--root", tmp, "--index", "--json"],
                           capture_output=True, text=True)
        check("--index --json is valid JSON", p.returncode == 0 and json.loads(p.stdout))
        payload = json.loads(p.stdout)
        check("--json keeps groups", "groups" in payload)
        check("--json keeps diagnostics", "diagnostics" in payload)
        check("--json drops unread fields",
              all("toc" not in n for n in payload["nodes"]))

        p = subprocess.run([sys.executable, SCRIPT, "--root", tmp, "--index", "--affects"],
                           capture_output=True, text=True)
        check("mutually exclusive modes rejected", p.returncode != 0)

        p = subprocess.run([sys.executable, SCRIPT, "--root", tmp, "--affects"],
                           input="src/a/x.ts\n", capture_output=True, text=True)
        check("--affects reads stdin", "docs/a.md" in p.stdout, p.stdout)

    print()
    if failures:
        print("FAILED (%d): %s" % (len(failures), ", ".join(failures)))
        return 1
    print("All guards passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
