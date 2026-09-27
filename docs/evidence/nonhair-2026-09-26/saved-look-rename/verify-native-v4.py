"""Verify the exact retained packet in memory; no extraction, browser or GPU."""
import gzip, hashlib, json, pathlib, tarfile
root=pathlib.Path(__file__).resolve().parent / 'native-v4-evidence'
hash_bytes=lambda data:hashlib.sha256(data).hexdigest()
r=json.loads((root/'receipt.json').read_text())
assert hash_bytes((root/r['archive']['path']).read_bytes())==r['archive']['sha256']
with tarfile.open(root/r['archive']['path'],'r:gz') as archive:
    members=archive.getmembers()
    assert len(members)==len(r['archive']['members'])
    assert len({m.name for m in members})==len(members)
    for member in members:
        assert member.isfile() and member.name in r['archive']['members']
        expected=r['archive']['members'][member.name]
        data=archive.extractfile(member).read()
        assert len(data)==expected['bytes'] and hash_bytes(data)==expected['sha256']
for key in ('report','manifest'):
    entry=r[key];encoded=(root/entry['path']).read_bytes()
    assert hash_bytes(encoded)==entry['sha256']
    decoded=gzip.decompress(encoded)
    assert hash_bytes(decoded)==entry['decodedSHA256']
    assert hash_bytes(decoded)==r['archive']['members'][key+'.json']['sha256']
for image in r['images']:
    assert hash_bytes((root/image['file']).read_bytes())==image['sha256']
assert hash_bytes((root/r['analysis']['path']).read_bytes())==r['analysis']['sha256']
assert hash_bytes((root.parent/'package-native-v4.mjs').read_bytes())==r['packagerSHA256']
report=json.loads(gzip.decompress((root/r['report']['path']).read_bytes()))
assert report['functionalChecksCompleted'] is True
assert report['transportAdmitted'] is False and report['completed'] is False
assert len(report['checks'])==9 and len(report['errors'])==2
assert 'seal.json' not in r['archive']['members']
print(json.dumps({'verified':True,'capture_members':len(members),'images':len(r['images']),'functionalChecksCompleted':True,'transportAdmitted':False,'completed':False}))
