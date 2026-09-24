import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {readGlb,readAccessor} from '../../tools/lut-bake/glb.mjs';
import {connectedComponents,isRibbon} from '../../tools/figure-pipeline/hair_geometry.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function snapshot(file){
 const bytes=fs.readFileSync(file),g=readGlb(file),p=g.json.meshes[0].primitives[0];
 const idx=readAccessor(g,p.indices).data,attrs=Object.fromEntries(Object.entries(p.attributes).map(([k,id])=>[k,readAccessor(g,id)]));
 const count=attrs.POSITION.count,components=connectedComponents(idx,count).filter(isRibbon);
 const cards=components.map(c=>{
  const vertices=[...c.vertices].sort((a,b)=>a-b),map=new Map(vertices.map((v,i)=>[v,i]));
  const card={};
  for(const[key,a]of Object.entries(attrs)){
   const n=a.data.length/a.count;
   card[key]=vertices.flatMap(v=>Array.from(a.data.slice(v*n,(v+1)*n)));
  }
  card.indices=[];for(let i=0;i<idx.length;i+=3)if(map.has(idx[i]))card.indices.push(...Array.from(idx.slice(i,i+3),v=>map.get(v)));
  return sha(JSON.stringify(card));
 });
 return {file,sha256:sha(bytes),cards:cards.length,cardHash:sha(JSON.stringify(cards))};
}
const files=process.argv.slice(2);const rows=files.map(snapshot);
for(const r of rows.slice(1))if(r.cardHash!==rows[0].cardHash)throw new Error(`${r.file} card payload changed`);
console.log(JSON.stringify({identicalCardPayload:true,rows},null,2));
