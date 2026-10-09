"""Stored-only root Bellman/route/cycle and independent union-find partition verification."""
from pathlib import Path
from collections import defaultdict
import json,hashlib,datetime
import numpy as np
H=Path(__file__).resolve().parent
r=json.loads((H/'RESULT.json').read_text());policy=json.loads((H/'POLICY.json').read_text());inputs=json.loads((H/'INPUTS.json').read_text())
for row in json.loads((H/'EXEC-QUERY.json').read_text())['pins']:
 b=Path(row['path']).read_bytes();assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256']
sha=lambda a:hashlib.sha256(a.tobytes()).hexdigest()
with np.load(next(x['path'] for x in inputs if x['path'].endswith('/after-geometry.npz')),allow_pickle=False) as z:raw=z['Human_world'];t=z['Human_triangles']
assert raw.dtype==np.float32 and raw.shape==(13380,3) and t.dtype==np.int32 and t.shape==(26756,3) and np.isfinite(raw).all() and t.min()>=0 and t.max()<len(raw)
assert sha(raw)==r['source']['world_sha256'] and sha(t)==r['source']['triangles_sha256'];w=raw.astype(float);a=w[t[:,1]]-w[t[:,0]];b=w[t[:,2]]-w[t[:,0]];gram=np.sum(a*a,axis=1)*np.sum(b*b,axis=1)-np.sum(a*b,axis=1)**2;assert (gram>0).all()
edgefaces=defaultdict(list);directions=defaultdict(list)
for tid,tri in enumerate(t):
 for a,b in zip(tri,np.roll(tri,-1)):
  a,b=int(a),int(b);edge=tuple(sorted((a,b)));edgefaces[edge].append(tid);directions[edge].append(1 if a<b else -1)
edges=np.array(sorted(edgefaces),dtype=np.int32);ell=np.sqrt(np.sum((w[edges[:,1]]-w[edges[:,0]])**2,axis=1));assert len(edges)==40134 and all(len(v)==2 for v in edgefaces.values()) and all(sum(v)==0 for v in directions.values()) and sha(edges)==r['source']['edges_sha256'] and sha(ell)==r['source']['lengths_sha256'] and (ell>0).all()
adj=defaultdict(list);weights={}
for (a,b),length in zip(edges,ell):a,b=int(a),int(b);adj[a].append(b);adj[b].append(a);weights[a,b]=weights[b,a]=float(length)
sections=json.loads(next(Path(x['path']).read_text() for x in inputs if x['path'].endswith('/SECTION-MANIFEST.json')));neck=next(row for row in sections['sections'] if row['name']=='neckline');neckids=set()
for row in neck['ordered_source_triangle_edges']:
 a,b=row['edge'];assert (a,b) in edgefaces and 0<row['fraction']<1 and np.max(np.abs(w[a]+row['fraction']*(w[b]-w[a])-row['point']))<1e-12;neckids.update((a,b))
