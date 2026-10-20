"""One admitted Node selftest, with bounded owned-child collection. No browser/GPU."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
LEAF = ROOT / 'docs/evidence/appearance-2026-10-19/saved-look-import-candidate'
NODE = Path('/Users/robault/.brv-cli/bin/node')
MAX_OUTPUT = 1024 * 1024


def utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def retirement_unknown(report):
    return (report['childPID'] is not None and not report['childCollected']) or any(not m.get('collected', False) for m in report['monitors'])


def stop_owned(child, errors):
    """A wait result, rather than signal success, establishes collection."""
    if child.poll() is not None:
        return True
    for action in ('terminate', 'kill'):
        try:
            getattr(child, action)()
        except ProcessLookupError:
            pass  # The bounded wait still has to collect this exact child.
        except OSError as error:
            errors.append(f'{action}: {error}')
        try:
            child.wait(timeout=2)
            return True
        except subprocess.TimeoutExpired:
            pass
    return False


def rss_sample(pid, monitors, errors):
    monitor = subprocess.Popen(['/bin/ps', '-o', 'rss=', '-p', str(pid)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    record = {'pid': monitor.pid, 'targetPID': pid, 'start': utc()}
    monitors.append(record)
    try:
        output, error = monitor.communicate(timeout=.25)
        record.update(exit=monitor.returncode, collected=True)
        if monitor.returncode == 0 and output.strip().isdigit():
            return int(output.strip()) * 1024  # ps rss is KiB on this Mac.
        if monitor.returncode == 1 and not output.strip() and not error.strip():
            return None  # Target may have exited; caller positively polls it.
        raise RuntimeError(f'RSS monitor failed: {monitor.returncode}, {error[:200]!r}')
    except BaseException:
        record['collected'] = stop_owned(monitor, errors)
        if not record['collected']:
            errors.append(f'RSS monitor retirement unknown PID {monitor.pid}')
        raise
    finally:
        record['end'] = utc()
        monitor.stdout.close()
        monitor.stderr.close()


def main():
    if len(sys.argv) != 2 or Path(sys.argv[1]).resolve() != LEAF / 'cpu-run':
        raise RuntimeError('Use only the declared fresh cpu-run output directory.')
    manifest_path = LEAF / 'SOURCE-INPUTS.json'
    manifest_bytes = manifest_path.read_bytes()
    manifest = json.loads(manifest_bytes)
    for item in manifest['pins']:
        data = (ROOT / item['path']).read_bytes()
        if len(data) != item['bytes'] or hashlib.sha256(data).hexdigest() != item['sha256']:
            raise RuntimeError(f'Source changed: {item["path"]}')
    admission = json.loads((LEAF / 'CPU-ADMISSION.json').read_bytes())
    deadline = datetime.datetime.fromisoformat(admission['dispatchBeforeUTC'])
    if admission['allowRun'] is not True or admission['manifestSHA256'] != hashlib.sha256(manifest_bytes).hexdigest() or datetime.datetime.now(datetime.timezone.utc) >= deadline:
        raise RuntimeError('No current exact-source CPU admission.')
    output = LEAF / 'cpu-run'
    output.mkdir(exist_ok=False)
    with (LEAF / 'CPU-ADMISSION.used').open('x') as consumed:
        consumed.write(utc() + '\n')
    report = {'start': utc(), 'supervisorPID': os.getpid(), 'decision': 'UNKNOWN', 'childPID': None,
              'childCollected': False, 'v8OldSpaceLimitMiB': 128, 'hardTotalHeapOrRSSLimit': None,
              'sampledRSSRefusalBytes': 512 * 1024 * 1024, 'rssSamples': [], 'monitors': [], 'errors': [],
              'childWallLimitSeconds': 10, 'stopWaitSecondsPerSignal': 2, 'perStreamRefusalBytes': MAX_OUTPUT}
    child = None
    stdout, stderr = output / 'stdout.log', output / 'stderr.log'
    try:
        argv = [str(NODE), '--max-old-space-size=128', str(ROOT / 'packages/testbed/src/showcase-look-import.selftest.mjs')]
        report['argv'] = argv
        with stdout.open('xb') as out, stderr.open('xb') as err:
            began = time.monotonic()
            child = subprocess.Popen(argv, cwd=ROOT, stdout=out, stderr=err)
            report['childPID'] = child.pid
            (output / 'runtime-start.json').write_text(json.dumps(report, indent=2) + '\n')
            while child.poll() is None:
                if time.monotonic() - began >= 10:
                    raise RuntimeError('Child wall deadline exceeded.')
                if stdout.stat().st_size > MAX_OUTPUT or stderr.stat().st_size > MAX_OUTPUT:
                    raise RuntimeError('Output stream exceeded refusal threshold.')
                rss = rss_sample(child.pid, report['monitors'], report['errors'])
                if rss is not None:
                    report['rssSamples'].append({'utc': utc(), 'bytes': rss})
                    if rss > report['sampledRSSRefusalBytes']:
                        raise RuntimeError('Sampled RSS exceeded refusal threshold.')
                # A bounded wait also positively collects an early normal exit.
                try:
                    child.wait(timeout=.05)
                except subprocess.TimeoutExpired:
                    pass
            report['childCollected'] = True
            report['childExit'] = child.returncode
            report['observedChildWindowSeconds'] = time.monotonic() - began
        if report['observedChildWindowSeconds'] >= 10:
            raise RuntimeError('Observed child window exceeded the deadline before collection.')
        if child.returncode != 0:
            raise RuntimeError(f'Node selftest exited {child.returncode}.')
        if stdout.stat().st_size > MAX_OUTPUT or stderr.stat().st_size > MAX_OUTPUT:
            raise RuntimeError('Completed output exceeded refusal threshold.')
        rows = [json.loads(line) for line in stdout.read_text().splitlines()]
        summary = rows[-1]
        cases = rows[:-1]
        if not 1 <= summary['passed'] <= 40 or len(cases) != summary['passed'] or any(r['case'] != i or r['passed'] is not True for i, r in enumerate(cases, 1)):
            raise RuntimeError('Selftest count or assertions receipt is incomplete.')
        report['assertions'] = summary
        report['decision'] = 'A_CPU_ONLY'
    except BaseException as error:
        report['errors'].append(f'{type(error).__name__}: {error}')
        if child is not None:
            report['childCollected'] = stop_owned(child, report['errors'])
            report['childExit'] = child.returncode
        report['decision'] = 'UNKNOWN_RETIREMENT' if retirement_unknown(report) else 'B'
    finally:
        report['end'] = utc()
        report['streamBytes'] = {}
        for stream in (stdout, stderr):
            try:
                if stream.exists():
                    report['streamBytes'][stream.name] = stream.stat().st_size
            except OSError as error:
                report['errors'].append(f'Output metadata failed: {error}')
                report['decision'] = 'UNKNOWN_RETIREMENT' if retirement_unknown(report) else 'B'
        report['limits'] = 'Old-space only; RSS/output sampling may miss bursts. No hard process peak, browser, GPU or appearance guarantee.'
        try:
            (output / 'RUN.json').write_text(json.dumps(report, indent=2) + '\n')
        except OSError as error:
            report['errors'].append(f'RUN receipt write failed: {error}')
            report['decision'] = 'UNKNOWN_RETIREMENT' if retirement_unknown(report) else 'B'
        print(json.dumps(report))
    return 0 if report['decision'] == 'A_CPU_ONLY' else 1


if __name__ == '__main__':
    sys.exit(main())
