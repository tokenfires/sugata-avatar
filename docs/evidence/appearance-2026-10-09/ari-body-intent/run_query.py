import datetime, hashlib, json, os, pathlib, signal, subprocess, sys, time

P = pathlib.Path(__file__).resolve().parent
C = json.loads((P/'EXEC.json').read_text())
now = lambda: datetime.datetime.now(datetime.timezone.utc)
def save(name,value):
    with (P/name).open('x') as f:
        json.dump(value,f,indent=2)
        f.write('\n')
if now() >= datetime.datetime.fromisoformat(C['launch_before']):
    raise RuntimeError('launch gate closed')
for p in C['pins']:
    b=pathlib.Path(p['path']).read_bytes()
    if len(b)!=p['bytes'] or hashlib.sha256(b).hexdigest()!=p['sha256']:
        raise RuntimeError('input pin '+p['path'])
for name in ('JOB-start.json','JOB.json','query.log','RESULT.json','OBSERVED.json','targets.npz'):
    if (P/name).exists():
        raise RuntimeError('first outputs only '+name)
proc=None
started=now()
start=None
job={'wrapper_pid':os.getpid(),'wrapper_started':started.isoformat(),'started':None,'command':[C['python'],str(P/'query.py')],'cap_seconds':120,'launch_before':C['launch_before'],'finish_by':C['finish_by'],'child_pid':None,'timed_out':False,'interrupted':False}
try:
    with (P/'query.log').open('xb') as log:
        launched=now()
        if launched >= datetime.datetime.fromisoformat(C['launch_before']) or launched >= datetime.datetime.fromisoformat(C['finish_by']):
            raise RuntimeError('fresh launch gate closed')
        start=time.monotonic()
        job['started']=launched.isoformat()
        proc=subprocess.Popen(job['command'],stdout=log,stderr=subprocess.STDOUT,start_new_session=True,cwd=P)
        job['child_pid']=proc.pid
        job['process_group']=proc.pid
        save('JOB-start.json',job)
        remaining=min(120-(time.monotonic()-start),(datetime.datetime.fromisoformat(C['finish_by'])-now()).total_seconds())
        try:
            job['returncode']=proc.wait(timeout=max(0,remaining))
        except subprocess.TimeoutExpired:
            job['timed_out']=True
            os.killpg(proc.pid,signal.SIGKILL)
            proc.wait()
            job['returncode']=proc.returncode
except BaseException as e:
    job['interrupted']=True
    job['error']={'type':type(e).__name__,'message':str(e)}
    if proc and proc.poll() is None:
        os.killpg(proc.pid,signal.SIGKILL)
        proc.wait()
    job['returncode']=proc.returncode if proc else None
finally:
    job['finished']=now().isoformat()
    job['elapsed_seconds']=time.monotonic()-start if start is not None else None
    job['launch_before_gate']=job['started'] is not None and datetime.datetime.fromisoformat(job['started'])<datetime.datetime.fromisoformat(C['launch_before'])
    job['within_wall_cap']=job['elapsed_seconds'] is not None and job['elapsed_seconds']<=120 and not job['timed_out']
    job['finished_before_gate']=now()<datetime.datetime.fromisoformat(C['finish_by'])
    job['log_bytes']=(P/'query.log').stat().st_size if (P/'query.log').exists() else None
    save('JOB.json',job)
    print(json.dumps(job))
sys.exit(0 if job.get('returncode')==0 and not job['timed_out'] and not job['interrupted'] and job['launch_before_gate'] and job['within_wall_cap'] and job['finished_before_gate'] else 1)
