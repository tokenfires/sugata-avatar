from pathlib import Path
import json,hashlib,datetime
P=Path(__file__).resolve().parent
assert (P/'ROOT-READBACK.json').exists()
def pin(f,name):
 h=hashlib.sha256()
 with f.open('rb') as source:
  while True:
   chunk=source.read(8*1024*1024)
   if not chunk:break
   h.update(chunk)
 return {'path':name,'bytes':f.stat().st_size,'sha256':h.hexdigest()}
e=json.loads((P/'EXEC-PLAN.json').read_text())
for x in e['pins']:assert pin(Path(x['path']),x['path'])==x
payload=[]
for f in sorted(P.iterdir()):
 if f.is_file() and f.name!='MANIFEST.json':f.chmod(0o444);payload.append(pin(f,f.name))
assert not list(P.glob('*.png')) and not (P/'work').exists()
m={'sealed_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'payloads':payload,'execution_pins':e['pins'],'native_attempts':1,'readonly':True,'no_palette_retry':True,'candidate_qualification':False,'witness':'Missingonly unusedMaterial; fullmechanism/source/artist qualification not inferred','nextscope':'Explicit source-owned persistence contract nomination only; no further operation admitted'}
with (P/'MANIFEST.json').open('x') as out:json.dump(m,out,indent=2);out.write('\n')
(P/'MANIFEST.json').chmod(0o444);print({'payloads':len(payload),'pins':len(e['pins']),'sealed_utc':m['sealed_utc']})
