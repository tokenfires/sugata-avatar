// Matched sampled moving evidence for frozen card281; no asset mutation or performance claim.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {startProbeServer,launchProbeBrowser} from '../../packages/core/src/render/MotionProbe.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const arg=(key,fallback)=>process.argv.find(x=>x.startsWith(`--${key}=`))?.slice(key.length+3)??fallback;
const arm=arg('arm','baseline'),view=arg('view','rear-oblique'),colour=arg('colour','brown');
assert.ok(['baseline','candidate'].includes(arm)&&['rear-oblique','back','rear-left'].includes(view)&&['brown','dark'].includes(colour));
const out=path.resolve(root,arg('out',`captures/nape-motion-v1/${arm}-${view}-${colour}`));
assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});fs.mkdirSync(path.join(out,'frames'));
const variant=arg('variant','guide');
const candidates={guide:['captures/hair-colour-2026-09-29/nape-guide-v1/candidate.glb','dc6d17fbd6b98facd81e420ee24b46e28c2514243e065446e30ab2ef6de27427'],distal:['captures/nape-distal-v1/candidate.glb','b418d97eacd6edd4312fb198959b69f0cb6dbf0531abe17bda7f0791ef9d04e4']};
assert.ok(Object.hasOwn(candidates,variant));
const [candidate,candidateSha256]=candidates[variant];
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(sha(fs.readFileSync(path.join(root,candidate))),candidateSha256);
const sourcePaths=['tools/critic/bob-nape-motion.mjs','tools/critic/bob-nape-motion-browser.mjs','packages/core/src/Avatar.js','packages/core/src/motion/HairDynamics.js','packages/core/src/motion/HairBodyContact.js','packages/core/src/motion/HairSurfaceContact.js','packages/core/src/motion/Layer.js','packages/core/src/motion/Breath.js','packages/core/src/render/MotionProbe.mjs','packages/core/src/render/Stage.js','packages/core/src/render/TRAAPost.js','packages/core/src/material/HairMaterial.js','packages/testbed/src/showcase.js','assets/hair/bob02/g050.glb','assets/figures/figure_g050.glb',candidate];
const hashes=()=>Object.fromEntries(sourcePaths.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
const report={started:new Date().toISOString(),pid:process.pid,status:'running',arm,variant,candidate,candidateSha256,view,colour,fps:60,frameStride:3,geometryStride:15,totalFrames:555,sourceHashes:hashes(),samples:[],images:[],errors:[],limits:['One authored head-only sequence on g050/bob02; idle, gait, wind, other bodies, garments and all-motion qualification are excluded.','20fps image sequence; selected-card/body geometry at4Hz. No continuous-time contact guarantee.']};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
for(const p of sourcePaths.filter(p=>p.startsWith('tools/')||p.startsWith('packages/'))){const dest=path.join(out,'source',p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,p),dest);}
let server,browser,page;
try {
  server=await startProbeServer({port:5297});browser=await launchProbeBrowser();
  page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'no-preference'});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  let candidateLoads=0;
  if(arm==='candidate')await page.route('**/hair/bob02/g050.glb',async route=>{candidateLoads++;await route.fulfill({status:200,contentType:'model/gltf-binary',body:fs.readFileSync(path.join(root,candidate))});});
  await page.goto(`${server.baseUrl}/src/showcase.html?preset=casual&frame=portrait&capture=${colour==='brown'?'&hairColour=%23765344':''}`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.showcase||!document.querySelector('#error').hidden,null,{timeout:120000});
  assert.equal(await page.locator('#error').textContent(),'');assert.equal(candidateLoads,arm==='candidate'?1:0);report.candidateLoads=candidateLoads;
  report.setup=await page.evaluate(async({url,angle,neutral})=>{window.napeModule=await import(url);return napeModule.setupNapeMotion({angle,neutral});},{url:`/@fs/${root}tools/critic/bob-nape-motion-browser.mjs`,angle:{'rear-oblique':135,back:180,'rear-left':-135}[view],neutral:colour==='brown'});
  assert.equal(report.setup.clock.frame,98);save();
  for(let frame=0;frame<=555;frame++){
    if(frame)await page.evaluate(async()=>{napeTick(1/60);await showcase.step(1/60);});
    if(frame%3===0){
      const data=await page.evaluate(()=>showcase.avatar.stage.canvas.toDataURL('image/png'));
      const bytes=Buffer.from(data.split(',')[1],'base64'),file=`frames/${String(frame).padStart(4,'0')}.png`;
      fs.writeFileSync(path.join(out,file),bytes);report.images.push({frame,file,sha256:sha(bytes)});
    }
    if(frame%15===0){
      const sample=await page.evaluate(frame=>napeModule.napeSample(frame),frame);
      assert.ok(Math.abs(sample.time-frame/60)<1e-9);assert.equal(sample.clock.frame,98+frame);
      const raw=gzipSync(JSON.stringify(sample)),file=`sample-${String(frame).padStart(4,'0')}.json.gz`;fs.writeFileSync(path.join(out,file),raw);
      const {bodyPositions,bodyNormals,...compact}=sample;
      report.samples.push({...compact,geometryFile:file,geometrySha256:sha(raw)});save();
    }
    if(frame%60===0)console.log(`${arm} ${view} ${colour}: ${frame}/555`);
  }
  report.disposal=await page.evaluate(()=>{showcase.controls.dispose();showcase.avatar.dispose();return showcase.avatar.report().disposal;});
  assert.deepEqual(report.disposal.leaked,[]);assert.deepEqual(report.errors,[]);assert.deepEqual(hashes(),report.sourceHashes);
  report.status='captured';
}catch(error){report.errors.push(error.stack);report.status='failed';process.exitCode=1;}
finally{await page?.close();await browser?.close();await server?.close();report.finished=new Date().toISOString();save();}
console.log(`${report.status}: ${out}`);
