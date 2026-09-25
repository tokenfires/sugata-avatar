from pathlib import Path
import hashlib,json,math,struct,gzip
root=Path('tmp/hair-sep25/counter-coverage');out=root/'captures'
read=lambda p:json.loads(p.read_text())
sha=lambda b:hashlib.sha256(b).hexdigest()
def js_sum(v):
 total=0
 for x in v:total+=x
 return total
def name(r):
 c=r['config'];return f"{c['temporal']}-{c['name']}-p{c['phase']}"
report=read(out/'report.json');results=report['results'];assert len(results)==48
for p,h in report['sourceSHA256'].items():assert sha(Path(p).read_bytes())==h,p
full={name(r):read(out/(name(r)+'.json')) for r in results}
fields=['frameId','mean','min','max','spatialSD','temporalRMS']
def measurements(r):return [[f[k] for k in fields] for f in r['frames']]
raw_oracle_pixels=0
for r in results:
 c,a=r['config'],r['actual'];assert r['maskPixels']==12544
 assert r['bounds']=={'x0':72,'x1':184,'y0':72,'y1':184}
 assert a['stats']['backend']=='webgpu' and a['adapter']['vendor']=='apple'
 assert a['stats']['temporalAA']==c['temporal']
 assert a['stats']['resolutionScale']==(1 if c['temporal']=='off' else .66)
 assert a['frameId']==512 and a['captureTime']==0
 assert [f['frameId'] for f in r['frames']]==list(range(1,513))
 assert [s['count'] for s in r['checkpoints']]==[24,128,512]
 ids=[m['ids'] for m in a['materials']]
 expected=[] if not c['alphas'] else [[101]*4+[503]*4] if c.get('merged') else [[101 if c.get('sharedId') else [101,503][i]]*4 for i in range(len(c['alphas']))]
 assert ids==expected,(name(r),ids)
 for m in a['materials']:
  assert m['idArrayType']=='Uint32Array'
  for i in range(0,len(m['indices']),3):assert len({m['ids'][v] for v in m['indices'][i:i+3]})==1
 for f in r['frames']:
  assert f['oracleMismatches']==0
  if c['temporal']=='off' and c['sampler']=='counter' and c['mode']=='stochastic':raw_oracle_pixels+=r['maskPixels']
  for i in range(len(f['offsets'])):
   if c['mode']!='stochastic':continue
   if c['sampler']=='counter':assert f['counters'][i]==f['frameId']+c['phase']
   else:
    value=(f['frameId']+c['phase'])*.6180339887498949
    assert f['offsets'][i]==value-math.floor(value)
 for s in r['checkpoints']:
  prefix=r['frames'][:s['count']];tail=prefix[-min(64,s['count']):]
  assert s['temporalMean']==js_sum(f['mean'] for f in prefix)/len(prefix)
  assert s['tailMean']==js_sum(f['mean'] for f in tail)/len(tail)
  assert s['tailTemporalRMS']==js_sum(f['temporalRMS'] or 0 for f in tail)/len(tail)
  assert sha((out/f'{name(r)}-n{s["count"]}.png').read_bytes())==s['imageSHA256']
  if c['temporal']=='taau':
   n=s['native'];assert n['owner']=='TAAUNode' and n['colorCopyDifferences']==0
   for t in n['targets']:
    assert t['width']==t['height']==256 and t['type']==1016 and t['gpuFormat']=='rgba16float'
    assert t['attachments']==(1 if t['name']=='resolve' else 2)
    assert t['values']['whole']['nan']==t['values']['whole']['infinity']==0
    if t['name']=='historyLock':assert t['values']['whole']['finiteMax']==0
  else:assert s['native'] is None

equivalences=[]
for mode in ['off','taau']:
 for a,b in [('shared-half','shared-single'),('counter-half','reversed'),('counter-half','merged'),('counter-half','merged-reversed'),('shared-id','single')]:
  x,y=[full[f'{mode}-{n}-p0'] for n in (a,b)]
  assert measurements(x)==measurements(y)
  assert x['pixelMeans']==y['pixelMeans']
  assert x['checkpoints']==y['checkpoints']
  equivalences.append({'mode':mode,'a':a,'b':b,'exact':True})
 for n,expected in [('empty',1),('zero-pair',1),('opaque-pair',0),('front-body',1)]:
  assert all(f['min']==f['max']==expected for f in full[f'{mode}-{n}-p0']['frames'])
 for n,expected in [('quarter',.5625),('half',.25),('three-quarter',.0625),('mixed',.1875)]:
  assert all(abs(f['mean']-expected)<=1/255 for f in full[f'{mode}-blend-{n}-p0']['frames'])

