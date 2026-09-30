"""Observe the original three-case MPFB arithmetic contract, without exporting assets."""
from pathlib import Path
import datetime
import gzip
import hashlib
import inspect
import json
import os
import sys
import zipfile

import bpy

ROOT = Path(__file__).resolve().parents[2]
PROFILE = ROOT / "tmp/wardrobe-sep30/blender-profile"
OUT = ROOT / "captures/wardrobe-native-oracle-2026-09-30-v2"
assert not OUT.exists(), "Fresh output required"
assert Path(bpy.utils.user_resource("CONFIG")).resolve().is_relative_to(PROFILE)
OUT.mkdir(parents=True)
sys.path.insert(0, str(ROOT / "tools/figure-pipeline"))
from mpfb_bridge import dynamic_import

HumanService = dynamic_import("mpfb.services.humanservice", "HumanService")
TargetService = dynamic_import("mpfb.services.targetservice", "TargetService")
ClothesService = dynamic_import("mpfb.services.clothesservice", "ClothesService")
LocationService = dynamic_import("mpfb.services.locationservice", "LocationService")
AssetService = dynamic_import("mpfb.services.assetservice", "AssetService")
HumanObjectProperties = dynamic_import("mpfb.entities.objectproperties", "HumanObjectProperties")
GeneralObjectProperties = dynamic_import("mpfb.entities.objectproperties", "GeneralObjectProperties")
Mhclo = dynamic_import("mpfb.entities.clothes.mhclo", "Mhclo")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def file_sha(file):
    return sha(Path(file).read_bytes())


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def flat(values):
    return [float(c) for v in values for c in v]


def matrix(obj):
    return [list(row) for row in obj.matrix_world]


inventory_path = ROOT / "docs/evidence/nonhair-2026-09-26/wardrobe-coupling/inventory-v1.json"
assert file_sha(inventory_path) == "a5efb4f0882a47fa3276b4b059427a85d008fad28c4177030a17c358387e99f0"
inventory = json.loads(inventory_path.read_text())
report = {"started": now(), "pid": os.getpid(), "status": "running", "errors": [],
          "blender": bpy.app.version_string, "buildHash": bpy.app.build_hash.decode(),
          "profile": str(PROFILE), "inputs": {}, "loadedMPFB": [], "dataMembers": [],
          "cases": [], "artifacts": [], "scope": "Original unrigged garment arithmetic; no exported or corrected garment, fit or appearance acceptance."}


def save():
    (OUT / "report.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")


def bind(path):
    path = Path(path).resolve()
    report["inputs"][str(path)] = file_sha(path)
    return path


