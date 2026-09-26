// CPU freeze/preflight; --capture is the only native browser/GPU entry point.
// The original showcase startup, public zero-dt stepping, and Save image action remain intact.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url)), ROOT=path.resolve(HERE,'../../../..');
const sha=b=>createHash('sha256').update(b).digest('hex'), hash=p=>sha(fs.readFileSync(p));
const json=x=>JSON.stringify(x,null,2)+'\n', rel=p=>path.relative(ROOT,p);
const KIND='unchanged-showcase-palette-references-v1';
const CASES=['casual','elegant'].flatMap(preset=>['ecru','charcoal','original'].map(style=>({preset,outfit:preset,style,hair:preset==='casual'?'bob02':'bob01'})));
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
 scene:'studio',light:'studio',frame:'body',seed:20260807,cases:CASES};
const scope='Six unchanged native Wardrobe resting references. Palette comparison only within each authored preset; no hair change/comparison, new fit, motion qualification or representative-build acceptance.';
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
 const p=path.join(dir,e.name);assert.equal(e.isSymbolicLink(),false,'Source symlink requires explicit binding: '+p);return e.isDirectory()?walk(p):e.isFile()?[p]:[];
});}
function sourceFiles(){return [...new Set([
 ...['packages/core/src','packages/testbed/src','assets','node_modules/three/src','node_modules/three/build','node_modules/three/examples/jsm','node_modules/vite/dist'].flatMap(p=>walk(path.join(ROOT,p))),
 ...['package.json','package-lock.json','vite.config.js','tools/critic/png.mjs','node_modules/three/package.json','node_modules/vite/package.json'].map(p=>path.join(ROOT,p)),
 path.join(HERE,'capture-palettes.mjs'),...walk(path.join(HERE,'candidate'))])].sort();}
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
 for(const m of s.meshes){assert.equal(m.positions.length%3,0);assert.equal(m.fullIndices.length%3,0);assert.equal(m.drawnIndices.length%3,0);assert.ok(m.positions.length>0&&m.fullIndices.length>0&&m.drawnIndices.length>0);
  for(const i of [...m.fullIndices,...m.drawnIndices])assert.ok(Number.isInteger(i)&&i>=0&&i<m.positions.length/3,'Invalid index '+m.id);
 }
}
// Read actual currently skinned body/worn state; CPU vertex readback, not GPU output geometry.
// No separate Three import, native layer wrapper, render callback or clock replacement.
async function readNativeState(page){return await page.evaluate(()=>{
 const a=showcase.avatar,c=a.stage.camera,w=a.wardrobe;
 a.figure.root.updateMatrixWorld(true);
 const meshes=[['body',a.figure.body],...w.wornMeshes].sort(([x],[y])=>x.localeCompare(y)).map(([id,m])=>{
  m.updateMatrixWorld(true);m.skeleton?.update();const v=m.position.clone(),p=new Float32Array(m.geometry.attributes.position.count*3);
  for(let i=0;i<p.length/3;i++)m.getVertexPosition(i,v).applyMatrix4(m.matrixWorld).toArray(p,i*3);
  const range=m.geometry.drawRange,end=Math.min(m.geometry.index.count,range.start+range.count);
  const full=id==='body'?w.fullIndex:w.fragments.get(id).fullIndex;
  return {id,positions:Array.from(p),fullIndices:Array.from(full),drawnIndices:Array.from(m.geometry.index.array.slice(range.start,end)),
   matrixWorld:m.matrixWorld.toArray(),boneMatrices:Array.from(m.skeleton?.boneMatrices??[]),
   morphs:Object.fromEntries(Object.entries(m.morphTargetDictionary??{}).map(([name,i])=>[name,m.morphTargetInfluences[i]]))};
 });
 return {clock:a.clockSeconds,canvas:{width:a.stage.canvas.width,height:a.stage.canvas.height},
  camera:{position:c.position.toArray(),quaternion:c.quaternion.toArray(),world:c.matrixWorld.toArray(),view:c.matrixWorldInverse.toArray(),projection:c.projectionMatrix.toArray(),target:showcase.controls.target.toArray(),focus:a.focus.toArray()},
  rig:a.figure.body.skeleton.bones.map(b=>({name:b.name,position:b.position.toArray(),quaternion:b.quaternion.toArray(),scale:b.scale.toArray(),matrixWorld:b.matrixWorld.toArray()})),
  face:a.figure.meshes.map(m=>({name:m.name,morphs:Object.fromEntries(Object.entries(m.morphTargetDictionary??{}).map(([name,i])=>[name,m.morphTargetInfluences[i]]))})),meshes};
 });}
