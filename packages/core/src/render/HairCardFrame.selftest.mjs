/** CPU ownership/fallback gates. Real WebGPU image and lifecycle evidence is separate. */
import assert from 'node:assert/strict';
import { BufferGeometry, BufferAttribute, Float32BufferAttribute, Mesh } from 'three/webgpu';
import { instancedArray, vec3 } from 'three/tsl';
import { createHairMaterial } from '../material/HairMaterial.js';
import { createHairCardFrame, inspectCardFrameLayout } from './HairCardFrame.js';
import { deriveCardGroom } from '../motion/HairDynamics.js';
import { readGlb, readPrimitive } from '../../../../tools/lut-bake/glb.mjs';
let groups=0;
async function test(name,fn){await fn();groups++;console.log('PASS '+name);}
async function fixture(){
 const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(new Float32Array(27),3));
 geometry.setAttribute('uv',new Float32BufferAttribute([0,0,0,0,0,0,.25,0,.375,0,.25,.5,.375,.5,.25,1,.375,1],2));
 geometry.setIndex([0,1,2,3,4,5,4,6,5,5,6,7,6,8,7]);
 const material=await createHairMaterial({flowMapUrl:null,depthMapUrl:null}),mesh=new Mesh(geometry,material),buffer=instancedArray(6,'vec3');
 material.positionNode=vec3(1,2,3);
 const state={write:1,reset:1,builtReset:1,ready:true,rawComputeUsed:false};let released=0,borrowed=0,retire=null;
 const dynamics={disposed:false,borrowCardEdges(callback){borrowed++;let live=true;const source={space:'mesh-local',chainCount:1,pointsPerChain:3,cardVertexBase:3,cardVertexCount:6,get live(){return live&&!dynamics.disposed;},state(){assert.ok(live&&!dynamics.disposed);return{...state};},read:i=>buffer.element(i),release(){if(live){live=false;released++;}}};retire=()=>{source.release();callback();};return source;}};
 const install=()=>createHairCardFrame({dynamics,mesh,material});
 const draw=()=>material.hair.cardFrame.enabled.update({object:mesh});
 return{geometry,material,mesh,state,dynamics,install,draw,counts:()=>({borrowed,released}),retire(){dynamics.disposed=true;retire();}};
}
await test('before draw holds; actual object update enables without changing position/coverage/index',async()=>{
 const f=await fixture(),normal=f.material.normalNode,position=f.material.positionNode,color=f.material.colorNode,index=f.geometry.index,attributes=Object.keys(f.geometry.attributes),h=f.install();
 assert.equal(h.report().mode,'derivative');f.draw();assert.equal(h.report().mode,'smooth');assert.equal(h.report().ownedBuffers,0);assert.equal(f.material.positionNode,position);assert.equal(f.material.colorNode,color);assert.equal(f.geometry.index,index);assert.deepEqual(Object.keys(f.geometry.attributes),attributes);
 h.dispose();assert.equal(f.material.normalNode,normal);assert.equal(f.material.hair.cardFrame,undefined);h.dispose();assert.deepEqual(f.counts(),{borrowed:1,released:1});
});
await test('first rebuild, reset, failed submission and raw compute fall back before drawing',async()=>{
 const f=await fixture();f.state.ready=false;const h=f.install();f.draw();assert.equal(h.report().mode,'derivative');f.state.ready=true;f.draw();assert.equal(h.report().mode,'smooth');f.state.reset++;f.draw();assert.equal(f.material.hair.cardFrame.enabled.value,0);f.state.builtReset++;f.draw();assert.equal(h.report().mode,'smooth');f.state.rawComputeUsed=true;f.draw();assert.equal(h.report().mode,'derivative');assert.match(h.report().reason,/untracked/);f.state.rawComputeUsed=false;f.state.ready=false;f.draw();assert.equal(h.report().mode,'derivative');h.dispose();
});
await test('each object identity guard holds then recovers; alternate object cannot borrow this frame',async()=>{
 const f=await fixture(),h=f.install(),frame=f.material.hair.cardFrame;
 for(const [object,key,value]of[[f.mesh,'geometry',new BufferGeometry()],[f.mesh,'material',{}],[f.material,'positionNode',vec3(4)],[f.material.hair,'cardFrame',{}]]){
  const original=object[key];object[key]=value;frame.enabled.update({object:f.mesh});assert.equal(frame.enabled.value,0);object[key]=original;f.draw();assert.equal(h.report().mode,'smooth');
 }
 frame.enabled.update({object:new Mesh()});assert.equal(frame.enabled.value,0);f.draw();assert.equal(h.report().mode,'smooth');h.dispose();
});
await test('synchronous source retirement removes graph; old uniform stays safe',async()=>{
 const f=await fixture(),normal=f.material.normalNode,h=f.install(),frame=f.material.hair.cardFrame;f.draw();f.retire();assert.equal(h.disposed,true);assert.equal(f.material.normalNode,normal);assert.equal(f.material.hair.cardFrame,undefined);frame.enabled.update({object:f.mesh});assert.equal(frame.enabled.value,0);assert.equal(h.report().mode,'disposed');assert.deepEqual(f.counts(),{borrowed:1,released:1});
});
await test('duplicate install refuses without an extra borrow; dispose permits reinstall',async()=>{
 const f=await fixture(),h=f.install();assert.throws(f.install,/already installed/);assert.deepEqual(f.counts(),{borrowed:1,released:0});h.dispose();const h2=f.install();f.draw();assert.equal(h2.report().mode,'smooth');h2.dispose();assert.deepEqual(f.counts(),{borrowed:2,released:2});
});
await test('unsupported atlas retains derivative shading, releases borrow and permits corrected retry',async()=>{
 const f=await fixture(),normal=f.material.normalNode;f.geometry.attributes.uv.setY(5,.2);const h=f.install();
 assert.equal(h.report().mode,'derivative');assert.equal(h.report().available,false);assert.match(h.report().reason,/evenly spaced/);
 assert.deepEqual(f.counts(),{borrowed:1,released:1});assert.equal(f.material.normalNode,normal);assert.equal(f.material.hair.cardFrame,undefined);
 h.dispose();f.geometry.attributes.uv.setY(5,.5);const restored=f.install();f.draw();assert.equal(restored.report().mode,'smooth');restored.dispose();
});
await test('foreign normal replacement survives cleanup',async()=>{
 const f=await fixture(),h=f.install(),external=vec3(0,1,0);f.material.normalNode=external;h.dispose();assert.equal(f.material.normalNode,external);assert.equal(f.material.hair.cardFrame,undefined);
});
await test('throwing normal restoration still releases source and registry',async()=>{
 const f=await fixture(),h=f.install(),normal=f.material.normalNode;
 Object.defineProperty(f.material,'normalNode',{get:()=>normal,set(){throw Error('normal restore red');},configurable:true});
 assert.throws(()=>h.dispose(),/cleanup failed/);assert.deepEqual(f.counts(),{borrowed:1,released:1});assert.equal(h.disposed,true);assert.equal(f.material.hair.cardFrame,undefined);h.dispose();
});
await test('material refusal releases pending source without overriding installed frame',async()=>{
 const f=await fixture(),h=f.install(),other=new Mesh(f.geometry,f.material),frame=f.material.hair.cardFrame;
 assert.throws(()=>createHairCardFrame({dynamics:f.dynamics,mesh:other,material:f.material}),/already installed/);assert.equal(f.material.hair.cardFrame,frame);f.draw();assert.equal(h.report().mode,'smooth');h.dispose();assert.deepEqual(f.counts(),{borrowed:2,released:2});
});
await test('mixed triangles, inverted width, uneven rings and out of range index are rejected',async()=>{
 const descriptor={space:'mesh-local',chainCount:1,pointsPerChain:3,cardVertexBase:3,cardVertexCount:6};
 for(const mutate of[f=>f.geometry.index.setX(0,3),f=>f.geometry.attributes.uv.setX(4,.1),f=>f.geometry.attributes.uv.setY(5,.1),f=>f.geometry.index.setX(0,99)]){const f=await fixture();mutate(f);assert.throws(()=>inspectCardFrameLayout(f.geometry,descriptor));}
});
await test('all six shipped bob bakes satisfy actual solver/card atlas layout',()=>{
 const layouts=[];
 for(const [style,bake]of[['bob01','g000'],['bob01','g025'],['bob01','g050'],['bob01','g075'],['bob01','g100'],['bob02','g050']]){
  const path=new URL(`../../../../assets/hair/${style}/${bake}.glb`,import.meta.url),p=readPrimitive(readGlb(path),'hair_'+style),geometry=new BufferGeometry();
  geometry.setAttribute('position',new BufferAttribute(new Float32Array(p.positions),3));geometry.setAttribute('uv',new BufferAttribute(new Float32Array(p.uvs),2));geometry.setIndex(new BufferAttribute(p.indices,1));
  const groom=deriveCardGroom(geometry),layout=inspectCardFrameLayout(geometry,{...groom,space:'mesh-local'});assert.equal(layout.cards,496);assert.equal(layout.rings,17);assert.equal(layout.width,.123046875);layouts.push({style,bake,...layout});geometry.dispose();
 }
 console.log(JSON.stringify({layouts}));
});
await test('unexpected source read failure propagates while releasing pending ownership',async()=>{
 const f=await fixture(),borrow=f.dynamics.borrowCardEdges;f.dynamics.borrowCardEdges=callback=>{const source=borrow(callback);source.read=()=>{throw Error('source read red');};return source;};
 assert.throws(f.install,/source read red/);assert.deepEqual(f.counts(),{borrowed:1,released:1});assert.equal(f.material.hair.cardFrame,undefined);
});
console.log(JSON.stringify({groups}));
