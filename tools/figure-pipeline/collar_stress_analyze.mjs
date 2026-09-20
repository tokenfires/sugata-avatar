// Attribute the expressive-motion island using an exact-frame GPU colour control
// and unjittered CPU rays. This does not measure penetration depth or all pixels.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodePng} from '../critic/png.mjs';

const directory=path.resolve(process.argv[2]);
const output=path.resolve(process.argv[3]);
assert.equal(fs.existsSync(output),false,'Use a fresh output directory');
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=f=>fs.readFileSync(path.join(directory,f));
const report=JSON.parse(read('report.json'));
assert.equal(report.completed,true);
const motionDirectory=path.resolve(directory,'../gpu-v1');
const motionReport=fs.readFileSync(motionDirectory+'/report.json');
assert.equal(sha(motionReport),report.referenceReportSHA256);
const motionFrame=fs.readFileSync(motionDirectory+'/bob02-owned/frame-0099.png');
assert.equal(sha(motionFrame),report.runs[0].imageSHA256,'Ordinary control must reproduce the motion PNG byte-for-byte');
const images=new Map();
for(const run of report.runs){
 assert.deepEqual(run.errors,[]);assert.equal(run.failure,undefined);
 assert.deepEqual(run.state,report.runs[0].state);
 assert.ok(Object.values(run.disposal.memory).every(x=>x===0));assert.deepEqual(run.disposal.leaks,[]);
 const bytes=read(run.arm+'.png');assert.equal(sha(bytes),run.imageSHA256);
 const im=decodePng(bytes);assert.equal(im.width,754);assert.equal(im.height,918);images.set(run.arm,im);
}
assert.deepEqual([...images.keys()],['ordinary','bra-magenta','cloth-double']);
const rayBytes=read('rays.json');assert.equal(sha(rayBytes),report.runs[0].raysSHA256);
const rays=JSON.parse(rayBytes);
assert.equal(rays.current.length,598);assert.equal(rays.doubleSided.length,598);assert.equal(rays.fullBody.length,598);
const rgb=(name,p)=>{const im=images.get(name),i=(Math.floor(p.y)*im.width+Math.floor(p.x))*4;return Array.from(im.pixels.slice(i,i+3),v=>Math.round(v*255));};
const samples=[];
for(let i=0;i<rays.current.length;i++){
 const p=rays.current[i].pixel;assert.deepEqual(rays.doubleSided[i].pixel,p);assert.deepEqual(rays.fullBody[i].pixel,p);
 const tag=rgb('bra-magenta',p);
 // A declared tag-localization criterion, not a visual-quality acceptance gate.
 if(tag[0]-tag[1]<=80||tag[2]-tag[1]<=80)continue;
 const first=rays.doubleSided[i].hits[0],cloth=rays.doubleSided[i].hits.find(h=>h.id==='female_casualsuit01');
 samples.push({pixel:p,ordinary:rgb('ordinary',p),tag,double:rgb('cloth-double',p),currentFirst:rays.current[i].hits[0],doubleFirst:first,fullBodyFirst:rays.fullBody[i].hits[0],firstCloth:cloth??null,braBeforeClothAlongRayMm:cloth?(cloth.distance-first.distance)*1000:null});
}
assert.ok(samples.length>0);
for(const s of samples){for(const k of ['currentFirst','doubleFirst','fullBodyFirst'])assert.equal(s[k].id,'foundation_bra');assert.deepEqual(s.ordinary,s.double);assert.ok(s.braBeforeClothAlongRayMm>0);}
const result={candidateSHA256:report.candidateSHA256,step:report.step,seconds:report.step/60,
 inputHashes:{report:sha(read('report.json')),motionReport:sha(motionReport),motionFrame:sha(motionFrame),rays:sha(rayBytes),...Object.fromEntries(report.runs.map(r=>[r.arm,r.imageSHA256]))},
 checks:{exactSavedStateReproduced:true,ordinaryPngExactlyMatchesMotionFrame:true,matchingStatesAcrossThreeControls:true,zeroErrorsAndRetirementResources:true,rays:598,taggedWitnesses:samples.length,allFirstHitsRetainedBra:true,allTaggedPixelsUnchangedByGlobalDoubleSide:true},
 selection:'Within x172..194/y550..575, pixel centres whose GPU tag RGB has R-G>80 and B-G>80. This is a localization set, not an image-quality threshold.',
 firstClothTriangles:[...new Set(samples.map(s=>s.firstCloth.triangle))].sort((a,b)=>a-b),
 alongRayBraBeforeClothMm:{minimum:Math.min(...samples.map(s=>s.braBeforeClothAlongRayMm)),maximum:Math.max(...samples.map(s=>s.braBeforeClothAlongRayMm)),meaning:'View-dependent depth order, not surface penetration depth.'},
 conclusion:'The visible island at the exact GPU motion frame is the retained bra in front of the cloth. Global two-sided cloth does not close it. This is distinct from the original culled-back-face openings.',
 limits:['CPU rays exclude GPU hair and the owned interior child; the double-sided pass includes both sides of every outer cloth triangle.','The bra colour tag is the direct GPU ownership control. Cloth-double removes the local child and changes the entire cloth side mode; it is an alternative rendering configuration.','The full-body ray pass restores complete body triangles for picking only. No mask or geometry is changed in the rendered controls.','Discrete pixel centres and one motion frame do not certify the rest of the animation or all cameras.'],samples};
fs.mkdirSync(output,{recursive:true});fs.copyFileSync(fileURLToPath(import.meta.url),output+'/collar_stress_analyze.mjs');
fs.writeFileSync(output+'/report.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,samples:undefined},null,2));
