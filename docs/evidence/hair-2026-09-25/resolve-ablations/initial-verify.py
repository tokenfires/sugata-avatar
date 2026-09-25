from pathlib import Path
import json,hashlib,gzip,math,sys
root=Path('tmp/hair-sep25/resolve-ablations');run=sys.argv[1] if len(sys.argv)>1 else 'captures';out=root/run
read=lambda p:json.loads(p.read_text());sha=lambda b:hashlib.sha256(b).hexdigest()
def key(r):
 c=r['config'];return f"{c['name']}-p{c['phase']}"
def name(r):return r['config']['diagnostic']+'-taau-'+key(r)
def mean(v):
 s=0
 for x in v:s+=x
 return s/len(v)
report=read(out/'report.json');results=report['results'];assert len(results)==24
count=24 if run=='pilot' else 512
assert report['baseCommit']=='8b5e6133cc644eb9859a12e412b87f38222a8e27'
for p,h in report['sourceSHA256'].items():assert sha(Path(p).read_bytes())==h,p
prior={key(r):r for r in map(json.loads,gzip.decompress(Path('docs/evidence/hair-2026-09-25/resolve-stages/case-records.jsonl.gz').read_bytes()).decode().splitlines()) if r['config']['diagnostic']=='identity'}
by={(r['config']['diagnostic'],key(r)):r for r in results}
identities=[];rows=[];per_pixel=[]
for r in results:
 c,a=r['config'],r['actual'];k=key(r);full=read(out/(name(r)+'.json'))
 assert a['stats']['backend']=='webgpu' and a['adapter']['vendor']=='apple'
 assert a['stats']['temporalAA']=='taau' and a['stats']['resolutionScale']==.66
 assert a['frameId']==count and a['captureTime']==0 and r['maskPixels']==12544
 assert r['bounds']=={'x0':72,'x1':184,'y0':72,'y1':184}
 control=by['identity',k]
 for prop in ['size','projected','bounds','maskPixels']:assert r[prop]==control[prop]
 assert a['materials']==control['actual']['materials']
 assert [f['frameId'] for f in r['frames']]==list(range(1,count+1))
 for f,g in zip(r['frames'],control['frames']):
  assert f['diagnostic'] is None and f['oracleMismatches']==0
  assert f['resolve']['values']['whole']['nan']==f['resolve']['values']['whole']['infinity']==0
  assert f['resolve']['values']['whole']['components']==262144
  assert f['resolve']['values']['roi']['pixels']==12544
  for prop in ['offsets','counters','frameId']:assert f[prop]==g[prop]
  for i in range(len(f['offsets'])):
   if c['mode']!='stochastic':continue
   if c['sampler']=='counter':assert f['counters'][i]==f['frameId']+c['phase']
   else:
    value=(f['frameId']+c['phase'])*.6180339887498949
    assert f['offsets'][i]==value-math.floor(value)
 assert len(r['routes'])==1
 route=r['routes'][0];assert route['beforeSHA256']==sha((out/'original-served.js').read_bytes())
 assert route['afterSHA256']==sha((out/(c['diagnostic']+'-served.js')).read_bytes())
 for s in r['checkpoints']:
  assert sha((out/f'{name(r)}-n{s["count"]}.png').read_bytes())==s['imageSHA256']
  n=s['native'];assert n['owner']=='TAAUNode' and n['colorCopyDifferences']==0 and len(n['targets'])==3
  for t in n['targets']:
   assert t['type']==1016 and t['gpuFormat']=='rgba16float' and t['width']==t['height']==256
   assert t['attachments']==(1 if t['name']=='resolve' else 2)
   assert t['values']['whole']['nan']==t['values']['whole']['infinity']==0
   if t['name']=='historyLock':assert t['values']['whole']['finiteMax']==0
 if c['name'] in ['empty','opaque-pair']:
  value=1 if c['name']=='empty' else 0
  assert all(f['min']==f['max']==value for f in r['frames'])
 if c['mode']=='blend':assert all(abs(f['mean']-math.prod(1-v for v in c['alphas']))<=1/255 for f in r['frames'])
 if c['diagnostic']=='identity':
  p=prior[k];assert r['frames']==p['frames'][:count]
  assert r['checkpoints']==[s for s in p['checkpoints'] if s['count']<=count]
  identities.append(name(r))
 values=full['pixelMeans'];assert len(values)==12544 and all(math.isfinite(v) for v in values)
 per_pixel.append({'case':name(r),'bounds':r['bounds'],'pixelMeans':values})
 reference=math.prod(1-v for v in c['alphas']);tail=r['frames'][-64:]
 ordered=sorted(values)
 rows.append({'case':name(r),'reference':reference,'tailNativeMean':mean([f['resolve']['values']['roi']['redMean'] for f in tail]),'tailByteMean':mean([f['mean'] for f in tail]),'tailTemporalRMS':mean([f['temporalRMS'] or 0 for f in tail]),'temporalMean':r['temporalMean'],'pixelMeanDistribution':{'min':ordered[0],'p05':ordered[int(.05*(len(ordered)-1))],'median':ordered[len(ordered)//2],'p95':ordered[int(.95*(len(ordered)-1))],'max':ordered[-1],'rmsFromReference':math.sqrt(mean([(v-reference)**2 for v in values]))},'checkpointMeans':[{'count':s['count'],'tailMean':s['tailMean'],'finalMean':s['finalMean']} for s in r['checkpoints']]})
assert len(identities)==8
if count==512:
 pilot=read(root/'pilot/report.json');assert pilot['sourceSHA256']==report['sourceSHA256'] and len(pilot['results'])==24
 for r in pilot['results']:
  later=by[r['config']['diagnostic'],key(r)];assert r['frames']==later['frames'][:24] and r['checkpoints']==later['checkpoints'][:1]
  s=r['checkpoints'][0];assert sha((root/'pilot'/f'{name(r)}-n24.png').read_bytes())==s['imageSHA256']
 (root/'pilot-records.jsonl.gz').write_bytes(gzip.compress((''.join(json.dumps(r,separators=(',',':'))+'\n' for r in pilot['results'])).encode(),mtime=0))
for filename,records in [(f'{run}-records.jsonl.gz',results),(f'{run}-pixel-means.jsonl.gz',per_pixel)]:
 (root/filename).write_bytes(gzip.compress((''.join(json.dumps(r,separators=(',',':'))+'\n' for r in records)).encode(),mtime=0))
summary={'baseCommit':report['baseCommit'],'sourceSHA256':report['sourceSHA256'],'cases':24,'framesPerCase':count,'priorIdentities':identities,'pilotRepeats':24 if count==512 else None,'rows':rows,'limits':['Isolated constant-alpha fixture, no real-groom/motion/performance qualification.','Each arm changes one existing expression; original missing lock delivery and frame/flicker weighting remain unchanged.','No-clipping preserves lock expression with equal inputs; no-lock selects clipped history without interpolation.','Per-frame native resolve finiteness; history format/copy checks at checkpoints.','Native means distinguish half-float results from byte quantization; per-pixel temporal distributions are retained.']}
(root/(run+'-summary.json')).write_text(json.dumps(summary,indent=2)+'\n')
print(f'PASS: 24 Apple WebGPU cases x {count} frames; 8 prior identity repeats, unchanged geometry/material/mask/clock inputs, source hashes, endpoints/blends and native buffer/copy checks.')
if count==512:print('PASS: all 24 pilot traces and checkpoint images repeat exactly; 72 final plates verified.')
for r in rows:
 if any(s in r['case'] for s in ['shared-half','counter-half','counter-quarter']):print(r['case'],{k:r[k] for k in ['tailNativeMean','tailByteMean','tailTemporalRMS','pixelMeanDistribution']})
