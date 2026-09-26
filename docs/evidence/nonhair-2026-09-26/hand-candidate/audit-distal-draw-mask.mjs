// Read exact retained draw topology; never changes a mask or reruns native capture.
import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict';
import { createHash } from 'node:crypto'; import { gunzipSync } from 'node:zlib'; import { fileURLToPath } from 'node:url';
import { readGlb, readPrimitive } from '../../../../tools/lut-bake/glb.mjs';
const ROOT=fileURLToPath(new URL('../../../../',import.meta.url)),OUT=fileURLToPath(new URL('./',import.meta.url));
const BASE=path.join(ROOT,'captures/hand-attribution-2026-09-26/primary-v4'),output=path.join(OUT,'distal-draw-mask-v1.json');
assert.ok(!fs.existsSync(output),'Fresh receipt required');
const read=p=>fs.readFileSync(p),sha=b=>createHash('sha256').update(b).digest('hex'),json=p=>JSON.parse(read(p)),hjson=v=>sha(JSON.stringify(v));
const report=json(path.join(BASE,'report.json')),seal=json(path.join(BASE,'seal.json')),region=json(path.join(OUT,'distal-regions-v1.json')),diagnostic=json(path.join(OUT,'ipsilateral-corridor-v3.json'));
assert.equal(sha(read(path.join(BASE,'report.json'))),seal.reportSHA256);assert.equal(report.completed,true);assert.equal(diagnostic.completed,true);
assert.equal(sha(read(path.join(OUT,'ipsilateral-corridor-v3.json'))),'40f1047e3c81fb7c783529c17376db51e0a1203c6f6626e981b5d26fab5c0602');
assert.equal(sha(read(path.join(OUT,'distal-regions-v1.json'))),diagnostic.regionsSHA256);assert.equal(seal.reportSHA256,diagnostic.captureReportSHA256);
const bodyPath=path.join(BASE,'source/assets/wardrobe/body/g050.glb');assert.equal(sha(read(bodyPath)),region.bodySHA256);
const reader='tools/lut-bake/glb.mjs';assert.equal(sha(read(path.join(ROOT,reader))),report.sourceHashes[reader]);
const bodySource=readPrimitive(readGlb(bodyPath),'base.001'),initialTopology={};
const result={version:1,completed:false,sourceHashes:{'audit-distal-draw-mask.mjs':sha(read(fileURLToPath(import.meta.url))),[reader]:report.sourceHashes[reader]},
 captureReportSHA256:seal.reportSHA256,diagnosticSHA256:sha(read(path.join(OUT,'ipsilateral-corridor-v3.json'))),regionSHA256:diagnostic.regionsSHA256,
 bodySourceSHA256:region.bodySHA256,poses:[],scope:'Native full/drawn index membership only. Drawn is not proof of on-screen visibility: a garment may occlude a submitted body triangle.'};
