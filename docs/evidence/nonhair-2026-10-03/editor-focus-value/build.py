import subprocess,pathlib,datetime,json,os,hashlib
p=pathlib.Path('docs/evidence/nonhair-2026-10-03/editor-focus-value');start=datetime.datetime.now(datetime.timezone.utc).isoformat();command=['npm','run','build:pages']
with (p/'build-pages.log').open('w')as f:
 job=subprocess.Popen(command,stdout=f,stderr=subprocess.STDOUT);code=job.wait(timeout=60)
r=dict(supervisorPID=os.getpid(),pid=job.pid,started=start,finished=datetime.datetime.now(datetime.timezone.utc).isoformat(),command=command,exitCode=code,logSHA256=hashlib.sha256((p/'build-pages.log').read_bytes()).hexdigest(),scope='pages bundle only; not actual AX/speech/appearance qualification');(p/'BUILD-JOB.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r));raise SystemExit(code)
