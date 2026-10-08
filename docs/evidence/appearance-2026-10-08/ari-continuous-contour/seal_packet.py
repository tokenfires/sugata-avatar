from pathlib import Path
import json,hashlib,datetime
P=Path(__file__).resolve().parent
assert (P/'ROOT-READBACK.json').exists()
def pin(f,name):
 b=f.read_bytes();return {'path':name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
inputs=json.loads((P/'INPUTS.json').read_text())
for x in inputs:
 b=Path(x['path']).read_bytes();assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256']
assert not (P/'work').exists() and not list(P.glob('*.png')) and not (P/'JOB.json').exists()
payload=[]
for f in sorted(P.iterdir()):
 if f.is_file() and f.name!='MANIFEST.json':f.chmod(0o444);payload.append(pin(f,f.name))
m={'sealed_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'payloads':payload,'external_inputs':inputs,'native_attempts':0,'source_envelope_refused':True,'candidate_promotion':False,'appearance':'UNKNOWN; no new image','limits':'Fixed scalar contour recipe closed. Continuous source ledger is not a qualified hairline/appearance improvement. No retry/exception/current coefficient tweak.'}
with (P/'MANIFEST.json').open('x') as out:json.dump(m,out,indent=2);out.write('\n')
(P/'MANIFEST.json').chmod(0o444);print({'payloads':len(payload),'external_inputs':len(inputs),'native_attempts':0,'sealed_utc':m['sealed_utc']})
