// Follow-up body target requested after v1: remove ipsilateral arm attachment, retain clothing.
import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict';
import { createHash } from 'node:crypto'; import { gunzipSync } from 'node:zlib'; import { fileURLToPath } from 'node:url';
import { readGlb, readPrimitive, readAccessor } from '../../../../tools/lut-bake/glb.mjs';
import { triangles, projectedIndex, certifyLateralCorridor } from './distal-corridor.mjs';
import { positiveMarginBound } from './distal-margin-bound.mjs';
const ROOT=fileURLToPath(new URL('../../../../',import.meta.url)),OUT=fileURLToPath(new URL('./',import.meta.url));
const BASE=path.join(ROOT,'captures/hand-attribution-2026-09-26/primary-v4'),output=path.join(OUT,'ipsilateral-corridor-v2.json');
assert.ok(!fs.existsSync(output),'Fresh result required');
const read=p=>fs.readFileSync(p), sha=b=>createHash('sha256').update(b).digest('hex'), json=p=>JSON.parse(read(p));
const prior=json(path.join(OUT,'distal-corridor-v1.json')),regions=json(path.join(OUT,'distal-regions-v1.json'));
assert.equal(sha(read(path.join(OUT,'distal-corridor-v1.json'))),'604a645efaca2b3d3c83c69cf87c12821cad1959b8f3b23eb3a40307523ae6ed');
assert.equal(sha(read(path.join(OUT,'distal-regions-v1.json'))),prior.regionsSHA256);
const report=json(path.join(BASE,'report.json'));assert.equal(sha(read(path.join(BASE,'report.json'))),prior.captureReportSHA256);assert.equal(report.completed,true);
const sourceHashes={};
for(const f of ['distal-corridor.mjs','distal-margin-bound.mjs','distal-margin-bound.selftest.mjs','measure-ipsilateral-corridor.mjs'])sourceHashes[f]=sha(read(path.join(OUT,f)));
sourceHashes['tools/lut-bake/glb.mjs']=sha(read(path.join(ROOT,'tools/lut-bake/glb.mjs')));assert.equal(sourceHashes['tools/lut-bake/glb.mjs'],report.sourceHashes['tools/lut-bake/glb.mjs']);
const sources={},attributes={};
for(const id of ['body','foundation_bra','foundation_briefs','female_casualsuit01','shoes01']){
 const rel=`assets/wardrobe/${id}/g050.glb`,p=path.join(BASE,'source',rel);sourceHashes[rel]=sha(read(p));assert.equal(sourceHashes[rel],report.sourceHashes[rel]);
 const glb=readGlb(p);sources[id]=readPrimitive(glb,id==='body'?'base.001':id);
 const prim=glb.json.meshes[0].primitives[0];attributes[id]={joints:readAccessor(glb,prim.attributes.JOINTS_0).data,weights:readAccessor(glb,prim.attributes.WEIGHTS_0).data,names:glb.json.skins[0].joints.map(i=>glb.json.nodes[i].name)};
}
const b=sources.body,attrs=attributes.body,faces=Array.from({length:b.indices.length/3},(_,f)=>Array.from(b.indices.slice(f*3,f*3+3)));
const entries=(id,v)=>{const a=attributes[id];return[0,1,2,3].map(k=>({joint:a.names[a.joints[v*4+k]],weight:a.weights[v*4+k]}));};
const armRE=/^(upperarm|lowerarm|hand|thumb|index|middle|ring|pinky)_/;
const support=(v,side)=>entries('body',v).some(e=>e.weight>0&&armRE.test(e.joint)&&(!side||e.joint.endsWith('_'+side)));
const excluded={literalSupport:{l:[],r:[]},sourceHalfSpace:{l:[],r:[]}},targets={literalSupport:{},sourceHalfSpace:{}},profileSummary={};
for(const[face,vs]of faces.entries()){
 for(const side of['l','r'])if(vs.some(v=>support(v,side)))excluded.literalSupport[side].push(face);
 if(vs.some(v=>support(v))){const side=vs.every(v=>b.positions[v*3]>0)?'l':vs.every(v=>b.positions[v*3]<0)?'r':null;assert.ok(side,'Whole-arm union crosses source midline; stop for review');excluded.sourceHalfSpace[side].push(face);}
}
const pointKey=v=>Array.from(b.positions.slice(v*3,v*3+3)).join(',');
for(const name of Object.keys(excluded)){
 profileSummary[name]={};
 for(const side of['l','r']){
  const omit=new Set(excluded[name][side]);targets[name][side]=faces.flatMap((_,f)=>omit.has(f)?[]:[f]);
  const removedPoints=new Set(excluded[name][side].flatMap(f=>faces[f]).map(pointKey));
  const keptPoints=new Set(targets[name][side].flatMap(f=>faces[f]).map(pointKey));
  const boundary=excluded[name][side].filter(f=>faces[f].some(v=>keptPoints.has(pointKey(v))));
  profileSummary[name][side]={excludedFaces:omit.size,targetFaces:targets[name][side].length,excludedAttachmentBoundaryFaces:boundary,
   oppositeHalfSpaceExcludedFaces:excluded[name][side].filter(f=>faces[f].every(v=>side==='l'?b.positions[v*3]<0:b.positions[v*3]>0)),
   retainedFacesTouchingExcludedSourcePositions:targets[name][side].filter(f=>faces[f].some(v=>removedPoints.has(pointKey(v)))).length};
 }
}
const result={version:2,createdAt:new Date().toISOString(),completed:false,captureReportSHA256:prior.captureReportSHA256,manifestSHA256:prior.manifestSHA256,
 priorReportSHA256:sha(read(path.join(OUT,'distal-corridor-v1.json'))),regionsSHA256:prior.regionsSHA256,sourceHashes,
 sourceRegionProfiles:{literalSupport:'Exclude every body triangle incident to any positive ipsilateral upperarm-or-descendant weight. A documented stray weight also excludes opposite-hand faces; do not claim all opposite-arm surfaces retained.',
 sourceHalfSpace:'Union of all positive upperarm-or-descendant support, closed over incident faces and partitioned by exact source-rest x sign. No selected face crosses the midline. Exclude only the ipsilateral partition; preserve every opposite-half-space and non-arm face.'},
 profileSummary,excludedFaceIds:excluded,poses:[],scope:'Measured sufficient bounds on exact retained geometry. No chosen acceptance margin, candidate angle, native behavior change or continuous-motion qualification.'};
