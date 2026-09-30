// Matched ordinary-motion evidence for the frozen posterior envelope. No asset mutation or performance claim.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {startProbeServer,launchProbeBrowser} from '../../packages/core/src/render/MotionProbe.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const arg=(key,fallback)=>process.argv.find(x=>x.startsWith(`--${key}=`))?.slice(key.length+3)??fallback;
const arm=arg('arm','baseline'),view=arg('view','rear-left'),colour=arg('colour','brown');
const protocol=arg('protocol','ordinary'); assert.ok(['ordinary','head'].includes(protocol));
const totalFrames=protocol==='head'?555:720;
assert.ok(['baseline','candidate'].includes(arm)&&['rear-oblique','back','rear-left','front'].includes(view)&&['brown','dark'].includes(colour));
const extraImageFrames=arg('extra-image-frames','').split(',').filter(Boolean).map(Number);
assert.ok(extraImageFrames.every(f=>Number.isInteger(f)&&f>=0&&f<=totalFrames));
const out=path.resolve(root,arg('out',`captures/envelope-motion-v1/${arm}-${view}-${colour}`));
assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});fs.mkdirSync(path.join(out,'frames'));
const variant='envelope-v3',candidate='captures/bob-posterior-envelope-v3/candidate.glb',candidateSha256='d477f9079577f1205b706941a789b608a3dbb6974a022a6888251737abb26146';
const selectedCards=JSON.parse(fs.readFileSync(path.join(root,'captures/bob-posterior-envelope-v3/candidate-report.json'))).selected;
assert.equal(selectedCards.length,266);
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(sha(fs.readFileSync(path.join(root,candidate))),candidateSha256);
const sourcePaths=['tools/critic/bob-envelope-motion.mjs','tools/critic/bob-envelope-motion-browser.mjs','tools/critic/bob-nape-motion-browser.mjs','packages/core/src/Avatar.js','packages/core/src/motion/HairDynamics.js','packages/core/src/motion/HairBodyContact.js','packages/core/src/motion/HairSurfaceContact.js','packages/core/src/motion/Layer.js','packages/core/src/motion/Breath.js','packages/core/src/motion/IdleMotion.js','packages/core/src/motion/BodyIdle.js','packages/core/src/motion/Sway.js','packages/core/src/motion/MotionStack.js','packages/core/src/render/MotionProbe.mjs','packages/core/src/render/Stage.js','packages/core/src/render/TRAAPost.js','packages/core/src/material/HairMaterial.js','packages/testbed/src/showcase.js','assets/hair/bob02/g050.glb','assets/figures/figure_g050.glb',candidate];
const hashes=()=>Object.fromEntries(sourcePaths.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
const report={started:new Date().toISOString(),pid:process.pid,status:'running',arm,variant,candidate,candidateSha256,view,colour,fps:60,frameStride:3,extraImageFrames,geometryStride:1,totalFrames,protocol,selectedCards,sourceHashes:hashes(),samples:[],images:[],errors:[],limits:[protocol==='head'?'One9.25second head-only sequence;ordinarylayersdisabled,yaw±30,pitch+20/-15,roll±15;notall-motion,garment,performanceorstyleacceptance.':'Twelve seconds of ordinary procedural motion on one g050/bob02 outfit and seed; not all-motion, garment-contact, performance or style acceptance.','20fps images plus explicitly recorded extra frames;60Hz full selected-card/body geometry readbacks; time between updates remains unsampled.']};
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
  report.setup=await page.evaluate(async({url,angle,neutral,selectedCards,protocol})=>{window.envelopeModule=await import(url);return envelopeModule.setupEnvelopeMotion({angle,neutral,selectedCards,protocol,retainOtherVertices:protocol==='head'});},{url:`/@fs/${root}tools/critic/bob-envelope-motion-browser.mjs`,angle:{'rear-oblique':135,back:180,'rear-left':-135,front:0}[view],neutral:colour==='brown',selectedCards,protocol});
  assert.equal(report.setup.clock.frame,98);save();
  for(let frame=0;frame<=totalFrames;frame++){
    if(frame)await page.evaluate(async()=>{envelopeTick(1/60);await showcase.step(1/60);});
    if(frame%3===0||extraImageFrames.includes(frame)){
      const data=await page.evaluate(()=>showcase.avatar.stage.canvas.toDataURL('image/png'));
      const bytes=Buffer.from(data.split(',')[1],'base64'),file=`frames/${String(frame).padStart(4,'0')}.png`;
      fs.writeFileSync(path.join(out,file),bytes);report.images.push({frame,file,sha256:sha(bytes)});
    }
    if(frame%1===0){
      const sample=await page.evaluate(frame=>envelopeModule.envelopeSample(frame),frame);
      assert.ok(Math.abs(sample.time-frame/60)<1e-9);assert.equal(sample.clock.frame,98+frame);
      const raw=gzipSync(JSON.stringify(sample)),file=`sample-${String(frame).padStart(4,'0')}.json.gz`;fs.writeFileSync(path.join(out,file),raw);
      const {bodyPositions,bodyNormals,selectedVertices,selectedCentres,otherVertices,...compact}=sample;
      report.samples.push({...compact,geometryFile:file,geometrySha256:sha(raw)});if(frame%30===0)save();
    }
    if(frame%60===0)console.log(`${arm} ${view} ${colour}: ${frame}/${totalFrames}`);
  }
  report.disposal=await page.evaluate(()=>{showcase.controls.dispose();showcase.avatar.dispose();return showcase.avatar.report().disposal;});
  assert.deepEqual(report.disposal.leaked,[]);assert.deepEqual(report.errors,[]);assert.deepEqual(hashes(),report.sourceHashes);
  report.status='captured';
}catch(error){report.errors.push(error.stack);report.status='failed';process.exitCode=1;}
finally{await page?.close();await browser?.close();await server?.close();report.finished=new Date().toISOString();save();}
console.log(`${report.status}: ${out}`);
