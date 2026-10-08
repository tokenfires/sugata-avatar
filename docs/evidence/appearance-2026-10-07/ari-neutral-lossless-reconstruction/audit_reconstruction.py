"""One changed lossless reconstruction audit. Never save the original or retry."""
import sys
sys.dont_write_bytecode = True
import os
import json
import hashlib
import datetime
import importlib.util
import traceback
import math
from array import array
from pathlib import Path
import bpy

HERE = Path(__file__).resolve().parent
WORK = HERE / "work"
SOURCE_PACKET = HERE.parent / "ari-neutral-native-source"
SOURCE = SOURCE_PACKET / "work/neutral-source-logged.blend"
SOURCE_SHA = "6ed771b71a99ac8a5cf9c717fef5364ac0a427763e601fecffa984bafd4f53eb"
RESULT = HERE / "RESULT.json"
EPSILON = 1e-6
PREFIX = "bl_ext.blender_org.mpfb"
ATTRS = {"POINT": "sugata_source_point", "FACE": "sugata_source_face", "CORNER": "sugata_source_corner"}
report = {"started_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
          "pid": os.getpid(), "epsilon_m": EPSILON, "checks": [], "limit":
          "Exact retained-source reconstruction only. No GLB/Ari targets/appearance or cold-candidate qualification."}

def check(name, passed, detail=None):
    report["checks"].append({"name": name, "pass": bool(passed), "detail": detail})

def require(condition, message):
    if not condition:
        raise RuntimeError(message)

def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def coords(collection):
    out = array("f", [0]) * (len(collection) * 3)
    collection.foreach_get("co", out)
    require(all(math.isfinite(v) for v in out), "Nonfinite source coordinates")
    return out

def identifiers(mesh, domain):
    attr = mesh.attributes.get(ATTRS[domain])
    require(attr is not None and attr.domain == domain and attr.data_type == "INT", "Lost " + domain + " provenance")
    ids = [item.value for item in attr.data]
    require(len(ids) == len(set(ids)), "Merged/duplicated " + domain + " provenance")
    return ids

def topology(mesh):
    point = identifiers(mesh, "POINT")
    face = identifiers(mesh, "FACE")
    corner = identifiers(mesh, "CORNER")
    return {"points": sorted(point),
            "edges": sorted(sorted(point[i] for i in e.vertices) for e in mesh.edges),
            "faces": sorted((face[p.index], [point[i] for i in p.vertices],
                             [corner[i] for i in p.loop_indices], p.material_index, p.use_smooth)
                            for p in mesh.polygons)}

def evaluated(body):
    bpy.context.view_layer.update()
    evaluated_object = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated_object.to_mesh(preserve_all_data_layers=True,
                                    depsgraph=bpy.context.evaluated_depsgraph_get())
    try:
        ids = identifiers(mesh, "POINT")
        positions = {i: list(evaluated_object.matrix_world @ v.co) for i, v in zip(ids, mesh.vertices)}
        require(all(math.isfinite(v) for xyz in positions.values() for v in xyz), "Nonfinite evaluated coordinates")
        return {"topology": topology(mesh), "positions": positions}
    finally:
        evaluated_object.to_mesh_clear()

