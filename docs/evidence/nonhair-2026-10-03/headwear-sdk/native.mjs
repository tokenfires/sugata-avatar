import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {launchProbeBrowser} from '../../../../packages/core/src/render/MotionProbe.mjs';
const root=new URL('../../../../',import.meta.url),folder=new URL('./',import.meta.url),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const stop=Date.parse('2026-10-04T03:03:00Z');
assert.ok(Date.now()<Date.parse('2026-10-04T02:48:00Z'),'sole launch cutoff');
const raw=new URL('capture/',folder);assert.ok(!fs.existsSync(raw),'fresh sole capture folder');fs.mkdirSync(raw);
const started=Date.now(),workEnd=Math.min(stop-30000,started+180000);
const source=JSON.parse(fs.readFileSync(new URL('SOURCE.json',folder)));
const candidateBytes=fs.readFileSync(new URL('SDK-OPTIONS.json',folder)),candidate=JSON.parse(candidateBytes);
assert.equal(sha(candidateBytes),source.candidateSha256);
const inputPins=['PLAN.md','CRITIC-WORTH.md','CRITIC-SOURCE.md','SOURCE.json','SDK-OPTIONS.json','ROOT-SOURCE.json'].map(file=>({file,sha256:sha(fs.readFileSync(new URL(file,folder)))}));
for(const pin of source.pins)assert.equal(sha(fs.readFileSync(new URL(pin.file,root))),pin.sha256,pin.file);
const report={command:'node docs/evidence/nonhair-2026-10-03/headwear-sdk/native.mjs',pid:process.pid,started:new Date(started).toISOString(),workEnd:new Date(workEnd).toISOString(),stop:new Date(stop).toISOString(),instrumentSha256:sha(fs.readFileSync(new URL(import.meta.url))),inputPins,sourcePins:source.pins,requestedOptions:candidate,status:'running',states:[],images:[],assets:[],errors:[],warnings:[],failedRequests:[],retirements:[],cleanup:{},limits:['One bob/room/static four-view screen; no motion/contact/all-angle/physical/material-calibration/AAA or Showcase-import proof.','Literal SDK input recreation, not settings export or pixel equality.','Fixed32 public zero-delta steps per capture are not convergence or pinned render epochs; no history/clock manipulation.','No garment geometry, hair visibility, mask, source material, default, API/schema/UI or acceptance change.']};
const save=()=>fs.writeFileSync(new URL('report.json',raw),JSON.stringify(report,null,2)+'\n');
save();fs.copyFileSync(new URL(import.meta.url),new URL('instrument.mjs.source',raw));
let browser,page,error,phase='launch';const reads=[];
const left=()=>Math.max(1,workEnd-Date.now());
async function bound(fn,label,cleanup=false){let timer;try{return await Promise.race([fn(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timeout')),cleanup?10000:left());})]);}finally{clearTimeout(timer);}}
function checkErrors(){assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedRequests,[]);}
async function state(label){
 const s=await page.evaluate(label=>{
  const a=window.headwearAvatar,r=a.report();
  return {label,observedUTC:new Date().toISOString(),clockSeconds:a.clockSeconds,backend:a.stage.backendName,webGPU:a.stage.renderer.backend.isWebGPUBackend,report:r,camera:{position:a.stage.camera.position.toArray(),matrix:a.stage.camera.matrixWorld.toArray(),projection:a.stage.camera.projectionMatrix.toArray()}};
 },label);report.states.push(s);save();return s;
}
function attached(s,frame){
 const r=s.report;assert.equal(s.backend,'webgpu');assert.equal(s.webGPU,true);
 assert.equal(r.identity.bake,'figure_g050');assert.equal(r.identity.gender,.5);
 assert.equal(r.hair.attached,true);assert.equal(r.hair.style,'bob02');assert.equal(r.hair.loadedStyle,'bob02');
 assert.equal(r.hair.colour.applied,candidate.hairColour);assert.equal(r.hair.colour.matchesAttached,true);
 assert.equal(r.wardrobe.attached,true);assert.equal(r.wardrobe.pendingCandidates,0);assert.equal(r.wardrobe.error,null);
 const worn=[...candidate.wardrobe.outfit,'foundation_bra','foundation_briefs'].sort();assert.deepEqual([...r.wardrobe.state.worn].sort(),worn);
 assert.equal(r.wardrobe.appearance.attached,true);assert.equal(r.wardrobe.appearance.style,'ecru');assert.deepEqual(r.wardrobe.appearance.colours,candidate.wardrobe.colours);
 assert.equal(r.framing.mode,frame);assert.equal(r.scene.id,'studio');assert.equal(r.scene.lighting.look,'neutral');assert.equal(r.quality.requested,'balanced');assert.equal(r.motion.seed,candidate.seed);
 assert.equal(r.disposal.disposed,false);assert.equal(s.clockSeconds,0);checkErrors();
}
async function create(label){
 phase=label;save();
 const input=JSON.parse(fs.readFileSync(new URL('SDK-OPTIONS.json',folder)));assert.deepEqual(input,candidate);
 await page.evaluate(async options=>{window.headwearAvatar=await window.HeadwearAvatarClass.create({...options,canvas:document.querySelector('canvas'),autoStart:false});await window.headwearAvatar.step(0);},input);
 await page.waitForLoadState('networkidle',{timeout:left()});await Promise.all(reads);checkErrors();
 const s=await state(label);attached(s,'body');return s;
}
async function retire(label){
 phase=label;const disposal=await page.evaluate(()=>{const a=window.headwearAvatar;if(!a)return null;a.dispose();return a.report().disposal;});
 report.retirements.push({label,observedUTC:new Date().toISOString(),disposal});save();assert.equal(disposal?.disposed,true);assert.deepEqual(disposal.leaked,[]);
}
async function shot(name,frame,angle){
 phase=name;
 await page.evaluate(async({frame,angle})=>{
  const a=window.headwearAvatar;a.setFraming(frame);
  const focus=a.focus,radius=a.stage.camera.position.distanceTo(focus),radians=angle*Math.PI/180;
  a.stage.camera.position.set(focus.x+radius*Math.sin(radians),focus.y,focus.z+radius*Math.cos(radians));a.stage.camera.lookAt(focus);
  for(let i=0;i<32;i++)await a.step(0);
 },{frame,angle});
 const before=await state(name+'-before');attached(before,frame);
 const data=await page.evaluate(()=>{const a=window.headwearAvatar;a.stage.draw();return a.stage.canvas.toDataURL('image/png');});
 const bytes=Buffer.from(data.split(',')[1],'base64');assert.ok(bytes.length>10000);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 fs.writeFileSync(new URL(name+'.png',raw),bytes,{flag:'wx'});
 const image={file:name+'.png',bytes:bytes.length,sha256:sha(bytes),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),frame,angle,before,after:null,complete:false};report.images.push(image);save();
 image.after=await state(name+'-after');attached(image.after,frame);assert.deepEqual(image.before.camera,image.after.camera);image.complete=true;save();
}
try{await bound(async()=>{
 browser=await launchProbeBrowser();page=await browser.newPage({viewport:{width:900,height:1050},deviceScaleFactor:1});page.setDefaultTimeout(Math.min(30000,left()));
 const event=x=>({...x,phase,observedUTC:new Date().toISOString()});
 page.on('pageerror',e=>{report.errors.push(event({kind:'pageerror',message:e.stack??e.message}));save();});
 page.on('console',m=>{if(m.type()==='error')report.errors.push(event({kind:'console',message:m.text(),location:m.location()}));if(m.type()==='warning')report.warnings.push(event({message:m.text(),location:m.location()}));save();});
 page.on('requestfailed',r=>{report.failedRequests.push(event({url:r.url(),failure:r.failure()}));save();});
 page.on('response',r=>{
  if(r.status()>=400){report.failedRequests.push(event({url:r.url(),status:r.status()}));save();}
  const u=new URL(r.url());if(!r.ok()||!u.pathname.endsWith('.glb')||u.searchParams.has('import'))return;
  reads.push((async()=>{const at=u.pathname.indexOf('/assets/');assert.ok(at>=0);const file=u.pathname.slice(at+1),bytes=await r.body(),expected=source.pins.find(p=>p.file===file);assert.ok(expected,file);report.assets.push(event({file,url:r.url(),bytes:bytes.length,sha256:sha(bytes),expectedSha256:expected.sha256}));save();assert.equal(sha(bytes),expected.sha256,file);})().catch(e=>{report.errors.push(event({kind:'asset-read',message:e.stack}));save();}));
 });
 const html='<!doctype html><html><head><link rel="icon" href="data:,"></head><body style="margin:0;background:#000"><canvas style="display:block;width:900px;height:1050px" width="900" height="1050"></canvas></body></html>';
 await page.route('**/__headwear_sdk_probe.html',r=>r.fulfill({contentType:'text/html',body:html}));
 report.url='http://127.0.0.1:5173/__headwear_sdk_probe.html';phase='module-load';save();await page.goto(report.url,{waitUntil:'domcontentloaded',timeout:left()});
 await page.evaluate(async url=>{window.HeadwearAvatarClass=(await import(url)).Avatar;},'/@fs'+root.pathname+'packages/core/src/Avatar.js');checkErrors();
 await create('initial-sdk-options');await retire('first-owner-dispose');await create('exact-saved-input-recreation');
 for(const [name,frame,angle]of[['front-body','body',0],['front-portrait','portrait',0],['left-portrait','portrait',-35],['right-portrait','portrait',35]])await shot(name,frame,angle);
 await Promise.all(reads);checkErrors();assert.equal(report.images.length,4);assert.ok(report.images.every(i=>i.complete&&i.width===900&&i.height===1050));
 const expected=source.pins.filter(p=>p.file.endsWith('.glb')).map(p=>p.file).sort();assert.deepEqual([...new Set(report.assets.map(a=>a.file))].sort(),expected);
 report.status='observed';save();
},'sole-native-work');}catch(e){error=e;report.errors.push({kind:'assertion',phase,message:e.stack,observedUTC:new Date().toISOString()});report.status='failed';save();}
finally{
 try{if(page&&!page.isClosed())await bound(()=>retire('final-owner-dispose'),'final-dispose',true);}catch(e){error??=e;report.errors.push({kind:'cleanup-dispose',message:e.stack});save();}
 try{await bound(()=>Promise.all(reads),'asset-reads-drain',true);report.cleanup.assetReads='drained';}catch(e){error??=e;report.cleanup.assetReads='failed';save();}
 for(const [name,owner]of[['page',page],['browser',browser]])try{phase=name+'-close';if(owner)await bound(()=>owner.close(),name+'-close',true);report.cleanup[name]=owner?'closed':'not-created';save();}catch(e){error??=e;report.cleanup[name]='failed';report.errors.push({kind:'cleanup',name,message:e.message});save();}
 try{for(const pin of source.pins)assert.equal(sha(fs.readFileSync(new URL(pin.file,root))),pin.sha256,pin.file);for(const pin of inputPins)assert.equal(sha(fs.readFileSync(new URL(pin.file,folder))),pin.sha256,pin.file);assert.equal(sha(fs.readFileSync(new URL(import.meta.url))),report.instrumentSha256);checkErrors();assert.ok(Date.now()<stop);report.finalPinsUnchanged=true;}catch(e){error??=e;report.errors.push({kind:'final-gate',message:e.stack});}
 if(error||report.errors.length||report.failedRequests.length)report.status='failed';report.finished=new Date().toISOString();report.borrowedReviewServerRetained=true;save();
 console.log(JSON.stringify({pid:report.pid,started:report.started,finished:report.finished,status:report.status,images:report.images.length,assets:report.assets.length,errors:report.errors.length,failedRequests:report.failedRequests.length,warnings:report.warnings.length,cleanup:report.cleanup,reportSha256:sha(fs.readFileSync(new URL('report.json',raw)))}));
}
if(error)throw error;
