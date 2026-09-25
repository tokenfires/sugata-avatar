import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readGlb,readAccessor} from '../../../tools/lut-bake/glb.mjs';
import {connectedComponents,isRibbon} from '../../../tools/figure-pipeline/hair_geometry.mjs';
import {layerMap,sha} from './map.mjs';
const root='tmp/hair-sep24/layer-attribution';
function snapshot(file,provenanceFile){
 const provenance=JSON.parse(fs.readFileSync(provenanceFile)),map=layerMap(file,provenance);
 const glb=readGlb(file),p=glb.json.meshes[0].primitives[0],idx=readAccessor(glb,p.indices).data;
 const attrs=Object.fromEntries(Object.entries(p.attributes).map(([k,v])=>[k,readAccessor(glb,v)]));
 const fingerprint=vertices=>{
  vertices=[...vertices].sort((a,b)=>a-b);const local=new Map(vertices.map((v,i)=>[v,i]));
  const payload={};
  for(const[name,a]of Object.entries(attrs))payload[name]=vertices.flatMap(v=>Array.from(a.data.slice(v*a.components,(v+1)*a.components)));
  payload.indices=[];for(let i=0;i<idx.length;i+=3)if(local.has(idx[i]))payload.indices.push(...Array.from(idx.slice(i,i+3),v=>local.get(v)));
  return sha(JSON.stringify(payload));
 };
 return {sha256:map.sha256,cards:map.cards.map(c=>({card:c.card,layer:c.layer,hash:fingerprint(c.vertices)})).sort((a,b)=>a.card-b.card),
  caps:connectedComponents(idx,attrs.POSITION.count).filter(c=>!isRibbon(c)).map(c=>fingerprint(c.vertices))};
}
const baseline=snapshot('assets/hair/crop01/g050.glb',`${root}/provenance.json`);
const candidate=snapshot(`${root}/root-cut/hair/crop01/g050.glb`,`${root}/root-cut-provenance.json`);
assert.deepEqual(baseline.caps,candidate.caps);
const changed=[],unchanged=[];
for(let i=0;i<baseline.cards.length;i++){
 const a=baseline.cards[i],b=candidate.cards[i];assert.equal(a.card,b.card);assert.equal(a.layer,b.layer);
 if(a.hash===b.hash)unchanged.push(a.card);else {assert.equal(a.layer,'root');changed.push(a.card);}
}
assert.equal(unchanged.length,314);assert.equal(changed.length,70);
console.log(JSON.stringify({baselineSha256:baseline.sha256,candidateSha256:candidate.sha256,unchangedCaps:baseline.caps.length,
 unchangedCards:unchanged.length,changedRootCards:changed.length,changedCardIndices:changed},null,2));
