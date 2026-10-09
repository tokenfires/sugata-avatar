"""Root-owned, single bounded offline section job."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
import json,hashlib,subprocess,datetime,os,time
HERE=Path(__file__).resolve().parent
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
plan=json.loads((HERE/'EXEC-QUERY.json').read_text())
admission=json.loads((HERE/'ROOT-QUERY-PREFLIGHT.json').read_text())
assert admission['admitted'] and admission['exec_sha256']==hashlib.sha256((HERE/'EXEC-QUERY.json').read_bytes()).hexdigest()
for pin in plan['pins']:
    b=Path(pin['path']).read_bytes()
    assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256'],pin['path']
assert not any((HERE/name).exists() for name in ['RESULT.json','fields.npz','JOB-start.json','JOB.json','query.log'])
deadline=datetime.datetime(2026,10,9,7,15,tzinfo=datetime.timezone.utc)
remaining=(deadline-datetime.datetime.now(datetime.timezone.utc)).total_seconds()
assert remaining>0,'Slice deadline elapsed'
allocation=min(120.0,remaining)
start={'deadline_utc':deadline.isoformat(),'allocated_timeout_seconds':allocation,'started_utc':now(),'wrapper_pid':os.getpid(),'command':[sys.executable,str(HERE/'paths.py')],'timeout_seconds':120}
with (HERE/'JOB-start.json').open('x') as f:json.dump(start,f,indent=2)
process=subprocess.Popen(start['command'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1','MPLBACKEND':'Agg'})
start['query_pid']=process.pid
(HERE/'JOB-start.json').write_text(json.dumps(start,indent=2)+'\n')
timed_out=False
try:
    output,_=process.communicate(timeout=min(allocation,max(0.001,(deadline-datetime.datetime.now(datetime.timezone.utc)).total_seconds())))
except subprocess.TimeoutExpired:
    timed_out=True;process.kill();output,_=process.communicate()
assert len(output)<=65536,'Log cap exceeded'
(HERE/'query.log').write_bytes(output)
job={**start,'finished_utc':now(),'exit_code':process.returncode,'timed_out':timed_out,'log_bytes':len(output)}
(HERE/'JOB.json').write_text(json.dumps(job,indent=2)+'\n')
print(output.decode('utf-8','replace'))
print(json.dumps(job))
sys.exit(process.returncode if not timed_out else 124)
