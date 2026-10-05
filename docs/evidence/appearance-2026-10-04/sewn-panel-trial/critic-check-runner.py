"""Exactly one saved-data checker with a 30-second external limit."""
import datetime,hashlib,json,os,pathlib,subprocess,sys
T=pathlib.Path(__file__).resolve().parent
def now():return datetime.datetime.now(datetime.UTC).isoformat()
def pin(p):
 b=p.read_bytes();return {'path':str(p),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
record={'pid':os.getpid(),'started':now(),'command':[sys.executable,'-B',str(T/'critic-check.py')],'maximumInvocations':1,'wallLimitSeconds':30,'checker':pin(T/'critic-check.py'),'status':'launching'}
with (T/'CRITIC-CHECK-JOB.json').open('x') as f:json.dump(record,f,indent=2)
try:
 with (T/'CRITIC-CHECK-STDOUT.txt').open('xb') as out,(T/'CRITIC-CHECK-STDERR.txt').open('xb') as err:
  result=subprocess.run(record['command'],cwd=T,stdout=out,stderr=err,timeout=30,check=False)
  record.update(status='complete' if result.returncode==0 else 'refused',exitCode=result.returncode)
except BaseException as e:record.update(status='wrapper-refused',exception=repr(e))
finally:
 record['fullReturn']=now();record['outputs']=[pin(T/n) for n in ('CRITIC-CHECK.json','CRITIC-CHECK-STDOUT.txt','CRITIC-CHECK-STDERR.txt') if (T/n).exists()]
 (T/'CRITIC-CHECK-JOB.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
raise SystemExit(0 if record['status']=='complete' else 1)
