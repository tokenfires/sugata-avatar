from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,os,subprocess
root=Path('/Users/robault/GitHub/sugata-avatar');p=root/'docs/evidence/nonhair-2026-10-03/skin-finish-sdk';start=datetime.now(timezone.utc).isoformat();h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
assert subprocess.check_output(['git','rev-parse','--short','HEAD'],cwd=root,text=True).strip()=='8e929e6'
tracked=['packages/core/src/Avatar.js','docs/API.md','packages/testbed/src/showcase-presets.mjs','packages/testbed/src/showcase-settings.selftest.mjs']
checks=json.loads((p/'CHECKS.json').read_text());pins={x['path']:x for x in checks['pins']}
for name in tracked+['packages/core/src/material/SkinFinishOptions.js','packages/core/src/material/SkinFinishOptions.selftest.mjs']:
 assert h(root/name)==pins[name]['sha256'];assert (p/('source-'+Path(name).name)).read_bytes()==(root/name).read_bytes()
assert set(subprocess.check_output(['git','diff','--name-only'],cwd=root,text=True).splitlines())==set(tracked)
patch=subprocess.check_output(['git','diff','--binary','--full-index','--',*tracked],cwd=root)
with (p/'candidate.patch').open('xb') as f:f.write(patch)
for name in ['SkinFinishOptions.js','SkinFinishOptions.selftest.mjs']:
 source=root/'packages/core/src/material'/name;target=p/('candidate-'+name);assert not target.exists();source.rename(target)
startedGit=datetime.now(timezone.utc).isoformat();job=subprocess.Popen(['git','restore','--',*tracked],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT);out=job.communicate()[0];assert job.returncode==0
restored=[]
for name in tracked:
 expected=subprocess.check_output(['git','show','HEAD:'+name],cwd=root);f=root/name;assert f.read_bytes()==expected;restored.append({'path':name,'bytes':len(expected),'sha256':h(f)})
assert not subprocess.check_output(['git','diff','--name-only'],cwd=root,text=True).strip()
r={'command':'python3 '+str(Path(__file__).relative_to(root)),'pid':os.getpid(),'startUTC':start,'endUTC':datetime.now(timezone.utc).isoformat(),'exitCode':0,'passed':True,'entryHEAD':'8e929e6','gitRestore':{'command':['git','restore','--',*tracked],'pid':job.pid,'startUTC':startedGit,'exitCode':job.returncode,'output':out.decode()},'patchSHA256':h(p/'candidate.patch'),'candidateModules':[{'file':'candidate-'+n,'sha256':h(p/('candidate-'+n))} for n in ['SkinFinishOptions.js','SkinFinishOptions.selftest.mjs']],'restored':restored,'scope':'Only root-owned unqualified edits restored exactly; candidates/source snapshots preserved, assets/defaults/unrelated work untouched','sourceSHA256':h(Path(__file__))}
with (p/'RESTORE.json').open('x') as f:json.dump(r,f,indent=2);f.write('\n')
print(json.dumps(r));print('receiptSHA256',h(p/'RESTORE.json'))
