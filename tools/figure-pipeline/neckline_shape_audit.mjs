// Independent surface checks on saved native CPU-skinned snapshots; no geometry edits.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {gunzipSync} from 'node:zlib';
import {ROOT,sha256,hashFile,ACCEPTED_PATH,ACCEPTED_SHA256} from './collar_replacement_manifest.mjs';
import {readGlb,readPrimitive} from '../lut-bake/glb.mjs';
import {compare,topology} from './collar_clearance_review.mjs';
const root=path.join(ROOT,'captures/neckline-shape-2026-09-30-v2'),construction=path.join(ROOT,'captures/neckline-construction-2026-09-30-v1');
const out=path.resolve(ROOT,process.argv[2]??'captures/neckline-shape-audit-2026-09-30-v1');assert.ok(!fs.existsSync(out));
const capture=JSON.parse(fs.readFileSync(path.join(root,'report.json'))),recipe=JSON.parse(fs.readFileSync(path.join(construction,'report.json')));assert.equal(capture.status,'captured');assert.equal(capture.candidateSHA256,recipe.candidateSHA256);assert.equal(hashFile(path.join(ROOT,ACCEPTED_PATH)),ACCEPTED_SHA256);
fs.mkdirSync(out,{recursive:true});const report={started:new Date().toISOString(),pid:process.pid,status:'running',captureReportSHA256:hashFile(path.join(root,'report.json')),constructionReportSHA256:hashFile(path.join(construction,'report.json')),runs:[],scope:'One saved zero-time native pose,234 complete affected triangles versus full body and actually retained bra. No vest/coverage/motion or all-garment certification.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const point=(p,i)=>Array.from(p.slice(3*i,3*i+3));
const triangles=(m,ids)=>ids.map(id=>{const vertices=Array.from(m.fullIndices.slice(3*id,3*id+3),i=>point(m.positions,i));return{id,vertices,min:[0,1,2].map(k=>Math.min(...vertices.map(v=>v[k]))),max:[0,1,2].map(k=>Math.max(...vertices.map(v=>v[k])))};});
try{
 for(const arm of ['accepted','candidate']){
  const entry=capture.arms.find(a=>a.key===`${arm}-0`);assert.equal(entry.completed,true);const bytes=fs.readFileSync(path.join(root,`${arm}-0-state.json.gz`));assert.equal(sha256(bytes),entry.compressedStateSHA256);const raw=gunzipSync(bytes);assert.equal(sha256(raw),entry.stateSHA256);
  const snapshot=JSON.parse(raw).snapshot,cloth=snapshot.meshes.find(m=>m.id==='female_casualsuit01'),body=snapshot.meshes.find(m=>m.id==='body'),bra=snapshot.meshes.find(m=>m.id==='foundation_bra');
  const clothSource=readPrimitive(readGlb(arm==='accepted'?path.join(ROOT,ACCEPTED_PATH):path.join(construction,'candidate.glb')),'female_casualsuit01');assert.deepEqual(cloth.fullIndices,Array.from(clothSource.indices));
  const bodySource=readPrimitive(readGlb(path.join(ROOT,'assets/figures/figure_g050.glb')),'base.001');assert.deepEqual(body.fullIndices,Array.from(bodySource.indices));
  const patch=triangles(cloth,recipe.affected.map(f=>f.triangle));
  const braIds=new Map();for(let t=0;t<bra.fullIndices.length;t+=3)braIds.set(bra.fullIndices.slice(t,t+3).join(':'),t/3);
  const map=[];for(let t=0;t<bra.drawnIndices.length;t+=3){const id=braIds.get(bra.drawnIndices.slice(t,t+3).join(':'));assert.ok(Number.isInteger(id));map.push(id);}
  const rec={arm,recordedStateSHA256:entry.stateSHA256,bodyTopology:topology({positions:body.positions,indices:body.fullIndices},bodySource.positions),retainedBraTriangles:map.length,retainedBraSourceTriangleIds:map};report.runs.push(rec);save();
  assert.equal(rec.bodyTopology.boundaryEdges,0);assert.equal(rec.bodyTopology.orientationErrors,0);assert.equal(rec.bodyTopology.nonmanifoldEdges,0);
  rec.body=compare(patch,{positions:body.positions,indices:body.fullIndices},{gridSteps:4,globalInside:true});save();console.log(`${arm} body crossings ${rec.body.crossingTriangles}, contained centroids ${rec.body.winding.insideByAbsoluteWindingOverHalf}`);
  rec.bra=compare(patch,{positions:bra.positions,indices:bra.drawnIndices},{gridSteps:4,globalInside:false});save();console.log(`${arm} bra crossings ${rec.bra.crossingTriangles}`);
 }
 report.status='audited';
}catch(e){report.status='failed';report.error=e.stack;throw e;}
finally{report.finished=new Date().toISOString();const source=['tools/figure-pipeline/neckline_shape_audit.mjs','tools/figure-pipeline/collar_clearance_review.mjs','tools/figure-pipeline/hair_geometry.mjs','tools/figure-pipeline/hair_surface.mjs'];report.sourceHashes=Object.fromEntries(source.map(f=>[f,hashFile(path.join(ROOT,f))]));for(const f of source){const dest=path.join(out,'source',f);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(ROOT,f),dest);}save();}
