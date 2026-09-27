"""Independent exact intersection of closed triangles at stored IEEE754 coordinates.
No project geometry dependency, numerical tolerance, nearest-vertex proxy or welding.
"""
from fractions import Fraction as F
from math import isfinite


def sub(a, b): return tuple(x-y for x, y in zip(a,b))
def dot(a, b): return sum(x*y for x,y in zip(a,b))
def cross(a,b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def lerp(a,b,t): return tuple(x+t*(y-x) for x,y in zip(a,b))
def unique(p): return list(dict.fromkeys(p))
def exact(points):
    if len(points)!=3 or any(len(p)!=3 for p in points): raise ValueError('triangle shape')
    if any(not isinstance(x,(int,float,F)) or isinstance(x,bool) or not isfinite(x) for p in points for x in p): raise ValueError('nonfinite coordinate')
    q=tuple(tuple(F(x) for x in p) for p in points)
    if cross(sub(q[1],q[0]),sub(q[2],q[0]))==(0,0,0): raise ValueError('degenerate triangle')
    return q

def barycentric(p,t):
    u,v,w=sub(t[1],t[0]),sub(t[2],t[0]),sub(p,t[0]); uu,vv,uv=dot(u,u),dot(v,v),dot(u,v)
    d=uu*vv-uv*uv
    if not d: raise ValueError('degenerate triangle')
    b=(dot(w,u)*vv-dot(w,v)*uv)/d; c=(dot(w,v)*uu-dot(w,u)*uv)/d
    return (1-b-c,b,c)

def section(t, distances):
    p=[t[i] for i,d in enumerate(distances) if not d]
    for i,j in ((0,1),(1,2),(2,0)):
        if distances[i]*distances[j]<0: p.append(lerp(t[i],t[j],distances[i]/(distances[i]-distances[j])))
    return unique(p)

def intersection(a,b):
    """All extreme points of a closed intersection; exact coordinates and category."""
    a,b=exact(a),exact(b)
    na=cross(sub(a[1],a[0]),sub(a[2],a[0])); nb=cross(sub(b[1],b[0]),sub(b[2],b[0]))
    da=[dot(nb,sub(p,b[0])) for p in a]; db=[dot(na,sub(p,a[0])) for p in b]
    if any(all(d>0 for d in ds) or all(d<0 for d in ds) for ds in (da,db)): return None
    line=cross(na,nb)
    if line!=(0,0,0):
        sa,sb=section(a,da),section(b,db)
        if not sa or not sb: return None
        k=max(range(3),key=lambda i:abs(line[i])); sa.sort(key=lambda p:p[k]); sb.sort(key=lambda p:p[k])
        lo=max(sa[0][k],sb[0][k]); hi=min(sa[-1][k],sb[-1][k])
        if lo>hi:return None
        source=sa if len(sa)>1 else sb
        if len(source)==1: points=[source[0]]
        else: points=unique([lerp(source[0],source[-1],(x-source[0][k])/(source[-1][k]-source[0][k])) for x in (lo,hi)])
        mid=tuple(sum(p[i] for p in points)/len(points) for i in range(3))
        kind='transverse-interior' if len(points)>1 and all(v>0 for t in (a,b) for v in barycentric(mid,t)) else 'boundary-contact'
        return {'kind':kind,'points':points,'coplanar':False}
    if any(da) or any(db): return None
    # Coplanar convex clipping; signed halfplanes in the dominant projection.
    k=max(range(3),key=lambda i:abs(na[i])); axes=[i for i in range(3) if i!=k]
    def orient(p,q,r):
        x,y=axes;return (q[x]-p[x])*(r[y]-p[y])-(q[y]-p[y])*(r[x]-p[x])
    sign=1 if orient(*b)>0 else -1; poly=list(a)
    for i,j in ((0,1),(1,2),(2,0)):
        out=[]
        for p,q in zip(poly,poly[1:]+poly[:1]):
            dp=sign*orient(b[i],b[j],p);dq=sign*orient(b[i],b[j],q)
            if dp>=0:out.append(p)
            if (dp<0<dq) or (dq<0<dp):out.append(lerp(p,q,dp/(dp-dq)))
        poly=unique(out)
        if not poly:return None
    area=any(orient(poly[0],poly[i],poly[i+1]) for i in range(1,len(poly)-1))
    return {'kind':'coplanar-area' if area else 'boundary-contact','points':poly,'coplanar':True}

def in_segment(p,a,b):
    d=sub(b,a);w=sub(p,a)
    return cross(d,w)==(0,0,0) and 0<=dot(w,d)<=dot(d,d)

def shared_only(hit,a,b):
    """Indexed same-mesh adjacency only. Cross-mesh IDs never imply attachment."""
    if a['mesh']!=b['mesh']: return False
    common=set(a['ids'])&set(b['ids'])
    if not common:return False
    if len(common)==3: raise ValueError('identical/repeated self triangle must be classified separately')
    pa={i:tuple(F(x) for x in p) for i,p in zip(a['ids'],a['points'])}; pb={i:tuple(F(x) for x in p) for i,p in zip(b['ids'],b['points'])}
    if any(pa[i]!=pb[i] for i in common):raise ValueError('shared indexed vertex positions differ')
    pts=[pa[i] for i in sorted(common)]
    return all(p==pts[0] if len(pts)==1 else in_segment(p,*pts) for p in hit['points'])

def certificate(hit,a,b):
    out={'kind':hit['kind'],'coplanar':hit['coplanar'],'points':[]}
    for p in hit['points']:
        out['points'].append({'xyz':[float(x) for x in p],'exact':[str(x) for x in p],
            'aBarycentric':[str(x) for x in barycentric(p,exact(a))],
            'bBarycentric':[str(x) for x in barycentric(p,exact(b))]})
    return out
