// Current controls/material observation; exact-image residuals remain a separate failed property.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {gzipSync} from 'node:zlib';
import {ROOT,collectSourceHashes,hashFile,sha256} from '../figure-pipeline/collar_replacement_manifest.mjs';
import {launchProbeBrowser} from '../../packages/core/src/render/MotionProbe.mjs';
import {decodePng} from './png.mjs';
const integration='/Users/robault/.codex/worktrees/sugata-hair-colours/sugata-avatar';
const out=path.resolve(ROOT,process.argv[2]??'captures/wardrobe-colours-day-2026-09-30-v1');assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const source='tools/critic/wardrobe-colours-day-capture.mjs',plan='docs/evidence/wardrobe-2026-09-30/custom-colours/PLAN.md';
const report={started:new Date().toISOString(),pid:process.pid,status:'running',captureSourceSHA256:hashFile(path.join(ROOT,source)),planSHA256:hashFile(path.join(ROOT,plan)),phases:[],arms:[],errors:[],scope:'Current static material mapping/detail and source-bound geometry comparison; no exact-image, all-colour-space, fit or motion acceptance.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();fs.copyFileSync(path.join(ROOT,source),path.join(out,'capture.mjs'));fs.copyFileSync(path.join(ROOT,plan),path.join(out,'PLAN.md'));
const custom={casual:{top:'#617a70',shoes:'#252a30'},elegant:{top:'#627e9b',bottom:'#4b354f',shoes:'#35291f'}};
const held=new Map();let server,browser,page,heldClock;
try{
 browser=await launchProbeBrowser();
 for(const [phase,workspace]of [['baseline',ROOT],['feature',integration]]){
  const sources=collectSourceHashes(workspace),phaseRow={phase,workspace,sourceHashes:sources};report.phases.push(phaseRow);save();
  for(const p of Object.keys(sources).filter(p=>!p.startsWith('assets/')&&!p.startsWith('node_modules/'))){const dest=path.join(out,'source',phase,p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(workspace,p),dest);}
  process.chdir(workspace);const probe=await import(pathToFileURL(path.join(workspace,'packages/core/src/render/MotionProbe.mjs')).href);server=await probe.startProbeServer({port:5301});phaseRow.baseUrl=server.baseUrl;
  for(const preset of ['casual','elegant'])for(const yaw of [0,145])for(const variant of phase==='baseline'?['base']:['base','custom','return']){
   const key=`${phase}-${preset}-${yaw}-${variant}`,rec={key,phase,preset,yaw,variant,assets:[],errors:[],warnings:[]},reads=[];report.arms.push(rec);save();
   page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
   page.on('pageerror',e=>rec.errors.push(e.message));page.on('requestfailed',r=>rec.errors.push(`Request failed: ${r.url()} ${r.failure()?.errorText}`));page.on('console',m=>{if(m.type()==='error')rec.errors.push(m.text());if(m.type()==='warning')rec.warnings.push(m.text());});
   page.on('response',r=>{if(r.status()>=400)rec.errors.push(`${r.status()} ${r.url()}`);const u=new URL(r.url());if(r.ok()&&u.pathname.endsWith('.glb')&&!u.searchParams.has('import'))reads.push(r.body().then(bytes=>{const i=u.pathname.indexOf('/assets/');assert.ok(i>=0);const file=u.pathname.slice(i+1);assert.equal(sha256(bytes),sources[file],`Loaded asset ${file}`);rec.assets.push({file,bytes:bytes.length,sha256:sha256(bytes)});}).catch(e=>rec.errors.push(e.stack)));});
   const params=new URLSearchParams({preset,frame:'body',hairColour:'#413934',hairTintColour:'#8063ac',hairTintAmount:'.35',capture:''});
   if(variant==='custom')for(const [part,hex]of Object.entries(custom[preset]))params.set(`${part}Color`,hex);
   rec.url=`${server.baseUrl}/src/showcase.html?${params}`;await page.goto(rec.url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.showcase||!document.querySelector('#error').hidden,null,{timeout:120000});assert.equal(await page.locator('#error').textContent(),'');
   rec.setup=await page.evaluate(async({workspace,yaw})=>{
    const a=showcase.avatar;window.colourHelper=await import(`/@fs${workspace}/tools/figure-pipeline/collar_capture_browser.mjs`);
    const f=a.stage.renderer._nodes.nodeFrame;a.stage.renderer._animation.stop();f.frameId=0;f.time=0;f.deltaTime=0;f.lastTime=undefined;a.stage.temporal?.resetFrameEpoch();
    showcase.controls.enableDamping=false;const target=showcase.controls.target,radius=a.stage.camera.position.distanceTo(target),r=yaw*Math.PI/180;
    a.stage.camera.position.set(target.x+radius*Math.sin(r),target.y,target.z+radius*Math.cos(r));a.stage.camera.lookAt(target);showcase.controls.update();
    for(let i=0;i<98;i++){f.update();f.time=0;f.deltaTime=0;await showcase.step(0);}
    const adapter=a.stage.renderer.backend.device?.adapterInfo;return{configuration:showcase.configuration(),appearance:a.wardrobe.appearance(),backend:a.stage.backendName,adapter:adapter?{vendor:adapter.vendor,architecture:adapter.architecture}:null};
   },{workspace,yaw});assert.equal(rec.setup.backend,'webgpu');await Promise.all(reads);assert.ok(rec.assets.length>=5);
   assert.equal(rec.setup.configuration.hairColour,'#413934');assert.deepEqual(rec.setup.configuration.hairTint,{colour:'#8063ac',amount:.35});assert.equal(rec.setup.appearance.style,'ecru');assert.equal(rec.setup.appearance.attached,true);
   assert.deepEqual(rec.setup.configuration.wardrobe.colours,variant==='custom'?custom[preset]:undefined);assert.deepEqual(rec.setup.appearance.colours,variant==='custom'?custom[preset]:undefined);
   const fixed=await page.evaluate(async()=>{const a=showcase.avatar;return{physical:await colourHelper.physical(a),snapshot:colourHelper.snapshot(a),lights:(()=>{const rows=[];a.stage.scene.traverse(o=>{if(o.isLight)rows.push({name:o.name,type:o.type,colour:o.color.toArray(),groundColour:o.groundColor?.toArray()??null,intensity:o.intensity,matrix:o.matrixWorld.toArray()});});return rows;})(),camera:a.stage.camera.matrixWorld.toArray(),projection:a.stage.camera.projectionMatrix.toArray()};});
   const group=`${preset}-${yaw}`;if(held.has(group))assert.deepEqual(fixed,held.get(group),'Colour path changed recorded physical state');else held.set(group,fixed);
   const state=Buffer.from(JSON.stringify(fixed)+'\n');fs.writeFileSync(path.join(out,`${key}-state.json.gz`),gzipSync(state));rec.stateSHA256=sha256(state);rec.compressedStateSHA256=hashFile(path.join(out,`${key}-state.json.gz`));
   const image=await page.evaluate(()=>{const a=showcase.avatar,f=a.stage.renderer._nodes.nodeFrame;f.update();f.time=0;f.deltaTime=0;a.stage.draw();return{data:a.stage.canvas.toDataURL('image/png'),clock:{frameId:f.frameId,grainFrame:a.stage.grade?.grainFrame?.value,temporal:a.stage.temporal?.frameEpoch(),time:f.time,delta:f.deltaTime}};});
   assert.equal(image.clock.frameId,99);assert.equal(image.clock.time,0);assert.equal(image.clock.delta,0);if(heldClock)assert.deepEqual(image.clock,heldClock);else heldClock=image.clock;
   const bytes=Buffer.from(image.data.split(',')[1],'base64');fs.writeFileSync(path.join(out,`${key}.png`),bytes);rec.imageSHA256=sha256(bytes);rec.clock=image.clock;
   rec.disposal=await page.evaluate(()=>{showcase.attention.dispose();showcase.controls.dispose();showcase.avatar.dispose();return showcase.avatar.report().disposal;});assert.equal(rec.disposal.disposed,true);assert.deepEqual(rec.disposal.leaked,[]);assert.deepEqual(rec.errors,[]);rec.completed=true;save();await page.close();page=null;console.log(key);
  }
  assert.deepEqual(collectSourceHashes(workspace),sources,'Workspace changed during capture');await server.close();server=null;
 }
 report.comparisons=[];
 for(const preset of ['casual','elegant'])for(const yaw of [0,145])for(const [a,b]of [[`baseline-${preset}-${yaw}-base`,`feature-${preset}-${yaw}-base`],[`feature-${preset}-${yaw}-base`,`feature-${preset}-${yaw}-return`]]){
  const x=decodePng(fs.readFileSync(path.join(out,a+'.png'))),y=decodePng(fs.readFileSync(path.join(out,b+'.png')));assert.equal(x.width,y.width);assert.equal(x.height,y.height);let changedPixels=0,maxChannelCodes=0;
  for(let i=0;i<x.pixels.length;i+=4){let changed=false;for(let k=0;k<4;k++){const d=Math.abs(Math.round(x.pixels[i+k]*255)-Math.round(y.pixels[i+k]*255));if(d)changed=true;maxChannelCodes=Math.max(maxChannelCodes,d);}if(changed)changedPixels++;}
  report.comparisons.push({a,b,changedPixels,totalPixels:x.width*x.height,maxChannelCodes,exact:changedPixels===0});
 }
 report.exactImageGatePassed=report.comparisons.every(r=>r.exact);report.status='captured';
 assert.equal(hashFile(path.join(ROOT,source)),report.captureSourceSHA256);assert.equal(hashFile(path.join(ROOT,plan)),report.planSHA256);
}catch(e){report.status='failed';report.errors.push(e.stack);throw e;}
finally{if(page&&!page.isClosed())try{report.failureDisposal=await page.evaluate(()=>{if(!window.showcase)return null;showcase.attention?.dispose();showcase.controls?.dispose();showcase.avatar.dispose();return showcase.avatar.report().disposal;});}catch(e){report.errors.push(`Cleanup: ${e.message}`);}report.finished=new Date().toISOString();save();await browser?.close();await server?.close();process.chdir(ROOT);}
