// Deterministic native-motion capture, tracked so a clean checkout needs no historical archive.
// The clock/coverage protocol follows the September 16 instrument; experiments are not enabled.
import {Vector3} from 'three';
import {hairDitherOffsetValue} from '../../packages/core/src/render/HairOIT.js';
import {morphVelocityMode} from '../../packages/core/src/render/MorphVelocity.js';
const raf=()=>new Promise(requestAnimationFrame);
const sha=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a.buffer.slice(a.byteOffset,a.byteOffset+a.byteLength)))).map(v=>v.toString(16).padStart(2,'0')).join('');
const equal=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(label);};
const meshes=a=>{const out=[];a.figure.root.traverse(o=>{if(o.isMesh&&a.cards.includes(o.material))out.push(o);});return out;};
function materialState(m){return{name:m.name,alphaTest:m.alphaTest,alphaToCoverage:m.alphaToCoverage,alphaHash:m.alphaHash,transparent:m.transparent,depthWrite:m.depthWrite,specularIntensity:m.specularIntensity,roughness:m.roughness,metalness:m.metalness,color:m.color.toArray(),colorNode:m.colorNode?.uuid,map:m.map?.uuid,side:m.side,positionNode:m.positionNode?.uuid??null,mrtNode:m.mrtNode?.uuid??null,maskNode:m.maskNode?.uuid??null,maskShadowNode:m.maskShadowNode?.uuid??null,castShadowNode:m.castShadowNode?.uuid??null};}
export async function physical(a){
 const c=await a.hairDynamics.readCentrelines(),v=await a.hairDynamics.readVertices(),cam=a.stage.camera;
 const cards=[];
 for(const o of meshes(a)){const p=new Float32Array(o.geometry.attributes.position.count*3),v=new Vector3();for(let i=0;i<p.length/3;i++){o.getVertexPosition(i,v).applyMatrix4(o.matrixWorld);v.toArray(p,i*3);}cards.push({name:o.name,positions:await sha(p),weights:Array.from(o.morphTargetInfluences),boneMatrices:await sha(o.skeleton.boneMatrices)});}
 return{hairPositions:await sha(c.positions),hairVelocities:await sha(c.velocities),hairVertices:await sha(v.positions),head:await sha(Float64Array.from(c.headMatrix)),clock:a.clockSeconds,steps:c.steps,cards,projection:cam.projectionMatrix.toArray(),view:cam.matrixWorldInverse.toArray(),camera:cam.matrixWorld.toArray()};
}
const traces = new WeakMap();
function traceDraws(a, owner) {
 const t={draws:[],after:[],restores:[]};traces.set(a,t);
 for(const object of meshes(a)){
  const previous=object.onBeforeRender;
  object.onBeforeRender=function(renderer,scene,camera,geometry,material,group){
   previous.call(this,renderer,scene,camera,geometry,material,group);
   if(camera!==a.stage.camera || material!==object.material)return;
   const frameId=renderer._nodes.nodeFrame.frameId;
   t.draws.push({name:object.name,frameId,epoch:a.stage.temporal.frameEpoch(),viewOffset:camera.view?{...camera.view}:null,projection:camera.projectionMatrix.toArray(),morphWeights:Array.from(object.morphTargetInfluences),bones:Array.from(object.skeleton.boneMatrices)});
  };
  t.restores.push(()=>{object.onBeforeRender=previous;});
 }
 t.afterDraw=()=>{const frameId=a.stage.renderer._nodes.nodeFrame.frameId,expected=hairDitherOffsetValue(frameId,0),actual=owner?.offset?.value??null;
  const offsets=[],enabled=[];if(owner===a.faceCardCoverage&&owner.report().managedMaterials){for(const m of a.cards)m.alphaTestNode.traverse(n=>{if(n.name==='faceCardCoverageOffset')offsets.push(n.value);if(n.name==='faceCardCoverageEnabled')enabled.push(n.value);});if(offsets.some(v=>v!==expected)||enabled.some(v=>v!==1))throw Error('Owned draw has wrong phase/coverage: '+JSON.stringify({offsets,enabled,expected}));}
  if(actual!==null && actual!==expected)throw Error('Dither uniform disagrees with actual draw frame');
  t.after.push({frameId,epoch:a.stage.temporal.frameEpoch(),expectedOffset:expected,actualOffset:actual,ownedOffsets:offsets,ownedEnabled:enabled,hairOffset:a.hairMaterial.hairDitherOffset?.value??null});
 };
 return t;
}
export function trace(a){const t=traces.get(a);return{draws:t.draws,after:t.after};}
export async function barrier(a){await a.stage.renderer.backend.device.queue.onSubmittedWorkDone();await raf();}
function beginCapturedFrame(a, dt) {
 const t=traces.get(a),n=a.stage.renderer._nodes.nodeFrame;
 if(!t?.clock)throw Error('Capture clock not installed');
 n.update();t.clock.frames++;t.clock.time+=dt;n.time=t.clock.time;n.deltaTime=dt;a.stage.renderer.info.frame=n.frameId;
 if(n.frameId!==t.clock.base+t.clock.frames)throw Error('Uncontrolled renderer frame increment');
}
export async function draw(a){await raf();beginCapturedFrame(a,0);a.stage.draw();await barrier(a);traces.get(a)?.afterDraw();}
export function view(a,yaw){const c=a.stage.camera,t=a.focus.clone();t.y+=.045;const old=c.position.clone().sub(t),d=Math.hypot(old.x,old.z),r=yaw*Math.PI/180;c.position.set(t.x+Math.sin(r)*d,t.y+old.y,t.z+Math.cos(r)*d);c.lookAt(t);c.updateMatrixWorld(true);}
export async function setup(a,{arm,motion='natural',phase=0,yaw=12}){
 if(a.stage.viewMode!=='beauty'||a.stage.temporal?.mode!=='taau'||a.stage.multisampled)throw Error('Original single-sample beauty TAAU required');
 if(a.stage.morphVelocity!=='exact'||morphVelocityMode()!=='exact')throw Error('Current exact MorphVelocity repair required');
 if(arm!=='owned'||motion!=='natural'||phase!==0)throw Error('Only native owned coverage and natural motion are supported');
 const before=meshes(a).map(o=>({name:o.name,material:materialState(o.material),castShadow:o.castShadow,receiveShadow:o.receiveShadow,positionAttribute:o.geometry.attributes.position,skinIndex:o.geometry.attributes.skinIndex,skinWeight:o.geometry.attributes.skinWeight,morphPositions:o.geometry.morphAttributes.position,skeleton:o.skeleton}));
 const owner=a.faceCardCoverage;
 for(let i=0;i<before.length;i++){const o=meshes(a)[i],b=before[i];equal(materialState(o.material),b.material,'Noncoverage material field changed');if(o.geometry.attributes.position!==b.positionAttribute||o.geometry.attributes.skinIndex!==b.skinIndex||o.geometry.attributes.skinWeight!==b.skinWeight||o.geometry.morphAttributes.position!==b.morphPositions||o.skeleton!==b.skeleton)throw Error('Native skin/morph input changed');}
 view(a,yaw);
 const tracing=traceDraws(a,owner),renderer=a.stage.renderer,nodeFrame=renderer._nodes.nodeFrame;
 if(typeof renderer._animation?.stop!=='function'||renderer._animation.getAnimationLoop()!==null)throw Error('Only idle renderer clock takeover is allowed');
 const bootFrame=nodeFrame.frameId,base=1000000;
 if(!Number.isInteger(bootFrame)||bootFrame>=base)throw Error('Boot exceeded common unique frame epoch');
 renderer._animation.stop();nodeFrame.frameId=base;nodeFrame.time=0;nodeFrame.deltaTime=0;nodeFrame.lastTime=undefined;
 tracing.clock={base,bootFrame,frames:0,time:0};a.stage.temporal.resetFrameEpoch();
 const reset=a.stage.temporal.frameEpoch();if(reset.jitterIndex!==0||reset.historyWidth!==1)throw Error('TAAU epoch did not reset');
 await raf();beginCapturedFrame(a,0);await a.step(0);await barrier(a);tracing.afterDraw();
 const saved=await physical(a);for(let i=0;i<128;i++)await draw(a);equal(await physical(a),saved,'Convergence altered physical/camera state');
 return{owner,arm,motion,phase,setupReport:{captureClock:{...tracing.clock},epochReset:reset,nodeFrameAfterWarmup:a.stage.renderer._nodes.nodeFrame.frameId,stageMorphVelocity:a.stage.morphVelocity,installedMorphVelocity:morphVelocityMode(),temporal:a.stage.temporal.mode,multisampled:a.stage.multisampled,cards:meshes(a).map(o=>({name:o.name,material:materialState(o.material),castShadow:o.castShadow,receiveShadow:o.receiveShadow,morphCount:o.geometry.morphAttributes.position.length,skinVertices:o.geometry.attributes.skinWeight.count,hasBeautyCoverage:o.material.alphaTestNode!==null}))}};
}
export async function step(a,dt){await raf();beginCapturedFrame(a,dt);await window.showcase.step(dt);await barrier(a);traces.get(a)?.afterDraw();}
export async function programs(a){const out=[];for(const [stage,map]of Object.entries(a.stage.renderer._pipelines.programs))for(const p of map.values())out.push({stage,name:p.name,code:p.code,sha256:await sha(new TextEncoder().encode(p.code))});return out;}
export function dispose(a,probe){for(const restore of traces.get(a)?.restores??[])restore();traces.delete(a);probe.owner?.dispose();a.dispose();}

/** CPU-skinned world geometry at the current rendered pose; this is not GPU vertex readback. */
export function snapshot(a) {
 const v=new Vector3(), wardrobe=a.wardrobe;
 a.figure.root.updateMatrixWorld(true);
 const meshes=[];
 for(const [id,mesh] of [['body',a.figure.body],...wardrobe.wornMeshes]){
  mesh.updateMatrixWorld(true);mesh.skeleton?.update();
  const positions=new Float32Array(mesh.geometry.attributes.position.count*3);
  for(let i=0;i<positions.length/3;i++)mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld).toArray(positions,i*3);
  const full=id==='body'?wardrobe.fullIndex:wardrobe.fragments.get(id).fullIndex;
  const range=mesh.geometry.drawRange,end=Math.min(mesh.geometry.index.count,range.start+range.count);
  meshes.push({id,positions:Array.from(positions),fullIndices:Array.from(full),
   drawnIndices:Array.from(mesh.geometry.index.array.slice(range.start,end))});
 }
 return {time:a.clockSeconds,rig:Object.fromEntries(a.figure.body.skeleton.bones.map(b=>[b.name,b.matrixWorld.toArray()])),meshes};
}
