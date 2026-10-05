"""Inert preparation: one admitted original CPU attempt, never a retry tool.

No target module is imported. ADMISSION.json must be written only after full
independent/root source review. Sampled RSS is not an instantaneous hard limit.
Native process creation and filesystem calls may outlast a cooperative deadline;
an overdue result cannot pass. The root retains external job ownership too.
"""
from pathlib import Path
import hashlib
import json
import os
import selectors
import signal
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
SUITE = HERE.parent / 'standalone-facial-reader'
OUT = SUITE / 'output'
JOB = HERE / 'job'
PYTHON = Path('/opt/homebrew/opt/python@3.14/bin/python3.14')
NODE = Path('/opt/homebrew/Cellar/node/26.9.0/bin/node')
PS = Path('/bin/ps')
COMPUTE = 120.
CLEANUP = 5.
POLL = .1
PS_TIMEOUT = .5
RSS_KIB = 1024 * 1024
LOG_EACH = 1024 * 1024
LOG_TOTAL = 4 * 1024 * 1024
JSON_CAP = 64 * 1024 * 1024
OUTPUT_CAP = 256 * 1024 * 1024
ENV = {'PATH': '/opt/homebrew/bin:/usr/bin:/bin', 'LANG': 'en_US.UTF-8',
       'LC_ALL': 'en_US.UTF-8', 'TZ': 'UTC'}
EXPECTED = {'source.glb', 'source.json', 'accessors.json', 'ownership.json',
            'world.json', 'manifest.json', 'oracle.json', 'check.json'}
STOP = None


def require(value, witness):
    if not value:
        raise ValueError(witness)


def interrupted(signum, _frame):
    global STOP
    STOP = signum


def digest(path, deadline=None):
    h = hashlib.sha256(); length = 0
    with path.open('rb') as f:
        while block := f.read(1024*1024):
            if deadline is not None:
                require(time.monotonic() < deadline and STOP is None, 'deadline/signal during byte guard')
            h.update(block); length += len(block)
    return {'path': str(path.resolve()), 'bytes': length, 'sha256': h.hexdigest()}


def verify(pin, deadline=None):
    path = Path(pin['path'])
    got = digest(path, deadline)
    require(got['bytes'] == pin['bytes'] and got['sha256'] == pin['sha256'], 'byte pin '+str(path))
    return got


def load(path):
    require(path.stat().st_size <= 1024*1024 and not path.is_symlink(), 'metadata size/path '+str(path))
    return json.loads(path.read_text(), parse_constant=lambda v: (_ for _ in ()).throw(ValueError('nonfinite '+v)))


def save(path, record):
    body = (json.dumps(record, allow_nan=False, separators=(',', ':'))+'\n').encode()
    require(len(body) <= LOG_EACH, 'parent receipt size')
    tmp = path.with_suffix(path.suffix+'.tmp')
    with tmp.open('wb') as f:
        f.write(body); f.flush(); os.fsync(f.fileno())
    os.replace(tmp, path)


def process_table():
    # Helper is a known ps invocation, not a target child. run(timeout) owns its
    # kill-and-wait handling. No command arguments or unrelated process text kept.
    began = time.monotonic()
    result = subprocess.run([str(PS), '-A', '-o', 'pid=,ppid=,pgid=,rss=,stat='],
                            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, timeout=PS_TIMEOUT, env=ENV,
                            check=False)
    require(result.returncode == 0 and not result.stderr and len(result.stdout) <= LOG_EACH, 'ps observation failed/overflow')
    rows = {}
    for line in result.stdout.decode('ascii').splitlines():
        parts = line.split(); require(len(parts) == 5, 'ps field shape')
        pid, ppid, pgid, rss = map(int, parts[:4])
        require(pid > 0 and ppid >= 0 and pgid >= 0 and rss >= 0 and pid not in rows, 'ps numeric identity')
        rows[pid] = {'pid': pid, 'ppid': ppid, 'pgid': pgid, 'rssKiB': rss, 'state': parts[4]}
    require(os.getpid() in rows, 'parent observation missing')
    return rows, time.monotonic()-began


