import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {startProbeServer,launchProbeBrowser} from '../../packages/core/src/render/MotionProbe.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=path.resolve(root,process.argv[2]??'captures/wardrobe-colours-review-page-v1');assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const sources=['tools/critic/daytime-review-page.mjs','packages/testbed/today-review.js','docs/evidence/hair-2026-09-30/review.html'];const sha=b=>createHash('sha256').update(b).digest('hex');const hashes=()=>Object.fromEntries(sources.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
const report={started:new Date().toISOString(),pid:process.pid,status:'running',sourceHashes:hashes(),views:[],errors:[]};const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
for(const p of sources){const dest=path.join(out,'source',p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,p),dest);}save();let server,browser;
try{server=await startProbeServer({port:5301});browser=await launchProbeBrowser();const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});await page.goto(server.baseUrl,{waitUntil:'networkidle'});const link=page.locator('[data-today-review]');assert.equal(await link.textContent(),'Today’s work · September 30');await link.click();await page.waitForLoadState('networkidle');
 for(const [name,width,height]of [['desktop',1440,1000],['mobile',390,844]]){await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));const state=await page.evaluate(()=>({url:location.href,scroll:[scrollX,scrollY],width:innerWidth,scrollWidth:document.documentElement.scrollWidth,images:[...document.images].map(i=>({src:i.src,loaded:i.complete&&i.naturalWidth>0})),links:[...document.links].map(a=>({text:a.textContent,url:a.href}))}));assert.equal(state.images.length,7);assert.ok(state.images.every(i=>i.loaded));assert.ok(state.scrollWidth<=width);const file=`${name}.png`;await page.screenshot({path:path.join(out,file),fullPage:true});report.views.push({name,...state,file,sha256:sha(fs.readFileSync(path.join(out,file)))});save();}
 assert.deepEqual(report.errors,[]);assert.deepEqual(hashes(),report.sourceHashes);report.status='captured';
}catch(e){report.status='failed';report.errors.push(e.stack);throw e;}finally{report.finished=new Date().toISOString();save();await browser?.close();await server?.close();}
