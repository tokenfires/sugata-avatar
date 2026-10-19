"""One separately admitted CPU sweater trial. Definitions alone perform no geometry."""
import collections
import ctypes
from fractions import Fraction as Q
import hashlib
import json
import math
import os
from pathlib import Path
import resource
import sys
import time
import traceback
import types

G = None


class Refusal(Exception):
    def __init__(self, code, **witness):
        super().__init__(code)
        self.code, self.witness = code, witness


class FitFailure(Refusal):
    pass


def require(condition, code, **witness):
    if not condition: raise Refusal(code, **witness)


def plain(value):
    if isinstance(value, Q): return {"numerator": str(value.numerator), "denominator": str(value.denominator)}
    if isinstance(value, dict): return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, (tuple, list)): return [plain(v) for v in value]
    return value


class Budget:
    def __init__(self, deadline):
        self.deadline = deadline
        self.calls = 0
        self.counts = collections.Counter()
        self.peaks = []
        self.maximum_rss = 0
        self.caps = {"solver": 20_000_000, "accept": 20_000_000, "ray": 5_000_000}
        self.observe("startup")

    def observe(self, stage):
        require(time.monotonic() < self.deadline, "wall-limit", stage=stage)
        rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        self.maximum_rss = max(self.maximum_rss, rss)
        if len(self.peaks) < 256: self.peaks.append({"stage": stage, "rawBytes": rss})
        require(rss <= 2*1024**3, "cooperative-rss-limit", stage=stage, rawBytes=rss)

    def tick(self, mode=None):
        self.calls += 1
        if mode:
            self.counts[mode] += 1
            if mode in self.caps:
                require(self.counts[mode] <= self.caps[mode], "predicate-budget", mode=mode, counts=dict(self.counts))
        if self.calls % 128 == 0: self.observe("operation-"+str(mode))


class Output:
    """111MiB child allocation +16MiB streams +1MiB parent reservation =128MiB."""
    def __init__(self, folder, budget):
        self.folder, self.budget, self.bytes = folder, budget, 0
        self.inventory = []

    def write(self, name, value):
        require('/' not in name and name.endswith('.json'), "output-name", name=name)
        self.budget.observe("before-write-"+name)
        path = self.folder/name
        encoder = json.JSONEncoder(separators=(',', ':'), allow_nan=False)
        h, size = hashlib.sha256(), 0
        with path.open('xb') as stream:
            for part in encoder.iterencode(plain(value)):
                data = part.encode()
                require(self.bytes+len(data) <= 111*1024**2, "child-output-allocation")
                stream.write(data)
                h.update(data)
                size += len(data)
                self.bytes += len(data)
                self.budget.tick()
            require(self.bytes+1 <= 111*1024**2, "child-output-allocation")
            stream.write(b'\n'); h.update(b'\n'); size += 1; self.bytes += 1
        self.inventory.append({"name": name, "bytes": size, "sha256": h.hexdigest()})
        self.budget.observe("after-write-"+name)


def pin_check(row):
    p = Path(row['path'])
    require(p.is_file(), "missing-pin", path=str(p))
    require(p.stat().st_size == row['bytes'], "pin-size", path=str(p))
    require(hashlib.sha256(p.read_bytes()).hexdigest() == row['sha256'], "pin-hash", path=str(p))


def runtime_check(runtime, caches, own_paths):
    require(sys.platform == 'darwin' and sys.flags.isolated and sys.flags.no_site and
            sys.flags.dont_write_bytecode and sys.flags.optimize == 0 and sys.pycache_prefix is None,
            "runtime-flags")
    require(str(Path(sys.executable).resolve()) == runtime['executable']['path'] and
            sys.version == runtime['version'] and list(os.uname()) == runtime['uname'], "runtime-identity")
    rows = [runtime['executable']]+runtime['modules']+runtime['nonSystemImages']+caches['cacheFiles']
    for row in rows: pin_check(row)
    for branch in caches['branches']:
        src = Path(branch['source']); directory = src.parent/'__pycache__'
        names = []
        if directory.exists():
            with os.scandir(directory) as entries:
                names = sorted(str(directory/e.name) for e in entries
                               if e.name.startswith(src.stem+'.') and e.name.endswith('.pyc'))
        require(names == sorted(branch['present']), "cache-membership", source=str(src))
        cache_paths = {r['path'] for r in caches['cacheFiles']}
        require(all(str(Path(name).resolve()) in cache_paths for name in names),
                "cache-link-target", source=str(src))
    allowed = {r['path'] for r in rows} | set(own_paths)
    for module in tuple(sys.modules.values()):
        path = getattr(module, '__file__', None)
        if path and not str(path).startswith('<'):
            require(str(Path(path).resolve()) in allowed, "unowned-module", path=str(path))
    lib = ctypes.CDLL(None)
    count = lib._dyld_image_count; count.restype = ctypes.c_uint32
    name = lib._dyld_get_image_name; name.argtypes = [ctypes.c_uint32]; name.restype = ctypes.c_char_p
    n = int(count()); require(n <= 4096, "runtime-image-count")
    expected = {r['path'] for r in runtime['nonSystemImages']}
    native = []
    for i in range(n):
        raw = name(i); require(raw is not None, "missing-image-name")
        path = os.fsdecode(raw)
        if not path.startswith(('/System/', '/usr/lib/')):
            real = str(Path(path).resolve()); require(real in expected, "unowned-native", path=real)
            native.append(real)
    require(len(native) <= 150, "runtime-native-count")
    return {"nonSystemImagePaths": native, "allImageCount": n,
            "systemProvenance": "trusted host OS/shared cache, not independently byte-pinned"}


