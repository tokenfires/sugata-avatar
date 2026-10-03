"""Independent byte, scalar colour/camera and scope audit of the refused control."""
import json, gzip, hashlib, pathlib, datetime, os, sys, math, struct
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
root=pathlib.Path(__file__).resolve().parents[4]
out=root/'captures/neutral-floor-2026-10-03-v1'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
r=json.loads((out/'report.json').read_text())
assert r['status']=='failed' and len(r['arms'])==1 and r['images']==[]
assert r['browserClosed'] and r['finalPinsUnchanged'] and r['finished']<r['hardStop']
assert len(r['errors'])==1 and "undefined !== '*'" in r['errors'][0]
a=r['arms'][0];s=a['state'];g=s['ground'];assert (a['context'],a['preset'],a['floor'],a['viewport'])==('desktop-casual','casual','olive',[900,868])
assert a['errors']==[] and a['pageClosed'] and a['failureRetirement']==dict(disposed=True,leaked=[])
assert not a.get('completed') and not a.get('stateFile') and not a.get('image') and not a.get('after')
assert not list(out.glob('*.png')) and not list(out.glob('*state.json.gz'))
pins={}
for key in ['sources','dependencies','helpers']:
 for p,h in r[key].items():assert sha(root/p)==h,p;pins[p]=h
assert sha(root/'tools/critic/neutral-floor.mjs')==r['instrumentSHA256']==sha(out/'instrument.mjs')
assert sha(out/'fixture.html')==r['fixtureSHA256']
copies=[]
for p in (out/'source').rglob('*'):
 if p.is_file():
  rel=str(p.relative_to(out/'source'));assert sha(p)==pins[rel],rel;copies.append(rel)
for asset in a['assets']:assert sha(root/asset['file'])==asset['sha256']==r['sources'][asset['file']]
assert len(a['assets'])==6
rgb=[150/255,140/255,52/255]
ideal_linear=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
linear=[v*.0773993808 if v<.04045 else (v*.9478672986+.0521327014)**2.4 for v in rgb]
ideal_formula_difference=max(abs(x-y) for x,y in zip(ideal_linear,g['material']['colour']))
color_error=max(abs(x-y) for x,y in zip(linear,g['material']['colour']))
assert color_error<2e-15
assert g['constructorAlbedo']==0x968c34 and s['scene']['groundMaterial']==dict(albedo='#968c34',roughness=.9)
n=g['colorNode'];assert n['type']=='VarNode' and 'op' not in n and n['albedoOperand'] is None
assert len(n['colors'])==1 and n['colors'][0]['hex']=='968c34' and n['colors'][0]['linear']==g['material']['colour']
assert g['material']['type']=='MeshStandardNodeMaterial' and g['material']['roughness']==.9 and g['occlusionEnabled'] and g['strength']==g['strengthUniform']==1 and g['extent']==12
assert g['activeCount']==len(g['occluders'])==len(g['spheres'])==16
assert all(not x['present'] for x in s['interiorPresence'])
assert s['scene']['background']=='#08080a' and s['scene']['backdrop']=='#070a0e' and s['scene']['environment'] is None
assert s['scene']['lighting']['look']=='neutral' and s['normalClocks']['motion']==s['normalClocks']['utterance']==s['normalClocks']['resetEpoch']==0
assert s['backend']==dict(isWebGPU=True,temporalAA='taau',resolutionScale=.66)
c=s['camera'];assert s['canvas']['client']==s['canvas']['buffer']==[900,868] and c['zoom']==1 and c['coordinateSystem']==2001 and not c['viewEnabled']
n0,f=c['near'],c['far'];q=1/math.tan(math.radians(c['fov'])/2)*c['zoom']
P=[q/c['aspect'],0,0,0,0,q,0,0,0,0,-f/(f-n0),-1,0,0,-f*n0/(f-n0),0]
projection_error=max(abs(x-y) for x,y in zip(P,c['projection']));assert projection_error<1e-12
def norm(v):
 d=math.sqrt(sum(x*x for x in v));return [x/d for x in v]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
z=norm([x-y for x,y in zip(c['position'],c['focus'])]);x=norm(cross([0,1,0],z));y=cross(z,x)
M=[*x,0,*y,0,*z,0,*c['position'],1]
camera_error=max(abs(x-y) for x,y in zip(M,s['physical']['camera']));assert camera_error<1e-12
dependency_context={}
for p in ['node_modules/three/src/nodes/core/VarNode.js','node_modules/three/src/nodes/tsl/TSLCore.js','node_modules/three/src/nodes/math/OperatorNode.js','node_modules/three/src/nodes/core/Node.js']:
 dependency_context[p]=sha(root/p)
print(json.dumps(dict(status='passed refusal audit',command='/opt/homebrew/opt/python@3.14/bin/python3.14 docs/evidence/nonhair-2026-10-03/neutral-floor/verify-refusal.py > docs/evidence/nonhair-2026-10-03/neutral-floor/independent.json',interpreter=sys.executable,version=sys.version,pid=os.getpid(),started=start,finished=datetime.datetime.now(datetime.timezone.utc).isoformat(),verifierSHA256=sha(pathlib.Path(__file__)),reportSHA256=sha(out/'report.json'),pinCount=len(pins),pins=pins,sourceCopies=copies,postflightInstalledGraphSources=dependency_context,assets=a['assets'],observedNode=n,maxColorError=color_error,idealSRGBFormulaDifference=ideal_formula_difference,maxProjectionError=projection_error,maxCameraWorldError=camera_error,images=0,grayArms=0,pairedComparisons=0,cleanup=dict(browserClosed=r['browserClosed'],pageClosed=a['pageClosed'],retirement=a['failureRetirement']),limits='First olive control only. Installed graph-source hashes are postflight context, not original capture pins. No PNG, gray creation, A/B numerical/appearance or candidate qualification.'),indent=2))
