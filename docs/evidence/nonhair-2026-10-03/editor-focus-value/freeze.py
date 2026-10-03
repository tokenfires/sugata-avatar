from pathlib import Path
import json,hashlib,datetime,os,shutil
p=Path('docs/evidence/nonhair-2026-10-03/editor-focus-value');start=datetime.datetime.now(datetime.timezone.utc).isoformat();h=lambda q:hashlib.sha256(Path(q).read_bytes()).hexdigest();pins=json.loads((p/'ROOT-HANDOFF.json').read_text())['pins']
for q,v in pins.items():assert h(q)==v,q
assert not Path('captures/clothing-descriptions-2026-10-03-v1').exists();instrument=Path('tools/critic/clothing-descriptions.mjs');shutil.copyfile(instrument,p/'EXECUTED-INSTRUMENT.mjs.source');assert h(instrument)==h(p/'EXECUTED-INSTRUMENT.mjs.source')
files={str(q.relative_to(p)):dict(sha256=h(q),bytes=q.stat().st_size)for q in sorted(p.rglob('*'))if q.is_file()and q.name!='PRESERVATION.json'}
r=dict(pid=os.getpid(),started=start,finished=datetime.datetime.now(datetime.timezone.utc).isoformat(),command='python3 '+str(p/'freeze.py'),exactInputs=pins,files=files,rawAbsent=True,status='source-qualified candidate/exact rollback and late pre-browser refusal retained; preservation only, no native/AX/image')
(p/'PRESERVATION.json').write_text(json.dumps(r,indent=2)+'\n')
for q in p.rglob('*'):
 if q.is_file():q.chmod(0o444)
p.chmod(0o555);instrument.chmod(0o444);print(json.dumps(dict(pid=r['pid'],started=start,finished=r['finished'],files=len(files),bytes=sum(v['bytes']for v in files.values()),pins=len(pins),manifestSHA256=h(p/'PRESERVATION.json'))))
