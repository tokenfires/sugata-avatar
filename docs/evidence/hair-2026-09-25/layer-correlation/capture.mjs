import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { startProbeServer, launchProbeBrowser } from '../../../packages/core/src/render/MotionProbe.mjs';
import { encodePng } from '../../../tools/critic/png.mjs';

const root = 'tmp/hair-sep25/layer-correlation';
const cases = [
  {name:'empty', alphas:[]}, {name:'zero',alphas:[0]}, {name:'quarter',alphas:[0.25]},
  {name:'half',alphas:[0.5]}, {name:'three-quarter',alphas:[0.75]}, {name:'opaque',alphas:[1]},
  {name:'quarter-pair',alphas:[0.25,0.25]}, {name:'half-pair',alphas:[0.5,0.5]},
  {name:'three-quarter-pair',alphas:[0.75,0.75]}, {name:'mixed-pair',alphas:[0.25,0.75]},
  {name:'half-reversed',alphas:[0.5,0.5],reverse:true},
  {name:'half-merged',alphas:[0.5,0.5],merged:true},
  {name:'half-merged-reversed',alphas:[0.5,0.5],merged:true,reverse:true},
  {name:'half-phase-one',alphas:[0.5,0.5],phases:[0,1]},
  {name:'half-phase-977',alphas:[0.5,0.5],phases:[0,977]},
  {name:'front-body',alphas:[0.5,0.5],frontBody:true},
  {name:'blend-half',alphas:[0.5],mode:'blend'},
  {name:'blend-half-pair',alphas:[0.5,0.5],mode:'blend'},
  {name:'blend-mixed-pair',alphas:[0.25,0.75],mode:'blend'}
];
const select = process.env.CASES?.split(',');
const modes = process.env.TEMPORAL?.split(',') ?? ['off','taau'];
const out = path.join(root,process.env.RUN_NAME ?? 'captures');
fs.mkdirSync(out,{recursive:true});
const sources = ['packages/core/src/render/HairOIT.js','packages/core/src/render/Stage.js',
  'packages/core/src/render/GBuffer.js','packages/core/src/render/TRAAPost.js','assets/hair/bob01/g050.glb'];
const sha = data => createHash('sha256').update(data).digest('hex');
const report = {baseCommit:'4f12a97333662a214ba7d1d28526295b2a920830',
  sourceSHA256:Object.fromEntries(sources.map(f=>[f,sha(fs.readFileSync(f))])),results:[]};
const server = await startProbeServer({port:5187}); let browser;
try {
  browser = await launchProbeBrowser();
  for (const temporal of modes) for (const item of cases.filter(c=>!select||select.includes(c.name))) {
    const config = {mode:'stochastic',...item,temporal};
    const context = await browser.newContext({viewport:{width:256,height:256},deviceScaleFactor:1});
    try {
      const page = await context.newPage(), errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Failed to load resource'))errors.push(m.text());});
      page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(r.status()+' '+r.url());});
      const url = `${server.baseUrl}/@fs${path.resolve(root,'fixture.html')}?config=${encodeURIComponent(JSON.stringify(config))}`;
      await page.goto(url,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>!!globalThis.layerProbe,null,{timeout:120000,polling:200});
      const data = await page.evaluate(()=>layerProbe.run(128));
      assert.deepEqual(errors,[]);
      assert.equal(data.actual.stats.backend,'webgpu');
      assert.equal(data.actual.stats.temporalAA,temporal);
      assert.equal(data.actual.stats.resolutionScale,temporal==='taau'?0.66:1);
      assert.equal(data.actual.frameId,128);
      assert.equal(data.actual.captureTime,0);
      const name=temporal+'-'+item.name;
      const png=encodePng(data.size,data.size,Uint8Array.from(data.final.rgba));
      fs.writeFileSync(path.join(out,name+'.png'),png);
      delete data.final.rgba;
      data.imageSHA256=sha(png);
      fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(data,null,2)+'\n');
      delete data.pixelMeans;
      report.results.push(data);
      console.log(`${name}: temporal mean ${data.temporalMean.toFixed(6)}, final ${data.final.mean.toFixed(6)}, pixels ${data.maskPixels}`);
      await page.evaluate(()=>layerProbe.dispose());
    } finally {await context.close();}
  }
} finally {
  if(browser)await browser.close();
  await server.close();
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
}
