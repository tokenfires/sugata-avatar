/** One root-owned desktop/mobile HTML navigation packet. Existing avatar images only. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {launchProbeBrowser} from '../../packages/core/src/render/MotionProbe.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),rel='captures/current-review-2026-10-02-v1',out=path.join(root,rel);
assert.ok(!fs.existsSync(out),'One fresh UI packet; preserve earlier output.');fs.mkdirSync(out,{recursive:true});
const hash=p=>createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const sourceFiles=['tools/critic/current-review-ui.mjs','packages/testbed/today-review.js','packages/testbed/index.html','packages/testbed/pages.js','packages/core/src/render/MotionProbe.mjs','docs/evidence/appearance-2026-10-02/REVIEW-PLAN.md','docs/evidence/appearance-2026-10-02/review.html'];
const imageFiles=['captures/saved-colour-recipe-2026-10-02-candidate-v2/desktop-recipes.png','captures/saved-look-export-2026-10-02-v1/desktop-saved-export.png','docs/evidence/appearance-2026-10-02/front-design/concept-v1.png','docs/evidence/appearance-2026-10-02/front-design/boundary-archive/capture/front-bare-A.png'];
const report={started:new Date().toISOString(),pid:process.pid,status:'running',baseUrl:'http://127.0.0.1:5173',sourceHashes:Object.fromEntries(sourceFiles.map(p=>[p,hash(p)])),imageInputHashes:Object.fromEntries(imageFiles.map(p=>[p,hash(p)])),errors:[],views:[],linkedResponses:[],
 limits:['New HTML layout/navigation qualification only; existing images retain their prior scope.','No Avatar, groom, feature-download, physics, hardware-performance or all-page qualification.','Review service is borrowed and retained; only this browser/page are owned.']};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
for(const p of sourceFiles){const dest=path.join(out,'sources',p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,p),dest);}
let browser,page,primaryError;
try{
 browser=await launchProbeBrowser();page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.stack??e.message));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 for(const[label,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  await page.setViewportSize(viewport);await page.goto(report.baseUrl+'/',{waitUntil:'networkidle'});
  const entry=page.locator('[data-today-review]');assert.equal(await entry.count(),1);assert.equal(await entry.textContent(),'Latest work · October 2');
  const href=await entry.getAttribute('href');assert.ok(href.endsWith('/docs/evidence/appearance-2026-10-02/review.html'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const hubDestinations=await page.locator('#hub .page h3 a').evaluateAll(a=>a.map(e=>({text:e.textContent,url:e.href})));assert.equal(hubDestinations.length,17);assert.equal(new Set(hubDestinations.map(a=>a.url)).size,17);
  await entry.focus();assert.equal(await entry.evaluate(e=>e===document.activeElement),true);
  const hubFile=label+'-hub.png';await page.screenshot({path:path.join(out,hubFile)});
  await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}),page.keyboard.press('Enter')]);assert.equal(page.url(),href);
  assert.equal(await page.title(),'Sugata — October 2 review');assert.equal(await page.locator('main h1').count(),1);
  await page.evaluate(async()=>{for(const i of document.images)i.loading='eager';await Promise.all([...document.images].map(i=>i.decode()));});
  const state=await page.evaluate(()=>({url:location.href,viewport:[innerWidth,innerHeight],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],
   userAgent:navigator.userAgent,headings:[...document.querySelectorAll('h1,h2,h3')].map(e=>e.textContent),
   links:[...document.querySelectorAll('a')].map(e=>({text:e.textContent,url:e.href})),
   images:[...document.images].map(i=>({url:i.src,alt:i.alt,loaded:i.complete,width:i.naturalWidth,height:i.naturalHeight,rect:(()=>{const r=i.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})()})),
   sections:[...document.querySelectorAll('section')].map(e=>({id:e.id,label:e.querySelector('h2').textContent,cards:[...e.querySelectorAll('.card')].map(c=>{const r=c.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})})),
   status:document.querySelector('.status').textContent,footer:document.querySelector('footer').textContent}));
  assert.ok(state.document[0]<=viewport.width);assert.equal(state.images.length,4);assert.ok(state.images.every(i=>i.loaded&&i.width>0&&i.height>0));
  assert.deepEqual(state.sections.map(s=>s.label),['Available in the wardrobe study','Hair direction · experimental']);
  assert.ok(state.status.includes('No new hairstyle is integrated.'));assert.ok(state.footer.includes('AAA character quality, expression, wardrobe and broader representation'));
  for(const s of state.sections){const[a,b]=s.cards;assert.equal(s.cards.length,2);if(label==='desktop'){assert.equal(a.y,b.y);assert.ok(b.x>a.x);}else{assert.equal(a.x,b.x);assert.ok(b.y>=a.y+a.height);}}
  assert.ok(state.links.some(l=>l.text==='September 30 review'));assert.ok(state.links.some(l=>l.text==='Open the A/B visual review'));
  const imageResponses=await Promise.all(state.images.map(async i=>{const response=await page.request.get(i.url);assert.equal(response.status(),200);const bytes=await response.body();const local=imageFiles.find(p=>i.url.endsWith('/'+p));assert.ok(local,'Undeclared image input');const actual=createHash('sha256').update(bytes).digest('hex');assert.equal(actual,report.imageInputHashes[local]);return{url:i.url,file:local,status:response.status(),sha256:actual};}));
  const pageFile=label+'-review.png';await page.screenshot({path:path.join(out,pageFile),fullPage:true});
  report.views.push({label,viewport,hub:{file:hubFile,sha256:hash(rel+'/'+hubFile),entryHref:href,destinations:hubDestinations},review:{file:pageFile,sha256:hash(rel+'/'+pageFile),state,imageResponses}});save();
 }
 const links=report.views[0].review.state.links;
 report.linkedResponses=await Promise.all(links.map(async l=>{const response=await page.request.get(l.url);assert.equal(response.status(),200,l.url);const fragment=new URL(l.url).hash.slice(1);if(fragment==='saved-looks')assert.ok((await response.text()).includes('id="saved-looks"'),'CTA fragment must exist in served source');return{...l,status:response.status(),contentType:response.headers()['content-type'],fragment:fragment||null,fragmentVerified:fragment==='saved-looks'?true:null};}));
 for(const[p,h]of Object.entries({...report.sourceHashes,...report.imageInputHashes}))assert.equal(hash(p),h,p);
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){primaryError=e;report.status='failed';report.errors.push(e.stack??String(e));}
finally{
 report.cleanup={};for(const[name,resource]of [['page',page],['browser',browser]]){if(!resource){report.cleanup[name]='not-created';continue;}try{await resource.close();report.cleanup[name]='closed';}catch(e){report.cleanup[name]={error:e.stack};report.errors.push(`${name} cleanup: ${e.message}`);report.status='failed';primaryError??=e;}}
 if(report.errors.length){report.status='failed';primaryError??=new Error('Observer errors retained at final cleanup boundary.');}
 report.borrowedReviewServerRetained=true;report.finished=new Date().toISOString();save();console.log(JSON.stringify({out,pid:process.pid,status:report.status,cleanup:report.cleanup,reportSha256:hash(rel+'/report.json')}));
}
if(primaryError)throw primaryError;
