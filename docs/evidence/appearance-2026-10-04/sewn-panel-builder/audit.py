"""Whole saved-domain acceptance predicates. No geometry evaluation at import."""
import math
from fractions import Fraction as Q
import exact as E
import spatial as S
import panel as F

def require(test,witness):
    if not test:raise ValueError(witness)

def topology(mesh,closed,euler):
    vertices=mesh['vertices'];faces=mesh['faces'];points=[E.point(p) for p in vertices]
    require(bool(faces),'empty surface')
    require(all(math.isfinite(x) for p in vertices for x in p),'nonfinite surface')
    used=set();edges={};faceKeys=set();links=[{} for p in points];minarea=None;areas=[]
    for fi,f in enumerate(faces):
        require(len(f)==3 and len(set(f))==3 and all(0<=i<len(points) for i in f),{'indices':fi,'face':f})
        key=tuple(sorted(f));require(key not in faceKeys,{'duplicateFace':fi});faceKeys.add(key);used.update(f)
        tri=tuple(points[i] for i in f);a2=E.area2(tri)
        require(a2>0,{'areaFace':fi,'squaredCross':a2,'points':tri})
        if minarea is None or a2<minarea[0]:minarea=(a2,fi)
        areas.append(math.sqrt(float(a2))/2)
        for j,v in enumerate(f):
            x,y=f[(j+1)%3],f[(j+2)%3]
            links[v].setdefault(x,set()).add(y);links[v].setdefault(y,set()).add(x)
            a,b=v,x;edges.setdefault(tuple(sorted((a,b))),[]).append((a,b,fi))
    require(used==set(range(len(points))),{'unusedVertices':sorted(set(range(len(points)))-used)})
    neighbors=[set() for f in faces];boundary=[]
    for edge,rows in edges.items():
        require(len(rows) in ((2,) if closed else (1,2)),{'edgeIncidence':edge,'rows':rows})
        if len(rows)==2:
            a,b=rows;require(a[0]==b[1] and a[1]==b[0],{'edgeWinding':edge,'rows':rows})
            neighbors[a[2]].add(b[2]);neighbors[b[2]].add(a[2])
        else:boundary.append(rows[0][:2])
    seen={0};stack=[0]
    while stack:
        for j in neighbors[stack.pop()]:
            if j not in seen:seen.add(j);stack.append(j)
    require(len(seen)==len(faces),{'multipleComponents':len(faces)-len(seen),'firstUnseen':next((j for j in range(len(faces)) if j not in seen),None)})
    boundaryVertices={v for edge in boundary for v in edge}
    for v,graph in enumerate(links):
        require(bool(graph),{'emptyVertexLink':v})
        reached={next(iter(graph))};stack=list(reached)
        while stack:
            for j in graph[stack.pop()]:
                if j not in reached:reached.add(j);stack.append(j)
        deg=[len(ns) for ns in graph.values()]
        wanted=sorted(deg)==[1,1]+[2]*(len(deg)-2) if v in boundaryVertices else all(d==2 for d in deg)
        require(len(reached)==len(graph) and wanted,{'vertexLink':v,'degrees':deg,'connected':len(reached)==len(graph)})
    chi=len(points)-len(edges)+len(faces);require(chi==euler,{'Euler':chi,'expected':euler,'V':len(points),'E':len(edges),'F':len(faces)})
    volume=sum((E.dot(points[f[0]],E.cross(points[f[1]],points[f[2]])) for f in faces),Q(0))/6
    if closed:require(volume>0,{'signedVolume':volume})
    return {'vertices':len(points),'edges':len(edges),'faces':len(faces),'Euler':chi,'closed':closed,'boundaryEdges':boundary,'signedVolumeObserver':volume,'minimumSquaredCross':minarea,'totalAreaSquareMetresObserver':math.fsum(areas)},points

