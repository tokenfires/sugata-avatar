// Read-only CPU review of the retained pair; no renderer imports or native rerun.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {decodePng} from '../../../../tools/critic/png.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const dir=path.join(ROOT,'captures/render-boundary-2026-09-26/native-v4');
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=f=>fs.readFileSync(path.join(dir,f));
const rbytes=read('report.json'),r=JSON.parse(rbytes),mbytes=read('manifest.json'),m=JSON.parse(mbytes);
assert.equal(hash(rbytes),'9e662e886717c15a93db7c703a79d3f98b4d7fde2898f664dbebd8b04f797f42');
assert.equal(hash(mbytes),r.manifestSHA256);assert.deepEqual(r.sourceHashes,m.sources);
assert.equal(r.completed,true);assert.equal(r.imageAdmission,false);assert.equal(r.causalAdmission,false);assert.equal(r.featureQualified,false);assert.deepEqual(r.errors,[]);
assert.deepEqual(r.cases.map(c=>c.label),['casual-front-base','casual-front-return']);
let archivedSources=0,currentSources=0;
for(const[f,h]of Object.entries(m.sources)){
 assert.equal(hash(fs.readFileSync(path.join(ROOT,f))),h,'Current source '+f);currentSources++;
 if(!f.startsWith('assets/')){assert.equal(hash(read('source/'+f)),h,'Archived source '+f);archivedSources++;}
}
for(const x of r.responses){assert.equal(x.status,200);const b=read('served/'+x.sha256);assert.equal(hash(b),x.sha256);assert.equal(b.length,x.bytes);if(x.asset)assert.equal(x.sha256,m.sources[x.asset]);}
const bpt={rgba16float:8,rg16float:4,rgba8unorm:4};
function unpack(q){
 const zipped=read(q.artifact.file);assert.equal(hash(zipped),q.artifact.sha256);const raw=gunzipSync(zipped);assert.equal(hash(raw),q.rawSHA256);
 const row=q.width*bpt[q.format],stride=Math.ceil(row/256)*256;assert.ok(bpt[q.format]);
 assert.equal(raw.length,(q.height-1)*stride+row);assert.equal(q.layout.rowStride,stride);assert.equal(q.layout.rowBytes,row);
 const logical=Buffer.alloc(row*q.height);for(let y=0;y<q.height;y++)raw.copy(logical,y*row,y*stride,y*stride+row);
 assert.equal(hash(logical),q.pixelsSHA256);return {raw,logical};
}
function compare(a,b,width,bytesPerPixel){
 assert.equal(a.length,b.length);let changedBytes=0,changedTexels=0,minX=Infinity,minY=Infinity,maxX=-1,maxY=-1,maxByteDifference=0;
 for(let i=0;i<a.length;i+=bytesPerPixel){let changed=false;for(let k=0;k<bytesPerPixel;k++)if(a[i+k]!==b[i+k]){changedBytes++;changed=true;maxByteDifference=Math.max(maxByteDifference,Math.abs(a[i+k]-b[i+k]));}
  if(changed){changedTexels++;const n=i/bytesPerPixel,x=n%width,y=Math.floor(n/width);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}}
 return {changedBytes,changedTexels,bounds:changedTexels?{minX,minY,maxX,maxY}:null,maxByteDifference};
}
const loaded=[];
for(const c of r.cases){
 assert.equal(c.completed,true);assert.equal(c.exportStateExact,true);assert.equal(c.boundaries.allCountersAndTargetOwnersUnchanged,true);assert.deepEqual(c.boundaries.before,c.boundaries.after);
 assert.equal(c.boundaryArtifacts.length,10);assert.deepEqual(c.boundaries.records,c.boundaryArtifacts.map(({artifact,...q})=>q));
 assert.equal(c.retirement.instrumentError,null);assert.equal(c.retirement.disposed,true);assert.deepEqual(c.retirement.leaks,[]);assert.ok(Object.values(c.retirement.memory).every(x=>x===0));
 assert.equal(c.retirement.instrument.drawRestored,true);assert.equal(c.retirement.instrument.uniformRestored,true);assert.equal(c.retirement.instrument.draws,65);assert.deepEqual(c.retirement.gpu.errors,[]);assert.deepEqual(c.gpu.errors,[]);
 const state=read(c.stateArtifact.file);assert.equal(hash(state),c.stateArtifact.sha256);assert.equal(hash(gunzipSync(state)),c.stateArtifact.decodedSHA256);
 assert.equal(hash(read(c.image.file)),c.image.sha256);const png=decodePng(read(c.image.file));assert.deepEqual([png.width,png.height,png.bitDepth,png.colorType],[657,868,8,6]);
 const pairs=c.boundaryArtifacts.map(unpack);assert.deepEqual(pairs[4].logical,pairs[5].logical,'Post-copy history equals current resolve within owner');
 loaded.push({pairs,png,state:gunzipSync(state)});
}
assert.deepEqual(loaded[0].state,loaded[1].state);
const comparison=r.cases[0].boundaryArtifacts.map((q,i)=>{
 const p=r.cases[1].boundaryArtifacts[i];const descriptor=({artifact,rawSHA256,pixelsSHA256,...x})=>x;assert.deepEqual(descriptor(q),descriptor(p));
 const actual=compare(loaded[0].pairs[i].logical,loaded[1].pairs[i].logical,q.width,bpt[q.format]),expected=r.boundaryComparison[i];
 assert.equal(expected.label,q.label);for(const k of ['changedBytes','changedTexels','bounds'])assert.deepEqual(actual[k],expected.comparison[k]);
 assert.equal(loaded[0].pairs[i].raw.equals(loaded[1].pairs[i].raw),expected.rawExact);return {label:q.label,...actual};
});
// The shared PNG decoder exposes normalized Float32 channels; recover exact 8-bit codes.
const pngCodes=loaded.map(x=>Uint8Array.from(x.png.pixels,v=>Math.round(v*255)));
const pngComparison=compare(pngCodes[0],pngCodes[1],657,4);
console.log(JSON.stringify({passed:true,reportSHA256:hash(rbytes),manifestSHA256:hash(mbytes),currentSources,archivedSources,responses:r.responses.length,readbacks:20,originalPNGs:2,retirements:2,warnings:r.warnings.length,comparison,pngComparison,limits:'Post-export finite boundary pair only; no prior history/depth, causal, repeatability or feature admission.'},null,2));
