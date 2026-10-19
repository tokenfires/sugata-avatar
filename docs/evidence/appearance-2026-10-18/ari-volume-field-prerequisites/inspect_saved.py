"""Independent saved-result consumer. Does not import worker/kernel or launch a trial."""
import ast
import bisect
from collections import Counter, defaultdict
import datetime
from fractions import Fraction as F
import hashlib
import json
from pathlib import Path
import struct
import time
import zipfile

P = Path(__file__).resolve().parent
TICK = time.monotonic()


def check():
    assert time.monotonic()-TICK < 110, 'observer budget'


def strict(raw):
    def pairs(items):
        d = {}
        for k,v in items:
            assert k not in d, 'duplicate JSON key'
            d[k] = v
        return d
    return json.loads(raw,object_pairs_hook=pairs,parse_constant=lambda s: (_ for _ in ()).throw(ValueError(s)))


def pin(path):
    path = Path(path); b = path.read_bytes()
    return {'path':str(path),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}


def verify(row):
    assert pin(row['path']) == {k:row[k] for k in ('path','bytes','sha256')}, row['path']


def read_source(archive, spec):
    with zipfile.ZipFile(archive) as z:
        names = [i for i in z.infolist() if i.filename == spec['name']+'.npy']
        assert len(names) == 1 and names[0].file_size <= spec['bytes']+4108
        blob = z.read(names[0])
    assert blob[:6] == b'\x93NUMPY'
    version = tuple(blob[6:8]); assert version in ((1,0),(2,0),(3,0))
    count_bytes = 2 if version == (1,0) else 4
    n = int.from_bytes(blob[8:8+count_bytes],'little'); assert 0 < n <= 4096
    header = ast.literal_eval(blob[8+count_bytes:8+count_bytes+n].decode('utf8' if version == (3,0) else 'latin1').strip())
    assert header == {'descr':spec['dtype'],'fortran_order':False,'shape':tuple(spec['shape'])}
    raw = blob[8+count_bytes+n:]
    assert len(raw) == spec['bytes'] and hashlib.sha256(raw).hexdigest() == spec['raw_sha256']
    return list(struct.iter_unpack('<fff' if spec['dtype'] == '<f4' else '<iii',raw))


def determinant(a,b,c):
    return a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0])


def area(a,b,c):
    return (a[0]-c[0])*(b[1]-c[1])-(a[1]-c[1])*(b[0]-c[0])


def predicate(triangle, axis, point, scale):
    indices = tuple(i for i in range(3) if i != axis)
    p = [tuple(v[i] for i in indices) for v in triangle]
    d = area(*p); weights = [area(point,p[1],p[2]),area(p[0],point,p[2]),area(p[0],p[1],point)]
    def integer(x):
        v = x*scale*scale; assert v.denominator == 1
        return v.numerator
    if d:
        bary = [w/d for w in weights]
        if min(bary) < 0:
            return None
        zero = bary.count(0)
        di = integer(d); wi = list(map(integer,weights))
        axis_int = [int(v[axis]*scale) for v in triangle]
        return {'kind':'VERTEX' if zero > 1 else 'EDGE' if zero else 'PROPER',
                'area_int':di,'bary_numerators':wi,
                'hit_axis_numerator':sum(a*b for a,b in zip(wi,axis_int)), 'hit_axis_denominator':di}
    for i,j in ((0,1),(1,2),(2,0)):
        delta = [p[j][k]-p[i][k] for k in range(2)]
        if area(p[i],p[j],point) or any(not min(p[i][k],p[j][k]) <= point[k] <= max(p[i][k],p[j][k]) for k in range(2)):
            continue
        den = sum(x*x for x in delta)
        num = sum((point[k]-p[i][k])*delta[k] for k in range(2)) if den else F(0)
        num_int, den_int = integer(num), integer(den) if den else 1
        left, right = int(triangle[i][axis]*scale), int(triangle[j][axis]*scale)
        return {'kind':'COPLANAR','area_int':0,'bary_numerators':list(map(integer,weights)),
                'segment':[i,j],'segment_fraction':[num_int,den_int],
                'hit_axis_numerator':left*den_int+num_int*(right-left),'hit_axis_denominator':den_int}
    return None


