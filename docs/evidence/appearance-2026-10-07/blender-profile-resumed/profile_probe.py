"""Observe the selected Blender profile; never enable/import MPFB or touch a scene."""
import datetime
import json
import os
from pathlib import Path
import sys

import bpy

args = sys.argv[sys.argv.index("--") + 1:]
if len(args) != 1:
    raise RuntimeError("Expected the single owned JSON output path")
output = Path(args[0])
if output.exists():
    raise RuntimeError("Refusing to replace an existing report")

loaded = []
unresolved = []
for name, module in sorted(sys.modules.copy().items()):
    if "mpfb" in name.split("."):
        if module is None:
            unresolved.append(name)
        else:
            loaded.append({"module": name, "file": vars(module).get("__file__")})

report = {
    "observed_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "pid": os.getpid(),
    "version": list(bpy.app.version),
    "version_string": bpy.app.version_string,
    "binary_path": bpy.app.binary_path,
    "background": bpy.app.background,
    "online_access": getattr(bpy.app, "online_access", None),
    "resource_paths": {kind: bpy.utils.resource_path(kind)
                       for kind in ("USER", "LOCAL", "SYSTEM")},
    "user_paths": {kind: bpy.utils.user_resource(kind, create=False)
                   for kind in ("CONFIG", "SCRIPTS", "DATAFILES")},
    "script_paths": bpy.utils.script_paths(),
    "configured_addons": sorted(bpy.context.preferences.addons.keys()),
    "already_loaded_mpfb_modules": loaded,
    "unresolved_mpfb_module_names": unresolved,
    "limit": "Current profile observation only. No explicit addon import/enable, preference save, MPFB service/data call, human/scene/geometry/rig/target/snapshot/export/render operation. Blender startup itself is not instrumented for arbitrary internal file reads.",
}
with output.open("x", encoding="utf-8") as stream:
    json.dump(report, stream, indent=2)
    stream.write("\n")
print(json.dumps(report, indent=2))
