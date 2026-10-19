// Experimental CPU-only positions. Stock rendering/bounds/raycasting stay untouched.
import{Mesh,Matrix4,Vector3,Vector4,AttachedBindMode}from 'three';
export const OWNED_CAP=64 * 1024 * 1024;
export const PAYLOAD_CAP=256 * 1024 * 1024;
export function requireThat(ok,code){if (!ok) throw new Error(code);}
const integer=(n,lo,hi)=>Number.isSafeInteger(n)&&n>=lo&&n<=hi;
const finite=a=>a.every(Number.isFinite);
export class OwnedBudget{
constructor(){this.bytes=0;this.allocations=[];this.backings=new Set();}
take(label,bytes,create){
requireThat(integer(bytes,0,OWNED_CAP)&&this.bytes + bytes<=OWNED_CAP,'OWNED_CAP');
this.bytes +=bytes;
const value=create(),backing=value instanceof ArrayBuffer ? value:value.buffer;
requireThat(backing instanceof ArrayBuffer&&backing.byteLength===bytes&&!this.backings.has(backing),'OWNERSHIP');
this.backings.add(backing);this.allocations.push({label,bytes});return value;
}
array(Type,count,label){
requireThat(integer(count,0,OWNED_CAP / Type.BYTES_PER_ELEMENT),'ARRAY_COUNT');
return this.take(label,count * Type.BYTES_PER_ELEMENT,()=>new Type(count));
}
alias(value){requireThat(this.backings.has(value.buffer),'UNKNOWN_OWNED_ALIAS');return value;}
}
const COMPONENT={5121:[1,'getUint8'],5123:[2,'getUint16'],5125:[4,'getUint32'],5126:[4,'getFloat32']};
const SIZE={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
export function readOriginal(input){
requireThat(ArrayBuffer.isView(input)&&input.byteLength<=33554432&&input.byteLength>=28,'GLB_SIZE');
const v=new DataView(input.buffer,input.byteOffset,input.byteLength);
requireThat(v.getUint32(0,true)===0x46546c67&&v.getUint32(4,true)===2&&v.getUint32(8,true)===input.byteLength,'GLB_HEADER');
const jl=v.getUint32(12,true);
requireThat(jl<=2097152&&jl % 4===0&&28 + jl<=input.byteLength&&v.getUint32(16,true)===0x4e4f534a,'JSON_CHUNK');
const json=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(input.buffer,input.byteOffset + 20,jl)));
const bh=20 + jl,bl=v.getUint32(bh,true),start=bh + 8;
requireThat(bl % 4===0&&start + bl===input.byteLength&&v.getUint32(bh + 4,true)===0x004e4942,'BIN_CHUNK');
requireThat(json.asset?.version==='2.0'&&json.buffers?.length===1&&json.buffers[0].uri===undefined&&integer(json.buffers[0].byteLength,0,bl)&&bl - json.buffers[0].byteLength<=3,'INTERNAL_BUFFER');
requireThat(Array.isArray(json.accessors)&&Array.isArray(json.bufferViews)&&json.accessors.length<=4096&&json.bufferViews.length<=4096&&Array.isArray(json.nodes)&&json.nodes.length<=4096&&!json.animations?.length,'SUPPORTED_DOCUMENT');
requireThat(!json.extensionsRequired?.some(x=>/draco|meshopt|quantization|instancing/i.test(x)),'UNSUPPORTED_EXTENSION');
let viewBytes=0;
for (const b of json.bufferViews){
requireThat(b.buffer===0&&integer(b.byteOffset??0,0,bl)&&integer(b.byteLength,0,bl)&&(b.byteOffset??0) + b.byteLength<=json.buffers[0].byteLength&&!b.extensions,'BUFFER_VIEW');
viewBytes +=b.byteLength;requireThat(Number.isSafeInteger(viewBytes),'VIEW_BYTES');
}
const cache=new Map();
function accessor(id,type,components){
requireThat(integer(id,0,json.accessors.length - 1),'ACCESSOR_INDEX');
const a=json.accessors[id],c=COMPONENT[a.componentType],count=a.count,size=SIZE[a.type];
requireThat(!a.sparse&&a.normalized!==true&&c&&size&&integer(count,1,200000)&&integer(a.bufferView,0,json.bufferViews.length - 1),'ACCESSOR_LAYOUT');
if (type) requireThat(a.type===type,'ACCESSOR_TYPE');
if (components) requireThat(components.includes(a.componentType),'ACCESSOR_COMPONENT');
if (cache.has(id)) return cache.get(id);
const b=json.bufferViews[a.bufferView],off=a.byteOffset??0,stride=b.byteStride??size * c[0];
// Deliberately packed-only; no sparse/interleaved/compressed interpretation.
requireThat(integer(off,0,b.byteLength)&&stride===size * c[0]&&off % c[0]===0&&((b.byteOffset??0) + off) % c[0]===0&&off + count * stride<=b.byteLength,'PACKED_ACCESSOR');
const byteOffset=start + (b.byteOffset??0) + off;
const d={id,count,size,type:a.type,componentType:a.componentType,byteOffset,byteLength:count * stride,
at(row,col=0){requireThat(integer(row,0,count - 1)&&integer(col,0,size - 1),'ACCESSOR_ROW');return v[c[1]](byteOffset + (row * size + col) * c[0],true);}};
for (let i=0;i < count;i++) for (let j=0;j < size;j++) requireThat(Number.isFinite(d.at(i,j)),'NONFINITE_ACCESSOR');
cache.set(id,d);return d;
}
// This also excludes all allocation-changing sparse/implicit/interleaved paths.
for (let i=0;i < json.accessors.length;i++) accessor(i);
// Bound hierarchy before handing this fixed source to the loader.
const parent=Array(json.nodes.length).fill(-1),mark=Array(json.nodes.length).fill(0);
for (let i=0;i < json.nodes.length;i++) for (const c of json.nodes[i].children??[]){requireThat(integer(c,0,json.nodes.length - 1)&&parent[c]===-1&&c!==i,'RAW_PARENT');parent[c]=i;}
function visit(i){requireThat(mark[i]!==1,'RAW_CYCLE');if (mark[i]===2) return;mark[i]=1;if (parent[i]>=0) visit(parent[i]);mark[i]=2;}
for (let i=0;i < json.nodes.length;i++) visit(i);
const entries=[],usedMeshes=new Set(),usedPositions=new Set();
for (let ni=0;ni < json.nodes.length;ni++){
const node=json.nodes[ni];if (node.mesh===undefined) continue;
requireThat(integer(node.mesh,0,json.meshes.length - 1)&&integer(node.skin,0,json.skins.length - 1)&&!usedMeshes.has(node.mesh),'UNIQUE_SKIN_INSTANCE');usedMeshes.add(node.mesh);
const m=json.meshes[node.mesh],skin=json.skins[node.skin];
requireThat(m.primitives.length===1&&Array.isArray(skin.joints)&&skin.joints.length<=65535&&skin.joints.length > 0&&new Set(skin.joints).size===skin.joints.length&&skin.joints.every(j=>integer(j,0,json.nodes.length - 1)),'SKIN_PRIMITIVE');
const p=m.primitives[0];requireThat((p.mode??4)===4&&!p.extensions,'TRIANGLE_PRIMITIVE');
const pos=accessor(p.attributes.POSITION,'VEC3',[5126]);
requireThat(!usedPositions.has(pos.id),'UNIQUE_GEOMETRY');usedPositions.add(pos.id);
const normal=accessor(p.attributes.NORMAL,'VEC3',[5126]);requireThat(normal.count===pos.count,'NORMAL_ROWS');
for (const id of Object.values(p.attributes)) requireThat(accessor(id).count===pos.count,'ATTRIBUTE_ROWS');
const jointKeys=Object.keys(p.attributes).filter(x=>/^JOINTS_\d+$/.test(x)).sort((a,b)=>Number(a.slice(7)) - Number(b.slice(7)));
const weightKeys=Object.keys(p.attributes).filter(x=>/^WEIGHTS_\d+$/.test(x)).sort((a,b)=>Number(a.slice(8)) - Number(b.slice(8)));
requireThat(jointKeys.length > 0&&jointKeys.length<=16&&jointKeys.length===weightKeys.length,'PAIRED_SETS');
const sets=jointKeys.map((key,n)=>{
requireThat(key===`JOINTS_${n}`&&weightKeys[n]===`WEIGHTS_${n}`,'CONTIGUOUS_SETS');
return{ordinal:n,joints:accessor(p.attributes[key],'VEC4',[5121,5123]),weights:accessor(p.attributes[weightKeys[n]],'VEC4',[5126])};
});
const ibm=accessor(skin.inverseBindMatrices,'MAT4',[5126]);requireThat(ibm.count>=skin.joints.length,'IBM_ROWS');
for (let i=0;i < skin.joints.length;i++) requireThat([3,7,11].every(j=>ibm.at(i,j)===0)&&ibm.at(i,15)===1,'IBM_AFFINE');
requireThat(Array.isArray(p.targets)&&p.targets.length > 0,'MORPH_TARGETS');
const morphs=p.targets.map(t=>{requireThat(Object.keys(t).length===1&&t.POSITION!==undefined,'POSITION_ONLY_MORPH');const a=accessor(t.POSITION,'VEC3',[5126]);requireThat(a.count===pos.count,'MORPH_ROWS');return a;});
const defaults=node.weights??m.weights??Array(morphs.length).fill(0);
requireThat(defaults.length===morphs.length&&finite(defaults),'MORPH_DEFAULTS');
entries.push({node:ni,mesh:node.mesh,primitive:0,skin:node.skin,owner:node.name,pos,sets,ibm,jointNodes:[...skin.joints],morphs,defaults:[...defaults]});
}
// Current loader paths: BIN slice, one slice per bufferView; packed accessor
// views share those buffers. Unique TRIANGLES and complete POSITION-only
// targets exclude geometry conversion/reuse and missing-target clone paths.
const payloadEstimate=OWNED_CAP + bl + viewBytes + 4;
requireThat(payloadEstimate<=PAYLOAD_CAP,'LOADER_PAYLOAD_ESTIMATE');
return{json,input,entries,accessor,binByteLength:bl,bufferViewBytes:viewBytes,payloadEstimate,
raw(d){return new Uint8Array(input.buffer,input.byteOffset + d.byteOffset,d.byteLength);}};
}
export function makeInfluenceTable(sets,rows,jointCount,budget){
requireThat(integer(rows,1,200000)&&integer(jointCount,1,65535)&&Array.isArray(sets)&&sets.length > 0&&sets.length<=16,'TABLE_SHAPE');
for (let n=0;n < sets.length;n++){
const s=sets[n];requireThat(s.ordinal===n&&s.joints&&s.weights,'TABLE_PAIR');
requireThat(s.joints.count===rows&&s.weights.count===rows&&s.joints.size===4&&s.weights.size===4,'TABLE_ROWS');
}
// Validate every slot before allocating. Repeat arithmetic in storage pass;
// no partial success/table with skipped rows or positive terms.
function row(i,store){
let sum=0,positives=0;const seen=new Set();
for (let n=0;n < sets.length;n++) for (let c=0;c < 4;c++){
const j=sets[n].joints.at(i,c),w=sets[n].weights.at(i,c);
requireThat(integer(j,0,jointCount - 1),'TABLE_JOINT');requireThat(Number.isFinite(w),'TABLE_FINITE');requireThat(w>=0,'TABLE_NEGATIVE');requireThat(Math.fround(w)===w,'TABLE_FLOAT32');
if (w > 0){requireThat(!seen.has(j),'TABLE_DUPLICATE');seen.add(j);positives++;sum +=w;}
if (store) store(n * 4 + c,j,w);
}
requireThat(Number.isFinite(sum)&&sum > 0,'TABLE_TOTAL');requireThat(Math.abs(sum - 1)<=2e-7 * positives,'TABLE_UNIT');
return{sum,positives};
}
let positiveCount=0;for (let i=0;i < rows;i++) positiveCount +=row(i).positives;
const slots=sets.length * 4,count=rows * slots;
const joints=budget.array(Uint16Array,count,'complete joints'),raw=budget.array(Float32Array,count,'original weights'),normalized=budget.array(Float64Array,count,'global normalized weights');
for (let i=0;i < rows;i++){
const{sum}=row(i,(s,j,w)=>{joints[i * slots + s]=j;raw[i * slots + s]=w;});
for (let s=0;s < slots;s++) normalized[i * slots + s]=raw[i * slots + s] / sum;
}
return{rows,slots,joints,raw,normalized,positiveCount};
}
export function affine(a){requireThat(a.length===16&&finite(a)&&[3,7,11].every(i=>Math.abs(a[i])<=1e-12)&&Math.abs(a[15] - 1)<=1e-12,'AFFINE_MATRIX');}
function near(a,b,tolerance=1e-10){requireThat(a.length===b.length&&a.every((v,i)=>Number.isFinite(v)&&Math.abs(v - b[i])<=tolerance),'ASSOCIATION_VALUES');}
export async function bindCompleteCPU(source,gltf,budget){
requireThat(JSON.stringify(gltf.parser.json.asset)===JSON.stringify(source.json.asset),'PARSER_ASSET');
const nodes=[];
for (let i=0;i < source.json.nodes.length;i++){const p=gltf.parser.cache.get(`node:${i}`);requireThat(p!==undefined,'MISSING_NODE_CACHE');nodes.push(await p);}
requireThat(new Set(nodes).size===nodes.length,'UNIQUE_NODE_OBJECTS');
const index=new Map(nodes.map((n,i)=>[n,i]));const parents=Array(nodes.length).fill(null);
for (let i=0;i < nodes.length;i++) for (const j of source.json.nodes[i].children??[]){requireThat(integer(j,0,nodes.length - 1)&&parents[j]===null,'SOURCE_PARENT');parents[j]=i;}
for (let i=0;i < nodes.length;i++) requireThat((index.get(nodes[i].parent)??null)===parents[i],'ACTUAL_PARENT');
const bindings=[];
for (const e of source.entries){
const mesh=nodes[e.node],a=gltf.parser.associations.get(mesh);
requireThat(mesh.isSkinnedMesh&&a?.meshes===e.mesh&&(a.primitives??0)===e.primitive&&mesh.bindMode===AttachedBindMode&&mesh.geometry.morphTargetsRelative===true,'ACTUAL_INSTANCE');
requireThat(mesh.geometry.attributes.position.count===e.pos.count&&mesh.skeleton.bones.length===e.jointNodes.length&&mesh.skeleton.boneInverses.length===e.jointNodes.length,'ACTUAL_SKIN');
requireThat(mesh.morphTargetInfluences.length===e.morphs.length&&mesh.geometry.morphAttributes.position.length===e.morphs.length,'ACTUAL_MORPHS');near(mesh.morphTargetInfluences,e.defaults,0);
for (let j=0;j < e.jointNodes.length;j++){
requireThat(mesh.skeleton.bones[j]===nodes[e.jointNodes[j]]&&nodes[e.jointNodes[j]].isBone,'ACTUAL_JOINT_ORDER');
near(mesh.skeleton.boneInverses[j].elements,Array.from({length:16},(_,c)=>e.ibm.at(j,c)),0);
}
// Match complete loaded position/morph arrays against original raw source.
const attrs=[mesh.geometry.attributes.position,...mesh.geometry.morphAttributes.position],originals=[e.pos,...e.morphs];
for (let k=0;k < attrs.length;k++){const t=attrs[k],d=originals[k];requireThat(!t.isInterleavedBufferAttribute&&t.itemSize===3&&t.count===d.count,'ACTUAL_POSITION_LAYOUT');for (let i=0;i < d.count;i++) for (let c=0;c < 3;c++) requireThat(t.array[3 * i + c]===d.at(i,c),'RAW_POSITION_ASSOCIATION');}
const table=makeInfluenceTable(e.sets,e.pos.count,e.jointNodes.length,budget);
function matrices(){
affine(mesh.bindMatrix.elements);affine(mesh.bindMatrixInverse.elements);affine(mesh.matrixWorld.elements);
near(mesh.bindMatrixInverse.elements,new Matrix4().copy(mesh.matrixWorld).invert().elements);
return mesh.skeleton.bones.map((bone,j)=>{affine(bone.matrixWorld.elements);affine(mesh.skeleton.boneInverses[j].elements);const m=new Matrix4().multiplyMatrices(bone.matrixWorld,mesh.skeleton.boneInverses[j]);affine(m.elements);return m;});
}
function calculate(i,target,current){
requireThat(integer(i,0,table.rows - 1)&&target?.isVector3,'CPU_POSITION_ARGUMENT');
Mesh.prototype.getVertexPosition.call(mesh,i,target);requireThat(finite(target.toArray()),'MORPH_POSITION_FINITE');
const base=new Vector4(target.x,target.y,target.z,1).applyMatrix4(mesh.bindMatrix),result=new Vector4(0,0,0,0),term=new Vector4();
for (let s=0;s < table.slots;s++){const k=i * table.slots + s,w=table.normalized[k];if (w > 0) result.addScaledVector(term.copy(base).applyMatrix4(current[table.joints[k]]),w);}
result.applyMatrix4(mesh.bindMatrixInverse);requireThat(finite(result.toArray())&&Math.abs(result.w - 1)<=1e-10,'CPU_HOMOGENEOUS');
return target.set(result.x / result.w,result.y / result.w,result.z / result.w);
}
bindings.push({source:e,mesh,table,space:'mesh-local-full-influence-CPU-only',
vertex(i,target=new Vector3()){return calculate(i,target,matrices());},
positions(){const current=matrices(),out=budget.array(Float64Array,table.rows * 3,'complete CPU positions'),t=new Vector3();for (let i=0;i < table.rows;i++){calculate(i,t,current);out[3 * i]=t.x;out[3 * i + 1]=t.y;out[3 * i + 2]=t.z;}return out;}});
}
return{source,nodes,parents,bindings,space:'mesh-local-full-influence-CPU-only'};
}
