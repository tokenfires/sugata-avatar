import collections, datetime, hashlib, json, math, os, pathlib, platform, struct
root = pathlib.Path('/Users/robault/GitHub/sugata-avatar')
packet = root / 'docs/evidence/nonhair-2026-10-03/iris-integration'
raw = root / 'captures/iris-integration-2026-10-03-v1'
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
sha = lambda data: hashlib.sha256(data).hexdigest()
report_bytes = (raw / 'report.json').read_bytes()
r = json.loads(report_bytes)
assert r['status'] == 'failed' and len(r['failedResources']) == 31 and len(r['errors']) == 2
assert all(x['failure']['errorText'] == 'net::ERR_ABORTED' for x in r['failedResources'])
assert ':154:48' in r['errors'][0] and ':162:53' in r['errors'][1]
assert r['cleanup'] == {'page':'closed','browser':'closed'}
assert 'finalPinsUnchanged' not in r
pins = []
for p, expected in r['sources'].items():
 candidate = packet / 'candidate-source' / p
 witness = candidate if candidate.is_file() else root / p
 actual = sha(witness.read_bytes())
 assert actual == expected, (p, 'native source witness mismatch')
 pins.append(dict(path=p, witness=str(witness.relative_to(root)), sha256=actual))
for p, expected in r['inputs'].items():
 assert sha((root / p).read_bytes()) == expected, p
assert sha((raw / 'instrument.mjs').read_bytes()) == r['instrumentSHA256']
assert sha((root / 'tools/critic/iris-integration.mjs').read_bytes()) == r['instrumentSHA256']
base = r['requestedConfiguration']
blue = {**base, 'eyeColour':'blue'}
vector = [.46375534541012664,1.0886445839519705,1.7009280765008]
assert len(r['states']) == 26
by_label = {s['label']:s for s in r['states']}
assert len(by_label) == 26
max_inverse_residual = 0
for s in r['states']:
 assert s['backend'] == 'webgpu'
 e = s['eyes']
 assert e['ownerAvailable'] and e['attached'] and e['matchesAttached'] and e['matchesRequest']
 assert e['requested'] == e['applied']
 assert e['chromaticity'] == (vector if e['applied'] == 'blue' else None)
 assert s['configuration'] == (blue if e['applied'] == 'blue' else base)
 for name in ['eyeOwnerSame','mapSame','corneaSame','occlusionSame','pupilOwnerSame','gazeOwnerSame','uniformsSame']:
  assert s[name] is True
 assert s['mapDisposals'] == 0 and s['eyeMeshes']['activeGlobe'] == s['eyeMeshes']['ownedGlobe']
 assert s['uniforms']['pupilScaleUniform'] == s['pupilScale'] and math.isfinite(s['pupilScale'])
 assert not s['control']['disabled'] and s['control']['applied'] == ('Applied: Blue' if e['applied'] == 'blue' else 'Applied: Original')
 assert s['optics'] == by_label['original-initial']['optics']
 for key, value in s['uniforms'].items():
  if key not in ['pupilScaleUniform','keyLightDirectionUniform']:
   assert value == by_label['original-initial']['uniforms'][key]
 for frame in s['frames'].values():
  a,b = frame['eyeToWorld'],frame['worldToEye']
  assert len(a) == len(b) == 9 and all(math.isfinite(x) for x in a+b)
  for c in range(3):
   for row in range(3):
    value = sum(a[k*3+row]*b[c*3+k] for k in range(3))
    max_inverse_residual = max(max_inverse_residual, abs(value-(1 if c==row else 0)))
