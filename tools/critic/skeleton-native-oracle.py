"""Three native existing-rig/fresh-rig controls. No exports or production writes."""
from pathlib import Path
import datetime, gzip, hashlib, inspect, json, os, sys
import bpy

ROOT = Path(__file__).resolve().parents[2]
PROFILE = ROOT / "tmp/wardrobe-sep30/blender-profile"
PARENT = ROOT / "captures/wardrobe-native-oracle-2026-09-30-v2"
OUT = ROOT / "captures/skeleton-native-oracle-2026-09-30-v1"
assert not OUT.exists()
assert Path(bpy.utils.user_resource("CONFIG")).resolve().is_relative_to(PROFILE)
OUT.mkdir(parents=True)
sys.path.insert(0, str(ROOT / "tools/figure-pipeline"))
from mpfb_bridge import dynamic_import

HumanService = dynamic_import("mpfb.services.humanservice", "HumanService")
TargetService = dynamic_import("mpfb.services.targetservice", "TargetService")
RigService = dynamic_import("mpfb.services.rigservice", "RigService")
LocationService = dynamic_import("mpfb.services.locationservice", "LocationService")
HumanObjectProperties = dynamic_import("mpfb.entities.objectproperties", "HumanObjectProperties")
Rig = dynamic_import("mpfb.entities.rig", "Rig")


def sha(data): return hashlib.sha256(data).hexdigest()
def digest(path): return sha(Path(path).read_bytes())
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def flat(values): return [float(c) for v in values for c in v]
def matrix(value): return [list(row) for row in value]
IDENTITY = [[int(i == j) for j in range(4)] for i in range(4)]


parent = json.loads((PARENT / "report.json").read_text())
assert digest(PARENT / "report.json") == "28b28844d2e9391314650ad489e4c45c72cfd42542f088ebe931b6c9a8203261"
assert parent["status"] == "observed-awaiting-independent-comparison"
report = {"started": now(), "pid": os.getpid(), "status": "running", "errors": [],
          "parentNativeReportSHA256": digest(PARENT / "report.json"),
          "blender": bpy.app.version_string, "buildHash": bpy.app.build_hash.decode(),
          "sourceHashes": {}, "cases": [], "artifacts": [],
          "scope": "Native bone endpoint/refit controls in three coupled cases; no runtime skin or appearance qualification."}


def save(): (OUT / "report.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")


