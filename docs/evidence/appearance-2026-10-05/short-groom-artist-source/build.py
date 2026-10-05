"""Original fictional short-groom artist source. Not executed before admission."""
import json, math, hashlib, struct
from pathlib import Path

BASE = Path(__file__).resolve().parent
P, F, PARTS, ROOTS = [], [], [], []
RX, RY, RZ = .66, 1.02, .72
HAIRLINE = [1.10, 1.28, 1.48, 1.87, 2.02, 1.87, 1.48, 1.28]

def add(a, b): return [x+y for x,y in zip(a,b)]
def sub(a, b): return [x-y for x,y in zip(a,b)]
def mul(a, k): return [x*k for x in a]
def dot(a, b): return sum(x*y for x,y in zip(a,b))
def cross(a, b): return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
def unit(a):
    n = math.sqrt(dot(a,a))
    if n < 1e-10: raise ValueError('Undefined source frame')
    return mul(a,1/n)
def v(p): P.append(list(p)); return len(P)-1
def tri(a,b,c): F.append([a,b,c])
def quad(a,b,c,d): tri(a,b,c); tri(a,c,d)
def part(name, kind, color, start_v, start_f):
    PARTS.append(dict(id=name,kind=kind,color=color,vertex_ids=list(range(start_v,len(P))),face_ids=list(range(start_f,len(F)))))

def ellipsoid(name, radii, center, rows=24, cols=32, color='#bdb8ad'):
    sv,sf=len(P),len(F)
    top=v(add(center,[0,radii[1],0])); rings=[]
    for i in range(1,rows):
        phi=math.pi*i/rows; ring=[]
        for j in range(cols):
            theta=2*math.pi*j/cols
            ring.append(v(add(center,[radii[0]*math.sin(phi)*math.sin(theta),radii[1]*math.cos(phi),radii[2]*math.sin(phi)*math.cos(theta)])))
        rings.append(ring)
    bottom=v(add(center,[0,-radii[1],0]))
    for j in range(cols): tri(top,rings[0][j],rings[0][(j+1)%cols])
    for a,b in zip(rings,rings[1:]):
        for j in range(cols): quad(a[j],b[j],b[(j+1)%cols],a[(j+1)%cols])
    for j in range(cols): tri(rings[-1][j],bottom,rings[-1][(j+1)%cols])
    part(name,'fictional-reference',color,sv,sf)
    return rings

head = ellipsoid('head-reference',[RX,RY,RZ],[0,0,0])
head_faces = list(PARTS[0]['face_ids'])
ellipsoid('neck-reference',[.24,.39,.25],[0,-1.03,-.10],16,24)
ellipsoid('ear-left-reference',[.095,.19,.085],[-.66,-.055,.005],16,24)
ellipsoid('ear-right-reference',[.095,.19,.085],[.66,-.055,.005],16,24)
ellipsoid('front-orientation-marker',[.105,.13,.115],[0,-.12,.69],16,24)

def limit(theta):
    u=(theta%(2*math.pi))/(2*math.pi)*8; i=int(u); t=u-i
    return HAIRLINE[i]*(1-t)+HAIRLINE[(i+1)%8]*t

scalp_faces=[]
for fid in head_faces:
    p=mul(add(add(P[F[fid][0]],P[F[fid][1]]),P[F[fid][2]]),1/3)
    phi=math.acos(max(-1,min(1,p[1]/RY)))
    if phi <= limit(math.atan2(p[0]/RX,p[2]/RZ)): scalp_faces.append(fid)

# Full two-surface original mass, poles and a joined complete hairline rim.
sv,sf=len(P),len(F); layers=[]; n,m=20,64
for outer in [True,False]:
    top=v([-.10,1.20,-.02] if outer else [0,RY*1.016,0]); rings=[]
    for i in range(1,n+1):
        u=i/n; ring=[]
        for j in range(m):
            theta=2*math.pi*j/m; phi=u*limit(theta)
            if outer:
                point=[.74*math.sin(phi)*math.sin(theta)-.10*(1-u)**2,1.20*math.cos(phi)+.075*math.sin(math.pi*u),.79*math.sin(phi)*math.cos(theta)-.02*(1-u)**2]
            else:
                point=[RX*1.016*math.sin(phi)*math.sin(theta),RY*1.016*math.cos(phi),RZ*1.016*math.sin(phi)*math.cos(theta)]
            ring.append(v(point))
        rings.append(ring)
    local=[]
    for j in range(m): local.append([top,rings[0][j],rings[0][(j+1)%m]])
    for a,b in zip(rings,rings[1:]):
        for j in range(m): local.extend([[a[j],b[j],b[(j+1)%m]],[a[j],b[(j+1)%m],a[(j+1)%m]]])
    for a,b,c in local: tri(a,b,c) if outer else tri(c,b,a)
    layers.append(rings)
