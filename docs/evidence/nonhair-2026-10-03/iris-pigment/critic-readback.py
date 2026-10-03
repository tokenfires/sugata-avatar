from pathlib import Path
from hashlib import sha256
from datetime import datetime, timezone
import copy, json, os, struct, sys
ROOT=Path('/Users/robault/GitHub/sugata-avatar')
PACK=ROOT/'docs/evidence/nonhair-2026-10-03/iris-pigment'
RAW=ROOT/'captures/iris-pigment-2026-10-03-v1'
started=datetime.now(timezone.utc).isoformat()
sha=lambda p:sha256(p.read_bytes()).hexdigest()
r=json.loads((RAW/'report.json').read_text())
assert sha(RAW/'report.json')=='dd4fcae12131fae2ada44e85dffcd52aaccc097a078cf68d0206b3e8450b190f'
assert r['status']=='observed' and not r['errors'] and not r['failedResources']
assert r['cleanup']=={'page':'closed','browser':'closed'} and r['finalPinsUnchanged'] and r['borrowedReviewServerRetained']
for pins in [r['sources'],r['inputs']]:
 for path,digest in pins.items(): assert sha(ROOT/path)==digest,path
assert sha(RAW/'instrument.mjs')==r['instrumentSHA256']==sha(ROOT/'tools/critic/iris-pigment.mjs')
expected=[('original','front'),('candidate','front'),('candidate','oblique'),('original','oblique')]
assert len(r['images'])==4
recipe=json.loads((ROOT/'looks/sage-lavender-chin.json').read_text())
states=[]; imagePins={}
for image,(arm,view) in zip(r['images'],expected):
 assert image['file']==arm+'-'+view+'.png'
 p=RAW/image['file'];b=p.read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n';assert struct.unpack('>II',b[16:24])==(1440,1000)
 assert sha(p)==image['sha256'];imagePins[image['file']]=image['sha256']
 assert image['before']==image['after']
 states.extend([image['before'],image['after']])
ret=r['retirement'];states.append(ret['restored']);baseline=None
for s in states:
 e=s['eyes'];assert s['recipe']==s['actualConfiguration']==recipe
 assert s['backend']=='webgpu' and s['webGPU'] and s['camera']['fov']==26
 assert s['camera']['position']==([0,1.55,.88] if s['view']=='front' else [.4235,1.55,.7665])
 assert e['originalOwnerUnchanged'] and not e['donorAttached'] and e['borrowedSourceSame'] and e['borrowedMapSame']
 assert e['actualCornea']==e['originalCornea'] and e['activeGlobe']==e['originalGlobe' if s['arm']=='original' else 'donorGlobe']
 for a,b in [('originalGeometry','donorGeometry'),('originalFrames','donorFrames'),('originalUniforms','donorUniforms'),('originalOptics','donorOptics')]: assert e[a]==e[b]
 assert not e['donorDisposals'] and e['borrowedMapDisposed']==0 and e['blue']=='#527b97'
 weights=[.2126,.7152,.0722];assert abs(sum(w*c for w,c in zip(weights,e['chromaticity']))-1)<1e-12
 assert e['luma']==sum(w*c for w,c in zip(weights,e['linear']))
 assert all(abs(c/e['luma']-n)<1e-12 for c,n in zip(e['linear'],e['chromaticity']))
 n=copy.deepcopy(s)
 for k in ['arm','view','camera']:n.pop(k)
 n['eyes'].pop('activeGlobe')
 for row in n['bindings']:
  if row['mesh']==e['globeMesh']:row['materials']=['declared-globe']
 if baseline is None:baseline=n
 assert n==baseline
assert ret.get('snapshotError') is None and not ret['retirementErrors']
assert ret['mapDisposedByDonor']==0 and ret['disposal']['disposed'] and not ret['disposal']['leaked']
assert ret['donorDisposals']==[{'name':k,'uuid':v} for k,v in ret['restored']['eyes']['donorResources'].items()]
cr=json.loads((PACK/'COPY-RECIPE.json').read_text());reverse=(PACK/'PreviewEyeMaterial.mjs').read_text();assert len(cr['changes'])==9
for x in reversed(cr['changes']):assert reverse.count(x['to'])==1;reverse=reverse.replace(x['to'],x['from'])
assert reverse==(ROOT/cr['original']).read_text()
assert datetime.fromisoformat(r['finished'].replace('Z','+00:00'))<datetime.fromisoformat(r['stop'].replace('Z','+00:00'))
result={'pid':os.getpid(),'command':'python3 docs/evidence/nonhair-2026-10-03/iris-pigment/critic-readback.py','interpreter':sys.executable,'version':sys.version,'started':started,'finished':datetime.now(timezone.utc).isoformat(),'verifierSHA256':sha(Path(__file__)),'reportSHA256':sha(RAW/'report.json'),'sourcePins':len(r['sources']),'inputPins':len(r['inputs']),'executedInstrumentSHA256':r['instrumentSHA256'],'imagePins':imagePins,'imageDimensions':[1440,1000],'completeRecordedStates':len(states),'bindingsPerState':len(states[0]['bindings']),'pupilScale':states[0]['eyes']['originalUniforms']['pupilScaleUniform'],'borrowedMap':states[0]['eyes']['borrowedMap'],'donorDisposals':ret['donorDisposals'],'mapDisposedByDonor':ret['mapDisposedByDonor'],'status':'passed fs/copy/state/luma/retirement readback','limits':['No GPU, image crop/edit or render replay.','Observed frame/uniform equality, not independent reconstruction of physical skinning or texture sampling.','Image appearance reviewed separately; no pixel equality, perceptual/spectral/moving/default/API qualification.']}
with (PACK/'CRITIC-READBACK.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps(result,indent=2))
