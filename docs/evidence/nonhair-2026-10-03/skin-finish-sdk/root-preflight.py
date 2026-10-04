from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,os,subprocess
root=Path('/Users/robault/GitHub/sugata-avatar');p=root/'docs/evidence/nonhair-2026-10-03/skin-finish-sdk';start=datetime.now(timezone.utc).isoformat();h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
assert datetime.now(timezone.utc)<datetime.fromisoformat('2026-10-04T05:52:00+00:00')
c=json.loads((p/'CHECKS.json').read_text());assert c['passed'] and all(j['exitCode']==0 for j in c['jobs'])
for row in c['pins']:
 f=root/row['path'];assert h(f)==row['sha256'] and f.stat().st_size==row['bytes']
for job in c['jobs']:assert h(p/job['output'])==job['outputSHA256']
k=json.loads((p/'CRITIC-SOURCE-PINS.json').read_text())
assert k['exitCode']==0
for row in k['pins']:
 f=Path(row['path']);assert h(f)==row['sha256'] and f.stat().st_size==row['bytes']
assert h(p/'critic-source-pins.py')==k['sourceSHA256']
assert h(root/'packages/core/src/material/SkinMaterial.js')=='cc70579edf2686db953d9c413e40403f6d1135d18eef3a7353e45637abf24164'
preview=(p/'preview.mjs').read_text();avatar=(root/'packages/core/src/Avatar.js').read_text();helper=(root/'packages/core/src/material/SkinFinishOptions.js').read_text()
assert h(p/'preview.mjs')=='22a1335bab0e52967f4c71a14d165b2ca4feedf70a424c2937a0c7931dc34c91'
assert preview.index('log.creations.push')<preview.index('validate(report,finish)')
assert preview.index('log.states.push(item)')<preview.index('validate(before,finish)')
assert 'Promise.race' not in preview and 'stage.draw(' not in preview and 'await a.step(0)' in preview
assert "...skinFinishMaterialOptions( this.skinFinish )" in avatar and "settings: { secondLobeWeight: 0.12 }" in helper
assert 'secondLobeRoughness:' not in helper and '? {}' in helper
for name in ['packages/core/src/Avatar.js','packages/core/src/material/SkinFinishOptions.js','packages/core/src/material/SkinFinishOptions.selftest.mjs','packages/testbed/src/showcase-presets.mjs','packages/testbed/src/showcase-settings.selftest.mjs','docs/API.md']:
 target=p/('source-'+Path(name).name);target.write_bytes((root/name).read_bytes());target.chmod(0o444)
syntax=subprocess.run(['node','--check',str(p/'preview.mjs')],cwd=root,capture_output=True);assert syntax.returncode==0
r={'command':'python3 '+str(Path(__file__).relative_to(root)),'pid':os.getpid(),'startUTC':start,'endUTC':datetime.now(timezone.utc).isoformat(),'exitCode':0,'passed':True,'checksSHA256':h(p/'CHECKS.json'),'criticSHA256':h(p/'CRITIC-SOURCE.md'),'criticReaderSHA256':h(p/'critic-source-pins.py'),'criticMetadataSHA256':h(p/'CRITIC-SOURCE-PINS.json'),'currentPins':k['pins'],'sourceSnapshots':[{'file':f.name,'bytes':f.stat().st_size,'sha256':h(f)} for f in sorted(p.glob('source-*'))],'syntaxExitCode':syntax.returncode,'scope':'Current literal/source/tests/critic pin reconciliation before sole native open; no asset parse/native/GPU/pixel qualification','sourceSHA256':h(Path(__file__))}
with (p/'ROOT-PREFLIGHT.json').open('x') as f:json.dump(r,f,indent=2);f.write('\n')
print(json.dumps({z:r[z] for z in ['pid','startUTC','endUTC','passed','sourceSHA256']}));print('pins',len(k['pins']),'receiptSHA',h(p/'ROOT-PREFLIGHT.json'))
