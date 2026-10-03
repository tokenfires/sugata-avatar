import subprocess,pathlib,datetime,json,os,hashlib,signal
p=pathlib.Path('docs/evidence/nonhair-2026-10-03/editor-focus-value');start=datetime.datetime.now(datetime.timezone.utc).isoformat();command=['node','tools/critic/clothing-descriptions.mjs'];r=dict(supervisorPID=os.getpid(),started=start,command=command,status='running');q=p/'NATIVE-JOB.json'
with (p/'native.log').open('w')as f:
 job=subprocess.Popen(command,stdout=f,stderr=subprocess.STDOUT,start_new_session=True);r['pid']=job.pid;q.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r),flush=True)
 try:code=job.wait(timeout=140)
 except subprocess.TimeoutExpired:
  r['supervisorTimeout']=True;os.killpg(job.pid,signal.SIGTERM)
  try:code=job.wait(timeout=10)
  except subprocess.TimeoutExpired:os.killpg(job.pid,signal.SIGKILL);code=job.wait()
r.update(finished=datetime.datetime.now(datetime.timezone.utc).isoformat(),exitCode=code,status='collected',logSHA256=hashlib.sha256((p/'native.log').read_bytes()).hexdigest());q.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r),flush=True);raise SystemExit(code)
