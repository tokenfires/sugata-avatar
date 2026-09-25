import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {readGlb,readAccessor} from '../../../tools/lut-bake/glb.mjs';
import {connectedComponents,isRibbon} from '../../../tools/figure-pipeline/hair_geometry.mjs';
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const palette={cap:0x999999,root:0xff0044,mass:0x00ff44,underlayer:0x0088ff,body:0xffff00,surface:0xff00ff,flyaway:0x00ffff,veil:0xff8800,fringe:0x8800ff};

export function layerMap(file,provenance){
 const glb=readGlb(file),p=glb.json.meshes[0].primitives[0];
 const positions=readAccessor(glb,p.attributes.POSITION),indices=readAccessor(glb,p.indices).data;
 const labels=Array(positions.count).fill(null),components=connectedComponents(indices,positions.count);
 const records=new Map(provenance.cards.map(c=>[c.positionHash,c]));
 assert.equal(records.size,provenance.cards.length,'Duplicate provenance hash');
 const used=new Set(),cards=[];
 for(const c of components){
  let layer='cap';
  if(isRibbon(c)){
   const points=c.vertices.map(v=>Array.from(positions.data.slice(v*3,v*3+3),x=>x===0?0:x));
   points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2]);
   const bytes=Buffer.alloc(points.length*12);points.flat().forEach((v,i)=>bytes.writeFloatLE(v,i*4));
   const hash=sha(bytes),record=records.get(hash);
   assert.ok(record,`Unmapped card ${hash}`);assert.ok(!used.has(hash),'Duplicated card');used.add(hash);
   assert.equal(record.vertices,c.vertices.length);
   layer=record.layer;cards.push({...record,vertices:c.vertices});
  }
  assert.ok(Object.hasOwn(palette,layer));for(const v of c.vertices)labels[v]=layer;
 }
 assert.equal(used.size,provenance.cards.length);assert.ok(labels.every(x=>x!==null));
 for(let i=0;i<indices.length;i+=3){assert.equal(labels[indices[i]],labels[indices[i+1]]);assert.equal(labels[indices[i]],labels[indices[i+2]]);}
 return {file,sha256:sha(fs.readFileSync(file)),labels,palette,cards,
   layers:Object.fromEntries(Object.keys(palette).map(name=>[name,{cards:cards.filter(c=>c.layer===name).length,vertices:labels.filter(l=>l===name).length}]))};
}
