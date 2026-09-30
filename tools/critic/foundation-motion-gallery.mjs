import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {ROOT,hashFile} from '../figure-pipeline/collar_replacement_manifest.mjs';import {launchProbeBrowser} from '../../packages/core/src/render/MotionProbe.mjs';
const out=path.join(ROOT,'captures/foundation-motion-gallery-2026-09-30-v1');assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const file='docs/evidence/wardrobe-2026-09-30/foundation-domain-motion/review.html';
const report={started:new Date().toISOString(),pid:process.pid,status:'running',pageSHA256:hashFile(path.join(ROOT,file)),sourceSHA256:hashFile(new URL(import.meta.url)),states:[],errors:[],screenshots:[]};const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
fs.copyFileSync(new URL(import.meta.url),path.join(out,'gallery.mjs'));fs.copyFileSync(path.join(ROOT,file),path.join(out,'review.html'));let browser;
try{
  browser=await launchProbeBrowser();const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  await page.goto('http://localhost:5173/@fs'+path.join(ROOT,file),{waitUntil:'networkidle'});
  const loaded=()=>page.waitForFunction(()=>document.querySelector('#load').textContent.startsWith('Original pair loaded')&&Array.from(document.images).every(i=>i.complete&&i.naturalWidth===800&&i.naturalHeight===1000));
  await loaded();
  for(const outfit of ['elegant','casual','foundation']){
    await page.selectOption('#outfit',outfit);
    for(const step of [0,20,40,60]){await page.locator('#step').evaluate((e,value)=>{e.value=String(value);e.dispatchEvent(new Event('input',{bubbles:true}));},step);await loaded();const state=await page.evaluate(()=>({outfit:document.querySelector('#outfit').value,step:document.querySelector('#step').value,time:document.querySelector('#time').textContent,urls:Array.from(document.images,i=>i.src),status:document.querySelector('#load').textContent}));for(const url of state.urls)assert.ok(url.endsWith(`-${outfit}/frame-${String(step*12).padStart(4,'0')}.png`));report.states.push(state);}
    await page.selectOption('#view','rear');await loaded();assert.equal(await page.locator('#step').isDisabled(),true);assert.equal(await page.locator('#play').isDisabled(),true);report.states.push(await page.evaluate(()=>({outfit:document.querySelector('#outfit').value,rear:true,urls:Array.from(document.images,i=>i.src)})));await page.selectOption('#view','front');await loaded();
  }
  await page.selectOption('#outfit','elegant');await loaded();await page.locator('#step').evaluate(e=>{e.value='0';e.dispatchEvent(new Event('input',{bubbles:true}));});await loaded();
  await page.click('#play');await page.waitForFunction(()=>Number(document.querySelector('#step').value)>=2);await page.click('#play');await loaded();const paused=await page.locator('#step').inputValue();await page.waitForTimeout(350);assert.equal(await page.locator('#step').inputValue(),paused);report.playback={advanced:true,pausedAt:Number(paused),pauseHeld:true};
  await page.locator('#step').evaluate(e=>{e.value='0';e.dispatchEvent(new Event('input',{bubbles:true}));});await loaded();
  for(const[width,height,label]of [[1440,1100,'desktop'],[390,844,'mobile']]){await page.setViewportSize({width,height});await page.locator('.controls').first().scrollIntoViewIfNeeded();const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);const name=label+'.png';await page.screenshot({path:path.join(out,name)});report.screenshots.push({width,height,file:name,sha256:hashFile(path.join(out,name)),overflow});}
  assert.deepEqual(report.errors,[]);assert.equal(hashFile(path.join(ROOT,file)),report.pageSHA256);assert.equal(hashFile(new URL(import.meta.url)),report.sourceSHA256);report.status='captured';
}catch(error){report.status='failed';report.errors.push(error.stack);process.exitCode=1;}finally{await browser?.close();report.finished=new Date().toISOString();save();console.log(JSON.stringify({status:report.status,reportSHA256:hashFile(path.join(out,'report.json')),errors:report.errors}));}
