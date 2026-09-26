// CPU-only lossless packaging and descriptive8-bit image difference receipt. No image edits.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {decodePng} from '../../../../tools/critic/png.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(HERE,'../../../..'),raw=path.join(ROOT,'captures/skin-micro-attribution-2026-09-26/native-v2'),out=path.join(HERE,'native-v2');
const sha=b=>createHash('sha256').update(b).digest('hex'),hash=p=>sha(fs.readFileSync(p)),json=x=>JSON.stringify(x,null,2)+'\n';
assert.equal(fs.existsSync(out),false,'Fresh package only');
const reportFile=path.join(raw,'report.json'),report=JSON.parse(fs.readFileSync(reportFile)),manifestFile=path.join(raw,'manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestFile)),seal=JSON.parse(fs.readFileSync(path.join(raw,'seal.json')));
assert.equal(hash(reportFile),seal.reportSHA256);assert.equal(hash(manifestFile),seal.manifestSHA256);assert.equal(report.manifestSHA256,seal.manifestSHA256);assert.deepEqual(report.sourceHashes,manifest.sources);assert.equal(report.completed,true);assert.equal(report.sourcesStable,true);assert.equal(report.cases.length,3);assert.deepEqual(report.errors,[]);
const archivedSources=Object.entries(manifest.sources).filter(([p])=>!p.startsWith('assets/'));
for(const[p,h]of archivedSources)assert.equal(hash(path.join(raw,'source',p)),h,'Frozen source '+p);
const served=new Map();for(const r of report.responses){assert.equal(r.status,200);assert.equal(hash(path.join(raw,'served',r.sha256)),r.sha256);if(r.asset)assert.equal(r.sha256,manifest.sources[r.asset]);served.set(r.sha256,r.bytes);}
const images=[];const states=new Set();
for(const c of report.cases){assert.equal(c.completed,true);assert.equal(c.exportStateExact,true);assert.equal(c.settled.clock.draws,64);assert.equal(c.exported.clock.draws,65);assert.equal(c.exported.clock.clock,0);assert.equal(c.retirement.disposed,true);assert.deepEqual(c.retirement.leaks,[]);assert.ok(Object.values(c.retirement.memory).every(v=>v===0));assert.deepEqual(c.gpu.errors,[]);assert.deepEqual(c.gpu.losses,[]);
 assert.equal(hash(path.join(raw,c.image.file)),c.image.sha256);assert.equal(hash(path.join(raw,c.stateArtifact.file)),c.stateArtifact.sha256);assert.equal(sha(gunzipSync(fs.readFileSync(path.join(raw,c.stateArtifact.file)))),c.stateArtifact.decodedSHA256);states.add(c.stateArtifact.file);
 const png=decodePng(fs.readFileSync(path.join(raw,c.image.file)));assert.equal(png.bitDepth,8);assert.deepEqual([png.width,png.height],[657,868]);images.push(png);
}
assert.equal(states.size,1);assert.equal(report.cases[0].image.sha256,report.cases[2].image.sha256);assert.equal(report.cases[2].defaultReturnPNGExact,true);
function diff(a,b,rect){const [x,y,w,h]=rect;let changed=0,totalAbs=0,square=0,max=0,alphaChanged=0;const channelSigned=[0,0,0],channelAbs=[0,0,0];
 for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){const offset=(yy*a.width+xx)*4;let any=false;for(let k=0;k<3;k++){const d=Math.round(b.pixels[offset+k]*255)-Math.round(a.pixels[offset+k]*255);if(d)any=true;totalAbs+=Math.abs(d);square+=d*d;max=Math.max(max,Math.abs(d));channelSigned[k]+=d;channelAbs[k]+=Math.abs(d);}if(any)changed++;if(a.pixels[offset+3]!==b.pixels[offset+3])alphaChanged++;}
 return {rect,areaPixels:w*h,changedRGBPixels:changed,changedRGBFraction:changed/(w*h),meanAbsoluteRGBCodeDifference:totalAbs/(w*h*3),rmsRGBCodeDifference:Math.sqrt(square/(w*h*3)),maxAbsoluteRGBCodeDifference:max,meanSignedBminusARGB:channelSigned.map(v=>v/(w*h)),meanAbsoluteByChannelRGB:channelAbs.map(v=>v/(w*h)),alphaChangedPixels:alphaChanged};
}
const regions={whole:[0,0,657,868],leftVisibleLeg:[246,565,57,172],rightVisibleLeg:[329,563,62,176],leftInnerShin:[266,661,22,55],rightInnerShin:[348,663,23,55],leftKnee:[260,598,24,27],rightKnee:[345,598,26,27],jawEdge:[287,134,47,18]};
const numerical={definition:'Descriptive differences of8-bit sRGB-encoded PNG codes, BminusA. Named rectangles are declared display-space review windows including boundaries/background where present, not anatomical or material masks, and not acceptance thresholds.',regions,defaultVersusMicroOff:Object.fromEntries(Object.entries(regions).map(([name,rect])=>[name,diff(images[0],images[1],rect)])),defaultReturn:diff(images[0],images[2],regions.whole)};
assert.equal(numerical.defaultReturn.changedRGBPixels,0);
fs.mkdirSync(out,{recursive:true});const copies=[];
function copy(relative){const from=path.join(raw,relative),to=path.join(out,relative);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);assert.equal(hash(to),hash(from));copies.push({file:relative,bytes:fs.statSync(to).size,sha256:hash(to)});}
for(const file of ['report.json','manifest.json','seal.json',...report.cases.map(c=>c.image.file),...states])copy(file);
const essential=['docs/evidence/nonhair-2026-09-26/skin-attribution/capture-micro.mjs','docs/evidence/nonhair-2026-09-26/skin-attribution/micro-capture-runtime.mjs','docs/evidence/nonhair-2026-09-26/skin-attribution/micro-capture-runtime.selftest.mjs','docs/evidence/nonhair-2026-09-26/skin-attribution/rejected-native-v1/exposure-owner-fixture.json'];
for(const file of essential)copy('source/'+file);
fs.writeFileSync(path.join(out,'image-differences.json'),json(numerical),{flag:'wx'});
const receipt={version:1,kind:'lossless-skin-attribution-native-v2-package',rawDirectory:raw,reportSHA256:seal.reportSHA256,manifestSHA256:seal.manifestSHA256,completedArms:3,exactDefaultReturn:true,exactNativeStateAcrossArms:report.cases[0].stateArtifact,sourceVerification:{manifestEntries:Object.keys(manifest.sources).length,retainedNonAssetSourcesVerified:archivedSources.length,actualResponseRecords:report.responses.length,uniqueServedBodiesVerified:served.size,completeSourceArchive:'Retained at rawDirectory/source; only essential experimental sources copied here. No source/served/archive files removed.'},copies,imageDifferencesSHA256:hash(path.join(out,'image-differences.json')),packagingSourceSHA256:hash(fileURLToPath(import.meta.url)),pngDecoderSHA256:hash(path.join(ROOT,'tools/critic/png.mjs')),warnings:report.warnings,errors:report.errors,rejectedFirstRun:{path:'../rejected-native-v1/receipt.json',sha256:hash(path.join(HERE,'rejected-native-v1/receipt.json'))},scope:'One fixed native Kitchen body-view attribution with shared diagnostic clock/history. Does not establish global skin quality, face calibration, another scene/resolution/motion or production cadence.'};
fs.writeFileSync(path.join(out,'receipt.json'),json(receipt),{flag:'wx'});console.log(json({out,receiptSHA256:hash(path.join(out,'receipt.json')),numerical,sourceVerification:receipt.sourceVerification}));
