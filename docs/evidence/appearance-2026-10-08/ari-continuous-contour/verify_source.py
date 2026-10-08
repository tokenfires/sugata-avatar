"""Independent stored-source verification only; no author replay or native job."""
from pathlib import Path
import json,hashlib,math,struct,collections,datetime
P=Path(__file__).resolve().parent
def read(n):return json.loads((P/n).read_text())
c=read('CONTRACT.json');f=read('FIELD.json');cl=read('CLIPPED.json');m=read('MASS.json');ar=read('AUTHOR-RESULT.json');env=read('SOURCE-ENVELOPE.json');a=json.loads((P.parent/'ari-root-flow-atlas/PARTITION.json').read_text())
assert not ar['passed'] and ar['native_attempts']==0 and not env['passed'] and not env['candidate_promotion'] and not m.get('candidate_promotion',False)
for x in read('INPUTS.json'):
 b=Path(x['path']).read_bytes();assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256']
source={x['triangle']:x for zone in a['zones'].values() for x in zone};source.update({x['triangle']:x for x in a['excluded']});assert len(source)==676
points={};incident=collections.defaultdict(list)
for row in f['triangles']:
 s=source[row['triangle']];assert all(row[k]==s[k] for k in ['triangle','vertices','coordinates','normal','area'])
 for vid,co in zip(row['vertices'],row['coordinates']):
  if vid in points:assert points[vid]==co
  points[vid]=co;incident[vid].append(row)
field={r['native_vertex']:r for r in f['values']};assert set(field)==set(points)
f32=lambda x:struct.unpack('<f',struct.pack('<f',x))[0]
def unit(x):
 length=math.sqrt(sum(v*v for v in x));assert length>1e-10;return [v/length for v in x]
for vid,r in field.items():
 assert r['source']==points[vid];angle=math.degrees(math.atan2(abs(r['source'][0]-f['axis'][0]),-(r['source'][1]-f['axis'][1])));knots=c['boundary_knots_degree_H']
 for (lo,hlo),(hi,hhi) in zip(knots,knots[1:]):
  if lo<=angle<=hi:
   t=(angle-lo)/(hi-lo);s=t*t*(3-2*t);value=r['source'][2]-(f['axis'][2]+f['H']*(hlo+(hhi-hlo)*s));break
 if abs(value)<=c['zero_epsilon']:value=0.
 assert value==r['F'];rs=incident[vid];area=sum(x['area'] for x in rs);normal=unit([sum(x['normal'][j]*x['area'] for x in rs)/area for j in range(3)]);height=sum(c['nominal_lifts_m'][x['new_region']]*x['area'] for x in rs)/area;assert normal==r['normal'] and height==r['height_m']
 for x in rs:
  centroid=[sum(p[j] for p in x['coordinates'])/3 for j in range(3)];theta=math.degrees(math.atan2(abs(centroid[0]-f['axis'][0]),-(centroid[1]-f['axis'][1])));region='crown' if centroid[2]>=f['axis'][2]+.86*f['H'] else ('temple' if theta<=110 else 'nape');assert x['new_region']==region
identities=[tuple(r['identity']) for r in cl['ledger']];assert len(set(identities))==len(identities)==276 and m['source_point_count']==276
for i,r in enumerate(cl['ledger']):
 ids=r['support_ids'];weights=r['support_weights'];assert sum(weights)==1 and all(0<=x<=1 for x in weights)
 expected=[sum(points[v][j]*w for v,w in zip(ids,weights)) for j in range(3)];expected=[f32(x) for x in expected] if len(ids)==2 else expected;assert r['base']==expected==cl['vertices'][i]
 if len(ids)==2:
  lo,hi=ids;assert lo<hi and r['identity']==['e',lo,hi] and weights[1]==field[lo]['F']/(field[lo]['F']-field[hi]['F'])
 else:assert r['identity']==['v',ids[0]]
 assert r['normal']==unit([sum(field[v]['normal'][j]*w for v,w in zip(ids,weights)) for j in range(3)]) or len(ids)==1
 assert r['height_m']==sum(field[v]['height_m']*w for v,w in zip(ids,weights))
 for parent in r['parent_triangles']:
  s=source[parent['triangle']];assert parent['native_vertices']==s['vertices'];assert parent['weights']==[sum(w for v,w in zip(ids,weights) if v==n) for n in s['vertices']]
