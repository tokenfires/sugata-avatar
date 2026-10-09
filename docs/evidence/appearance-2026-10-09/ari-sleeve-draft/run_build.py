"""One bounded original constructor with exclusive outputs and root admission."""
from pathlib import Path
import sys,os,json,hashlib,datetime,subprocess,signal
sys.dont_write_bytecode=True
H=Path(__file__).resolve().parent
now=lambda:datetime.datetime.now(datetime.timezone.utc)
deadline=datetime.datetime(2026,10,9,10,15,tzinfo=datetime.timezone.utc)
x=json.loads((H/'EXEC-BUILD.json').read_text());a=json.loads((H/'ROOT-BUILD-PREFLIGHT.json').read_text())
assert a['admitted'] and a['exec_sha256']==hashlib.sha256((H/'EXEC-BUILD.json').read_bytes()).hexdigest()
for p in x['pins']:
 with open(p['path'],'rb') as f:d=hashlib.file_digest(f,'sha256').hexdigest()
 assert Path(p['path']).stat().st_size==p['bytes'] and d==p['sha256'],p['path']
assert not any((H/n).exists() for n in ['RESULT.json','geometry.npz','BUILD-JOB-start.json','BUILD-JOB.json','build.log'])
remaining=(deadline-now()).total_seconds();assert remaining>0
command=[sys.executable,str(H/'build.py')]
j={'utc_started':now().isoformat(),'wrapper_pid':os.getpid(),'command':command,'allocated_timeout_seconds':min(120,remaining),'deadline_utc':deadline.isoformat()}
with (H/'BUILD-JOB-start.json').open('x') as f:json.dump(j,f,indent=2)
child=subprocess.Popen(command,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'})
j['child_pid']=child.pid;j['owned_process_group']=child.pid;(H/'BUILD-JOB-start.json').write_text(json.dumps(j,indent=2)+'\n');timeout=False
try:output,_=child.communicate(timeout=min(j['allocated_timeout_seconds'],max(.001,(deadline-now()).total_seconds())))
except subprocess.TimeoutExpired:
 timeout=True;os.killpg(child.pid,signal.SIGKILL);output,_=child.communicate()
j.update(utc_finished=now().isoformat(),exit_code=child.returncode,timed_out=timeout,log_bytes=len(output),log_sha256=hashlib.sha256(output).hexdigest(),log_truncated=len(output)>65536)
(H/'build.log').write_bytes(output[:65536]);(H/'BUILD-JOB.json').write_text(json.dumps(j,indent=2)+'\n');print(json.dumps(j))
sys.exit(124 if timeout else (125 if len(output)>65536 else child.returncode))
