// One real loader parse; no render and no production mutation.
import fs from 'node:fs';
import path from 'node:path';
import{fileURLToPath}from 'node:url';
import{createHash}from 'node:crypto';
import v8 from 'node:v8';
import * as T from 'three';
import{GLTFLoader}from 'three/addons/loaders/GLTFLoader.js';
import{OwnedBudget,readOriginal,bindCompleteCPU,makeInfluenceTable,requireThat as ok,affine,PAYLOAD_CAP}from './full-influence.mjs';
const P=fileURLToPath(new URL('.',import.meta.url)),R=path.resolve(P,'../../../..');
const budget=new OwnedBudget(),stages=[],outputs=[],started=new Date().toISOString();
let graph,snapshot,rawFd,rawBytes=0,rawHash=createHash('sha256'),restored=false;
const rawIndex={},rawAccessors=new Set(),generated=['CLAIM.json'];
const equal=(a,b)=>a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
const hash=b=>createHash('sha256').update(b).digest('hex');
function readJSON(name){const n=fs.statSync(path.join(P,name)).size;ok(n<=2097152,'METADATA_CAP');return JSON.parse(budget.take(name,n,()=>fs.readFileSync(path.join(P,name))).toString('utf8'));}
function memory(label){stages.push({label,utc:new Date().toISOString(),ownedCumulative:budget.bytes,...process.memoryUsage(),v8HeapLimit:v8.getHeapStatistics().heap_size_limit});}
function jsonOutput(name,value){
const text=JSON.stringify(value),n=Buffer.byteLength(text);ok(n<=(name==='FAILURE.json'? 32768:1048576),'JSON_OUTPUT_CAP');
const b=budget.take(name + ' UTF8',n,()=>Buffer.from(text));
ok(rawBytes + n + 65536<=16777216,'TOTAL_OUTPUT_CAP');fs.writeFileSync(path.join(P,name),b,{flag:'wx'});generated.push(name);
}
function bytesOf(a){return Buffer.from(a.buffer,a.byteOffset,a.byteLength);}
function emit(id,a,metadata={}){
ok(!rawIndex[id]&&rawBytes + a.byteLength + 1114112<=16777216,'RAW_OUTPUT_CAP');
const b=bytesOf(a),offset=rawBytes;let done=0;
while (done < b.length){const n=fs.writeSync(rawFd,b,done,b.length - done);ok(n > 0,'WRITE_PROGRESS');done +=n;}
rawHash.update(b);rawBytes +=b.length;
rawIndex[id]={offset,bytes:b.length,sha256:hash(b),...metadata};return id;
}
function emitAccessor(src,d){
const id=`source/accessor/${d.id}`;
if (!rawAccessors.has(d.id)){emit(id,src.raw(d),{accessor:d.id,count:d.count,size:d.size,componentType:d.componentType,sourceByteOffset:d.byteOffset,sourceBytes:d.byteLength});rawAccessors.add(d.id);}
return id;
}
function fingerprint(bindings){
const rows=[];
for (const b of bindings){
const g=b.mesh.geometry;
for (const [name,a] of Object.entries(g.attributes)) rows.push([b.source.node,name,a.itemSize,a.count,hash(bytesOf(a.array))]);
if (g.index) rows.push([b.source.node,'index',g.index.count,hash(bytesOf(g.index.array))]);
for (const [name,list] of Object.entries(g.morphAttributes)) list.forEach((a,i)=>rows.push([b.source.node,name,i,a.itemSize,a.count,hash(bytesOf(a.array))]));
}
return rows;
}
function captureGraph(g){return g.nodes.map(n=>({p:n.position.toArray(),q:n.quaternion.toArray(),s:n.scale.toArray(),local:n.matrix.toArray(),world:n.matrixWorld.toArray(),morph:n.morphTargetInfluences ? [...n.morphTargetInfluences]:null}));}
function restoreGraph(){
if (!graph||!snapshot) return false;
graph.nodes.forEach((n,i)=>{const x=snapshot[i];n.position.fromArray(x.p);n.quaternion.fromArray(x.q);n.scale.fromArray(x.s);if (x.morph) n.morphTargetInfluences.splice(0,n.morphTargetInfluences.length,...x.morph);});
graph.scene.updateMatrixWorld(true);
const after=captureGraph(graph);
for (let i=0;i < after.length;i++) for (const k of ['p','q','s','local','world']) ok(equal(after[i][k],snapshot[i][k]),'RESTORE_'+ k);
for (let i=0;i < after.length;i++) if (snapshot[i].morph) ok(equal(after[i].morph,snapshot[i].morph),'RESTORE_MORPH');
restored=true;return true;
}
function mv(m,p){return [0,1,2,3].map(r=>m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r] * p[3]);}
function scalarReference(e,b,i){
const m=[e.pos.at(i,0),e.pos.at(i,1),e.pos.at(i,2),1],weights=b.mesh.morphTargetInfluences;
for (let k=0;k < weights.length;k++) if (weights[k]!==0) for (let c=0;c < 3;c++) m[c] +=weights[k] * e.morphs[k].at(i,c);
const base=mv(b.mesh.bindMatrix.elements,m),result=[0,0,0,0];let sum=0;
for (const s of e.sets) for (let c=0;c < 4;c++) sum +=s.weights.at(i,c);
ok(Number.isFinite(sum)&&sum > 0,'REFERENCE_TOTAL');
for (const s of e.sets) for (let c=0;c < 4;c++){
const w=s.weights.at(i,c);if (w===0) continue;const j=s.joints.at(i,c);
const term=mv(b.mesh.skeleton.bones[j].matrixWorld.elements,mv(b.mesh.skeleton.boneInverses[j].elements,base));
for (let r=0;r < 4;r++) result[r] +=w / sum * term[r];
}
const v=mv(b.mesh.bindMatrixInverse.elements,result);ok(v.every(Number.isFinite)&&Math.abs(v[3] - 1)<=1e-10,'REFERENCE_W');
return{local:v.slice(0,3).map(x=>x / v[3]),morph:m.slice(0,3)};
}
function guardChecks(){
const desc=(a,count=1)=>({count,size:4,at:(i,c)=>a[c]});
const cases=[
['pair','TABLE_PAIR',{weights:null}],
['rows','TABLE_ROWS',{weights:desc([.25,.25,.25,.25],2)}],
['joint','TABLE_JOINT',{joints:desc([4,1,2,3])}],
['negative','TABLE_NEGATIVE',{weights:desc([-.25,.5,.5,.25])}],
['nonfinite','TABLE_FINITE',{weights:desc([NaN,.25,.25,.25])}],
['zero','TABLE_TOTAL',{weights:desc([0,0,0,0])}],
['duplicate','TABLE_DUPLICATE',{joints:desc([0,0,2,3])}],
['unit','TABLE_UNIT',{weights:desc([Math.fround(.6),0,0,0])}]
];
return cases.map(([name,wanted,change])=>{
let caught;try{makeInfluenceTable([{ordinal:0,joints:desc([0,1,2,3]),weights:desc([.25,.25,.25,.25]),...change}],1,4,budget);}catch (e){caught=e.message;}
ok(caught===wanted,'GUARD_'+ name);return{name,expected:wanted,actual:caught,pass:true};
});
}
async function retainedPayload(src,gltf){
const buffers=new Set(),records=[];
function add(value,label){
if (!value) return;
const a=value.isInterleavedBufferAttribute ? value.data.array:value.array??value;
const b=a instanceof ArrayBuffer ? a:ArrayBuffer.isView(a) ? a.buffer:null;
if (b&&!buffers.has(b)){buffers.add(b);records.push({label,bytes:b.byteLength});}
}
for (const b of graph.bindings){
for (const [n,a] of Object.entries(b.mesh.geometry.attributes)) add(a,`geometry/${b.source.node}/${n}`);
add(b.mesh.geometry.index,`index/${b.source.node}`);
for (const [n,list] of Object.entries(b.mesh.geometry.morphAttributes)) list.forEach((a,i)=>add(a,`morph/${b.source.node}/${n}/${i}`));
}
for (const [type,length] of [['buffer',1],['bufferView',src.json.bufferViews.length],['accessor',src.json.accessors.length]]) for (let i=0;i < length;i++){
const cached=gltf.parser.cache.get(`${type}:${i}`);if (cached!==undefined) add(await cached,`${type}/${i}`);
}
const bytes=records.reduce((n,r)=>n + r.bytes,0);ok(bytes<=PAYLOAD_CAP,'RETAINED_PAYLOAD_CAP');
return{bytes,buffers:records,limit:'Retained backing buffers only; does not observe transient allocations or hard RSS.'};
}
try{
const e=readJSON('EXEC.json'),claim=readJSON('CLAIM.json'),fixed=readJSON('FIXED.json');
ok(claim.pid===process.pid&&claim.attempt===1&&path.resolve(process.execPath)===e.node&&T.REVISION==='185','EXECUTION_IDENTITY');
const endian=budget.array(Uint16Array,1,'endianness probe');endian[0]=1;ok(new Uint8Array(endian.buffer)[0]===1,'LITTLE_ENDIAN');
const inputPath=path.resolve(R,e.input),size=fs.statSync(inputPath).size;
ok(size===fixed.candidate.bytes&&size<=33554432,'INPUT_SIZE');
const input=budget.take('original input bytes',size,()=>fs.readFileSync(inputPath));ok(hash(input)===fixed.candidate.sha256,'INPUT_SHA');
const src=readOriginal(input);ok(src.json.nodes.length===166&&src.entries.length===6&&src.entries.reduce((n,r)=>n + r.morphs.length,0)===236,'SOURCE_COUNTS');
const helpers=Object.values(fixed.helper_indices).flat();ok(helpers.length===106&&new Set(helpers).size===106&&fixed.joints.length===53,'FIXED_COUNTS');
memory('raw source captured');
const loaderInput=budget.take('distinct loader input bytes',size,()=>input.buffer.slice(input.byteOffset,input.byteOffset + input.byteLength));
const intercepted=[],loader=new GLTFLoader();
loader.register(()=>({name:'CPU_TEXTURE_BYPASS',loadTexture(index){ok(Number.isInteger(index)&&index>=0&&index<=5,'TEXTURE_INDEX');intercepted.push(index);return Promise.resolve(new T.Texture());}}));
const gltf=await loader.parseAsync(loaderInput,'');// The sole actual parse.
gltf.scene.updateMatrixWorld(true);
graph=await bindCompleteCPU(src,gltf,budget);graph.scene=gltf.scene;
ok(graph.bindings.length===6&&graph.nodes.length===166,'ACTUAL_COUNTS');
const boneSet=new Set(graph.nodes.filter(n=>n.isBone));ok(boneSet.size===53&&helpers.every(i=>!graph.nodes[i].isBone&&!graph.nodes[i].isMesh),'ACTUAL_HELPERS');
for (const j of fixed.joints){const n=graph.nodes[j.node];ok(n.isBone&&n.name===j.name&&n.matrixWorld.elements.every((x,i)=>Math.abs(x - j.matrixWorld[i])<=1e-6),'FROZEN_BONE_WORLD');}
for (const b of graph.bindings){
const f=fixed.meshes.find(x=>x.node===b.source.node),names=src.json.meshes[b.source.mesh].extras?.targetNames;
ok(f&&f.morphs===b.source.morphs.length&&equal(f.defaults,b.mesh.morphTargetInfluences)&&names?.length===f.morphs&&new Set(names).size===names.length&&names.every((n,i)=>b.mesh.morphTargetDictionary[n]===i),'NAMED_MORPH_DEFAULTS');
}
const retained=await retainedPayload(src,gltf);memory('actual graph and complete binding');
const guards=guardChecks();snapshot=captureGraph(graph);const geometryBefore=fingerprint(graph.bindings);
const methodsBefore=[T.Mesh.prototype.getVertexPosition,T.SkinnedMesh.prototype.getVertexPosition,T.SkinnedMesh.prototype.applyBoneTransform];
rawFd=fs.openSync(path.join(P,'RAW.bin'),'wx');generated.push('RAW.bin');
const sources=graph.bindings.map(b=>({node:b.source.node,mesh:b.source.mesh,primitive:0,skin:b.source.skin,owner:b.source.owner,rows:b.source.pos.count,
position:emitAccessor(src,b.source.pos),joints:b.source.sets.map(s=>emitAccessor(src,s.joints)),weights:b.source.sets.map(s=>emitAccessor(src,s.weights)),ibm:emitAccessor(src,b.source.ibm),jointNodes:b.source.jointNodes,
tableJoints:emit(`table/${b.source.node}/joints`,b.table.joints,{type:'U16',slots:b.table.slots}),tableRaw:emit(`table/${b.source.node}/raw`,b.table.raw,{type:'F32'}),tableNormalized:emit(`table/${b.source.node}/normalized`,b.table.normalized,{type:'F64'}),positiveEntries:b.table.positiveCount}));
const arm=graph.nodes.find(n=>n.isBone&&n.name==='upperarm_r');ok(arm,'POSE_BONE');
const identity=new T.Matrix4().elements;
const states=[];
for (let state=0;state < 2;state++){
if (state===1){const i=graph.nodes.indexOf(arm);arm.quaternion.fromArray(snapshot[i].q).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),.35));graph.bindings.forEach(b=>{b.mesh.morphTargetInfluences[0]=.2;});gltf.scene.updateMatrixWorld(true);}
const rows=[];
for (const b of graph.bindings){
const ent=b.source,actual=b.positions(),reference=budget.array(Float64Array,actual.length,'independent coefficient positions');
const active=[];for (let k=0;k < ent.morphs.length;k++) if (b.mesh.morphTargetInfluences[k]!==0) active.push({target:k,weight:b.mesh.morphTargetInfluences[k],source:emitAccessor(src,ent.morphs[k])});
ok(b.mesh.bindMatrix.elements.every((x,i)=>x===identity[i]),'ACTUAL_IDENTITY_BIND');
let maxLocal=0,maxWorld=0,maxMorph=0;const observedMorph=new T.Vector3(),world=new T.Vector3();
for (let i=0;i < ent.pos.count;i++){
const r=scalarReference(ent,b,i);T.Mesh.prototype.getVertexPosition.call(b.mesh,i,observedMorph);
const expectedWorld=mv(b.mesh.matrixWorld.elements,[...r.local,1]);world.set(actual[3 * i],actual[3 * i + 1],actual[3 * i + 2]).applyMatrix4(b.mesh.matrixWorld);
for (let c=0;c < 3;c++){reference[3 * i + c]=r.local[c];maxLocal=Math.max(maxLocal,Math.abs(actual[3 * i + c] - r.local[c]));maxWorld=Math.max(maxWorld,Math.abs(world.getComponent(c) - expectedWorld[c] / expectedWorld[3]));maxMorph=Math.max(maxMorph,Math.abs(observedMorph.getComponent(c) - r.morph[c]));}
}
ok([maxLocal,maxWorld,maxMorph].every(x=>Number.isFinite(x)&&x<=1e-10),'FULL_POSITION_REFERENCE');
rows.push({node:ent.node,active,morphDefaults:[...b.mesh.morphTargetInfluences],B:b.mesh.bindMatrix.toArray(),C:b.mesh.bindMatrixInverse.toArray(),W:b.mesh.matrixWorld.toArray(),boneWorlds:b.mesh.skeleton.bones.map(n=>n.matrixWorld.toArray()),IBM:b.mesh.skeleton.boneInverses.map(m=>m.toArray()),actual:emit(`state/${state}/${ent.node}/actual`,actual,{type:'F64',rows:ent.pos.count,size:3}),reference:emit(`state/${state}/${ent.node}/reference`,reference,{type:'F64'}),maxLocal,maxWorld,maxMorph});
}
const human=graph.bindings.find(b=>b.source.owner==='Human'),witness=fixed.first_influence_witness;
ok(human&&witness.split_vertex===2997&&witness.native_vertex===750,'WITNESS_OWNER');
const primitive=src.json.meshes[human.source.mesh].primitives[0],nativeKeys=Object.keys(primitive.attributes).filter(k=>k.toLowerCase()==='_sugata_native_vertex');ok(nativeKeys.length===1,'NATIVE_ATTRIBUTE');
const native=src.accessor(primitive.attributes[nativeKeys[0]]);ok(native.size===1&&native.at(2997)===750,'NATIVE_VERTEX_WITNESS');emitAccessor(src,native);
const d=human.source.sets[1];ok(d&&d.joints.at(2997,0)===25&&d.weights.at(2997,0)===.0010000000474974513&&human.mesh.skeleton.bones[25].name==='upperarm_r','SECONDARY_WITNESS');
const complete=human.vertex(2997).toArray(),stock=human.mesh.getVertexPosition(2997,new T.Vector3()).toArray();
const allTerms=[];let sum=0;for (const s of human.source.sets) for (let c=0;c < 4;c++) sum +=s.weights.at(2997,c);
for (const s of human.source.sets) for (let c=0;c < 4;c++) if (s.weights.at(2997,c) > 0) allTerms.push({set:s.ordinal,component:c,joint:s.joints.at(2997,c),raw:s.weights.at(2997,c),normalized:s.weights.at(2997,c) / sum});
states.push({state,nodes:captureGraph(graph),meshes:rows,witness:{split:2997,native:750,complete,stockFourWeightControl:stock,allTerms,sum,scope:'CPU source arithmetic only; no visible/native-pose defect inferred.'}});memory(`state ${state} complete`);
}
restoreGraph();ok(JSON.stringify(fingerprint(graph.bindings))===JSON.stringify(geometryBefore),'GEOMETRY_PRESERVATION');
ok(methodsBefore[0]===T.Mesh.prototype.getVertexPosition&&methodsBefore[1]===T.SkinnedMesh.prototype.getVertexPosition&&methodsBefore[2]===T.SkinnedMesh.prototype.applyBoneTransform,'NO_GLOBAL_METHOD_MUTATION');
ok(hash(input)===fixed.candidate.sha256,'ORIGINAL_MEMORY_BYTES');
const scratch=budget.array(Uint8Array,65536,'post-pin streaming buffer');
for (const row of e.pins){
const p=path.resolve(R,row.path);ok(fs.statSync(p).size===row.bytes,'POST_SIZE');const h=createHash('sha256'),fd=fs.openSync(p,'r');let n;
try{while ((n=fs.readSync(fd,scratch,0,scratch.length,null)) > 0) h.update(scratch.subarray(0,n));}finally{fs.closeSync(fd);}
ok(h.digest('hex')===row.sha256,'POST_SHA');
}
fs.closeSync(rawFd);rawFd=undefined;const rawSha=rawHash.digest('hex');memory('restored and pins verified');
const result={status:'PACKET_PASS',started,finished:new Date().toISOString(),pid:process.pid,node:process.execPath,threeRevision:T.REVISION,actualLoaderParses:1,states,sources,sourceJSON:src.json,rawIndex,rawBytes,rawSha256:rawSha,guards,geometryBefore,graphRestored:restored,sourcePinsUnchanged:true,originalMemoryBytesUnchanged:true,methodsUnchanged:true,interceptedTextures:intercepted,payloadEstimate:src.payloadEstimate,retained,memoryStages:stages,ownedAllocations:budget.allocations,ownedCumulativeBytes:budget.bytes,scope:'Finite complete-influence CPU mesh-local position operator only. No stockGPU/normal/raycast/bounds/nativeAri/fit/motion/appearance/performance/AAA qualification.'};
jsonOutput('RESULT.json',result);
const allBytes=generated.reduce((n,name)=>n + fs.statSync(path.join(P,name)).size,0);ok(allBytes<=16777216,'FINAL_OUTPUT_CAP');
console.log(JSON.stringify({status:'PACKET_PASS',pid:process.pid,rawBytes,rawSha256:rawSha,resultBytes:fs.statSync(path.join(P,'RESULT.json')).size,outputTotalBytes:allBytes,ownedCumulativeBytes:budget.bytes,graphRestored:restored}));
}catch (error){
let restoreError;
try{restoreGraph();}catch (x){restoreError=String(x);}
if (rawFd!==undefined){try{fs.closeSync(rawFd);}catch{}}
try{jsonOutput('FAILURE.json',{status:'FAILURE',started,utc:new Date().toISOString(),pid:process.pid,error:String(error),stack:String(error.stack).slice(0,6000),graphRestored:restored,restoreError,rawPartialBytes:rawBytes,generated,stages,limits:'Partial artifacts retained; no retry or PASS inferred.'});}catch (x){console.error('FAILURE_RECORD_UNAVAILABLE',String(x));}
console.error('PACKET_FAILURE',String(error));process.exitCode=1;
}
