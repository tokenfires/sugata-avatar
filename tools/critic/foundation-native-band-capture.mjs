// Actual shipped, construction-control and band views through the current Avatar renderer.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { ROOT, collectSourceHashes, hashFile, sha256 } from '../figure-pipeline/collar_replacement_manifest.mjs';
import { startProbeServer, launchProbeBrowser } from '../../packages/core/src/render/MotionProbe.mjs';
const nativeRoot='captures/foundation-native-band-2026-09-30-v1';
const basePath='assets/wardrobe/foundation_bra/g050.glb';
const arms={shipped:{path:basePath,sha256:'4a3366377087bbfb2d5779ba4d6f5de09735e1810ae4ea9b6a22e11d3aee0d79'},
  band:{path:`${nativeRoot}/band.glb`,sha256:'c82805f09177627376a9b6ec821c754c020ef1b2cc7a074e6960523e8f5641bd'},
  'construction-control':{path:`${nativeRoot}/original-control.glb`,sha256:'af908bb0155fcdd1140a5d66855ba293d9e413e8923807bd2994205f0910f3bb'}};
const out=path.join(ROOT,'captures/foundation-native-band-visual-2026-09-30-v1');
assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const extra=['tools/critic/foundation-native-band-capture.mjs','tools/figure-pipeline/collar_capture_browser.mjs',
  'docs/evidence/wardrobe-2026-09-30/foundation-native-band/CAPTURE-PLAN.md'];
const sources=()=>({...collectSourceHashes(),...Object.fromEntries(extra.map(p=>[p,hashFile(path.join(ROOT,p))]))});
const report={started:new Date().toISOString(),pid:process.pid,status:'running',sourceHashes:sources(),arms,views:[],errors:[],
  scope:'Static foundation and casual views; no all-motion, exact-image or promotion claim.'};
for(const p of Object.keys(report.sourceHashes).filter(p=>!p.startsWith('assets/')&&!p.startsWith('node_modules/'))){const dest=path.join(out,'source',p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(ROOT,p),dest);}
for(const [id,a]of Object.entries(arms)){assert.equal(hashFile(path.join(ROOT,a.path)),a.sha256);fs.copyFileSync(path.join(ROOT,a.path),path.join(out,id+'.glb'));}
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const views=[...[0,-45,45,180].map(yaw=>({outfit:'foundation',frame:'torso',yaw})),
  ...[0,180].map(yaw=>({outfit:'foundation',frame:'body',yaw})),
  ...[0,-45,45,180].map(yaw=>({outfit:'casual',frame:'portrait',yaw}))];
