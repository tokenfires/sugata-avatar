// One declared crew-neck shape observation. No optimization or installed asset writes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {readGlb,readPrimitive,readAccessor} from '../lut-bake/glb.mjs';
import {encodeGlb} from './hair_fall.mjs';
import {collarBand} from './collar_lining_topology.mjs';
import {ROOT,ACCEPTED_PATH,ACCEPTED_SHA256,hashFile,sha256} from './collar_replacement_manifest.mjs';

const out=path.resolve(ROOT,process.argv[2]??'captures/neckline-construction-2026-09-30-v1');
assert.ok(!fs.existsSync(out),'Fresh output required');
const input=path.join(ROOT,ACCEPTED_PATH),plan='docs/evidence/wardrobe-2026-09-30/neckline-construction/PLAN.md';
assert.equal(hashFile(input),ACCEPTED_SHA256);
const glb=readGlb(input),sourceBin=Buffer.from(glb.bin),sourceJson=structuredClone(glb.json);
const p=readPrimitive(glb,'female_casualsuit01'),attrs=glb.json.meshes.find(m=>m.name==='female_casualsuit01').primitives[0].attributes;
assert.equal(p.vertexCount,2377);
const joints=readAccessor(glb,attrs.JOINTS_0).data,weights=readAccessor(glb,attrs.WEIGHTS_0).data;
const point=(a,i)=>Array.from(a.slice(3*i,3*i+3)),sub=(a,b)=>a.map((x,k)=>x-b[k]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0),length=a=>Math.hypot(...a),unit=a=>{const n=length(a);assert.ok(n>1e-15);return a.map(x=>x/n);};
const groups=[],byPosition=new Map(),groupOf=[];
for(let i=0;i<p.vertexCount;i++){
 const position=point(p.positions,i),key=position.map(x=>Math.round(x/1e-7)).join(':');
 if(!byPosition.has(key)){byPosition.set(key,groups.length);groups.push({id:groups.length,position,vertices:[],neighbors:new Map(),distance:Infinity});}
 const id=byPosition.get(key);groupOf[i]=id;groups[id].vertices.push(i);
}
for(const g of groups)for(const i of g.vertices)for(const a of [joints,weights])assert.deepEqual(a.slice(4*i,4*i+4),a.slice(4*g.vertices[0],4*g.vertices[0]+4));
for(let t=0;t<p.indices.length;t+=3)for(let k=0;k<3;k++){
 const a=groupOf[p.indices[t+k]],b=groupOf[p.indices[t+(k+1)%3]],d=length(sub(groups[a].position,groups[b].position));
 groups[a].neighbors.set(b,d);groups[b].neighbors.set(a,d);
}
const band=collarBand(p.positions,p.indices,{width:.08});
const rim=band.boundaryVertices.map(v=>groupOf[v[0]]);for(const i of rim)groups[i].distance=0;
const pending=new Set(groups.map(g=>g.id));
while(pending.size){let best=null;for(const i of pending)if(best===null||groups[i].distance<groups[best].distance)best=i;
 if(groups[best].distance>=.08)break;pending.delete(best);
 for(const [i,d]of groups[best].neighbors)groups[i].distance=Math.min(groups[i].distance,groups[best].distance+d);
}
const positions=Float32Array.from(p.positions),normals=Float32Array.from(p.normals),moving=groups.filter(g=>g.distance<.08);
const changes=[];for(const g of moving){
 const t=g.distance/.08,w=1-(6*t**5-15*t**4+10*t**3),mean=[0,0,0];
 for(const i of g.vertices)for(let k=0;k<3;k++)mean[k]+=p.normals[3*i+k];
 const n=unit(mean),delta=n.map((x,k)=>w*(x*.004+(k===1?.012:0))),value=g.position.map((x,k)=>Math.fround(x+delta[k]));
 assert.ok(length(sub(value,g.position))<=.02);assert.ok(g.vertices.every(i=>i<1427),'Entered trousers');
 for(const i of g.vertices)positions.set(value,3*i);
 changes.push({group:g.id,vertices:g.vertices,old:g.position,position:value,geodesicMetres:g.distance,falloff:w,meanNormal:n});
}
const moved=new Set(changes.flatMap(c=>c.vertices)),affected=[],face=(a,ids)=>cross(sub(point(a,ids[1]),point(a,ids[0])),sub(point(a,ids[2]),point(a,ids[0])));
for(let t=0;t<p.indices.length;t+=3){const ids=Array.from(p.indices.slice(t,t+3));if(!ids.some(i=>moved.has(i)))continue;
 const before=face(p.positions,ids),after=face(positions,ids),areaRatio=length(after)/length(before),normalDot=dot(unit(before),unit(after));
 affected.push({triangle:t/3,vertices:ids,areaRatio,normalDot});
 assert.ok(Number.isFinite(areaRatio)&&areaRatio>=.25&&areaRatio<=4,`Area gate ${t/3}: ${areaRatio}`);
 assert.ok(normalDot>.25,`Orientation gate ${t/3}: ${normalDot}`);
}
// Existing coincident smoothing partitions: equal positional weld and source normal.
const partitionOf=[],parts=new Map();
for(let i=0;i<p.vertexCount;i++){const key=groupOf[i]+':'+point(p.normals,i).map(x=>Math.round(x/1e-5)).join(':');partitionOf[i]=key;if(!parts.has(key))parts.set(key,{vertices:[],sum:[0,0,0]});parts.get(key).vertices.push(i);}
const affectedParts=new Set(affected.flatMap(f=>f.vertices.map(i=>partitionOf[i])));
for(let t=0;t<p.indices.length;t+=3){const ids=Array.from(p.indices.slice(t,t+3)),n=face(positions,ids);for(const key of new Set(ids.map(i=>partitionOf[i])))if(affectedParts.has(key))for(let k=0;k<3;k++)parts.get(key).sum[k]+=n[k];}
const normalChanges=[];for(const key of affectedParts){const part=parts.get(key),n=unit(part.sum).map(Math.fround);for(const i of part.vertices){normals.set(n,3*i);normalChanges.push({i,old:point(p.normals,i),normal:n});}}
const allowed=new Uint8Array(glb.bin.length);
function writeAttribute(name,values,selected){const a=glb.json.accessors[attrs[name]],v=glb.json.bufferViews[a.bufferView],base=(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??12;
 assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');assert.ok(!a.sparse);
 for(const i of selected)for(let k=0;k<3;k++){const at=base+i*stride+4*k;assert.ok(Number.isFinite(values[3*i+k]));glb.bin.writeFloatLE(values[3*i+k],at);allowed.fill(1,at,at+4);}
 for(const [field,fn]of [['min',Math.min],['max',Math.max]])if(a[field])a[field]=[0,1,2].map(k=>fn(...Array.from({length:a.count},(_,i)=>values[3*i+k])));
}
writeAttribute('POSITION',positions,moved);writeAttribute('NORMAL',normals,new Set(normalChanges.map(c=>c.i)));
for(let i=0;i<sourceBin.length;i++)if(sourceBin[i]!==glb.bin[i])assert.equal(allowed[i],1,`Protected byte ${i}`);
const normalized=structuredClone(glb.json);for(const key of ['POSITION','NORMAL'])for(const field of ['min','max']){
 if(sourceJson.accessors[attrs[key]][field]===undefined)delete normalized.accessors[attrs[key]][field];else normalized.accessors[attrs[key]][field]=sourceJson.accessors[attrs[key]][field];}
assert.deepEqual(normalized,sourceJson);assert.equal(hashFile(input),ACCEPTED_SHA256);
fs.mkdirSync(out,{recursive:true});const bytes=encodeGlb(glb);fs.writeFileSync(path.join(out,'candidate.glb'),bytes,{flag:'wx'});
const reread=readPrimitive(readGlb(path.join(out,'candidate.glb')),'female_casualsuit01');
assert.deepEqual(reread.positions,Float64Array.from(positions));assert.deepEqual(reread.normals,Float64Array.from(normals));
for(const g of groups)for(const i of g.vertices)assert.deepEqual(point(reread.positions,i),point(reread.positions,g.vertices[0]),'Separated source weld');
const sourceFiles=['tools/figure-pipeline/neckline_construct.mjs','tools/figure-pipeline/collar_lining_topology.mjs','tools/figure-pipeline/hair_fall.mjs','tools/lut-bake/glb.mjs',plan];
for(const file of sourceFiles){const dest=path.join(out,'source',file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(ROOT,file),dest);}
const report={status:'isolated-shape-observation',finished:new Date().toISOString(),pid:process.pid,inputSHA256:ACCEPTED_SHA256,candidateSHA256:sha256(bytes),
 sourceHashes:Object.fromEntries(sourceFiles.map(f=>[f,hashFile(path.join(ROOT,f))])),config:{rimRaiseMetres:.012,normalAllowanceMetres:.004,supportMetres:.08,falloff:'quintic',maxDisplacementMetres:.02,areaRatio:[.25,4],minimumNormalDot:.25},
 movingGroups:moving.length,movingVertices:moved.size,affectedTriangles:affected.length,changedNormals:normalChanges.length,
 maximumDisplacementMetres:Math.max(...changes.map(c=>length(sub(c.position,c.old)))),minimumAreaRatio:Math.min(...affected.map(f=>f.areaRatio)),maximumAreaRatio:Math.max(...affected.map(f=>f.areaRatio)),minimumNormalDot:Math.min(...affected.map(f=>f.normalDot)),
 oldFixedVestWitnesses:[1503,1515,1516,1517].map(t=>({triangle:t,moved:affected.some(f=>f.triangle===t)})),rimGroups:rim,changes,normalChanges,affected,
 invariants:['Protected bytes and metadata exact except listed positions/normals and bounds','Re-read exact Float32 geometry','All source welds coincident','Joint/weight equality within source welds','No topology, UV, mask, material, skeleton or lower garment change'],
 limits:['No body or foundation clearance certified','No new coverage or motion qualification','No appearance acceptance before real renders','No default asset change; at most one trial under this plan']};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({...report,sourceHashes:undefined,changes:undefined,normalChanges:undefined,affected:undefined},null,2));
