"""One fixed source-surface branch boundary query; no native/garment mutation."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
import json,hashlib,datetime,os,heapq
from collections import defaultdict,deque
import numpy as np
HERE=Path(__file__).resolve().parent
RESULT={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':os.getpid(),'boundaries':[],'passed':False,'representation':'edge-graph distance, not continuum geodesic/anatomy/garment seams','physical_3D_self_clearance':'UNKNOWN','native_chart':'NOT_RUN'}
class Refusal(Exception):pass
def require(ok,label,witness=None):
 if not ok:
  RESULT['refusal']={'reason':label,'witness':witness};raise Refusal(label)
def digest(a):return hashlib.sha256(a.tobytes()).hexdigest()
def pins_exact():
 for x in json.loads((HERE/'INPUTS.json').read_text()):
  b=Path(x['path']).read_bytes();require(len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'],'Physical input changed',x['path'])
def shortest(adj,seeds):
 count=len(adj);dist=np.full(count,np.inf);prev=np.full(count,-1,dtype=np.int32);heap=[]
 for i in seeds:dist[i]=0;heapq.heappush(heap,(0.0,int(i)))
 pops=0
 while heap:
  d,i=heapq.heappop(heap);pops+=1;require(pops<=1000000,'Graph heap budget')
  if d!=dist[i]:continue
  for j,weight in adj[i]:
   candidate=d+weight
   if candidate<dist[j]:dist[j]=candidate;prev[j]=i;heapq.heappush(heap,(candidate,j))
 require(np.isfinite(dist).all() and (dist>=0).all(),'Source graph not fully reachable')
 return dist,prev,pops
def connected_negative(adj,field,seeds):
 domain=set(np.flatnonzero(field<0).tolist());require(domain and all(int(i) in domain for i in seeds),'Arm seeds not in negative domain')
 seen={int(seeds[0])};queue=deque(seen)
 while queue:
  i=queue.popleft()
  for j,_ in adj[i]:
   if j in domain and j not in seen:seen.add(j);queue.append(j)
 require(seen==domain,'Negative source region disconnected',{'missing_vertex_ids':sorted(domain-seen)})
 return np.array(sorted(domain),dtype=np.int32)
def boundary(world,triangles,field,role):
 record={'side':role['side'],'role':role};RESULT['boundaries'].append(record)
 near=np.flatnonzero(np.abs(field)<=1e-10);require(not len(near),'Distance boundary on source vertex',{'side':role['side'],'vertex_ids':near.tolist(),'values':field[near].tolist()})
 vals=field[triangles];ids=np.flatnonzero((vals.min(axis=1)<0)&(vals.max(axis=1)>0));require(len(ids)>0,'No source boundary',role['side'])
 points={};adj=defaultdict(list);segments=[]
 for tid in ids:
  tri=triangles[tid];crossing=[]
  for k in range(3):
   a,b=sorted((int(tri[k]),int(tri[(k+1)%3])))
   if (field[a]<0)!=(field[b]<0):
    e=(a,b);crossing.append(e)
    if e not in points:
     fraction=float(field[a]/(field[a]-field[b]));xyz=world[a]+fraction*(world[b]-world[a]);require(0<fraction<1 and np.isfinite(xyz).all(),'Invalid source field crossing',e)
     points[e]={'edge':list(e),'fraction':fraction,'point':xyz.tolist()}
  require(len(crossing)==2 and crossing[0]!=crossing[1],'Degenerate source contour triangle',int(tid));a,b=crossing;adj[a].append(b);adj[b].append(a);segments.append({'triangle':int(tid),'edges':[list(a),list(b)]})
 record['source_crossings']=[points[e] for e in sorted(points)];record['source_segments']=segments
 bad={str(e):v for e,v in adj.items() if len(v)!=2 or len(set(v))!=2};require(not bad,'Non-simple source contour degree',bad)
 left=set(points);cycles=[]
 while left:
  start=min(left);route=[start];previous=start;current=min(adj[start])
  while current!=start:
   require(current in left and current not in route,'Repeated/disconnected ring node',{'side':role['side'],'edge':current});route.append(current);following=[x for x in adj[current] if x!=previous];require(len(following)==1,'Ambiguous ring successor');previous,current=current,following[0]
  require(3<=len(route)<=4096,'Contour point count');left.difference_update(route);cycles.append([list(e) for e in route])
 record['cycles']=cycles;require(len(cycles)==1,'Source branch boundary not one ring',{'side':role['side'],'cycle_counts':list(map(len,cycles))})
 route=list(map(tuple,cycles[0]));xyz=np.array([points[e]['point'] for e in route]);record['world_min']=xyz.min(axis=0).tolist();record['world_max']=xyz.max(axis=0).tolist();record['points']=len(xyz)
 invalid=np.flatnonzero((xyz[:,0]*role['x_sign']<=0)|(xyz[:,2]<=role['z_min'])|(xyz[:,2]>=role['z_max']));require(not len(invalid),'Source branch outside fixed artist role interval',{'side':role['side'],'ordered_point_indices':invalid.tolist(),'points':xyz[invalid].tolist(),'role':role})
 centroid=xyz.mean(axis=0);_,singular,vh=np.linalg.svd(xyz-centroid,full_matrices=False);normal=vh[-1];normal=normal if normal[np.argmax(np.abs(normal))]>=0 else -normal
 record['descriptive_nonplanarity']={'centroid':centroid.tolist(),'best_plane_normal':normal.tolist(),'singular_values':singular.tolist(),'maximum_plane_residual':float(np.abs((xyz-centroid)@normal).max()),'not_acceptance_or_physical_fit':True}
 record['accepted_source_reference']=True
try:
 require(not any((HERE/f).exists() for f in ['RESULT.json','distances.npz']),'Refuse duplicate query output');pins_exact();policy=json.loads((HERE/'POLICY.json').read_text());pins=json.loads((HERE/'INPUTS.json').read_text());archive=next(Path(x['path']) for x in pins if x['path'].endswith('/after-geometry.npz'));require(archive.stat().st_size<=1048576,'Encoded source cap')
 cold=json.loads(next(Path(x['path']).read_text() for x in pins if x['path'].endswith('/COLD.json')))['geometry']['Human']
 with np.load(archive,allow_pickle=False) as z:
  require(z.files.count('Human_world')==1 and z.files.count('Human_triangles')==1,'Literal source arrays');rawworld=z['Human_world'];triangles=z['Human_triangles']
 require(rawworld.shape==(13380,3) and rawworld.dtype==np.dtype('float32') and triangles.shape==(26756,3) and triangles.dtype==np.dtype('int32'),'Exact source domain/dtype');require(digest(rawworld)==cold['world_sha256'] and digest(triangles)==cold['triangles_sha256'],'Exact source COLD hashes');require(np.isfinite(rawworld).all() and triangles.min()>=0 and triangles.max()<len(rawworld),'Finite indexed source');world=rawworld.astype(float)
 a=world[triangles[:,1]]-world[triangles[:,0]];b=world[triangles[:,2]]-world[triangles[:,0]];area=np.linalg.norm(np.cross(a,b),axis=1);bad=np.flatnonzero(~np.isfinite(area)|(area<=0));require(not len(bad),'Degenerate source triangle',None if not len(bad) else {'triangle':int(bad[0]),'vertices':triangles[bad[0]].tolist()})
 rawedges=np.concatenate((triangles[:,[0,1]],triangles[:,[1,2]],triangles[:,[2,0]]));edges,counts=np.unique(np.sort(rawedges,axis=1),axis=0,return_counts=True);require(len(edges)==40134 and (counts==2).all(),'Source triangle graph not closed expected domain',{'edges':len(edges),'non_two_incidence':int(np.count_nonzero(counts!=2))});lengths=np.linalg.norm(world[edges[:,1]]-world[edges[:,0]],axis=1);require(np.isfinite(lengths).all() and (lengths>0).all(),'Finite positive graph lengths')
 adj=[[] for _ in world]
 for (i,j),weight in zip(edges,lengths):adj[int(i)].append((int(j),float(weight)));adj[int(j)].append((int(i),float(weight)))
 manifest=json.loads(next(Path(x['path']).read_text() for x in pins if x['path'].endswith('/SECTION-MANIFEST.json')));require(manifest['source_arrays']['world']['sha256']==cold['world_sha256'] and manifest['source_arrays']['triangles']['sha256']==cold['triangles_sha256'],'Torso reference source domain association');upper=[s for s in manifest['sections'] if s['name']=='torso-upper'];require(len(upper)==1,'One literal upper torso reference');sourceedges=set(map(tuple,edges.tolist()));torso=set()
 for row in upper[0]['ordered_source_triangle_edges']:
  i,j=row['edge'];require((i,j) in sourceedges and 0<row['fraction']<1,'Torso seed crossing source edge');point=world[i]+row['fraction']*(world[j]-world[i]);require(np.max(np.abs(point-np.array(row['point'])))<1e-12,'Torso reference exact source crossing');torso.update((i,j))
 seeds={'torso':sorted(torso)}
 for role in policy['roles']:
  side=role['side'];center=np.array(policy['arm_centers'][side]);d2=np.sum((world-center)**2,axis=1);ids=np.flatnonzero(d2<=d2.min()+1e-12);RESULT.setdefault('seed_candidates',{})[side]={'center':center.tolist(),'vertex_ids':ids.tolist(),'points':world[ids].tolist(),'squared_distances':d2[ids].tolist(),'minimum_squared_distance':float(d2.min()),'tie_band':1e-12};require(len(ids)>0 and float(np.sqrt(d2.min()))<=0.10,'Arm nearest source seed exceeds fixed bound',{'side':side,'distance':float(np.sqrt(d2.min()))});require((world[ids,0]*role['x_sign']>0).all(),'Arm seed wrong source side',ids.tolist());require(not set(ids.tolist())&torso,'Arm/torso seed overlap',ids.tolist());seeds[side]=ids.tolist()
 RESULT['source']={'world_sha256':digest(rawworld),'triangles_sha256':digest(triangles),'edges_sha256':digest(edges),'edge_lengths_sha256':digest(lengths),'vertices':len(world),'triangles':len(triangles),'edges':len(edges),'minimum_twice_triangle_area':float(area.min())};RESULT['seeds']={name:{'vertex_ids':ids,'points':world[ids].tolist(),'centers':None if name=='torso' else policy['arm_centers'][name]} for name,ids in seeds.items()}
 arrays={};fields={};RESULT['distance_fields']={}
 for name in ['torso','l','r']:
  dist,prev,pops=shortest(adj,seeds[name]);arrays[name+'_distance']=dist;arrays[name+'_predecessor']=prev;fields[name]=dist;RESULT['distance_fields'][name]={'distance_sha256':digest(dist),'predecessor_sha256':digest(prev),'vertices':len(dist),'max':float(dist.max()),'heap_pops':pops}
 with (HERE/'distances.npz').open('xb') as f:np.savez_compressed(f,**arrays)
 encoded=(HERE/'distances.npz').read_bytes();require(len(encoded)<=1048576,'Derived distance archive cap');RESULT['derived_archive']={'file':'distances.npz','bytes':len(encoded),'sha256':hashlib.sha256(encoded).hexdigest(),'arrays':list(arrays)}
 domains={}
 for role in policy['roles']:
  side=role['side'];field=fields[side]-fields['torso'];domain=connected_negative(adj,field,seeds[side]);domains[side]=domain;RESULT.setdefault('regions',{})[side]={'vertices':len(domain),'vertex_ids_sha256':digest(domain)};boundary(world,triangles,field,role)
 overlap=np.intersect1d(domains['l'],domains['r']);require(not len(overlap),'Artist arm regions overlap',overlap.tolist());RESULT['regions_disjoint']=True;RESULT['passed']=True
except Refusal as e:print('REFUSED:',str(e))
except Exception as e:RESULT['unexpected_error']={'type':type(e).__name__,'message':str(e)};print('ERROR:',str(e))
finally:
 try:pins_exact();RESULT['post_pins_exact']=True
 except Exception as e:RESULT['post_pin_error']=str(e);RESULT['passed']=False
 RESULT['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat();encoded=json.dumps(RESULT,indent=2).encode()+b'\n'
 if len(encoded)>8388608:raise RuntimeError('8MiB result cap')
 with (HERE/'RESULT.json').open('xb') as f:f.write(encoded)
 print(json.dumps({'passed':RESULT['passed'],'boundaries':len(RESULT['boundaries']),'bytes':len(encoded),'refusal':RESULT.get('refusal'),'unexpected_error':RESULT.get('unexpected_error')}));sys.exit(0 if RESULT['passed'] else 1)
