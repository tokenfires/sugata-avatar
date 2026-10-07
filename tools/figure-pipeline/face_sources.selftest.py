"""Exercise the actual face-source function with injected services; never import bpy."""
import argparse
import ast
import contextlib
import datetime
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import traceback
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "tools/figure-pipeline/build_figure.py"


def extracted_function(source):
    tree = ast.parse(source)
    return next(node for node in tree.body
                if isinstance(node, ast.FunctionDef) and node.name == "attach_face_parts")


def declared_constants(source):
    wanted = {"FACE_PART_ASSETS", "EYE_ASSET_FILENAME"}
    values = {}
    for node in ast.parse(source).body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1:
            target = node.targets[0]
            if isinstance(target, ast.Name) and target.id in wanted:
                values[target.id] = ast.literal_eval(node.value)
    assert set(values) == wanted
    return values


def exercise(function, constants, proxy, missing=(), opt_out=False,
             lookup_error=None, attachment_error=None):
    resolutions, attachments, events = [], [], []
    owner = object()

    def resolve(filename, *, asset_subdir):
        resolutions.append([asset_subdir, filename])
        events.append(["resolve", asset_subdir, filename])
        if asset_subdir == lookup_error:
            raise RuntimeError("injected lookup failure")
        return None if asset_subdir in missing else f"/injected/{asset_subdir}/{filename}"

    def attach(path, basemesh, *, asset_type, material_type):
        assert basemesh is owner
        attachments.append([asset_type, path, material_type])
        events.append(["attach", asset_type, path])
        if asset_type == attachment_error:
            raise RuntimeError("injected attachment failure")
        return {"part": asset_type, "path": path}

    namespace = {
        **constants,
        "AssetService": SimpleNamespace(find_asset_absolute_path=resolve),
        "HumanService": SimpleNamespace(add_mhclo_asset=attach),
    }
    code = ast.Module(body=[function], type_ignores=[])
    exec(compile(code, "build_figure.py:attach_face_parts", "exec"), namespace)
    output = io.StringIO()
    result, failure = None, None
    with contextlib.redirect_stdout(output):
        try:
            result = namespace["attach_face_parts"](
                owner, SimpleNamespace(no_face_parts=opt_out, eye_proxy=proxy))
        except (SystemExit, RuntimeError) as error:
            failure = {"type": type(error).__name__, "message": str(error)}
    return {"resolutions": resolutions, "attachments": attachments,
            "events": events, "result": result, "failure": failure, "stdout": output.getvalue()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--before-function", type=Path)
    parser.add_argument("--before-constants", type=Path)
    args = parser.parse_args()
    assert bool(args.before_function) == bool(args.before_constants)
    if args.out:
        assert not args.out.exists(), "Refuse to overwrite an existing evidence record."
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    source = SOURCE.read_text()
    function = extracted_function(source)
    constants = declared_constants(source)
    table = constants["FACE_PART_ASSETS"]
    assert len(table) == 5 and len({row[0] for row in table}) == 5
    before = None
    baseline = None
    if args.before_function:
        before = extracted_function(args.before_function.read_text())
        baseline = json.loads(args.before_constants.read_text())
        assert baseline["constants"] == json.loads(json.dumps(constants))

    cases, red_controls = [], []

    def run(label, proxy="high-poly.mhclo", **options):
        record = exercise(function, constants, proxy, **options)
        cases.append({"case": label, "options": {"proxy": proxy, **options}, **record})
        return record

    for proxy in ["high-poly.mhclo", "low-poly.mhclo"]:
        record = run("all-present-" + proxy, proxy)
        expected_paths = [[subdir, proxy if kind == "Eyes" else filename]
                          for subdir, filename, kind, _alpha in table]
        assert record["resolutions"] == expected_paths
        assert record["failure"] is None
        assert record["attachments"] == [
            [kind, f"/injected/{subdir}/{filename}", "GAMEENGINE"]
            for (subdir, filename), (_subdir, _file, kind, _alpha) in zip(expected_paths, table)]
        assert record["result"] == [
            ({"part": kind, "path": path}, path, alpha)
            for (_subdir, _file, kind, alpha), (_kind, path, _material)
            in zip(table, record["attachments"])]
        assert [event[0] for event in record["events"]] == ["resolve"] * 5 + ["attach"] * 5
        if before:
            original = exercise(before, constants, proxy)
            assert all(original[key] == record[key] for key in ["resolutions", "attachments", "result", "failure", "stdout"])

    missing_cases = [("missing-" + row[0], "high-poly.mhclo", [row[0]]) for row in table]
    missing_cases += [
        ("multiple-missing", "high-poly.mhclo", ["teeth", "eyelashes"]),
        ("all-missing", "high-poly.mhclo", [row[0] for row in table]),
        ("low-poly-missing", "low-poly.mhclo", ["eyes"]),
    ]
    for label, proxy, missing in missing_cases:
        record = run(label, proxy, missing=missing)
        expected_missing = [
            f"{kind}: {subdir}/{proxy if kind == 'Eyes' else filename}"
            for subdir, filename, kind, _alpha in table if subdir in missing]
        assert record["failure"] == {
            "type": "SystemExit",
            "message": "Build failed: required face assets are missing: " + ", ".join(expected_missing)}
        assert len(record["resolutions"]) == 5
        assert record["attachments"] == [] and record["result"] is None
        if before:
            original = exercise(before, constants, proxy, missing=missing)
            assert original["failure"] is None and len(original["result"]) == 5 - len(missing)
            red_controls.append({"case": label, "missing": missing,
                                 "original_attached_count": len(original["attachments"]),
                                 "original_returned_incomplete_without_refusal": True})

    record = run("explicit-opt-out", missing=[row[0] for row in table], opt_out=True)
    assert record["result"] == [] and record["failure"] is None
    assert record["resolutions"] == [] and record["attachments"] == []
    if before:
        assert record == exercise(before, constants, "high-poly.mhclo", missing=[row[0] for row in table], opt_out=True)

    record = run("lookup-exception", lookup_error="eyelashes")
    assert record["failure"] == {"type": "RuntimeError", "message": "injected lookup failure"}
    assert len(record["resolutions"]) == 5 and record["attachments"] == []
    if before:
        assert record["failure"] == exercise(before, constants, "high-poly.mhclo", lookup_error="eyelashes")["failure"]

    record = run("attachment-exception", attachment_error="Tongue")
    assert record["failure"] == {"type": "RuntimeError", "message": "injected attachment failure"}
    assert len(record["attachments"]) == 3
    if before:
        original = exercise(before, constants, "high-poly.mhclo", attachment_error="Tongue")
        assert record["failure"] == original["failure"] and record["attachments"] == original["attachments"]

    report = {
        "started_utc": started, "finished_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "pid": os.getpid(), "argv": sys.argv, "status": "pass", "cases": cases,
        "source_sha256": hashlib.sha256(source.encode()).hexdigest(),
        "observer_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "baseline_function_sha256": hashlib.sha256(args.before_function.read_bytes()).hexdigest() if before else None,
        "baseline_constants_sha256": hashlib.sha256(args.before_constants.read_bytes()).hexdigest() if before else None,
        "original_red_controls": red_controls,
        "limits": "AST-extracted actual function with injected source/attachment services only. No bpy, installed MPFB call, asset lookup, native build, geometry or source lineage/appearance qualification. Attachment failures propagate; native attachment rollback is not claimed."
    }
    if args.out:
        args.out.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": "pass", "pid": report["pid"], "cases": len(cases), "red_controls": len(red_controls)}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        if "--out" in sys.argv:
            index = sys.argv.index("--out")
            if index + 1 < len(sys.argv):
                output = Path(sys.argv[index + 1])
                if not output.exists():
                    output.write_text(json.dumps({
                        "status": "failed", "pid": os.getpid(), "argv": sys.argv,
                        "finished_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                        "error": repr(error), "traceback": traceback.format_exc(),
                        "observer_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                        "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                        "scope": "Injected actual-function CPU test failure; no native job or retry."
                    }, indent=2) + "\n")
        raise