def construct(artist):
    grids = [artist['torso'][a] for a in ('X', 'Y', 'Z')]
    addresses, faces, face_roles = set(), [], []
    for axis in range(3):
        for sign in (-1, 1):
            constant = 0 if sign < 0 else 6
            for u in range(6):
                for v in range(6):
                    if axis == 1 and sign == -1: continue
                    if axis == 1 and sign == 1 and u in (2,3) and v in (2,3): continue
                    if axis == 0 and u in (3,4) and v in (2,3): continue
                    if axis == 0:
                        q = [(constant,u,v),(constant,u+1,v),(constant,u+1,v+1),(constant,u,v+1)]
                    elif axis == 1:
                        q = [(u,constant,v),(u,constant,v+1),(u+1,constant,v+1),(u+1,constant,v)]
                    else:
                        q = [(u,v,constant),(u+1,v,constant),(u+1,v+1,constant),(u,v+1,constant)]
                    if sign < 0: q = list(reversed(q))
                    faces.append(q); addresses.update(q); face_roles.append('torso')
    ordered = sorted(addresses); ids = {a:i for i,a in enumerate(ordered)}
    p = [tuple(grids[k][a[k]] for k in range(3)) for a in ordered]
    center = tuple((g[0]+g[-1])/2 for g in grids)
    half = tuple((g[-1]-g[0])/2 for g in grids)
    target = []
    for q in p:
        u = tuple((q[k]-center[k])/half[k] for k in range(3)); s = sum(x**4 for x in u)**0.25
        target.append(tuple(center[k]+half[k]*u[k]/s for k in range(3)))
    faces = [[ids[a] for a in q] for q in faces]
    edges = collections.defaultdict(list)
    for fi, q in enumerate(faces):
        for a,b in zip(q,q[1:]+q[:1]): edges[tuple(sorted((a,b)))].append((a,b))
    outgoing = {items[0][0]:items[0][1] for items in edges.values() if len(items)==1}
    require(len(outgoing) == 48, 'base-boundaries')
    loops = {}
    unseen = set(outgoing)
    while unseen:
        start = min(unseen); loop = [start]; nxt = outgoing[start]
        while nxt != start:
            require(nxt not in loop and nxt in outgoing, 'base-loop'); loop.append(nxt); nxt = outgoing[nxt]
        unseen.difference_update(loop)
        aa = [ordered[i] for i in loop]
        role = ('hem' if all(a[1]==0 for a in aa) else 'neck' if all(a[1]==6 for a in aa)
                else 'cuff_l' if all(a[0]==6 for a in aa) else 'cuff_r' if all(a[0]==0 for a in aa) else None)
        require(role is not None and role not in loops, 'base-role'); loops[role] = loop
    final_coarse = {}
    for role in ('neck','hem','cuff_l','cuff_r'):
        spec = artist['outlets'][role]; loop = loops[role]; n = len(loop)
        require(n == artist['topology']['rootLoops'][role], 'loop-length', role=role)
        axis = tuple(spec['rootAxis']); u0=(0.,0.,1.); v0=G.cross(axis,u0)
        root = G.mean([p[i] for i in loop]); delta = G.sub(p[loop[0]],root)
        phase = math.atan2(G.dot(delta,v0),G.dot(delta,u0))
        signed = sum(G.dot(G.cross(G.sub(p[loop[j]],root),G.sub(p[loop[(j+1)%n]],root)),axis) for j in range(n))
        require(signed < 0, 'root-winding', role=role)
        plane = spec['plane']; og = tuple(o-.015*k for o,k in zip(plane['sourceOrigin'],plane['inwardNormal']))
        if role.startswith('cuff'):
            elbow = tuple(spec['elbow']); end=og
            centers=[tuple(spec['rings'][0]['center']),elbow,tuple((a+b)/2 for a,b in zip(elbow,end)),end]
            tangents=[G.unit(G.sub(centers[1],root)),G.unit(G.sub(centers[2],centers[0])),
                      G.unit(G.sub(centers[3],centers[1])),tuple(-x for x in plane['inwardNormal'])]
        else:
            centers=[tuple(r['center']) for r in spec['rings']]; tangents=[axis]*len(centers)
        for ri,(cs,rs,tangent) in enumerate(zip(centers,spec['rings'],tangents)):
            vv=G.cross(axis,tangent); cc=G.dot(axis,tangent)
            require(cc > -1+1e-12, 'frame-antipodal', role=role,ring=ri)
            def rotate(w):
                return G.add(w,G.add(G.cross(vv,w),G.scale(G.cross(vv,G.cross(vv,w)),1/(1+cc))))
            ur,vr=rotate(u0),rotate(v0)
            ring=[]
            for j in range(n):
                theta=phase-2*math.pi*j/n
                q=G.add(cs,G.add(G.scale(ur,rs['radiusU']*math.cos(theta)),G.scale(vr,rs['radiusV']*math.sin(theta))))
                ring.append(len(p));p.append(q);target.append(q)
            for j in range(n):
                k=(j+1)%n;faces.append([loop[k],loop[j],ring[j],ring[k]]);face_roles.append(role+':'+str(ri))
            loop=ring
        final_coarse[role]=loop
    require((len(p),len(faces)) == (326,304),'coarse-count')
    edge_ids = sorted({tuple(sorted((a,b))) for q in faces for a,b in zip(q,q[1:]+q[:1])})
    require(len(edge_ids)==632,'coarse-edge-count')
    mid={}
    for edge in edge_ids:
        mid[edge]=len(p);p.append(G.mean([p[edge[0]],p[edge[1]]]))
        target.append(G.mean([target[edge[0]],target[edge[1]]]))
    quads,roles=[],[]
    for q,role in zip(faces,face_roles):
        f=len(p);p.append(G.mean([p[i] for i in q]));target.append(G.mean([target[i] for i in q]))
        a,b,c,d=q;ab,bc,cd,da=[mid[tuple(sorted(e))] for e in ((a,b),(b,c),(c,d),(d,a))]
        quads.extend([[a,ab,f,da],[ab,b,bc,f],[f,bc,c,cd],[da,f,cd,d]]);roles.extend([role]*4)
    loops={}
    for role,loop in final_coarse.items():
        result=[]
        for j,a in enumerate(loop):result.extend([a,mid[tuple(sorted((a,loop[(j+1)%len(loop)])))]])
        loops[role]=result
    triangles=[];tri_roles=[]
    for q,role in zip(quads,roles):triangles.extend([(q[0],q[1],q[2]),(q[0],q[2],q[3])]);tri_roles.extend([role]*2)
    require((len(p),len(quads),len(triangles))==(1262,1216,2432),'final-count')
    return p,target,triangles,tri_roles,loops


