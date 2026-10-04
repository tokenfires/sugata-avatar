import datetime, hashlib, json, os, pathlib, platform, struct, sys

started = datetime.datetime.now(datetime.timezone.utc).isoformat()
repo = pathlib.Path('/Users/robault/GitHub/sugata-avatar')
folder = pathlib.Path(__file__).resolve().parent
def digest(data): return hashlib.sha256(data).hexdigest()
critic = json.loads((folder / 'CRITIC-VALUE-PINS.json').read_text())
assert critic['status'] == 'passed'
assert digest((folder / 'critic-value-pins.py').read_bytes()) == critic['sourceSha256']
for row in critic['pins']:
    data = (repo / row['file']).read_bytes()
    assert len(data) == row['bytes'] and digest(data) == row['sha256'], row['file']
    if 'dimensions' in row:
        assert data[:8] == b'\x89PNG\r\n\x1a\n'
        assert list(struct.unpack('>II', data[16:24])) == row['dimensions']
root = json.loads((folder / 'ROOT-OPTIONS.json').read_text())
assert root['candidate'] == root['recovered']
assert root['candidate']['hair'] == 'bob02'
assert root['candidate']['wardrobe']['outfit'] == ['female_elegantsuit01', 'shoes01']
for target in root['targetsAbsent']:
    assert not (repo / target).exists()
now = datetime.datetime.now(datetime.timezone.utc)
assert now >= datetime.datetime(2026, 10, 4, 2, 3, tzinfo=datetime.timezone.utc)
result = dict(status='closed-expired-before-root-admission', verification='18 critic pins, checker source, PNG headers, exact option roundtrip and target absence independently reconciled; no helper rerun', command='python3 docs/evidence/nonhair-2026-10-03/stone-slate-value/root-close.py', pid=os.getpid(), python=sys.executable, version=platform.python_version(), started=started, ended=now.isoformat(), sourceSha256=digest(pathlib.Path(__file__).read_bytes()), criticReceiptSha256=digest((folder / 'CRITIC-VALUE-PINS.json').read_bytes()), pins=critic['pins'], targetsAbsent=root['targetsAbsent'], outcome='Conditional artistic value retained. No native contract, browser, Avatar, GPU, build, product changes or recipe adoption. Expired worth window is not extended.')
with (folder / 'ROOT-CLOSED.json').open('x') as handle:
    json.dump(result, handle, indent=2); handle.write('\n')
print(json.dumps({key: result[key] for key in ['status', 'pid', 'started', 'ended', 'sourceSha256']}))
