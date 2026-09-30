// Bounded diagnostic layers/readback only. This module never replaces production modules.
import { Layer } from '../../packages/core/src/motion/Layer.js';
import { restRotationRelativeToRig, toBoneDeltaFrame } from '../../packages/core/src/motion/Breath.js';

export const MOTION_KEYS = [
  [0,0,0,0], [.5,0,0,0], [1.25,30,0,0], [2,-30,0,0], [2.75,0,0,0],
  [3.5,0,20,0], [4.25,0,-15,0], [5,0,0,0], [5.75,0,0,15], [6.5,0,0,-15],
  [7.25,0,0,0], [9.25,0,0,0]
];
function degreesAt(t) {
  const right = MOTION_KEYS.findIndex(k => k[0] >= t);
  if (right <= 0) return [0,0,0];
  const a = MOTION_KEYS[right-1], b = MOTION_KEYS[right];
  const u = .5-.5*Math.cos(Math.PI*(t-a[0])/(b[0]-a[0]));
  return [1,2,3].map(i => a[i]+(b[i]-a[i])*u);
}
const sha = async a => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(a.buffer,a.byteOffset,a.byteLength)))].map(x=>x.toString(16).padStart(2,'0')).join('');

export async function setupNapeMotion({angle,neutral}) {
  const a = showcase.avatar, controls = showcase.controls, renderer = a.stage.renderer;
  if (a.stage.backendName !== 'webgpu' || a.clockSeconds !== 0) throw Error('Requires fresh native captured owner');
  renderer._animation.stop();
  const nf = renderer._nodes.nodeFrame;
  nf.frameId=0; nf.time=0; nf.deltaTime=0; nf.lastTime=undefined;
  a.stage.temporal?.resetFrameEpoch();
  window.napeTick = dt => {nf.update();nf.time=a.clockSeconds+dt;nf.deltaTime=dt;};
  controls.enableDamping=false; controls.update();
  const target=controls.target, radius=a.stage.camera.position.distanceTo(target), theta=angle*Math.PI/180;
  a.stage.camera.position.set(target.x+radius*Math.sin(theta),target.y,target.z+radius*Math.cos(theta));
  a.stage.camera.lookAt(target);controls.update();
  const disabled=a.stack.layers.map(l=>l.name);
  for(const layer of a.stack.layers)layer.enabled=false;
  napeTick(0);await showcase.step(0);
  const head=a.figure.root.getObjectByName('head'), rest=restRotationRelativeToRig(head,a.figure.root);
  const q=head.quaternion.clone(), delta=q.clone(), axis=a.focus.clone();
  class Motion extends Layer {
    constructor(){super({name:'napeReview',order:500,boneChannels:['head']});}
    update(dt,context){
      const [yaw,pitch,roll]=degreesAt(context.time);
      // Keys isolate each anatomical axis. The helper maps rig-space rotations into the bone frame.
      const value=yaw||pitch||roll;
      axis.fromArray(yaw?[0,1,0]:pitch?[1,0,0]:[0,0,1]);
      q.setFromAxisAngle(axis,value*Math.PI/180);
      this.contribution.rotateBone('head',toBoneDeltaFrame(q,rest,delta));return this.contribution;
    }
  }
  a.stack.add(new Motion()); a.hairDynamics.reset();
  const lightingChanges=[];
  if(neutral)a.stage.scene.traverse(o=>{
    if(!o.isLight)return;
    for(const key of ['color','groundColor'])if(o[key]?.isColor){
      const before=o[key].toArray(), l=.2126*before[0]+.7152*before[1]+.0722*before[2];
      o[key].setRGB(l,l,l);lightingChanges.push({name:o.name,key,before,after:o[key].toArray()});
    }
  });
  for(let i=0;i<97;i++){napeTick(0);await showcase.step(0);}
  const g=a.hairDynamics.groom;
  if(g.chainCount!==496||g.pointsPerChain!==17||g.cardVertexBase!==652)throw Error('Unexpected groom topology');
  let mesh;a.hairRoot.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});
  const first=g.cardVertexBase+281*34;
  const selectedIndices=Array.from(mesh.geometry.index.array).filter((v,i,all)=>{
    const start=i-i%3;return all.slice(start,start+3).every(k=>k>=first&&k<first+34);
  }).map(v=>v-first);
  if(selectedIndices.length!==96)throw Error('Expected 32 selected triangles');
  window.napeDescriptor={selectedIndices,bodyIndices:Array.from(a.wardrobe?.fullIndex??a.figure.body.geometry.index.array),
    restPositions:Array.from(mesh.geometry.attributes.position.array.slice(first*3,(first+34)*3)),
    restCentres:Array.from(g.restCentres.slice(281*17*3,282*17*3)),restLengths:Array.from(g.restLengths.slice(281*17,282*17))};
  const lights=[];a.stage.scene.traverse(o=>{if(o.isLight)lights.push({name:o.name,type:o.type,color:o.color.toArray(),intensity:o.intensity,position:o.position.toArray()});});
  return {disabled,keys:MOTION_KEYS,configuration:showcase.configuration(),camera:a.stage.camera.matrixWorld.toArray(),projection:a.stage.camera.projectionMatrix.toArray(),
    canvas:[a.stage.canvas.width,a.stage.canvas.height],lights,lightingChanges,material:a.hairMaterial.hairUniforms.baseColour.value.toArray(),
    backend:a.stage.backendName,adapter:renderer.backend.adapter?.info?.description??null,descriptor:napeDescriptor,
    parameters:Object.fromEntries(['dampingScale','globalStiffness','tipStiffness','gravity','drag'].filter(k=>a.hairDynamics.uniforms[k]).map(k=>[k,a.hairDynamics.uniforms[k].value])),
    clock:{frame:nf.frameId,time:nf.time,delta:nf.deltaTime,grain:a.stage.grade?.grainFrame?.value}};
}