try:
    require(bpy.app.background and not bpy.app.online_access and Path(bpy.data.filepath).resolve() == SOURCE, "Wrong offline source")
    require(not WORK.exists() and not RESULT.exists(), "Refusing reused outputs")
    require(hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SOURCE_SHA, "Source hash changed")
    pins = json.loads((HERE / "SOURCE-PINS.json").read_text())["pins"]
    for pin in pins:
        raw = Path(pin["path"]).read_bytes()
        require(len(raw) == pin["bytes"] and hashlib.sha256(raw).hexdigest() == pin["sha256"], "Source pin changed")
    WORK.mkdir()
    logdir = WORK / "logs"
    logdir.mkdir()
    logs = sys.modules[PREFIX + ".services.logservice"]
    old_logdir = Path(logs._LOGDIR).resolve()
    for name, logger in logs.LogService.get_loggers().items():
        old = Path(logger.path)
        require(old.resolve().parent == old_logdir and old.name == "separated." + name + ".txt", "Unexpected logger path")
        logger.path = str(logdir / old.name)
    logs._LOGDIR = str(logdir)
    logs._COMBINED = str(logdir / "combined.txt")
    def audit(event, args):
        if event == "open" and not isinstance(args[0], int):
            mode, flags = args[1:3]
            writing = (mode is not None and any(c in mode for c in "wax+")) or flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND)
            if writing:
                require(Path(args[0]).resolve().is_relative_to(HERE), "Unowned Python write")
        if event in ("os.mkdir", "os.remove", "os.rmdir", "os.rename"):
            for path in args[:2] if event == "os.rename" else args[:1]:
                require(Path(path).resolve().is_relative_to(HERE), "Unowned Python mutation")
    sys.addaudithook(audit)
    receipt = load(SOURCE_PACKET / "scene_receipt.py", "sugata_bake_receipt")
    before = receipt.capture_scene()
    warm = json.loads((SOURCE_PACKET / "LOGGED-SOURCE-RESULT.json").read_text())["scene"]
    require(before == warm, "Cold source signature differs")
    loader = load(SOURCE_PACKET / "function_module.py", "sugata_bake_loader")
    builder = loader.load_builder(HERE.parents[3] / "tools/figure-pipeline/build_figure.py")
    require(builder.ExportService is sys.modules[PREFIX + ".services.exportservice"].ExportService, "Wrong loaded exporter")
    body = bpy.data.objects["Human"]
    require(body.get("sugata_source_role") == "body_with_helpers", "Wrong body owner")
    masks = [m for m in body.modifiers if m.type == "MASK"]
    require(len(masks) == 1 and masks[0].vertex_group == "body" and not masks[0].invert_vertex_group,
            "Unexpected mask semantics")
    require(all(m.type in ("MASK", "ARMATURE") for m in body.modifiers), "Unsupported modifier")
    mesh = body.data
    lengths = {"POINT": len(mesh.vertices), "FACE": len(mesh.polygons), "CORNER": len(mesh.loops)}
    for domain, name in ATTRS.items():
        require(mesh.attributes.get(name) is None, "Source provenance name collision")
        attr = mesh.attributes.new(name=name, type="INT", domain=domain)
        attr.data.foreach_set("value", list(range(lengths[domain])))
    reconstruction = load(HERE / "exact_reconstruction.py", "sugata_exact_shapes")
    key_metadata = reconstruction.snapshot(mesh.shape_keys)
    original_mesh_pointers = {m.as_pointer() for m in bpy.data.meshes}
    original_keys = {k.name: {"coords": coords(k.data), "value": k.value, "relative": k.relative_key.name}
                     for k in mesh.shape_keys.key_blocks}
    require(all(k["relative"] == "Basis" for k in original_keys.values()), "Unsupported relative-key graph")
    original_weights = [[(g.group, g.weight) for g in v.groups] for v in mesh.vertices]
    original_uvs = {uv.name: [tuple(item.uv) for item in uv.data] for uv in mesh.uv_layers}
    visible_before = evaluated(body)
    report["source_visible_counts"] = {k: len(v) for k, v in visible_before["topology"].items()}
    report["source_owner_signature"] = before
    report["pruning_threshold_m"] = sys.modules[PREFIX + ".services.exportservice"].SIGNIFICANT_SHIFT_MINIMUM
    builder.bake_for_export(body)
    mesh = body.data
    point = identifiers(mesh, "POINT")
    face = identifiers(mesh, "FACE")
    corner = identifiers(mesh, "CORNER")
    require(all(0 <= i < lengths["POINT"] for i in point) and all(0 <= i < lengths["FACE"] for i in face)
            and all(0 <= i < lengths["CORNER"] for i in corner), "Out-of-source provenance")
    report["mapping"] = {"points": point, "faces": face, "corners": corner}
    require(topology(mesh) == visible_before["topology"], "Topology changed before reconstruction")
    report["reconstruction"] = reconstruction.restore(body, original_keys, key_metadata, point)
    report["removed_new_unused_meshes"] = reconstruction.remove_new_unused_meshes(original_mesh_pointers)
    report["extended_key_metadata"] = {"source": key_metadata, "restored": reconstruction.snapshot(mesh.shape_keys)}
    check("extended_key_metadata", report["extended_key_metadata"]["source"] == report["extended_key_metadata"]["restored"])
    check("retained_topology_and_smoothing", topology(mesh) == visible_before["topology"])
    check("retained_skin_influences", [[(g.group, g.weight) for g in v.groups] for v in mesh.vertices]
          == [original_weights[i] for i in point])
    check("uv_layer_names", [u.name for u in mesh.uv_layers] == list(original_uvs))
    for uv in mesh.uv_layers:
        check("uv_corner_" + uv.name, uv.name in original_uvs and
              [tuple(item.uv) for item in uv.data] == [original_uvs[uv.name][i] for i in corner])
    check("shape_names_and_order", list(original_keys) == [k.name for k in mesh.shape_keys.key_blocks])
    shape_errors = []
    for key in mesh.shape_keys.key_blocks:
        require(key.name in original_keys, "Unknown output key")
        original = original_keys[key.name]
        check("shape_metadata_" + key.name, (key.value, key.relative_key.name) == (original["value"], original["relative"]))
        maximum = 0.0
        witness = None
        changed = 0
        for output_index, (v, src) in enumerate(zip(key.data, point)):
            expected = original["coords"][3 * src:3 * src + 3]
            require(all(math.isfinite(c) for c in v.co), "Nonfinite output shape coordinates")
            error = sum((a - b) ** 2 for a, b in zip(v.co, expected)) ** .5
            require(math.isfinite(error), "Nonfinite shape error")
            if error > EPSILON:
                changed += 1
            if error > maximum:
                maximum = error
                witness = {"source_vertex": src, "output_vertex": output_index,
                           "expected": list(expected), "actual": list(v.co)}
        shape_errors.append({"name": key.name, "max_error_m": maximum, "vertices_over_epsilon": changed, "witness": witness})
        check("shape_coordinates_" + key.name, maximum <= EPSILON)
    report["shape_errors"] = shape_errors
    visible_after = evaluated(body)
    check("evaluated_visible_topology", visible_after["topology"] == visible_before["topology"])
    require(set(visible_after["positions"]) == set(visible_before["positions"]), "Evaluated provenance differs")
    errors = [(sum((a - b) ** 2 for a, b in zip(pos, visible_before["positions"][i])) ** .5, i)
              for i, pos in visible_after["positions"].items()]
    require(all(math.isfinite(e) for e, i in errors), "Nonfinite evaluated error")
    maximum, witness_id = max(errors)
    check("current_evaluated_world_positions", maximum <= EPSILON,
          {"max_error_m": maximum, "source_vertex": witness_id,
           "before": visible_before["positions"][witness_id], "after": visible_after["positions"][witness_id]})
    after = receipt.capture_scene()
    report["derivative_owner_signature"] = after
    original_objects = {o["name"]: o for o in before["objects"]}
    output_objects = {o["name"]: o for o in after["objects"]}
    check("object_owner_set", set(original_objects) == set(output_objects))
    for name, original in original_objects.items():
        if name != body.name:
            check("unchanged_owner_" + name, output_objects.get(name) == original)
    original_body = original_objects[body.name].copy()
    output_body = output_objects[body.name].copy()
    original_body.pop("mesh"); output_body.pop("mesh")
    original_body["modifiers"] = [m for m in original_body["modifiers"] if m["type"] != "MASK"]
    check("body_transform_parent_groups_modifier", original_body == output_body)
    check("body_vertex_group_names", original_objects[body.name]["mesh"]["vertex_group_names"] == output_objects[body.name]["mesh"]["vertex_group_names"])
    check("owner_material_graphs", [{k: v for k, v in m.items() if k != "users"} for m in before["materials"]]
          == [{k: v for k, v in m.items() if k != "users"} for m in after["materials"]])
    report["material_user_counts"] = {"before": [(m["name"], m["users"]) for m in before["materials"]],
                                      "after": [(m["name"], m["users"]) for m in after["materials"]]}
    check("owner_material_user_counts", report["material_user_counts"]["before"] == report["material_user_counts"]["after"])
    check("owner_packed_images", before["images"] == after["images"])
    check("scene_names", before["scene_names"] == after["scene_names"])
    check("physical_original_unchanged", hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SOURCE_SHA)
    report["passed"] = all(c["pass"] for c in report["checks"])
    if report["passed"]:
        candidate = WORK / "neutral-lossless.blend"
        require(not candidate.exists() and candidate != SOURCE, "Unsafe candidate destination")
        saved = bpy.ops.wm.save_as_mainfile(filepath=str(candidate))
        require(saved == {"FINISHED"} and candidate.is_file(), "Candidate save did not finish")
        require(hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SOURCE_SHA, "Original changed during candidate save")
        report["candidate"] = {"path": str(candidate), "bytes": candidate.stat().st_size,
                               "sha256": hashlib.sha256(candidate.read_bytes()).hexdigest()}
except Exception:
    report["passed"] = False
    report["exception"] = traceback.format_exc()
finally:
    report["finished_utc"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with RESULT.open("x") as out:
        json.dump(report, out, indent=2); out.write("\n")
    print("SUGATA_BAKE " + json.dumps({"passed": report.get("passed"), "result": str(RESULT)}))
if not report.get("passed"):
    raise RuntimeError("Association refused; retain first evidence, no retry")
