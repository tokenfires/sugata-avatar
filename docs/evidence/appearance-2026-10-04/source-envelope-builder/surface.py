"""Fixed original-fragment primitives, full shared grid extraction and procedural cuts."""
import array,itertools,math
from fractions import Fraction as Q
import exact as E
import spatial as S

def vfsub(a,b):return [a[i]-b[i] for i in range(3)]
def vfcross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def vfdot(a,b):return (a[0]*b[0]+a[1]*b[1])+a[2]*b[2]
def mean(ps):
    acc=[0.,0.,0.]
    for p in ps:
        for k in range(3):acc[k]+=p[k]
    return [x/len(ps) for x in acc]
def unit(v):
    length=math.sqrt(vfdot(v,v))
    if not length or not math.isfinite(length):raise ValueError('zero/nonfinite normalization')
    return [x/length for x in v]
def basis(n):
    n=unit(n);axis=min(range(3),key=lambda k:abs(n[k]));a=[0.,0.,0.];a[axis]=1.
    u=unit(vfcross(n,a));return u,vfcross(n,u)

def ceil_radius(center,points):
    c=E.point(center);m=max(E.norm2(E.sub(E.point(p),c)) for p in points);ease=Q(1,40)
    def covers(r):
        d=Q(r)-ease
        return d>=0 and d*d>=m
    r=math.sqrt(float(m))+.025;steps=0
    while not covers(r):
        r=math.nextafter(r,math.inf);steps+=1
        if steps>16:raise ValueError('radius rounding bound')
    while covers(math.nextafter(r,-math.inf)):
        r=math.nextafter(r,-math.inf);steps+=1
        if steps>16:raise ValueError('radius rounding bound')
    if not math.isfinite(r):raise ValueError('nonfinite radius')
    return r,{'maximumCornerDistanceSquared':m,'radiusSquaredCheck':(Q(r)-ease)**2,'roundingSteps':steps}

def fragments_and_primitives(ledger,part,artist):
    if len(ledger['owners'])!=9 or len(part['owners'])!=9:raise ValueError('owner count')
    fragments=[];counts=[];primitives=[]
    for owner,p in zip(ledger['owners'],part['owners']):
        if any(owner[k]!=p[k] for k in ('uuid','key','name')):raise ValueError('owner identity')
        n=len(owner['triangles'])
        ids=p['required']+list(itertools.chain.from_iterable(p['exposed'].values()))+[c['id'] for c in p['cut']]+p['degenerate']
        if p['sourceTriangles']!=n or sorted(ids)!=list(range(n)):raise ValueError('all original IDs')
        rows=[(tid,[[1.,0.,0.],[0.,1.,0.],[0.,0.,1.]]) for tid in p['required']]
        rows.extend((c['id'],c['required']) for c in p['cut'] if c['required'])
        for tid,barys in rows:
            corners=[owner['worldPositions'][j] for j in owner['triangles'][tid]]
            ps=[[(0.+b[0]*corners[0][k]+b[1]*corners[1][k])+b[2]*corners[2][k] for k in range(3)] for b in barys]
            if len(ps)<3 or not all(math.isfinite(x) for v in ps for x in v):raise ValueError('invalid required polygon')
            c=mean(ps);rad,witness=ceil_radius(c,ps)
            key=(0,owner['uuid'],tid,0);frag={'key':key,'owner':owner['uuid'],'triangleID':tid,'ordinal':0,'barycentric':barys,'points':ps}
            fragments.append(frag)
            primitives.append({'kind':'ball','key':key,'center':c,'radius':rad,'centerBox':(c,c),'split':c,'boundWitness':witness})
        counts.append({'uuid':owner['uuid'],'originalTriangles':n,'requiredPolygons':len(rows),'wholeRequired':len(p['required']),'cutRequired':len(rows)-len(p['required'])})
        if owner['key']=='bra' and (len(p['required'])!=22090 or p['cut'] or any(p['exposed'].values())):raise ValueError('all bra responsibility')
    if sum(row['originalTriangles'] for row in counts)!=71512:raise ValueError('complete original count')
    for i,c in enumerate(artist['capsules']):
        a,b=c['a'],c['b'];rad=c['radius'];lo=[min(a[k],b[k]) for k in range(3)];hi=[max(a[k],b[k]) for k in range(3)]
        if not rad>0 or a==b:raise ValueError('capsule radius/length')
        primitives.append({'kind':'capsule','key':(1,i,c['id']),'a':a,'b':b,'radius':rad,'centerBox':(lo,hi),'split':mean([a,b])})
    primitives.sort(key=lambda p:p['key'])
    if any(not math.isfinite(x) or abs(x)>3 for p in primitives for v in p['centerBox'] for x in v):raise ValueError('primitive coordinate extent')
    if any(not math.isfinite(p['radius']) or not 0<p['radius']<=3 for p in primitives):raise ValueError('primitive radius extent')
    caps=[p for p in primitives if p['kind']=='capsule'];edges=[]
    for i,a in enumerate(caps):
        for j in range(i+1,len(caps)):
            b=caps[j];d,s,t=E.segment_segment2(E.point(a['a']),E.point(a['b']),E.point(b['a']),E.point(b['b']))
            if d<(Q(a['radius'])+Q(b['radius']))**2:edges.append((i,j,d,s,t))
    seen={0}
    while True:
        before=set(seen)
        for i,j,*rest in edges:
            if i in seen or j in seen:seen.update((i,j))
        if seen==before:break
    if len(caps)!=7 or len(seen)!=7:raise ValueError('interior fill disconnected')
    return fragments,primitives,{'owners':counts,'capsuleOverlapEdges':edges}

