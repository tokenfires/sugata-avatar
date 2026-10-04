"""Read saved source/state/media bytes only. Never import/render Avatar or repair artifacts."""
import datetime, hashlib, json, os, pathlib, struct, sys, zlib

BASE = pathlib.Path(__file__).resolve().parent
ROOT = BASE.parents[3]
OUT = BASE / 'CRITIC-RESULT-PINS.json'
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
pins = []

def read(path):
    path = pathlib.Path(path)
    data = path.read_bytes()
    pins.append({'path': str(path), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    return data

def load(name):
    return json.loads(read(BASE / name))

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

def leaves(value, prefix=''):
    if isinstance(value, dict):
        if not value: return {prefix: value}
        out = {}
        for k, v in value.items(): out.update(leaves(v, prefix + '/' + str(k)))
        return out
    if isinstance(value, list):
        if not value: return {prefix: value}
        out = {}
        for i, v in enumerate(value): out.update(leaves(v, prefix + '/' + str(i)))
        return out
    return {prefix: value}

def png_structure(data):
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    pos, chunks, cut = 8, [], None
    dims = None
    while pos < len(data):
        if len(data) - pos < 8:
            cut = {'offset': pos, 'headerBytesAvailable': len(data)-pos}; break
        n = struct.unpack('>I', data[pos:pos+4])[0]
        kind = data[pos+4:pos+8].decode('ascii')
        end = pos + 12 + n
        if end > len(data):
            cut = {'offset': pos, 'type': kind, 'declaredDataBytes': n,
                   'requiredEnd': end, 'fileBytes': len(data), 'bytesMissing': end-len(data)}
            break
        payload = data[pos+8:pos+8+n]
        stored = struct.unpack('>I', data[pos+8+n:end])[0]
        assert zlib.crc32(data[pos+4:pos+8]+payload) & 0xffffffff == stored
        chunks.append({'type': kind, 'dataBytes': n, 'offset': pos, 'crcValid': True})
        if kind == 'IHDR': dims = list(struct.unpack('>II', payload[:8]))
        pos = end
    return {'dimensions': dims, 'completeChunks': chunks, 'truncatedChunk': cut,
            'hasIEND': any(c['type']=='IEND' for c in chunks),
            'scope': 'Structure/CRC only; no image decoding, crop or pixel interpretation.'}

def validate_report(r, finish, recipe):
    weight = .34 if finish == 'original' else .12
    assert r['skin'] == {'requestedFinish': finish, 'attached': True, 'clearcoat': weight,
        'clearcoatRoughness': .24, 'settings': {'secondLobeWeight': weight, 'secondLobeRoughness': .24}}
    q = r['quality']
    assert (q['requested'],q['tier'],q['backend'],q['backendMismatch']) == ('balanced','balanced','webgpu',False)
    assert (r['identity']['bake'], r['identity']['gender']) == ('figure_g050',.5)
    h = r['hair']
    assert h['attached'] and h['loadedStyle']=='bob02'
    assert h['colour']['applied']==recipe['hairColour'] and h['colour']['matchesAttached']
    assert h['colour']['requestedTint']==h['colour']['appliedTint']==recipe['hairTint']
    w = r['wardrobe']
    assert w['attached'] and w['pendingCandidates']==0 and w['lastError'] is None
    assert sorted(w['state']['worn']) == sorted(recipe['wardrobe']['outfit']+list(recipe['wardrobe']['foundation'].values()))
    assert w['appearance']['attached'] and w['appearance']['style']==recipe['wardrobe']['style']
    assert w['appearance']['colours']==recipe['wardrobe']['colours']
    assert r['framing']['mode']=='portrait' and r['scene']['id']=='studio'
    assert r['scene']['lighting']['look']=='neutral' and r['scene']['lighting']['calibrated'] is False
    assert r['motion']['seed']==20260807 and not r['disposal']['disposed']

receipt = {'scope': 'Read all saved native JSON as data, rehash admitted/current snapshots, PNG structure and source call order. No native/test/material/module/asset evaluation or image repair.',
    'command': 'python3 docs/evidence/nonhair-2026-10-03/skin-finish-sdk/critic-result-reader.py',
    'pid': os.getpid(), 'startUTC': start, 'interpreter': sys.executable,
    'sourceSHA256': hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()}
try:
    source_pins = load('CRITIC-SOURCE-PINS.json')
    for row in source_pins['pins']:
        data = read(row['path'])
        assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256']
    read(BASE / 'CRITIC-SOURCE.md')
    state = load('NATIVE-STATE.json')
    images = load('NATIVE-IMAGES.json')
    console = load('CONSOLE.json')
    close = load('CLOSE.json')
    read(BASE / 'NATIVE-CALLS.md')
    preflight = load('ROOT-PREFLIGHT.json')
    recipe = json.loads(read(ROOT / 'looks/sage-lavender-chin.json'))
    assert state['recipe']==recipe
    assert state['recipeSHA256']==hashlib.sha256((ROOT/'looks/sage-lavender-chin.json').read_bytes()).hexdigest()
    assert state['complete'] is False and state['pending'] is False
    assert state['failure']['at']=='2026-10-04T05:29:31.198Z'
    assert 'old skin disposal event mismatch' in state['failure']['message']
    assert len(state['states'])==len(state['requests'])==len(state['creations'])==2
    assert [x['name'] for x in state['states']]==['original','reduced']
    assert [x['finish'] for x in state['creations']]==['original','reduced-sheen']
    original_options = {**recipe, 'autoStart': False}
    reduced_options = {**original_options, 'skinFinish': 'reduced-sheen'}
    assert state['requests'][0]['options']==original_options
    assert state['requests'][1]['options']==reduced_options
    reports = []
    for creation in state['creations']:
        validate_report(creation['report'], creation['finish'], recipe)
        assert creation['skinUUID']==creation['bodyMaterialUUID']
        reports.append(('creation-'+creation['finish'], creation['report']))
    for row, finish in zip(state['states'], ('original','reduced-sheen')):
        assert row['complete'] is True and row['clockSeconds']==0
        assert row['skinUUID']==row['bodyMaterialUUID']
        assert row['canvas']=={'width':900,'height':1120}
        for when in ('before','after'):
            validate_report(row[when],finish,recipe)
            reports.append((row['name']+'-'+when,row[when]))
        assert row['before']['skin']==row['after']['skin']
    rb=state['rebuild']
    assert rb['disposeEvents']==2 and rb['complete'] is False
    assert rb['beforeSkinUUID']!=rb['afterSkinUUID']
    for when in ('before','after'):
        validate_report(rb[when],'reduced-sheen',recipe)
        reports.append(('rebuild-'+when,rb[when]))
    assert len(state['retirements'])==2
    for row in state['retirements']:
        assert row['error'] is None and row['disposal']['disposed'] is True and row['disposal']['leaked']==[]
        assert row['skinAfter']=={'requestedFinish': 'original' if row['reason']=='before-reduced' else 'reduced-sheen',
            'attached':False,'clearcoat':None,'clearcoatRoughness':None,'settings':None}
    assert [x['reason'] for x in state['retirements']]==['before-reduced','failure']
    assert close['closedTab']=='9' and [x['id'] for x in close['tabs']]==['1']
    assert all(x['level']=='warn' for x in console['logs']) and len(console['logs'])==7
    media=[]
    assert len(images['images'])==2
    for row in images['images']:
        data=read(BASE/row['file'])
        assert len(data)==row['bytes']==149990 and hashlib.sha256(data).hexdigest()==row['sha256']
        structure=png_structure(data)
        assert structure['dimensions']==[900,1120] and structure['truncatedChunk'] and not structure['hasIEND']
        media.append({'file':row['file'],**structure})
    assert images['links']==[{'id':'original','hidden':False,'offered':True},
        {'id':'reduced','hidden':False,'offered':True},{'id':'rebuilt','hidden':True,'offered':False}]
    jpeg=read(BASE/'native-context.jpg'); assert jpeg[:2]==b'\xff\xd8' and jpeg[-2:]==b'\xff\xd9'
    for name,current in [('Avatar.js','packages/core/src/Avatar.js'),('SkinFinishOptions.js','packages/core/src/material/SkinFinishOptions.js'),
        ('SkinFinishOptions.selftest.mjs','packages/core/src/material/SkinFinishOptions.selftest.mjs'),('API.md','docs/API.md'),
        ('showcase-presets.mjs','packages/testbed/src/showcase-presets.mjs'),('showcase-settings.selftest.mjs','packages/testbed/src/showcase-settings.selftest.mjs')]:
        assert read(BASE/('source-'+name))==(ROOT/current).read_bytes()
    avatar=read(ROOT/'packages/core/src/Avatar.js').decode()
    figure=read(ROOT/'packages/core/src/figure/Figure.js').decode()
    material=read(ROOT/'node_modules/three/src/materials/Material.js').decode()
    skin=read(ROOT/'packages/core/src/material/SkinMaterial.js').decode()
    swap=avatar[avatar.index('    async swapFigure() {'):avatar.index('    async swapFigure() {')+14500]
    assert swap.index('this.disposeShading();')<swap.index('this.figure.dispose();')
    assert 'release( this.skin );' in avatar and 'material.dispose();' in figure
    assert "this.dispatchEvent( { type: 'dispose' } );" in material
    assert 'object.material = material;' in skin
    baseline=leaves(reports[0][1]); report_diffs=[]
    for label,r in reports:
        flat=leaves(r)
        diff={k:{'base':baseline.get(k),'actual':flat.get(k)} for k in set(baseline)|set(flat) if baseline.get(k)!=flat.get(k)}
        report_diffs.append({'label':label,'sha256Canonical':digest(r),'leafCount':len(flat),'differencesFromFirstCreation':diff})
    # Lossless human review representation: first full report plus every changed leaf in later reports.
    review={'allNonReportState':{k:v for k,v in state.items() if k not in ('states','creations','rebuild')},
        'stateMetadata':[{k:v for k,v in x.items() if k not in ('before','after')} for x in state['states']],
        'creationMetadata':[{k:v for k,v in x.items() if k!='report'} for x in state['creations']],
        'rebuildMetadata':{k:v for k,v in rb.items() if k not in ('before','after')},
        'firstCompleteReport':reports[0][1], 'allEightReportDifferences':report_diffs}
    view_path=BASE/'CRITIC-STATE-READBACK.json'
    with view_path.open('x') as f: json.dump(review,f,indent=2);f.write('\n')
    read(view_path)
    receipt.update({'passed':True,'nativeQualification':'REFUSED; first declared rebuild event predicate failed; no rebuilt PNG; incomplete two collected PNGs provide no original appearance comparison.',
        'admittedPinsUnchanged':len(source_pins['pins']),'reportsRead':len(reports),'requestOptions':[original_options,reduced_options],
        'failure':state['failure'],'rebuild':{k:v for k,v in rb.items() if k not in ('before','after')},
        'retirements':state['retirements'],'mediaStructure':media,'consoleWarnCount':7,'close':close,
        'sourceExplanation':'Source has skin.dispose through disposeShading then old Figure body material traversal. Every Three Material.dispose emits an event; count two is consistent with that call order, not proof of a leak or executed call stacks.',
        'limits':['No original PNG decode/appearance available; context JPEG only visually inspected separately.','No runtime replay/test/material constructor/asset parse/GPU performed.','Report fields and event counts are recorded observations, not allocator or exhaustive process/network proof.']})
except Exception as exc:
    receipt.update({'passed':False,'error':repr(exc)})
    raise
finally:
    receipt.update({'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':0 if receipt.get('passed') else 1,'pins':pins})
    with OUT.open('x') as f: json.dump(receipt,f,indent=2); f.write('\n')
    print(json.dumps({k:v for k,v in receipt.items() if k not in ('pins','requestOptions','retirements','close')},indent=2))
