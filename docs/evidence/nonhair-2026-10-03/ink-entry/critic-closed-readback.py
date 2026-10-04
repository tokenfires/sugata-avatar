import datetime, hashlib, json, os, pathlib, platform, re, sys

started = datetime.datetime.now(datetime.timezone.utc).isoformat()
root = pathlib.Path('/Users/robault/GitHub/sugata-avatar')
packet = root / 'docs/evidence/nonhair-2026-10-03/ink-entry'
def record(p):
    b = p.read_bytes()
    return {'file': str(p.relative_to(root)), 'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()}
author = json.loads((packet / 'AUTHOR.json').read_text())
accepted = []
for name, expected in author['acceptedSources'].items():
    r = record(root / name)
    assert r['sha256'] == expected, name
    accepted.append(r)
assert len(accepted) == 380
assert (root / 'packages/testbed/src/showcase.html').read_bytes() == (packet / 'showcase.original.html.source').read_bytes()
assert (root / 'looks/INK-DENIM.md').read_bytes() == (packet / 'INK-DENIM.original.md.source').read_bytes()
route = root / author['route']
route_record = record(route) if route.exists() else None
if route_record:
    assert route.read_bytes() == (packet / 'showcase.candidate.html.source').read_bytes()
out = root / 'dist-ink-entry-candidate'
assert out.is_dir()
outputs = [record(p) for p in sorted(out.rglob('*')) if p.is_file()]
html = []
for p in sorted(out.rglob('*.html')):
    text = p.read_text()
    title = re.search(r'<title>(.*?)</title>', text, re.S)
    html.append({'file': str(p.relative_to(out)), 'title': title.group(1) if title else None, 'inkEntryMarker': 'try-ink-denim' in text})
assert not any(r['inkEntryMarker'] for r in html)
absent = [out / 'src/showcase-ink-entry-review.html', packet / 'compiled.candidate.html.source', packet / 'BUILD.json']
assert all(not p.exists() for p in absent)
log = (packet / 'BUILD.log').read_text()
assert '216 modules transformed' in log and 'built in 306ms' in log
assert "ENOENT" in log and 'build-candidate.mjs:16:15' in log
files = ['PLAN.md','ISOLATION.md','author.py','build-candidate.mjs','BUILD.log','AUTHOR.json','ROOT-CONTRACT.json','showcase.original.html.source','showcase.candidate.html.source','INK-DENIM.original.md.source','INK-DENIM.candidate.md.source','CRITIC-CONTRACT.md','CRITIC-CONTRACT-PINS.json','CRITIC-CLOSED.md','critic-closed-readback.py']
pins = [record(packet / f) for f in files]
receipt = {'scope':'FS-only independent failure readback; no build/author/guard/browser execution','command':'python3 docs/evidence/nonhair-2026-10-03/ink-entry/critic-closed-readback.py','interpreter':sys.executable,'pythonVersion':platform.python_version(),'pid':os.getpid(),'started':started,'ended':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'passed','sourceSha256':record(pathlib.Path(__file__))['sha256'],'accepted':accepted,'packetPins':pins,'isolatedRouteAtReadback':route_record,'outputs':outputs,'outputCount':len(outputs),'outputBytes':sum(r['bytes'] for r in outputs),'html':html,'absent':[str(p.relative_to(root)) for p in absent],'qualification':'wrapper output lookup failure; no UI/adoption evidence'}
dest = packet / 'CRITIC-CLOSED-PINS.json'
with dest.open('x') as f:
    json.dump(receipt,f,indent=2); f.write('\n')
print(json.dumps({'status':receipt['status'],'pid':receipt['pid'],'started':started,'ended':receipt['ended'],'acceptedPins':len(accepted),'outputCount':len(outputs),'outputBytes':receipt['outputBytes'],'htmlCount':len(html),'readerSha256':receipt['sourceSha256'],'critiqueSha256':record(packet/'CRITIC-CLOSED.md')['sha256'],'receiptSha256':record(dest)['sha256']}))