def grid_field(primitives,artist,progress):
    h=artist['gridMetres'];pad=artist['domainPaddingCells']
    lo=[min(p['centerBox'][0][k]-p['radius'] for p in primitives) for k in range(3)]
    hi=[max(p['centerBox'][1][k]+p['radius'] for p in primitives) for k in range(3)]
    L=[math.floor(x/h)-pad for x in lo];H=[math.ceil(x/h)+pad for x in hi]
    dims=[H[k]-L[k]+1 for k in range(3)];N=math.prod(dims);cells=math.prod(x-1 for x in dims)
    if N>artist['maximumGridVertices'] or cells>artist['maximumGridCells']:raise ValueError({'gridLimit':{'vertices':N,'cells':cells,'L':L,'H':H}})
    if any(abs(i*h)>3 for i in L+H):raise ValueError('grid coordinate extent')
    nodes=S.primitive_tree(primitives);values=array.array('d',[math.inf])*N;winners=array.array('I',[2**32-1])*N;visits=array.array('I',[0])*N
    meta={'spacing':h,'L':L,'H':H,'dimensions':dims,'vertices':N,'cells':cells,'primitiveBounds':(lo,hi),'primitiveTreeNodes':len(nodes),'complete':False,'completedNodes':0}
    progress('grid-start',meta,values,winners,visits)
    nx,ny,nz=dims;i=0
    for iz in range(nz):
        for iy in range(ny):
            for ix in range(nx):
                q=[(L[0]+ix)*h,(L[1]+iy)*h,(L[2]+iz)*h]
                f,w,v=S.primitive_value(q,primitives,nodes)
                values[i],winners[i],visits[i]=f,w,v;meta['completedNodes']=i+1
                if abs(f)<=artist['fieldZeroRefusalMetres']:progress('grid-zero-refusal',meta,values,winners,visits);raise ValueError({'zeroNode':i,'point':q,'F':f,'primitive':w})
                if (ix in (0,nx-1) or iy in (0,ny-1) or iz in (0,nz-1)) and f<=artist['fieldZeroRefusalMetres']:
                    progress('grid-boundary-refusal',meta,values,winners,visits);raise ValueError({'boundaryNode':i,'point':q,'F':f})
                i+=1
                if i%10000==0:progress('grid-progress',meta,None,None,None)
    meta['complete']=True;progress('grid-complete',meta,values,winners,visits)
    return values,meta

