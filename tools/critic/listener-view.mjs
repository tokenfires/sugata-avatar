/** One live current-recipe attention/release viewing sequence; no private clock or pixel oracle. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {ROOT,collectSourceHashes,hashFile} from '../figure-pipeline/collar_replacement_manifest.mjs';
import {launchProbeBrowser} from '../../packages/core/src/render/MotionProbe.mjs';
const stop='2026-10-03T14:45:00Z',started=new Date().toISOString();
const out=path.join(ROOT,'captures/listener-view-2026-10-03-v1');
const check=label=>assert.ok(Date.now()<Date.parse(stop),'Deadline '+label);
const observationStop=Date.parse(stop)-20000;
async function bounded(fn,label,cleanup=false){let timer;const ms=cleanup?5000:Math.max(1,observationStop-Date.now());try{return await Promise.race([fn(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),ms);})]);}finally{clearTimeout(timer);}}
check('entry');assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const recipe=ROOT+'/looks/sage-lavender-chin.json',expected=JSON.parse(fs.readFileSync(recipe));
const report={pid:process.pid,started,stop,command:'node tools/critic/listener-view.mjs',status:'running',instrumentSHA256:hashFile(new URL(import.meta.url)),recipe:{file:recipe,sha256:hashFile(recipe)},planSHA256:hashFile(ROOT+'/docs/evidence/nonhair-2026-10-03/listener-view/PLAN.md'),sources:collectSourceHashes(ROOT),events:[],images:[],errors:[],warnings:[],retirements:[],limits:['One current live composition/action/release sequence; ordinary wall times are observational, not exact physical-frame matches.','No continuous naturalness, human intent, fit, body range or AAA qualification from sampled stills.','Video retains native context; only actual reviewed frames may support visual findings.']};
const save=()=>fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2)+'\n');
fs.copyFileSync(new URL(import.meta.url),out+'/instrument.mjs');save();
let browser,context,page,video,error;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){check('ready');await page.waitForFunction(()=>window.showcase||!document.querySelector('#error').hidden,null,{timeout:120000});assert.equal(await page.locator('#error').textContent(),'');}
async function state(){return page.evaluate(()=>({url:location.href,wall:performance.now(),configuration:showcase.configuration(),attention:showcase.attention.report(),attentionStatus:document.querySelector('#attention-status').textContent,pause:document.querySelector('#pause').getAttribute('aria-pressed'),lookDisabled:document.querySelector('#look-toward-me').matches(':disabled'),releaseDisabled:document.querySelector('#release-attention').matches(':disabled'),camera:showcase.avatar.stage.camera.position.toArray(),frame:showcase.framing.report(),backend:showcase.avatar.stage.backendName,webGPU:showcase.avatar.stage.renderer.backend.isWebGPUBackend,canvas:{width:document.querySelector('canvas').width,height:document.querySelector('canvas').height}}));}
async function shot(label,anchor,full=false){check('shot '+label);const before=await state();const requested=Date.now();const file=label+'.png';if(full)await page.screenshot({path:out+'/'+file,fullPage:true});else{const box=await page.locator('canvas').boundingBox();assert.ok(box&&box.x>=0&&box.y>=0&&box.width>500&&box.height>500);await page.screenshot({path:out+'/'+file,clip:box});}report.images.push({file,sha256:hashFile(out+'/'+file),requested,completed:Date.now(),elapsedFromAnchor:anchor==null?null:requested-anchor,before,after:await state(),fullPage:full});save();}
async function at(anchor,ms,label){check(label);await sleep(Math.max(0,anchor+ms-Date.now()));check(label);}
try{
 await bounded(async()=>{
 browser=await launchProbeBrowser();context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce',recordVideo:{dir:out+'/video',size:{width:1440,height:1000}}});page=await context.newPage();video=page.video();page.setDefaultTimeout(30000);
 page.on('pageerror',e=>report.errors.push(e.stack??e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());if(m.type()==='warning')report.warnings.push(m.text());if(m.text().startsWith('LISTENER_RETIRE '))report.retirements.push(JSON.parse(m.text().slice(16)));});
 await page.goto('http://127.0.0.1:5173/src/showcase.html',{waitUntil:'domcontentloaded',timeout:120000});await ready();
 await page.evaluate(()=>{const owner=showcase.avatar;addEventListener('pagehide',()=>console.log('LISTENER_RETIRE '+JSON.stringify(owner.report().disposal)),{once:true});});
 await Promise.all([page.waitForEvent('domcontentloaded',{timeout:120000}),page.locator('#settings-file').setInputFiles(recipe)]);await ready();
 const restored=await state();assert.deepEqual(restored.configuration,expected);assert.equal(restored.backend,'webgpu');assert.equal(restored.webGPU,true);assert.equal(new URL(restored.url).searchParams.has('capture'),false);report.events.push({label:'actual JSON reopened',at:Date.now(),state:restored});save();
 if(restored.pause==='true'){await page.locator('#pause').click();report.events.push({label:'actual Resume motion',at:Date.now(),state:await state()});}
 await page.locator('#attention-controls').scrollIntoViewIfNeeded();await sleep(1000);const baseline=await state();assert.equal(baseline.lookDisabled,false);assert.equal(baseline.attention.phase,'idle');await shot('context-before',null,true);await shot('baseline',null);
 await page.locator('#look-toward-me').click();const attentionAt=Date.now();report.events.push({label:'actual Look toward me',at:attentionAt,state:await state()});save();
 for(const [ms,label] of [[200,'entry'],[850,'hold-early'],[1800,'hold-late']]){await at(attentionAt,ms,label);await shot(label,attentionAt);}
 await at(attentionAt,2200,'release');const beforeRelease=await state();assert.equal(beforeRelease.attention.phase,'attending');assert.equal(beforeRelease.attention.holdsGaze,true);assert.equal(beforeRelease.releaseDisabled,false);
 await page.locator('#release-attention').click();const releaseAt=Date.now();const releasedState=await state();assert.equal(releasedState.attention.phase,'releasing');assert.equal(releasedState.attention.holdsGaze,false);report.events.push({label:'actual Release',at:releaseAt,before:beforeRelease,state:releasedState});save();
 for(const [ms,label] of [[100,'release-entry'],[450,'released'],[1500,'return']]){await at(releaseAt,ms,label);await shot(label,releaseAt);}
 const final=await state();assert.equal(final.attention.phase,'idle');assert.equal(final.attention.holdsGaze,false);assert.equal(final.releaseDisabled,true);assert.deepEqual(final.configuration,expected);report.events.push({label:'final released state',at:Date.now(),state:final});await shot('context-after',null,true);assert.deepEqual(report.errors,[]);report.status='observed';
 },'entire setup and observation');
}catch(e){error=e;report.status='failed';report.errors.push(e.stack??String(e));}
finally{
 report.cleanup={};
 try{if(page&&!page.isClosed())report.finalRetirement=await bounded(()=>page.evaluate(()=>{if(!window.showcase)return null;showcase.attention.dispose();showcase.controls.dispose();showcase.avatar.dispose();return showcase.avatar.report().disposal;}),'retirement',true);}catch(e){report.errors.push('retirement '+e.message);error??=e;}
 for(const [name,object] of [['page',page],['context',context],['browser',browser]]){try{if(object)await bounded(()=>object.close(),name+' cleanup',true);report.cleanup[name]=object?'closed':'not-created';}catch(e){report.errors.push(name+' '+e.message);report.cleanup[name]='failed';error??=e;}}
 try{if(video){const file=await bounded(()=>video.path(),'video path',true);report.video={file:path.relative(out,file),sha256:hashFile(file),bytes:fs.statSync(file).size};}assert.deepEqual(collectSourceHashes(ROOT),report.sources);assert.equal(hashFile(new URL(import.meta.url)),report.instrumentSHA256);assert.equal(hashFile(recipe),report.recipe.sha256);report.finalPinsUnchanged=true;check('postflight');assert.equal(report.finalRetirement?.disposed,true);assert.deepEqual(report.finalRetirement.leaked,[]);for(const d of report.retirements){assert.equal(d.disposed,true);assert.deepEqual(d.leaked,[]);}assert.equal(report.retirements.length,1);assert.deepEqual(report.errors,[]);}catch(e){report.errors.push(e.message);error??=e;}
 if(error||report.errors.length)report.status='failed';report.finished=new Date().toISOString();report.borrowedReviewServerRetained=true;save();console.log(JSON.stringify({pid:process.pid,started,status:report.status,finished:report.finished,images:report.images.length,events:report.events.length,errors:report.errors.length,warnings:report.warnings.length,reportSHA256:hashFile(out+'/report.json'),cleanup:report.cleanup}));
}
if(report.errors.length&&!error)error=Error('Final recorded error');
if(error)throw error;
