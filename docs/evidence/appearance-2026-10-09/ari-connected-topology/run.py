from pathlib import Path
import datetime, hashlib, json, os, signal, subprocess, sys
HERE=Path(__file__).resolve().parent
now=lambda:datetime.datetime.now(datetime.timezone.utc)
limit=datetime.datetime.fromisoformat('2026-10-09T10:55:00+00:00')
assert now()<limit
for name in ['JOB.json','generation.log','TOPOLOGY.json','RESULT.json']: assert not (HERE/name).exists(),name
for r in json.loads((HERE/'EXEC.json').read_text()):
    b=Path(r['path']).read_bytes();assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'],r['path']
started=now();timed_out=False
with (HERE/'generation.log').open('xb') as log:
    remaining=(limit-now()).total_seconds();assert remaining>0,'Hard launch gate expired'
    child=subprocess.Popen([sys.executable,str(HERE/'generate.py')],stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
    try: child.wait(timeout=max(0,min(30,remaining,(limit-now()).total_seconds())))
    except subprocess.TimeoutExpired:
        timed_out=True;os.killpg(child.pid,signal.SIGKILL);child.wait()
finished=now(); b=(HERE/'generation.log').read_bytes()
within_gate=finished<=limit
with (HERE/'JOB.json').open('x') as f:
    json.dump({'wrapper_pid':os.getpid(),'child_pid':child.pid,'owned_group':child.pid,'command':[sys.executable,str(HERE/'generate.py')],
       'started_utc':started.isoformat(),'finished_utc':finished.isoformat(),'exit_code':child.returncode,'timeout_seconds':30,'timed_out':timed_out,
       'finished_within_gate':within_gate,'log_bytes':len(b),'log_sha256':hashlib.sha256(b).hexdigest()},f,indent=2);f.write('\n')
print(b.decode('utf-8',errors='replace'),end='')
sys.exit(child.returncode if not timed_out and within_gate else 124)
