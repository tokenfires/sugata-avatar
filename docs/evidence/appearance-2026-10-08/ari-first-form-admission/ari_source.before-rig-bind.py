"""One complete active-target Ari pre-bake source; no export or appearance acceptance."""
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import traceback
from types import SimpleNamespace
import bpy

HERE = Path(__file__).resolve().parent
WORK = HERE / "work"
KIT = Path('/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-07/ari-neutral-native-source/work')
CONTROL_HERE = Path('/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-07/ari-neutral-native-source')
SOURCE = WORK / "ari-first-form.blend"
PREFIX = "bl_ext.blender_org.mpfb"
if not bpy.app.background or bpy.app.online_access or SOURCE.exists():
    raise RuntimeError("Require offline owned new source")
sys.dont_write_bytecode = True
execution = json.loads((HERE / "EXEC-PLAN.json").read_text())
for row in execution["pins"]:
    if hashlib.sha256(Path(row["path"]).read_bytes()).hexdigest() != row["sha256"]:
        raise RuntimeError("Source execution pin changed")
inputs = json.loads((CONTROL_HERE / "INPUTS.json").read_text())
for row in inputs["files"]:
    file = Path(row["path"])
    if file.stat().st_size != row["bytes"] or hashlib.sha256(file.read_bytes()).hexdigest() != row["sha256"]:
        raise RuntimeError("Input bytes changed: " + str(file))
for ledger in ("SOURCE-PINS.json", "SOURCE-ADDITIONAL.json"):
    info = json.loads((CONTROL_HERE / ledger).read_text())
    for row in info.get("source_pins", info.get("pins", [])):
        if hashlib.sha256(Path(row["path"]).read_bytes()).hexdigest() != row["sha256"]:
            raise RuntimeError("Source code changed")

location_module = sys.modules[PREFIX + ".services.locationservice"]
location = location_module.LocationService
redirected = {}
for field, value in [("_mpfb_data", KIT / "mpfb/data"), ("_user_data", KIT / "user/data"),
                     ("_user_cache", WORK / "cache"), ("_user_config", WORK / "config")]:
    redirected[field] = {"before": str(getattr(location, field)), "after": str(value)}
    if field in ("_user_cache", "_user_config"):
        value.mkdir(parents=True, exist_ok=True)
    elif not value.is_dir():
        raise RuntimeError("Missing frozen input root")
    setattr(location, field, str(value))
if location.get_second_root() or location.is_mh_user_data_enabled():
    raise RuntimeError("Unowned external asset root active")

# Rehome already-created log channels; Location and LogService cache distinct roots.
log_module = sys.modules[PREFIX + ".services.logservice"]
log_directory = WORK / "logs"
log_directory.mkdir(exist_ok=False)
old_log_directory = Path(log_module._LOGDIR).resolve()
logger_paths = {}
for name, logger in log_module.LogService.get_loggers().items():
    previous = Path(logger.path)
    if previous.resolve().parent != old_log_directory or previous.name != "separated." + name + ".txt":
        raise RuntimeError("Unexpected cached logger path")
    logger_paths[name] = {"before": str(previous), "after": str(log_directory / previous.name)}
    logger.path = str(log_directory / previous.name)
log_module._LOGDIR = str(log_directory)
log_module._COMBINED = str(log_directory / "combined.txt")

# Reject Python filesystem writes outside the new source packet and existing log directory.
allowed = [HERE.resolve(), log_directory.resolve()]
def audit(event, args):
    if event == "open" and not isinstance(args[0], int):
        mode, flags = args[1], args[2]
        writing = (mode is not None and any(c in mode for c in "wax+")) or flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND)
        if writing and not any(Path(args[0]).resolve().is_relative_to(root) for root in allowed):
            raise RuntimeError("Unowned Python write: " + str(args[0]))
    if event in ("os.mkdir", "os.remove", "os.rmdir", "os.rename"):
        for path in args[:2] if event == "os.rename" else args[:1]:
            if not any(Path(path).resolve().is_relative_to(root) for root in allowed):
                raise RuntimeError("Unowned Python filesystem mutation: " + str(path))
sys.addaudithook(audit)

