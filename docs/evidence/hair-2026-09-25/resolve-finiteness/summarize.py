from pathlib import Path
import hashlib
import json
import math
import struct

root=Path('tmp/hair-sep25/resolve-finiteness')
out=root/'captures'
read=lambda p:json.loads(p.read_text())
sha=lambda data:hashlib.sha256(data).hexdigest()
report=read(out/'report.json')
results=report['results']
assert len(results)==9
for path,expected in report['sourceSHA256'].items():
    assert sha(Path(path).read_bytes())==expected,path

def name(r):
    c=r['config']
    return f'{c["temporal"]}-{c["name"]}-p{c["phase"]}'

prior_dir=Path('docs/evidence/hair-2026-09-25/spatial-fields')
prior={name(r):r for r in map(json.loads,(prior_dir/'case-records.jsonl').read_text().splitlines())}
prior_rows={r['name']:r for r in read(prior_dir/'summary.json')['rows']}
whole_components=roi_components=0
rows=[]
for r in results:
    c,actual=r['config'],r['actual']
    key=name(r)
    assert actual['stats']['backend']=='webgpu' and actual['adapter']['vendor']=='apple'
    assert actual['stats']['temporalAA']=='taau' and actual['stats']['resolutionScale']==.66
    assert actual['frameId']==512 and actual['captureTime']==0
    assert actual['nativeAudit']['owner']=='TAAUNode' and not actual['nativeAudit']['sharpenNode']
    assert r['maskPixels']==12544 and r['bounds']=={'x0':72,'x1':184,'y0':72,'y1':184}
    for target in actual['nativeAudit']['targets']:
        assert target['width']==target['height']==256
        assert target['gpuFormat']=='rgba16float' and target['typedArray']=='Uint16Array'
        assert target['textureType']==1016 and target['textureFormat']==1023
        assert target['attachments']==(1 if target['name']=='resolve' else 2)
    assert [f['frameId'] for f in r['frames']]==list(range(1,513))
    for f in r['frames']:
        for i,offset in enumerate(f['offsets']):
            if c['mode']!='stochastic':continue
            rate=math.sqrt(2)-1 if c['sequence']=='distinct' and i==1 else .6180339887498949
            assert actual['materials'][i]['rate']==rate
            assert actual['materials'][i]['field']==('yx' if c['spatial']=='swapped' and i==1 else 'xy')
            value=(f['frameId']+c['phase'])*rate
            assert offset==value-math.floor(value)
        audit=f['nativeAudit']
        assert audit['resolveHistoryBitDifferences']==0
        assert audit['quantization']['finiteCompared']==262144
        assert audit['quantization']['quantizationMismatches']==0
        assert audit['quantization']['maxQuantizationError']<=1
        for buffer in ['resolve','historyColor','historyLock']:
            for region,pixels in [('whole',65536),('roi',12544)]:
                a=audit[buffer][region]
                assert a['pixels']==pixels and a['components']==pixels*4
                assert a['nan']==a['infinity']==a['nonfinitePixels']==0
                assert a['redFinite']==pixels
                if region=='whole':whole_components+=a['components']
                else:roi_components+=a['components']
            # Observation of this sampled implementation, not a claim that zero lock is correct.
            assert audit[buffer]['whole']['finiteMin'] is not None
        assert audit['historyLock']['whole']['finiteMin']==audit['historyLock']['whole']['finiteMax']==0
        if c['name'] in ['empty','opaque-pair']:
            expected=1 if c['name']=='empty' else 0
            assert f['min']==f['max']==expected
            if c['name']=='opaque-pair':assert audit['resolve']['roi']['redMean']==0
            # Native white can carry sub-code-value filtering/half-float differences;
            # the unchanged byte endpoint and per-component conversion check bind it.
    previous=prior[key]
    assert [{k:v for k,v in f.items() if k!='nativeAudit'} for f in r['frames']]==previous['frames']
    assert r['checkpoints']==previous['checkpoints']
    full=read(out/(key+'.json'))
    pixel_sha=sha(struct.pack('<'+'d'*r['maskPixels'],*full['pixelMeans']))
    assert pixel_sha==prior_rows[key]['pixelMeansSHA256']
    for s in r['checkpoints']:
        assert sha((out/f'{key}-n{s["count"]}.png').read_bytes())==s['imageSHA256']
    tail=r['frames'][-64:]
    rows.append({'name':key,'nativeMetadata':actual['nativeAudit'],
                 'maxNativeNonfiniteComponents':0,
                 'nativeROIMeanRange':[min(f['nativeAudit']['resolve']['roi']['redMean'] for f in r['frames']),max(f['nativeAudit']['resolve']['roi']['redMean'] for f in r['frames'])],
                 'nativeColorMeanLast64':sum(f['nativeAudit']['resolve']['roi']['redMean'] for f in tail)/64,
                 'rgba8MeanLast64':r['checkpoints'][-1]['tailMean'],
                 'maxQuantizationErrorCodeValues':max(f['nativeAudit']['quantization']['maxQuantizationError'] for f in r['frames']),
                 'resolveHistoryBitDifferences':0,'historyLockRange':[0,0],
                 'pixelMeansSHA256':pixel_sha,'checkpoints':r['checkpoints']})

