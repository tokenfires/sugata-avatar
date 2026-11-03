"""Single admitted CPU-only layout check; no compiler, browser or native renderer."""
import datetime
import hashlib
import json
from pathlib import Path
import resource
import subprocess
import time

root = Path(__file__).resolve().parents[2]
out = root / 'docs/evidence/ember-2026-10-31-hair-layout-check'
limits = json.loads((out/'contract.json').read_text())['limits']
assert not (out/'STARTED.json').exists(), 'This check is consumed'
review = json.loads((out/'source-review.json').read_text())
assert review['admitSingleCheck'] is True
assert review['preflightSha256'] == hashlib.sha256((out/'preflight.json').read_bytes()).hexdigest()


def bound_cpu():
    resource.setrlimit(resource.RLIMIT_CPU, (10, 10))


start = time.monotonic()
peak = 0
reason = None
with (out/'check.log').open('x') as log:
    child = subprocess.Popen(['node', 'tools/ember-hair/layout-check.mjs', '--run'], cwd=root,
                             stdout=log, stderr=subprocess.STDOUT, preexec_fn=bound_cpu)
    try:
        while child.poll() is None:
            rss = subprocess.run(['ps', '-o', 'rss=', '-p', str(child.pid)], capture_output=True,
                                 text=True, timeout=1).stdout.strip()
            if rss:
                peak = max(peak, int(rss)*1024)
            total_bytes = sum(p.stat().st_size for p in out.iterdir() if p.is_file())
            if (time.monotonic()-start > limits['wallSeconds'] or peak > limits['rssBytes'] or
                    log.tell() > limits['logBytes'] or total_bytes > limits['totalOutputBytes']-8192):
                reason = 'wall, observed RSS or output ceiling'
                break
            time.sleep(.1)
    except Exception as error:
        reason = 'watchdog failure: ' + str(error)
    finally:
        if child.poll() is None:
            child.kill()
    code = child.wait(timeout=2)
receipt = {'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'pid': child.pid,
           'exitCode': code, 'wallSeconds': time.monotonic()-start, 'sampledPeakRssBytes': peak,
           'stopReason': reason, 'completeArtifact': (out/'COMPLETE.json').exists(), 'automaticRetry': False}
payload = json.dumps(receipt, indent=2)+'\n'
assert sum(p.stat().st_size for p in out.iterdir() if p.is_file())+len(payload.encode()) <= limits['totalOutputBytes']
(out/'process-result.json').write_text(payload)
print(json.dumps(receipt))
raise SystemExit(0 if code == 0 and reason is None and receipt['completeArtifact'] else 1)
