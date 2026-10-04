import datetime, hashlib, json, os, pathlib, re
folder = pathlib.Path(__file__).resolve().parent
repo = pathlib.Path('/Users/robault/GitHub/sugata-avatar')
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
files = ['packages/core/src/wardrobe/WardrobeStyles.js', 'packages/core/src/wardrobe/Wardrobe.js', 'docs/WARDROBE-COLOURWAYS-2026-09-13.md', 'docs/WARDROBE-TROUSER-FIT-2026-09-13.md', 'docs/evidence/nonhair-2026-10-03/ink-denim-look/archive/capture/neutral-body.png', 'docs/evidence/nonhair-2026-10-03/ink-denim-look/archive/capture/kitchen-body.png', 'packages/testbed/src/palette-references/casual-ecru.png', 'packages/testbed/src/palette-references/elegant-ecru.png']
note = (folder / 'CRITIC.md').read_bytes()
assert hashlib.sha256(note).hexdigest() == 'a18ec903e6236df51890ce3ed3b9fb1bdafa8bbf4ecae2e28b592f9a8396388d'
expected = re.findall(r'`([a-f0-9]{64})`', note.decode())
rows = []
for file in files:
    data = (repo / file).read_bytes(); digest = hashlib.sha256(data).hexdigest()
    assert digest in expected, file
    rows.append(dict(file=file, bytes=len(data), sha256=digest))
assert len(expected) == len(files)
out = dict(decision='B: no justified finish trial', command='python3 docs/evidence/nonhair-2026-10-03/garment-finish-worth/root-verify.py', pid=os.getpid(), started=started, ended=datetime.datetime.now(datetime.timezone.utc).isoformat(), pins=rows, noteSha256=hashlib.sha256(note).hexdigest(), readerSha256=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(), rootViewed=['Ink neutral-body.png whole original', 'Ink kitchen-body.png whole original'], scope='Independent complete note and8pin reconciliation; no native/GPU/asset or material change')
with (folder / 'ROOT-VERIFIED.json').open('x') as h: json.dump(out,h,indent=2); h.write('\n')
print(json.dumps({k:out[k] for k in ['decision','pid','started','ended','readerSha256']}))
