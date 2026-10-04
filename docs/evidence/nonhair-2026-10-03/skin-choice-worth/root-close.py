from pathlib import Path
from datetime import datetime, timezone
import hashlib,json,os,struct
root=Path('/Users/robault/GitHub/sugata-avatar'); p=root/'docs/evidence/nonhair-2026-10-03/skin-choice-worth'; started=datetime.now(timezone.utc).isoformat()
h=lambda x:hashlib.sha256(x.read_bytes()).hexdigest()
c=json.loads((p/'CRITIC-PINS.json').read_text()); assert c['passed'] and c['exitCode']==0
assert h(p/'critic-pins.py')==c['sourceSHA256']
for row in c['pins']:
 f=Path(row['path']); assert f.stat().st_size==row['bytes'] and h(f)==row['sha256']
r=json.loads((root/'docs/evidence/nonhair-2026-10-03/skin-finish/archive/capture/report.json').read_text())
assert len(r['images'])==4 and len(c['completeRetainedStates'])==8
fixed=None
for item in r['images']:
 assert item['before']==item['after']; s=item['before']; skin=s['skin']; expected=.34 if s['arm']=='original' else .12
 assert skin['clearcoat']==expected and skin['clearcoatRoughness']==.24 and skin['settings']['secondLobeWeight']==.34
 assert skin['bodyOwner'] and skin['useClearcoat'] and skin['type']=='SkinNodeMaterial'
 assert all(skin[k] is None for k in ['clearcoatNode','clearcoatMap','clearcoatRoughnessNode','clearcoatRoughnessMap'])
 assert s['recipe']==s['actualConfiguration'] and s['recipe']['lighting']=='neutral' and s['recipe']['scene']=='studio'
 other={k:v for k,v in s.items() if k not in ['arm','view','camera','skin']}; other['skin']={k:v for k,v in skin.items() if k!='clearcoat'}
 if fixed is None: fixed=other
 assert fixed==other
 for phase in ['before','after']:
  assert any(x['file']==item['file'] and x['phase']==phase and x['state']==item[phase] for x in c['completeRetainedStates'])
for a,b in [(0,1),(2,3)]: assert r['images'][a]['before']['camera']==r['images'][b]['before']['camera']
assert not r['errors'] and not r['failedResources'] and r['finalPinsUnchanged']
assert r['retirement']['restored']['skin']['clearcoat']==.34 and r['retirement']['disposal']['disposed'] and not r['retirement']['disposal']['leaked']
assert r['cleanup']=={'page':'closed','browser':'closed'}
out={'command':'python3 docs/evidence/nonhair-2026-10-03/skin-choice-worth/root-close.py','pid':os.getpid(),'startUTC':started,'endUTC':datetime.now(timezone.utc).isoformat(),'exitCode':0,'passed':True,'scope':'independent file hashes and all eight archived states, no import/runtime/new image','inputPins':c['pins'],'criticReaderSHA256':h(p/'critic-pins.py'),'criticMetadataSHA256':h(p/'CRITIC-PINS.json'),'worthSHA256':h(p/'WORTH.md'),'rootScriptSHA256':h(Path(__file__))}
with (p/'ROOT-CLOSE.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps({k:out[k] for k in ['pid','startUTC','endUTC','exitCode','passed','worthSHA256','rootScriptSHA256']}));print('pins',len(c['pins']),'states',len(c['completeRetainedStates']),'metadata',h(p/'ROOT-CLOSE.json'))
