import datetime, hashlib, json, os, pathlib, sys
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar')
packet=root/'docs/evidence/nonhair-2026-10-03/skin-kitchen'
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
files={}
for path in sorted(packet.rglob('*')):
    if path.is_file() and path.name!='PRESERVATION.json':
        data=path.read_bytes()
        files[str(path.relative_to(packet))]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
receipt=dict(scope='Source-only packet preservation, no launch',command='python3 docs/evidence/nonhair-2026-10-03/skin-kitchen/preserve.py',pid=os.getpid(),interpreter=sys.executable,started=start,ended=datetime.datetime.now(datetime.timezone.utc).isoformat(),fileCount=len(files),bytes=sum(p['bytes'] for p in files.values()),files=files,externalAcceptedPins=json.loads((packet/'AUTHOR-FINAL.json').read_text())['sources'])
target=packet/'PRESERVATION.json'
target.write_text(json.dumps(receipt,indent=2)+'\n')
for path in packet.rglob('*'):
    if path.is_file(): path.chmod(0o444)
print(json.dumps({k:v for k,v in receipt.items() if k not in ['files','externalAcceptedPins']}))
print('manifestSha256',hashlib.sha256(target.read_bytes()).hexdigest())
