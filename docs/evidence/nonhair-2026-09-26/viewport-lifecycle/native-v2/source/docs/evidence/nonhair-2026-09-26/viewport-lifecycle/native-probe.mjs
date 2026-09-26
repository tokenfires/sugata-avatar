// Real Stage + native MediaQueryList listener inspection with explicitly synthetic events.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {startProbeServer,launchProbeBrowser} from '../../../../packages/core/src/render/MotionProbe.mjs';
const ROOT=fileURLToPath(new URL('../../../../',import.meta.url));
assert.equal(process.argv.length,3,'usage: node native-probe.mjs FRESH_OUTPUT');
const out=path.resolve(process.argv[2]);assert.ok(!fs.existsSync(out));
const sha=b=>createHash('sha256').update(b).digest('hex');
const files=['packages/core/src/render/Stage.js','packages/core/src/render/MotionProbe.mjs',
 'docs/evidence/nonhair-2026-09-26/viewport-lifecycle/native-probe.mjs'];
const hashes=Object.fromEntries(files.map(f=>[f,sha(fs.readFileSync(path.join(ROOT,f)))]));
const report={completed:false,sourceHashes:hashes,checks:[],observations:[],errors:[],retirements:[],
 scope:'Native MediaQueryList registration/retirement on empty WebGPU Stages, with explicitly synthetic change events. No automatic physical-display DPR transition, full Avatar, OS heap, GPU allocator, appearance or performance qualification.'};
