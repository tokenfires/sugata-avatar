import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {launchProbeBrowser} from '../../../../packages/core/src/render/MotionProbe.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)), root=path.resolve(here,'../../../..');
const out=path.resolve(process.argv[2]);assert.ok(process.argv[2]);assert.equal(fs.existsSync(out),false);fs.mkdirSync(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex'), rel=p=>path.relative(root,p), json=x=>JSON.stringify(x,null,2)+'\n';
const names=[path.resolve(here,'../review.html'),...['review.html','review.css','base-example.png','custom-example.png','desktop-controls.png','mobile-controls.png'].map(f=>path.join(here,f))];
const routes=new Map(names.map(f=>['/'+rel(f),{file:f,bytes:fs.readFileSync(f)}]));
const report={scope:'Static Today link, status and layout only; no live Avatar page is loaded.',sources:Object.fromEntries([...routes.values()].map(x=>[rel(x.file),hash(x.bytes)])),responses:[],checks:[],screens:[],errors:[]};
report.controllerSHA256=hash(fs.readFileSync(fileURLToPath(import.meta.url)));
fs.copyFileSync(fileURLToPath(import.meta.url),path.join(out,'controller.mjs'));
for(const item of routes.values()){const f=path.join(out,'source',rel(item.file));fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,item.bytes);}
let browser,server,page;const pending=[];
try{
 server=http.createServer((req,res)=>{const item=routes.get(new URL(req.url,'http://local').pathname);if(!item){res.writeHead(404);res.end('Not in this static link check');return;}res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'}[path.extname(item.file)],'Cache-Control':'no-store'});res.end(item.bytes);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 browser=await launchProbeBrowser();report.browserVersion=browser.version();page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',e=>{if(e.type()==='error')report.errors.push(e.text());});
 page.on('response',r=>pending.push((async()=>{const item=routes.get(new URL(r.url()).pathname);assert.ok(item);assert.equal(r.status(),200);assert.equal(hash(await r.body()),hash(item.bytes));report.responses.push({path:rel(item.file),sha256:hash(item.bytes)});})().catch(e=>report.errors.push(String(e)))));
 for(const [name,width,height]of [['desktop',1440,1000],['mobile',390,844]]){
  await page.setViewportSize({width,height});await page.goto(base+'/'+rel(names[0]),{waitUntil:'networkidle'});
  assert.equal(await page.locator('.grid.comparisons > article').count(),6);
  const link=page.getByRole('link',{name:'See the colour prototype'});await link.focus();await link.scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const image=name+'-today.png';await page.screenshot({path:path.join(out,image)});report.screens.push({file:image,sha256:hash(fs.readFileSync(path.join(out,image)))});
  await page.keyboard.press('Enter');await page.waitForLoadState('networkidle');assert.match(page.url(),/wardrobe-colours-preview\/review.html$/);assert.equal(await page.locator('.status').textContent(),'Prototype — not in the live Wardrobe yet');assert.equal(await page.locator('script,canvas').count(),0);
  await page.getByRole('link',{name:'← Today’s work',exact:true}).click();await page.waitForLoadState('networkidle');assert.equal(page.url(),base+'/'+rel(names[0]));report.checks.push({viewport:{width,height},sixCards:true,keyboardNavigation:true,heldStatus:true,returnNavigation:true});
 }
 await Promise.all(pending);assert.deepEqual(report.errors,[]);for(const item of routes.values())assert.equal(hash(fs.readFileSync(item.file)),hash(item.bytes));report.sourcesStable=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}
finally{try{await browser?.close();report.browserClosed=true;}catch(e){report.errors.push(String(e));}try{if(server)await new Promise(resolve=>server.close(resolve));report.serverClosed=true;}catch(e){report.errors.push(String(e));}await Promise.all(pending);report.completed=!report.failure&&!report.errors.length&&report.checks.length===2&&report.sourcesStable&&report.browserClosed&&report.serverClosed;fs.writeFileSync(path.join(out,'report.json'),json(report));console.log(json({completed:report.completed,checks:report.checks.length,screens:report.screens.length,errors:report.errors, failure:report.failure,reportSHA256:hash(fs.readFileSync(path.join(out,'report.json')))}));if(!report.completed)process.exitCode=1;}
