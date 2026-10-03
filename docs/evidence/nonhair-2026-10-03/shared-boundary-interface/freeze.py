"""Preservation only: rehash retained inputs and receipts; no graph/surface evaluator."""
from pathlib import Path
import hashlib,json,datetime,os
p=Path('docs/evidence/nonhair-2026-10-03/shared-boundary-interface')
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda q:hashlib.sha256(q.read_bytes()).hexdigest()
pins=json.loads(Path('docs/evidence/nonhair-2026-10-03/control-net-authorship/INPUTS.json').read_text())
pins['docs/evidence/nonhair-2026-10-03/control-net-authorship/control-net.json']='ee2808f9c4c2a04d6582beee454786dde2c3303e91430a9f259d1158a4982936'
for name,h in pins.items():assert sha(Path(name))==h,name
checks={'interface.json':'e734947c8e594b7396bf5f4359c0979b569d9ead92554a9b9a3d656b69248c2c','author-interface.py':'ac9c7e42d558dc9b3b3b2aecef2a0a563152e37a5d10598c0c5ab0fa90da5e96','AUTHOR-RECEIPT.json':'954013fa9288e20afff04b3bb10897ccb101316bcb7938c165893209a6a15f01','root-readback.py':'11aab0951617b8c37bc3e112fbb4744ec5554e4ece255195fbb64164d2c6a30d','ROOT-READBACK.json':'3b90f84085a1874429c74129587fd7a134b7a29c69e5d23cdee773f71190fa49','critic-reader.py':'b0b96a181beb033129d0322bd407faa103c110214b36b95fde4eff1127e3fbf6','CRITIC-READBACK.json':'dbc747d2cd358120be0b07678c966a52bcfb39d3e638a8a5f303b164b9b9c3cd','CRITIC-POSTFLIGHT.md':'223c292fec7b8bd0314faaa10aeaca84394a69d79b76a9cff8655f14448917ed'}
for name,h in checks.items():assert sha(p/name)==h,name
files={str(q.relative_to(p)):{'sha256':sha(q),'bytes':q.stat().st_size}for q in sorted(p.rglob('*'))if q.is_file()and q.name!='PRESERVATION.json'}
r={'command':'python3 docs/evidence/nonhair-2026-10-03/shared-boundary-interface/freeze.py','pid':os.getpid(),'started':start,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'externalInputs':pins,'files':files,'status':'exact interface/author/root/critic receipts and original inputs unchanged; preservation only','limits':'C0 source qualification only; no surface/native/appearance evaluation'}
(p/'PRESERVATION.json').write_text(json.dumps(r,indent=2)+'\n')
for q in p.rglob('*'):
 if q.is_file():q.chmod(0o444)
p.chmod(0o555)
print(json.dumps({'pid':r['pid'],'started':start,'finished':r['finished'],'files':len(files),'bytes':sum(f['bytes']for f in files.values()),'externalInputs':len(pins),'manifestSHA256':sha(p/'PRESERVATION.json')}))
