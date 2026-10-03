/** One root-owned retained-position replay; preserve September30 compute evidence. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {startProbeServer,launchProbeBrowser} from '../../packages/core/src/render/MotionProbe.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),rel='captures/full-body-coverage-2026-10-02-v1',out=path.join(root,rel);
assert.ok(!fs.existsSync(out),'One fresh packet; no retry/overwrite');fs.mkdirSync(out,{recursive:true});
const old='captures/skeleton-full-influences-gpu-2026-09-30-v2',read=p=>fs.readFileSync(path.join(root,p));
const sha=b=>createHash('sha256').update(b).digest('hex'),hash=p=>sha(read(p));
const report={started:new Date().toISOString(),pid:process.pid,status:'running',inputs:{},views:[],artifacts:[],errors:[],
 scope:'Supplementary static complete-body replay of retained1-coupled native/GPU positions. No compute, kernel, geometry/pose tuning or production integration.',
 hardStop:'2026-10-03T06:16:00.000Z',computeRuns:0,borrowedReviewServerRetained:true};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
function bind(p,pin,copy=false){const b=read(p),h=sha(b);if(pin)assert.equal(h,pin,p);report.inputs[p]=h;if(copy){const d=path.join(out,'sources',p);fs.mkdirSync(path.dirname(d),{recursive:true});fs.writeFileSync(d,b);}return b;}
function archive(file,value){const b=gzipSync(Buffer.from(JSON.stringify(value)+'\n'));fs.writeFileSync(path.join(out,file),b);const a={file,sha256:sha(b),decodedSHA256:sha(gunzipSync(b)),bytes:b.length};report.artifacts.push(a);return a;}
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>a.map(v=>v/Math.hypot(...a));
const deadline=stage=>assert.ok(Date.now()<Date.parse(report.hardStop),'Expired slice at '+stage);
const remaining=cap=>Math.max(1,Math.min(cap,Date.parse(report.hardStop)-Date.now()));
async function bounded(fn,label,cap=45000,cleanup=false){
 if(!cleanup)deadline(label);let timer;
 try{return await Promise.race([fn(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' timed out')),cleanup?cap:remaining(cap));})]);}
 finally{clearTimeout(timer);}
}
let server,browser,page,primaryError;
try{
 deadline('entry');
 const previous=JSON.parse(bind(old+'/report.json','0b272c6531241d18992d8e99c90bc723654c233cf110aa832042e4d3133a478d',true));
 assert.equal(previous.status,'observed');assert.equal(previous.passed,true);
 const prepared=JSON.parse(bind(old+'/inputs.json','7b6880c44fe4ccbcd3453c00ad1f00cc86a6ccb9a9e9ce732826983896488cea'));
 const row=previous.cases.find(c=>c.name==='1-coupled'),source=prepared.cases.find(c=>c.name==='1-coupled');
 assert.ok(row?.passed&&row.interpretable&&!row.negative);assert.equal(source.weight,1);assert.equal(source.pose,'coupled');
 const compressed=bind(old+'/1-coupled.json.gz','02e39dde2756da96a416bc5cc5963781571174fcdf89627971164ec4229ca71a');
 assert.equal(row.artifact.sha256,sha(compressed));const decoded=gunzipSync(compressed);
 assert.equal(sha(decoded),'7c84a5b1703ba406ca2ac524dbb0982dcefebf202f86897d7cf1258f367aee13');assert.equal(row.artifact.decodedSHA256,sha(decoded));
 const retained=JSON.parse(decoded);assert.equal(retained.observed.name,source.name);assert.equal(retained.observed.backend,'webgpu');assert.deepEqual(retained.observed.errors,[]);
 assert.equal(prepared.vertexCount,14517);assert.equal(prepared.indices.length,26756*3);
 assert.ok(prepared.indices.every(i=>Number.isInteger(i)&&i>=0&&i<14517));
 const native=Array.from(new Float32Array(source.expected)),gpu=retained.observed.positions;
 assert.equal(native.length,14517*3);assert.equal(gpu.length,native.length);
 assert.ok(native.every(Number.isFinite));assert.ok(gpu.every(v=>Number.isFinite(v)&&Math.fround(v)===v));
 report.retained={case:source.name,bodyTarget:1,pose:'coupled',vertices:14517,triangles:26756,previousGPUObservedUTC:previous.finished,
  previousAdapter:retained.observed.adapter,decodedSHA256:sha(decoded),nativeFloat32Sha256:sha(Buffer.from(new Float32Array(native).buffer)),gpuFloat32Sha256:sha(Buffer.from(new Float32Array(gpu).buffer)),
  previousVersusNative:row.versusNative,note:'Previous comparison metadata, not a new compute result.'};
 for(const p of ['tools/critic/eight-influence-gpu.mjs','tools/critic/capture-eight-influence-gpu.mjs','tools/critic/eight-influence-gpu.html','packages/core/src/render/MotionProbe.mjs','vite.config.js','package-lock.json','node_modules/three/package.json','node_modules/three/build/three.webgpu.js','node_modules/three/build/three.tsl.js','node_modules/three/build/three.core.js','node_modules/three/build/three.module.js']){assert.match(previous.inputs[p],/^[a-f0-9]{64}$/,'Required historical source pin '+p);bind(p,previous.inputs[p],!p.startsWith('node_modules/'));}
 for(const arm of ['native','gpu']){const p=old+'/body-1-context-'+arm+'.png';bind(p,previous.views.find(v=>v.file===path.basename(p)).sha256);}
 for(const p of ['tools/critic/capture-full-body-coverage.mjs','tools/critic/full-body-coverage.mjs','tools/critic/full-body-coverage.html','docs/evidence/appearance-2026-10-02/full-body-coverage/PLAN.md','docs/evidence/appearance-2026-10-02/NEXT-SLICE-VALUE-CRITIQUE.md','node_modules/three/src/cameras/OrthographicCamera.js','node_modules/three/src/renderers/common/Renderer.js'])bind(p,null,true);
 const z=unit([-2.4,.56,4]),x=unit(cross([0,1,0],z)),y=cross(z,x),basis=[x,y,z],bounds=basis.map(()=>[Infinity,-Infinity]);
 for(let i=0;i<14517;i++)for(let a=0;a<3;a++){const v=dot(native.slice(i*3,i*3+3),basis[a]);bounds[a][0]=Math.min(bounds[a][0],v);bounds[a][1]=Math.max(bounds[a][1],v);}
 const mid=bounds.map(b=>(b[0]+b[1])/2),target=[0,1,2].map(c=>basis.reduce((s,a,i)=>s+a[c]*mid[i],0)),aspect=1.2;
 const camera={basis,bounds,target,position:target.map((v,i)=>v+5*z[i]),halfSpan:Math.max((bounds[1][1]-bounds[1][0])/2,(bounds[0][1]-bounds[0][0])/(2*aspect))/.70,aspect,near:.01,far:20,distance:5,derivedFrom:'native-float32-only'};
 assert.ok(camera.halfSpan>0&&[...camera.position,...camera.target,camera.halfSpan].every(Number.isFinite));
 const data={vertexCount:14517,indices:prepared.indices,native,gpu,camera};
 fs.writeFileSync(path.join(out,'inputs.json'),JSON.stringify(data)+'\n');report.prepared={file:'inputs.json',sha256:hash(rel+'/inputs.json'),archive:archive('inputs.json.gz',data)};report.cameraDerivation=camera;save();
 deadline('server start');server=await startProbeServer({port:5301});report.baseUrl=server.baseUrl;assert.equal(new URL(server.baseUrl).port,'5301','Unexpected probe port');
 deadline('browser start');browser=await launchProbeBrowser();deadline('page start');page=await browser.newPage({viewport:{width:1200,height:1000},deviceScaleFactor:1});page.setDefaultTimeout(remaining(45000));
 page.on('pageerror',e=>report.errors.push(e.stack??e.message));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});page.on('console',m=>{if(m.type()==='error')report.errors.push(`${m.text()} ${JSON.stringify(m.location())}`);});
 deadline('navigation');await page.goto(`${server.baseUrl}/@fs${root}tools/critic/full-body-coverage.html?data=${encodeURIComponent('/@fs'+out+'/inputs.json')}`,{waitUntil:'networkidle',timeout:remaining(45000)});deadline('ready');await page.waitForFunction(()=>window.captureReady,null,{timeout:remaining(45000)});
 for(const arm of ['native','gpu']){
  const state=await bounded(()=>page.evaluate(a=>window.drawCoverage(a),arm),'draw-'+arm);assert.equal(state.arm,arm);assert.equal(state.projections.length,14517);assert.equal(state.common.computeRuns,0);assert.equal(state.common.replay,true);
  assert.ok(state.labelRect.bottom<=94&&state.labelRect.x+state.labelRect.width<=1200,'Label must not overlap body or clip');
  const extrema=[[Infinity,-Infinity],[Infinity,-Infinity],[Infinity,-Infinity]];
  for(const p of state.projections){assert.ok(p.every(Number.isFinite));for(let a=0;a<3;a++){extrema[a][0]=Math.min(extrema[a][0],p[a]);extrema[a][1]=Math.max(extrema[a][1],p[a]);}assert.ok(p[0]>=180-.001&&p[0]<=1020+.001&&p[1]>=150-.001&&p[1]<=850+.001&&p[2]>=0&&p[2]<=1,'Complete geometry/WebGPU frustum coverage');}
  const projections=archive(arm+'-projections.json.gz',state.projections);delete state.projections;
  const file='body-complete-'+arm+'.png';await bounded(()=>page.screenshot({path:path.join(out,file)}),'screenshot-'+arm);
  report.views.push({...state,file,sha256:hash(rel+'/'+file),extrema,projections});save();
 }
 assert.deepEqual(report.views[0].common,report.views[1].common,'Shared camera/render state');assert.deepEqual(report.views[1].uploaded,{stride:4,vertices:14517,exactFloat32XYZAndW:true});
 assert.deepEqual(report.errors,[]);deadline('observation complete');report.status='observed';
}catch(e){primaryError=e;report.status='failed';report.errors.push(e.stack??String(e));}
finally{
 report.cleanup={};
 if(page)try{report.cleanup.gpu=await bounded(()=>page.evaluate(()=>window.disposeProbe?.()),'GPU cleanup',5000,true);assert.equal(report.cleanup.gpu?.disposed,true);assert.deepEqual(report.cleanup.gpu.errors,[]);}catch(e){report.errors.push('GPU cleanup: '+e.message);primaryError??=e;}
 for(const[name,resource]of [['page',page],['browser',browser],['server',server]]){if(!resource){report.cleanup[name]='not-created';continue;}try{await bounded(()=>resource.close(),name+' cleanup',5000,true);report.cleanup[name]='closed';}catch(e){report.cleanup[name]={error:e.message};report.errors.push(`${name} cleanup: ${e.message}`);primaryError??=e;}}
 try{for(const[p,h]of Object.entries(report.inputs))assert.equal(hash(p),h,p);if(report.prepared)assert.equal(hash(rel+'/'+report.prepared.file),report.prepared.sha256);report.finalInputHashesUnchanged=true;}catch(e){report.errors.push('Final source check: '+e.message);primaryError??=e;}
 try{deadline('final receipt');}catch(e){report.errors.push(e.message);primaryError??=e;}
 if(report.errors.length){report.status='failed';primaryError??=new Error('Late observer/cleanup failure');}
 report.finished=new Date().toISOString();save();console.log(JSON.stringify({out,pid:process.pid,status:report.status,views:report.views.length,cleanup:report.cleanup,reportSha256:hash(rel+'/report.json')}));
}
if(primaryError)throw primaryError;
