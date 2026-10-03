"""Read-only cap-only verification; no JS gates, guide audit or asset writes.

Reuses generic direct-GLB, plane/edge closest and triangle-SAT definitions from
the critic's earlier independent helper without executing that helper's audit.
Emits JSON to stdout. All geometry is the unchanged cap prefix and body.
"""
import ast
import hashlib
import json
import struct
from pathlib import Path
import numpy as np

ROOT = Path('.')
OUT = ROOT / 'captures/cap-baseline-2026-10-02-v1'
raw = (OUT / 'report.json').read_bytes()
r = json.loads(raw)
assert hashlib.sha256(raw).hexdigest() == 'c7493e0453537ea94471a5fe221ba05eebf075c97b05082374d534673c8a0001'
helper = ROOT / 'docs/evidence/appearance-2026-10-02/root-coverage/verify-local-result.py'
tree = ast.parse(helper.read_text())
functions = [x for x in tree.body if isinstance(x, ast.FunctionDef) and x.name in
             ('glb', 'accessor', 'mesh', 'closest', 'triangle_sat')]
assert len(functions) == 5
exec(compile(ast.Module(body=functions, type_ignores=[]), str(helper), 'exec'), globals())
pins = {}
for p, expected in r['sourceHashes'].items():
    live = hashlib.sha256(Path(p).read_bytes()).hexdigest() == expected
    copy = OUT / 'sources' / p
    snapshot = hashlib.sha256(copy.read_bytes()).hexdigest() == expected if copy.exists() else None
    pins[p] = {'live': live, 'snapshot': snapshot}
    assert live and (snapshot is not False)
assert len(pins) == 17 and all(c['pass'] for c in r['checks']) and len(r['checks']) == 15
hair = glb('captures/bob-lower-fallback-v1/candidate.glb')
body = glb('assets/figures/figure_g050.glb')
hp, ha, hi = mesh(hair, 'hair_bob02')
bp, ba, bi = mesh(body, 'base.001')
hpos = ha['POSITION'].astype(float)
bpos, bnorm = ba['POSITION'].astype(float), ba['NORMAL'].astype(float)
assert len(hpos) == 17516 and np.isfinite(bpos).all() and np.isfinite(bnorm).all()
assert np.min(np.linalg.norm(bnorm, axis=1)) > 1e-9
allcap, anycap = (hi < 652).all(axis=1), (hi < 652).any(axis=1)
assert np.array_equal(allcap, anycap)
original = np.flatnonzero(allcap)
cap = hi[allcap]
assert len(cap) == 1128 and set(cap.reshape(-1)) == set(range(652))
parent = list(range(652))
def find(v):
    while parent[v] != v:
        parent[v] = parent[parent[v]]; v = parent[v]
    return v
for tri in cap:
    root = find(int(tri[0]))
    for v in tri[1:]: parent[find(int(v))] = root
groups = {}
for v in range(652): groups.setdefault(find(v), []).append(v)
groups = sorted(groups.values(), key=lambda x:x[0])
assert [len(x) for x in groups] == [326,326]
assert [x['vertices'] for x in r['components']] == groups
assert r['capOriginalTriangles'] == original.tolist()
for group, recorded in zip(groups,r['components']):
    assert recorded['originalTriangles'] == original[np.isin(cap[:,0],group)].tolist()
for key in ('POSITION','NORMAL','TEXCOORD_0','TEXCOORD_1','WEIGHTS_0'):
    assert np.isfinite(ha[key][:652]).all()
assert np.array_equal(ha['JOINTS_0'][:652],np.tile([44,0,0,0],(652,1)))
assert np.array_equal(ha['WEIGHTS_0'][:652],np.tile([1,0,0,0],(652,1)))

def hierarchy(asset,name):
    nodes=asset['json']['nodes']; parents={c:i for i,n in enumerate(nodes) for c in n.get('children',[])}
    cache={}
    def world(i):
        if i in cache: return cache[i]
        n=nodes[i]
        if 'matrix' in n: local=np.array(n['matrix']).reshape((4,4),order='F')
        else:
            x,y,z,w=n.get('rotation',[0,0,0,1]); scale=n.get('scale',[1,1,1])
            rotation=np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],
                               [2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],
                               [2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]])
            local=np.eye(4);local[:3,:3]=rotation@np.diag(scale);local[:3,3]=n.get('translation',[0,0,0])
        cache[i]=(world(parents[i])@local) if i in parents else local
        return cache[i]
    mi=next(i for i,m in enumerate(asset['json']['meshes']) if m['name']==name)
    assert len(asset['json']['meshes'][mi]['primitives'])==1
    ni=next(i for i,n in enumerate(nodes) if n.get('mesh')==mi)
    skin=asset['json']['skins'][nodes[ni]['skin']]
    ib=accessor(asset,skin['inverseBindMatrices'])
    worlds=np.array([world(i) for i in skin['joints']])
    inverse=np.array([x.reshape((4,4),order='F') for x in ib])
    return world(ni),[nodes[i]['name'] for i in skin['joints']],worlds,worlds@inverse
hw,hn,hj,hb=hierarchy(hair,'hair_bob02');bw,bn,bj,bb=hierarchy(body,'base.001')
bind={'hairMeshIdentityError':float(np.max(abs(hw-np.eye(4)))),
      'bodyMeshIdentityError':float(np.max(abs(bw-np.eye(4)))),
      'hairBindIdentityError':float(np.max(abs(hb-np.eye(4)))),
      'bodyBindIdentityError':float(np.max(abs(bb-np.eye(4)))),
      'jointNamesEqual':hn==bn,'jointWorldMaximumError':float(np.max(abs(hj-bj))),
      'skinJoint44':hn[44]}
