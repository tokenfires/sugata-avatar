// Full candidate/body clearance at four declared actual captured ordinary-motion states.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {ROOT,hashFile,sha256} from '../figure-pipeline/collar_replacement_manifest.mjs';
import {readGlb,readPrimitive} from '../lut-bake/glb.mjs';
import {compare,topology,selftest} from '../figure-pipeline/collar_clearance_review.mjs';
assert.equal(process.argv.length,3,'Pass the completed capture report SHA256');
const base='captures/foundation-domain-motion-2026-09-30-v1',reportFile=path.join(ROOT,base,'report.json');
assert.equal(hashFile(reportFile),process.argv[2]);const capture=JSON.parse(fs.readFileSync(reportFile));
assert.equal(capture.status,'captured-awaiting-fit-and-visual-review');assert.equal(capture.runs.length,6);assert.ok(capture.runs.every(r=>r.completed));
assert.equal(capture.arms.band.sha256,'3793206f8f7a95a632705b02756bff9c35c5a934f266dc6bd790d076278671cd');
const out=path.join(ROOT,'captures/foundation-domain-motion-clearance-2026-09-30-v1');assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const sources=['tools/critic/foundation-domain-motion-clearance.mjs','tools/critic/foundation-domain-motion.mjs',
  'tools/figure-pipeline/collar_clearance_review.mjs','tools/figure-pipeline/hair_geometry.mjs','tools/figure-pipeline/hair_surface.mjs',
  'tools/figure-pipeline/collar_replacement_manifest.mjs','tools/lut-bake/glb.mjs',
  'docs/evidence/wardrobe-2026-09-30/foundation-domain-motion/PLAN.md',
  'assets/wardrobe/body/g050.glb',`${base}/report.json`,`${base}/band.glb`,
  ...capture.runs.flatMap(r=>r.geometry.map(g=>`${base}/${g.file}`))];
const pins=Object.fromEntries(sources.map(p=>[p,hashFile(path.join(ROOT,p))]));
for(const p of sources){const dest=path.join(out,'source',p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(ROOT,p),dest);}
assert.equal(pins['assets/wardrobe/body/g050.glb'],'fc4445c95ed3f423734ff272ee78ebb44d762a8f16edb94b26039de7a8a96b3a');assert.equal(pins[`${base}/band.glb`],capture.arms.band.sha256);
const report={started:new Date().toISOString(),pid:process.pid,status:'running',pins,states:[],errors:[],
  scope:'Complete CPU-skinned candidate and full captured body at steps0/240/480/720. No GPU vertex readback, intermediate-time, other gestures, moving ray-coverage or self-intersection certificate.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const point=(p,i)=>Array.from(p.slice(i*3,i*3+3));
function load(rec){const bytes=fs.readFileSync(path.join(ROOT,base,rec.file));assert.equal(sha256(bytes),rec.sha256);const raw=gunzipSync(bytes);assert.equal(sha256(raw),rec.decodedSHA256);return JSON.parse(raw);}
function mesh(snapshot,id){const m=snapshot.meshes.find(m=>m.id===id);assert.ok(m);return{positions:Float32Array.from(m.positions),indices:Uint32Array.from(m.fullIndices)};}
try{
  save();report.helperControls=selftest();assert.equal(report.helperControls.pass,true);
  const sourceBody=readPrimitive(readGlb(path.join(ROOT,'assets/wardrobe/body/g050.glb')),'base.001');
  const bg=readGlb(path.join(ROOT,base,'band.glb')),sourceBand=readPrimitive(bg,bg.json.meshes[0].name);
  const runs=capture.runs.filter(r=>r.arm==='band');assert.equal(runs.length,3);
  for(const step of [0,240,480,720]){
    const snapshots=runs.map(r=>{const g=r.geometry.find(g=>g.step===step);assert.ok(g);return{outfit:r.outfit,file:g.file,snapshot:load(g)};});
    const first=snapshots.find(s=>s.outfit==='foundation');assert.ok(first);
    const band=mesh(first.snapshot,'foundation_bra'),body=mesh(first.snapshot,'body');
    assert.deepEqual(band.indices,sourceBand.indices);assert.deepEqual(body.indices,sourceBody.indices);
    assert.equal(band.positions.length,sourceBand.positions.length);assert.equal(body.positions.length,sourceBody.positions.length);
    for(const s of snapshots){assert.deepEqual(s.snapshot.rig,first.snapshot.rig);assert.equal(s.snapshot.time,first.snapshot.time);assert.deepEqual(mesh(s.snapshot,'foundation_bra'),band);assert.deepEqual(mesh(s.snapshot,'body'),body);}
    const row={step,time:first.snapshot.time,sharedExactGeometry:snapshots.map(s=>({outfit:s.outfit,file:s.file})),rows:[],
      bodyTopology:topology(body,sourceBody.positions),bandTopology:topology(band,sourceBand.positions)};
    report.states.push(row);save();
    assert.equal(row.bodyTopology.boundaryEdges,0);assert.equal(row.bodyTopology.orientationErrors,0);assert.equal(row.bodyTopology.nonmanifoldEdges,0);assert.equal(row.bodyTopology.components,1);assert.equal(row.bodyTopology.maxWeldSeparation,0,'Source-welded body seams separated in the captured pose');
    const faces=Array.from({length:band.indices.length/3},(_,id)=>{const indices=Array.from(band.indices.slice(id*3,id*3+3)),vertices=indices.map(i=>point(band.positions,i));return{id,indices,vertices,min:[0,1,2].map(k=>Math.min(...vertices.map(v=>v[k]))),max:[0,1,2].map(k=>Math.max(...vertices.map(v=>v[k])))};});
    assert.equal(faces.length,15401);row.expectedTriangles=faces.length;
    for(let offset=0;offset<faces.length;offset+=256){row.rows.push(...compare(faces.slice(offset,offset+256),body,{gridSteps:1,globalInside:true}).rows);save();console.log(`step${step}: ${row.rows.length}/${faces.length}`);}
    row.summary={triangles:row.rows.length,crossingTriangles:row.rows.filter(r=>r.minimum.distance===0).length,
      minimum:row.rows.reduce((a,r)=>!a||r.minimum.distance<a.minimum.distance?r:a,null),windingInside:row.rows.filter(r=>Math.abs(r.winding)>.5).length,
      parityInside:row.rows.filter(r=>r.parity.some(p=>p.inside===true)).length,parityAmbiguous:row.rows.filter(r=>r.parity.some(p=>p.ambiguous)).length,
      negativeVertexSamplesIncludingDuplicates:row.rows.reduce((s,r)=>s+r.negativeSamples,0)};
    row.strictExterior=row.rows.every(r=>r.minimum.distance>0&&Math.abs(r.winding)<.5&&r.parity.every(p=>!p.ambiguous&&p.inside===false));save();
  }
  report.allFourStatesExterior=report.states.length===4&&report.states.every(s=>s.strictExterior);report.status='audited';
  for(const[p,h]of Object.entries(pins))assert.equal(hashFile(path.join(ROOT,p)),h,p);
}catch(error){report.status='failed';report.errors.push({message:error.message,stack:error.stack});process.exitCode=1;}
finally{report.finished=new Date().toISOString();save();console.log(JSON.stringify({status:report.status,pid:process.pid,allFourStatesExterior:report.allFourStatesExterior,states:report.states.map(s=>({step:s.step,rows:s.rows.length,strictExterior:s.strictExterior}))}));}
