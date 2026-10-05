"""Exercise only parsed stop_child against owned CPU children, never the probe."""
from pathlib import Path
import ast
import datetime
import hashlib
import json
import os
import signal
import subprocess
import sys
import time

base = Path(__file__).resolve().parent
rows = []


def function(name):
    source = base / name
    parsed = ast.parse(source.read_text())
    node = next(n for n in parsed.body if isinstance(n, ast.FunctionDef) and n.name == 'stop_child')
    scope = {'os': os, 'signal': signal, 'subprocess': subprocess, 'time': time}
    exec(compile(ast.Module(body=[node], type_ignores=[]), str(source), 'exec'), scope)
    return scope['stop_child']


def group_alive(pid):
    try:
        os.killpg(pid, 0)
        return True
    except ProcessLookupError:
        return False


for source, case in [('probe.initial.py', 'exited_leader_with_descendant'),
                     ('probe.py', 'exited_leader_with_descendant'),
                     ('probe.py', 'live_leader'), ('probe.py', 'completed_leader')]:
    marker = base / ('fixture-' + str(len(rows)) + '.json')
    if case == 'exited_leader_with_descendant':
        payload = "import pathlib,subprocess,sys,os; p=subprocess.Popen([sys.executable,'-c','import time; time.sleep(30)']); pathlib.Path(sys.argv[1]).write_text(str(p.pid)); os._exit(0)"
        argv = [sys.executable, '-B', '-c', payload, str(marker)]
    elif case == 'live_leader':
        argv = [sys.executable, '-B', '-c', 'import time; time.sleep(30)']
    else:
        argv = [sys.executable, '-B', '-c', 'pass']
    child = subprocess.Popen(argv, start_new_session=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    start = time.monotonic()
    try:
        if case != 'live_leader':
            child.wait(timeout=3)
        before = group_alive(child.pid)
        function(source)(child)
        after = group_alive(child.pid)
        expected_remaining = source == 'probe.initial.py'
        assert after == expected_remaining, (source, case, after)
        rows.append({'source': source, 'case': case, 'owned_leader_pid': child.pid,
                     'owned_descendant_pid': int(marker.read_text()) if marker.exists() else None,
                     'leader_exit': child.returncode, 'group_before': before,
                     'group_after_function': after, 'expected_remaining': expected_remaining,
                     'seconds': time.monotonic() - start})
    finally:
        if group_alive(child.pid):
            os.killpg(child.pid, signal.SIGKILL)
        if child.poll() is None:
            child.wait(timeout=2)
        end = time.monotonic() + 3
        while group_alive(child.pid) and time.monotonic() < end:
            time.sleep(0.05)
        assert not group_alive(child.pid), 'fixture group remains'
        rows[-1]['fixture_group_gone'] = True

bindings = [{'path': str((base / n)), 'bytes': (base / n).stat().st_size,
             'sha256': hashlib.sha256((base / n).read_bytes()).hexdigest()}
            for n in ['probe.py', 'probe.initial.py', Path(__file__).name]]
result = {'closed_utc': datetime.datetime.now(datetime.UTC).isoformat(),
          'scope': 'Only parsed stop_child called against four newly owned CPU fixtures; no full controller invocation/package/mount/native/browser/Blender action.',
          'bindings': bindings, 'cases': rows}
(base / 'PROCESS-OWNERSHIP.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
