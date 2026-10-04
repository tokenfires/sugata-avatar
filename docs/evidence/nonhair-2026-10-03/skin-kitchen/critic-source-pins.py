import datetime, hashlib, json, os, pathlib, sys
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar'); packet=root/'docs/evidence/nonhair-2026-10-03/skin-kitchen'
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
author=json.loads((packet/'AUTHOR-FINAL.json').read_text())
pins=[]
for p,expected in author['sources'].items():
    data=(root/p).read_bytes(); actual=hashlib.sha256(data).hexdigest(); assert actual==expected, p
    pins.append(dict(path=p,bytes=len(data),sha256=actual))
assert len(pins)==380
extra=['PLAN.md','preview.html','preview.mjs','recipe.json','AUTHOR.json','AUTHOR-FINAL.json','SOURCE-OBSERVATION-REVISION.json','SOURCE-RETIREMENT-REVISION.json','preview.initial.mjs.source','preview.pose-only.mjs.source','CRITIC-CONTRACT.md','CRITIC-SOURCE-INITIAL.md','CRITIC-SOURCE.md']
for name in extra:
    p=packet/name; data=p.read_bytes(); pins.append(dict(path=str(p.relative_to(root)),bytes=len(data),sha256=hashlib.sha256(data).hexdigest()))
sage=json.loads((root/'looks/sage-lavender-chin.json').read_text()); sage['scene']='kitchen'; sage.pop('lighting',None)
recipe=json.loads((packet/'recipe.json').read_text()); assert recipe==sage and 'lighting' not in recipe
for p,expected in author['files'].items(): assert hashlib.sha256((root/p).read_bytes()).hexdigest()==expected, p
receipt=dict(scope='Source/FS/JSON only; no Avatar/renderer/guard/API or numerical geometry execution',command='python3 docs/evidence/nonhair-2026-10-03/skin-kitchen/critic-source-pins.py',pid=os.getpid(),interpreter=sys.executable,python=sys.version,started=start,ended=datetime.datetime.now(datetime.timezone.utc).isoformat(),sourceSha256=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),sourceInputs=len(author['sources']),recipeExactClone=True,pins=pins)
(packet/'CRITIC-SOURCE-PINS.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'pid':receipt['pid'],'started':start,'ended':receipt['ended'],'pins':len(pins),'sourceInputs':380,'recipeExactClone':True}))
for name in ['CRITIC-SOURCE.md','CRITIC-SOURCE-PINS.json','critic-source-pins.py']: print(name,hashlib.sha256((packet/name).read_bytes()).hexdigest())
