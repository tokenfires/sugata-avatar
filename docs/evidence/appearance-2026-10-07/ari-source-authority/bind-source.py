"""Hash-only current source admission against one saved neutral summary; no asset decode."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os

packet = Path(__file__).resolve().parent
base = packet.parents[3]
started = datetime.now(timezone.utc).isoformat()
pin = json.loads((packet / 'SAVED-RECORD-PIN.json').read_text())
record_bytes = (base / pin['path']).read_bytes()
assert len(record_bytes) == pin['bytes']
assert hashlib.sha256(record_bytes).hexdigest() == pin['sha256']
saved = json.loads(record_bytes)
expected_source = 'b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14'
expected_report = 'a1c1ec374c41f2fd1c197d666a6b25d7c0f11bf52b796c4a5b02cc03270ed3e9'
readme = (base / 'docs/evidence/wardrobe-2026-09-30/skeleton-export-bridge/README.md').read_text()
assert expected_source in readme and expected_report in readme
assert saved['rawReportSHA256'] == expected_report
assert saved['rawRoot'] == 'captures/skeleton-export-bridge-2026-09-30-v1'
assert saved['passed'] is True

assets = []
for name in ['assets/figures/figure_g050.glb', 'assets/wardrobe/body/g050.glb']:
    path = base / name
    total = 0
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
            total += len(chunk)
    assets.append({'path': name, 'bytes': total, 'sha256': digest.hexdigest(), 'read_scope': 'One streamed hash only; no header or data decoding.'})

match = assets[0]['sha256'] == expected_source
result = {
    'started_at': started, 'completed_at': datetime.now(timezone.utc).isoformat(), 'pid': os.getpid(),
    'command': 'python3 docs/evidence/appearance-2026-10-07/ari-source-authority/bind-source.py',
    'observer_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'current_assets': assets, 'record_pin': pin,
    'expected_standalone_source_sha256_from_bridge': expected_source,
    'current_standalone_matches_recorded_bridge': match,
    'wardrobe_digest_differs': assets[1]['sha256'] != assets[0]['sha256'],
    'saved_summary_witness': {
        'raw_root': saved['rawRoot'], 'recorded_raw_report_sha256': saved['rawReportSHA256'],
        'recorded_scope': saved['scope'], 'recorded_passed': saved['passed'],
        'nativeVersusExport': saved['comparisons']['nativeVersusExport'],
        'mappedBody': saved['comparisons']['mappedBody'], 'morphAdmission': saved['morphAdmission']
    },
    'decision': 'Reuse the exact historical neutral standalone source/frame baseline; stop inquiry here.' if match else 'Stop on source identity mismatch; do not reuse bridge authority for current source.',
    'limits': [
        'One current hash invocation over two assets; no GLB/packed offset/gzip parse, calculation or renderer.',
        'Saved summary fields are copied historical observations, not newly repeated comparisons.',
        'Raw report digest is recorded by the pinned summary and README; raw report bytes were not freshly hashed or decoded.',
        'Different wardrobe bytes establish file identity distinction, not geometry differences, fit or incompatibility.',
        'Neutral bridge covers named body/map/rest frame; new Ari values, auxiliary anatomy, rig/pose/motion, garment/fit and appearance remain unqualified.'
    ]
}
(packet / 'BINDING.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'source_match': match, 'current_assets': assets, 'binding_sha256': hashlib.sha256((packet / 'BINDING.json').read_bytes()).hexdigest(), 'pid': os.getpid()}, indent=2))
if not match:
    raise SystemExit(2)
