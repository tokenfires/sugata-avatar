import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {readGlb,readAccessor} from '../../../tools/lut-bake/glb.mjs';
import {connectedComponents,isRibbon} from '../../../tools/figure-pipeline/hair_geometry.mjs';
const root='tmp/hair-sep24/narrow-density',sha=x=>createHash('sha256').update(x).digest('hex');
const a=JSON.parse(fs.readFileSync(`${root}/baseline-recipe.json`)),b=JSON.parse(fs.readFileSync(`${root}/double-recipe.json`));
assert.deepEqual(a.before,a.after);assert.deepEqual(a.before,b.before);assert.deepEqual(a.locks,b.locks);
assert.equal(a.seed,b.seed);assert.equal(a.gender,b.gender);assert.equal(a.locks.length,24);
const expected=structuredClone(a.after);
for(const l of expected.HAIR_LAYERS){l.cards*=2;l.half_width/=2;}
assert.deepEqual(b.after,expected);assert.equal(a.sourceSha256,b.sourceSha256);
function snapshot(file){
 const glb=readGlb(file),p=glb.json.meshes[0].primitives[0],indices=readAccessor(glb,p.indices).data;
 const attrs=Object.fromEntries(Object.entries(p.attributes).map(([k,v])=>[k,readAccessor(glb,v)]));
 const components=connectedComponents(indices,attrs.POSITION.count);
 const fingerprints=components.map(c=>{
  const vertices=[...c.vertices].sort((a,b)=>a-b),local=new Map(vertices.map((v,i)=>[v,i]));
  const payload=Object.fromEntries(Object.entries(attrs).map(([k,a])=>[k,vertices.flatMap(v=>Array.from(a.data.slice(v*a.components,(v+1)*a.components)))]));
  payload.indices=[];let area=0;
  for(let i=0;i<indices.length;i+=3)if(local.has(indices[i])){
   const ids=Array.from(indices.slice(i,i+3));payload.indices.push(...ids.map(v=>local.get(v)));
   const pts=ids.map(v=>Array.from(attrs.POSITION.data.slice(v*3,v*3+3)));
   const u=pts[1].map((v,j)=>v-pts[0][j]),w=pts[2].map((v,j)=>v-pts[0][j]);
   area+=Math.hypot(u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0])/2;
  }
  return {ribbon:isRibbon(c),hash:sha(JSON.stringify(payload)),areaM2:area};
 });
 return {file,sha256:sha(fs.readFileSync(file)),extras:glb.json.meshes[0].extras??p.extras,
  vertices:attrs.POSITION.count,triangles:indices.length/3,
  cards:fingerprints.filter(c=>c.ribbon),caps:fingerprints.filter(c=>!c.ribbon),
  images:glb.json.images.map(i=>{const v=glb.json.bufferViews[i.bufferView];return sha(glb.bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength));}),
  materials:glb.json.materials};
}
const shipping=snapshot('assets/hair/crop01/g050.glb'),rebuilt=snapshot(`${root}/baseline/hair/crop01/g050.glb`),candidate=snapshot(`${root}/double/hair/crop01/g050.glb`);
assert.deepEqual(shipping.cards,rebuilt.cards);assert.deepEqual(shipping.caps,rebuilt.caps);
assert.deepEqual(shipping.images,rebuilt.images);assert.deepEqual(shipping.materials,rebuilt.materials);
assert.equal(shipping.cards.length,384);assert.equal(candidate.cards.length,768);
assert.deepEqual(shipping.caps,candidate.caps);assert.deepEqual(shipping.images,candidate.images);assert.deepEqual(shipping.materials,candidate.materials);
assert.ok(shipping.extras);assert.deepEqual(shipping.extras,candidate.extras);
const brief=x=>({...x,cards:x.cards.length,cardPayloadSha256:sha(JSON.stringify(x.cards)),cardAreaM2:x.cards.reduce((s,c)=>s+c.areaM2,0)});
console.log(JSON.stringify({sourceSha256:a.sourceSha256,baselinePayloadMatches:true,unchangedCapCount:shipping.caps.length,
 unchangedImagesAndMaterials:true,unchangedLocks:24,onlyStyleChanges:'cards x2, half_width /2 in every layer',
 note:'Card sampling and per-card RNG change with counts; card roots and details are not held fixed. Triangle area ignores cutout alpha.',
 rows:[shipping,rebuilt,candidate].map(brief)},null,2));
