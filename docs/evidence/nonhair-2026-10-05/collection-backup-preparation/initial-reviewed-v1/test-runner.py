"""One bounded Node test child; writes only its own evidence leaf."""
import datetime
import json
import pathlib
import subprocess
import sys
import time
import os

leaf = pathlib.Path(__file__).resolve().parent
repo = leaf.parents[3]
node = pathlib.Path('/Users/robault/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')
command = [str(node), '--max-old-space-size=128', str(repo / 'packages/testbed/src/showcase-collection-backup.selftest.mjs')]
for name in ('TEST-START.json', 'TEST-STDOUT.txt', 'TEST-STDERR.txt', 'TEST-PROCESS.json'):
    if (leaf / name).exists():
        raise SystemExit('Refusing existing test evidence; no retry in this output owner.')
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
clock = time.monotonic()
child = None
timed_out = False
launch_error = None
try:
    child = subprocess.Popen(command, cwd=repo, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    with (leaf / 'TEST-START.json').open('x') as file:
        json.dump(dict(command=command, cwd=str(repo), parent_pid=os.getpid(), child_pid=child.pid, start_utc=start), file, indent=2)
        file.write('\n')
    try:
        stdout, stderr = child.communicate(timeout=30)
    except subprocess.TimeoutExpired:
        timed_out = True
        child.kill()
        stdout, stderr = child.communicate()
except OSError as error:
    launch_error = str(error)
    stdout, stderr = b'', str(error).encode()
finally:
    if child is not None and child.poll() is None:
        child.kill()
        child.communicate()
record = dict(command=command, cwd=str(repo), parent_pid=os.getpid(), child_pid=child.pid if child else None,
              start_utc=start, return_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
              elapsed_seconds=time.monotonic() - clock, exit_code=child.returncode if child else None, timeout=timed_out, launch_error=launch_error,
              stdout_bytes=len(stdout), stderr_bytes=len(stderr), output_limit=65536,
              output_within_limit=len(stdout) + len(stderr) <= 65536,
              scope='30s child timeout then kill/collect; V8 heap flag, not RSS cap; output size checked after collection, not streaming cap')
for name, data in [('TEST-STDOUT.txt', stdout), ('TEST-STDERR.txt', stderr), ('TEST-PROCESS.json', (json.dumps(record, indent=2) + '\n').encode())]:
    with (leaf / name).open('xb') as file:
        file.write(data)
print(json.dumps(record))
sys.exit(0 if not timed_out and launch_error is None and child.returncode == 0 and record['output_within_limit'] else 1)