def family_rows(rows, groups):
    ids = {os.getpid()} | {pid for pid, row in rows.items() if row['pgid'] in groups}
    while True:
        extra = {pid for pid, row in rows.items() if row['ppid'] in ids}
        if extra <= ids: break
        ids |= extra
    require(len(ids) <= 64, 'unsupported owned family size')
    return [rows[pid] for pid in sorted(ids) if pid in rows]


def output_inventory():
    if not OUT.exists(): return []
    require(not OUT.is_symlink() and OUT.is_dir(), 'output directory identity')
    result = []; total = 0
    for path in sorted(OUT.iterdir()):
        require(path.name in EXPECTED and path.is_file() and not path.is_symlink(), 'unexpected/unsafe output '+path.name)
        size = path.stat().st_size; total += size
        require(not path.name.endswith('.json') or size <= JSON_CAP, 'output JSON cap')
        require(total <= OUTPUT_CAP, 'aggregate output cap')
        result.append({'name': path.name, 'bytes': size})
    return result


def drain(proc, selector, logs, counts, timeout):
    for key, _ in selector.select(timeout):
        name = key.data
        block = os.read(key.fd, 8192)
        if not block:
            selector.unregister(key.fileobj); key.fileobj.close(); continue
        persistent_logs = sum(p.stat().st_size for p in JOB.iterdir() if p.suffix in ('.stdout','.stderr'))
        # Reserve one maximum parent receipt and lock/metadata overhead.
        room = max(0, min(LOG_EACH-counts[name], LOG_TOTAL-LOG_EACH-1024-persistent_logs))
        if room > 0:
            logs[name].write(block[:room]); logs[name].flush(); counts[name] += min(room, len(block))
        require(len(block) <= room, 'child log cap '+name)
        require(name != 'stderr', 'any child stderr/warning refuses')


def collect(proc, selector, logs, counts, failed):
    """Retain the unreaped direct child while signaling its own session group.

    No Popen.poll is used before this function: its PID cannot be reused before
    wait. After reaping, group observation can refuse but never signals a group.
    The selected reviewed suite creates no child processes; unexpected members
    refuse and are collected while the leader identity remains reserved.
    """
    began = time.monotonic(); limit = began+CLEANUP; signals = []; errors = []
    if failed:
        for sig in (signal.SIGTERM, signal.SIGKILL):
            action = {'signal': int(sig)}; signals.append(action)
            try:
                os.killpg(proc.pid, sig); action['result'] = 'sent'
            except ProcessLookupError:
                action['result'] = 'already absent'
            except BaseException as error:
                action['result'] = 'error'
                action['error'] = type(error).__name__+': '+str(error)
                errors.append({'operation': 'signal', **action})
            if sig == signal.SIGTERM:
                try: time.sleep(min(.2, max(0., limit-time.monotonic())))
                except BaseException as error:
                    errors.append({'operation': 'grace', 'error': type(error).__name__+': '+str(error)})
    drained_error = None
    while selector.get_map() and time.monotonic() < limit:
        try: drain(proc, selector, logs, counts, min(.05, max(0., limit-time.monotonic())))
        except Exception as error:
            # Failures remain failures; bounded logging continues through EOF.
            drained_error = type(error).__name__+': '+str(error)
            if len(errors) < 32: errors.append({'operation': 'drain', 'error': drained_error})
    remaining = max(0., limit-time.monotonic())
    reaped = False; exit_code = None; remnants = None; latency = None
    try:
        exit_code = proc.wait(timeout=remaining); reaped = True
    except BaseException as error:
        errors.append({'operation': 'wait', 'error': type(error).__name__+': '+str(error)})
    try:
        rows, latency = process_table()
        remnants = [row for row in rows.values() if row['pgid'] == proc.pid]
    except BaseException as error:
        errors.append({'operation': 'group observation', 'error': type(error).__name__+': '+str(error)})
    ended = time.monotonic()
    return {'collected': reaped and remnants == [] and not selector.get_map() and ended <= limit, 'signals': signals,
            'exit': exit_code, 'remainingGroup': remnants, 'observationSeconds': latency,
            'directChildReaped': reaped, 'pipesClosed': not selector.get_map(), 'logError': drained_error,
            'cleanupSeconds': ended-began, 'cleanupErrors': errors}