def audit_source(vertices, faces):
    n = len(vertices); used = set(); adjacency = [set() for _ in vertices]
    links = [defaultdict(list) for _ in vertices]; edges = defaultdict(list); volume6 = 0
    def fail(condition, witness):
        return {'status':'REFUSED','condition':condition,'witness':witness}
    for fid, face in enumerate(faces):
        if fid % 256 == 0:check()
        if len(face) != 3 or any(type(i) is not int or not 0 <= i < n for i in face):
            return fail('source_indices',{'face_id':fid,'indices':list(face)})
        a,b,c = face; pa,pb,pc = (vertices[i] for i in face)
        u = tuple(pb[i]-pa[i] for i in range(3)); w = tuple(pc[i]-pa[i] for i in range(3))
        gram = sum(x*x for x in u)*sum(x*x for x in w)-sum(x*y for x,y in zip(u,w))**2
        if gram == 0:
            return fail('nonzero_area',{'face_id':fid,'indices':list(face),'vertices_int':[pa,pb,pc]})
        assert gram > 0
        used.update(face); volume6 += determinant(pa,pb,pc)
        for x,y,z in ((a,b,c),(b,c,a),(c,a,b)):
            adjacency[x].add(y); adjacency[y].add(x)
            edges[tuple(sorted((x,y)))].append((fid,1 if x < y else -1))
            links[x][y].append(z); links[x][z].append(y)
    if used != set(range(n)):
        return fail('all_used',{'first_unused':min(set(range(n))-used)})
    unseen = set(range(n)); components = 0
    while unseen:
        components += 1; todo = [unseen.pop()]
        while todo:
            for j in adjacency[todo.pop()]:
                if j in unseen:unseen.remove(j);todo.append(j)
    if components != 1:
        return fail('one_component',{'components':components})
    for edge in sorted(edges):
        incidence = edges[edge]
        if len(incidence) != 2 or incidence[0][1] == incidence[1][1]:
            return fail('two_opposed_edges',{'edge':edge,'incidences':incidence})
    for vid, star in enumerate(links):
        if vid % 256 == 0:check()
        good = bool(star) and all(len(neighbors)==2 for neighbors in star.values())
        visited = set()
        if good:
            todo = [next(iter(star))]; visited = set(todo)
            while todo:
                for j in star[todo.pop()]:
                    if j not in visited:visited.add(j);todo.append(j)
            good = visited == set(star)
        if not good:
            original = []
            for a,b,c in faces:
                if a == vid:original.append((b,c))
                if b == vid:original.append((c,a))
                if c == vid:original.append((a,b))
            return fail('cyclic_vertex_link',{'vertex':vid,'links':original})
    euler = n-len(edges)+len(faces)
    if euler != 2:
        return fail('Euler2',{'V':n,'E':len(edges),'F':len(faces),'Euler':euler})
    if volume6 == 0:
        return fail('nonzero_chain_volume',{'volume6_int':0})
    return {'status':'PASS','V':n,'E':len(edges),'F':len(faces),'components':1,'used':n,
            'Euler':2,'cyclic_links':n,'volume6_int':volume6,'orientation':1 if volume6>0 else -1}


