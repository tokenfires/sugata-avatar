/** One native Showcase packet with pose-bound, explicitly unoccluded design annotations. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readGlb,readPrimitive} from '../lut-bake/glb.mjs';
import {startProbeServer,launchProbeBrowser} from '../../packages/core/src/render/MotionProbe.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const rel='captures/hair-boundary-2026-10-02-v1',out=path.join(root,rel);
assert.ok(!fs.existsSync(out),'One fresh packet only.');fs.mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(path.join(root,p));
const target='docs/evidence/appearance-2026-10-02/front-design/boundary-landmarks.json';
const candidate='captures/bob-lower-fallback-v1/candidate.glb';
assert.equal(sha(read(target)),'4df88cf6fda7f0633127b62cda3ad5ab0e2801acb8b5558437e1959af48b3bd8');
assert.equal(sha(read(candidate)),'8c458428551ca546d2aac511dec3b516067d53050de9663a563b9884a4ae5fe7');
const landmarks=JSON.parse(read(target));
for(const [p,h]of Object.entries(landmarks.sourceHashes))assert.equal(sha(read(p)),h,p);
const body=readPrimitive(readGlb(path.join(root,landmarks.bodyFile)),'base.001');
const sources=[target,candidate,landmarks.bodyFile,'assets/wardrobe/body/g050.glb',
'tools/critic/capture-hair-boundary.mjs','tools/critic/author-hair-boundary.mjs','tools/lut-bake/glb.mjs',
'packages/core/src/render/MotionProbe.mjs','packages/core/src/Avatar.js','packages/core/src/render/Stage.js',
'packages/core/src/figure/Figure.js','packages/core/src/wardrobe/Wardrobe.js','packages/core/src/motion/HairDynamics.js',
'packages/testbed/src/showcase.js','packages/testbed/src/showcase-presets.mjs',
'packages/testbed/src/viewer-framing.mjs','node_modules/three/src/objects/SkinnedMesh.js',
'node_modules/three/src/objects/Mesh.js','package-lock.json',
'node_modules/three/examples/jsm/loaders/GLTFLoader.js',
'docs/evidence/appearance-2026-10-02/front-design/BOUNDARY-PLAN.md',
'docs/evidence/appearance-2026-10-02/front-design/BOUNDARY-AUTHORING.md'];
const report={started:new Date().toISOString(),pid:process.pid,status:'running',sourceHashes:Object.fromEntries(sources.map(p=>[p,sha(read(p))])),views:[],errors:[],
 limits:['One fixed design proposal, not groom appearance/fit acceptance.','SVG annotations are unoccluded, straight landmark joins and open endpoints; no continuous partition.','All32landmarks are morph→skin→world per triangle corner, then barycentrically interpolated.','Whole inward groom includes all34fringe cards; bare-head diagnostic hides whole hair root only.']};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
save();
for(const p of sources.filter(p=>!p.endsWith('.glb'))){const dest=path.join(out,'source',p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,p),dest);}
let server,browser,page,primaryError;
try{
 server=await startProbeServer({port:5297});browser=await launchProbeBrowser();
 page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 let loads=0;await page.route('**/hair/bob02/g050.glb',async r=>{loads++;await r.fulfill({status:200,contentType:'model/gltf-binary',body:read(candidate)});});
 await page.goto(`${server.baseUrl}/src/showcase.html?preset=casual&frame=portrait&scene=studio&light=studio&capture`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.showcase||!document.querySelector('#error').hidden,null,{timeout:120000});
 assert.equal(await page.locator('#error').textContent(),'');assert.equal(loads,1);
 const setup=await page.evaluate(async({landmarks,positions,indices})=>{
  const a=showcase.avatar,b=a.figure.body,r=a.stage.renderer,n=r._nodes?.nodeFrame;
  if(a.stage.backendName!=='webgpu'||typeof r._animation?.stop!=='function')throw new Error('Native owned capture unavailable.');
  r._animation.stop();n.frameId=0;n.time=0;n.deltaTime=0;n.lastTime=undefined;a.stage.temporal?.resetFrameEpoch();
  window.boundaryTick=()=>{n.update();n.time=0;n.deltaTime=0;};
  showcase.controls.enableDamping=false;showcase.controls.update();
  window.boundaryOrbit={target:showcase.controls.target.toArray(),radius:a.stage.camera.position.distanceTo(showcase.controls.target)};
  if(b.geometry.attributes.position.count*3!==positions.length||!positions.every((x,i)=>x===b.geometry.attributes.position.array[i]))throw new Error('Actual body positions differ from pinned g050.');
  if(!indices.every((x,i)=>x===a.wardrobe.fullIndex[i])||indices.length!==a.wardrobe.fullIndex.length)throw new Error('Actual fullIndex differs from pinned body.');
  const requestedConfiguration=showcase.configuration();
  const rgb=[0x76,0x53,0x44].map(x=>x/255);a.hairMaterial.hairUniforms.baseColour.value.fromArray(rgb.map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4));
  const canvas=document.querySelector('#stage');
  window.boundaryState=()=>({clock:a.clockSeconds,morphs:Array.from(b.morphTargetInfluences),bodyMatrix:b.matrixWorld.toArray(),bindMatrix:b.bindMatrix.toArray(),bindMatrixInverse:b.bindMatrixInverse.toArray(),
   boneInverses:b.skeleton.boneInverses.map(m=>m.toArray()),bones:b.skeleton.bones.map(o=>({name:o.name,matrix:o.matrixWorld.toArray()})),
   camera:{position:a.stage.camera.position.toArray(),quaternion:a.stage.camera.quaternion.toArray(),world:a.stage.camera.matrixWorld.toArray(),inverse:a.stage.camera.matrixWorldInverse.toArray(),projection:a.stage.camera.projectionMatrix.toArray()},
   canvas:[canvas.width,canvas.height],configuration:requestedConfiguration});
  window.boundaryProject=name=>{
   b.updateWorldMatrix(true,false);b.skeleton.update();a.stage.camera.updateMatrixWorld();
   const result={};
   for(const key of ['opening','part'])result[key]=landmarks.orientations[name][key].map(anchor=>{
    const corners=anchor.indices.map(i=>b.getVertexPosition(i,b.position.clone()).applyMatrix4(b.matrixWorld));
    const world=b.position.clone().set(0,0,0);corners.forEach((p,k)=>world.addScaledVector(p,anchor.bary[k]));
    const ndc=world.clone().project(a.stage.camera);
    return {...anchor,worldCorners:corners.map(p=>p.toArray()),world:world.toArray(),ndc:ndc.toArray(),pixel:[(ndc.x+1)*canvas.width/2,(1-ndc.y)*canvas.height/2]};
   });return result;
  };
  window.boundaryOverlay=(name,visible)=>{
   document.querySelector('#boundary-svg')?.remove();if(!visible)return null;
   const data=boundaryProject(name),rect=canvas.getBoundingClientRect(),ns='http://www.w3.org/2000/svg';
   const svg=document.createElementNS(ns,'svg');svg.id='boundary-svg';svg.setAttribute('viewBox',`0 0 ${canvas.width} ${canvas.height}`);
   Object.assign(svg.style,{position:'fixed',left:rect.x+'px',top:rect.y+'px',width:rect.width+'px',height:rect.height+'px',zIndex:9999,pointerEvents:'none'});
   for(const [key,color]of [['opening','#55efff'],['part','#ffc34a']]){
    const line=document.createElementNS(ns,'polyline');line.setAttribute('points',data[key].map(p=>p.pixel.join(',')).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke',color);line.setAttribute('stroke-width','3');svg.append(line);
    for(const p of data[key]){const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',p.pixel[0]);dot.setAttribute('cy',p.pixel[1]);dot.setAttribute('r','3');dot.setAttribute('fill',color);svg.append(dot);}
   }
   const label=document.createElementNS(ns,'text');label.setAttribute('x','18');label.setAttribute('y',String(canvas.height-28));label.setAttribute('fill','#fff');label.setAttribute('stroke','#111');label.setAttribute('stroke-width','3');label.setAttribute('paint-order','stroke');label.setAttribute('font-size','16');label.textContent=`${name}: cyan opening / amber part · unoccluded design annotations`;svg.append(label);document.body.append(svg);
   return data;
  };
  boundaryTick();await showcase.step(0);for(let i=0;i<96;i++){boundaryTick();await showcase.step(0);}
  const vertexIds=[...new Set(Object.values(landmarks.orientations).flatMap(o=>[...o.opening,...o.part]).flatMap(p=>p.indices))].sort((x,y)=>x-y);
  const attrs=b.geometry.attributes,activeMorphs=b.morphTargetInfluences.map((weight,index)=>({index,weight,name:Object.keys(b.morphTargetDictionary).find(k=>b.morphTargetDictionary[k]===index)})).filter(p=>p.weight!==0);
  const values=(attr,i)=>Array.from({length:attr.itemSize},(_,k)=>attr.array[i*attr.itemSize+k]);
  const poseInputs={scope:'Actual runtime pose-equation inputs for every distinct corner used by32landmarks.',morphTargetsRelative:b.geometry.morphTargetsRelative,activeMorphs,
   vertices:vertexIds.map(index=>({index,position:values(attrs.position,index),joints:values(attrs.skinIndex,index),weights:values(attrs.skinWeight,index),morphs:activeMorphs.map(m=>({index:m.index,name:m.name,delta:values(b.geometry.morphAttributes.position[m.index],index)}))}))};
  return {backend:a.stage.backendName,adapter:r.backend.adapter?.info??r.backend.device?.adapterInfo??null,state:boundaryState(),tint:a.hairMaterial.hairUniforms.baseColour.value.toArray(),poseInputs};
 },{landmarks,positions:Array.from(body.positions),indices:Array.from(body.indices)});
 assert.equal(setup.backend,'webgpu');report.setup=setup;save();
 for(const [view,angle,hidden,orientations]of [['front-full',0,false,['A','B']],['front-bare',0,true,['A','B']],['left-bare',-45,true,['A']],['right-bare',45,true,['B']]]){
  const state=await page.evaluate(async({angle,hidden})=>{const a=showcase.avatar,c=showcase.controls,target=c.target.clone().fromArray(boundaryOrbit.target),radius=boundaryOrbit.radius;boundaryOverlay('A',false);a.hairRoot.visible=!hidden;const theta=angle*Math.PI/180;a.stage.camera.position.set(target.x+radius*Math.sin(theta),target.y,target.z+radius*Math.cos(theta));a.stage.camera.lookAt(target);c.update();for(let i=0;i<24;i++){boundaryTick();await showcase.step(0);}return boundaryState();},{angle,hidden});
  assert.deepEqual(state.morphs,setup.state.morphs);assert.deepEqual(state.bones,setup.state.bones);assert.deepEqual(state.bodyMatrix,setup.state.bodyMatrix);
  if(view==='front-bare')assert.deepEqual(state.camera,report.views[0].state.camera,'Whole/bare front camera must match.');
  const canvas=await page.evaluate(()=>document.querySelector('#stage').toDataURL('image/png'));
  const rawFile=view+'-beauty.png';fs.writeFileSync(path.join(out,rawFile),Buffer.from(canvas.split(',')[1],'base64'));
  const record={view,angle,hairHidden:hidden,fullGroomIncludesFringe:true,state,beauty:{file:rawFile,sha256:sha(read(rel+'/'+rawFile))},annotations:[]};
  for(const orientation of orientations){
   const projected=await page.evaluate(name=>boundaryOverlay(name,true),orientation);
   const after=await page.evaluate(()=>({state:boundaryState(),canvas:document.querySelector('#stage').toDataURL('image/png'),rect:(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})()}));
   assert.deepEqual(after.state,state);assert.equal(after.canvas,canvas,'Annotation must retain exact underlying native canvas.');
   const file=view+'-'+orientation+'.png';await page.screenshot({path:path.join(out,file),clip:after.rect});
   record.annotations.push({orientation,file,sha256:sha(read(rel+'/'+file)),unoccluded:true,projected});
  }
  report.views.push(record);save();console.log(JSON.stringify({captured:view,annotations:record.annotations.length,pid:process.pid}));
 }
 assert.deepEqual(report.errors,[]);for(const [p,h]of Object.entries(report.sourceHashes))assert.equal(sha(read(p)),h,p);
 await page.evaluate(()=>{boundaryOverlay('A',false);showcase.controls.dispose();showcase.avatar.dispose();});report.explicitAvatarRetired=true;
 report.status='captured';
}catch(e){primaryError=e;report.status='failed';report.errors.push(e.stack);}
finally{
 report.cleanup={};
 for(const [name,resource]of [['page',page],['browser',browser],['server',server]]){
  if(!resource){report.cleanup[name]='not-created';continue;}
  try{await resource.close();report.cleanup[name]='closed';}catch(e){report.cleanup[name]={error:e.stack};report.errors.push(`${name} cleanup: ${e.message}`);report.status='failed';primaryError??=e;}
 }
 report.ownedBrowserAndServerClosed=['browser','server'].every(k=>['closed','not-created'].includes(report.cleanup[k]));
 report.finished=new Date().toISOString();save();console.log(JSON.stringify({out,status:report.status,pid:report.pid,cleanup:report.cleanup}));
}
if(primaryError)throw primaryError;
