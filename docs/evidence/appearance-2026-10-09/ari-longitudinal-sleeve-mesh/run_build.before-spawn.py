from pathlib import Path
import datetime,hashlib,json,os,signal,subprocess,sys,time
P=Path(__file__).resolve().parent;E=json.loads((P/'EXEC.json').read_text());A=json.loads((P/'ROOT-PREFLIGHT.json').read_text())
def sha(b):return hashlib.sha256(b).hexdigest()
def now():return datetime.datetime.now(datetime.timezone.utc)
def write(n,v):
 with (P/n).open('x') as f:json.dump(v,f,indent=2);f.write('\n')
assert A['admitted'] and A['exec_sha256']==sha((P/'EXEC.json').read_bytes()) and A['critic_sha256']==sha((P/'PREFLIGHT.md').read_bytes())
assert str(Path(sys.executable).resolve())==E['python'] and now()<datetime.datetime.fromisoformat(E['launch_before'])
for r in E['pins']:
 b=Path(r['path']).read_bytes();assert len(b)==r['bytes'] and sha(b)==r['sha256']
assert not any((P/n).exists() for n in E['first_outputs'])
census=subprocess.check_output(['ps','-axo','pid,pgid,args']).decode('utf-8',errors='replace');matches=[]
for l in census.splitlines()[1:]:
 fields=l.split(None,2)
 if len(fields)==3 and fields[0]!=str(os.getpid()) and fields[2].split(None,1)[0]==E['python'] and str(P) in fields[2]:matches.append(l)
assert not matches
write('ADMISSION.json',{'utc':now().isoformat(),'wrapper_pid':os.getpid(),'exec_sha256':sha((P/'EXEC.json').read_bytes()),'preflight_sha256':sha((P/'PREFLIGHT.md').read_bytes()),'all_pins_exact':True,'first_outputs_absent':True,'scoped_matches':matches,'census_sha256':sha(census.encode()),'decision':'ONE GEOMETRY ONLY BUILD'})
child=None;start=None;j={'wrapper_pid':os.getpid(),'child_pid':None,'started':None,'cap_seconds':60,'timed_out':False,'interrupted':False,'command':[E['python'],str(P/'build.py')]}
try:
 with (P/'build.log').open('x') as log:
  launched=now();assert launched<datetime.datetime.fromisoformat(E['launch_before']) and launched<datetime.datetime.fromisoformat(E['finish_by']);start=time.monotonic();j['started']=launched.isoformat();child=subprocess.Popen(j['command'],stdout=log,stderr=subprocess.STDOUT,start_new_session=True,cwd=P,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'});j['child_pid']=child.pid;j['pgid']=child.pid;write('JOB-start.json',j)
  try:j['exit_code']=child.wait(timeout=max(0,min(60-(time.monotonic()-start),(datetime.datetime.fromisoformat(E['finish_by'])-now()).total_seconds())))
  except subprocess.TimeoutExpired:j['timed_out']=True;os.killpg(child.pid,signal.SIGKILL);j['exit_code']=child.wait()
except BaseException as ex:
 j['interrupted']=True;j['error']={'type':type(ex).__name__,'message':str(ex)}
 if child and child.poll() is None:os.killpg(child.pid,signal.SIGKILL);child.wait()
 j['exit_code']=child.returncode if child else None
finally:
 j['finished']=now().isoformat();j['elapsed']=time.monotonic()-start if start is not None else None;j['timing']={'launch_before_gate':j['started'] is not None and datetime.datetime.fromisoformat(j['started'])<datetime.datetime.fromisoformat(E['launch_before']),'wall60':j['elapsed'] is not None and j['elapsed']<=60,'absolute_finish':now()<datetime.datetime.fromisoformat(E['finish_by']),'no_timeout_or_interrupt':not j['timed_out'] and not j['interrupted']};j['worker_passed']=False
 if (P/'RESULT.json').is_file():
  try:r=json.loads((P/'RESULT.json').read_text());j['worker_passed']=bool(r['passed'] and r['post_pins'] and r['raw_geometry_preserved'])
  except Exception as ex:j['result_error']=repr(ex)
 write('JOB.json',j);print(json.dumps(j,indent=2))
sys.exit(0 if j.get('exit_code')==0 and j['worker_passed'] and all(j['timing'].values()) else 1)
