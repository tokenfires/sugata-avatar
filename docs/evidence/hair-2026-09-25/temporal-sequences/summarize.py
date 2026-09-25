from pathlib import Path
import hashlib
import json
import math
import struct

root = Path('tmp/hair-sep25/temporal-sequences')
out = root / 'captures'
read = lambda p: json.loads(p.read_text())
sha = lambda data: hashlib.sha256(data).hexdigest()

def js_sum(values):
    # Match JavaScript's left-to-right reduce, not Python's compensated float sum.
    total = 0
    for value in values:
        total += value
    return total

report = read(out / 'report.json')
results = report['results']
assert len(results) == 42
for name, expected in report['sourceSHA256'].items():
    assert sha(Path(name).read_bytes()) == expected, name

def name(r):
    c = r['config']
    return f'{c["temporal"]}-{c["name"]}-p{c["phase"]}'

full = {name(r): read(out / (name(r) + '.json')) for r in results}
for r in results:
    c, actual = r['config'], r['actual']
    assert r['maskPixels'] == 12544
    assert r['bounds'] == {'x0': 72, 'x1': 184, 'y0': 72, 'y1': 184}
    assert actual['stats']['backend'] == 'webgpu'
    assert actual['adapter']['vendor'] == 'apple'
    assert actual['stats']['temporalAA'] == c['temporal']
    assert actual['stats']['resolutionScale'] == (1 if c['temporal'] == 'off' else .66)
    assert actual['frameId'] == 512 and actual['captureTime'] == 0
    assert [f['frameId'] for f in r['frames']] == list(range(1, 513))
    assert [s['count'] for s in r['checkpoints']] == [24, 128, 512]
    for f in r['frames']:
        if c['mode'] != 'stochastic':
            continue
        for i, offset in enumerate(f['offsets']):
            rate = math.sqrt(2) - 1 if c['sequence'] == 'distinct' and i == 1 else .6180339887498949
            assert actual['materials'][i]['rate'] == rate
            value = (f['frameId'] + c['phase']) * rate
            assert offset == value - math.floor(value)
    for s in r['checkpoints']:
        prefix = r['frames'][:s['count']]
        tail = prefix[-min(64, s['count']):]
        assert s['temporalMean'] == js_sum(f['mean'] for f in prefix) / len(prefix)
        assert s['tailMean'] == js_sum(f['mean'] for f in tail) / len(tail)
        assert s['tailTemporalRMS'] == js_sum(f['temporalRMS'] or 0 for f in tail) / len(tail)
        assert sha((out / f'{name(r)}-n{s["count"]}.png').read_bytes()) == s['imageSHA256']

equivalences = []
for mode in ['off', 'taau']:
    for a, b in [('shared-half', 'single-half'), ('shared-half', 'merged-negative'),
                 ('distinct-half', 'distinct-reversed')]:
        x, y = (full[f'{mode}-{n}-p0'] for n in [a, b])
        fields = ['frameId', 'mean', 'min', 'max', 'spatialSD', 'temporalRMS']
        assert [[f[k] for k in fields] for f in x['frames']] == [[f[k] for k in fields] for f in y['frames']]
        assert x['pixelMeans'] == y['pixelMeans']
        assert x['checkpoints'] == y['checkpoints']
        equivalences.append({'mode': mode, 'a': a, 'b': b, 'exact': True})
    for case, expected in [('empty', 1), ('zero-pair', 1), ('opaque-pair', 0), ('front-body', 1)]:
        assert all(f['min'] == f['max'] == expected for f in full[f'{mode}-{case}-p0']['frames'])
    for case, expected in [('quarter', .5625), ('half', .25), ('three-quarter', .0625), ('mixed', .1875)]:
        assert all(abs(f['mean'] - expected) <= 1 / 255 for f in full[f'{mode}-blend-{case}-p0']['frames'])

pilot = read(root / 'pilot/report.json')
assert len(pilot['results']) == 10
assert pilot['sourceSHA256'] == report['sourceSHA256']
for r in pilot['results']:
    later = full[name(r)]
    assert r['frames'] == later['frames'][:128], name(r)
    assert r['checkpoints'] == later['checkpoints'][:2], name(r)
    for s in r['checkpoints']:
        assert sha((root / 'pilot' / f'{name(r)}-n{s["count"]}.png').read_bytes()) == s['imageSHA256']

prior_dir = Path('docs/evidence/hair-2026-09-25/layer-correlation')
prior = {f'{r["config"]["temporal"]}-{r["config"]["name"]}': r
         for r in map(json.loads, (prior_dir / 'case-records.jsonl').read_text().splitlines())}