for j in range(m): quad(layers[0][-1][(j+1)%m],layers[0][-1][j],layers[1][-1][j],layers[1][-1][(j+1)%m])
part('complete-crown-temple-nape-mass','hair-mass','#30261f',sv,sf)

# Every original trajectory is a deliberate artist choice, not image measurement.
# id, head ring (1-based), azimuth column, four following centre controls, halfwidth.
LOCKS = [
 ('front-sweep-01',4,2,[[.17,1.26,.40],[-.12,1.32,.58],[-.38,1.13,.72],[-.46,.78,.73]],.15),
 ('front-sweep-02',4,4,[[.28,1.29,.28],[-.02,1.35,.48],[-.34,1.18,.65],[-.57,.85,.62]],.14),
 ('front-sweep-03',4,6,[[.34,1.28,.10],[.04,1.34,.31],[-.28,1.21,.49],[-.66,.79,.37]],.14),
 ('crown-sweep-01',3,8,[[.34,1.28,-.10],[.10,1.34,.10],[-.25,1.24,.26],[-.65,.82,.17]],.13),
 ('crown-sweep-02',3,10,[[.28,1.26,-.27],[.01,1.31,-.10],[-.30,1.22,.02],[-.70,.71,-.03]],.13),
 ('crown-sweep-03',3,12,[[.19,1.24,-.39],[-.09,1.28,-.26],[-.35,1.16,-.17],[-.71,.60,-.23]],.12),
 ('right-temple-front',7,7,[[.65,.88,.18],[.77,.65,.19],[.77,.40,.19],[.75,.20,.14]],.10),
 ('right-temple-rear',7,10,[[.64,.84,-.24],[.76,.62,-.26],[.77,.37,-.28],[.74,.17,-.31]],.095),
 ('left-temple-front',7,25,[[-.66,.86,.18],[-.77,.62,.21],[-.78,.39,.20],[-.75,.21,.14]],.10),
 ('left-temple-rear',7,22,[[-.64,.85,-.24],[-.77,.62,-.27],[-.77,.37,-.30],[-.73,.16,-.34]],.095),
 ('rear-flow-center',5,16,[[0,1.09,-.69],[.02,.79,-.86],[.03,.24,-.89],[0,-.53,-.77]],.12),
 ('rear-flow-right',5,13,[[.30,1.07,-.61],[.43,.79,-.77],[.42,.19,-.83],[.28,-.43,-.75]],.12),
 ('rear-flow-left',5,19,[[-.30,1.07,-.61],[-.43,.79,-.77],[-.42,.19,-.83],[-.28,-.43,-.75]],.12),
 ('nape-center',9,16,[[0,.48,-.87],[0,.16,-.91],[0,-.22,-.88],[0,-.58,-.75]],.09),
 ('nape-right',9,14,[[.31,.48,-.82],[.35,.15,-.86],[.34,-.23,-.84],[.25,-.54,-.73]],.085),
 ('nape-left',9,18,[[-.31,.48,-.82],[-.35,.15,-.86],[-.34,-.23,-.84],[-.25,-.54,-.73]],.085),
]

def catmull(points,t):
    u=t*(len(points)-1); i=min(int(u),len(points)-2); f=u-i
    a,b,c,d=points[max(0,i-1)],points[i],points[i+1],points[min(i+2,len(points)-1)]
    return [.5*((2*b[k])+(-a[k]+c[k])*f+(2*a[k]-5*b[k]+4*c[k]-d[k])*f*f+(-a[k]+3*b[k]-3*c[k]+d[k])*f*f*f) for k in range(3)]