def read_source(ledger, partition, budget):
    require(len(ledger['owners'])==9 and len(partition['owners'])==9,'source-owner-count')
    po={o['uuid']:o for o in partition['owners']}; original=[]; guides=[]; domains=[];inventory=[]
    for owner in ledger['owners']:
        budget.observe('source-owner')
        record=po[owner['uuid']];require((owner['key'],owner['name'])==(record['key'],record['name']),'source-owner-identity')
        points=[tuple(p) for p in owner['worldPositions']];tris=owner['triangles'];nv=len(points);nt=len(tris)
        require(owner['vertexIDs']==list(range(nv)) and owner['triangleIDs']==list(range(nt)),'source-ids')
        require(all(len(p)==3 and all(math.isfinite(x) and abs(x)<=3 for x in p) for p in points),'source-coordinates')
        all_ids=record['required']+sum(record['exposed'].values(),[])+[r['id'] for r in record['cut']]+record['degenerate']
        require(len(all_ids)==nt and sorted(all_ids)==list(range(nt)),'partition-conservation',uuid=owner['uuid'])
        deg=set(record['degenerate']);guides.extend(points)
        for ti,indices in enumerate(tris):
            budget.tick();require(len(indices)==3 and all(isinstance(i,int) and 0<=i<nv for i in indices),'source-index')
            tri=tuple(points[i] for i in indices);qq=tuple(G.rational(p) for p in tri)
            area=G.norm2(G.cross(G.sub(qq[1],qq[0]),G.sub(qq[2],qq[0])))
            require((area==0)==(ti in deg),'source-degenerate',uuid=owner['uuid'],triangle=ti)
            if area:original.append((owner['uuid'],ti,qq))
        def add_domain(ti,bary):
            corners=[];src=[points[i] for i in tris[ti]]
            for b in bary:
                require(len(b)==3 and all(math.isfinite(x) for x in b),'source-barycentric')
                corners.append(tuple((src[0][k]*b[0]+src[1][k]*b[1])+src[2][k]*b[2] for k in range(3)))
            fans=[]
            for j in range(1,len(corners)-1):
                budget.tick();fan=(corners[0],corners[j],corners[j+1]);qt=tuple(G.rational(p) for p in fan)
                require(G.norm2(G.cross(G.sub(qt[1],qt[0]),G.sub(qt[2],qt[0])))>0,'required-fan-degenerate')
                fans.append(fan)
            domains.append({'uuid':owner['uuid'],'triangle':ti,'barycentric':bary,'corners':corners,'fans':fans})
        for ti in record['required']:add_domain(ti,[(1.,0.,0.),(0.,1.,0.),(0.,0.,1.)])
        for cut in record['cut']:add_domain(cut['id'],cut['required'])
        if owner['key']=='bra':require(len(record['required'])==22090 and not record['cut'],'whole-bra-duty')
        inventory.append({'uuid':owner['uuid'],'key':owner['key'],'name':owner['name'],'vertexIDs':owner['vertexIDs'],
            'triangleIDs':owner['triangleIDs'],'requiredIDs':record['required'],'exposedIDs':record['exposed'],
            'cutIDs':[r['id'] for r in record['cut']],'degenerateIDs':record['degenerate']})
    require(len(guides)==39546 and sum(len(o['triangleIDs']) for o in inventory)==71512,'source-total')
    corners=[(d['uuid'],d['triangle'],fi,ci,q) for d in domains for fi,fan in enumerate(d['fans']) for ci,q in enumerate(fan)]
    require(len(corners)<=200000 and len(guides)<=50000,'guide-count-cap')
    return original,guides,domains,corners,inventory


