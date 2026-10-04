import datetime,hashlib,json,os,pathlib
p=pathlib.Path(__file__).resolve().parent;started=datetime.datetime.now(datetime.timezone.utc).isoformat();pins=[]
for file in sorted(p.rglob('*')):
 if file.is_file() and file.name!='FROZEN.json':
  d=file.read_bytes();pins.append(dict(file=str(file.relative_to(p)),bytes=len(d),sha256=hashlib.sha256(d).hexdigest()))
out=dict(command='python3 docs/evidence/nonhair-2026-10-03/ink-ao/freeze.py',pid=os.getpid(),started=started,ended=datetime.datetime.now(datetime.timezone.utc).isoformat(),pins=pins,scope='Exact evidence packet only; no accepted/frozen/reference/unrelated source mutation.')
with (p/'FROZEN.json').open('x') as h:json.dump(out,h,indent=2);h.write('\n')
for file in p.rglob('*'):
 if file.is_file():file.chmod(0o444)
print(json.dumps(dict(pid=out['pid'],started=started,ended=out['ended'],files=len(pins),bytes=sum(v['bytes'] for v in pins),manifestSha256=hashlib.sha256((p/'FROZEN.json').read_bytes()).hexdigest())))
