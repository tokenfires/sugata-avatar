"""One temporary material initializer plus read-only native operator/RNA evidence."""
import datetime
import json
import os
from pathlib import Path
import sys
import traceback
import bpy

HERE = Path(__file__).resolve().parent
if not bpy.app.background or bpy.app.online_access:
    raise RuntimeError("Require offline background process")
module = sys.modules.get("bl_ext.blender_org.mpfb.services.materialservice")
expected = Path("/Users/robault/Library/Application Support/Blender/5.2/extensions/blender_org/mpfb/services/materialservice.py")
if module is None or Path(vars(module).get("__file__", "")).resolve() != expected.resolve():
    raise RuntimeError("Require exact already loaded MaterialService")

def property_info(rna, name):
    prop = rna.properties.get(name)
    if prop is None:
        return {"present": False}
    result = {"present": True, "type": prop.type, "readonly": prop.is_readonly}
    if prop.type == "ENUM":
        result["enum_identifiers"] = [i.identifier for i in prop.enum_items]
    return result

before = {"objects": sorted((o.name, o.type) for o in bpy.data.objects),
          "materials": sorted(m.name for m in bpy.data.materials)}
if "Sugata_CompatibilityProbe" in bpy.data.materials:
    raise RuntimeError("Probe material name already exists")
material_fields = {name: property_info(bpy.types.Material.bl_rna, name)
                   for name in ["blend_method", "surface_render_method", "use_nodes"]}
initializer = {"called": True, "name": "Sugata_CompatibilityProbe", "object_argument": None}
try:
    material = module.MaterialService.create_empty_material("Sugata_CompatibilityProbe")
    initializer.update(success=True, returned_name=material.name, use_nodes=material.use_nodes)
except Exception as error:
    initializer.update(success=False, error_type=type(error).__name__, error=str(error),
                       traceback=traceback.format_exc())
operators = {}
for name, op, required in [
    ("save_as_mainfile", bpy.ops.wm.save_as_mainfile, ["filepath", "check_existing", "copy", "relative_remap"]),
    ("pack_all", bpy.ops.file.pack_all, []),
    ("gltf", bpy.ops.export_scene.gltf, ["filepath", "export_format", "use_selection", "export_morph", "export_skins", "export_morph_reset_sk_data"]),
]:
    operators[name] = {"registered": None, "rna_query_success": False}
    try:
        rna = op.get_rna_type()
        operators[name]["registered"] = True
        operators[name].update(rna_query_success=True,
                              required_fields={field: property_info(rna, field) for field in required},
                              all_property_names=sorted(p.identifier for p in rna.properties))
    except Exception as error:
        operators[name].update(rna_query_success=False, error_type=type(error).__name__, error=str(error))
after = {"objects": sorted((o.name, o.type) for o in bpy.data.objects),
         "materials": sorted(m.name for m in bpy.data.materials)}
report = {"observed_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(), "pid": os.getpid(),
          "version": bpy.app.version_string, "background": bpy.app.background, "online_access": bpy.app.online_access,
          "loaded_materialservice": vars(module)["__file__"], "material_fields": material_fields,
          "initializer": initializer, "operators": operators, "before": before, "after": after,
          "objects_unchanged": before["objects"] == after["objects"],
          "limit": "One actual initializer on a new temporary material in this owned background process. No human/geometry, asset/image reads, targets, rig, save/pack/export/render calls or installed preferences/source changes. Normal startup/logging uninstrumented; may create dirs/reset/append logs. RNA registration does not prove live save/export or appearance."}
with (HERE / "RESULT.json").open("x") as out:
    json.dump(report, out, indent=2)
    out.write("\n")
print("SUGATA_API " + json.dumps(report))
