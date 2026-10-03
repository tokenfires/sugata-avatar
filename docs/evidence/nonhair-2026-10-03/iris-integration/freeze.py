from pathlib import Path
import json,hashlib,datetime,os,shutil
p=Path('docs/evidence/nonhair-2026-10-03/iris-integration');raw=Path('captures/iris-integration-2026-10-03-v1');start=datetime.datetime.now(datetime.timezone.utc).isoformat();h=lambda q:hashlib.sha256(Path(q).read_bytes()).hexdigest()
pins=json.loads((p/'ROOT-HANDOFF.json').read_text())['pins']
for q,v in pins.items():assert h(q)==v,q
r=json.loads((raw/'report.json').read_text());assert h(raw/'report.json')=='3e13426fd1571db5b9498e6f4aff178c0871b271ea39f38ed012968e266a3b1f';assert h('tools/critic/iris-integration.mjs')==r['instrumentSHA256']
a=p/'archive/capture';a.mkdir(parents=True);copies=[]
for q in sorted(raw.iterdir()):
 assert q.is_file();d=a/q.name;shutil.copyfile(q,d);assert h(q)==h(d);copies.append(dict(source=str(q),copy=str(d),sha256=h(q),bytes=q.stat().st_size))
files={str(q.relative_to(p)):dict(sha256=h(q),bytes=q.stat().st_size)for q in sorted(p.rglob('*'))if q.is_file()and q.name!='PRESERVATION.json'}
out=dict(pid=os.getpid(),command='python3 '+str(p/'freeze.py'),started=start,finished=datetime.datetime.now(datetime.timezone.utc).isoformat(),exactInputs=pins,files=files,copies=copies,status='refused iris integration and exact rollback frozen; preservation only; no evaluator/native rerun')
(p/'PRESERVATION.json').write_text(json.dumps(out,indent=2)+'\n')
for q in p.rglob('*'):
 if q.is_file():q.chmod(0o444)
for q in raw.iterdir():q.chmod(0o444)
raw.chmod(0o555);p.chmod(0o555);Path('tools/critic/iris-integration.mjs').chmod(0o444)
print(json.dumps(dict(pid=out['pid'],started=start,finished=out['finished'],files=len(files),bytes=sum(v['bytes'] for v in files.values()),pins=len(pins),copies=len(copies),manifestSHA256=h(p/'PRESERVATION.json'))))
