import assert from 'node:assert/strict';
import fs from 'node:fs';
import {transportNormal,transportLocalNormals,intersectionBeyondSharedSimplex,checkLocalSelfIntersection} from './local-normal.mjs';
import {createTipWidthOperator,inspectPatchLayout,verifyAllowedByteChanges,SOURCE_PINS,sha} from './TipWidthCandidate.mjs';
import {readAccessor} from '../../../../tools/lut-bake/glb.mjs';
let groups=0;async function check(label,fn){await fn();groups++;console.log('PASS '+label)}
const near=(a,b,e=1e-14)=>assert.ok(Math.abs(a-b)<=e,`${a} differs from ${b}`);
const unit=a=>{const n=Math.hypot(...a);return a.map(x=>x/n)};
const N=Float32Array.from([0,0,1,0,0,1,0,0,1,0,0,1]);
const patch=()=>({positions:Float32Array.from([0,0,0,1,0,0,0,1,0,-1,0,0]),normals:N.slice(),displaced:Float32Array.from([0,0,0,1,0,1,0,1,0,-1,0,0]),indices:Uint32Array.from([0,1,2,0,2,3]),mapping:Uint16Array.from([0,1,2,3])});
await check('Analytical 45 degree transport preserves authored offset and original length',()=>{
 const a=[.5,0,Math.sqrt(3)/2],q=transportNormal(a,[0,0,1],[0,-Math.SQRT1_2,Math.SQRT1_2]);
 const expected=[.5,-Math.sqrt(3/8),Math.sqrt(3/8)];q.forEach((x,i)=>near(x,expected[i]));near(Math.hypot(...q),1);near(q[1]*-Math.SQRT1_2+q[2]*Math.SQRT1_2,a[2]);
 const additive=unit([.5,-Math.SQRT1_2,a[2]+Math.SQRT1_2-1]);assert.ok(Math.hypot(...q.map((x,i)=>x-additive[i]))>.01,'Must discriminate additive-normal policy');
 const doubled=transportNormal(a.map(x=>2*x),[0,0,1],[0,-Math.SQRT1_2,Math.SQRT1_2]);near(Math.hypot(...doubled),2);
});
await check('Complete star includes unchanged neighbor and yields the hand-solved normal',()=>{
 const out=transportLocalNormals(patch());const expected=unit([-1,0,2]);Array.from(out.normals.slice(0,3)).forEach((x,i)=>near(x,expected[i],2**-23));
 assert.deepEqual(out.affectedFaces,[0]);assert.deepEqual(out.completeStarFaces,[0,1]);assert.deepEqual(out.changedPositions,[1]);assert.deepEqual(Array.from(out.normals.slice(9)),[0,0,1]);
 assert.ok(Math.abs(out.normals[0]+Math.SQRT1_2)>.2,'Must detect truncated star');
});
await check('Source weld combines UV split incidence and rejects hard-normal or position conflict',()=>{
 const p=patch();p.positions=Float32Array.from([...p.positions.slice(0,9),0,0,0,-1,0,0]);p.displaced=Float32Array.from([...p.displaced.slice(0,9),0,0,0,-1,0,0]);p.normals=Float32Array.from([...N,0,0,1]);p.indices=Uint32Array.from([0,1,2,3,2,4]);p.mapping=Uint16Array.from([0,1,2,0,3]);
 const out=transportLocalNormals(p);assert.deepEqual(out.normals.slice(0,3),out.normals.slice(9,12));
 p.normals[9]=.2;assert.throws(()=>transportLocalNormals(p),/Conflicting authored weld/);p.normals[9]=0;p.positions[9]=.1;assert.throws(()=>transportLocalNormals(p),/Conflicting weld positions/);
});
await check('Unchanged geometric direction preserves authored normal without rounding',()=>{
 const a=[Math.fround(.123),Math.fround(.234),Math.fround(.964)];assert.deepEqual(transportNormal(a,[0,0,1],[0,0,2]),a);
});
await check('Nonfinite, cancelling and opposite normals reject without fallback',()=>{
 assert.throws(()=>transportNormal([0,0,1],[0,0,0],[0,0,1]),/Degenerate/);assert.throws(()=>transportNormal([0,0,1],[0,0,1],[0,0,-1]),/hemisphere/);assert.throws(()=>transportNormal([0,0,1],[0,0,1],[1e-10,0,-1]),/hemisphere/);assert.throws(()=>transportNormal([0,NaN,1],[0,0,1],[0,0,1]),/Nonfinite/);assert.throws(()=>transportNormal([0,0,0],[0,0,1],[0,0,1]),/Degenerate authored/);
 const p=patch();p.positions[9]=0;p.positions[10]=-1;p.displaced[9]=0;p.displaced[10]=-1;p.indices=Uint32Array.from([0,1,2,0,1,3]);assert.throws(()=>transportLocalNormals(p),/Degenerate geometric normal sum/);
});
await check('Collapsed, reference-reversed and malformed geometry reject; inputs remain untouched',()=>{
 const p=patch(),before=p.positions.slice();p.displaced.set([0,0,0],3);assert.throws(()=>transportLocalNormals(p),/Degenerate triangle/);assert.deepEqual(p.positions,before);
 const q=patch();q.displaced.set([0,-1,0],6);assert.throws(()=>transportLocalNormals(q),/reversal/);
 const bad=patch();bad.indices[0]=100;assert.throws(()=>transportLocalNormals(bad),/Invalid triangle/);
 const nan=patch();nan.displaced[0]=Infinity;assert.throws(()=>transportLocalNormals(nan),/Nonfinite/);
});
const tri=[[0,0,0],[1,0,0],[0,1,0]];
await check('Topology permits only actual shared edge/vertex and catches adjacent coplanar folding',()=>{
 assert.equal(intersectionBeyondSharedSimplex(tri,[[1,0,0],[0,0,0],[0,-1,0]],[0,1,2],[1,0,3]),null);
 assert.equal(intersectionBeyondSharedSimplex(tri,[[0,0,0],[-1,0,0],[0,-1,0]],[0,1,2],[0,3,4]),null);
 assert.ok(intersectionBeyondSharedSimplex(tri,[[1,0,0],[0,0,0],[.25,.25,0]],[0,1,2],[1,0,3]));
 assert.equal(intersectionBeyondSharedSimplex(tri,tri,[0,1,2],[0,1,2]).kind,'duplicate-source-face');
});
await check('Nonadjacent interior crossing and contact are failures; separated triangles pass',()=>{
 const b=[[.25,.25,-1],[.25,.25,1],[.5,.25,0]];assert.ok(intersectionBeyondSharedSimplex(tri,b,[0,1,2],[3,4,5]));
 assert.ok(intersectionBeyondSharedSimplex(tri,[[1,0,0],[2,0,1],[2,1,1]],[0,1,2],[3,4,5]));
 assert.equal(intersectionBeyondSharedSimplex(tri,tri.map(p=>[p[0],p[1],p[2]+1]),[0,1,2],[3,4,5]),null);
 const out=checkLocalSelfIntersection({positions:Float32Array.from([...tri.flat(),...b.flat()]),indices:Uint32Array.from([0,1,2,3,4,5]),mapping:Uint16Array.from([0,1,2,3,4,5]),affectedFaces:[0]});assert.equal(out.witnesses.length,1);
});
const paths={bodyBytes:'assets/wardrobe/body/g050.glb',mapBytes:'assets/identity/figure-vertex-map.bin',catalogueBytes:'assets/identity/catalogue.json',noseBytes:'assets/identity/targets/nose.bin'};
const inputs=Object.fromEntries(Object.entries(paths).map(([k,p])=>[k,fs.readFileSync(p)]));const original=Buffer.from(inputs.bodyBytes);let op,minus,plus;
await check('Actual source hashes admit; changed bytes, missing or extra inputs reject',async()=>{
 for(const [k,pin] of Object.entries(SOURCE_PINS))assert.equal(sha(inputs[k]),pin);
 op=await createTipWidthOperator(inputs);const bad={...inputs,bodyBytes:Buffer.from(inputs.bodyBytes)};bad.bodyBytes[100]^=1;await assert.rejects(()=>createTipWidthOperator(bad),/source drift/);await assert.rejects(()=>createTipWidthOperator({...inputs,extra:new Uint8Array()}),/input keys/);
});
await check('Actual zero bypass is byte exact and returns independent copies',()=>{
 const a=op.candidate(0),b=op.candidate(-0);assert.deepEqual(a.bytes,original);assert.deepEqual(b.bytes,original);a.bytes[0]^=1;a.positions[0]=100;assert.deepEqual(op.candidate(0).bytes,original);assert.notEqual(b.positions[0],100);assert.throws(()=>op.candidate(.25),/diagnostic endpoints/);
});
await check('Both source endpoints pass local normal and whole-body local crossing gates',()=>{
 minus=op.candidate(-1);plus=op.candidate(1);
 for(const c of [minus,plus]) {assert.equal(c.receipt.tangents,'absent');assert.equal(c.receipt.selfIntersection.witnesses.length,0);assert.equal(c.receipt.baselineSelfIntersection.witnesses.length,0);assert.ok(c.receipt.byteGate.allOtherBytesExact);}
 assert.equal(minus.receipt.changedPositionIDs.length,64);assert.equal(plus.receipt.changedPositionIDs.length,42);assert.equal(minus.receipt.normalSources.length,114);assert.equal(plus.receipt.normalSources.length,83);
});
await check('Endpoint order, caller mutations and prior return mutations cannot accumulate',()=>{
 const expected=sha(minus.bytes);minus.positions[0]=100;minus.bytes[0]^=1;inputs.noseBytes[0]^=1;inputs.bodyBytes[0]^=1;
 assert.equal(sha(op.candidate(-1).bytes),expected);assert.equal(sha(op.candidate(1).bytes),sha(plus.bytes));assert.deepEqual(op.candidate(0).bytes,original);
});
function repack(json,bin) {let j=Buffer.from(JSON.stringify(json));j=Buffer.concat([j,Buffer.alloc((4-j.length%4)%4,32)]);const h=Buffer.alloc(20);h.writeUInt32LE(0x46546c67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(28+j.length+bin.length,8);h.writeUInt32LE(j.length,12);h.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([h,j,bh,bin]);}
await check('Present tangents and aliased accessor storage explicitly reject',()=>{
 const l=inspectPatchLayout(original),doc=structuredClone(l.glb.json),p=doc.meshes.find(m=>m.name==='base.001').primitives[0];p.attributes.TANGENT=p.attributes.NORMAL;assert.throws(()=>inspectPatchLayout(repack(doc,l.glb.bin)),/Tangent ownership/);delete p.attributes.TANGENT;
 const pi=p.attributes.POSITION,uv=p.attributes.TEXCOORD_0;doc.accessors[uv].bufferView=doc.accessors[pi].bufferView;assert.throws(()=>inspectPatchLayout(repack(doc,l.glb.bin)),/aliases another accessor/);
});
await check('Independent complete GLB read preserves every other attribute/morph and all metadata',()=>{
 const c=op.candidate(-1),a=inspectPatchLayout(original),b=inspectPatchLayout(c.bytes);assert.deepEqual(a.glb.json,b.glb.json);
 const allowed=new Set([a.primitive.attributes.POSITION,a.primitive.attributes.NORMAL]);
 for(let i=0;i<a.glb.json.accessors.length;i++)if(!allowed.has(i))assert.deepEqual(readAccessor(a.glb,i).data,readAccessor(b.glb,i).data,`Nonselected accessor ${i}`);
 const slots=[...c.receipt.changedPositionIDs.flatMap(i=>[0,1,2].map(k=>a.locations.POSITION.start+i*a.locations.POSITION.stride+k*4)),...c.receipt.changedNormalIDs.flatMap(i=>[0,1,2].map(k=>a.locations.NORMAL.start+i*a.locations.NORMAL.stride+k*4))];
 verifyAllowedByteChanges(original,c.bytes,slots);const corrupt=Buffer.from(c.bytes);corrupt[15]^=1;assert.throws(()=>verifyAllowedByteChanges(original,corrupt,slots),/Nonselected byte/);assert.deepEqual(op.candidate(0).bytes,original);
});
console.log(`${groups}/${groups} focused CPU groups passed. No native or aesthetic qualification.`);
