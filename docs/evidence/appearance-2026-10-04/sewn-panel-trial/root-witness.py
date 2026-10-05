"""Independent saved-data counterexample; no producer/helper imports or rerun."""
import collections
import datetime
import json
import math
import pathlib
from fractions import Fraction as Q

p=pathlib.Path(__file__).resolve().parent
root=p.parents[3]
def dec(v):
    if isinstance(v,dict) and set(v)=={'n','d'}:return Q(int(v['n']),int(v['d']))
    if isinstance(v,dict):return {k:dec(x) for k,x in v.items()}
    if isinstance(v,list):return [dec(x) for x in v]
    return v
def enc(v):
    if isinstance(v,Q):return {'n':str(v.numerator),'d':str(v.denominator)}
    if isinstance(v,dict):return {k:enc(x) for k,x in v.items()}
    if isinstance(v,(list,tuple)):return [enc(x) for x in v]
    return v
load=lambda name:dec(json.loads((p/name).read_text()))
ref=load('REFUSAL.json')['operands'][0]
mesh=load('PHYSICAL.json')
frags=load('FRAGMENTS.json')
key=ref['physicalClearance']
index=next(i for i,f in enumerate(frags) if f['key']==key)
f=frags[index]
ledger=json.loads((root/'docs/evidence/appearance-2026-10-04/original-surface-ledger/LEDGER.json').read_text())
partition=json.loads((root/'docs/evidence/appearance-2026-10-04/sweater-coverage-owned/PARTITION.json').read_text())
owner=next(o for o in ledger['owners'] if o['uuid']==key[0])
intent=next(o for o in partition['owners'] if o['uuid']==key[0])
assert key[1] in intent['required']
assert f['originalVertexIDs']==owner['triangles'][key[1]]
corners=[owner['worldPositions'][i] for i in f['originalVertexIDs']]
assert f['barycentric']==[[1.,0.,0.],[0.,1.,0.],[0.,0.,1.]] and f['points']==corners
source=[tuple(Q(x) for x in row) for row in f['points']]
assert source==[tuple(row) for row in ref['sourceTriangle']]
squared,faceid,witness=ref['rowPrefix']['sourceFan'][0]['physicalCertificate']['failure']
assert ref['fan']==1 and witness[:4]==['vertex-face',0,2,'face']
bary=witness[4]
assert sum(bary)==1 and all(x>=0 for x in bary)
triangle=[tuple(Q(x) for x in mesh['vertices'][i]) for i in mesh['faces'][faceid]]
closest=tuple(sum((bary[j]*triangle[j][k] for j in range(3)),Q(0)) for k in range(3))
delta=tuple(source[2][k]-closest[k] for k in range(3))
direct=sum((x*x for x in delta),Q(0))
assert direct==squared and direct<Q(1,100)**2
# A point on each saved surface at <10mm is sufficient to reject the
# all-point gap. No global minimum or full classification is required.
def graph(name):
    m=load(name);faces=m['faces'];nv=len(m['vertices']);edges=collections.defaultdict(list)
    for i,face in enumerate(faces):
        assert len(set(face))==3 and all(0<=v<nv for v in face)
        for j in range(3):
            a,b=face[j],face[(j+1)%3];edges[tuple(sorted((a,b)))].append((a,b,i))
    links=[set() for _ in faces];boundary=[]
    for rows in edges.values():
        assert len(rows) in (1,2)
        if len(rows)==2:
            a,b=rows;assert a[:2]==tuple(reversed(b[:2]));links[a[2]].add(b[2]);links[b[2]].add(a[2])
        else:boundary.append(rows[0][:2])
    seen=set();stack=[0]
    while stack:
        i=stack.pop()
        if i in seen:continue
        seen.add(i);stack.extend(links[i]-seen)
    assert len(seen)==len(faces)
    return {'vertices':nv,'edges':len(edges),'faces':len(faces),'Euler':nv-len(edges)+len(faces),'boundaryEdges':len(boundary),'edgeConnected':True,'opposedSharedEdges':True,
            'scope':'Independent complete edge graph only; no independent vertex-link/intersection/cap/enclosure acceptance'}
physical=graph('PHYSICAL.json');test=graph('TEST-SOLID.json')
assert [physical[k] for k in ['vertices','edges','faces','Euler','boundaryEdges']]==[38,98,58,-2,22]
assert [test[k] for k in ['vertices','edges','faces','Euler','boundaryEdges']]==[42,120,80,2,0]
result={'utc':datetime.datetime.now(datetime.UTC).isoformat(),'decision':'B literal whole-source clearance; fixed design closed without repair',
        'originalOwner':{'uuid':owner['uuid'],'key':owner['key'],'name':owner['name']},'key':key,'requiredWholeTriangle':True,'originalVertexIDs':f['originalVertexIDs'],
        'sourceCorner':source[2],'garmentFace':faceid,'garmentIndices':mesh['faces'][faceid],'faceProvenance':mesh['faceProvenance'][faceid],
        'garmentTriangle':triangle,'nonnegativeBarycentricSumOne':bary,'pointOnGarment':closest,'delta':delta,'squaredDistance':direct,'requiredSquaredGap':Q(1,100)**2,
        'distanceMetresObserver':math.sqrt(float(direct)),'gapShortfallMetresObserver':.01-math.sqrt(float(direct)),
        'prefixKeyIndex':index,'physicalGraph':physical,'cappedGraph':test,
        'limits':'Counterexample proves failed10mm gap at two actual original/candidate surface points, not contact/intersection/global minimum, all remaining-domain coverage, fit, appearance, or failure cause in prior candidates.'}
with (p/'ROOT-WITNESS.json').open('x') as stream:stream.write(json.dumps(enc(result),indent=2)+'\n')
print(result['utc'],result['decision'],result['distanceMetresObserver'],physical,test)
