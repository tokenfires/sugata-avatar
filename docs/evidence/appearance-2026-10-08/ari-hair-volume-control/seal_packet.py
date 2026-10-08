from pathlib import Path
import json,hashlib,datetime,stat
P=Path(__file__).resolve().parent
assert (P/'ROOT-READBACK.json').exists(), 'Final independent handoff must be verified before seal'
e=json.loads((P/'EXEC-PLAN.json').read_text())
def pin(f,name):
 b=f.read_bytes();return {'path':name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
for x in e['pins']:
 b=Path(x['path']).read_bytes();assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256']
payload=[]
for f in sorted(P.iterdir()):
 if f.is_file() and f.name!='MANIFEST.json':f.chmod(0o444);payload.append(pin(f,f.name))
local=[]
for f in sorted((P/'work').iterdir()):
 if f.is_file():assert stat.S_IMODE(f.stat().st_mode)==0o444;local.append(pin(f,str(f.relative_to(P))))
manifest={'sealed_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'payloads':payload,'external_or_execution_pins':e['pins'],'local_ignored_readonly_outputs':local,'strict_forehead_passed':False,'candidate_promotion':False,'limits':'One exact-geometry diagnostic only; temporary mass direction retained, provisional contour not final hairline. No current recipe tuning/retry or next construction admitted.'}
with (P/'MANIFEST.json').open('x') as out:json.dump(manifest,out,indent=2);out.write('\n')
(P/'MANIFEST.json').chmod(0o444);print({'payloads':len(payload),'pins':len(e['pins']),'local_ignored_readonly_outputs':len(local),'sealed_utc':manifest['sealed_utc']})