const [mode,manifestPath,output]=process.argv.slice(2);
if(mode==='--write-manifest'){
 assert.equal(process.argv.length,4,'capture-palettes.mjs --write-manifest fresh-manifest.json');
 const m=makeManifest();verify(m);fs.writeFileSync(manifestPath,json(m),{flag:'wx'});console.log(json({manifest:manifestPath,sha256:hash(manifestPath),files:Object.keys(m.sources).length}));process.exit(0);
}
assert.ok(['--preflight','--capture'].includes(mode),'capture-palettes.mjs --preflight|--capture manifest.json fresh-output-directory');assert.equal(process.argv.length,5);
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
  if(window.__paletteRetirement)return window.__paletteRetirement;
  const a=window.showcase?.avatar,renderer=a?.stage.renderer;
  // Exercises the already installed page handler, including attention/controls/RAF ownership.
  // Explicit handler invocation is not a claim of actual bfcache admission or page navigation.
  dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));
  return window.__paletteRetirement=a ? {disposed:a.disposed,leaks:a.leakedHandles(),memory:structuredClone(renderer.info.memory),handlerFixture:'nonpersisted pagehide'} :
   {noPublishedOwner:true,loadError:document.querySelector('#error')?.textContent,handlerFixture:'nonpersisted pagehide; unpublished owner teardown not observed'};
 }),'Page retirement');
 if(currentCase)currentCase.retirement=receipt;else report.unassignedRetirement=receipt;
 if(!receipt.noPublishedOwner){assert.equal(receipt.disposed,true);assert.deepEqual(receipt.leaks,[]);assert.ok(Object.values(receipt.memory).every(v=>v===0));}
 await drain();await context.close();context=null;page=null;
}
try{
 for(const file of Object.keys(manifest.sources).filter(f=>!f.startsWith('assets/'))){const bytes=fs.readFileSync(path.join(ROOT,file));write('source/'+file,bytes);assert.equal(sha(bytes),manifest.sources[file]);}
 report.sourceArchive={directory:'source',assets:'Actual loaded response bytes retained once by SHA-256 in served; all assets remain hash-bound in manifest.'};
 server=await startProbeServer({port:5393});browser=await launchProbeBrowser();report.browserVersion=browser.version();
 const cdp=await browser.newBrowserCDPSession();report.browserCDP=await cdp.send('Browser.getVersion');report.browserCommandLine=await cdp.send('Browser.getBrowserCommandLine');await cdp.detach();
 for(const c of CASES){
  verify(manifest);const label=c.preset+'-'+c.style;currentCase={...c,label,completed:false};report.cases.push(currentCase);save();
  context=await browser.newContext({viewport:protocol.viewport,deviceScaleFactor:1,colorScheme:'dark',reducedMotion:'no-preference',acceptDownloads:true});page=await context.newPage();
  page.on('pageerror',e=>report.errors.push({label,type:'pageerror',message:String(e)}));
  page.on('console',m=>{if(m.type()==='error')report.errors.push({label,type:'console',message:m.text()});if(m.type()==='warning')report.warnings.push({label,message:m.text()});});
  page.on('requestfailed',r=>report.errors.push({label,type:'requestfailed',url:r.url(),message:r.failure()?.errorText}));
  page.on('response',r=>{if(r.status()>=400)report.errors.push({label,type:'http',url:r.url(),status:r.status()});reads.push(r.body().then(bytes=>{
   const digest=sha(bytes),asset=assetFile(r.url());if(asset){assert.ok(Object.hasOwn(manifest.sources,asset),'Unbound asset '+asset);assert.equal(digest,manifest.sources[asset],'Actual asset bytes '+asset);}
   if(!served.has(digest)){write('served/'+digest,bytes);served.add(digest);}
   report.responses.push({label,url:r.url(),status:r.status(),asset,sha256:digest,bytes:bytes.length});
  }).catch(e=>report.errors.push({label,type:'response-hash',message:String(e)})));});
  // Same bytes as native loader requests; pinning prevents concurrent asset drift before parse.
  await page.route(/\/assets\//,async route=>{const asset=assetFile(route.request().url());if(!asset)return route.continue();try{
   assert.ok(Object.hasOwn(manifest.sources,asset),'Unbound asset request '+asset);const bytes=fs.readFileSync(path.join(ROOT,asset));assert.equal(sha(bytes),manifest.sources[asset]);
   const type={'.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.json':'application/json'}[path.extname(asset)]??'application/octet-stream';await route.fulfill({status:200,contentType:type,body:bytes});
  }catch(e){report.errors.push({label,type:'asset-route',message:String(e)});await route.abort();}});
  const query=new URLSearchParams({preset:c.preset,style:c.style,frame:'body',scene:'studio',light:'studio',capture:''});
  currentCase.url=server.baseUrl+'/src/showcase.html?'+query;
  await page.goto(currentCase.url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.showcase?.avatar||!document.querySelector('#error').hidden,null,{timeout:120000});
  assert.equal(await page.locator('#error').isVisible(),false,'Original page startup failed');
  await page.waitForLoadState('networkidle');await drain();
  await bounded(page.evaluate(async count=>{for(let i=0;i<count;i++){await new Promise(requestAnimationFrame);await showcase.step(0);}await showcase.avatar.stage.renderer.backend.device.queue.onSubmittedWorkDone();},protocol.settleDraws),'Native zero-dt settling',120000);
  const native=await page.evaluate(()=>({configuration:showcase.configuration(),report:showcase.avatar.report(),backend:showcase.avatar.stage.backendName,
   frameId:showcase.avatar.stage.renderer._nodes.nodeFrame.frameId,canvasRect:document.querySelector('#stage').getBoundingClientRect().toJSON()}));
  currentCase.native=native;assert.equal(native.backend,'webgpu');const cfg=native.configuration;
  assert.deepEqual(cfg.identity,{gender:.5,mode:'nearest'});assert.equal(cfg.hair,c.hair);assert.equal(cfg.frame,'body');assert.equal(cfg.seed,20260807);assert.equal(cfg.quality,'balanced');assert.equal(cfg.pose,'relaxed-standing');
  assert.equal(cfg.wardrobe.style??'original',c.style);assert.deepEqual(cfg.wardrobe.outfit,[c.outfit==='casual'?'female_casualsuit01':'female_elegantsuit01','shoes01']);
  assert.deepEqual(cfg.wardrobe.foundation,{TORSO:'foundation_bra',HIPS:'foundation_briefs'});
  assert.equal(native.report.scene.id,'studio');assert.equal(native.report.scene.lighting.look,'studio');assert.equal(native.report.wardrobe.appearance.attached,true);assert.equal(native.report.wardrobe.appearance.style,c.style);
  assert.equal(native.report.identity.bake,'figure_g050');assert.equal(native.report.hair.loadedStyle,c.hair);assert.equal(native.report.hair.attached,true);
  assert.ok(native.report.hair.solver.steps>0);assert.equal(native.report.hair.history.valid,true);assert.equal(native.report.hair.cardFrame.available,true);
  const before=await readNativeState(page);validState(before);const stateBytes=Buffer.from(JSON.stringify(before));currentCase.stateSHA256=sha(stateBytes);
  if(!baselines.has(c.preset)){baselines.set(c.preset,before);const bytes=gzipSync(stateBytes);write(label+'-state.json.gz',bytes);currentCase.stateArtifact={file:label+'-state.json.gz',sha256:sha(bytes),decodedSHA256:sha(stateBytes)};}
  else{assert.deepEqual(before,baselines.get(c.preset),'All body/worn topology+masks/rig/morph/camera values must match within a preset across styles');currentCase.exactReferenceState=c.preset+'-ecru-state.json.gz';}
  const expectedGLB=['assets/wardrobe/body/g050.glb',`assets/wardrobe/${cfg.wardrobe.outfit[0]}/g050.glb`,'assets/wardrobe/foundation_bra/g050.glb','assets/wardrobe/foundation_briefs/g050.glb','assets/wardrobe/shoes01/g050.glb',`assets/hair/${c.hair}/g050.glb`].sort();
  assert.deepEqual(report.responses.filter(r=>r.label===label&&r.asset?.endsWith('.glb')).map(r=>r.asset).sort(),expectedGLB,'Exact native loaded GLB set');
  const [download]=await Promise.all([page.waitForEvent('download',{timeout:30000}),page.locator('#save-image').click()]);
  const filename=label+'.png';await download.saveAs(path.join(out,filename));assert.equal(await download.failure(),null);
  await page.waitForFunction(()=>!document.querySelector('#save-image').disabled);assert.match(await page.locator('#status').textContent(),/PNG image downloaded/);
  const after=await readNativeState(page);assert.deepEqual(after,before,'Export must hold the exact native pose/camera/clock');
  const bytes=fs.readFileSync(path.join(out,filename)),png=decodePng(bytes);assert.deepEqual([png.width,png.height],[before.canvas.width,before.canvas.height]);
  let lo=Infinity,hi=-Infinity;for(let i=0;i<png.pixels.length;i+=4){const y=png.pixels[i]+png.pixels[i+1]+png.pixels[i+2];lo=Math.min(lo,y);hi=Math.max(hi,y);}assert.ok(hi-lo>.6,'Actual PNG must be nonblank');
  currentCase.image={file:filename,sha256:sha(bytes),bytes:bytes.length,width:png.width,height:png.height,suggestedFilename:download.suggestedFilename(),nativeSaveImage:true,unmodifiedBytes:true};
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
 report.completed=!report.failure&&!report.cleanupFailure&&!report.bindingFailure&&report.sourcesStable&&report.errors.length===0&&report.cases.length===6&&report.cases.every(c=>c.completed);
 report.servedBlobs=served.size;save();if(report.completed)write('seal.json',{reportSHA256:hash(path.join(out,'report.json')),manifestSHA256:report.manifestSHA256,scope});
 console.log(json({completed:report.completed,cases:report.cases.filter(c=>c.completed).length,out,failure:report.failure,cleanupFailure:report.cleanupFailure,errors:report.errors.length}));
}