by_name={name(r):r for r in results}
pilot=read(root/'pilot/report.json')
assert len(pilot['results'])==6 and pilot['sourceSHA256']==report['sourceSHA256']
for r in pilot['results']:
    final=by_name[name(r)]
    assert r['frames']==final['frames'][:24]
    assert r['checkpoints']==final['checkpoints'][:1]
    assert sha((root/'pilot'/f'{name(r)}-n24.png').read_bytes())==r['checkpoints'][0]['imageSHA256']

initial=read(root/'initial-pilot/report.json')
assert len(initial['results'])==6
for path,expected in initial['sourceSHA256'].items():
    mapped=root/('initial-'+Path(path).name) if path in [str(root/'fixture.js'),str(root/'capture.mjs')] else Path(path)
    assert sha(mapped.read_bytes())==expected,path
for r in initial['results']:
    final=by_name[name(r)]
    prefix=json.loads(json.dumps(final['frames'][:24]))
    for f in prefix:del f['nativeAudit']['quantization']
    assert r['frames']==prefix
    assert r['checkpoints']==final['checkpoints'][:1]

summary={'baseCommit':report['baseCommit'],'sourceSHA256':report['sourceSHA256'],
         'finding':'No NaN or infinity reproduced in sampled native resolve/color-history/lock buffers. The dark bias exists before RGBA8 conversion; no denominator guard is justified by this audit.',
         'cases':9,'framesPerCase':512,'nativeBuffersPerFrame':3,
         'wholeFrameComponentsExamined':whole_components,'roiComponentsExamined':roi_components,
         'nonfiniteComponents':0,'priorCasesWithExactFrameTracesPixelMeansAndImages':9,
         'pilotCasesWithExact24FrameTracesAndImages':6,'initialPilotCasesWithExactCommon24FrameTracesAndImages':6,
         'rows':rows,'observation':'Native resolve has one attachment; history has color and lock. Sampled history lock is identically zero. Source writes two output members but copies only resolved color to history; causal effect of changing this wiring is untested.',
         'limits':['Native buffers only; no assertion about all intermediate shader expressions or other GPUs.',
                   'Static constant-alpha basic-material fixture, not real-groom or fibre-BSDF qualification.',
                   'RGBA16F readback decoded from Uint16 bit patterns; all four channels counted in whole-frame and fixed ROI.',
                   'Resolve/history comparison is after the renderer copies current color into history, not an independent capture.',
                   'No runtime, dependency, asset, threshold or calibration modification; no motion, cost, geometry, build or full-suite result.']}
(root/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
for label,records in [('case-records',results),('pilot-records',pilot['results']),('initial-pilot-records',initial['results'])]:
    (root/(label+'.jsonl')).write_text(''.join(json.dumps(r,separators=(',',':'))+'\n' for r in records))
(root/'initial-source-hashes.json').write_text(json.dumps(initial['sourceSHA256'],indent=2)+'\n')
print('PASS: nine actual Apple/Metal WebGPU cases x 512 frames, three native RGBA16F buffers each frame.')
print(f'PASS: {whole_components} full-frame components and {roi_components} ROI components classified; zero nonfinite.')
print('PASS: native color matches copied history bit-for-bit and ordinary RGBA8 pixels within one code value.')
print('PASS: all nine prior frame traces, per-pixel temporal means and 27 checkpoint images reproduce exactly.')
print('PASS: six final-pilot and six initial-pilot cases reproduce all common first-24 traces and images.')
print('OBSERVED: native history lock remains zero; resolve has one attachment, history two. Wiring effect is not tested.')
for row in rows:print(row['name'],'native tail',row['nativeColorMeanLast64'],'RGBA8 tail',row['rgba8MeanLast64'],'max quant error',row['maxQuantizationErrorCodeValues'])
print(summary['finding'])
