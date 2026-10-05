"""Exact narrow phase on the actual binary64 operands; no geometry at import."""
from fractions import Fraction as Q

def point(p): return tuple(Q(x) for x in p)
def sub(a,b): return tuple(a[i]-b[i] for i in range(3))
def add(a,b): return tuple(a[i]+b[i] for i in range(3))
def mul(a,s): return tuple(x*s for x in a)
def dot(a,b): return sum((a[i]*b[i] for i in range(3)),Q(0))
def cross(a,b): return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def norm2(v): return dot(v,v)
def clamp(t): return max(Q(0),min(Q(1),t))
def interp(a,b,t): return add(a,mul(sub(b,a),t))
def normal(t): return cross(sub(t[1],t[0]),sub(t[2],t[0]))
def area2(t): return norm2(normal(t)) # four times squared area
def mean(ps): return tuple(sum((p[i] for p in ps),Q(0))/len(ps) for i in range(3))
def orient2(a,b,c): return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def project(p,axis): return tuple(p[k] for k in range(3) if k!=axis)

def point_segment2(p,a,b):
    d=sub(b,a); s=norm2(d)
    t=clamp(dot(sub(p,a),d)/s) if s else Q(0)
    q=interp(a,b,t)
    return norm2(sub(p,q)),t

def segment_segment2(a,b,c,d):
    """Enumerate boundary optima and the unconstrained interior quadratic optimum."""
    u,v,w=sub(b,a),sub(d,c),sub(a,c)
    A,B,C,D,E=dot(u,u),dot(u,v),dot(v,v),dot(u,w),dot(v,w)
    rows=[]
    for s in (Q(0),Q(1)):
        p=interp(a,b,s); dist,t=point_segment2(p,c,d); rows.append((dist,s,t))
    for t in (Q(0),Q(1)):
        p=interp(c,d,t); dist,s=point_segment2(p,a,b); rows.append((dist,s,t))
    det=A*C-B*B
    if det:
        s,t=(B*E-C*D)/det,(A*E-B*D)/det
        if 0<=s<=1 and 0<=t<=1:
            rows.append((norm2(sub(interp(a,b,s),interp(c,d,t))),s,t))
    return min(rows)

def point_triangle2(p,t):
    """Plane projection if interior, plus all three complete edge minima."""
    a,b,c=t; ab,ac=sub(b,a),sub(c,a); ap=sub(p,a)
    aa,bb,cc,d,e=dot(ab,ab),dot(ab,ac),dot(ac,ac),dot(ap,ab),dot(ap,ac)
    det=aa*cc-bb*bb
    rows=[]
    if det:
        u,v=(cc*d-bb*e)/det,(aa*e-bb*d)/det
        if u>=0 and v>=0 and u+v<=1:
            q=add(a,add(mul(ab,u),mul(ac,v)))
            rows.append((norm2(sub(p,q)),'face',(1-u-v,u,v)))
    for i in range(3):
        x,s=point_segment2(p,t[i],t[(i+1)%3]);rows.append((x,'edge',(i,s)))
    return min(rows,key=lambda row:row[0])

def inside_plane_triangle(p,t):
    n=normal(t)
    if not norm2(n): return False
    k=max(range(3),key=lambda i:abs(n[i])); p2=project(p,k)
    tri=[project(x,k) for x in t]; sign=orient2(*tri)
    return all(orient2(tri[i],tri[(i+1)%3],p2)*sign>=0 for i in range(3))

def segment_triangle_intersects(a,b,t):
    n=normal(t)
    if not norm2(n): return False
    da,db=dot(n,sub(a,t[0])),dot(n,sub(b,t[0]))
    if da*db>0: return False
    if not da and inside_plane_triangle(a,t): return True
    if not db and inside_plane_triangle(b,t): return True
    if da*db<0: return inside_plane_triangle(interp(a,b,da/(da-db)),t)
    if not da and not db:
        # A coplanar crossing can have both endpoints outside the triangle.
        for j in range(3):
            if segment_segment2(a,b,t[j],t[(j+1)%3])[0]==0: return True
    return False

def triangle_distance2(a,b):
    for x,y in ((a,b),(b,a)):
        for i in range(3):
            if segment_triangle_intersects(x[i],x[(i+1)%3],y): return Q(0),('intersection',i)
    rows=[]
    for kind,(x,y) in enumerate(((a,b),(b,a))):
        for i,p in enumerate(x):
            d,region,uv=point_triangle2(p,y);rows.append((d,('vertex-face',kind,i,region,uv)))
    for i in range(3):
        for j in range(3):
            d,s,t=segment_segment2(a[i],a[(i+1)%3],b[j],b[(j+1)%3])
            rows.append((d,('edge-edge',i,j,s,t)))
    return min(rows,key=lambda row:row[0])

