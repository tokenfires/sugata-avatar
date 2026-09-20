/** Native Three r185 callback/MRT controls. GPU compilation and images have a separate gate. */
import assert from 'node:assert/strict';
import Renderer from 'three/src/renderers/common/Renderer.js';
import { Matrix4, PerspectiveCamera, Scene, BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicNodeMaterial } from 'three/webgpu';
import { instancedArray, velocity, mrt, vec2, vec4 } from 'three/tsl';
import { RenderParticipants } from './RenderParticipants.js';
import { createCardRenderHistory } from './CardRenderHistory.js';
let groups=0;
function fixture(factory=createCardRenderHistory){
 const camera=new PerspectiveCamera(),scene=new Scene(),projection=new Matrix4();
 let target=null,outputs=null,copies=0,deleted=0,released=0;const state={write:1,reset:1,builtReset:1,ready:true,rawComputeUsed:false};
 const renderer={_initialized:true,xr:{enabled:false},_nodes:{nodeFrame:{renderId:0}},getRenderTarget:()=>target,setRenderTarget:x=>target=x,getMRT:()=>outputs,setMRT:x=>outputs=x,
 compute(){copies++;},_attributes:{delete(){deleted++;}},async getArrayBufferAsync(){return new Float32Array(24).buffer;}};
 const stage={renderer,camera,scene,viewMode:'beauty',renderPipeline:{},scenePass:{renderTarget:{},overrideMaterial:null},temporal:{mode:'taau',resetEpoch:0,getUnjitteredProjection:()=>projection,resetFrameEpoch(){this.resetEpoch++;}}};
 stage.renderParticipants=new RenderParticipants(stage);stage.registerRenderParticipant=p=>stage.renderParticipants.register(p);
 const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(new Float32Array(18),3));geometry.setIndex([0,1,2,3,4,5]);
 const material=new MeshBasicNodeMaterial();material.mrtNode=null;const mesh=new Mesh(geometry,material);scene.add(mesh);
 const sourceBuffer=instancedArray(6,'vec3');let retire;const source={live:true,space:'mesh-local',chainCount:1,pointsPerChain:3,cardVertexBase:0,cardVertexCount:6,state:()=>({...state}),read:i=>sourceBuffer.element(i),release(){released++;source.live=false;}};
 const dynamics={disposed:false,borrowCardEdges(fn){retire=fn;return source;}};
 const install=()=>factory({stage,dynamics,mesh,material});
 function fresh(body){return stage.renderParticipants.draw(()=>{const receipt=stage.renderParticipants.mainPassBegin(stage.scenePass,{renderer});renderer.setRenderTarget(stage.scenePass.renderTarget);velocity.setProjectionMatrix(projection);
 try{mesh.onBeforeRender(renderer,scene,camera,geometry,material,null);body?.();mesh.onAfterRender(renderer,scene,camera,geometry,material,null);stage.renderParticipants.mainPassEnd(receipt,null);}finally{renderer.setRenderTarget(null);velocity.setProjectionMatrix(null);}});}
 return {stage,mesh,material,state,source,dynamics,install,fresh,retire:()=>retire(),counts:()=>({copies,deleted,released})};
}

// Red mechanism: a velocity-only material MRT has no output for the unnamed forward target.
{
 const target={textures:[{name:''}]},output=mrt({velocity:vec2(0)});
 output.setup({renderer:{getRenderTarget:()=>target},getOutputType:()=> 'vec4',getNodeProperties:()=>({})});
 assert.equal(output.members.length,0);groups++;
}
for(const secondary of [false,true]){
 const f=fixture(),owner=f.install();f.fresh();f.fresh();
 const renderer=f.stage.renderer,camera=secondary?new PerspectiveCamera():f.stage.camera;
 renderer.setRenderTarget({textures:[{name:''}]});renderer.setMRT(null);
 renderer._handleObjectFunction=(_object,material)=>{assert.equal(material.mrtNode,null);assert.equal(owner.report().mode,'hold');};
 Renderer.prototype.renderObject.call(renderer,f.mesh,f.stage.scene,camera,f.mesh.geometry,f.material,null,null);
 owner.dispose();groups++;
}

{
const checks=[];
const direct=f=>Renderer.prototype.renderObject.call(f.stage.renderer,f.mesh,f.stage.scene,f.stage.camera,f.mesh.geometry,f.material,null,null);
const prepare=f=>{f.stage.renderer.setRenderTarget({textures:[{name:''}]});f.stage.renderer.setMRT(null);f.stage.renderer._handleObjectFunction=()=>assert.equal(f.material.mrtNode,null);};
{
 const f=fixture();f.mesh.onAfterRender=()=>{throw Error('prior after callback failure');};const h=f.install();prepare(f);
 assert.throws(()=>direct(f),/prior after/);assert.notEqual(f.material.mrtNode,null);h.dispose();checks.push('prior after callback throw restores installed history MRT');
}
{
 const f=fixture(),h=f.install();prepare(f);f.stage.renderer._handleObjectFunction=()=>{throw Error('draw failure');};assert.throws(()=>direct(f),/draw failure/);
 assert.equal(f.material.mrtNode,null);f.fresh();assert.notEqual(f.material.mrtNode,null);assert.equal(h.report().mode,'seeding');h.dispose();checks.push('interrupted direct draw restores and reseeds at next owned begin');
}
{
 const f=fixture(),external=mrt({output:vec4(1)});f.mesh.onAfterRender=()=>{f.material.mrtNode=external;};const h=f.install();prepare(f);direct(f);assert.equal(f.material.mrtNode,external);h.dispose();assert.equal(f.material.mrtNode,external);checks.push('external MRT replacement during after callback survives lease cleanup and disposal');
}
{
 const f=fixture();let h;f.mesh.onAfterRender=()=>h.dispose();h=f.install();prepare(f);direct(f);assert.equal(f.material.mrtNode,null);assert.equal(h.disposed,true);assert.deepEqual(f.counts(),{copies:0,deleted:1,released:1});checks.push('disposal during after callback keeps native MRT and releases each resource once');
}
const nested=[];
for(const hasMRT of [false,true]){
 const f=fixture();let inside=false;
 f.mesh.onAfterRender=()=>{
  if(inside)return;inside=true;
  const renderer=f.stage.renderer,saved=renderer.getMRT();
  if(hasMRT)renderer.setMRT(mrt({output:vec4(1),velocity:vec2(0)}));
  direct(f);renderer.setMRT(saved);
  nested.push({nestedHasRendererMRT:hasMRT,nativeStillLeasedInsideOuterAfter:f.material.mrtNode===null});
 };
 const h=f.install();prepare(f);direct(f);h.dispose();
}
assert.equal(nested[0].nativeStillLeasedInsideOuterAfter,true);
assert.equal(nested[1].nativeStillLeasedInsideOuterAfter,true);

groups+=checks.length+nested.length;
}

