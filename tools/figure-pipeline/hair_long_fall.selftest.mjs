#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readGlb, readPrimitive, readAccessor } from '../lut-bake/glb.mjs';
import { encodeGlb, geometryFingerprint, sha256 } from './hair_fall.mjs';
import { LONG_FALL_CALIBRATION as C, transformHairLongFall, runHairLongFall, measureLongFallSurface, parseLongFallArgs } from './hair_long_fall.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const input=path.join(root,'tools/figure-pipeline/fixtures/bob01-g050-original.glb'),bodyFile=path.join(root,'assets/figures/figure_g050.glb');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sugata-long-fall-test-'));
const arrayHash=a=>sha256(Buffer.from(new Float32Array(a).buffer));
let groups=0;const check=(name,run)=>{run();console.log(`PASS ${++groups} - ${name}`);};
const attrs=g=>g.json.meshes.find(m=>m.name==='hair_bob01').primitives[0].attributes;
const save=(name,g)=>{const p=path.join(temp,name);fs.writeFileSync(p,encodeGlb(g));return p;};
function changeFloat(g,name){const a=g.json.accessors[attrs(g)[name]],v=g.json.bufferViews[a.bufferView],i=(v.byteOffset??0)+(a.byteOffset??0);g.bin.writeFloatLE(g.bin.readFloatLE(i)+.01,i);}
try{
 assert.equal(sha256(fs.readFileSync(input)),C.sourceSha256,'Fetch the immutable original Git LFS fixture; the mutable shipping groom is not test input.');
 const originalBytes=fs.readFileSync(input),bodyBytes=fs.readFileSync(bodyFile),before=readGlb(input),original=readPrimitive(before,'hair_bob01');
 const result=transformHairLongFall(input,bodyFile),output=path.join(temp,'candidate.glb');fs.writeFileSync(output,result.bytes);
 const after=readGlb(output),corrected=readPrimitive(after,'hair_bob01');
 check('tracked original reproduces exact frozen candidate positions, normals and complete payload',()=>{
  assert.equal(arrayHash(corrected.positions),C.outputPositionsSha256);assert.equal(arrayHash(corrected.normals),C.outputNormalsSha256);assert.equal(geometryFingerprint(corrected),C.outputGeometry);
  const clean=readGlb(output);delete clean.json.asset.extras.sugataHairLongFall;assert.equal(sha256(encodeGlb(clean)),C.outputPayloadSha256);
  assert.equal(result.report.reproducedCandidateSha256,'110dfee561cd4ff627bb157986ff7001b69b75bb6e57a2e54f2b2d104523c876');assert.equal(result.report.correctedCards,173);
 });
 check('whole-triangle original rejection and corrected curtain pass retain the strict root failure',()=>{
  const originalSurface=measureLongFallSurface(original,readPrimitive(readGlb(bodyFile),'base.001'));
  assert.ok(originalSurface.face.pairs>0);assert.ok(originalSurface.movableCurtains.pairs>0);assert.ok(originalSurface.movableCurtains.cards.every(card=>card>=78&&card<462));for(const e of originalSurface.movableCurtains.examples)assert.ok(Array.from(original.indices.slice(e.hairTriangle*3,e.hairTriangle*3+3)).every(v=>v>=652+78*34&&v<652+462*34));assert.equal(originalSurface.strictAllBodyPass,false);
  const s=result.report.surface;assert.equal(s.face.pairs,0);assert.equal(s.movableCurtains.pairs,0);assert.equal(s.allBody.pairs,67);assert.deepEqual(s.allBody.cards,[68]);assert.equal(s.strictAllBodyPass,false);
  console.log(JSON.stringify({original:{face:originalSurface.face.pairs,curtains:originalSurface.movableCurtains.pairs,all:originalSurface.allBody.pairs},corrected:{face:s.face.pairs,curtains:s.movableCurtains.pairs,all:s.allBody.pairs}}));
 });
 check('caps, root positions, root-layer/fringe geometry, Y cut and upper release vertices remain exact',()=>{
  const movedCards=new Set();let moved=0;
  for(let v=0;v<original.vertexCount;v++){
   const card=Math.floor((v-652)/34),ring=Math.floor(((v-652)%34)/2),delta=[0,1,2].map(k=>corrected.positions[v*3+k]-original.positions[v*3+k]);
   assert.equal(delta[1],0);if(delta.some(x=>x!==0)){moved++;movedCards.add(card);}
   if(v<652||card<78||card>=462||ring===0||original.positions[v*3+1]>=C.releaseY)assert.deepEqual(delta,[0,0,0]);
   if(v<652||card<78||card>=462)for(let k=0;k<3;k++)assert.equal(corrected.normals[v*3+k],original.normals[v*3+k]);
  }
  assert.equal(moved,3642);assert.deepEqual([...movedCards].sort((a,b)=>a-b),C.cards.map(x=>x.card));
 });
 check('ring widths and card101 source connector boundary survive Float32 encoding',()=>{
  let maxHalfWidthError=0;
  for(let card=0;card<496;card++)for(let ring=0;ring<17;ring++){
   const v=652+(card*17+ring)*2,d=[0,1,2].map(k=>((corrected.positions[(v+1)*3+k]-corrected.positions[v*3+k])-(original.positions[(v+1)*3+k]-original.positions[v*3+k]))/2);
   maxHalfWidthError=Math.max(maxHalfWidthError,Math.hypot(...d));
   if(card===101&&ring<=11)for(let side=0;side<2;side++)for(let k=0;k<3;k++)assert.equal(corrected.positions[(v+side)*3+k],original.positions[(v+side)*3+k]);
   if(card===101&&ring<11)for(let side=0;side<2;side++)for(let k=0;k<3;k++)assert.equal(corrected.normals[(v+side)*3+k],original.normals[(v+side)*3+k]);
  }assert.ok(maxHalfWidthError<5e-9);assert.equal(result.report.arcLengthChangesMm.length,173);assert.ok(result.report.arcLengthChangesMm.some(x=>Math.abs(x.delta)>100),'Arc changes must not be misreported as preserved lengths.');
 });
 check('all UV, skin, topology, images/material and nongeometry bytes remain unchanged',()=>{
  const attributes=attrs(before);for(const name of ['TEXCOORD_0','TEXCOORD_1','JOINTS_0','WEIGHTS_0'])assert.deepEqual(readAccessor(after,attributes[name]).data,readAccessor(before,attributes[name]).data);
  assert.deepEqual(corrected.indices,original.indices);assert.equal(before.bin.length,after.bin.length);
  const mask=new Uint8Array(before.bin.length);for(const name of ['POSITION','NORMAL']){const a=before.json.accessors[attributes[name]],v=before.json.bufferViews[a.bufferView];for(let i=0;i<a.count;i++){const start=(v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??12);mask.fill(1,start,start+12);}}
  for(let i=0;i<mask.length;i++)if(!mask[i])assert.equal(before.bin[i],after.bin[i]);
  const a=structuredClone(before.json),b=structuredClone(after.json);delete b.asset.extras.sugataHairLongFall;if(!Object.keys(b.asset.extras).length)delete b.asset.extras;
  for(const json of [a,b])for(const name of ['POSITION','NORMAL']){delete json.accessors[attributes[name]].min;delete json.accessors[attributes[name]].max;}assert.deepEqual(b,a);
 });
 check('deterministic fresh output and byte-idempotent stamped replay',()=>{
  assert.deepEqual(transformHairLongFall(input,bodyFile).bytes,result.bytes);const again=transformHairLongFall(output,bodyFile);assert.equal(again.report.alreadyApplied,true);assert.deepEqual(again.bytes,result.bytes);
  assert.deepEqual(fs.readFileSync(input),originalBytes);assert.deepEqual(fs.readFileSync(bodyFile),bodyBytes);
 });
 check('other bakes, renamed bodies, altered source geometry/metadata and added attributes are refused',()=>{
  for(const bake of ['g000','g025','g075','g100'])assert.throws(()=>transformHairLongFall(input,path.join(root,`assets/figures/figure_${bake}.glb`)),/calibrated figure_g050/);
  assert.throws(()=>transformHairLongFall(path.join(root,'assets/hair/bob01/g000.glb'),bodyFile),/immutable original/);
  for(const change of [g=>changeFloat(g,'POSITION'),g=>changeFloat(g,'WEIGHTS_0'),g=>{g.json.asset.generator='changed';},g=>{attrs(g).TANGENT=attrs(g).NORMAL;}]){const g=readGlb(input);change(g);assert.throws(()=>transformHairLongFall(save('bad-source.glb',g),bodyFile),/immutable original/);}
 });
 check('stamp, corrected geometry, skin and arbitrary metadata tampering cannot pass idempotence',()=>{
  for(const change of [g=>{g.json.asset.extras.sugataHairLongFall=null;},g=>{g.json.asset.extras.sugataHairLongFall.sourceSha256='forged';},g=>{g.json.asset.extras.sugataHairLongFall.note='unknown';},g=>changeFloat(g,'POSITION'),g=>changeFloat(g,'NORMAL'),g=>changeFloat(g,'WEIGHTS_0'),g=>{g.json.materials[0].name='changed';}]){const g=readGlb(output);change(g);assert.throws(()=>transformHairLongFall(save('bad-corrected.glb',g),bodyFile),/second deformation/);}
  const unstamped=readGlb(output);delete unstamped.json.asset.extras.sugataHairLongFall;assert.throws(()=>transformHairLongFall(save('unstamped.glb',unstamped),bodyFile),/immutable original/);
 });
 check('new atomic outputs preserve sources and refuse aliases or existing evidence',()=>{
  const copy=path.join(temp,'source.glb');fs.writeFileSync(copy,originalBytes);const options={input:copy,body:bodyFile,output:copy};
  assert.throws(()=>runHairLongFall(options),/In-place/);assert.throws(()=>runHairLongFall({...options,output:bodyFile}),/body/);
  for(const kind of ['sym','hard']){const link=path.join(temp,kind+'.glb');if(kind==='sym')fs.symlinkSync(copy,link);else fs.linkSync(copy,link);assert.throws(()=>runHairLongFall({...options,output:link}),/In-place/);}
  assert.throws(()=>runHairLongFall({...options,output:path.join(temp,'new.glb'),report:copy}),/Report path/);
  const existing=path.join(temp,'existing.glb');fs.writeFileSync(existing,'preserve');assert.throws(()=>runHairLongFall({...options,output:existing}),/exists/);assert.equal(fs.readFileSync(existing,'utf8'),'preserve');
  const nested=path.join(temp,'nested','out.glb'),report=path.join(temp,'reports','out.json');runHairLongFall({...options,output:nested,report});assert.deepEqual(fs.readFileSync(nested),result.bytes);assert.equal(JSON.parse(fs.readFileSync(report)).outputSha256,sha256(result.bytes));
 });
 check('staging and publication failures leave no partial output or unowned-file deletion',()=>{
  const blocked=path.join(temp,'not-a-directory');fs.writeFileSync(blocked,'preserve');const out=path.join(temp,'staging','out.glb');assert.throws(()=>runHairLongFall({input,body:bodyFile,output:out,report:path.join(blocked,'report.json')}));assert.equal(fs.existsSync(out),false);assert.deepEqual(fs.readdirSync(path.dirname(out)),[]);assert.equal(fs.readFileSync(blocked,'utf8'),'preserve');
  const real=path.join(temp,'real'),alias=path.join(temp,'alias');fs.mkdirSync(real);fs.symlinkSync(real,alias);const sentinel=path.join(real,'.hair-long-fall-reserved.tmp');fs.writeFileSync(sentinel,'preserve');
  assert.throws(()=>runHairLongFall({input,body:bodyFile,output:path.join(real,'same.glb'),report:path.join(alias,'same.glb')}),/EEXIST/);assert.equal(fs.existsSync(path.join(real,'same.glb')),false);assert.deepEqual(fs.readdirSync(real),[path.basename(sentinel)]);assert.equal(fs.readFileSync(sentinel,'utf8'),'preserve');
 });
 check('CLI requires explicit paths and rejects duplicates or an in-place escape hatch',()=>{
  assert.equal(parseLongFallArgs(['--help']),null);assert.throws(()=>parseLongFallArgs(['--input','x','--input','y']),/duplicate/);assert.throws(()=>parseLongFallArgs(['--allow-in-place']),/Unknown/);assert.throws(()=>parseLongFallArgs(['--input']),/requires/);assert.throws(()=>parseLongFallArgs(['--input','x','--body','y']),/output/);
 });
 console.log(`${groups}/${groups} portable bob01/g050 long-fall groups passed`);
}finally{fs.rmSync(temp,{recursive:true,force:true});}
