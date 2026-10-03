from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, os, struct, sys
ROOT = Path('/Users/robault/GitHub/sugata-avatar')
RAW = ROOT / 'captures/skin-finish-2026-10-03-v1'
OUT = ROOT / 'docs/evidence/nonhair-2026-10-03/skin-finish/CRITIC-READBACK.json'
started = datetime.now(timezone.utc).isoformat()
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
rp = RAW / 'report.json'
r = json.loads(rp.read_bytes())
assert sha(rp) == 'acb884858d91bbcfdb8e91d792d4a2438f27fb59b914d615ea9e7bbf08339aeb'
assert r['status'] == 'observed' and r['errors'] == [] and r['failedResources'] == []
assert r['finalPinsUnchanged'] is True
assert r['cleanup'] == {'page': 'closed', 'browser': 'closed'}
for group in ['sources', 'inputs']:
    for name, expected in r[group].items(): assert sha(ROOT / name) == expected, (group, name)
assert sha(RAW / 'instrument.mjs') == r['instrumentSHA256']
assert sha(ROOT / 'tools/critic/skin-finish.mjs') == r['instrumentSHA256']
assert r['instrumentSHA256'] == '2cf1cc12102dec3b2e4cc2f53e0b22ae04291a43f14d5fde8d201ceb3a78a284'
recipe = json.loads((ROOT / 'looks/sage-lavender-chin.json').read_bytes())
expected = [('original','front'),('candidate','front'),('candidate','oblique'),('original','oblique')]
assert len(r['images']) == len(expected)
base = None
images = []
for item, (arm, view) in zip(r['images'], expected):
    data = (RAW / item['file']).read_bytes()
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    size = struct.unpack('>II',data[16:24])
    assert size == (1440, 1000)
    assert sha(RAW / item['file']) == item['sha256']
    b, a = item['before'], item['after']
    assert a == b
    assert b['arm'] == arm and b['view'] == view
    assert b['actualConfiguration'] == b['recipe'] == recipe
    assert b['backend'] == 'webgpu' and b['webGPU'] is True
    skin = b['skin']
    assert skin['bodyOwner'] is True and skin['type'] == 'SkinNodeMaterial'
    assert skin['clearcoat'] == (.34 if arm == 'original' else .12)
    assert skin['clearcoatRoughness'] == .24 and skin['useClearcoat'] is True
    for field in ['clearcoatNode','clearcoatRoughnessNode','clearcoatMap','clearcoatRoughnessMap']: assert skin[field] is None
    assert b['camera']['fov'] == 26
    assert b['camera']['position'] == ([0,1.55,.88] if view == 'front' else [.4235,1.55,.7665])
    fixed = {k:v for k,v in b.items() if k not in ['arm','view','camera','skin']}
    fixed['skin'] = {k:v for k,v in skin.items() if k != 'clearcoat'}
    if base is None: base = fixed
    assert fixed == base
    images.append({'file':item['file'],'sha256':item['sha256'],'size':size,'arm':arm,'view':view})
for i,j in [(0,1),(2,3)]: assert r['images'][i]['before']['camera'] == r['images'][j]['before']['camera']
ret = r['retirement']
assert not ret.get('snapshotError')
assert ret['restored']['skin']['clearcoat'] == .34
assert ret['disposal']['disposed'] is True and ret['disposal']['leaked'] == []
assert datetime.fromisoformat(r['finished'].replace('Z','+00:00')) < datetime.fromisoformat(r['stop'].replace('Z','+00:00'))
receipt = {'scope':'Pure fs/report readback; no renderer, node graph oracle, shader uniform readback, fresh capture or appearance verdict.', 'command':'python3 docs/evidence/nonhair-2026-10-03/skin-finish/critic-readback.py', 'pid':os.getpid(), 'interpreter':sys.executable, 'version':sys.version, 'startedUTC':started, 'finishedUTC':datetime.now(timezone.utc).isoformat(), 'sourceSHA256':sha(Path(__file__)), 'reportSHA256':sha(rp), 'nativePID':r['pid'], 'nativeStarted':r['started'], 'nativeFinished':r['finished'], 'sourcePins':len(r['sources']), 'inputPins':len(r['inputs']), 'images':images, 'statesChecked':8, 'warnings':r['warnings'], 'cleanup':r['cleanup'], 'retirement':{'restoredClearcoat':ret['restored']['skin']['clearcoat'],'disposed':ret['disposal']['disposed'],'leaked':ret['disposal']['leaked']}, 'passed':True}
with OUT.open('x',encoding='utf-8') as f: json.dump(receipt,f,indent=2); f.write('\n')
print(json.dumps(receipt,indent=2))
print('RECEIPT_SHA256',sha(OUT))
print('REPORT_NON_HASH_FIELDS',json.dumps({k:v for k,v in r.items() if k not in ['sources','inputs','images','retirement']},indent=2))
print('FIRST_COMPLETE_STATE',json.dumps(r['images'][0]['before'],indent=2))
print('ALL_STATE_SCHEMA',{k:list(v.keys()) for k,v in [('firstBefore',r['images'][0]['before']),('lastAfter',r['images'][-1]['after']),('restored',ret['restored'])]})
