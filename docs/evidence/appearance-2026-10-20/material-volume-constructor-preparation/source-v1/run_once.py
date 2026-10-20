"""Inert proposed one-shot supervisor. No admission file is created by this source."""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
import traceback

HERE = Path(__file__).resolve().parent
BLENDER = Path('/Applications/Blender.app/Contents/MacOS/Blender')
BLENDER_SHA = 'f5c1f2a0c0bca3389ec772d355242b700975ea84e66cbb3f5257a7bce8e5adeb'
PYTHON = Path('/opt/homebrew/Cellar/python@3.14/3.14.7/Frameworks/Python.framework/Versions/3.14/bin/python3.14')
PYTHON_SHA = '87d4df53fd91304be5bac391fb204643c36b7df2023c04a0953bcbc7d4fdf634'
OUTPUT = HERE / 'trial-001'
LIMITS = dict(worker_wall_seconds=900, total_wall_seconds=1200,
              sampled_rss_bytes=4*1024**3, sampled_output_bytes=2*1024**3,
              poll_seconds=0.25, term_grace_seconds=3, kill_grace_seconds=3)
REQUESTED_STOP = None
TOTAL_DEADLINE = None


def utc():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def write_atomic(path, value):
    temp = path.with_suffix('.tmp')
    with temp.open('w') as out:
        json.dump(value, out, indent=2, allow_nan=False)
        out.write('\n')
        out.flush()
        os.fsync(out.fileno())
    os.replace(temp, path)


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as inp:
        while True:
            if TOTAL_DEADLINE is not None and time.monotonic() > TOTAL_DEADLINE:
                raise RuntimeError('total deadline while hashing; collection incomplete')
            chunk = inp.read(1024*1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def inventory():
    # Read-only metadata observer, not a geometry/API probe. Each call bounded.
    result = subprocess.run(['/bin/ps', '-axo', 'pid=,ppid=,pgid=,lstart=,rss=,comm='],
                            capture_output=True, text=True, timeout=2, check=True)
    rows = {}
    for line in result.stdout.splitlines():
        fields = line.strip().split(None, 9)
        if len(fields) != 10:
            raise RuntimeError('unparseable process inventory')
        pid, ppid, pgid = map(int, fields[:3])
        rows[pid] = dict(pid=pid, ppid=ppid, pgid=pgid,
                         birth=' '.join(fields[3:8]), rss_bytes=int(fields[8])*1024,
                         command=fields[9])
    return rows


def same(current, recorded):
    return (current is not None and current['pid'] == recorded['pid'] and
            current['birth'] == recorded['birth'] and current['pgid'] == recorded['pgid'] and
            current['command'] == recorded['command'])


def file_inventory():
    result = []
    total = 0
    for p in sorted(OUTPUT.rglob('*')):
        if p.is_symlink():
            raise RuntimeError('unexpected output symlink')
        if p.is_file():
            n = p.stat().st_size
            result.append(dict(name=str(p.relative_to(OUTPUT)), bytes=n))
            total += n
    return result, total


def admitted():
    if Path(sys.executable).resolve() != PYTHON or digest(PYTHON) != PYTHON_SHA:
        raise RuntimeError('supervisor interpreter pin')
    if not BLENDER.is_file() or digest(BLENDER) != BLENDER_SHA:
        raise RuntimeError('Blender executable pin')
    p = HERE / 'ADMISSION.json'
    a = json.loads(p.read_text())
    if a.get('decision') != 'ONE_FIXED_TECHNICAL_TRIAL_A' or a.get('pending_edits') is not False:
        raise RuntimeError('missing complete source/root admission')
    if a.get('image_scope') != 'NO_IMAGES_TECHNICAL_ONLY' or a.get('limits') != LIMITS:
        raise RuntimeError('admission scope or workload mismatch')
    start = dt.datetime.fromisoformat(a['not_before_utc'])
    end = dt.datetime.fromisoformat(a['expires_utc'])
    now = dt.datetime.now(dt.timezone.utc)
    if start.utcoffset() != dt.timedelta(0) or end.utcoffset() != dt.timedelta(0):
        raise RuntimeError('admission timestamps must be UTC-aware')
    if not (start <= now <= end and dt.timedelta(0) < end-start <= dt.timedelta(minutes=10)):
        raise RuntimeError('admission window expired or not yet valid')
    pins = a['pins']
    names = [Path(x['path']).resolve() for x in pins]
    required_local = {HERE / name for name in ('constructor.py', 'run_once.py',
                      'IMPLEMENTATION.md', 'PREPARATION-PLAN.md', 'SOURCE-FILE-PINS.json',
                      'ARCHIVE-OWNERS.json', 'FOUR-MEMBER-PREFLIGHT.json', 'RUNTIME-PREFLIGHT.json')}
    normative = HERE.parents[1] / 'appearance-2026-10-10/ari-volume-owner-revision'
    # HERE.parents[1] is evidence/; exact normative path is stated rather than searched.
    required_normative = {normative / name for name in ('CONTRACT.json', 'BINDINGS.json',
        'INPUTS.json', 'PLAN.md', 'README.md', 'REVIEW.md', 'ROOT-SEMANTIC-DIFF.json',
        'ROOT-WORTH.json', 'WORTH.md')}
    source_pins = json.loads((HERE / 'SOURCE-FILE-PINS.json').read_text())['files']
    required = required_local | required_normative | {Path(x['path']) for x in source_pins}
    if len(names) != len(set(names)) or not required <= set(names):
        raise RuntimeError('incomplete or duplicate source/runtime/contract pins')
    reviews = a.get('reviews', [])
    if {r.get('role') for r in reviews} != {'independent_source_workload', 'root_verification'}:
        raise RuntimeError('two explicit complete source gates required')
    for review in reviews:
        if review.get('decision') != 'A' or review.get('pending_edits') is not False:
            raise RuntimeError('source review is not complete A')
        rp = Path(review['path']).resolve()
        if rp not in names:
            raise RuntimeError('unbound source review')
    for entry in pins:
        p = Path(entry['path']).resolve()
        if not p.is_file() or p.stat().st_size != entry['bytes'] or digest(p) != entry['sha256']:
            raise RuntimeError('admission input/source pin mismatch: '+str(p))
    return a


def stop_signal(number, frame):
    global REQUESTED_STOP
    REQUESTED_STOP = 'supervisor signal '+str(number)


def main():
    global TOTAL_DEADLINE
    begun = time.monotonic()
    TOTAL_DEADLINE = begun + LIMITS['total_wall_seconds']
    admission = admitted()  # No output/fuse/worker before full gate and fresh pins.
    OUTPUT.mkdir(exist_ok=False)  # Sole exclusive fuse, never deleted or retried.
    for sig in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT):
        signal.signal(sig, stop_signal)
    state = dict(status='STARTING', utc=utc(), supervisor_pid=os.getpid(),
                 supervisor_pgid=os.getpgid(0), limits=LIMITS,
                 admission_sha256=digest(HERE / 'ADMISSION.json'),
                 warning='Sampled RSS/output limits may overshoot; parent death is not cleanup proof')
    worker = None
    members = {}
    reaped = False
    peak_rss = peak_output = 0
    exit_code = 2
    try:
        write_atomic(OUTPUT / 'owner.json', state)
        command = [str(BLENDER), '--background', '--factory-startup', '--disable-autoexec',
                   '--python-exit-code', '2', '--python', str(HERE / 'constructor.py'),
                   '--', str(OUTPUT)]
        state['command'] = command
        with (OUTPUT / 'stdout.log').open('xb') as stdout, (OUTPUT / 'stderr.log').open('xb') as stderr:
            if REQUESTED_STOP:
                raise RuntimeError(REQUESTED_STOP)
            worker = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=stdout,
                                      stderr=stderr, start_new_session=True,
                                      env={**os.environ, 'PYTHONNOUSERSITE': '1',
                                           'OMP_NUM_THREADS': '1', 'OPENBLAS_NUM_THREADS': '1'})
            started = time.monotonic()
            state.update(status='RUNNING', worker_pid=worker.pid, expected_pgid=worker.pid,
                         worker_started_utc=utc(), worker_returncode=None)
            write_atomic(OUTPUT / 'owner.json', state)
            leader = None
            while True:
                rows = inventory()
                live_leader = rows.get(worker.pid)
                if leader is None and live_leader is not None:
                    if live_leader['pgid'] != worker.pid or os.getsid(worker.pid) != worker.pid:
                        raise RuntimeError('new worker session/group identity failed')
                    leader = live_leader
                    state['leader_identity'] = leader
                if leader is not None and live_leader is not None and not same(live_leader, leader):
                    raise RuntimeError('leader PID identity changed')
                # New group members are owned only while the exact leader is confirmed.
                if leader is not None and same(live_leader, leader):
                    for pid, row in rows.items():
                        if row['pgid'] == worker.pid:
                            if os.getsid(pid) != worker.pid:
                                raise RuntimeError('group member session mismatch')
                            if pid in members and not same(row, members[pid]):
                                raise RuntimeError('owned PID reused')
                            members[pid] = row
                owned = [row for pid, row in rows.items() if pid in members and same(row, members[pid])]
                rss = sum(row['rss_bytes'] for row in owned)
                files, nbytes = file_inventory()
                peak_rss, peak_output = max(peak_rss, rss), max(peak_output, nbytes)
                state.update(sampled_utc=utc(), elapsed=time.monotonic()-begun,
                             peak_owned_rss_bytes=peak_rss, peak_output_bytes=peak_output,
                             members=list(members.values()), output_files=files)
                write_atomic(OUTPUT / 'owner.json', state)
                if REQUESTED_STOP:
                    raise RuntimeError(REQUESTED_STOP)
                if time.monotonic()-begun > LIMITS['total_wall_seconds']:
                    raise RuntimeError('total wall limit')
                if time.monotonic()-started > LIMITS['worker_wall_seconds']:
                    raise RuntimeError('worker wall limit')
                if rss > LIMITS['sampled_rss_bytes'] or nbytes > LIMITS['sampled_output_bytes']:
                    raise RuntimeError('sampled resource limit')
                if worker.poll() is not None:
                    break
                time.sleep(LIMITS['poll_seconds'])
            returncode = worker.wait(timeout=1)
            reaped = True
            state['worker_returncode'] = returncode
            remaining = [r for r in inventory().values() if r['pgid'] == worker.pid]
            if remaining:
                raise RuntimeError('remaining group members after leader exit')
            state['remaining_group_members'] = []
            result_path = OUTPUT / 'worker-result.json'
            if not result_path.is_file():
                raise RuntimeError('worker result missing')
            result = json.loads(result_path.read_text())
            state['worker_result'] = result
            if returncode != 0 or result.get('status') != 'NUMERICAL_REPRESENTATION_ELIGIBLE':
                raise RuntimeError('worker refused/unknown/error; no full representation result')
            state['status'] = 'COLLECTED_NUMERICAL_ONLY'
            exit_code = 0
    except BaseException as exc:
        state.update(status='FAILED_OR_REFUSED', reason=type(exc).__name__+': '+str(exc))
        traceback.print_exc()
    finally:
        cleanup = []
        if worker is not None:
            # Never signal solely by PGID. Confirm each recorded PID's birth/command/group.
            for sig, grace in ((signal.SIGTERM, LIMITS['term_grace_seconds']),
                               (signal.SIGKILL, LIMITS['kill_grace_seconds'])):
                try:
                    # Popen's unreaped direct child cannot have its PID reused while
                    # poll() still reports it alive. This covers an initial observer
                    # failure before any birth tuple was acquired. No group signal.
                    if worker.poll() is None:
                        worker.send_signal(sig)
                        cleanup.append(dict(pid=worker.pid, signal=int(sig),
                                            identity='unreaped live direct Popen child'))
                    rows = inventory()
                    for pid, recorded in members.items():
                        current = rows.get(pid)
                        if same(current, recorded):
                            os.kill(pid, sig)
                            cleanup.append(dict(pid=pid, signal=int(sig), identity=recorded))
                        elif current is not None:
                            cleanup.append(dict(pid=pid, refused_signal='identity mismatch'))
                    if worker.poll() is None:
                        try:
                            worker.wait(timeout=grace)
                            reaped = True
                        except subprocess.TimeoutExpired:
                            pass
                except BaseException as exc:
                    cleanup.append(dict(cleanup_error=type(exc).__name__+': '+str(exc)))
            try:
                if worker.poll() is not None:
                    state['worker_returncode'] = worker.wait(timeout=1)
                    reaped = True
                rows = inventory()
                remaining = [r for r in rows.values() if r['pgid'] == worker.pid]
                state['remaining_group_members'] = remaining
                if remaining or not reaped:
                    state['status'] = 'COLLECTION_FAILURE'
                    exit_code = 2
            except BaseException as exc:
                state['status'] = 'COLLECTION_FAILURE'
                state['collection_error'] = type(exc).__name__+': '+str(exc)
                exit_code = 2
        state.update(completed_utc=utc(), elapsed=time.monotonic()-begun, reaped=reaped,
                     cleanup=cleanup, peak_owned_rss_bytes=peak_rss,
                     peak_output_bytes=peak_output, appearance='UNKNOWN', physical='UNKNOWN')
        try:
            files, total = file_inventory()
            state['final_outputs'] = [{**entry, 'sha256': digest(OUTPUT / entry['name'])}
                                      for entry in files if entry['name'] not in ('owner.json', 'collection.json')]
            state['final_output_bytes_before_collection'] = total
            write_atomic(OUTPUT / 'collection.json', state)
            write_atomic(OUTPUT / 'owner.json', state)
        except BaseException:
            traceback.print_exc()
            exit_code = 2
    return exit_code


if __name__ == '__main__':
    sys.exit(main())
