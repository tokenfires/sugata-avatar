import datetime, hashlib, json, math, os, pathlib, platform
root = pathlib.Path('/Users/robault/GitHub/sugata-avatar')
packet = root / 'docs/evidence/nonhair-2026-10-03/iris-integration'
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
sha = lambda data: hashlib.sha256(data).hexdigest()
before = json.loads((packet / 'BEFORE.json').read_text())
recipe = json.loads((packet / 'EDIT-RECIPE.json').read_text())
corrections = json.loads((packet / 'SOURCE-CORRECTIONS.json').read_text())
files = sorted(set(change['file'] for change in recipe['changes']))
reconstructed = {}
for name in files:
 data = (packet / 'before' / name).read_bytes()
 assert sha(data) == before['sources'][name]
 reconstructed[name] = data.decode()
for change in recipe['changes'] + [c for c in corrections['changes'] if c['file'] in reconstructed]:
 text = reconstructed[change['file']]
 assert text.count(change['old']) == 1, (change['file'], 'declaration occurrence')
 reconstructed[change['file']] = text.replace(change['old'], change['new'])
for name, text in reconstructed.items():
 assert text.encode() == (root / name).read_bytes(), (name, 'undeclared production difference')
jobs = json.loads((packet / 'CPU-JOBS.json').read_text())['jobs']
for job in jobs:
 path = pathlib.Path(job['output'])
 if not path.is_absolute(): path = root / path
 assert job['exit'] == 0 and sha(path.read_bytes()) == job['outputSHA256'], job['name']
rgb = [x / 255 for x in [0x52, 0x7b, 0x97]]
linear = [x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in rgb]
luma = sum(x*y for x,y in zip(linear,[.2126,.7152,.0722]))
normalized = [x / luma for x in linear]
assert max(abs(a-b) for a,b in zip(normalized,[.46375534541012664,1.0886445839519705,1.7009280765008])) < 2e-15
paths = files + ['packages/core/src/material/EyeColourOptions.js', 'docs/API.md',
 'packages/testbed/src/showcase-eye-colours.selftest.mjs',
 'packages/testbed/src/showcase-colours.mjs', 'packages/testbed/src/showcase-collection.mjs',
 'tools/critic/iris-integration.mjs',
 'docs/evidence/nonhair-2026-10-03/iris-integration/PLAN.md',
 'docs/evidence/nonhair-2026-10-03/iris-integration/OWNERSHIP-CONTRACT.md',
 'docs/evidence/nonhair-2026-10-03/iris-integration/CONTRACT-ADDENDUM.md',
 'docs/evidence/nonhair-2026-10-03/iris-integration/EDIT-RECIPE.json',
 'docs/evidence/nonhair-2026-10-03/iris-integration/SOURCE-CORRECTIONS.json',
 'docs/evidence/nonhair-2026-10-03/iris-integration/CPU-JOBS.json']
receipt = dict(pid=os.getpid(), started=start, python=platform.python_version(),
 command='python3 docs/evidence/nonhair-2026-10-03/iris-integration/critic-final-source-readback.py',
 scope='Literal source reconstruction, file/log hashes and scalar sRGB math only; no tests, constructor, shader/GPU/browser or evaluator rerun',
 reconstructedFiles=files, declaredChanges=len(recipe['changes']), cpuJobsVerified=len(jobs),
 linear=linear, luma=luma, normalizedBlue=normalized, sources=[])
for path in paths:
 data = (root / path).read_bytes()
 receipt['sources'].append(dict(path=path, bytes=len(data), sha256=sha(data)))
receipt['readerSha256'] = sha(pathlib.Path(__file__).read_bytes())
receipt['finished'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
target = packet / 'critic-final-source-readback.json'
with target.open('x') as f: json.dump(receipt,f,indent=2); f.write('\n')
print(json.dumps(dict(pid=receipt['pid'], started=start, finished=receipt['finished'], readerSha256=receipt['readerSha256'], receiptSha256=sha(target.read_bytes()), sources=receipt['sources'])))
