"""Sole fixed point-constrained edge paths and full source-face association query."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
from collections import deque,Counter
import json,hashlib,datetime,os,heapq
import numpy as np
H=Path(__file__).resolve().parent
R={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':os.getpid(),'passed':False,'sides':[],'fields':{},'garment_geometry':False,'artist_role':'PENDING actualpathcharts','physical_selfclearance_occupancy_fit':'UNKNOWN'}
arrays={}
class Refusal(Exception):pass
def require(ok,label,witness=None):
 if not ok:R['refusal']={'reason':label,'witness':witness};raise Refusal(label)
def sha(a):return hashlib.sha256(a.tobytes()).hexdigest()
def pins():
 for x in json.loads((H/'EXEC-QUERY.json').read_text())['pins']:
  b=Path(x['path']).read_bytes();require(len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'],'Exact physical input',x['path'])
def distances(adj,origin):
 d=np.full(len(adj),np.inf);prev=np.full(len(adj),-1,dtype=np.int32);d[origin]=0;queue=[(0.0,origin)];pops=0
 while queue:
  value,i=heapq.heappop(queue);pops+=1;require(pops<=1000000,'Heap budget',{'origin':origin,'pops':pops})
  if value!=d[i]:continue
  for j,length in adj[i]:
   candidate=value+length
   if candidate<d[j]:d[j]=candidate;prev[j]=i;heapq.heappush(queue,(candidate,j))
 require(np.isfinite(d).all() and (d>=0).all(),'Source graph fully reachable',origin)
 return d,prev,pops
def partition(triangles,edge_faces,cycle):
 cut={tuple(sorted((a,b))) for a,b in zip(cycle,cycle[1:]+cycle[:1])};face_adj=[[] for _ in triangles]
 for edge,(a,b) in edge_faces.items():
  if edge not in cut:face_adj[a].append(b);face_adj[b].append(a)
 remaining=set(range(len(triangles)));components=[]
 while remaining:
  origin=min(remaining);remaining.remove(origin);seen={origin};queue=deque([origin])
  while queue:
   i=queue.popleft()
   for j in face_adj[i]:
    if j in remaining:remaining.remove(j);seen.add(j);queue.append(j)
  components.append(np.array(sorted(seen),dtype=np.int32))
 return components
try:
 require(not any((H/n).exists() for n in ['RESULT.json','fields.npz']),'Exclusive firstquery output');pins();inputs=json.loads((H/'INPUTS.json').read_text());policy=json.loads((H/'POLICY.json').read_text())
 find=lambda suffix:next(Path(x['path']) for x in inputs if x['path'].endswith(suffix))
 cold=json.loads(find('/COLD.json').read_text())['geometry']['Human'];mapping=json.loads(find('/SOURCE-MAP.json').read_text());bones={b['name']:b for b in mapping['rig_object']['rig']['bones']};registration=json.loads(find('/SOURCE-REGISTRATION.json').read_text());old=json.loads(find('/ari-bomber-junction/RESULT.json').read_text());sections=json.loads(find('/SECTION-MANIFEST.json').read_text());source=find('/after-geometry.npz');require(source.stat().st_size<=1048576,'Encoded source cap')
 with np.load(source,allow_pickle=False) as z:raw=z['Human_world'];triangles=z['Human_triangles']
 require(raw.shape==(13380,3) and raw.dtype==np.float32 and triangles.shape==(26756,3) and triangles.dtype==np.int32,'Literal source domains');require(sha(raw)==cold['world_sha256'] and sha(triangles)==cold['triangles_sha256'],'Exact source hashes');require(np.isfinite(raw).all() and triangles.min()>=0 and triangles.max()<len(raw),'Finite indexed source');world=raw.astype(float)
 area=np.linalg.norm(np.cross(world[triangles[:,1]]-world[triangles[:,0]],world[triangles[:,2]]-world[triangles[:,0]]),axis=1);bad=np.flatnonzero(~np.isfinite(area)|(area<=0));require(not len(bad),'Full source triangle eligibility',None if not len(bad) else int(bad[0]))
 rawedges=np.concatenate([triangles[:,[0,1]],triangles[:,[1,2]],triangles[:,[2,0]]]);edges,inv,counts=np.unique(np.sort(rawedges,axis=1),axis=0,return_inverse=True,return_counts=True);require(len(edges)==40134 and (counts==2).all(),'Source closed canonicaledge domain');balance=np.bincount(inv,weights=np.where(rawedges[:,0]<rawedges[:,1],1,-1));require((balance==0).all(),'Opposite source edge orientation')
 lengths=np.linalg.norm(world[edges[:,1]]-world[edges[:,0]],axis=1);require(np.isfinite(lengths).all() and (lengths>0).all(),'Finite positive sourceweights');tids=np.tile(np.arange(len(triangles),dtype=np.int32),3)[np.argsort(inv,kind='stable')].reshape(-1,2);edge_faces={tuple(map(int,e)):tuple(map(int,f)) for e,f in zip(edges,tids)};adj=[[] for _ in world]
 for (a,b),length in zip(edges,lengths):adj[int(a)].append((int(b),float(length)));adj[int(b)].append((int(a),float(length)))
 for row in adj:row.sort()
 R['source']={'world_sha256':sha(raw),'triangles_sha256':sha(triangles),'vertices':len(raw),'triangles':len(triangles),'edges':len(edges),'edges_sha256':sha(edges),'lengths_sha256':sha(lengths),'minimum_twice_triangle_area':float(area.min()),'opposite_edge_orientation':True}
 require(registration['source']['world_sha256']==sha(raw) and registration['source']['triangles_sha256']==sha(triangles) and sections['source_arrays']['world']['sha256']==sha(raw) and sections['source_arrays']['triangles']['sha256']==sha(triangles) and old['source']['world_sha256']==sha(raw) and old['source']['triangles_sha256']==sha(triangles),'Reference source identity')
 neck=next(s for s in sections['sections'] if s['name']=='neckline');neck_ids=set()
 for row in neck['ordered_source_triangle_edges']:
  a,b=row['edge'];require((a,b) in edge_faces and 0<row['fraction']<1 and np.max(np.abs(world[a]+row['fraction']*(world[b]-world[a])-row['point']))<1e-12,'Exact existing neckline source association');neck_ids.update((a,b))
 R['neckline_reference']={'vertex_ids':sorted(neck_ids),'incident_triangle_ids':np.flatnonzero(np.any(np.isin(triangles,list(neck_ids)),axis=1)).tolist()};arm_components={}
 for side,sign in [('l',1),('r',-1)]:
  anchors=policy['anchor_ids'][side];record={'side':side,'anchor_ids':anchors,'paths':[]};R['sides'].append(record)
  expected=[a for a in registration['anchors'] if a['side']==side];require([a['source_vertex'] for a in expected]+[expected[0]['source_vertex']]==anchors and [a['role'] for a in expected]==['crown','front','underarm','rear'],'Fixed retainedanchor identities')
  for a in expected:require(np.array_equal(raw[a['source_vertex']],a['source_point']),'Exact retainedanchor sourcepoint')
  for k,(origin,target) in enumerate(zip(anchors,anchors[1:])):
   field=side+'-'+policy['anchor_order'][k];d,prev,pops=distances(adj,origin);arrays[field+'_distance']=d;arrays[field+'_predecessor']=prev;R['fields'][field]={'origin':origin,'target':target,'distance_sha256':sha(d),'predecessor_sha256':sha(prev),'heap_pops':pops,'target_distance':float(d[target])}
   route=[target]
   while route[-1]!=origin:
    i=route[-1];j=int(prev[i]);require(0<=j<len(world) and d[j]<d[i] and any(n==j for n,_ in adj[i]),'Strict source predecessor route',{'side':side,'field':field,'vertex':i,'predecessor':j});require(j not in route,'Repeated predecessor route',{'field':field,'vertex':j});route.append(j);require(len(route)<=512,'Route countbudget',field)
   route.reverse();path={'field':field,'origin':origin,'target':target,'vertex_ids':route,'points':raw[route].tolist(),'edges':[{'vertices':[a,b],'incident_triangles':list(edge_faces[tuple(sorted((a,b)))])} for a,b in zip(route,route[1:])],'uniqueness':[]};record['paths'].append(path)
   require(len(route)>=3,'Route needs3vertices',path);invalid=[i for i in route if world[i,0]*sign<=0 or not bones['lowerarm_'+side]['head_local'][2]<world[i,2]<bones['neck_01']['head_local'][2]];require(not invalid,'Source route outsidefixedrole',{'field':field,'vertex_ids':invalid,'points':raw[invalid].tolist()})
   other=sorted(set(route[1:-1])&set(anchors[:-1]));require(not other,'Another role anchor inside route',{'field':field,'vertex_ids':other,'points':raw[other].tolist()})
   for i in route[1:]:
    options=[{'vertex':j,'candidate_distance':float(d[j]+length),'difference':float(d[j]+length-d[i])} for j,length in adj[i] if abs(d[j]+length-d[i])<=1e-12];u={'vertex':i,'distance':float(d[i]),'selected_predecessor':int(prev[i]),'candidates':options};path['uniqueness'].append(u);require(len(options)==1 and options[0]['vertex']==int(prev[i]),'Ambiguous optimal route predecessor',{'field':field,'source_point':raw[i].tolist(),'candidate_witness':u})
   path['accepted_source_route']=True
   previous_paths=record['paths'][:-1];prior_vertices={i for p in previous_paths for i in p['vertex_ids']};allowed={origin} if previous_paths else set()
   if k==3:allowed.add(target)
   overlap=[i for i in route if i in prior_vertices and i not in allowed]
   if overlap:
    i=overlap[0];members=[{'field':p['field'],'route_indices':[n for n,v in enumerate(p['vertex_ids']) if v==i]} for p in record['paths'] if i in p['vertex_ids']];require(False,'Repeated nonconsecutive cycle vertex',{'side':side,'vertex':i,'source_point':raw[i].tolist(),'path_memberships':members,'detected_after_route':field,'later_routes_not_attempted':True})
   previous_edges={tuple(sorted((a,b))) for p in previous_paths for a,b in zip(p['vertex_ids'],p['vertex_ids'][1:])};overlap_edges=[tuple(sorted((a,b))) for a,b in zip(route,route[1:]) if tuple(sorted((a,b))) in previous_edges];require(not overlap_edges,'Repeated attachment route edge',{'side':side,'field':field,'edges':[list(e) for e in overlap_edges],'later_routes_not_attempted':True})
   path['incremental_no_prior_nonconsecutive_vertex_or_edge_overlap']=True
  cycle=[i for path in record['paths'] for i in path['vertex_ids'][:-1]];record['cycle_vertex_ids']=cycle;record['cycle_points']=raw[cycle].tolist();duplicates=[i for i,count in Counter(cycle).items() if count>1]
  if duplicates:
   i=duplicates[0];members=[{'field':p['field'],'route_indices':[n for n,v in enumerate(p['vertex_ids']) if v==i]} for p in record['paths'] if i in p['vertex_ids']];require(False,'Repeated nonconsecutive cycle vertex',{'side':side,'vertex':i,'source_point':raw[i].tolist(),'path_memberships':members})
  require(3<=len(cycle)<=2048,'Cycle countbudget');cycleedges=[tuple(sorted((a,b))) for a,b in zip(cycle,cycle[1:]+cycle[:1])];require(len(set(cycleedges))==len(cycleedges) and all(e in edge_faces for e in cycleedges),'Literal simplecycle edges');record['cycle_edges']=[{'vertices':list(e),'incident_triangles':list(edge_faces[e])} for e in cycleedges]
  arm=policy['arm_reference_vertex'][side];require(old['seeds'][side]['vertex_ids']==[arm] and np.array_equal(raw[arm],old['seeds'][side]['points'][0]),'Fixed previousnumeric armreference');arm_ids=np.flatnonzero(np.any(triangles==arm,axis=1));neckfaces=np.array(R['neckline_reference']['incident_triangle_ids'],dtype=np.int32);require(arm not in cycle and not neck_ids.intersection(cycle),'Reference vertex on cutcycle',{'side':side,'arm_reference':arm,'neck_on_cycle':sorted(neck_ids.intersection(cycle))})
  components=partition(triangles,edge_faces,cycle);record['face_components']=[{'count':len(c),'sha256':sha(c)} for c in components];require(len(components)==2,'Cutface partition notexact2components',{'side':side,'counts':[len(c) for c in components]});arm_matches=[i for i,c in enumerate(components) if np.isin(arm_ids,c).all()];neck_matches=[i for i,c in enumerate(components) if np.isin(neckfaces,c).all()];record['reference_faces']={'arm_vertex':arm,'arm_incident_triangle_ids':arm_ids.tolist(),'arm_component_matches':arm_matches,'neck_component_matches':neck_matches};require(len(arm_matches)==len(neck_matches)==1 and arm_matches[0]!=neck_matches[0],'Wholearm/neck reference components notdistinct',record['reference_faces'])
  arm_component=components[arm_matches[0]];arm_components[side]=arm_component;arrays[side+'_arm_faces']=arm_component;arrays[side+'_other_faces']=components[neck_matches[0]];record['arm_component']={'component':arm_matches[0],'count':len(arm_component),'sha256':sha(arm_component)};record['accepted_source_association']=True
 require(not len(np.intersect1d(arm_components['l'],arm_components['r'])),'L/Rsource armface memberships overlap');R['arm_face_sets_disjoint']=True;R['passed']=True
except Refusal as e:print('REFUSED',str(e))
except Exception as e:R['unexpected_error']={'type':type(e).__name__,'message':str(e)};print('ERROR',str(e))
finally:
 if arrays:
  with (H/'fields.npz').open('xb') as f:np.savez_compressed(f,**arrays)
  b=(H/'fields.npz').read_bytes();R['derived_archive']={'file':'fields.npz','bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'arrays':list(arrays)}
  if len(b)>2097152:R['passed']=False;R['archive_cap_refusal']=True
 try:pins();R['post_pins_exact']=True
 except Exception as e:R['post_pin_error']=str(e);R['passed']=False
 R['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat();b=json.dumps(R,indent=2).encode()+b'\n'
 if len(b)>2097152:raise RuntimeError('Resultcap2MiB')
 with (H/'RESULT.json').open('xb') as f:f.write(b)
 print(json.dumps({'passed':R['passed'],'sides_reached':len(R['sides']),'fields':len(R['fields']),'bytes':len(b),'refusal':R.get('refusal'),'unexpected_error':R.get('unexpected_error')}));sys.exit(0 if R['passed'] else 1)