const attachSource=w=>w?{...w,querySource:w.query.ids.map(v=>({vertex:v,position:Array.from(sources[w.query.mesh].positions.slice(v*3,v*3+3)),weights:entries(w.query.mesh,v)})),targetSource:w.target.ids.map(v=>({vertex:v,position:Array.from(sources[w.target.mesh].positions.slice(v*3,v*3+3)),weights:entries(w.target.mesh,v)}))}:null;
const compact=c=>{const{failedFaceIds,...rest}=c;return{...rest,failedFaceIdsSHA256:sha(JSON.stringify(failedFaceIds)),witness:attachSource(c.witness)};};
const save=()=>fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');save();
for(const run of report.runs)for(const step of[0,455,637,720]){
 const entry=run.geometry.find(g=>g.step===step),raw=read(path.join(BASE,entry.file));assert.equal(sha(raw),entry.sha256);const decoded=gunzipSync(raw);assert.equal(sha(decoded),entry.decodedSHA256);const s=JSON.parse(decoded);
 assert.equal(s.capture.arm,run.arm);assert.equal(s.capture.step,step);assert.equal(s.time,entry.time);
 const all={};for(const mesh of s.meshes){assert.deepEqual(mesh.fullIndices,Array.from(sources[mesh.id].indices));all[mesh.id]=triangles(mesh);}
 const sides={};for(const side of['l','r']){
  sides[side]={};const queries=regions.distal[side].map(f=>all.body[f]);
  for(const name of Object.keys(targets)){
   const index=projectedIndex(targets[name][side].map(f=>all.body[f])),certificate=certifyLateralCorridor(queries,index,{side,marginMetres:0});
   sides[side][name]={certificate:compact(certificate),positiveBound:null};
   if(certificate.status==='certified-for-selected-triangle-sets'){const bound=positiveMarginBound(queries,index,certificate);bound.witness=attachSource(bound.witness);sides[side][name].positiveBound=bound;}
  }
  // Preserve the complete worn v1 diagnostic; annotate its actual limiting source weights.
  const old=prior.poses.find(p=>p.arm===run.arm&&p.step===step).sides[side];sides[side].allWornDistal={...old.distalWithBoundary.allWorn,witness:attachSource(old.distalWithBoundary.allWorn.witness)};
  const index=projectedIndex(Object.entries(all).filter(([id])=>id!=='body').flatMap(([,v])=>v));
  if(old.legacyHand.allWorn.status==='certified-for-selected-triangle-sets'){
   const bound=positiveMarginBound(regions.legacy[side].map(f=>all.body[f]),index,old.legacyHand.allWorn);bound.witness=attachSource(bound.witness);sides[side].allWornLegacyHandPositiveBound=bound;
  }
 }
 result.poses.push({arm:run.arm,step,time:s.time,file:entry.file,sha256:entry.sha256,decodedSHA256:entry.decodedSHA256,sides});save();
 console.log(`Measured ipsilateral targets ${run.arm}/${step}`);
}
result.completed=true;save();console.log(JSON.stringify({completed:true,poses:result.poses.length,sha256:sha(read(output)),profiles:profileSummary},null,2));