def solve(p,target,faces,loops,corners,guides,budget,out):
    fixed={i for loop in loops.values() for i in loop};w=[0 if i in fixed else 1 for i in range(len(p))]
    edges=sorted({tuple(sorted((a,b))) for t in faces for a,b in zip(t,t[1:]+t[:1])})
    neighbors=[set() for _ in p]
    for a,b in edges:neighbors[a].add(b);neighbors[b].add(a)
    neighbors=[sorted(s) for s in neighbors]
    lengths=[math.sqrt(G.norm2(G.sub(target[a],target[b]))) for a,b in edges]
    rest=[G.sub(target[i],G.mean([target[j] for j in js])) for i,js in enumerate(neighbors)]
    history=[]
    for stage,target_gain in enumerate((.005,.01,.02)):
        for sweep in range(8):
            budget.observe('sweep-start');bvh=G.BVH([tuple(p[i] for i in t) for t in faces])
            normals=[G.unit(G.cross(G.sub(p[t[1]],p[t[0]]),G.sub(p[t[2]],p[t[0]]))) for t in faces]
            sums=[[0.,0.,0.] for _ in p];counts=[0]*len(p);obj=collections.Counter();residual=collections.Counter();active=collections.Counter()
            def constraint(family,c,gradients,gain,inequality=False):
                budget.tick();require(math.isfinite(c),'nonfinite-constraint',family=family)
                value=min(0.,c) if inequality else c;obj[family]+=gain*value*value;residual[family]=max(residual[family],abs(value))
                if inequality and c>=0:return
                denom=sum(w[i]*G.norm2(g) for i,g in gradients)
                if denom==0:
                    require(c==0,'fixed-constraint-conflict',family=family,value=c,vertices=[i for i,g in gradients]);return
                require(math.isfinite(denom) and denom>0,'constraint-denominator',family=family)
                active[family]+=1
                for i,g in gradients:
                    if not w[i] or G.norm2(g)==0:continue
                    correction=G.scale(g,-gain*c*w[i]/denom)
                    require(all(math.isfinite(x) for x in correction),'nonfinite-correction')
                    for k in range(3):sums[i][k]+=correction[k]
                    counts[i]+=1
            for i in range(len(p)):
                if w[i]:
                    for k in range(3):constraint('target',p[i][k]-target[i][k],[(i,tuple(1. if j==k else 0. for j in range(3)))],target_gain)
            for (a,b),length in zip(edges,lengths):
                v=G.sub(p[a],p[b]);n=math.sqrt(G.norm2(v));require(n>0 and length>0,'zero-edge')
                u=G.scale(v,1/n);constraint('edge',n-length,[(a,u),(b,G.scale(u,-1))],.25)
            for i,js in enumerate(neighbors):
                delta=G.sub(G.sub(p[i],G.mean([p[j] for j in js])),rest[i])
                for k in range(3):
                    axis=tuple(1. if j==k else 0. for j in range(3))
                    constraint('differential',delta[k],[(i,axis)]+[(j,G.scale(axis,-1/len(js))) for j in js],.10)
            contacts=[];two_sided=[]
            for corner_id,(uuid,tid,fan,corner,q) in enumerate(corners):
                budget.tick('guide');d2,fi,feature,cp,beta=bvh.nearest(q,budget.tick);n=normals[fi]
                c=G.dot(n,G.sub(cp,q))-.015
                if c<0:contacts.append([corner_id,fi,feature,c])
                constraint('required',c,[(i,G.scale(n,b)) for i,b in zip(faces[fi],beta)],.90,True)
            for qi,q in enumerate(guides):
                budget.tick('guide');d2,fi,feature,cp,beta=bvh.nearest(q,budget.tick);d=math.sqrt(d2)
                if d<.015:
                    require(d>0,'zero-point-gap',point=qi,face=fi);n=G.scale(G.sub(cp,q),1/d)
                    two_sided.append([qi,fi,feature,d-.015])
                    constraint('two-sided',d-.015,[(i,G.scale(n,b)) for i,b in zip(faces[fi],beta)],.90,True)
            updated=list(p);maximum=0.
            for i in range(len(p)):
                if not w[i]:continue
                step=G.scale(sums[i],.5/max(1,counts[i]));length=math.sqrt(G.norm2(step))
                if length>.005:step=G.scale(step,.005/length);length=.005
                updated[i]=G.add(p[i],step);maximum=max(maximum,length)
                require(all(math.isfinite(x) and abs(x)<=3 for x in updated[i]),'iteration-coordinate-bounds')
            p=updated
            record={'stage':stage,'sweep':sweep,'objectiveByFamily':dict(obj),'maxResidualByFamily':dict(residual),
                'activeByFamily':dict(active),'largestStep':maximum,'correctionCounts':counts,'requiredContactIdentities':contacts,
                'twoSidedContactIdentities':two_sided,
                'counts':dict(budget.counts)}
            out.write('sweep-%02d.json'%(stage*8+sweep),record);history.append({k:v for k,v in record.items()
                if k not in ('requiredContactIdentities','twoSidedContactIdentities')})
            budget.observe('sweep-end')
    return p,history


