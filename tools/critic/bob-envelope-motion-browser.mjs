// Fixed ordinary or isolated-head protocols with full selected-groom readback. No production module routing.
import { Layer } from '../../packages/core/src/motion/Layer.js';
import { restRotationRelativeToRig, toBoneDeltaFrame } from '../../packages/core/src/motion/Breath.js';
import { MOTION_KEYS } from './bob-nape-motion-browser.mjs';
function headDegreesAt(t) {
  const right = MOTION_KEYS.findIndex(k => k[0] >= t);
  if (right <= 0) return [0, 0, 0];
  const a = MOTION_KEYS[right - 1], b = MOTION_KEYS[right];
  const u = .5 - .5 * Math.cos(Math.PI * (t - a[0]) / (b[0] - a[0]));
  return [1, 2, 3].map(i => a[i] + (b[i] - a[i]) * u);
}
const sha = async a => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(a.buffer,a.byteOffset,a.byteLength)))].map(x=>x.toString(16).padStart(2,'0')).join('');

export async function setupEnvelopeMotion({angle,neutral,selectedCards,protocol='ordinary',retainOtherVertices=false}) {
  const a = showcase.avatar, controls = showcase.controls, renderer = a.stage.renderer;
  if (a.stage.backendName !== 'webgpu' || a.clockSeconds !== 0) throw Error('Requires fresh native captured owner');
  renderer._animation.stop();
  const nf = renderer._nodes.nodeFrame;
  nf.frameId=0; nf.time=0; nf.deltaTime=0; nf.lastTime=undefined;
  a.stage.temporal?.resetFrameEpoch();
  window.envelopeTick = dt => {nf.update();nf.time=a.clockSeconds+dt;nf.deltaTime=dt;};
  controls.enableDamping=false; controls.update();
  const target=controls.target, radius=a.stage.camera.position.distanceTo(target), theta=angle*Math.PI/180;
  a.stage.camera.position.set(target.x+radius*Math.sin(theta),target.y,target.z+radius*Math.cos(theta));
  a.stage.camera.lookAt(target);controls.update();
  if (!['ordinary', 'head'].includes(protocol)) throw Error('Unknown motion protocol');
  const originalLayers=a.stack.layers.map(l=>({name:l.name,order:l.order,enabled:l.enabled}));
  if (protocol === 'head') for (const layer of a.stack.layers) layer.enabled = false;
  envelopeTick(0);await showcase.step(0);
  if (protocol === 'head') {
    const head = a.figure.root.getObjectByName('head'), rest = restRotationRelativeToRig(head, a.figure.root);
    const q = head.quaternion.clone(), delta = q.clone(), axis = a.focus.clone();
    class Motion extends Layer {
      constructor() { super({name:'envelopeHeadReview',order:500,boneChannels:['head']}); }
      update(dt, context) {
        const [yaw, pitch, roll] = headDegreesAt(context.time), value = yaw || pitch || roll;
        axis.fromArray(yaw ? [0,1,0] : pitch ? [1,0,0] : [0,0,1]);
        q.setFromAxisAngle(axis, value * Math.PI / 180);
        this.contribution.rotateBone('head', toBoneDeltaFrame(q, rest, delta));
        return this.contribution;
      }
    }
    a.stack.add(new Motion());
  }
  const layers=a.stack.layers.map(l=>({name:l.name,order:l.order,enabled:l.enabled}));
  a.hairDynamics.reset();
  window.envelopeProtocol = protocol;
  window.envelopeRetainOther = retainOtherVertices;
  window.envelopeSelection=selectedCards;
  const lightingChanges=[];
  if(neutral)a.stage.scene.traverse(o=>{
    if(!o.isLight)return;
    for(const key of ['color','groundColor'])if(o[key]?.isColor){
      const before=o[key].toArray(), l=.2126*before[0]+.7152*before[1]+.0722*before[2];
      o[key].setRGB(l,l,l);lightingChanges.push({name:o.name,key,before,after:o[key].toArray()});
    }
  });
  for(let i=0;i<97;i++){envelopeTick(0);await showcase.step(0);}
  const g=a.hairDynamics.groom;
  if(g.chainCount!==496||g.pointsPerChain!==17||g.cardVertexBase!==652)throw Error('Unexpected groom topology');
  let mesh;a.hairRoot.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});
  const compactIndex=new Map(selectedCards.map((card,i)=>[card,i]));
  const selectedIndices=[];
  const index=mesh.geometry.index.array;
  for(let i=0;i<index.length;i+=3){
    const vertices=Array.from(index.slice(i,i+3));
    if(vertices.every(v=>v>=652&&compactIndex.has(Math.floor((v-652)/34))))selectedIndices.push(...vertices.map(v=>compactIndex.get(Math.floor((v-652)/34))*34+(v-652)%34));
  }
  if(selectedIndices.length!==selectedCards.length*96)throw Error('Unexpected selected triangles');
  const pick=(values,width,base=0)=>selectedCards.flatMap(card=>Array.from(values.slice(base+card*width,base+(card+1)*width)));
  window.envelopeDescriptor={selectedCards,selectedIndices,otherCards:Array.from({length:496},(_,card)=>card).filter(card=>!compactIndex.has(card)),bodyIndices:Array.from(a.wardrobe?.fullIndex??a.figure.body.geometry.index.array),
    restPositions:pick(mesh.geometry.attributes.position.array,34*3,652*3),restCentres:pick(g.restCentres,17*3)};
  const lights=[];a.stage.scene.traverse(o=>{if(o.isLight)lights.push({name:o.name,type:o.type,color:o.color.toArray(),intensity:o.intensity,position:o.position.toArray()});});
  return {seed:a.seed,layers,originalLayers,protocol,keys:protocol==='head'?MOTION_KEYS:null,retainOtherVertices,configuration:showcase.configuration(),camera:a.stage.camera.matrixWorld.toArray(),projection:a.stage.camera.projectionMatrix.toArray(),
    canvas:[a.stage.canvas.width,a.stage.canvas.height],lights,lightingChanges,material:a.hairMaterial.hairUniforms.baseColour.value.toArray(),
    backend:a.stage.backendName,adapter:renderer.backend.adapter?.info?.description??null,descriptor:envelopeDescriptor,
    parameters:Object.fromEntries(['dampingScale','globalStiffness','tipStiffness','gravity','drag'].filter(k=>a.hairDynamics.uniforms[k]).map(k=>[k,a.hairDynamics.uniforms[k].value])),
    clock:{frame:nf.frameId,time:nf.time,delta:nf.deltaTime,grain:a.stage.grade?.grainFrame?.value}};
}

