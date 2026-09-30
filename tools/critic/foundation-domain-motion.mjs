// Fixed ordinary motion observations of exact foundation bytes through the real loader.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {ROOT,collectSourceHashes,hashFile,sha256} from '../figure-pipeline/collar_replacement_manifest.mjs';
import {startProbeServer,launchProbeBrowser} from '../../packages/core/src/render/MotionProbe.mjs';
const out=path.join(ROOT,'captures/foundation-domain-motion-2026-09-30-v1');
assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const basePath='assets/wardrobe/foundation_bra/g050.glb';
const arms={shipped:{path:basePath,sha256:'4a3366377087bbfb2d5779ba4d6f5de09735e1810ae4ea9b6a22e11d3aee0d79'},
  band:{path:'captures/foundation-domain-native-2026-09-30-v3/band.glb',sha256:'3793206f8f7a95a632705b02756bff9c35c5a934f266dc6bd790d076278671cd'}};
const extra=['tools/critic/foundation-domain-motion.mjs','tools/figure-pipeline/collar_capture_browser.mjs',
  'docs/evidence/wardrobe-2026-09-30/foundation-domain-motion/PLAN.md'];
const sources=()=>({...collectSourceHashes(),...Object.fromEntries(extra.map(p=>[p,hashFile(path.join(ROOT,p))]))});
const report={started:new Date().toISOString(),pid:process.pid,status:'running',sourceHashes:sources(),arms,runs:[],errors:[],
  schedule:{nativeHz:60,steps:720,imageEvery:12,snapshots:[0,240,480,720]},
  scope:'Actual ordinary movement and three outfits; CPU-skinned snapshots are not GPU readback or continuous fit/coverage proof.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
for(const p of Object.keys(report.sourceHashes).filter(p=>!p.startsWith('assets/')&&!p.startsWith('node_modules/'))){const dest=path.join(out,'source',p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(ROOT,p),dest);}
for(const[id,a]of Object.entries(arms)){assert.equal(hashFile(path.join(ROOT,a.path)),a.sha256);fs.copyFileSync(path.join(ROOT,a.path),path.join(out,id+'.glb'));}
const disk=fs.statfsSync(out);report.availableBytes=Number(disk.bavail)*Number(disk.bsize);assert.ok(report.availableBytes>4*1024**3);save();
const held=new Map();let server,browser,page;
try{
  server=await startProbeServer({port:5301});browser=await launchProbeBrowser();report.baseUrl=server.baseUrl;
  for(const[arm,asset]of Object.entries(arms))for(const outfit of ['foundation','casual','elegant']){
    const key=arm+'-'+outfit,dir=path.join(out,key);fs.mkdirSync(dir);
    const rec={key,arm,outfit,images:[],geometry:[],states:[],assets:[],errors:[],warnings:[]},reads=[];report.runs.push(rec);save();
    page=await browser.newPage({viewport:{width:800,height:1000},deviceScaleFactor:1,reducedMotion:'no-preference'});
    page.on('pageerror',e=>rec.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')rec.errors.push(m.text());if(m.type()==='warning')rec.warnings.push(m.text());});page.on('requestfailed',r=>rec.errors.push(`${r.url()} ${r.failure()?.errorText}`));
    if(arm!=='shipped')await page.route('**/assets/wardrobe/foundation_bra/g050.glb',r=>r.fulfill({status:200,contentType:'model/gltf-binary',body:fs.readFileSync(path.join(ROOT,asset.path))}));
    page.on('response',r=>{if(r.status()>=400)rec.errors.push(`${r.status()} ${r.url()}`);const u=new URL(r.url());if(r.ok()&&u.pathname.endsWith('.glb')&&!u.searchParams.has('import'))reads.push(r.body().then(bytes=>{const at=u.pathname.indexOf('/assets/');assert.ok(at>=0);const file=u.pathname.slice(at+1),expected=file===basePath?asset.sha256:report.sourceHashes[file];assert.equal(sha256(bytes),expected,file);rec.assets.push({file,sha256:sha256(bytes),bytes:bytes.length});}).catch(e=>rec.errors.push(e.stack)));});
    await page.route('**/foundation-motion-fixture.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head><link rel="icon" href="data:,"><style>html,body{margin:0}canvas{width:800px;height:1000px;display:block}</style></head><body><canvas></canvas></body></html>'}));
    await page.goto(server.baseUrl+'/foundation-motion-fixture.html');
    rec.setup=await page.evaluate(async({root,outfit})=>{
      const{Avatar}=await import(`/@fs${root}/packages/core/src/Avatar.js`),{optionsForShowcase,resolveShowcaseSelection}=await import(`/@fs${root}/packages/testbed/src/showcase-presets.mjs`);
      const options=optionsForShowcase(resolveShowcaseSelection(new URLSearchParams({preset:'casual',outfit:outfit==='foundation'?'casual':outfit,style:'original',frame:'portrait',light:'neutral',hairColour:'#413934'})));
      window.subject=await Avatar.create({canvas:document.querySelector('canvas'),...options,autoStart:false});
      window.motionHelper=await import(`/@fs${root}/tools/figure-pipeline/collar_capture_browser.mjs`);
      if(outfit==='foundation')await subject.dress([]);
      const a=subject,f=a.stage.renderer._nodes.nodeFrame;a.stage.renderer._animation.stop();f.frameId=0;f.time=0;f.deltaTime=0;f.lastTime=undefined;a.stage.temporal?.resetFrameEpoch();
      const target=a.focus.clone().set(0,1.30,0),radius=1.20,angle=25*Math.PI/180,c=a.stage.camera;
      c.position.set(radius*Math.sin(angle),1.34,radius*Math.cos(angle));c.lookAt(target);c.updateMatrixWorld(true);
      for(let i=0;i<98;i++){f.update();f.time=0;f.deltaTime=0;await a.step(0);}
      f.update();f.time=0;f.deltaTime=0;a.stage.draw();await a.stage.renderer.backend.device.queue.onSubmittedWorkDone();
      const lights=[];a.stage.scene.traverse(o=>{if(o.isLight)lights.push({name:o.name,type:o.type,colour:o.color.toArray(),groundColour:o.groundColor?.toArray()??null,intensity:o.intensity,matrix:o.matrixWorld.toArray()});});
      return{backend:a.stage.backendName,adapter:{vendor:a.stage.renderer.backend.device?.adapterInfo?.vendor,architecture:a.stage.renderer.backend.device?.adapterInfo?.architecture},identity:a.report().identity,hair:a.report().hair.loadedStyle,motion:a.report().motion,layers:a.stack.layers.map(l=>({name:l.name,order:l.order,enabled:l.enabled})),lights,camera:c.matrixWorld.toArray(),projection:c.projectionMatrix.toArray(),target:target.toArray(),radius,clock:a.clockSeconds,frame:f.frameId,wardrobe:a.report().wardrobe};
    },{root:ROOT,outfit});
    assert.equal(rec.setup.backend,'webgpu');assert.equal(rec.setup.hair,'bob02');assert.equal(rec.setup.clock,0);assert.equal(rec.setup.frame,99);assert.equal(rec.setup.motion.seed,20260807);
    const selected=await page.evaluate(()=>[...subject.wardrobe.wornMeshes.keys()].sort());rec.selectedMeshes=selected;
    assert.ok(selected.includes('foundation_bra')&&selected.includes('foundation_briefs'));
    assert.ok(outfit==='foundation'?selected.length===2:selected.includes(outfit==='casual'?'female_casualsuit01':'female_elegantsuit01'));
    for(let step=0;step<=720;step++){
      if(step)await page.evaluate(async()=>{const a=subject,f=a.stage.renderer._nodes.nodeFrame;f.update();f.time=a.clockSeconds+1/60;f.deltaTime=1/60;await a.step(1/60);});
      if(step%12===0){
        const observed=await page.evaluate(async()=>{const a=subject,f=a.stage.renderer._nodes.nodeFrame;await a.stage.renderer.backend.device.queue.onSubmittedWorkDone();return{data:a.stage.canvas.toDataURL('image/png'),state:{physical:await motionHelper.physical(a),frame:f.frameId,time:f.time,delta:f.deltaTime,rig:Array.from(a.figure.body.skeleton.boneMatrices),morphs:Array.from(a.figure.body.morphTargetInfluences),affect:a.report().affect,gesture:a.gesture.report()}};});
        assert.equal(observed.state.frame,99+step);assert.ok(Math.abs(observed.state.time-step/60)<1e-9);assert.ok(Math.abs(observed.state.physical.clock-step/60)<1e-9);
        const file=key+'/frame-'+String(step).padStart(4,'0')+'.png',bytes=Buffer.from(observed.data.split(',')[1],'base64');fs.writeFileSync(path.join(out,file),bytes);rec.images.push({step,file,sha256:sha256(bytes)});rec.states.push({step,...observed.state});
      }
      if(report.schedule.snapshots.includes(step)){
        const snapshot=await page.evaluate(()=>motionHelper.snapshot(subject));
        const file=key+'/meshes-'+step+'.json.gz',raw=Buffer.from(JSON.stringify(snapshot)+'\n'),bytes=gzipSync(raw);fs.writeFileSync(path.join(out,file),bytes);
        const invariant=structuredClone(snapshot);invariant.meshes=invariant.meshes.filter(m=>m.id!=='foundation_bra');
        const token=outfit+'-'+step;if(held.has(token))assert.deepEqual(invariant,held.get(token),'Non-foundation snapshot changed');else held.set(token,invariant);
        const band=snapshot.meshes.find(m=>m.id==='foundation_bra');assert.ok(band);
        rec.geometry.push({step,file,sha256:sha256(bytes),decodedSHA256:sha256(raw),time:snapshot.time,bandVertices:band.positions.length/3,bandTriangles:band.fullIndices.length/3,drawnBandTriangles:band.drawnIndices.length/3});
      }
      if(step%120===0)save();
    }
    rec.rear=await page.evaluate(async()=>{
      const a=subject,c=a.stage.camera,target=a.focus.clone().set(0,1.30,0),f=a.stage.renderer._nodes.nodeFrame;
      const before={snapshot:motionHelper.snapshot(a),physical:await motionHelper.physical(a),morphs:Array.from(a.figure.body.morphTargetInfluences)};
      c.position.set(0,1.34,-1.20);c.lookAt(target);c.updateMatrixWorld(true);
      // Converge the alternate camera using draws only. A step(0) still advances motion layers.
      for(let i=0;i<99;i++){f.update();f.time=a.clockSeconds;f.deltaTime=0;a.stage.draw();await a.stage.renderer.backend.device.queue.onSubmittedWorkDone();}
      const after={snapshot:motionHelper.snapshot(a),physical:await motionHelper.physical(a),morphs:Array.from(a.figure.body.morphTargetInfluences)};
      return{data:a.stage.canvas.toDataURL('image/png'),clock:a.clockSeconds,frame:f.frameId,camera:c.matrixWorld.toArray(),projection:c.projectionMatrix.toArray(),physical:after.physical,poseReceipt:{before,after}};
    });
    const poseRaw=Buffer.from(JSON.stringify(rec.rear.poseReceipt)+'\n'),poseBytes=gzipSync(poseRaw),poseFile=key+'/rear-pose-receipt.json.gz';fs.writeFileSync(path.join(out,poseFile),poseBytes);
    const{before,after}=rec.rear.poseReceipt;delete rec.rear.poseReceipt;rec.rear.poseReceipt={file:poseFile,sha256:sha256(poseBytes),decodedSHA256:sha256(poseRaw)};save();
    assert.deepEqual(after.snapshot,before.snapshot,'Rear draw changed full physical geometry/rig');assert.deepEqual(after.morphs,before.morphs,'Rear draw changed body morph weights');
    const withoutCamera=p=>Object.fromEntries(Object.entries(p).filter(([k])=>!['projection','view','camera'].includes(k)));
    assert.deepEqual(withoutCamera(after.physical),withoutCamera(before.physical),'Rear draw changed simulation state');
    const rearBytes=Buffer.from(rec.rear.data.split(',')[1],'base64');delete rec.rear.data;rec.rear.file=key+'/rear-720.png';rec.rear.sha256=sha256(rearBytes);fs.writeFileSync(path.join(out,rec.rear.file),rearBytes);assert.ok(Math.abs(rec.rear.clock-12)<1e-9);
    await Promise.all(reads);assert.equal(rec.assets.filter(a=>a.file===basePath).length,1);assert.equal(rec.images.length,61);assert.equal(rec.geometry.length,4);assert.deepEqual(rec.errors,[]);
    rec.disposal=await page.evaluate(()=>{subject.dispose();return subject.report().disposal;});assert.equal(rec.disposal.disposed,true);assert.deepEqual(rec.disposal.leaked,[]);assert.deepEqual(rec.errors,[]);await page.close();page=null;rec.completed=true;save();console.log(key);
  }
  for(const outfit of ['foundation','casual','elegant']){
    const a=report.runs.find(r=>r.arm==='shipped'&&r.outfit===outfit),b=report.runs.find(r=>r.arm==='band'&&r.outfit===outfit);
    assert.deepEqual(a.states,b.states,'Paired non-foundation motion state changed');
    for(const k of ['identity','hair','motion','layers','lights','camera','projection','target','radius','clock','frame'])assert.deepEqual(a.setup[k],b.setup[k],k);
    assert.deepEqual(a.rear.physical,b.rear.physical,'Paired rear physical state changed');
  }
  assert.deepEqual(sources(),report.sourceHashes);for(const a of Object.values(arms))assert.equal(hashFile(path.join(ROOT,a.path)),a.sha256);report.status='captured-awaiting-fit-and-visual-review';
}catch(error){report.status='failed';report.errors.push(error.stack);process.exitCode=1;}
finally{if(page&&!page.isClosed())try{report.failureDisposal=await page.evaluate(()=>{if(!window.subject)return null;subject.dispose();return subject.report().disposal;});}catch(e){report.errors.push(e.message);}report.finished=new Date().toISOString();save();await browser?.close();await server?.close();}
