import datetime,hashlib,json,os,pathlib
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar');folder=pathlib.Path(__file__).resolve().parent;started=datetime.datetime.now(datetime.timezone.utc).isoformat()
original=(root/'looks/ink-denim.json').read_bytes();assert original.count(b'"quality": "balanced"')==1
for name,data in [('INK-balanced.json',original),('INK-high.json',original.replace(b'"quality": "balanced"',b'"quality": "high"'))]:
 with (folder/name).open('xb') as h:h.write(data)
pins=[]
previous=json.loads((root/'docs/evidence/nonhair-2026-10-03/headwear-sdk/SOURCE.json').read_text())
files=[p['file'] for p in previous['pins'] if 'fedora01' not in p['file']]+['packages/core/src/render/GTAO.js','packages/core/src/render/Stage.js','packages/core/src/material/HairColourOptions.js','packages/testbed/src/showcase-presets.mjs','packages/testbed/src/showcase-settings.mjs']
for file in files:
 d=(root/file).read_bytes();pins.append(dict(file=file,bytes=len(d),sha256=hashlib.sha256(d).hexdigest()))
for name in ['PLAN.md','preview.html','preview.mjs','prepare.py','INK-balanced.json','INK-high.json','PRIMARY-GTAO.json']:
 d=(folder/name).read_bytes();pins.append(dict(file=str((folder/name).relative_to(root)),bytes=len(d),sha256=hashlib.sha256(d).hexdigest()))
out=dict(command='python3 docs/evidence/nonhair-2026-10-03/ink-ao/prepare.py',pid=os.getpid(),started=started,ended=datetime.datetime.now(datetime.timezone.utc).isoformat(),pins=pins,scope='FS literal preparation/pins only, no SDK resolution/asset parse/runtime. Balanced exact accepted bytes; High only one literal quality substitution.')
with (folder/'INPUTS.json').open('x') as h:json.dump(out,h,indent=2);h.write('\n')
print(json.dumps(dict(pid=out['pid'],started=started,ended=out['ended'],pins=len(pins))))
