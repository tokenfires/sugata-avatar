import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {ROOT,hashFile,sha256} from '../figure-pipeline/collar_replacement_manifest.mjs';
import {readGlb,readAccessor} from '../lut-bake/glb.mjs';
import {decodePng} from './png.mjs';
import {compare,selftest} from '../figure-pipeline/collar_clearance_review.mjs';
assert.equal(process.argv.length,3,'Supply completed attribution capture report SHA256');
const base='captures/foundation-elegant-attribution-2026-09-30-v1',input=path.join(ROOT,base),captureFile=path.join(input,'report.json');
assert.equal(hashFile(captureFile),process.argv[2]);const capture=JSON.parse(fs.readFileSync(captureFile));
assert.equal(capture.status,'captured-awaiting-attribution-review');assert.equal(capture.runs.length,4);assert.ok(capture.runs.every(r=>r.completed));
const out=path.join(ROOT,'captures/foundation-elegant-analysis-2026-09-30-v1');assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const sources=['tools/critic/foundation-elegant-analyze.mjs','tools/critic/png.mjs','tools/lut-bake/glb.mjs','tools/figure-pipeline/collar_clearance_review.mjs','tools/figure-pipeline/hair_geometry.mjs','tools/figure-pipeline/hair_surface.mjs','tools/figure-pipeline/collar_replacement_manifest.mjs','packages/core/src/wardrobe/Wardrobe.js',`${base}/report.json`,`${base}/band.glb`,`${base}/shipped.glb`,...capture.runs.flatMap(r=>[`${base}/${r.observation.file}`,`${base}/${r.image.file}`])];
const pins=Object.fromEntries(sources.map(p=>[p,hashFile(path.join(ROOT,p))]));for(const p of sources){const dest=path.join(out,'source',p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(ROOT,p),dest);}
const report={started:new Date().toISOString(),pid:process.pid,status:'running',pins,maskChecks:[],rows:[],geometry:[],errors:[],scope:'All declared pixels, source/runtime mask correspondence and foundation-first witness triangles against drawn outer blouse. No repair, closed-cloth containment, all-pixel, continuous-motion or coverage certificate.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const observations={},images={};
const rgb=(im,p)=>Array.from(im.pixels.slice((Math.floor(p.y)*im.width+Math.floor(p.x))*4,(Math.floor(p.y)*im.width+Math.floor(p.x))*4+3),v=>Math.round(v*255));
try{
  save();report.controls=selftest();assert.equal(report.controls.pass,true);
  for(const r of capture.runs){
    const bytes=fs.readFileSync(path.join(input,r.observation.file));assert.equal(sha256(bytes),r.observation.sha256);const raw=gunzipSync(bytes);assert.equal(sha256(raw),r.observation.decodedSHA256);observations[r.key]=JSON.parse(raw);
    const png=fs.readFileSync(path.join(input,r.image.file));assert.equal(sha256(png),r.image.sha256);images[r.key]=decodePng(png);assert.equal(images[r.key].width,800);assert.equal(images[r.key].height,1000);
  }
  for(const key of ['shipped-ordinary','band-ordinary']){
    const arm=key.split('-')[0],observed=observations[key],m=observed.snapshot.meshes.find(m=>m.id==='foundation_bra'),runtime=observed.observation.masks.find(m=>m.id==='foundation_bra');
    const glb=readGlb(path.join(input,arm+'.glb'));assert.equal(hashFile(path.join(input,arm+'.glb')),capture.arms[arm].sha256);
    assert.equal(glb.json.meshes.length,1);assert.equal(glb.json.meshes[0].primitives.length,1);const primitive=glb.json.meshes[0].primitives[0],full=Array.from(readAccessor(glb,primitive.indices).data);assert.deepEqual(full,m.fullIndices);
    const attributes=Object.fromEntries(Object.entries(primitive.attributes).filter(([n])=>n.toLowerCase().startsWith('_under_')).map(([n,i])=>[n.toLowerCase(),Array.from(readAccessor(glb,i).data)]));
    for(const a of runtime.attributes)assert.deepEqual(a.values,attributes[a.name]);
    const active=runtime.occludedBy.map(id=>'_under_'+id),drawn=[];for(const name of active)assert.ok(attributes[name]);
    for(let i=0;i<full.length;i+=3){const tri=full.slice(i,i+3);if(!tri.some(v=>active.some(n=>attributes[n][v]>.5)))drawn.push(...tri);}
    assert.deepEqual(drawn,m.drawnIndices,'Exact any-corner mask index');report.maskChecks.push({key,fullTriangles:full.length/3,drawnTriangles:drawn.length/3,active,sourceRuntimeAttributesExact:true,predictedDrawnIndicesExact:true});
    const unique=new Map();for(const ray of observed.observation.ordinary){const h=ray.hits[0];if(h?.id==='foundation_bra')unique.set(h.triangle,h);}
    const witnesses=[...unique.values()].sort((a,b)=>a.triangle-b.triangle).map(h=>{
      assert.ok(Number.isInteger(h.triangle));assert.deepEqual(h.indices,full.slice(h.triangle*3,h.triangle*3+3));
      const vertices=h.indices.map(i=>m.positions.slice(i*3,i*3+3));
      // Browser pick coordinates retain Float64 skin calculations; saved CPU snapshots are Float32.
      const maximumPickFloat32Difference=Math.max(...vertices.flatMap((p,i)=>p.map((x,k)=>Math.abs(x-h.posed[i][k]))));
      return{id:h.triangle,indices:h.indices,vertices,min:[0,1,2].map(k=>Math.min(...vertices.map(v=>v[k]))),max:[0,1,2].map(k=>Math.max(...vertices.map(v=>v[k]))),maximumPickFloat32Difference,maskValues:Object.fromEntries(active.map(n=>[n,h.indices.map(v=>attributes[n][v])]))};
    });
    const cloth=observed.snapshot.meshes.find(m=>m.id==='female_elegantsuit01');assert.ok(cloth);const target={positions:Float32Array.from(cloth.positions),indices:Uint32Array.from(cloth.drawnIndices)};
    report.geometry.push({key,witnesses,comparison:witnesses.length?compare(witnesses,target,{gridSteps:1,globalInside:false}):null});save();
  }
  const ordinary=observations['band-ordinary'].observation.ordinary;
  for(let i=0;i<ordinary.length;i++){
    const pixel=ordinary[i].pixel,row={pixel,arms:{}};
    for(const r of capture.runs){const o=observations[r.key].observation;assert.deepEqual(o.ordinary[i].pixel,pixel);assert.deepEqual(o.doubleSided[i].pixel,pixel);row.arms[r.key]={rgb:rgb(images[r.key],pixel),hits:o.ordinary[i].hits,doubleSidedHits:o.doubleSided[i].hits};}
    const a=row.arms['band-ordinary'];row.tagDelta=row.arms['band-magenta'].rgb.map((v,k)=>v-a.rgb[k]);row.repeatDelta=row.arms['band-repeat'].rgb.map((v,k)=>v-a.rgb[k]);
    const foundation=a.hits.find(h=>h.id==='foundation_bra'),cloth=a.hits.find(h=>h.id==='female_elegantsuit01');row.nearestClothMinusFoundationDistance=foundation&&cloth?cloth.distance-foundation.distance:null;report.rows.push(row);
  }
  report.sampleCount=report.rows.length;assert.equal(report.sampleCount,200);report.groups={};
  for(const row of report.rows){const id=row.pixel.label+':'+(row.arms['band-ordinary'].hits[0]?.id??'miss');const g=report.groups[id]??={count:0,triangles:new Set()};g.count++;if(row.arms['band-ordinary'].hits[0])g.triangles.add(row.arms['band-ordinary'].hits[0].triangle);}
  for(const g of Object.values(report.groups))g.triangles=[...g.triangles].sort((a,b)=>a-b);
  const a=images['band-ordinary'],b=images['band-repeat'];let changedPixels=0,maximumChannelCodes=0;
  for(let i=0;i<a.pixels.length;i+=4){let d=0;for(let k=0;k<4;k++)d=Math.max(d,Math.abs(Math.round(a.pixels[i+k]*255)-Math.round(b.pixels[i+k]*255)));if(d)changedPixels++;maximumChannelCodes=Math.max(d,maximumChannelCodes);}
  report.repeat={changedPixels,totalPixels:a.width*a.height,maximumChannelCodes,exact:changedPixels===0};
  for(const[p,h]of Object.entries(pins))assert.equal(hashFile(path.join(ROOT,p)),h,p);report.status='analyzed';
}catch(error){report.status='failed';report.errors.push(error.stack);process.exitCode=1;}
finally{report.finished=new Date().toISOString();save();console.log(JSON.stringify({status:report.status,pid:process.pid,masks:report.maskChecks,samples:report.sampleCount,repeat:report.repeat,groups:report.groups,errors:report.errors}));}
