/** Actual Avatar integration checks; loaded only by the Node WebGPU selftest. */
import { Vector3, Quaternion } from 'three';
import { Layer } from './motion/Layer.js';
import { restRotationRelativeToRig, toBoneDeltaFrame } from './motion/Breath.js';
const digest=async typed=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',typed.buffer))].map(x=>x.toString(16).padStart(2,'0')).join('');
const pack=async array=>({length:array.length,sha256:await digest(array)});
export async function captureCanonicalContact() {
 const {avatar}=portrait;
 for(const layer of avatar.stack.layers)layer.enabled=false;
 await portrait.step(0);
 const head=avatar.figure.root.getObjectByName('head'),rest=restRotationRelativeToRig(head,avatar.figure.root),q=head.quaternion.clone(),delta=q.clone(),axis=avatar.focus.clone().fromArray([1,0,0]);
 class Nod extends Layer {constructor(){super({name:'clearanceShake',order:500,boneChannels:['head']});}update(dt,context){q.setFromAxisAngle(axis,.5*Math.sin(2*Math.PI*.6*Math.min(context.time,2)));this.contribution.rotateBone('head',toBoneDeltaFrame(q,rest,delta));return this.contribution;}}
 avatar.stack.add(new Nod());avatar.hairDynamics.reset();await portrait.step(0);
 for(let i=0;i<8;i++)await portrait.step(0);
 const frames=[];
 for(let frame=0;frame<=6;frame++){
  if(frame)await portrait.step(1/60);if(frame!==0&&frame!==6)continue;
  const d=avatar.hairDynamics,c=await d.readCentrelines(),v=await d.readVertices(),body=avatar.figure.body,p=new Vector3(),positions=new Float32Array(body.geometry.attributes.position.count*3);body.skeleton.update();
  for(let i=0;i<body.geometry.attributes.position.count;i++)body.getVertexPosition(i,p).applyMatrix4(body.matrixWorld).toArray(positions,i*3);
  frames.push({frame,time:avatar.clockSeconds,steps:c.steps,vertexBase:v.vertexBase,verticesSpace:v.space,centers:await pack(c.positions),vertices:await pack(v.positions),bodyPositions:await pack(positions),headMatrix:await pack(new Float64Array(c.headMatrix)),contact:d.contactReport()});
 }
 return frames;
}
export async function runAvatarContactLifecycle() {
 const {avatar}=portrait,renderer=avatar.stage.renderer;
 if(avatar.stage.backendName!=='webgpu')throw Error('Actual WebGPU required');
 const resources=()=>({storage:renderer.info.memory.storageAttributes,bytes:renderer.info.memory.storageAttributesSize,compute:[...renderer._pipelines.caches.values()].filter(x=>x.isComputePipeline).length});
 const report={initial:resources(),transforms:[],sequence:[],scale:null,pending:null};window.__avatarContactProgress=report;
 for(const layer of avatar.stack.layers)layer.enabled=false;await portrait.step(0);
 const figureRoot=avatar.figure.root,initialPosition=figureRoot.position.clone(),initialQuaternion=figureRoot.quaternion.clone(),initialScale=figureRoot.scale.clone();
 const resetTransform=()=>{figureRoot.position.copy(initialPosition);figureRoot.quaternion.copy(initialQuaternion);figureRoot.scale.copy(initialScale);figureRoot.updateMatrixWorld(true);};
 for(const mode of ['identity','translation','rotation','translation-and-rotation']){
  resetTransform();if(mode.includes('translation'))figureRoot.position.add(new Vector3(.1,.2,.3));if(mode.includes('rotation'))figureRoot.quaternion.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.4));figureRoot.updateMatrixWorld(true);
  const d=avatar.hairDynamics;d.reset();avatar.hairUpdate(0);avatar.hairUpdate(1/30);
  const c=await d.readCentrelines(),v=await d.readVertices();let mesh;avatar.hairRoot.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});mesh.skeleton.update();
  let maxCenterError=0,maxRootVertexError=0,maxRootMidpointError=0,maxRootWidthError=0;const left=new Vector3(),right=new Vector3(),actual=new Vector3();
  for(let chain=0;chain<d.groom.chainCount;chain++){
   const vertex=d.groom.cardVertexBase+chain*d.groom.pointsPerChain*2;
   mesh.getVertexPosition(vertex,left).applyMatrix4(mesh.matrixWorld);mesh.getVertexPosition(vertex+1,right).applyMatrix4(mesh.matrixWorld);
   const center=left.clone().add(right).multiplyScalar(.5),offset=chain*d.groom.pointsPerChain*3;
   maxCenterError=Math.max(maxCenterError,actual.fromArray(c.positions,offset).distanceTo(center));
   const card=chain*d.groom.pointsPerChain*6,gpuLeft=new Vector3().fromArray(v.positions,card),gpuRight=new Vector3().fromArray(v.positions,card+3);
   maxRootMidpointError=Math.max(maxRootMidpointError,gpuLeft.clone().add(gpuRight).multiplyScalar(.5).distanceTo(center));
   maxRootWidthError=Math.max(maxRootWidthError,Math.abs(gpuLeft.distanceTo(gpuRight)-left.distanceTo(right)));
   maxRootVertexError=Math.max(maxRootVertexError,actual.fromArray(v.positions,card).distanceTo(left),actual.fromArray(v.positions,card+3).distanceTo(right));
  }
  report.transforms.push({mode,maxCenterErrorMm:maxCenterError*1000,maxRootVertexErrorMmDiagnostic:maxRootVertexError*1000,maxRootMidpointErrorMm:maxRootMidpointError*1000,maxRootWidthErrorMm:maxRootWidthError*1000,finite:c.positions.every(Number.isFinite)&&v.positions.every(Number.isFinite),roots:d.groom.chainCount,resources:resources(),contact:d.contactReport()});
 }
 // Refusal happens before setHeadMatrix/update: this owner can resume after valid input returns.
 const d=avatar.hairDynamics,before={centers:await pack((await d.readCentrelines()).positions),vertices:await pack((await d.readVertices()).positions),steps:d.stepsTaken,frames:d.contactReport().frames,resources:resources()};
 const originalCompute=renderer.compute;let submissions=0;renderer.compute=function(...args){submissions++;return originalCompute.apply(this,args);};let message=null;
 try{figureRoot.scale.set(2,1,1);figureRoot.updateMatrixWorld(true);try{avatar.hairUpdate(1/30);}catch(error){message=error.message;}}
 finally{renderer.compute=originalCompute;}
 const after={centers:await pack((await d.readCentrelines()).positions),vertices:await pack((await d.readVertices()).positions),steps:d.stepsTaken,frames:d.contactReport().frames,resources:resources()};
 report.scale={message,submissions,before,after,disposed:d.disposed};resetTransform();d.reset();avatar.hairUpdate(0);report.scale.resumed=d.contactReport().frames>before.frames;
 const retired=[];
 const retire=()=>{if(avatar.hairDynamics)retired.push(avatar.hairDynamics);avatar.disposeHair();};
 retire();report.baseline=resources();
 // Runtime attachment boundary on one renderer. Portrait's public selector still reloads pages;
 // this test does not claim that the process-global material prototype patch is uninstalled.
 for(const [style,identity] of [['bob01',null],['bob02',null],[null,null],['bob01',null],['bob01',.5],['bob01',0],['bob01',.5]]){
  if(identity!==null){if(avatar.hairDynamics)retired.push(avatar.hairDynamics);avatar.hairStyle=style;await avatar.setIdentity({gender:identity});}
  else{retire();avatar.hairStyle=style;if(style)await avatar.attachHair(avatar.figure,avatar.report().identity.bake,avatar.loadToken);}
  if(avatar.hairDynamics){avatar.hairUpdate(1/30);await avatar.hairDynamics.readCentrelines();}
  report.sequence.push({style,identity:avatar.report().identity.bake,resources:resources(),contact:avatar.hairDynamics?.contactReport()??null,attached:!!avatar.hairDynamics});
 }
 report.retired=await Promise.all(retired.map(async solver=>{let refused=0;for(const fn of [()=>solver.update(0),()=>solver.readCentrelines(),()=>solver.readVertices()]){try{await fn();}catch(error){if(/solver has been disposed/.test(error.message))refused++;}}return{disposed:solver.disposed,refused};}));
 // Gate the actual browser digest, then dispose the Avatar before it can publish contact resources.
 const subtle=crypto.subtle,originalDigest=subtle.digest;let arrived,release,calls=0;
 const started=new Promise(resolve=>{arrived=resolve;}),gate=new Promise(resolve=>{release=resolve;});
 subtle.digest=async function(...args){calls++;arrived();await gate;return originalDigest.apply(this,args);};
 let pending,computeAfterRetirement=0;const compute=renderer.compute;
 try{
  pending=avatar.setIdentity({gender:.5});await started;const atDigest=resources();avatar.dispose();
  renderer.compute=function(...args){computeAfterRetirement++;return compute.apply(this,args);};release();await pending;
  report.pending={digestCalls:calls,atDigest,disposed:avatar.disposed,hairNull:avatar.hairDynamics===null&&avatar.hairRoot===null,computeAfterRetirement,memoryAfter:{storage:renderer.info.memory.storageAttributes,bytes:renderer.info.memory.storageAttributesSize}};
 }finally{release();subtle.digest=originalDigest;renderer.compute=compute;if(!avatar.disposed)avatar.dispose();}
 return report;
}
