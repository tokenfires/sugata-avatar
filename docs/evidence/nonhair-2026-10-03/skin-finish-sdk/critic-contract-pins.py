"""Saved-first filesystem contract pins; no SDK import or runtime."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, os
root=Path('/Users/robault/GitHub/sugata-avatar')
packet=root/'docs/evidence/nonhair-2026-10-03/skin-finish-sdk'
start=datetime.now(timezone.utc).isoformat()
paths=['docs/evidence/nonhair-2026-10-03/skin-finish-sdk/PLAN.md','docs/evidence/nonhair-2026-10-03/skin-choice-worth/WORTH.md','docs/evidence/nonhair-2026-10-03/skin-choice-worth/CRITIC-PINS.json','packages/core/src/Avatar.js','packages/core/src/material/SkinMaterial.js']
pins=[]
for name in paths:
    p=root/name; b=p.read_bytes(); pins.append({'path':str(p),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
source=Path(__file__).read_bytes()
r={'scope':'Contract-stage FS pins only, not final edited source or execution admission','command':'python3 docs/evidence/nonhair-2026-10-03/skin-finish-sdk/critic-contract-pins.py','pid':os.getpid(),'startUTC':start,'endUTC':datetime.now(timezone.utc).isoformat(),'exitCode':0,'sourceSHA256':hashlib.sha256(source).hexdigest(),'pins':pins}
out=packet/'CRITIC-CONTRACT-PINS.json'
with out.open('x') as f: json.dump(r,f,indent=2); f.write('\n')
print(json.dumps({k:r[k] for k in ['pid','startUTC','endUTC','exitCode','sourceSHA256']}));print('receiptSHA256',hashlib.sha256(out.read_bytes()).hexdigest())
