import datetime, hashlib, json, os, pathlib, platform, struct, sys
root = pathlib.Path('/Users/robault/GitHub/sugata-avatar')
packet = root/'docs/evidence/nonhair-2026-10-03/review-hub-value'
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
meta = json.loads((packet/'CRITIC-VALUE-PINS.json').read_text())
assert len(meta['pins']) == 19 and meta['status'] == 'passed'
rows = []
for row in meta['pins']:
    data = (root/row['file']).read_bytes()
    assert len(data) == row['bytes']
    assert hashlib.sha256(data).hexdigest() == row['sha256'], row['file']
    if 'dimensions' in row:
        assert data[:8] == b'\x89PNG\r\n\x1a\n'
        assert list(struct.unpack('>II', data[16:24])) == row['dimensions']
    rows.append(row)
assert meta['noteSha256'] == '6e9a81fc0563b6de130cad6fff1765084ec859e0a7724d7cca25d439a7226b7f'
receipt = {'command':'python3 docs/evidence/nonhair-2026-10-03/review-hub-value/root-read.py', 'pid':os.getpid(), 'interpreter':sys.executable, 'pythonVersion':platform.python_version(), 'started':started, 'ended':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'status':'passed', 'pins':rows, 'criticReceiptSha256':hashlib.sha256((packet/'CRITIC-VALUE-PINS.json').read_bytes()).hexdigest(), 'readerSha256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(), 'decision':'Conditional A: fresh bounded static chapter and native layout/link qualification before changing shortcut', 'visualWitnesses':'Root independently viewed all four complete PNGs. Existing cards/stipple and weaker Kitchen hair edge remain. No fresh Avatar or appearance qualification.'}
dest = packet/'ROOT-HANDOFF.json'
with dest.open('x') as f:
    json.dump(receipt,f,indent=2); f.write('\n')
print(json.dumps({k:receipt[k] for k in ['pid','started','ended','status','readerSha256','criticReceiptSha256']}))