def run_stage(name, argv, deadline, record, pins):
    for pin in pins: verify(pin, deadline)
    require(time.monotonic() < deadline and STOP is None, 'deadline/signal before '+name)
    logs = {n: (JOB/(name+'.'+n)).open('xb') for n in ('stdout', 'stderr')}
    counts = {'stdout': 0, 'stderr': 0}; selector = selectors.DefaultSelector()
    proc = None; failure = None; stage = {'name': name, 'argv': argv, 'startedMonotonic': time.monotonic()}
    record['stages'].append(stage)
    save(JOB/'receipt.json', record)
    try:
        proc = subprocess.Popen(argv, cwd=str(ROOT), env=ENV, stdin=subprocess.DEVNULL,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                start_new_session=True, close_fds=True)
        stage['pid'] = proc.pid; stage['pgid'] = proc.pid
        # setsid is performed before exec/Popen success by the installed path.
        require(proc.pid != os.getpid() and proc.pid != os.getpgrp(), 'owned group identity')
        save(JOB/'receipt.json', record)
        for n in ('stdout', 'stderr'):
            stream = getattr(proc, n); os.set_blocking(stream.fileno(), False)
            selector.register(stream, selectors.EVENT_READ, n)
        previous = time.monotonic()
        while True:
            require(STOP is None and time.monotonic() < deadline, 'combined deadline/signal')
            rows, latency = process_table(); now = time.monotonic()
            family = family_rows(rows, {proc.pid}); rss = sum(row['rssKiB'] for row in family)
            group = [row for row in rows.values() if row['pgid'] == proc.pid]
            gap = now-previous; previous = now
            record['maxObservedRssKiB'] = max(record['maxObservedRssKiB'], rss)
            record['maxObservationGapSeconds'] = max(record['maxObservationGapSeconds'], gap)
            record['samples'].append({'elapsed': now-record['startedMonotonic'], 'stage': name, 'rssKiB': rss, 'rows': family})
            require(latency <= PS_TIMEOUT and gap <= POLL+PS_TIMEOUT, 'resident observation gap/latency')
            require(rss <= RSS_KIB, 'observed whole-owned-family RSS cap')
            stage['unexpectedGroupMembers'] = [row for row in group if row['pid'] != proc.pid]
            stage['escapedDescendants'] = [row for row in family if row['ppid'] == proc.pid and row['pgid'] != proc.pid]
            require(not stage['unexpectedGroupMembers'], 'unsupported target child process')
            require(not stage['escapedDescendants'], 'unsupported target descendant/session escape')
            target = rows.get(proc.pid)
            if target is not None: require(target['pgid'] == proc.pid, 'target session group drift')
            output_inventory()
            drain(proc, selector, logs, counts, min(POLL, max(0., deadline-time.monotonic())))
            if not selector.get_map() and (target is None or target['state'].startswith('Z')):
                break
    except BaseException as error:
        failure = type(error).__name__+': '+str(error)
    finally:
        if proc is not None:
            try: stage['collection'] = collect(proc, selector, logs, counts, failure is not None)
            except BaseException as error:
                stage['collection'] = {'collected': False, 'reason': type(error).__name__+': '+str(error)}
            if stage.get('escapedDescendants'):
                stage['collection']['collected'] = False
                stage['collection']['unsupportedEscape'] = stage['escapedDescendants']
                stage['collection']['reason'] = 'unsupported escaped descendants require root identity/collection; no post-reap blind signaling'
        else:
            stage['collection'] = {'collected': True, 'exit': None, 'reason': 'no target Popen returned'}
        selector.close()
        for f in logs.values(): f.close()
        stage['logBytes'] = counts; stage['endedMonotonic'] = time.monotonic(); stage['failure'] = failure
        save(JOB/'receipt.json', record)
    require(failure is None and stage['collection']['collected'] and stage['collection']['exit'] == 0 and not stage['collection'].get('logError'), 'stage failed '+name+' '+str(stage))
    require(not counts['stderr'], 'stderr refuses '+name)
    require(time.monotonic() < deadline and STOP is None, 'overdue completed '+name)
    for pin in pins: verify(pin, deadline)


