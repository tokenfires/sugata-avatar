// Full triangle/body rest audit using the unchanged clearance predicates.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { ROOT, hashFile } from '../figure-pipeline/collar_replacement_manifest.mjs';
import { readGlb, readPrimitive, readAccessor } from '../lut-bake/glb.mjs';
import { compare, topology, selftest } from '../figure-pipeline/collar_clearance_review.mjs';
const base='captures/foundation-native-band-2026-09-30-v1';
const out=path.join(ROOT,'captures/foundation-native-band-clearance-2026-09-30-v1');
assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const sources=['tools/critic/foundation-native-band-clearance.mjs','tools/figure-pipeline/collar_clearance_review.mjs',
  'tools/figure-pipeline/hair_geometry.mjs','tools/figure-pipeline/hair_surface.mjs',
  'tools/figure-pipeline/collar_replacement_manifest.mjs','tools/lut-bake/glb.mjs',
  'docs/evidence/wardrobe-2026-09-30/foundation-native-band/CLEARANCE-PLAN.md',
  'assets/wardrobe/body/g050.glb',`${base}/band.glb`,`${base}/report.json`];
const pins=Object.fromEntries(sources.map(p=>[p,hashFile(path.join(ROOT,p))]));
for(const p of sources){const dest=path.join(out,'source',p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(ROOT,p),dest);}
assert.equal(pins[`${base}/band.glb`],'c82805f09177627376a9b6ec821c754c020ef1b2cc7a074e6960523e8f5641bd');
assert.equal(pins['assets/wardrobe/body/g050.glb'],'fc4445c95ed3f423734ff272ee78ebb44d762a8f16edb94b26039de7a8a96b3a');
const report={started:new Date().toISOString(),pid:process.pid,status:'running',pins,rows:[],errors:[],
  scope:'Complete candidate triangles against full accepted body in source rest pose. No motion, visible-contact or self-intersection certificate.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const point=(p,i)=>Array.from(p.slice(i*3,i*3+3));
try{
  save();report.helperControls=selftest();
  const bg=readGlb(path.join(ROOT,'assets/wardrobe/body/g050.glb')),body=readPrimitive(bg,'base.001');
  const g=readGlb(path.join(ROOT,base,'band.glb')),band=readPrimitive(g,g.json.meshes[0].name);
  report.bodyTopology=topology(body);assert.equal(report.bodyTopology.boundaryEdges,0);assert.equal(report.bodyTopology.orientationErrors,0);assert.equal(report.bodyTopology.nonmanifoldEdges,0);assert.equal(report.bodyTopology.components,1);
  const mask=readAccessor(bg,bg.json.meshes.find(m=>m.name==='base.001').primitives[0].attributes._HIDE_FEMALE_CASUALSUIT01).data;
  const faces=Array.from({length:band.indices.length/3},(_,id)=>{const indices=Array.from(band.indices.slice(id*3,id*3+3)),vertices=indices.map(i=>point(band.positions,i));return{id,indices,vertices,min:[0,1,2].map(k=>Math.min(...vertices.map(v=>v[k]))),max:[0,1,2].map(k=>Math.max(...vertices.map(v=>v[k])))};});
  report.expectedTriangles=faces.length;
  for(let offset=0;offset<faces.length;offset+=256){
    const result=compare(faces.slice(offset,offset+256),body,{gridSteps:1,globalInside:true});
    for(const row of result.rows){const target=row.minimum.targetTriangle,ids=Array.from(body.indices.slice(target*3,target*3+3));row.nearestBodyTriangleMaskedInCasual=ids.some(i=>mask[i]>.5);}
    report.rows.push(...result.rows);save();console.log(`Audited ${report.rows.length}/${faces.length} band triangles`);
  }
  report.summary={triangles:report.rows.length,crossingTriangles:report.rows.filter(r=>r.minimum.distance===0).length,
    minimum:report.rows.reduce((a,r)=>!a||r.minimum.distance<a.minimum.distance?r:a,null),
    windingInside:report.rows.filter(r=>Math.abs(r.winding)>.5).length,
    parityInside:report.rows.filter(r=>r.parity.some(p=>p.inside===true)).length,
    parityAmbiguous:report.rows.filter(r=>r.parity.some(p=>p.ambiguous)).length,
    negativeVertexSamplesIncludingDuplicates:report.rows.reduce((s,r)=>s+r.negativeSamples,0)};
  report.strictRestExterior=report.rows.every(r=>r.minimum.distance>0&&Math.abs(r.winding)<.5&&r.parity.every(p=>!p.ambiguous&&p.inside===false));
  report.status='audited';
  for(const[p,h]of Object.entries(pins))assert.equal(hashFile(path.join(ROOT,p)),h,p);
}catch(error){report.status='failed';report.errors.push({message:error.message,stack:error.stack});process.exitCode=1;}
finally{report.finished=new Date().toISOString();save();console.log(JSON.stringify({status:report.status,pid:process.pid,strictRestExterior:report.strictRestExterior,rows:report.rows.length}));}
