from pathlib import Path
import gzip
import hashlib
import json
import math
import struct

root=Path('tmp/hair-sep25/lock-wiring')
out=root/'captures'
read=lambda p:json.loads(p.read_text())
sha=lambda data:hashlib.sha256(data).hexdigest()
report=read(out/'report.json')
results=report['results']
assert len(results)==21
for path,expected in report['sourceSHA256'].items():assert sha(Path(path).read_bytes())==expected,path
def bare(r):
    c=r['config']
    return f'{c["temporal"]}-{c["name"]}-p{c["phase"]}'
def name(r):return r['config']['wiring']+'-'+bare(r)
full={name(r):read(out/(name(r)+'.json')) for r in results}
prior_dir=Path('docs/evidence/hair-2026-09-25/resolve-finiteness')
prior={bare(r):r for r in map(json.loads,(prior_dir/'case-records.jsonl').read_text().splitlines())}
prior_rows={r['name']:r for r in read(prior_dir/'summary.json')['rows']}
rows=[]
for r in results:
    c,actual=r['config'],r['actual']
    wiring=c['wiring'];has_lock=wiring!='identity'
    assert actual['stats']['backend']=='webgpu' and actual['adapter']['vendor']=='apple'
    assert actual['stats']['temporalAA']=='taau' and actual['stats']['resolutionScale']==.66
    assert actual['frameId']==512 and actual['captureTime']==0
    assert actual['nativeAudit']['owner']=='TAAUNode' and not actual['nativeAudit']['sharpenNode']
    assert r['maskPixels']==12544 and r['bounds']=={'x0':72,'x1':184,'y0':72,'y1':184}
    targets=actual['nativeAudit']['targets']
    assert len(targets)==(4 if has_lock else 3)
    for t in targets:
        assert t['width']==t['height']==256 and t['gpuFormat']=='rgba16float' and t['typedArray']=='Uint16Array'
        assert t['attachments']==(1 if wiring=='identity' and t['name']=='resolve' else 2)
    assert len(r['routes'])==1
    route=r['routes'][0]
    assert route['arm']==wiring
    assert route['beforeSHA256']==sha((out/'original-served.js').read_bytes())
    assert route['afterSHA256']==sha((out/(wiring+'-served.js')).read_bytes())
    assert (route['beforeSHA256']==route['afterSHA256'])==(wiring=='identity')
    assert [f['frameId'] for f in r['frames']]==list(range(1,513))
    emitted_positive=history_positive=copy_different=0
    for f in r['frames']:
        a=f['nativeAudit']
        assert a['resolveHistoryBitDifferences']==0
        assert a['quantization']['finiteCompared']==262144 and a['quantization']['quantizationMismatches']==0
        for t in targets:
            for region,pixels in [('whole',65536),('roi',12544)]:
                v=a[t['name']][region]
                assert v['components']==pixels*4 and v['pixels']==v['redFinite']==pixels
                assert v['nan']==v['infinity']==v['nonfinitePixels']==0
        for i,offset in enumerate(f['offsets']):
            if c['mode']!='stochastic':continue
            rate=math.sqrt(2)-1 if c['sequence']=='distinct' and i==1 else .6180339887498949
            assert actual['materials'][i]['rate']==rate
            value=(f['frameId']+c['phase'])*rate
            assert offset==value-math.floor(value)
        if wiring=='copy-lock':assert a['lockHistoryBitDifferences']==0
        else:assert a['historyLock']['whole']['finiteMin']==a['historyLock']['whole']['finiteMax']==0
        if has_lock:
            emitted_positive+=a['resolveLock']['whole']['finiteMax']>0
            copy_different+=a['lockHistoryBitDifferences']>0
        history_positive+=a['historyLock']['whole']['finiteMax']>0
        if c['name'] in ['opaque-pair','empty']:
            expected=0 if c['name']=='opaque-pair' else 1
            assert f['min']==f['max']==expected
        if c['name']=='blend-half':assert abs(f['mean']-.25)<=1/255
    if has_lock and c['name']!='empty':assert emitted_positive>0
    if wiring=='attachment-only' and c['name']!='empty':assert copy_different>0 and history_positive==0
    if wiring=='copy-lock' and c['name']!='empty':assert history_positive>0 and copy_different==0
    pixel_sha=sha(struct.pack('<'+'d'*r['maskPixels'],*full[name(r)]['pixelMeans']))
    if wiring=='identity':
        assert r['frames']==prior[bare(r)]['frames']
        assert r['checkpoints']==prior[bare(r)]['checkpoints']
        assert pixel_sha==prior_rows[bare(r)]['pixelMeansSHA256']
    if wiring=='attachment-only':
        identity=full['identity-'+bare(r)]
        without_native=lambda x:[{k:v for k,v in f.items() if k!='nativeAudit'} for f in x['frames']]
        assert without_native(r)==without_native(identity)
        assert r['checkpoints']==identity['checkpoints']
        assert full[name(r)]['pixelMeans']==identity['pixelMeans']
    for s in r['checkpoints']:
        assert sha((out/f'{name(r)}-n{s["count"]}.png').read_bytes())==s['imageSHA256']
    tail=r['frames'][-64:]
    rows.append({'name':name(r),'nativeMetadata':actual['nativeAudit'],
      'emittedLockPositiveFrames':emitted_positive if has_lock else None,
      'historyLockPositiveFrames':history_positive,'lockCopyDifferentFrames':copy_different if has_lock else None,
      'nativeColorTailMean':sum(f['nativeAudit']['resolve']['roi']['redMean'] for f in tail)/64,
      'nativeHistoryLockTailMean':sum(f['nativeAudit']['historyLock']['roi']['redMean'] for f in tail)/64,
      'pixelMeansSHA256':pixel_sha,'checkpoints':r['checkpoints']})

