"""Independent packed-byte and exact comparison replay; no extraction, browser or GPU."""
import gzip
import hashlib
import json
import pathlib
import tarfile

here = pathlib.Path(__file__).resolve().parent
packet = here / 'native-v4-evidence'
sha = lambda data: hashlib.sha256(data).hexdigest()
r = json.loads((packet / 'receipt.json').read_text())
assert sha((here / 'package-native-v4.py').read_bytes()) == r['packagerSHA256']
assert sha((packet / r['archive']['path']).read_bytes()) == r['archive']['sha256']
with tarfile.open(packet / r['archive']['path'], 'r:gz') as archive:
    entries = archive.getmembers()
    assert len(entries) == len(r['archive']['members']) == len({m.name for m in entries})
    selected = {}
    for member in entries:
        assert member.isfile() and member.name in r['archive']['members']
        data = archive.extractfile(member).read()
        expected = r['archive']['members'][member.name]
        assert len(data) == expected['bytes'] and sha(data) == expected['sha256']
        if member.name in ('report.json', 'manifest.json', 'collection-seal.json') or member.name.startswith(('readbacks/', 'states/')):
            selected[member.name] = data
report = json.loads(selected['report.json'])
manifest = json.loads(selected['manifest.json'])
seal = json.loads(selected['collection-seal.json'])
assert report['completed'] and report['sourcesStable'] and not report['errors']
assert report['imageAdmission'] is False and report['causalAdmission'] is False and report['featureQualified'] is False
assert seal['reportSHA256'] == sha(selected['report.json']) and seal['manifestSHA256'] == sha(selected['manifest.json'])
for key in ('report', 'manifest', 'collection-seal'):
    record = r[key]
    encoded = (packet / record['path']).read_bytes()
    assert sha(encoded) == record['sha256']
    assert gzip.decompress(encoded) == selected[key + '.json']
for path, digest in manifest['sources'].items():
    if not path.startswith('assets/'):
        assert r['archive']['members']['source/' + path]['sha256'] == digest
for response in report['responses']:
    assert r['archive']['members']['served/' + response['sha256']]['sha256'] == response['sha256']
    if response['asset']:
        assert response['sha256'] == manifest['sources'][response['asset']]
packed = []
for case in report['cases']:
    assert case['completed'] and case['exportStateExact']
    assert case['boundaries']['allCountersAndTargetOwnersUnchanged']
    retirement = case['retirement']
    assert retirement['disposed'] and not retirement['leaks'] and not retirement['instrumentError']
    assert all(value == 0 for value in retirement['memory'].values())
    assert not retirement['gpu']['errors']
    state = case['stateArtifact']
    assert sha(selected[state['file']]) == state['sha256']
    assert sha(gzip.decompress(selected[state['file']])) == state['decodedSHA256']
    image = case['image']
    assert sha((packet / image['file']).read_bytes()) == image['sha256'] == r['archive']['members'][image['file']]['sha256']
    textures = {}
    for target in case['boundaryArtifacts']:
        encoded = selected[target['artifact']['file']]
        assert sha(encoded) == target['artifact']['sha256']
        raw = gzip.decompress(encoded)
        assert sha(raw) == target['rawSHA256'] and len(raw) == target['layout']['rawBytes']
        layout = target['layout']
        pixels = b''.join(raw[y * layout['rowStride']:y * layout['rowStride'] + layout['rowBytes']] for y in range(layout['height']))
        assert len(pixels) == layout['pixelBytes'] and sha(pixels) == target['pixelsSHA256']
        textures[target['label']] = pixels
    assert len(textures) == 10
    packed.append(textures)
assert len(packed) == 2
for comparison, target in zip(report['boundaryComparison'], report['cases'][0]['boundaryArtifacts']):
    label = comparison['label']
    assert label == target['label']
    a, b = packed[0][label], packed[1][label]
    size = target['layout']['bytesPerTexel']
    changed = [i for i, (x, y) in enumerate(zip(a, b)) if x != y]
    texels = set(i // size for i in changed)
    result = comparison['comparison']
    assert result['exact'] == (a == b) and result['changedBytes'] == len(changed) and result['changedTexels'] == len(texels)
    if texels:
        width = target['width']
        assert result['bounds'] == dict(minX=min(i % width for i in texels), maxX=max(i % width for i in texels), minY=min(i // width for i in texels), maxY=max(i // width for i in texels))
    else:
        assert result['bounds'] is None
assert report['cases'][0]['stateSHA256'] == report['cases'][1]['stateSHA256']
print(json.dumps({'verified': True, 'members': len(entries), 'targetsPerControl': 10, 'originalImages': 2,
                  'collectionComplete': True, 'imageAdmission': False, 'causalAdmission': False, 'featureQualified': False}))
