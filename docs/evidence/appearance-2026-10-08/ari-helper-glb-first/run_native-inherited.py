"""Record exactly one owned offline Blender process, with timeout and no retry."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import signal
import subprocess
import sys

HERE = Path(__file__).resolve().parent
preflight = json.loads((HERE / "ROOT-PREFLIGHT.json").read_text())
plan = json.loads((HERE / "EXEC-PLAN.json").read_text())
assert preflight["admitted"] and preflight["outputs_absent"] and preflight["background_native_absent"]
assert datetime.datetime.now(datetime.timezone.utc) < datetime.datetime.fromisoformat("2026-10-08T09:35:00+00:00")
for pin in plan["pins"]:
    b = Path(pin["path"]).read_bytes()
    assert len(b)==pin["bytes"] and hashlib.sha256(b).hexdigest()==pin["sha256"]
assert all(not (HERE/n).exists() for n in ["work","JOB-start.json","JOB.json","COLD-RESULT.json","RESULT.json","native.log","NATIVE.json","GLB-DOCUMENT.json"])
job={"started_utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),"wrapper_pid":os.getpid(),
     "argv":plan["argv"],"timeout_seconds":180,"timed_out":False}
with (HERE/"native.log").open("x") as log:
    p=subprocess.Popen(plan["argv"],stdout=log,stderr=subprocess.STDOUT,cwd=str(HERE),start_new_session=True)
    job["pid"]=p.pid
    with (HERE/"JOB-start.json").open("x") as f:
        json.dump(job,f,indent=2);f.write("\n")
    try:
        job["exit_code"]=p.wait(timeout=180)
    except subprocess.TimeoutExpired:
        job["timed_out"]=True
        os.killpg(p.pid,signal.SIGTERM)
        try:
            job["exit_code"]=p.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(p.pid,signal.SIGKILL)
            job["exit_code"]=p.wait()
job["finished_utc"]=datetime.datetime.now(datetime.timezone.utc).isoformat()
for name in ["candidate.glb","native-arrays.npz"]:
    f=HERE/"work"/name
    if f.is_file():
        f.chmod(0o444)
with (HERE/"JOB.json").open("x") as f:
    json.dump(job,f,indent=2);f.write("\n")
print(json.dumps(job,indent=2),flush=True)
sys.exit(job["exit_code"])
