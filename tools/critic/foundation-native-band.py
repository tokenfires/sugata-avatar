"""One isolated native band construction and its original-predicate control.

Loads pinned builder definitions without its terminal CLI invocation. No product writes.
"""
from pathlib import Path
import ast, datetime, gzip, hashlib, inspect, json, math, os, sys, traceback, types
import bpy
from mathutils import Matrix, Quaternion

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "captures/foundation-native-band-2026-09-30-v1"
PROFILE = ROOT / "tmp/wardrobe-sep30/blender-profile"
PARENT = ROOT / "captures/wardrobe-native-oracle-2026-09-30-v2/report.json"
BUILDER = ROOT / "tools/figure-pipeline/build_figure.py"
EXPECTED_BUILDER = "8470ba8b949058d7127cdb22458ed83d1c611042e2f366f1371da698056559f2"
assert not OUT.exists(), "Fresh output required"
assert Path(bpy.utils.user_resource("CONFIG")).resolve().is_relative_to(PROFILE)
OUT.mkdir(parents=True)

def sha(b): return hashlib.sha256(b).hexdigest()
def digest(p): return sha(Path(p).read_bytes())
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def flat(vs): return [float(c) for v in vs for c in v]
def matrix(m): return [list(r) for r in m]
def serial(v):
    if isinstance(v, dict): return {k: serial(x) for k, x in v.items()}
    if isinstance(v, (str, int, float, bool)) or v is None: return v
    return [serial(x) for x in v]

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
          "sources": {}, "artifacts": [], "cases": [], "poses": POSES,
          "scope": "One band-only native prototype and original-predicate control; no asset promotion."}

def save(): (OUT / "report.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")

def archive(name, obj):
    raw = (json.dumps(obj, separators=(",", ":"), allow_nan=False) + "\n").encode()
    encoded = gzip.compress(raw, mtime=0)
    (OUT / name).write_bytes(encoded)
    item = {"file": name, "bytes": len(encoded), "sha256": sha(encoded), "decodedSHA256": sha(raw)}
    report["artifacts"].append(item)
    return item

def bind(p):
    p = Path(p).resolve()
    relative = str(p.relative_to(ROOT))
    data = p.read_bytes()
    report["sources"][relative] = sha(data)
    dest = OUT / "source" / relative
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)

def attributes(mesh):
    result = {}
    for a in mesh.attributes:
        if not a.name.startswith("_"): continue
        assert a.domain == "POINT" and a.data_type == "FLOAT", (a.name, a.domain, a.data_type)
        result[a.name] = [float(v.value) for v in a.data]
    return result

def weight_rows(obj, rig):
    names = {b.name for b in rig.data.bones if b.use_deform}
    groups = {g.index: g.name for g in obj.vertex_groups}
    return [[[groups[e.group], float(e.weight)] for e in v.groups
             if groups[e.group] in names and e.weight > 0] for v in obj.data.vertices]

def admit_rig(obj, rig, names):
    identity = matrix(Matrix.Identity(4))
    assert set(b.name for b in rig.data.bones) == names
    assert matrix(obj.matrix_world) == identity and matrix(rig.matrix_world) == identity
    for b in rig.data.bones:
        assert b.use_deform and b.inherit_scale == "FULL" and b.use_inherit_rotation
        assert b.use_local_location and not b.use_connect and not rig.pose.bones[b.name].constraints
    assert all(m.type == "ARMATURE" for m in obj.modifiers)
    assert len(obj.modifiers) == 1
    m = obj.modifiers[0]
    assert m.object == rig and m.use_vertex_groups and not m.use_bone_envelopes
    assert not m.use_deform_preserve_volume and not m.use_multi_modifier and not m.vertex_group
    assert m.show_viewport and m.show_render
    return {"boneNames": sorted(names), "matrixWorld": matrix(obj.matrix_world),
            "rigWorld": matrix(rig.matrix_world), "useVertexGroups": m.use_vertex_groups,
            "useBoneEnvelopes": m.use_bone_envelopes, "preserveVolume": m.use_deform_preserve_volume,
            "multiModifier": m.use_multi_modifier, "vertexGroup": m.vertex_group,
            "bones": {b.name: {"inheritScale": b.inherit_scale, "inheritRotation": b.use_inherit_rotation,
                               "localLocation": b.use_local_location, "connected": b.use_connect,
                               "deform": b.use_deform, "constraints": len(rig.pose.bones[b.name].constraints)}
                      for b in rig.data.bones}}

