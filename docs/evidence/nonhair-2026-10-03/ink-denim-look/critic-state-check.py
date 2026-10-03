"""Independent fs/record readback; does not import Avatar, draw or re-evaluate geometry."""
from pathlib import Path
from hashlib import sha256
from datetime import datetime, timezone
import json, math, os, struct, sys, copy

ROOT = Path('/Users/robault/GitHub/sugata-avatar')
PACKET = ROOT / 'docs/evidence/nonhair-2026-10-03/ink-denim-look'
RAW = ROOT / 'captures/ink-denim-look-2026-10-03-v1'
started = datetime.now(timezone.utc).isoformat()
H = lambda p: sha256(Path(p).read_bytes()).hexdigest()
r = json.loads((RAW / 'report.json').read_bytes())
assert H(RAW / 'report.json') == 'ef33303c76dde505cb3f274c6de29f3b3d2e45716d94d233b836144b8fdd26d7'
pins = dict(r['sources'])
pins.update(r['inputs'])
for name, expected_hash in pins.items():
    p = Path(name) if Path(name).is_absolute() else ROOT / name
    assert H(p) == expected_hash, name
assert H(ROOT / 'tools/critic/ink-denim-look.mjs') == r['instrumentSHA256']
assert H(RAW / 'instrument.mjs') == r['instrumentSHA256']
recipe = json.loads((PACKET / 'CANDIDATE.json').read_bytes())
assert (RAW / 'ink-denim.json').read_bytes() == (PACKET / 'CANDIDATE.json').read_bytes()
assert r['download']['sha256'] == H(RAW / 'ink-denim.json')
assert r['download']['configuration'] == r['recipe'] == recipe
assert recipe['hair'] == 'bob02' and recipe['hairColour'] == '#413934' and 'hairTint' not in recipe
assert recipe['wardrobe']['colours'] == {'top':'#32495e','bottom':'#35485c','shoes':'#48382e'}
assert r['status'] == 'observed' and not r['errors'] and not r['failedResources']
assert r['started'] < '2026-10-03T21:23:00Z' and r['finished'] < '2026-10-03T21:37:00Z'
states = {s['label']:s for s in r['states']}
assert len(states) == len(r['states']) == 18
for s in r['states']:
    e = copy.deepcopy(recipe)
    e['scene'], e['frame'] = s['configuration']['scene'], s['configuration']['frame']
    assert e['scene'] in ('studio','kitchen') and e['frame'] in ('body','portrait')
    if e['scene'] == 'kitchen': del e['lighting']
    assert s['configuration'] == e
    assert s['storage'] == {} and s['backend'] == 'webgpu' and s['webGPU'] is True
    a = s['attached']
    assert a['identity'] == {'gender':0.5,'bake':'figure_g050'}
    hair = a['hair']; c = hair['colour']
    assert hair['attached'] and hair['style'] == hair['loadedStyle'] == 'bob02'
    assert c['requested'] == c['applied'] == c['resolved'] == '#413934' and c['matchesAttached']
    assert c['requestedTint'] is None and c['appliedTint'] is None
    w = a['wardrobe']
    assert w['attached'] and w['pendingCandidates'] == 0
    assert w['appearance'] == {'style':'ecru','colours':recipe['wardrobe']['colours'],'attached':True}
    assert w['foundation'] == recipe['wardrobe']['foundation']
    assert sorted(w['state']['worn']) == sorted(['female_casualsuit01','shoes01','foundation_bra','foundation_briefs'])
    assert w['state']['pendingFragments'] == 0 and not w['state']['disposed']
    assert a['scene']['id'] == e['scene'] and a['framing']['mode'] == e['frame']
    if e['scene'] == 'studio': assert a['scene']['lighting']['look'] == 'neutral'
    assert a['motion']['seed'] == 20260807
    for name in ('matrix','projection'):
        assert len(s['camera'][name]) == 16 and all(math.isfinite(x) for x in s['camera'][name])

