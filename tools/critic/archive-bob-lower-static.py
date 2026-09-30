"""Freeze the completed lower-curve still-image evidence; motion has separate roots."""
from pathlib import Path
import datetime
import hashlib
import json

root = Path('captures/bob-lower-curve-v1')
out = Path('docs/evidence/hair-2026-09-29/lower-curve')
assert not (out / 'archive-manifest.json').exists()
def read(p): return json.loads(p.read_text())
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p, d): p.write_text(json.dumps(d, indent=2) + '\n')
a = read(root / 'candidate-report.json')
assert digest(root / 'candidate.glb') == a['outputSha256']
assert digest(Path(a['input'])) == a['inputSha256']
assert digest(Path(a['bodyPath'])) == a['bodySha256']
assert digest(root / 'bob-lower-curve.mjs') == a['sourceSha256']
for record in a['prerequisites']:
    assert digest(Path(record['file'])) == record['sha256']
for name, source in [('paired-captures', 'audit-bob-lower-captures'), ('dark-controls', 'audit-bob-lower-dark')]:
    record = read(root / f'{name}.json')
    assert record['status'] == 'complete'
    assert record['candidateSha256'] == a['outputSha256']
    assert record['baselineSha256'] == a['inputSha256']
    assert digest(root / f'{source}.mjs') == record['sourceSha256']
reports = []
for name in ['neutral', 'dark-control', 'dark']:
    base = root / name
    report = read(base / 'report.json')
    assert report['status'] == 'captured' and not report['errors']
    assert len(report['cases']) == (5 if name == 'neutral' else 3)
    for case in report['cases']:
        assert digest(base / case['filename']) == case['imageSha256']
        assert case['candidateLoads'] == 1 and not case['errors']
    for item in report.get('geometryFiles', []):
        assert digest(base / item['filename']) == item['sha256']
    for file, expected in report['sourceHashes'].items():
        target = base / 'source' / file if file.startswith(('packages/', 'tools/')) else Path(file)
        assert digest(target) == expected, str(target)
    reports.append(dict(name=name, report=str(base / 'report.json'), sha256=digest(base / 'report.json'),
                        images=len(report['cases']), pid=report['pid'], finished=report['finished']))
files = [dict(path=str(p), bytes=p.stat().st_size, sha256=digest(p))
         for p in sorted(root.rglob('*')) if p.is_file()]
source = Path(__file__)
manifest = dict(generated=datetime.datetime.now(datetime.timezone.utc).isoformat(), roots=[str(root)],
                fileCount=len(files), totalBytes=sum(f['bytes'] for f in files),
                pngCount=sum(f['path'].endswith('.png') for f in files), files=files,
                generator=dict(path=str(source), sha256=digest(source)))
summary = dict(status='static appearance positive in sampled neutral and dark views; motion unqualified',
               baselineSha256=a['inputSha256'], candidateSha256=a['outputSha256'], reports=reports,
               authoring={k:a[k] for k in ['sourceSha256','restTriangleBodyPairs','minimumSelectedVertexClearanceMm',
                    'maximumWidthVectorDeltaMm','maximumEdgeYDeltaMm','maximumOrthogonalityDepartureDegrees',
                    'protectedPositionAndNormalRecordsExact','topologyAndProtectedAttributesExact','joinNormalSummary']},
               archive={k:v for k,v in manifest.items() if k != 'files'},
               limits=['Still images and rest body audit do not qualify moving geometry, garments, hair-hair or all views.',
                       'Original Studio blue lighting is an appearance condition, not natural shade fidelity.',
                       'Raw evidence is local and ignored; the tracked manifest is not an off-machine backup.'])
write(out / '.summary.pending.json', summary)
write(out / '.archive-manifest.pending.json', manifest)
(out / '.summary.pending.json').replace(out / 'summary.json')
(out / '.archive-manifest.pending.json').replace(out / 'archive-manifest.json')
print(json.dumps(summary['archive'], indent=2))
