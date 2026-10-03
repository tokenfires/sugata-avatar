/** Root's CPU-only readback of the sole native iris report and exact originals. */
import fs from 'node:fs'; import assert from 'node:assert/strict'; import crypto from 'node:crypto';
import { ROOT, collectSourceHashes, hashFile } from '../../../../tools/figure-pipeline/collar_replacement_manifest.mjs';
const started=new Date().toISOString(), packet=ROOT+'/docs/evidence/nonhair-2026-10-03/iris-pigment', raw=ROOT+'/captures/iris-pigment-2026-10-03-v1';
const r=JSON.parse(fs.readFileSync(raw+'/report.json')),recipe=JSON.parse(fs.readFileSync(ROOT+'/looks/sage-lavender-chin.json')),colour=JSON.parse(fs.readFileSync(packet+'/SOURCE-CHECK.json'));
assert.equal(r.status,'observed');assert.equal(r.finalPinsUnchanged,true);assert.deepEqual(r.errors,[]);assert.deepEqual(r.failedResources,[]);assert.equal(r.warnings.length,4);
assert.deepEqual(r.sources,collectSourceHashes(ROOT));for(const [p,h]of Object.entries(r.inputs))assert.equal(hashFile(ROOT+'/'+p),h);
assert.equal(hashFile(raw+'/instrument.mjs'),r.instrumentSHA256);assert.equal(hashFile(ROOT+'/tools/critic/iris-pigment.mjs'),r.instrumentSHA256);
assert.ok(Date.parse(r.started)<Date.parse('2026-10-03T17:09:00Z'));assert.ok(Date.parse(r.finished)<Date.parse(r.stop));
const expected=[['original','front'],['candidate','front'],['candidate','oblique'],['original','oblique']],rows=[];assert.equal(r.images.length,4);
let constant;
for(let i=0;i<4;i++){
 const x=r.images[i],[arm,view]=expected[i];assert.equal(x.file,arm+'-'+view+'.png');assert.ok(Date.parse(x.finished)<Date.parse(r.stop));
 const b=fs.readFileSync(raw+'/'+x.file);assert.equal(hashFile(raw+'/'+x.file),x.sha256);assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(b.readUInt32BE(16),1440);assert.equal(b.readUInt32BE(20),1000);
 assert.deepEqual(x.before,x.after);
 const s=x.before,e=s.eyes;assert.equal(s.arm,arm);assert.equal(s.view,view);assert.deepEqual(s.actualConfiguration,recipe);assert.deepEqual(s.recipe,recipe);
 assert.equal(s.camera.fov,26);assert.deepEqual(s.camera.position,view==='front'?[0,1.55,.88]:[.4235,1.55,.7665]);assert.equal(s.backend,'webgpu');assert.equal(s.webGPU,true);
 assert.equal(e.originalOwnerUnchanged,true);assert.equal(e.donorAttached,false);assert.equal(e.borrowedSourceSame,true);assert.equal(e.borrowedMapSame,true);assert.equal(e.actualCornea,e.originalCornea);
 assert.equal(e.activeGlobe,arm==='original'?e.originalGlobe:e.donorGlobe);assert.deepEqual(e.originalGeometry,e.donorGeometry);assert.deepEqual(e.originalFrames,e.donorFrames);assert.deepEqual(e.originalUniforms,e.donorUniforms);assert.deepEqual(e.originalOptics,e.donorOptics);
 assert.equal(e.blue,'#527b97');assert.deepEqual(e.chromaticity,colour.chromaticity);assert.deepEqual(e.linear,colour.linear);assert.equal(e.luma,colour.luma);assert.deepEqual(e.donorDisposals,[]);assert.equal(e.borrowedMapDisposed,0);
 const owners=s.bindings.filter(q=>q.mesh===e.globeMesh);assert.equal(owners.length,1);assert.deepEqual(owners[0].materials,[e.activeGlobe]);
 const stable=structuredClone(s);delete stable.arm;delete stable.view;delete stable.camera;delete stable.eyes.activeGlobe;
 stable.bindings=stable.bindings.map(q=>q.mesh===e.globeMesh?{...q,materials:['declared-active-globe']}:q);constant??=stable;assert.deepEqual(stable,constant);
 rows.push({file:x.file,sha256:x.sha256,bytes:b.length,width:1440,height:1000,requested:x.requested,finished:x.finished});
}
const t=r.retirement;assert.equal(t.restored.arm,'original');assert.equal(t.restored.eyes.activeGlobe,t.restored.eyes.originalGlobe);assert.deepEqual(t.retirementErrors,[]);assert.equal(t.snapshotError,undefined);
assert.deepEqual(t.donorDisposals,Object.entries(t.restored.eyes.donorResources).map(([name,uuid])=>({name,uuid})));assert.equal(t.mapDisposedByDonor,0);assert.deepEqual(t.disposal,{disposed:true,leaked:[]});assert.deepEqual(r.cleanup,{page:'closed',browser:'closed'});
const output={pid:process.pid,started,finished:new Date().toISOString(),command:'node docs/evidence/nonhair-2026-10-03/iris-pigment/root-readback.mjs',sourceSHA256:hashFile(new URL(import.meta.url)),reportSHA256:hashFile(raw+'/report.json'),sourcePins:Object.keys(r.sources).length,inputPins:Object.keys(r.inputs).length,states:8,images:rows,status:'passed recorded state/pin/header/retirement readback; actual appearance reviewed separately, no shader/physical/motion/fault injection qualification'};
fs.writeFileSync(packet+'/ROOT-READBACK.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output));
