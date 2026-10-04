"""Read final source/CPU receipts only; do not import SDK or execute any tests."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, os, sys
root=Path('/Users/robault/GitHub/sugata-avatar')
packet=root/'docs/evidence/nonhair-2026-10-03/skin-finish-sdk'
start=datetime.now(timezone.utc).isoformat()
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
checks=json.loads((packet/'CHECKS.json').read_bytes())
assert checks['passed'] is True and len(checks['jobs'])==5
names=[root/row['path'] for row in checks['pins']]
for row,p in zip(checks['pins'],names):
    assert p.stat().st_size==row['bytes'] and sha(p)==row['sha256'],row['path']
logs=[]
for row in checks['jobs']:
    assert row['exitCode']==0
    p=packet/row['output']; assert sha(p)==row['outputSHA256'],row['output']
    names.append(p); logs.append({'path':str(p),'command':row['command'],'pid':row['pid'],'startUTC':row['startUTC'],'endUTC':row['endUTC'],'exitCode':row['exitCode'],'sha256':sha(p)})
assert sha(packet/'run-checks.py')==checks['sourceSHA256']
assert sha(packet/'preview.mjs')=='22a1335bab0e52967f4c71a14d165b2ca4feedf70a424c2937a0c7931dc34c91'
names += [packet/n for n in ['PLAN.md','EXECUTION.md','preview.mjs','review.html','CHECKS.json','run-checks.py','CRITIC-CONTRACT.md','CRITIC-PRODUCTION-INITIAL.md']]
pins=[{'path':str(p),'bytes':p.stat().st_size,'sha256':sha(p)} for p in names]
r={'scope':'FS source/log/receipt pins only; no test rerun, syntax/module/material constructor, asset parse, browser or GPU',
   'command':'python3 docs/evidence/nonhair-2026-10-03/skin-finish-sdk/critic-source-pins.py',
   'pid':os.getpid(),'startUTC':start,'endUTC':datetime.now(timezone.utc).isoformat(),'exitCode':0,
   'interpreter':sys.executable,'sourceSHA256':sha(Path(__file__)),'pins':pins,'CPUJobs':logs,
   'cpuLimits':checks['limits'],'passed':True}
out=packet/'CRITIC-SOURCE-PINS.json'
with out.open('x') as f: json.dump(r,f,indent=2); f.write('\n')
print(json.dumps({k:r[k] for k in ['pid','startUTC','endUTC','exitCode','sourceSHA256','passed']}))
print('receiptSHA256',sha(out),'pins',len(pins))
print('FINAL_PREVIEW_HTML_PLAN',json.dumps([p for p in pins if p['path'].endswith(('preview.mjs','review.html','PLAN.md','EXECUTION.md'))],indent=2))