assert max_inverse_residual < 1e-10
assert by_label['blue-draft']['control']['draft'] == 'blue' and by_label['blue-draft']['eyes']['applied'] is None
assert by_label['original-restored']['configuration'] == base
assert by_label['JSON-reopened-blue']['configuration'] == by_label['local-reopened-blue']['configuration'] == blue
settings = (raw / 'blue-settings.json').read_bytes()
assert sha(settings) == r['downloadSHA256'] and json.loads(settings) == blue
assert len(r['local']['looks']) == 1 and r['local']['looks'][0]['configuration'] == blue
held, released, release = [by_label[k] for k in ['attention-held','attention-released','manual-release-start']]
assert held['attention']['phase'] == 'attending' and held['attention']['holdsGaze'] is True
assert abs(held['attention']['time']-72/60) < 1e-12
assert release['attention']['phase'] == 'releasing' and release['attention']['holdsGaze'] is False
assert released['attention']['phase'] == 'idle' and released['attention']['holdsGaze'] is False
assert held['frames'] != by_label['attention-before']['frames'] and held['gazeMorphs'] != by_label['attention-before']['gazeMorphs']
assert r['sequence'] == dict(holdSteps=72,releaseSteps=30,dt=1/60,pupilScales=[by_label['attention-before']['pupilScale'],held['pupilScale'],released['pupilScale']])
images=[]
expected_names=['original-front.png','original-oblique.png','blue-front.png','blue-oblique.png','desktop-blue-controls.png','mobile-blue-controls.png','blue-attention-held.png','blue-attention-released.png']
assert [x['file'] for x in r['images']] == expected_names
for entry in r['images']:
 data = (raw / entry['file']).read_bytes()
 assert sha(data) == entry['sha256'] and data[:8] == b'\x89PNG\r\n\x1a\n'
 size = struct.unpack('>II',data[16:24])
 before, after = [r['states'][entry[k]] for k in ['before','after']]
 assert before['label'] == entry['file'][:-4]+':before' and after['label'] == entry['file'][:-4]+':after'
 for key in ['configuration','eyes','camera']: assert before[key] == after[key]
 images.append(dict(file=entry['file'],sha256=entry['sha256'],width=size[0],height=size[1],bytes=len(data)))
assert len(r['retirements']) == 6 and [x['requested'] for x in r['retirements']] == [None,'blue',None,'blue',None,'blue']
resource_ids=[]
for entry in r['retirements']:
 assert entry['eye'] == dict(borrowedMapDisposals=0,restoredGlobe=True,restoredCornea=True)
 assert entry['disposal'] == dict(disposed=True,leaked=[])
 assert [(x['name'],x['uuid']) for x in entry['events']] == list(entry['resources'].items())
 resource_ids.extend(entry['resources'].values())
assert len(resource_ids) == len(set(resource_ids)) == 18
receipt=dict(pid=os.getpid(),started=start,python=platform.python_version(),command='python3 docs/evidence/nonhair-2026-10-03/iris-integration/critic-native-readback.py',
 scope='File bytes, complete recorded state/lifecycle/source and 3x3 inverse arithmetic only; no browser/GPU/evaluator/test or request replay; does not override resource refusal',
 reportSHA256=sha(report_bytes),instrumentSHA256=r['instrumentSHA256'],sourcePins=pins,inputPins=len(r['inputs']),states=26,images=images,
 errors=2,failedResources=r['failedResources'],warnings=dict(collections.Counter(r['warnings'])),retirements=6,uniqueResourceEvents=18,
 maxInverseResidual=max_inverse_residual,sequence=r['sequence'],settingsSHA256=sha(settings),cleanup=r['cleanup'],nativeFinalPinsFlag=False,
 sourceByteReadback='Uses exact preserved candidate copies where available; current filesystem pins elsewhere. This is separate postflight evidence, not the native absent final flag.',
 adoption='Refused: first resource gate failed; keep completed observations as a failed study only')
receipt['readerSHA256']=sha(pathlib.Path(__file__).read_bytes())
receipt['finished']=datetime.datetime.now(datetime.timezone.utc).isoformat()
target=packet/'critic-native-readback.json'
with target.open('x') as f:json.dump(receipt,f,indent=2);f.write('\n')
print(json.dumps({k:receipt[k] for k in ['pid','started','finished','readerSHA256','reportSHA256','states','retirements','uniqueResourceEvents','maxInverseResidual']}))
print('receiptSHA256',sha(target.read_bytes()))
