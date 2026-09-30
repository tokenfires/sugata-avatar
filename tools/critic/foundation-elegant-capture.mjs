// Frozen exact-frame elegant overlap attribution; material-only diagnostic.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {ROOT,collectSourceHashes,hashFile,sha256} from '../figure-pipeline/collar_replacement_manifest.mjs';
import {startProbeServer,launchProbeBrowser} from '../../packages/core/src/render/MotionProbe.mjs';
const out=path.join(ROOT,'captures/foundation-elegant-attribution-2026-09-30-v1');
assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const basePath='assets/wardrobe/foundation_bra/g050.glb';
const arms={shipped:{path:basePath,sha256:'4a3366377087bbfb2d5779ba4d6f5de09735e1810ae4ea9b6a22e11d3aee0d79'},
  band:{path:'captures/foundation-domain-native-2026-09-30-v3/band.glb',sha256:'3793206f8f7a95a632705b02756bff9c35c5a934f266dc6bd790d076278671cd'}};
const extra=['tools/critic/foundation-elegant-capture.mjs','tools/critic/foundation-elegant-browser.mjs','tools/figure-pipeline/collar_capture_browser.mjs',
  'docs/evidence/wardrobe-2026-09-30/foundation-elegant-attribution/PLAN.md'];
const sources=()=>({...collectSourceHashes(),...Object.fromEntries(extra.map(p=>[p,hashFile(path.join(ROOT,p))]))});
const report={started:new Date().toISOString(),pid:process.pid,status:'running',sourceHashes:sources(),arms,runs:[],errors:[],
  windows:[['left',112,584,184,664],['right',280,584,344,656]],
  scope:'Exact initial elegant pose, foundation diffuse attribution and CPU picks; no repair or fit qualification.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
for(const p of Object.keys(report.sourceHashes).filter(p=>!p.startsWith('assets/')&&!p.startsWith('node_modules/'))){const dest=path.join(out,'source',p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(ROOT,p),dest);}
for(const[id,a]of Object.entries(arms)){assert.equal(hashFile(path.join(ROOT,a.path)),a.sha256);fs.copyFileSync(path.join(ROOT,a.path),path.join(out,id+'.glb'));}
const disk=fs.statfsSync(out);report.availableBytes=Number(disk.bavail)*Number(disk.bsize);assert.ok(report.availableBytes>4*1024**3);save();
const previousRoot=path.join(ROOT,'captures/foundation-domain-motion-2026-09-30-v1');
const previousFile=path.join(previousRoot,'report.json');assert.equal(hashFile(previousFile),'24071200867f77630521e51202fe3c9de6069173cee905d0a5ecda713176953b');
const previous=JSON.parse(fs.readFileSync(previousFile));report.previousReportSHA256=hashFile(previousFile);
fs.copyFileSync(previousFile,path.join(out,'motion-report.json'));
let server,browser,page,held;
try{
  server=await startProbeServer({port:5301});browser=await launchProbeBrowser();report.baseUrl=server.baseUrl;
  for(const [key,arm] of [['shipped-ordinary','shipped'],['band-ordinary','band'],['band-magenta','band'],['band-repeat','band']]){
    const asset=arms[arm],outfit='elegant',dir=path.join(out,key);fs.mkdirSync(dir);
    const rec={key,arm,outfit,assets:[],errors:[],warnings:[]},reads=[];report.runs.push(rec);save();
    page=await browser.newPage({viewport:{width:800,height:1000},deviceScaleFactor:1,reducedMotion:'no-preference'});
    page.on('pageerror',e=>rec.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')rec.errors.push(m.text());if(m.type()==='warning')rec.warnings.push(m.text());});page.on('requestfailed',r=>rec.errors.push(`${r.url()} ${r.failure()?.errorText}`));
    if(arm!=='shipped')await page.route('**/assets/wardrobe/foundation_bra/g050.glb',r=>r.fulfill({status:200,contentType:'model/gltf-binary',body:fs.readFileSync(path.join(ROOT,asset.path))}));
    page.on('response',r=>{if(r.status()>=400)rec.errors.push(`${r.status()} ${r.url()}`);const u=new URL(r.url());if(r.ok()&&u.pathname.endsWith('.glb')&&!u.searchParams.has('import'))reads.push(r.body().then(bytes=>{const at=u.pathname.indexOf('/assets/');assert.ok(at>=0);const file=u.pathname.slice(at+1),expected=file===basePath?asset.sha256:report.sourceHashes[file];assert.equal(sha256(bytes),expected,file);rec.assets.push({file,sha256:sha256(bytes),bytes:bytes.length});}).catch(e=>rec.errors.push(e.stack)));});
    await page.route('**/foundation-motion-fixture.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head><link rel="icon" href="data:,"><style>html,body{margin:0}canvas{width:800px;height:1000px;display:block}</style></head><body><canvas></canvas></body></html>'}));
    await page.goto(server.baseUrl+'/foundation-motion-fixture.html');
    rec.setup=await page.evaluate(async({root,outfit,key})=>{
      const{Avatar}=await import(`/@fs${root}/packages/core/src/Avatar.js`),{optionsForShowcase,resolveShowcaseSelection}=await import(`/@fs${root}/packages/testbed/src/showcase-presets.mjs`);
      const options=optionsForShowcase(resolveShowcaseSelection(new URLSearchParams({preset:'casual',outfit:outfit==='foundation'?'casual':outfit,style:'original',frame:'portrait',light:'neutral',hairColour:'#413934'})));
      window.subject=await Avatar.create({canvas:document.querySelector('canvas'),...options,autoStart:false});
      window.motionHelper=await import(`/@fs${root}/tools/figure-pipeline/collar_capture_browser.mjs`);window.elegantHelper=await import(`/@fs${root}/tools/critic/foundation-elegant-browser.mjs`);if(key==='band-magenta')elegantHelper.tag(subject);
      if(outfit==='foundation')await subject.dress([]);
      const a=subject,f=a.stage.renderer._nodes.nodeFrame;a.stage.renderer._animation.stop();f.frameId=0;f.time=0;f.deltaTime=0;f.lastTime=undefined;a.stage.temporal?.resetFrameEpoch();
      const target=a.focus.clone().set(0,1.30,0),radius=1.20,angle=25*Math.PI/180,c=a.stage.camera;
      c.position.set(radius*Math.sin(angle),1.34,radius*Math.cos(angle));c.lookAt(target);c.updateMatrixWorld(true);
      for(let i=0;i<98;i++){f.update();f.time=0;f.deltaTime=0;await a.step(0);}
      f.update();f.time=0;f.deltaTime=0;a.stage.draw();await a.stage.renderer.backend.device.queue.onSubmittedWorkDone();
      const lights=[];a.stage.scene.traverse(o=>{if(o.isLight)lights.push({name:o.name,type:o.type,colour:o.color.toArray(),groundColour:o.groundColor?.toArray()??null,intensity:o.intensity,matrix:o.matrixWorld.toArray()});});
      return{backend:a.stage.backendName,adapter:{vendor:a.stage.renderer.backend.device?.adapterInfo?.vendor,architecture:a.stage.renderer.backend.device?.adapterInfo?.architecture},identity:a.report().identity,hair:a.report().hair.loadedStyle,motion:a.report().motion,layers:a.stack.layers.map(l=>({name:l.name,order:l.order,enabled:l.enabled})),lights,camera:c.matrixWorld.toArray(),projection:c.projectionMatrix.toArray(),target:target.toArray(),radius,clock:a.clockSeconds,frame:f.frameId,wardrobe:a.report().wardrobe};
    },{root:ROOT,outfit,key});
    assert.equal(rec.setup.backend,'webgpu');assert.equal(rec.setup.hair,'bob02');assert.equal(rec.setup.clock,0);assert.equal(rec.setup.frame,99);assert.equal(rec.setup.motion.seed,20260807);
    const selected=await page.evaluate(()=>[...subject.wardrobe.wornMeshes.keys()].sort());rec.selectedMeshes=selected;
    assert.ok(selected.includes('foundation_bra')&&selected.includes('foundation_briefs'));
    assert.ok(outfit==='foundation'?selected.length===2:selected.includes(outfit==='casual'?'female_casualsuit01':'female_elegantsuit01'));
    const fixed=await page.evaluate(async windows=>({snapshot:motionHelper.snapshot(subject),physical:await motionHelper.physical(subject),morphs:Array.from(subject.figure.body.morphTargetInfluences),observation:elegantHelper.observe(subject,windows)}),report.windows);
    const raw=Buffer.from(JSON.stringify(fixed)+'\n'),bytes=gzipSync(raw);fs.writeFileSync(path.join(dir,'observed.json.gz'),bytes);rec.observation={file:key+'/observed.json.gz',sha256:sha256(bytes),decodedSHA256:sha256(raw)};save();
    const prior=previous.runs.find(r=>r.arm===arm&&r.outfit==='elegant'),geometry=prior.geometry.find(g=>g.step===0),encoded=fs.readFileSync(path.join(previousRoot,geometry.file));
    assert.equal(sha256(encoded),geometry.sha256);const decoded=gunzipSync(encoded);assert.equal(sha256(decoded),geometry.decodedSHA256);
    assert.deepEqual(fixed.snapshot,JSON.parse(decoded),'Exact prior motion pose/geometry');assert.deepEqual(fixed.physical,prior.states[0].physical);assert.deepEqual(fixed.morphs,prior.states[0].morphs);
    fs.writeFileSync(path.join(dir,'prior-meshes.json.gz'),encoded);
    for(const k of ['identity','hair','motion','layers','lights','camera','projection','target','radius','clock','frame'])assert.deepEqual(rec.setup[k],prior.setup[k],k);
    if(arm==='band'){if(held)assert.deepEqual(fixed,held,'Tag/repeat changed geometry/masks/picks/state');else held=fixed;}
    // CPU-only temporary side inspection must not update the renderer or motion.
    const captured=await page.evaluate(async()=>{await subject.stage.renderer.backend.device.queue.onSubmittedWorkDone();return{data:subject.stage.canvas.toDataURL('image/png'),frame:subject.stage.renderer._nodes.nodeFrame.frameId,time:subject.clockSeconds};});
    assert.equal(captured.frame,99);assert.equal(captured.time,0);const png=Buffer.from(captured.data.split(',')[1],'base64');fs.writeFileSync(path.join(dir,'frame.png'),png);rec.image={file:key+'/frame.png',sha256:sha256(png)};
    await Promise.all(reads);assert.equal(rec.assets.filter(a=>a.file===basePath).length,1);assert.deepEqual(rec.errors,[]);
    rec.disposal=await page.evaluate(()=>{subject.dispose();return subject.report().disposal;});assert.equal(rec.disposal.disposed,true);assert.deepEqual(rec.disposal.leaked,[]);assert.deepEqual(rec.errors,[]);await page.close();page=null;rec.completed=true;save();console.log(key);
  }
  assert.deepEqual(sources(),report.sourceHashes);for(const a of Object.values(arms))assert.equal(hashFile(path.join(ROOT,a.path)),a.sha256);report.status='captured-awaiting-attribution-review';
}catch(error){report.status='failed';report.errors.push(error.stack);process.exitCode=1;}
finally{if(page&&!page.isClosed())try{report.failureDisposal=await page.evaluate(()=>{if(!window.subject)return null;subject.dispose();return subject.report().disposal;});}catch(e){report.errors.push(e.message);}report.finished=new Date().toISOString();save();await browser?.close();await server?.close();}
