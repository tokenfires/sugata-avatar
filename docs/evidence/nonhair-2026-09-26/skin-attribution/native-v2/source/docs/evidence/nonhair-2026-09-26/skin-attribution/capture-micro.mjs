// CPU freeze/preflight; --capture is the only native browser/GPU entry point.
// The original showcase startup, public zero-dt stepping, and Save image action remain intact.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {assertExposureOwners} from './micro-capture-runtime.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url)), ROOT=path.resolve(HERE,'../../../..');
const sha=b=>createHash('sha256').update(b).digest('hex'), hash=p=>sha(fs.readFileSync(p));
const json=x=>JSON.stringify(x,null,2)+'\n', rel=p=>path.relative(ROOT,p);
const KIND='isolated-body-micro-normal-aba-v1';
const CASES=[{label:'default-a',microNormalScale:.25},{label:'micro-off',microNormalScale:0},{label:'default-a2',microNormalScale:.25}].map(c=>({...c,preset:'elegant',outfit:'elegant',style:'ecru',hair:'bob01'}));
const ACCEPTED={
 'assets/wardrobe/body/g050.glb':'fc4445c95ed3f423734ff272ee78ebb44d762a8f16edb94b26039de7a8a96b3a',
 'assets/wardrobe/female_casualsuit01/g050.glb':'44ebc3eb3a09408a3563d369ae74be15a5bc4beb8040bc43c2c5446d6e65c783',
 'assets/wardrobe/female_elegantsuit01/g050.glb':'0acd22bbf9a847de6fa051bec0860157b72ba626f9504a26f8313713938f1440',
 'assets/wardrobe/foundation_bra/g050.glb':'4a3366377087bbfb2d5779ba4d6f5de09735e1810ae4ea9b6a22e11d3aee0d79',
 'assets/wardrobe/foundation_briefs/g050.glb':'53f81630df24817f89bd7f8b59d58977b180855adc54d7f439f54a23f2757747',
 'assets/wardrobe/shoes01/g050.glb':'28e15257130da9eabf790b5dda55e96c985b3504e5905fa9b230195b2f27fde4',
 'assets/hair/bob01/g050.glb':'d425444f3d478c63e4842f7a789aa89ac1968c7d13b5aac87ca6717700df56e7',
 'assets/hair/bob02/g050.glb':'a666a80777f0b93a824857dc2e2cbffe27cd2c8991a3f4ec8215ebc1d94298bd'
};
const protocol={viewport:{width:1100,height:1000},deviceScaleFactor:1,settleDraws:64,deltaSeconds:0,
 scene:'kitchen',light:'studio',frame:'body',seed:20260807,baseFrame:1000000,captureDraws:65,cases:CASES};
const scope='Diagnostic only: three fresh Kitchen/elegant/Ecru/body native pages, current body micro-normal0.25 versus0 versus fresh0.25, under the same explicit capture clock/history policy. Not a proposed default, production cadence guarantee, face-G4/material quality approval or hair comparison.';
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
 const p=path.join(dir,e.name);assert.equal(e.isSymbolicLink(),false,'Source symlink requires explicit binding: '+p);return e.isDirectory()?walk(p):e.isFile()?[p]:[];
});}
function sourceFiles(){return [...new Set([
 ...['packages/core/src','packages/testbed/src','assets','node_modules/three/src','node_modules/three/build','node_modules/three/examples/jsm','node_modules/vite/dist'].flatMap(p=>walk(path.join(ROOT,p))),
 ...['package.json','package-lock.json','vite.config.js','tools/critic/png.mjs','node_modules/three/package.json','node_modules/vite/package.json'].map(p=>path.join(ROOT,p)),
 ...['capture-micro.mjs','micro-capture-runtime.mjs','micro-capture-runtime.selftest.mjs','rejected-native-v1/exposure-owner-fixture.json'].map(p=>path.join(HERE,p)),path.join(ROOT,'tools/figure-pipeline/collar_capture_browser.mjs')])].sort();}
