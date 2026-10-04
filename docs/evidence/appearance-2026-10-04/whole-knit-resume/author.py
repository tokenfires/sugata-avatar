"""One fixed artist blockout. Standalone stdlib author; not a garment-fit solver."""
from collections import defaultdict, Counter
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import math
import os
import sys

HERE = Path(__file__).resolve().parent
STOP = datetime.fromisoformat('2026-10-04T17:15:00+00:00')
X = [-.75, -.50, -.25, -.10, .10, .25, .50, .75]
Y = [0, .08, .50, .70, .75]
Z = [-.14, -.09, .09, .14]
ROLES = {'hem', 'neck', 'negative-X-cuff', 'positive-X-cuff'}
# Each local quad is outward-wound in its cube axis; no radial test or repair.
SIDES = [
    ((-1,0,0), [(0,0,0),(0,0,1),(0,1,1),(0,1,0)]),
    ((1,0,0), [(1,0,0),(1,1,0),(1,1,1),(1,0,1)]),
    ((0,-1,0), [(0,0,0),(1,0,0),(1,0,1),(0,0,1)]),
    ((0,1,0), [(0,1,0),(0,1,1),(1,1,1),(1,1,0)]),
    ((0,0,-1), [(0,0,0),(0,1,0),(1,1,0),(1,0,0)]),
    ((0,0,1), [(0,0,1),(1,0,1),(1,1,1),(0,1,1)]),
]

def utc():
    return datetime.now(timezone.utc).isoformat()

def save(name, value):
    (HERE / name).write_text(json.dumps(value, indent=2, allow_nan=False) + '\n')

def edge(a, b):
    return tuple(sorted((a,b)))

def mean(points):
    return [math.fsum(p[c] for p in points)/len(points) for c in range(3)]

def triangle_area(a,b,c):
    u = [b[i]-a[i] for i in range(3)]
    v = [c[i]-a[i] for i in range(3)]
    cross = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
    return math.hypot(*cross)/2

class Refusal(Exception):
    def __init__(self, label, witness):
        super().__init__(label)
        self.witness = witness

def require(ok, label, witness):
    if not ok:
        raise Refusal(label, witness)

def incidence(faces):
    edges = defaultdict(list)
    for fi, face in enumerate(faces):
        for i,a in enumerate(face):
            b = face[(i+1)%4]
            edges[edge(a,b)].append([fi,a,b])
    return dict(edges)

def connected(graph, initial):
    seen = {initial}
    todo = [initial]
    while todo:
        for other in graph[todo.pop()]:
            if other not in seen:
                seen.add(other)
                todo.append(other)
    return seen

def control(raw):
    cells = set()
    for i in range(len(X)-1):
        for j in range(len(Y)-1):
            for k in range(len(Z)-1):
                x,y,z = (X[i]+X[i+1])/2,(Y[j]+Y[j+1])/2,(Z[k]+Z[k+1])/2
                if ((abs(x)<.25 and y<.70) or
                    (abs(x)<.10 and .70<=y<.75) or
                    (abs(x)>=.25 and .50<=y<.70 and abs(z)<.09)):
                    cells.add((i,j,k))
    grid_to_id = {}
    points, grid_keys, faces, owners, omitted = [],[],[],[],[]
    for i,j,k in sorted(cells):
        for axis, offsets in SIDES:
            neighbour = (i+axis[0], j+axis[1], k+axis[2])
            if neighbour in cells:
                continue
            keys = [tuple((i,j,k)[d]+o[d] for d in range(3)) for o in offsets]
            role = None
            if axis==(0,-1,0) and j==0:
                role = 'hem'
            elif axis==(-1,0,0) and i==0:
                role = 'negative-X-cuff'
            elif axis==(1,0,0) and i==len(X)-2:
                role = 'positive-X-cuff'
            elif axis==(0,1,0) and j==len(Y)-2 and k==1:
                role = 'neck'
            if role:
                omitted.append({'cell':[i,j,k], 'axis':axis, 'gridQuad':keys, 'role':role})
                continue
            face = []
            for key in keys:
                if key not in grid_to_id:
                    p = [X[key[0]],Y[key[1]],Z[key[2]]]
                    if abs(p[0])>.25:
                        t = (abs(p[0])-.25)/.50
                        scale = 1-.50*t
                        p[1] = .60+(p[1]-.60)*scale
                        p[2] *= scale
                    grid_to_id[key] = len(points)
                    grid_keys.append(key)
                    points.append(p)
                face.append(grid_to_id[key])
            faces.append(face)
            owners.append({'cell':[i,j,k], 'axis':axis, 'gridQuad':keys})
    # Opening identity comes from missing outer cube faces, not coordinate guessing.
    omission_edges = defaultdict(list)
    for missing in omitted:
        q = [tuple(v) for v in missing['gridQuad']]
        for a,b in zip(q,q[1:]+q[:1]):
            omission_edges[edge(a,b)].append(missing['role'])
    boundaries = []
    unknown = []
    for (a,b), uses in incidence(faces).items():
        if len(uses)==1:
            roles = omission_edges.get(edge(tuple(grid_keys[a]),tuple(grid_keys[b])), [])
            if len(roles)!=1:
                unknown.append({'edge':[a,b], 'omittedRoles':roles})
            else:
                boundaries.append({'edge':[a,b], 'role':roles[0]})
    raw['artist'] = {'grid':{'X':X,'Y':Y,'Z':Z}, 'occupiedCells':sorted(cells),
                     'gridKeys':grid_keys,'faceOwners':owners,'omittedFaces':omitted,
                     'unknownBoundaryRoles':unknown, 'unit':'artist unitless',
                     'coordinateSystem':'Y up, front +Z, sleeves in T rest'}
    return {'positions':points,'quads':faces,'boundaries':boundaries,'parent':None}

