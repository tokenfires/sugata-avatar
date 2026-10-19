from pathlib import Path
import json, math, struct, collections, hashlib, datetime, os

# Read-only audit of the sole saved entry. No builder/library import or geometry generation.
p = Path(__file__).resolve().parent
def pin(q):
    b = q.read_bytes()
    return dict(path=str(q), bytes=len(b), sha256=hashlib.sha256(b).hexdigest())
def delta(a, b): return [a[k] - b[k] for k in range(3)]
def cross(a, b): return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
def dot(a, b): return sum(a[k]*b[k] for k in range(3))
def book(faces):
    edges = collections.defaultdict(list)
    for i, f in enumerate(faces):
        a, b, c = f['v']
        for u, v in [(a,b), (b,c), (c,a)]: edges[tuple(sorted((u,v)))].append((i,u,v))
    return edges
def connected(graph):
    seen, todo = set(), [next(iter(graph))]
    while todo:
        a = todo.pop()
        if a not in seen:
            seen.add(a)
            todo.extend(graph[a] - seen)
    return len(seen) == len(graph)
def cycle_edges(q): return {tuple(sorted((q[i], q[(i+1) % len(q)]))) for i in range(len(q))}
def boundary_cycles(edge_book):
    nxt = {}
    for entries in edge_book.values():
        if len(entries) == 1:
            _, a, b = entries[0]
            assert a not in nxt
            nxt[a] = b
    assert len(set(nxt.values())) == len(nxt) and set(nxt) == set(nxt.values())
    left, loops = set(nxt), []
    while left:
        start, seq = min(left), []
        a = start
        while a in left:
            seq.append(a); left.remove(a); a = nxt[a]
        assert a == start
        loops.append(seq)
    return loops

admission = json.loads((p/'CPU-ADMISSION.json').read_text())
for row in admission['inputs']: assert pin(Path(row['path'])) == row
m = json.loads((p/'out/model.json').read_text())
d = json.loads((p/'design.json').read_text())
r = json.loads((p/'BUILD-RESULT.json').read_text())
t = json.loads((p/'TOOL-CPU.json').read_text())
assert t['result']['exit_code'] == 0 and 'session_id' not in t['result']
assert json.loads(t['result']['output']) == r
assert m['designSha256'] == r['designSha256'] == pin(p/'design.json')['sha256']
assert m['materials'] == d['materials'] and m['frame'] == d['frame'] and m['units'] == d['units']
for row in r['outputs']: assert pin(Path(row['path'])) == row
parts = {part['id']: part for part in m['parts']}
assert len(parts) == 8 and len(m['materials']) == 9
stats, edge_books, outer_books, largest_offset_error = [], {}, {}, 0
largest_f32_error = 0
f32 = lambda x: struct.unpack('<f', struct.pack('<f', x))[0]
for part in m['parts']:
    vs, fs, n = part['vertices'], part['faces'], part['outerCount']
    assert len(vs) == n*2
    assert all(len(v) == 3 and all(type(x) in [int,float] and math.isfinite(x) for x in v) for v in vs)
    assert all(len(f['v']) == 3 and len(set(f['v'])) == 3 and all(type(i) is int and 0 <= i < len(vs) for i in f['v']) and f['material'] in m['materials'] and type(f['role']) is str and type(f['owner']) is str for f in fs)
    assert len({tuple(sorted(f['v'])) for f in fs}) == len(fs)
    eb = book(fs); edge_books[part['id']] = eb
    adjacency = {i:set() for i in range(len(fs))}
    for entries in eb.values():
        assert len(entries) == 2 and entries[0][1:] == entries[1][1:][::-1]
        a, b = entries[0][0], entries[1][0]
        adjacency[a].add(b); adjacency[b].add(a)
    assert connected(adjacency)
    links = [collections.defaultdict(set) for _ in vs]
    for f in fs:
        for k, i in enumerate(f['v']):
            a, b = f['v'][(k+1)%3], f['v'][(k+2)%3]
            links[i][a].add(b); links[i][b].add(a)
    assert all(g and all(len(s) == 2 for s in g.values()) and connected(g) for g in links)
    centroid = [sum(v[k] for v in vs)/len(vs) for k in range(3)]
    volume, min_area, min_f32_area = 0., math.inf, math.inf
    converted = [[f32(x) for x in v] for v in vs]
    largest_f32_error = max(largest_f32_error, max(abs(a-b) for v,w in zip(vs,converted) for a,b in zip(v,w)))
    for f in fs:
        a,b,c = [vs[i] for i in f['v']]
        area = math.sqrt(dot(cross(delta(b,a),delta(c,a)),cross(delta(b,a),delta(c,a))))/2
        assert area > 0
        min_area = min(min_area,area)
        volume += dot(delta(a,centroid),cross(delta(b,centroid),delta(c,centroid)))/6
        a,b,c = [converted[i] for i in f['v']]
        q = cross(delta(b,a),delta(c,a)); ar = math.sqrt(dot(q,q))/2
        assert ar > 0
        min_f32_area = min(min_f32_area,ar)
    assert volume > 0 and math.isclose(volume,part['materialVolume'],rel_tol=1e-9,abs_tol=1e-8)
    outer = [f for f in fs if f.get('layer') == 'outer']
    inner = [f for f in fs if f.get('layer') == 'inner']
    rims = [f for f in fs if 'layer' not in f]
    assert all(all(i < n for i in f['v']) for f in outer)
    assert {tuple(f['v']) for f in inner} == {(f['v'][0]+n,f['v'][2]+n,f['v'][1]+n) for f in outer}
    assert all(f['role'] == 'rim' and len({i % n for i in f['v']}) == 2 for f in rims)
    ob = book(outer); outer_books[part['id']] = (outer,ob)
    loops = boundary_cycles(ob)
    assert {frozenset(cycle_edges(q)) for q in loops} == {frozenset(cycle_edges(q)) for q in part['openSurfaceBoundaryLoops']}
    assert len(rims) == 2*sum(map(len,loops))
    acc = [[0.,0.,0.] for _ in range(n)]
    for f in outer:
        a,b,c = [vs[i] for i in f['v']]
        q = cross(delta(b,a),delta(c,a))
        for i in f['v']:
            for k in range(3): acc[i][k] += q[k]
    for i,q in enumerate(acc):
        length = math.sqrt(dot(q,q)); assert length > 0
        observed = delta(vs[i],vs[i+n])
        largest_offset_error = max(largest_offset_error,max(abs(observed[k]-part['thickness']*q[k]/length) for k in range(3)))
    assert largest_offset_error < 1e-10
    euler = len(vs)-len(eb)+len(fs)
    assert euler == (-2 if part['id'] in ['shell_with_outer_bags','full_lining_and_facings'] else 2)
    stats.append(dict(id=part['id'],vertices=len(vs),triangles=len(fs),edges=len(eb),euler=euler,min_area=min_area,min_predicted_Float32_area=min_f32_area,translated_volume=volume,outer_boundary_lengths=sorted(map(len,loops))))

