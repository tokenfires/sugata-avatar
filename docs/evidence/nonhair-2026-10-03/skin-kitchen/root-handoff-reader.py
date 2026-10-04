import datetime, hashlib, json, os, pathlib, sys

root = pathlib.Path('/Users/robault/GitHub/sugata-avatar')
packet = root / 'docs/evidence/nonhair-2026-10-03/skin-kitchen'
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
receipt = json.loads((packet / 'CRITIC-SOURCE-PINS.json').read_text())
author = json.loads((packet / 'AUTHOR-FINAL.json').read_text())
assert receipt['pid'] == 83909
assert receipt['sourceSha256'] == sha(packet / 'critic-source-pins.py') == '410c00b5f445449521906bb270219b09017e1adc67418d129bc186c26c1b54d0'
assert receipt['sourceInputs'] == len(author['sources']) == 380
assert receipt['recipeExactClone'] is True
assert len(receipt['pins']) == 393
seen = set()
for pin in receipt['pins']:
    assert pin['path'] not in seen
    seen.add(pin['path'])
    path = root / pin['path']
    assert path.stat().st_size == pin['bytes'], pin['path']
    assert sha(path) == pin['sha256'], pin['path']
    if pin['path'] in author['sources']:
        assert pin['sha256'] == author['sources'][pin['path']]
assert set(author['sources']).issubset(seen)
assert len(seen - set(author['sources'])) == 13
for path, expected in author['files'].items():
    assert sha(root / path) == expected, path
assert sha(packet / 'preview.mjs') == '9181c8450c2c3edc87491eefb2936e30109a410f20911271fb87128714e41d0a'
assert sha(packet / 'CRITIC-SOURCE.md') == '15a15b6b122269e8238979ac5e1ee44e7e89d887dcf813944c6f9efbbbd5990a'
sage = json.loads((root / 'looks/sage-lavender-chin.json').read_text())
sage['scene'] = 'kitchen'
sage.pop('lighting', None)
assert json.loads((packet / 'recipe.json').read_text()) == sage
outputs = ['original-front.jpg', 'candidate-front.jpg', 'candidate-oblique.jpg', 'original-oblique.jpg', 'UI.json']
assert not any((packet / name).exists() for name in outputs)
result = dict(scope='Post-stop preservation and independent filesystem/JSON readback only; no browser, Avatar, renderer or geometry execution', command='python3 docs/evidence/nonhair-2026-10-03/skin-kitchen/root-handoff-reader.py', pid=os.getpid(), interpreter=sys.executable, python=sys.version, started=started, ended=datetime.datetime.now(datetime.timezone.utc).isoformat(), sourceSha256=sha(pathlib.Path(__file__)), criticReceiptSha256=sha(packet / 'CRITIC-SOURCE-PINS.json'), criticMetadata={k:v for k,v in receipt.items() if k!='pins'}, checkedPins=393, acceptedSources=380, exactRecipe=True, renderOutputsAbsent=outputs, firstRecoveryClock='2026-10-04T00:43:36Z', firstOpenCutoff='2026-10-04T00:42:00Z', decision='STOP: missed first-open cutoff; no launch, correction, replay or appearance qualification')
(packet / 'ROOT-HANDOFF.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(result, indent=2))
