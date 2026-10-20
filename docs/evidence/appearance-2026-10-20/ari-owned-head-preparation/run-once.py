"""First-invocation supervisor, inert until fresh independent/root admission."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import resource
import signal
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
WORKER = HERE / 'head.py'
OUT = HERE / 'output'
RSS_LIMIT = 384*1024*1024
OUTPUT_LIMIT = 16*1024*1024
MAIN_SECONDS = 45.0
TOTAL_SECONDS = 70.0


def utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def persist(value):
    temp = HERE / 'RUN.json.tmp'
    temp.write_text(json.dumps(value, indent=2, allow_nan=False)+'\n')
    temp.replace(HERE / 'RUN.json')


def worker_limits():
    resource.setrlimit(resource.RLIMIT_CPU, (40, 42))
    resource.setrlimit(resource.RLIMIT_FSIZE, (12*1024*1024, 12*1024*1024))


def main():
    start = time.monotonic()
    assert sys.platform == 'darwin', 'This preflight is for the retained Mac only'
    assert not OUT.exists() and not (HERE/'FUSE').exists()
    assert not any((HERE/name).exists() for name in ('RUN.json', 'stdout.log', 'stderr.log'))
    lock_data = (HERE/'SOURCE-LOCK.json').read_bytes()
    lock = json.loads(lock_data)
    admission = json.loads((HERE/'ROOT-SOURCE-RESULT.json').read_text())
    assert admission['admitFirstInvocation'] is True
    assert admission['sourceLockSHA256'] == hashlib.sha256(lock_data).hexdigest()
    assert datetime.datetime.now(datetime.timezone.utc) < datetime.datetime.fromisoformat(admission['latestStartUTC'])
    for pin in lock['files']:
        data = Path(pin['path']).read_bytes()
        assert len(data) == pin['bytes'] and hashlib.sha256(data).hexdigest() == pin['sha256'], pin['path']
    assert str(Path(sys.executable).resolve()) == lock['interpreter']['resolvedPath']
    executable = Path(sys.executable).resolve().read_bytes()
    assert hashlib.sha256(executable).hexdigest() == lock['interpreter']['sha256']
    assert sys.version == lock['interpreter']['version']
    with (HERE/'FUSE').open('x') as fuse:
        fuse.write(utc()+'\n')
    state = dict(wrapperPID=os.getpid(), wrapperBirthUTC=utc(),
                 command=[sys.executable, '-I', str(WORKER)],
                 sourceLockSHA256=hashlib.sha256(lock_data).hexdigest(),
                 admissionSHA256=hashlib.sha256((HERE/'ROOT-SOURCE-RESULT.json').read_bytes()).hexdigest(),
                 status='PRELAUNCH', childPID=None, childPGID=None, reaped=False,
                 sampledRSSMaxBytes=0, events=[],
                 limits=dict(mainSeconds=MAIN_SECONDS, totalSeconds=TOTAL_SECONDS,
                             sampledChildRSSBytes=RSS_LIMIT, aggregateOutputBytes=OUTPUT_LIMIT,
                             cpuSeconds=[40, 42], perFileBytes=12*1024*1024,
                             memoryLimitIsSampledNotKernelEnforced=True),
                 statusNotAFailurePathOrRepresentativePerformanceQualification=True)
    persist(state)
    child = None
    failure = None
    try:
        with (HERE/'stdout.log').open('wb') as stdout, (HERE/'stderr.log').open('wb') as stderr:
            child = subprocess.Popen(state['command'], cwd=str(HERE), stdin=subprocess.DEVNULL,
                                     stdout=stdout, stderr=stderr, start_new_session=True,
                                     preexec_fn=worker_limits)
            state.update(childPID=child.pid, childPGID=child.pid, childBirthUTC=utc(), status='RUNNING')
            persist(state)
            launched = time.monotonic()
            while child.poll() is None:
                elapsed = time.monotonic()-launched
                if elapsed > MAIN_SECONDS or time.monotonic()-start > TOTAL_SECONDS-5:
                    failure = 'TIME_LIMIT'
                    break
                # The worker has no fork/subprocess/eval/import of local code.
                # Sampling is scoped to this exact owned direct child PID.
                sample = subprocess.run(['/bin/ps', '-o', 'rss=', '-p', str(child.pid)],
                                        capture_output=True, text=True, timeout=2)
                values = sample.stdout.split()
                if sample.returncode == 0 and len(values) == 1:
                    rss = int(values[0])*1024
                    state['sampledRSSMaxBytes'] = max(state['sampledRSSMaxBytes'], rss)
                    if rss > RSS_LIMIT:
                        failure = 'SAMPLED_RSS_LIMIT'
                        break
                elif child.poll() is None:
                    failure = 'RSS_SAMPLE_UNAVAILABLE'
                    break
                total = sum(p.stat().st_size for p in OUT.iterdir() if p.is_file()) if OUT.exists() else 0
                if total > OUTPUT_LIMIT:
                    failure = 'OUTPUT_LIMIT'
                    break
                time.sleep(.10)
            if failure is not None and child.poll() is None:
                state['events'].append(dict(event=failure, utc=utc()))
                os.killpg(child.pid, signal.SIGTERM)
                try:
                    child.wait(timeout=1)
                except subprocess.TimeoutExpired:
                    state['events'].append(dict(event='SIGKILL', utc=utc()))
                    os.killpg(child.pid, signal.SIGKILL)
                    child.wait(timeout=3)
            returncode = child.wait(timeout=3)
            state.update(returncode=returncode, reaped=True, childCollectedUTC=utc())
            if returncode != 0:
                failure = failure or 'WORKER_NONZERO'
            files = []
            if OUT.exists():
                for p in sorted(OUT.iterdir()):
                    assert p.is_file() and not p.is_symlink(), 'Unexpected output member'
                    data = p.read_bytes()
                    files.append(dict(path=str(p), bytes=len(data), sha256=hashlib.sha256(data).hexdigest()))
            state['outputs'] = files
            state['outputBytes'] = sum(pin['bytes'] for pin in files)
            expected = {'head.mesh.json', 'head.landmarks.json', 'head.obj', 'first-head.png',
                        'CHECKS.json', 'OUTPUTS.json'}
            if state['outputBytes'] > OUTPUT_LIMIT:
                failure = failure or 'FINAL_OUTPUT_LIMIT'
            if {Path(pin['path']).name for pin in files} != expected:
                failure = failure or 'INCOMPLETE_OUTPUT'
            state['status'] = 'REFUSED' if failure else 'COLLECTED_UNQUALIFIED'
            state['failure'] = failure
    except BaseException as error:
        state.update(status='SUPERVISOR_ERROR', error=repr(error))
        if child is not None and child.poll() is None:
            try:
                os.killpg(child.pid, signal.SIGKILL)
                child.wait(timeout=3)
                state.update(reaped=True, returncode=child.returncode, childCollectedUTC=utc())
            except BaseException as cleanup_error:
                state['cleanupError'] = repr(cleanup_error)
        persist(state)
        raise
    finally:
        state.update(wrapperCollectionUTC=utc(), elapsedSeconds=time.monotonic()-start)
        persist(state)
    print(json.dumps(state, allow_nan=False))
    return 0 if state['status'] == 'COLLECTED_UNQUALIFIED' and state['reaped'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
