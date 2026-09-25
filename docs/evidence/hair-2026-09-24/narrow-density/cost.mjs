import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {startProbeServer,launchProbeBrowser} from '../../../packages/core/src/render/MotionProbe.mjs';
const root='tmp/hair-sep24/narrow-density';
const sha=data=>createHash('sha256').update(data).digest('hex');
const summary=values=>{
 const s=[...values].sort((a,b)=>a-b);
 return {min:s[0],p50:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],max:s.at(-1)};
};
const report={scope:'hair.html PBR crop01/g050, viewport 1400x1100, capture clock, four sequential pages; no all-scene performance claim',
 runs:[],errors:[],budget:{computeP50Ms:.25,source:'HairDynamics.selftest.mjs X; no existing render or tail budget'}};
const server=await startProbeServer({port:5187});let browser;
try{
 browser=await launchProbeBrowser();
 for(const arm of ['baseline','double','double','baseline']){
  const input=arm==='baseline'?'assets/hair/crop01/g050.glb':`${root}/double/hair/crop01/g050.glb`;
  const data=fs.readFileSync(input),row={arm,input,sha256:sha(data),loads:[]};report.runs.push(row);
  const context=await browser.newContext({viewport:{width:1400,height:1100},deviceScaleFactor:1});
  try{
   const page=await context.newPage();page.setDefaultTimeout(300000);
   page.on('pageerror',e=>report.errors.push(String(e)));
   page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Failed to load resource'))report.errors.push(m.text());});
   page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))report.errors.push(`${r.status()} ${r.url()}`);});
   await page.route('**/assets/hair/crop01/g050.glb',route=>{row.loads.push(sha(data));return route.fulfill({body:data,contentType:'model/gltf-binary'});});
   await page.goto(`${server.baseUrl}/src/hair.html?groom=crop01&bake=g050&capture=1&motion=1&head=shake&gputime=1`);
   await page.waitForFunction(()=>typeof window.__HAIR_GPU_COST__==='function'&&document.querySelector('#hud').textContent.includes('Renderer'),null,{timeout:120000});
   row.hud=await page.locator('#hud').textContent();assert.match(row.hud,/WebGPU/);assert.doesNotMatch(row.hud,/FAILED/);
   row.adapter=await page.evaluate(async()=>{const a=await navigator.gpu.requestAdapter();const i=a?.info;return i?{vendor:i.vendor,architecture:i.architecture,device:i.device,description:i.description,isFallbackAdapter:a.isFallbackAdapter}:null;});
   await page.evaluate(async()=>{for(let i=0;i<60;i++)await window.__HAIR_STEP__(1/60);});
   row.frames=await page.evaluate(async()=>{
    const values=[];let steps=window.__HAIR_STATE__().steps;
    for(let i=0;i<120;i++){
     await window.__HAIR_STEP__(1/60);
     const state=window.__HAIR_STATE__(),reading=await window.__HAIR_GPU_MS__();
     values.push({...reading,substeps:state.steps-steps,computeCalls:state.computeCallsThisFrame});steps=state.steps;
    }
    return values;
   });
   for(const frame of row.frames){assert.ok(Number.isFinite(frame.compute)&&Number.isFinite(frame.render));assert.equal(frame.substeps,2);assert.equal(frame.computeCalls,1);}
   assert.ok(row.frames.some(f=>f.compute>0)&&row.frames.some(f=>f.render>0),'Timestamps must be live');
   row.batch=await page.evaluate(async()=>{const runs=[];for(let i=0;i<8;i++)runs.push(await window.__HAIR_GPU_COST__(64));return runs;});
   assert.ok(row.batch.every(b=>b.repeats===64&&Number.isFinite(b.perFrameMs)&&b.perFrameMs>0));
   row.compute=summary(row.frames.map(f=>f.compute));row.render=summary(row.frames.map(f=>f.render));
   row.amortizedDispatch=summary(row.batch.map(b=>b.perFrameMs));
   row.computeBudgetPassed=row.compute.p50<report.budget.computeP50Ms;
   const gcd=(a,b)=>b===0?a:gcd(b,a%b);
   row.computeQuantumMs=row.frames.map(f=>Math.round(f.compute*1e6)).filter(x=>x>0).reduce(gcd)/1e6;
   assert.ok(row.loads.length>0&&row.loads.every(h=>h===row.sha256));
   console.log(JSON.stringify({arm,compute:row.compute,render:row.render,arithmetic:row.amortizedDispatch,computeBudgetPassed:row.computeBudgetPassed}));
  }finally{await context.close();}
 }
 assert.deepEqual(report.errors,[]);
}catch(error){report.error=error.stack;throw error;}finally{
 fs.writeFileSync(`${root}/cost.json`,JSON.stringify(report,null,2)+'\n');
 await browser?.close();await server.close();
}
