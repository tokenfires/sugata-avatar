"""One fixed partial-face source contour; no Blender, fitting, variants or gate changes."""
from pathlib import Path
import json,math,struct,collections,datetime,hashlib
P=Path(__file__).resolve().parent;C=json.loads((P/'CONTRACT.json').read_text());A=json.loads((P.parent/'ari-root-flow-atlas/PARTITION.json').read_text());L=json.loads((P.parent/'ari-root-flow-atlas/LANDMARKS.json').read_text());report={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':False,'native_attempts':0,'candidate_promotion':False}
def write(n,v):
 with (P/n).open('x') as f:json.dump(v,f,indent=2);f.write('\n')
def check(v,label):
 if not v:raise RuntimeError(label)
def f32(x):return struct.unpack('<f',struct.pack('<f',x))[0]
def cross(u,v):return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
def sub(u,v):return [a-b for a,b in zip(u,v)]
def dot(u,v):return sum(a*b for a,b in zip(u,v))
def unit(v):
 d=math.sqrt(dot(v,v));check(d>1e-10 and math.isfinite(d),'Finite nonzero normal');return [x/d for x in v]
try:
 rows=sorted([r for z in A['zones'].values() for r in z]+A['excluded'],key=lambda r:r['triangle']);check(len(rows)==676 and len({r['triangle'] for r in rows})==676,'All676 source triangles');points={};incident=collections.defaultdict(list)
 head=L['head_bone']['head_local'];H=L['head_bone']['tail_local'][2]-head[2];knots=C['boundary_knots_degree_H'];eps=C['zero_epsilon']
 def angle(p):return math.degrees(math.atan2(abs(p[0]-head[0]),-(p[1]-head[1])))
 def field(p):
  a=angle(p)
  for (lo,vlo),(hi,vhi) in zip(knots,knots[1:]):
   if lo<=a<=hi:
    t=(a-lo)/(hi-lo);s=t*t*(3-2*t);return p[2]-(head[2]+H*(vlo+(vhi-vlo)*s))
  raise RuntimeError('Azimuth outside frozen knots')
 for r in rows:
  check(len(r['vertices'])==3 and r['area']>0 and all(math.isfinite(x) for p in r['coordinates'] for x in p),'Finite source triangles')
  centroid=[sum(p[j] for p in r['coordinates'])/3 for j in range(3)];r['new_region']='crown' if centroid[2]>=head[2]+.86*H else ('temple' if angle(centroid)<=110 else 'nape')
  for vid,p in zip(r['vertices'],r['coordinates']):
   if vid in points:check(points[vid]==p,'Shared exact source coordinates')
   points[vid]=p;incident[vid].append(r)
 values={n:field(p) for n,p in points.items()};check(all(math.isfinite(x) for x in values.values()),'Finite scalar field')
 for n in values:
  if abs(values[n])<=eps:values[n]=0.
 normals={};heights={}
 for n,rs in incident.items():
  area=sum(r['area'] for r in rs);normals[n]=unit([sum(r['normal'][j]*r['area'] for r in rs)/area for j in range(3)]);heights[n]=sum(C['nominal_lifts_m'][r['new_region']]*r['area'] for r in rs)/area
 write('FIELD.json',{'axis':head,'H':H,'contract_sha256':hashlib.sha256((P/'CONTRACT.json').read_bytes()).hexdigest(),'values':[{'native_vertex':n,'source':points[n],'F':values[n],'normal':normals[n],'height_m':heights[n]} for n in sorted(points)],'triangles':[{k:r[k] for k in ['triangle','vertices','coordinates','normal','area','new_region']} for r in rows]})
 ledger={};faces=[];sources=[];clips=[]
 def native(n):
  key=('v',n)
  if key not in ledger:ledger[key]={'identity':list(key),'support_ids':[n],'support_weights':[1.],'base':points[n],'F':values[n],'normal':normals[n],'height_m':heights[n],'parent_triangles':[]}
  return key
 def intersection(u,v):
  if values[u]==0:return native(u)
  if values[v]==0:return native(v)
  lo,hi=sorted((u,v));key=('e',lo,hi)
  if key not in ledger:
   t=values[lo]/(values[lo]-values[hi]);check(0<t<1,'Interior edge barycentric weight');weights=[1-t,t];co=[f32(points[lo][j]*(1-t)+points[hi][j]*t) for j in range(3)];normal=unit([normals[lo][j]*(1-t)+normals[hi][j]*t for j in range(3)]);ledger[key]={'identity':list(key),'support_ids':[lo,hi],'support_weights':weights,'base':co,'F':values[lo]*(1-t)+values[hi]*t,'normal':normal,'height_m':heights[lo]*(1-t)+heights[hi]*t,'parent_triangles':[]}
  return key
 for r in rows:
  vs=r['vertices'];poly=[]
  for u,v in zip(vs,vs[1:]+vs[:1]):
   inside_u=values[u]>=0;inside_v=values[v]>=0
   if inside_u:poly.append(native(u))
   if inside_u!=inside_v:poly.append(intersection(u,v))
  dedup=[]
  for key in poly:
   if not dedup or key!=dedup[-1]:dedup.append(key)
  if len(dedup)>1 and dedup[0]==dedup[-1]:dedup.pop()
  if len(dedup)<3:continue
  check(len(set(dedup))==len(dedup) and len(dedup)<=4,'Convex clipped polygon distinct3or4')
  clip_area=0;tris=[]
  for i in range(1,len(dedup)-1):
   tri=[dedup[0],dedup[i],dedup[i+1]];co=[ledger[k]['base'] for k in tri];area_vector=cross(sub(co[1],co[0]),sub(co[2],co[0]));projected=dot(area_vector,r['normal'])/2;check(projected>1e-14,'Positive partial-face source winding/area');clip_area+=math.sqrt(dot(area_vector,area_vector))/2;faces.append(tri);sources.append(r['triangle']);tris.append([list(k) for k in tri])
  check(clip_area<=r['area']+1e-12,'Clipped area does not exceed source');clips.append({'source_triangle':r['triangle'],'source_vertices':vs,'polygon':[list(k) for k in dedup],'triangles':tris,'clipped_area':clip_area,'source_area':r['area']})
  for key in dedup:
   rec=ledger[key];weights=[sum(w for n,w in zip(rec['support_ids'],rec['support_weights']) if n==v) for v in vs];check(abs(sum(weights)-1)<1e-12 and all(w>=0 for w in weights),'Triangle-local source barycentrics');rec['parent_triangles'].append({'triangle':r['triangle'],'native_vertices':vs,'weights':weights})
 used={k for tri in faces for k in tri};ledger={k:v for k,v in ledger.items() if k in used};keys=sorted(ledger);index={k:i for i,k in enumerate(keys)};ff=[[index[k] for k in tri] for tri in faces];base=[ledger[k]['base'] for k in keys];ed=collections.defaultdict(list);graph=collections.defaultdict(set)
 for i,tri in enumerate(ff):
  for u,v in zip(tri,tri[1:]+tri[:1]):ed[tuple(sorted((u,v)))].append((i,u,v));graph[u].add(v);graph[v].add(u)
 write('CLIPPED.json',{'ledger':[ledger[k] for k in keys],'vertices':base,'faces':ff,'source_triangles':sources,'clipped_source_polygons':clips})
 check(all(len(rs) in [1,2] for rs in ed.values()),'One or two incidence source edges');check(all(rs[0][1:]==tuple(reversed(rs[1][1:])) for rs in ed.values() if len(rs)==2),'Opposite interior source winding')
 todo=[0];seen=set()
 while todo:
  u=todo.pop()
  if u in seen:continue
  seen.add(u);todo.extend(graph[u]-seen)
 check(len(seen)==len(keys),'One connected clipped domain')
 boundary=[rs[0] for rs in ed.values() if len(rs)==1];bg=collections.defaultdict(set)
 for _,u,v in boundary:bg[u].add(v);bg[v].add(u)
 check(len(bg)>=3 and all(len(v)==2 for v in bg.values()),'Degree2 perimeter');todo=[min(bg)];seen=set()
 while todo:
  u=todo.pop()
  if u in seen:continue
  seen.add(u);todo.extend(bg[u]-seen)
 check(len(seen)==len(bg),'Exactlyone perimeter loop');check(all(abs(ledger[keys[i]]['F'])<=1e-10 for i in bg),'No inherited unowned sourcepatch border')
 distance={i:0 for i in bg};q=collections.deque(sorted(bg))
 while q:
  u=q.popleft()
  for v in sorted(graph[u]):
   if v not in distance:distance[v]=distance[u]+1;q.append(v)
 outer=[];records=[]
 for i,k in enumerate(keys):
  rec=dict(ledger[k]);t=min(distance[i]/3,1);taper=.15+.85*t*t*(3-2*t);lift=rec['height_m']*taper;co=[f32(rec['base'][j]+rec['normal'][j]*lift) for j in range(3)];outer.append(co);rec.update({'outer_index':i,'base_index':len(keys)+i,'graph_boundary_distance':distance[i],'taper':taper,'lift_m':lift,'outer':co});records.append(rec)
 vertices=outer+base;massfaces=[];roles=[];masssources=[]
 for tri,source in zip(ff,sources):massfaces.append(tri);roles.append('outer');masssources.append(source);massfaces.append([len(keys)+v for v in reversed(tri)]);roles.append('base');masssources.append(source)
 for face,u,v in boundary:massfaces.append([v,u,len(keys)+u,len(keys)+v]);roles.append('wall');masssources.append(sources[face])
 closed=collections.defaultdict(list)
 for i,face in enumerate(massfaces):
  for u,v in zip(face,face[1:]+face[:1]):closed[tuple(sorted((u,v)))].append((i,u,v))
 check(all(len(rs)==2 and rs[0][1:]==tuple(reversed(rs[1][1:])) for rs in closed.values()),'Closed mass opposite incidence');check(len(vertices)<=C['bounds']['mass_vertices'] and sum(len(f)-2 for f in massfaces)<=C['bounds']['mass_triangles'],'Prospective mass budget')
 mass={'authored_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'contract_sha256':hashlib.sha256((P/'CONTRACT.json').read_bytes()).hexdigest(),'vertices':vertices,'faces':massfaces,'face_roles':roles,'face_source_triangles':masssources,'vertex_ledger':records,'source_point_count':len(keys),'component_count':1,'perimeter_loops':1,'boundary_edges':len(boundary),'material_rgba':C['material_rgba'],'roughness':C['roughness'],'smooth_faces':True,'bounds':C['bounds'],'artist_ear_boxes':A['ear_intent_boxes'],'artist_forehead_gate':{'front_y':A['artist_thresholds']['front_boundary_y'],'min_z':A['artist_thresholds']['forehead_z']},'limits':'New partial-face C0 contour mass control; source-barycentric skin attachment/basewalls intentional, not clearance/finalhairline/groom/motion/runtime/AAA'}
 write('MASS.json',mass);ear=[];fore=[]
 for i,(face,role) in enumerate(zip(massfaces,roles)):
  if role!='outer':continue
  co=[vertices[v] for v in face];lo=[min(p[j] for p in co) for j in range(3)];hi=[max(p[j] for p in co) for j in range(3)]
  for side,box in mass['artist_ear_boxes'].items():
   if all(hi[j]>=box['min'][j] and lo[j]<=box['max'][j] for j in range(3)):ear.append({'polygon':i,'source_triangle':masssources[i],'side':side,'coordinates':co})
  gate=mass['artist_forehead_gate']
  if lo[1]<gate['front_y'] and lo[2]<gate['min_z']:fore.append({'polygon':i,'source_triangle':masssources[i],'coordinates':co})
 write('SOURCE-ENVELOPE.json',{'outer_ear_overlaps':ear,'outer_forehead_overlaps':fore,'thresholds_unchanged':True,'passed':not ear and not fore,'candidate_promotion':False})
 check(not ear and not fore,'Prospective outer artist envelope refusal; no native/diagnosticexception')
 report.update({'passed':True,'source_triangles':676,'retained_source_polygons':len(clips),'clipped_source_points':len(keys),'outer_triangles':len(ff),'vertices':len(vertices),'faces':len(massfaces),'closed_edges':len(closed),'boundary_edges':len(boundary),'perimeter_loops':1})
except Exception as ex:report['exception']=repr(ex)
finally:report['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat();write('AUTHOR-RESULT.json',report);print(json.dumps(report,indent=2))
if not report['passed']:raise SystemExit(1)
