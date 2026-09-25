from pathlib import Path
import hashlib
import json
import math
import struct

root = Path('tmp/hair-sep25/layer-correlation')
out = root / 'final-captures'
read = lambda p: json.loads(p.read_text())
sha = lambda data: hashlib.sha256(data).hexdigest()
report = read(out / 'report.json')
results = report['results']
assert len(results) == 38
for name, expected in report['sourceSHA256'].items():
    assert sha(Path(name).read_bytes()) == expected, name
by_name = {(r['config']['temporal'], r['config']['name']): r for r in results}
full = {(mode, name): read(out / f'{mode}-{name}.json') for mode, name in by_name}
equivalence = []
for mode in ['off', 'taau']:
    for a, b in [('quarter', 'quarter-pair'), ('half', 'half-pair'),
                 ('three-quarter', 'three-quarter-pair'), ('half-pair', 'half-reversed'),
                 ('half-pair', 'half-merged'), ('half-merged', 'half-merged-reversed')]:
        x, y = full[mode, a], full[mode, b]
        assert x['pixelMeans'] == y['pixelMeans'], (mode, a, b)
        assert [f['mean'] for f in x['frames']] == [f['mean'] for f in y['frames']], (mode, a, b)
        assert x['imageSHA256'] == y['imageSHA256'], (mode, a, b)
        equivalence.append({'mode': mode, 'a': a, 'b': b, 'exact': True})
    for name, expected in [('empty', 1), ('zero', 1), ('opaque', 0), ('front-body', 1)]:
        r = full[mode, name]
        assert all(f['min'] == f['max'] == expected for f in r['frames']), (mode, name)
    for name, expected in [('blend-half', .5), ('blend-half-pair', .25), ('blend-mixed-pair', .1875)]:
        r = full[mode, name]
        assert all(abs(f['mean'] - expected) <= 1 / 255 for f in r['frames']), (mode, name)
    for r in [v for (m, _), v in by_name.items() if m == mode]:
        assert r['maskPixels'] == 12544 and r['bounds'] == {'x0':72,'x1':184,'y0':72,'y1':184}
        assert r['actual']['stats']['backend'] == 'webgpu'
        assert r['actual']['stats']['temporalAA'] == mode
        assert r['actual']['stats']['resolutionScale'] == (1 if mode == 'off' else .66)
        assert [f['frameId'] for f in r['frames']] == list(range(1, 129))
        assert sha((out / f'{mode}-{r["config"]["name"]}.png').read_bytes()) == r['imageSHA256']
        if r['config']['mode'] == 'stochastic' and len(r['config']['alphas']) == 2 and not r['config'].get('phases'):
            for frame in r['frames']:
                assert len(set(frame['offsets'])) == 1, r['config']
assert full['off', 'mixed-pair']['pixelMeans'] == full['off', 'three-quarter']['pixelMeans']

first = read(root / 'captures/report.json')['results']
for r in first:
    key = r['config']['temporal'], r['config']['name']
    old = read(root / 'captures' / f'{key[0]}-{key[1]}.json')
    new = full[key]
    for field in ['frames', 'pixelMeans', 'temporalMean', 'imageSHA256']:
        assert old[field] == new[field], (key, field)

rows = []
for r in results:
    config = r['config']
    name = config['temporal'] + '-' + config['name']
    alphas = config['alphas']
    phase = (config.get('phases') or [0, 0])[-1]
    delta = (phase * 0.6180339887498949) % 1
    shared = 1 - max(alphas, default=0)
    if config.get('phases'): shared = abs(.5 - delta)
    if config.get('frontBody'): shared = 1
    independent = 1 if config.get('frontBody') else math.prod(1-a for a in alphas)
    rows.append({'name': name, 'independentTransmission': independent,
                 'sharedThresholdPrediction': shared, 'temporalMean': r['temporalMean'],
                 'finalMean': r['final']['mean'], 'imageSHA256': r['imageSHA256'],
                 'pixelMeansSHA256': sha(struct.pack('<' + 'd' * r['maskPixels'], *full[config['temporal'],config['name']]['pixelMeans']))})
summary = {
    'baseCommit': report['baseCommit'], 'sourceSHA256': report['sourceSHA256'],
    'finding': 'The current threshold correlates overlapping layers in this fixture; a second equal-alpha card adds no opacity.',
    'cases': len(rows), 'framesPerCase': 128, 'repeatedCasesExact': len(first),
    'geometryMask': {'pixels':12544, 'bounds':{'x0':72,'x1':184,'y0':72,'y1':184}},
    'exactEquivalence': equivalence, 'rows': rows,
    'limits': ['Constant-alpha unlit cards through configureHairMaterial; not the real groom or fibre BSDF.',
               'Linear RGBA8 output, no tone mapping, grade or AO; TAAU has its default scene scale.',
               'Temporal mean includes all 128 frames; final mean is frame 128, not a claim of convergence.',
               'A fixed per-material phase shift is not a general independent-layer estimator.',
               'No renderer, asset, material, threshold or acceptance change; no all-motion, cost or full-suite result.']
}
(root / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
# Compact records retain every frame, actual pipeline and material flags in a portable archive.
(root / 'case-records.jsonl').write_text(''.join(json.dumps(r, separators=(',', ':')) + '\n' for r in results))
print('PASS: 38 actual WebGPU cases; endpoints, opaque-body depth and analytic blend references.')
print('PASS: 12 exact pair equivalences for all per-frame means, per-pixel means and final images.')
print('PASS: 34 repeated cases match every frame trace, per-pixel mean and final image exactly.')
print('PASS: geometry mask, capture clocks, shared uniforms, source/asset and image hashes.')
print('CONFIRMED in fixture: shared-threshold overlap differs from independent-layer compositing.')
