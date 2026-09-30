// Read-only replay of initial page loading; never invokes runCase or drawCase.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {fileURLToPath}from'node:url';
import{startProbeServer,launchProbeBrowser}from'../../packages/core/src/render/MotionProbe.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=path.join(root,'captures/skeleton-full-influences-network-2026-09-30-v1');assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=['tools/critic/eight-influence-network-diagnostic.mjs','tools/critic/eight-influence-gpu.html','tools/critic/eight-influence-gpu.mjs','captures/skeleton-full-influences-gpu-2026-09-30-v1/inputs.json'];
const report={started:new Date().toISOString(),pid:process.pid,inputs:Object.fromEntries(files.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))])),console:[],log:[],network:[],status:'running'};
let server,browser,page;
try{server=await startProbeServer({port:5301});browser=await launchProbeBrowser();page=await browser.newPage();const cdp=await page.context().newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Log.enable');cdp.on('Log.entryAdded',v=>report.log.push(v.entry));cdp.on('Network.responseReceived',v=>report.network.push({url:v.response.url,status:v.response.status,type:v.type}));page.on('console',m=>report.console.push({type:m.type(),text:m.text(),location:m.location()}));
await page.goto(`${server.baseUrl}/@fs${root}tools/critic/eight-influence-gpu.html?data=${encodeURIComponent('/@fs'+root+'captures/skeleton-full-influences-gpu-2026-09-30-v1/inputs.json')}`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.captureReady);report.disposal=await page.evaluate(()=>window.disposeProbe());report.status='observed';
for(const[p,h]of Object.entries(report.inputs))assert.equal(sha(fs.readFileSync(path.join(root,p))),h,p);
}finally{await browser?.close();await server?.close();report.finished=new Date().toISOString();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');fs.copyFileSync(fileURLToPath(import.meta.url),path.join(out,'source.mjs'));console.log(JSON.stringify({out,pid:report.pid,status:report.status,errors:report.log.filter(l=>l.level==='error')}));}
