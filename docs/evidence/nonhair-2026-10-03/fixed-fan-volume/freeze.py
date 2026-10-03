"""Preservation only: exact files/pins/copies, no topology/geometry/capture work."""
from pathlib import Path
import json,hashlib,datetime,os,shutil
p=Path('docs/evidence/nonhair-2026-10-03/fixed-fan-volume');raw=Path('captures/fixed-fan-volume-2026-10-03-v1');start=datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda q:hashlib.sha256(Path(q).read_bytes()).hexdigest()
pins={}
for n,key in [('BUILD-RECEIPT.json','pins'),('CRITIC-CPU-READBACK.json','pins'),('CRITIC-NATIVE-READBACK.json','pins')]:
 for q,h in json.loads((p/n).read_text())[key].items():assert sha(q)==h,q;pins[q]=h
native=json.loads((raw/'report.json').read_text())
for q,h in(native['sources']|native['inputs']).items():assert sha(q)==h,q;pins[q]=h
assert sha(p/'CRITIC-POSTFLIGHT.md')=='169efa8ef163abedc5d35ea7cd9b04f234d1e3f1f7793bd99f00ef848fbda22d'
assert sha(raw/'report.json')=='8c37282c8fbb5c629d6bc28989685abeaa0e9c78784ef3cac9ed33cf0cbda083'
assert sha('tools/critic/fixed-fan-volume.mjs')==native['instrumentSHA256']
archive=p/'archive/capture';archive.mkdir(parents=True);copies=[]
for q in sorted(raw.iterdir()):
 assert q.is_file()and q.name in ['report.json','instrument.mjs'];d=archive/q.name;shutil.copyfile(q,d);assert sha(q)==sha(d);copies.append({'source':str(q),'copy':str(d),'bytes':q.stat().st_size,'sha256':sha(q)})
files={str(q.relative_to(p)):{'sha256':sha(q),'bytes':q.stat().st_size}for q in sorted(p.rglob('*'))if q.is_file()and q.name!='PRESERVATION.json'}
r={'pid':os.getpid(),'command':'python3 '+str(p/'freeze.py'),'started':start,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exactInputs':pins,'files':files,'copies':copies,'status':'exact CPU/native refusal/source/root/critic/input bytes retained; preservation only','limits':'CPU candidate only; no actual-world/images/appearance/motion qualification; no repair/rerun'}
(p/'PRESERVATION.json').write_text(json.dumps(r,indent=2)+'\n')
for q in p.rglob('*'):
 if q.is_file():q.chmod(0o444)
for q in raw.iterdir():q.chmod(0o444)
raw.chmod(0o555);p.chmod(0o555);Path('tools/critic/fixed-fan-volume.mjs').chmod(0o444)
print(json.dumps({'pid':r['pid'],'started':start,'finished':r['finished'],'files':len(files),'bytes':sum(f['bytes']for f in files.values()),'exactInputs':len(pins),'copies':len(copies),'manifestSHA256':sha(p/'PRESERVATION.json')}))