export async function napeSample(frame) {
  const a=showcase.avatar,d=a.hairDynamics,c=await d.readCentrelines(),v=await d.readVertices();
  if(v.space!=='world')throw Error('Expected world-space GPU readback');
  const body=a.figure.body,p=body.geometry.attributes.position,point=a.focus.clone();body.skeleton.update();
  const positions=new Float32Array(p.count*3),normals=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++)body.getVertexPosition(i,point).applyMatrix4(body.matrixWorld).toArray(positions,i*3);
  const base=body.geometry.attributes.normal,morphs=body.geometry.morphAttributes.normal??[],weights=body.morphTargetInfluences??[];
  const baseWeight=body.geometry.morphTargetsRelative?1:1-weights.reduce((x,y)=>x+y,0);
  const normal4=d.uniforms.skull.value.clone(),scratch=point.clone(),nm=body.normalMatrix.clone().getNormalMatrix(body.matrixWorld);
  for(let i=0;i<p.count;i++){
    point.fromBufferAttribute(base,i);
    if(morphs.length){point.multiplyScalar(baseWeight);for(let m=0;m<morphs.length;m++)if(weights[m])point.addScaledVector(scratch.fromBufferAttribute(morphs[m],i),weights[m]);}
    normal4.set(point.x,point.y,point.z,0);body.applyBoneTransform(i,normal4);
    point.set(normal4.x,normal4.y,normal4.z).applyMatrix3(nm).normalize().toArray(normals,i*3);
  }
  const selected=v.positions.slice(281*34*3,282*34*3), centers=c.positions.slice(281*17*3,282*17*3);
  const other=new Float32Array(v.positions.length-selected.length);other.set(v.positions.subarray(0,281*34*3));other.set(v.positions.subarray(282*34*3),281*34*3);
  const screen=[];for(let i=0;i<selected.length;i+=3){point.fromArray(selected,i).project(a.stage.camera);screen.push((point.x+1)*a.stage.canvas.width/2,(1-point.y)*a.stage.canvas.height/2,point.z);}
  for(const array of [selected,centers,positions,normals])if(!array.every(Number.isFinite))throw Error('Nonfinite readback');
  const nf=a.stage.renderer._nodes.nodeFrame;
  return {frame,time:a.clockSeconds,degrees:degreesAt(a.clockSeconds),headMatrix:c.headMatrix,steps:c.steps,
    clock:{frame:nf.frameId,time:nf.time,delta:nf.deltaTime,grain:a.stage.grade?.grainFrame?.value,temporal:a.stage.temporal?.frameEpoch()},
    hashes:{otherVertices:await sha(other),body:await sha(positions),rig:await sha(new Float64Array(body.skeleton.bones.flatMap(b=>b.matrixWorld.toArray()))),velocities:await sha(c.velocities)},
    selectedVertices:Array.from(selected),selectedCentres:Array.from(centers),selectedScreen:screen,
    bodyPositions:Array.from(positions),bodyNormals:Array.from(normals),contact:d.contactReport(),
    colliders:{skull:d.uniforms.skull.value.toArray(),capsuleA:d.uniforms.capsuleA.value.toArray(),capsuleB:d.uniforms.capsuleB.value.toArray(),capsuleRadius:d.uniforms.capsuleRadius.value}};
}
