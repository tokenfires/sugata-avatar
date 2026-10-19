"""One native study; WNOWAIT reserves each owned child until retirement ends."""
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
ERRORS = []
CHILDREN = []

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def note(label, error):
    ERRORS.append({"utc": now(), "operation": label, "type": type(error).__name__, "error": str(error)})

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
    for p in sorted(HERE.rglob("*")):
        s = p.lstat()
        row = {"path": str(p.relative_to(HERE)), "mode": oct(stat.S_IMODE(s.st_mode)), "bytes": s.st_size,
               "type": "regular" if stat.S_ISREG(s.st_mode) else "directory" if stat.S_ISDIR(s.st_mode) else "other"}
        if row["type"] == "regular":
            row["sha256"] = digest(p)
        rows.append(row)
    return rows

def observe(child):
    if child.returncode is not None:
        raise RuntimeError("identity already reaped; no later signal permitted")
    # No poll(), wait(), communicate(), wait-for-any, SIGCHLD handler or other reaper.
    status = os.waitid(os.P_PID, child.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
    if status is not None and status.si_pid != child.pid:
        raise RuntimeError("unexpected child identity")
    return status

def send_reserved(child, sig, group=False):
    try:
        observe(child)  # ECHILD/unknown refuses the signal. A running or zombie child remains unreaped.
        if group:
            if os.getpgid(child.pid) != child.pid:
                raise RuntimeError("owned session/group leader identity lost")
            os.killpg(child.pid, sig)
        else:
            os.kill(child.pid, sig)
        return True
    except ProcessLookupError as error:
        note("signal group/process unavailable; no inferred ownership", error)
    except BaseException as error:
        note("signal reserved child", error)
    return False

def reap_nonblocking(child):
    status = observe(child)
    if status is None:
        return False
    pid, encoded = os.waitpid(child.pid, os.WNOHANG)
    if pid != child.pid:
        raise RuntimeError("nonblocking reap not collected")
    child.returncode = os.waitstatus_to_exitcode(encoded)
    return True

def wait_observed(child, seconds):
    end = time.monotonic() + seconds
    while True:
        if observe(child) is not None:
            return True
        if time.monotonic() >= end:
            return False
        time.sleep(.02)

def sample_rows():
    # The only helper is numeric ps. It has its own unreaped reservation and finite retirement.
    child = subprocess.Popen(["/bin/ps", "-axo", "pid=,pgid=,state=,rss="], stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE, start_new_session=True)
    CHILDREN.append(("numeric_ps", child))
    data = bytearray()
    try:
        os.set_blocking(child.stdout.fileno(), False)
        os.set_blocking(child.stderr.fileno(), False)
        end = time.monotonic() + 2
        while True:
            for pipe in [child.stdout, child.stderr]:
                try:
                    block = os.read(pipe.fileno(), 65536)
                except BlockingIOError:
                    block = b""
                if pipe is child.stdout:
                    data.extend(block)
                elif block:
                    raise RuntimeError("numeric ps stderr: " + block[:2048].decode(errors="replace"))
            if len(data) > 1024 * 1024:
                raise RuntimeError("numeric ps output bound")
            if observe(child) is not None:
                # Drain finite remaining pipe content after the child exits, before reaping.
                while True:
                    try:
                        block = os.read(child.stdout.fileno(), 65536)
                    except BlockingIOError:
                        break
                    if not block:
                        break
                    data.extend(block)
                    if len(data) > 1024 * 1024:
                        raise RuntimeError("numeric ps final output bound")
                reap_nonblocking(child)
                if child.returncode != 0:
                    raise RuntimeError("numeric ps nonzero")
                rows = []
                for line in data.decode().splitlines():
                    parts = line.split()
                    if len(parts) != 4:
                        raise RuntimeError("numeric ps row shape")
                    rows.append({"pid": int(parts[0]), "pgid": int(parts[1]), "state": parts[2], "rss": int(parts[3]) * 1024})
                return rows
            if time.monotonic() >= end:
                raise TimeoutError("numeric ps2s deadline")
            time.sleep(.01)
    finally:
        if child.returncode is None:
            try:
                if observe(child) is None:
                    send_reserved(child, signal.SIGTERM)
                    if not wait_observed(child, .25):
                        send_reserved(child, signal.SIGKILL)
                        wait_observed(child, .5)
                if not reap_nonblocking(child):
                    raise RuntimeError("numeric ps remains uncollected")
            except BaseException as error:
                note("numeric ps retirement", error)
        for pipe in [child.stdout, child.stderr]:
            try:
                pipe.close()
            except BaseException as error:
                note("numeric ps pipe close", error)

def live_group(child):
    observe(child)  # direct leader is still reserved when interpreting this group snapshot
    if os.getpgid(child.pid) != child.pid:
        raise RuntimeError("native PGID changed")
    return [r for r in sample_rows() if r["pgid"] == child.pid and not r["state"].startswith("Z")]

def retire_native(child, record):
    # Never reap the leader until all signal decisions finish. Unknown errors are recorded independently.
    retired = False
    try:
        rows = live_group(child)
        if rows:
            send_reserved(child, signal.SIGTERM, group=True)
            for sig, seconds in [(None, 5), (signal.SIGKILL, 2)]:
                if sig is not None:
                    send_reserved(child, sig, group=True)
                end = time.monotonic() + seconds
                while True:
                    rows = live_group(child)
                    if not rows:
                        break
                    if time.monotonic() >= end:
                        break
                    time.sleep(.05)
                if not rows:
                    break
        retired = not rows and observe(child) is not None
        record["group_retirement"] = "observed no live group members with unreaped leader" if retired else "uncollected_or_unknown"
    except BaseException as error:
        note("native retirement observation", error)
        record["group_retirement"] = "unknown; reserved signals attempted only if positive waitid/PGID identity"
        send_reserved(child, signal.SIGTERM, group=True)
        try:
            if not wait_observed(child, 5):
                send_reserved(child, signal.SIGKILL, group=True)
                wait_observed(child, 2)
        except BaseException as error:
            note("native error retirement", error)
    # This is the last action on this numeric identity. There is no subsequent signal.
    try:
        record["native_collected"] = reap_nonblocking(child)
    except BaseException as error:
        note("native nonblocking reap", error)
        record["native_collected"] = False
    record["exit_code"] = child.returncode
    return retired and record["native_collected"]

def bounded_child():
    resource.setrlimit(resource.RLIMIT_FSIZE, (128 * 1024**2, 128 * 1024**2))

def main():
    if len(sys.argv) != 2:
        raise RuntimeError("one root admission SHA required")
    if digest(HERE / "ROOT-ADMISSION.json") != sys.argv[1]:
        raise RuntimeError("admission identity")
    admission = json.loads((HERE / "ROOT-ADMISSION.json").read_bytes())
    if admission["state"] != "ONE_NATIVE_RENDER_SAVE_STUDY" or datetime.datetime.now(datetime.timezone.utc) >= datetime.datetime.fromisoformat(admission["launch_before_utc"]):
        raise RuntimeError("admission scope/expiry")
    if signal.getsignal(signal.SIGCHLD) != signal.SIG_DFL:
        raise RuntimeError("no independent child reaper or SIGCHLDignore allowed")
    for name in ["waitid", "P_PID", "WEXITED", "WNOHANG", "WNOWAIT"]:
        if not hasattr(os, name):
            raise RuntimeError("required nonreaping capability missing")
    for row in admission["pins"]:
        p = Path(row["path"])
        if p.stat().st_size != row["bytes"] or digest(p) != row["sha256"]:
            raise RuntimeError("input identity: " + str(p))
    absent = ["CLAIM.json", "STARTED.json", "JOB.json", "NATIVE.log", "RESULT.json", "FAILURE.json", "BEFORE.json", "AFTER.json", "candidate.blend"]
    absent += [v + "-" + w + ".png" for v in ["control", "candidate"] for w in ["front", "oblique", "profile"]]
    if any((HERE / n).exists() for n in absent):
        raise RuntimeError("already consumed/pending output")
    baseline = inventory()
    create("CLAIM.json", {"utc": now(), "wrapper_pid": os.getpid(), "admission_sha256": sys.argv[1]})
    contract = json.loads((HERE / "CONTRACT.json").read_bytes())
    record = {"started_utc": now(), "wrapper_pid": os.getpid(), "argv": contract["argv"], "native_pid": None,
              "baseline": baseline, "trigger": None, "rss_observed_peak_bytes": 0, "native_collected": False}
    child, log = None, None
    start = time.monotonic()
    retired = False
    try:
        log = (HERE / "NATIVE.log").open("xb")
        child = subprocess.Popen(contract["argv"], stdout=log, stderr=subprocess.STDOUT,
                                 start_new_session=True, preexec_fn=bounded_child,
                                 env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})
        CHILDREN.append(("native", child))
        record["native_pid"] = child.pid
        create("STARTED.json", {"utc": now(), "wrapper_pid": os.getpid(), "native_pid": child.pid, "pgid": child.pid, "argv": contract["argv"]})
        print(json.dumps({"utc": now(), "wrapper_pid": os.getpid(), "native_pid": child.pid}), flush=True)
        while observe(child) is None:
            rows = live_group(child)
            if ERRORS:
                raise RuntimeError("helper evidence error; stop native study")
            rss = sum(r["rss"] for r in rows)
            record["rss_observed_peak_bytes"] = max(record["rss_observed_peak_bytes"], rss)
            total = sum(p.lstat().st_size for p in HERE.rglob("*") if p.is_file() and not p.is_symlink())
            elapsed = time.monotonic() - start
            if elapsed > 180 or rss > 6 * 1024**3 or total > 128 * 1024**2:
                record["trigger"] = "wall" if elapsed > 180 else "rss" if rss > 6 * 1024**3 else "output"
                break
            time.sleep(.2)
    except BaseException as error:
        note("main native study", error)
        record["trigger"] = record["trigger"] or "supervisor_error"
    finally:
        if child is not None:
            try:
                retired = retire_native(child, record)
            except BaseException as error:
                note("independent native retirement guard", error)
        if log is not None:
            try:
                log.close()
            except BaseException as error:
                note("independent log close", error)
        record["finished_utc"] = now()
        record["elapsed_seconds"] = time.monotonic() - start
        record["children"] = [{"role": role, "pid": c.pid, "returncode": c.returncode, "collected": c.returncode is not None} for role, c in CHILDREN]
        try:
            record["actual_outputs"] = inventory()
        except BaseException as error:
            note("independent final output inventory", error)
        record["errors"] = ERRORS
        record["supervisor_pass"] = retired and record.get("exit_code") == 0 and not record["trigger"] and not ERRORS and all(c.returncode is not None for _, c in CHILDREN)
        try:
            create("JOB.json", record)
        except BaseException as error:
            note("independent final JOB write", error)
            record["supervisor_pass"] = False
        try:
            print("SUPERVISOR_RESULT " + json.dumps({k: v for k, v in record.items() if k not in ["baseline", "actual_outputs"]}), flush=True)
        except BaseException as error:
            note("independent final stdout", error)
    return 0 if record.get("supervisor_pass") and not ERRORS else 1

if __name__ == "__main__":
    sys.exit(main())