def main():
    cfg = strict((P/'CONFIG.json').read_bytes()); job = strict((P/'JOB.json').read_bytes())
    for r in cfg['pins']:
        verify(r)
    assert job['returncode'] == 0 and job['collected'] and job['reason'] is None and not job['errors']
    assert job['elapsed_seconds'] <= 124
    for key,name in [('stdout','STDOUT.txt'),('stderr','STDERR.txt')]:
        p = pin(P/name); s = job['streams'][key]
        assert p['bytes'] == s['bytes'] == s['observed_read_bytes'] and p['sha256'] == s['sha256']
        assert s['eof'] and s['closed'] and s['written']
    assert (P/'STDERR.txt').read_bytes() == b''
    rp = pin(P/'RESULT.json'); assert job['result'] == {k:rp[k] for k in ('bytes','sha256')}
    r = strict((P/'RESULT.json').read_bytes()); out = strict((P/'STDOUT.txt').read_bytes())
    assert out == {'status':r['status'],'bytes':rp['bytes'],'sha256':rp['sha256'],'pid':job['child_pid']}
    assert r['post_pins_verified'] == len(cfg['pins'])
    if 'input_pins_verified' in r:assert r['input_pins_verified'] == len(cfg['pins'])
    if 'runtime' in r:
        assert r['runtime']['pid'] == job['child_pid'] and r['runtime']['executable'] == cfg['python']
    if 'resource_limits' in r:
        data_limit = r['resource_limits']['DATA']['requested_and_readback']
        assert data_limit[0] == data_limit[1] and 0 < data_limit[0] <= 1073741824
    expected_fixture_names = ['inside','edge','vertex','outside','reverse','coplanar','beyond_segment','off_line','axis_y','axis_z']
    assert r['status'] == 'UNKNOWN' or [x['name'] for x in r['fixtures']] == expected_fixture_names
    for x in r.get('fixtures',[]):
        tri = [tuple(map(F,v)) for v in x['triangle']]
        assert predicate(tri,x['axis'],tuple(map(F,x['point'])),1) == x['result']
    if 'format_fixtures' in r:
        assert [x['version'] for x in r['format_fixtures'][:3]] == [1,2,3]
        assert all(x['values'] == [[1.25,-2.5,0.0]] for x in r['format_fixtures'][:3])
        assert r['format_fixtures'][3] == {'object_dtype_refused':'NPY dtype/order/shape'}
    assert r['status'] in ('REFUSED_SOURCE_GATE','REFUSED_AMBIGUOUS_COLUMN','UNKNOWN_COLUMN','PASS_PREREQUISITES_ONLY','UNKNOWN')
    if r['status'] == 'UNKNOWN':
        assert not r['complete'] and 'stop' in r and 'unexpected' not in r
        conclusion = 'Bounded UNKNOWN only; no source/column/field qualification.'
    else:
        contract = strict(Path(cfg['contract']).read_bytes())
        specs = {x['name']:x for x in contract['frame']['buffers']}
        archive = next(x['path'] for x in contract['sources'] if x['path'].endswith('/ari-skin-palette/work/after-geometry.npz'))
        vf = read_source(archive,specs['Human_world']); faces = read_source(archive,specs['Human_triangles'])
        assert len(vf) == 13380 and len(faces) == 26756
        q64 = [[contract['grid']['origin_world64'][a] + float(i*contract['grid']['h']) for i in range(contract['grid']['cell_counts'][a]+1)] for a in range(3)]
        q32 = [[struct.unpack('<f',struct.pack('<f',x))[0] for x in row] for row in q64]
        assert r['grid']['q64_axes'] == q64 and r['grid']['q32_axes'] == q32
        exponent = max(F(x).denominator.bit_length()-1 for x in [v for p in vf for v in p]+[v for row in q32 for v in row])
        assert exponent == r['grid']['scale_exponent']; scale = 1 << exponent
        v = [tuple(F(x) for x in p) for p in vf]; qi = [[F(x) for x in row] for row in q32]
        vi = [tuple(int(x*scale) for x in p) for p in v]
        source = audit_source(vi,faces); source['scale_exponent'] = exponent
        assert r['source_gate'] == strict(json.dumps(source))
        if source['status'] != 'PASS':
            assert r['status'] == 'REFUSED_SOURCE_GATE' and not r['complete'] and r['columns_scanned'] == 0
            conclusion = 'Independently rederived exact formal source prerequisite refusal; no field or physical/appearance result.'
        else:
            stop = r.get('witness'); stop_key = tuple([stop['axis']]+stop['column_indices']+[stop['face_id']]) if stop else None
            rolling = hashlib.sha256(); pairs_total = 0; columns_total = 0; first_bad = None
            for axis in range(3 if stop is None else stop['axis']+1):
                other = [i for i in range(3) if i != axis]; events = []; refs = 0; nonempty = set()
                for fid,face in enumerate(faces):
                    if fid % 128 == 0:check()
                    ranges = [range(bisect.bisect_left(qi[a],min(v[k][a] for k in face)),bisect.bisect_right(qi[a],max(v[k][a] for k in face))) for a in other]
                    refs += len(ranges[0])*len(ranges[1]); assert refs <= 1000000
                    for u in ranges[0]:
                        for w in ranges[1]:
                            nonempty.add((u,w))
                            if stop_key is None or (axis,u,w,fid) <= stop_key:events.append((u,w,fid))
                proper = 0
                for n,(u,w,fid) in enumerate(sorted(events)):
                    if n % 128 == 0:check()
                    value = predicate([v[k] for k in faces[fid]],axis,(qi[other[0]][u],qi[other[1]][w]),scale)
                    rolling.update(json.dumps([axis,u,w,fid,value],sort_keys=True,separators=(',',':')).encode()+b'\n')
                    if value:
                        if value['kind'] == 'PROPER':proper += 1
                        else:
                            assert first_bad is None
                            first_bad = (axis,u,w,fid,value)
                column_count = stop['column_indices'][0]*len(qi[other[1]])+stop['column_indices'][1]+1 if stop and axis == stop['axis'] else len(qi[other[0]])*len(qi[other[1]])
                expected_axis = {'axis':axis,'references':refs,'nonempty_bins':len(nonempty),'columns_scanned':column_count,
                                 'pairs_tested':len(events),'proper_hits':proper,'complete':not(stop and axis == stop['axis'])}
                assert r['axis_records'][axis] == expected_axis
                pairs_total += len(events); columns_total += column_count
            assert rolling.hexdigest() == r['prefix_digest'] and pairs_total == r['candidate_pairs_tested'] and columns_total == r['columns_scanned']
            if stop:
                assert first_bad == (stop['axis'],*stop['column_indices'],stop['face_id'],stop['predicate'])
                assert stop['source_indices'] == list(faces[stop['face_id']])
                assert stop['vertices_F32'] == [list(vf[k]) for k in faces[stop['face_id']]]
                assert stop['vertices_int'] == [list(vi[k]) for k in faces[stop['face_id']]]
                node = stop['node']; assert not r['complete']
                if node['proven_nonboundary']:
                    idx = node['indices']; point = [q32[a][idx[a]] for a in range(3)]
                    assert point == node['q32'] and [struct.pack('<f',x).hex() for x in point] == node['q32_bits_hex']
                    assert node['gid'] == ((idx[0]*len(qi[1])+idx[1])*len(qi[2])+idx[2])
                    axis = stop['axis']; bounds = [min(p[axis] for p in vi),max(p[axis] for p in vi)]
                    assert node['source_axis_bounds_int'] == bounds
                    assert [int(F(x)*scale) for x in point] == node['point_int']
                    assert node['point_int'][axis] < bounds[0] or node['point_int'][axis] > bounds[1]
                    assert r['status'] == 'REFUSED_AMBIGUOUS_COLUMN'
                    conclusion = 'Exact ambiguous column plus actual grid node outside complete source axis bounds; fixed field prerequisite refused, not physical inside/fit.'
                else:
                    assert r['status'] == 'UNKNOWN_COLUMN'; conclusion = 'Column ambiguity only; boundary exception unresolved, field held.'
            else:
                assert first_bad is None and r['complete'] and columns_total == 51872 and r['status']=='PASS_PREREQUISITES_ONLY'
                conclusion = 'All formal source-chain/column prerequisites completed; native metric, node agreement, field, mesh and every physical/appearance gate remain held.'
    for row in cfg['pins']:verify(row)
    record = {'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elapsed_seconds':time.monotonic()-TICK,
              'status':r['status'],'conclusion':conclusion,'independent_method':'BFS/undirected vertex links, expanded volume determinant, face-centric projected event sort and Fraction predicates; no kernel/worker import.',
              'inputs':[pin(P/name) for name in ['CONFIG.json','ADMISSION.json','JOB.json','RESULT.json','STDOUT.txt','STDERR.txt']],
              'limits':'No native, field, mesh, fit, physical inside, coverage, rendered appearance or motion qualification. Data-limit readback is not a hard instantaneous RSS guarantee.'}
    with (P/'ROOT-OBSERVATION.json').open('x') as f:json.dump(record,f,indent=2);f.write('\n')
    print(json.dumps(record,indent=2))


if __name__ == '__main__':
    main()
