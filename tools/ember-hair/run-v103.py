"""Launch the one admitted compilation with a finite parent watchdog and failure receipt."""
import datetime
import hashlib
import json
from pathlib import Path
import resource
import subprocess
import time

root = Path(__file__).resolve().parents[2]
out = root / 'docs/evidence/ember-2026-11-02-hair-v103'
assert not (out/'STARTED.json').exists(), 'This compilation has already been consumed'

def bound_cpu():
    resource.setrlimit(resource.RLIMIT_CPU, (10, 10))

start = time.monotonic()
peak = 0
reason = None
with (out/'build.log').open('x') as log:
    child = subprocess.Popen(['node', 'tools/ember-hair/compile-v103.mjs', '--run'], cwd=root,
                             stdout=log, stderr=subprocess.STDOUT, preexec_fn=bound_cpu)
    try:
        while child.poll() is None:
            elapsed = time.monotonic()-start
            rss = subprocess.run(['ps', '-o', 'rss=', '-p', str(child.pid)], capture_output=True,
                                 text=True, timeout=1).stdout.strip()
            if rss:
                peak = max(peak, int(rss)*1024)
            if elapsed > 15 or peak > 512*1024*1024 or log.tell() > 2*1024*1024:
                reason = 'wall-time ceiling' if elapsed > 15 else 'RSS or log ceiling'
                break
            time.sleep(.1)
    except Exception as error:
        reason = 'watchdog failed: ' + str(error)
    finally:
        if child.poll() is None:
            child.kill()
    code = child.wait(timeout=2)
receipt = {'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'pid': child.pid,
           'exitCode': code, 'wallSeconds': time.monotonic()-start, 'sampledPeakRssBytes': peak,
           'stopReason': reason, 'completeArtifact': (out/'COMPLETE.json').exists(), 'automaticRetry': False}
(out/'process-result.json').write_text(json.dumps(receipt, indent=2)+'\n')
print(json.dumps(receipt))
raise SystemExit(0 if code == 0 and receipt['completeArtifact'] else 1)
