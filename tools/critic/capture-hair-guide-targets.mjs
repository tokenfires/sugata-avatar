/** Root-owned six-frame HTML annotation packet; frozen native backgrounds only. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {startProbeServer,launchProbeBrowser} from '../../packages/core/src/render/MotionProbe.mjs';
const root=process.cwd(),rel='captures/hair-guide-targets-2026-10-02-v1',out=path.join(root,rel),targetFile='docs/evidence/appearance-2026-10-02/front-design/guide-targets-v1.json',nativeRoot='captures/hair-boundary-2026-10-02-v1';
assert.ok(!fs.existsSync(out),'One fresh packet; no retry');fs.mkdirSync(out,{recursive:true});
const read=p=>fs.readFileSync(path.join(root,p)),sha=b=>createHash('sha256').update(b).digest('hex'),hash=p=>sha(read(p));
const report={started:new Date().toISOString(),pid:process.pid,status:'running',hardStop:'2026-10-03T06:50:00Z',sourceHashes:{},views:[],errors:[],scope:'One independent artist-sheet arrangement over retained-native pose/images. No new Avatar/groom/WebGPU render, fit or builder.'};
const save=()=>fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2)+'\n');save();
function bind(p,pin,copy=false){const b=read(p),h=sha(b);if(pin)assert.equal(h,pin,p);report.sourceHashes[p]=h;if(copy){const dst=out+'/sources/'+p;fs.mkdirSync(path.dirname(dst),{recursive:true});fs.writeFileSync(dst,b);}return b;}
const deadline=s=>assert.ok(Date.now()<Date.parse(report.hardStop),'Expired at '+s),remaining=n=>Math.max(1,Math.min(n,Date.parse(report.hardStop)-Date.now()));
async function bounded(fn,label,cleanup=false){if(!cleanup)deadline(label);let timer;try{return await Promise.race([fn(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timeout')),cleanup?5000:remaining(45000));})]);}finally{clearTimeout(timer);}}
let server,browser,page,error;
try{
 deadline('entry');const target=JSON.parse(bind(targetFile,'f29520ec0819cd72b6cbfae4f894029ebf0b835f7376554e82cc641d68ccc3fe',true));assert.equal(target.status,'authored');
 for(const[p,h]of Object.entries(target.sourceHashes))bind(p,h,!p.endsWith('.glb')&&!p.startsWith('reference/')&&!p.endsWith('.png'));
 const native=JSON.parse(bind(nativeRoot+'/report.json','3a9d2349ae7fe0ea315eb2888c9ef3fec993396da3bc4d93fe951f9a6745cc0f',true));assert.equal(native.status,'captured');
 for(const p of ['tools/critic/capture-hair-guide-targets.mjs','tools/critic/hair-guide-target-replay.html','tools/critic/hair-guide-target-replay.mjs'])bind(p,null,true);
 for(const p of ['packages/core/src/render/MotionProbe.mjs','node_modules/three/src/objects/SkinnedMesh.js'])bind(p,native.sourceHashes[p],true);
 const views=native.views.map(v=>{assert.deepEqual(v.state.bones,native.setup.state.bones);assert.deepEqual(v.state.bodyMatrix,native.setup.state.bodyMatrix);assert.deepEqual(v.state.bindMatrix,native.setup.state.bindMatrix);assert.deepEqual(v.state.bindMatrixInverse,native.setup.state.bindMatrixInverse);assert.deepEqual(v.state.boneInverses,native.setup.state.boneInverses);assert.deepEqual(v.state.morphs,native.setup.state.morphs);assert.deepEqual(v.state.canvas,[900,868]);return{view:v.view,beauty:v.beauty,state:v.state,nativeURL:'/@fs'+root+'/'+nativeRoot+'/'+v.beauty.file};});
 const data={target,views};fs.writeFileSync(out+'/inputs.json',JSON.stringify(data)+'\n');report.prepared={file:'inputs.json',sha256:hash(rel+'/inputs.json')};save();
 server=await bounded(()=>startProbeServer({port:5297}),'server');report.baseUrl=server.baseUrl;assert.equal(new URL(server.baseUrl).port,'5297');browser=await bounded(()=>launchProbeBrowser(),'browser');page=await bounded(()=>browser.newPage({viewport:{width:900,height:868},deviceScaleFactor:1}),'page');page.setDefaultTimeout(remaining(45000));
 page.on('pageerror',e=>report.errors.push(e.stack??e.message));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 deadline('navigation');await page.goto(server.baseUrl+'/@fs'+root+'/tools/critic/hair-guide-target-replay.html?data='+encodeURIComponent('/@fs'+out+'/inputs.json'),{waitUntil:'networkidle',timeout:remaining(45000)});deadline('ready');await page.waitForFunction(()=>window.captureReady,null,{timeout:remaining(45000)});
 for(const[view,orientation]of [['front-full','A'],['front-full','B'],['front-bare','A'],['front-bare','B'],['left-bare','A'],['right-bare','B']]){
  const state=await bounded(()=>page.evaluate(o=>window.drawGuideTarget(o),{view,orientation}),'draw-'+view+orientation);assert.equal(state.triangles,192);assert.equal(state.avatarRuns,0);assert.equal(state.replay,true);assert.equal(state.unoccluded,true);
  for(const g of state.projected)for(const p of [...g.records.flatMap(r=>[r.centre,r.minus,r.plus]),...g.controls,...g.centreline])assert.ok(p.ndc[2]>=0&&p.ndc[2]<=1&&p.pixel[0]>=0&&p.pixel[0]<=900&&p.pixel[1]>=0&&p.pixel[1]<=868,'Target annotation outside native frame');
  const response=await page.request.get(state.nativeURL,{timeout:remaining(10000)});assert.equal(response.status(),200);assert.equal(sha(await response.body()),state.nativeInput.sha256);
  const file=view+'-'+orientation+'.png';await bounded(()=>page.screenshot({path:out+'/'+file}),'screenshot-'+view+orientation);
  report.views.push({...state,file,sha256:hash(rel+'/'+file)});save();
 }
 assert.deepEqual(report.errors,[]);deadline('observed');report.status='observed';
}catch(e){error=e;report.status='failed';report.errors.push(e.stack??String(e));}
finally{
 report.cleanup={};for(const[name,resource]of [['page',page],['browser',browser],['server',server]]){if(!resource){report.cleanup[name]='not-created';continue;}try{await bounded(()=>resource.close(),name+' cleanup',true);report.cleanup[name]='closed';}catch(e){report.cleanup[name]={error:e.message};report.errors.push(name+' cleanup: '+e.message);error??=e;}}
 try{for(const[p,h]of Object.entries(report.sourceHashes))assert.equal(hash(p),h,p);if(report.prepared)assert.equal(hash(rel+'/inputs.json'),report.prepared.sha256);deadline('final receipt');report.finalPinsUnchanged=true;}catch(e){report.errors.push(e.message);error??=e;}
 if(report.errors.length){report.status='failed';error??=Error('Late observer/cleanup failure');}report.borrowedReviewServerRetained=true;report.finished=new Date().toISOString();save();console.log(JSON.stringify({out,pid:process.pid,status:report.status,views:report.views.length,cleanup:report.cleanup,reportSHA256:hash(rel+'/report.json')}));
}
if(error)throw error;
