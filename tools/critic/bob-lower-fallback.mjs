// One bounded fallback of the finalized contact-card set; no amplitude or runtime tuning.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readGlb,readPrimitive,readAccessor} from '../lut-bake/glb.mjs';
import {encodeGlb,sha256} from '../figure-pipeline/hair_fall.mjs';
import {SurfaceGrid} from '../figure-pipeline/hair_geometry.mjs';
import {measureHairSurface} from '../figure-pipeline/hair_surface.mjs';
const started=new Date().toISOString(),out='captures/bob-lower-fallback-v1';
const input='captures/bob-lower-curve-v1/candidate.glb',inputSha256='2b0c68c05802d0f515aa84b7e505fd325735befbc0159a50bd37cc887e274802';
const control='captures/bob-side-envelope-v3/candidate.glb',controlSha256='bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9';
const bodyPath='assets/figures/figure_g050.glb',bodySha256='b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14';
for(const[file,hash]of[[input,inputSha256],[control,controlSha256],[bodyPath,bodySha256]])assert.equal(sha256(fs.readFileSync(file)),hash);
assert.ok(!fs.existsSync(out));const read=p=>JSON.parse(fs.readFileSync(p));
const previous=read('captures/bob-lower-curve-v1/candidate-report.json'),selected=previous.selected;
const failed=new Set(),prerequisites=[];
for(const[protocol,view,count]of[['head','right-profile',556],['ordinary','left-profile',721]]){
 const dir=`captures/lower-${protocol}-v1/candidate-${view}-brown`,file=`${dir}/numerical-checks.json`,audit=read(file),capture=read(`${dir}/report.json`);
 assert.equal(audit.status,'complete');assert.deepEqual(audit,read(`${dir}/audit-progress.json`));assert.equal(audit.rows.length,count);
 assert.deepEqual(audit.rows.map(r=>r.frame),Array.from({length:count},(_,i)=>i));assert.equal(audit.reportSha256,sha256(fs.readFileSync(`${dir}/report.json`)));
 assert.equal(capture.status,'captured');assert.deepEqual(capture.errors,[]);assert.equal(capture.routedAsset,input);assert.equal(capture.candidateSha256,inputSha256);
 assert.deepEqual(audit.selectedCards,selected);assert.equal(audit.selectedTriangles,10816);
 for(const row of audit.rows)for(const card of row.contactCards)failed.add(card);
 prerequisites.push({protocol,file,sha256:sha256(fs.readFileSync(file)),summary:audit.summary});
}
const restoredCards=[...failed].sort((a,b)=>a-b);
assert.equal(restoredCards.length,19,'Final set changed; reconsider the bounded fallback before editing');
assert.deepEqual(restoredCards,[78,80,86,101,112,113,120,127,130,131,133,135,146,151,154,162,172,173,177]);
assert.ok(restoredCards.every(c=>c>=78&&c<178&&previous.affectedCards.includes(c)));
const originalGlb=readGlb(input),glb=readGlb(input),old=readPrimitive(originalGlb,'hair_bob02'),base=readPrimitive(readGlb(control),'hair_bob02');
assert.deepEqual(old.indices,base.indices);
const primitive=glb.json.meshes.find(m=>m.name==='hair_bob02').primitives[0];
for(const[name,key]of[['POSITION','positions'],['NORMAL','normals']]){
 const ac=glb.json.accessors[primitive.attributes[name]],bv=glb.json.bufferViews[ac.bufferView],offset=(ac.byteOffset??0)+(bv.byteOffset??0),stride=bv.byteStride??12;
 assert.equal(ac.componentType,5126);assert.ok(!ac.sparse);
 for(const card of restoredCards)for(let v=652+card*34;v<652+(card+1)*34;v++)for(let k=0;k<3;k++)glb.bin.writeFloatLE(base[key][v*3+k],offset+v*stride+k*4);
 const data=readAccessor(glb,primitive.attributes[name]).data;
 ac.min=[0,1,2].map(k=>Math.min(...Array.from({length:ac.count},(_,v)=>data[v*3+k])));
 ac.max=[0,1,2].map(k=>Math.max(...Array.from({length:ac.count},(_,v)=>data[v*3+k])));
}
const result=readPrimitive(glb,'hair_bob02'),attributes={};
for(const name of Object.keys(primitive.attributes)){
 const a=readAccessor(originalGlb,primitive.attributes[name]),b=readAccessor(glb,primitive.attributes[name]);let changed=0;
 for(let v=0;v<a.count;v++){
  const different=Array.from({length:a.components},(_,k)=>a.data[v*a.components+k]!==b.data[v*b.components+k]).some(Boolean);
  if(different){assert.ok(['POSITION','NORMAL'].includes(name)&&failed.has(Math.floor((v-652)/34)),`${name} protected record ${v}`);changed++;}
 }
 attributes[name]={changedRecords:changed};
}
for(const card of restoredCards)for(const key of['positions','normals'])assert.deepEqual(result[key].slice((652+card*34)*3,(652+(card+1)*34)*3),base[key].slice((652+card*34)*3,(652+(card+1)*34)*3));
assert.deepEqual(result.indices,old.indices);
for(const key of['nodes','skins','scenes','materials','textures','images'])assert.deepEqual(glb.json[key],originalGlb.json[key]);
const set=new Set(selected),indices=[];
for(let i=0;i<result.indices.length;i+=3)if([0,1,2].every(k=>result.indices[i+k]>=652&&set.has(Math.floor((result.indices[i+k]-652)/34))))indices.push(...result.indices.slice(i,i+3));
assert.equal(indices.length,32448);
const body=readPrimitive(readGlb(bodyPath),'base.001'),bounds={min:[-Infinity,-Infinity,-Infinity],max:[Infinity,Infinity,Infinity]};
const contact=measureHairSurface({...result,indices},body,{headBounds:bounds,faceBounds:bounds}),grid=new SurfaceGrid(body.positions,body.normals,body.indices);
let minimum=Infinity,witness=null,negative=0;
for(const card of selected)for(let v=652+card*34;v<652+(card+1)*34;v++){
 const point=Array.from(result.positions.slice(v*3,v*3+3)),hit=grid.nearest(point);assert.ok(hit);if(hit.signed<0)negative++;
 if(hit.signed<minimum){minimum=hit.signed;witness={card,vertex:v,point,signedMm:minimum*1000};}
}
const report={status:'unqualified inward ends with exact inner-card fallback',started,finished:new Date().toISOString(),pid:process.pid,
 input,inputSha256,control,controlSha256,bodyPath,bodySha256,prerequisites,selected,restoredCards,inwardCards:previous.affectedCards.filter(c=>!failed.has(c)),attributes,
 restoredPositionAndNormalRecordsExact:true,allOtherRecordsAndTopologyExact:true,
 restTriangleBodyPairs:contact.head.pairs,restContactCards:contact.head.cards.map(i=>selected[i]),minimumSelectedVertexClearanceMm:minimum*1000,negativeVertices:negative,witness,
 limits:['Only finalized 19 failing inner-mass cards restored from qualified side control; all other lower-v1 geometry and settings exact.',
 'Set is derived from triangle-contact card IDs, not an exhaustive negative-only-card inventory. Fresh full338 motion and signed-vertex checks are required.',
 'Shared median/compliance can change again. This new combination inherits no body-motion or visual qualification.',
 'Do not widen fallback, tune amplitude or edit simulation settings without a new recorded diagnosis.']};
glb.json.asset.extras??={};glb.json.asset.extras.sugataUnqualifiedExperiment={status:report.status,restoredCards};
const bytes=encodeGlb(glb);report.outputSha256=sha256(bytes);
const sources=['tools/critic/bob-lower-fallback.mjs','tools/lut-bake/glb.mjs','tools/figure-pipeline/hair_fall.mjs','tools/figure-pipeline/hair_geometry.mjs','tools/figure-pipeline/hair_surface.mjs'];
report.sourceHashes=Object.fromEntries(sources.map(p=>[p,sha256(fs.readFileSync(p))]));
fs.mkdirSync(out,{recursive:true});
for(const file of sources){const target=`${out}/source/${file}`;fs.mkdirSync(target.slice(0,target.lastIndexOf('/')),{recursive:true});fs.copyFileSync(file,target,fs.constants.COPYFILE_EXCL);}
fs.writeFileSync(`${out}/candidate.glb`,bytes,{flag:'wx'});fs.writeFileSync(`${out}/candidate-report.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({...report,selected:selected.length,inwardCards:report.inwardCards.length},null,2));