def projected_caps(capped):
    for row in capped['caps']:
        ps=[tuple(Q(x) for x in p) for p in row['projectedLoop']];c=tuple(Q(x) for x in row['projectedCenter']);n=len(ps)
        signs=[E.orient2(c,ps[j],ps[(j+1)%n]) for j in range(n)]
        require(all(x>0 for x in signs) or all(x<0 for x in signs),{'nonStarCap':row['role'],'areas':signs})
        lift=lambda p:(p[0],p[1],Q(0))
        for i in range(n):
            for j in range(i+1,n):
                if j in ((i+1)%n,(i-1)%n):continue
                d,*w=E.segment_segment2(lift(ps[i]),lift(ps[(i+1)%n]),lift(ps[j]),lift(ps[(j+1)%n]))
                require(d>0,{'capLoopCrossing':row['role'],'edges':[i,j]})
        tris=[(lift(c),lift(ps[i]),lift(ps[(i+1)%n])) for i in range(n)]
        for i in range(n):
            for j in range(i+1,n):
                shared=[lift(c)]
                for p in (ps[i],ps[(i+1)%n]):
                    if p in (ps[j],ps[(j+1)%n]):shared.append(lift(p))
                inter=E.triangle_intersection(tris[i],tris[j])
                require(all(E.within_simplex(p,shared) for p in inter),{'capFanOverlap':row['role'],'faces':[i,j],'intersection':inter})

def self_intersections(mesh,points,progress):
    tris=[tuple(points[i] for i in f) for f in mesh['faces']];nodes,boxes=S.triangle_tree(tris);pairs=0
    for i,t in enumerate(tris):
        for j in S.overlap_ids(nodes,boxes[i]):
            if j<=i or not E.boxes_overlap(boxes[i],boxes[j]):continue
            sharedIDs=sorted(set(mesh['faces'][i])&set(mesh['faces'][j]));shared=[points[k] for k in sharedIDs]
            inter=E.triangle_intersection(t,tris[j]);pairs+=1
            require((not inter and not shared) or (bool(inter) and all(E.within_simplex(p,shared) for p in inter)),
                    {'selfIntersection':(i,j),'sharedIDs':sharedIDs,'intersection':inter,'triangles':(t,tris[j])})
        if i%1000==0:progress('self-intersection-progress',{'facesCompleted':i+1,'pairs':pairs})
    return tris,nodes,boxes,{'candidatePairs':pairs,'allFaces':len(tris),'unallowedIntersections':0}

def opening_loops(mesh,boundary):
    outgoing={};incoming={}
    for a,b in boundary:
        require(a not in outgoing and b not in incoming,{'boundaryBranch':(a,b)})
        outgoing[a]=b;incoming[b]=a
    require(set(outgoing)==set(incoming),'boundary endpoints mismatch')
    roleRows=mesh['proceduralEdgeRoles'];roles={tuple(edge):set(names) for edge,names in roleRows}
    require(len(roles)==len(roleRows)==22 and set(roles)=={tuple(sorted(edge)) for edge in boundary},'complete literal boundary roles')
    remaining=set(outgoing);loops={};planes={p['name']:p for p in mesh['planes']}
    while remaining:
        start=min(remaining);v=start;loop=[]
        while v not in loop:
            require(v in remaining,{'mergedLoop':v});loop.append(v);remaining.remove(v);v=outgoing[v]
        require(v==start and len(loop)>=3,{'invalidLoop':loop});names=[]
        for k,a in enumerate(loop):
            tags=roles[tuple(sorted((a,loop[(k+1)%len(loop)])))]
            require(len(tags)==1,{'boundaryRole':a,'tags':tags});names.append(next(iter(tags)))
        require(len(set(names))==1,{'mixedOpening':names});role=names[0]
        require(role not in loops and role in planes,{'openingRole':role})
        require(loop==mesh['declaredLoops'][role],{'literalCycle':role,'actual':loop,'declared':mesh['declaredLoops'][role]})
        plane=planes[role];n,o=E.point(plane['normal']),E.point(plane['origin']);n2=E.norm2(n)
        require(n2>0,'plane normal')
        for i in loop:
            dot=E.dot(n,E.sub(E.point(mesh['vertices'][i]),o))
            require(dot*dot<=Q(1,10**10)**2*n2,{'openingPlane':role,'vertex':i,'signedDot':dot,'normalSquared':n2})
        loops[role]=loop
    require(set(loops)=={'neck','hem','cuff_l','cuff_r'},'four loops')
    return loops

