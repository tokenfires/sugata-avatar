"""Saved original source checks; never imports or replays the builder."""
import json, math, hashlib, struct, sys
from pathlib import Path
from collections import defaultdict, Counter

BASE=Path(__file__).resolve().parent; EXPORT=BASE/'export'
data=(EXPORT/'mesh.json').read_bytes(); mesh=json.loads(data)
P,F,parts=mesh['positions'],mesh['triangles'],mesh['parts']
failures=[]; metrics={}; observations=[]
def require(ok,kind,witness):
    if not ok: failures.append(dict(kind=kind,witness=witness))
def cross(a,b): return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def sub(a,b): return [x-y for x,y in zip(a,b)]
def dot(a,b): return sum(x*y for x,y in zip(a,b))
require(mesh['schema']=='sugata-original-artist-groom-1','schema',mesh['schema'])
require(all(len(p)==3 and all(isinstance(c,(int,float)) and math.isfinite(c) for c in p) for p in P),'finite-positions','whole source')
require(all(len(t)==3 and len(set(t))==3 and all(type(i) is int and 0<=i<len(P) for i in t) for t in F),'indices','whole source')
require(len(parts)==22 and len(mesh['roots'])==16,'complete-parts-roots',[len(parts),len(mesh['roots'])])
require(len(set(p['id'] for p in parts))==len(parts),'unique-names','all parts')
owned_faces=[]; owned_vertices=[]
for p in parts:
    owned_faces+=p['face_ids'];owned_vertices+=p['vertex_ids']
    edges=defaultdict(list); adjacency=defaultdict(set);vol=0;min_area=math.inf
    for fid in p['face_ids']:
        a,b,c=F[fid];pa,pb,pc=P[a],P[b],P[c]
        area=math.sqrt(dot(cross(sub(pb,pa),sub(pc,pa)),cross(sub(pb,pa),sub(pc,pa))))/2
        min_area=min(min_area,area);vol+=dot(pa,cross(pb,pc))/6
        require(area>1e-12,'triangle-area',dict(part=p['id'],face=fid,area=area))
        require(set(F[fid])<=set(p['vertex_ids']),'part-vertex-ownership',dict(part=p['id'],face=fid))
        for x,y in [(a,b),(b,c),(c,a)]:
            edges[tuple(sorted((x,y)))].append((x,y));adjacency[x].add(y);adjacency[y].add(x)
    bad=[dict(edge=list(e),uses=[list(t) for t in uses]) for e,uses in edges.items() if len(uses)!=2 or uses[0]!=uses[1][::-1]]
    require(not bad,'closed-oriented-edges',dict(part=p['id'],edges=bad))
    seen=set();todo=[p['vertex_ids'][0]]
    while todo:
        x=todo.pop()
        if x in seen:continue
        seen.add(x);todo.extend(adjacency[x]-seen)
    require(seen==set(p['vertex_ids']),'one-used-component',dict(part=p['id'],unreached=sorted(set(p['vertex_ids'])-seen)))
    chi=len(p['vertex_ids'])-len(edges)+len(p['face_ids'])
    require(chi==2 and vol>1e-10,'sphere-topology-positive-volume',dict(part=p['id'],chi=chi,signed_volume=vol))
    observations.append(dict(part=p['id'],vertices=len(p['vertex_ids']),triangles=len(p['face_ids']),edges=len(edges),chi=chi,signed_volume=vol,min_triangle_area=min_area))
