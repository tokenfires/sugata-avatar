"""Saved-data observer only; no producer imports or candidate construction."""
from pathlib import Path
from fractions import Fraction
from collections import defaultdict
import datetime, hashlib, json, os, struct

root = Path(__file__).resolve().parent
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
def load(name):
    return json.loads((root/name).read_text())
def verify(base, row):
    raw = (base/row['path']).read_bytes()
    assert len(raw) == row['bytes'] and hashlib.sha256(raw).hexdigest() == row['sha256'], row['path']
repo = root.parents[3]
for row in load('SOURCE-PINS.json')['sourcePins'] + load('INPUTS.json')['inputs']:
    verify(repo, row)
run = load('RUN.json')
for row in run['inputPins'] + run['outputs']:
    verify(root, row)
assert run['exit'] == 0 and not run['timeout'] and not run['actions']
mesh = load('export/mesh.json')
partial = load('export/surface-partial.json')
for key in ['positions','quads','regions','ports','limits']:
    assert mesh[key] == partial[key]
points, quads = mesh['positions'], mesh['quads']
triangles = [q[:3] for q in quads] + [[q[0],q[2],q[3]] for q in quads]
edges, graph, wedges = defaultdict(list), defaultdict(set), defaultdict(lambda: defaultdict(set))
minimum = None
used = set()
for fi, tri in enumerate(triangles):
    assert len(set(tri)) == 3 and all(0 <= i < len(points) for i in tri)
    used.update(tri)
    p = [[Fraction(x) for x in points[i]] for i in tri]
    u = [p[1][i]-p[0][i] for i in range(3)]; v = [p[2][i]-p[0][i] for i in range(3)]
    cross = [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
    area = sum(x*x for x in cross)
    assert area > Fraction(1e-12)
    minimum = area if minimum is None else min(minimum,area)
    for a,b in zip(tri,tri[1:]+tri[:1]):
        edges[tuple(sorted((a,b)))].append((fi,a,b))
    for i in range(3):
        c,a,b = tri[i],tri[(i+1)%3],tri[(i+2)%3]
        wedges[c][a].add(b); wedges[c][b].add(a)
def groups(nodes, adjacency):
    unseen = set(nodes); result = []
    while unseen:
        pending = [min(unseen)]; seen = set()
        while pending:
            node = pending.pop()
            if node in seen: continue
            seen.add(node); pending.extend(adjacency[node]-seen)
        unseen -= seen; result.append(seen)
    return result
boundary = set(); border = defaultdict(set)
for edge, uses in edges.items():
    assert len(uses) in (1,2)
    if len(uses) == 2:
        f,a,b = uses[0]; g,c,d = uses[1]
        assert (a,b) == (d,c)
        graph[f].add(g); graph[g].add(f)
    else:
        boundary.add(edge); a,b = edge; border[a].add(b); border[b].add(a)
assert len(groups(range(len(triangles)),graph)) == 1 and used == set(range(len(points)))
assert all(len(x)==2 for x in border.values())
named = set()
for port in mesh['ports'].values():
    assert len(port) == len(set(port))
    for a,b in zip(port,port[1:]+port[:1]):
        edge = tuple(sorted((a,b))); assert edge not in named; named.add(edge)
assert named == boundary
for center, link in wedges.items():
    assert len(groups(link,link)) == 1
    degrees = [len(v) for v in link.values()]
    assert (degrees.count(1)==2 and all(d in (1,2) for d in degrees)) if center in border else all(d==2 for d in degrees)
actual = {'vertices':len(points),'quads':len(quads),'triangles':len(triangles),'triangleEdges':len(edges),'boundaryEdges':len(boundary),'boundaryLoops':len(groups(border,border)),'euler':len(points)-len(edges)+len(triangles)}
assert actual == load('ARTIST-DATA.json')['expected'] == load('export/CHECK.json')['actual']
objpoints=[]; objquads=[]; objregions=[]; region=None
for line in (root/'export/trousers.obj').read_text().splitlines():
    terms=line.split()
    if terms and terms[0]=='v': objpoints.append([float(x) for x in terms[1:]])
    elif terms and terms[0]=='g': region=terms[1]
    elif terms and terms[0]=='f': objquads.append([int(x)-1 for x in terms[1:]]); objregions.append(region)
assert (objpoints,objquads,objregions)==(points,quads,mesh['regions'])
native=load('NATIVE.json'); record=native['observed']['record']
assert record == load('NATIVE-AFTER.json')['record'] and record['ready'] and record['error'] is None
assert record['meshSha'] == hashlib.sha256((root/'export/mesh.json').read_bytes()).hexdigest()
assert (record['vertices'],record['quads'],record['triangles'])==(320,289,578)
f32=lambda x:struct.unpack('f',struct.pack('f',x))[0]
assert record['bounds'] == {'min':[min(f32(p[i]) for p in points) for i in range(3)],'max':[max(f32(p[i]) for p in points) for i in range(3)]}
assert [x['view'] for x in record['draws']]==['front','profile','back']
assert [x['position'] for x in record['draws']]==[[0,2.4,10],[10,2.4,0],[0,2.4,-10]]
assert [x['viewport'] for x in record['draws']]==[[0,0,393,640],[393,0,393,640],[786,0,394,640]]
assert all(x['target']==[0,2.4,0] and x['up']==[0,1,0] and x['verticalHalfExtent']==2.25 and x['near']==.1 and x['far']==20 for x in record['draws'])
assert native['captureCount']==1 and native['viewportOverride'] is False
closed=load('NATIVE-CLOSE.json'); assert closed['ownedTab']==native['tabId']=='32' and closed['closed'] and closed['tabsAfter']==[]
plan=load('PLAN.json'); stop=datetime.datetime.fromisoformat(plan['stopAt'])
assert datetime.datetime.fromisoformat(run['finishedUtc']) < stop and datetime.datetime.fromisoformat(closed['utc'].replace('Z','+00:00')) < stop
result={'pid':os.getpid(),'startedUtc':started,'finishedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actual':actual,'triangleFaceComponents':1,'boundaryComponentLengths':sorted(len(x) for x in groups(border,border)),'allVertexLinksPass':True,'objExact':True,'exactSquaredCrossMinimumObserver':float(minimum),'nativeIdentityAndFloat32Bounds':True,'drawsUnchanged':True,'knownTabClosed':True,'limits':'Saved topology/export/record observation only; no producer imports, global intersections, material/fit/physical or GPU-ledger certificate.'}
(root/'CRITIC-DATA.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