edgeuses=collections.defaultdict(list);graph=collections.defaultdict(set)
for fi,tri in enumerate(cl['faces']):
 assert len(set(tri))==3 and all(0<=x<276 for x in tri);sourceids=set(source[cl['source_triangles'][fi]]['vertices']);assert all(set(cl['ledger'][v]['support_ids'])<=sourceids for v in tri)
 for u,v in zip(tri,tri[1:]+tri[:1]):edgeuses[tuple(sorted((u,v)))].append((u,v));graph[u].add(v);graph[v].add(u)
assert all(len(x) in [1,2] and (len(x)==1 or x[0]==tuple(reversed(x[1]))) for x in edgeuses.values())
bound={e for e,uses in edgeuses.items() if len(uses)==1};bg=collections.defaultdict(set)
for u,v in bound:bg[u].add(v);bg[v].add(u)
assert len(bound)==106 and all(len(x)==2 for x in bg.values()) and all(abs(cl['ledger'][i]['F'])<=1e-10 for i in bg)
def connected(graph):
 seen=set();todo=[min(graph)]
 while todo:
  u=todo.pop()
  if u in seen:continue
  seen.add(u);todo.extend(graph[u]-seen)
 return len(seen)==len(graph)
assert connected(graph) and connected(bg)
distance={i:0 for i in bg};q=collections.deque(distance)
while q:
 u=q.popleft()
 for v in graph[u]:
  if v not in distance:distance[v]=distance[u]+1;q.append(v)
for i,r in enumerate(m['vertex_ledger']):
 original=cl['ledger'][i];assert all(r[k]==v for k,v in original.items());t=min(distance[i]/3,1);taper=.15+.85*t*t*(3-2*t);lift=r['height_m']*taper;assert r['taper']==taper and r['lift_m']==lift and r['graph_boundary_distance']==distance[i];assert r['outer']==m['vertices'][i]==[f32(r['base'][j]+r['normal'][j]*lift) for j in range(3)] and m['vertices'][i+276]==r['base']
closed=collections.defaultdict(list)
for fi,face in enumerate(m['faces']):
 assert len(set(face))==len(face) and all(0<=i<552 for i in face)
 for u,v in zip(face,face[1:]+face[:1]):closed[tuple(sorted((u,v)))].append((u,v))
assert all(len(x)==2 and x[0]==tuple(reversed(x[1])) for x in closed.values())
assert m['artist_ear_boxes']==a['ear_intent_boxes'] and m['artist_forehead_gate']=={'front_y':a['artist_thresholds']['front_boundary_y'],'min_z':a['artist_thresholds']['forehead_z']}
ears=[];fore=[]
for fi,(face,role) in enumerate(zip(m['faces'],m['face_roles'])):
 if role!='outer':continue
 co=[m['vertices'][i] for i in face];lo=[min(p[j] for p in co) for j in range(3)];hi=[max(p[j] for p in co) for j in range(3)]
 for side,box in m['artist_ear_boxes'].items():
  if all(hi[j]>=box['min'][j] and lo[j]<=box['max'][j] for j in range(3)):ears.append((fi,m['face_source_triangles'][fi],side,co))
 gate=m['artist_forehead_gate']
 if lo[1]<gate['front_y'] and lo[2]<gate['min_z']:fore.append(fi)
assert ears==[(x['polygon'],x['source_triangle'],x['side'],x['coordinates']) for x in env['outer_ear_overlaps']] and [x[0] for x in ears]==[236,684] and not fore and not env['outer_forehead_overlaps']
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'stored_source_verified':True,'pins':18,'all676source_triangles_and_scalar_values_bound':True,'276canonical_source_points_barycentrics_and_lift':True,'one_connected_domain_and_perimeter':True,'boundary_edges':106,'552mass_vertices994polygons_closed_opposite':True,'artist_thresholds_unchanged':True,'ear_refusal_polygons_sources':[[236,1540],[684,14783]],'forehead_overlaps':0,'native_attempts':0,'appearance':'UNKNOWN; no new image','limits':'Stored source topology and conservative AABB observations only, not actual triangle-box intersection/visible obstruction/penetration/occupancy/clearance/motion/AAA; no author or native replay'}
(P/'ROOT-SOURCE.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
