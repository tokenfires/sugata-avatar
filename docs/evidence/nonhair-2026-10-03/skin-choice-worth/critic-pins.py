"""Read existing source bytes and archived state only; never import material/runtime code."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, os, struct, sys

root = Path('/Users/robault/GitHub/sugata-avatar')
packet = root / 'docs/evidence/nonhair-2026-10-03/skin-choice-worth'
study = root / 'docs/evidence/nonhair-2026-10-03/skin-finish'
started = datetime.now(timezone.utc).isoformat()
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
names = [
    packet / 'PLAN.md', root / 'packages/core/src/material/SkinMaterial.js',
    root / 'packages/core/src/Avatar.js', root / 'docs/API.md',
    root / 'packages/testbed/src/showcase-settings.mjs',
    study / 'preview.mjs', study / 'candidate.json', study / 'README.md',
    study / 'ROOT-VISUAL-DECISION.md', study / 'CRITIQUE.md', study / 'RECEIPT.md',
    root / 'docs/evidence/nonhair-2026-10-03/skin-lighting-value/CRITIC-VALUE.md',
    study / 'archive/capture/report.json',
]
report = json.loads(names[-1].read_bytes())
assert digest(names[-1]) == 'acb884858d91bbcfdb8e91d792d4a2438f27fb59b914d615ea9e7bbf08339aeb'
assert report['status'] == 'observed' and not report['errors'] and not report['failedResources']
assert report['finalPinsUnchanged'] is True
assert report['cleanup'] == {'page':'closed', 'browser':'closed'}
expected = [('original','front',.34), ('candidate','front',.12), ('candidate','oblique',.12), ('original','oblique',.34)]
assert len(report['images']) == 4
states, images, base = [], [], None
for item, (arm, view, weight) in zip(report['images'], expected):
    p = study / 'archive/capture' / item['file']
    names.append(p)
    raw = p.read_bytes()
    assert raw[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', raw[16:24]) == (1440,1000)
    assert digest(p) == item['sha256']
    assert item['before'] == item['after']
    for phase in ['before','after']:
        s = item[phase]
        assert s['arm'] == arm and s['view'] == view
        assert s['actualConfiguration'] == s['recipe']
        assert s['actualConfiguration']['scene'] == 'studio' and s['actualConfiguration']['lighting'] == 'neutral'
        skin = s['skin']
        assert skin['bodyOwner'] is True and skin['type'] == 'SkinNodeMaterial'
        assert skin['clearcoat'] == weight and skin['clearcoatRoughness'] == .24 and skin['useClearcoat'] is True
        assert skin['settings']['secondLobeWeight'] == .34 and skin['settings']['secondLobeRoughness'] == .24
        for key in ['clearcoatNode','clearcoatRoughnessNode','clearcoatMap','clearcoatRoughnessMap']:
            assert skin[key] is None
        fixed = {k:v for k,v in s.items() if k not in ['arm','view','camera','skin']}
        fixed['skin'] = {k:v for k,v in skin.items() if k != 'clearcoat'}
        if base is None: base = fixed
        assert fixed == base
        states.append({'file':item['file'], 'phase':phase, 'state':s})
    images.append({'path':str(p), 'sha256':digest(p), 'dimensions':[1440,1000], 'arm':arm,'view':view})
for i,j in [(0,1),(2,3)]:
    assert report['images'][i]['before']['camera'] == report['images'][j]['before']['camera']
ret = report['retirement']
assert not ret.get('snapshotError') and ret['restored']['skin']['clearcoat'] == .34
assert ret['disposal']['disposed'] is True and not ret['disposal']['leaked']
pins = [{'path':str(p),'bytes':p.stat().st_size,'sha256':digest(p)} for p in names]
receipt = {'scope':'Read-only source/image/header/report-state metadata; no material constructor/setter/import, GLB parse, runtime or GPU',
    'command':'python3 docs/evidence/nonhair-2026-10-03/skin-choice-worth/critic-pins.py',
    'pid':os.getpid(), 'startUTC':started, 'endUTC':datetime.now(timezone.utc).isoformat(), 'exitCode':0,
    'interpreter':sys.executable, 'sourceSHA256':digest(Path(__file__)), 'pins':pins,
    'images':images, 'completeRetainedStates':states, 'retirement':ret, 'cleanup':report['cleanup'],
    'warnings':report['warnings'], 'passed':True}
target = packet / 'CRITIC-PINS.json'
with target.open('x') as f: json.dump(receipt,f,indent=2); f.write('\n')
print(json.dumps({k:receipt[k] for k in ['pid','startUTC','endUTC','exitCode','sourceSHA256','passed']}))
print('receiptSHA256',digest(target),'pins',len(pins),'states',len(states))
print('FULL_FIRST_STATE',json.dumps(states[0]['state'],indent=2))
print('WARNINGS_RETIREMENT',json.dumps({'warnings':receipt['warnings'],'retirement':ret,'cleanup':report['cleanup']},indent=2))