builder_path = Path("/Users/robault/GitHub/sugata-avatar/tools/figure-pipeline/build_figure.py")
logical = ["services.humanservice", "services.targetservice", "services.faceservice", "services.exportservice",
           "services.objectservice", "services.assetservice", "services.clothesservice", "entities.clothes.mhclo",
           "entities.objectproperties"]
for name in logical:
    matches = [n for n in sys.modules if n.endswith("mpfb." + name)]
    if matches != [PREFIX + "." + name] or sys.modules[matches[0]] is None:
        raise RuntimeError("Ambiguous/unresolved builder bridge: " + name)
loader_spec = importlib.util.spec_from_file_location("sugata_function_loader", CONTROL_HERE / "function_module.py")
loader_module = importlib.util.module_from_spec(loader_spec)
loader_spec.loader.exec_module(loader_module)
builder = loader_module.load_builder(builder_path)
receipt_spec = importlib.util.spec_from_file_location("sugata_owned_receipt", CONTROL_HERE / "scene_receipt.py")
receipt_module = importlib.util.module_from_spec(receipt_spec)
receipt_spec.loader.exec_module(receipt_module)
capture_scene = receipt_module.capture_scene
face = sys.modules[PREFIX + ".services.faceservice"]
target = sys.modules[PREFIX + ".services.targetservice"].TargetService
expression_names = face.MICROSOFT_VISEMES + face.META_VISEMES + face.ARKIT_FACEUNITS
resolved_expressions = {name: target.target_full_path(name) for name in expression_names}
expected_expressions = json.loads((CONTROL_HERE / "EXPRESSION-PATHS.json").read_text())["paths"]
if resolved_expressions != expected_expressions:
    raise RuntimeError("Incomplete expression source roots")
skin = KIT / "user/data/skins/young_caucasian_female/young_caucasian_female.mhmat"
if builder.AssetService.find_asset_absolute_path(skin.name, "skins") != str(skin):
    raise RuntimeError("Selected skin canonical resolution mismatch")
arguments = SimpleNamespace(gender=.5, age=.5, muscle=.5, weight=.5, height=.5, proportions=.5,
                            cupsize=.5, firmness=.5, skin=skin.name, no_face_parts=False,
                            eye_proxy="high-poly.mhclo", no_microsoft_visemes=False)
report = {"started_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(), "pid": os.getpid(),
          "version": bpy.app.version_string, "redirected_paths": redirected, "logger_paths": logger_paths, "requested_parameters": vars(arguments),
          "resolved_expression_paths": resolved_expressions, "source": str(SOURCE), "success": False}

original_interpolate = builder.FaceService.interpolate_targets
def audited_interpolate(basemesh):
    original_interpolate(basemesh)
    witness = []
    source_keys = {k.name: k for k in basemesh.data.shape_keys.key_blocks}
    for child in [obj for obj in bpy.data.objects if obj.type == "MESH" and obj != basemesh]:
        path = builder.ClothesService.find_clothes_absolute_path(child)
        if not path or not Path(path).resolve().is_relative_to(KIT.resolve()):
            raise RuntimeError("Auxiliary MHClO source missing: " + child.name)
        mhclo = builder.Mhclo()
        mhclo.load(path)
        if set(mhclo.verts) != set(range(len(child.data.vertices))):
            raise RuntimeError("Auxiliary vertex mapping incomplete: " + child.name)
        keys = {k.name: k for k in child.data.shape_keys.key_blocks} if child.data.shape_keys else {}
        for name in expression_names:
            source_key = source_keys[name]
            significant = 0
            max_error = 0.0
            for index, mapping in mhclo.verts.items():
                indices, weights = mapping["verts"], mapping["weights"]
                if any(v < 0 or v >= len(source_key.data) for v in indices):
                    raise RuntimeError("Invalid auxiliary source index")
                offset = sum(((source_key.data[v].co - basemesh.data.vertices[v].co) * weight
                              for v, weight in zip(indices, weights)), start=source_key.data[0].co * 0)
                if offset.length > face.SIGNIFICANT_SHIFT_MINIMUM:
                    significant += 1
                    if name not in keys:
                        raise RuntimeError("Required auxiliary key absent: " + child.name + "/" + name)
                    expected_offset = offset
                else:
                    expected_offset = offset * 0
                if name in keys:
                    observed = keys[name].data[index].co - child.data.vertices[index].co
                    max_error = max(max_error, (observed - expected_offset).length)
            if max_error > 1e-6:
                raise RuntimeError("Auxiliary interpolation mismatch")
            if name in keys and keys[name].value != source_key.value:
                raise RuntimeError("Auxiliary expression value mismatch")
            witness.append({"owner": child.name, "source": path, "key": name,
                            "mapped_vertices": len(mhclo.verts), "significant_vertices": significant,
                            "key_present": name in keys, "max_offset_error": max_error,
                            "absence_reason": "no significant mapped shift" if not significant and name not in keys else None})
    report["auxiliary_expression_witnesses"] = witness
