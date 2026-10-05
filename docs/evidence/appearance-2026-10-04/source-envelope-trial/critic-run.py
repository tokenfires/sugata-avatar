"""External sole saved-data checker owner; at most60s computation,5s forced collection."""
import datetime,hashlib,json,os,pathlib,subprocess,sys,traceback
BASE=pathlib.Path(__file__).resolve().parent
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
def pin(p):
 p=pathlib.Path(p);r=p.read_bytes();return {'path':str(p),'bytes':len(r),'sha256':hashlib.sha256(r).hexdigest()}
def main():
 if now()>='2026-10-05T01:03:34.724705+00:00':raise ValueError('checker collection margin expired')
 names=['CRITIC-CHECK.json','CRITIC-COMPONENTS.u32','CRITIC-CHECK-JOB.json','CRITIC-CHECK-STDOUT.txt','CRITIC-CHECK-STDERR.txt']
 if any((BASE/n).exists() for n in names):raise ValueError('sole independent checker already attempted')
 job={'runnerPid':os.getpid(),'startedUTC':now(),'wallLimitSeconds':60,'command':[sys.executable,'-B',str(BASE/'critic-check.py')],'source':pin(BASE/'critic-check.py'),'wrapper':pin(__file__)}
 child=None;code=1
 with (BASE/'CRITIC-CHECK-JOB.json').open('x') as f:json.dump(job,f,indent=2)
 try:
  with (BASE/'CRITIC-CHECK-STDOUT.txt').open('xb') as stdout,(BASE/'CRITIC-CHECK-STDERR.txt').open('xb') as stderr:
   child=subprocess.Popen(job['command'],cwd='/Users/robault/GitHub/sugata-avatar',stdout=stdout,stderr=stderr)
   job.update(childPid=child.pid,launchedUTC=now())
   try:code=child.wait(timeout=60)
   except subprocess.TimeoutExpired:
    job['timeoutObservedUTC']=now();child.kill();code=child.wait(timeout=5);job['timeout']=True
 except BaseException as e:
  job.update(exception=repr(e),traceback=traceback.format_exc())
  if child is not None and child.poll() is None:child.kill();child.wait(timeout=5)
 finally:
  job.update(exitCode=code,fullReturnUTC=now(),outputs=[pin(BASE/n) for n in names if n!='CRITIC-CHECK-JOB.json' and (BASE/n).is_file()])
  (BASE/'CRITIC-CHECK-JOB.json').write_text(json.dumps(job,indent=2)+'\n')
  print(json.dumps(job),flush=True)
 return 0 if code==0 and not job.get('timeout') and not job.get('exception') else 1
if __name__=='__main__':raise SystemExit(main())
