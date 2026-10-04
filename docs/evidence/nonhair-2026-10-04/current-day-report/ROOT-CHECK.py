from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, os, re, subprocess
from urllib.parse import urlparse, unquote

started = datetime.now(timezone.utc).isoformat()
root = Path(__file__).resolve().parents[4]
packet = Path(__file__).resolve().parent
sha = lambda data: hashlib.sha256(data).hexdigest()
rows = re.findall(r'^\| ([^|]+) \| ([0-9a-f]{64}) \|$', (packet/'WORTH.md').read_text(), re.M)
assert len(rows) == 13
checked = []
for name, expected in rows:
    if name.endswith('/PLAN.md'):
        data = (packet/'INITIAL-PLAN.md').read_bytes()
        epoch = 'retained initial plan'
    elif name == 'docs/WORK-WINDOW-2026-10-02.md':
        data = subprocess.check_output(['git', 'show', '089a7a8:'+name], cwd=root)
        epoch = 'entry Git blob'
    else:
        data = (root/name).read_bytes()
        epoch = 'current unchanged input'
    assert sha(data) == expected, name
    checked.append(dict(path=name, bytes=len(data), sha256=expected, epoch=epoch))

report = root/'docs/DAY-REPORT-2026-10-04.md'
assert sha(report.read_bytes()) == '6d500ae2cb0e40ade7c5c3182bbeec689caccf4f18d0e604bc2232410c06eac4'
assert sha((packet/'FINAL.md').read_bytes()) == '01d8beebbf6ea5307f6cb38e2ffa49ff037d160ebbc520bf75166c9cc739fbd1'
assert sha((packet/'PLAN.md').read_bytes()) == 'a2dc73cb64f49069e575f4778ad516ddf011d9208a5ea677083ba5d54187a351'
assert sha((root/'docs/WORK-WINDOW-2026-10-02.md').read_bytes()) == '37b4a49f74135085e9bf6b43f973eb737a205c56103f8214561e02cb26c0d360'
links = []
for label, target in re.findall(r'\[([^\]]+)\]\(([^)]+)\)', report.read_text()):
    url = urlparse(target)
    if url.scheme:
        assert url.hostname == '127.0.0.1' and url.port == 5173
        path = unquote(url.path)
        local = Path(path[4:]) if path.startswith('/@fs/') else root/'packages/testbed'/path.lstrip('/')
    else:
        local = (report.parent/unquote(url.path)).resolve()
    assert local.is_file(), (target, local)
    links.append(dict(target=target, local=str(local), check='file exists; no HTTP/native claim'))
command = ['git', 'diff', '--name-status', '68662cd..089a7a8', '--', 'packages', 'assets', 'tools/figure-pipeline']
names = subprocess.check_output(command, cwd=root, text=True)
assert names == ''
result = dict(pid=os.getpid(), startedAt=started, endedAt=datetime.now(timezone.utc).isoformat(), status='A', worthInputs=checked, report=dict(bytes=report.stat().st_size, sha256=sha(report.read_bytes())), links=links, trackedAvatarDiff=dict(command=command, output=names), limits='FS/source reconciliation only; no runtime, capture, ignored-asset audit or all-motion acceptance')
(packet/'ROOT-RESULT.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(dict(pid=result['pid'], startedAt=started, endedAt=result['endedAt'], status='A', inputPins=len(checked), linkOccurrences=len(links), resultSha256=sha((packet/'ROOT-RESULT.json').read_bytes()))))
