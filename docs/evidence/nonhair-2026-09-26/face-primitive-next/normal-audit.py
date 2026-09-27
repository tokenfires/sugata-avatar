"""CPU-only normal ownership measurements; not a candidate operator."""
import contextlib,io,runpy,json,math,struct,hashlib
from pathlib import Path
HERE=Path(__file__).resolve().parent
with contextlib.redirect_stdout(io.StringIO()):s=runpy.run_path(str(HERE/'inventory.py'))
P=s['positions'];N=s['a'](s['pr']['attributes']['NORMAL']);I=s['triangles'];M=s['mapping'];B=s['by_source'];packed=s['packed']
def sub(a,b):return [x-y for x,y in zip(a,b)]
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def length(a):return math.sqrt(dot(a,a))
def unit(a):return [x/length(a) for x in a]
def f32(x):return struct.unpack('<f',struct.pack('<f',x))[0]
def angle(a,b):return math.degrees(math.acos(max(-1,min(1,dot(unit(a),unit(b))))))
def face(points,i):a,b,c=[points[j] for j in I[i*3:i*3+3]];return cross(sub(b,a),sub(c,a))
faces=len(I)//3;incident={source:[] for source in B}
for f in range(faces):
 for source in set(M[i] for i in I[3*f:3*f+3]):incident[source].append(f)
def sum_faces(points,fs):
 out=[0.,0.,0.]
 for f in fs:
  n=face(points,f)
  for c in range(3):out[c]+=n[c]
 return out
split={source:ix for source,ix in B.items() if len(ix)>1};hard={source:ix for source,ix in split.items() if any(N[i]!=N[ix[0]] for i in ix)}
rows=[]
slider=next(x for x in s['catalogue']['sliders'] if x['id']=='nose/nose-point-width-decr-incr')
for end,e in slider['ends'].items():
 records=[struct.unpack_from('<Ifff',packed,e['offset']+16*i) for i in range(e['count'])];moved={r[0] for r in records if any(r[1:])};affected_faces=sorted({f for src in moved for f in incident[src]});normal_sources=sorted({M[i] for f in affected_faces for i in I[3*f:3*f+3]});normal_positions=sorted({i for src in normal_sources for i in B[src]});Q=[p[:] for p in P]
 for src,*delta in records:
  for i in B.get(src,[]):Q[i]=[f32(x+y) for x,y in zip(P[i],delta)]
 base_areas=[length(face(P,f))/2 for f in affected_faces];new_areas=[length(face(Q,f))/2 for f in affected_faces];rotations=[];offsets=[];min_sum=math.inf
 for src in normal_sources:
  gp=sum_faces(P,incident[src]);gq=sum_faces(Q,incident[src]);min_sum=min(min_sum,length(gp),length(gq));rotations.append(angle(gp,gq));offsets.extend(angle(gp,N[i]) for i in B[src])
 rows.append({'target':e['target'],'movedSources':len(moved),'changedFaces':len(affected_faces),'normalSources':len(normal_sources),'normalPositions':len(normal_positions),'completeNormalNeighborhoodFaceCount':len({f for src in normal_sources for f in incident[src]}),'splitGroupsInNormalNeighborhood':{str(k):split[k] for k in normal_sources if k in split},'hardNormalGroupsInNormalNeighborhood':{str(k):hard[k] for k in normal_sources if k in hard},'minPristineTriangleAreaM2':min(base_areas),'minEndpointTriangleAreaM2':min(new_areas),'minFaceReferenceCosine':min(dot(unit(face(P,f)),unit(face(Q,f))) for f in affected_faces),'minEndpointToPristineAreaRatio':min(b/a for a,b in zip(base_areas,new_areas)),'maxGeometricNormalRotationDegrees':max(rotations),'maxAuthoredVsPristineGeometricNormalDegrees':max(offsets),'minSummedGeometricNormalLengthM2':min_sum,'minAuthoredNormalLength':min(length(N[i]) for i in normal_positions),'maxAuthoredNormalLength':max(length(N[i]) for i in normal_positions)})
self_bytes=Path(__file__).read_bytes();r={'kind':'read-only-local-normal-ownership-audit','method':'Source-index weld mapping, complete indexed triangle incidence, cross-product area sums. Endpoint POSITION values rounded once to Float32 as actual typed-array application. No candidate normal output authored.','sourceHashes':[*s['pins'],{'path':str(Path(__file__).resolve().relative_to(s['ROOT'])),'bytes':len(self_bytes),'sha256':hashlib.sha256(self_bytes).hexdigest()}],'allBodySplitGroups':len(split),'allBodyUnequalAuthoredNormalSplitGroups':len(hard),'cases':rows,'limits':['No candidate normal operator, topology quality gate or self-intersection test executed.','Area/cosine metrics describe source endpoints, not a chosen aesthetic range.','Different authored normals on one source weld are classified as unresolved hard-normal ownership; no averaging across them is proposed.']}
print(json.dumps(r,indent=2,allow_nan=False))