def archive(name, value):
    raw = (json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n").encode()
    encoded = gzip.compress(raw, mtime=0)
    (OUT / name).write_bytes(encoded)
    item = {"file": name, "sha256": sha(encoded), "decodedSHA256": sha(raw), "bytes": len(encoded)}
    report["artifacts"].append(item)
    return item


def validate_parent():
    assert digest(PARENT / "report.json") == report["parentNativeReportSHA256"]
    for path, expected in parent["inputs"].items():
        assert digest(path) == expected, path


def module_census():
    records = []
    for name, module in sorted(list(sys.modules.items())):
        file = getattr(module, "__file__", None)
        if file and ".mpfb" in name and Path(file).suffix == ".py":
            path = str(Path(file).resolve())
            assert path in parent["inputs"], "Unbound loaded MPFB source: " + path
            assert digest(path) == parent["inputs"][path]
            records.append({"module": name, "path": path, "sha256": digest(path)})
    assert len(records) > 20
    return records


def full_body(body, armature_enabled):
    assert all(m.type in ["MASK", "ARMATURE"] for m in body.modifiers)
    states = [(m, m.show_viewport, m.show_render) for m in body.modifiers]
    evaluated = None
    try:
        for m, _, _ in states:
            m.show_viewport = m.show_render = m.type == "ARMATURE" and armature_enabled
        bpy.context.view_layer.update()
        evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = evaluated.to_mesh()
        assert len(mesh.vertices) == 19158
        assert [list(p.vertices) for p in mesh.polygons] == [list(p.vertices) for p in body.data.polygons]
        return flat(v.co for v in mesh.vertices)
    finally:
        if evaluated: evaluated.to_mesh_clear()
        for m, viewport, render in states:
            m.show_viewport, m.show_render = viewport, render
        bpy.context.view_layer.update()


def new_body(weight):
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    body = HumanService.create_human(macro_detail_dict=recipe["macro"])
    HumanObjectProperties.set_value("gender", .5, entity_reference=body)
    TargetService.reapply_macro_details(body)
    raw = TargetService.calculate_target_stack_from_macro_info_dict(TargetService.get_macro_info_dict_from_basemesh(body))
    assert [{"file": n, "weight": v} for n, v in raw] == recipe["mpfbStack"]
    keys = [TargetService.load_target(body, str(target_dir / (name + ".target.gz")),
                                      weight=weight, name=Path(name).name) for name in detail_names]
    return body, keys


try:
    assert report["buildHash"] == "d13f752e3b9c"
    validate_parent()
    report["initialLoadedMPFB"] = module_census()
    for relative in ["tools/critic/skeleton-native-oracle.py",
                     "docs/evidence/wardrobe-2026-09-30/skeleton-placement/PLAN.md",
                     "tmp/skeleton-sep30/blender-mount.plist", "tmp/skeleton-sep30/runtime-preflight.json"]:
        file = ROOT / relative
        report["sourceHashes"][relative] = digest(file)
        dest = OUT / "source" / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(file.read_bytes())
    mpfb_root = Path(inspect.getfile(HumanService)).resolve().parents[1]
    rig_path = Path(LocationService.get_mpfb_data("rigs")) / "standard/rig.game_engine.json"
    metadata_path = mpfb_root / "data/mesh_metadata/basemesh_vertex_groups.json"
    table = json.loads(rig_path.read_text())
    metadata = json.loads(metadata_path.read_text())
    assert len(table) == 53
    assert all(not b["use_connect"] and "roll_strategy" not in b for b in table.values())
    assert all(b[e]["strategy"] in ["CUBE", "MEAN"] and "offset" not in b[e] for b in table.values() for e in ["head", "tail"])
    report["rigTableSHA256"] = digest(rig_path)
    report["groupMetadataSHA256"] = digest(metadata_path)
    report["rigTable"] = archive("rig-table.json.gz", table)
    inventory = json.loads((ROOT / "docs/evidence/nonhair-2026-09-26/wardrobe-coupling/inventory-v1.json").read_text())
    recipe = inventory["sourceData"]["neutralRetainedRecipe"]
    target_dir = Path(LocationService.get_mpfb_data("targets"))
    detail_names = ["torso/measure-shoulder-dist-incr", "legs/upperlegs-height-incr"]
    expected_bodies = {}
    for row in parent["cases"]:
        encoded = (PARENT / row["artifact"]["file"]).read_bytes()
        assert sha(encoded) == row["artifact"]["sha256"]
        decoded = gzip.decompress(encoded)
        assert sha(decoded) == row["artifact"]["decodedSHA256"]
        expected_bodies[row["weight"]] = json.loads(decoded)["bodyPositions"]
    save()
    for weight in [0, .25, 1]:
        for mode in ["refit", "fresh"]:
            body, keys = new_body(0 if mode == "refit" else weight)
            rig = HumanService.add_builtin_rig(body, "game_engine", import_weights=True)
            assert rig and len(rig.data.bones) == 53
            assert set(b.name for b in rig.data.bones) == set(table)
            assert RigService.identify_rig(rig) == "game_engine"
            if mode == "refit":
                for key in keys: key.value = weight
                bpy.context.view_layer.update()
                RigService.refit_existing_armature(rig, body)
            rig.data.pose_position = "POSE"
            bpy.context.view_layer.update()
            assert matrix(body.matrix_world) == IDENTITY
            assert matrix(rig.matrix_world) == IDENTITY
            assert all(matrix(b.matrix_basis) == IDENTITY for b in rig.pose.bones)
            coords = full_body(body, False)
            assert coords == expected_bodies[weight], "Changed native helper/body coordinates"
            info = Rig.from_json_file_and_basemesh(str(rig_path), body)
            assert flat(info.position_info["vertices"]) == coords
            assert set(info.rig_definition) == set(table)
            assert all(info.rig_definition[n][end] == b[end]
                       for n, b in table.items() for end in ["head", "tail"])
            for b in table.values():
                for end in ["head", "tail"]:
                    if b[end]["strategy"] == "MEAN":
                        indices = b[end]["vertex_indices"]
                        assert indices and all(type(i) is int and 0 <= i < 19158 for i in indices)
            joint_names = {b[e]["cube_name"] for b in table.values() for e in ["head", "tail"] if b[e]["strategy"] == "CUBE"}
            groups = {}
            for name in sorted(joint_names):
                group = body.vertex_groups.get(name)
                assert group is not None
                indices = [v.index for v in body.data.vertices if any(g.group == group.index for g in v.groups)]
                declared = sorted({i for first, last in metadata[name] for i in range(first, last + 1)})
                assert indices == declared and indices, name
                groups[name] = indices
            bpy.context.view_layer.objects.active = rig
            bpy.ops.object.mode_set(mode="EDIT")
            edit_rolls = {bone.name: bone.roll for bone in rig.data.edit_bones}
            bpy.ops.object.mode_set(mode="OBJECT")
            data = {"weight": weight, "mode": mode, "space": "blender-z-up-metres",
                    "bodyPositions": coords, "nativeIdentityPoseSkin": full_body(body, True),
                    "jointGroups": groups, "nativeJointCentres": {n: info.position_info["cubes"][n] for n in groups},
                    "relativeScale": info.relative_scale, "bodyMatrix": matrix(body.matrix_world),
                    "armatureMatrix": matrix(rig.matrix_world),
                    "upgradedRigTable": info.rig_header,
                    "bones": {bone.name: {"head": list(bone.head_local), "tail": list(bone.tail_local),
                                           "roll": edit_rolls[bone.name],
                                           "parent": bone.parent.name if bone.parent else "",
                                           "matrixLocal": matrix(bone.matrix_local),
                                           "poseBasis": matrix(rig.pose.bones[bone.name].matrix_basis)} for bone in rig.data.bones},
                    "strategyEndpoints": {name: {end: info.get_best_location_from_strategy(b[end], use_default=False)
                                                   for end in ["head", "tail"]} for name, b in table.items()},
                    "shapeKeys": [{"name": key.name, "value": key.value} for key in body.data.shape_keys.key_blocks]}
            assert all(v is not None for ends in data["strategyEndpoints"].values() for v in ends.values())
            record = archive("case-" + str(weight).replace(".", "_") + "-" + mode + ".json.gz", data)
            report["cases"].append({"weight": weight, "mode": mode, "artifact": record, "parentBodyExactlyEqual": True})
            save()
    report["loadedMPFB"] = module_census()
    validate_parent()
    for p, expected in report["sourceHashes"].items(): assert digest(ROOT / p) == expected
    report["status"] = "observed-awaiting-independent-comparison"
except BaseException as error:
    report["status"] = "failed"
    report["errors"].append(repr(error))
    raise
finally:
    report["finished"] = now()
    save()
    print("NATIVE_SKELETON_ORACLE=" + json.dumps({"status": report["status"], "cases": len(report["cases"]), "out": str(OUT)}))