pilot=read(root/'pilot/report.json');assert len(pilot['results'])==28
assert pilot['sourceSHA256']==report['sourceSHA256']
for r in pilot['results']:
 later=full[name(r)];assert r['frames']==later['frames'][:24]
 assert r['checkpoints']==later['checkpoints'][:1]
 for c in r['checkpoints']:assert sha((root/'pilot'/f'{name(r)}-n{c["count"]}.png').read_bytes())==c['imageSHA256']

prior={name(r):r for r in map(json.loads,Path('docs/evidence/hair-2026-09-25/spatial-fields/case-records.jsonl').read_text().splitlines())}
identity=[]
for mode in ['off','taau']:
 for new,old,phases in [('shared-half','shared-half',[0,977]),('shared-single','single-half',[0]),*[(n,n,[0]) for n in ['empty','zero-pair','opaque-pair','front-body','blend-quarter','blend-half','blend-three-quarter','blend-mixed']]]:
  for phase in phases:
   cur,prev=full[f'{mode}-{new}-p{phase}'],prior[f'{mode}-{old}-p{phase}']
   assert measurements(cur)==measurements(prev)
   for cc,pc in zip(cur['checkpoints'],prev['checkpoints']):assert {k:v for k,v in cc.items() if k!='native'}==pc
   identity.append({'current':name(cur),'previous':name(prev),'frames':512,'exact':True})
assert len(identity)==22

def distribution(values,reference):
 v=sorted(values);n=len(v);mean=js_sum(v)/n
 return {'mean':mean,'min':v[0],'max':v[-1],'p05':v[math.floor(.05*(n-1))],'p95':v[math.floor(.95*(n-1))],
  'spatialSD':math.sqrt(js_sum((x-mean)**2 for x in v)/n),'referenceRMS':math.sqrt(js_sum((x-reference)**2 for x in v)/n)}
rows=[]
for r in results:
 c=r['config'];reference=1 if c.get('frontBody') else math.prod(1-a for a in c['alphas'])
 f=[x['mean'] for x in r['frames']]
 rows.append({'name':name(r),'independentReference':reference,'checkpoints':r['checkpoints'],
  'frameMeanRange':[min(f),max(f)],'frameMeanSD':math.sqrt(js_sum((x-r['temporalMean'])**2 for x in f)/len(f)),
  'pixelMeans':distribution(full[name(r)]['pixelMeans'],reference),
  'pixelMeansSHA256':sha(struct.pack('<'+'d'*r['maskPixels'],*full[name(r)]['pixelMeans']))})
summary={'baseCommit':report['baseCommit'],'sourceSHA256':report['sourceSHA256'],
 'verdict':'REJECT for groom/runtime promotion: counter IDs repair the raw two-card coverage mechanism but shipping TAAU remains strongly dark-biased and noisy.',
 'cases':48,'framesPerCase':512,'pilotCases':28,'rawCounterPixelsComparedWithIntegerCPUOracle':raw_oracle_pixels,
 'geometryMask':{'pixels':12544,'bounds':results[0]['bounds']},'equivalences':equivalences,'priorIdentity':identity,'rows':rows,
 'limits':['Static constant-alpha fixture, not a groom or fibre BSDF, motion or cost qualification.',
 'Fixed IDs 101/503 carried by Uint32 per-vertex attribute; exact separate/merged/reversed pixel equality, no asset edits.',
 'Integer hash mixes pixel, frame and card; measured behavior is not a universal independence/convergence theorem.',
 'Raw scale 1 and shipping TAAU scale .66 are different render paths. No lock-copy correction or other TAAU modification.',
 'Native finiteness is sampled at 24/128/512, not every frame. RGBA8 measurements use linear grayscale diagnostic output.',
 'Last-64 temporal RMS is mean consecutive-frame pixel RMS, not camera or geometry motion. Whole-prefix means include startup.',
 'All thresholds unchanged. No specific internal cause of TAAU bias isolated here.']}
(root/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
for file,records in [('case-records.jsonl.gz',results),('pilot-records.jsonl.gz',pilot['results'])]:
 (root/file).write_bytes(gzip.compress((''.join(json.dumps(r,separators=(',',':'))+'\n' for r in records)).encode(),mtime=0))
print(f'PASS: 48 actual Apple WebGPU cases x 512 frames, 144 plates, stable IDs and {raw_oracle_pixels:,} raw ROI pixels match the CPU oracle.')
print('PASS: endpoint/depth/blend controls, 10 exact equivalences, 28 repeated pilots, 22 exact prior controls, native finite/copy checks and source hashes.')
for r in rows:
 if 'counter-' in r['name'] or 'shared-half' in r['name']:
  c=r['checkpoints'][-1]
  print(r['name'],{k:c[k] for k in ['temporalMean','tailMean','tailTemporalRMS']},'pixel mean SD',r['pixelMeans']['spatialSD'])
print(summary['verdict'])
