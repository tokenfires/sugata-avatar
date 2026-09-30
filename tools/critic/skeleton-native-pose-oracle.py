"""Native posed skin, preserving full and explicit exported-four-weight controls."""
from pathlib import Path
import datetime, gzip, hashlib, inspect, json, os, sys
import bpy
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[2]
PROFILE = ROOT / "tmp/wardrobe-sep30/blender-profile"
PARENT = ROOT / "captures/wardrobe-native-oracle-2026-09-30-v2"
REST = ROOT / "captures/skeleton-native-oracle-2026-09-30-v1"
BRIDGE = ROOT / "captures/skeleton-export-bridge-2026-09-30-v1"
OUT = ROOT / "captures/skeleton-native-pose-2026-09-30-v1"
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


def sha(data): return hashlib.sha256(data).hexdigest()
def digest(path): return sha(Path(path).read_bytes())
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def flat(values): return [float(c) for v in values for c in v]
def matrix(value): return [list(row) for row in value]
IDENTITY = [[int(i == j) for j in range(4)] for i in range(4)]
POSES = {
    "identity": {},
    "elbow": {"lowerarm_l": {"axis": [1, 0, 0], "radians": .6}},
    "coupled": {
        "pelvis": {"axis": [0, 0, 1], "radians": .08},
        "spine_02": {"axis": [1, 0, 0], "radians": .15},
        "upperarm_l": {"axis": [0, 0, 1], "radians": -.35},
        "lowerarm_l": {"axis": [1, 0, 0], "radians": .6},
        "thigh_r": {"axis": [1, 0, 0], "radians": -.35},
        "calf_r": {"axis": [1, 0, 0], "radians": .65},
        "head": {"axis": [0, 1, 0], "radians": .2},
    },
}
report = {"started": now(), "pid": os.getpid(), "status": "running", "errors": [],
          "blender": bpy.app.version_string, "buildHash": bpy.app.build_hash.decode(),
          "sourceHashes": {}, "observations": [], "bodies": [], "artifacts": [], "poses": POSES,
          "scope": "Three bodies, full native and explicit exported-four influences, three local-bone poses. No production or visual qualification."}


def save(): (OUT / "report.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")


