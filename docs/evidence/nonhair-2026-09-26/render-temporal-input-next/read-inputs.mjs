import {targetDescriptor} from '../render-boundary-next/read-targets.mjs';
import {packReadback} from '../render-boundary-next/readback-bytes.mjs';
const requireValue=(ok,message)=>{if(!ok)throw Error(message);};
const matrixFields=['_cameraWorldMatrix','_cameraWorldMatrixInverse','_cameraProjectionMatrixInverse','_previousCameraWorldMatrix','_previousCameraProjectionMatrixInverse'];
const vectorFields=['_cameraNearFar','_jitterOffset'];
const scalarFields=['depthThreshold','edgeDepthDiff','maxVelocityLength','currentFrameWeight','_jitterIndex'];
function exact(a,b){if(Object.is(a,b))return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const ak=Object.keys(a),bk=Object.keys(b);return ak.length===bk.length&&ak.every(k=>Object.hasOwn(b,k)&&exact(a[k],b[k]));}
function finite(v){if(typeof v==='number')requireValue(Number.isFinite(v),'Nonfinite temporal state');else if(v&&typeof v==='object')Object.values(v).forEach(finite);}
function targets(avatar){
 const s=avatar.stage,t=s.temporal?.node?.passNode;
 requireValue(avatar.tier==='balanced'&&avatar.tierSettings?.occlusion===false&&s.backendName==='webgpu'&&s.temporal.mode==='taau'&&t?.isTAAUNode,'Fixed balanced native temporal owner required');
 requireValue(t.camera===s.camera&&s.temporal.node.value===t._resolveRenderTarget?.texture,'Temporal camera/resolve ownership changed');
 requireValue(t._historyRenderTarget?.textures.length===2,'Actual colour and lock attachments required');
 return {t,list:[{label:'inherited-history-colour',target:t._historyRenderTarget,index:0},{label:'inherited-history-lock',target:t._historyRenderTarget,index:1}]};
}
function textureMeta(renderer,texture){
 requireValue(texture?.isTexture&&renderer.backend.has(texture),'Uploaded depth texture required');
 const d=renderer.backend.get(texture),g=d.texture,descriptor=d.textureDescriptorGPU;
 requireValue(g&&descriptor&&g.format===descriptor.format,'Actual depth metadata required');
 return {name:texture.name,threeType:texture.type,threeFormat:texture.format,format:g.format,width:g.width,height:g.height,depthOrArrayLayers:g.depthOrArrayLayers,mipLevelCount:g.mipLevelCount,sampleCount:g.sampleCount,usage:g.usage,contentsObserved:false};
}
function snapshot(avatar,t){
 const s=avatar.stage,r=s.renderer,c=s.camera,n=r._nodes.nodeFrame;
 for(const k of matrixFields)requireValue(t[k]?.isUniformNode&&t[k].value?.isMatrix4,'Actual matrix uniform required: '+k);
 for(const k of vectorFields)requireValue(t[k]?.isUniformNode&&t[k].value?.isVector2,'Actual vector uniform required: '+k);
 for(const k of scalarFields)requireValue(typeof t[k]==='number','Actual scalar required: '+k);
 requireValue(typeof t._needsPostProcessingSync==='boolean'&&t._originalProjectionMatrix?.isMatrix4,'Actual temporal cached state required');
 requireValue(t._previousDepthNode.value===t._previousDepthRenderTarget.depthTexture,'Previous depth ownership differs');
 const inputs={uniforms:Object.fromEntries([...matrixFields,...vectorFields].map(k=>[k,t[k].value.toArray()])),scalars:Object.fromEntries(scalarFields.map(k=>[k,t[k]])),needsPostProcessingSync:t._needsPostProcessingSync,originalProjection:t._originalProjectionMatrix.toArray(),
  camera:{world:c.matrixWorld.toArray(),view:c.matrixWorldInverse.toArray(),projection:c.projectionMatrix.toArray(),projectionInverse:c.projectionMatrixInverse.toArray(),near:c.near,far:c.far,viewOffset:c.view?structuredClone(c.view):null},
  dimensions:{history:[t._historyRenderTarget.width,t._historyRenderTarget.height],resolve:[t._resolveRenderTarget.width,t._resolveRenderTarget.height]},
  depth:{current:textureMeta(r,t.depthNode.value),previous:textureMeta(r,t._previousDepthNode.value)}};
 const result={inputs,counters:{clock:avatar.clockSeconds,node:{frameId:n.frameId,renderId:n.renderId,time:n.time,deltaTime:n.deltaTime},rendererFrame:r.info.frame,render:structuredClone(r.info.render),temporal:s.temporal.frameEpoch(),activeTarget:r.getRenderTarget()?.uuid??null,automaticLoop:r._animation.getAnimationLoop()!==null}};
 finite(result);requireValue(result.counters.automaticLoop===false,'Idle renderer required');return result;
}
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
function base64(b){let value='';for(let i=0;i<b.length;i+=0x8000)value+=String.fromCharCode(...b.subarray(i,i+0x8000));return btoa(value);}
export async function readTemporalInputs(avatar,save){
 requireValue(typeof save==='function','Owned evidence sink required');
 const stage=avatar.stage,r=stage.renderer,{t,list}=targets(avatar),before=snapshot(avatar,t);
 const descriptors=list.map(q=>targetDescriptor(r,q));
 const refs={stage,renderer:r,temporal:stage.temporal,camera:stage.camera,originalProjection:t._originalProjectionMatrix,depthNode:t.depthNode,previousDepthNode:t._previousDepthNode,previousDepthTarget:t._previousDepthRenderTarget,
  uniforms:[...matrixFields,...vectorFields].map(k=>[k,t[k],t[k].value]),depths:[t.depthNode.value,t._previousDepthNode.value].map(q=>[q,r.backend.get(q).texture]),targets:list.map(q=>[q.target,q.target.textures[q.index],r.backend.get(q.target.textures[q.index]).texture])};
 const validate=()=>{
  requireValue(avatar.stage===refs.stage&&stage.renderer===refs.renderer&&stage.temporal===refs.temporal&&stage.camera===refs.camera,'Native owner changed');
  const now=targets(avatar);requireValue(now.t===t&&t._originalProjectionMatrix===refs.originalProjection&&t.depthNode===refs.depthNode&&t._previousDepthNode===refs.previousDepthNode&&t._previousDepthRenderTarget===refs.previousDepthTarget,'Temporal owner changed');
  for(const[k,node,value]of refs.uniforms)requireValue(t[k]===node&&t[k].value===value,'Uniform owner changed');
  for(let i=0;i<refs.depths.length;i++){const q=i===0?t.depthNode.value:t._previousDepthNode.value;requireValue(q===refs.depths[i][0]&&r.backend.has(q)&&r.backend.get(q).texture===refs.depths[i][1],'Depth owner changed');}
  for(let i=0;i<list.length;i++){const q=now.list[i],texture=q.target.textures[q.index];requireValue(q.target===refs.targets[i][0]&&texture===refs.targets[i][1]&&r.backend.has(texture)&&r.backend.get(texture).texture===refs.targets[i][2],'History owner changed');requireValue(exact(targetDescriptor(r,q),descriptors[i]),'History descriptor changed');}
  requireValue(exact(snapshot(avatar,t),before),'Temporal values or counters changed');
 };
 const records=[];
 for(let i=0;i<list.length;i++){
  validate();const q=list[i],desc=descriptors[i],raw=await r.readRenderTargetPixelsAsync(q.target,0,0,q.target.width,q.target.height,q.index,0);validate();
  const {pixels,layout}=packReadback(raw,desc),bytes=new Uint8Array(raw.buffer,raw.byteOffset,raw.byteLength);
  const record={...desc,layout,rawSHA256:await sha(bytes),pixelsSHA256:await sha(pixels)};validate();await save(record,base64(bytes));validate();records.push(record);
 }
 validate();return {before,after:snapshot(avatar,t),records,unchanged:true,depthContentsObserved:false,gpuUniformContentsObserved:false,scope:'Inherited history bits and actual JavaScript owner state after draw64, before original export draw65; readbacks add copies and synchronization.'};
}