def connected(adjacency):
    if not adjacency:return False
    seen=set();queue=[next(iter(adjacency))]
    while queue:
        i=queue.pop()
        if i in seen:continue
        seen.add(i);queue.extend(adjacency[i]-seen)
    return len(seen)==len(adjacency)


def structure(positions,faces,expected_loops,budget,closed=False,physical_count=None):
    edge_users=collections.defaultdict(list);links=[collections.defaultdict(set) for _ in positions]
    used=set();seen_faces=set();triangles=[]
    for fi,t in enumerate(faces):
        budget.tick();require(len(t)==3 and len(set(t))==3 and all(0<=i<len(positions) for i in t),'face-indices',face=fi)
        key=tuple(sorted(t));require(key not in seen_faces,'duplicate-face',face=fi);seen_faces.add(key);used.update(t)
        tri=tuple(positions[i] for i in t);area=G.norm2(G.cross(G.sub(tri[1],tri[0]),G.sub(tri[2],tri[0])))
        threshold=Q(0) if physical_count is not None and fi>=physical_count else Q(4,10**36)
        require(area>threshold,'surface-area',face=fi,squaredCross=area);triangles.append(tri)
        for j,i in enumerate(t):
            a,b=t[(j+1)%3],t[(j+2)%3];links[i][a].add(b);links[i][b].add(a)
        for a,b in zip(t,t[1:]+t[:1]):edge_users[tuple(sorted((a,b)))].append((fi,a,b))
    require(used==set(range(len(positions))),'unused-position')
    face_graph={i:set() for i in range(len(faces))};boundary=[]
    for edge,owners in edge_users.items():
        require(len(owners) in (1,2),'nonmanifold-edge',edge=edge,owners=owners)
        if len(owners)==1:boundary.append(owners[0][1:])
        else:
            a,b=owners;require(a[1:]==(b[2],b[1]),'edge-winding',edge=edge)
            face_graph[a[0]].add(b[0]);face_graph[b[0]].add(a[0])
    require(connected(face_graph),'surface-components')
    actual_edges={tuple(sorted(e)) for e in boundary}
    expected_edges={tuple(sorted((loop[j],loop[(j+1)%len(loop)]))) for loop in expected_loops.values() for j in range(len(loop))}
    require(actual_edges==expected_edges,'boundary-ownership')
    outgoing={};incoming=collections.Counter()
    for a,b in boundary:
        require(a not in outgoing,'boundary-branch',vertex=a);outgoing[a]=b;incoming[b]+=1
    require(all(incoming[i]==1 for i in outgoing),'boundary-incoming')
    actual_loops=[];unseen=set(outgoing)
    while unseen:
        a=min(unseen);loop=[a];b=outgoing[a]
        while b!=a:
            require(b in outgoing and b not in loop,'boundary-loop');loop.append(b);b=outgoing[b]
        unseen.difference_update(loop);actual_loops.append(loop)
    if closed:require(not actual_loops and len(positions)-len(edge_users)+len(faces)==2,'closed-euler')
    else:
        require(len(actual_loops)==4 and len(positions)-len(edge_users)+len(faces)==-2,'physical-euler')
        for role,loop in expected_loops.items():
            require(any(set(loop)==set(a) for a in actual_loops),'missing-role-loop',role=role)
            require(all(outgoing[loop[j]]==loop[(j+1)%len(loop)] for j in range(len(loop))),'role-winding',role=role)
    boundary_vertices=set(outgoing)
    for i,link in enumerate(links):
        budget.tick();require(connected(link),'vertex-link-components',vertex=i)
        degrees=[len(v) for v in link.values()]
        if i in boundary_vertices:require(degrees.count(1)==2 and all(d in (1,2) for d in degrees),'boundary-link',vertex=i)
        else:require(all(d==2 for d in degrees),'interior-link',vertex=i)
    return triangles,{'V':len(positions),'E':len(edge_users),'F':len(faces),'boundaryEdges':len(boundary),'loops':actual_loops}