def archive(name, value):
    raw = (json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n").encode()
    encoded = gzip.compress(raw, mtime=0)
    (OUT / name).write_bytes(encoded)
    item = {"file": name, "sha256": sha(encoded), "decodedSHA256": sha(raw), "bytes": len(encoded)}
    report["artifacts"].append(item)
    return item


def decode(directory, item):
    encoded = (directory / item["file"]).read_bytes()
    assert sha(encoded) == item["sha256"]
    raw = gzip.decompress(encoded)
    assert sha(raw) == item["decodedSHA256"]
    return json.loads(raw)


def validate_inputs():
    for doc, expected in [
        (PARENT / "report.json", "28b28844d2e9391314650ad489e4c45c72cfd42542f088ebe931b6c9a8203261"),
        (REST / "report.json", "0802b23b4bdbee05fbc232f9851aeeb7cc4a67fe14227bb16b645c06cac61472"),
        (BRIDGE / "report.json", "a1c1ec374c41f2fd1c197d666a6b25d7c0f11bf52b796c4a5b02cc03270ed3e9"),
    ]: assert digest(doc) == expected
    for path, expected in parent["inputs"].items(): assert digest(path) == expected, path
    for path, expected in rest["sourceHashes"].items(): assert digest(ROOT / path) == expected, path
    for path, expected in bridge["inputs"].items(): assert digest(ROOT / path) == expected, path


def census():
    rows = []
    for name, module in sorted(list(sys.modules.items())):
        file = getattr(module, "__file__", None)
        if file and ".mpfb" in name and Path(file).suffix == ".py":
            p = str(Path(file).resolve())
            assert p in parent["inputs"] and digest(p) == parent["inputs"][p], p
            rows.append({"module": name, "path": p, "sha256": digest(p)})
    assert len(rows) > 20
    return rows


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
        for m, viewport, render in states: m.show_viewport, m.show_render = viewport, render
        bpy.context.view_layer.update()


def actual_weights(body, names):
    group_names = {g.index: g.name for g in body.vertex_groups if g.name in names}
    return [[[group_names[g.group], g.weight] for g in v.groups if g.group in group_names and g.weight > 0]
            for v in body.data.vertices]


def set_pose(rig, commands):
    for p in rig.pose.bones:
        p.rotation_mode = "QUATERNION"
        p.matrix_basis = Matrix.Identity(4)
    for name, command in commands.items():
        rig.pose.bones[name].rotation_quaternion = Quaternion(Vector(command["axis"]), command["radians"])
    rig.data.pose_position = "POSE"
    bpy.context.view_layer.update()


try:
    assert report["buildHash"] == "d13f752e3b9c"
    parent = json.loads((PARENT / "report.json").read_text())
    rest = json.loads((REST / "report.json").read_text())
    bridge = json.loads((BRIDGE / "report.json").read_text())
    assert bridge["passed"] and rest["status"] == "observed-awaiting-independent-comparison"
    validate_inputs()
    report["initialLoadedMPFB"] = census()
    for relative in ["tools/critic/skeleton-native-pose-oracle.py",
                     "docs/evidence/wardrobe-2026-09-30/skeleton-posed-skin/PLAN.md",
                     "tmp/skeleton-pose-sep30/blender-mount.plist", "tmp/skeleton-pose-sep30/runtime-preflight.json"]:
        file = ROOT / relative
        report["sourceHashes"][relative] = digest(file)
        dest = OUT / "source" / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(file.read_bytes())
    asset = decode(BRIDGE, next(a for a in bridge["artifacts"] if a["file"] == "parsed-asset.json.gz"))
    expected_four = {}
    for i, v in enumerate(asset["vertexMap"]):
        pairs = sorted([[asset["jointNames"][j], w] for j, w in zip(asset["joints"][i], asset["normalizedWeights"][i]) if w > 0])
        assert len(set(n for n, _ in pairs)) == len(pairs)
        assert pairs and 0 <= v < 13380
        if v in expected_four: assert expected_four[v] == pairs, "Ambiguous mapped weights"
        expected_four[v] = pairs
    assert set(expected_four) == set(range(13380))
    report["mappedExportWeights"] = archive("export-four-weights.json.gz", expected_four)
    inventory = json.loads((ROOT / "docs/evidence/nonhair-2026-09-26/wardrobe-coupling/inventory-v1.json").read_text())
    recipe = inventory["sourceData"]["neutralRetainedRecipe"]
    target_dir = Path(LocationService.get_mpfb_data("targets"))
    names = set(asset["jointNames"])
    weight_path = Path(inspect.getfile(HumanService)).resolve().parents[1] / "data/rigs/standard/weights.game_engine.json"
    source_weights = json.loads(weight_path.read_text())["weights"]
    expected_full = [[] for _ in range(19158)]
    for name, rows in source_weights.items():
        assert name in names
        for v, w in rows:
            if w > 0: expected_full[v].append([name, w])
    expected_full = [sorted(row) for row in expected_full]
    save()
    for weight in [0, .25, 1]:
        if bpy.context.object and bpy.context.object.mode != "OBJECT": bpy.ops.object.mode_set(mode="OBJECT")
        bpy.ops.object.select_all(action="SELECT")
        bpy.ops.object.delete(use_global=False)
        body = HumanService.create_human(macro_detail_dict=recipe["macro"])
        HumanObjectProperties.set_value("gender", .5, entity_reference=body)
        TargetService.reapply_macro_details(body)
        stack = TargetService.calculate_target_stack_from_macro_info_dict(TargetService.get_macro_info_dict_from_basemesh(body))
        assert [{"file": n, "weight": v} for n, v in stack] == recipe["mpfbStack"]
        for name in ["torso/measure-shoulder-dist-incr", "legs/upperlegs-height-incr"]:
            TargetService.load_target(body, str(target_dir / (name + ".target.gz")), weight=weight, name=Path(name).name)
        rig = HumanService.add_builtin_rig(body, "game_engine", import_weights=True)
        assert set(b.name for b in rig.data.bones) == names and RigService.identify_rig(rig) == "game_engine"
        assert matrix(body.matrix_world) == IDENTITY and matrix(rig.matrix_world) == IDENTITY
        for bone in rig.data.bones:
            assert bone.use_deform and bone.inherit_scale == "FULL" and bone.use_inherit_rotation and bone.use_local_location and not bone.use_connect
            assert not rig.pose.bones[bone.name].constraints
        armatures = [m for m in body.modifiers if m.type == "ARMATURE"]
        assert len(armatures) == 1
        modifier = armatures[0]
        assert modifier.object == rig and modifier.use_vertex_groups and not modifier.use_bone_envelopes
        assert not modifier.use_deform_preserve_volume and not modifier.use_multi_modifier and not modifier.vertex_group
        assert modifier.show_viewport and modifier.show_render
        old = decode(REST, next(c["artifact"] for c in rest["cases"] if c["weight"] == weight and c["mode"] == "fresh"))
        coords = full_body(body, False)
        assert coords == old["bodyPositions"]
        for b in rig.data.bones:
            assert matrix(b.matrix_local) == old["bones"][b.name]["matrixLocal"]
            assert list(b.head_local) == old["bones"][b.name]["head"] and list(b.tail_local) == old["bones"][b.name]["tail"]
        weights = actual_weights(body, names)
        assert [sorted(row) for row in weights] == expected_full
        assert all(row for row in weights)
        metadata = {"weight": weight, "bodyPositions": coords, "restBones": old["bones"],
                    "bodyMatrix": matrix(body.matrix_world), "armatureMatrix": matrix(rig.matrix_world),
                    "fullWeights": weights, "modifier": {"type": modifier.type, "useVertexGroups": modifier.use_vertex_groups,
                    "useBoneEnvelopes": modifier.use_bone_envelopes, "preserveVolume": modifier.use_deform_preserve_volume,
                    "multiModifier": modifier.use_multi_modifier, "vertexGroup": modifier.vertex_group},
                    "bones": {b.name: {"parent": b.parent.name if b.parent else "", "deform": b.use_deform,
                    "inheritScale": b.inherit_scale, "inheritRotation": b.use_inherit_rotation,
                    "localLocation": b.use_local_location, "connected": b.use_connect,
                    "constraints": len(rig.pose.bones[b.name].constraints)} for b in rig.data.bones}}
        report["bodies"].append({"weight": weight, "artifact": archive("body-" + str(weight).replace(".", "_") + ".json.gz", metadata)})
        for arm in ["native-full", "export-four"]:
            if arm == "export-four":
                body_indices = list(range(13380))
                for name in names:
                    group = body.vertex_groups.get(name)
                    if group: group.remove(body_indices)
                for v, pairs in expected_four.items():
                    for name, value in pairs:
                        group = body.vertex_groups.get(name) or body.vertex_groups.new(name=name)
                        group.add([v], value, 'REPLACE')
                body.data.update()
                bpy.context.view_layer.update()
            observed_weights = actual_weights(body, names)
            if arm == "export-four":
                assert all(sorted(observed_weights[v]) == expected_four[v] for v in range(13380))
                assert observed_weights[13380:] == weights[13380:]
            else: assert observed_weights == weights
            weight_artifact = archive("weights-" + str(weight).replace(".", "_") + "-" + arm + ".json.gz", observed_weights)
            for pose_name, commands in POSES.items():
                set_pose(rig, commands)
                assert full_body(body, False) == coords
                posed = full_body(body, True)
                evaluated_rig = rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
                data = {"weight": weight, "arm": arm, "pose": pose_name, "commands": commands,
                        "space": "blender-z-up-metres", "bodyPositions": posed,
                        "poseBones": {p.name: {"basis": matrix(p.matrix_basis), "quaternionWXYZ": list(p.rotation_quaternion),
                        "evaluatedMatrix": matrix(evaluated_rig.pose.bones[p.name].matrix)} for p in rig.pose.bones}}
                item = archive("pose-" + str(weight).replace(".", "_") + "-" + arm + "-" + pose_name + ".json.gz", data)
                report["observations"].append({"weight": weight, "arm": arm, "pose": pose_name, "weights": weight_artifact, "artifact": item})
                save()
    report["loadedMPFB"] = census()
    validate_inputs()
    for p, expected in report["sourceHashes"].items(): assert digest(ROOT / p) == expected
    report["status"] = "observed-awaiting-independent-comparison"
except BaseException as error:
    report["status"] = "failed"
    report["errors"].append(repr(error))
    raise
finally:
    report["finished"] = now()
    save()
    print("NATIVE_POSE_ORACLE=" + json.dumps({"status": report["status"], "observations": len(report["observations"]), "out": str(OUT)}))
