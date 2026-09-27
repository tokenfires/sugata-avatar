import assert from 'node:assert/strict';
import {PerspectiveCamera,Scene,UnsignedByteType,RGFormat,RedFormat} from 'three/webgpu';
import {pass} from 'three/tsl';
import {GBuffer} from '../../../../packages/core/src/render/GBuffer.js';
import {createTemporalResolve} from '../../../../packages/core/src/render/TRAAPost.js';
import {Grade} from '../../../../packages/core/src/render/Grade.js';
import {QUALITY_TIERS} from '../../../../packages/core/src/Avatar.js';
import {claimArtifactLabel} from './artifact-label.mjs';
import {existingTargets,targetDescriptor,readExistingBoundaries} from './read-targets.mjs';
let groups=0;
async function test(name,fn){await fn();groups++;console.log('PASS '+name);}
// Real exported balanced settings and real Three/Sugata node graph; only GPU storage/copy is a fixture.
function fixture() {
 const tier=QUALITY_TIERS.balanced,camera=new PerspectiveCamera(),scenePass=pass(new Scene(),camera),gbuffer=new GBuffer(scenePass);
 const temporal=createTemporalResolve({mode:tier.temporalAA,gbuffer,camera}),grade=new Grade({sharpness:tier.gradeSharpness});grade.compose(gbuffer,temporal.node);
 assert.equal(tier.occlusion,false);assert.equal(temporal.sharpenNode,null);
 assert.equal(grade.bloomNode.inputNode,temporal.node);assert.equal(grade.bloomNode.inputNode.renderTarget,undefined);
 const owner=temporal.node.passNode;
 assert.equal(grade.bloomNode.inputNode.value,owner._resolveRenderTarget.texture);
 assert.equal(grade.sharpenNode.textureNode.isRTTNode,true);
 const expected=[scenePass.renderTarget,owner._resolveRenderTarget,owner._historyRenderTarget,
  grade.bloomNode._renderTargetsHorizontal[0],grade.bloomNode._renderTargetsVertical[0],
  grade.sharpenNode.textureNode.renderTarget,grade.sharpenNode._renderTarget];
 for(const t of expected)t.setSize(2,2);
 const records=new WeakMap(),backend={has:q=>records.has(q),get:q=>records.get(q)};
 for(const t of expected)for(const texture of t.textures){
  const format=texture.type===UnsignedByteType?(texture.format===RedFormat?'r8unorm':'rgba8unorm'):(texture.format===RGFormat?'rg16float':'rgba16float');
  records.set(texture,{texture:{width:2,height:2,depthOrArrayLayers:1,format,mipLevelCount:1,sampleCount:1,usage:17},textureDescriptorGPU:{format,mipLevelCount:1,sampleCount:1}});
 }
 let calls=0;
 const renderer={backend,_nodes:{nodeFrame:{frameId:1000065,renderId:42,time:0,deltaTime:0}},info:{frame:65,render:{drawCalls:10,triangles:99}},_animation:{getAnimationLoop:()=>null},getRenderTarget:()=>null,
  async readRenderTargetPixelsAsync(t,x,y,w,h,index,face){calls++;assert.deepEqual([x,y,w,h,face],[0,0,2,2,0]);const fmt=records.get(t.textures[index]).texture.format;
   const bpt=fmt==='rgba16float'?8:4,bytes=256+2*bpt;return fmt==='rgba8unorm'?new Uint8Array(bytes).fill(128):new Uint16Array(bytes/2).fill(0x3c00);}};
 const stage={backendName:'webgpu',renderer,scenePass,gbuffer,camera,grade,ambientOcclusion:null,composeOutput:null,temporal};
 const selected=existingTargets(stage);const names=new Set();for(const q of selected)claimArtifactLabel(q.label,names);
 assert.deepEqual(selected.map(q=>q.label),['scene-output','scene-diffuseColor','scene-normal','scene-velocity','temporal-resolve','temporal-history-post-copy','bloom-final-composite','bloom-vertical-0','grade-encoded-before-rcas','grade-encoded-after-rcas']);
 assert.deepEqual(selected.slice(0,4).map(q=>q.target),Array(4).fill(scenePass.renderTarget));
 assert.deepEqual(selected.slice(4).map(q=>q.target),expected.slice(1));
 return {avatar:{stage,clockSeconds:0,tier:'balanced',tierSettings:tier},renderer,records,calls:()=>calls};
}
await test('Actual balanced graph supplies every selected target and the exact bloom alias',async()=>{
 const f=fixture(),saved=[];let saving=false;const r=await readExistingBoundaries(f.avatar,async(m,b)=>{assert.equal(saving,false);saving=true;await Promise.resolve();assert.equal(Buffer.from(b,'base64').length,m.layout.rawBytes);saved.push(m);saving=false;});
 assert.equal(r.records.length,10);assert.equal(f.calls(),10);assert.equal(saved.length,10);assert.deepEqual(r.before,r.after);assert.equal(r.allCountersAndTargetOwnersUnchanged,true);assert.equal(r.aliases[0].source,'temporal-resolve');
});
await test('Missing, foreign, or aliased graph boundaries fail before reading',()=>{
 for(const kind of['missing','foreign-bloom','alias','temporal-sharpen','compose']){const f=fixture(),s=f.avatar.stage;if(kind==='missing')s.grade.sharpenNode.textureNode.renderTarget=null;if(kind==='foreign-bloom')s.grade.bloomNode.inputNode={value:s.temporal.node.value};if(kind==='alias')s.grade.bloomNode._renderTargetsVertical[0]=s.grade.bloomNode._renderTargetsHorizontal[0];if(kind==='temporal-sharpen')s.temporal.sharpenNode={};if(kind==='compose')s.composeOutput=()=>{};assert.throws(()=>existingTargets(s));assert.equal(f.calls(),0);}
});
await test('Native upload, dimensions, sample count, mip, usage and format are required',()=>{
 for(const kind of['upload','size','sample','mip','usage','format']){const f=fixture(),q=existingTargets(f.avatar.stage)[0],d=f.records.get(q.target.textures[q.index]);if(kind==='upload')f.records.delete(q.target.textures[q.index]);if(kind==='size')d.texture.width=4;if(kind==='sample')d.textureDescriptorGPU.sampleCount=4;if(kind==='mip')d.textureDescriptorGPU.mipLevelCount=2;if(kind==='usage')d.texture.usage=16;if(kind==='format')d.texture.format='rgba8unorm';assert.throws(()=>targetDescriptor(f.renderer,q));assert.equal(f.calls(),0);}
});
await test('A changed motion clock fails and does not read a second target',async()=>{
 const f=fixture();await assert.rejects(readExistingBoundaries(f.avatar,async()=>{f.avatar.clockSeconds=1;}),/counters changed/);assert.equal(f.calls(),1);
});
await test('Foreign GPU storage and descriptor change at end fail',async()=>{
 for(const change of['identity','descriptor']){const f=fixture();let n=0;await assert.rejects(readExistingBoundaries(f.avatar,async()=>{if(++n===10){const q=existingTargets(f.avatar.stage)[0],d=f.records.get(q.target.textures[q.index]);if(change==='identity')d.texture={...d.texture};else q.target.textures[q.index].flipY=!q.target.textures[q.index].flipY;}}),change==='identity'?/texture owner changed/:/descriptor changed/);}
});
await test('GPU readback rejection and evidence-sink failure propagate with no retry',async()=>{
 const f=fixture(),e=new Error('native copy failed');f.renderer.readRenderTargetPixelsAsync=()=>Promise.reject(e);await assert.rejects(readExistingBoundaries(f.avatar,async()=>{}),q=>q===e);
 const g=fixture();await assert.rejects(readExistingBoundaries(g.avatar,async()=>{throw e;}),q=>q===e);assert.equal(g.calls(),1);
});
await test('Unread target storage cannot be changed by the evidence sink',async()=>{
 const f=fixture();await assert.rejects(readExistingBoundaries(f.avatar,async()=>{const q=existingTargets(f.avatar.stage)[1],d=f.records.get(q.target.textures[q.index]);d.texture={...d.texture};}),/texture owner changed/);assert.equal(f.calls(),1);
});
await test('Negative zero is preserved and nonfinite counters are rejected',async()=>{
 const f=fixture();await assert.rejects(readExistingBoundaries(f.avatar,async()=>{f.avatar.clockSeconds=-0;}),/counters changed/);assert.equal(f.calls(),1);
 const g=fixture();g.avatar.clockSeconds=NaN;await assert.rejects(readExistingBoundaries(g.avatar,async()=>{}),/Nonfinite/);assert.equal(g.calls(),0);
});
await test('Actual balanced tier settings are enforced against wrong tier, flag, and AO owner',async()=>{
 for(const kind of['tier','setting','owner']){const f=fixture();if(kind==='tier')f.avatar.tier='high';if(kind==='setting')f.avatar.tierSettings={...QUALITY_TIERS.balanced,occlusion:true};if(kind==='owner')f.avatar.stage.ambientOcclusion={};await assert.rejects(readExistingBoundaries(f.avatar,async()=>{}));assert.equal(f.calls(),0);}
});
await test('Artifact sink accepts actual graph labels and rejects unsafe or duplicate names',()=>{
 const labels=new Set();assert.equal(claimArtifactLabel('scene-diffuseColor',labels),'scene-diffuseColor');assert.throws(()=>claimArtifactLabel('scene-diffuseColor',labels),/Duplicate/);
 for(const label of['../a','a/b','a.b','é','a\nb','a\n','a\r','a b','',null,123])assert.throws(()=>claimArtifactLabel(label,labels),/Unsafe/);
 assert.deepEqual([...labels],['scene-diffuseColor']);
});
console.log(JSON.stringify({groups,passed:true,graph:'Actual balanced Sugata and Three nodes; GPU data/copy fixture only'}));
