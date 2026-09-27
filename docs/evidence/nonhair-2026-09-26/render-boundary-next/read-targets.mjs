import {packReadback} from './readback-bytes.mjs';
const check=(yes,message)=>{if(!yes)throw Error(message);};
export function existingTargets(stage) {
 check(stage?.backendName==='webgpu','Native WebGPU stage required');
 check(stage.temporal?.mode==='taau','Fixed TAAU setup required');
 check(stage.ambientOcclusion===null,'Fixed balanced tier must have no GTAO owner');
 check(stage.temporal.sharpenNode===null,'Fixed balanced graph has no temporal sharpen');
 const temporal=stage.temporal.node?.passNode;
 check(temporal?.isTAAUNode===true,'Actual TAAU owner required');
 check(stage.temporal.node.value===temporal._resolveRenderTarget?.texture,'Temporal texture ownership differs');
 check(stage.composeOutput===null,'Unexpected additional composite');
 check(stage.scenePass?.renderTarget===stage.gbuffer?.pass?.renderTarget,'G-buffer owner differs');
 const targets=['output','diffuseColor','normal','velocity'].map(name=>{
  const target=stage.scenePass.renderTarget,texture=stage.gbuffer.textures[name],index=target.textures.indexOf(texture);
  check(index>=0,'Actual scene attachment absent: '+name);return {label:'scene-'+name,target,index};
 });
 targets.push({label:'temporal-resolve',target:temporal._resolveRenderTarget,index:0},
  {label:'temporal-history-post-copy',target:temporal._historyRenderTarget,index:0});
 const grade=stage.grade,bloom=grade?.bloomNode,sharpen=grade?.sharpenNode;
 check(grade?.sharpness===1.2&&sharpen?.isSharpenNode===true,'Actual balanced grade sharpen required');
 check(bloom?.inputNode===stage.temporal.node&&bloom.inputNode.value===temporal._resolveRenderTarget.texture,'Bloom must consume the existing temporal resolve texture');
 check(sharpen.textureNode?.isRTTNode===true,'Actual encoded grade RTT input required');
 targets.push({label:'bloom-final-composite',target:bloom._renderTargetsHorizontal?.[0],index:0},
  {label:'bloom-vertical-0',target:bloom._renderTargetsVertical?.[0],index:0},
  {label:'grade-encoded-before-rcas',target:sharpen.textureNode.renderTarget,index:0},
  {label:'grade-encoded-after-rcas',target:sharpen._renderTarget,index:0});
 for(const q of targets)check(q.target?.isRenderTarget===true&&q.target.width>1&&q.target.height>1,'Written target absent: '+q.label);
 check(new Set(targets.map(q=>q.target.textures[q.index])).size===targets.length,'Unexpected target alias');
 return targets;
}
export function targetDescriptor(renderer,{label,target,index}) {
 const texture=target.textures[index];check(texture?.isTexture,'Texture absent: '+label);
 check(renderer.backend.has(texture),'Texture has no native backend data: '+label);
 const data=renderer.backend.get(texture),gpu=data.texture,desc=data.textureDescriptorGPU;
 check(gpu&&desc,'No uploaded native texture: '+label);
 check((target.samples??0)===0&&(desc.sampleCount??1)===1,'MSAA readback is outside this protocol');
 check((desc.mipLevelCount??1)===1&&gpu.depthOrArrayLayers===1,'Mipmap/array readback is outside this protocol');
 check(gpu.width===target.width&&gpu.height===target.height,'Native dimensions differ');
 check(gpu.format===desc.format,'Native texture format differs');
 check((gpu.usage&1)===1,'Native COPY_SRC usage absent');
 return {label,width:target.width,height:target.height,index,textureName:texture.name,format:desc.format,
  threeType:texture.type,threeFormat:texture.format,colorSpace:texture.colorSpace,flipY:texture.flipY,
  samples:target.samples??0,gpu:{width:gpu.width,height:gpu.height,depthOrArrayLayers:gpu.depthOrArrayLayers,
   format:gpu.format,mipLevelCount:gpu.mipLevelCount,sampleCount:gpu.sampleCount,usage:gpu.usage}};
}
function equalNative(a,b) {
 if(Object.is(a,b))return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const ka=Object.keys(a),kb=Object.keys(b);
 return ka.length===kb.length&&ka.every(k=>Object.hasOwn(b,k)&&equalNative(a[k],b[k]));
}
function finiteNative(value) {
 if(typeof value==='number')check(Number.isFinite(value),'Nonfinite native state');
 else if(value&&typeof value==='object')Object.values(value).forEach(finiteNative);
}
function counters(avatar) {
 const s=avatar.stage,r=s.renderer,n=r._nodes.nodeFrame,c=s.camera;
 return {tier:avatar.tier,occlusion:avatar.tierSettings?.occlusion,motion:avatar.clockSeconds,node:{frameId:n.frameId,renderId:n.renderId,time:n.time,deltaTime:n.deltaTime},
  rendererFrame:r.info.frame,render:structuredClone(r.info.render),temporal:s.temporal.frameEpoch(),
  camera:{world:c.matrixWorld.toArray(),projection:c.projectionMatrix.toArray(),view:c.matrixWorldInverse.toArray()},
  target:r.getRenderTarget()?.uuid??null,callback:r._animation.getAnimationLoop()===null};
}
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
function base64(b){let value='';for(let i=0;i<b.length;i+=0x8000)value+=String.fromCharCode(...b.subarray(i,i+0x8000));return btoa(value);}
export async function readExistingBoundaries(avatar,save) {
 check(typeof save==='function','An owned evidence sink is required');
 check(avatar.tier==='balanced'&&avatar.tierSettings?.occlusion===false,'Actual balanced no-occlusion settings required');
 const s=avatar.stage,r=s.renderer,targets=existingTargets(s),before=counters(avatar),descriptors=targets.map(q=>targetDescriptor(r,q));
 check(before.callback,'Native automatic render loop must already be stopped');
 const identities=targets.map(q=>({target:q.target,texture:q.target.textures[q.index],gpu:r.backend.get(q.target.textures[q.index]).texture}));
 finiteNative(before);descriptors.forEach(finiteNative);
 const validate=()=>{
  const now=counters(avatar);finiteNative(now);check(equalNative(now,before),'Native counters changed during readback');
  const owned=existingTargets(s);check(owned.length===targets.length,'Target set changed');
  for(let i=0;i<targets.length;i++) {
   check(owned[i].target===identities[i].target&&owned[i].target.textures[owned[i].index]===identities[i].texture,'Texture owner changed');
   check(r.backend.has(identities[i].texture),'Native texture data removed');
   check(r.backend.get(identities[i].texture).texture===identities[i].gpu,'Native texture owner changed');
   check(equalNative(targetDescriptor(r,owned[i]),descriptors[i]),'Texture descriptor changed');
  }
 };
 const records=[];
 for(let i=0;i<targets.length;i++) {
  const q=targets[i],desc=descriptors[i];
  validate();
  const raw=await r.readRenderTargetPixelsAsync(q.target,0,0,q.target.width,q.target.height,q.index,0);
  validate();
  const {pixels,layout}=packReadback(raw,desc),bytes=new Uint8Array(raw.buffer,raw.byteOffset,raw.byteLength);
  const record={...desc,layout,rawSHA256:await sha(bytes),pixelsSHA256:await sha(pixels)};
  validate();await save(record,base64(bytes));validate();records.push(record);
 }
 validate();const after=counters(avatar);
 return {before,after,records,aliases:[{consumer:'bloom.input',source:'temporal-resolve',sameNode:true,sameTexture:true}],allCountersAndTargetOwnersUnchanged:true};
}
