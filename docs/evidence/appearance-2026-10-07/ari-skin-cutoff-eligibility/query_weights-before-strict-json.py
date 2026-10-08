"""Read native skin weights only; no exporter, save, pose or weight operations."""
import sys
sys.dont_write_bytecode = True
import json
import math
import hashlib
import datetime
import importlib.util
import traceback
from pathlib import Path
import bpy

HERE = Path(__file__).resolve().parent
plan = json.loads((HERE / "EXEC-PLAN.json").read_text())
result_path = HERE / "RESULT.json"
report = {"started_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
          "cutoff": 0.0001, "owners": [], "unsupported": [], "invalid_weights": [],
          "cutoff_participants": [], "zero_bone_sums": [], "passed": False,
          "limit": "Necessary native cutoff eligibility only; exporter joint tree/binds/defaults/materials/GLB remain unqualified."}

def require(condition, message):
    if not condition:
        raise RuntimeError(message)

def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def provenance(body):
    out = {}
    for key, name, domain in [("points", "sugata_source_point", "POINT"),
                              ("faces", "sugata_source_face", "FACE"),
                              ("corners", "sugata_source_corner", "CORNER")]:
        attr = body.data.attributes.get(name)
        require(attr is not None and attr.domain == domain and attr.data_type == "INT", "Lost provenance")
        ids = [v.value for v in attr.data]
        require(len(ids) == len(set(ids)), "Ambiguous provenance")
        out[key] = ids
    return out

try:
    require(not result_path.exists() and bpy.app.background and not bpy.app.online_access,
            "Require fresh offline background query")
    source = Path(plan["source"]["path"])
    require(Path(bpy.data.filepath).resolve() == source, "Wrong candidate CLI path")
    for pin in [plan["source"], *plan["pins"]]:
        raw = Path(pin["path"]).read_bytes()
        require(len(raw) == pin["bytes"] and hashlib.sha256(raw).hexdigest() == pin["sha256"], "Query input pin changed")
    warm = json.loads(Path(plan["warm_receipt"]["path"]).read_text())
    scene_module = load(plan["scene_helper"]["path"], "sugata_weights_scene")
    metadata_module = load(plan["metadata_helper"]["path"], "sugata_weights_metadata")
    before = scene_module.capture_scene()
    require(before == warm["derivative_owner_signature"], "Saved owner signature changed")
    body = bpy.data.objects["Human"]
    before_mapping = provenance(body)
    before_metadata = metadata_module.snapshot(body.data.shape_keys)
    require(before_mapping == warm["mapping"] and before_metadata == warm["extended_key_metadata"]["restored"],
            "Saved mapping or key semantics changed")
    rigs = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    require(len(rigs) == 1 and rigs[0].get("sugata_source_role") == "game_engine_rig", "Ambiguous native rig")
    rig = rigs[0]
    bones = {b.name: b for b in rig.data.bones}
    report["rig"] = {"name": rig.name, "bones": [{"name": b.name, "use_deform": b.use_deform} for b in rig.data.bones]}
    report["before_scene"] = before
    report["before_mapping"] = before_mapping
    report["before_key_metadata"] = before_metadata
    meshes = sorted((o for o in bpy.data.objects if o.type == "MESH"), key=lambda o: o.name)
    require(len(meshes) == 6, "Unexpected mesh owner set")
    for obj in meshes:
        armatures = [m for m in obj.modifiers if m.type == "ARMATURE"]
        group_names = {g.index: g.name for g in obj.vertex_groups}
        require(len(group_names) == len(obj.vertex_groups), "Ambiguous vertex group indices")
        owner = {"name": obj.name, "vertices": len(obj.data.vertices), "parent": obj.parent.name if obj.parent else None,
                 "armatures": [{"name": m.name, "object": m.object.name if m.object else None,
                                  "use_vertex_groups": m.use_vertex_groups, "use_bone_envelopes": m.use_bone_envelopes,
                                  "show_viewport": m.show_viewport, "show_render": m.show_render} for m in armatures],
                 "groups": [{"index": i, "name": n, "native_bone": n if n in bones else None,
                             "use_deform": bones[n].use_deform if n in bones else None} for i, n in group_names.items()],
                 "vertex_records": []}
        if len(armatures) != 1 or armatures[0].object != rig or not armatures[0].use_vertex_groups \
                or armatures[0].use_bone_envelopes or not armatures[0].show_viewport or not armatures[0].show_render \
                or obj.parent != rig:
            report["unsupported"].append({"owner": obj.name, "reason": "Native rig/modifier/parent association not owned"})
        for v in obj.data.vertices:
            memberships = []
            positive_bones = []
            for g in v.groups:
                require(g.group in group_names, "Unknown group index")
                name = group_names[g.group]
                w = g.weight
                bone = bones.get(name)
                item = {"group_index": g.group, "group": name, "weight": w,
                        "native_bone": name if bone else None, "use_deform": bone.use_deform if bone else None}
                memberships.append(item)
                witness = {"owner": obj.name, "vertex": v.index, "coordinate_local": list(v.co), **item}
                if not math.isfinite(w) or w < 0:
                    report["invalid_weights"].append(witness)
                if bone is not None and math.isfinite(w) and w > 0:
                    positive_bones.append(item)
                    if w <= report["cutoff"]:
                        report["cutoff_participants"].append(witness)
            total = math.fsum(i["weight"] for i in positive_bones)
            if not math.isfinite(total) or total <= 0:
                report["zero_bone_sums"].append({"owner": obj.name, "vertex": v.index, "coordinate_local": list(v.co),
                                                 "positive_bone_sum": total})
            owner["vertex_records"].append({"vertex": v.index, "memberships": memberships,
                                            "positive_bone_sum": total, "positive_bone_count": len(positive_bones)})
        owner["min_positive_bone_sum"] = min(r["positive_bone_sum"] for r in owner["vertex_records"])
        owner["max_positive_bone_sum"] = max(r["positive_bone_sum"] for r in owner["vertex_records"])
        owner["max_positive_bone_count"] = max(r["positive_bone_count"] for r in owner["vertex_records"])
        report["owners"].append(owner)
    after = scene_module.capture_scene()
    require(after == before, "Query changed recorded owners")
    require(provenance(body) == before_mapping and metadata_module.snapshot(body.data.shape_keys) == before_metadata,
            "Query changed provenance/key semantics")
    require(hashlib.sha256(source.read_bytes()).hexdigest() == plan["source"]["sha256"], "Physical candidate changed")
    report["after_scene"] = after
    report["owner_mapping_metadata_and_bytes_unchanged"] = True
    report["passed"] = not any(report[k] for k in ["unsupported", "invalid_weights", "cutoff_participants", "zero_bone_sums"])
except Exception:
    report["exception"] = traceback.format_exc()
finally:
    report["finished_utc"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with result_path.open("x") as out:
        json.dump(report, out, indent=2); out.write("\n")
    print("SUGATA_WEIGHT_ELIGIBILITY " + json.dumps({"passed": report["passed"], "result": str(result_path)}))
if not report["passed"]:
    raise RuntimeError("Native input eligibility refused; preserve evidence, no retry")