def embedding(positions,faces,triangles,budget):
    tree=G.BVH(triangles);tested=0
    for i,tri in enumerate(triangles):
        budget.tick()
        for j in tree.overlap_candidates(tree.boxes[i]):
            if j<=i:continue
            budget.tick('accept');tested+=1
            hits=G.triangle_intersection_points(tri,triangles[j]);shared=sorted(set(faces[i])&set(faces[j]))
            if not hits:continue
            allowed=(bool(shared) and all(h==positions[shared[0]] for h in hits) if len(shared)==1 else
                     all(G.on_segment3(h,positions[shared[0]],positions[shared[1]]) for h in hits) if len(shared)==2 else False)
            require(allowed,'self-embedding',faces=[i,j],shared=shared,intersection=hits)
    return tree,{'evaluatedPairs':tested,'prunedByExactAABBDisjointness':len(triangles)*(len(triangles)-1)//2-tested}


def capped_surface(p,faces,loops,artist,budget):
    positions=[G.rational(q) for q in p];all_faces=list(faces);cap_ids={};capplanes={};cap_projection_checks=0
    for role,loop in loops.items():
        spec=artist['outlets'][role]['plane'];n=G.rational(spec['inwardNormal'])
        og=G.rational(tuple(o-.015*k for o,k in zip(spec['sourceOrigin'],spec['inwardNormal'])))
        n2=G.norm2(n);require(n2>0,'cap-normal')
        for i in loop:
            num=G.dot(n,G.sub(positions[i],og))
            require(num*num<=Q(1e-12)**2*n2,'fixed-plane-residual',role=role,vertex=i,numerator=num)
        axis=max(range(3),key=lambda k:(abs(n[k]),-k));outward=G.scale(n,-1)
        factor=outward[axis]*((-1)**axis);center=G.mean([positions[i] for i in loop])
        p2=[G.project2(positions[i],axis) for i in loop];mean2=G.project2(center,axis)
        signed=sum(p2[j][0]*p2[(j+1)%len(loop)][1]-p2[j][1]*p2[(j+1)%len(loop)][0] for j in range(len(loop)))
        require(signed*factor<0,'projected-loop-winding',role=role)
        for a in range(len(loop)):
            for b in range(a+1,len(loop)):
                budget.tick('accept');hits=G.segment_intersections2(p2[a],p2[(a+1)%len(loop)],p2[b],p2[(b+1)%len(loop)])
                common=set((loop[a],loop[(a+1)%len(loop)]))&set((loop[b],loop[(b+1)%len(loop)]))
                allowed={G.project2(positions[i],axis) for i in common}
                require(all(h in allowed for h in hits),'projected-loop-crossing',role=role,edges=[a,b])
        projected=[];cap_start=len(all_faces);ci=len(positions);positions.append(center)
        for j,a in enumerate(loop):
            b=loop[(j+1)%len(loop)];require(G.orient2(p2[(j+1)%len(loop)],p2[j],mean2)*factor>0,'cap-fan-area',role=role,edge=j)
            all_faces.append((b,a,ci));projected.append(tuple((x,y,Q(0)) for x,y in (p2[(j+1)%len(loop)],p2[j],mean2)))
        for a in range(len(projected)):
            for b in range(a+1,len(projected)):
                budget.tick('accept');cap_projection_checks+=1
                hits=G.triangle_intersection_points(projected[a],projected[b])
                shared=set(projected[a])&set(projected[b])
                if len(shared)==1:valid=all(h in shared for h in hits)
                elif len(shared)==2:
                    x,y=sorted(shared);valid=all(G.on_segment3(h,x,y) for h in hits)
                else:valid=False
                require(valid,'projected-cap-overlap',role=role,faces=[a,b])
        cap_ids[role]=list(range(cap_start,len(all_faces)));capplanes[role]=(n,og)
    physical,physical_record=structure(positions[:len(p)],faces,loops,budget)
    all_triangles,closed_record=structure(positions,all_faces,{},budget,True,len(faces))
    volume6=sum(G.dot(t[0],G.cross(t[1],t[2])) for t in all_triangles)
    require(volume6>0,'capped-volume',sixVolume=volume6)
    tree,tests=embedding(positions,all_faces,all_triangles,budget)
    return {'positions':positions,'faces':all_faces,'physical':physical,'physicalTree':G.BVH(physical),
        'allTriangles':all_triangles,'allTree':tree,'capIDs':cap_ids,'capPlanes':capplanes,
        'record':{'physical':physical_record,'capped':closed_record,'sixVolume':volume6,
                  'embeddingPairs':tests,'projectedCapPairs':cap_projection_checks}}


def audit_fit(surface,original,domains,budget):
    limit=Q(1,10000);certificates=[];required_certificates=[];tested=0
    def gap(tri,identity):
        nonlocal tested
        pairs=0
        for fi in surface['physicalTree'].gap_candidates(G.bounds(tri),limit):
            budget.tick('accept');tested+=1;pairs+=1
            d2=G.triangle_distance2(tri,surface['physical'][fi])
            if d2<limit:raise FitFailure('continuous-gap',source=identity,face=fi,squaredDistance=d2,
                                        sourceTriangle=tri,garmentTriangle=surface['physical'][fi],completedSourceCertificates=len(certificates))
        return {'identity':identity,'thresholdSquared':limit,'evaluatedPairs':pairs,
                'prunedByExactAABBThreshold':len(surface['physical'])-pairs,'fullDomainAboveThreshold':True,
                'limit':'threshold certificate, not observed global minimum'}
    for uuid,tid,tri in original:
        budget.tick();certificates.append(gap(tri,{'uuid':uuid,'originalTriangle':tid}))
    directions=[(Q(1),Q(37,29),Q(67,41)),(Q(67,41),Q(1),Q(37,29)),(Q(37,29),Q(67,41),Q(1))]
    for domain in domains:
        for fan_id,fan in enumerate(domain['fans']):
            budget.tick();tri=tuple(G.rational(p) for p in fan);identity={'uuid':domain['uuid'],'originalTriangle':domain['triangle'],'fan':fan_id}
            cert=gap(tri,identity)
            for role,(normal,origin) in surface['capPlanes'].items():
                for q in tri:
                    num=G.dot(normal,G.sub(q,origin));threshold=Q(.015)-Q(1e-12)
                    if num<0 or num*num<threshold*threshold*G.norm2(normal):
                        raise FitFailure('required-cap-plane',source=identity,role=role,point=q,numerator=num)
                for fi in surface['capIDs'][role]:
                    budget.tick('accept')
                    if G.triangle_intersection_points(tri,surface['allTriangles'][fi]):
                        raise FitFailure('required-cap-intersection',source=identity,role=role,capFace=fi)
            origin=G.mean(tri);parities=[]
            for direction in directions:
                hits=0
                for fi in surface['allTree'].ray_candidates(origin,direction):
                    budget.tick('ray')
                    if G.ray_triangle(origin,direction,surface['allTriangles'][fi]):hits+=1
                if hits%2!=1:raise FitFailure('required-outside',source=identity,origin=origin,direction=direction,hits=hits)
                parities.append(hits)
            cert['threeExactOddCounts']=parities;required_certificates.append(cert)
    return {'originalCertificates':certificates,'requiredFanCertificates':required_certificates,'distancePairs':tested,
            'allOriginalTriangles':len(original),'allRequiredFans':len(required_certificates),'gapSquared':limit}


def load_checked(path,row,budget):
    budget.observe('before-json-'+Path(path).name)
    require(Path(path).stat().st_size<=128*1024**2,'json-input-cap')
    raw=Path(path).read_bytes()
    require(len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'],'decoded-input-pin',path=str(path))
    budget.observe('after-read-'+Path(path).name)
    value=json.loads(raw)
    budget.observe('after-json-'+Path(path).name)
    return value


def main():
    global G
    require(len(sys.argv)==5,'worker-arguments')
    here=Path(__file__).resolve().parent;output=Path(sys.argv[1]).resolve();admission_path=Path(sys.argv[2]).resolve()
    deadline=float(sys.argv[3]);budget=Budget(deadline);out=Output(output,budget)
    stage='admission';started=time.monotonic();admission=None
    try:
        require(output==here.parent/'coupled-garment-first-trial' and output.is_dir(),'worker-output-root')
        require(admission_path==here/'ADMISSION.json' and admission_path.is_file(),'missing-admission')
        require(admission_path.stat().st_size<=256*1024,'admission-size-cap')
        admission_bytes=admission_path.read_bytes()
        require(hashlib.sha256(admission_bytes).hexdigest()==sys.argv[4],'parent-admission-identity')
        admission=json.loads(admission_bytes)
        require(admission.get('kind')=='one-coupled-sweater-cpu-trial' and admission.get('allowExecution') is True,
                'wrong-admission-kind')
        require(time.time()<admission['expiresEpoch'],'expired-admission')
        for row in admission['pins']:pin_check(row)
        rows={r['path']:r for r in admission['pins']}
        def read_pin(path):return load_checked(path,rows[str(path)],budget)
        root=here.parents[3]
        method=root/'docs/evidence/appearance-2026-10-19/coupled-garment-surface-method'
        require(rows[str(method/'METHOD.md')]['sha256']=='966e24a57c1249983ed0da4f3b48489ef3e207b2e94912bbabd9a856ef5d4b24','changed-method')
        require(rows[str(method/'ARTIST.json')]['sha256']=='e5796b5d2ccee166a37413433dd475c41f00f8c9695f633ae1ddda8e00e61325','changed-artist')
        require(str(here/'worker.py') in rows and str(here/'exact_geometry.py') in rows,'unowned-executable-source')
        runtime=read_pin(here/'RUNTIME.json');caches=read_pin(here/'RUNTIME-CACHES.json')
        own_paths=[str(here/'worker.py'),str(here/'exact_geometry.py')]
        runtime_start=runtime_check(runtime,caches,own_paths)
        out.write('runtime-start.json',{'identity':runtime_start,'maxRSSRawBytes':budget.maximum_rss,
                                     'flags':repr(sys.flags),'version':sys.version})
        stage='load-pinned-geometry-definitions'
        helper=here/'exact_geometry.py';raw=helper.read_bytes()
        require(len(raw)==rows[str(helper)]['bytes'] and hashlib.sha256(raw).hexdigest()==rows[str(helper)]['sha256'],'compiled-helper-pin')
        G=types.ModuleType('sugata_exact_geometry');G.__file__=str(helper);sys.modules[G.__name__]=G
        exec(compile(raw,str(helper),'exec'),G.__dict__)
        artist=read_pin(method/'ARTIST.json')
        ledger_path=root/'docs/evidence/appearance-2026-10-04/original-surface-ledger/LEDGER.json'
        partition_path=root/'docs/evidence/appearance-2026-10-04/sweater-coverage-owned/PARTITION.json'
        require(rows[str(ledger_path)]['sha256']=='d221466f48a076c040eef267d9d069c82dca2c0062ba466217ba247138939f5e' and
                rows[str(partition_path)]['sha256']=='08850757c4d630581c2dc11a8c80e8559f6d324d297eaa1bff4d21141dfdb4df','changed-original-input')
        require(rows[str(ledger_path)]['bytes']+rows[str(partition_path)]['bytes']<=192*1024**2,'combined-input-cap')
        ledger=read_pin(ledger_path);partition=read_pin(partition_path)
        require(partition['ledgerPin']=={'bytes':rows[str(ledger_path)]['bytes'],'sha256':rows[str(ledger_path)]['sha256']},'partition-ledger-pin')
        stage='complete-original-domain'
        original,guides,domains,corners,inventory=read_source(ledger,partition,budget)
        del ledger,partition
        out.write('source-domain.json',{'inventory':inventory,'domains':domains,
            'cornerOccurrenceProvenance':[[u,t,f,c] for u,t,f,c,q in corners],
            'originalPointOrder':'owner order in inventory, then each original vertexID in order',
            'originalTriangleCount':len(original),'originalPointCount':len(guides),'requiredCornerOccurrences':len(corners),
            'immutableInputs':[rows[str(ledger_path)],rows[str(partition_path)]]})
        stage='first-construction'
        p,target,faces,roles,loops=construct(artist)
        require(len(p)<=2000 and len(faces)<=4000 and all(all(math.isfinite(x) and abs(x)<=3 for x in q) for q in p+target),'candidate-size-or-finite-cap')
        out.write('initial.json',{'positions':p,'targets':target,'faces':faces,'roles':roles,'namedBoundaryLoops':loops,
                                  'status':'unqualified first geometry; no fit/appearance claim'})
        stage='initial-structural-embedding'
        initial_surface=capped_surface(p,faces,loops,artist,budget)
        out.write('initial-structure.json',initial_surface['record'])
        stage='initial-fit-observer'
        try:
            baseline=audit_fit(initial_surface,original,domains,budget)
            out.write('initial-fit.json',{'status':'complete-source-rest-fit-A','certificates':baseline})
        except FitFailure as exc:
            out.write('initial-fit.json',{'status':'diagnostic-baseline-B-prefix-only','code':exc.code,'witness':exc.witness,
                'limit':'permitted initial fit observer; not full baseline completion or final acceptance'})
        del initial_surface
        stage='joint-projections'
        final,history=solve(p,target,faces,loops,corners,guides,budget,out)
        out.write('final.json',{'positions':final,'faces':faces,'roles':roles,'namedBoundaryLoops':loops,
            'status':'unqualified until final full acceptance','iterations':history})
        stage='final-structural-embedding'
        final_surface=capped_surface(final,faces,loops,artist,budget)
        out.write('final-structure.json',final_surface['record'])
        stage='final-complete-fit'
        accepted=audit_fit(final_surface,original,domains,budget)
        out.write('final-fit.json',accepted)
        stage='final-runtime-and-memory'
        runtime_end=runtime_check(runtime,caches,own_paths);budget.observe('before-final-return')
        out.write('result.json',{'status':'PRODUCER_DATA_A_PENDING_INDEPENDENT_REVIEW','actualGeometry':True,
            'iterationCount':24,'counts':dict(budget.counts),'maxRSSRawBytes':budget.maximum_rss,'rssObservations':budget.peaks,
            'runtimeEnd':runtime_end,'priorOutputInventory':out.inventory,'elapsedChildSeconds':time.monotonic()-started,
            'limits':'original source pose only; no independent data/appearance/export/native/GPU/rig/morph/motion/material/runtime-performance/AAA acceptance'})
        print(json.dumps({'status':'producer-data-A','outputs':len(out.inventory),'maxRSSRawBytes':budget.maximum_rss}))
        return 0
    except BaseException as exc:
        error={'status':'REFUSED_OR_UNKNOWN','stage':stage,'exception':type(exc).__name__,
               'code':getattr(exc,'code',str(exc)),'witness':getattr(exc,'witness',{}),
               'counts':dict(budget.counts),'maxRSSRawBytes':budget.maximum_rss,
               'elapsedChildSeconds':time.monotonic()-started,'traceback':traceback.format_exc(limit=12)}
        # A failed memory/output observation cannot be converted into successful evidence.
        # Best-effort small failure evidence is bounded; the parent reports any missing file.
        try:
            data=(json.dumps(plain(error),allow_nan=False)+'\n').encode()
            if len(data)<=1024**2 and out.bytes+len(data)<=111*1024**2:
                with (output/'refusal.json').open('xb') as stream:stream.write(data)
            else:print('Failure evidence exceeded its reserved allocation',file=sys.stderr)
        except BaseException:
            print('Failure evidence unavailable',file=sys.stderr)
        print(json.dumps({'status':'refused-or-unknown','stage':stage,'exception':type(exc).__name__}),file=sys.stderr)
        return 1


if __name__=='__main__':
    sys.exit(main())
