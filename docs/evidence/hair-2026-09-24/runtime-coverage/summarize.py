#!/usr/bin/env python3
"""Verify the recorded comparison without starting another GPU job."""
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
BASE = 'c70c8c71da978d25a61fead87aba9f46372f2e48'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read(name):
    return json.loads((HERE / name).read_text())


def report_rows(name):
    metadata = re.compile(r'^\s*(?:hairOITMode|stageHairOITMode|weightedOITPass|temporalAA|resolutionScale)\s')
    return [line.rstrip() for line in (HERE / name).read_text().splitlines()
            if not line.startswith('http://') and not metadata.match(line)]


sources = read('probe-sources.json')
for name, expected in sources.items():
    pinned = subprocess.check_output(['git', 'show', f'{BASE}:{name}'], cwd=ROOT)
    # The GLB is managed by LFS; git show returns its pointer, not the actual payload.
    if not name.endswith('.glb'):
        assert sha(pinned) == expected, name
    if name != 'tools/figure-pipeline/hair_tips.mjs':
        assert sha((ROOT / name).read_bytes()) == expected, name

before = sorted((HERE / 'baseline').glob('*.png'))
after = sorted((HERE / 'after-metadata').glob('*.png'))
assert len(before) == len(after) == 11
assert [p.name for p in before] == [p.name for p in after]
for old, new in zip(before, after):
    assert old.read_bytes() == new.read_bytes(), old.name
assert report_rows('tips-baseline.txt') == report_rows('tips-after-metadata.txt')

tip_rows = {}
text = (HERE / 'tips-after-metadata.txt').read_text()
for arm in ['stochastic', 'cutout', 'blend']:
    body = text.split(f'=== ?hairoit={arm} ===')[1].split('===')[0]
    for key, value in {'stageHairOITMode': arm, 'weightedOITPass': 'false',
                       'temporalAA': 'taau', 'resolutionScale': '0.66'}.items():
        assert re.search(r'^\s*' + key + r'\s+' + re.escape(value) + r'\s*$', body, re.M)
    tip_rows[arm] = {
        name: {'pixels': int(px), 'specklePercent': float(speckle), 'rms': float(rms)}
        for name, px, speckle, rms in re.findall(
            r'^\s*(tips|curtain|mass|skin|backdrop)\s+(\d+)\s+([\d.]+)%\s+([\d.]+)', body, re.M)
    }
    assert len(tip_rows[arm]) == 5

first_scale = read('first-scale-one-image-hashes.json')
for name, expected in first_scale.items():
    assert sha((HERE / 'scale-one-verified' / name).read_bytes()) == expected, name
assert read('scale-one/measurements.json') == read('scale-one-verified/measurements.json')
scale = read('scale-one-verified/measurements.json')[0]['summary']
for name, data in scale.items():
    assert data['pixels'] == tip_rows['stochastic'][name]['pixels'], name

pipelines = {}
for file in ['tips-scale-one-verified.txt', 'opacity-baseline.txt', 'opacity-scale-one.txt']:
    live = [json.loads(line.removeprefix('ACTUAL PIPELINE '))
            for line in (HERE / file).read_text().splitlines() if line.startswith('ACTUAL PIPELINE ')]
    assert len(live) == 1 and live[0]['backend'] and live[0]['aa'] == 'taau', file
    assert live[0]['scale'] == (0.66 if file == 'opacity-baseline.txt' else 1), file
    pipelines[file] = live[0]

opacity = {}
for arm in ['baseline-opacity', 'scale-one-opacity']:
    opacity[arm] = {view: read(f'{arm}/{view}-measurements.json') for view in ['portrait', 'rear34']}
    for view, data in opacity[arm].items():
        assert data['outside']['mean'] >= 0.97
        assert 0.97 <= data['hidden']['mean'] <= 1.03
        if view == 'portrait':
            assert 0.97 <= data['curtainHidden']['mean'] <= 1.03

summary = {
    'baseCommit': BASE,
    'steps': 24,
    'verdict': 'Resolution scale 1 rejected; reporting repair preserves exact images and measurements.',
    'metadataRepair': {'identicalImages': len(before), 'allNonMetadataReportLinesIdentical': True,
                       'sourceSHA256': sha((ROOT / 'tools/figure-pipeline/hair_tips.mjs').read_bytes())},
    'scaleOneRepeat': {'identicalImages': len(first_scale), 'measurementsIdentical': True},
    'baselineTipsRoundedAsPrinted': tip_rows,
    'scaleOneTips': scale,
    'livePipelines': pipelines,
    'opacity': opacity,
    'sourceSHA256BeforeMetadataRepair': sources,
    'images': {str(p.relative_to(HERE)): sha(p.read_bytes()) for p in sorted(HERE.glob('*/*.png'))},
    'limits': ['Static 24-step protocol; no claim of full temporal convergence.',
               'Scene resolution changes body/background too; no cross-scale pixel identity claim.',
               'Sorted blend remains draw-order dependent and exceeds the existing cheek ceiling.',
               'No geometry, performance, motion or full-suite qualification; no renderer or asset promotion.'],
}
(HERE / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print('PASS: 11 metadata before/after images and all non-metadata report lines match exactly.')
print('PASS: corrected scale-one probe reproduces all 3 images and exact measurements.')
print('PASS: live WebGPU/TAAU/scale reports, mask counts and independent opacity controls.')
print('PASS: fixed runtime and asset hashes; only production tip-report metadata changed.')