for(const run of report.runs)for(const step of[0,455,637,720]){
 assert.equal(run.completed,true);const entry=run.geometry.find(g=>g.step===step),raw=read(path.join(BASE,entry.file));assert.equal(sha(raw),entry.sha256);
 const decoded=gunzipSync(raw);assert.equal(sha(decoded),entry.decodedSHA256);const snapshot=JSON.parse(decoded);
 assert.equal(snapshot.capture.arm,run.arm);assert.equal(snapshot.capture.step,step);assert.equal(snapshot.time,entry.time);
 const meshes={};
 for(const mesh of snapshot.meshes){
  assert.equal(mesh.fullIndices.length%3,0);assert.equal(mesh.drawnIndices.length%3,0);
  const fullMap=new Map(Array.from({length:mesh.fullIndices.length/3},(_,f)=>[mesh.fullIndices.slice(f*3,f*3+3).join(','),f]));
  assert.equal(fullMap.size,mesh.fullIndices.length/3,'Ambiguous duplicate oriented source triangle');
  const drawnFaces=Array.from({length:mesh.drawnIndices.length/3},(_,f)=>{const key=mesh.drawnIndices.slice(f*3,f*3+3).join(',');assert.ok(fullMap.has(key));return fullMap.get(key);});
  assert.equal(new Set(drawnFaces).size,drawnFaces.length);
  const topology={fullIndices:mesh.fullIndices,drawnIndices:mesh.drawnIndices};
  if(initialTopology[mesh.id])assert.deepEqual(topology,initialTopology[mesh.id],`Mask/topology changed ${run.arm}/${step}/${mesh.id}`);else initialTopology[mesh.id]=topology;
  meshes[mesh.id]={fullFaces:mesh.fullIndices.length/3,drawnFaces:drawnFaces.length,fullIndicesSHA256:hjson(mesh.fullIndices),drawnIndicesSHA256:hjson(mesh.drawnIndices),drawnSet:new Set(drawnFaces)};
  if(mesh.id==='body')assert.deepEqual(mesh.fullIndices,Array.from(bodySource.indices));
 }
 const selected=diagnostic.poses.find(p=>p.arm===run.arm&&p.step===step),sides={};
 for(const side of['l','r']){
  const drawn=region.distal[side].filter(f=>meshes.body.drawnSet.has(f)),hidden=region.distal[side].filter(f=>!meshes.body.drawnSet.has(f));
  const legacyHidden=region.legacy[side].filter(f=>!meshes.body.drawnSet.has(f));assert.deepEqual(legacyHidden,[],'A required legacy hand/finger face is masked');
  assert.deepEqual(drawn,region.distal[side],'This retained-data finding requires exact full/drawn query equality');
  const witness=selected.sides[side].allWornDistal.witness;
  sides[side]={fullDistalFaces:region.distal[side].length,drawnDistalFaces:drawn.length,hiddenDistalFaceIds:hidden,
   legacyHandFaces:region.legacy[side].length,legacyHiddenFaceIds:legacyHidden,fullAndDrawnOrderedFaceIdsSHA256:hjson(drawn),
   proximalSleeveFace:{face:side==='l'?16009:2803,drawn:meshes.body.drawnSet.has(side==='l'?16009:2803)},
   actualLimitingClothingPair:{queryFace:witness.query.face,queryDrawn:meshes[witness.query.mesh].drawnSet.has(witness.query.face),
    targetMesh:witness.target.mesh,targetFace:witness.target.face,targetDrawn:meshes[witness.target.mesh].drawnSet.has(witness.target.face),
    queryPoints:witness.query.points,targetPoints:witness.target.points},
   fullAndDrawnCertificateIdenticalBySetEquality:true,
   existingFullClothingResult:{status:selected.sides[side].allWornDistal.status,failedTriangles:selected.sides[side].allWornDistal.failedTriangles}};
 }
 result.poses.push({arm:run.arm,step,file:entry.file,sha256:entry.sha256,decodedSHA256:entry.decodedSHA256,
  meshes:Object.fromEntries(Object.entries(meshes).map(([id,{drawnSet,...rest}])=>[id,rest])),sides});
}
result.completed=true;result.maskAndTopologyFixedAcrossAll12Poses=true;result.everyLegacyHandFaceDrawn=true;result.everySelectedDistalFaceDrawn=true;
result.clothingCertificateRerun=false;result.noRerunReason='Every ordered full query face set equals its drawn subset, with the same retained positions and targets. The pure existing operator therefore receives identical inputs; no alternate visible-face result is invented.';
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({completed:true,poses:result.poses.length,reportSHA256:sha(read(output)),bodyDrawnIndicesSHA256:result.poses[0].meshes.body.drawnIndicesSHA256,distalDrawn:[region.distal.l.length,region.distal.r.length],legacyDrawn:[region.legacy.l.length,region.legacy.r.length],proximalSleeveFacesDrawn:[16009,2803]},null,2));