def extract(values,grid,artist,progress):
    L=grid['L'];nx,ny,nz=grid['dimensions'];h=grid['spacing']
    def gid(x,y,z):return x+nx*y+nx*ny*z
    def position(i):
        z,i=divmod(i,nx*ny);y,x=divmod(i,nx)
        return [(L[0]+x)*h,(L[1]+y)*h,(L[2]+z)*h]
    cache={};verts=[];provenance=[];faces=[];faceOwners=[]
    for z in range(nz-1):
        for y in range(ny-1):
            for x in range(nx-1):
                corners=[gid(x+dx,y+dy,z+dz) for dz in (0,1) for dy in (0,1) for dx in (0,1)]
                fcs=[values[j] for j in corners]
                if all(v>0 for v in fcs) or all(v<0 for v in fcs):continue
                for perm in itertools.permutations(range(3)):
                    xyz=[x,y,z];ids=[gid(*xyz)]
                    for axis in perm:xyz[axis]+=1;ids.append(gid(*xyz))
                    fs=[values[j] for j in ids]
                    if all(v>0 for v in fs) or all(v<0 for v in fs):continue
                    points=[position(j) for j in ids];edges=[]
                    for a,b in itertools.combinations(range(4),2):
                        if fs[a]*fs[b]>=0:continue
                        key=tuple(sorted((ids[a],ids[b])))
                        if key not in cache:
                            t=values[key[0]]/(values[key[0]]-values[key[1]])
                            if not 0<t<1 or not math.isfinite(t):raise ValueError({'interpolation':key,'t':t})
                            A,B=position(key[0]),position(key[1]);p=[A[k]+t*(B[k]-A[k]) for k in range(3)]
                            cache[key]=len(verts);verts.append(p);provenance.append({'gridEdge':key,'t':t})
                        edges.append(cache[key])
                    if len(set(edges)) not in (3,4):raise ValueError('tetrahedral crossing count')
                    u,v,w=[vfsub(points[k],points[0]) for k in (1,2,3)]
                    cvw,cwu,cuv=vfcross(v,w),vfcross(w,u),vfcross(u,v);det=vfdot(u,cvw)
                    if not det:raise ValueError('singular tetrahedron')
                    grad=[sum((fs[k+1]-fs[0])*basisVec[j] for k,basisVec in enumerate((cvw,cwu,cuv)))/det for j in range(3)]
                    U,V=basis(grad);c=mean([verts[j] for j in edges])
                    edges.sort(key=lambda j:(math.atan2(vfdot(vfsub(verts[j],c),V),vfdot(vfsub(verts[j],c),U)),provenance[j]['gridEdge']))
                    start=min(range(len(edges)),key=lambda j:provenance[edges[j]]['gridEdge']);edges=edges[start:]+edges[:start]
                    dot=vfdot(vfcross(vfsub(verts[edges[1]],verts[edges[0]]),vfsub(verts[edges[2]],verts[edges[0]])),grad)
                    if dot==0 or not math.isfinite(dot):raise ValueError('undefined surface winding')
                    if dot<0:edges=[edges[0]]+list(reversed(edges[1:]))
                    for j in range(1,len(edges)-1):
                        f=(edges[0],edges[j],edges[j+1])
                        if vfdot(vfcross(vfsub(verts[f[1]],verts[f[0]]),vfsub(verts[f[2]],verts[f[0]])),grad)<=0:raise ValueError({'gradientWinding':f,'tet':ids})
                        faces.append(f);faceOwners.append({'cube':[x,y,z],'axes':perm,'gridTet':ids})
                        if len(faces)>artist['maximumMeshTriangles']:raise ValueError('triangle count limit')
            if (y+z*ny)%100==0:progress('extraction-progress',{'vertices':len(verts),'faces':len(faces),'row':[y,z]})
    return {'vertices':verts,'faces':faces,'vertexProvenance':provenance,'faceProvenance':faceOwners}