def plane_section(t,n,origin):
    ds=[dot(n,sub(p,origin)) for p in t]; out=[]
    for i in range(3):
        if ds[i]==0: out.append(t[i])
        j=(i+1)%3
        if ds[i]*ds[j]<0: out.append(interp(t[i],t[j],ds[i]/(ds[i]-ds[j])))
    return list(dict.fromkeys(out))

def coplanar_intersection(a,b,n):
    axis=max(range(3),key=lambda i:abs(n[i]))
    b2=[project(x,axis) for x in b];sgn=1 if orient2(*b2)>0 else -1
    poly=list(a)
    for j in range(3):
        if not poly:break
        old=poly;poly=[];B,C=b2[j],b2[(j+1)%3]
        for i,p in enumerate(old):
            q=old[(i+1)%len(old)]
            dp=sgn*orient2(B,C,project(p,axis));dq=sgn*orient2(B,C,project(q,axis))
            if dp>=0:poly.append(p)
            if dp*dq<0:poly.append(interp(p,q,dp/(dp-dq)))
        # Exact equality only. Retain point/segment intersections.
        cleaned=[]
        for p in poly:
            if not cleaned or cleaned[-1]!=p:cleaned.append(p)
        if len(cleaned)>1 and cleaned[0]==cleaned[-1]:cleaned.pop()
        poly=cleaned
    return list(dict.fromkeys(poly))

def triangle_intersection(a,b):
    """Complete convex intersection; physical/test-solid triangles must be nondegenerate."""
    na,nb=normal(a),normal(b)
    if not norm2(na) or not norm2(nb):raise ValueError('degenerate intersection triangle')
    da=[dot(nb,sub(x,b[0])) for x in a];db=[dot(na,sub(x,a[0])) for x in b]
    if all(x>0 for x in da) or all(x<0 for x in da) or all(x>0 for x in db) or all(x<0 for x in db):return []
    line=cross(na,nb)
    if not norm2(line):
        return coplanar_intersection(a,b,na) if all(x==0 for x in da) else []
    sa,sb=plane_section(a,nb,b[0]),plane_section(b,na,a[0])
    if not sa or not sb:return []
    k=max(range(3),key=lambda i:abs(line[i]))
    lo=max(min(p[k] for p in sa),min(p[k] for p in sb))
    hi=min(max(p[k] for p in sa),max(p[k] for p in sb))
    if lo>hi:return []
    if len(sa)==1:return sa
    sa.sort(key=lambda p:p[k]);den=sa[-1][k]-sa[0][k]
    if not den:raise ValueError('section axis contradiction')
    return list(dict.fromkeys(interp(sa[0],sa[-1],(v-sa[0][k])/den) for v in (lo,hi)))

def within_simplex(p,shared):
    if len(shared)==1:return p==shared[0]
    if len(shared)==2:
        d=sub(shared[1],shared[0]);w=sub(p,shared[0])
        return norm2(cross(d,w))==0 and 0<=dot(w,d)<=norm2(d)
    return False

def ray_hit(p,d,t,band=Q(1,10**12)):
    """Exact forward Moller-Trumbore; boundary hit ambiguity refuses, never perturbs."""
    a,b,c=t;e1,e2=sub(b,a),sub(c,a);h=cross(d,e2);det=dot(e1,h)
    if not det:
        if dot(normal(t),sub(p,a))==0:raise ValueError('coplanar ray ambiguity')
        return None
    s=sub(p,a);u=dot(s,h)/det;q=cross(s,e1);v=dot(d,q)/det;tt=dot(e2,q)/det
    if tt<=0 or u<0 or v<0 or u+v>1:return None
    if min(u,v,1-u-v)<=band:raise ValueError('ray edge/vertex ambiguity')
    return tt

def bbox(ps):
    return tuple(min(p[i] for p in ps) for i in range(3)),tuple(max(p[i] for p in ps) for i in range(3))

def boxes_overlap(a,b):
    return all(a[0][i]<=b[1][i] and b[0][i]<=a[1][i] for i in range(3))

def box_distance2(a,b):
    return sum((max(Q(0),a[0][i]-b[1][i],b[0][i]-a[1][i])**2 for i in range(3)),Q(0))

def ray_box(p,d,box):
    lo,hi=Q(0),None
    for i in range(3):
        if not d[i]:
            if not box[0][i]<=p[i]<=box[1][i]:return False
        else:
            x,y=sorted(((box[0][i]-p[i])/d[i],(box[1][i]-p[i])/d[i]))
            lo=max(lo,x);hi=y if hi is None else min(hi,y)
            if hi<lo:return False
    return hi is None or hi>=lo
