"""Independent exact-rational endpoint intersection check, JSON stdin/stdout only.
Plane sections for noncoplanar triangles; projected exact 2-D clipping for coplanar ones.
No floating tolerance, normal transport, node kernel or renderer is imported.
"""
from fractions import Fraction as F
import json,sys,hashlib,math

def sub(a,b):return tuple(x-y for x,y in zip(a,b))
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def cross(a,b):return(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def orient(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def normal(t):return cross(sub(t[1],t[0]),sub(t[2],t[0]))
def section(t,p,n):
 d=[dot(n,sub(v,p)) for v in t];points=[v for v,x in zip(t,d) if x==0]
 for i in range(3):
  j=(i+1)%3
  if d[i]*d[j]<0:
   alpha=d[i]/(d[i]-d[j]);points.append(tuple(t[i][k]+alpha*(t[j][k]-t[i][k]) for k in range(3)))
 return points

def beyond_shared(a,b,sa,sb):
 na,nb=normal(a),normal(b);assert any(na) and any(nb),'degenerate triangle'
 common=set(sa)&set(sb);shared=[a[sa.index(x)] for x in common]
 if len(common)==3:return True
 direction=cross(na,nb)
 if any(direction):
  x=section(a,b[0],nb);y=section(b,a[0],na)
  if not x or not y:return False
  k=next(i for i,v in enumerate(direction) if v);lo=max(min(p[k] for p in x),min(p[k] for p in y));hi=min(max(p[k] for p in x),max(p[k] for p in y))
  if lo>hi:return False
  if not shared:return True
  return lo<min(p[k] for p in shared) or hi>max(p[k] for p in shared)
 if dot(na,sub(b[0],a[0]))!=0:return False
 # Coplanar: clip in any nondegenerate 2-D projection using exact rationals.
 drop=next(i for i,v in enumerate(na) if v);axes=[i for i in range(3) if i!=drop];project=lambda p:tuple(p[i] for i in axes)
 poly=list(map(project,a));clip=list(map(project,b));sign=1 if orient(*clip)>0 else -1
 for i in range(3):
  u,v=clip[i],clip[(i+1)%3];out=[]
  for j in range(len(poly)):
   p,q=poly[j],poly[(j+1)%len(poly)];dp=sign*orient(u,v,p);dq=sign*orient(u,v,q)
   if dp>=0:out.append(p)
   if (dp<0<dq) or (dq<0<dp):
    alpha=dp/(dp-dq);out.append(tuple(p[k]+alpha*(q[k]-p[k]) for k in range(2)))
  poly=out
  if not poly:return False
 shared=list(map(project,shared))
 if not shared:return True
 if len(shared)==1:return any(p!=shared[0] for p in poly)
 u,v=shared;return any(orient(u,v,p)!=0 or dot(sub(p,u),sub(p,v))>0 for p in poly)

def rational(t):return [tuple(F(x) for x in p) for p in t]
a=rational([[0,0,0],[1,0,0],[0,1,0]])
assert not beyond_shared(a,rational([[1,0,0],[0,0,0],[0,-1,0]]),[0,1,2],[1,0,3])
assert beyond_shared(a,rational([[1,0,0],[0,0,0],[.25,.25,0]]),[0,1,2],[1,0,3])
assert not beyond_shared(a,rational([[0,0,0],[-1,0,0],[0,-1,0]]),[0,1,2],[0,3,4])
assert beyond_shared(a,rational([[.25,.25,-1],[.25,.25,1],[.5,.25,0]]),[0,1,2],[3,4,5])
assert beyond_shared(a,rational([[0,0,0],[.2,.2,-1],[.2,.2,1]]),[0,1,2],[0,3,4])
assert not beyond_shared(a,rational([[0,0,0],[-.2,-.2,-1],[-.2,-.2,1]]),[0,1,2],[0,3,4])
assert beyond_shared(a,rational([[1,0,0],[2,0,1],[2,1,1]]),[0,1,2],[3,4,5])
assert not beyond_shared(a,rational([[0,0,1],[1,0,1],[0,1,1]]),[0,1,2],[3,4,5])
raw=sys.stdin.buffer.read();data=json.loads(raw);indices=data['indices'];mapping=data['mapping'];reference=data['reference'];assert len(indices)%3==0;tri_ids=[indices[i:i+3] for i in range(0,len(indices),3)];sources=[[mapping[i] for i in t] for t in tri_ids];receipts=[]
for case in data['cases']:
 flat=case['positions'];assert len(flat)==len(reference)==3*len(mapping);assert all(math.isfinite(x) for x in flat)
 points=[tuple(flat[i:i+3]) for i in range(0,len(flat),3)];exact=[tuple(F(x) for x in p) for p in points];triangles=[[exact[i] for i in t] for t in tri_ids];bounds=[([min(points[i][c] for i in t) for c in range(3)],[max(points[i][c] for i in t) for c in range(3)]) for t in tri_ids];seen=set();hits=[];min_dot=None
 for f in case['affectedFaces']:
  before=[tuple(F(x) for x in reference[3*i:3*i+3]) for i in tri_ids[f]];n0=normal(before);n1=normal(triangles[f]);assert any(n0) and any(n1);d=dot(n0,n1);assert d>0,'reference-facing reversal';min_dot=d if min_dot is None else min(min_dot,d)
  for g in range(len(tri_ids)):
   if f==g:continue
   pair=tuple(sorted((f,g)))
   if pair in seen:continue
   af,bg=bounds[f],bounds[g]
   if any(af[0][c]>bg[1][c] or af[1][c]<bg[0][c] for c in range(3)):continue
   seen.add(pair)
   if beyond_shared(triangles[f],triangles[g],sources[f],sources[g]):hits.append(pair)
 receipts.append({'weight':case['weight'],'affectedFaces':len(case['affectedFaces']),'exactAABBPairs':len(seen),'nonSharedSimplexIntersections':hits,'positiveExactReferenceFaceDot':True,'minimumExactReferenceFaceDot':str(min_dot),'passed':not hits})
assert all(x['passed'] for x in receipts),receipts
print(json.dumps({'inputSHA256':hashlib.sha256(raw).hexdigest(),'method':'Exact rationals on supplied Float32 coordinates; plane-section intervals and projected coplanar clipping. Full affected-face versus body pairs; only actual shared source-index simplex is accepted.','independentAnalyticalControls':8,'cases':receipts,'limits':'Discrete endpoint self-intersection and reference-facing checks only; no positive clearance, continuous range, all-motion or rendered acceptance.'},indent=2))
