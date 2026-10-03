"""Independent GLB-input, morph/skin/barycentric/camera arithmetic. No native job."""
import ast, hashlib, json, os, struct, sys
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
started=datetime.now(timezone.utc).isoformat()
folder=Path('captures/hair-boundary-2026-10-02-v1')
report_path=folder/'report.json'; report_bytes=report_path.read_bytes(); r=json.loads(report_bytes)
assert hashlib.sha256(report_bytes).hexdigest()=='3a9d2349ae7fe0ea315eb2888c9ef3fec993396da3bc4d93fe951f9a6745cc0f'
assert r['status']=='captured' and not r['errors'] and r['explicitAvatarRetired'] and r['ownedBrowserAndServerClosed']
assert r['cleanup']=={'page':'closed','browser':'closed','server':'closed'}
sources={}
for p,h in r['sourceHashes'].items():
    assert hashlib.sha256(Path(p).read_bytes()).hexdigest()==h,p
    if not p.endswith('.glb'): assert hashlib.sha256((folder/'source'/p).read_bytes()).hexdigest()==h,p
    sources[p]=h
landmark_path=Path('docs/evidence/appearance-2026-10-02/front-design/boundary-landmarks.json')
lm_bytes=landmark_path.read_bytes(); lm=json.loads(lm_bytes)
assert hashlib.sha256(lm_bytes).hexdigest()=='4df88cf6fda7f0633127b62cda3ad5ab0e2801acb8b5558437e1959af48b3bd8'
for p,h in lm['sourceHashes'].items(): assert hashlib.sha256(Path(p).read_bytes()).hexdigest()==h,p
# Reuse only generic decoding definitions, never run the previous geometric audit.
helper=Path('docs/evidence/appearance-2026-10-02/root-coverage/verify-local-result.py')
defs=[n for n in ast.parse(helper.read_text()).body if isinstance(n,ast.FunctionDef) and n.name in ('glb','accessor','mesh')]
exec(compile(ast.Module(body=defs,type_ignores=[]),str(helper),'exec'),globals())
morph_helper=Path('docs/evidence/appearance-2026-10-02/front-design/verify-anatomy-anchors.py')
defs=[n for n in ast.parse(morph_helper.read_text()).body if isinstance(n,ast.FunctionDef) and n.name=='morph_accessor']
exec(compile(ast.Module(body=defs,type_ignores=[]),str(morph_helper),'exec'),globals())
g=glb(lm['bodyFile']);primitive,attrs,triangles=mesh(g,'base.001')
body_mesh=next(m for m in g['json']['meshes'] if m['name']=='base.001')
names=body_mesh['extras']['targetNames']; inputs=r['setup']['poseInputs']
vertices={v['index']:v for v in inputs['vertices']}
used={i for o in lm['orientations'].values() for line in ('opening','part') for a in o[line] for i in a['indices']}
assert set(vertices)==used and len(vertices)==77
active={m['index']:m for m in inputs['activeMorphs']}
assert len(active)==13
assert inputs['morphTargetsRelative'] is True
source_morphs={i:morph_accessor(g,primitive['targets'][i]['POSITION']).astype(float) for i in active}
for v in vertices.values():
    index=v['index'];assert attrs['POSITION'][index].tolist()==v['position']
    assert attrs['JOINTS_0'][index].tolist()==v['joints']
    raw=attrs['WEIGHTS_0'][index].astype(float)
    expected=(raw/abs(raw).sum()).astype(np.float32).astype(float)
    assert expected.tolist()==v['weights']
    assert {m['index'] for m in v['morphs']}==set(active)
    for m in v['morphs']:
        assert names[m['index']]==m['name']==active[m['index']]['name']
        assert source_morphs[m['index']][index].tolist()==m['delta']
for i,m in active.items(): assert r['setup']['state']['morphs'][i]==m['weight']
def matrix(values):return np.asarray(values,dtype=float).reshape((4,4),order='F')
def point(m,p):
    v=m@np.r_[p,1.0]
    return v[:3]/v[3]
def corner_world(index,state):
    v=vertices[index];pos=np.array(v['position'],dtype=float)
    for m in v['morphs']:pos+=np.array(m['delta'])*active[m['index']]['weight']
    bound=matrix(state['bindMatrix'])@np.r_[pos,1.0]
    skinned=np.zeros(3)
    for joint,weight in zip(v['joints'],v['weights']):
        if weight:skinned+=weight*(matrix(state['bones'][joint]['matrix'])@matrix(state['boneInverses'][joint])@bound)[:3]
    local=point(matrix(state['bindMatrixInverse']),skinned)
    return point(matrix(state['bodyMatrix']),local)
