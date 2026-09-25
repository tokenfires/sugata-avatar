import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { startProbeServer, launchProbeBrowser } from '../../../packages/core/src/render/MotionProbe.mjs';
import { encodePng } from '../../../tools/critic/png.mjs';

const root = 'tmp/hair-sep25/counter-coverage';
const cases = [
  {name:'shared-half',alphas:[.5,.5],sampler:'shared',phases:[0,977]},
  {name:'shared-single',alphas:[.5],sampler:'shared'},
  ...[['quarter',[.25,.25]],['half',[.5,.5]],['three-quarter',[.75,.75]],['mixed',[.25,.75]]]
    .map(([name,alphas])=>({name:'counter-'+name,alphas,phases:[0,977]})),
  {name:'reversed',alphas:[.5,.5],reverse:true},
  {name:'merged',alphas:[.5,.5],merged:true},
  {name:'merged-reversed',alphas:[.5,.5],merged:true,reverse:true},
  {name:'shared-id',alphas:[.5,.5],sharedId:true},
  {name:'single',alphas:[.5]},
  {name:'empty',alphas:[]}, {name:'zero-pair',alphas:[0,0]},
  {name:'opaque-pair',alphas:[1,1]}, {name:'front-body',alphas:[.5,.5],frontBody:true},
  ...[['quarter',[.25,.25]],['half',[.5,.5]],['three-quarter',[.75,.75]],['mixed',[.25,.75]]]
    .map(([name,alphas])=>({name:'blend-'+name,alphas,mode:'blend'}))
];
const select = process.env.CASES?.split(',');
const modes = process.env.TEMPORAL?.split(',') ?? ['off','taau'];
const out = path.join(root,process.env.RUN_NAME ?? 'captures');
const count = Number(process.env.FRAMES ?? 512);
assert.ok([24,128,512].includes(count));
fs.mkdirSync(out,{recursive:true});
const sources=['packages/core/src/render/HairOIT.js','packages/core/src/render/Stage.js',
  'packages/core/src/render/GBuffer.js','packages/core/src/render/TRAAPost.js',
  'assets/hair/bob01/g050.glb','node_modules/three/examples/jsm/tsl/display/TAAUNode.js',
  'node_modules/three/src/nodes/math/Hash.js',root+'/sampler.js',root+'/half-audit.mjs',root+'/fixture.js',root+'/capture.mjs'];
const sha = data => createHash('sha256').update(data).digest('hex');
const report={baseCommit:'f4a7c032ceeb24829cee0ba459587d8533d0e921',
  sourceSHA256:Object.fromEntries(sources.map(f=>[f,sha(fs.readFileSync(f))])),results:[]};
const server=await startProbeServer({port:5187});let browser;
try {
  browser=await launchProbeBrowser();
  for(const temporal of modes) for(const item of cases.filter(c=>!select||select.includes(c.name))) for(const phase of item.phases??[0]) {
    const {phases,...settings}=item;
    const config={mode:'stochastic',sampler:'counter',...settings,temporal,phase};
    const context=await browser.newContext({viewport:{width:256,height:256},deviceScaleFactor:1});
    try {
      const page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Failed to load resource'))errors.push(m.text());});
      page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(r.status()+' '+r.url());});
      await page.goto(`${server.baseUrl}/@fs${path.resolve(root,'fixture.html')}?config=${encodeURIComponent(JSON.stringify(config))}`,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>!!globalThis.layerProbe,null,{timeout:120000,polling:200});
      const data=await page.evaluate(n=>layerProbe.run(n),count);
      assert.deepEqual(errors,[]);
      assert.equal(data.actual.stats.backend,'webgpu');
      assert.equal(data.actual.stats.temporalAA,temporal);
      assert.equal(data.actual.stats.resolutionScale,temporal==='taau'?.66:1);
      assert.equal(data.actual.frameId,count);assert.equal(data.actual.captureTime,0);
      assert.equal(data.actual.adapter.vendor,'apple');
      assert.equal(data.maskPixels,12544);
      for(const f of data.frames){
        assert.equal(f.oracleMismatches,0,'Raw GPU pixels disagree with integer CPU oracle');
        for(let i=0;i<f.offsets.length;i++){
          if(config.mode!=='stochastic')continue;
          if(config.sampler==='counter')assert.equal(f.counters[i],(f.frameId+phase)>>>0);
          else{
            const value=(f.frameId+phase)*.6180339887498949;
            assert.equal(f.offsets[i],value-Math.floor(value));
          }
        }
      }
      for(const checkpoint of data.checkpoints)if(temporal==='taau'){
        const native=checkpoint.native;
        assert.equal(native.owner,'TAAUNode');assert.equal(native.colorCopyDifferences,0);
        assert.equal(native.targets.length,3);
        for(const t of native.targets){
          assert.equal(t.width,256);assert.equal(t.height,256);assert.equal(t.type,1016);assert.equal(t.gpuFormat,'rgba16float');
          assert.equal(t.attachments,t.name==='resolve'?1:2);
          assert.equal(t.values.whole.nan+t.values.whole.infinity,0);
          if(t.name==='historyLock')assert.equal(t.values.whole.finiteMax,0);
        }
      }
      const name=`${temporal}-${item.name}-p${phase}`;
      for(const c of data.checkpoints){
        const png=encodePng(data.size,data.size,Uint8Array.from(c.rgba));
        fs.writeFileSync(path.join(out,`${name}-n${c.count}.png`),png);
        c.imageSHA256=sha(png);delete c.rgba;
      }
      delete data.final.rgba;
      fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(data,null,2)+'\n');
      delete data.pixelMeans;report.results.push(data);
      console.log(name+' '+data.checkpoints.map(c=>`n${c.count}:mean=${c.temporalMean.toFixed(5)},tail=${c.tailMean.toFixed(5)},final=${c.finalMean.toFixed(5)},temporalRMS=${c.tailTemporalRMS.toFixed(5)}`).join(' | '));
      await page.evaluate(()=>layerProbe.dispose());
    }finally{await context.close();}
  }
}finally{
  if(browser)await browser.close();await server.close();
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
}
