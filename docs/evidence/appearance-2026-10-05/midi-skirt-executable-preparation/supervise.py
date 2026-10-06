"""Single serial MIDI trial; inert until a separate root execution admission."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import selectors
import signal
import stat
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
TRIAL = HERE.parent / 'midi-skirt-first-cpu'
OUT = TRIAL / 'output'
RECORDS = TRIAL / 'records'
EXPORTS = {'mesh.json', 'mara-midi.obj', 'mara-midi.mtl'}
ROLES = {'design', 'contract', 'writer_addendum', 'producer', 'checker', 'supervisor', 'python'}
FILE_CAP = 10 * 1024 * 1024
STREAM_CAP = 16 * 1024
RSS_CAP = 512 * 1024  # KiB, sampled parent plus currently owned session groups.
WORK_SECONDS = 60.0
SAMPLE_SECONDS = 0.05
interrupted = []


def utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def interruption(number, frame):
    interrupted.append({'signal': number, 'utc': utc()})


def pin(path):
    assert stat.S_ISREG(path.lstat().st_mode), str(path)
    data = path.read_bytes()
    return {'path': str(path), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def verify(config):
    files = config['files']
    assert len(files) == 7 and {p['role'] for p in files} == ROLES
    assert len({p['path'] for p in files}) == 7
    assert config['output_directory'] == str(OUT)
    assert config['records_directory'] == str(RECORDS)
    assert config['python_command'] == '/opt/homebrew/opt/python@3.14/bin/python3.14'
    assert set(config) == {'files', 'output_directory', 'records_directory', 'python_command', 'scope'}
    for item in files:
        path = Path(item['path'])
        assert path.is_absolute()
        assert pin(path) == {k: item[k] for k in ['path', 'bytes', 'sha256']}, item['role']
    by_role = {p['role']: p for p in files}
    for role, name in [('producer', 'producer.py'), ('checker', 'checker.py'), ('supervisor', 'supervise.py')]:
        assert by_role[role]['path'] == str(HERE / name)
    assert Path(config['python_command']).resolve() == Path(by_role['python']['path'])
    assert Path(sys.executable).resolve() == Path(by_role['python']['path'])
    return by_role


def envelope(names):
    assert stat.S_ISDIR(OUT.lstat().st_mode) and not OUT.is_symlink()
    assert {p.name for p in OUT.iterdir()} == names
    for name in names:
        path = OUT / name
        assert stat.S_ISREG(path.lstat().st_mode) and path.lstat().st_size <= FILE_CAP, name


def output_cap():
    if OUT.is_symlink():
        raise ValueError('output symlink')
    if OUT.exists():
        assert stat.S_ISDIR(OUT.lstat().st_mode)
        for path in OUT.iterdir():
            assert path.name in EXPORTS | {'CHECK.json'} and stat.S_ISREG(path.lstat().st_mode)
            assert path.lstat().st_size <= FILE_CAP, path.name


def processes():
    observation = {'utc': utc(), 'monotonic': time.monotonic()}
    run = subprocess.run(['/bin/ps', '-axo', 'pid=,pgid=,rss='], stdin=subprocess.DEVNULL,
                         capture_output=True, timeout=1, check=True)
    rows = [tuple(map(int, line.split())) for line in run.stdout.splitlines() if line.strip()]
    observation['return_monotonic'] = time.monotonic()
    return rows, observation


def stage(role, config, deadline, records):
    command = [config['python_command'], '-I', '-S', '-B', str(HERE / (role + '.py'))]
    record = {'role': role, 'command': command, 'request_utc': utc(), 'request_monotonic': time.monotonic(),
              'signals': [], 'samples': [], 'refusals': [], 'collected': False}
    records.append(record)  # Parent retains ownership even if later receipt writing fails.
    process = None
    selector = selectors.DefaultSelector()
    streams = {name: bytearray() for name in ['stdout', 'stderr']}
    totals = {name: 0 for name in streams}
    collected = False
    next_sample = 0.0

    def drain(timeout):
        for key, event in selector.select(timeout):
            chunk = os.read(key.fileobj.fileno(), 65536)
            name = key.data
            if not chunk:
                selector.unregister(key.fileobj)
                key.fileobj.close()
            else:
                totals[name] += len(chunk)
                available = max(0, STREAM_CAP-len(streams[name]))
                streams[name].extend(chunk[:available])

    def signal_group(number):
        observation = {'signal': number, 'utc': utc(), 'unreaped_direct_child': process.returncode is None}
        try:
            if process.returncode is not None:
                observation['skipped'] = 'Direct child already reaped; no continuing group signal authority'
                record['signals'].append(observation)
                return
            # With SIGCHLD default and no other waiter, an unreaped direct child
            # retains this PID. Never poll/wait between this guard and signal.
            observation['observed_pgid'] = os.getpgid(process.pid)
            assert observation['observed_pgid'] == record['pgid'], 'owned group changed'
            os.killpg(process.pid, number)
            observation['sent'] = True
        except Exception as error:
            observation['error'] = repr(error)
        record['signals'].append(observation)

    try:
        process = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, start_new_session=True, bufsize=0)
        record.update({'pid': process.pid, 'pgid': process.pid, 'return_utc': utc(),
                       'popen_return_monotonic': time.monotonic()})
        for name, pipe in [('stdout', process.stdout), ('stderr', process.stderr)]:
            os.set_blocking(pipe.fileno(), False)
            selector.register(pipe, selectors.EVENT_READ, name)
        record['observed_pgid'] = os.getpgid(process.pid)
        assert record['observed_pgid'] == process.pid
        while True:
            if interrupted:
                raise InterruptedError('parent interrupted')
            if time.monotonic() >= deadline:
                raise TimeoutError('total work deadline')
            if any(n > STREAM_CAP for n in totals.values()):
                raise ValueError('stream cap exceeded')
            output_cap()
            if time.monotonic() >= next_sample:
                rows, sample = processes()
                group = [row for row in rows if row[1] == process.pid]
                parent = [row for row in rows if row[0] == os.getpid()]
                assert len(parent) == 1
                sample.update({'owned_rows': group, 'parent_row': parent[0],
                               'aggregate_rss_kib': sum(row[2] for row in group + parent)})
                record['samples'].append(sample)
                next_sample = sample['monotonic'] + SAMPLE_SECONDS
                assert sample['aggregate_rss_kib'] <= RSS_CAP, 'sampled RSS cap'
                if process.poll() is not None and not selector.get_map() and not group:
                    collected = True
                    break
            drain(min(SAMPLE_SECONDS, max(0, deadline-time.monotonic())))
        process.wait(timeout=0)
    except BaseException as error:
        record['refusals'].append({'type': type(error).__name__, 'detail': str(error)[:2000], 'utc': utc()})
    finally:
        cleanup_deadline = time.monotonic() + 3.0
        if process is not None and not collected:
            signal_group(signal.SIGTERM)
            term_until = min(cleanup_deadline, time.monotonic()+0.25)
            while time.monotonic() < term_until:
                try:
                    drain(0.02)
                    process.poll()
                except Exception as error:
                    record['refusals'].append({'cleanup_drain': repr(error)})
                    break
            signal_group(signal.SIGKILL)  # independent attempt, even if TERM failed.
            try:
                process.wait(timeout=max(0, cleanup_deadline-time.monotonic()))
            except Exception as error:
                record['refusals'].append({'cleanup_wait': repr(error)})
            while selector.get_map() and time.monotonic() < cleanup_deadline:
                try:
                    drain(0.02)
                except Exception as error:
                    record['refusals'].append({'cleanup_drain': repr(error)})
                    break
            try:
                rows, observation = processes()
                remaining = [row for row in rows if row[1] == process.pid]
                record['cleanup_group_readback'] = {'observation': observation, 'rows': remaining}
                collected = process.poll() is not None and not selector.get_map() and not remaining
            except Exception as error:
                record['refusals'].append({'cleanup_group_readback': repr(error)})
        record.update({'collection_utc': utc(), 'collection_monotonic': time.monotonic(),
                       'exit_code': None if process is None else process.poll(),
                       'collected': collected, 'pipes_eof': not bool(selector.get_map())})
        for key in list(selector.get_map().values()):
            selector.unregister(key.fileobj)
            key.fileobj.close()
        selector.close()
        for name, data in streams.items():
            path = RECORDS / (role+'.'+name)
            with path.open('xb') as f:
                f.write(data)
            record[name] = {**pin(path), 'observed_bytes': totals[name],
                            'discarded_after_cap': totals[name]-len(data)}
    return record


def main():
    signal.signal(signal.SIGCHLD, signal.SIG_DFL)  # Retain direct-child wait ownership.
    signal.signal(signal.SIGINT, interruption)
    signal.signal(signal.SIGTERM, interruption)
    assert stat.S_ISDIR(TRIAL.lstat().st_mode) and not TRIAL.is_symlink()
    assert not OUT.exists() and not OUT.is_symlink()
    assert not RECORDS.exists() and not RECORDS.is_symlink()
    RECORDS.mkdir()
    started = time.monotonic()
    receipt = {'actor': 'parent', 'pid': os.getpid(), 'utc': utc(), 'started_monotonic': started,
               'work_deadline_monotonic': started+WORK_SECONDS, 'stages': [], 'decision': 'B',
               'limits': {'work_seconds': WORK_SECONDS, 'cleanup_per_stage_seconds': 3,
                          'cleanup_ps_timeout_seconds': 1, 'sample_period_seconds': SAMPLE_SECONDS,
                          'aggregate_rss_kib': RSS_CAP, 'each_stream_bytes': STREAM_CAP,
                          'each_payload_bytes': FILE_CAP},
               'scope': 'Sampled cooperative control; no peak/OS containment/GPU/appearance/fit certificate'}
    try:
        receipt['input_manifest'] = pin(HERE/'INPUTS.json')
        config = json.loads((HERE/'INPUTS.json').read_text())
        pins = verify(config)
        receipt['inputs'] = config['files']
        for role in ['producer', 'checker']:
            assert not interrupted and time.monotonic() < receipt['work_deadline_monotonic']
            assert pin(HERE/'INPUTS.json') == receipt['input_manifest']
            verify(config)
            result = stage(role, config, receipt['work_deadline_monotonic'], receipt['stages'])
            assert result['collected'] and result['exit_code'] == 0 and not result['refusals'], role
            assert all(result[s]['observed_bytes'] <= STREAM_CAP for s in ['stdout', 'stderr'])
            envelope(EXPORTS if role == 'producer' else EXPORTS | {'CHECK.json'})
        verify(config)
        assert pin(HERE/'INPUTS.json') == receipt['input_manifest']
        report = json.loads((OUT/'CHECK.json').read_text())
        assert report['decision'] == 'A' and report['actor'] == 'independent_checker'
        assert report['pid'] == receipt['stages'][1]['pid']
        assert report['source_hashes'] == {r: pins[r]['sha256'] for r in ['design', 'contract', 'writer_addendum']}
        assert report['export_inputs'] == [pin(OUT/name) for name in sorted(EXPORTS)]
        assert not interrupted and time.monotonic() <= receipt['work_deadline_monotonic']
        receipt['decision'] = 'A'
    except BaseException as error:
        receipt['refusal'] = {'type': type(error).__name__, 'detail': str(error)[:2000], 'utc': utc()}
    all_collected = all(record['collected'] for record in receipt['stages'])
    if all_collected:
        receipt['partial_or_final_inventory'] = []
        if OUT.exists() and not OUT.is_symlink() and stat.S_ISDIR(OUT.lstat().st_mode):
            for path in sorted(OUT.iterdir()):
                if path.name in EXPORTS | {'CHECK.json'} and stat.S_ISREG(path.lstat().st_mode) and path.stat().st_size <= FILE_CAP:
                    receipt['partial_or_final_inventory'].append(pin(path))
                else:
                    receipt['partial_or_final_inventory'].append({'path': str(path), 'hashed': False, 'reason': 'unknown/type/cap'})
    else:
        receipt['partial_hashing'] = 'Skipped: collection not certified; root must collect exact owned identities'
    receipt.update({'interruption_observations': interrupted, 'end_utc': utc(),
                    'end_monotonic': time.monotonic(), 'all_launched_children_collected': all_collected})
    payload = (json.dumps(receipt, indent=2, allow_nan=False)+'\n').encode()
    assert len(payload) <= FILE_CAP
    with (RECORDS/'PARENT.json').open('xb') as f:
        f.write(payload)
    print(json.dumps({'actor': 'parent', 'pid': os.getpid(), 'decision': receipt['decision'],
                      'collected': all_collected, 'receipt': str(RECORDS/'PARENT.json')}))
    raise SystemExit(0 if receipt['decision'] == 'A' else 2)


if __name__ == '__main__':
    main()
