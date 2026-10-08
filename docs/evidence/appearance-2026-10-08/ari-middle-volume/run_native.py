from pathlib import Path
import json,datetime,hashlib,subprocess,os,signal,sys
HERE=Path(__file__).resolve().parent
plan=json.loads((HERE/'EXEC-PLAN.json').read_text());guard=json.loads((HERE/'ROOT-PREFLIGHT.json').read_text())
assert guard['admitted'] and guard['outputs_absent'] and guard['owned_native_absent']
assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime.fromisoformat('2026-10-08T17:00:00+00:00')
for pin in plan['pins']:
 b=Path(pin['path']).read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256']
assert all(not (HERE/n).exists() for n in ['work','RESULT.json','JOB-start.json','JOB.json','native.log'])
job={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'wrapper_pid':os.getpid(),'argv':plan['argv'],'timeout_seconds':240,'timed_out':False}
with (HERE/'native.log').open('x') as log:
 p=subprocess.Popen(plan['argv'],stdout=log,stderr=subprocess.STDOUT,cwd=str(HERE),start_new_session=True)
 job['pid']=p.pid
 with (HERE/'JOB-start.json').open('x') as out:json.dump(job,out,indent=2);out.write('\n')
 try:job['exit_code']=p.wait(timeout=240)
 except subprocess.TimeoutExpired:
  job['timed_out']=True;os.killpg(p.pid,signal.SIGTERM)
  try:job['exit_code']=p.wait(timeout=5)
  except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);job['exit_code']=p.wait()
job['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
if (HERE/'work/ari-middle-volume.blend').is_file():(HERE/'work/ari-middle-volume.blend').chmod(0o444)
with (HERE/'JOB.json').open('x') as out:json.dump(job,out,indent=2);out.write('\n')
print(json.dumps(job,indent=2),flush=True);sys.exit(job['exit_code'])
