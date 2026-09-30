// Diagnose whether the declared immutable annulus boundary already intersects the body volume.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {gunzipSync} from 'node:zlib';
import {ROOT,sha256,hashFile} from './collar_replacement_manifest.mjs';
import {rayParity,winding} from './collar_clearance_review.mjs';
const out=path.join(ROOT,'captures/neckline-boundary-check-2026-09-30-v1');assert.ok(!fs.existsSync(out));
const capturePath=path.join(ROOT,'captures/neckline-shape-2026-09-30-v2/report.json'),recipePath=path.join(ROOT,'captures/neckline-construction-2026-09-30-v1/report.json');
const capture=JSON.parse(fs.readFileSync(capturePath)),recipe=JSON.parse(fs.readFileSync(recipePath));assert.equal(capture.status,'captured');
const states=['accepted','candidate'].map(arm=>{const entry=capture.arms.find(a=>a.key===`${arm}-0`),raw=gunzipSync(fs.readFileSync(path.join(path.dirname(capturePath),`${arm}-0-state.json.gz`)));assert.equal(sha256(raw),entry.stateSHA256);return JSON.parse(raw).snapshot;});
const cloth=states.map(s=>s.meshes.find(m=>m.id==='female_casualsuit01')),body=states[1].meshes.find(m=>m.id==='body'),point=(a,i)=>a.slice(3*i,3*i+3);
const moved=new Set(recipe.changes.flatMap(c=>c.vertices)),fixed=[...new Set(recipe.affected.flatMap(f=>f.vertices))].filter(i=>!moved.has(i));
const tris=[];for(let t=0;t<body.fullIndices.length;t+=3)tris.push({vertices:body.fullIndices.slice(t,t+3).map(i=>point(body.positions,i))});
const directions=[[1,.371,.127],[-.217,1,.413],[.319,-.173,1],[1,-.731,.229],[-.617,.331,-1]];
const rows=fixed.map(i=>{const p=point(cloth[1].positions,i);assert.deepEqual(p,point(cloth[0].positions,i));const w=winding(p,tris),parity=directions.map(d=>rayParity(p,d,tris));return{vertex:i,world:p,winding:w,parity,allFiveInside:parity.every(r=>!r.ambiguous&&r.inside===true),incidentAffectedFaces:recipe.affected.filter(f=>f.vertices.includes(i)).map(f=>f.triangle)};});
fs.mkdirSync(out,{recursive:true});const source=['tools/figure-pipeline/neckline_boundary_check.mjs','tools/figure-pipeline/collar_clearance_review.mjs'];for(const f of source){const dest=path.join(out,'source',f);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(ROOT,f),dest);}
const report={finished:new Date().toISOString(),pid:process.pid,captureReportSHA256:hashFile(capturePath),constructionReportSHA256:hashFile(recipePath),sourceHashes:Object.fromEntries(source.map(f=>[f,hashFile(path.join(ROOT,f))])),directions,fixedRawVertices:fixed.length,insideVertices:rows.filter(r=>r.allFiveInside&&Math.abs(r.winding)>.5).map(r=>r.vertex),rows,limits:['One saved native pose and floating-point closed-body predicates','Fixed authored positions, skin weights and pose make these points immutable under this construction contract','Not a general garment infeasibility proof; another boundary or representation is a new contract']};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({...report,rows:undefined,sourceHashes:undefined},null,2));
