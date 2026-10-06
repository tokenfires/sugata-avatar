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
command = [str(node), '--max-old-space-size=128', str(repo / 'packages/testbed/src/showcase-collection.selftest.mjs')]
for name in ('TEST-START.json', 'TEST-STDOUT.txt', 'TEST-STDERR.txt', 'TEST-PROCESS.json'):
    if (leaf / name).exists():
        raise SystemExit('Refusing existing test evidence; no retry in this output owner.')
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
clock = time.monotonic()
child = None
timed_out = False
stdout, stderr = b'', b''
streams_complete = False
errors = []
def failure(phase, error):
    errors.append(dict(phase=phase, type=type(error).__name__, message=str(error)))
def collect(timeout, phase):
    global stdout, stderr, streams_complete, timed_out
    try:
        stdout, stderr = child.communicate(timeout=timeout)
        streams_complete = True
    except subprocess.TimeoutExpired as error:
        timed_out = True
        # communicate retries include the earlier prefix: never concatenate it twice.
        if error.output is not None: stdout = error.output
        if error.stderr is not None: stderr = error.stderr
        failure(phase, error)
    except OSError as error:
        failure(phase, error)
try:
    child = subprocess.Popen(command, cwd=repo, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
except OSError as error:
    failure('launch', error)
if child is not None:
    start_written = False
    try:
        with (leaf / 'TEST-START.json').open('x') as file:
            json.dump(dict(command=command, cwd=str(repo), parent_pid=os.getpid(), child_pid=child.pid, start_utc=start), file, indent=2)
            file.write('\n')
        start_written = True
    except OSError as error:
        failure('start-record', error)
    if start_written: collect(30, 'test-communicate')
    if not streams_complete:
        cleanup_deadline = time.monotonic() + 5
        try:
            if child.poll() is None: child.kill()
        except OSError as error:
            failure('cleanup-poll-or-signal', error)
        collect(max(.001, cleanup_deadline - time.monotonic()), 'cleanup-communicate')
    try:
        child.poll()
    except OSError as error:
        failure('final-poll', error)
for name, data in [('TEST-STDOUT.txt', stdout), ('TEST-STDERR.txt', stderr)]:
    try:
        with (leaf / name).open('xb') as file: file.write(data)
    except OSError as error:
        failure(name, error)
record = dict(command=command, cwd=str(repo), parent_pid=os.getpid(), child_pid=child.pid if child else None,
              start_utc=start, return_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
              elapsed_seconds=time.monotonic() - clock, exit_code=child.returncode if child else None, timeout=timed_out,
              child_reaped=child is not None and child.returncode is not None, streams_complete=streams_complete, errors=errors,
              stdout_bytes=len(stdout), stderr_bytes=len(stderr), output_limit=65536,
              output_within_limit=len(stdout) + len(stderr) <= 65536,
              scope='30s child wait, then independent signal/drain up to5s; permission failures may leave uncollected child identified byPID. V8 heap flag not RSS cap; output size checked after collection not streaming cap. Partial raw prefixes retained; supervisor errors never replace child streams.')
try:
    with (leaf / 'TEST-PROCESS.json').open('x') as file:
        json.dump(record, file, indent=2); file.write('\n')
except OSError as error:
    failure('final-record', error)
print(json.dumps(record), flush=True)
sys.exit(0 if child is not None and streams_complete and not timed_out and not errors and child.returncode == 0 and record['output_within_limit'] else 1)