require(sorted(owned_faces)==list(range(len(F))),'face-partition','all original faces exactly once')
require(sorted(owned_vertices)==list(range(len(P))),'vertex-partition','all original vertices exactly once')
head=parts[0]; require(head['id']=='head-reference','head-owner',head['id'])
scalp=set(mesh['scalp']['head_face_ids']);require(scalp<=set(head['face_ids']),'scalp-face-owner','original head only')
for r in mesh['roots']:
    anchor=r['head_vertex'];incident=[fid for fid in mesh['scalp']['head_face_ids'] if anchor in F[fid]]
    require(anchor in head['vertex_ids'] and P[anchor]==r['root'],'source-root',r['lock'])
    require(bool(incident) and incident==r['scalp_incident_faces'],'incident-scalp-ownership',dict(lock=r['lock'],faces=incident))
    require(len(r['centers'])==5 and P[r['first_section_center_vertex']]==r['centers'][0] and P[r['tip_center_vertex']]==r['centers'][-1],'complete-curve-centers',r['lock'])
    owner=next(p for p in parts if p['id']==r['lock'])
    require(r['first_section_center_vertex'] in owner['vertex_ids'] and r['tip_center_vertex'] in owner['vertex_ids'],'curve-part-owner',r['lock'])
hair=[i for p in parts if p['kind'] in ['hair-mass','directed-hair-lock'] for i in p['vertex_ids']]
radii=mesh['head']['radii']; norms=[(sum((P[i][k]/radii[k])**2 for k in range(3)),i) for i in hair]
bad=[dict(vertex=i,ellipsoid_norm2=n,position=P[i]) for n,i in norms if n<1-1e-10]
require(not bad,'hair-vertices-outside-fictional-head',bad)
metrics['hair_vertex_ellipsoid_norm2_min']=min(norms);metrics['hair_vertices']=len(hair)

lines=(EXPORT/'groom.obj').read_text().splitlines();objp=[];objf=[];groups=[];current=None;root_comments=[]
for line in lines:
    if line.startswith('v '):objp.append([float(c) for c in line.split()[1:]])
    elif line.startswith('g '):current=line[2:];groups.append([current,[]])
    elif line.startswith('f '):
        face=[int(c)-1 for c in line.split()[1:]];objf.append(face);groups[-1][1].append(face)
    elif line.startswith('# root '):root_comments.append(line)
require(objp==P and objf==F,'literal-OBJ-positions-faces','all original records, double roundtrip')
require([g[0] for g in groups]==[p['id'] for p in parts],'OBJ-groups','all original named parts')
for g,p in zip(groups,parts):require(g[1]==[F[fid] for fid in p['face_ids']],'OBJ-part-faces',p['id'])
expected_comments=['# root '+r['lock']+' head_vertex '+str(r['head_vertex']+1)+' first_center '+str(r['first_section_center_vertex']+1)+' tip '+str(r['tip_center_vertex']+1) for r in mesh['roots']]
require(root_comments==expected_comments,'OBJ-root-comments','all16 named roots')
expected=json.loads((EXPORT/'expected.json').read_text())
require(len(expected['parts'])==len(parts),'expected-part-count',[len(expected['parts']),len(parts)])
def sha(values,fmt):return hashlib.sha256(struct.pack('<'+fmt*len(values),*values)).hexdigest()
require(expected['meshSha']==hashlib.sha256(data).hexdigest(),'mesh-byte-SHA','actual serialized source')
require(expected['positionSha']==sha([c for p in P for c in p],'f'),'Float32-position-SHA','all actual positions')
for e,p in zip(expected['parts'],parts):require(e['id']==p['id'] and e['indexSha']==sha([i for fid in p['face_ids'] for i in F[fid]],'I'),'Uint32-part-SHA',p['id'])
report=dict(decision='A saved original graph/OBJ and finite fictional-reference predicates only' if not failures else 'B first numerical refusal; no native admission',positions=len(P),triangles=len(F),parts=observations,roots=len(mesh['roots']),scalp_faces=len(scalp),metrics=metrics,failures=failures,limits='No complete surface clearance, Boolean union, anatomy, Sugata attachment, renderer pixels, visual coherence, skinning/morphs, dynamics, strand material or AAA qualification. All original failure witnesses retained; no builder replay.')
(BASE/'CHECK.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ['decision','positions','triangles','roots','scalp_faces','metrics','failures']}))
sys.exit(1 if failures else 0)
