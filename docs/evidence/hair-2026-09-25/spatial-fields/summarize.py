from pathlib import Path
import hashlib
import json
import math
import struct

root = Path('tmp/hair-sep25/spatial-fields')
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
assert len(results) == 64
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
            assert actual['materials'][i]['field'] == ('yx' if c['spatial'] == 'swapped' and i == 1 else 'xy')
            value = (f['frameId'] + c['phase']) * rate
            assert offset == value - math.floor(value)
    for s in r['checkpoints']:
        prefix = r['frames'][:s['count']]
        tail = prefix[-min(64, s['count']):]
        assert s['temporalMean'] == js_sum(f['mean'] for f in prefix) / len(prefix)
        assert s['tailMean'] == js_sum(f['mean'] for f in tail) / len(tail)
        assert s['tailTemporalRMS'] == js_sum(f['temporalRMS'] or 0 for f in tail) / len(tail)
        assert sha((out / f'{name(r)}-n{s["count"]}.png').read_bytes()) == s['imageSHA256']

fields = ['frameId', 'mean', 'min', 'max', 'spatialSD', 'temporalRMS']
def measurements(r):
    return [[f[k] for k in fields] for f in r['frames']]

equivalences = []
for mode in ['off', 'taau']:
    for a, b in [('shared-half', 'single-half'), ('shared-half', 'merged-negative'),
                 ('swapped-shared-half', 'reversed-shared'), ('swapped-distinct-half', 'reversed-distinct')]:
        x, y = (full[f'{mode}-{n}-p0'] for n in [a, b])
        assert measurements(x) == measurements(y)
        assert x['pixelMeans'] == y['pixelMeans']
        assert x['checkpoints'] == y['checkpoints']
        equivalences.append({'mode': mode, 'a': a, 'b': b, 'exact': True})
    for case, expected in [('empty', 1), ('zero-pair', 1), ('opaque-pair', 0), ('front-body', 1)]:
        assert all(f['min'] == f['max'] == expected for f in full[f'{mode}-{case}-p0']['frames'])
    for case, expected in [('quarter', .5625), ('half', .25), ('three-quarter', .0625), ('mixed', .1875)]:
        assert all(abs(f['mean'] - expected) <= 1 / 255 for f in full[f'{mode}-blend-{case}-p0']['frames'])

pilot = read(root / 'pilot/report.json')
assert len(pilot['results']) == 18
assert pilot['sourceSHA256'] == report['sourceSHA256']
for r in pilot['results']:
    later = full[name(r)]
    assert r['frames'] == later['frames'][:128], name(r)
    assert r['checkpoints'] == later['checkpoints'][:2], name(r)
    for s in r['checkpoints']:
        assert sha((root / 'pilot' / f'{name(r)}-n{s["count"]}.png').read_bytes()) == s['imageSHA256']

prior_dir = Path('docs/evidence/hair-2026-09-25/temporal-sequences')
prior = {name(r): r for r in map(json.loads, (prior_dir / 'case-records.jsonl').read_text().splitlines())}
identity = []
for mode in ['off', 'taau']:
    for new, old, phases in [('shared-half', 'shared-half', [0,977]),
                             ('temporal-half', 'distinct-half', [0,977]),
                             *[(n,n,[0]) for n in ['merged-negative','empty','zero-pair','opaque-pair',
                                                  'front-body','single-half','blend-quarter','blend-half',
                                                  'blend-three-quarter','blend-mixed']]]:
        for phase in phases:
            current, previous = full[f'{mode}-{new}-p{phase}'], prior[f'{mode}-{old}-p{phase}']
            assert measurements(current) == measurements(previous), (mode,new,phase)
            assert current['checkpoints'] == previous['checkpoints']
            identity.append({'current': name(current), 'previous': name(previous), 'frames':512, 'exact':True})
assert len(identity) == 28

def distribution(values, expected):
    values = sorted(values)
    n = len(values)
    mean = sum(values) / n
    return {'mean':mean, 'min':values[0], 'max':values[-1],
            'p05':values[math.floor(.05*(n-1))], 'p95':values[math.floor(.95*(n-1))],
            'spatialSD':math.sqrt(sum((v-mean)**2 for v in values)/n),
            'referenceRMS':math.sqrt(sum((v-expected)**2 for v in values)/n)}

rows = []
for r in results:
    c = r['config']
    independent = 1 if c.get('frontBody') else math.prod(1 - a for a in c['alphas'])
    means = [f['mean'] for f in r['frames']]
    mean_sd = math.sqrt(sum((v-r['temporalMean'])**2 for v in means)/len(means))
    rows.append({'name':name(r), 'independentTransmission':independent,
                 'checkpoints':r['checkpoints'], 'frameMeanRange':[min(means),max(means)], 'frameMeanSD':mean_sd,
                 'pixelMeans':distribution(full[name(r)]['pixelMeans'],independent),
                 'pixelMeansSHA256':sha(struct.pack('<'+'d'*r['maskPixels'],*full[name(r)]['pixelMeans']))})

summary = {'baseCommit':report['baseCommit'], 'sourceSHA256':report['sourceSHA256'],
           'verdict':'REJECT: spatial swaps remove coherent patch swings, but shared rates leave per-pixel temporal bias and both swapped arms remain too dark and noisier after TAAU.',
           'cases':64, 'framesPerCase':512, 'sampleCounts':[24,128,512], 'startingPhases':[0,977],
           'pilotCasesWithExact128FrameTracesAndImages':18, 'priorIdentity':identity, 'equivalences':equivalences,
           'geometryMask':{'pixels':12544,'bounds':results[0]['bounds']}, 'rows':rows,
           'limits':['Static constant-alpha basic materials; not real groom, fibre BSDF, motion or cost qualification.',
                     'Per-material two-card control; merged pair intentionally retains one spatial field.',
                     'Linear RGBA8 output; unfiltered scale 1 and TAAU scale .66 are different paths.',
                     'Spatial field is interleavedGradientNoise(screenCoordinate.xy) or .yx; identity reconstructs the production expression.',
                     'Whole-prefix means include startup; tails are last 64 frames, except 24-frame checkpoint.',
                     'tailTemporalRMS is mean consecutive-frame pixel RMS in linear 0..1 values; frame one contributes zero at n24.',
                     'Per-pixel distributions use 512-frame means; no independent-sampling or convergence theorem is claimed.',
                     'No specific TAAU internal cause established; no runtime, asset, threshold or calibration change.']}
(root/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
(root/'case-records.jsonl').write_text(''.join(json.dumps(r,separators=(',',':'))+'\n' for r in results))
(root/'pilot-records.jsonl').write_text(''.join(json.dumps(r,separators=(',',':'))+'\n' for r in pilot['results']))
print('PASS: 64 actual Apple/Metal WebGPU cases x 512 frames; live rates/fields, clocks, mask, source and 192 image hashes.')
print('PASS: endpoints, opaque-body depth and four independent blend references in both paths.')
print('PASS: eight equivalences cover shared/single/merged controls and draw-order reversal for both spatial candidates.')
print('PASS: eighteen pilot cases reproduce all first 128 frame traces and both checkpoint images exactly.')
print('PASS: twenty-eight prior controls reproduce all 512 frame measurements and all three images exactly.')
for row in rows:
    if 'half' in row['name'] and 'blend' not in row['name'] and 'single' not in row['name']:
        s=row['checkpoints'][-1]
        print(row['name'], {k:s[k] for k in ['temporalMean','tailMean','tailTemporalRMS']},
              'patch SD',row['frameMeanSD'],'pixel mean SD',row['pixelMeans']['spatialSD'])
print(summary['verdict'])
