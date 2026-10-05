"""Original source responsibility guide; never imports a producer or edits its inputs."""
from pathlib import Path
import hashlib, json, math, datetime

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
SOURCE = ROOT / 'docs/evidence/appearance-2026-10-04/original-surface-ledger/LEDGER.json'
EXPECTED = 'd221466f48a076c040eef267d9d069c82dca2c0062ba466217ba247138939f5e'
CUT = .28

def area(poly):
    if len(poly) < 3:
        return 0.0
    a = poly[0]['p']; total = 0.0
    for i in range(1, len(poly)-1):
        u = [poly[i]['p'][k]-a[k] for k in range(3)]
        v = [poly[i+1]['p'][k]-a[k] for k in range(3)]
        c = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
        total += math.sqrt(sum(x*x for x in c)) / 2
    return total

def clip(original, below, cross):
    result = []
    for i, a in enumerate(original):
        b = original[(i+1) % 3]
        ain = a['p'][1] <= CUT if below else a['p'][1] >= CUT
        bin_ = b['p'][1] <= CUT if below else b['p'][1] >= CUT
        if ain:
            result.append(a)
        if ain != bin_:
            result.append(cross(i, (i+1) % 3))
    dedup = []
    for v in result:
        if not dedup or v['b'] != dedup[-1]['b']:
            dedup.append(v)
    if len(dedup) > 1 and dedup[0]['b'] == dedup[-1]['b']:
        dedup.pop()
    return dedup if area(dedup) > 0 else []

def bounds(points):
    assert points
    return {'min': [min(p[k] for p in points) for k in range(3)],
            'max': [max(p[k] for p in points) for k in range(3)]}

