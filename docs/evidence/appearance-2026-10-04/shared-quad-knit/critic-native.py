"""Saved-record arithmetic only; no GLB, author, THREE or renderer imports."""
from pathlib import Path
import datetime, hashlib, json, math, os, struct

root = Path(__file__).resolve().parent
repo = root.parents[3]
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
def digest(p):
    b = p.read_bytes()
    return {'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()}
def load(n): return json.loads((root / n).read_bytes())
obs, job, console, mesh = map(load, ['OBSERVATIONS.json', 'NATIVE-JOB.json', 'CONSOLE.json', 'mesh.json'])
pins = load('NATIVE-INPUTS.json')
for name, pin in pins['files'].items(): assert digest(repo / name) == pin, name
for k in ['inputs','sources','comparisons','draws','disposals','skinnedOwners','bodyEligible','literalJoints','garmentInput','garmentDocument','garmentDrawSource','framing','cameras','garmentClip','finished','cleanupReason']: assert k in obs, k
def allfinite(v):
    if isinstance(v, float): assert math.isfinite(v)
    elif isinstance(v, dict):
        for q in v.values(): allfinite(q)
    elif isinstance(v, list):
        for q in v: allfinite(q)
allfinite(obs)
assert obs['status'] == 'ready' and 'error' not in obs
assert obs['cleanupReason'] == 'explicit Finish reference'
assert obs['garmentDocument'] == mesh
assert obs['garmentInput']['observedSHA256'] == digest(root/'mesh.json')['sha256']
assert obs['garmentInput']['observedBytes'] == digest(root/'mesh.json')['bytes']
for pin in obs['inputs']:
    assert digest(repo/pin['path']) == {'bytes':pin['bytes'],'sha256':pin['sha256']}
    assert pin['httpStatus'] == 200 and pin['observedBytes'] == pin['bytes'] and pin['observedSHA256'] == pin['sha256']
    assert pin['parseStarted'] <= pin['parseCompleted']

def f32(x): return struct.unpack('<f', struct.pack('<f', x))[0]
draw = obs['garmentDrawSource']
xyz = [f32(v) for p in mesh['vertices'] for v in p]
idx = [v for f in mesh['quads'] for v in (f[0],f[1],f[2],f[0],f[2],f[3])]
assert xyz == draw['positionsFloat32'] and idx == draw['indices']
assert len(xyz) == 1770 and len(idx) == 3264
normal = [0.0]*len(xyz)
minimum_area = math.inf
for k in range(0,len(idx),3):
    ids = idx[k:k+3]
    a,b,c = [[xyz[3*i+j] for j in range(3)] for i in ids]
    cb = [c[j]-b[j] for j in range(3)]; ab = [a[j]-b[j] for j in range(3)]
    cross = [cb[1]*ab[2]-cb[2]*ab[1],cb[2]*ab[0]-cb[0]*ab[2],cb[0]*ab[1]-cb[1]*ab[0]]
    minimum_area = min(minimum_area, math.sqrt(sum(v*v for v in cross))/2)
    for i in ids:
        for j in range(3): normal[3*i+j] = f32(normal[3*i+j]+cross[j])
for k in range(0,len(normal),3):
    length = math.sqrt(sum(v*v for v in normal[k:k+3]))
    if length:
        normal[k:k+3] = [f32(v/length) for v in normal[k:k+3]]
normal_residual = max(abs(a-b) for a,b in zip(normal,draw['normalsFloat32']))
assert normal_residual <= 1e-7
identity = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
assert draw['matrix'] == draw['matrixWorld'] == identity
assert draw['position'] == [0,0,0] and draw['quaternion'] == [0,0,0,1] and draw['scale'] == [1,1,1]
assert draw['material'] == {'color':0x9bb4c8,'side':0,'roughness':1,'metalness':0}
assert draw['quadDiagonal'] == '0-2'

def multiply(a,b):
    return [sum(a[4*k+r]*b[4*c+k] for k in range(4)) for c in range(4) for r in range(4)]
def local(n):
    if 'matrix' in n: return n['matrix']
    x,y,z,w=n.get('rotation',[0,0,0,1]); sx,sy,sz=n.get('scale',[1,1,1]); tx,ty,tz=n.get('translation',[0,0,0])
    return [(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,
            2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,
            2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,tx,ty,tz,1]
source_meshes = []
raw_world_residual = 0.0; associated_nodes=0; total_vertices=0
for source in obs['sources']:
    key=source['key']; raw=source['rawDocument']; parents={}
    for i,n in enumerate(raw['nodes']):
        for c in n.get('children',[]): assert c not in parents; parents[c]=i
    world={}
    def evaluate(i):
        if i not in world: world[i]=multiply(evaluate(parents[i]),local(raw['nodes'][i])) if i in parents else local(raw['nodes'][i])
        return world[i]
    for node in source['nodes']:
        association=node['association']
        if 'nodes' in association:
            expected=evaluate(association['nodes']); associated_nodes+=1
            raw_world_residual=max(raw_world_residual,max(abs(a-b) for a,b in zip(expected,node['world'])))
    for m in source['meshes']:
        assert m['skinned'] and len(m['bones']) == 53
        assert len(m['originalMorphInfluences']) == len(m['zeroMorphInfluences']) and all(v==0 for v in m['zeroMorphInfluences'])
        assoc=m['association']; primitive=raw['meshes'][assoc['meshes']]['primitives'][assoc['primitives']]
        assert raw['nodes'][assoc['nodes']]['skin'] == 0
        assert len(m['zeroMorphInfluences']) == len(primitive.get('targets',[]))
        assert raw['accessors'][primitive['attributes']['POSITION']]['count'] == m['vertexCount']
        total_vertices += m['vertexCount'];source_meshes.append((key,m))
        assert len(m['bind']) == len(m['bindInverse']) == 16
        for bone in m['bones']:
            expected=evaluate(bone['association']['nodes'])
            raw_world_residual=max(raw_world_residual,max(abs(a-b) for a,b in zip(expected,bone['world'])))
    assert [m['uuid'] for m in source['meshes']] == [m['uuid'] for m in obs['skinnedOwners'][key]]
assert raw_world_residual < 1e-14 and associated_nodes == 171
assert [len(s['meshes']) for s in obs['sources']] == [7,1,1]
assert total_vertices == obs['framing']['vertexCount'] == 39546
assert obs['missingSourceOwners'] == []
eligible=[m for k,m in source_meshes if k=='body' and m['originalMorphInfluences']]
assert [m['uuid'] for m in eligible] == [m['uuid'] for m in obs['bodyEligible']]
reference=eligible[0];assert reference['uuid'] == obs['referenceUUID']
reference_map={b['name']:b for b in reference['bones']};assert len(reference_map)==53
metric_residual=0.0; comparisons=0
def delta(a,b): return {'translation':math.dist(a[12:15],b[12:15]),'linear':max(abs(a[i]-b[i]) for i in [0,1,2,4,5,6,8,9,10])}
rows={r['meshUUID']:r for r in obs['comparisons']};assert len(rows)==9
for key,m in source_meshes:
    row=rows[m['uuid']];assert row['key']==key and row['pass'] and row['unique'] and row['missing']==row['extra']==[]
    bm={b['name']:b for b in m['bones']};assert set(bm)==set(reference_map) and len(bm)==len(m['bones'])
    stored={b['name']:b for b in row['bones']};assert set(stored)==set(bm)
    for name,b in bm.items():
        for operand in ['world','inverseBind']:
            got=delta(b[operand],reference_map[name][operand])
            for k,v in got.items(): metric_residual=max(metric_residual,abs(v-stored[name][operand][k]))
            assert got['translation']<=.001 and got['linear']<=1e-6
        assert stored[name]['pass'];comparisons+=1
assert metric_residual == 0 and comparisons == 477
for j in obs['literalJoints']:
    b=reference_map[j['name']];assert j['world']==b['world'] and j['inverseBind']==b['inverseBind'] and j['origin']==b['world'][12:15]

frame=obs['framing']; lo,hi=frame['bounds']['min'],frame['bounds']['max']
size=[b-a for a,b in zip(lo,hi)];center=[(a+b)/2 for a,b in zip(lo,hi)]
assert frame['width']==1240 and frame['height']==620 and frame['panelAspect']==1
assert abs(frame['half']-.60*max(size[1],math.hypot(size[0],size[2])/frame['panelAspect']))<1e-15
assert abs(frame['eyeDistance']-3*max(size))<1e-15
assert frame['near']==.01 and abs(frame['far']-20*max(size))<1e-14
clip_residual=0.0
for i,(camera,clip) in enumerate(zip(obs['cameras'],obs['garmentClip'])):
    w=camera['matrixWorld'];p=camera['projection'];assert camera['target']==center
    assert camera['position']==w[12:15]
    for a in range(3):
        for b in range(3): assert abs(sum(w[4*a+r]*w[4*b+r] for r in range(3))-(1 if a==b else 0))<1e-14
    direction=[[0,0,1],[2**-.5,0,2**-.5],[0,0,-1]][i]
    assert max(abs(camera['position'][k]-(center[k]+frame['eyeDistance']*direction[k])) for k in range(3))<1e-14
    expected_projection=[1/(frame['half']*frame['panelAspect']),0,0,0,0,1/frame['half'],0,0,0,0,-2/(frame['far']-frame['near']),0,0,0,-(frame['far']+frame['near'])/(frame['far']-frame['near']),1]
    assert max(abs(a-b) for a,b in zip(p,expected_projection))<1e-14
    low=[math.inf]*3;high=[-math.inf]*3
    for k in range(0,len(xyz),3):
        q=[xyz[k+j]-w[12+j] for j in range(3)]
        view=[sum(w[4*r+j]*q[j] for j in range(3)) for r in range(3)]+[1]
        h=[sum(p[4*c+r]*view[c] for c in range(4)) for r in range(4)]
        ndc=[v/h[3] for v in h[:3]]
        assert abs(ndc[0])<=.97 and abs(ndc[1])<=.97 and -1<=ndc[2]<=1
        low=[min(a,b) for a,b in zip(low,ndc)];high=[max(a,b) for a,b in zip(high,ndc)]
    clip_residual=max(clip_residual,max(abs(a-b) for a,b in zip(low,clip['minimumNDC'])),max(abs(a-b) for a,b in zip(high,clip['maximumNDC'])))
    assert clip['camera']==i and clip['pass'] and clip['vertices']==590 and clip['xyLimit']==.97 and clip['depthLimits']==[-1,1]
assert clip_residual<1e-14
assert len(obs['draws'])==2
for draw_row,mode,which in zip(obs['draws'],['Front/Oblique','Front/Back'],[[0,1],[0,2]]):
    assert draw_row['mode']==mode and draw_row['cameraIndices']==which and draw_row['garmentVisible']
    assert draw_row['cameraMatrices']==[{'world':obs['cameras'][i]['matrixWorld'],'projection':obs['cameras'][i]['projection']} for i in which]
    assert draw_row['rootVisibility']==[{'key':k,'visible':True} for k in ['body','bra','briefs']]
assert len(obs['disposals'])==33 and all(r['attempted'] and r.get('returned') and 'error' not in r for r in obs['disposals'])
assert len({r['uuid'] for r in obs['disposals'] if r.get('uuid')})==32
assert console['entries']==[] and console['limit']==20
assert job['tabId']=='30' and job['maximumCreations']==1 and job['originalCaptures']==2 and job['readyWaits']==1
assert job['tabsBefore']==job['tabsAfter'] and job['closeRequestedUTC']<=job['closeReturnedUTC']
assert job['creationRequestedUTC']<'2026-10-04T21:36:00Z'
for prefix,name in [('first','front-oblique.jpg'),('second','front-back.jpg')]:
    assert digest(root/name)==job[prefix+'Image']
    assert job[prefix+'AcquisitionStartedUTC']<=job[prefix+'AcquisitionReturnedUTC']<'2026-10-04T21:40:00Z'
assert digest(root/'OBSERVATIONS.json')=={'bytes':job['observationsBytes'],'sha256':job['observationsSHA256']}
files=['OBSERVATIONS.json','NATIVE-JOB.json','CONSOLE.json','front-oblique.jpg','front-back.jpg','NATIVE-INPUTS.json','NATIVE-CONTRACT.md','NATIVE-SOURCE.md','DATA.md','viewer.mjs','index.html','mesh.json','critic-native.py']
result={'pid':os.getpid(),'startedUTC':start,'completedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'saved operands pass; contextual visual decision separate','pins':{n:digest(root/n) for n in files},'verifiedNativeInputCount':len(pins['files']),'drawCounts':[len(obs['draws']),len(idx)//3],'Float32PositionIndexExact':True,'normalResidual':normal_residual,'minimumFloat32TriangleArea':minimum_area,'associatedSourceNodes':associated_nodes,'rawWorldMaximumResidual':raw_world_residual,'namedComparisons':comparisons,'comparisonMetricResidual':metric_residual,'cameraClipResidual':clip_residual,'returnedDisposalAttempts':len(obs['disposals']),'limits':'No GLB decode, author/helper import or execution, new geometry, renderer, HTTP or browser. Original source position buffers are not exported: framing bounds are recorded operands, not independently re-evaluated source vertices. Inverse-bind values compared from exported operands, not independently decoded accessors. No pixel-cause, contact/fit/coverage/morph-range/motion or post-close GPU-memory proof.'}
(root/'CRITIC-NATIVE.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
