from pathlib import Path
import json,hashlib,datetime,subprocess,os,signal,sys
P=Path(__file__).resolve().parent;e=json.loads((P/'EXEC-PLAN.json').read_text());g=json.loads((P/'ROOT-PREFLIGHT.json').read_text());assert g['admitted'] and g['outputs_absent'] and g['owned_native_absent']
assert hashlib.sha256((P/'EXEC-PLAN.json').read_bytes()).hexdigest()==g['exec_sha256']
assert hashlib.sha256(Path(__file__).read_bytes()).hexdigest()==g['wrapper_sha256']
assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime.fromisoformat(e['launch_before'])
for r in e['pins']:
 b=Path(r['path']).read_bytes();assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256']
assert not any((P/n).exists() for n in ['work','DESCRIPTOR-REFUSAL.json','RNA-DESCRIPTORS.json','COLD-OBSERVED.json','COLD.json','CLEANUP-OBSERVED.json','CLEANUP.json','LIGHTING.json','RESULT.json','JOB-start.json','JOB.json','native.log']) and not list(P.glob('*.png'))
j={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'wrapper_pid':os.getpid(),'argv':e['argv'],'timeout_seconds':240,'timed_out':False};env=os.environ.copy();env['PYTHONDONTWRITEBYTECODE']='1'
with (P/'native.log').open('x') as out:
 c=subprocess.Popen(e['argv'],stdout=out,stderr=subprocess.STDOUT,cwd=str(P),env=env,start_new_session=True);j['pid']=c.pid
 with (P/'JOB-start.json').open('x') as f:json.dump(j,f,indent=2);f.write('\n')
 try:j['exit_code']=c.wait(timeout=240)
 except subprocess.TimeoutExpired:
  j['timed_out']=True;os.killpg(c.pid,signal.SIGTERM)
  try:j['exit_code']=c.wait(timeout=5)
  except subprocess.TimeoutExpired:os.killpg(c.pid,signal.SIGKILL);j['exit_code']=c.wait()
j['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
for f in P.glob('*.png'):f.chmod(0o444)
with (P/'JOB.json').open('x') as f:json.dump(j,f,indent=2);f.write('\n')
print(json.dumps(j,indent=2));sys.exit(j['exit_code'])
