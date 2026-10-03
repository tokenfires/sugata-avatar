/** Preservation/readback only. Does not construct geometry or launch a renderer. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {Matrix4} from 'three';
const started=new Date().toISOString(),root=process.cwd(),packet='docs/evidence/nonhair-2026-10-03/whole-front-blockout',raw='captures/whole-front-blockout-2026-10-03-v1';
const bytes=p=>fs.readFileSync(path.resolve(root,p)),hash=p=>crypto.createHash('sha256').update(bytes(p)).digest('hex');
const report=JSON.parse(bytes(raw+'/report.json')),recipe=JSON.parse(bytes('looks/sage-lavender-chin.json'));
assert.equal(report.pid,4860);assert.equal(report.status,'failed');assert.equal(report.started,'2026-10-03T15:18:01.304Z');assert.equal(report.finished,'2026-10-03T15:18:05.985Z');
for(const [p,h] of Object.entries({...report.sources,...report.inputs}))assert.equal(hash(p),h,p);
assert.equal(hash('tools/critic/whole-front-blockout.mjs'),report.instrumentSHA256);assert.equal(hash(raw+'/instrument.mjs'),report.instrumentSHA256);
assert.equal(report.errors.length,3);assert.equal(report.errors[0],'Failed to load resource: the server responded with a status of 404 (Not Found)');assert.equal(report.warnings.length,4);
assert.deepEqual(report.disposal,{disposed:true,leaked:[]});assert.deepEqual(report.cleanup,{page:'closed',browser:'closed'});
assert.equal(report.images.length,4);const dimensions=[];
const cases=[['original','front'],['proposal','front'],['proposal','oblique'],['original','oblique']];
for(const [i,row] of report.images.entries()){
 const [arm,view]=cases[i];assert.equal(row.file,arm+'-'+view+'.png');assert.equal(hash(raw+'/'+row.file),row.sha256);
 const b=bytes(raw+'/'+row.file);assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(b.readUInt32BE(16),1440);assert.equal(b.readUInt32BE(20),1000);dimensions.push({file:row.file,width:1440,height:1000,bytes:b.length,sha256:row.sha256});
 assert.deepEqual(row.before,row.after);const s=row.before;assert.equal(s.arm,arm);assert.equal(s.view,view);assert.equal(s.originalVisible,arm==='original');assert.equal(s.proposalVisible,arm==='proposal');assert.deepEqual(s.recipe,recipe);assert.equal(s.backend,'webgpu');assert.equal(s.webGPU,true);assert.equal(s.camera.fov,26);assert.deepEqual(s.camera.position,view==='front'?[0,1.55,.88]:[.4235,1.55,.7665]);
 assert.deepEqual(s.headWorld,report.images[0].before.headWorld);assert.deepEqual(s.attachment,report.images[0].before.attachment);assert.deepEqual(s.records,report.images[0].before.records);
 const a=s.attachment;assert.equal(a.head,'head');assert.ok([...s.headWorld,...a.figureRootWorld,...a.sourceToHead].every(Number.isFinite));assert.deepEqual(s.headWorld,a.constructionHeadWorld);
 const head=new Matrix4().fromArray(a.constructionHeadWorld),figure=new Matrix4().fromArray(a.figureRootWorld);assert.ok(Math.abs(head.determinant())>1e-10);assert.ok(Math.abs(figure.determinant())>1e-10);
 const reconstructed=head.multiply(new Matrix4().fromArray(a.sourceToHead)).toArray();assert.ok(reconstructed.every((x,j)=>Math.abs(x-a.figureRootWorld[j])<1e-12));
 for(const m of s.records){assert.equal(m.vertices,709);assert.equal(m.triangles,1336);assert.equal(m.sharedCapSideBoundary,true);assert.equal(m.sideStartAzimuthDegrees,39.375);}
 assert.ok(Date.parse(row.requested)>=Date.parse(report.started));assert.ok(Date.parse(row.finished)<=Date.parse(report.finished));
}
const receipt={pid:process.pid,started,finished:new Date().toISOString(),command:'node '+packet+'/root-readback.mjs',sourceSHA256:hash(packet+'/root-readback.mjs'),nativeReportSHA256:hash(raw+'/report.json'),sources:Object.keys(report.sources).length,inputs:Object.keys(report.inputs).length,states:8,dimensions,disposal:report.disposal,cleanup:report.cleanup,status:'readback passed; native run and artistic proposal remain refused',limits:['No native rerun, geometry construction, image edit or investigation after 15:24.','The three error entries contain one unattributed console404 and two assertion messages.','Matrix and state checks support provenance, not appearance, clearance, coverage, motion or AAA qualification.']};
fs.writeFileSync(root+'/'+packet+'/ROOT-READBACK.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