def native_mesh(obj, rig):
    obj.data.calc_loop_triangles()
    weights = weight_rows(obj, rig)
    assert all(rows and abs(sum(v for _, v in rows) - 1) < .001 for rows in weights)
    return {"objectName": obj.name, "meshName": obj.data.name,
            "materials": [m.name if m else None for m in obj.data.materials],
            "positions": flat(v.co for v in obj.data.vertices),
            "normals": flat(v.vector for v in obj.data.vertex_normals),
            "polygons": [list(p.vertices) for p in obj.data.polygons],
            "triangles": [list(p.vertices) for p in obj.data.loop_triangles],
            "triangleLoops": [list(p.loops) for p in obj.data.loop_triangles],
            "loopVertexIndices": [int(v.vertex_index) for v in obj.data.loops],
            "cornerNormals": flat(n.vector for n in obj.data.corner_normals),
            "uvLayers": {a.name: flat(v.uv for v in a.data) for a in obj.data.uv_layers},
            "activeUV": obj.data.uv_layers.active.name if obj.data.uv_layers.active else None,
            "smoothPolygons": [bool(p.use_smooth) for p in obj.data.polygons],
            "hasCustomNormals": obj.data.has_custom_normals,
            "sharpEdges": [bool(v.value) for v in obj.data.attributes["sharp_edge"].data]
                          if "sharp_edge" in obj.data.attributes else None,
            "attributes": attributes(obj.data), "weights": weights,
            "matrixWorld": matrix(obj.matrix_world),
            "modifiers": [{"name": m.name, "type": m.type, "viewport": m.show_viewport,
                           "render": m.show_render, "object": getattr(getattr(m, "object", None), "name", None)}
                          for m in obj.modifiers]}

def pose_rig(rig, specification):
    for b in rig.pose.bones:
        b.matrix_basis = Matrix.Identity(4)
        b.rotation_mode = "QUATERNION"
    for name, q in specification.items():
        rig.pose.bones[name].rotation_quaternion = Quaternion(q["axis"], q["radians"])
    bpy.context.view_layer.update()

def evaluated_mesh(obj):
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    try:
        assert len(mesh.vertices) == len(obj.data.vertices)
        assert [list(p.vertices) for p in mesh.polygons] == [list(p.vertices) for p in obj.data.polygons]
        return {"positions": flat(v.co for v in mesh.vertices),
                "normals": flat(n.vector for n in mesh.vertex_normals), "matrixWorld": matrix(evaluated.matrix_world)}
    finally: evaluated.to_mesh_clear()

