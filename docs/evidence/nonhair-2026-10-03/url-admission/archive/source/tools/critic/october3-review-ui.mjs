/** One root-owned HTML navigation packet; no Avatar, GPU scene or new character image. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {launchProbeBrowser} from '../../packages/core/src/render/MotionProbe.mjs';
import {ALL_PAGES} from '../../packages/testbed/pages.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const rel='captures/october3-review-2026-10-03-v1',out=path.join(root,rel);
const hardStop='2026-10-03T10:38:00Z',baseUrl='http://127.0.0.1:5173';
const landing='docs/evidence/nonhair-2026-10-03/review.html';
const sourceFiles=['tools/critic/october3-review-ui.mjs','packages/testbed/today-review.js','packages/testbed/index.html','packages/testbed/pages.js','packages/core/src/render/MotionProbe.mjs',landing,'docs/evidence/nonhair-2026-10-03/current-review/PLAN.md'];
const imageFiles=['docs/evidence/nonhair-2026-10-03/mobile-body-jitter/archive/capture/page.png','docs/evidence/nonhair-2026-10-03/mobile-toolbar/archive/capture/mobile-body.png'];
const sha=b=>createHash('sha256').update(b).digest('hex');
const hash=p=>sha(fs.readFileSync(path.join(root,p)));
const preservationPins=JSON.parse(fs.readFileSync(path.join(root,'docs/evidence/nonhair-2026-10-03/overshirt/archive/manifest.json'))).externalPins;
assert.ok(!fs.existsSync(out),'Fresh sole packet; no overwrite');
fs.mkdirSync(out,{recursive:true});
const report={started:new Date().toISOString(),pid:process.pid,hardStop,status:'running',baseUrl,sourceHashes:Object.fromEntries(sourceFiles.map(p=>[p,hash(p)])),imageInputHashes:Object.fromEntries(imageFiles.map(p=>[p,hash(p)])),preservationPins,views:[],linkedResponses:[],errors:[],warnings:[],limits:['HTML navigation/media/layout only; no Avatar or current feature execution.','Original character images retain prior scoped qualification; no exact pixel comparison or AAA acceptance.','Only this browser/page are owned. Borrowed review service remains.']};
const save=()=>fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2)+'\n');
const deadline=()=>assert.ok(Date.now()<Date.parse(hardStop),'Fixed deadline');
async function bounded(fn,label,cleanup=false){if(!cleanup)deadline();let timer;try{return await Promise.race([fn(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timeout')),cleanup?5000:Math.max(1,Math.min(30000,Date.parse(hardStop)-Date.now())));})]);}finally{clearTimeout(timer);}}
for(const p of sourceFiles){const dst=path.join(out,'sources',p);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(path.join(root,p),dst);}
save();let browser,page,error;
function localFile(url){const u=new URL(url),decoded=decodeURIComponent(u.pathname);assert.equal(u.origin,baseUrl);return decoded.startsWith('/@fs/')?decoded.slice(5):path.join(root,'packages/testbed',decoded.slice(1));}
async function checkResource(link){
 return await bounded(async()=>{const response=await page.request.get(link.url);assert.equal(response.status(),200,link.url);const bytes=await response.body(),file=localFile(link.url),original=fs.readFileSync(file),type=response.headers()['content-type']??'';
 const record={...link,file:path.relative(root,file),status:response.status(),contentType:type,servedSHA256:sha(bytes),localSHA256:sha(original)};
 if(file.endsWith('.html')){assert.ok(type.includes('text/html'),link.url);const title=original.toString().match(/<title>([\s\S]*?)<\/title>/i)?.[1];assert.ok(title);assert.ok(bytes.toString().includes(`<title>${title}</title>`),'Intended HTML title; no fallback');record.intendedTitle=title;
  const fragment=new URL(link.url).hash.slice(1);if(fragment){assert.ok(original.toString().includes(`id="${fragment}"`));assert.ok(bytes.toString().includes(`id="${fragment}"`));record.fragment=fragment;}}
 else assert.equal(record.servedSHA256,record.localSHA256,'Exact resource bytes; no fallback');
 return record;
 },'Resource '+link.url);
}
try{
 browser=await bounded(()=>launchProbeBrowser(),'Browser');
 page=await bounded(()=>browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'}),'Page');
 page.setDefaultTimeout(15000);
 page.on('pageerror',e=>report.errors.push(e.stack??e.message));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());if(m.type()==='warning')report.warnings.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 for(const[label,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}],['narrow',{width:320,height:560}]]){
  await bounded(async()=>{
  await bounded(async()=>{await page.setViewportSize(viewport);await page.goto(baseUrl+'/',{waitUntil:'networkidle'});},'Hub '+label);
  const entry=page.locator('[data-today-review]');assert.equal(await entry.count(),1);assert.equal(await entry.textContent(),'Latest work · October 3');
  const href=await entry.getAttribute('href');assert.ok(href.endsWith('/'+landing));
  const destinations=await page.locator('#hub .page h3 a').evaluateAll(a=>a.map(e=>({text:e.textContent,url:e.href})));
  assert.equal(destinations.length,17);assert.deepEqual(destinations,ALL_PAGES.map(p=>({text:p.name,url:new URL(p.path,baseUrl+'/').href})));
  await page.keyboard.press('Tab');
  const focus=await entry.evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return{active:e===document.activeElement,visible:e.matches(':focus-visible'),outline:s.outlineStyle,width:parseFloat(s.outlineWidth),offset:parseFloat(s.outlineOffset),rect:{x:r.x,y:r.y,width:r.width,height:r.height},overflow:document.documentElement.scrollWidth>innerWidth};});
  assert.ok(focus.active&&focus.visible&&focus.outline==='solid'&&focus.width>0);assert.equal(focus.overflow,false);
  assert.ok(focus.rect.x-focus.width-focus.offset>=0&&focus.rect.x+focus.rect.width+focus.width+focus.offset<=viewport.width);
  const hubFile=label+'-hub.png';await bounded(()=>page.screenshot({path:out+'/'+hubFile}),'Hub screenshot');
  await bounded(()=>Promise.all([page.waitForNavigation({waitUntil:'networkidle'}),page.keyboard.press('Enter')]),'Enter hub→review');assert.equal(page.url(),href);assert.equal(await page.title(),'Sugata — October 3 review');
  await bounded(()=>page.evaluate(async()=>{for(const i of document.images)i.loading='eager';await Promise.all([...document.images].map(i=>i.decode()));}),'Original image decode');
  const state=await page.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};return{url:location.href,viewport:[innerWidth,innerHeight],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],avatarPresent:!!window.showcase||!!document.querySelector('canvas'),headings:[...document.querySelectorAll('h1,h2,h3')].map(e=>({text:e.textContent,rect:rect(e),clientWidth:e.clientWidth,scrollWidth:e.scrollWidth})),links:[...document.querySelectorAll('a')].map(e=>({text:e.textContent,url:e.href})),images:[...document.images].map(i=>({url:i.src,alt:i.alt,loaded:i.complete,width:i.naturalWidth,height:i.naturalHeight,rect:rect(i)})),cards:[...document.querySelectorAll('#mobile-outfit .card')].map(rect),mobileStatus:document.querySelector('#mobile-outfit .status').textContent,research:document.querySelector('#research').textContent,footer:document.querySelector('footer').textContent};});
  assert.equal(state.avatarPresent,false);assert.ok(state.document[0]<=viewport.width);assert.equal(state.images.length,2);assert.ok(state.images.every(i=>i.loaded&&i.width===390&&i.height===844&&i.alt.length>20));
  assert.equal(await page.locator('h1').count(),1);assert.ok(state.headings.every(h=>h.scrollWidth<=h.clientWidth&&h.rect.x>=0&&h.rect.x+h.rect.width<=viewport.width));
  const[a,b]=state.cards;assert.equal(state.cards.length,2);if(label==='desktop'){assert.equal(a.y,b.y);assert.ok(b.x>a.x);}else{assert.equal(a.x,b.x);assert.ok(b.y>=a.y+a.height);}
  assert.ok(state.mobileStatus.includes('scroll to reach the controls'));assert.ok(state.research.includes('Rejected image')&&state.research.includes('No new garment or outfit is available'));assert.ok(state.research.includes('stopped before producing a new native image'));assert.ok(state.footer.includes('AAA character quality, expression, wardrobe and broader representation'));
  const imageResponses=await Promise.all(state.images.map(async i=>{const r=await checkResource({text:i.alt,url:i.url});const f=imageFiles.find(p=>r.file===p);assert.ok(f,'Declared original');assert.equal(r.servedSHA256,report.imageInputHashes[f]);return r;}));
  const reviewFile=label+'-review.png',outfitFile=label+'-outfit.png';
  await bounded(()=>page.screenshot({path:out+'/'+reviewFile,fullPage:true}),'Review screenshot');
  await bounded(()=>page.locator('#mobile-outfit').screenshot({path:out+'/'+outfitFile}),'Outfit section screenshot');
  report.views.push({label,viewport,hub:{file:hubFile,sha256:hash(rel+'/'+hubFile),entryHref:href,focus,destinations},review:{file:reviewFile,sha256:hash(rel+'/'+reviewFile),outfitFile,outfitSHA256:hash(rel+'/'+outfitFile),state,imageResponses}});save();
  },'Complete viewport '+label);
 }
 report.linkedResponses=await Promise.all(report.views[0].review.state.links.map(checkResource));
 for(const[p,h]of Object.entries({...report.sourceHashes,...report.imageInputHashes,...preservationPins}))assert.equal(hash(p),h,p);
 assert.deepEqual(report.errors,[]);deadline();report.finalPinsUnchanged=true;report.status='observed';
}catch(e){error=e;report.status='failed';report.errors.push(e.stack??String(e));}
finally{
 report.cleanup={};for(const[name,r]of [['page',page],['browser',browser]]){try{if(r)await bounded(()=>r.close(),name,true);report.cleanup[name]=r?'closed':'not-created';}catch(e){report.errors.push(e.message);error??=e;}}
 if(!error){try{deadline();assert.equal(report.views.length,3);assert.deepEqual(report.cleanup,{page:'closed',browser:'closed'});for(const[p,h]of Object.entries({...report.sourceHashes,...report.imageInputHashes,...preservationPins}))assert.equal(hash(p),h,p);report.status='passed';report.postCleanupDeadlinePassed=true;}catch(e){report.errors.push(e.stack??e.message);error=e;}}
 if(report.errors.length){report.status='failed';error??=Error('Late failure');}report.borrowedReviewServerRetained=true;report.finished=new Date().toISOString();save();
 console.log(JSON.stringify({out,pid:process.pid,status:report.status,views:report.views.length,errors:report.errors.length,warnings:report.warnings.length,cleanup:report.cleanup,reportSHA256:hash(rel+'/report.json')}));
}
if(error)throw error;