names = ['neutral-body','neutral-portrait','kitchen-body','kitchen-portrait','smile-held','smile-released']
assert [im['file'] for im in r['images']] == [n+'.png' for n in names]
image_pins = {}
for im, name in zip(r['images'], names):
    p = RAW / im['file']; b = p.read_bytes()
    assert H(p) == im['sha256'] and len(b) == im['bytes']
    assert b[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',b[16:24]) == (900,868)
    assert im['completed'] and im['encoding'] == 'one ordinary Stage.draw plus same-task canvas PNG'
    assert im['before'] == states[name+'-before'] and im['after'] == states[name+'-after']
    assert im['before']['configuration'] == im['after']['configuration']
    assert im['before']['camera'] == im['after']['camera']
    assert im['before']['attention'] == im['after']['attention']
    for k in ('frame','timeSeconds','seed'):
        assert im['before']['attached']['motion'][k] == im['after']['attached']['motion'][k]
    image_pins[im['file']] = {'sha256':H(p),'dimensions':[900,868],'bytes':len(b)}

required = {'assets/wardrobe/body/g050.glb','assets/wardrobe/foundation_bra/g050.glb',
            'assets/wardrobe/foundation_briefs/g050.glb','assets/wardrobe/female_casualsuit01/g050.glb',
            'assets/wardrobe/shoes01/g050.glb','assets/hair/bob02/g050.glb'}
assert len(r['assets']) == 24 and {a['file'] for a in r['assets']} == required
for a in r['assets']:
    assert H(ROOT / a['file']) == a['sha256'] == a['expectedSHA256'] == r['sources'][a['file']]
    assert (ROOT / a['file']).stat().st_size == a['bytes']
assert all(sum(a['file']==p for a in r['assets'])==4 for p in required)
assert r['operations'][1]['kind'] == 'actual JSON reopen'
assert [x['requestedScene'] for x in r['operations'] if x['kind']=='scene button'] == ['kitchen','studio']

def smooth(u):
    u = min(1.,max(0.,u))
    return 6*u**5 - 15*u**4 + 10*u**3
def near(a,b): assert math.isclose(a,b,rel_tol=0,abs_tol=2e-12), (a,b)
held = [x for x in r['steps'] if x['segment']=='held']
released = [x for x in r['steps'] if x['segment']=='released']
assert len(r['steps']) == 102 and len(held)==72 and len(released)==30
assert states['smile-start']['pausePressed'] == 'false'
assert states['smile-start']['attention']['phase']=='attending'
assert states['smile-start']['attention']['holdsGaze']
for i,x in enumerate(held,1):
    assert x['i']==i and x['delta']==1/60
    a=x['attention']; near(a['time'],i/60)
    assert a['phase']=='attending' and a['expression']=='soft-smile' and a['holdsGaze']
    weight = smooth((i/60-.25)/.6)
    near(a['poseWeight'],weight); near(a['smileWeight'],weight)
    near(a['headNoiseScale'],1-.75*smooth(i/60/.5))
assert states['manual-release']['attention']['phase']=='releasing'
assert states['manual-release']['attention']['time']==0
assert not states['manual-release']['attention']['holdsGaze']
for i,x in enumerate(released,1):
    assert x['i']==i and x['delta']==1/60
    a=x['attention']; assert not a['holdsGaze']
    if i < 18:
        assert a['phase']=='releasing'; near(a['time'],i/60)
        weight=1-smooth(i/60/.3)
        near(a['poseWeight'],weight); near(a['smileWeight'],weight)
        near(a['headNoiseScale'],1-.75*weight)
    else:
        assert a['phase']=='idle' and a['time']==0 and a['poseWeight']==0 and a['smileWeight']==0
assert states['released-end']['attention']['phase']=='idle'
assert [x['label'] for x in r['retirements']]==['json-reopen','kitchen-load','studio-return']
for row in r['retirements']:
    assert row['persisted'] is False and row['disposal']=={'disposed':True,'leaked':[]}
assert r['retirement']=={'disposed':True,'leaked':[]}
assert r['cleanup']=={'page':'closed','browser':'closed','server':'closed',
                     'assetReads':{'drained':True,'recordedPromises':24}}
assert r['finalPinsUnchanged'] is True and r['borrowedReviewServerRetained'] is True
warning_counts = {}
for w in r['warnings']: warning_counts[w['message']] = warning_counts.get(w['message'],0)+1
assert len(r['warnings'])==18 and sorted(warning_counts.values())==[4,4,10]
receipt = {'started':started,'finished':datetime.now(timezone.utc).isoformat(),'pid':os.getpid(),
 'command':'python3 docs/evidence/nonhair-2026-10-03/ink-denim-look/critic-state-check.py',
 'interpreter':sys.executable,'version':sys.version,'sourceSHA256':H(__file__),'reportSHA256':H(RAW/'report.json'),
 'status':'passed fs/record/arithmetic readback','sourceInputPins':pins,'instrumentSHA256':r['instrumentSHA256'],
 'sources':len(r['sources']),'inputs':len(r['inputs']),'states':18,'steps':102,'actualGLBResponses':24,
 'uniqueGLBFiles':6,'images':image_pins,'downloadSHA256':H(RAW/'ink-denim.json'),'warningCounts':warning_counts,
 'limits':['No native/browser/GPU/evaluator rerun. Hashes read from current sources and retained raw files.',
 'Recorded camera/configuration/action equality around six ordinary encoding redraws only; no phase/history/pixel equality.',
 'Source-derived envelope arithmetic checks public reports, not human intent or continuous naturalness.',
 'Pixel readability was inspected independently by viewing all six original images; no crop or bitmap edit.']}
with (PACKET/'critic-state-readback.json').open('x') as f: json.dump(receipt,f,indent=2); f.write('\n')
print(json.dumps({'pid':os.getpid(),'started':started,'finished':receipt['finished'],'status':receipt['status'],
                  'receiptSHA256':H(PACKET/'critic-state-readback.json'),'sourceSHA256':H(__file__)}))
