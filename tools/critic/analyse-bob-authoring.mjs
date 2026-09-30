/** Read-only source-stage measurements, guarded by exact original-fixture correspondence. */
import fs from 'node:fs';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readGlb,readAccessor} from '../lut-bake/glb.mjs';
const root='captures/bob-authoring-trace-v1';
const paths={trace:`${root}/trace.json.gz`,original:'tools/figure-pipeline/fixtures/bob02-g050-original.glb',rebuilt:`${root}/hair/bob02/g050.glb`,accepted:'assets/hair/bob02/g050.glb'};
const trace=JSON.parse(zlib.gunzipSync(fs.readFileSync(paths.trace)));
const glbs=Object.fromEntries(['original','rebuilt','accepted'].map(k=>[k,readGlb(paths[k])]));
const primitive=g=>g.json.meshes.find(m=>m.name==='hair_bob02').primitives[0];
const attr=(g,name)=>Array.from(readAccessor(g,primitive(g).attributes[name]).data);
const diff=(a,b)=>{assert.equal(a.length,b.length);let max=0,changed=0;for(let i=0;i<a.length;i++){let d=Math.abs(a[i]-b[i]);max=Math.max(max,d);changed+=d!==0;}return{components:a.length,max,changed};};
const correspondence={attributes:{}};
for(const name of Object.keys(primitive(glbs.original).attributes)) {const result=diff(attr(glbs.original,name),attr(glbs.rebuilt,name));assert.equal(result.changed,0,name);correspondence.attributes[name]=result;}
const indices=g=>Array.from(readAccessor(g,primitive(g).indices).data);
correspondence.indices=diff(indices(glbs.original),indices(glbs.rebuilt));assert.equal(correspondence.indices.changed,0);
for(const key of ['nodes','skins','scenes']){assert.deepEqual(glbs.original.json[key],glbs.rebuilt.json[key],key);correspondence[key]='exact';}
correspondence.inverseBindMatrices=diff(Array.from(readAccessor(glbs.original,glbs.original.json.skins[0].inverseBindMatrices).data),Array.from(readAccessor(glbs.rebuilt,glbs.rebuilt.json.skins[0].inverseBindMatrices).data));assert.equal(correspondence.inverseBindMatrices.changed,0);
assert.deepEqual(glbs.original.json.meshes[0].extras,glbs.rebuilt.json.meshes[0].extras);correspondence.lockExtras='exact';
assert.deepEqual(trace.clamp.objectMatrix,[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]);
const toGltf=([x,y,z])=>[x,z,-y];
correspondence.traceAfterClamp=diff(trace.clamp.after.flatMap(toGltf),attr(glbs.rebuilt,'POSITION'));assert.equal(correspondence.traceAfterClamp.changed,0);
const sub=(a,b)=>a.map((x,i)=>x-b[i]),len=v=>Math.hypot(...v),dist=(a,b)=>len(sub(a,b));
const angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a.reduce((s,x,i)=>s+x*b[i],0)/(len(a)*len(b)))))*180/Math.PI;
const centre=r=>r.left.map((x,i)=>(x+r.right[i])/2);
const unpack=(values,card)=>Array.from({length:17},(_,r)=>{let base=652+card*34+r*2;return{left:values[base],right:values[base+1]};});
const shape=points=>{const spans=points.slice(1).map((p,i)=>sub(p,points[i]));const bends=spans.slice(1).map((p,i)=>angle(p,spans[i]));return{arcMm:spans.reduce((s,p)=>s+len(p)*1000,0),maxBendDegrees:Math.max(...bends),maxBendRing:bends.indexOf(Math.max(...bends))+1,tipDeltaMm:sub(points.at(-1),points[0]).map(v=>v*1000)};};
const axes=rings=>{const a=rings.map(r=>sub(r.right,r.left));const angles=a.slice(1).map((p,i)=>angle(p,a[i]));return{maxAxisTurnDegrees:Math.max(...angles),maxAxisTurnFromRing:angles.indexOf(Math.max(...angles)),angles};};
const accepted=attr(glbs.accepted,'POSITION');const av=Array.from({length:accepted.length/3},(_,i)=>[accepted[i*3],-accepted[i*3+2],accepted[i*3+1]]);
const cards=trace.cards.map(c=>{
 const before=unpack(trace.clamp.before,c.card),after=unpack(trace.clamp.after,c.card),production=unpack(av,c.card);
 const stages=Object.fromEntries(['grownToCut','lockGuide','blendedBeforeClearance','clumpedAfterClearance'].map(k=>[k,shape(c[k])]));
 stages.ribbonBeforeClamp=shape(before.map(centre));stages.ribbonAfterClamp=shape(after.map(centre));stages.accepted=shape(production.map(centre));
 const maxDelta=(a,b)=>Math.max(...a.map((p,i)=>dist(p,b[i])))*1000;
 return {card:c.card,layer:c.layer,stages,widthFrame:{beforeClamp:axes(before),afterClamp:axes(after),accepted:axes(production)},deltasMm:{clumpClearance:maxDelta(c.blendedBeforeClearance,c.clumpedAfterClearance),ribbonCentresVsGuide:maxDelta(c.clumpedAfterClearance,before.map(centre)),vertexClamp:maxDelta(before.flatMap(r=>[r.left,r.right]),after.flatMap(r=>[r.left,r.right])),postExport:maxDelta(after.flatMap(r=>[r.left,r.right]),production.flatMap(r=>[r.left,r.right]))}};
});
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const output={status:'exact-original-geometry-correspondence',sources:Object.fromEntries(Object.entries({...paths,analysis:'tools/critic/analyse-bob-authoring.mjs'}).map(([k,p])=>[k,{path:p,sha256:hash(p)}])),correspondence,clamp:{...trace.clamp,before:undefined,after:undefined},cards,limits:['Geometric stages and exact fixture correspondence establish where bends enter; appearance attribution still needs native images and the prior ablation witnesses.','Per-vertex clamp moved count counts operations across passes, not necessarily unique vertices.','Original rebuild equals preserved original; production additionally contains post-export edits.']};
fs.writeFileSync(`${root}/analysis.json`,JSON.stringify(output,null,2)+'\n',{flag:'wx'});fs.copyFileSync('tools/critic/analyse-bob-authoring.mjs',`${root}/analyse-bob-authoring.mjs`);
console.log(JSON.stringify({status:output.status,correspondence,selected:cards.filter(c=>[276,281,285,322,380,449].includes(c.card)).map(c=>({card:c.card,layer:c.layer,deltasMm:c.deltasMm,stages:c.stages,axis:c.widthFrame.beforeClamp.maxAxisTurnDegrees}))},null,2));