maxima={k:0.0 for k in ('restMetres','cornerWorldMetres','baryWorldMetres','ndc','pixel','projectionDistanceMm')}
projected_count=0; image_hashes={}; shape_witnesses={}
baseline=r['setup']['state']
for view in r['views']:
    s=view['state'];assert s['canvas']==[900,868]
    for k in ('clock','morphs','bodyMatrix','bindMatrix','bindMatrixInverse','boneInverses','bones','configuration'):assert s[k]==baseline[k],k
    cam=s['camera'];assert np.max(abs(matrix(cam['inverse'])@matrix(cam['world'])-np.eye(4)))<1e-14
    records=[view['beauty']]+view['annotations']
    for record in records:
        p=folder/record['file'];h=hashlib.sha256(p.read_bytes()).hexdigest();assert h==record['sha256'];image_hashes[record['file']]=h
    for anno in view['annotations']:
        assert anno['unoccluded'] is True
        target=lm['orientations'][anno['orientation']]
        for line in ('opening','part'):
            assert len(anno['projected'][line])==len(target[line])
            for a,b in zip(anno['projected'][line],target[line]):
                for k,val in b.items():assert a[k]==val
                bary=np.array(a['bary']);assert min(bary)>=-1e-10 and abs(bary.sum()-1)<1e-10
                assert triangles[a['bodyTriangle']].tolist()==a['indices']
                rest=bary@attrs['POSITION'][a['indices']].astype(float)
                maxima['restMetres']=max(maxima['restMetres'],float(max(abs(rest-a['restSurface']))))
                distance=np.linalg.norm(np.array(a['wanted'])-rest)*1000
                maxima['projectionDistanceMm']=max(maxima['projectionDistanceMm'],abs(float(distance)-a['projectionDistanceMm']))
                assert distance<=20
                corners=np.array([corner_world(i,s) for i in a['indices']]);world=bary@corners
                ndc=point(matrix(cam['projection'])@matrix(cam['inverse']),world)
                pixel=np.array([(ndc[0]+1)*s['canvas'][0]/2,(1-ndc[1])*s['canvas'][1]/2])
                for k,x,y in [('cornerWorldMetres',corners,a['worldCorners']),('baryWorldMetres',world,a['world']),('ndc',ndc,a['ndc']),('pixel',pixel,a['pixel'])]:
                    maxima[k]=max(maxima[k],float(np.max(abs(x-np.array(y)))))
                projected_count+=1
        shape_witnesses[view['view']+'-'+anno['orientation']]={line:anno['projected'][line][i]['pixel'] for line,i in [('opening',4),('part',0)]}
assert projected_count==96 and len(image_hashes)==10
assert r['views'][0]['state']['camera']==r['views'][1]['state']['camera']
assert maxima['restMetres']<1e-14 and maxima['cornerWorldMetres']<1e-14 and maxima['baryWorldMetres']<1e-14 and maxima['ndc']<1e-13 and maxima['pixel']<1e-10
mirror=[]
for line in ('opening','part'):
    for i,(a,b) in enumerate(zip(lm['orientations']['A'][line],lm['orientations']['B'][line])):
        assert np.array_equal(np.array(a['wanted'])*[-1,1,1],b['wanted'])
        delta=np.array(a['restSurface'])*[-1,1,1]-b['restSurface']
        mirror.append({'line':line,'index':i,'restMirrorResidualMm':float(np.linalg.norm(delta)*1000)})
finished=datetime.now(timezone.utc).isoformat()
print(json.dumps({'status':'Independent pose/barycentric/camera arithmetic and actual input pins agree','started':started,'finished':finished,'pid':os.getpid(),
 'interpreter':sys.executable,'pythonVersion':sys.version,'numpyVersion':np.__version__,'reportSha256':hashlib.sha256(report_bytes).hexdigest(),
 'sourcePins':sources,'genericReaderSha256':hashlib.sha256(helper.read_bytes()).hexdigest(),'sparseReaderSha256':hashlib.sha256(morph_helper.read_bytes()).hexdigest(),
 'landmarkSha256':hashlib.sha256(lm_bytes).hexdigest(),'cornerInputs':len(vertices),'activeMorphs':len(active),'projectedAnchorRecords':projected_count,'images':image_hashes,
 'maximumResiduals':maxima,'mirrorResiduals':mirror,'shapeWitnesses':shape_witnesses,
 'limits':['Verifies source/runtime corner inputs and pose/projection arithmetic, not underlying-canvas pixels independent of the browser assertions.',
 'Open-ended chord annotations do not form a continuous surface partition.','No nearest-face solve, domain fitting, geometry construction or native capture by critic.']},indent=2))
