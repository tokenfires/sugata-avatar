// Isolate two source-stage outputs on the accepted post-export groom. Never overwrites assets.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readGlb,readPrimitive,readAccessor} from '../lut-bake/glb.mjs';
import {encodeGlb,sha256} from '../figure-pipeline/hair_fall.mjs';
import {SurfaceGrid} from '../figure-pipeline/hair_geometry.mjs';
import {measureHairSurface} from '../figure-pipeline/hair_surface.mjs';
const out='captures/bob-clump-clearance-v1',cards=[322,449],selected=new Set(cards),base=652;
const paths={accepted:'assets/hair/bob02/g050.glb',original:'tools/figure-pipeline/fixtures/bob02-g050-original.glb',rebuilt:`${out}/hair/bob02/g050.glb`,body:'assets/figures/figure_g050.glb'};
assert.ok(!fs.existsSync(`${out}/candidate.glb`));
const g=Object.fromEntries(Object.entries(paths).map(([k,p])=>[k,readGlb(p)]));
const p=Object.fromEntries(['accepted','original','rebuilt'].map(k=>[k,readPrimitive(g[k],'hair_bob02')]));
const belongs=v=>v>=base&&selected.has(Math.floor((v-base)/34));
const attrs=k=>g[k].json.meshes.find(m=>m.name==='hair_bob02').primitives[0].attributes;
for(const name of ['TEXCOORD_0','TEXCOORD_1','JOINTS_0','WEIGHTS_0'])assert.deepEqual(readAccessor(g.original,attrs('original')[name]).data,readAccessor(g.rebuilt,attrs('rebuilt')[name]).data,name);
assert.equal(p.rebuilt.vertexCount,p.original.vertexCount);
const changes={positions:[],normals:[],triangles:[]};
for(const [name,values] of [['POSITION','positions'],['NORMAL','normals']]){
 for(let v=0;v<p.original.vertexCount;v++){
  const changed=[0,1,2].some(k=>p.original[values][v*3+k]!==p.rebuilt[values][v*3+k]);
  if(changed){assert.ok(belongs(v),`${name} outside selected cards: ${v}`);changes[values].push(v);}
  if(belongs(v))for(let k=0;k<3;k++)p.accepted[values][v*3+k]=p.rebuilt[values][v*3+k];
 }
 const a=g.accepted.json.accessors[attrs('accepted')[name]],b=g.accepted.json.bufferViews[a.bufferView];assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');assert.ok(!a.sparse);
 const offset=(a.byteOffset??0)+(b.byteOffset??0),stride=b.byteStride??12;
 for(let v=0;v<a.count;v++)if(belongs(v))for(let k=0;k<3;k++)g.accepted.bin.writeFloatLE(p.accepted[values][v*3+k],offset+v*stride+k*4);
 a.min=[0,1,2].map(k=>Math.min(...Array.from({length:a.count},(_,v)=>p.accepted[values][v*3+k])));a.max=[0,1,2].map(k=>Math.max(...Array.from({length:a.count},(_,v)=>p.accepted[values][v*3+k])));
}
assert.deepEqual(p.accepted.indices,p.original.indices,'Accepted topology has changed since fixture; handle explicitly');
const prim=g.accepted.json.meshes.find(m=>m.name==='hair_bob02').primitives[0],ia=g.accepted.json.accessors[prim.indices],iv=g.accepted.json.bufferViews[ia.bufferView];assert.equal(ia.componentType,5123);assert.ok(!ia.sparse&&!iv.byteStride);
for(let i=0;i<p.original.indices.length;i+=3){
 if([0,1,2].some(k=>p.original.indices[i+k]!==p.rebuilt.indices[i+k])){assert.ok([0,1,2].every(k=>belongs(p.original.indices[i+k])&&belongs(p.rebuilt.indices[i+k])));changes.triangles.push(i/3);for(let k=0;k<3;k++){p.accepted.indices[i+k]=p.rebuilt.indices[i+k];g.accepted.bin.writeUInt16LE(p.rebuilt.indices[i+k],(iv.byteOffset??0)+(ia.byteOffset??0)+(i+k)*2);}}
}
const selectedIndices=[];for(let i=0;i<p.accepted.indices.length;i+=3)if([0,1,2].every(k=>belongs(p.accepted.indices[i+k])))selectedIndices.push(...p.accepted.indices.slice(i,i+3));assert.equal(selectedIndices.length,192);
const body=readPrimitive(g.body,'base.001'),grid=new SurfaceGrid(body.positions,body.normals,body.indices),bounds={min:[-Infinity,-Infinity,-Infinity],max:[Infinity,Infinity,Infinity]};
const crossings=measureHairSurface({...p.accepted,indices:selectedIndices},body,{headBounds:bounds,faceBounds:bounds});
const vertices=Array.from({length:p.accepted.vertexCount},(_,v)=>v).filter(belongs);const clearances=vertices.map(v=>({v,signedMm:grid.nearest(Array.from(p.accepted.positions.slice(v*3,v*3+3))).signed*1000}));
const shape=primitive=>cards.map(card=>{const pts=Array.from({length:17},(_,r)=>[0,1,2].map(k=>(primitive.positions[(base+card*34+r*2)*3+k]+primitive.positions[(base+card*34+r*2+1)*3+k])/2));const spans=pts.slice(1).map((p,i)=>p.map((x,k)=>x-pts[i][k]));const turns=spans.slice(1).map((p,i)=>{const l=Math.hypot(...p)*Math.hypot(...spans[i]);return l<=1e-18?null:Math.acos(Math.max(-1,Math.min(1,p.reduce((s,x,k)=>s+x*spans[i][k],0)/l)))*180/Math.PI;});return{card,maxFiniteBendDegrees:Math.max(...turns.filter(v=>v!==null)),undefinedTurns:turns.map((v,i)=>v===null?i+1:null).filter(v=>v!==null),turns};});
const report={status:'unqualified source-stage diagnostic',cards,sources:Object.fromEntries(Object.entries(paths).map(([k,path])=>[k,{path,sha256:sha256(fs.readFileSync(path))}])),changes,selectedTriangles:selectedIndices.length/3,restTriangleBodyPairs:crossings.head.pairs,minSelectedVertexClearanceMm:Math.min(...clearances.map(v=>v.signedMm)),clearances,shapeBefore:shape(p.original),shapeAfter:shape(p.accepted),limits:['Selected source output includes final production vertex clamp; independent rest triangle crossings are still measured.','No motion qualification; appearance requires actual native images.','Root rings and selected topology can change as part of the source mechanism and are reported explicitly; all other cards and cap remain unchanged.']};
g.accepted.json.asset.extras??={};g.accepted.json.asset.extras.sugataUnqualifiedExperiment={cards,status:report.status};
const bytes=encodeGlb(g.accepted);report.outputSha256=sha256(bytes);fs.writeFileSync(`${out}/candidate.glb`,bytes,{flag:'wx'});fs.writeFileSync(`${out}/candidate-report.json`,JSON.stringify({...report,crossings},null,2)+'\n',{flag:'wx'});fs.copyFileSync('tools/critic/isolate-bob-clump-clearance.mjs',`${out}/isolate-bob-clump-clearance.mjs`);
console.log(JSON.stringify({...report,clearances:undefined},null,2));
