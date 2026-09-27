"""Losslessly retain the declared two-control collection, including its failed PNG gate."""
import gzip
import hashlib
import io
import json
import pathlib
import tarfile

here = pathlib.Path(__file__).resolve().parent
repo = here.parents[3]
raw = repo / 'captures/render-boundary-2026-09-26/native-v4'
out = here / 'native-v4-evidence'
out.mkdir(exist_ok=False)
sha = lambda data: hashlib.sha256(data).hexdigest()
report = json.loads((raw / 'report.json').read_text())
assert report['completed'] is True and report['imageAdmission'] is False
assert report['causalAdmission'] is False and report['featureQualified'] is False
files = sorted(p for p in raw.rglob('*') if p.is_file())
assert all(not p.is_symlink() for p in raw.rglob('*'))
members = {}
with (out / 'full-native-capture.tar.gz').open('xb') as stream:
    with gzip.GzipFile(fileobj=stream, mode='wb', filename='', mtime=0) as packed:
        with tarfile.open(fileobj=packed, mode='w') as archive:
            for path in files:
                data = path.read_bytes()
                name = path.relative_to(raw).as_posix()
                info = tarfile.TarInfo(name)
                info.size, info.mode, info.mtime = len(data), 0o644, 0
                archive.addfile(info, io.BytesIO(data))
                members[name] = {'bytes': len(data), 'sha256': sha(data)}
receipt = {'version': 1, 'scope': report['scope'], 'packagerSHA256': sha(pathlib.Path(__file__).read_bytes()),
           'archive': {'path': 'full-native-capture.tar.gz', 'members': members}, 'images': []}
archive = (out / receipt['archive']['path']).read_bytes()
receipt['archive'].update(bytes=len(archive), sha256=sha(archive))
for key in ('report', 'manifest', 'collection-seal'):
    data = (raw / (key + '.json')).read_bytes()
    encoded = gzip.compress(data, mtime=0)
    name = key + '.json.gz'
    (out / name).write_bytes(encoded)
    receipt[key] = {'path': name, 'sha256': sha(encoded), 'decodedSHA256': sha(data)}
for case in report['cases']:
    item = case['image']
    data = (raw / item['file']).read_bytes()
    assert sha(data) == item['sha256']
    (out / item['file']).write_bytes(data)
    receipt['images'].append(item)
(out / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'files': len(files), 'rawBytes': sum(x['bytes'] for x in members.values()),
                  'archiveBytes': len(archive), 'receiptSHA256': sha((out / 'receipt.json').read_bytes())}))
