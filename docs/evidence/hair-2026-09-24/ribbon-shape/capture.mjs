import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {decodePng} from '../../../tools/critic/png.mjs';
import {startProbeServer,launchProbeBrowser} from '../../../packages/core/src/render/MotionProbe.mjs';
const root=path.resolve(process.env.RIBBON_CAPTURE_OUT || 'tmp/hair-sep24/ribbon-shape/closest-capture');
let baselineCentre;
const sha=data=>createHash('sha256').update(data).digest('hex');
const [candidate,style='crop01']=process.argv.slice(2);
const arms={baseline:`assets/hair/${style}/g050.glb`,candidate};
const report={style,arms:{},errors:[],scope:'hair.html PBR stills and four-second shake; not public Avatar material or full-body contact qualification'};
const server=await startProbeServer({port:5187});let browser;
try{
 browser=await launchProbeBrowser();
 for(const [arm,input] of Object.entries(arms)){
  const out=path.join(root,style,arm);fs.mkdirSync(out,{recursive:true});
  const data=fs.readFileSync(input),row=report.arms[arm]={input,sha256:sha(data),loads:[],frames:[]};
  for(const motion of [false,true]){
   const context=await browser.newContext({viewport:{width:1400,height:1100},deviceScaleFactor:1});
   const page=await context.newPage();
   page.on('pageerror',e=>report.errors.push(String(e)));
   page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
   await page.route('**/src/hair.js',async route=>{
    const response=await route.fetch();
    let body=(await response.text()).replace(
     /const camera = new PerspectiveCamera\(\s*38,\s*WIDTH \/ HEIGHT,\s*0\.05,\s*20\s*\);/,
     'const camera = new PerspectiveCamera(38, WIDTH / HEIGHT, 0.05, 20); window.__CAP_INSPECT__ = () => ({centre: centre.toArray(), camera: camera.position.toArray(), head: figure.scene.getObjectByName("head").matrixWorld.elements.slice()});');
    assert.ok(body.includes('window.__CAP_INSPECT__ ='));
    assert.ok(body.includes('await place();'));
    const hairAdded='scene.add( hair.scene );';
    assert.ok(body.includes(hairAdded));
    body=body.replace(hairAdded, `${hairAdded}
    const captureHairMeshes=[]; hair.scene.traverse(o=>{if(o.isMesh)captureHairMeshes.push(o);});
    let captureHairParents;
    window.__RIBBON_BODY__=async hidden=>{
     if(hidden){ captureHairParents=captureHairMeshes.map(o=>o.parent); for(const o of captureHairMeshes)o.removeFromParent(); }
     else { captureHairMeshes.forEach((o,i)=>captureHairParents[i].add(o)); }
     await place();
    };`);
    if(arm==='candidate'){
     assert.ok(baselineCentre);
     const before='const centre = bounds.getCenter( new Vector3() );';
     assert.ok(body.includes(before));
     body=body.replace(before, `const centre = new Vector3(...${JSON.stringify(baselineCentre)});`);
    }
    await route.fulfill({response,body});
   });
   await page.route(`**/assets/hair/${style}/g050.glb`,route=>{row.loads.push(sha(data));return route.fulfill({body:data,contentType:'model/gltf-binary'});});
   await page.goto(`${server.baseUrl}/src/hair.html?groom=${style}&bake=g050&capture=1${motion?'&motion=1&head=shake':''}`);
   await page.waitForFunction(m=>typeof window.hairShot==='function'&&document.querySelector('#hud').textContent.includes('Renderer')&&(!m||typeof window.__HAIR_MEASURE__==='function'),motion,{timeout:120000});
   const hud=await page.locator('#hud').textContent();assert.match(hud,/WebGPU/);assert.doesNotMatch(hud,/FAILED/);
   fs.writeFileSync(path.join(out,motion?'motion-hud.txt':'still-hud.txt'),hud);
   const inspection=await page.evaluate(()=>window.__CAP_INSPECT__());
   if(arm==='baseline')baselineCentre=inspection.centre;
   else assert.deepEqual(inspection.centre,baselineCentre);
   if(!motion){
    for(const view of ['front','three-quarter','side','back','top']){
     await page.evaluate(v=>window.hairShot(v),view);
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     await page.locator('#stage').screenshot({path:path.join(out,`${view}.png`)});
    }
   }else{
    await page.evaluate(()=>window.hairShot('three-quarter'));
    for(let frame=1;frame<=240;frame++){
     await page.evaluate(()=>window.__HAIR_STEP__(1/60));
     if(frame===1||frame%6===0){
      const state=await page.evaluate(async()=>{
       const m=await window.__HAIR_MEASURE__();delete m.tips;
       const c=await window.__HAIR__.dynamics.readCentrelines();
       return {clock:window.__HAIR_CLOCK__(),view:window.__CAP_INSPECT__(),measurement:m,positions:Array.from(c.positions),velocities:Array.from(c.velocities)};
      });
      const {positions,velocities,...compact}=state;
      assert.ok(positions.every(Number.isFinite)&&velocities.every(Number.isFinite));
      row.frames.push({frame,...compact,positionsSha256:sha(JSON.stringify(positions)),velocitiesSha256:sha(JSON.stringify(velocities))});
      if(frame===1||frame%60===0){
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     await page.locator('#stage').screenshot({path:path.join(out,`motion-${frame}.png`)});
     await page.evaluate(()=>window.__RIBBON_BODY__(true));
     await page.locator('#stage').screenshot({path:path.join(out,`body-${frame}.png`)});
     await page.evaluate(()=>window.__RIBBON_BODY__(false));
      }
     }
    }
   }
   await context.close();
  }
 }
 assert.deepEqual(report.errors,[]);
 for(let i=0;i<report.arms.baseline.frames.length;i++){
  const a=report.arms.baseline.frames[i],b=report.arms.candidate.frames[i];
  assert.equal(a.measurement.nonFinite,0);assert.equal(b.measurement.nonFinite,0);
  for(const state of [a,b]){assert.equal(state.clock.frameId,state.clock.draws);assert.ok(Math.abs(state.clock.time-state.frame/60)<1e-12);}
  assert.deepEqual(a.view,b.view,`View or body pose differs at ${a.frame}`);
  for(const state of [a,b]){
   assert.ok(state.measurement.worstSegmentErrorMm<0.01,'Existing HairDynamics inextensibility limit');
   assert.ok(state.measurement.deepestPenetrationMm<0.05,'Existing HairDynamics fitted-sphere penetration limit');
  }
 }
 const faceDifference=(left,right)=>{
  const a=decodePng(fs.readFileSync(left)),b=decodePng(fs.readFileSync(right));let changed=0;
  assert.equal(a.width,b.width);assert.equal(a.height,b.height);
  for(let y=540;y<610;y++)for(let x=240;x<380;x++){
   const k=(y*a.width+x)*4;if([0,1,2].some(c=>a.pixels[k+c]!==b.pixels[k+c]))changed++;
  }
  return changed;
 };
 report.facePixelControl={rect:[240,540,140,70],frames:report.arms.baseline.frames.filter(f=>f.frame===1||f.frame%60===0).map(f=>({frame:f.frame,
  changed:faceDifference(path.join(root,style,'baseline',`motion-${f.frame}.png`),path.join(root,style,'candidate',`motion-${f.frame}.png`))}))};
 // Changed card geometry can occlude this old face ROI. Verify the entire rendered body
 // independently with the actual hair meshes detached, instead of assuming a hair-free ROI.
 report.bodyPixelControl={frames:report.facePixelControl.frames.map(({frame})=>{
  const left=fs.readFileSync(path.join(root,style,'baseline',`body-${frame}.png`));
  const right=fs.readFileSync(path.join(root,style,'candidate',`body-${frame}.png`));
  const a=decodePng(left),b=decodePng(right);
  assert.equal(a.width,b.width);assert.equal(a.height,b.height);
  let changed=0;for(let k=0;k<a.pixels.length;k+=4)if([0,1,2].some(c=>a.pixels[k+c]!==b.pixels[k+c]))changed++;
  assert.equal(changed,0,`Detached-hair body image differs at ${frame}`);
  return {frame,changed,baselineSha256:sha(left),candidateSha256:sha(right)};
 })};
 report.facePixelControl.wrongFrameChanged=faceDifference(path.join(root,style,'baseline','motion-60.png'),path.join(root,style,'baseline','motion-120.png'));
 assert.ok(report.facePixelControl.wrongFrameChanged>0,'Face control must detect a mismatched pose');
 report.sampledMotionConstraintsPassed=true;
 console.log('PASS actual WebGPU: five views and 41 sampled shake states per arm; existing segment-length and fitted-sphere limits pass. Geometry differs, so dynamics are not required to match.');
}catch(error){report.error=error.stack;throw error;}finally{
 fs.writeFileSync(path.join(root,`${style}-gpu.json`),JSON.stringify(report,null,2));
 await browser?.close();await server.close();
}
