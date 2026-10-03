import datetime, hashlib, json, os, pathlib, re

root = pathlib.Path.cwd()
packet = root / 'docs/evidence/nonhair-2026-10-03/endpoint-starter-value'
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
critic = packet / 'CRITIC-VALUE.md'
assert digest(critic) == '4ff32d468e666cdbb9f196cccbe2ee90372c17484bb1e0ab095a0da8e332719d'
pins = dict(re.findall(r'^- `([^`]+)`: `([0-9a-f]{64})`$', critic.read_text(), re.M))
assert len(pins) == 9
for name, expected in pins.items():
    assert digest(root / name) == expected, name
prior = root / 'docs/evidence/nonhair-2026-10-03/representation-recipes/receipt.json'
assert digest(prior) == 'a8c91fd7351b79904c03c9ed0a22a113c6344af4aaebaccaf789af3a2a0579f6'
avatar = (root / 'packages/core/src/Avatar.js').read_text()
helper = (root / 'packages/core/src/wardrobe/AvatarWardrobe.js').read_text()
assert avatar.count('validateWardrobePlan( plan );') == 3
assert 'plan.figures[ 0 ].gender !== 0.5' in avatar
assert "bodyUrl: new URL( 'wardrobe/body/g050.glb', absolute ).href" in helper
assert "manifest.fragmentUrl( id, 'g050' )" in helper
assert "figureKey: 'g050'" in helper
result = dict(pid=os.getpid(), started=started,
              finished=datetime.datetime.now(datetime.timezone.utc).isoformat(),
              sourceSha256=digest(pathlib.Path(__file__)), criticSha256=digest(critic),
              pins=pins, priorReceiptSha256=digest(prior),
              decision='Duplicate support question closed; no new endpoint asset or runtime probe.',
              limits='Source readback only; no lower-level impossibility, fit or representation claim.')
target = packet / 'ROOT-READBACK.json'
assert not target.exists()
target.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: v for k, v in result.items() if k != 'pins'}))
