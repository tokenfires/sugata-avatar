"""Preservation only; no graph, surface or native evaluation."""
from pathlib import Path
import hashlib,json,datetime,os
p=Path('docs/evidence/nonhair-2026-10-03/cell-fan-contract')
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda q:hashlib.sha256(q.read_bytes()).hexdigest()
a=json.loads((p/'AUTHOR-RECEIPT.json').read_text())
for name,h in a['pins'].items():assert sha(Path(name))==h,name
checks={'author.py':a['authorSHA256'],'topology.json':a['topologySHA256'],'AUTHOR-RECEIPT.json':'efa07365b6b6b26adc1438cdc363611d46ba21722e6d3dded9cc32e1c3759cc5','root-readback.py':'4bb71a637a4b4dbb26133bf72232a82956587832b71fbc43213a3c8ecf54a141','reader-history/root-before-receipt-fix.py':'a92145c62437bd08f899b8d246dd41d289b16c0c4ace32f19e5f27642b88753e','critic-symbolic-reader.py':'78f73cbd029f60604b1afa56d9871ba1045fa9c97126c26d0da0df43a76f957f','CRITIC-READBACK.json':'c26d45d8d0dc90249231a831ed6a81594c285f7c400f2ea9b75ca3026ba94bca','CRITIC-POSTFLIGHT.md':'6f88eeefff4ea94a494b2e1d61f83310a870f4aee6284490686ff278118bb7fd'}
for name,h in checks.items():assert sha(p/name)==h,name
files={str(q.relative_to(p)):{'sha256':sha(q),'bytes':q.stat().st_size}for q in sorted(p.rglob('*'))if q.is_file()and q.name!='PRESERVATION.json'}
r={'command':'python3 docs/evidence/nonhair-2026-10-03/cell-fan-contract/freeze.py','pid':os.getpid(),'started':start,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'externalInputs':a['pins'],'checks':checks,'files':files,'status':'exact symbolic output/source/readers/receipts/input pins retained; preservation only','limits':'abstract topology only; no geometry or appearance qualification'}
(p/'PRESERVATION.json').write_text(json.dumps(r,indent=2)+'\n')
for q in p.rglob('*'):
 if q.is_file():q.chmod(0o444)
p.chmod(0o555)
print(json.dumps({'pid':r['pid'],'started':start,'finished':r['finished'],'files':len(files),'bytes':sum(f['bytes']for f in files.values()),'externalInputs':len(a['pins']),'manifestSHA256':sha(p/'PRESERVATION.json')}))
