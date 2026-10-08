"""One immutable-array incident-edge query; no winding/solid/native/geometry edits."""
from pathlib import Path
from array import array
import json,zipfile,struct,ast,hashlib,math,datetime,collections
HERE=Path(__file__).resolve().parent;PLAN=json.loads((HERE/'EXEC-PLAN.json').read_text())
R={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'completed':False,'classification':'UNKNOWN','checks':[],'physical_occupancy':'UNKNOWN','formal_winding':'UNIMPLEMENTED_UNQUALIFIED'}
def check(v,s):
 if not v:raise RuntimeError(s)
 R['checks'].append(s)
def load(z,n):
 b=z.read(n+'.npy');check(b[:6]==b'\x93NUMPY','NumericNPY magic');major=b[6];check(major in [1,2],'SupportednumericNPYversion');start=10 if major==1 else 12;size=struct.unpack('<H' if major==1 else '<I',b[8:start])[0];h=ast.literal_eval(b[start:start+size].decode().strip());check(not h['fortran_order'] and h['descr'] in ['<f4','<i4'],'FixednumericCorderdtype');raw=b[start+size:];a=array({'<f4':'f','<i4':'i'}[h['descr']]);a.frombytes(raw);check(len(a)==math.prod(h['shape']),'Exact numericpayloadshape');return a,h['shape'],hashlib.sha256(raw).hexdigest()
