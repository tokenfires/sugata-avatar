from pathlib import Path
import json,hashlib,gzip,struct,math
root=Path('tmp/hair-sep25/resolve-stages');out=root/'captures'
read=lambda p:json.loads(p.read_text());sha=lambda b:hashlib.sha256(b).hexdigest()
def js_sum(values):
 total=0
 for value in values:total+=value
 return total
def key(r):
 c=r['config'];return f"{c['name']}-p{c['phase']}"
def name(r):return r['config']['diagnostic']+'-taau-'+key(r)
report=read(out/'report.json');results=report['results'];assert len(results)==48
for p,h in report['sourceSHA256'].items():assert sha(Path(p).read_bytes())==h,p
by={(r['config']['diagnostic'],key(r)):r for r in results}
full={name(r):read(out/(name(r)+'.json')) for r in results}
fields=['frameId','mean','min','max','spatialSD','temporalRMS','offsets','counters','oracleMismatches','resolve']
equivalences=[]
for r in results:
 c,a=r['config'],r['actual'];control=by['identity',key(r)]
 assert len(r['frames'])==512 and a['frameId']==512 and a['captureTime']==0
 assert a['stats']['backend']=='webgpu' and a['adapter']['vendor']=='apple'
 assert a['stats']['temporalAA']=='taau' and a['stats']['resolutionScale']==.66
 assert r['maskPixels']==12544 and r['bounds']=={'x0':72,'x1':184,'y0':72,'y1':184}
 assert [f['frameId'] for f in r['frames']]==list(range(1,513))
 assert [f['resolve'] for f in r['frames']]==[f['resolve'] for f in control['frames']],name(r)
 assert [[f[k] for k in fields] for f in r['frames']]==[[f[k] for k in fields] for f in control['frames']]
 assert full[name(r)]['pixelMeans']==full[name(control)]['pixelMeans']
 for f in r['frames']:
  for channel in ['resolve','diagnostic']:
   if channel=='diagnostic' and c['diagnostic']=='identity':assert f[channel] is None;continue
   v=f[channel]['values'];assert v['whole']['nan']==v['whole']['infinity']==0
   assert v['whole']['components']==262144 and v['roi']['pixels']==12544
  for i in range(len(f['offsets'])):
   if c['mode']!='stochastic':continue
   if c['sampler']=='counter':assert f['counters'][i]==f['frameId']+c['phase']
   else:
    value=(f['frameId']+c['phase'])*.6180339887498949
    assert f['offsets'][i]==value-math.floor(value)
 assert len(r['routes'])==1
 route=r['routes'][0]
 assert route['beforeSHA256']==sha((out/'original-served.js').read_bytes())
 assert route['afterSHA256']==sha((out/(c['diagnostic']+'-served.js')).read_bytes())
 for s,base in zip(r['checkpoints'],control['checkpoints']):
  assert s['imageSHA256']==base['imageSHA256']
  assert sha((out/f'{name(r)}-n{s["count"]}.png').read_bytes())==s['imageSHA256']
  if c['diagnostic']!='identity':assert sha((out/f'{name(r)}-n{s["count"]}-diagnostic.png').read_bytes())==s['diagnosticImageSHA256']
  n=s['native'];assert n['colorCopyDifferences']==0 and n['owner']=='TAAUNode'
  assert len(n['targets'])==3
  for t in n['targets']:
   assert t['type']==1016 and t['gpuFormat']=='rgba16float' and t['width']==t['height']==256
   assert t['attachments']==((1 if c['diagnostic']=='identity' else 3) if t['name']=='resolve' else 2)
   assert t['values']['whole']['nan']==t['values']['whole']['infinity']==0
   if t['name']=='historyLock':assert t['values']['whole']['finiteMax']==0
 if c['diagnostic']!='identity':equivalences.append({'case':name(r),'identity':name(control),'frames':512,'nativeRGBAHashesEqual':True,'pixelMeansAndImagesEqual':True})
assert len(equivalences)==40
pilot=read(root/'pilot-fixed/report.json');assert len(pilot['results'])==48
assert pilot['sourceSHA256']==report['sourceSHA256']
for r in pilot['results']:
 later=by[r['config']['diagnostic'],key(r)]
 assert r['frames']==later['frames'][:24]
 assert r['checkpoints']==later['checkpoints'][:1]
