"""Root independent stored contour/angle-winding/linear-solve/barycentric verification."""
from pathlib import Path
import json,hashlib,datetime,math
import numpy as np
H=Path(__file__).resolve().parent
r=json.loads((H/'RESULT.json').read_text());policy=json.loads((H/'POLICY.json').read_text());inputs=json.loads((H/'INPUTS.json').read_text());assert r['passed'] and r['post_pins_exact']
for pin in json.loads((H/'EXEC-QUERY.json').read_text())['pins']:
 b=Path(pin['path']).read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256']
with np.load(next(p['path'] for p in inputs if p['path'].endswith('/after-geometry.npz')),allow_pickle=False) as z:raw=z['Human_world'];t=z['Human_triangles']
sha=lambda a:hashlib.sha256(a.tobytes()).hexdigest()
assert raw.dtype==np.float32 and raw.shape==(13380,3) and t.dtype==np.int32 and t.shape==(26756,3) and sha(raw)==r['source']['world_sha256'] and sha(t)==r['source']['triangles_sha256'];w=raw.astype(float)
a=w[t[:,1]]-w[t[:,0]];b=w[t[:,2]]-w[t[:,0]];gram=np.sum(a*a,axis=1)*np.sum(b*b,axis=1)-np.sum(a*b,axis=1)**2;assert np.isfinite(gram).all() and (gram>0).all()
checks=[];pairs=0;hits_checked=0
for station,s in zip(policy['stations'],r['sections']):
 assert all(s[k]==station[k] for k in station);origin=np.array(s['origin']);normal=np.array(s['normal']);distance=(w-origin)@normal;assert (np.abs(distance)>1e-10).all();expected_tids=np.flatnonzero((distance[t].min(axis=1)<0)&(distance[t].max(axis=1)>0));assert expected_tids.tolist()==[v['triangle'] for v in s['source_segments']]
 lookup={tuple(v['edge']):v for v in s['source_crossings']};actual_edges=set();neighbors={}
 for seg in s['source_segments']:
  tri=t[seg['triangle']];es=[]
  for a,b in zip(tri,np.roll(tri,-1)):
   a,b=sorted((int(a),int(b)))
   if (distance[a]<0)!=(distance[b]<0):es.append((a,b));actual_edges.add((a,b))
  assert set(es)==set(map(tuple,seg['edges'])) and len(es)==2
  for a,b in [(es[0],es[1]),(es[1],es[0])]:neighbors.setdefault(a,set()).add(b)
 assert actual_edges==set(lookup) and all(len(v)==2 for v in neighbors.values())
 for edge,row in lookup.items():
  a,b=edge;f=float(distance[a]/(distance[a]-distance[b]));point=w[a]+f*(w[b]-w[a]);assert abs(f-row['fraction'])<1e-14 and np.max(np.abs(point-row['point']))<1e-12
 used=set();inside=[];bu=np.array(s['plane_basis']['u']);bv=np.array(s['plane_basis']['v'])
 for index,comp in enumerate(s['components']):
  edges=list(map(tuple,comp['ordered_edges']));assert len(edges)==len(set(edges)) and not used.intersection(edges);used.update(edges);assert all(b in neighbors[a] for a,b in zip(edges,edges[1:]+edges[:1]));xyz=np.array([lookup[e]['point'] for e in edges]);q=np.c_[(xyz-origin)@bu,(xyz-origin)@bv];assert np.max(np.abs(q-comp['projected_points']))<1e-12
  nxt=np.roll(q,-1,axis=0);angle=float(np.arctan2(q[:,0]*nxt[:,1]-q[:,1]*nxt[:,0],np.sum(q*nxt,axis=1)).sum());is_inside=abs(angle)>math.pi;assert is_inside==comp['origin_inside'];inside.append(index) if is_inside else None
  area=.5*float(np.sum(q[:,0]*nxt[:,1]-q[:,1]*nxt[:,0]));assert abs(area-comp['signed_area'])<1e-14 and abs(area)>1e-12 and abs(float(np.linalg.norm(q,axis=1).max())-comp['max_radial_extent'])<1e-14
  delta=nxt-q;frac=np.clip(-np.sum(q*delta,axis=1)/np.sum(delta*delta,axis=1),0,1);minimum=float(np.sqrt(np.sum((q+frac[:,None]*delta)**2,axis=1)).min());assert abs(minimum-comp['origin_boundary_distance'])<1e-14 and minimum>1e-9
  n=len(q)
  for i in range(n):
   for j in range(i+2,n):
    if i==0 and j==n-1:continue
    pairs+=1;matrix=np.column_stack((delta[i],-delta[j]));det=float(np.linalg.det(matrix))
    if abs(det)>1e-14:
     uv=np.linalg.solve(matrix,q[j]-q[i]);assert not ((uv>=0).all() and (uv<=1).all()),(s['name'],index,i,j)
    else:
     col=abs(float(delta[i,0]*(q[j,1]-q[i,1])-delta[i,1]*(q[j,0]-q[i,0])))<=1e-14
     if col:assert not np.all(np.maximum(np.minimum(q[i],nxt[i]),np.minimum(q[j],nxt[j]))<=np.minimum(np.maximum(q[i],nxt[i]),np.maximum(q[j],nxt[j]))+1e-12)
 assert used==actual_edges and inside==[s['selected_component']];selected=s['components'][s['selected_component']];assert selected['max_radial_extent']<=s['max_radial_extent']
 mb=s['meridian_basis'];u=np.array(mb['u_front']);v=np.array(mb['v_down']);assert np.max(np.abs(np.array([u,v,normal])@np.array([u,v,normal]).T-np.eye(3)))<1e-12 and v[2]<-1e-9 and abs(np.dot(np.cross(u,v),normal)-mb['handedness'])<1e-12
 front=np.array([0.,-1.,0.]);expected=front-np.dot(front,normal)*normal;expected/=np.linalg.norm(expected);assert np.max(np.abs(expected-u))<1e-12
 edges=list(map(tuple,selected['ordered_edges']));xyz=np.array([lookup[e]['point'] for e in edges]);q=np.c_[(xyz-origin)@u,(xyz-origin)@v];segment_tri={frozenset(map(tuple,seg['edges'])):seg['triangle'] for seg in s['source_segments']};assert len(s['meridian_samples'])==16
 for k,sample in enumerate(s['meridian_samples']):
  d=np.array([math.cos(2*math.pi*k/16),math.sin(2*math.pi*k/16)]);assert sample['index']==k and np.array_equal(d,sample['direction_2d']);expected_hits=[]
  for i,(a,b) in enumerate(zip(q,np.roll(q,-1,axis=0))):
   matrix=np.column_stack((d,-(b-a)));det=float(np.linalg.det(matrix))
   if abs(det)<=1e-12:
    col=abs(float(a[0]*d[1]-a[1]*d[0]))<=1e-12;assert not(col and max(np.dot(a,d),np.dot(b,d))>1e-9);continue
   ray_t,f=np.linalg.solve(matrix,a)
   if ray_t>1e-9 and -1e-12<=f<=1+1e-12:expected_hits.append((i,float(ray_t),float(f)))
  assert [a[0] for a in expected_hits]==[h['segment'] for h in sample['candidate_hits']]
  for hit,(i,ray_t,f) in zip(sample['candidate_hits'],expected_hits):
   if abs(f)<=1e-12:f=0.
   elif abs(f-1)<=1e-12:f=1.
   assert abs(f-hit['segment_fraction'])<1e-12 and abs(ray_t-hit['ray_distance'])<1e-12;tid=segment_tri[frozenset([edges[i],edges[(i+1)%len(edges)]])];assert tid==hit['triangle'] and np.array_equal(t[tid],hit['triangle_vertex_ids']);bary=np.array(hit['barycentric_weights']);weights={int(j):0. for j in t[tid]}
   for factor,e in [(1-f,edges[i]),(f,edges[(i+1)%len(edges)])]:weights[e[0]]+=factor*(1-lookup[e]['fraction']);weights[e[1]]+=factor*lookup[e]['fraction']
   assert np.max(np.abs(bary-np.array([weights[int(j)] for j in t[tid]])))<1e-12 and np.max(np.abs(bary@w[t[tid]]-hit['point']))<1e-12 and abs(bary.sum()-1)<1e-12 and (bary>=-1e-12).all();hits_checked+=1
  assert len(sample['physical_hit_groups'])==1 and sample['accepted_source_sample'];primary=min(sample['all_incident_associations'],key=lambda h:(h['triangle'],h['segment']));assert primary==sample['primary_association'] and sample['all_incident_associations']==sample['candidate_hits']
 checks.append({'name':s['name'],'components':len(s['components']),'selected_nodes':len(edges),'selected_extent':selected['max_radial_extent'],'signed_area':selected['signed_area'],'handedness':mb['handedness'],'fixedmeridian_samples':16,'max_candidate_hits':max(len(a['candidate_hits']) for a in s['meridian_samples'])})
assert len(checks)==4 and pairs==r['self_intersection_pairs'] and pairs<=1000000
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'verified':True,'source_query_passed':True,'method':'Independent sourcecross/triangle/cycle/atan2originwinding/linearsolveallnonadjacentsegments andallrayhit classes/sourcebarys','nonadjacent_segment_pairs':pairs,'candidate_hits_verified':hits_checked,'stations':checks,'global_allangle_starshapedness':'UNKNOWN; only16fixedrays','artist_role':'PENDING separatefirstchart','garment_geometry':False,'fit_clearance_motion':'UNKNOWN'}
with (H/'ROOT-RESULT.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps(out))