const versions=()=>({node:process.version,three:JSON.parse(fs.readFileSync(path.join(ROOT,'node_modules/three/package.json'))).version,vite:JSON.parse(fs.readFileSync(path.join(ROOT,'node_modules/vite/package.json'))).version});
function makeManifest(){return {version:1,kind:KIND,createdAt:new Date().toISOString(),scope,protocol,accepted:ACCEPTED,
 revision:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),versions:versions(),
 sources:Object.fromEntries(sourceFiles().map(p=>[rel(p),hash(p)]))};}
function verify(m){assert.equal(m.version,1);assert.equal(m.kind,KIND);assert.deepEqual(m.protocol,protocol);assert.deepEqual(m.accepted,ACCEPTED);assert.deepEqual(m.versions,versions());
 assert.deepEqual(Object.keys(m.sources),sourceFiles().map(rel));
 for(const [f,h]of Object.entries(m.sources))assert.equal(hash(path.join(ROOT,f)),h,'Source changed: '+f);
 for(const [f,h]of Object.entries(ACCEPTED))assert.equal(m.sources[f],h,'Accepted asset changed: '+f);
}
async function bounded(p,label,ms=30000){let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),ms);})]);}finally{clearTimeout(timer);}}
function finite(value,label){if(typeof value==='number')assert.ok(Number.isFinite(value),'Nonfinite '+label);else if(Array.isArray(value))value.forEach((x,i)=>finite(x,label+'.'+i));else if(value&&typeof value==='object')for(const[k,v]of Object.entries(value))finite(v,label+'.'+k);}
function validState(s){finite(s,'state');assert.equal(s.clock,0);assert.ok(s.canvas.width>0&&s.canvas.height>0);assert.ok(s.rig.length>0);assert.equal(s.meshes.length,5);
 for(const m of s.meshes){assert.equal(m.positions.length%3,0);assert.equal(m.fullIndices.length%3,0);assert.equal(m.drawnIndices.length%3,0);assert.ok(m.positions.length>0&&m.fullIndices.length>0);
  const r=m.drawRange;assert.ok(Number.isInteger(r.start)&&r.start>=0&&Number.isInteger(r.indexCount)&&r.indexCount>=0&&r.start<=r.indexCount);
  assert.ok(r.count==='Infinity'||Number.isInteger(r.count)&&r.count>=0);
  const expectedDrawn=Math.max(0,Math.min(r.indexCount,r.start+(r.count==='Infinity'?Infinity:r.count))-r.start);
  assert.equal(m.drawnIndices.length,expectedDrawn,'Exact native drawn subset, including legitimately fully masked foundations');
  for(const i of [...m.fullIndices,...m.drawnIndices])assert.ok(Number.isInteger(i)&&i>=0&&i<m.positions.length/3,'Invalid index '+m.id);
 }
}
// Read actual currently skinned body/worn state; CPU vertex readback, not GPU output geometry.
// No separate Three import, native layer wrapper, render callback or clock replacement.
async function readNativeState(page){return await page.evaluate(async()=>{
 const a=showcase.avatar,c=a.stage.camera,w=a.wardrobe;
 a.figure.root.updateMatrixWorld(true);
 const meshes=[['body',a.figure.body],...w.wornMeshes].sort(([x],[y])=>x.localeCompare(y)).map(([id,m])=>{
  m.updateMatrixWorld(true);m.skeleton?.update();const v=m.position.clone(),p=new Float32Array(m.geometry.attributes.position.count*3);
  for(let i=0;i<p.length/3;i++)m.getVertexPosition(i,v).applyMatrix4(m.matrixWorld).toArray(p,i*3);
  const range=m.geometry.drawRange,end=Math.min(m.geometry.index.count,range.start+range.count);
  const full=id==='body'?w.fullIndex:w.fragments.get(id).fullIndex;
  return {id,positions:Array.from(p),fullIndices:Array.from(full),drawnIndices:Array.from(m.geometry.index.array.slice(range.start,end)),
   drawRange:{start:range.start,count:Number.isFinite(range.count)?range.count:'Infinity',indexCount:m.geometry.index.count},
   matrixWorld:m.matrixWorld.toArray(),boneMatrices:Array.from(m.skeleton?.boneMatrices??[]),
   morphs:Object.fromEntries(Object.entries(m.morphTargetDictionary??{}).map(([name,i])=>[name,m.morphTargetInfluences[i]]))};
 });
 const centres=await a.hairDynamics.readCentrelines(),vertices=await a.hairDynamics.readVertices();
 const digest=async array=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',array.buffer.slice(array.byteOffset,array.byteOffset+array.byteLength)))).map(v=>v.toString(16).padStart(2,'0')).join('');
 const hair={positions:await digest(centres.positions),velocities:await digest(centres.velocities),vertices:await digest(vertices.positions),head:await digest(Float64Array.from(centres.headMatrix)),solverSteps:centres.steps};
 return {hair,clock:a.clockSeconds,canvas:{width:a.stage.canvas.width,height:a.stage.canvas.height},
  camera:{position:c.position.toArray(),quaternion:c.quaternion.toArray(),world:c.matrixWorld.toArray(),view:c.matrixWorldInverse.toArray(),projection:c.projectionMatrix.toArray(),target:showcase.controls.target.toArray(),focus:a.focus.toArray()},
  rig:a.figure.body.skeleton.bones.map(b=>({name:b.name,position:b.position.toArray(),quaternion:b.quaternion.toArray(),scale:b.scale.toArray(),matrixWorld:b.matrixWorld.toArray()})),
  face:a.figure.meshes.map(m=>({name:m.name,morphs:Object.fromEntries(Object.entries(m.morphTargetDictionary??{}).map(([name,i])=>[name,m.morphTargetInfluences[i]]))})),meshes};
 });}
