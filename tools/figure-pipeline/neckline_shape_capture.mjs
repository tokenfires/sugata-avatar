import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {gzipSync} from 'node:zlib';
import {ROOT,collectSourceHashes,ACCEPTED_PATH,ACCEPTED_SHA256,hashFile,sha256} from './collar_replacement_manifest.mjs';
import {startProbeServer,launchProbeBrowser} from '../../packages/core/src/render/MotionProbe.mjs';
const construction='captures/neckline-construction-2026-09-30-v1',candidate=fs.readFileSync(path.join(ROOT,construction,'candidate.glb'));
const recipe=JSON.parse(fs.readFileSync(path.join(ROOT,construction,'report.json')));assert.equal(sha256(candidate),recipe.candidateSHA256);
const out=path.resolve(ROOT,process.argv[2]??'captures/neckline-shape-2026-09-30-v2');assert.ok(!fs.existsSync(out));assert.equal(hashFile(path.join(ROOT,ACCEPTED_PATH)),ACCEPTED_SHA256);fs.mkdirSync(out,{recursive:true});
const extra=['tools/figure-pipeline/neckline_shape_capture.mjs','tools/figure-pipeline/neckline_attribution_browser.mjs','docs/evidence/wardrobe-2026-09-30/neckline-construction/PLAN.md'];
const hashes=()=>({...collectSourceHashes(),...Object.fromEntries(extra.map(p=>[p,hashFile(path.join(ROOT,p))]))});
const report={started:new Date().toISOString(),pid:process.pid,status:'running',sourceHashes:hashes(),constructionReportSHA256:hashFile(path.join(ROOT,construction,'report.json')),candidateSHA256:sha256(candidate),views:[0,-45,45,180],arms:[],errors:[],scope:'One isolated crew-neck shape observation; no fit, coverage or motion acceptance.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
for(const p of Object.keys(report.sourceHashes).filter(p=>!p.startsWith('assets/')&&!p.startsWith('node_modules/'))){const dest=path.join(out,'source',p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(ROOT,p),dest);}fs.writeFileSync(path.join(out,'candidate.glb'),candidate);save();
let server,browser,page;const held=new Map();
try{server=await startProbeServer({port:5301});browser=await launchProbeBrowser();report.baseUrl=server.baseUrl;save();
 for(const arm of ['accepted','candidate'])for(const yaw of report.views){
  const key=`${arm}-${yaw}`,rec={arm,yaw,key,assets:[],errors:[]},reads=[];report.arms.push(rec);save();
  page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});page.on('pageerror',e=>rec.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')rec.errors.push(m.text());});
  if(arm==='candidate')await page.route('**/assets/wardrobe/female_casualsuit01/g050.glb',r=>r.fulfill({status:200,contentType:'model/gltf-binary',body:candidate}));
  page.on('response',r=>{if(r.status()>=400)rec.errors.push(`${r.status()} ${r.url()}`);const u=new URL(r.url());if(r.ok()&&u.pathname.endsWith('.glb')&&!u.searchParams.has('import'))reads.push(r.body().then(bytes=>{const i=u.pathname.indexOf('/assets/');assert.ok(i>=0);const file=u.pathname.slice(i+1),expected=arm==='candidate'&&file===ACCEPTED_PATH?report.candidateSHA256:report.sourceHashes[file];assert.equal(sha256(bytes),expected,`Loaded bytes ${file}`);rec.assets.push({file,bytes:bytes.length,sha256:sha256(bytes)});}).catch(e=>rec.errors.push(`Asset response: ${e.message}`)));});
  await page.goto(`${server.baseUrl}/src/showcase.html?preset=casual&style=original&frame=portrait&hairColour=%23413934&capture=`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.showcase||!document.querySelector('#error').hidden,null,{timeout:120000});assert.equal(await page.locator('#error').textContent(),'');
  rec.setup=await page.evaluate(async({root,yaw})=>{
   const a=showcase.avatar;window.neckHelper=await import(`/@fs${root}/tools/figure-pipeline/collar_capture_browser.mjs`);
   const f=a.stage.renderer._nodes.nodeFrame;a.stage.renderer._animation.stop();f.frameId=0;f.time=0;f.deltaTime=0;f.lastTime=undefined;a.stage.temporal?.resetFrameEpoch();
   showcase.controls.enableDamping=false;const target=showcase.controls.target,radius=a.stage.camera.position.distanceTo(target),r=yaw*Math.PI/180;
   a.stage.camera.position.set(target.x+radius*Math.sin(r),target.y,target.z+radius*Math.cos(r));a.stage.camera.lookAt(target);showcase.controls.update();
   for(let i=0;i<98;i++){f.update();f.time=0;f.deltaTime=0;await showcase.step(0);}
   const adapter=a.stage.renderer.backend.device?.adapterInfo;return{configuration:showcase.configuration(),backend:a.stage.backendName,adapter:adapter?{vendor:adapter.vendor,architecture:adapter.architecture}:null};
  },{root:ROOT,yaw});assert.equal(rec.setup.backend,'webgpu');await Promise.all(reads);assert.equal(rec.assets.filter(x=>x.file===ACCEPTED_PATH).length,1);
  const fixed=await page.evaluate(async()=>{const a=showcase.avatar;return{physical:await neckHelper.physical(a),snapshot:neckHelper.snapshot(a),lights:(()=>{const rows=[];a.stage.scene.traverse(o=>{if(o.isLight)rows.push({name:o.name,type:o.type,colour:o.color.toArray(),groundColour:o.groundColor?.toArray()??null,intensity:o.intensity,matrix:o.matrixWorld.toArray()});});return rows;})(),camera:a.stage.camera.matrixWorld.toArray(),projection:a.stage.camera.projectionMatrix.toArray()};});
  const invariant=structuredClone(fixed);invariant.snapshot.meshes=invariant.snapshot.meshes.filter(m=>m.id!=='female_casualsuit01');
  if(held.has(yaw))assert.deepEqual(invariant,held.get(yaw),'Noncloth state changed');else held.set(yaw,invariant);
  const state=Buffer.from(JSON.stringify(fixed)+'\n');fs.writeFileSync(path.join(out,`${key}-state.json.gz`),gzipSync(state));rec.stateSHA256=sha256(state);rec.compressedStateSHA256=hashFile(path.join(out,`${key}-state.json.gz`));
  const image=await page.evaluate(()=>{const a=showcase.avatar,f=a.stage.renderer._nodes.nodeFrame;f.update();f.time=0;f.deltaTime=0;a.stage.draw();return{data:a.stage.canvas.toDataURL('image/png'),clock:{frameId:f.frameId,grainFrame:a.stage.grade?.grainFrame?.value,temporal:a.stage.temporal?.frameEpoch(),time:f.time,delta:f.deltaTime}};});
  assert.equal(image.clock.frameId,99);assert.equal(image.clock.time,0);assert.equal(image.clock.delta,0);if(report.arms[0].clock)assert.deepEqual(image.clock,report.arms[0].clock);
  const bytes=Buffer.from(image.data.split(',')[1],'base64');fs.writeFileSync(path.join(out,`${key}.png`),bytes);rec.imageSHA256=sha256(bytes);rec.clock=image.clock;
  rec.disposal=await page.evaluate(()=>{showcase.attention.dispose();showcase.controls.dispose();showcase.avatar.dispose();return showcase.avatar.report().disposal;});assert.equal(rec.disposal.disposed,true);assert.deepEqual(rec.disposal.leaked,[]);assert.deepEqual(rec.errors,[]);rec.completed=true;save();await page.close();page=null;console.log(key);
 }
 assert.deepEqual(hashes(),report.sourceHashes);assert.equal(hashFile(path.join(ROOT,construction,'report.json')),report.constructionReportSHA256);report.status='captured';
}catch(e){report.status='failed';report.errors.push(e.stack);throw e;}
finally{if(page&&!page.isClosed())try{report.failureDisposal=await page.evaluate(()=>{if(!window.showcase)return null;showcase.attention?.dispose();showcase.controls?.dispose();showcase.avatar.dispose();return showcase.avatar.report().disposal;});}catch(e){report.errors.push(`Cleanup: ${e.message}`);}report.finished=new Date().toISOString();save();await browser?.close();await server?.close();}
