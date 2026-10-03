"""Preservation-only exact input/source/refusal/forensic rehash; no builder evaluation."""
from pathlib import Path
import json,hashlib,os,datetime
p=Path('docs/evidence/nonhair-2026-10-03/whole-head-volume');start=datetime.datetime.now(datetime.timezone.utc).isoformat();sha=lambda q:hashlib.sha256(q.read_bytes()).hexdigest()
b=json.loads((p/'BUILD-RECEIPT.json').read_text());s=json.loads((p/'SUPERVISOR-RECEIPT.json').read_text());pins=dict(b['pins']);pins.update(json.loads(Path('docs/evidence/nonhair-2026-10-03/control-net-authorship/INPUTS.json').read_text()))
assert sha(p/'BUILD-RECEIPT.json')==s['innerReceipt']=='2c3523941089801e9130740721c153ff3bc1eaee017b9fa3b5ae945064ddd271'
assert s['workerRetired']and s['pass']==False and s['timedOut']==False and s['workerExitCode']==2
for name,h in pins.items():assert sha(Path(name))==h,name
checks={'SUPERVISOR-RECEIPT.json':'682556a726e7d0d85a25bf65493ef29f1704a3e4570863423e125474b1ec1333','ROOT-WITNESS.json':'357e179fd3ca21b096d001134fa2bbbe0b976ffeb0489e25e848f5416f03f131','CRITIC-POSTFLIGHT.md':'5e65bf334d170fc3fa3b0d247aad070db22395678ee64486371e906a7fca2152','CRITIC-TOPOLOGY-READBACK.json':'8867513ae00efdc3dc9f3d91027e54cea7b3d25c2ff96adde8d77aef2ea83434','critic-topology-reader.py':'3ec22b26b7d9ca0ee2eef759029ef5a0c399c6d032dd0b930b54996d24d5f6ad','root-witness.py':'851b664a37966014066bcbda60f27a4b1b5be7f09c4e07be8fc0227e981feeab'}
for name,h in checks.items():assert sha(p/name)==h,name
assert all(not(p/name).exists()for name in ['mesh.json','positions.f32','indices.u32','normals.f32'])and not Path('captures/whole-head-volume-2026-10-03-v1').exists()
files={str(q.relative_to(p)):{'sha256':sha(q),'bytes':q.stat().st_size}for q in sorted(p.rglob('*'))if q.is_file()and q.name!='PRESERVATION.json'}
r={'pid':os.getpid(),'command':'python3 docs/evidence/nonhair-2026-10-03/whole-head-volume/freeze.py','started':start,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':files,'externalInputs':pins,'nativeSourceSHA256':sha(Path('tools/critic/whole-head-volume.mjs')),'status':'exact refused single CPU candidate/source/receipts retained; no repair/export/native/appearance','limits':'Original CPU arrays not exported; separate index-only source witness, no position/surface reevaluation'}
(p/'PRESERVATION.json').write_text(json.dumps(r,indent=2)+'\n')
for q in p.rglob('*'):
 if q.is_file():q.chmod(0o444)
for q in sorted(p.rglob('*'),reverse=True):
 if q.is_dir():q.chmod(0o555)
p.chmod(0o555);Path('tools/critic/whole-head-volume.mjs').chmod(0o444)
print(json.dumps({'pid':r['pid'],'started':start,'finished':r['finished'],'files':len(files),'bytes':sum(x['bytes']for x in files.values()),'pins':len(pins),'manifestSHA256':sha(p/'PRESERVATION.json')}))