prior={key(r):r for r in map(json.loads,gzip.decompress(Path('docs/evidence/hair-2026-09-25/counter-coverage/case-records.jsonl.gz').read_bytes()).decode().splitlines()) if r['config']['temporal']=='taau'}
identities=[]
for (field,k),r in by.items():
 if field!='identity':continue
 old=prior[k]
 for f,g in zip(r['frames'],old['frames']):assert {key:f[key] for key in g}==g
 assert r['checkpoints']==old['checkpoints']
 identities.append({'case':name(r),'priorCase':'taau-'+k,'frames':512,'exact':True})
for field in ['identity','current','mean','history','clipped','locked']:
 for n,value in [('empty',1),('opaque-pair',0)]:assert all(f['min']==f['max']==value for f in by[field,n+'-p0']['frames'])
 for n,value in [('blend-half',.25),('blend-quarter',.5625)]:assert all(abs(f['mean']-value)<=1/255 for f in by[field,n+'-p0']['frames'])
rows=[]
for field,k in by:
 if field!='identity':continue
 reference=math.prod(1-a for a in by[field,k]['config']['alphas'])
 per_frame=[]
 for i in range(512):
  stages={field:by[field,k]['frames'][i]['diagnostic']['values']['roi']['redMean'] for field in ['current','mean','history','clipped','locked']}
  stages['output']=by['identity',k]['frames'][i]['resolve']['values']['roi']['redMean']
  per_frame.append({'frameId':i+1,**stages})
 tail=per_frame[-64:]
 means={field:js_sum(f[field] for f in tail)/64 for field in ['current','mean','history','clipped','locked','output']}
 transitions={b+'Minus'+a.title():js_sum(f[b]-f[a] for f in tail)/64 for a,b in [('history','clipped'),('clipped','locked'),('locked','output'),('history','locked')]}
 # Sampled history versus previous output tests reprojection effects without changing them.
 transitions['historyMinusPreviousOutput']=js_sum(per_frame[i]['history']-per_frame[i-1]['output'] for i in range(448,512))/64
 rows.append({'case':k,'independentReference':reference,'tailMeans':means,'tailTransitions':transitions,'stageCheckpoints':[per_frame[i-1] for i in (1,2,24,128,512)]})
summary={'baseCommit':report['baseCommit'],'sourceSHA256':report['sourceSHA256'],'cases':48,'framesPerCase':512,'pilotCases':48,
 'instrumentEquivalences':equivalences,'priorIdentity':identities,'rows':rows,
 'limits':['Observations preserve full native RGBA resolve bytes at every frame; no candidate repair.',
 'Only diagnostic RGB is observed; auxiliary alpha is fixed at one to avoid the rejected vec4-observation alpha perturbation.',
 'Per-frame full-component native finiteness and native color hashes; history-copy/format topology checks at 24/128/512.',
 'Frame one is seeded with the beauty sample for all diagnostic fields and is excluded from last-64 analysis.',
 'Static constant-alpha fixture on shipping TAAU scale .66; original shared field or rejected counter sampler, no groom or motion acceptance.',
 'Stage mean changes locate observed adjustments, not a counterfactual proof that disabling an operation will repair quality.',
 'Diagnostic color image conversion clips to [0,1] and quantizes; native values are the authority.']}
(root/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
for filename,records in [('case-records.jsonl.gz',results),('pilot-records.jsonl.gz',pilot['results'])]:
 (root/filename).write_bytes(gzip.compress((''.join(json.dumps(r,separators=(',',':'))+'\n' for r in records)).encode(),mtime=0))
print('PASS: 48 Apple WebGPU cases x 512 frames; 40 diagnostic/native-RGBA equivalences, all 48 pilot repeats and 8 preceding controls.')
print('PASS: exact source routes, clocks, masks, endpoint/blend controls, native finiteness/copies, 144 ordinary plates and 120 diagnostic plates.')
for row in rows:print(row['case'],row['tailMeans'],row['tailTransitions'])
