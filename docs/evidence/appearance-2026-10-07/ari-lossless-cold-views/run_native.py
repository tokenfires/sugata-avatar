"""Record one cold/render native process, bounded to180s; no automatic retry."""
from pathlib import Path
import json
import datetime
import subprocess
import sys

here = Path(__file__).resolve().parent
preflight = json.loads((here / "ROOT-PREFLIGHT.json").read_text())
plan = json.loads((here / "EXEC-PLAN.json").read_text())
assert preflight["outputs_absent"] and preflight["background_native_absent"]
assert datetime.datetime.now(datetime.timezone.utc) < datetime.datetime.fromisoformat("2026-10-08T05:40:00+00:00")
assert all(not (here / n).exists() for n in ["JOB-start.json", "JOB.json", "COLD-RESULT.json", "RENDER-RESULT.json"])
job = {"started_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
       "wrapper_pid": __import__("os").getpid(), "argv": plan["argv"],
       "timeout_seconds": plan["timeout_seconds"], "timed_out": False}
with (here / "native.log").open("x") as log:
    process = subprocess.Popen(plan["argv"], stdout=log, stderr=subprocess.STDOUT,
                               cwd=str(here.parents[3]))
    job["pid"] = process.pid
    with (here / "JOB-start.json").open("x") as out:
        json.dump(job, out, indent=2); out.write("\n")
    try:
        job["exit_code"] = process.wait(timeout=plan["timeout_seconds"])
    except subprocess.TimeoutExpired:
        job["timed_out"] = True
        process.terminate()
        try:
            job["exit_code"] = process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            job["exit_code"] = process.wait()
job["finished_utc"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
with (here / "JOB.json").open("x") as out:
    json.dump(job, out, indent=2); out.write("\n")
print(json.dumps(job, indent=2))
sys.exit(job["exit_code"])
