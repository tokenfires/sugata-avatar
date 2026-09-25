import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { startProbeServer, launchProbeBrowser } from '../../../packages/core/src/render/MotionProbe.mjs';
import { encodePng } from '../../../tools/critic/png.mjs';

const root = 'tmp/hair-sep25/temporal-sequences';
const cases = [
  {name:'shared-half',alphas:[.5,.5],sequence:'shared', phases:[0,977]},
  {name:'distinct-quarter',alphas:[.25,.25],phases:[0,977]},
  {name:'distinct-half',alphas:[.5,.5],phases:[0,977]},
  {name:'distinct-three-quarter',alphas:[.75,.75],phases:[0,977]},
  {name:'distinct-mixed',alphas:[.25,.75],phases:[0,977]},
  {name:'distinct-reversed',alphas:[.5,.5],reverse:true},
  {name:'merged-negative',alphas:[.5,.5],merged:true},
  {name:'empty',alphas:[]}, {name:'zero-pair',alphas:[0,0]},
  {name:'opaque-pair',alphas:[1,1]}, {name:'front-body',alphas:[.5,.5],frontBody:true},
  {name:'single-half',alphas:[.5]},
  {name:'blend-quarter',alphas:[.25,.25],mode:'blend'},
  {name:'blend-half',alphas:[.5,.5],mode:'blend'},
  {name:'blend-three-quarter',alphas:[.75,.75],mode:'blend'},
  {name:'blend-mixed',alphas:[.25,.75],mode:'blend'}
];
const select = process.env.CASES?.split(',');
const modes = process.env.TEMPORAL?.split(',') ?? ['off','taau'];
const out = path.join(root,process.env.RUN_NAME ?? 'captures');
const count = Number(process.env.FRAMES ?? 512);
assert.ok([24,128,512].includes(count));
fs.mkdirSync(out,{recursive:true});
const sources=['packages/core/src/render/HairOIT.js','packages/core/src/render/Stage.js',
  'packages/core/src/render/GBuffer.js','packages/core/src/render/TRAAPost.js',
  'assets/hair/bob01/g050.glb',root+'/fixture.js',root+'/capture.mjs'];
const sha = data => createHash('sha256').update(data).digest('hex');
const report={baseCommit:'671ee3294fb9f1ea9c61e3664bd434bea38c51ae',
  sourceSHA256:Object.fromEntries(sources.map(f=>[f,sha(fs.readFileSync(f))])),results:[]};
const server=await startProbeServer({port:5187});let browser;
try {
  browser=await launchProbeBrowser();
  for(const temporal of modes) for(const item of cases.filter(c=>!select||select.includes(c.name))) for(const phase of item.phases??[0]) {
    const {phases,...settings}=item;
    const config={mode:'stochastic',sequence:'distinct',...settings,temporal,phase};
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
      for(const f of data.frames)for(let i=0;i<f.offsets.length;i++){
        if(config.mode!=='stochastic')continue;
        const rate=data.actual.materials[i].rate;
        const value=(f.frameId+phase)*rate;
        assert.equal(f.offsets[i],value-Math.floor(value),'GPU uniform does not follow requested sequence');
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
      console.log(name+' '+data.checkpoints.map(c=>`n${c.count}:mean=${c.temporalMean.toFixed(5)},tail=${c.tailMean.toFixed(5)},final=${c.finalMean.toFixed(5)},motion=${c.tailTemporalRMS.toFixed(5)}`).join(' | '));
      await page.evaluate(()=>layerProbe.dispose());
    }finally{await context.close();}
  }
}finally{
  if(browser)await browser.close();await server.close();
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
}
