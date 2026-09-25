from pathlib import Path
import hashlib
import json

root = Path('tmp/hair-sep25/pattern-phase')
sha = lambda data: hashlib.sha256(data).hexdigest()
read = lambda name: json.loads((root / name).read_text())
for name, expected in read('source-hashes.json').items():
    assert sha(Path(name).read_bytes()) == expected, name
zero = read('zero-tips/measurements.json')[0]
candidate = read('candidate-tips/measurements.json')[0]
zero_images = sorted((root / 'zero-tips').glob('*.png'))
assert len(zero_images) == 3
for f in zero_images:
    assert f.read_bytes() == (Path('tmp/hair-sep24/runtime-coverage/after-metadata') / f.name).read_bytes(), f.name
for region in zero['summary']:
    assert zero['summary'][region]['pixels'] == candidate['summary'][region]['pixels'], region
assert (root / 'zero-tips/stochastic.png').read_bytes() != (root / 'candidate-tips/stochastic.png').read_bytes()
opacity = {view: read(f'candidate-opacity/{view}-measurements.json') for view in ['portrait', 'rear34']}
baseline_opacity = {view: json.loads(Path(f'tmp/hair-sep24/runtime-coverage/baseline-opacity/{view}-measurements.json').read_text()) for view in ['portrait', 'rear34']}
for view, result in opacity.items():
    for region in ['all', 'mass', 'curtain', 'outside', 'hidden']:
        assert result[region]['pixels'] == baseline_opacity[view][region]['pixels']
    assert result['outside']['mean'] >= 0.97
    assert 0.97 <= result['hidden']['mean'] <= 1.03
    if view == 'portrait':
        assert 0.97 <= result['curtainHidden']['mean'] <= 1.03
phase = read('phase-controls/report.json')
assert len(phase['plates']) == 9
for plate in phase['plates']:
    assert sha((root / 'phase-controls' / plate['name']).read_bytes()) == plate['sha256']
    assert plate['actual']['backend'] and plate['actual']['stats']['temporalAA'] == 'taau'
    assert plate['actual']['stats']['resolutionScale'] == 0.66
images = {str(f.relative_to(root)): sha(f.read_bytes()) for f in sorted(root.glob('*/*.png'))}
summary = {
    'baseCommit': '5606973415cd372ae99f031dc54302531d132f1d',
    'verdict': 'Rejected: tip and opacity gates remain red; seed dependence increases and focused C2/C3 controls fail.',
    'sourceSHA256': read('source-hashes.json'),
    'tips': {'baseline': zero['summary'], 'candidate': candidate['summary'], 'steps': 24},
    'opacity': {'baseline': baseline_opacity, 'candidate': opacity, 'steps': 24},
    'zeroControlExactImages': len(zero_images),
    'phaseControl': {k: v for k, v in phase.items() if k != 'plates'},
    'arithmeticSummary': read('arithmetic.json')['summary'],
    'images': images,
    'limits': ['Existing C thresholds on one fixed shipping mask, not the full HairOIT suite.',
               'White defect changes the outer offset only; frozen defect freezes both offsets.',
               'CPU arithmetic uses doubles and does not establish GPU precision or unbiased coverage.',
               'Static 24/128-step runs only; no motion, geometry, build, cost or full-suite qualification.']
}
(root / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print('PASS: all source and shipping asset hashes unchanged.')
print('PASS: zero-inner-phase route reproduces all three shipping images exactly.')
print('PASS: all geometry mask counts preserved; candidate affects rendered output.')
print('PASS: independent opacity controls and nine WebGPU/TAAU phase captures verified.')
print('REJECT: candidate remains red on T1/T2/C4 and focused C2/C3 controls.')
