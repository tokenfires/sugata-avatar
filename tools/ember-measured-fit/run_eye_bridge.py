"""Finite, single-use process supervisor for the admitted eye bridge build."""
import json
import os
import signal
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'docs/evidence/ember-2026-10-31-eye-bridge'
manifest = json.loads((OUT/'preflight.json').read_text())
limits = manifest['limits']
command = ['/Applications/Blender.app/Contents/MacOS/Blender', '--background',
           '--threads', '2', '--python-exit-code', '1', '--python',
           str(ROOT/'tools/ember-measured-fit/eye_bridge.py'), '--', '--run-admitted-eye-bridge-v001']
with (OUT/'BUILD.started.json').open('x') as f:
    json.dump({'command': command, 'startedUnix': time.time(), 'limits': limits}, f, indent=2)
env = dict(os.environ, OPENBLAS_NUM_THREADS='1', OMP_NUM_THREADS='2')
start = time.monotonic()
peak = 0
reason = None
with (OUT/'build.log').open('x') as log:
    process = subprocess.Popen(command, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    try:
        while process.poll() is None:
            elapsed = time.monotonic()-start
            r = subprocess.run(['ps', '-o', 'rss=', '-p', str(process.pid)], capture_output=True, text=True)
            rss = int(r.stdout.strip() or 0)*1024
            peak = max(peak, rss)
            size = sum(p.stat().st_size for p in OUT.iterdir() if p.is_file())
            if elapsed > limits['wallSeconds'] or rss > limits['rssBytes'] or size > limits['outputBytes']:
                reason = {'wallSeconds': elapsed, 'rssBytes': rss, 'directoryBytes': size}
                os.killpg(process.pid, signal.SIGTERM)
                break
            time.sleep(.5)
        try:
            code = process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            code = process.wait()
    finally:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
result = {'pid': process.pid, 'exitCode': code, 'seconds': time.monotonic()-start,
          'peakRssBytes': peak, 'limitStop': reason}
(OUT/'process-result.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(result))
raise SystemExit(code or (1 if reason else 0))
