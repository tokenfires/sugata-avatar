"""Single externally accounted author invocation; no retry."""
from pathlib import Path
import datetime, hashlib, json, os, subprocess, sys
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def pin(p):
 b=p.read_bytes();return {'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
r={'pid':os.getpid(),'started':now(),'command':[sys.executable,str(HERE/'author.py')],'timeoutSeconds':20,'child':None}
try:
 for p in json.loads((HERE/'SOURCE-INPUTS.json').read_text())['sources']:
  if pin(ROOT/p['path'])!={k:p[k] for k in ['bytes','sha256']}:raise ValueError('Source pin changed')
 if datetime.datetime.now(datetime.timezone.utc)>=datetime.datetime.fromisoformat('2026-10-04T23:12:00+00:00'):raise ValueError('Author gate expired')
 with (HERE/'stdout.txt').open('wb') as out,(HERE/'stderr.txt').open('wb') as err:
  child=subprocess.Popen(r['command'],cwd=ROOT,stdout=out,stderr=err);r['child']=child.pid;r['childStarted']=now()
  try:r['childExit']=child.wait(timeout=20)
  except subprocess.TimeoutExpired:child.kill();r['timeout']=True;r['childExit']=child.wait()
  r['childReturned']=now()
except Exception as e:r['error']=str(e)
r['returned']=now();r['outputs']={n:pin(HERE/n) for n in ['stdout.txt','stderr.txt','JOB.json','PARTIAL.json','PARTITION.json','WORKSHEET.md'] if (HERE/n).exists()}
(HERE/'RUN.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
sys.exit(0 if r.get('childExit')==0 and not r.get('timeout') and not r.get('error') else 1)
