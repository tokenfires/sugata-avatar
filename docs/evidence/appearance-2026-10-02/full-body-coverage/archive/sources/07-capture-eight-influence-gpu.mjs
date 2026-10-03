import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {Matrix4} from 'three';
import {startProbeServer,launchProbeBrowser} from '../../packages/core/src/render/MotionProbe.mjs';
const ROOT=fileURLToPath(new URL('../../',import.meta.url)),REL='captures/skeleton-full-influences-gpu-2026-09-30-v2',OUT=path.join(ROOT,REL);
assert.ok(!fs.existsSync(OUT));fs.mkdirSync(OUT,{recursive:true});
const read=p=>fs.readFileSync(path.resolve(ROOT,p)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={started:new Date().toISOString(),pid:process.pid,status:'running',inputs:{},cases:[],views:[],artifacts:[],errors:[],scope:'Finite WebGPU compute positions and eight static plain-body images; no production shader/motion/normals/performance/body-range integration.'};
const save=()=>fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n');
function bind(p,copy=false){report.inputs[p]=sha(read(p));if(copy){const d=path.join(OUT,'source',p);fs.mkdirSync(path.dirname(d),{recursive:true});fs.copyFileSync(path.join(ROOT,p),d);}}
function decode(dir,a){const p=dir+'/'+a.file;bind(p);const b=read(p);assert.equal(sha(b),a.sha256);const raw=gunzipSync(b);assert.equal(sha(raw),a.decodedSHA256);return JSON.parse(raw);}
function archive(file,value){const raw=Buffer.from(JSON.stringify(value)+'\n'),b=gzipSync(raw);fs.writeFileSync(path.join(OUT,file),b);const a={file,sha256:sha(b),decodedSHA256:sha(raw),bytes:b.length};report.artifacts.push(a);return a;}
function metric(actual,expected){assert.equal(actual.length,expected.length);let maxMm=-1,sum=0,worst;const residuals=[];for(let i=0;i<actual.length/3;i++){const a=actual.slice(i*3,i*3+3),e=expected.slice(i*3,i*3+3);assert.ok([...a,...e].every(Number.isFinite));const mm=Math.hypot(...a.map((v,c)=>v-e[c]))*1000;sum+=mm*mm;const r={vertex:i,actual:a,expected:e,mm};if(mm>maxMm){maxMm=mm;worst=r;}residuals.push(r);}return {summary:{passed:maxMm<.342,strict:true,gateMm:.342,vertices:actual.length/3,maxMm,rmsMm:Math.sqrt(sum/(actual.length/3)),worst},residuals};}
const matrix=a=>{assert.equal(a.length,16);assert.ok(a.every(Number.isFinite));return new Matrix4().set(...a);};
const C=matrix([1,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,1]);
const matrices=(pose,rest,names)=>names.flatMap(n=>C.clone().multiply(matrix(pose[n])).multiply(C.clone().multiply(matrix(rest[n])).invert()).toArray());
let server,browser,page;
try{
 const cr='captures/skeleton-full-influences-2026-09-30-v1',pr='captures/skeleton-posed-comparison-2026-09-30-v1',br='captures/skeleton-export-bridge-2026-09-30-v1',vr='captures/skeleton-posed-visual-2026-09-30-v1';
 for(const [dir,pin]of [[cr,'eac81ac3b1f5e66b17e0dbdb1606bdc0d479290c2b7cd0d85c6ebd6a71f13df3'],[pr,'ea6f19c3cef8e60e5d9bd8f9936cf0c83eeeb0d363bd08d7f7c635897a0a83ef'],[br,'a1c1ec374c41f2fd1c197d666a6b25d7c0f11bf52b796c4a5b02cc03270ed3e9'],[vr,'00e66b52d462d9be2f97995a335f211a474872db064d01ef952200c04772e79c']]){bind(dir+'/report.json',true);assert.equal(report.inputs[dir+'/report.json'],pin);}
 for(const p of ['tools/critic/capture-eight-influence-gpu.mjs','tools/critic/eight-influence-gpu.mjs','tools/critic/eight-influence-gpu.html','docs/evidence/wardrobe-2026-09-30/skeleton-full-influences/GPU-PLAN.md','packages/core/src/render/MotionProbe.mjs','vite.config.js','package-lock.json','node_modules/three/package.json','node_modules/three/build/three.webgpu.js','node_modules/three/build/three.tsl.js','node_modules/three/build/three.core.js','node_modules/three/build/three.module.js'])bind(p,true);
 bind('assets/figures/figure_g050.glb');assert.equal(report.inputs['assets/figures/figure_g050.glb'],'b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14');
 bind('docs/evidence/wardrobe-2026-09-30/skeleton-full-influences/GPU-RECOVERY.md',true);
 const cpu=JSON.parse(read(cr+'/report.json')),posed=JSON.parse(read(pr+'/report.json')),bridge=JSON.parse(read(br+'/report.json')),visual=JSON.parse(read(vr+'/report.json'));assert.ok(cpu.passed);assert.equal(cpu.cases.length,9);
 const repr=decode(cr,cpu.representation.artifact),asset=decode(br,bridge.artifacts.find(a=>a.file==='parsed-asset.json.gz'));assert.deepEqual(repr.jointNames,asset.jointNames);assert.deepEqual(repr.vertexMap,asset.vertexMap);
 bind(vr+'/geometry.json');assert.equal(report.inputs[vr+'/geometry.json'],visual.geometry.sha256);const oldGeometry=JSON.parse(read(vr+'/geometry.json'));
 const data={vertexCount:14517,indices:oldGeometry.indices,joints8:repr.joints8,weights8:repr.weights8,cases:[]};
 let neutralRest;
 for(const r of cpu.cases){const raw=decode(cr,r.artifact),p=decode(pr,posed.cases.find(c=>c.weight===r.weight&&c.pose===r.pose).artifact);assert.deepEqual(raw.parentArtifact,posed.cases.find(c=>c.weight===r.weight&&c.pose===r.pose).artifact);const row={name:`${r.weight}-${r.pose}`,weight:r.weight,pose:r.pose,positions:p.shapedPositions,matrices:matrices(p.constructedPose,p.constructedRest,repr.jointNames),expected:raw.expected,cpu:raw.packedPositions};data.cases.push(row);if(r.weight===0&&r.pose==='identity')neutralRest=p.constructedRest;}
 const cleanFour=data.cases.find(c=>c.weight===0&&c.pose==='coupled'),cleanStale=data.cases.find(c=>c.weight===1&&c.pose==='coupled');
 const fourJ=asset.joints.flatMap(row=>[...row,0,0,0,0]),fourW=asset.normalizedWeights.flatMap(row=>[...row,0,0,0,0]);
 const oldFour=decode(pr,posed.cases.find(c=>c.weight===0&&c.pose==='coupled').artifact);
 const staleData=decode(cr,cpu.artifacts.find(a=>a.file==='stale-neutral-binds.json.gz'));
 const staleSource=decode(pr,posed.cases.find(c=>c.weight===1&&c.pose==='coupled').artifact);
 data.cases.push({...cleanFour,name:'restore-accepted-four',negative:true,cleanParent:cleanFour.name,joints8:fourJ,weights8:fourW,cpu:oldFour.proposedPositions});
 data.cases.push({...cleanStale,name:'stale-neutral-binds',negative:true,cleanParent:cleanStale.name,matrices:matrices(staleSource.constructedPose,neutralRest,repr.jointNames),cpu:staleData.stale});
 fs.writeFileSync(path.join(OUT,'inputs.json'),JSON.stringify(data)+'\n');report.prepared={file:'inputs.json',sha256:sha(read(REL+'/inputs.json')),cases:data.cases.length};save();
 server=await startProbeServer({port:5301});report.baseUrl=server.baseUrl;browser=await launchProbeBrowser();page=await browser.newPage({viewport:{width:1200,height:1000},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.stack));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});page.on('console',m=>{if(m.type()==='error')report.errors.push(`${m.text()} ${JSON.stringify(m.location())}`);});
 await page.goto(`${server.baseUrl}/@fs${ROOT}tools/critic/eight-influence-gpu.html?data=${encodeURIComponent('/@fs'+OUT+'/inputs.json')}`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.captureReady,null,{timeout:60000});
 for(let index=0;index<data.cases.length;index++){
  const source=data.cases[index],observed=await page.evaluate(i=>window.runCase(i),index);assert.equal(observed.backend,'webgpu');assert.equal(observed.name,source.name);assert.equal(observed.positions.length,14517*3);assert.deepEqual(observed.errors,[]);
  const native=metric(observed.positions,source.expected),cpuCompare=metric(observed.positions,source.cpu);
  const controls=source.negative?report.cases.filter(c=>c.name===source.cleanParent):report.cases.filter(c=>!c.negative&&((source.weight!==0&&c.weight===0&&c.pose===source.pose)||(source.pose!=='identity'&&c.weight===source.weight&&c.pose==='identity')));
  assert.equal(controls.length,source.negative?1:(source.weight!==0?1:0)+(source.pose!=='identity'?1:0));
  const row={name:source.name,weight:source.weight,pose:source.pose,negative:!!source.negative,adapter:observed.adapter,three:observed.three,versusNative:native.summary,versusCPU:cpuCompare.summary,interpretable:controls.every(c=>c.passed&&c.interpretable)};
  row.passed=native.summary.passed&&cpuCompare.summary.passed;row.artifact=archive(source.name+'.json.gz',{observed,native,cpuCompare});report.cases.push(row);save();
  if(!source.negative&&source.pose==='coupled'&&[0,1].includes(source.weight))for(const close of [false,true])for(const arm of ['native','gpu']){
   const state=await page.evaluate(options=>window.drawCase(options),{arm,close});const file=`body-${source.weight}-${close?'waist':'context'}-${arm}.png`;await page.screenshot({path:path.join(OUT,file)});report.views.push({case:source.name,file,sha256:sha(read(REL+'/'+file)),...state});save();
  }
 }
 assert.deepEqual(report.errors,[]);report.cleanPassed=report.cases.filter(c=>!c.negative).every(c=>c.passed&&c.interpretable);report.negativeControlsPassed=report.cases.filter(c=>c.negative).every(c=>c.interpretable&&!c.versusNative.passed&&c.versusCPU.passed);report.passed=report.cleanPassed&&report.negativeControlsPassed;
 report.disposal=await page.evaluate(()=>window.disposeProbe());assert.equal(report.disposal.disposed,true);assert.deepEqual(report.disposal.errors,[]);for(const [p,h]of Object.entries(report.inputs))assert.equal(sha(read(p)),h,p);report.status='observed';
}catch(e){report.status='failed';report.errors.push(e.stack);if(page)try{report.failureDisposal=await page.evaluate(()=>window.disposeProbe?.());}catch(cleanup){report.errors.push('cleanup: '+cleanup.message);}throw e;}
finally{await browser?.close();await server?.close();report.finished=new Date().toISOString();report.ownedBrowserAndServerClosed=true;save();console.log(JSON.stringify({out:OUT,status:report.status,passed:report.passed,cases:report.cases.length,views:report.views.length,pid:report.pid}));}
