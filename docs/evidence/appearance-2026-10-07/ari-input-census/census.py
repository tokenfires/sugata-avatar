"""One bounded metadata census; no MPFB imports, asset decoding or scene writes."""
import datetime
import json
import os
from pathlib import Path
import stat
import sys
import time

import bpy

PACKAGE = "bl_ext.blender_org.mpfb"
EXPECTED = Path("/Users/robault/Library/Application Support/Blender/5.2/extensions/blender_org/mpfb")
if not bpy.app.background or bpy.app.online_access:
    raise RuntimeError("Require offline background process")
args = sys.argv[sys.argv.index("--") + 1:]
if len(args) != 1 or Path(args[0]).exists():
    raise RuntimeError("Require one new owned output")

def loaded(relative):
    module = sys.modules.get(PACKAGE + "." + relative)
    expected = EXPECTED / (relative.replace(".", "/") + ".py")
    if module is None or Path(vars(module).get("__file__", "")).resolve() != expected.resolve():
        raise RuntimeError("Loaded implementation mismatch: " + relative)
    return module

# Precondition the getter's internal import: it must already be loaded.
paths = ["services.assetservice", "services.locationservice", "services.sceneconfigset",
         "services.blenderconfigset", "services.logservice",
         "ui.apply_assets.assetlibrary.assetsettingspanel"]
modules = {name: loaded(name) for name in paths}
assets = modules["services.assetservice"].AssetService
location = modules["services.locationservice"].LocationService

def scene_summary():
    return {"objects": sorted((o.name, o.type) for o in bpy.data.objects),
            "scenes": sorted(s.name for s in bpy.data.scenes)}

def metadata(path):
    p = Path(path)
    result = {"path": str(p), "canonical": str(p.resolve()), "exists": p.exists()}
    if p.exists():
        s = p.stat()
        result.update(regular=stat.S_ISREG(s.st_mode), size=s.st_size, mtime_ns=s.st_mtime_ns,
                      symlink=p.is_symlink())
    return result

before = scene_summary()
start = time.monotonic()
deadline = start + 20
counts = {"directories": 0, "files": 0}
def check_bound():
    if time.monotonic() > deadline or counts["directories"] > 10000 or counts["files"] > 100000:
        raise RuntimeError("Census effort bound exceeded; no availability qualification")

roots = assets.get_available_data_roots()
parts = []
for subdir, filename in [("eyes", "high-poly.mhclo"), ("teeth", "teeth_base.mhclo"),
                         ("tongue", "tongue01.mhclo"), ("eyebrows", "eyebrow001.mhclo"),
                         ("eyelashes", "eyelashes01.mhclo")]:
    part = {"subdir": subdir, "filename": filename, "roots": assets.get_asset_roots(subdir),
            "matches": [], "excluded_symlink_directories": [], "errors": []}
    visited = set()
    def walk_error(error):
        part["errors"].append(str(error))
    for root in part["roots"]:
        check_bound()
        if not Path(root).is_dir():
            part["errors"].append("Asset root is not a directory: " + root)
            continue
        canonical_root = str(Path(root).resolve())
        if canonical_root in visited:
            continue
        visited.add(canonical_root)
        for dirpath, dirs, files in os.walk(root, followlinks=False, onerror=walk_error):
            counts["directories"] += 1
            counts["files"] += len(files)
            check_bound()
            for name in list(dirs):
                child = Path(dirpath) / name
                if child.is_symlink():
                    part["excluded_symlink_directories"].append(str(child))
                    dirs.remove(name)
            if filename in files:
                candidate = metadata(Path(dirpath) / filename)
                candidate["inside_root"] = Path(candidate["canonical"]).is_relative_to(Path(canonical_root))
                part["matches"].append(candidate)
    canonical = sorted({m["canonical"] for m in part["matches"] if m.get("regular")})
    incomplete = bool(part["errors"] or part["excluded_symlink_directories"] or
                      any(not m.get("regular") or not m["inside_root"] for m in part["matches"]))
    part["canonical_matches"] = canonical
    part["status"] = "incomplete" if incomplete else "missing" if not canonical else "unique" if len(canonical) == 1 else "ambiguous"
    parts.append(part)

# Literal source-proven paths only; do not invoke loaders or parse assets.
check_bound()
data = location.get_mpfb_data()
body = {role: metadata(Path(data) / relative) for role, relative in {
    "base_mesh": "3dobjs/base.obj",
    "vertex_groups": "mesh_metadata/basemesh_vertex_groups.json",
    "game_engine_rig": "rigs/standard/rig.game_engine.json",
    "game_engine_weights": "rigs/standard/weights.game_engine.json",
}.items()}
after = scene_summary()
check_bound()
report = {"observed_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
          "pid": os.getpid(), "version": bpy.app.version_string, "online_access": bpy.app.online_access,
          "loaded_implementations": {name: vars(module)["__file__"] for name, module in modules.items()},
          "available_data_roots": roots, "mpfb_data": data, "face_parts": parts, "body_inputs": body,
          "counts": counts, "elapsed_seconds": time.monotonic() - start,
          "scene_before": before, "scene_after": after, "scene_summary_unchanged": before == after,
          "prerequisites_available": all(p["status"] == "unique" for p in parts) and
              all(m.get("regular", False) for m in body.values()) and before == after,
          "limit": "Metadata availability only. No asset content, geometry, construction, targets, rigging, export or appearance qualification. Normal Blender/MPFB startup is uninstrumented and may create directories/reset logs; getter logging may append logs. No prefs/cache/directory/scene writes by this probe."}
with Path(args[0]).open("x", encoding="utf-8") as stream:
    json.dump(report, stream, indent=2)
    stream.write("\n")
print("SUGATA_CENSUS " + json.dumps(report))
