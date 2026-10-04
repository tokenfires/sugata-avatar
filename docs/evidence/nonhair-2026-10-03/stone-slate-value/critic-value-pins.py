import datetime, hashlib, json, os, pathlib, platform, struct, sys

started = datetime.datetime.now(datetime.timezone.utc).isoformat()
repo = pathlib.Path('/Users/robault/GitHub/sugata-avatar')
folder = repo / 'docs/evidence/nonhair-2026-10-03/stone-slate-value'
source = pathlib.Path(__file__).resolve()
files = [
    'docs/evidence/nonhair-2026-10-03/stone-slate-value/PLAN.md',
    'docs/evidence/nonhair-2026-10-03/stone-slate-value/CRITIC-VALUE.md',
    'docs/evidence/nonhair-2026-10-03/stone-slate-value/proposed-options.mjs',
    'docs/evidence/nonhair-2026-10-03/stone-slate-value/ROOT-OPTIONS.json',
    'docs/evidence/nonhair-2026-10-03/stone-slate-value/PRIMARY-SEARCH.json',
    'docs/evidence/nonhair-2026-10-03/stone-slate-value/PRIMARY-REFERENCE.json',
    'packages/testbed/src/showcase-presets.mjs',
    'packages/testbed/src/showcase-settings.mjs',
    'packages/testbed/src/showcase-colours.mjs',
    'packages/testbed/src/showcase-palette-references.mjs',
    'packages/core/src/wardrobe/WardrobeStyles.js',
    'looks/README.md', 'looks/ink-denim.json', 'docs/PRODUCT-ROADMAP.md',
    'packages/testbed/src/palette-references/elegant-ecru.png',
    'docs/evidence/nonhair-2026-10-03/ink-denim-look/archive/capture/neutral-body.png',
    'docs/evidence/nonhair-2026-10-03/ink-denim-look/archive/capture/neutral-portrait.png',
    'docs/evidence/nonhair-2026-10-03/ink-denim-value/uniqlo-70000561.jpg'
]
def sha(data): return hashlib.sha256(data).hexdigest()
pins = []
for file in files:
    data = (repo / file).read_bytes()
    pin = {'file': file, 'bytes': len(data), 'sha256': sha(data)}
    if file.endswith('.png'):
        assert data[:8] == b'\x89PNG\r\n\x1a\n'
        pin['dimensions'] = list(struct.unpack('>II', data[16:24]))
    pins.append(pin)
by_file = {row['file']: row for row in pins}
root = json.loads((folder / 'ROOT-OPTIONS.json').read_text())
for row in root['pins']:
    assert by_file[row['file']]['sha256'] == row['sha256']
    assert by_file[row['file']]['bytes'] == row['bytes']
assert root['status'] == 'passed' and root['candidate'] == root['recovered']
assert root['selection']['preset'] == 'casual' and root['selection']['outfit'] == 'elegant'
assert by_file['docs/evidence/nonhair-2026-10-03/stone-slate-value/proposed-options.mjs']['sha256'] == root['readerSha256']
for target in root['targetsAbsent']:
    assert not (repo / target).exists()
assert by_file['packages/testbed/src/palette-references/elegant-ecru.png']['dimensions'] == [657, 868]
for suffix in ['neutral-body.png', 'neutral-portrait.png']:
    assert by_file['docs/evidence/nonhair-2026-10-03/ink-denim-look/archive/capture/' + suffix]['dimensions'] == [900, 868]
result = {
    'status': 'passed', 'scope': 'FS-only input/provenance readback; no helper import/execution, image transform, asset parse, geometry, Avatar, browser or GPU',
    'command': 'python3 docs/evidence/nonhair-2026-10-03/stone-slate-value/critic-value-pins.py',
    'pid': os.getpid(), 'python': sys.executable, 'version': platform.python_version(),
    'started': started, 'ended': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'sourceSha256': sha(source.read_bytes()), 'pins': pins,
    'rootHelperReceiptOnly': {'pid': root['pid'], 'started': root['started'], 'ended': root['ended'], 'status': root['status']},
    'targetsAbsent': root['targetsAbsent'],
    'actualImagesViewed': [files[-4], files[-3], files[-2], files[-1]],
    'roadmapReadScope': 'Lines 13–51 and 116–122 plus relevant search witnesses; full file pinned, not represented as full prose review'
}
out = folder / 'CRITIC-VALUE-PINS.json'
with out.open('x') as handle: json.dump(result, handle, indent=2); handle.write('\n')
print(json.dumps({'status': result['status'], 'pid': result['pid'], 'started': started, 'ended': result['ended'], 'sourceSha256': result['sourceSha256'], 'receiptSha256': sha(out.read_bytes()), 'noteSha256': by_file['docs/evidence/nonhair-2026-10-03/stone-slate-value/CRITIC-VALUE.md']['sha256'], 'pins': len(pins)}))