contact_counts = collections.Counter()
for w in m['contacts']:
    a,b = parts[w['partA']],parts[w['partB']]
    ia,ib = w['vertexA'],w['vertexB']
    assert type(ia) is int and type(ib) is int and 0 <= ia < len(a['vertices']) and 0 <= ib < len(b['vertices'])
    assert math.dist(a['vertices'][ia],b['vertices'][ib]) == w['distance'] == 0
    if w['partA'] == 'shell_with_outer_bags': assert ia >= a['outerCount'] and ib < b['outerCount']
    else: assert ia < a['outerCount'] and ib < b['outerCount']
    contact_counts[w['partA']] += 1
assert len(m['contacts']) == 246
assert dict(contact_counts) == dict(shell_with_outer_bags=152,pointed_collar=49,left_guard_G_L=13,separate_zip_R=13,separate_zip_L=13,outer_mouth_L_tape=3,outer_mouth_R_tape=3)
main, lining = parts['shell_with_outer_bags'], parts['full_lining_and_facings']
shared_edges = 0
for part in [main,lining]:
    outer, eb = outer_books[part['id']]
    assert sorted(map(len,part['openSurfaceBoundaryLoops'])) == [16,16,120]
    assert len(part['bodyGrid']) == 13 and all(len(row) == 49 for row in part['bodyGrid'])
    assert sum(i is None for row in part['bodyGrid'] for i in row) == 18
    for it in part['interfaces']:
        assert len(it['sharedBodyRing']) == len(set(it['sharedBodyRing'])) == 16
        for a,b in cycle_edges(it['sharedBodyRing']):
            entries = eb[(a,b)]; assert len(entries) == 2
            owners = [outer[x[0]]['owner'] for x in entries]
            assert sum(x.startswith('torso:') for x in owners) == 1 and sum(x.startswith('sleeve:'+it['id']+':') for x in owners) == 1
            shared_edges += 1
        assert any(set(it['terminalCuffRing']) == set(q) for q in part['openSurfaceBoundaryLoops'])
lining_roles = {f['role'] for f in outer_books[lining['id']][0]}
assert {'LF_R','LF_L','LB','LS_R','LS_L','F_R','F_L','N','H','C_R','C_L'} <= lining_roles
outer, eb = outer_books[main['id']]
mouth_edges, bag_faces = 0, collections.Counter(f['role'] for f in main['faces'] if f['role'].startswith('bag_'))
assert dict(bag_faces) == {'bag_L':60,'bag_R':60}
for mouth in main['mouths']:
    assert len(mouth['loop']) == 6 and len(mouth['bagVertices']) == 13
    assert all((1 if mouth['id'] == 'L' else -1)*main['vertices'][i][0] > 0 for i in mouth['loop'])
    for key in cycle_edges(mouth['loop']):
        entries = eb[key]; assert len(entries) == 2
        owners = [outer[x[0]]['owner'] for x in entries]
        assert sum(x.startswith('torso:') for x in owners) == 1 and sum(x.startswith('bag:'+mouth['id']+':') for x in owners) == 1
        mouth_edges += 1