export async function envelopeSample(frame) {
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
  const pick=(values,width)=>new Float32Array(envelopeSelection.flatMap(card=>Array.from(values.slice(card*width,(card+1)*width))));
  const selected=pick(v.positions,34*3),centers=pick(c.positions,17*3),selection=new Set(envelopeSelection);
  const other=new Float32Array(Array.from({length:496},(_,card)=>card).filter(card=>!selection.has(card)).flatMap(card=>Array.from(v.positions.slice(card*34*3,(card+1)*34*3))));
  for(const array of [selected,centers,other,positions,normals])if(!array.every(Number.isFinite))throw Error('Nonfinite readback');
  const nf=a.stage.renderer._nodes.nodeFrame;
  return {frame,time:a.clockSeconds,...(envelopeProtocol==='head'?{degrees:headDegreesAt(a.clockSeconds)}:{}),headMatrix:c.headMatrix,steps:c.steps,
    clock:{frame:nf.frameId,time:nf.time,delta:nf.deltaTime,grain:a.stage.grade?.grainFrame?.value,temporal:a.stage.temporal?.frameEpoch()},
    hashes:{otherVertices:await sha(other),body:await sha(positions),rig:await sha(new Float64Array(body.skeleton.bones.flatMap(b=>b.matrixWorld.toArray()))),velocities:await sha(c.velocities)},
    selectedVertices:Array.from(selected),selectedCentres:Array.from(centers),
    ...(envelopeRetainOther ? {otherVertices:Array.from(other)} : {}),
    bodyPositions:Array.from(positions),bodyNormals:Array.from(normals),contact:d.contactReport(),
    colliders:{skull:d.uniforms.skull.value.toArray(),capsuleA:d.uniforms.capsuleA.value.toArray(),capsuleB:d.uniforms.capsuleB.value.toArray(),capsuleRadius:d.uniforms.capsuleRadius.value}};
}