builder.FaceService.interpolate_targets = audited_interpolate
checks_spec = importlib.util.spec_from_file_location("sugata_ari_checks", HERE / "ari_checks.py")
ari_checks = importlib.util.module_from_spec(checks_spec)
checks_spec.loader.exec_module(ari_checks)
try:
    builder.clear_startup_scene()
    body = builder.create_figure(arguments)
    if len(body.data.vertices) != 19158:
        raise RuntimeError("Complete body/helper vertex count mismatch")
    body["sugata_source_role"] = "body_with_helpers"
    body["sugata_source_file"] = str(KIT / "mpfb/data/3dobjs/base.obj")
    ari_checks.prepare(body, builder, target, report, HERE, CONTROL_HERE)
    builder.apply_skin(body, arguments)
    parts = builder.attach_face_parts(body, arguments)
    if len(parts) != 5:
        raise RuntimeError("Complete five-face ownership mismatch")
    for obj, path, alpha in parts:
        obj["sugata_source_role"] = "face_part"
        obj["sugata_source_file"] = path
    builder.load_expression_shape_keys(body, arguments)
    actual_keys = {key.name for key in body.data.shape_keys.key_blocks}
    if not set(expression_names).issubset(actual_keys):
        raise RuntimeError("Missing body expression keys: " + str(set(expression_names) - actual_keys))
    rig = builder.HumanService.add_builtin_rig(body, "game_engine")
    if rig is None:
        raise RuntimeError("Complete rig owner missing")
    rig["sugata_source_role"] = "game_engine_rig"
    rig["sugata_source_file"] = str(KIT / "mpfb/data/rigs/standard/rig.game_engine.json")
    builder.bind_mhclo_parts_to_rig(body, rig, parts)
    expected_objects = {body.name, rig.name} | {obj.name for obj, path, alpha in parts}
    if {obj.name for obj in bpy.data.objects} != expected_objects:
        raise RuntimeError("Whole scene owner set mismatch")
    for obj in [body] + [obj for obj, path, alpha in parts]:
        if builder.count_weighted_vertices(obj, rig) != len(obj.data.vertices):
            raise RuntimeError("Unweighted owner vertices: " + obj.name)
        if not any(m.type == "ARMATURE" and m.object == rig for m in obj.modifiers):
            raise RuntimeError("Missing owner armature modifier: " + obj.name)
    for image in bpy.data.images:
        if image.source == "FILE" and image.users and not Path(bpy.path.abspath(image.filepath)).resolve().is_relative_to(KIT.resolve()):
            raise RuntimeError("Unowned image input")
    bpy.ops.file.pack_all()
    report["actual_macro_parameters"] = target.get_macro_info_dict_from_basemesh(body)
    ari_checks.finish(body, rig, parts, builder, report, capture_scene)
    report["scene"] = capture_scene()
    result = bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), check_existing=False, copy=True, relative_remap=False)
    if result != {"FINISHED"} or not SOURCE.is_file():
        raise RuntimeError("Whole scene save failed")
    report.update(success=True, source_bytes=SOURCE.stat().st_size,
                  source_sha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest())
except Exception as error:
    report.update(error_type=type(error).__name__, error=str(error), traceback=traceback.format_exc())
finally:
    report["finished_utc"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    report["limit"] = "Complete Ari first native form with fixed active detail targets; no helper bake/export/cold/render/appearance/motion acceptance. Python write audit is not instrumentation of all native C writes."
    with (HERE / "RESULT.json").open("x") as out:
        json.dump(report, out, indent=2)
        out.write("\n")
    print("SUGATA_ARI_SOURCE " + json.dumps({k: v for k, v in report.items() if k != "scene"}))
if not report["success"]:
    raise SystemExit(1)
