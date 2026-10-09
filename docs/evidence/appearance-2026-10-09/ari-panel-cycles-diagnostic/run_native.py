"""Checked admission and one collected native process group."""
from pathlib import Path
import json,hashlib,datetime,time,subprocess,os,signal,sys
P=Path(__file__).resolve().parent
E=json.loads((P/'EXEC.json').read_text());A=json.loads((P/'ROOT-PREFLIGHT.json').read_text())
def sha(b):return hashlib.sha256(b).hexdigest()
def write(n,v):
 with (P/n).open('x') as f:json.dump(v,f,indent=2);f.write('\n')
assert A['admitted'] and A['exec_sha256']==sha((P/'EXEC.json').read_bytes())
assert A['critic_sha256']==sha((P/'PREFLIGHT.md').read_bytes())
assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime.fromisoformat(E['launch_before'])
for row in E['pins']:
 b=Path(row['path']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256']
assert Path(E['inputs']['actor']['path']).stat().st_mode&0o222==0
outputs=['ADMISSION.json','JOB-start.json','JOB.json','native.log','RESULT.json','SOURCE-OBSERVED.json','JACKET-OBSERVED.json','RESTORED.json','actor-geometry.npz','private-render','front.png','oblique.png','rear.png','PRE-front.json','PRE-oblique.json','PRE-rear.json','CLEANUP-SOURCE-BEFORE-REMOVAL.json']
assert not any((P/n).exists() for n in outputs)
census=subprocess.run(['ps','-axo','pid,pgid,args'],capture_output=True,check=True).stdout.decode('utf-8',errors='replace')
matches=[]
for line in census.splitlines()[1:]:
 fields=line.split(None,2)
 if len(fields)==3 and fields[2].split(None,1)[0]==E['argv'][0]:matches.append(line)
assert not matches
write('ADMISSION.json',{'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'wrapper_pid':os.getpid(),'decision':'ONE NATIVE DIAGNOSTIC ONLY','exec_sha256':sha((P/'EXEC.json').read_bytes()),'all_pins_exact':True,'first_outputs_absent':True,'native_matches':matches,'census_sha256':sha(census.encode())})
j={'started':datetime.datetime.now(datetime.timezone.utc).isoformat(),'wrapper_pid':os.getpid(),'argv':E['argv'],'timeout_seconds':180,'timed_out':False,'interrupted':False};t=time.monotonic()
with (P/'native.log').open('x') as f:
 launch_utc=datetime.datetime.now(datetime.timezone.utc);assert launch_utc<datetime.datetime.fromisoformat(E['launch_before']) and launch_utc<datetime.datetime.fromisoformat(E['finish_before'])
 child=subprocess.Popen(E['argv'],stdout=f,stderr=subprocess.STDOUT,start_new_session=True,cwd=P,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'});j['native_pid']=child.pid;j['pgid']=child.pid;write('JOB-start.json',j)
 try:j['exit_code']=child.wait(timeout=min(180-(time.monotonic()-t),(datetime.datetime.fromisoformat(E['finish_before'])-datetime.datetime.now(datetime.timezone.utc)).total_seconds()))
 except (subprocess.TimeoutExpired,KeyboardInterrupt) as ex:
  j['timed_out']=isinstance(ex,subprocess.TimeoutExpired);j['interrupted']=isinstance(ex,KeyboardInterrupt);os.killpg(child.pid,signal.SIGKILL);j['exit_code']=child.wait()
j['finished']=datetime.datetime.now(datetime.timezone.utc).isoformat();j['elapsed']=time.monotonic()-t;j['result_exists']=(P/'RESULT.json').is_file();j['passed']=False
if j['result_exists']:
 try:
  result=json.loads((P/'RESULT.json').read_text());j['passed']=bool(result['passed'] and result['post_pins'] and [r['file'] for r in result['outputs']]==['front.png','oblique.png','rear.png'])
 except Exception as ex:j['result_error']=repr(ex)
j['timing']={'launch_before_gate':launch_utc<datetime.datetime.fromisoformat(E['launch_before']),'elapsed_within180':j['elapsed']<=180,'finish_before_gate':datetime.datetime.fromisoformat(j['finished'])<datetime.datetime.fromisoformat(E['finish_before']),'no_timeout_or_interrupt':not j['timed_out'] and not j['interrupted']}
write('JOB.json',j);print(json.dumps(j,indent=2));sys.exit(0 if j['exit_code']==0 and j['passed'] and all(j['timing'].values()) else 1)
