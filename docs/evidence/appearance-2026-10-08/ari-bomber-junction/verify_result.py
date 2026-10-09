"""Independent root verification: Bellman certificates and literal source intersections."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
import json,hashlib,datetime
from collections import defaultdict,deque
import numpy as np
H=Path(__file__).resolve().parent
sha=lambda a:hashlib.sha256(a.tobytes()).hexdigest()
r=json.loads((H/'RESULT.json').read_text());p=json.loads((H/'POLICY.json').read_text())
for pin in json.loads((H/'EXEC-QUERY.json').read_text())['pins']:
 b=Path(pin['path']).read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256']
inputs=json.loads((H/'INPUTS.json').read_text())
with np.load(next(x['path'] for x in inputs if x['path'].endswith('/after-geometry.npz')),allow_pickle=False) as z:
 raw=z['Human_world'];t=z['Human_triangles']
assert raw.shape==(13380,3) and raw.dtype==np.float32 and t.shape==(26756,3) and t.dtype==np.int32
assert sha(raw)==r['source']['world_sha256'] and sha(t)==r['source']['triangles_sha256']
w=raw.astype(np.float64);assert np.isfinite(w).all() and t.min()>=0 and t.max()<len(w)
areas=np.sqrt(np.sum(np.cross(w[t[:,1]]-w[t[:,0]],w[t[:,2]]-w[t[:,0]])**2,axis=1));assert (areas>0).all()
e,c=np.unique(np.sort(np.vstack([t[:,[0,1]],t[:,[1,2]],t[:,[2,0]]]),axis=1),axis=0,return_counts=True)
assert len(e)==40134 and (c==2).all() and sha(e)==r['source']['edges_sha256']
ell=np.sqrt(np.sum((w[e[:,1]]-w[e[:,0]])**2,axis=1));assert (ell>0).all() and sha(ell)==r['source']['edge_lengths_sha256']
adj=defaultdict(list);weights={}
for (a,b),length in zip(e,ell):
 a,b=int(a),int(b);adj[a].append(b);adj[b].append(a);weights[a,b]=weights[b,a]=float(length)
m=json.loads(next(Path(x['path']).read_text() for x in inputs if x['path'].endswith('/SECTION-MANIFEST.json')))
u=next(x for x in m['sections'] if x['name']=='torso-upper');seeds={'torso':sorted({i for row in u['ordered_source_triangle_edges'] for i in row['edge']})}
for row in u['ordered_source_triangle_edges']:
 a,b=row['edge'];assert (a,b) in weights and 0<row['fraction']<1 and np.array_equal(w[a]+row['fraction']*(w[b]-w[a]),row['point'])
for side in ['l','r']:
 sq=np.sum((w-np.array(p['arm_centers'][side]))**2,axis=1);seeds[side]=np.flatnonzero(sq<=sq.min()+1e-12).tolist()
 assert float(np.sqrt(sq.min()))<=.1
b=(H/'distances.npz').read_bytes();assert len(b)==r['derived_archive']['bytes'] and hashlib.sha256(b).hexdigest()==r['derived_archive']['sha256']
fields={};certificates={}
with np.load(H/'distances.npz',allow_pickle=False) as z:
 assert set(z.files)=={name+suffix for name in ['torso','l','r'] for suffix in ['_distance','_predecessor']}
 for name in ['torso','l','r']:
  d=z[name+'_distance'];prev=z[name+'_predecessor'];f=r['distance_fields'][name]
  assert d.dtype==np.float64 and prev.dtype==np.int32 and d.shape==prev.shape==(13380,)
  assert sha(d)==f['distance_sha256'] and sha(prev)==f['predecessor_sha256'] and np.isfinite(d).all() and (d>=0).all()
  assert seeds[name]==r['seeds'][name]['vertex_ids'] and np.array_equal(w[seeds[name]],r['seeds'][name]['points'])
  assert np.flatnonzero(d==0).tolist()==seeds[name] and (prev[seeds[name]]==-1).all()
  violation=float(np.max(np.abs(d[e[:,0]]-d[e[:,1]])-ell));assert violation<=1e-14
  errors=[]
  for i in np.flatnonzero(d>0):
   parent=int(prev[i]);assert parent in adj[int(i)] and d[parent]<d[i]
   errors.append(abs(float(d[i])-(float(d[parent])+weights[int(i),parent])))
  assert max(errors)<=1e-14
  certificates[name]={'all_edges_Bellman_inequality_max_excess':violation,'all_nonseed_predecessor_equality_max_error':max(errors),'strict_predecessor_descent':True,'seed_count':len(seeds[name])};fields[name]=d.copy()
boundary_checks=[];domains={}
for rec in r['boundaries']:
 side=rec['side'];assert rec['role']==next(role for role in p['roles'] if role['side']==side);field=fields[side]-fields['torso'];assert (np.abs(field)>1e-10).all();ids=set(np.flatnonzero(field<0).tolist());seen={seeds[side][0]};q=deque(seen)
 while q:
  i=q.popleft()
  for j in adj[i]:
   if j in ids and j not in seen:seen.add(j);q.append(j)
 assert seen==ids and all(i in ids for i in seeds[side]);domains[side]=ids
 assert r['regions'][side]['vertices']==len(ids) and r['regions'][side]['vertex_ids_sha256']==sha(np.array(sorted(ids),dtype=np.int32))
 crossing={};segments={};graph=defaultdict(set)
 for ti,tri in enumerate(t):
  es=[]
  for a,b in zip(tri,np.roll(tri,-1)):
   a,b=sorted((int(a),int(b)))
   if (field[a]<0)!=(field[b]<0):
    es.append((a,b));fraction=float(field[a]/(field[a]-field[b]));crossing[a,b]=(fraction,w[a]+fraction*(w[b]-w[a]))
  if es:
   assert len(es)==2;segments[ti]=set(es);graph[es[0]].add(es[1]);graph[es[1]].add(es[0])
 assert set(crossing)=={tuple(row['edge']) for row in rec['source_crossings']}
 for row in rec['source_crossings']:
  fraction,xyz=crossing[tuple(row['edge'])];assert fraction==row['fraction'] and np.array_equal(xyz,row['point'])
 assert segments=={row['triangle']:{tuple(a) for a in row['edges']} for row in rec['source_segments']}
 assert all(len(v)==2 for v in graph.values());used=set()
 for cycle in rec['cycles']:
  nodes=list(map(tuple,cycle));assert len(set(nodes))==len(nodes) and not used.intersection(nodes);used.update(nodes)
  assert all(b in graph[a] for a,b in zip(nodes,nodes[1:]+nodes[:1]))
 assert used==set(crossing) and len(rec['cycles'])==1
 nodes=list(map(tuple,rec['cycles'][0]));points=np.array([crossing[a][1] for a in nodes]);role=rec['role']
 bad=np.flatnonzero((points[:,0]*role['x_sign']<=0)|(points[:,2]<=role['z_min'])|(points[:,2]>=role['z_max']))
 assert np.array_equal(points.min(axis=0),rec['world_min']) and np.array_equal(points.max(axis=0),rec['world_max'])
 if rec.get('accepted_source_reference'):assert not len(bad)
 elif r.get('refusal',{}).get('reason')=='Source branch outside fixed artist role interval':
  witness=r['refusal']['witness'];assert witness['ordered_point_indices']==bad.tolist() and np.array_equal(points[bad],witness['points'])
 boundary_checks.append({'side':side,'crossings':len(crossing),'triangles':len(segments),'role_invalid_indices':bad.tolist(),'world_min':points.min(axis=0).tolist(),'world_max':points.max(axis=0).tolist()})
if r['passed']:assert len(boundary_checks)==2 and not domains['l'].intersection(domains['r'])
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'verified':True,'source_query_passed':r['passed'],'method':'independent full-source identities/area/edge graph, Bellman inequality and strictly descending predecessor equality certificates, complete triangle intersections/loops/role witnesses','distance_certificates':certificates,'boundaries':boundary_checks,'refusal':r.get('refusal'),'native_chart':'NOT_RUN','physical_3D_self_clearance':'UNKNOWN'}
with (H/'ROOT-RESULT.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps(out))