for k,v in bind.items():
    assert abs(v-r['bind'][k])<1e-13 if isinstance(v,float) else v==r['bind'][k]
assert max(v for k,v in bind.items() if k.endswith('Error'))<=1e-5 and hn==bn and hn[44]=='head'
uv=ha['TEXCOORD_0'].astype(float);uv1=ha['TEXCOORD_1'].astype(float)
assert ((uv[:652,0]>=0)&(uv[:652,0]<.125)).all()
delta=uv[cap[:,1]]-uv[cap[:,0]];delta2=uv[cap[:,2]]-uv[cap[:,0]]
dets=delta[:,0]*delta2[:,1]-delta2[:,0]*delta[:,1]
uv_check=next(x['witness'] for x in r['checks'] if x['name']=='finite cap UV determinants')
assert abs(abs(dets).min()-uv_check['minimumAbsUvDet'])<1e-16 and not np.any(abs(dets)<=1e-12)
info=hair['json']['materials'][hp['material']]['pbrMetallicRoughness']['baseColorTexture']
assert info.get('texCoord',0)==0 and not info.get('extensions',{}).get('KHR_texture_transform')
tex=hair['json']['textures'][info['index']];im=hair['json']['images'][tex['source']]
view=hair['json']['bufferViews'][im['bufferView']];start=view.get('byteOffset',0)
atlas=hair['bin'][start:start+view['byteLength']]
assert im['mimeType']=='image/png' and hashlib.sha256(atlas).hexdigest()==r['material']['atlas']['imageSha256']
assert struct.unpack('>II',atlas[16:24])==(1024,1024)
for role,rec in r['material']['sidecars'].items():
    data=Path(rec['file']).read_bytes()
    assert hashlib.sha256(data).hexdigest()==rec['sha256'] and struct.unpack('>II',data[16:24])==(rec['width'],rec['height'])
assert np.allclose(uv1[:652].min(axis=0),[x['min'] for x in r['material']['UV1Range']],rtol=0,atol=0)
assert np.allclose(uv1[:652].max(axis=0),[x['max'] for x in r['material']['UV1Range']],rtol=0,atol=0)

btri=bpos[bi];bmin,bmax=btri.min(axis=1),btri.max(axis=1)
minimum=(np.inf,None);count=0;failures=[]
def observe(point,at):
    global minimum,count
    result=closest(point);count+=1
    signnormal=(bnorm[bi[result[1]]]*np.array(result[3])[:,None]).sum(axis=0)
    assert np.linalg.norm(signnormal)>1e-9 and np.isfinite(signnormal).all()
    record={**at,'point':point.tolist(),'signedMm':float(result[0]),'bodyTriangle':result[1],
            'closest':result[2],'bodyBary':result[3],'signNormalLength':float(np.linalg.norm(signnormal))}
    if result[0]<minimum[0]:minimum=(result[0],record)
    if result[0]<=0:failures.append(record)
for v in range(652):observe(hpos[v],{'vertex':v})
for t,ids in enumerate(cap):
    for i in range(5):
        for j in range(5-i):
            bary=np.array([i/4,j/4,1-(i+j)/4])
            observe(bary@hpos[ids],{'capTriangle':t,'originalTriangle':int(original[t]),'ids':ids.tolist(),'bary':bary.tolist()})
sample=next(x['witness'] for x in r['checks'] if x['name']=='all fixed cap signed samples >0')
assert count==17572==sample['sampleCount'] and not failures
assert abs(minimum[0]-sample['minimum']['signedMm'])<1e-9
assert np.allclose(minimum[1]['closest'],sample['minimum']['closest'],rtol=0,atol=1e-14)
crossings=[];pairs=0
for t,ids in enumerate(cap):
    tri=hpos[ids]
    possible=np.flatnonzero(np.all((bmin<=tri.max(axis=0)+1e-9)&(bmax>=tri.min(axis=0)-1e-9),axis=1))
    pairs+=len(possible)
    for bt in possible:
        if triangle_sat(tri,btri[bt]):crossings.append([t,int(bt)])
reported=next(x['witness'] for x in r['checks'] if x['name']=='full cap/body zero shell crossings')
assert pairs==4009==reported['candidatePairs'] and not crossings and reported['head']['pairs']==0
print(json.dumps({'status':'independent cap-only predicates agree','reportSha256':hashlib.sha256(raw).hexdigest(),
                 'pins':pins,'genericHelperSha256':hashlib.sha256(helper.read_bytes()).hexdigest(),
                 'capComponents':[{'vertices':len(x),'first':x[0],'last':x[-1]} for x in groups],
                 'capTriangles':len(cap),'bodyTriangles':len(bi),'bind':bind,
                 'UV0Range':np.column_stack((uv[:652].min(axis=0),uv[:652].max(axis=0))).tolist(),
                 'minimumAbsUvDet':float(abs(dets).min()),'nearZeroUvDets':int(np.sum(abs(dets)<=1e-12)),
                 'signedSamples':count,'minimum':minimum[1],'nonpositiveSamples':failures,
                 'AABBpairs':pairs,'independentSATcrossings':crossings,
                 'limits':['Raw authored-rest/bind premise only.','Finite samples and floating-point SAT, not a global clearance proof.',
                           'No scalp coverage, renderer, target design or motion qualification.','No guide metrics or construction executed.']},indent=2))
