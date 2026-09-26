import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
import {launchProbeBrowser} from '../../../../packages/core/src/render/MotionProbe.mjs';
const ROOT=fileURLToPath(new URL('../../../../',import.meta.url)),out=path.resolve(process.argv[2]);assert.equal(process.argv.length,3);assert.ok(!fs.existsSync(out));
const sha=b=>createHash('sha256').update(b).digest('hex'),files=['packages/testbed/index.html','packages/testbed/today-review.js','docs/evidence/nonhair-2026-09-26/review.html',
 'docs/evidence/nonhair-2026-09-26/today-review/probe.mjs',
 ...['scene','expression-next','hand-candidate','hand-clearance'].map(name=>'docs/evidence/nonhair-2026-09-26/'+name+'/review.html'),
 'docs/evidence/nonhair-2026-09-26/expression-next/review.js','docs/evidence/nonhair-2026-09-26/expression-next/review-manifest.json',
 ...['showcase','portrait'].flatMap(name=>['packages/testbed/src/'+name+'.html','packages/testbed/src/'+name+'.js']),
 'packages/core/src/Avatar.js','packages/core/src/render/MotionProbe.mjs'];
const hashes=Object.fromEntries(files.map(f=>[f,sha(fs.readFileSync(path.join(ROOT,f)))]));
const report={completed:false,sourceHashes:hashes,checks:[],images:[],retirements:[],errors:[]};fs.mkdirSync(out,{recursive:true});
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const browser=await launchProbeBrowser(),context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1}),page=await context.newPage();
page.on('pageerror',e=>report.errors.push({kind:'pageerror',message:String(e)}));page.on('response',r=>{if(r.status()>=400)report.errors.push({kind:'http',status:r.status(),url:r.url()});});
page.on('console',m=>{if(m.type()==='error')report.errors.push({kind:'console',message:m.text(),location:m.location()});});
page.on('requestfailed',r=>report.errors.push({kind:'requestfailed',url:r.url(),failure:r.failure()}));
let retirementResolve;
await page.exposeFunction('recordReviewRetirement',receipt=>{report.retirements.push(receipt);retirementResolve?.(receipt);});
const capture=async file=>{const bytes=await page.screenshot({fullPage:true});fs.writeFileSync(path.join(out,file),bytes,{flag:'wx'});report.images.push({file,sha256:sha(bytes)});};
const fits=async()=>{const r=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(r.scroll<=r.client+1);return r;};
let landing;
try{
 await page.goto('http://127.0.0.1:5173/');const shortcut=page.locator('[data-today-review]');await shortcut.waitFor();assert.equal(await shortcut.count(),1);await shortcut.click();await page.locator('h1').filter({hasText:'Today’s work.'}).waitFor();landing=page.url();
 assert.ok(landing.includes('/docs/evidence/nonhair-2026-09-26/review.html'));await fits();await capture('desktop.png');
 await page.reload();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.className),'skip');await page.keyboard.press('Enter');assert.equal(new URL(page.url()).hash,'#main');
 await page.locator('nav a[href="#comparisons"]').click();assert.equal(new URL(page.url()).hash,'#comparisons');
 report.checks.push({name:'Hub shortcut resolves local review; keyboard skip/section links work',passed:true,landing});
 await page.setViewportSize({width:390,height:844});await page.goto(landing);const mobile=await fits();await capture('mobile.png');report.checks.push({name:'Desktop/mobile landing fit viewport',passed:true,mobile});await page.setViewportSize({width:1440,height:1000});
 const routes=[['scene/review.html','kitchen'],['expression-next/review.html','Three expression studies'],['hand-candidate/review.html','hand-placement'],['hand-clearance/review.html','hand and hip']];
 for(const [href,title]of routes){await page.goto(landing);await page.locator('a[href="'+href+'"]').click();assert.ok(new URL(page.url()).pathname.endsWith('/'+href));
  if(href.startsWith('scene/'))await page.waitForFunction(()=>[...document.querySelectorAll('img:not([loading="lazy"])')].every(i=>i.complete&&i.naturalWidth>0));
  if(href.startsWith('expression-'))await page.waitForFunction(()=>!document.querySelector('#play').disabled&&document.querySelectorAll('#comparison img').length===3);
  assert.ok((await page.title()).toLowerCase().includes(title.toLowerCase()));
  if(href.startsWith('hand-candidate/')){await page.locator('a').filter({hasText:'Open the synchronized comparison'}).click();await page.waitForFunction(()=>document.querySelectorAll('#comparison img').length===2&&[...document.querySelectorAll('#comparison img')].every(i=>i.complete&&i.naturalWidth>0));}
  if(href.startsWith('hand-clearance/')){await page.locator('a').filter({hasText:'Open the synchronized comparison'}).click();await page.waitForFunction(()=>document.querySelectorAll('#comparison img').length===3&&[...document.querySelectorAll('#comparison img')].every(i=>i.complete&&i.naturalWidth>0));}
 }
 report.checks.push({name:'Four relative comparison routes reach their actual pages; image galleries initialize',passed:true});
 for(const [href,handle]of [['/src/showcase.html','showcase'],['/src/portrait.html','portrait']]){
  await page.goto(landing);await page.locator('a[href="'+href+'"]').click();await page.waitForFunction(handle=>window[handle]?.avatar?.stage?.backendName==='webgpu',handle,{timeout:120000});assert.equal(await page.locator('#error').isVisible(),false);assert.equal(new URL(page.url()).pathname,href);
  const retired=new Promise(resolve=>{retirementResolve=resolve;});
  await page.evaluate(handle=>{const avatar=window[handle].avatar,renderer=avatar.stage.renderer;
   addEventListener('pagehide',event=>{window.recordReviewRetirement({handle,persisted:event.persisted,disposed:avatar.disposed,leaks:avatar.leakedHandles(),memory:structuredClone(renderer.info.memory)});},{once:true});
  },handle);
  // Actual navigation invokes the page-owned handler, including its RAF/attention/controls cleanup.
  await page.goto(landing);let timer;const receipt=await Promise.race([retired,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Missing actual pagehide retirement')),10000);})]).finally(()=>clearTimeout(timer));
  assert.equal(receipt.handle,handle);assert.equal(receipt.persisted,false);assert.equal(receipt.disposed,true);assert.deepEqual(receipt.leaks,[]);assert.ok(Object.values(receipt.memory).every(v=>v===0));retirementResolve=null;
 }
 report.checks.push({name:'Both live demo links initialize actual WebGPU avatars serially',passed:true});
 await page.goto(landing);await page.locator('footer a[href="/"]').click();await page.locator('[data-today-review]').waitFor();
 for(const [file,hash]of Object.entries(hashes))assert.equal(sha(fs.readFileSync(path.join(ROOT,file))),hash,'Source drift');assert.deepEqual(report.errors,[]);report.completed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}finally{save();await context.close();await browser.close();console.log(JSON.stringify({completed:report.completed,checks:report.checks.length,failure:report.failure,out}));}