const [mode,manifestPath,output]=process.argv.slice(2);
if(mode==='--write-manifest'){
 assert.equal(process.argv.length,4,'capture-micro.mjs --write-manifest fresh-manifest.json');
 const m=makeManifest();verify(m);fs.writeFileSync(manifestPath,json(m),{flag:'wx'});console.log(json({manifest:manifestPath,sha256:hash(manifestPath),files:Object.keys(m.sources).length}));process.exit(0);
}
assert.ok(['--preflight','--capture'].includes(mode),'capture-micro.mjs --preflight|--capture manifest.json fresh-output-directory');assert.equal(process.argv.length,5);
const manifestBytes=fs.readFileSync(manifestPath),manifest=JSON.parse(manifestBytes);verify(manifest);
const out=path.resolve(output);assert.equal(fs.existsSync(out),false,'Fresh output directory required.');fs.mkdirSync(out,{recursive:true});
const write=(name,value)=>{const dest=path.join(out,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,Buffer.isBuffer(value)||typeof value==='string'?value:json(value),{flag:'wx'});};
write('manifest.json',manifestBytes);
const report={version:1,kind:KIND,scope,protocol,completed:false,createdAt:new Date().toISOString(),manifestSHA256:sha(manifestBytes),sourceHashes:manifest.sources,cases:[],responses:[],errors:[],warnings:[],sourcesStable:false};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),json(report));
if(mode==='--preflight'){report.preflightOnly=true;report.sourcesStable=true;report.completed=true;save();console.log(json({preflight:true,files:Object.keys(manifest.sources).length,protocol}));process.exit(0);}
// Only this explicit entry starts a native renderer. Root owns execution and the GPU slot.
const {startProbeServer,launchProbeBrowser}=await import('../../../../packages/core/src/render/MotionProbe.mjs');
const {decodePng}=await import('../../../../tools/critic/png.mjs');
let server,browser,context,page,currentCase;const reads=[],baselines=new Map(),served=new Set();
const assetFile=url=>{const u=new URL(url);if(u.searchParams.has('import')||u.searchParams.has('url'))return null;const p=decodeURIComponent(u.pathname),i=p.indexOf('/assets/');return i<0?null:p.slice(i+1);};
async function drain(){await bounded(Promise.all(reads),'Response readback');assert.deepEqual(report.errors,[]);}
async function retire(){if(!page||page.isClosed())return;
 const receipt=await bounded(page.evaluate(()=>{
  if(window.__microRetirement)return window.__microRetirement;
  const a=window.showcase?.avatar,renderer=a?.stage.renderer;let instrument=null,instrumentError=null;
  try{if(window.__skinCapture)instrument=window.__skinCapture.releaseForRetirement();}catch(e){instrumentError=String(e);}
  // Exercises the already installed page handler, including attention/controls/RAF ownership.
  // Explicit handler invocation is not a claim of actual bfcache admission or page navigation.
  if(window.__microGPU)window.__microGPU.retiring=true;
  dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));
  return window.__microRetirement=a ? {instrument,instrumentError,gpu:window.__microGPU??null,disposed:a.disposed,leaks:a.leakedHandles(),memory:structuredClone(renderer.info.memory),handlerFixture:'nonpersisted pagehide'} :
   {noPublishedOwner:true,loadError:document.querySelector('#error')?.textContent,handlerFixture:'nonpersisted pagehide; unpublished owner teardown not observed'};
 }),'Page retirement');
 if(currentCase)currentCase.retirement=receipt;else report.unassignedRetirement=receipt;
 if(!receipt.noPublishedOwner){if(receipt.gpu){assert.deepEqual(receipt.gpu.errors,[]);assert.ok(receipt.gpu.losses.every(x=>x.retiring&&x.reason==='destroyed'));}assert.equal(receipt.instrumentError,null);if(receipt.instrument){assert.equal(receipt.instrument.drawRestored,true);assert.equal(receipt.instrument.uniformRestored,true);}assert.equal(receipt.disposed,true);assert.deepEqual(receipt.leaks,[]);assert.ok(Object.values(receipt.memory).every(v=>v===0));}
 await drain();await context.close();context=null;page=null;
}
try{
 for(const file of Object.keys(manifest.sources).filter(f=>!f.startsWith('assets/'))){const bytes=fs.readFileSync(path.join(ROOT,file));write('source/'+file,bytes);assert.equal(sha(bytes),manifest.sources[file]);}
 report.sourceArchive={directory:'source',assets:'Actual loaded response bytes retained once by SHA-256 in served; all assets remain hash-bound in manifest.'};
 server=await startProbeServer({port:5395});browser=await launchProbeBrowser();report.browserVersion=browser.version();
 const cdp=await browser.newBrowserCDPSession();report.browserCDP=await cdp.send('Browser.getVersion');
 try{report.browserCommandLine=await cdp.send('Browser.getBrowserCommandLine');}
 catch(error){const known='cdpSession.send: Protocol error (Browser.getBrowserCommandLine): Command line not returned because --enable-automation not set.';
  if(error.message!==known)throw error;report.browserCommandLine={available:false,reason:error.message,scope:'Corroborating metadata unavailable; this capture does not measure native process argv or performance.'};}
 report.declaredLaunch={source:'packages/core/src/render/MotionProbe.mjs',sha256:manifest.sources['packages/core/src/render/MotionProbe.mjs'],channel:'chromium',headless:true,flags:['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--hide-scrollbars'],scope:'Source declaration, not an OS process observation.'};await cdp.detach();
 for(const c of CASES){
  verify(manifest);const label=c.label;currentCase={...c,label,completed:false};report.cases.push(currentCase);save();
  context=await browser.newContext({viewport:protocol.viewport,deviceScaleFactor:1,colorScheme:'dark',reducedMotion:'no-preference',acceptDownloads:true});page=await context.newPage();
  page.on('pageerror',e=>report.errors.push({label,type:'pageerror',message:String(e)}));
  page.on('console',m=>{if(m.type()==='error')report.errors.push({label,type:'console',message:m.text()});if(m.type()==='warning')report.warnings.push({label,message:m.text()});});
  page.on('requestfailed',r=>report.errors.push({label,type:'requestfailed',url:r.url(),message:r.failure()?.errorText}));
  page.on('response',r=>{if(r.status()>=400)report.errors.push({label,type:'http',url:r.url(),status:r.status()});reads.push((async()=>{assert.equal(r.status(),200,'Fresh-context routed capture expects actual successful bodies; unexpected cache/redirect refuses');const bytes=await r.body();
   const digest=sha(bytes),asset=assetFile(r.url());if(asset){assert.ok(Object.hasOwn(manifest.sources,asset),'Unbound asset '+asset);assert.equal(digest,manifest.sources[asset],'Actual asset bytes '+asset);}
   if(!served.has(digest)){write('served/'+digest,bytes);served.add(digest);}
   report.responses.push({label,url:r.url(),status:r.status(),asset,sha256:digest,bytes:bytes.length});
  })().catch(e=>report.errors.push({label,type:'response-hash',url:r.url(),status:r.status(),message:String(e)})));});
  // Same bytes as native loader requests; pinning prevents concurrent asset drift before parse.
  await page.route(/\/assets\//,async route=>{const asset=assetFile(route.request().url());if(!asset)return route.continue();try{
   assert.ok(Object.hasOwn(manifest.sources,asset),'Unbound asset request '+asset);const bytes=fs.readFileSync(path.join(ROOT,asset));assert.equal(sha(bytes),manifest.sources[asset]);
   const type={'.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.json':'application/json'}[path.extname(asset)]??'application/octet-stream';await route.fulfill({status:200,contentType:type,body:bytes});
  }catch(e){report.errors.push({label,type:'asset-route',message:String(e)});await route.abort();}});
  const query=new URLSearchParams({preset:c.preset,style:c.style,frame:'body',scene:'kitchen',light:'studio',capture:'micro-attribution'});
  currentCase.url=server.baseUrl+'/src/showcase.html?'+query;
  await page.goto(currentCase.url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.showcase?.avatar||!document.querySelector('#error').hidden,null,{timeout:120000});
  assert.equal(await page.locator('#error').isVisible(),false,'Original page startup failed');
  await page.waitForLoadState('networkidle');await drain();
  await page.evaluate(()=>{const d=showcase.avatar.stage.renderer.backend.device;window.__microGPU={errors:[],losses:[],retiring:false};d.addEventListener('uncapturederror',event=>window.__microGPU.errors.push({name:event.error.name,message:event.error.message}));d.lost.then(info=>window.__microGPU.losses.push({reason:info.reason,message:info.message,retiring:window.__microGPU.retiring}));});
  currentCase.instrumentSetup=await page.evaluate(async({moduleURL,microNormalScale})=>{const {createMicroCapture}=await import(moduleURL);window.__skinCapture=createMicroCapture(showcase,{microNormalScale});return window.__skinCapture.setup;},{moduleURL:'/@fs'+path.join(HERE,'micro-capture-runtime.mjs'),microNormalScale:c.microNormalScale});save();
  currentCase.settled=await bounded(page.evaluate(()=>window.__skinCapture.settle()),'Matched native zero-dt settling',120000);
  assert.equal(currentCase.settled.clock.frameId,protocol.baseFrame+64);assert.equal(currentCase.settled.clock.draws,64);assert.equal(currentCase.settled.clock.clock,0);assert.equal(currentCase.settled.pending,null);
  assert.equal(currentCase.instrumentSetup.before.uniforms.skin.microNormalScale,.25);assert.equal(currentCase.instrumentSetup.reset.temporal.jitterIndex,0);assert.equal(currentCase.instrumentSetup.reset.temporal.historyWidth,1);
  assert.equal(currentCase.settled.uniforms.skin.microNormalScale,c.microNormalScale);assert.equal(currentCase.settled.uniforms.skin.microNormalRepeat,48);
  const matched=structuredClone({reset:currentCase.instrumentSetup.reset,settled:currentCase.settled});delete matched.settled.uniforms.skin.microNormalScale;
  // The reset does not alter the grade uniform; it is evaluated on first indexed render.
  // Retain that boot-only stale value, and require all actually rendered grain phases exactly.
  assert.equal(matched.reset.grainFrame,currentCase.instrumentSetup.before.grainFrame);assert.equal(matched.settled.trace[0].before.grainFrame,matched.reset.grainFrame);
  delete matched.reset.grainFrame;delete matched.settled.trace[0].before.grainFrame;
  if(report.cases.length===1)report.matchedHistory=matched;else assert.deepEqual(matched,report.matchedHistory,'All other uniforms and actual reset/settle render histories must match exactly');save();
  const native=await page.evaluate(()=>({configuration:showcase.configuration(),report:showcase.avatar.report(),backend:showcase.avatar.stage.backendName,
   frameId:showcase.avatar.stage.renderer._nodes.nodeFrame.frameId,canvasRect:document.querySelector('#stage').getBoundingClientRect().toJSON()}));
  currentCase.native=native;assert.equal(native.backend,'webgpu');const cfg=native.configuration;
  assert.deepEqual(cfg.identity,{gender:.5,mode:'nearest'});assert.equal(cfg.hair,c.hair);assert.equal(cfg.frame,'body');assert.equal(cfg.seed,20260807);assert.equal(cfg.quality,'balanced');assert.equal(cfg.pose,'relaxed-standing');
  assert.equal(cfg.wardrobe.style??'original',c.style);assert.deepEqual(cfg.wardrobe.outfit,[c.outfit==='casual'?'female_casualsuit01':'female_elegantsuit01','shoes01']);
  assert.deepEqual(cfg.wardrobe.foundation,{TORSO:'foundation_bra',HIPS:'foundation_briefs'});
  assert.equal(native.report.scene.id,'kitchen');assert.equal(native.report.scene.lighting.look,'studio');assert.equal(native.report.wardrobe.appearance.attached,true);assert.equal(native.report.wardrobe.appearance.style,c.style);
  assert.equal(native.report.identity.bake,'figure_g050');assert.equal(native.report.hair.loadedStyle,c.hair);assert.equal(native.report.hair.attached,true);
  currentCase.exposureOwners=assertExposureOwners({rendererToneMappingExposure:currentCase.settled.uniforms.rendererToneMappingExposure,gradeExposure:currentCase.settled.uniforms.grade.exposure,sceneLightingExposure:native.report.scene.lighting.exposure});
  assert.equal(currentCase.settled.uniforms.lightRigExposure,currentCase.exposureOwners.sceneLightingExposure,'Actual native LightRig owner equals its report');
  assert.ok(native.report.hair.solver.steps>0);assert.equal(native.report.hair.history.valid,true);assert.equal(native.report.hair.cardFrame.available,true);
  const before=await readNativeState(page);validState(before);const stateBytes=Buffer.from(JSON.stringify(before));currentCase.stateSHA256=sha(stateBytes);
  const stateFile='states/'+currentCase.stateSHA256+'.json.gz',stateCompressed=gzipSync(stateBytes);
  if(!fs.existsSync(path.join(out,stateFile)))write(stateFile,stateCompressed);
  currentCase.stateArtifact={file:stateFile,sha256:hash(path.join(out,stateFile)),decodedSHA256:sha(stateBytes)};save();
  if(!baselines.has(c.preset))baselines.set(c.preset,{state:before,file:stateFile});
  else{assert.deepEqual(before,baselines.get(c.preset).state,'All body/worn topology+masks/rig/morph/camera and physical groom values must match across the three fresh arms');currentCase.exactReferenceState=baselines.get(c.preset).file;}
  const expectedGLB=['assets/wardrobe/body/g050.glb',`assets/wardrobe/${cfg.wardrobe.outfit[0]}/g050.glb`,'assets/wardrobe/foundation_bra/g050.glb','assets/wardrobe/foundation_briefs/g050.glb','assets/wardrobe/shoes01/g050.glb',`assets/hair/${c.hair}/g050.glb`].sort();
  assert.deepEqual(report.responses.filter(r=>r.label===label&&r.asset?.endsWith('.glb')).map(r=>r.asset).sort(),expectedGLB,'Exact native loaded GLB set');
  await page.evaluate(()=>window.__skinCapture.prepareExport());
  const [download]=await Promise.all([page.waitForEvent('download',{timeout:30000}),page.locator('#save-image').click()]);
  const filename=label+'.png';await download.saveAs(path.join(out,filename));assert.equal(await download.failure(),null);
  await page.waitForFunction(()=>!document.querySelector('#save-image').disabled);assert.match(await page.locator('#status').textContent(),/PNG image downloaded/);
  currentCase.exported=await page.evaluate(()=>window.__skinCapture.receipt());
  assert.equal(currentCase.exported.clock.draws,65);assert.equal(currentCase.exported.clock.frameId,protocol.baseFrame+65);assert.equal(currentCase.exported.pending,null);
  const exportMatched=structuredClone(currentCase.exported);delete exportMatched.uniforms.skin.microNormalScale;delete exportMatched.trace[0].before.grainFrame;
  if(report.cases.length===1)report.matchedExport=exportMatched;else assert.deepEqual(exportMatched,report.matchedExport,'Matched actual native export histories and all-other uniforms');
  const after=await readNativeState(page);assert.deepEqual(after,before,'Export must hold the exact native pose/camera/clock');
  const bytes=fs.readFileSync(path.join(out,filename)),png=decodePng(bytes);assert.deepEqual([png.width,png.height],[before.canvas.width,before.canvas.height]);
  let lo=Infinity,hi=-Infinity;for(let i=0;i<png.pixels.length;i+=4){const y=png.pixels[i]+png.pixels[i+1]+png.pixels[i+2];lo=Math.min(lo,y);hi=Math.max(hi,y);}assert.ok(hi-lo>.6,'Actual PNG must be nonblank');
  currentCase.image={file:filename,sha256:sha(bytes),bytes:bytes.length,width:png.width,height:png.height,suggestedFilename:download.suggestedFilename(),nativeSaveImage:true,unmodifiedBytes:true};
  if(c.label==='default-a2'){assert.equal(currentCase.image.sha256,report.cases[0].image.sha256,'Returned fresh default PNG must be byte-identical; otherwise reject attribution');currentCase.defaultReturnPNGExact=true;}
  currentCase.gpu=await page.evaluate(()=>structuredClone(window.__microGPU));assert.deepEqual(currentCase.gpu.errors,[]);assert.deepEqual(currentCase.gpu.losses,[]);
  currentCase.exportStateExact=true;await drain();await retire();verify(manifest);currentCase.completed=true;save();console.log('Captured and retired '+label);
 }
}catch(e){report.failure=e.stack;process.exitCode=1;}
finally{
 try{await retire();}catch(e){report.cleanupFailure=e.stack;process.exitCode=1;}
 try{await drain();verify(manifest);assert.equal(hash(manifestPath),report.manifestSHA256);report.sourcesStable=true;
  // Reread retained source archive and actual-response blobs, not only current files.
  for(const [f,h]of Object.entries(manifest.sources))if(!f.startsWith('assets/'))assert.equal(hash(path.join(out,'source',f)),h,'Archived source drift '+f);
  for(const digest of served)assert.equal(hash(path.join(out,'served',digest)),digest,'Retained served bytes drift');
 }catch(e){report.bindingFailure=e.stack;process.exitCode=1;}
 for(const[name,close]of [['context',()=>context?.close()],['browser',()=>browser?.close()],['server',()=>server?.close()]])try{await bounded(close(),'Close '+name);}catch(e){report.errors.push({type:'close-'+name,message:String(e)});process.exitCode=1;}
 report.completed=!report.failure&&!report.cleanupFailure&&!report.bindingFailure&&report.sourcesStable&&report.errors.length===0&&report.cases.length===3&&report.cases.every(c=>c.completed);
 report.servedBlobs=served.size;save();if(report.completed)write('seal.json',{reportSHA256:hash(path.join(out,'report.json')),manifestSHA256:report.manifestSHA256,scope});
 console.log(json({completed:report.completed,cases:report.cases.filter(c=>c.completed).length,out,failure:report.failure,cleanupFailure:report.cleanupFailure,errors:report.errors.length}));
}
