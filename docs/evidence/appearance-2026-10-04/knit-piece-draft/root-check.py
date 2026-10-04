"""Independently check saved 2D outputs only; never import or invoke the author."""
from pathlib import Path
import collections, datetime, hashlib, json, math, os

p = Path(__file__).resolve().parent
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
d = json.loads((p/'pattern.json').read_text())
j = json.loads((p/'AUTHOR-JOB.json').read_text())
assert j['exitCode'] == 0 and all(c['okay'] for c in j['checks'])
for out in j['outputs']:
    raw = (p/out['file']).read_bytes()
    assert len(raw) == out['bytes'] and hashlib.sha256(raw).hexdigest() == out['sha256']
v, e = d['vertices'], d['edges']
assert len(d['pieces']) == 5 and len(e) == 31 and len(d['seams']) == 13
assert all(math.isfinite(x) for xy in v.values() for x in xy)
lengths = {}
for name, edge in e.items():
    a,b = v[edge['from']],v[edge['to']]
    if edge['kind'] == 'line':
        length = math.sqrt(sum((b[k]-a[k])**2 for k in (0,1)))
    else:
        c = edge['control']; n = 65536
        def speed(t):
            return math.sqrt(sum((2*(1-t)*(c[k]-a[k])+2*t*(b[k]-c[k]))**2 for k in (0,1)))
        length = math.fsum(speed(i/n)*(1 if i in (0,n) else 4 if i%2 else 2) for i in range(n+1))/(3*n)
    assert abs(length-edge['lengthAU']) <= 1e-9, (name,length,edge['lengthAU'])
    lengths[name] = length

# Equivalence closure by explicit set merging, independent of author's union trees.
classes = [{name} for name in v]
used = []
germ_keys = {}
faces = collections.defaultdict(set)
for seam in d['seams']:
    x,y = seam['edges']; a,b = e[x],e[y]
    assert x != y and x not in used and y not in used
    used += [x,y]
    assert seam['reverseBoundaryDirection'] and abs(lengths[x]-lengths[y]) <= 1e-9
    expected = [[a['from'],b['to']],[a['to'],b['from']]]
    assert expected == seam['endpointPairs']
    for first,second in expected:
        participating = [part for part in classes if first in part or second in part]
        merged = set().union(*participating)
        classes = [part for part in classes if part not in participating]+[merged]
    germ_keys[(x,'from')] = germ_keys[(y,'to')] = seam['id']+':a'
    germ_keys[(x,'to')] = germ_keys[(y,'from')] = seam['id']+':b'
    faces[a['piece']].add(b['piece']); faces[b['piece']].add(a['piece'])
owner = {name:min(part) for part in classes for name in part}
actual_classes = {min(part):sorted(part) for part in classes}
assert actual_classes == {k:sorted(val) for k,val in d['cornerEquivalences'].items()}
free = {name:edge['freeOpening'] for name,edge in e.items() if 'freeOpening' in edge}
assert len(free) == 5 and set(used).isdisjoint(free) and set(used)|set(free) == set(e)
adj = collections.defaultdict(list)
for name in free:
    a,b = owner[e[name]['from']],owner[e[name]['to']]
    adj[a].append((b,name));adj[b].append((a,name))
    for endpoint in ('from','to'):germ_keys[(name,endpoint)] = name+':'+endpoint
assert all(len(neighbors)==2 for neighbors in adj.values())
loops = []; remaining = set(adj)
while remaining:
    todo = [min(remaining)]; nodes = set(); edges = set()
    while todo:
        at = todo.pop()
        if at in nodes:continue
        nodes.add(at)
        for neighbor,name in adj[at]:edges.add(name);todo.append(neighbor)
    remaining -= nodes
    names = {free[name] for name in edges}
    assert len(names) == 1
    loops.append({'name':next(iter(names)),'vertices':sorted(nodes),'edges':sorted(edges)})
assert sorted(loops,key=lambda q:q['name']) == sorted(d['freeLoops'],key=lambda q:q['name'])
assert len(loops)==4 and {q['name'] for q in loops}=={'neck','hem','left cuff','right cuff'}

# A corner is a link arc between its two edge-end germs. Paired germ identity
# is determined by seam endpoint correspondence, not by quotient vertex alone.
links = collections.defaultdict(lambda:collections.defaultdict(list))
for piece in d['pieces']:
    assert len(piece['edges'])==len(piece['vertices'])
    for node in piece['vertices']:
        ends = [(name,end) for name in piece['edges'] for end in ('from','to') if e[name][end]==node]
        assert len(ends)==2
        a,b = [germ_keys[end] for end in ends]
        graph = links[owner[node]];graph[a].append(b);graph[b].append(a)
link_summary = []
for node,graph in sorted(links.items()):
    stack=[next(iter(graph))];seen=set()
    while stack:
        at=stack.pop()
        if at not in seen:seen.add(at);stack.extend(graph[at])
    degrees=sorted(len(neighbors) for neighbors in graph.values());boundary=node in adj
    assert seen==set(graph) and set(degrees)<={1,2} and degrees.count(1)==(2 if boundary else 0)
    record=next(q for q in d['cornerLinks'] if q['vertex']==node)
    assert degrees==sorted(record['germDegrees']) and record['boundary']==boundary
    link_summary.append({'vertex':node,'degrees':degrees,'boundary':boundary})
seen={'F'};todo=['F']
while todo:
    for neighbor in faces[todo.pop()]:
        if neighbor not in seen:seen.add(neighbor);todo.append(neighbor)
assert seen=={'F','B','L','R','N'}
counts={'V':len(classes),'E':len(e)-len(d['seams']),'F':len(d['pieces'])}
counts['Euler']=counts['V']-counts['E']+counts['F']
assert counts==d['quotientCounts']=={'V':11,'E':18,'F':5,'Euler':-2}
report={'pid':os.getpid(),'startedAt':started,'endedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'pins':{name:{'sha256':hashlib.sha256((p/name).read_bytes()).hexdigest(),'bytes':(p/name).stat().st_size} for name in ('pattern.json','pattern.svg','AUTHOR-JOB.json','draft.py','root-check.py')},
        'independentMethod':'Saved JSON only: Simpson 65536 intervals for quadratic lengths, Euclidean line lengths, explicit equivalence-set closure, seam-endpoint keyed corner links and free-loop components. No author import or rerun.',
        'lengthsAU':lengths,'counts':counts,'freeLoops':loops,'cornerLinks':link_summary,
        'qualification':'All independent arithmetic/abstract graph checks pass; SVG readability still requires original native inspection. No 3D, physical pattern or fit claim.'}
(p/'ROOT-CHECK.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'pid':report['pid'],'startedAt':started,'endedAt':report['endedAt'],'counts':counts,'loopNames':[x['name'] for x in loops],'checks':'PASS saved arithmetic/graph only'}))
