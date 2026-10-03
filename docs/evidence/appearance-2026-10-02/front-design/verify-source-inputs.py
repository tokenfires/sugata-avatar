"""Read-only member equality and retained vertex-map inventory; no mapping proof."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parent
repo = root.parents[3]
receipt = json.loads((root / 'source-root-verification.json').read_text())
for path, expected in receipt['sourceHashes'].items():
    assert hashlib.sha256((repo / path).read_bytes()).hexdigest() == expected, path
with zipfile.ZipFile(repo / 'tools/figure-pipeline/.cache/mpfb-2.0.17.zip') as archive:
    assert hashlib.sha256(Path(archive.filename).read_bytes()).hexdigest() == '4f0a879d64a39bf646fbf5f53601ac678855da329d650617dca5737548239a87'
    for member, record in receipt['archiveMembers'].items():
        raw = (root / 'source-witnesses' / member).read_bytes()
        assert raw == archive.read(member), member
        assert len(raw) == record['bytes']
        assert hashlib.sha256(raw).hexdigest() == record['sha256']
raw = (repo / 'assets/identity/figure-vertex-map.bin').read_bytes()
ids = [int.from_bytes(raw[i:i+2], 'little') for i in range(0, len(raw), 2)]
assert (len(ids), len(set(ids)), min(ids), max(ids)) == (14517, 13380, 0, 13379)
print('PASS: pinned inputs, seven exact archive members, retained map inventory; correspondence unqualified')