def sub(a,b):return [x-y for x,y in zip(a,b)]
def dot(a,b):return math.fsum(x*y for x,y in zip(a,b))
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def norm(a):return math.sqrt(dot(a,a))
def point(a,i):return list(a[i*3:i*3+3])
try:
 for row in PLAN['pins']:
  b=Path(row['path']).read_bytes();check(len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'],'Exactpin '+row['path'])
 old=json.loads(Path(PLAN['result']).read_text());w=old['refusal_witness']
 with zipfile.ZipFile(PLAN['groom']) as z:
  g,gs,h=load(z,'AriOriginalCurls_world');check(h==old['render_geometry']['AriOriginalCurls']['world_sha256'] and gs==(516000,3),'Exactgroom world');ge,es,h=load(z,'AriOriginalCurls_edges');check(h==old['render_geometry']['AriOriginalCurls']['edges_sha256'] and es==(1008000,2),'Exactgroom edges')
 with zipfile.ZipFile(PLAN['skin']) as z:
  body,bs,h=load(z,'Human_world');check(h==old['skin_geometry']['Human']['world_sha256'] and bs==(13380,3),'ExactHumanworld');tri,ts,h=load(z,'Human_triangles');check(h==old['skin_geometry']['Human']['triangles_sha256'] and ts==(26756,3),'ExactHumantriangles')
 check(all(math.isfinite(x) for x in g) and all(math.isfinite(x) for x in body),'Completefinitequeriedcoordinatearrays');check(all(0<=i<gs[0] for i in ge) and all(0<=i<bs[0] for i in tri),'Completeindexbounds')
 v=1872;check(point(g,v)==w['point'],'Exactsinglequeriedpoint');incident=[]
 for i in range(es[0]):
  ids=list(ge[i*2:i*2+2])
  if v in ids:incident.append({'edge':i,'vertices':ids,'start':point(g,ids[0]),'end':point(g,ids[1])})
 check(0<len(incident)<=16,'Boundedactualincidentedges');R['incident_edges']=incident
 faces=[];edge_inc={};area_min=float('inf')
 for i in range(ts[0]):
  ids=list(tri[i*3:i*3+3]);check(len(set(ids))==3,'DistinctHumantrianglevertices');a,b,c=[point(body,j) for j in ids];e1=sub(b,a);e2=sub(c,a);n=cross(e1,e2);area=norm(n);check(math.isfinite(area) and area>1e-14,'NondegenerateHumantriangle');area_min=min(area_min,area);faces.append((ids,a,e1,e2,n,area))
  for u,vv in [(ids[0],ids[1]),(ids[1],ids[2]),(ids[2],ids[0])]:edge_inc.setdefault(tuple(sorted((u,vv))),[]).append((i,1 if u<vv else -1))
 boundaries=[e for e,inc in edge_inc.items() if len(inc)==1];nonmanifold=[e for e,inc in edge_inc.items() if len(inc)!=2];bad_orientation=[e for e,inc in edge_inc.items() if len(inc)==2 and inc[0][1]+inc[1][1]!=0]
 R['topology']={'vertices':bs[0],'triangles':ts[0],'undirected_triangle_edges':len(edge_inc),'boundary_edges':len(boundaries),'non_two_incidence_edges':len(nonmanifold),'inconsistent_orientation_edges':len(bad_orientation),'min_triangle_cross_norm':area_min,'self_intersection_free_unproved':True}
 if boundaries or nonmanifold or bad_orientation:
  bad=(boundaries or nonmanifold or bad_orientation)[0];R['topology_refusal_witness']={'edge_vertices':list(bad),'coordinates':[point(body,j) for j in bad],'incident_faces_and_directions':edge_inc[bad]};check(False,'Closedtwomanifold consistentedgeorientation')
 adj=[[] for _ in faces]
 for inc in edge_inc.values():a,b=inc[0][0],inc[1][0];adj[a].append(b);adj[b].append(a)
 seen={0};queue=collections.deque([0])
 while queue:
  for j in adj[queue.popleft()]:
   if j not in seen:seen.add(j);queue.append(j)
 R['topology']['connected_faces']=len(seen);R['topology']['total_faces']=len(faces)
 if len(seen)!=len(faces):
  unvisited=next(i for i in range(len(faces)) if i not in seen);R['topology_refusal_witness']={'first_unreached_triangle':unvisited,'vertices':faces[unvisited][0]};check(False,'SingleHumanfacecomponent')
 check(len(seen)==len(faces),'SingleHumanfacecomponent')
 R['ambiguities']=[];R['pairs_tested']=0;proper=None
 for edge in incident:
  start,end=edge['start'],edge['end'];d=sub(end,start);length=norm(d);check(math.isfinite(length) and length>1e-12,'Finite nondegenerateincidentedge');D=[x/length for x in d]
  # TriangleAABB rejection is a conservative acceleration; boundaries retain toleranceband.
  for face,(ids,a,e1,e2,n,area) in enumerate(faces):
   b=[a[k]+e1[k] for k in range(3)];c=[a[k]+e2[k] for k in range(3)]
   if any(max(start[k],end[k])+1e-8<min(a[k],b[k],c[k]) or min(start[k],end[k])-1e-8>max(a[k],b[k],c[k]) for k in range(3)):continue
   R['pairs_tested']+=1;p=cross(D,e2);det=dot(e1,p);parallel=1e-12*norm(e1)*norm(e2);check(math.isfinite(det) and math.isfinite(parallel),'Finitesegmentdet')
   if abs(det)<=parallel:
    distances=[dot(sub(x,a),n)/area for x in [start,end]]
    if min(abs(x) for x in distances)<=1e-8:R['ambiguities'].append({'kind':'parallel_nearplane_or_coplanar_candidate','edge':edge['edge'],'triangle':face,'endpoint_plane_distances':distances})
    continue
   T=sub(start,a);u=dot(T,p)/det;q=cross(T,e1);vv=dot(D,q)/det;t=dot(e2,q)/det;check(all(math.isfinite(x) for x in [u,vv,t]),'Finitetubarycentric')
   bary=[1-u-vv,u,vv]
   if min(bary)<-1e-9 or t<-1e-8 or t>length+1e-8:continue
   hit=[start[k]+D[k]*t for k in range(3)];reconstructed=[a[k]+u*e1[k]+vv*e2[k] for k in range(3)];residual=math.dist(hit,reconstructed);check(residual<=1e-8,'Intersectionpointreconstructs')
   witness={'edge':edge['edge'],'edge_vertices':edge['vertices'],'start':start,'end':end,'Human_triangle':face,'Human_vertices':ids,'hit':hit,'triangle_points':[a,b,c],'barycentric':bary,'distance_along_segment':t,'segment_length':length,'reconstruction_residual':residual}
   if min(bary)>1e-9 and t>1e-8 and length-t>1e-8:proper=witness;break
   witness['kind']='triangle_boundary_or_segment_endpoint_band';R['ambiguities'].append(witness)
  if proper:break
 R['proper_hit']=proper;R['classification']='PROPER_INCIDENT_EDGE_HIT' if proper else ('NO_PROPER_HIT_WITH_BOUNDARY_AMBIGUITIES' if R['ambiguities'] else 'NO_OBSERVED_PROPER_INCIDENT_EDGE_HIT');R['completed']=True
except Exception as e:R['exception']=repr(e)
finally:
 R['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat();R['limits']='Onevertex/incidentedges only; no formalwinding/solidoccupancy/globalselfintersection/groomclearance/appearance/native/retry/recipeacceptance'
 with (HERE/'RESULT.json').open('x') as f:json.dump(R,f,indent=2);f.write('\n')
 print(json.dumps({k:v for k,v in R.items() if k not in ['checks','incident_edges','ambiguities','proper_hit']},indent=2),flush=True)
if not R['completed']:raise SystemExit(1)