for mouth in d['mouths']:
    for i in range(mouth['i0'],mouth['i1']):
        owner = 'torso:'+str(i)+':'+str(mouth['j0'])
        assert not any(f['owner'] == owner for f in outer_books[main['id']][0])
        assert sum(f['owner'] == owner for f in outer_books[lining['id']][0]) == 2
assert all(v[0] > 0 for v in parts['left_guard_G_L']['vertices'])
assert all(v[0] < 0 for v in parts['separate_zip_R']['vertices']) and all(v[0] > 0 for v in parts['separate_zip_L']['vertices'])

obj_lines = (p/'out/model.obj').read_text().splitlines()
ordered = m['parts']; pi, vi, fi, offset, material, max_round = -1,0,0,0,None,0.
for line in obj_lines:
    fields = line.split()
    if not fields or fields[0].startswith('#'): continue
    tag = fields[0]
    if tag == 'mtllib': assert fields == ['mtllib','model.mtl']
    elif tag == 'o':
        if pi >= 0: assert vi == len(ordered[pi]['vertices']) and fi == len(ordered[pi]['faces']); offset += vi
        pi += 1; assert fields[1] == ordered[pi]['id']; vi=fi=0; material=None
    elif tag == 'v':
        vals = list(map(float,fields[1:])); assert len(vals) == 3
        err = max(abs(a-b) for a,b in zip(vals,ordered[pi]['vertices'][vi])); assert err <= 5.0001e-9
        max_round = max(max_round,err); vi += 1
    elif tag == 'usemtl': material = fields[1]; assert material in m['materials']
    elif tag == 'f':
        assert [int(x)-1-offset for x in fields[1:]] == ordered[pi]['faces'][fi]['v'] and material == ordered[pi]['faces'][fi]['material']; fi += 1
    else: raise AssertionError(('unexpected OBJ record',tag))
assert pi == 7 and vi == len(ordered[-1]['vertices']) and fi == len(ordered[-1]['faces'])
mtl, current = {}, None
for line in (p/'out/model.mtl').read_text().splitlines():
    fields = line.split()
    if not fields: continue
    if fields[0] == 'newmtl': current=fields[1]; assert current not in mtl; mtl[current]={}
    else: assert fields[0] not in mtl[current]; mtl[current][fields[0]]=fields[1:]
assert set(mtl) == set(m['materials'])
for name,h in m['materials'].items():
    q=mtl[name]; assert set(q) == {'Kd','Ka','Ks','Ns','d','illum'}
    assert max(abs(float(v)-int(h[i:i+2],16)/255) for v,i in zip(q['Kd'],[1,3,5])) <= 5.0001e-9
    assert q['Ka'] == ['0.05']*3 and q['Ks'] == ['0']*3 and q['Ns'] == ['8'] and q['d'] == ['1'] and q['illum'] == ['2']
counts=dict(parts=len(ordered),vertices=sum(len(q['vertices']) for q in ordered),triangles=sum(len(q['faces']) for q in ordered))
assert counts == m['counts'] == r['counts'] == d['expected']
lin_ids=['full_lining_and_facings','pointed_collar','left_guard_G_L','separate_zip_R','separate_zip_L']
line_tris=sum(len(parts[x]['faces']) for x in lin_ids)
bag_tris=sum(bag_faces.values())+sum(len(parts[x]['faces']) for x in parts if x.startswith('outer_mouth_'))
assert line_tris == 4644 and bag_tris == 160
result=dict(schema='root-Ari-full-saved-data-audit-v1',utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),pid=os.getpid(),decision='A finite saved-data/interface/export scope only; actual independent critic and rendered appearance still owed',reverified_admission_pins=len(admission['inputs']),sole_tool_chunk='7be568',counts=counts,parts=stats,actual_contacts=len(m['contacts']),contact_groups=dict(contact_counts),shared_sleeve_edges=shared_edges,shared_outer_mouth_edges=mouth_edges,lining_has_no_pocket_entry=True,lining_roles=sorted(lining_roles),normal_offset_max_error=largest_offset_error,predicted_Float32_max_position_error=largest_f32_error,all_predicted_Float32_triangles_nondegenerate=True,OBJ_all_positions_faces_materials=True,OBJ_max_rounding_error=max_round,MTL_roles=len(mtl),role_triangle_forecasts=[8548,8548,8548,line_tris,line_tris,bag_tris],limits='Existing saved data only, no generator/helper import/replay or geometry change. No global layer separation/selfintersection/collisionfree/sewnunion/functionalcapacity/physicalfit/cloth/rig/motion/runtime/performance/AAA or appearance proof. Float32 predicted, not actual GPU readback.')
(p/'ROOT-CPU.json').open('x').write(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
