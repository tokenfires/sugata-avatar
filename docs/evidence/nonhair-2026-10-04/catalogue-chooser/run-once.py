"""One externally bounded CPU selftest. No candidate import in this owner process."""
from pathlib import Path
import datetime, hashlib, json, os, shutil, signal, subprocess, time

ROOT = Path('/Users/robault/GitHub/sugata-avatar')
PACKET = ROOT / 'docs/evidence/nonhair-2026-10-04/catalogue-chooser'
STOP = datetime.datetime.fromisoformat('2026-10-05T05:47:04.054325+00:00')
now = lambda: datetime.datetime.now(datetime.timezone.utc)
if (PACKET / 'TEST-JOB.json').exists() or (PACKET / 'TEST-START.json').exists():
    raise SystemExit('One invocation already recorded; no rerun.')
admission = json.loads((PACKET / 'ROOT-ADMISSION.json').read_text())
if admission['decision'] != 'A sole 60-second CPU selftest' or now().timestamp() + 90 >= STOP.timestamp():
    raise SystemExit('Not admitted or insufficient time inside fixed stop.')
for pin in admission['pins']:
    data = Path(pin['path']).read_bytes()
    assert len(data) == pin['bytes'] and hashlib.sha256(data).hexdigest() == pin['sha256'], pin['path']
node = shutil.which('node')
assert node, 'Existing node runtime required; no installation.'
command = [node, str(PACKET / 'candidate/CatalogueDresser.selftest.mjs')]
started = now(); tick = time.monotonic()
start_record = {'startedAt':started.isoformat(), 'ownerPid':os.getpid(), 'command':command, 'cwd':str(ROOT), 'timeoutSeconds':60, 'stopAt':STOP.isoformat()}
(PACKET / 'TEST-START.json').write_text(json.dumps(start_record, indent=2)+'\n')
child = subprocess.Popen(command, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
start_record['childPid'] = child.pid
(PACKET / 'TEST-START.json').write_text(json.dumps(start_record, indent=2)+'\n')
timed_out = False
try:
    stdout, stderr = child.communicate(timeout=60)
except subprocess.TimeoutExpired:
    timed_out = True
    os.killpg(child.pid, signal.SIGKILL)
    stdout, stderr = child.communicate()
(PACKET / 'TEST-STDOUT.txt').write_bytes(stdout)
(PACKET / 'TEST-STDERR.txt').write_bytes(stderr)
record = {**start_record, 'completedAt':now().isoformat(), 'elapsedSeconds':time.monotonic()-tick, 'exitCode':child.returncode, 'timedOut':timed_out, 'outputs':[]}
for name in ['TEST-STDOUT.txt','TEST-STDERR.txt']:
    f = PACKET/name; data = f.read_bytes()
    record['outputs'].append({'path':str(f), 'bytes':len(data), 'sha256':hashlib.sha256(data).hexdigest()})
(PACKET / 'TEST-JOB.json').write_text(json.dumps(record, indent=2)+'\n')
print(json.dumps(record, indent=2))
raise SystemExit(0 if child.returncode == 0 and not timed_out else 1)
