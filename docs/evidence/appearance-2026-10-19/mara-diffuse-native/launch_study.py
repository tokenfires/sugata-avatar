"""Exclusive single native study with collected process-group and output ownership."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import resource
import signal
import stat
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for part in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(part)
    return h.hexdigest()

def create(name, data):
    with (HERE / name).open("x") as stream:
        json.dump(data, stream, indent=2)
        stream.write("\n")

def inventory():
    rows = []
    for path in sorted(HERE.rglob("*")):
        s = path.lstat()
        row = {"path": str(path.relative_to(HERE)), "mode": oct(stat.S_IMODE(s.st_mode)), "bytes": s.st_size}
        row["type"] = "regular" if stat.S_ISREG(s.st_mode) else "directory" if stat.S_ISDIR(s.st_mode) else "other"
        if row["type"] == "regular":
            row["sha256"] = digest(path)
        rows.append(row)
    return rows

def bounded_child():
    # A per-file limit, not a whole-process memory or total-output guarantee.
    resource.setrlimit(resource.RLIMIT_FSIZE, (128 * 1024**2, 128 * 1024**2))

def main():
    if len(sys.argv) != 2:
        raise RuntimeError("root admission SHA required")
    admission = HERE / "ROOT-ADMISSION.json"
    if digest(admission) != sys.argv[1]:
        raise RuntimeError("admission identity mismatch")
    d = json.loads(admission.read_bytes())
    if d["state"] != "ONE_NATIVE_RENDER_SAVE_STUDY":
        raise RuntimeError("wrong admission scope")
    if datetime.datetime.now(datetime.timezone.utc) >= datetime.datetime.fromisoformat(d["launch_before_utc"]):
        raise RuntimeError("admission expired")
    for row in d["pins"]:
        path = Path(row["path"])
        if path.stat().st_size != row["bytes"] or digest(path) != row["sha256"]:
            raise RuntimeError("input identity mismatch: " + str(path))
    for name in ["CLAIM.json", "JOB.json", "NATIVE.log", "RESULT.json", "FAILURE.json", "candidate.blend", "BEFORE.json", "AFTER.json"] + [v + "-" + w + ".png" for v in ["control", "candidate"] for w in ["front", "oblique", "profile"]]:
        if (HERE / name).exists():
            raise RuntimeError("already consumed or pending: " + name)
    baseline = inventory()
    create("CLAIM.json", {"utc": now(), "wrapper_pid": os.getpid(), "admission_sha256": sys.argv[1]})
    contract = json.loads((HERE / "CONTRACT.json").read_bytes())
    start = time.monotonic()
    record = {"started_utc": now(), "wrapper_pid": os.getpid(), "argv": contract["argv"], "native_pid": None,
              "timeout_seconds": 180, "rss_threshold_bytes": 6 * 1024**3, "output_threshold_bytes": 128 * 1024**2,
              "monitor_limit": "Process-group RSS and total leaf regular bytes sampled every0.2s; thresholds may overshoot. Not hard peak-memory/all-native-I/O coverage.",
              "rss_observed_peak_bytes": 0, "trigger": None, "baseline": baseline}
    child = None
    try:
        with (HERE / "NATIVE.log").open("xb") as log:
            child = subprocess.Popen(contract["argv"], stdout=log, stderr=subprocess.STDOUT,
                                     start_new_session=True, preexec_fn=bounded_child,
                                     env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})
            record["native_pid"] = child.pid
            create("STARTED.json", {"utc": now(), "wrapper_pid": os.getpid(), "native_pid": child.pid, "pgid": child.pid, "argv": contract["argv"]})
            print(json.dumps({"native_pid": child.pid, "wrapper_pid": os.getpid(), "utc": now()}), flush=True)
            while child.poll() is None:
                sample = subprocess.run(["ps", "-axo", "pid=,pgid=,rss="], capture_output=True, text=True, timeout=2, check=True)
                rss = sum(int(parts[2]) * 1024 for line in sample.stdout.splitlines() if len(parts := line.split()) == 3 and int(parts[1]) == child.pid)
                record["rss_observed_peak_bytes"] = max(record["rss_observed_peak_bytes"], rss)
                total = sum(p.lstat().st_size for p in HERE.rglob("*") if p.is_file() and not p.is_symlink())
                elapsed = time.monotonic() - start
                if elapsed > 180 or rss > 6 * 1024**3 or total > 128 * 1024**2:
                    record["trigger"] = "wall" if elapsed > 180 else "rss" if rss > 6 * 1024**3 else "output"
                    break
                time.sleep(.2)
    except BaseException as error:
        record["wrapper_error"] = {"type": type(error).__name__, "error": str(error)}
        record["trigger"] = record["trigger"] or "wrapper_error"
    finally:
        if child is not None:
            if child.poll() is None:
                try:
                    os.killpg(child.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
                try:
                    child.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(child.pid, signal.SIGKILL)
                    child.wait()
            record["exit_code"] = child.returncode
            # Own descendants still sharing the created native group even after leader exits.
            try:
                os.killpg(child.pid, signal.SIGTERM)
                end_cleanup = time.monotonic() + 5
                while True:
                    try:
                        os.killpg(child.pid, 0)
                    except ProcessLookupError:
                        record["group_cleanup"] = "remaining owned group collected absent after TERM"
                        break
                    if time.monotonic() >= end_cleanup:
                        os.killpg(child.pid, signal.SIGKILL)
                        record["group_cleanup"] = "remaining owned group KILL sent; root must verify absence"
                        break
                    time.sleep(.2)
            except ProcessLookupError:
                record["group_cleanup"] = "group absent"
        record["finished_utc"] = now()
        record["elapsed_seconds"] = time.monotonic() - start
        record["actual_outputs"] = inventory()
        create("JOB.json", record)
        print(json.dumps({k: v for k, v in record.items() if k not in ["baseline", "actual_outputs"]}), flush=True)
    return 0 if record.get("exit_code") == 0 and record["trigger"] is None else 1

if __name__ == "__main__":
    sys.exit(main())
