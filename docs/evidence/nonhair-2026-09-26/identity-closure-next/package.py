"""Losslessly retain finite CPU evidence; plots are numeric masks, not native renders."""
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
RAW = ROOT / 'captures/identity-closure-2026-09-26'
OUT = HERE / 'cpu-packet-v1'
FOLDERS = ('cpu-pilot-v1', 'critic-oracle-v1', 'calibrated-cpu-v1', 'critic-calibrated-oracle-v1')
sha = lambda data: hashlib.sha256(data).hexdigest()
entries = []
for name in FOLDERS:
    for original in sorted((RAW / name).iterdir()):
        assert original.is_file()
        data = original.read_bytes()
        compress = original.suffix != '.png'
        target = OUT / name / (original.name + ('.gz' if compress else ''))
        target.parent.mkdir(parents=True, exist_ok=True)
        packed = gzip.compress(data, mtime=0) if compress else data
        target.write_bytes(packed)
        restored = gzip.decompress(target.read_bytes()) if compress else target.read_bytes()
        assert restored == data
        entries.append({'source': str(original.relative_to(ROOT)), 'file': str(target.relative_to(OUT)),
                        'bytes': len(data), 'sha256': sha(data), 'packedBytes': len(packed),
                        'packedSHA256': sha(packed), 'gzip': compress})
receipt = {'kind': 'identity-aperture-lossless-cpu-packet', 'scope': 'Two sampled CPU instruments and two independent geometric oracles; no native appearance or identity acceptance.',
           'generatorSHA256': sha(Path(__file__).read_bytes()), 'entries': entries}
(OUT / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'files': len(entries), 'rawBytes': sum(x['bytes'] for x in entries),
                  'packedBytes': sum(x['packedBytes'] for x in entries),
                  'receiptSHA256': sha((OUT / 'receipt.json').read_bytes())}, indent=2))
