import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

root = Path(__file__).resolve().parent
now = dt.datetime.now(dt.timezone.utc)
stop = dt.datetime.fromisoformat('2026-10-09T23:42:00+00:00')
assert (stop-now).total_seconds() >= 65, 'Full allocation no longer available'
assert not (root/'ACQUISITION.json').exists(), 'Never duplicate an attempted acquisition'
record = {'start': now.isoformat(), 'parent_pid': os.getpid(), 'remaining_seconds': (stop-now).total_seconds(),
          'command': [sys.executable, str(root/'acquire.py')],
          'code_sha256': hashlib.sha256((root/'acquire.py').read_bytes()).hexdigest(), 'timeout': False}
child = None
clock = time.monotonic()
try:
    child = subprocess.Popen(record['command'], start_new_session=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    record['pid'] = record['pgid'] = child.pid
    try:
        output, _ = child.communicate(timeout=max(0, 60-(time.monotonic()-clock)))
    except subprocess.TimeoutExpired:
        record['timeout'] = True
        os.killpg(child.pid, signal.SIGKILL)
        output, _ = child.communicate()
    record['exit_code'] = child.returncode
    with (root/'acquire.log').open('xb') as file:
        file.write(output)
finally:
    if child is not None and child.poll() is None:
        os.killpg(child.pid, signal.SIGKILL)
        child.wait()
    record['elapsed_seconds'] = time.monotonic()-clock
    record['within_wall_cap'] = record['elapsed_seconds'] <= 60
    record['end'] = dt.datetime.now(dt.timezone.utc).isoformat()
    record['finished_before_stop'] = dt.datetime.fromisoformat(record['end']) < stop
    with (root/'JOB.json').open('x') as file:
        json.dump(record, file, indent=2)
        file.write('\n')
print(json.dumps(record))
if record.get('exit_code') != 0 or record['timeout'] or not record['finished_before_stop'] or not record['within_wall_cap']:
    raise SystemExit(1)
