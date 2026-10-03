/** Sole new rigid modelling comparison, outside production groom paths. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {ROOT,collectSourceHashes,hashFile} from '../figure-pipeline/collar_replacement_manifest.mjs';
import {launchProbeBrowser} from '../../packages/core/src/render/MotionProbe.mjs';
const started=new Date().toISOString(),stop='2026-10-03T15:24:00Z',observeStop=Date.parse(stop)-20000;
const packet='docs/evidence/nonhair-2026-10-03/whole-front-blockout',out=ROOT+'/captures/whole-front-blockout-2026-10-03-v1';assert.ok(Date.now()<observeStop);assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const inputs=Object.fromEntries(['PLAN.md','parameters.json','proposal.mjs','preview.mjs','preview.html','PRE-FLIGHT.md'].map(n=>[packet+'/'+n,hashFile(ROOT+'/'+packet+'/'+n)]));inputs['looks/sage-lavender-chin.json']=hashFile(ROOT+'/looks/sage-lavender-chin.json');inputs['reference/bob-appearance-2026-09-29/02-medium-face-framing.jpg']=hashFile(ROOT+'/reference/bob-appearance-2026-09-29/02-medium-face-framing.jpg');
const report={pid:process.pid,started,stop,command:'node tools/critic/whole-front-blockout.mjs',status:'running',instrumentSHA256:hashFile(new URL(import.meta.url)),sources:collectSourceHashes(ROOT),inputs,images:[],errors:[],warnings:[],limits:['New rigid opaque modelling surfaces only; original assets/defaults remain unchanged.','Static public autoStart:false+initial step(0), draw-only preview; no motion, fit/coverage, strand/material/dye or AAA qualification.','Registered camera/construction-pose shape observations, not pixel/phase equality or a repaired production groom.']};
const save=()=>fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2)+'\n');fs.copyFileSync(new URL(import.meta.url),out+'/instrument.mjs');save();
async function bounded(fn,label,cleanup=false){let timer;try{return await Promise.race([fn(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),cleanup?5000:Math.max(1,observeStop-Date.now()));})]);}finally{clearTimeout(timer);}}
let browser,page,error;
try{await bounded(async()=>{
 browser=await launchProbeBrowser();page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});page.setDefaultTimeout(30000);page.on('pageerror',e=>report.errors.push(e.stack??e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());if(m.type()==='warning')report.warnings.push(m.text());});
 await page.goto('http://127.0.0.1:5173/@fs/'+ROOT.replace(/^\//,'')+'/'+packet+'/preview.html',{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.blockout||window.blockoutFailure,null,{timeout:120000});assert.equal(await page.locator('#error').textContent(),'');assert.ok(await page.evaluate(()=>!!window.blockout));await page.waitForTimeout(1000);
 for(const [arm,view] of [['original','front'],['proposal','front'],['proposal','oblique'],['original','oblique']]){
  await page.locator('#'+arm).click();await page.locator('#'+view).click();await page.waitForTimeout(300);
  const before=await page.evaluate(()=>blockout.state());assert.equal(before.arm,arm);assert.equal(before.view,view);assert.equal(before.originalVisible,arm==='original');assert.equal(before.proposalVisible,arm==='proposal');assert.equal(before.backend,'webgpu');assert.equal(before.webGPU,true);assert.deepEqual(before.recipe,JSON.parse(fs.readFileSync(ROOT+'/looks/sage-lavender-chin.json')));
  const file=arm+'-'+view+'.png',requested=new Date().toISOString();await page.screenshot({path:out+'/'+file,fullPage:true});report.images.push({file,requested,finished:new Date().toISOString(),sha256:hashFile(out+'/'+file),before,after:await page.evaluate(()=>blockout.state())});save();
 }
 assert.deepEqual(report.errors,[]);report.status='observed';
},'entire setup and observation');}catch(e){error=e;report.errors.push(e.stack??String(e));report.status='failed';}
finally{
 report.cleanup={};try{if(page&&!page.isClosed())report.disposal=await bounded(()=>page.evaluate(()=>window.blockout?.dispose()??null),'owned proposal/Avatar disposal',true);}catch(e){report.errors.push(e.message);error??=e;}
 for(const [name,object] of [['page',page],['browser',browser]]){try{if(object)await bounded(()=>object.close(),name+' close',true);report.cleanup[name]=object?'closed':'not-created';}catch(e){report.errors.push(e.message);report.cleanup[name]='failed';error??=e;}}
 try{assert.deepEqual(collectSourceHashes(ROOT),report.sources);for(const[p,h]of Object.entries(inputs))assert.equal(hashFile(ROOT+'/'+p),h);assert.equal(hashFile(new URL(import.meta.url)),report.instrumentSHA256);assert.equal(report.disposal?.disposed,true);assert.deepEqual(report.disposal.leaked,[]);assert.deepEqual(report.errors,[]);assert.ok(Date.now()<Date.parse(stop));report.finalPinsUnchanged=true;}catch(e){report.errors.push(e.message);error??=e;}
 if(error||report.errors.length)report.status='failed';report.finished=new Date().toISOString();report.borrowedReviewServerRetained=true;save();console.log(JSON.stringify({pid:process.pid,started,finished:report.finished,status:report.status,images:report.images.length,errors:report.errors.length,warnings:report.warnings.length,cleanup:report.cleanup,reportSHA256:hashFile(out+'/report.json')}));
}
if(error||report.errors.length)throw error??Error('Final recorded errors');