def main():
    raw = SOURCE.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == EXPECTED
    ledger = json.loads(raw)
    assert len(ledger['owners']) == 9 and ledger['vertexCount'] == 39546
    owners, records, traces, crossing_edges = [], [], [], []
    totals = {'triangles': 0, 'degenerate': 0, 'crossing': 0, '-X': 0, '+X': 0}
    side_area = {'-X': 0.0, '+X': 0.0}; side_trace = {'-X': 0, '+X': 0}
    low_points = []
    for oi, source in enumerate(ledger['owners']):
        pts = source['worldPositions']; tris = source['triangles']
        assert source['vertexIDs'] == list(range(len(pts)))
        assert source['triangleIDs'] == list(range(len(tris)))
        assert all(len(p) == 3 and all(math.isfinite(x) for x in p) for p in pts)
        owner = {k: source[k] for k in ('key', 'name', 'association', 'vertexIDs', 'triangleIDs', 'triangles')}
        owner['positions'] = pts
        owners.append(owner); cache = {}
        for ti, triangle in enumerate(tris):
            assert len(triangle) == 3 and all(isinstance(v, int) and 0 <= v < len(pts) for v in triangle)
            original = [{'p': pts[v], 'b': [int(k == i) for k in range(3)]} for i, v in enumerate(triangle)]
            original_area = area(original)
            def cross(i, j):
                va, vb = triangle[i], triangle[j]
                if pts[va][1] == CUT:
                    return original[i]
                if pts[vb][1] == CUT:
                    return original[j]
                lo, hi = sorted((va, vb)); key = (lo, hi)
                assert (pts[lo][1]-CUT)*(pts[hi][1]-CUT) < 0
                if key not in cache:
                    t = (CUT-pts[lo][1])/(pts[hi][1]-pts[lo][1])
                    p = [pts[lo][k] + t*(pts[hi][k]-pts[lo][k]) for k in range(3)]
                    edge = {'owner': oi, 'edge': [lo, hi], 'tFromLow': t, 'p': p}
                    cache[key] = edge; crossing_edges.append(edge)
                edge = cache[key]; bary = [0.0]*3
                bary[triangle.index(lo)] = 1-edge['tFromLow']
                bary[triangle.index(hi)] = edge['tFromLow']
                return {'p': edge['p'], 'b': bary, 'edge': edge['edge'], 'tFromLow': edge['tFromLow']}
            # Crossing provenance also belongs to zero-area original triangles.
            for i in range(3):
                j = (i+1) % 3
                if (original[i]['p'][1]-CUT)*(original[j]['p'][1]-CUT) < 0:
                    cross(i, j)
            if original_area == 0:
                below, above = [], []
            elif all(p['p'][1] == CUT for p in original):
                below, above = original, []
            else:
                below, above = clip(original, True, cross), clip(original, False, cross)
            delta = abs(original_area-area(below)-area(above))
            assert delta <= max(1e-12, original_area*1e-9), (oi, ti, delta)
            side = None
            if below:
                assert source['key'] == 'body' and source['name'] == 'Human', (oi, ti, 'unexpected owner')
                xs = [p['p'][0] for p in below]
                if max(xs) < 0: side = '-X'
                elif min(xs) > 0: side = '+X'
                else: raise ValueError(('cross-X support', oi, ti))
                totals[side] += 1; side_area[side] += area(below)
                low_points.extend(v['p'] for v in below)
            record = {'owner': oi, 'triangle': ti, 'area': original_area,
                      'degenerate': original_area == 0, 'belowSide': side,
                      'below': below, 'above': above}
            records.append(record); totals['triangles'] += 1
            totals['degenerate'] += int(original_area == 0)
            if below and above:
                ends = [p for p in below if abs(p['p'][1]-CUT) <= 1e-12]
                assert len(ends) == 2
                traces.append({'owner': oi, 'triangle': ti, 'side': side, 'ends': ends})
                totals['crossing'] += 1; side_trace[side] += 1
    assert totals['triangles'] == 71512 and all(v > 0 for v in side_area.values())
    assert all(v > 0 for v in side_trace.values())
    output = {'scope': 'Full original zero-morph geometric source intent only; no anatomical/boot/fit release',
              'ledger': {'path': str(SOURCE.relative_to(ROOT)), 'bytes': len(raw), 'sha256': EXPECTED},
              'plane': {'axis': 'worldY', 'metres': CUT, 'coplanar': 'below only',
                        'degenerate': 'original ID and raw original triangle retained; no area/coverage support'},
              'owners': owners, 'records': records, 'crossingEdges': crossing_edges, 'traces': traces,
              'totals': totals, 'sideAreaM2': side_area, 'sideTraceCount': side_trace,
              'fullBounds': bounds([p for o in owners for p in o['positions']]),
              'belowBounds': bounds(low_points)}
    encoded = (json.dumps(output, separators=(',', ':'), allow_nan=False)+'\n').encode()
    (HERE/'guide.json').write_bytes(encoded)
    with (HERE/'source-guide.obj').open('w') as f:
        f.write('# Saved original metre/world frame; artist responsibility only; no welding/capping or fitted boot.\n')
        next_vertex = 1
        for rec in records:
            own = owners[rec['owner']]
            groups = [(rec['belowSide'], rec['below']), ('outside', rec['above'])]
            if rec['degenerate']:
                groups = [('degenerate', [{'p': own['positions'][v]} for v in own['triangles'][rec['triangle']]])]
            for role, poly in groups:
                if not poly: continue
                f.write(f"g {rec['owner']}.{own['name']}.{role}\n# originalTriangle {rec['triangle']}\n")
                for v in poly: f.write('v '+' '.join(format(x,'.17g') for x in v['p'])+'\n')
                for i in range(1, len(poly)-1): f.write(f'f {next_vertex} {next_vertex+i} {next_vertex+i+1}\n')
                next_vertex += len(poly)
        f.write('g opening_trace\n')
        for trace in traces:
            f.write(f"# originalOwner {trace['owner']} originalTriangle {trace['triangle']}\n")
            for e in trace['ends']: f.write('v '+' '.join(format(x,'.17g') for x in e['p'])+'\n')
            f.write(f'l {next_vertex} {next_vertex+1}\n');next_vertex += 2
    summary = {'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'totals': totals,
               'sideAreaM2': side_area, 'sideTraceCount': side_trace,
               'outputs': {p.name: {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
                           for p in (HERE/'guide.json', HERE/'source-guide.obj')}}
    (HERE/'BUILD.json').write_text(json.dumps(summary, indent=2)+'\n')
    print(json.dumps(summary))

if __name__ == '__main__': main()