const held=new Map();let server,browser,page;
async function retire(rec){rec.disposal=await page.evaluate(()=>{subject.dispose();return subject.report().disposal;});assert.equal(rec.disposal.disposed,true);assert.deepEqual(rec.disposal.leaked,[]);assert.deepEqual(rec.errors,[]);await page.close();page=null;rec.completed=true;save();}
try{
  server=await startProbeServer({port:5301});browser=await launchProbeBrowser();report.baseUrl=server.baseUrl;
  for(const [arm,asset]of Object.entries(arms))for(const view of views){
    if(arm==='construction-control'&&!((view.outfit==='foundation'&&view.frame==='torso'&&[0,180].includes(view.yaw))||(view.outfit==='casual'&&view.yaw===0)))continue;
    const key=`${arm}-${view.outfit}-${view.frame}-${view.yaw}`,rec={arm,...view,key,assets:[],errors:[],warnings:[]},reads=[];report.views.push(rec);save();
    page=await browser.newPage({viewport:{width:800,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
    page.on('pageerror',e=>rec.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')rec.errors.push(m.text());if(m.type()==='warning')rec.warnings.push(m.text());});page.on('requestfailed',r=>rec.errors.push(`${r.url()} ${r.failure()?.errorText}`));
    if(arm!=='shipped')await page.route('**/assets/wardrobe/foundation_bra/g050.glb',r=>r.fulfill({status:200,contentType:'model/gltf-binary',body:fs.readFileSync(path.join(ROOT,asset.path))}));
    page.on('response',r=>{if(r.status()>=400)rec.errors.push(`${r.status()} ${r.url()}`);const u=new URL(r.url());if(r.ok()&&u.pathname.endsWith('.glb')&&!u.searchParams.has('import'))reads.push(r.body().then(bytes=>{const at=u.pathname.indexOf('/assets/');assert.ok(at>=0);const file=u.pathname.slice(at+1),expected=file===basePath?asset.sha256:report.sourceHashes[file];assert.equal(sha256(bytes),expected,file);rec.assets.push({file,sha256:sha256(bytes),bytes:bytes.length});}).catch(e=>rec.errors.push(e.stack)));});
    await page.route('**/foundation-band-fixture.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head><link rel="icon" href="data:,"><style>html,body{margin:0}canvas{width:800px;height:1000px;display:block}</style></head><body><canvas></canvas></body></html>'}));
    await page.goto(server.baseUrl+'/foundation-band-fixture.html');
    rec.setup=await page.evaluate(async({root,view})=>{
      const {Avatar}=await import(`/@fs${root}/packages/core/src/Avatar.js`),{optionsForShowcase,resolveShowcaseSelection}=await import(`/@fs${root}/packages/testbed/src/showcase-presets.mjs`);
      const options=optionsForShowcase(resolveShowcaseSelection(new URLSearchParams({preset:'casual',style:'original',frame:view.frame==='torso'?'portrait':view.frame,light:'neutral',hairColour:'#413934'})));
      window.subject=await Avatar.create({canvas:document.querySelector('canvas'),...options,autoStart:false});
      window.bandHelper=await import(`/@fs${root}/tools/figure-pipeline/collar_capture_browser.mjs`);
      if(view.outfit==='foundation')await subject.dress([]);
      const a=subject,f=a.stage.renderer._nodes.nodeFrame;a.stage.renderer._animation.stop();f.frameId=0;f.time=0;f.deltaTime=0;f.lastTime=undefined;a.stage.temporal?.resetFrameEpoch();
      const camera=a.stage.camera,target=a.focus.clone();target.y+=.045;
      let radius=Math.hypot(camera.position.x-target.x,camera.position.z-target.z),height=camera.position.y;
      if(view.frame==='torso'){target.set(0,1.23,0);radius=.90;height=target.y;}
      const r=view.yaw*Math.PI/180;camera.position.set(target.x+radius*Math.sin(r),height,target.z+radius*Math.cos(r));camera.lookAt(target);camera.updateMatrixWorld(true);
      for(let i=0;i<98;i++){f.update();f.time=0;f.deltaTime=0;await a.step(0);}
      return{backend:a.stage.backendName,adapter:{vendor:a.stage.renderer.backend.device?.adapterInfo?.vendor,architecture:a.stage.renderer.backend.device?.adapterInfo?.architecture},cameraTarget:target.toArray(),radius};
    },{root:ROOT,view});assert.equal(rec.setup.backend,'webgpu');
    const fixed=await page.evaluate(async()=>{const a=subject;a.stage.scene.updateMatrixWorld(true);const lights=[];a.stage.scene.traverse(o=>{if(o.isLight)lights.push({name:o.name,type:o.type,colour:o.color.toArray(),groundColour:o.groundColor?.toArray()??null,intensity:o.intensity,matrix:o.matrixWorld.toArray()});});return{physical:await bandHelper.physical(a),snapshot:bandHelper.snapshot(a),lights,camera:a.stage.camera.matrixWorld.toArray(),projection:a.stage.camera.projectionMatrix.toArray(),wardrobe:a.report().wardrobe};});
    const invariant={physical:fixed.physical,snapshot:structuredClone(fixed.snapshot),lights:fixed.lights,camera:fixed.camera,projection:fixed.projection};invariant.snapshot.meshes=invariant.snapshot.meshes.filter(m=>m.id!=='foundation_bra');
    const group=`${view.outfit}-${view.frame}-${view.yaw}`;if(held.has(group))assert.deepEqual(invariant,held.get(group));else held.set(group,invariant);
    const state=Buffer.from(JSON.stringify(fixed)+'\n'),encoded=gzipSync(state);fs.writeFileSync(path.join(out,key+'-state.json.gz'),encoded);rec.stateSHA256=sha256(state);rec.compressedStateSHA256=sha256(encoded);rec.wardrobe=fixed.wardrobe;
    const shot=await page.evaluate(()=>{const a=subject,f=a.stage.renderer._nodes.nodeFrame;f.update();f.time=0;f.deltaTime=0;a.stage.draw();return{data:a.stage.canvas.toDataURL('image/png'),clock:{frameId:f.frameId,time:f.time,delta:f.deltaTime}};});
    assert.equal(shot.clock.frameId,99);assert.equal(shot.clock.time,0);assert.equal(shot.clock.delta,0);const bytes=Buffer.from(shot.data.split(',')[1],'base64');fs.writeFileSync(path.join(out,key+'.png'),bytes);rec.imageSHA256=sha256(bytes);rec.clock=shot.clock;
    await Promise.all(reads);assert.equal(rec.assets.filter(a=>a.file===basePath).length,1);await retire(rec);console.log(key);
  }
  assert.deepEqual(sources(),report.sourceHashes);for(const a of Object.values(arms))assert.equal(hashFile(path.join(ROOT,a.path)),a.sha256);report.status='captured';
}catch(error){report.status='failed';report.errors.push(error.stack);throw error;}
finally{if(page&&!page.isClosed())try{report.failureDisposal=await page.evaluate(()=>{if(!window.subject)return null;subject.dispose();return subject.report().disposal;});}catch(e){report.errors.push(e.message);}report.finished=new Date().toISOString();save();await browser?.close();await server?.close();}