for name,row,col,tail,width in LOCKS:
    sv,sf=len(P),len(F); anchor=head[row-1][col]; root=P[anchor]
    outward=unit([root[0]/RX**2,root[1]/RY**2,root[2]/RZ**2])
    controls=[add(root,mul(outward,.145))]+tail
    rings=[]; previous=None; samples=25; sides=12
    for i in range(samples):
        t=i/(samples-1); center=catmull(controls,t)
        tangent=unit(sub(catmull(controls,min(1,t+.001)),catmull(controls,max(0,t-.001))))
        radial=unit([center[0]/RX**2,center[1]/RY**2,center[2]/RZ**2])
        normal=sub(radial,mul(tangent,dot(radial,tangent)))
        if dot(normal,normal)<1e-8: normal=sub([0,0,1],mul(tangent,tangent[2]))
        normal=unit(normal)
        if previous is not None and dot(normal,previous)<0: normal=mul(normal,-1)
        previous=normal; side=unit(cross(tangent,normal))
        taper=.16+.84*(1-t)**.75; thickness=.039*taper
        rings.append([v(add(center,add(mul(normal,thickness*math.cos(2*math.pi*j/sides)),mul(side,width*taper*math.sin(2*math.pi*j/sides))))) for j in range(sides)])
    for a,b in zip(rings,rings[1:]):
        for j in range(sides): quad(a[j],a[(j+1)%sides],b[(j+1)%sides],b[j])
    start=v(controls[0]); end=v(controls[-1])
    for j in range(sides): tri(start,rings[0][(j+1)%sides],rings[0][j]); tri(end,rings[-1][j],rings[-1][(j+1)%sides])
    part(name,'directed-hair-lock','#423127' if 'sweep' in name else '#382a23',sv,sf)
    incident=[fid for fid in scalp_faces if anchor in F[fid]]
    ROOTS.append(dict(lock=name,head_vertex=anchor,root=list(root),scalp_incident_faces=incident,centers=controls,first_section_center_vertex=start,tip_center_vertex=end,root_lift=.145,halfwidth=width,halfthickness=.039,samples=samples,cross_section_sides=sides))

mesh=dict(schema='sugata-original-artist-groom-1',id='swept-short-fictional-01',units='fictional unitless artist coordinates',positions=P,triangles=F,parts=PARTS,head=dict(part='head-reference',radii=[RX,RY,RZ],center=[0,0,0],rows=24,cols=32),scalp=dict(head_face_ids=scalp_faces,hairline_polar_angles=HAIRLINE,azimuth_start='+Z front',azimuth_direction='toward +X'),roots=ROOTS,limits='Original artist blockout only. Separate deliberately overlapping reference forms, mass and locks are not a Boolean union, anatomy, avatar attachment, physical fit, skinning, morphology, dynamics, finished strand materials or a supported character.')
export=BASE/'export'; export.mkdir(exist_ok=False)
data=(json.dumps(mesh,separators=(',',':'))+'\n').encode();(export/'mesh.json').write_bytes(data)
lines=['# Original fictional artist head/scalp/full short groom; unitless; no avatar fit']
lines += ['v '+' '.join(format(c,'.17g') for c in p) for p in P]
for p in PARTS:
    lines.append('g '+p['id']); lines.extend('f '+' '.join(str(i+1) for i in F[fid]) for fid in p['face_ids'])
for r in ROOTS: lines.append('# root '+r['lock']+' head_vertex '+str(r['head_vertex']+1)+' first_center '+str(r['first_section_center_vertex']+1)+' tip '+str(r['tip_center_vertex']+1))
(export/'groom.obj').write_text('\n'.join(lines)+'\n')
def digest(values,fmt): return hashlib.sha256(struct.pack('<'+fmt*len(values),*values)).hexdigest()
expected=dict(meshSha=hashlib.sha256(data).hexdigest(),positionSha=digest([c for p in P for c in p],'f'),parts=[dict(id=p['id'],indexSha=digest([i for fid in p['face_ids'] for i in F[fid]],'I'),vertices=len(p['vertex_ids']),triangles=len(p['face_ids'])) for p in PARTS],vertices=len(P),triangles=len(F),roots=len(ROOTS),scalp_faces=len(scalp_faces),bounds=dict(min=[min(p[k] for p in P) for k in range(3)],max=[max(p[k] for p in P) for k in range(3)]))
(export/'expected.json').write_text(json.dumps(expected,indent=2)+'\n')
print(json.dumps({k:expected[k] for k in ['meshSha','vertices','triangles','roots','scalp_faces']}))
