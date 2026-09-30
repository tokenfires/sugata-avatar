"""Freeze the bounded inner-card fallback and its completed still-image comparisons."""
from pathlib import Path
import datetime
import hashlib
import json

root = Path('captures/bob-lower-fallback-v1')
out = Path('docs/evidence/hair-2026-09-29/lower-fallback')
out.mkdir(parents=True, exist_ok=True)
assert not (out / 'archive-manifest.json').exists()
def read(p): return json.loads(p.read_text())
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p, value): p.write_text(json.dumps(value, indent=2) + '\n')
a = read(root / 'candidate-report.json')
assert digest(root / 'candidate.glb') == a['outputSha256']
for p, h in [(a['input'], a['inputSha256']), (a['control'], a['controlSha256']), (a['bodyPath'], a['bodySha256'])]:
    assert digest(Path(p)) == h
for p, h in a['sourceHashes'].items(): assert digest(root / 'source' / p) == h
for item in a['prerequisites']: assert digest(Path(item['file'])) == item['sha256']
paired = read(root / 'paired-static.json')
assert paired['status'] == 'complete' and paired['candidateSha256'] == a['outputSha256']
assert len(paired['rows']) == 13
assert digest(root / 'audit-bob-lower-fallback-static.mjs') == paired['sourceSha256']
reports = []
for group in paired['groups']:
    for item in group['reports']: assert digest(Path(item['file'])) == item['sha256']
for name in ['neutral', 'studio', 'studio-control']:
    base = root / name
    r = read(base / 'report.json')
    assert r['status'] == 'captured' and not r['errors']
    assert len(r['cases']) == (5 if name == 'neutral' else 3)
    for c in r['cases']:
        assert digest(base / c['filename']) == c['imageSha256']
        assert c['candidateLoads'] == 1 and not c['errors']
    for g in r['geometryFiles']: assert digest(base / g['filename']) == g['sha256']
    for p, h in r['sourceHashes'].items():
        target = base / 'source' / p if p.startswith(('tools/', 'packages/')) else Path(p)
        assert digest(target) == h
    reports.append(dict(directory=str(base), reportSha256=digest(base / 'report.json'), pid=r['pid'], finished=r['finished']))
files = [dict(path=str(p), bytes=p.stat().st_size, sha256=digest(p)) for p in sorted(root.rglob('*')) if p.is_file()]
manifest = dict(generated=datetime.datetime.now(datetime.timezone.utc).isoformat(), roots=[str(root)], fileCount=len(files),
                totalBytes=sum(f['bytes'] for f in files), pngCount=sum(f['path'].endswith('.png') for f in files),
                generator=dict(path=str(Path(__file__)), sha256=digest(Path(__file__))), files=files)
summary = dict(status='static appearance positive; fresh moving qualification pending', candidateSha256=a['outputSha256'],
               rejectedInputSha256=a['inputSha256'], qualifiedControlSha256=a['controlSha256'], reports=reports,
               restoredCards=a['restoredCards'], retainedInwardCardCount=len(a['inwardCards']),
               authoring={k:a[k] for k in ['attributes', 'restoredPositionAndNormalRecordsExact', 'allOtherRecordsAndTopologyExact',
                          'restTriangleBodyPairs', 'minimumSelectedVertexClearanceMm', 'negativeVertices', 'sourceHashes']},
               pairedStaticSha256=digest(root / 'paired-static.json'), archive={k:v for k,v in manifest.items() if k != 'files'},
               limits=a['limits'] + ['Actual static images inspected; neither static gain nor body-rest clearance establishes moving acceptance.',
                                    'Raw files are local/ignored; this manifest is not an off-machine backup.'])
write(out / '.summary.pending.json', summary)
write(out / '.archive-manifest.pending.json', manifest)
(out / '.summary.pending.json').replace(out / 'summary.json')
(out / '.archive-manifest.pending.json').replace(out / 'archive-manifest.json')
print(json.dumps(summary['archive'], indent=2))
