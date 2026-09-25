import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {decodePng} from '../../../tools/critic/png.mjs';
import {patch} from './route.mjs';
const root='tmp/hair-sep25/lock-runtime';
const read=(p)=>fs.readFileSync(p),json=p=>JSON.parse(read(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const sourceHashes=json(root+'/source-hashes.json');
for(const [p,h] of Object.entries(sourceHashes))assert.equal(sha(read(p)),h,p);
const summary={sourceHashes,verdict:'Rejected for promotion: delivery works, T1 worsens; T1/T2/C4 remain red. No production change.',runs:{},baselineRepeats:[],pilotRepeats:[],maskComparisons:[],imageComparisons:[]};
const metric=(a,b,mask)=>{
  let pixels=0,changedPixels=0,squares=0,maxCodeValues=0;
  for(let p=0;p<a.width*a.height;p++){
    if(mask&&!mask[p])continue;
    pixels++;let changed=false;
    for(let c=0;c<3;c++){
      const d=Math.abs(Math.round(a.pixels[p*4+c]*255)-Math.round(b.pixels[p*4+c]*255));
      if(d)changed=true;squares+=d*d;maxCodeValues=Math.max(maxCodeValues,d);
    }
    if(changed)changedPixels++;
  }
  return {pixels,changedPixels,rmsCodeValues:pixels?Math.sqrt(squares/(3*pixels)):null,maxCodeValues};
};
for(const arm of ['identity','copy-lock'])for(const probe of ['tips','opacity']){
  const name=`${arm}-${probe}`,dir=root+'/'+name,pilot=root+'/pilot-'+name;
  const pipeline=json(dir+'/pipeline.json');
  assert.equal(pipeline.arm,arm);assert.equal(pipeline.routes.length,1);
  const before=read(dir+'/original-served.js'),after=read(dir+'/candidate-served.js');
  assert.equal(patch(before.toString(),arm),after.toString());
  assert.equal(pipeline.routes[0].beforeSHA256,sha(before));assert.equal(pipeline.routes[0].afterSHA256,sha(after));
  assert.equal(pipeline.snapshots.length,probe==='tips'?2:17);
  const native=[];
  pipeline.snapshots.forEach((s,i)=>{
    assert.equal(s.frameId,1+24*i);assert.equal(s.captureTime,0);
    assert.equal(s.stats.backend,'webgpu');assert.equal(s.stats.temporalAA,'taau');assert.equal(s.stats.resolutionScale,.66);
    assert.equal(s.stats.hairOIT,'stochastic');assert.equal(s.hairMaterialType,'HairNodeMaterial');
    assert.equal(s.phase,0);assert.equal(s.defect,null);assert.equal(s.hasInner,false);
    assert.equal(s.targets.length,arm==='identity'?3:4);
    assert.equal(s.copies.historyColor,0);
    if(arm==='copy-lock')assert.equal(s.copies.historyLock,0);
    for(const t of s.targets){
      assert.equal(t.width,900);assert.equal(t.height,1200);assert.equal(t.type,1016);assert.equal(t.gpuFormat,'rgba16float');
      assert.equal(t.strideBytes,7424);assert.equal(t.paddingBytes,224);
      assert.equal(t.values.components,4320000);assert.equal(t.values.nan+t.values.infinity,0);
      assert.equal(t.attachments,t.name==='color'?(arm==='identity'?1:2):2);
    }
    const lock=s.targets.find(t=>t.name==='historyLock').values;
    if(arm==='identity')assert.equal(lock.finiteMax,0);else assert.ok(lock.redMean>0);
    native.push({frame:s.frameId,lockMean:lock.redMean,lockMax:lock.finiteMax});
  });
  const measureNames=probe==='tips'?['measurements.json']:['portrait-measurements.json','rear34-measurements.json'];
  const measurements=Object.fromEntries(measureNames.map(n=>[n,json(dir+'/'+n)]));
  const images=fs.readdirSync(dir).filter(n=>n.endsWith('.png'));
  assert.equal(images.length,probe==='tips'?3:10);
  for(const n of [...images,...measureNames]){
    assert.deepEqual(read(dir+'/'+n),read(pilot+'/'+n),'Repeat '+name+'/'+n);
    summary.pilotRepeats.push({file:name+'/'+n,sha256:sha(read(dir+'/'+n))});
  }
  // Compare stable native records; timing, output paths and local Vite ports are not results.
  const prior=json(pilot+'/pipeline.json');
  for(let i=0;i<pipeline.snapshots.length;i++){
    for(const key of ['frameId','captureTime','owner','hairMaterialType','phase','defect','hasInner','targets','copies'])
      assert.deepEqual(pipeline.snapshots[i][key],prior.snapshots[i][key],name+' '+key);
  }
  summary.runs[name]={route:pipeline.routes[0],native,measurements,imageHashes:Object.fromEntries(images.map(n=>[n,sha(read(dir+'/'+n))]))};
  if(arm==='identity'){
    const baseline=probe==='tips'?'tmp/hair-sep25/pattern-phase/zero-tips':'tmp/hair-sep24/runtime-coverage/baseline-opacity';
    for(const n of [...images,...measureNames]){
      if(fs.existsSync(baseline+'/'+n))assert.deepEqual(read(dir+'/'+n),read(baseline+'/'+n),'Baseline '+n);
      else {
        const archived=json('docs/evidence/hair-2026-09-25/lock-runtime/summary.json').baselineRepeats;
        const record=archived.find(r=>r.file===name+'/'+n);
        assert.ok(record,'Missing recorded baseline '+n);
        assert.equal(sha(read(dir+'/'+n)),record.sha256,'Recorded baseline '+n);
      }
      summary.baselineRepeats.push({file:name+'/'+n,baseline:baseline+'/'+n,sha256:sha(read(dir+'/'+n))});
    }
  }
}
for(const [probe,views] of [['tips',['stochastic']],['opacity',['portrait','rear34']]])for(const view of views){
  const dirs=['identity','copy-lock'].map(arm=>root+'/'+arm+'-'+probe);
  const masks=dirs.map(d=>JSON.parse(gunzipSync(read(d+'/'+view+'-masks.json.gz'))));
  assert.deepEqual(masks[0].raster,masks[1].raster,view+' geometry raster');
  assert.deepEqual(masks[0].regions,masks[1].regions,view+' final mask membership');
  summary.maskComparisons.push({probe,view,rasterSHA256:sha(JSON.stringify(masks[0].raster)),regionSHA256:sha(JSON.stringify(masks[0].regions)),exactMembership:true});
  const files=probe==='tips'?[view+'.png']:[view+'-hair.png',view+'-bald.png'];
  for(const file of files){
    const [a,b]=dirs.map(d=>decodePng(read(d+'/'+file)));
    assert.equal(a.width,900);assert.equal(a.height,1200);assert.equal(b.width,900);assert.equal(b.height,1200);
    const regions=Object.fromEntries(Object.entries(masks[0].regions).map(([k,v])=>[k,Buffer.from(v,'base64')]));
    const differences={whole:metric(a,b)};
    if(probe==='tips'){
      const boundary=regions.stable.map(x=>1-x);
      for(const [k,v] of Object.entries({...regions,boundary}))differences[k]=metric(a,b,v);
    }
    summary.imageComparisons.push({probe,file,regions:differences});
  }
}
fs.writeFileSync(root+'/summary.json',JSON.stringify(summary,null,2)+'\n');
console.log('PASS: source hashes, exact routes, native finite/copy delivery, 24-step clocks, all pilot results, shipping baselines and geometry/mask membership verified.');
console.log(JSON.stringify({repeatedFiles:summary.pilotRepeats.length,baselineFiles:summary.baselineRepeats.length,maskComparisons:summary.maskComparisons,imageComparisons:summary.imageComparisons},null,2));
