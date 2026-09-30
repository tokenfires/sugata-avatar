// Supplemental three-pose body check for the nonselected fringe motion witness.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {readGlb,readPrimitive} from '../lut-bake/glb.mjs';
import {measureHairSurface} from '../figure-pipeline/hair_surface.mjs';
import {SurfaceGrid} from '../figure-pipeline/hair_geometry.mjs';
const root='captures/lower-head-v1',output=`${root}/fringe494-body-witness.json`;
assert.ok(!fs.existsSync(output));const sha=b=>createHash('sha256').update(b).digest('hex');
const pair=JSON.parse(fs.readFileSync(`${root}/paired-controls.json`));
const p=readPrimitive(readGlb('captures/bob-lower-curve-v1/candidate.glb'),'hair_bob02');
const base=652+494*34,indices=[];
for(let i=0;i<p.indices.length;i+=3){const tri=p.indices.slice(i,i+3);if(tri.every(v=>v>=base&&v<base+34))indices.push(...tri.map(v=>v-base));}
assert.equal(indices.length,96);const rows=[];
for(const[arm,entry]of['baseline','candidate'].map((a,i)=>[a,pair.reports[i]])){
 const bytes=fs.readFileSync(entry.file);assert.equal(sha(bytes),entry.sha256);const r=JSON.parse(bytes);
 const cardIndex=r.setup.descriptor.otherCards.indexOf(494);assert.ok(cardIndex>=0);
 for(const frame of[372,373,375]){
  const sample=r.samples[frame],rawBytes=fs.readFileSync(`${root}/${arm}-right-profile-brown/${sample.geometryFile}`);assert.equal(sha(rawBytes),sample.geometrySha256);
  const raw=JSON.parse(gunzipSync(rawBytes));assert.equal(raw.frame,frame);
  const hair={positions:raw.otherVertices.slice(cardIndex*102,(cardIndex+1)*102),indices};assert.equal(hair.positions.length,102);
  const body={positions:raw.bodyPositions,indices:r.setup.descriptor.bodyIndices};
  const bounds={min:[-Infinity,-Infinity,-Infinity],max:[Infinity,Infinity,Infinity]};
  const contacts=measureHairSurface(hair,body,{headBounds:bounds,faceBounds:bounds,exampleLimit:12});
  const grid=new SurfaceGrid(raw.bodyPositions,raw.bodyNormals,body.indices);
  let minimum=Infinity,witness=null,negative=0;
  for(let v=0;v<34;v++){const point=hair.positions.slice(v*3,v*3+3),hit=grid.nearest(point);assert.ok(hit);if(hit.signed<0)negative++;if(hit.signed<minimum){minimum=hit.signed;witness={card:494,ring:Math.floor(v/2),side:v%2,point};}}
  rows.push({arm,frame,geometrySha256:sample.geometrySha256,triangleBodyPairs:contacts.head.pairs,minimumVertexClearanceMm:minimum*1000,negativeVertices:negative,witness,examples:contacts.head.examples});
 }
}
const sources=['tools/critic/audit-lower-fringe-witness.mjs','tools/lut-bake/glb.mjs','tools/figure-pipeline/hair_surface.mjs','tools/figure-pipeline/hair_geometry.mjs'];
const sourceHashes=Object.fromEntries(sources.map(file=>[file,sha(fs.readFileSync(file))]));
for(const file of sources){const target=`${root}/fringe-witness-source/${file}`;fs.mkdirSync(target.slice(0,target.lastIndexOf('/')),{recursive:true});fs.copyFileSync(file,target,fs.constants.COPYFILE_EXCL);}
const result={status:'complete',generated:new Date().toISOString(),reports:pair.reports,card:494,triangles:32,frames:[372,373,375],rows,sourceHashes,
 limits:['Only this one nonselected card and these three captured poses; not a full fringe, all-motion, garment or visible-contact qualification.','Oracle ignores alpha and occlusion. Actual images and source projection remain separate evidence.']};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(rows.map(({arm,frame,triangleBodyPairs,minimumVertexClearanceMm})=>({arm,frame,triangleBodyPairs,minimumVertexClearanceMm}))));
