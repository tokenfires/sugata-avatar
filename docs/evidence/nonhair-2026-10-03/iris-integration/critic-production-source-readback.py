import datetime, hashlib, json, os, pathlib, platform
root = pathlib.Path('/Users/robault/GitHub/sugata-avatar')
packet = root / 'docs/evidence/nonhair-2026-10-03/iris-integration'
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
paths = [
 'packages/core/src/material/EyeColourOptions.js',
 'packages/core/src/material/EyeMaterial.js',
 'packages/core/src/Avatar.js',
 'packages/testbed/src/showcase-presets.mjs',
 'packages/testbed/src/showcase-settings.mjs',
 'packages/testbed/src/showcase.js',
 'packages/testbed/src/showcase.html',
 'packages/testbed/src/showcase-colours.mjs',
 'packages/testbed/src/showcase-collection.mjs',
 'docs/evidence/nonhair-2026-10-03/iris-integration/OWNERSHIP-CONTRACT.md',
 'docs/evidence/nonhair-2026-10-03/iris-integration/EDIT-RECIPE.json',
 'docs/evidence/nonhair-2026-10-03/iris-integration/CRITIC-PRODUCTION-INITIAL.md',
]
receipt = dict(pid=os.getpid(), started=start, python=platform.python_version(), command='python3 docs/evidence/nonhair-2026-10-03/iris-integration/critic-production-source-readback.py', scope='Read bytes/hashes only; no constructor/evaluator or tests', sources=[])
for path in paths:
 data = (root / path).read_bytes()
 receipt['sources'].append(dict(path=path, bytes=len(data), sha256=hashlib.sha256(data).hexdigest()))
receipt['readerSha256'] = hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()
receipt['finished'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
target = packet / 'critic-production-initial-readback.json'
with target.open('x') as f:
 json.dump(receipt, f, indent=2)
 f.write('\n')
print(json.dumps(dict(pid=receipt['pid'], started=start, finished=receipt['finished'], count=len(paths), readerSha256=receipt['readerSha256'], receiptSha256=hashlib.sha256(target.read_bytes()).hexdigest())))
