import datetime, hashlib, json, os, pathlib, sys
root = pathlib.Path('/Users/robault/GitHub/sugata-avatar')
packet = root / 'docs/evidence/nonhair-2026-10-03/skin-kitchen'
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
paths = ['docs/evidence/nonhair-2026-10-03/skin-kitchen/PLAN.md', 'looks/sage-lavender-chin.json', 'packages/core/src/material/SkinMaterial.js', 'packages/core/src/Avatar.js', 'packages/testbed/src/viewer-scenes.mjs', 'docs/evidence/nonhair-2026-10-03/skin-lighting-value/CRITIC-VALUE.md']
pins = [{ 'path': p, 'bytes': len((root/p).read_bytes()), 'sha256': hashlib.sha256((root/p).read_bytes()).hexdigest() } for p in paths]
receipt = dict(scope='FS hash readback only; no runtime/API/parser/evaluator/render qualification', command='python3 docs/evidence/nonhair-2026-10-03/skin-kitchen/critic-contract-pins.py', pid=os.getpid(), interpreter=sys.executable, python=sys.version, started=start, ended=datetime.datetime.now(datetime.timezone.utc).isoformat(), sourceSha256=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(), pins=pins)
(packet/'CRITIC-CONTRACT-PINS.json').write_text(json.dumps(receipt, indent=2)+'\n')
print(json.dumps({'pid': receipt['pid'], 'started': start, 'ended': receipt['ended'], 'pins': len(pins)}))