identity = []
for mode in ['off', 'taau']:
    for new, old in [('shared-half', 'half-pair'), ('single-half', 'half'),
                     ('merged-negative', 'half-merged'), ('empty', 'empty'),
                     ('zero-pair', 'zero'), ('opaque-pair', 'opaque'),
                     ('front-body', 'front-body'), ('blend-half', 'blend-half-pair'),
                     ('blend-mixed', 'blend-mixed-pair')]:
        current, previous = full[f'{mode}-{new}-p0'], prior[f'{mode}-{old}']
        # The previous instrument predates spatialSD/temporalRMS; endpoint/depth
        # controls intentionally have a different layer count or second offset now.
        fields = ['frameId', 'mean', 'min', 'max']
        assert [[f[k] for k in fields] for f in current['frames'][:128]] == [[f[k] for k in fields] for f in previous['frames']]
        assert current['checkpoints'][1]['imageSHA256'] == previous['imageSHA256']
        identity.append({'current': name(current), 'previous': f'{mode}-{old}', 'frames': 128, 'exact': True})

rows, relative_phase = [], []
for r in results:
    c = r['config']
    independent = 1 if c.get('frontBody') else math.prod(1 - a for a in c['alphas'])
    rows.append({'name': name(r), 'independentTransmission': independent,
                 'checkpoints': r['checkpoints'],
                 'pixelMeansSHA256': sha(struct.pack('<' + 'd' * r['maskPixels'], *full[name(r)]['pixelMeans']))})
    if c['temporal'] == 'off' and c['name'].startswith('distinct-'):
        a, b = c['alphas']
        predictions = []
        for f in r['frames']:
            delta = (f['offsets'][1] - f['offsets'][0]) % 1
            # Measure of {u >= a and fract(u + delta) >= b}, for uniform u in [0,1).
            predictions.append(sum(max(0, min(1, 1 - delta + k) - max(a, b - delta + k))
                                   for k in [-1, 0, 1, 2]))
        means = [f['mean'] for f in r['frames']]
        relative_phase.append({'name': name(r), 'maxSpatialMeanPredictionError': max(abs(x-y) for x,y in zip(means, predictions)),
                               'frameMeanRange': [min(means), max(means)],
                               'frameMeanSD': math.sqrt(sum((v-r['temporalMean'])**2 for v in means)/len(means))})

summary = {'baseCommit': report['baseCommit'], 'sourceSHA256': report['sourceSHA256'],
           'verdict': 'REJECT: distinct per-material temporal rates alone repair raw mean coverage but strongly bias TAAU and increase resolved half-pair temporal noise.',
           'cases': len(results), 'framesPerCase': 512, 'sampleCounts': [24,128,512],
           'startingPhases': [0,977], 'pilotCasesWithExact128FrameTracesAndImages': 10,
           'priorIdentity': identity, 'equivalences': equivalences,
           'geometryMask': {'pixels': 12544, 'bounds': results[0]['bounds']},
           'relativePhaseDiagnostic': relative_phase, 'rows': rows,
           'limits': ['Static constant-alpha basic materials; not real groom, fibre BSDF, motion or cost qualification.',
                      'Per-material two-card control, not general per-card sampling for a merged groom.',
                      'Linear RGBA8 output; raw scale 1 and TAAU scale .66 are different paths.',
                      'Whole-prefix means include startup; tails are last 64 frames, except 24-frame checkpoint.',
                      'tailTemporalRMS is mean consecutive-frame ROI RMS in linear 0..1 values; frame one contributes zero at n24.',
                      'Relative-phase predictions assume uniform spatial thresholds; recorded discrepancies are finite-sample diagnostics, not acceptance thresholds.',
                      'No specific TAAU internal mechanism established; no production, asset, threshold or calibration change.']}
(root / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
(root / 'case-records.jsonl').write_text(''.join(json.dumps(r, separators=(',', ':')) + '\n' for r in results))
(root / 'pilot-records.jsonl').write_text(''.join(json.dumps(r, separators=(',', ':')) + '\n' for r in pilot['results']))
print('PASS: 42 actual WebGPU cases x 512 frames; live rates, clock, mask, source and 126 image hashes.')
print('PASS: endpoints, opaque-body depth and all four independent sorted-blend references in both paths.')
print('PASS: six equivalences cover shared/single/merged rejection controls and candidate draw-order reversal.')
print('PASS: ten pilot cases reproduce all first 128 frame traces and both checkpoint images exactly.')
print('PASS: eighteen controls reproduce prior 128-frame means/ranges and entire final images exactly.')
for r in relative_phase:
    print(r)
print(summary['verdict'])
