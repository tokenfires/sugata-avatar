import datetime, hashlib, json, os, pathlib, signal, subprocess, sys, time

P=pathlib.Path(__file__).resolve().parent
now=lambda:datetime.datetime.now(datetime.timezone.utc)
digest=lambda b:hashlib.sha256(b).hexdigest()
C=json.loads((P/'EXEC.json').read_text())
admission=json.loads((P/'ADMISSION.json').read_text())
if admission['execution_admitted'] is not True or admission['exec_sha256']!=digest((P/'EXEC.json').read_bytes()):
    raise RuntimeError('missing/mismatched saved admission')
if admission['pins']!=C['pins'] or admission['preflight_sha256']!=digest((P/'PREFLIGHT.md').read_bytes()):
    raise RuntimeError('admission bindings disagree')
age=(now()-datetime.datetime.fromisoformat(admission['clock'])).total_seconds()
if not admission['scoped_jobs_absent'] or not 0<=age<=180:raise RuntimeError('stale admission or live job')
if str(pathlib.Path(sys.executable).resolve())!=C['python']:raise RuntimeError('wrapper interpreter')
for row in C['pins']:
    b=pathlib.Path(row['path']).read_bytes()
    if len(b)!=row['bytes'] or digest(b)!=row['sha256']:raise RuntimeError('pin '+row['path'])
for name in C['first_outputs']:
    if (P/name).exists():raise RuntimeError('first output already exists '+name)
def save(name,obj):
    with (P/name).open('x') as f:json.dump(obj,f,indent=2);f.write('\n')
proc=None;start=None
job={'wrapper_pid':os.getpid(),'started':None,'command':[C['python'],str(P/'query.py')],'admission_sha256':digest((P/'ADMISSION.json').read_bytes()),'cap_seconds':120,'timed_out':False,'interrupted':False}
try:
    with (P/'query.log').open('xb') as log:
        launched=now()
        if launched>=datetime.datetime.fromisoformat(C['launch_before']) or launched>=datetime.datetime.fromisoformat(C['finish_by']):raise RuntimeError('fresh launch gate closed')
        start=time.monotonic();job['started']=launched.isoformat()
        proc=subprocess.Popen(job['command'],stdout=log,stderr=subprocess.STDOUT,start_new_session=True,cwd=P)
        job['child_pid']=proc.pid;job['process_group']=proc.pid
        save('JOB-start.json',job)
        remaining=min(120-(time.monotonic()-start),(datetime.datetime.fromisoformat(C['finish_by'])-now()).total_seconds())
        try:job['returncode']=proc.wait(timeout=max(0,remaining))
        except subprocess.TimeoutExpired:
            job['timed_out']=True;os.killpg(proc.pid,signal.SIGKILL);proc.wait();job['returncode']=proc.returncode
except BaseException as e:
    job['interrupted']=True;job['error']={'type':type(e).__name__,'message':str(e)}
    if proc and proc.poll() is None:os.killpg(proc.pid,signal.SIGKILL);proc.wait()
    job['returncode']=proc.returncode if proc else None
finally:
    job['finished']=now().isoformat();job['elapsed_seconds']=time.monotonic()-start if start is not None else None
    job['launch_before_gate']=job['started'] is not None and datetime.datetime.fromisoformat(job['started'])<datetime.datetime.fromisoformat(C['launch_before'])
    job['within_wall_cap']=job['elapsed_seconds'] is not None and job['elapsed_seconds']<=120 and not job['timed_out']
    job['finished_before_gate']=now()<datetime.datetime.fromisoformat(C['finish_by'])
    save('JOB.json',job);print(json.dumps(job))
sys.exit(0 if job.get('returncode')==0 and not job['interrupted'] and not job['timed_out'] and all(job[k] for k in ('launch_before_gate','within_wall_cap','finished_before_gate')) else 1)
