from pathlib import Path
from datetime import datetime,timezone
import subprocess,json,hashlib,os
p=Path(__file__).resolve().parent;root=p.parents[3];start=datetime.now(timezone.utc).isoformat();jobs=[]
commands=[['node','packages/core/src/material/SkinFinishOptions.selftest.mjs'],['node','packages/core/src/Avatar.selftest.mjs'],['node','packages/testbed/src/showcase-settings.selftest.mjs'],['node','packages/testbed/src/showcase-colours.selftest.mjs'],['node','--check',str(p/'preview.mjs')]]
for i,cmd in enumerate(commands):
 begun=datetime.now(timezone.utc).isoformat();process=subprocess.Popen(cmd,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT);out=process.communicate(timeout=40)[0];target=p/f'check-{i}.log';target.write_bytes(out)
 row={'command':cmd,'pid':process.pid,'startUTC':begun,'endUTC':datetime.now(timezone.utc).isoformat(),'exitCode':process.returncode,'output':target.name,'outputSHA256':hashlib.sha256(out).hexdigest()};jobs.append(row);print(json.dumps(row))
 if process.returncode:raise RuntimeError('Check failed; full output preserved '+str(target))
names=['packages/core/src/Avatar.js','packages/core/src/material/SkinFinishOptions.js','packages/core/src/material/SkinFinishOptions.selftest.mjs','packages/core/src/material/SkinMaterial.js','packages/testbed/src/showcase-presets.mjs','packages/testbed/src/showcase-settings.selftest.mjs','docs/API.md','looks/sage-lavender-chin.json']
r={'command':'python3 '+str(Path(__file__).relative_to(root)),'pid':os.getpid(),'startUTC':start,'endUTC':datetime.now(timezone.utc).isoformat(),'jobs':jobs,'passed':True,'pins':[{'path':n,'bytes':(root/n).stat().st_size,'sha256':hashlib.sha256((root/n).read_bytes()).hexdigest()} for n in names],'sourceSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'limits':'CPU validation/factory/report and existing contract regressions only; build stub and map-null material do not qualify native rebuild/pixels.'}
with (p/'CHECKS.json').open('x') as f:json.dump(r,f,indent=2);f.write('\n')
print('CHECKS SHA256',hashlib.sha256((p/'CHECKS.json').read_bytes()).hexdigest())
