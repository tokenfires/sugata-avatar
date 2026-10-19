"""One attempt; same PID exec, no child/process-group collector."""
import os, sys, json, hashlib, signal, resource, datetime
from pathlib import Path
P = Path(__file__).resolve().parent
R = P.parents[3]
def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        while b := f.read(65536): h.update(b)
    return h.hexdigest()
def now(): return datetime.datetime.now(datetime.timezone.utc)
def write(name, value):
    b = (json.dumps(value, indent=2) + '\n').encode()
    if len(b) > 32768: raise RuntimeError('failure record cap')
    with (P / name).open('xb') as f: f.write(b)
try:
    admission = P / 'ROOT-ADMISSION.json'
    if len(sys.argv) != 2 or digest(admission) != sys.argv[1]: raise RuntimeError('admission identity')
    a = json.loads(admission.read_bytes())
    if a['decision'] != 'ADMIT_SOLE_FIXED_PACKET' or digest(P/'EXEC.json') != a['exec_sha256']: raise RuntimeError('admission scope')
    with (P/'CLAIM.json').open('xb') as f:
        f.write((json.dumps({'attempt': 1, 'pid': os.getpid(), 'claimed_utc': now().isoformat(), 'admission_sha256': sys.argv[1]})+'\n').encode())
    signal.signal(signal.SIGALRM, signal.SIG_DFL)
    signal.alarm(90)
    resource.setrlimit(resource.RLIMIT_CPU, (60, 60))
    e = json.loads((P/'EXEC.json').read_bytes())
    for row in e['pins']:
        p = R / row['path']
        if p.stat().st_size != row['bytes'] or digest(p) != row['sha256']: raise RuntimeError('input pin '+row['path'])
    if now() >= datetime.datetime.fromisoformat(e['launch_before']): raise RuntimeError('launch deadline')
    if (R/e['input']).stat().st_mode & 0o777 != 0o444: raise RuntimeError('readonly GLB')
    os.execv(e['node'], [e['node'], '--max-old-space-size=512', str(P/'packet.mjs')])
except Exception as exc:
    try: write('FAILURE.json', {'phase': 'launcher', 'pid': os.getpid(), 'utc': now().isoformat(), 'error': repr(exc)[:2000], 'partial_outputs_retained': True, 'pass': False})
    except Exception: pass
    print('LAUNCH_FAILURE', repr(exc), file=sys.stderr)
    sys.exit(1)