def archive_json(name, value):
    raw = (json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n").encode()
    encoded = gzip.compress(raw, mtime=0)
    (OUT / name).write_bytes(encoded)
    record = {"file": name, "bytes": len(encoded), "sha256": sha(encoded),
              "decodedBytes": len(raw), "decodedSHA256": sha(raw)}
    report["artifacts"].append(record)
    return record


def full_evaluated(obj):
    # Only masks are disabled: there must be no unseen topology/deformation modifier.
    assert all(m.type == "MASK" for m in obj.modifiers)
    states = [(m, m.show_viewport, m.show_render) for m in obj.modifiers]
    evaluated = None
    try:
        for m, _, _ in states:
            m.show_viewport = False
            m.show_render = False
        bpy.context.view_layer.update()
        evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = evaluated.to_mesh()
        assert len(mesh.vertices) == 19158
        positions = flat(v.co for v in mesh.vertices)
        polygons = [list(p.vertices) for p in mesh.polygons]
        assert polygons == [list(p.vertices) for p in obj.data.polygons]
        return positions
    finally:
        if evaluated:
            evaluated.to_mesh_clear()
        for m, viewport, render in states:
            m.show_viewport = viewport
            m.show_render = render
        bpy.context.view_layer.update()


try:
    assert report["buildHash"] == "d13f752e3b9c"
    for relative in ["tools/critic/wardrobe-native-oracle.py", "tools/figure-pipeline/mpfb_bridge.py",
                     "docs/evidence/wardrobe-2026-09-30/native-refit/PLAN.md",
                     "tmp/wardrobe-sep30/blender-isolated.sh", "tmp/wardrobe-sep30/runtime-preflight.json"]:
        source = bind(ROOT / relative)
        dest = OUT / "source" / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(source.read_bytes())
    bind(inventory_path)
    archives = {}
    for entry in inventory["archives"]:
        archive = bind(ROOT / entry["path"])
        assert file_sha(archive) == entry["sha256"]
        archives[archive.name] = zipfile.ZipFile(archive)
    mpfb_zip = archives["mpfb-2.0.17.zip"]
    asset_zip = archives["makehuman_system_assets_cc0.zip"]
    mpfb_root = Path(inspect.getfile(HumanService)).resolve().parents[1]
    assert mpfb_root.is_relative_to(PROFILE)
    # Verify the complete original addon tree, including metadata and lazy-import sources.
    # Generated caches/user files are outside the archive and never stand in for pinned input.
    report["archiveMembersVerified"] = 0
    for entry in mpfb_zip.infolist():
        if entry.is_dir():
            continue
        member = entry.filename
        installed = mpfb_root / member
        assert installed.resolve().is_relative_to(mpfb_root)
        assert file_sha(bind(installed)) == sha(mpfb_zip.read(member)), member
        report["archiveMembersVerified"] += 1

    def census_modules():
        rows = []
        for name, module in sorted(list(sys.modules.items())):
            source = getattr(module, "__file__", None)
            if not source or ".mpfb" not in name:
                continue
            source = Path(source).resolve()
            if source.suffix != ".py" or not source.is_relative_to(mpfb_root):
                continue
            member = str(source.relative_to(mpfb_root))
            digest = file_sha(bind(source))
            assert digest == sha(mpfb_zip.read(member)), member
            rows.append({"module": name, "member": member, "path": str(source), "sha256": digest})
        assert len(rows) > 20
        return rows

    report["initialLoadedMPFB"] = census_modules()

    def bind_member(path, archive, member):
        path = bind(path)
        digest = file_sha(path)
        assert digest == sha(archive.read(member)), member
        report["dataMembers"].append({"path": str(path), "member": member, "sha256": digest})
        return path

    target_dir = Path(LocationService.get_mpfb_data("targets"))
    bind_member(mpfb_root / "data/3dobjs/base.obj", mpfb_zip, "data/3dobjs/base.obj")
    recipe = inventory["sourceData"]["neutralRetainedRecipe"]
    target_names = [r["file"] for r in recipe["mpfbStack"]] + [
        "torso/measure-shoulder-dist-incr", "legs/upperlegs-height-incr"]
    for name in target_names:
        bind_member(target_dir / (name + ".target.gz"), mpfb_zip, "data/targets/" + name + ".target.gz")
    garment_path = Path(AssetService.find_asset_absolute_path("female_casualsuit01/female_casualsuit01.mhclo", "clothes"))
    assert garment_path.is_relative_to(PROFILE)
    for path in sorted(garment_path.parent.iterdir()):
        if path.is_file():
            bind_member(path, asset_zip, "clothes/female_casualsuit01/" + path.name)
    native_model = Mhclo()
    native_model.load(str(garment_path))
    model = {"x_scale": native_model.x_scale, "y_scale": native_model.y_scale,
             "z_scale": native_model.z_scale,
             "rules": [{"id": i, "indices": list(v["verts"]), "weights": list(v["weights"]),
                        "offsets": list(v["offsets"])} for i, v in native_model.verts.items()]}
    assert len(model["rules"]) == 2197
    report["nativeModel"] = archive_json("native-model.json.gz", model)
    save()

    for weight in [0, 0.25, 1]:
        # Fresh native humans; no reused target state or correction carried between cases.
        bpy.ops.object.select_all(action="SELECT")
        bpy.ops.object.delete(use_global=False)
        body = HumanService.create_human(macro_detail_dict=recipe["macro"])
        HumanObjectProperties.set_value("gender", 0.5, entity_reference=body)
        TargetService.reapply_macro_details(body)
        raw_stack = TargetService.calculate_target_stack_from_macro_info_dict(
            TargetService.get_macro_info_dict_from_basemesh(body))
        stack = [{"file": name, "weight": value} for name, value in raw_stack]
        assert stack == recipe["mpfbStack"], (stack, recipe["mpfbStack"])
        for name in target_names[-2:]:
            TargetService.load_target(body, str(target_dir / (name + ".target.gz")),
                                      weight=weight, name=Path(name).name)
        before = full_evaluated(body)
        clothes = HumanService.add_mhclo_asset(str(garment_path), body,
                                              asset_type="Clothes", material_type="GAMEENGINE")
        assert len(clothes.data.vertices) == 2197
        observation = {}
        code = ClothesService.fit_clothes_to_human.__code__

        def trace(frame, event, arg):
            if frame.f_code is not code:
                return None
            if event == "line" and not observation and all(k in frame.f_locals for k in ["human_vertices", "x_size", "y_size", "z_size"]):
                # Wait until all three explicit scale calculations have finished.
                if frame.f_lineno > code.co_firstlineno and "mesh" in frame.f_locals:
                    locals_ = frame.f_locals
                    observation.update({"line": frame.f_lineno,
                                        "bodyPositions": flat(v.co for v in locals_["human_vertices"]),
                                        "scale": {k: locals_[k + "_size"] for k in ["x", "y", "z"]}})
            return trace

        assert sys.gettrace() is None
        sys.settrace(trace)
        try:
            ClothesService.fit_clothes_to_human(clothes, body)
        finally:
            sys.settrace(None)
        after = full_evaluated(body)
        assert before == after, "Native garment attach/refit changed full evaluated body"
        assert observation and observation["bodyPositions"] == after, "Fitter body input differs from full evaluated mesh"
        data = {"weight": weight, "space": "blender-z-up-metres", "macroStack": stack, "rawNativeMacroStack": raw_stack,
                "appliedTargets": [{"file": n, "weight": weight} for n in target_names[-2:]],
                "bodyPositions": after, "fitterObservation": observation,
                "garmentPositions": flat(v.co for v in clothes.data.vertices),
                "garmentPolygons": [list(p.vertices) for p in clothes.data.polygons],
                "bodyMatrix": matrix(body), "garmentMatrix": matrix(clothes),
                "scaleFactor": GeneralObjectProperties.get_value("scale_factor", entity_reference=body),
                "shapeKeys": [{"name": k.name, "value": k.value, "mute": k.mute,
                               "relativeKey": k.relative_key.name} for k in body.data.shape_keys.key_blocks],
                "bodyModifiers": [{"name": m.name, "type": m.type, "viewport": m.show_viewport,
                                   "render": m.show_render} for m in body.modifiers],
                "garmentModifiers": [{"name": m.name, "type": m.type} for m in clothes.modifiers]}
        artifact = archive_json("case-" + str(weight).replace(".", "_") + ".json.gz", data)
        report["cases"].append({"weight": weight, "bodyVertices": len(after) // 3,
                                "garmentVertices": len(data["garmentPositions"]) // 3,
                                "artifact": artifact, "fitterBodyExactlyEvaluated": True})
        save()
    report["loadedMPFB"] = census_modules()
    for path, digest in report["inputs"].items():
        assert file_sha(path) == digest, "Input changed: " + path
    report["status"] = "observed-awaiting-independent-comparison"
except BaseException as error:
    report["status"] = "failed"
    report["errors"].append(repr(error))
    raise
finally:
    report["finished"] = now()
    save()
    print("NATIVE_WARDROBE_ORACLE=" + json.dumps({"status": report["status"], "cases": len(report["cases"]), "out": str(OUT)}))
