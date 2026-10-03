"""Sole fixed native job supervisor; invoke only after exact source admission."""
from pathlib import Path
import datetime, json, subprocess, os, hashlib

ROOT = Path('/Users/robault/GitHub/sugata-avatar')
PACKET = ROOT / 'docs/evidence/nonhair-2026-10-03/ink-denim-look'
utc = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
command = ['node', 'tools/critic/ink-denim-look.mjs']
assert datetime.datetime.now(datetime.timezone.utc) < datetime.datetime(2026, 10, 3, 21, 23, tzinfo=datetime.timezone.utc)
assert not (PACKET / 'NATIVE-JOB.json').exists(), 'one native attempt only'
record = {'supervisorPID': os.getpid(), 'started': utc(), 'cwd': str(ROOT), 'command': command,
          'nativePID': None, 'exitCode': None, 'timeout': False, 'collection': 'running'}
write = lambda: (PACKET / 'NATIVE-JOB.json').write_text(json.dumps(record, indent=2) + '\n')
write()
with (PACKET / 'native.log').open('wb') as log:
    child = subprocess.Popen(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT)
    record['nativePID'] = child.pid
    write()
    try:
        record['exitCode'] = child.wait(timeout=120)
    except subprocess.TimeoutExpired:
        record['timeout'] = True
        child.terminate()
        try:
            record['exitCode'] = child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            child.kill()
            record['exitCode'] = child.wait(timeout=5)
    record['finished'] = utc()
    record['collection'] = 'collected'
record['logSHA256'] = hashlib.sha256((PACKET / 'native.log').read_bytes()).hexdigest()
write()
print(json.dumps(record))
raise SystemExit(0 if record['exitCode'] == 0 and not record['timeout'] else 1)
