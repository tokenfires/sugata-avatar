import datetime,hashlib,json,os,pathlib,sys
packet=pathlib.Path('/Users/robault/GitHub/sugata-avatar/docs/evidence/nonhair-2026-10-03/review-hub')
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
files=[]
for p in sorted(packet.rglob('*')):
    if p.is_file():
        b=p.read_bytes();files.append({'file':str(p.relative_to(packet)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
assert not (packet/'PRESERVATION.json').exists()
receipt={'scope':'preservation only; no render/build/SDK/source repair','command':'python3 docs/evidence/nonhair-2026-10-03/review-hub/freeze.py','pid':os.getpid(),'started':started,'ended':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':files,'payloadBytes':sum(f['bytes'] for f in files),'candidateArchive':'candidate.html.source','qualification':'finite candidate page only; adoption refused; current product unchanged'}
dest=packet/'PRESERVATION.json'
with dest.open('x') as f:json.dump(receipt,f,indent=2);f.write('\n')
for p in packet.rglob('*'):
    if p.is_file():p.chmod(0o444)
print(json.dumps({'pid':receipt['pid'],'started':started,'ended':receipt['ended'],'payloadFiles':len(files),'payloadBytes':receipt['payloadBytes'],'manifestSha256':hashlib.sha256(dest.read_bytes()).hexdigest()}))
