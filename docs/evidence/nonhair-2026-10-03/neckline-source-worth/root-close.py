import datetime, hashlib, json, os
from pathlib import Path
p = Path(__file__).resolve().parent
repo = p.parents[3]
started = datetime.datetime.now(datetime.timezone.utc)
assert started < datetime.datetime.fromisoformat('2026-10-04T06:00:00+00:00')
sha = lambda b: hashlib.sha256(b).hexdigest()
assert sha((p/'CRITIC-VALUE.md').read_bytes()) == '2eae8ed041dc3deb1473a59cf3f7a8bb1071ebe0d56f9c04e87dc11380d2d5de'
paths = [
 'docs/evidence/nonhair-2026-10-03/ink-denim-look/archive/capture/neutral-portrait.png',
 'docs/evidence/nonhair-2026-10-03/skin-finish-sdk/native-context.jpg',
 'docs/evidence/nonhair-2026-10-03/tee-neckline/ROOT-DECISION.md',
 'docs/evidence/nonhair-2026-10-03/tee-neckline/RECEIPT.md',
 'docs/evidence/nonhair-2026-10-03/separates-feasibility/read-ownership.mjs',
 'docs/evidence/nonhair-2026-10-03/separates-feasibility/OWNERSHIP.json',
 'assets/wardrobe/female_casualsuit01/g050.glb',
 'packages/core/src/wardrobe/WardrobeStyles.js',
 'packages/core/src/wardrobe/Wardrobe.js',
 'docs/DAY-REPORT-2026-09-30.md',
 'docs/research/POSE-AWARE-FIT-NEXT-2026-09-30.md']
rows = []
for name in paths:
 b = (repo/name).read_bytes()
 rows.append({'path': name, 'bytes': len(b), 'sha256': sha(b)})
by_path = {r['path']: r for r in rows}
assert by_path['assets/wardrobe/female_casualsuit01/g050.glb']['sha256'] == '44ebc3eb3a09408a3563d369ae74be15a5bc4beb8040bc43c2c5446d6e65c783'
assert by_path['docs/evidence/nonhair-2026-10-03/separates-feasibility/read-ownership.mjs']['sha256'] == '26360d09dabea054d9ae5dd4ab5eabc4b73dde4ad916bca406a1f75253716486'
packet = []
for f in sorted(p.iterdir()):
 assert f.is_file()
 b = f.read_bytes()
 packet.append({'file': f.name, 'bytes': len(b), 'sha256': sha(b)})
ended = datetime.datetime.now(datetime.timezone.utc)
assert ended < datetime.datetime.fromisoformat('2026-10-04T06:00:00+00:00')
result = {'command': 'python3 docs/evidence/nonhair-2026-10-03/neckline-source-worth/root-close.py', 'pid': os.getpid(), 'started': started.isoformat(), 'ended': ended.isoformat(), 'decision': 'B; duplicate cause-led discriminator, no parse admitted', 'externalPins': rows, 'packetPins': packet, 'scope': 'Hash readback only; root independently read complete handoff/source and viewed actual original. No asset topology computation or runtime.'}
with (p/'ROOT-CLOSE.json').open('x') as f:
 json.dump(result, f, indent=2); f.write('\n')
print(json.dumps(result))
