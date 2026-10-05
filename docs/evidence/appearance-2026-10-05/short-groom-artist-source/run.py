"""One bounded owned CPU controller; not run before explicit source admission."""
import json, os, subprocess, sys, time, datetime, hashlib
from pathlib import Path

BASE=Path(__file__).resolve().parent
REQUEST=BASE/'CPU-JOB.requested.json'; RECORD=BASE/'CPU-JOB.json'
request=json.loads(REQUEST.read_text())
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
now=datetime.datetime.now(datetime.timezone.utc)
deadline=datetime.datetime.fromisoformat(request['stop_utc'].replace('Z','+00:00'))
if now>=deadline:raise SystemExit('CPU deadline already passed')
for binding in request['bindings']:
    data=Path(binding['path']).read_bytes()
    if len(data)!=binding['bytes'] or hashlib.sha256(data).hexdigest()!=binding['sha256']:raise SystemExit('Source binding mismatch: '+binding['path'])
record=dict(controller_pid=os.getpid(),started_utc=stamp(),status='running',children=[],budget_seconds=request['budget_seconds'])
with RECORD.open('x') as f:json.dump(record,f,indent=2);f.write('\n')
start=time.monotonic();failed=False
def save():RECORD.write_text(json.dumps(record,indent=2)+'\n')
for command in request['commands']:
    remaining=min(request['budget_seconds']-(time.monotonic()-start),(deadline-datetime.datetime.now(datetime.timezone.utc)).total_seconds())
    if remaining<=0:record['status']='budget stopped';failed=True;break
    child=subprocess.Popen(command,cwd=BASE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    entry=dict(command=command,pid=child.pid,started_utc=stamp(),timeout=False)
    record['children'].append(entry);save()
    try:out,err=child.communicate(timeout=remaining)
    except subprocess.TimeoutExpired:
        entry['timeout']=True;child.terminate()
        try:out,err=child.communicate(timeout=3)
        except subprocess.TimeoutExpired:child.kill();out,err=child.communicate(timeout=3)
    entry.update(returned_utc=stamp(),exit_code=child.returncode,reaped=True,stdout_bytes=len(out),stderr_bytes=len(err))
    prefix='CPU-'+Path(command[-1]).stem
    (BASE/(prefix+'.stdout.txt')).write_bytes(out);(BASE/(prefix+'.stderr.txt')).write_bytes(err)
    entry['stdout_file']=prefix+'.stdout.txt';entry['stderr_file']=prefix+'.stderr.txt';save()
    if child.returncode!=0 or entry['timeout']:failed=True;break
record.update(status='B first CPU refusal' if failed else 'A CPU completed; no native admission',returned_utc=stamp(),elapsed_seconds=time.monotonic()-start)
save();print(json.dumps(record));sys.exit(1 if failed else 0)
