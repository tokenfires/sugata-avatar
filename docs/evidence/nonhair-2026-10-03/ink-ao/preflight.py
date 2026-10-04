import datetime,hashlib,json,os,pathlib
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar');p=pathlib.Path(__file__).resolve().parent;started=datetime.datetime.now(datetime.timezone.utc).isoformat()
inputs=json.loads((p/'INPUTS.json').read_text());pins=[]
for v in inputs['pins']:
 d=(root/v['file']).read_bytes();assert len(d)==v['bytes'] and hashlib.sha256(d).hexdigest()==v['sha256'],v['file'];pins.append(v)
bindings={'PLAN.md':'9486c0ed45965c6b9f3d10a56dc4a9915f1e0b17d72079f48dbc0aeb3b2319e6','preview.html':'696c55825795f7fe79b0d2f7851199c6bfcc3bd9e1d3f81d57da48ab07712c59','preview.mjs':'8e112b14193eb73d24ba16925ed0a272c7d7050f39cdbed8a8e42a830a0635bd','INK-balanced.json':'80562c5d8584fb75c127afd5dc240470fdf46c1a9f964d9075cbe38de3f07407','INK-high.json':'fe203ddcbb2f95099c94753b3f8363e670f634126f6221f4bb55f4a0c876afcb','INPUTS.json':'1c9ad0a62fc5a53d40ccdd8f29107a92da7227f75afe25012122b70f604ff870'}
for name,sha in bindings.items():assert hashlib.sha256((p/name).read_bytes()).hexdigest()==sha,name
lighting=root/'packages/core/src/render/LightingRig.js';assert hashlib.sha256(lighting.read_bytes()).hexdigest()=='8f8996daf35401635ce2b57d4668ab9caaf3512feb2080e1a5223639fb74ceb8'
a=(p/'INK-balanced.json').read_bytes();b=(p/'INK-high.json').read_bytes();assert a==(root/'looks/ink-denim.json').read_bytes();assert b==a.replace(b'"quality": "balanced"',b'"quality": "high"')
for name in ['CRITIC-SOURCE.md','CRITIC-WORTH.md','preflight.py']:
 d=(p/name).read_bytes();pins.append(dict(file=str((p/name).relative_to(root)),bytes=len(d),sha256=hashlib.sha256(d).hexdigest()))
pins.append(dict(file=str(lighting.relative_to(root)),bytes=len(lighting.read_bytes()),sha256=hashlib.sha256(lighting.read_bytes()).hexdigest()))
out=dict(command='python3 docs/evidence/nonhair-2026-10-03/ink-ao/preflight.py',pid=os.getpid(),started=started,ended=datetime.datetime.now(datetime.timezone.utc).isoformat(),pins=pins,criticBindings=bindings,decision='Source GO only: root read full handoff/fixture and actual tier/ambient/AO source; first-open before03:38/whole stop03:53.',scope='FS/hash/literal checks only; no SDK resolution/asset parse/runtime.')
with (p/'PREFLIGHT.json').open('x') as h:json.dump(out,h,indent=2);h.write('\n')
print(json.dumps(dict(pid=out['pid'],started=started,ended=out['ended'],pins=len(pins),decision=out['decision'])))
