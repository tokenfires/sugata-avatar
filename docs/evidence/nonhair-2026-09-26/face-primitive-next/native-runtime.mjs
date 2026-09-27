import {HandAttributionArm} from '../hand-clearance/HandAttributionArm.mjs';
import {physical} from '../../../../tools/figure-pipeline/collar_capture_browser.mjs';
import {PROTOCOL,afterSampleEvent} from './native-protocol.mjs';
import {digestArray,exactValues as equal} from './FreshTipWidthFigure.mjs';
import {prepareNativeChannels,observerPrerequisites} from './native-channel-preparation.mjs';
const requireValue=(ok,label)=>{if(!ok)throw Error(label);};
const raf=()=>new Promise(requestAnimationFrame);
const sameDescriptor=(a,b)=>!!a&&!!b&&['value','get','set','enumerable','writable','configurable'].every(k=>a[k]===b[k]);
function uniformValue(v){if(v===null||typeof v==='string'||typeof v==='boolean')return v;if(typeof v==='number'){requireValue(Number.isFinite(v),'Nonfinite material value');return v;}if(v?.toArray)return v.toArray().map(uniformValue);if(Array.isArray(v)||ArrayBuffer.isView(v))return Array.from(v,uniformValue);throw Error('Unsupported material uniform type');}
export async function createNativeTipCapture(api,{sourceHashes,adapter=null,setupReceipt={},markRetiring=()=>{}}){
 const a=api.avatar,s=a.stage,r=s.renderer,node=r._nodes.nodeFrame,c=s.camera,target=api.controls.target;
 requireValue(a.clockSeconds===0&&!a.autoStart&&!a.disposed&&a.seed===PROTOCOL.seed&&s.backendName==='webgpu','Fresh native WebGPU g050 owner required');
 requireValue(a.report().identity.bake==='figure_g050'&&a.report().hair.loadedStyle==='bob02'&&a.report().scene.id==='studio','Fixed body/scene/cut');
 requireValue(r._animation.getAnimationLoop()===null&&node.frameId<PROTOCOL.baseFrame,'Idle renderer capture epoch required');
 const loadedAdapter=adapter?.assertAttached(a)??null,originalDraw=s.draw,descriptor=Object.getOwnPropertyDescriptor(s,'draw');
 const beforeEpoch={frameId:node.frameId,time:node.time,deltaTime:node.deltaTime,clock:a.clockSeconds,temporal:s.temporal.frameEpoch()};
 Object.assign(setupReceipt,{status:'preparing',guardBefore:observerPrerequisites(a),observerInstalled:false});
 let observer=null,draws=0,time=0,pending=null,closed=false,speech=null,speechOutcome=null,currentStep=0,lastSampleClock=null,drawInstalled=null;const trace=[],events=[];
 const skin=a.skin,uniformNodes={...skin.skinUniforms},gradeNodes=Object.fromEntries(Object.entries(s.grade).filter(([k,v])=>k!=='grainFrame'&&v?.isUniformNode));
 const references={normalNode:skin.normalNode,map:skin.map,roughnessNode:skin.roughnessNode,colorNode:skin.colorNode,grade:s.grade,temporal:s.temporal};
 const uniforms=()=>({skin:Object.fromEntries(Object.entries(skin.skinUniforms).map(([k,v])=>[k,uniformValue(v.value)])),grade:Object.fromEntries(Object.entries(gradeNodes).map(([k,v])=>[k,uniformValue(v.value)])),
  material:Object.fromEntries(['roughness','metalness','ior','clearcoat','clearcoatRoughness','specularIntensity','color','specularColor','emissive','normalScale','opacity','transparent','depthWrite','side'].filter(k=>skin[k]!==undefined).map(k=>[k,uniformValue(skin[k])])),rendererToneMappingExposure:r.toneMappingExposure,lightRigExposure:a.lights.exposure});
 const originalUniforms=uniforms();requireValue(originalUniforms.rendererToneMappingExposure===1&&originalUniforms.grade.exposure===1&&originalUniforms.lightRigExposure===.85,'Native Studio exposure owners changed');
 const angleView=yaw=>{const radius=Math.hypot(c.position.x-target.x,c.position.z-target.z),height=c.position.y-target.y,rad=yaw*Math.PI/180;
  c.position.set(target.x+Math.sin(rad)*radius,target.y+height,target.z+Math.cos(rad)*radius);c.lookAt(target);c.updateMatrixWorld(true);api.controls.update();};
 function live(){requireValue(!closed&&!a.disposed&&a.stage===s&&s.renderer===r&&r._nodes.nodeFrame===node&&sameDescriptor(Object.getOwnPropertyDescriptor(s,'draw'),drawInstalled),'Native capture ownership changed');
  requireValue(a.skin===skin&&a.figure.body.material===skin,'Native skin owner changed');for(const[k,v]of Object.entries(uniformNodes))requireValue(skin.skinUniforms[k]===v,'Skin uniform owner changed');
  for(const[k,v]of Object.entries(references))requireValue((k==='grade'||k==='temporal'?s:skin)[k]===v,'Material graph owner changed');equal(uniforms(),originalUniforms,'Non-study material or exposure changed');}
 function wrappedDraw(...args){live();requireValue(pending!==null,'Unindexed native draw refused');requireValue(node.frameId===PROTOCOL.baseFrame+draws+1,'Renderer frame drift');const phase=pending;pending=null;const result=Reflect.apply(originalDraw,this,args);draws++;
  trace.push({phase,frameId:node.frameId,time:node.time,deltaTime:node.deltaTime,clock:a.clockSeconds,temporal:s.temporal.frameEpoch(),grainFrame:s.grade.grainFrame.value});
  requireValue(s.grade.grainFrame.value===node.frameId%4096,'Native grain phase drift');return result;
 }
 function begin(phase,dt){live();requireValue(pending===null&&node.frameId===PROTOCOL.baseFrame+draws,'Uncontrolled renderer increment');node.update();time+=dt;node.time=time;node.deltaTime=dt;r.info.frame=node.frameId;pending=phase;}
 async function barrier(){await r.backend.device.queue.onSubmittedWorkDone();}
 async function draw(phase){await raf();begin(phase,0);s.draw();await barrier();}
 function camera(){return {position:c.position.toArray(),quaternion:c.quaternion.toArray(),world:c.matrixWorld.toArray(),view:c.matrixWorldInverse.toArray(),projection:c.projectionMatrix.toArray(),target:target.toArray(),focus:a.focus.toArray()};}
 async function semantics(){
  const owner=observer.report();if(owner.owners)for(const o of owner.owners)equal(o.raw,o.effective,'Pass-through observer altered '+o.name);
  const channels=Object.fromEntries([...a.stack.morphChannels].map(([name,x])=>[name,{committed:x.committed,writers:x.writerNames.map((name,i)=>({name,value:x.writerValues[i]}))}]));
  const meshes=a.figure.meshes.map(m=>({name:m.name,morphs:Object.fromEntries(Object.entries(m.morphTargetDictionary??{}).map(([name,i])=>[name,m.morphTargetInfluences[i]]))}));
  for(const m of meshes)for(const[name,value]of Object.entries(m.morphs))if(channels[name])requireValue(value===channels[name].committed,'Native committed/mesh mismatch '+m.name+'/'+name);
  return {step:currentStep,clock:a.clockSeconds,frame:a.stack.frame,renderFrame:node.frameId,lastVisemeSampleClock:lastSampleClock,
   owner,channels,meshes,pad:{...a.affectState.pad},target:{...a.affectState.target},emotion:{...a.affectState.emotion},mood:{...a.affectState.mood},
   expression:{activations:structuredClone(a.expression.activations),face:structuredClone(a.expression.faceResult),body:structuredClone(a.expression.bodyPrescription)},
   blink:{closure:a.layers.blink.closure,elapsed:a.layers.blink.elapsed,amplitude:a.layers.blink.closureAmplitude,closing:a.layers.blink.closingDuration,hold:a.layers.blink.closedHold,opening:a.layers.blink.openingDuration},
   speech:a.report().speech,bones:Array.from(a.figure.body.skeleton.boneMatrices),physical:await physical(a),camera:camera()};
 }
 async function geometry(){
  a.figure.root.updateMatrixWorld(true);const v=a.figure.body.position.clone(),w=a.wardrobe;
  const list=[['body',a.figure.body],...a.figure.meshes.filter(m=>m!==a.figure.body).map(m=>['face:'+m.name,m]),...w.wornMeshes];
  const meshes=[];for(const[id,m]of list){m.updateMatrixWorld(true);m.skeleton?.update();const p=new Float32Array(m.geometry.attributes.position.count*3);
   for(let i=0;i<p.length/3;i++)m.getVertexPosition(i,v).applyMatrix4(m.matrixWorld).toArray(p,3*i);
   const g=m.geometry,full=id==='body'?w.fullIndex:w.wornMeshes.has(id)?w.fragments.get(id).fullIndex:g.index.array,range=g.drawRange,end=Math.min(g.index.count,range.start+range.count);
   meshes.push({id,name:m.name,positions:Array.from(p),fullIndices:Array.from(full),drawnIndices:Array.from(g.index.array.slice(range.start,end)),drawRange:{start:range.start,count:Number.isFinite(range.count)?range.count:'Infinity',indexCount:g.index.count},
    world:m.matrixWorld.toArray(),bones:Array.from(m.skeleton?.boneMatrices??[]),bind:m.bindMatrix?.toArray()??null,inverseBind:m.bindMatrixInverse?.toArray()??null,
    morphs:Object.fromEntries(Object.entries(m.morphTargetDictionary??{}).map(([n,i])=>[n,m.morphTargetInfluences[i]]))});
  }
  return {step:currentStep,time:a.clockSeconds,meshes,rig:a.figure.body.skeleton.bones.map(b=>({name:b.name,position:b.position.toArray(),quaternion:b.quaternion.toArray(),scale:b.scale.toArray(),world:b.matrixWorld.toArray()})),camera:camera()};
 }
 async function inputReceipt(){
  const rows=[];for(const m of [...a.figure.meshes,...a.wardrobe.wornMeshes.values()]){
   const g=m.geometry,attributes={};for(const[k,v]of Object.entries(g.attributes))attributes[k]={sha256:await digestArray(v.array),count:v.count,itemSize:v.itemSize,normalized:v.normalized,arrayType:v.array.constructor.name};
   const morphs={};for(const[k,list]of Object.entries(g.morphAttributes))morphs[k]=await Promise.all(list.map(async v=>({sha256:await digestArray(v.array),count:v.count,itemSize:v.itemSize,normalized:v.normalized,arrayType:v.array.constructor.name})));
   rows.push({name:m.name,body:m===a.figure.body,attributes,morphs,index:await digestArray(g.index.array),relative:g.morphTargetsRelative,morphDictionary:structuredClone(m.morphTargetDictionary),bind:m.bindMatrix?.toArray()??null,inverseBind:m.bindMatrixInverse?.toArray()??null,
    boneInverses:m.skeleton?.boneInverses.map(x=>x.toArray())??null});
  }
  return {rows,uniforms:uniforms(),configuration:api.configuration(),scene:a.report().scene,identity:a.report().identity,wardrobe:a.report().wardrobe,quality:a.report().quality,camera:camera()};
 }
 try{
  setupReceipt.channelPreparation=prepareNativeChannels(a);
  angleView(0);r._animation.stop();node.frameId=PROTOCOL.baseFrame;node.time=0;node.deltaTime=0;node.lastTime=undefined;s.temporal.resetFrameEpoch();s.draw=wrappedDraw;drawInstalled=Object.getOwnPropertyDescriptor(s,'draw');
  observer=new HandAttributionArm(a,{arm:'A',sourceHashes});setupReceipt.observerInstalled=true;
  await raf();begin('initial-native-zero-step',0);lastSampleClock=a.clockSeconds;await api.step(0);await barrier();
  const state=await physical(a);for(let i=0;i<PROTOCOL.settleDraws;i++)await draw('initial-settle');equal(await physical(a),state,'Initial draw-only settling moved native state');
 }catch(error){
  setupReceipt.status='failed';setupReceipt.failure={message:error.message,stack:error.stack};const errors=[];
  const cleanup=setupReceipt.cleanup={drawRestored:false,observerInstalled:!!observer,observer:null,errors:[]};
  if(drawInstalled){if(sameDescriptor(Object.getOwnPropertyDescriptor(s,'draw'),drawInstalled)){if(descriptor)Object.defineProperty(s,'draw',descriptor);else delete s.draw;}else errors.push(Error('Foreign Stage.draw descriptor during setup cleanup; not overwritten'));}
  cleanup.drawRestored=s.draw===originalDraw;
  try{adapter?.release();}catch(e){errors.push(e);}
  if(observer){try{markRetiring();observer.dispose();}catch(e){errors.push(e);}cleanup.observer=observer.report();}
  cleanup.errors=errors.map(e=>({message:e.message,stack:e.stack}));
  if(errors.length)throw new AggregateError([error,...errors],'Tip runtime setup and cleanup failed');throw error;
 }
 setupReceipt.status='ready';
 return {
  setup:{beforeEpoch,loadedAdapter,channelPreparation:setupReceipt.channelPreparation,observer:'Reviewed HandAttributionArm A pass-through only; no suppression or hand intervention',afterEpoch:{frameId:node.frameId,time:node.time,clock:a.clockSeconds,draws}},
  semantics,geometry,inputReceipt,
  event(step){live();requireValue(step===currentStep,'Event step mismatch');const result=afterSampleEvent(a,step);if(!result)return null;const {promise,...details}=result;
   if(promise){speech=promise.then(x=>{speechOutcome=x;return x;});details.schedule=structuredClone({timeline:a.viseme.schedule.timeline,leadSeconds:a.viseme.schedule.leadSeconds,audioStartTime:a.viseme.schedule.audioStartTime,windows:a.viseme.schedule.windows});}
   const row={step,clock:a.clockSeconds,...details};events.push(row);return row;},
  async step(){requireValue(currentStep<PROTOCOL.steps,'Trace finished');await raf();begin('native-motion',PROTOCOL.dt);lastSampleClock=a.clockSeconds;await api.step(PROTOCOL.dt);await barrier();currentStep++;return semantics();},
  async view(yaw){live();const before=await semantics();angleView(yaw);s.temporal.resetFrameEpoch();for(let i=0;i<PROTOCOL.settleDraws;i++)await draw('view-settle:'+yaw);const after=await semantics();
   for(const q of [before,after]){delete q.camera;delete q.renderFrame;delete q.physical.camera;delete q.physical.view;delete q.physical.projection;}equal(before,after,'View-only draw changed native motion/physical state');return camera();},
  prepareExport(){begin('native-save-image',0);},
  exportComplete(){requireValue(pending===null,'Native Save image failed to draw');return {step:currentStep,draws,frameId:node.frameId,camera:camera()};},
  async finish(){requireValue(currentStep===PROTOCOL.steps,'Incomplete native trace');requireValue(speechOutcome!==null,'Speech did not finish within fixed trace');return {speechOutcome:await speech,events,trace,observer:observer.report(),step:currentStep};},
  releaseForRetirement(){live();requireValue(pending===null,'Pending draw at retirement');if(descriptor)Object.defineProperty(s,'draw',descriptor);else delete s.draw;closed=true;adapter?.release();
   // HandAttributionArm guards stack.remove until its restore-and-native-teardown completes.
   // Match the existing hand-capture lifecycle, then let pagehide observe retired owners.
   markRetiring();observer.dispose();api.attention.dispose();api.controls.dispose();
   return {drawRestored:s.draw===originalDraw,captureOwnedRetirement:true,nativeDisposed:a.disposed,attentionDisposed:api.attention.disposed,events,trace,observer:observer.report(),step:currentStep};},
  retirementObserver:()=>observer.report()
 };
}
