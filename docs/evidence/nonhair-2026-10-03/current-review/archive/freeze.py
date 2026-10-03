"""Freeze the refused overview packet; never rerun its browser observer."""
from pathlib import Path
import datetime, hashlib, json, os, shutil, urllib.request

base = Path(__file__).resolve().parent
root = Path(__file__).resolve().parents[4]
raw = root / 'captures/october3-review-2026-10-03-v1'
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
report = json.loads((raw / 'report.json').read_text())
assert report['status'] == 'failed' and report['views'] == []
assert report['cleanup'] == {'page': 'closed', 'browser': 'closed'}
assert len(report['errors']) == 1 and 'ENOENT' in report['errors'][0]
assert sha(raw / 'report.json') == '20e2e393aee864766fe347b6ec5773fde6f5db337e7b35bc56eaec3dffaaaf5d'
for rel, expected in report['sourceHashes'].items():
    actual = base / 'candidate-today-review.js' if rel == 'packages/testbed/today-review.js' else root / rel
    assert sha(actual) == expected
    assert sha(raw / 'sources' / rel) == expected
pins = {**report['preservationPins'], **report['imageInputHashes']}
for rel, expected in pins.items(): assert sha(root / rel) == expected
assert sha(root / 'packages/testbed/today-review.js') == sha(base / 'before-today-review.js') == '4794f9646867e5b359d05a976ac63230d53b35abc9cd264a5bb231c1e44c28cc'
assert (base / 'CRITIQUE.md').is_file() and (base / 'independent.json').is_file()
json.loads((base / 'independent.json').read_text())
archive = base / 'archive'
assert not archive.exists()
files = {}
def copy(source, relative):
    target = archive / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    assert sha(target) == sha(source)
    files[str(relative)] = {'sha256': sha(source), 'bytes': source.stat().st_size}
for p in sorted(base.rglob('*')):
    if p.is_file(): copy(p, p.relative_to(base))
for p in sorted(raw.rglob('*')):
    if p.is_file(): copy(p, Path('capture') / p.relative_to(raw))
copy(base.parent / 'review.html', Path('candidate-review.html'))
copy(base.parent / 'EXPRESSION-VALUE.md', Path('EXPRESSION-VALUE.md'))
for version in [1, 2]:
    output = root / f'captures/october3-review-build-2026-10-03-v{version}'
    receipt = json.loads((base / ('BUILD-RECEIPT.json' if version == 1 else 'BUILD-RECEIPT-final.json')).read_text())
    assert receipt['exitCode'] == 0
    for rel, info in receipt['files'].items():
        p = output / rel
        assert sha(p) == info['sha256'] and p.stat().st_size == info['bytes']
        copy(p, Path(f'build-v{version}') / rel)
for rel in ['packages/testbed/today-review.js', 'docs/evidence/appearance-2026-10-02/review.html', 'docs/evidence/nonhair-2026-10-03/review.html', 'docs/evidence/nonhair-2026-10-03/EXPRESSION-VALUE.md']:
    pins[rel] = sha(root / rel)
manifest = {'created': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'pid': os.getpid(), 'files': files, 'externalPins': pins, 'status': 'Observer refused; previous hub restored; isolated candidate only', 'completedViews': 0, 'unindexedHubImages': 1, 'reviewImages': 0, 'limit': 'Recorded candidate runtime hashes differ intentionally from restored live shortcut. Frozen copies retain runtime inputs. No new browser or appearance qualification.'}
mp = archive / 'manifest.json'
mp.write_text(json.dumps(manifest, indent=2) + '\n')
for rel, info in files.items(): assert sha(archive / rel) == info['sha256']
for rel, expected in pins.items(): assert sha(root / rel) == expected
for p in archive.rglob('*'):
    if p.is_file(): p.chmod(0o444)
for p in raw.rglob('*'):
    if p.is_file(): p.chmod(0o444)
http = []
for p in [base / 'RECEIPT.md', base / 'ROOT-DECISION.md', base / 'CRITIQUE.md', raw / 'desktop-hub.png']:
    with urllib.request.urlopen('http://127.0.0.1:5173/@fs/' + str(p), timeout=4) as response:
        assert response.status == 200
        assert hashlib.sha256(response.read()).hexdigest() == sha(p)
        http.append({'path': str(p.relative_to(root)), 'status': 200, 'exactBytes': True})
result = {'started': started, 'finished': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'pid': os.getpid(), 'command': 'python3 docs/evidence/nonhair-2026-10-03/current-review/freeze.py', 'files': len(files), 'bytes': sum(v['bytes'] for v in files.values()), 'externalPins': len(pins), 'manifestSHA256': sha(mp), 'rawArchiveBytesVerified': True, 'http': http, 'jobs': 'No live owned job; review server retained; heartbeat ACTIVE'}
(base / 'FREEZE-RECEIPT.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
