"""One new offline native process group; exact actual timing and collection."""
from pathlib import Path
import sys,os,json,hashlib,datetime,subprocess,signal,time,re
sys.dont_write_bytecode=True
H=Path(__file__).resolve().parent
config=json.loads((H/'EXEC.json').read_text())
admission=json.loads((H/'ROOT-ADMISSION.json').read_text())
assert admission['admitted'] and admission['exec_sha256']==hashlib.sha256((H/'EXEC.json').read_bytes()).hexdigest()
for row in config['pins']:
    f=Path(row['path']);data=f.read_bytes()
    assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256'],str(f)
first=['RESULT.json','OBSERVED.json','NATIVE-JOB-start.json','NATIVE-JOB.json','native.log']
assert not any((H/name).exists() for name in first),'First outputs only'
rows=subprocess.check_output(['ps','-axo','pid=,args=']).decode(errors='replace').splitlines()
for row in rows:
    parts=row.strip().split(None,1)
    if len(parts)<2 or int(parts[0])==os.getpid():continue
    args=parts[1];name=Path(args.split()[0]).name
    assert not (name.lower()=='blender' and ('--background' in args or '--python' in args or ' -b ' in args)),'Competing native job: '+row
    assert not ('/sugata-avatar/docs/evidence/' in args and re.fullmatch(r'python(?:\d+(?:\.\d+)*)?',name,re.I)),'Competing Sugata worker: '+row
now=lambda:datetime.datetime.now(datetime.timezone.utc)
start_gate=datetime.datetime.fromisoformat(config['start_before']);stop_gate=datetime.datetime.fromisoformat(config['stop_before'])
command=[config['blender'],'--background','--factory-startup','--offline-mode','--python-exit-code','1','--python',str(H/'probe.py')]
launch=now();assert launch<start_gate and launch+datetime.timedelta(seconds=30)<stop_gate,'Fresh pre-Popen UTC envelope'
started=time.monotonic();child=subprocess.Popen(command,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'})
returned=now();job={'utc_started':launch.isoformat(),'utc_Popen_return':returned.isoformat(),'wrapper_pid':os.getpid(),'native_pid':child.pid,'owned_process_group':child.pid,'command':command,'allocated_seconds':30,'launch_within_gates':returned<start_gate and returned+datetime.timedelta(seconds=30)<stop_gate}
timeout=False;output=b''
try:
    with (H/'NATIVE-JOB-start.json').open('x') as f:json.dump(job,f,indent=2);f.write('\n')
    assert job['launch_within_gates'],'Actual launch envelope'
    output,_=child.communicate(timeout=max(.001,min(30-(time.monotonic()-started),(stop_gate-now()).total_seconds())))
except BaseException:
    timeout=True
    try:os.killpg(child.pid,signal.SIGKILL)
    except ProcessLookupError:pass
    output,_=child.communicate()
    raise
finally:
    if child.poll() is None:
        os.killpg(child.pid,signal.SIGKILL);output,_=child.communicate()
    elapsed=time.monotonic()-started;within=elapsed<=30 and now()<stop_gate
    exitcode=child.returncode if within and job['launch_within_gates'] and not timeout and len(output)<=65536 else 125
    job.update(utc_finished=now().isoformat(),elapsed=elapsed,exit_code=child.returncode,wrapper_exit_code=exitcode,timed_out_or_interrupted=timeout,within_total_wall_gate=within,log_bytes=len(output),log_sha256=hashlib.sha256(output).hexdigest(),log_truncated=len(output)>65536,shutdown='Immediateowned-groupSIGKILL; never overbudgetPASS')
    with (H/'native.log').open('xb') as f:f.write(output[:65536])
    with (H/'NATIVE-JOB.json').open('x') as f:json.dump(job,f,indent=2);f.write('\n')
print(json.dumps({'exit_code':child.returncode,'wrapper_exit_code':exitcode,'elapsed':time.monotonic()-started,'timeout_or_interrupt':timeout}))
raise SystemExit(exitcode)
