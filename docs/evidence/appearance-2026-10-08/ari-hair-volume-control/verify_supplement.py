from pathlib import Path
import json,math,struct,collections,datetime,zipfile
from array import array
P=Path(__file__).resolve().parent
m=json.loads((P/'MASS.json').read_text());n=json.loads((P/'NATIVE.json').read_text());a=json.loads((P.parent/'ari-root-flow-atlas/PARTITION.json').read_text());r=json.loads((P/'RESULT.json').read_text());rows=sorted([x for zone in a['zones'].values() for x in zone],key=lambda x:x['triangle']);points={};incident=collections.defaultdict(list);graph=collections.defaultdict(set);edges=collections.defaultdict(list)
for x in rows:
 for vid,co in zip(x['vertices'],x['coordinates']):
  if vid in points:assert points[vid]==co
  points[vid]=co;incident[vid].append(x)
 for u,v in zip(x['vertices'],x['vertices'][1:]+x['vertices'][:1]):graph[u].add(v);graph[v].add(u);edges[tuple(sorted((u,v)))].append((u,v))
bound={v for e,uses in edges.items() if len(uses)==1 for v in e};dist={v:0 for v in bound};q=collections.deque(bound)
while q:
 u=q.popleft()
 for v in graph[u]:
  if v not in dist:dist[v]=dist[u]+1;q.append(v)
f32=lambda x:struct.unpack('<f',struct.pack('<f',x))[0]
for i,v in enumerate(m['vertex_ledger']):
 vid=v['native_vertex'];assert m['source_ids'][i]==vid and v['source']==points[vid] and v['source_triangles']==[x['triangle'] for x in incident[vid]] and v['graph_boundary_distance']==dist[vid]
 area=sum(x['area'] for x in incident[vid]);normal=[sum(x['normal'][j]*x['area'] for x in incident[vid])/area for j in range(3)];length=math.sqrt(sum(x*x for x in normal));normal=[x/length for x in normal];t=min(dist[vid]/3,1);taper=.15+.85*t*t*(3-2*t);height=sum(m['artist_heights_m'][x['zone']]*x['area'] for x in incident[vid])/area*taper
 assert v['normal']==normal and v['taper']==taper and v['lift_m']==height and v['outer']==[f32(points[vid][j]+normal[j]*height) for j in range(3)] and m['vertices'][i+238]==points[vid]
mat=n['matrix_world'];res=max(abs(mat[i][j]-(1 if i==j else 0)) for i in range(4) for j in range(4));assert res<=1e-6
with zipfile.ZipFile(P/'work/actual-static-geometry.npz') as z:
 b=z.read('AriTemporaryVolume_world.npy');start=10 if b[6]==1 else 12;size=struct.unpack('<H' if b[6]==1 else '<I',b[8:start])[0];v=array('f');v.frombytes(b[start+size:]);assert len(v)==1428
 for i,co in enumerate(n['vertices']):assert list(v[i*3:i*3+3])==[f32(sum(mat[j][k]*([*co,1][k]) for k in range(4))) for j in range(3)]
frame=r['frame'];assert all(frame['min'][j]-1e-6<=v[off+j]<=frame['max'][j]+1e-6 for off in range(0,len(v),3) for j in range(3))
assert r['domains']['AriTemporaryVolume']['render_vertices']==476 and r['domains']['AriTemporaryVolume']['head_domain_vertices']==476 and len(r['outputs'])==3
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'all238source_associations_and_lift_formula_exact':True,'all476actualworld_float32_matrix_values_exact':True,'world_identity_max_coefficient_residual':res,'all476mass_points_within_recorded_frame_bounds':True,'three_original_projection_limits':all(.04<=x['projection'][k]<=.96 for x in r['outputs'] for k in ['minx','maxx','miny','maxy']),'head_union_memberships_and_projection':'Attributed to frozen actual native observer; no fresh render or independent projection replay','appearance':'Whole front/profile/rear inspected; compact crown/visible forehead and ears useful as temporary volume; stepped temple/ear/nape boundary not final hairline; strict numeric refusal remains.'}
(P/'ROOT-SUPPLEMENT.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
