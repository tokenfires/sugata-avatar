"""Only filesystem pins and retained Neutral-state metadata; no native/material execution."""
from pathlib import Path
import datetime, hashlib, json, os, struct, sys
R=Path('/Users/robault/GitHub/sugata-avatar')
P=R/'docs/evidence/nonhair-2026-10-03/skin-lighting-value'
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
pins={}
def pin(p,expected=None):
 h=hashlib.sha256(p.read_bytes()).hexdigest()
 if expected is not None:assert h==expected,(str(p),h,expected)
 pins[str(p.relative_to(R))]=h
 return h
declared=json.loads((P/'ROOT-INPUTS.json').read_text())['pins']
for name,h in declared.items():pin(R/name,h)
assert len(declared)==17
pin(P/'ROOT-INPUTS.json')
A=R/'docs/evidence/nonhair-2026-10-03/skin-finish'
pin(A/'ARCHIVE-RECEIPT.json')
report=A/'archive/capture/report.json'
pin(report,'acb884858d91bbcfdb8e91d792d4a2438f27fb59b914d615ea9e7bbf08339aeb')
r=json.loads(report.read_text());states=[];images=[]
for image in r['images']:
 p=A/'archive/capture'/image['file'];pin(p,image['sha256'])
 b=p.read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n'
 size=list(struct.unpack('>II',b[16:24]));assert size==[1440,1000]
 images.append({'file':str(p.relative_to(R)),'dimensions':size,'sha256':pins[str(p.relative_to(R))]})
 for label in ['before','after']:
  s=image[label];c=s['actualConfiguration'];skin=s['skin']
  assert c['scene']=='studio' and c['lighting']=='neutral'
  assert skin['bodyOwner'] is True and skin['useClearcoat'] is True
  assert skin['clearcoat']==(.12 if image['file'].startswith('candidate') else .34)
  assert skin['clearcoatRoughness']==.24
  states.append({'file':image['file'],'state':label,'scene':c['scene'],'lighting':c['lighting'],
                 'actualWeight':skin['clearcoat'],'roughness':skin['clearcoatRoughness']})
assert len(images)==4 and len(states)==8
result={'status':'pins-and-retained-Neutral-metadata-agree','pid':os.getpid(),'started':start,
 'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'interpreter':sys.executable,'version':sys.version,
 'command':'python3 docs/evidence/nonhair-2026-10-03/skin-lighting-value/critic-pin-reader.py',
 'readerSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'pins':pins,'images':images,'states':states,
 'limits':['Only declared filesystem targets and retained state metadata, not an independent renderer audit.',
           'Four skin originals are actually visually inspected separately; Epic example is pinned only in this step.',
           'No current Kitchen0.12 render/skin setter/material constructor/parser/evaluator or new experiment executed.',
           'An earlier optional cases-key metadata display returned no witness; these records use actual report.images.']}
target=P/'CRITIC-PIN-RECEIPT.json'
with target.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps({'status':result['status'],'pid':result['pid'],'started':result['started'],'finished':result['finished'],
 'readerSHA256':result['readerSHA256'],'receiptSHA256':hashlib.sha256(target.read_bytes()).hexdigest(),'pins':len(pins)}))
