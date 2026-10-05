"""Independent saved-only raw topology/identity/OBJ observer. No creator import."""
from pathlib import Path
import collections
import hashlib
import json
import math

BASE=Path(__file__).resolve().parent
raw=(BASE/'export/mesh.json').read_bytes();m=json.loads(raw)
points,faces=m['positions'],m['triangles']
assert m['units']=='unitless' and m['axes']=={'X':'lateral','Y':'up','Z':'toe-forward'}
assert len(points)==len(m['vertex_labels'])==len(set(m['vertex_labels']))
assert len(faces)==len(m['face_parts'])
assert all(len(p)==3 and all(type(x) in (int,float) and math.isfinite(x) for x in p) for p in points)
assert len({p['id'] for p in m['parts']})==len(m['parts'])
seen_vertices,seen_faces=set(),set();metrics=[]


def connected(graph,start):
    seen,pending=set(),[start]
    while pending:
        v=pending.pop()
        if v not in seen:seen.add(v);pending.extend(graph[v]-seen)
    return seen


for part in m['parts']:
    vids,fids=part['vertex_ids'],part['face_ids']
    assert vids and fids and len(vids)==len(set(vids)) and len(fids)==len(set(fids))
    assert not seen_vertices.intersection(vids) and not seen_faces.intersection(fids)
    seen_vertices.update(vids);seen_faces.update(fids)
    assert all(type(i)==int and 0<=i<len(points) for i in vids)
    assert all(type(i)==int and 0<=i<len(faces) for i in fids)
    edges=collections.defaultdict(list);links=collections.defaultdict(list)
    minimum=math.inf;volume=0
    for fi in fids:
        tri=faces[fi];assert len(tri)==3 and len(set(tri))==3
        assert all(type(v)==int and v in set(vids) for v in tri)
        assert m['face_parts'][fi]==part['id']
        a,b,c=[points[v] for v in tri]
        u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)]
        cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
        area=math.sqrt(sum(x*x for x in cross))/2;assert area>1e-10,(part['id'],fi)
        minimum=min(minimum,area)
        volume+=sum(a[k]*(b[(k+1)%3]*c[(k+2)%3]-b[(k+2)%3]*c[(k+1)%3]) for k in range(3))/6
        for i,a_id in enumerate(tri):
            b_id=tri[(i+1)%3];edges[tuple(sorted((a_id,b_id)))].append((fi,a_id,b_id))
            links[a_id].append((tri[(i-1)%3],b_id))
    assert set(links)==set(vids),'Unused part vertex'
    graph=collections.defaultdict(set)
    for edge,es in edges.items():
        assert len(es)==2,(part['id'],'Open/nonmanifold edge',edge)
        assert es[0][1:]==es[1][1:][::-1],(part['id'],'Winding',edge)
        graph[es[0][0]].add(es[1][0]);graph[es[1][0]].add(es[0][0])
    assert len(connected(graph,fids[0]))==len(fids),'Disconnected part'
    for vi,pairs in links.items():
        link=collections.defaultdict(set);link_edges=set()
        for a,b in pairs:
            edge=tuple(sorted((a,b)));assert edge not in link_edges,'Duplicate link edge'
            link_edges.add(edge);link[a].add(b);link[b].add(a)
        assert all(len(ns)==2 for ns in link.values()),'Nonmanifold vertex link'
        assert len(connected(link,next(iter(link))))==len(link),'Disconnected vertex link'
    euler=len(vids)-len(edges)+len(fids);assert euler==2 and volume>1e-10,(part['id'],euler,volume)
    for interface,ids in part['named_interfaces'].items():
        loops=ids if ids and isinstance(ids[0],list) else [ids]
        for loop in loops:
            assert len(loop)>=3 and len(loop)==len(set(loop)) and set(loop)<=set(vids)
            assert all(tuple(sorted((a,b))) in edges for a,b in zip(loop,loop[1:]+loop[:1])),interface
    metrics.append({'part':part['id'],'vertices':len(vids),'triangles':len(fids),
                    'edges':len(edges),'euler':euler,'signed_volume':volume,'minimum_triangle_area':minimum})
assert seen_vertices==set(range(len(points))) and seen_faces==set(range(len(faces)))
by_id={p['id']:p for p in m['parts']}
roles={'upper_shell','fictional_reference','sole','heel','tongue_front_facing','rear_strip','counter','lace'}
for side in ['left','right']:
    ps=[p for p in m['parts'] if p['side']==side]
    assert {p['role'] for p in ps}==roles
    assert sum(p['role']=='lace' for p in ps)==12
    for p in ps:
        assert p['visible']==(p['role']!='fictional_reference')
        assert p['id'].startswith(side+'.') and all(m['vertex_labels'][v].startswith(p['id']+'.') for v in p['vertex_ids'])
    upper=by_id[side+'.upper'];assert set(upper['named_interfaces'])=={'outer_bottom','inner_floor','rim_outer','rim_inner','outer_section_rings','inner_section_rings'}
    assert all(len(upper['named_interfaces'][key])==32 for key in ['outer_bottom','inner_floor','rim_outer','rim_inner'])
nv,nf=m['pair']['left_vertex_count'],m['pair']['left_face_count']
assert len(points)==2*nv and len(faces)==2*nf
for i in range(nv):
    assert points[i+nv]==[-points[i][0],points[i][1],points[i][2]],('Pair point',i)
    assert m['vertex_labels'][i+nv]==m['vertex_labels'][i].replace('left.','right.',1)
for i in range(nf):assert faces[i+nf]==[v+nv for v in faces[i][::-1]],('Pair winding',i)
for p in [p for p in m['parts'] if p['side']=='left']:
    q=by_id[p['id'].replace('left.','right.',1)]
    assert q['vertex_ids']==[v+nv for v in p['vertex_ids']] and q['face_ids']==[f+nf for f in p['face_ids']]
    assert q['role']==p['role'] and q['visible']==p['visible'] and q['color']==p['color']
assert m['nominal_interface']['role']=='fictional_reference'
assert m['nominal_interface']['sections_left_local'][-1][0]==1.29
assert m['contact_intent'] and m['limits']
for filename,reference in [('boots.obj',False),('nominal-reference.obj',True)]:
    op,of,groups=[],[],[];group=None
    for line in (BASE/'export'/filename).read_text().splitlines():
        words=line.split()
        if not words:continue
        if words[0]=='v':op.append([float(x) for x in words[1:]])
        elif words[0]=='g':group=words[1];groups.append(group)
        elif words[0]=='f':of.append((group,[int(x)-1 for x in words[1:]]))
    expected=[p for p in m['parts'] if (p['role']=='fictional_reference')==reference]
    assert op==points and groups==[p['id'] for p in expected]
    assert of==[(p['id'],faces[fi]) for p in expected for fi in p['face_ids']],filename
result={'mesh_sha256':hashlib.sha256(raw).hexdigest(),'vertices':len(points),'triangles':len(faces),
        'parts':len(m['parts']),'per_part':metrics,'pair_exact':True,'obj_roundtrips':True,
        'checks':'Raw finite/indexed/used/nondegenerate triangle graphs; closed oriented edge twins and connected manifold vertex links; Euler2/positive volume per named part; role/interfaces/reflected pair and OBJ identity',
        'limits':'Topology/identity only; not general self-intersection, inter-part collision/contact, cavity/enclosure, recognizability, physical last/body fit/rig/morph/pose/motion/AAA proof'}
assert not (BASE/'CPU-RESULT.json').exists(),'Refuse second check'
(BASE/'CPU-RESULT.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