try:
    save()
    assert report["buildHash"] == "d13f752e3b9c"
    assert digest(PARENT) == "28b28844d2e9391314650ad489e4c45c72cfd42542f088ebe931b6c9a8203261"
    parent = json.loads(PARENT.read_text())
    for filename, expected in parent["inputs"].items():
        assert digest(filename) == expected, filename
    report["validatedParentInputs"] = len(parent["inputs"])
    for p in sorted((ROOT / "tools/figure-pipeline").glob("*.py")): bind(p)
    for relative in ["tools/critic/foundation-native-band.py", "tools/critic/foundation-native-band-inputs.mjs",
                     "docs/evidence/wardrobe-2026-09-30/foundation-native-band/PLAN.md",
                     "docs/evidence/wardrobe-2026-09-30/foundation-native-band/SOURCE-REVIEW.md",
                     "tmp/foundation-band-sep30/input-receipt.json", "tmp/foundation-band-sep30/accepted-inputs.json.gz",
                     "tmp/foundation-band-sep30/runtime-preflight.json", "tmp/foundation-band-sep30/blender-mount.plist",
                     "tmp/wardrobe-sep30/blender-isolated.sh", "tools/figure-pipeline/.cache/mpfb-2.0.17.zip",
                     "captures/skeleton-native-pose-2026-09-30-v1/body-0.json.gz"]:
        bind(ROOT / relative)
    receipt = json.loads((ROOT / "tmp/foundation-band-sep30/input-receipt.json").read_text())
    encoded = Path(receipt["path"]).read_bytes()
    assert sha(encoded) == receipt["sha256"]
    decoded = gzip.decompress(encoded)
    assert sha(decoded) == receipt["decodedSHA256"]
    inputs = json.loads(decoded)
    for p, expected in inputs["pins"].items():
        assert digest(ROOT / p) == expected, p
        bind(ROOT / p)
    source = BUILDER.read_bytes()
    assert sha(source) == EXPECTED_BUILDER
    tree = ast.parse(source, filename=str(BUILDER))
    last = tree.body[-1]
    assert isinstance(last, ast.Expr) and isinstance(last.value, ast.Call)
    assert isinstance(last.value.func, ast.Name) and last.value.func.id == "main"
    assert not last.value.args and not last.value.keywords
    assert ast.get_source_segment(source.decode(), last) == "main()"
    tree.body.pop()
    builder = types.ModuleType("sugata_foundation_probe_builder")
    builder.__file__ = str(BUILDER)
    sys.modules[builder.__name__] = builder
    exec(compile(tree, str(BUILDER), "exec"), builder.__dict__)
    report["removedTerminalCall"] = {"line": last.lineno, "source": "main()", "builderSHA256": EXPECTED_BUILDER}
    builder.clear_startup_scene()
    inventory = json.loads((ROOT / "docs/evidence/nonhair-2026-09-26/wardrobe-coupling/inventory-v1.json").read_text())
    recipe = inventory["sourceData"]["neutralRetainedRecipe"]
    body = builder.HumanService.create_human(macro_detail_dict=recipe["macro"])
    builder.HumanObjectProperties.set_value("gender", .5, entity_reference=body)
    builder.TargetService.reapply_macro_details(body)
    stack = builder.TargetService.calculate_target_stack_from_macro_info_dict(builder.TargetService.get_macro_info_dict_from_basemesh(body))
    assert [{"file": n, "weight": w} for n, w in stack] == recipe["mpfbStack"]
    assert len(body.data.vertices) == 19158
    a = body.data.attributes.new("probe_source_index", "FLOAT", "POINT")
    for i, row in enumerate(a.data): row.value = i
    rig = builder.HumanService.add_builtin_rig(body, "game_engine", import_weights=True)
    assert len(rig.data.bones) == 53
    builder.bake_for_export(body)
    builder.bake_macro_shape_keys(body)
    bpy.context.view_layer.update()
    assert len(body.data.vertices) == 13380
    old_bytes = (ROOT / "captures/skeleton-native-pose-2026-09-30-v1/body-0.json.gz").read_bytes()
    assert sha(old_bytes) == "ccff3c6427938371ce942e645e8571c0c707d2c580a17f00a0d459600bc97085"
    old = json.loads(gzip.decompress(old_bytes))
    report["rigAdmission"] = admit_rig(body, rig, set(old["restBones"]))
    for b in rig.data.bones:
        assert matrix(b.matrix_local) == old["restBones"][b.name]["matrixLocal"]
        assert list(b.head_local) == old["restBones"][b.name]["head"]
        assert list(b.tail_local) == old["restBones"][b.name]["tail"]
    mapping = [int(v.value) for v in body.data.attributes["probe_source_index"].data]
    assert len(set(mapping)) == 13380
    expected = {r["source"]: r for r in inputs["vertices"]}
    assert set(mapping) == set(expected)
    actual_weights = weight_rows(body, rig)
    assert all(sorted(actual_weights[i]) == sorted(old["fullWeights"][s]) for i, s in enumerate(mapping))
    residuals = []
    for i, source_id in enumerate(mapping):
        v = body.data.vertices[i].co
        actual = [v.x, v.z, -v.y]
        reference = expected[source_id]["values"]["position"]
        residuals.append(math.dist(actual, reference))
    report["bodyAdmission"] = {"vertices": len(mapping), "maxMetres": max(residuals),
                               "thresholdMetres": .000001, "worstSource": mapping[residuals.index(max(residuals))]}
    save()
    assert max(residuals) < .000001, report["bodyAdmission"]
    for name in inputs["maskNames"]:
        assert name not in body.data.attributes
        a = body.data.attributes.new(name, "FLOAT", "POINT")
        for i, source_id in enumerate(mapping): a.data[i].value = expected[source_id]["values"]["masks"][name]
        assert all(a.data[i].value == expected[s]["values"]["masks"][name] for i, s in enumerate(mapping))
    body.data.attributes.remove(body.data.attributes["probe_source_index"])
    report["body"] = archive("native-body.json.gz", {**native_mesh(body, rig), "sourceIndices": mapping, "residuals": residuals})
    marks = builder.measure_landmarks(body, rig)
    report["landmarks"] = serial(vars(marks))
    report["rig"] = archive("native-rig.json.gz", {"matrixWorld": matrix(rig.matrix_world),
        "bones": [{"name": b.name, "parent": b.parent.name if b.parent else None,
                   "matrixLocal": matrix(b.matrix_local), "head": list(b.head_local), "tail": list(b.tail_local),
                   "useDeform": b.use_deform} for b in rig.data.bones]})
    def band_only(point, dominant, m):
        return (dominant in builder.TORSO_BONES and
                m.bust_z - .50 * (m.bust_z - m.spine_03_z) <= point.z <=
                m.bust_z + .45 * (m.clavicle_z - m.bust_z))
    manifest = builder.read_wardrobe_manifest(str(ROOT / "assets/wardrobe/manifest.json"), ["foundation_bra"])
    args = types.SimpleNamespace(keep_morph_normals=False, rig="game_engine", hide_mask_attribute=True,
                                 foundation=["foundation_bra"])
    dominant = builder.dominant_bone_per_vertex(body, rig)
    shells = []
    for label, predicate in [("original-control", builder.foundation_region_bra), ("band", band_only)]:
        region = {v.index for v in body.data.vertices if predicate(v.co, dominant[v.index], marks)}
        assert region
        shell, standoff = builder.cut_conformal_shell(body, rig, "foundation_bra", region,
            predicate, marks, manifest["foundation_bra"], roll_hem=True)
        builder.force_alpha_mode(shell, manifest["foundation_bra"]["alphaMode"])
        assert all(not n.lower().startswith(("_hide_", "_decency_")) for n in shell.data.attributes.keys())
        assert "_NATIVE_VERTEX" not in shell.data.attributes
        a = shell.data.attributes.new("_NATIVE_VERTEX", "FLOAT", "POINT")
        for i, row in enumerate(a.data): row.value = i
        data = native_mesh(shell, rig)
        shell_admission = admit_rig(shell, rig, set(old["restBones"]))
        assert all("_under_" + n[6:] in data["attributes"] for n in inputs["maskNames"] if n.startswith("_HIDE_"))
        item = {"label": label, "region": sorted(region), "standoff": serial(vars(standoff)),
                "rigAdmission": shell_admission,
                "vertices": len(shell.data.vertices), "fullInfluenceMax": max(map(len, data["weights"])),
                "native": archive(label + "-native.json.gz", data), "poses": []}
        file = OUT / (label + ".glb")
        builder.export_glb([rig, shell], str(file), args)
        item["export"] = {"file": file.name, "sha256": digest(file), "bytes": file.stat().st_size}
        report["cases"].append(item)
        shells.append((shell, item))
        save()
    for label, specification in POSES.items():
        pose_rig(rig, specification)
        bones = {b.name: {"matrix": matrix(b.matrix), "basis": matrix(b.matrix_basis)} for b in rig.pose.bones}
        for shell, item in shells:
            observation = {"pose": label, "bones": bones, "rigWorld": matrix(rig.matrix_world),
                           "shell": evaluated_mesh(shell), "body": evaluated_mesh(body)}
            item["poses"].append(archive(item["label"] + "-" + label + ".json.gz", observation))
        save()
    pose_rig(rig, {})
    blend = OUT / "construction.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    report["blend"] = {"file": blend.name, "sha256": digest(blend), "bytes": blend.stat().st_size}
    report["loadedMPFB"] = []
    for name, module in sorted(list(sys.modules.items())):
        file = getattr(module, "__file__", None)
        if file and ".mpfb" in name and Path(file).suffix == ".py":
            p = str(Path(file).resolve())
            assert p in parent["inputs"] and digest(p) == parent["inputs"][p], p
            report["loadedMPFB"].append({"module": name, "path": p, "sha256": digest(p)})
    for relative, expected_hash in report["sources"].items(): assert digest(ROOT / relative) == expected_hash
    report["status"] = "constructed-awaiting-export-coverage-and-visual-review"
except BaseException as error:
    report["status"] = "failed"
    report["errors"].append({"type": type(error).__name__, "message": str(error), "traceback": traceback.format_exc()})
    raise
finally:
    report["finished"] = now()
    save()
