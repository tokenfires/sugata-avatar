from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, math, os, struct

started = datetime.now(timezone.utc).isoformat()
root = Path('/Users/robault/GitHub/sugata-avatar')
packet = root / 'docs/evidence/nonhair-2026-10-04/rowan-portrait'
read = lambda name: json.loads((packet / name).read_text())
front, retired = read('FRONT-STATE.json'), read('RETIRED-STATE.json')
recipe = read('ROWAN.json')
assert front['recipe'] == retired['recipe'] == recipe
recipe_sha = hashlib.sha256((packet / 'ROWAN.json').read_bytes()).hexdigest()
assert front['recipeSHA256'] == retired['recipeSHA256'] == recipe_sha
assert front['failure'] is None and retired['failure'] is None
assert front['pending'] is False and retired['pending'] is False
assert len(front['views']) == len(retired['views']) == 1
v = front['views'][0]
assert v['name'] == 'front' and v['degrees'] == 0 and v['complete'] is True
for report in [front['creation']['report'], v['report']]:
    assert report['identity'] == {'gender': 1, 'bake': 'figure_g100'}
    assert report['quality']['requested'] == report['quality']['tier'] == 'balanced'
    assert report['quality']['backend'] == 'webgpu' and report['quality']['backendMismatch'] is False
    assert report['wardrobe'] is None
    assert report['framing']['mode'] == 'portrait' and report['framing']['heightMetres'] == .55
    h = report['hair']
    assert h['attached'] and h['loadedStyle'] == 'bob01' and h['bake'] == 'figure_g100'
    assert h['colour']['requested'] == h['colour']['applied'] == h['colour']['resolved'] == '#2f251f'
    assert h['colour']['requestedTint'] is None and h['colour']['appliedTint'] is None
    assert h['colour']['matchesAttached'] is True
    assert h['bodyContact'] is None
    assert h['bodyContactUnavailableReason'] == 'No body-contact calibration for bob01 on figure_g100.'
    assert report['scene']['id'] == 'studio' and report['scene']['lighting']['look'] == 'neutral'
    assert report['motion']['seed'] == 20260807 and report['motion']['timeSeconds'] == 0
    assert report['speech']['clockSeconds'] == 0 and report['disposal']['disposed'] is False
assert front['creation']['report']['motion']['frame'] == 0
assert v['report']['motion']['frame'] == 32 and v['clockSeconds'] == 0
assert front['creation']['canvas'] == v['canvas'] == {'width': 960, 'height': 1240, 'cssWidth': 480, 'cssHeight': 620}
c = front['composition']
initial_camera = front['creation']['camera']
distance_residual = abs(math.dist(initial_camera['position'], c['sourceFocus']) - c['distanceMetres'])
target = list(c['sourceFocus']); target[1] += .045
expected_position = [target[0], target[1], target[2] + c['distanceMetres']]
target_residual = max(abs(a-b) for a,b in zip(target, v['camera']['target']))
position_residual = max(abs(a-b) for a,b in zip(expected_position, v['camera']['position']))
assert max(distance_residual, target_residual, position_residual) < 1e-12
assert initial_camera['projection'] == v['camera']['projection']
assert all(math.isfinite(x) for x in v['camera']['matrix'] + v['camera']['projection'])
assert {k: value for k,value in retired.items() if k != 'retirement'} == {k: value for k,value in front.items() if k != 'retirement'}
assert front['retirement'] is None
retirement = retired['retirement']
assert retirement['reason'] == 'manual' and retirement['pendingAtRetirement'] is False
assert retirement['error'] is None and retirement['disposal'] == {'disposed': True, 'leaked': []}
assert 'lateRetirement' not in front and 'lateRetirement' not in retired
job, close = read('NATIVE-JOB.json'), read('NATIVE-CLOSE.json')
assert job['tab'] == close['tab'] == '11' and job['url'] == close['url']
assert job['createClick'] < '2026-10-04T06:26:00.000Z'
console = read('NATIVE-CONSOLE.json')
assert len(console) == 3 and all(row['level'] == 'warn' for row in console)

# Read the saved JPEG's header/terminal marker only, without modifying or recapturing it.
jpeg = (packet / 'front.jpg').read_bytes()
assert jpeg[:2] == b'\xff\xd8' and jpeg[-2:] == b'\xff\xd9'
i = 2; dimensions = None
while i < len(jpeg):
    assert jpeg[i] == 255
    while jpeg[i] == 255: i += 1
    marker = jpeg[i]; i += 1
    if marker in [0xD8, 0xD9] or 0xD0 <= marker <= 0xD7: continue
    length = struct.unpack('>H', jpeg[i:i+2])[0]
    if marker in [0xC0,0xC1,0xC2]:
        height,width = struct.unpack('>HH', jpeg[i+3:i+7]); dimensions = [width,height]; break
    assert marker != 0xDA
    i += length
assert dimensions == [1280,720]
source_pins = read('CRITIC-SOURCE-PINS.json')['pins']
for pin in source_pins:
    data = (root / pin['path']).read_bytes()
    assert len(data) == pin['bytes'] and hashlib.sha256(data).hexdigest() == pin['sha256']
names = ['FRONT-STATE.json','RETIRED-STATE.json','NATIVE-JOB.json','NATIVE-CLOSE.json','NATIVE-CONSOLE.json','NATIVE-ADMISSION.md','ARTISTIC-STOP.md','front.jpg','critic-result-reader.py','CRITIC-SOURCE-PINS.json','CRITIC-SOURCE.md']
pins = []
for name in names:
    data = (packet / name).read_bytes()
    pins.append({'file':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
out = {
    'command':'python3 docs/evidence/nonhair-2026-10-04/rowan-portrait/critic-result-reader.py',
    'pid':os.getpid(),'startedAt':started,'finishedAt':datetime.now(timezone.utc).isoformat(),
    'scope':'Saved source/state/media filesystem readback only; no import, evaluator, asset parser, renderer or browser.',
    'sourcePinsUnchanged':len(source_pins),'pins':pins,'jpegDimensions':dimensions,
    'creationFrame':0,'completedViews':['front'],'frontFrame':32,'clockSeconds':0,
    'cameraOperandResiduals':{'distance':distance_residual,'target':target_residual,'position':position_residual},
    'retirement':retirement,'consoleWarnings':3,'consoleErrors':0,
    'limits':'Header/state checks do not qualify appearance, served asset bytes, full pose equality, allocator reclamation or the absent three-quarter view.'
}
with (packet / 'CRITIC-RESULT-PINS.json').open('x') as handle:
    json.dump(out,handle,indent=2); handle.write('\n')
print(json.dumps({'pid':out['pid'],'startedAt':started,'finishedAt':out['finishedAt'],'pins':len(pins),'sourcePinsUnchanged':len(source_pins),'jpeg':dimensions,'cameraOperandResiduals':out['cameraOperandResiduals']}))
