"""One fixed source-bound temporary volume control; no native work or candidate fitting."""
from pathlib import Path
import json,hashlib,math,struct,collections,datetime
P=Path(__file__).resolve().parent;A=Path('../ari-root-flow-atlas/PARTITION.json');a=json.loads((P/A).read_text());rows=sorted([r for z in a['zones'].values() for r in z],key=lambda r:r['triangle']);points={};incident=collections.defaultdict(list);edges=collections.defaultdict(list);graph=collections.defaultdict(set)
for i,r in enumerate(rows):
 for native,p in zip(r['vertices'],r['coordinates']):
  if native in points:assert points[native]==p
  points[native]=p;incident[native].append(r)
 for u,v in zip(r['vertices'],r['vertices'][1:]+r['vertices'][:1]):edges[tuple(sorted((u,v)))].append((i,u,v));graph[u].add(v);graph[v].add(u)
assert all(len(es) in [1,2] for es in edges.values());assert all(es[0][1:]==tuple(reversed(es[1][1:])) for es in edges.values() if len(es)==2)
remaining=set(points);components=[]
while remaining:
 todo=[min(remaining)];component=set()
 while todo:
  x=todo.pop()
  if x in component:continue
  component.add(x);todo.extend(graph[x]-component)
 remaining-=component;components.append(sorted(component))
assert len(components)==1,'Source domain is not one connected component; stop original mass authoring'
boundary=[es[0] for es in edges.values() if len(es)==1];boundaryverts={x for _,u,v in boundary for x in [u,v]};distance={x:0 for x in boundaryverts};todo=collections.deque(sorted(boundaryverts))
while todo:
 u=todo.popleft()
 for v in sorted(graph[u]):
  if v not in distance:distance[v]=distance[u]+1;todo.append(v)
heights={'crown':.020,'temple':.008,'nape':.006};f32=lambda x:struct.unpack('<f',struct.pack('<f',x))[0];ids=sorted(points);index={n:i for i,n in enumerate(ids)};verts=[];ledger=[]
for n in ids:
 total=sum(r['area'] for r in incident[n]);normal=[sum(r['normal'][j]*r['area'] for r in incident[n])/total for j in range(3)];norm=math.sqrt(sum(x*x for x in normal));assert norm>1e-8;normal=[x/norm for x in normal];height=sum(heights[r['zone']]*r['area'] for r in incident[n])/total;t=min(distance[n]/3,1);taper=.15+.85*t*t*(3-2*t);height*=taper;outer=[f32(points[n][j]+normal[j]*height) for j in range(3)];verts.append(outer);ledger.append({'native_vertex':n,'source':points[n],'source_triangles':[r['triangle'] for r in incident[n]],'normal':normal,'graph_boundary_distance':distance[n],'taper':taper,'lift_m':height,'outer':outer,'outer_index':index[n],'base_index':len(ids)+index[n]})
verts += [points[n] for n in ids];faces=[];roles=[];sourcefaces=[]
for r in rows:
 f=[index[n] for n in r['vertices']];faces.append(f);roles.append('outer');sourcefaces.append(r['triangle']);faces.append([len(ids)+i for i in reversed(f)]);roles.append('base');sourcefaces.append(r['triangle'])
for row,u,v in boundary:faces.append([index[v],index[u],len(ids)+index[u],len(ids)+index[v]]);roles.append('wall');sourcefaces.append(rows[row]['triangle'])
closed=collections.defaultdict(list)
for i,f in enumerate(faces):
 for u,v in zip(f,f[1:]+f[:1]):closed[tuple(sorted((u,v)))].append((i,u,v))
assert all(len(es)==2 and es[0][1:]==tuple(reversed(es[1][1:])) for es in closed.values()),'Authoredvolume manifold/opposite edge failure'
result={'authored_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'partition_sha256':hashlib.sha256((P/A).read_bytes()).hexdigest(),'artist_heights_m':heights,'taper':'graphdistance/3 clamp; .15+.85*smoothstep(t)','shared_normal':'Area-weighted source triangle normals, normalized once per nativeID','component_count':len(components),'boundary_edges':len(boundary),'source_ids':ids,'vertex_ledger':ledger,'vertices':verts,'faces':faces,'face_roles':roles,'face_source_triangles':sourcefaces,'material_rgba':[.055,.07,.09,1],'roughness':.85,'smooth_faces':True,'contact_contract':'Base exact source skin coordinates; boundarywalls intentionally join base to outer. No bodyclearance claim. All edge BVH observations recorded by role; only outer-edge observedhit refuses this outer-envelope control. Base/wall observations retained as intended skin anchoring, not classified penetration. Outer-only artist ear+forehead triangleAABB gate; base/wall footprint remains frozenatlas and allrole overlaps reported.','bounds':{'mass_vertices':2000,'mass_triangles':4000,'all_vertices':500000,'all_triangles':1000000},'artist_ear_boxes':a['ear_intent_boxes'],'artist_forehead_gate':{'front_y':a['artist_thresholds']['front_boundary_y'],'min_z':a['artist_thresholds']['forehead_z']},'limits':'Temporarysmoothmass only. Provisional border nothairline; base/wall intentionalassociation, no fullgroom/occupancy/clearance/selfcontact/motion/consumer/AAA qualification.'}
with (P/'MASS.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps({'source_triangles':len(rows),'unique_source_vertices':len(ids),'components':len(components),'boundary_edges':len(boundary),'mass_vertices':len(verts),'mass_faces':len(faces),'maximum_lift_m':max(x['lift_m'] for x in ledger)}))