by_name={name(r):r for r in results}
pilot=read(root/'pilot/report.json')
assert len(pilot['results'])==18 and pilot['sourceSHA256']==report['sourceSHA256']
for r in pilot['results']:
    later=by_name[name(r)]
    assert r['frames']==later['frames'][:24]
    assert r['checkpoints']==later['checkpoints'][:1]
    for route in r['routes']:
        assert route['beforeSHA256']==later['routes'][0]['beforeSHA256']
        assert route['afterSHA256']==later['routes'][0]['afterSHA256']
    assert sha((root/'pilot'/f'{name(r)}-n24.png').read_bytes())==r['checkpoints'][0]['imageSHA256']

summary={'baseCommit':report['baseCommit'],'sourceSHA256':report['sourceSHA256'],
 'finding':'Missing lock delivery confirmed in this fixture: a second resolve attachment emits lock but leaves history zero until explicitly copied. Copying transfers exact bits and changes color/noise; broader runtime qualification remains pending.',
 'cases':21,'framesPerCase':512,'pilotCasesExact':18,'priorIdentityCasesExact':7,'attachmentOnlyColorCasesExact':7,
 'rows':rows,'limits':['Static constant-alpha fixture, not real groom, fibre BSDF, motion or cost qualification.',
 'Three served-source arms; installed dependency and production source/assets unchanged.',
 'Native RGBA16F color/lock compared after copies; no assertion about every intermediate shader expression.',
 'A delivery repair does not qualify the rejected spatial sampler or make its remaining opacity bias acceptable.',
 'No threshold change or promotion; no full-suite/build/geometry/motion result.']}
(root/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
for label,records in [('case-records',results),('pilot-records',pilot['results'])]:
    data=''.join(json.dumps(r,separators=(',',':'))+'\n' for r in records).encode()
    (root/(label+'.jsonl.gz')).write_bytes(gzip.compress(data,mtime=0))
print('PASS: 21 actual Apple/Metal WebGPU cases x 512 frames; applied routes, attachments, formats, copies and native finiteness.')
print('PASS: seven identity cases reproduce prior frame traces, per-pixel means and 21 images exactly.')
print('PASS: seven attachment-only cases reproduce all identity color measurements, per-pixel means and images exactly.')
print('PASS: emitted nonzero locks remain absent from history without the copy; copied lock/history match bit-for-bit.')
print('PASS: eighteen pilot cases repeat all first-24 traces and images; endpoints/blend references remain valid.')
for row in rows:
    if 'half' in row['name'] and 'blend' not in row['name']:
        c=row['checkpoints'][-1]
        print(row['name'],'tail',c['tailMean'],'RMS',c['tailTemporalRMS'],'nativeLockTail',row['nativeHistoryLockTailMean'])
print(summary['finding'])