def main():
    began = time.monotonic(); deadline = began+COMPUTE
    require(len(sys.argv) == 1 and sys.platform == 'darwin', 'fixed no-argument macOS owner')
    require(Path.cwd().resolve() == ROOT, 'fixed parent working directory')
    admission = load(HERE/'ADMISSION.json')
    require(admission.get('schema') == 'standalone-supervisor-root-admission-v1' and admission.get('allow_first_cpu_attempt') is True, 'explicit reviewed root admission required')
    require(Path(admission['supervisor']['path']).resolve() == Path(__file__).resolve(), 'admitted supervisor identity')
    verify(admission['supervisor'], deadline); verify(admission['inputs_manifest'], deadline)
    require(Path(admission['inputs_manifest']['path']).resolve() == HERE/'INPUTS.json', 'fixed inputs manifest')
    for name in ('critic_result', 'critic_receipt', 'root_readback'): verify(admission[name], deadline)
    inputs = load(HERE/'INPUTS.json'); require(inputs['scope'] == 'fixed-original-serial-cpu-before-data-v1', 'fixed input scope')
    pins = inputs['files']; require(isinstance(pins, list) and pins, 'source/runtime/dependency pins')
    require(all(Path(p['path']).is_absolute() for p in pins), 'absolute input paths')
    by_path = {str(Path(p['path']).resolve()): p for p in pins}
    require(len(by_path) == len(pins), 'one exact pin per resolved input')
    required = {str((SUITE/n).resolve()) for n in ('reader.py','cpu-oracle.mjs','check-packet.py','DEPENDENCY-PINS.json')}
    required |= {str(p.resolve()) for p in (ROOT/'assets/figures/figure_g100.glb', PYTHON, NODE, PS)}
    require(required <= set(by_path), 'all mandatory original/program/runtime guards')
    verify(by_path[str((SUITE/'DEPENDENCY-PINS.json').resolve())], deadline)
    dependencies = load(SUITE/'DEPENDENCY-PINS.json')['records']
    for pin in dependencies:
        path = Path(pin['path']); resolved = (path if path.is_absolute() else ROOT/path).resolve()
        got = by_path.get(str(resolved))
        require(got is not None and got['bytes'] == pin['bytes'] and got['sha256'] == pin['sha256'], 'complete dependency byte guard '+str(resolved))
    require(not JOB.exists() and not OUT.exists() and not OUT.is_symlink(), 'one empty job/output attempt only')
    JOB.mkdir()  # exclusive; never removed/reused, even on a refusal
    with (JOB/'attempt.lock').open('xb') as f: f.write(b'one original CPU attempt; no retries\n')
    for sig in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP): signal.signal(sig, interrupted)
    record = {'schema': 'collected-original-cpu-attempt-v1', 'parentPid': os.getpid(), 'startedMonotonic': began,
              'deadlineMonotonic': deadline, 'admission': digest(HERE/'ADMISSION.json'),
              'status': 'running', 'stages': [], 'samples': [], 'maxObservedRssKiB': 0,
              'maxObservationGapSeconds': 0., 'fixedCriteria': {'seconds': COMPUTE, 'sampledRssKiB': RSS_KIB,
              'nodeOldSpaceMiB': 512, 'matrixPosition': 1e-9, 'perJsonBytes': JSON_CAP, 'outputBytes': OUTPUT_CAP},
              'limits': 'sampled/cooperative controls; no instantaneous hard RSS/OS syscall duration guarantee, image decode/GPU/appearance or source adoption'}
    save(JOB/'receipt.json', record)
    try:
        rows, latency = process_table(); require(latency <= PS_TIMEOUT, 'initial observation')
        initial = family_rows(rows,set()); initial_rss = sum(r['rssKiB'] for r in initial)
        require(initial_rss <= RSS_KIB, 'initial parent family RSS')
        record['maxObservedRssKiB'] = initial_rss
        record['samples'].append({'elapsed': time.monotonic()-began, 'stage': 'initial', 'rssKiB': initial_rss, 'rows': initial})
        commands = [('reader', [str(PYTHON), '-I', '-S', '-B', str(SUITE/'reader.py'), str(OUT)]),
                    ('oracle', [str(NODE), '--max-old-space-size=512', str(SUITE/'cpu-oracle.mjs'), str(OUT)]),
                    ('checker', [str(PYTHON), '-I', '-S', '-B', str(SUITE/'check-packet.py'), str(OUT)])]
        for name, argv in commands: run_stage(name, argv, deadline, record, pins)
        inventory = output_inventory(); require({r['name'] for r in inventory} == EXPECTED, 'complete fixed output set')
        record['outputPins'] = [digest(OUT/r['name'], deadline) for r in inventory]
        require(time.monotonic() < deadline and STOP is None, 'final deadline/signal')
        record['status'] = 'complete CPU source/coverage only; no appearance verdict'
    except BaseException as error:
        record['status'] = 'refused'; record['reason'] = type(error).__name__+': '+str(error)
    finally:
        record['signal'] = STOP
        # Partial file hashes retained after collection; no parse/qualification.
        record['partialFiles'] = []
        certified_collection = all(stage.get('collection', {}).get('collected') is True for stage in record['stages'])
        record['allStagesCollected'] = certified_collection
        forensic_deadline = deadline+CLEANUP
        if OUT.exists() and OUT.is_dir() and not OUT.is_symlink():
            for path in sorted(OUT.iterdir()):
                if path.is_file() and not path.is_symlink():
                    row = {'path': str(path.resolve()), 'bytes': path.stat().st_size}
                    if certified_collection and row['bytes'] <= OUTPUT_CAP and time.monotonic() < forensic_deadline and STOP is None:
                        try: row = digest(path, forensic_deadline)
                        except Exception as error: row['hashRefused'] = str(error)
                    else:
                        row['hashRefused'] = 'uncertified collection/mutable output' if not certified_collection else 'signal/collection deadline/oversized partial'
                    record['partialFiles'].append(row)
        record['logPins'] = [digest(p) for p in sorted(JOB.iterdir()) if p.suffix in ('.stdout','.stderr')]
        log_total = sum(p.stat().st_size for p in JOB.iterdir() if p.is_file())
        if log_total > LOG_TOTAL:
            record['status'] = 'refused'; record['reason'] = 'aggregate parent job/log cap'
        record['jobBytesBeforeFinalReceipt'] = log_total
        record['endedMonotonic'] = time.monotonic(); record['elapsedSeconds'] = record['endedMonotonic']-began
        if record['status'].startswith('complete ') and (record['elapsedSeconds'] >= COMPUTE or STOP is not None):
            record['status'] = 'refused'; record['reason'] = 'overdue/signal at final receipt'
        save(JOB/'receipt.json', record)
    print(json.dumps({'status': record['status'], 'elapsedSeconds': record['elapsedSeconds'], 'receipt': str(JOB/'receipt.json')}))
    return 0 if record['status'].startswith('complete ') else 1


if __name__ == '__main__':
    sys.exit(main())
