/** Real Chrome/WebGPU regression gate. node packages/core/src/render/CardRenderHistory.gpu.selftest.mjs --out=/tmp/new-directory */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {startProbeServer,launchProbeBrowser} from './MotionProbe.mjs';
import {decodePng} from '../../../../tools/critic/png.mjs';
const ROOT=fileURLToPath(new URL('../../../../',import.meta.url));
const OUT=process.argv.find(x=>x.startsWith('--out='))?.slice(6) || path.join(os.tmpdir(),'sugata-card-history-'+Date.now());
assert.ok(!fs.existsSync(OUT),'preserve previous proof directory');fs.mkdirSync(OUT);
const sha=x=>createHash('sha256').update(x).digest('hex');
const sources=()=>Object.fromEntries(['Avatar.js','motion/HairDynamics.js',...['Stage','TRAAPost','CardRenderHistory','RenderParticipants','StageScenePass'].map(n=>'render/'+n+'.js')].map(x=>[x,sha(fs.readFileSync(ROOT+'/packages/core/src/'+x))]));
const report={sources:sources(),groomSha256:sha(fs.readFileSync(ROOT+'/assets/hair/bob01/g050.glb')),errors:[],served:{},scope:'Independent actual callback-failure/cache/reset challenge. No shader, geometry, solver, clock, FRAME cache, or threshold monkeypatch. Only a temporary unrelated body callback throws to test failure handling.'};
const responseWork=[];let server,browser,page;
try {
 server=await startProbeServer({port:5323});browser=await launchProbeBrowser();page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
 page.on('response',r=>{if(/(?:Avatar|CardRenderHistory|RenderParticipants|StageScenePass|HairDynamics|TRAAPost|Stage)\.js(?:\?|$)/.test(r.url()))responseWork.push((async()=>{const data=await r.body();report.served[r.url().replace(server.baseUrl,'')]=sha(data)})().catch(e=>report.errors.push('source response: '+e.message)))});
 await page.goto(server.baseUrl+'/src/showcase.html?preset=elegant&frame=portrait&capture=',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.showcase||!document.querySelector('#error').hidden,null,{timeout:120000});
 assert.equal(await page.locator('#error').textContent(),'');
 report.result=await page.evaluate(async()=>{
  const a=showcase.avatar,h=a.hairHistory,s=a.stage,r=s.renderer,c=s.camera,rows=[],frameWaits=[];window.__continuityChallenge={rows,frameWaits};
  const equal=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
  const require=(ok,message)=>{if(!ok)throw Error(message)};
  const fresh=async(delta=null)=>{const start=r._nodes.nodeFrame.frameId,seen=[];for(let i=0;i<5;i++){await new Promise(requestAnimationFrame);seen.push(r._nodes.nodeFrame.frameId);if(seen.at(-1)>start)break;}frameWaits.push({start,seen});require(seen.at(-1)>start,'Three native frameId did not advance over 5 rAF callbacks');if(delta===null)s.draw();else a.update(delta)};
  const capture=()=>({target:r.getRenderTarget(),mrt:r.getMRT(),toneMapping:r.toneMapping,outputColorSpace:r.outputColorSpace,xr:r.xr.enabled,
    autoClear:r.autoClear,transparent:r.transparent,opaque:r.opaque,contextNode:r.contextNode,override:s.scene.overrideMaterial,sceneName:s.scene.name,publicRenderFunction:r.getRenderObjectFunction(),clearColor:r._clearColor.toArray(),clearAlpha:r.getClearAlpha(),exposure:r.toneMappingExposure,pixelRatio:r.getPixelRatio(),scissorTest:r.getScissorTest(),background:s.scene.background,backgroundNode:s.scene.backgroundNode,
    layerMask:c.layers.mask,view:c.view?{...c.view}:null,projection:c.projectionMatrix.toArray(),inverse:c.projectionMatrixInverse.toArray(),
    callDepth:r._callDepth,renderContext:r._currentRenderContext,objectFunction:r._currentRenderObjectFunction,handleFunction:r._handleObjectFunction,renderId:r._nodes.nodeFrame.renderId,
    lightStack:[...r.lighting._cache],sceneLights:r.lighting.getNode(s.scene).getLights(),defaultLights:r.lighting.getNode({}).getLights()});
  const compare=(x,y)=>{const differences=[];for(const key of Object.keys(x)){
    const same=['view','projection','inverse','clearColor'].includes(key)?equal(x[key],y[key]):key==='lightStack'?x[key].length===y[key].length&&x[key].every((v,i)=>v===y[key][i]):x[key]===y[key];
    if(!same)differences.push(key);}return differences};
  require(a.autoStart===false,'capture Avatar must have manual clock');
  await fresh(0);await fresh(0);
  const prior=await h.readPrevious();
  await new Promise(requestAnimationFrame);
  a.update(0);
  const before=h.report(),steps=a.hairDynamics.stepsTaken;
  a.advanceFrame(1/60);c.position.x+=.002;c.updateMatrixWorld(true);
  // Intentionally NO await between the fresh scene, unrendered source/camera advance and PNG draw.
  const savePromise=showcase.saveImage();
  const after=h.report(),afterSteps=a.hairDynamics.stepsTaken;
  require(before.commits===after.commits,'cached PNG advanced history commits');
  require(equal(before.lastDraw,after.lastDraw),'cached PNG advanced MVP/source receipt');
  require(afterSteps>steps,'unrendered solver advance was not exercised');
  const saved=await savePromise;require(saved,'same-task cached PNG failed');
  const actual=await h.readPrevious();require(prior.length===actual.length&&prior.every((v,i)=>Object.is(v,actual[i])),'cached PNG overwrote previous GPU snapshot');
  rows.push({case:'fresh→unrendered solver/camera advance→same-task PNG',saved,before,after,steps,afterSteps,snapshotComponentsEqual:prior.length,status:document.querySelector('#status').textContent});
  await fresh();
  const resumed=h.report();require(equal(resumed.lastDraw.previousMVP,before.lastDraw.currentMVP),'next fresh draw lost last accepted camera MVP');
  rows.push({case:'next fresh after cached source advance',history:resumed});
  // Make the reset/cached sequence a single JS task too.
  await new Promise(requestAnimationFrame);s.draw();
  const resetBefore=h.report();s.temporal.resetFrameEpoch();s.draw();
  const resetCache=h.report();require(resetCache.commits===resetBefore.commits&&!resetCache.valid,'direct temporal reset cached draw was not invalidated without copy');
  await fresh();const resetFresh=h.report();require(resetFresh.lastDraw.mode==='seeding','direct reset did not reseed on fresh scene');
  rows.push({case:'direct temporal reset→cached→fresh',resetBefore,resetCache,resetFresh});
  s.setViewMode('velocity');await fresh();require(h.report().mode==='hold','debug view must hold');
  s.setViewMode('beauty');await fresh();s.setTemporalAA('off');await fresh();require(h.report().mode==='hold','temporal off must hold');
  s.setTemporalAA('taau');await fresh();await fresh();await fresh();require(h.report().mode==='exact','temporal reactivation must reseed then become exact');
  rows.push({case:'debug and temporal off/on recovery',history:h.report()});
  for(const secondary of [false,true]){
   const camera=secondary?s.camera.clone():s.camera;camera.updateMatrixWorld(true);
   r.render(s.scene,camera);await r.backend.device.queue.onSubmittedWorkDone();const direct=h.report();
   require(!direct.valid&&direct.mode==='hold','direct render did not invalidate');
   await fresh();require(h.report().lastDraw.mode==='seeding','fresh after direct render did not reseed');
   rows.push({case:secondary?'alternate-camera direct render':'primary-camera direct render',direct,after:h.report()});
  }
  // Force an actual failure inside native renderer.render, not an owner begin validation error.
  const body=a.figure.body,original=body.onBeforeRender;let bodyCallbacks=0,thrown=null;const bodyCallbackInfo=[];
  await new Promise(requestAnimationFrame);
  const entry=capture(),beforeFailure=h.report();
  body.onBeforeRender=function(...args){original.apply(this,args);bodyCallbacks++;bodyCallbackInfo.push({primaryCamera:args[2]===c,cameraType:args[2]?.type,sceneOverride:args[1]?.overrideMaterial?.type,target:r.getRenderTarget()?.texture?.name});throw Error('continuity injected body draw failure')};
  try{s.draw()}catch(e){thrown=e.message}finally{body.onBeforeRender=original}
  require(bodyCallbacks>0&&thrown?.includes('continuity injected body draw failure'),'actual native body callback failure was not reached');
  const exit=capture(),differences=compare(entry,exit),failed=h.report();window.__continuityChallenge.failureState={bodyCallbackInfo,differences,before:{publicRenderFunction:entry.publicRenderFunction?.name??null,shadowType:entry.publicRenderFunction?.shadowType??null,clearColor:entry.clearColor,clearAlpha:entry.clearAlpha,background:entry.background?.type??null},after:{publicRenderFunction:exit.publicRenderFunction?.name??null,shadowType:exit.publicRenderFunction?.shadowType??null,useVelocity:exit.publicRenderFunction?.useVelocity??null,clearColor:exit.clearColor,clearAlpha:exit.clearAlpha,background:exit.background?.type??null}};
  require(differences.length===0,'failure left renderer/camera state: '+differences.join(','));
  require(!failed.valid&&failed.commits===beforeFailure.commits,'failed image committed card history');
  let cachedFailure=null;try{s.draw()}catch(e){cachedFailure=e.message}
  require(cachedFailure?.includes('fresh scene'),'partial-frame cached retry was not explicitly refused');
  rows.push({case:'native body callback throw',bodyCallbacks,thrown,differences,beforeFailure,failed,cachedFailure,lightingDepth:r.lighting._cache.length});
  await fresh();const recovered=h.report();require(recovered.lastDraw.mode==='seeding'&&!s.renderParticipants.failedImage,'next genuinely fresh scene did not recover');
  await r.backend.device.queue.onSubmittedWorkDone();
  const buffer=await h.readPrevious();require(buffer.every(Number.isFinite),'recovered history has nonfinite elements');
  const recoverSave=showcase.saveImage();const recoveryReport=h.report();require(await recoverSave,'post-recovery PNG failed');
  rows.push({case:'next-fresh recovery',history:recovered,recoveryReport,finiteComponents:buffer.length});
  return {rows,frameWaits,clock:a.clockSeconds,steps:a.hairDynamics.stepsTaken,owner:h.report()};
 });
 await page.locator('#stage').screenshot({path:OUT+'/recovered.png'});
 const png=decodePng(fs.readFileSync(OUT+'/recovered.png'));let lo=1,hi=0;for(let i=0;i<png.pixels.length;i+=4){lo=Math.min(lo,png.pixels[i]);hi=Math.max(hi,png.pixels[i])}
 report.image={width:png.width,height:png.height,redRange:hi-lo};assert.ok(hi-lo>.1,'recovered image is blank');
 await Promise.all(responseWork);assert.deepEqual(report.errors,[]);assert.deepEqual(sources(),report.sources);
 report.completed=true;
} catch(e) {report.failure=e.stack;process.exitCode=1}
finally {if(page)try{report.disposal=await page.evaluate(()=>{const a=showcase?.avatar;if(!a)return null;window.__continuityChallenge??={};const h=a.hairHistory;let error=null;try{a.dispose()}catch(e){error=e.message}return{error,owner:h?.report(),stage:a.stage,disposed:a.disposed,partial:window.__continuityChallenge}})}catch(e){report.disposalError=e.message}
 await browser?.close();await server?.close();fs.writeFileSync(OUT+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({completed:report.completed,failure:report.failure,errors:report.errors,cases:report.result?.rows.map(x=>x.case),image:report.image,disposal:report.disposal},null,2));}
