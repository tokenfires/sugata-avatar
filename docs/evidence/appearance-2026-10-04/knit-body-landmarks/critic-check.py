"""Read saved JSON only; independent ancestor-point arithmetic, no author import or GLB read."""
from pathlib import Path
from fractions import Fraction as F
from decimal import Decimal as D, localcontext
import datetime, hashlib, json, math, os

ROOT = Path('/Users/robault/GitHub/sugata-avatar')
HERE = Path(__file__).resolve().parent
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
def read(path):
    return json.loads(path.read_text())
def pin(path):
    b = path.read_bytes()
    return {'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()}
def cross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
def point(node, p):
    if 'matrix' in node:
        m = [F(x) for x in node['matrix']]
        return [sum(m[4*k+i]*p[k] for k in range(3))+m[12+i] for i in range(3)]
    p = [v*F(s) for v, s in zip(p, node.get('scale', [1,1,1]))]
    q = [F(x) for x in node.get('rotation', [0,0,0,1])]
    uv = cross(q[:3], p); uuv = cross(q[:3], uv)
    return [p[k]+2*(q[3]*uv[k]+uuv[k])+F(node.get('translation', [0,0,0])[k]) for k in range(3)]
def decimal(x):
    return D(x.numerator)/D(x.denominator)

pins = read(HERE/'SOURCE-PINS.json')['files']
assert all(pin(ROOT/k) == v for k,v in pins.items())
raw = read(ROOT/'docs/evidence/appearance-2026-10-04/knit-registration-repaired/PARTIAL-DATA.json')['assets'][0]
doc = raw['document']; nodes = doc['nodes']; parents = {}; order = []
def visit(i, parent=None):
    assert i not in parents
    parents[i] = parent; order.append(i)
    for j in nodes[i].get('children', []): visit(j,i)
for i in doc['scenes'][doc.get('scene',0)]['nodes']: visit(i)
w = read(HERE/'worksheet.json'); c = read(HERE/'CONVENTION.json')
mesh = read(ROOT/'docs/evidence/appearance-2026-10-04/whole-knit-serving/mesh.json')
candidates = [[i,nodes[i]['mesh'],j] for i in order if 'mesh' in nodes[i] and 'skin' in nodes[i]
              for j,p in enumerate(doc['meshes'][nodes[i]['mesh']]['primitives']) if p.get('targets')]
assert candidates == w['candidates'] == raw['bodyOwnerCandidates']
assert w['sceneTraversal'] == order and w['parentMap'] == {str(k):v for k,v in parents.items()}
ni,mi,pi = candidates[0]; si = nodes[ni]['skin']; joints = doc['skins'][si]['joints']
assert [w['selectedOwner'][k] for k in ['nodeIndex','meshIndex','primitiveIndex','skinIndex']] == [ni,mi,pi,si]
assert w['selectedSkinDescriptor'] == doc['skins'][si]
means = {}; targets = {}; results = {}; deviations = []
bound = 64*math.ulp(1.0)
def compare(actual, expected):
    delta = abs(float(actual)-expected); deviations.append(delta)
    assert delta <= bound, (delta,bound)
with localcontext() as ctx:
    ctx.prec = 70
    for role,decl in c['sourceLandmarks'].items():
        row = w['landmarks'][role]; ids = decl['vertexIds']
        source = [mesh['positions'][i] for i in ids]
        assert row['vertexIds'] == ids and row['sourcePositionRows'] == source
        means[role] = [sum(F(p[k]) for p in source)/len(source) for k in range(3)]
        name = c['targetLandmarks'][role]['exactRigNodeName']
        matches = [i for i in joints if nodes[i].get('name') == name]
        assert len(matches) == 1 and matches == row['matchingNodeIndices'] == w['jointMatches'][name]
        j = matches[0]; origin = [F(0),F(0),F(0)]; cursor = j
        while cursor is not None:
            origin = point(nodes[cursor],origin); cursor = parents[cursor]
        assert row['nodeIndex'] == j and row['node'] == nodes[j] and row['parentIndex'] == parents[j]
        assert row['initialSceneGlobalMatrix'] == raw['initialSceneGlobalMatrices'][str(j)]
        offset = c['targetLandmarks'][role]['offsetMeters']
        assert row['offsetMeters'] == offset
        targets[role] = [origin[k]+F(offset[k]) for k in range(3)]
        for k in range(3):
            compare(origin[k],row['originMeters'][k]); compare(means[role][k],row['sourceMean'][k])
            compare(targets[role][k],row['targetMeters'][k])
        results[role] = {'nodeIndex':j,'independentOriginMeters':[str(decimal(x)) for x in origin]}
    scale = (targets['neck'][1]-targets['hem'][1])/(means['neck'][1]-means['hem'][1])
    translation = [targets['neck'][k]-scale*means['neck'][k] for k in range(3)]
    compare(scale,w['transform']['scale'])
    for k in range(3): compare(translation[k],w['transform']['translationMeters'][k])
    failed = []
    for role in ['hem','negative-X-cuff','positive-X-cuff']:
        mapped = [scale*means[role][k]+translation[k] for k in range(3)]
        delta = [mapped[k]-targets[role][k] for k in range(3)]
        dist = decimal(sum(x*x for x in delta)).sqrt(); out = w['residuals'][role]
        for k in range(3): compare(mapped[k],out['mappedMeanMeters'][k]); compare(delta[k],out['deltaMeters'][k])
        compare(dist,out['distanceMeters'])
        limit = c['transformConvention']['residualLimitMeters'][role]
        assert out['limitMeters'] == limit and out['withinLimit'] == (dist <= D(F(limit).numerator)/D(F(limit).denominator))
        if not out['withinLimit']: failed.append(role)
        results[role]['independentResidualMeters'] = str(dist)
    assert failed == ['negative-X-cuff','positive-X-cuff'] and w['status'] == 'incompatible'
    assert [g['message'] for g in w['gates'] if not g['ok']] == ['fixed held-out residual limits']
    scale_text = str(decimal(scale))
job = read(HERE/'JOB.json'); returned = read(HERE/'TOOL-RETURN.json')
assert job == read(HERE/'RUN.stdout.txt') and (HERE/'RUN.stderr.txt').stat().st_size == 0
assert job['exitCode'] == returned['result']['exit_code'] == 1
assert all(v['actual'] == v['expected'] == pins[v['path']] for v in job['authorityChecks'])
assert all(pin(HERE/k) == v for k,v in job['outputs'].items())
receipt = {'pid':os.getpid(),'startedAt':started,'endedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
           'status':'verified B mapping / retain diagnostic','maxArithmeticDeviationMetres':max(deviations),
           'arithmeticBoundMetres':bound,'independentScale':scale_text,'landmarks':results,
           'checkerPin':pin(Path(__file__)),'sourceInputs':pins,
           'limits':'Saved raw JSON and mesh operands only; no author import/rerun, GLB decode, skinning, new geometry or native.'}
with (HERE/'CRITIC-CHECK.json').open('x') as f: f.write(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({k:receipt[k] for k in ['pid','startedAt','endedAt','status','maxArithmeticDeviationMetres','independentScale']}))