def cut_surface(mesh,planes,artist):
    verts=[list(v) for v in mesh['vertices']];provenance=[dict(v) for v in mesh['vertexProvenance']]
    tags=[set() for v in verts];polys=[(list(f),i) for i,f in enumerate(mesh['faces'])];edgeRoles={};crossings={}
    shifted=[]
    for plane in planes:
        name,n,o=plane['name'],plane['normal'],plane['origin'];out=artist['garmentOpeningOutwardMetres']
        shifted.append({'name':name,'normal':n,'originalOrigin':o,'origin':[o[k]-out*n[k] for k in range(3)],'outward':out})
        def distance(i):return vfdot(n,vfsub(verts[i],o))+out
        newpolys=[]
        for poly,owner in polys:
            result=[]
            for j,a in enumerate(poly):
                b=poly[(j+1)%len(poly)];da,db=distance(a),distance(b)
                if da==0:tags[a].add(name)
                if db==0:tags[b].add(name)
                if da>=0:result.append(a)
                if da*db<0:
                    key=(name,)+tuple(sorted((a,b)))
                    if key not in crossings:
                        low,high=key[1:];dl,dh=distance(low),distance(high);t=dl/(dl-dh)
                        if not 0<t<1:raise ValueError({'cutInterpolation':key,'t':t})
                        p=[verts[low][k]+t*(verts[high][k]-verts[low][k]) for k in range(3)]
                        crossings[key]=len(verts);verts.append(p);tags.append({name}|(tags[low]&tags[high]));provenance.append({'cutPlane':name,'parents':[low,high],'t':t})
                    result.append(crossings[key])
            clean=[]
            for i in result:
                if not clean or clean[-1]!=i:clean.append(i)
            if len(clean)>1 and clean[0]==clean[-1]:clean.pop()
            if len(clean)<3:continue
            if not any(E.area2(tuple(E.point(verts[i]) for i in (clean[0],clean[j],clean[j+1])))>0 for j in range(1,len(clean)-1)):continue
            for j,a in enumerate(clean):
                b=clean[(j+1)%len(clean)]
                for inheritedRole in tags[a]&tags[b]:edgeRoles.setdefault(tuple(sorted((a,b))),set()).add(inheritedRole)
            newpolys.append((clean,owner))
        polys=newpolys
    faces=[];owners=[]
    for poly,owner in polys:
        for j in range(1,len(poly)-1):
            faces.append((poly[0],poly[j],poly[j+1]));owners.append({'extractedFace':owner,'cutPolygon':poly})
    # Candidate-only sorted compaction preserves original pool IDs/provenance; source IDs untouched.
    used=sorted({i for f in faces for i in f});mapping={old:new for new,old in enumerate(used)}
    result={'vertices':[verts[j] for j in used],'faces':[tuple(mapping[i] for i in f) for f in faces],
            'vertexProvenance':[provenance[j] for j in used],'faceProvenance':owners,'poolUsedIDs':used,
            'vertexPlaneRoles':[sorted(tags[j]) for j in used],
            'proceduralEdgeRoles':[(tuple(mapping[x] for x in key),sorted(role)) for key,role in sorted(edgeRoles.items()) if all(x in mapping for x in key)],
            'planes':shifted,'originalPoolVertexCount':len(verts),'retainedPolygons':len(polys),
            'fullCutPoolVertices':verts,'fullCutPoolProvenance':provenance,'fullCutPoolRoles':[sorted(t) for t in tags]}
    if len(faces)>artist['maximumMeshTriangles']:raise ValueError('postcut triangle limit')
    return result

def caps(mesh,loops,artist):
    verts=[list(p) for p in mesh['vertices']];faces=[tuple(f) for f in mesh['faces']];capRows=[]
    planeMap={p['name']:p for p in mesh['planes']}
    for role,loop in loops.items():
        plane=planeMap[role];n,o=plane['normal'],plane['origin'];center=mean([verts[j] for j in loop]);U,V=basis(n)
        ps=[[vfdot(vfsub(verts[j],o),U),vfdot(vfsub(verts[j],o),V)] for j in loop];cp=[vfdot(vfsub(center,o),U),vfdot(vfsub(center,o),V)]
        allpoints=[center]+[verts[j] for j in loop]
        if max(abs(vfdot(n,vfsub(p,o))) for p in allpoints)>artist['tracePlaneMetres']:raise ValueError({'capPlane':role})
        c=len(verts);verts.append(center);start=len(faces)
        for j,a in enumerate(loop):faces.append((loop[(j+1)%len(loop)],a,c))
        capRows.append({'role':role,'loop':loop,'centerID':c,'triangleIDs':list(range(start,len(faces))),'basisU':U,'basisV':V,'projectedLoop':ps,'projectedCenter':cp})
    return {'vertices':verts,'faces':faces,'caps':capRows,'physicalFaceCount':len(mesh['faces'])}