{
const observations=[];
const draw=(f,c=f.stage.camera)=>Renderer.prototype.renderObject.call(f.stage.renderer,f.mesh,f.stage.scene,c,f.mesh.geometry,f.material,null,null);
{
 const f=fixture();let nested=false,caught=false,probeActive=true,outerUsedNative=false;
 f.mesh.onBeforeRender=()=>{
  if(nested||!probeActive)return;nested=true;
  try{draw(f);}catch(e){assert.match(e.message,/nested failure/);caught=true;}finally{nested=false;}
 };
 const h=f.install(),override=f.material.mrtNode;f.stage.renderer.setRenderTarget({textures:[{name:''}]});
 f.stage.renderer._handleObjectFunction=()=>{if(nested)throw Error('nested failure');outerUsedNative=f.material.mrtNode===null;};
 draw(f);
 observations.push({case:'caught nested draw failure inside prior BEFORE callback',caught,outerUsedNative,restoredAtOuterReturn:f.material.mrtNode===override});
 assert.equal(caught,true);assert.equal(outerUsedNative,true);assert.equal(f.material.mrtNode,override);
 probeActive=false;f.fresh();assert.equal(f.material.mrtNode,override);assert.equal(h.report().mode,'seeding');h.dispose();
}
{
 const f=fixture(),shadow=new MeshBasicNodeMaterial(),shadowCamera=new PerspectiveCamera();let nested=false,shadowAfterSawOverride=false;
 f.mesh.onBeforeRender=()=>{if(nested)return;nested=true;f.stage.scene.overrideMaterial=shadow;try{draw(f,shadowCamera);}finally{f.stage.scene.overrideMaterial=null;nested=false;}};
 f.mesh.onAfterRender=(_r,_s,c,_g,m)=>{if(c===shadowCamera)shadowAfterSawOverride=m===shadow;};
 const h=f.install(),override=f.material.mrtNode;f.stage.renderer.setRenderTarget({textures:[{name:''}]});
 f.stage.renderer._handleObjectFunction=(_o,m)=>assert.equal(m.mrtNode,null);
 draw(f);assert.equal(shadowAfterSawOverride,true);assert.equal(f.material.mrtNode,override);h.dispose();shadow.dispose();
 observations.push({case:'nested actual override draw has asymmetric before/after material',shadowAfterSawOverride,restoredAtOuterReturn:true});
}

groups+=observations.length;
}

{
const checks=[];
for(const action of ['dispose','throw']){
 const f=fixture(createCardRenderHistory),shadow=new MeshBasicNodeMaterial(),shadowCamera=new PerspectiveCamera();let h,nested=false,receivedOverride=false;
 const draw=c=>Renderer.prototype.renderObject.call(f.stage.renderer,f.mesh,f.stage.scene,c,f.mesh.geometry,f.material,null,null);
 f.mesh.onAfterRender=(_r,_s,c,_g,m)=>{
  if(nested){receivedOverride=m===shadow;if(action==='dispose')h.dispose();else throw Error('nested override after failure');return;}
  nested=true;f.stage.scene.overrideMaterial=shadow;try{draw(shadowCamera);}finally{f.stage.scene.overrideMaterial=null;nested=false;}
 };
 h=f.install();const historyMRT=f.material.mrtNode;f.stage.renderer.setRenderTarget({textures:[{name:''}]});f.stage.renderer._handleObjectFunction=()=>{};
 if(action==='throw')assert.throws(()=>draw(f.stage.camera),/nested override after failure/);else draw(f.stage.camera);
 assert.equal(receivedOverride,true);
 if(action==='dispose'){assert.equal(f.material.mrtNode,null);assert.equal(h.disposed,true);assert.deepEqual(f.counts(),{copies:0,deleted:1,released:1});}
 else{assert.equal(f.material.mrtNode,historyMRT);assert.equal(h.disposed,false);}
 h.dispose();h.dispose();assert.deepEqual(f.counts(),{copies:0,deleted:1,released:1});shadow.dispose();
 checks.push({action,receivedOverride,leaseRestored:true,resourceReleaseCount:1});
}

groups+=checks.length;
}
console.log('PASS '+groups+' native callback/MRT controls (including the empty-output failure mechanism).');
