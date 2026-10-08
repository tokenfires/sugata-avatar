"""Read a successful owned whole-scene source once; never construct or resave."""
import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import bpy

HERE = Path(__file__).resolve().parent
if not bpy.app.background or bpy.app.online_access:
    raise RuntimeError("Require offline background")
warm = json.loads((HERE / "SOURCE-RESULT.json").read_text())
source = Path(warm["source"])
if not warm["success"] or source != HERE / "work/neutral-source.blend":
    raise RuntimeError("No complete source admitted for readback")
if hashlib.sha256(source.read_bytes()).hexdigest() != warm["source_sha256"]:
    raise RuntimeError("Native source byte identity changed")
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("sugata_cold_receipt", HERE / "scene_receipt.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
observed = module.capture_scene()
expected = warm["scene"]
report = {"observed_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
          "loaded_filepath": bpy.data.filepath, "source_sha256": warm["source_sha256"],
          "whole_owner_signature_equal": observed == expected, "scene": observed,
          "limit": "One cold owner-state readback only; no constructor/save/export/render or appearance acceptance."}
if Path(bpy.data.filepath).resolve() != source.resolve():
    raise RuntimeError("Wrong native file opened")
with (HERE / "COLD-RESULT.json").open("x") as out:
    json.dump(report, out, indent=2)
    out.write("\n")
print("SUGATA_COLD " + json.dumps({k: v for k, v in report.items() if k != "scene"}))
if observed != expected:
    raise SystemExit(1)
