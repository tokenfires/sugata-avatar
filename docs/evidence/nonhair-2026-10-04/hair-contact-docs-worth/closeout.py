import datetime, hashlib, json, os, pathlib, subprocess

root = pathlib.Path('/Users/robault/GitHub/sugata-avatar')
packet = root / 'docs/evidence/nonhair-2026-10-04/hair-contact-docs-worth'
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
before = subprocess.check_output(['git', 'show', 'HEAD:docs/API.md'], cwd=root)
readback = json.loads((packet / 'ROOT-READBACK.json').read_text())
rows = []
for row in readback['inputs']:
    data = before if row['path'] == 'docs/API.md' else (root / row['path']).read_bytes()
    assert len(data) == row['bytes'] and hashlib.sha256(data).hexdigest() == row['sha256']
    rows.append(row)
bindings = {
    'docs/API.md': '524541f8e1abd3ed578ae13dd64d8f3b471ddadf065629e961cdcdb71ca28190',
    'docs/evidence/nonhair-2026-10-04/hair-contact-docs-worth/CRITIC-WORTH.md': '39928397df2f101e3618fcf9e5c880c47e10d1ce8ce45ff09734f6054de29cd9',
    'docs/evidence/nonhair-2026-10-04/hair-contact-docs-worth/CRITIC-RESULT.md': '9696d261dcc2ac52ce2d1f76560de15dade0f1ec8dd3c2db7edce4d0caf417cc',
    'docs/evidence/nonhair-2026-10-04/hair-contact-docs-worth/PLAN.md': 'b83009e1bbf4355525518c277b6e256d475dfffe805174f6b78e9a5f16604261',
}
for path, expected in bindings.items():
    data = (root / path).read_bytes()
    assert hashlib.sha256(data).hexdigest() == expected
    rows.append({'path': path, 'bytes': len(data), 'sha256': expected})
verification = json.loads((packet / 'DOC-VERIFICATION.json').read_text())
api = (root / 'docs/API.md').read_text()
paragraph = verification['onlyChange']
assert api.count(paragraph) == 1 and api.replace(paragraph, '', 1).encode() == before
linked = pathlib.Path(verification['link'])
assert linked == root / 'docs/evidence/nonhair-2026-10-04/rowan-portrait/FRONT-STATE.json'
assert json.loads(linked.read_text())['views'][0]['report']['hair'] == json.loads((root / 'docs/evidence/nonhair-2026-10-04/rowan-portrait/RETIRED-STATE.json').read_text())['views'][0]['report']['hair']
result = {'pid': os.getpid(), 'started': started, 'finished': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'command': 'python3 docs/evidence/nonhair-2026-10-04/hair-contact-docs-worth/closeout.py',
    'bindings': rows, 'decision': 'A: exact API paragraph accepted; source/link review only',
    'limits': 'Root read both complete final critic notes independently. No new source investigation, runtime, appearance or motion test.'}
(packet / 'ROOT-RESULT.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({key: value for key, value in result.items() if key != 'bindings'}))