fs.mkdirSync(out,{recursive:true});
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
let server,browser,context,page,cdp;
async function inspectQueries(label){
 const count=await page.evaluate(()=>retainedQueries.length),queries=[];
 for(let i=0;i<count;i++){
  const evaluated=await cdp.send('Runtime.evaluate',{expression:'window.retainedQueries['+i+']',objectGroup:'viewport-lifecycle',returnByValue:false});
  assert.ok(evaluated.result.objectId);
  const result=await cdp.send('DOMDebugger.getEventListeners',{objectId:evaluated.result.objectId});
  const listeners=result.listeners.filter(x=>x.type==='change');
  queries.push({index:i,changeListeners:listeners.length,flags:listeners.map(x=>({useCapture:x.useCapture,passive:x.passive,once:x.once}))});
 }
 const state=await page.evaluate(()=>({dpr:devicePixelRatio,updateCount,watcherIndex:retainedQueries.indexOf(stage.pixelRatioWatcher),watcherNull:stage.pixelRatioWatcher===null,
  listenerNull:stage.pixelRatioChangeListener===null,resizeObserverNull:stage.resizeObserver===null,pixelRatio:stage.pixelRatio,
  buffer:stage.canvas?{width:stage.canvas.width,height:stage.canvas.height}:null}));
 const observation={label,queries,state};report.observations.push(observation);save();return observation;
}
async function settle(){await page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});}
async function create(){
 await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.style.cssText='width:320px;height:240px;display:block';document.body.append(canvas);
  window.stage=new StageClass();window.updateCount=0;
  const update=stage.updateViewport;stage.updateViewport=function(...args){updateCount++;return update(...args);};
  await stage.create(canvas,{pipeline:false,antialias:false});
  window.retainedRenderer=stage.renderer;retainedQueries.push(stage.pixelRatioWatcher);
 });
 await settle();assert.equal(await page.evaluate(()=>stage.backendName),'webgpu');
}
async function retire(label){
 const receipt=await page.evaluate(()=>{stage.dispose();return {rendererNull:stage.renderer===null,watcherNull:stage.pixelRatioWatcher===null,
  listenerNull:stage.pixelRatioChangeListener===null,resizeObserverNull:stage.resizeObserver===null,memory:structuredClone(retainedRenderer.info.memory)};});
 assert.equal(receipt.rendererNull,true);assert.equal(receipt.watcherNull,true);assert.equal(receipt.listenerNull,true);assert.equal(receipt.resizeObserverNull,true);
 assert.ok(Object.values(receipt.memory).every(x=>x===0));report.retirements.push({label,...receipt});
 const after=await inspectQueries(label);assert.ok(after.queries.every(q=>q.changeListeners===0));
 await page.evaluate(()=>stage.dispose());
 return after;
}
try{
 server=await startProbeServer({port:5381});browser=await launchProbeBrowser();
 context=await browser.newContext({viewport:{width:640,height:480},deviceScaleFactor:1});page=await context.newPage();
 page.on('pageerror',e=>report.errors.push({kind:'pageerror',message:e.message}));
 page.on('console',m=>{if(m.type()==='error')report.errors.push({kind:'console',message:m.text(),location:m.location()});});
 page.on('response',r=>{if(r.status()>=400)report.errors.push({kind:'http',status:r.status(),url:r.url()});});
 page.on('requestfailed',r=>report.errors.push({kind:'requestfailed',url:r.url(),error:r.failure()}));
 // Hub supplies the same Vite origin without instantiating an Avatar.
 await page.goto(server.baseUrl+'/');
 const moduleURL='/@fs'+path.join(ROOT,'packages/core/src/render/Stage.js');
 await page.evaluate(async url=>{window.StageClass=(await import(url)).Stage;window.retainedQueries=[];},moduleURL);
 cdp=await context.newCDPSession(page);await create();
 let current=await inspectQueries('initial native query');assert.equal(current.queries.length,1);assert.equal(current.queries[0].changeListeners,1);
 await page.evaluate(()=>{stage.watchPixelRatio();retainedQueries.push(stage.pixelRatioWatcher);});
 current=await inspectQueries('explicit repin');assert.equal(current.queries[0].changeListeners,0);assert.equal(current.queries[1].changeListeners,1);
 const beforeOldEvent=current.state.updateCount;
 await page.evaluate(()=>retainedQueries[0].dispatchEvent(new MediaQueryListEvent('change',{media:retainedQueries[0].media,matches:false})));
 assert.equal(await page.evaluate(()=>updateCount),beforeOldEvent);
 await page.evaluate(()=>{const query=stage.pixelRatioWatcher;query.dispatchEvent(new MediaQueryListEvent('change',{media:query.media,matches:false}));retainedQueries.push(stage.pixelRatioWatcher);});
 current=await inspectQueries('synthetic event on native current query');
 assert.equal(current.state.updateCount,beforeOldEvent+1);assert.ok(current.queries.slice(0,-1).every(q=>q.changeListeners===0));assert.equal(current.queries.at(-1).changeListeners,1);
 report.checks.push('Native listener census proves explicit repin retires the old callback; synthetic old/current query events observe removal and once-only repinning.');
 await page.evaluate(()=>stage.unwatchViewport());const unwatched=await inspectQueries('unwatch while renderer remains live');
 assert.ok(unwatched.queries.every(q=>q.changeListeners===0));assert.equal(unwatched.state.resizeObserverNull,true);assert.equal(unwatched.state.watcherNull,true);
 await page.evaluate(()=>retainedQueries.forEach(query=>query.dispatchEvent(new MediaQueryListEvent('change',{media:query.media,matches:false}))));await settle();current=await inspectQueries('synthetic changes after unwatch');
 assert.equal(current.state.updateCount,unwatched.state.updateCount);assert.equal(current.state.watcherNull,true);assert.deepEqual(current.state.buffer,unwatched.state.buffer);
 report.checks.push('Synthetic events on all native retired queries after unwatch invoke no viewport callback and cannot recreate observation.');
 await page.evaluate(()=>stage.watchViewport());await settle();await page.evaluate(()=>retainedQueries.push(stage.pixelRatioWatcher));
 current=await inspectQueries('watch again');assert.equal(current.queries.at(-1).changeListeners,1);assert.equal(current.state.pixelRatio,1);
 await retire('first complete Stage disposal');
 const before=await page.evaluate(()=>updateCount);await page.evaluate(()=>retainedQueries.forEach(query=>query.dispatchEvent(new MediaQueryListEvent('change',{media:query.media,matches:false}))));await settle();assert.equal(await page.evaluate(()=>updateCount),before);
 report.checks.push('Rewatch installs one listener; real Stage disposal removes it and later synthetic events invoke no retired callback.');
 for(let cycle=0;cycle<2;cycle++){await create();current=await inspectQueries('fresh Stage '+cycle);assert.equal(current.queries.filter(q=>q.changeListeners).length,1);await retire('fresh Stage '+cycle+' disposed');}
 report.checks.push('Three same-document native Stage create/dispose cycles leave zero registered change listeners and zero renderer counters.');
 await settle();assert.deepEqual(report.errors,[]);
 for(const[f,h]of Object.entries(hashes)){const bytes=fs.readFileSync(path.join(ROOT,f));assert.equal(sha(bytes),h,'Source drift '+f);const dest=path.join(out,'source',f);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);}
 report.completed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{
 if(page){try{await page.evaluate(()=>window.stage?.dispose());}catch(error){report.finalCleanupFailure=String(error);report.completed=false;process.exitCode=1;}}
 await cdp?.send('Runtime.releaseObjectGroup',{objectGroup:'viewport-lifecycle'}).catch(()=>{});
 await context?.close();await browser?.close();await server?.close();save();
 console.log(JSON.stringify({completed:report.completed,checks:report.checks.length,failure:report.failure,out}));
}
