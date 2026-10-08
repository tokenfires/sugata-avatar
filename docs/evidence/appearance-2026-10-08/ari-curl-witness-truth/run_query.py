from pathlib import Path
import json,hashlib,datetime,subprocess,os,signal,sys
P=Path(__file__).resolve().parent;e=json.loads((P/'EXEC-PLAN.json').read_text());g=json.loads((P/'ROOT-PREFLIGHT.json').read_text())
assert g['admitted'] and g['outputs_absent'] and g['owned_query_absent']
assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime.fromisoformat('2026-10-08T19:10:00+00:00')
for r in e['pins']:
 b=Path(r['path']).read_bytes();assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256']
assert not any((P/n).exists() for n in ['RESULT.json','JOB-start.json','JOB.json','query.log'])
j={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'wrapper_pid':os.getpid(),'argv':e['argv'],'timeout_seconds':90,'timed_out':False}
env=os.environ.copy();env['PYTHONDONTWRITEBYTECODE']='1'
with (P/'query.log').open('x') as f:
 c=subprocess.Popen(e['argv'],stdout=f,stderr=subprocess.STDOUT,cwd=str(P),env=env,start_new_session=True);j['pid']=c.pid
 with (P/'JOB-start.json').open('x') as start:json.dump(j,start,indent=2);start.write('\n')
 try:j['exit_code']=c.wait(timeout=90)
 except subprocess.TimeoutExpired:
  j['timed_out']=True;os.killpg(c.pid,signal.SIGTERM)
  try:j['exit_code']=c.wait(timeout=5)
  except subprocess.TimeoutExpired:os.killpg(c.pid,signal.SIGKILL);j['exit_code']=c.wait()
j['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
with (P/'JOB.json').open('x') as final:json.dump(j,final,indent=2);final.write('\n')
print(json.dumps(j,indent=2));sys.exit(j['exit_code'])