expected_neck_faces=np.flatnonzero(np.any(np.isin(t,list(neckids)),axis=1));assert sorted(neckids)==r['neckline_reference']['vertex_ids'] and expected_neck_faces.tolist()==r['neckline_reference']['incident_triangle_ids']
old=json.loads(next(Path(x['path']).read_text() for x in inputs if x['path'].endswith('/ari-bomber-junction/RESULT.json')))
for side,i in policy['arm_reference_vertex'].items():assert old['seeds'][side]['vertex_ids']==[i] and np.array_equal(raw[i],old['seeds'][side]['points'][0])
mapping=json.loads(next(Path(x['path']).read_text() for x in inputs if x['path'].endswith('/SOURCE-MAP.json')));bones={b['name']:b for b in mapping['rig_object']['rig']['bones']}
archive=(H/'fields.npz').read_bytes();assert len(archive)==r['derived_archive']['bytes'] and hashlib.sha256(archive).hexdigest()==r['derived_archive']['sha256'];certs={};checked=[];armsets={}
with np.load(H/'fields.npz',allow_pickle=False) as z:
 assert z.files==r['derived_archive']['arrays']
 fields={}
 for name,record in r['fields'].items():
  d=z[name+'_distance'];prev=z[name+'_predecessor'];origin=record['origin'];assert d.dtype==np.float64 and prev.dtype==np.int32 and d.shape==prev.shape==(13380,) and np.isfinite(d).all() and (d>=0).all() and sha(d)==record['distance_sha256'] and sha(prev)==record['predecessor_sha256']
  assert np.flatnonzero(d==0).tolist()==[origin] and prev[origin]==-1;excess=float(np.max(np.abs(d[edges[:,0]]-d[edges[:,1]])-ell));assert excess<=1e-14;error=0.0
  for i in np.flatnonzero(d>0):
   j=int(prev[i]);assert j in adj[int(i)] and d[j]<d[i];error=max(error,abs(float(d[i])-(float(d[j])+weights[int(i),j])))
  assert error<=1e-14;certs[name]={'origin':origin,'Bellman_max_excess':excess,'predecessor_max_equality_error':error,'strict_descent':True};fields[name]=(d,prev)
 for side_record in r['sides']:
  side=side_record['side'];anchors=policy['anchor_ids'][side];assert anchors==side_record['anchor_ids'];prior=[];overlap_witness=None
  for k,path in enumerate(side_record['paths']):
   d,prev=fields[path['field']];route=[path['target']]
   while route[-1]!=path['origin']:route.append(int(prev[route[-1]]));assert len(route)<=13380
   route.reverse();assert route==path['vertex_ids'] and np.array_equal(raw[route],path['points'])
   for i,row in enumerate(path['edges']):
    a,b=route[i:i+2];assert row['vertices']==[a,b] and sorted(row['incident_triangles'])==sorted(edgefaces[tuple(sorted((a,b)))])
   for u in path['uniqueness']:
    i=u['vertex'];options=sorted(j for j in adj[i] if abs(float(d[j])+weights[i,j]-float(d[i]))<=1e-12);assert options==sorted(c['vertex'] for c in u['candidates']) and u['selected_predecessor']==prev[i] and u['distance']==d[i]
   if path.get('accepted_source_route'):
    assert len(path['uniqueness'])==len(route)-1 and all(len(u['candidates'])==1 and u['candidates'][0]['vertex']==u['selected_predecessor'] for u in path['uniqueness']);assert not set(route[1:-1])&set(anchors[:-1])
    sign=1 if side=='l' else -1;assert (raw[route,0]*sign>0).all() and (raw[route,2]>bones['lowerarm_'+side]['head_local'][2]).all() and (raw[route,2]<bones['neck_01']['head_local'][2]).all();oldvertices={v for old in prior for v in old};allowed={route[0]} if prior else set()
    if k==3:allowed.add(route[-1])
    overlaps=[v for v in route if v in oldvertices and v not in allowed]
    if overlaps and overlap_witness is None:overlap_witness={'vertex':overlaps[0],'field':path['field'],'point':raw[overlaps[0]].tolist()}
    if path.get('incremental_no_prior_nonconsecutive_vertex_or_edge_overlap'):assert not overlaps
   prior.append(route)
  if overlap_witness:
   ref=r['refusal']['witness'];assert r['refusal']['reason']=='Repeated nonconsecutive cycle vertex' and ref['vertex']==overlap_witness['vertex'] and ref['detected_after_route']==overlap_witness['field'] and np.array_equal(ref['source_point'],overlap_witness['point']) and ref['later_routes_not_attempted'];assert len(r['sides'])==1 if side=='l' else True
  if 'cycle_vertex_ids' in side_record:
   cycle=[v for route in prior for v in route[:-1]];assert cycle==side_record['cycle_vertex_ids'] and np.array_equal(raw[cycle],side_record['cycle_points'])
   if 'cycle_edges' in side_record:
    assert len(set(cycle))==len(cycle);cut={tuple(sorted((a,b))) for a,b in zip(cycle,cycle[1:]+cycle[:1])};assert cut=={tuple(row['vertices']) for row in side_record['cycle_edges']}
    parent=list(range(len(t)))
    def find(i):
     while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
     return i
    for edge,(a,b) in edgefaces.items():
     if edge not in cut:
      a,b=find(a),find(b)
      if a!=b:parent[b]=a
    groups=defaultdict(list)
    for i in range(len(t)):groups[find(i)].append(i)
    components=sorted([np.array(v,dtype=np.int32) for v in groups.values()],key=lambda x:int(x[0]));assert [{'count':len(c),'sha256':sha(c)} for c in components]==side_record['face_components']
    if side_record.get('accepted_source_association'):
     arm=z[side+'_arm_faces'];other=z[side+'_other_faces'];assert len(components)==2 and any(np.array_equal(arm,c) for c in components) and any(np.array_equal(other,c) for c in components) and len(arm)+len(other)==len(t) and not len(np.intersect1d(arm,other));armsets[side]=arm
     av=policy['arm_reference_vertex'][side];assert av not in cycle and not neckids.intersection(cycle);ai=np.flatnonzero(np.any(t==av,axis=1));ni=np.array(r['neckline_reference']['incident_triangle_ids']);assert np.isin(ai,arm).all() and np.isin(ni,other).all()
  checked.append({'side':side,'paths_reached':len(prior),'source_association_passed':side_record.get('accepted_source_association',False),'first_incremental_overlap':overlap_witness})
 if r['passed']:assert len(armsets)==2 and not len(np.intersect1d(armsets['l'],armsets['r']))
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'verified':True,'source_query_passed':r['passed'],'method':'Independent fullsource edge-face enumeration/Gram, allstored Bellman+strictpredecessor certificates, literalroute/unique candidate/firstoverlap witnesses, union-find partition whenreached','fields':certs,'sides':checked,'refusal':r.get('refusal'),'artist_role':'NOT_RUN','garment_geometry':False,'physical_fit_occupancy_selfclearance':'UNKNOWN'}
with (H/'ROOT-RESULT.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps(out))
