"""Freeze this closed artistic packet; bytes support provenance, not appearance."""
from pathlib import Path
import datetime, hashlib, json, os, shutil, urllib.request, re

root = Path(__file__).resolve().parents[4]
base = Path(__file__).resolve().parent
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
receipt = json.loads((base / 'GENERATION-RECEIPT.json').read_text())
independent = json.loads((base / 'independent.json').read_text())
assert sha(base / 'GENERATION-RECEIPT.json') == independent['generationReceiptSHA256']
for witness in independent['records']:
    p = Path(witness['path'])
    if not p.is_absolute(): p = root / p
    assert sha(p) == witness['sha256']
    assert p.stat().st_size == witness['bytes']
    assert receipt['records'][witness['path']]['sha256'] == witness['sha256']
assert sha(base / 'CRITIQUE.md') == '9cd3611a2eb25f8bbf4b8ca4bc1848f6a1a9b5f95dd490c584e151b72688a9b4'
assert sha(base / 'independent.json') == 'ed3e224eb24ad41365ec51f06cb444aadb528dc7465d2dea2d2bec539bae5c25'
prior = json.loads((base.parent / 'mulberry/archive/manifest.json').read_text())
pins = dict(prior['externalPins'])
for rel in ['captures/mobile-body-jitter-2026-10-03-v1/canvas.png', 'docs/evidence/nonhair-2026-10-03/mobile-toolbar/archive/capture/desktop-portrait.png', 'docs/evidence/nonhair-2026-10-03/GARMENT-CONCEPT-VALUE.md']:
    pins[rel] = sha(root / rel)
for rel, expected in pins.items(): assert sha(root / rel) == expected, rel
archive = base / 'archive'
# One owned incomplete freeze may resume after the witnessed HTTP-path refusal.
assert not archive.exists() or not (base / 'FREEZE-RECEIPT.json').exists()
files = {}
for p in sorted(base.rglob('*')):
    if not p.is_file(): continue
    rel = p.relative_to(base)
    if 'archive' in rel.parts: continue
    dst = archive / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    if not dst.exists() or sha(dst) != sha(p):
        shutil.copy2(p, dst)
    files[str(rel)] = {'sha256': sha(p), 'bytes': p.stat().st_size}
    assert sha(dst) == sha(p)
manifest = {'created': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'pid': os.getpid(), 'files': files, 'externalPins': pins, 'contextPinLimit': 'Prior packet source/asset pins are preservation witnesses, not imagegen inputs.', 'generationCount': 1, 'status': 'Raster refused; written open-layer intent retained; no native/fit acceptance'}
mp = archive / 'manifest.json'
mp.write_text(json.dumps(manifest, indent=2) + '\n')
http = []
for rel in ['review.html'] + re.findall(r'(?:href|src)="([^"]+)"', (base / 'review.html').read_text()):
    url = 'http://127.0.0.1:5173/@fs/' + str(base) + '/' + rel
    with urllib.request.urlopen(url, timeout=4) as response:
        data = response.read()
        assert response.status == 200
        if rel.endswith('.png'): assert hashlib.sha256(data).hexdigest() == sha(base / rel)
        http.append({'path': rel, 'status': response.status})
for p in archive.rglob('*'):
    if p.is_file(): p.chmod(0o444)
result = {'started': started, 'finished': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'pid': os.getpid(), 'command': 'python3 docs/evidence/nonhair-2026-10-03/overshirt/freeze.py', 'files': len(files), 'bytes': sum(v['bytes'] for v in files.values()), 'externalPins': len(pins), 'manifestSHA256': sha(mp), 'independentWitnessesReconciled': len(independent['records']), 'http': http, 'jobs': 'No live owned imagegen/native/browser/GPU job; review service retained'}
(base / 'FREEZE-RECEIPT.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