def validate(mesh, level):
    points,faces = mesh['positions'],mesh['quads']
    require(all(len(p)==3 and all(math.isfinite(c) for c in p) for p in points),
            'finite positions', {'level':level})
    edges = incidence(faces)
    graph = defaultdict(set)
    links = defaultdict(list)
    minimum = math.inf
    for fi,q in enumerate(faces):
        require(len(set(q))==4, 'distinct quad corners', {'level':level,'face':fi,'quad':q})
        for tri in ((q[0],q[1],q[2]), (q[0],q[2],q[3])):
            area = triangle_area(*(points[v] for v in tri))
            require(math.isfinite(area) and area>1e-12, 'positive fan area',
                    {'level':level,'face':fi,'triangle':tri,'area':area,'positions':[points[v] for v in tri]})
            minimum = min(minimum,area)
        for ci,v in enumerate(q):
            links[v].append(edge(q[(ci-1)%4],q[(ci+1)%4]))
    boundary = {}
    for item in mesh['boundaries']:
        key = edge(*item['edge'])
        require(key not in boundary, 'unique boundary role', {'level':level,'edge':key})
        boundary[key] = item['role']
    actual = set()
    for (a,b),uses in edges.items():
        graph[a].add(b);graph[b].add(a)
        require(len(uses) in (1,2), 'edge manifold', {'level':level,'edge':[a,b],'uses':uses})
        if len(uses)==2:
            require(uses[0][1:]==uses[1][1:][::-1], 'opposite interior orientations',
                    {'level':level,'edge':[a,b],'uses':uses})
        else:
            actual.add((a,b))
    require(actual==set(boundary), 'complete boundary ownership',
            {'level':level,'missing':[list(e) for e in actual-set(boundary)],
             'extra':[list(e) for e in set(boundary)-actual]})
    require(set(boundary.values())==ROLES, 'four boundary names', {'level':level,'roles':sorted(set(boundary.values()))})
    require(len(connected(graph,0))==len(points), 'connected surface', {'level':level})
    boundary_vertices = {v for e in actual for v in e}
    for v in range(len(points)):
        local = defaultdict(set)
        require(len(set(links[v]))==len(links[v]), 'unique vertex link edges', {'level':level,'vertex':v,'links':links[v]})
        for a,b in links[v]:
            local[a].add(b);local[b].add(a)
        degrees = [len(n) for n in local.values()]
        expected = (degrees.count(1)==2 and all(d in (1,2) for d in degrees)) if v in boundary_vertices else all(d==2 for d in degrees)
        require(expected and len(connected(local,next(iter(local))))==len(local),
                'vertex link manifold', {'level':level,'vertex':v,'links':links[v],'degrees':degrees})
    cycles = {}
    for role in sorted(ROLES):
        ring = defaultdict(set)
        for (a,b),name in boundary.items():
            if name==role:
                ring[a].add(b);ring[b].add(a)
        require(all(len(n)==2 for n in ring.values()) and len(connected(ring,next(iter(ring))))==len(ring),
                'simple named boundary', {'level':level,'role':role,'ring':{str(k):sorted(v) for k,v in ring.items()}})
        cycles[role] = {'vertices':len(ring),'edges':sum(len(v) for v in ring.values())//2}
    chi = len(points)-len(edges)+len(faces)
    require(chi==-2, 'Euler minus two', {'level':level,'V':len(points),'E':len(edges),'F':len(faces),'chi':chi})
    return {'level':level,'V':len(points),'E':len(edges),'F':len(faces),'euler':chi,
            'openings':cycles,'minimumTriangleArea':minimum,'orientable':True,'vertexLinksManifold':True}

def subdivide(mesh):
    points,faces = mesh['positions'],mesh['quads']
    edges = incidence(faces)
    ordered = sorted(edges)
    neighbours,adjacent = defaultdict(set),defaultdict(list)
    boundary_neighbours = defaultdict(set)
    for (a,b),uses in edges.items():
        neighbours[a].add(b);neighbours[b].add(a)
        if len(uses)==1:
            boundary_neighbours[a].add(b);boundary_neighbours[b].add(a)
    centres = [mean([points[v] for v in q]) for q in faces]
    for fi,q in enumerate(faces):
        for v in q:
            adjacent[v].append(fi)
    new = []
    for v,p in enumerate(points):
        if v in boundary_neighbours:
            a,b = sorted(boundary_neighbours[v])
            new.append([(6*p[c]+points[a][c]+points[b][c])/8 for c in range(3)])
        else:
            n = len(neighbours[v])
            new.append([((n-2)/n)*p[c]+math.fsum(points[w][c] for w in sorted(neighbours[v]))/(n*n)
                        +math.fsum(centres[f][c] for f in adjacent[v])/(n*n) for c in range(3)])
    edge_ids = {}
    for e in ordered:
        a,b = e
        uses = edges[e]
        edge_ids[e] = len(new)
        new.append(mean([points[a],points[b]]+([centres[u[0]] for u in uses] if len(uses)==2 else [])))
    face_ids = []
    for centre in centres:
        face_ids.append(len(new));new.append(centre)
    quads = []
    for fi,q in enumerate(faces):
        for ci,v in enumerate(q):
            quads.append([v,edge_ids[edge(v,q[(ci+1)%4])],face_ids[fi],edge_ids[edge(q[(ci-1)%4],v)]])
    roles = []
    for item in mesh['boundaries']:
        a,b = item['edge'];e = edge_ids[edge(a,b)]
        roles.extend([{'edge':list(edge(a,e)),'role':item['role']}, {'edge':list(edge(e,b)),'role':item['role']}])
    return {'positions':new,'quads':quads,'boundaries':roles,
            'parent':{'edgePoints':[{'edge':list(e),'vertex':edge_ids[e]} for e in ordered], 'facePoints':face_ids}}

def main():
    raw = {'schema':'sugata-global-knit-study-v1','levels':[],'checks':[],
           'limits':['No physical units, flat-piece folding, fit, material, rig, motion or Avatar qualification.']}
    job = {'startedAt':utc(),'pid':os.getpid(),'command':sys.argv,'status':'running','failure':None}
    code = 1
    try:
        require(datetime.now(timezone.utc)<STOP, 'hard stop before construction', {'stop':STOP.isoformat()})
        require(not any((HERE/n).exists() for n in ('RAW.json','mesh.json','sweater.obj','AUTHOR-JOB.json')),
                'first invocation only', {'directory':str(HERE)})
        level = control(raw)
        raw['levels'].append(level);save('RAW.json',raw)
        require(not raw['artist']['unknownBoundaryRoles'], 'initial omitted face ownership', raw['artist']['unknownBoundaryRoles'])
        for number in range(3):
            if number:
                level = subdivide(level);raw['levels'].append(level);save('RAW.json',raw)
            raw['checks'].append(validate(level,number));save('RAW.json',raw)
        require(datetime.now(timezone.utc)<STOP, 'hard stop before export', {'stop':STOP.isoformat()})
        output = {'schema':raw['schema'],'unit':'artist unitless','coordinateSystem':raw['artist']['coordinateSystem'],
                  'positions':level['positions'],'quads':level['quads'],'boundaries':level['boundaries'],
                  'checks':raw['checks'],'limits':raw['limits']}
        save('mesh.json',output)
        with (HERE/'sweater.obj').open('x') as f:
            f.write('# Sugata isolated artist volume; unitless T rest. No garment fit acceptance.\n')
            for p in level['positions']:
                f.write('v '+' '.join(format(c,'.17g') for c in p)+'\n')
            for q in level['quads']:
                f.write('f '+' '.join(str(v+1) for v in q)+'\n')
        job['status'] = 'passed';code = 0
    except Exception as exc:
        job['status'] = 'refused'
        job['failure'] = {'type':type(exc).__name__,'message':str(exc),'witness':getattr(exc,'witness',None)}
    finally:
        job['endedAt'] = utc()
        job['exitCode'] = code
        # Record independent inventory attempts; an unreadable file must not erase the refusal.
        job['filesExcludingSelf'] = {}
        job['inventoryErrors'] = []
        try:
            entries = sorted(HERE.iterdir())
        except Exception as exc:
            entries = []
            job['inventoryErrors'].append({'path':str(HERE),'type':type(exc).__name__,'message':str(exc)})
        for p in entries:
            if p.name=='AUTHOR-JOB.json':
                continue
            try:
                if p.is_file():
                    data = p.read_bytes()
                    job['filesExcludingSelf'][p.name] = {'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
            except Exception as exc:
                job['inventoryErrors'].append({'path':p.name,'type':type(exc).__name__,'message':str(exc)})
        if job['inventoryErrors']:
            job['status'] = 'refused';code = 1;job['exitCode'] = code
            if job['failure'] is None:
                job['failure'] = {'type':'InventoryError','message':'Actual file inventory incomplete','witness':job['inventoryErrors']}
        try:
            save('AUTHOR-JOB.json',job)
        except Exception as exc:
            # The external tool transcript remains recoverable when the job destination fails.
            code = 1;job['exitCode'] = code;job['status'] = 'refused'
            job['jobWriteError'] = {'type':type(exc).__name__,'message':str(exc)}
            print(json.dumps({'externalRecoveryJob':job}))
        print(json.dumps({'status':job['status'],'checks':raw['checks'],'failure':job['failure']}))
    return code

if __name__=='__main__':
    sys.exit(main())
