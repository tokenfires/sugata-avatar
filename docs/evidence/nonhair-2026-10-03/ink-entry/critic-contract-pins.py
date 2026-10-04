import datetime, hashlib, json, os, pathlib, sys
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar'); packet=root/'docs/evidence/nonhair-2026-10-03/ink-entry'
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
prior=root/'docs/evidence/nonhair-2026-10-03/ink-entry-value/CRITIC-PINS.json'; old=json.loads(prior.read_text()); pins=[]
for item in old['pins']:
    data=(root/item['path']).read_bytes(); actual=hashlib.sha256(data).hexdigest(); assert actual==item['sha256'],item['path']
    pins.append(dict(path=item['path'],bytes=len(data),sha256=actual))
for p in [str(prior.relative_to(root)),str((packet/'PLAN.md').relative_to(root)),str((packet/'CRITIC-CONTRACT.md').relative_to(root))]:
    data=(root/p).read_bytes(); pins.append(dict(path=p,bytes=len(data),sha256=hashlib.sha256(data).hexdigest()))
receipt=dict(scope='FS provenance only; no source candidate/browser/SDK/helper/build execution',command='python3 docs/evidence/nonhair-2026-10-03/ink-entry/critic-contract-pins.py',pid=os.getpid(),interpreter=sys.executable,python=sys.version,started=start,ended=datetime.datetime.now(datetime.timezone.utc).isoformat(),readerSha256=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),inheritedPins=len(old['pins']),pins=pins)
(packet/'CRITIC-CONTRACT-PINS.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'pid':receipt['pid'],'started':start,'ended':receipt['ended'],'pins':len(pins),'inheritedPins':len(old['pins'])}))
for name in ['CRITIC-CONTRACT.md','CRITIC-CONTRACT-PINS.json','critic-contract-pins.py']:print(name,hashlib.sha256((packet/name).read_bytes()).hexdigest())
