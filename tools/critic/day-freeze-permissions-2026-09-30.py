"""Remove only write bits from the exact independently reviewed archive file set."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import stat
import sys

ROOT = Path(__file__).resolve().parents[2]
out = ROOT / 'captures/day-freeze-permissions-2026-09-30-v1'
out.mkdir(exist_ok=False)
now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
def digest(p):
    with p.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

report = {'started': now(), 'pid': os.getpid(), 'status': 'planning', 'files': [], 'completed': 0, 'errors': []}
def save():
    (out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')

save()
(out / 'instrument.py').write_bytes(Path(__file__).read_bytes())
try:
    source = ROOT / 'captures/day-preservation-2026-09-30-v1/report.json'
    report['auditSHA256'] = digest(source)
    assert report['auditSHA256'] == 'be9d30796168357c1374684ffb0b5b0860e6c31724d0ef0a01db89b6398438d9'
    audit = json.loads(source.read_text())
    expected = {row['path']: row['sha256'] for row in audit['manifests']}
    current = {str(p.relative_to(ROOT)): digest(p) for p in (ROOT / 'docs/evidence').rglob('*archive*.json') if '2026-09-30' in str(p.relative_to(ROOT))}
    assert current == expected and len(expected) == 28
    seen = set()
    for row in audit['manifests']:
        manifest = json.loads((ROOT / row['path']).read_text())
        entries = manifest['files'] if isinstance(manifest.get('files'), list) else manifest['entries']
        by_path = {entry['path']: entry for entry in entries}
        for file in row['writable']:
            assert file not in seen and file.startswith('captures/')
            seen.add(file)
            p = ROOT / file
            assert p.resolve() == p and not p.is_symlink()
            meta = p.stat()
            assert stat.S_ISREG(meta.st_mode) and meta.st_nlink == 1
            old = stat.S_IMODE(meta.st_mode)
            assert old == 0o644
            entry = by_path[file]
            assert meta.st_size == entry['bytes'] and digest(p) == entry['sha256']
            report['files'].append({'path': file, 'bytes': entry['bytes'], 'sha256': entry['sha256'],
                                    'oldMode': oct(old), 'newMode': oct(old & ~0o222)})
    assert len(report['files']) == 3826
    report['status'] = 'applying'
    save()  # The complete reversible mode plan is durable before any chmod.
    for entry in report['files']:
        p = ROOT / entry['path']
        assert stat.S_IMODE(p.stat().st_mode) == int(entry['oldMode'], 8)
        assert p.stat().st_size == entry['bytes'] and digest(p) == entry['sha256']
        p.chmod(int(entry['newMode'], 8))
        assert stat.S_IMODE(p.stat().st_mode) == int(entry['newMode'], 8)
        assert digest(p) == entry['sha256']
        report['completed'] += 1
        if report['completed'] % 256 == 0:
            save()
    report['status'] = 'completed'
except Exception as error:
    report['status'] = 'failed'
    report['errors'].append(repr(error))
finally:
    report['finished'] = now()
    save()
print(json.dumps({'status': report['status'], 'completed': report['completed'], 'reportSHA256': digest(out / 'report.json')}))
sys.exit(0 if report['status'] == 'completed' else 1)
