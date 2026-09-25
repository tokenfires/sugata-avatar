import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { startProbeServer, launchProbeBrowser } from '../../../packages/core/src/render/MotionProbe.mjs';
import { encodePng } from '../../../tools/critic/png.mjs';

const root = 'tmp/hair-sep25/resolve-finiteness';
const cases = [
  {name:'shared-half',alphas:[.5,.5],spatial:'original',phases:[0,977]},
  {name:'temporal-half',alphas:[.5,.5],spatial:'original',sequence:'distinct',phases:[0,977]},
  {name:'swapped-distinct-half',alphas:[.5,.5],sequence:'distinct',phases:[0,977]},
  {name:'opaque-pair',alphas:[1,1]}, {name:'empty',alphas:[]},
  {name:'blend-half',alphas:[.5,.5],mode:'blend'}
];
const select = process.env.CASES?.split(',');
const modes = process.env.TEMPORAL?.split(',') ?? ['taau'];
const out = path.join(root,process.env.RUN_NAME ?? 'captures');
const count = Number(process.env.FRAMES ?? 512);
assert.ok([24,128,512].includes(count));
fs.mkdirSync(out,{recursive:true});
const sources=['packages/core/src/render/HairOIT.js','packages/core/src/render/Stage.js',
  'packages/core/src/render/GBuffer.js','packages/core/src/render/TRAAPost.js',
  'assets/hair/bob01/g050.glb',root+'/fixture.js',root+'/capture.mjs',root+'/half-audit.mjs',
  'node_modules/three/examples/jsm/tsl/display/TAAUNode.js'];
const sha = data => createHash('sha256').update(data).digest('hex');
const report={baseCommit:'9d5700e208987b2379e79930ee2a15dcda9c45b4',
  sourceSHA256:Object.fromEntries(sources.map(f=>[f,sha(fs.readFileSync(f))])),results:[]};
const server=await startProbeServer({port:5187});let browser;
try {
  browser=await launchProbeBrowser();
  for(const temporal of modes) for(const item of cases.filter(c=>!select||select.includes(c.name))) for(const phase of item.phases??[0]) {
    const {phases,...settings}=item;
    const config={mode:'stochastic',sequence:'shared',spatial:'swapped',...settings,temporal,phase};
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
      assert.equal(data.actual.nativeAudit.owner,'TAAUNode');
      for(const f of data.frames)assert.equal(f.nativeAudit.resolveHistoryBitDifferences,0);
      for(const f of data.frames)for(let i=0;i<f.offsets.length;i++){
        if(config.mode!=='stochastic')continue;
        const rate=data.actual.materials[i].rate;
        assert.equal(data.actual.materials[i].field,config.spatial==='swapped'&&i===1?'yx':'xy');
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
      const maxNonfinite=Math.max(...data.frames.flatMap(f=>['resolve','historyColor','historyLock'].map(k=>f.nativeAudit[k].whole.nan+f.nativeAudit[k].whole.infinity)));
      console.log(name+' maxNonfinite='+maxNonfinite+' '+data.checkpoints.map(c=>`n${c.count}:mean=${c.temporalMean.toFixed(5)},tail=${c.tailMean.toFixed(5)},final=${c.finalMean.toFixed(5)},temporalRMS=${c.tailTemporalRMS.toFixed(5)}`).join(' | '));
      await page.evaluate(()=>layerProbe.dispose());
    }finally{await context.close();}
  }
}finally{
  if(browser)await browser.close();await server.close();
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
}