def full_fragments(fragments,physical,capped,cappedPoints,progress):
    ppoints=[E.point(p) for p in physical['vertices']]
    ptris=[tuple(ppoints[i] for i in face) for face in physical['faces']];ptree,pboxes=S.triangle_tree(ptris)
    ctris=[tuple(cappedPoints[i] for i in face) for face in capped['faces']];ctree,cboxes=S.triangle_tree(ctris)
    capIDs=list(range(len(physical['faces']),len(capped['faces'])));captris=[ctris[i] for i in capIDs]
    captree,capboxes=S.triangle_tree(captris)
    directions=[F.unit([1.,math.sqrt(2.),math.sqrt(3.)]),F.unit([math.sqrt(3.),1.,math.sqrt(2.)]),F.unit([math.sqrt(2.),math.sqrt(3.),1.])]
    progress('ray-operands',{'directions':directions,'formulas':'three fixed binary64 normalized formulas saved before rays; exact rational origin/direction/mesh operands','capFaceIDs':capIDs})
    qs=[E.point(d) for d in directions];gate=Q(1,100)**2;capGate=Q(3,200)-Q(1,10**12)
    seen=set();fanCount=0
    for index,frag in enumerate(fragments):
        key=tuple(frag['key']);require(key not in seen,{'duplicateFragment':key})
        ps=[E.point(p) for p in frag['points']];row={'key':key,'sourceFan':[],'capPlaneDistances':[],'classification':[]}
        for plane in physical['planes']:
            n,o=E.point(plane['normal']),E.point(plane['origin']);n2=E.norm2(n);require(n2>0,'cap normal')
            distances=[E.dot(n,E.sub(p,o)) for p in ps]
            require(all(d>=0 and d*d>=capGate*capGate*n2 for d in distances),{'requiredCapPlane':key,'plane':plane['name'],'signedDots':distances,'normalSquared':n2,'gate':capGate})
            row['capPlaneDistances'].append({'role':plane['name'],'signedDots':distances,'normalSquared':n2,'minimumSquaredDistance':min(d*d/n2 for d in distances)})
        representative=None;repRecord=None
        for j in range(1,len(ps)-1):
            tri=(ps[0],ps[j],ps[j+1]);a2=E.area2(tri)
            if representative is None and a2>0:
                representative=E.mean(tri);repRecord={'fan':j,'corners':[0,j,j+1],'cornerRatios':tri,'positiveSquaredCross':a2,'barycentric':[Q(1,3)]*3,'exactOrigin':representative}
            passed,cert=S.clearance_certificate(tri,ptris,ptree,pboxes,gate)
            piece={'corners':[0,j,j+1],'squaredCross':a2,'physicalCertificate':cert};row['sourceFan'].append(piece)
            require(passed,{'physicalClearance':key,'fan':j,'rowPrefix':row,'sourceTriangle':tri})
            disjoint,capcert=S.disjoint_certificate(tri,captris,captree,capboxes);piece['capDisjointCertificate']=capcert
            require(disjoint,{'sourceCapIntersection':key,'fan':j,'rowPrefix':row,'sourceTriangle':tri,'capFaceIDs':capIDs})
        require(representative is not None,{'noPositiveSourceFan':key,'points':ps})
        row['representative']=repRecord
        for direction in qs:
            try:parity,receipt=S.parity(representative,direction,ctris,ctree,cboxes)
            except ValueError as error:
                raise ValueError({'rayAmbiguity':key,'direction':direction,'rowPrefix':row,'inner':error.args}) from error
            require(parity==1,{'outsideFragment':key,'direction':direction,'rowPrefix':row,'receipt':receipt})
            row['classification'].append(receipt)
        seen.add(key);fanCount+=len(row['sourceFan'])
        # Save EVERY completed row, not only a100-row batch, before proceeding.
        progress('fragment-certificate',{'completed':index+1,'total':len(fragments),'lastKey':key},row)
    require(len(seen)==len(fragments),'required fragment omission')
    return {'requiredPolygons':len(seen),'wholeFanPieces':fanCount,'clearanceSquared':gate,'capMinimumMetresWithAllowance':capGate,'threeFixedDirections':directions,'physicalTreeNodes':len(ptree),'cappedTreeNodes':len(ctree),'capFaceIDs':capIDs,'scope':'Complete physical gap plus strict cap disjointness and exact on-domain origin parity; no global-minimum or runtime/appearance claim'}
