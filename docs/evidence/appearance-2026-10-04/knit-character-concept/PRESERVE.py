from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, os, re

started = datetime.now(timezone.utc).isoformat()
p = Path(__file__).resolve().parent
root = Path(__file__).resolve().parents[4]
sha = lambda data: hashlib.sha256(data).hexdigest()
note = (p/'FINAL.md').read_bytes()
assert sha(note) == '37c203e593b00bfe4cd321b904a52ffe48ea3caf2afb3a82cb9780a4bea22ce8'
rows = re.findall(r'^- ([^\n]+): ([a-f0-9]{64})$', note.decode(), re.M)
assert len(rows) == 4
pins = []
for name, expected in rows:
    data = (root/name).read_bytes()
    assert sha(data) == expected, name
    pins.append(dict(path=name, bytes=len(data), sha256=expected))
assert datetime.now(timezone.utc) < datetime(2026, 10, 4, 10, 15, tzinfo=timezone.utc)
final = dict(pid=os.getpid(), startedAt=started, verifiedAt=datetime.now(timezone.utc).isoformat(), decision='A: exact artist-reference delivery only', finalCriticSha256=sha(note), inputs=pins, root='Complete final handoff independently read; source/image/result limits accepted; all four delivered hashes reconciled. No next experiment admitted.')
(p/'FINAL-ROOT.json').write_text(json.dumps(final, indent=2)+'\n')
files = sorted(f for f in p.iterdir() if f.is_file() and f.name != 'MANIFEST.json')
assert all(not f.is_symlink() for f in files)
payloads = [dict(path=f.name, bytes=f.stat().st_size, sha256=sha(f.read_bytes())) for f in files]
manifest = dict(pid=os.getpid(), startedAt=started, endedAt=datetime.now(timezone.utc).isoformat(), payloads=payloads, payloadCount=len(payloads), payloadBytes=sum(x['bytes'] for x in payloads), preservation='Only new owned packet files; contents unchanged; readonly. Editable target/roadmap remain outside. Existing frozen evidence/default original/user tab untouched.')
(p/'MANIFEST.json').write_text(json.dumps(manifest, indent=2)+'\n')
for f in files+[p/'MANIFEST.json']:
    f.chmod(0o444)
print(json.dumps(dict(pid=manifest['pid'], startedAt=started, endedAt=manifest['endedAt'], finalPins=4, payloadCount=len(payloads), payloadBytes=manifest['payloadBytes'], manifestSha256=sha((p/'MANIFEST.json').read_bytes()))))
