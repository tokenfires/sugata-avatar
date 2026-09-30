// Reuse a prior body audit only after every physical sample replays exactly.
// This emits a provenance link, never a fresh numerical-checks result.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const arg=k=>process.argv.find(x=>x.startsWith(`--${k}=`))?.slice(k.length+3);
const prior=arg('prior'),replay=arg('replay'),output=arg('output');
assert.ok([prior,replay,output].every(p=>p?.startsWith('captures/')));
assert.ok(!fs.existsSync(output));
const read=p=>JSON.parse(fs.readFileSync(p)),sha=b=>createHash('sha256').update(b).digest('hex'),digest=p=>sha(fs.readFileSync(p));
const a=read(`${prior}/report.json`),b=read(`${replay}/report.json`),auditPath=`${prior}/numerical-checks.json`,audit=read(auditPath);
assert.equal(a.status,'captured');assert.equal(b.status,'captured');
assert.deepEqual(a.errors,[]);assert.deepEqual(b.errors,[]);
assert.equal(a.arm,'candidate');assert.equal(b.arm,'baseline');
assert.equal(a.routedAsset,b.routedAsset);
assert.equal(digest(a.routedAsset),a.candidateSha256);assert.equal(a.candidateSha256,b.baselineSha256);
for(const k of ['protocol','fps','geometryStride','totalFrames','view','colour','selectedCards'])assert.deepEqual(a[k],b[k],k);
assert.equal(a.geometryStride,1);assert.equal(a.samples.length,a.totalFrames+1);assert.equal(b.samples.length,a.samples.length);
assert.deepEqual(a.setup,b.setup,'All recorded setup and descriptor controls must replay exactly');
assert.equal(audit.status,'complete');assert.deepEqual(audit,read(`${prior}/audit-progress.json`));
assert.equal(audit.reportSha256,digest(`${prior}/report.json`));assert.equal(audit.sourceReport,`${prior}/report.json`);
assert.deepEqual(audit.selectedCards,a.setup.descriptor.selectedCards);assert.equal(audit.selectedTriangles,a.setup.descriptor.selectedIndices.length/3);
assert.equal(audit.rows.length,a.samples.length);assert.ok(audit.rows.every((r,i)=>r.frame===i));
const verifiedSources=[];
for(const [file,hash] of Object.entries(audit.sourceHashes)){
  const snapshot=`captures/side-motion-audit-source-v1/${file}`;
  assert.equal(digest(snapshot),hash);verifiedSources.push({file:snapshot,sha256:hash});
}
const commonSources=[];
const verifiedCaptureSnapshots=[];
for(const [dir,report] of [[prior,a],[replay,b]])for(const [file,hash] of Object.entries(report.sourceHashes)){
  if(file.startsWith('packages/')||file.startsWith('tools/')){
    const snapshot=`${dir}/source/${file}`;assert.equal(digest(snapshot),hash);
    verifiedCaptureSnapshots.push({file:snapshot,sha256:hash});
  }
}
for(const [file,hash] of Object.entries(a.sourceHashes))if(Object.hasOwn(b.sourceHashes,file)){
  assert.equal(b.sourceHashes[file],hash,file);commonSources.push({file,sha256:hash});
  if(file.startsWith('packages/')||file.startsWith('tools/'))for(const dir of [prior,replay])assert.equal(digest(`${dir}/source/${file}`),hash);
}
const sourceDifferences={priorOnly:Object.keys(a.sourceHashes).filter(k=>!Object.hasOwn(b.sourceHashes,k)),replayOnly:Object.keys(b.sourceHashes).filter(k=>!Object.hasOwn(a.sourceHashes,k))};
const frames=[];
for(let i=0;i<a.samples.length;i++){
  const samples=[a,b].map((report,arm)=>{
    const s=report.samples[i],file=`${arm?replay:prior}/${s.geometryFile}`,bytes=fs.readFileSync(file);
    assert.equal(sha(bytes),s.geometrySha256);const raw=JSON.parse(gunzipSync(bytes));
    assert.equal(s.frame,i);assert.equal(raw.frame,i);assert.deepEqual(raw.hashes,s.hashes);
    return raw;
  });
  assert.deepEqual(samples[0],samples[1],`Physical replay differs at frame ${i}; run a fresh audit`);
  assert.equal(audit.rows[i].time,samples[0].time);
  frames.push({frame:i,allPhysicalFieldsExact:true,priorGeometrySha256:a.samples[i].geometrySha256,replayGeometrySha256:b.samples[i].geometrySha256});
}
// Images are preserved, but image equality is deliberately not inferred from physics.
for(const [dir,report] of [[prior,a],[replay,b]])for(const image of report.images)assert.equal(digest(`${dir}/${image.file}`),image.sha256);
const record={status:'exact-physical-replay; prior-body-audit-reused',generated:new Date().toISOString(),pid:process.pid,
  prior:{directory:prior,reportSha256:digest(`${prior}/report.json`),auditFile:auditPath,auditSha256:digest(auditPath),sourceSnapshots:verifiedSources},
  replay:{directory:replay,reportSha256:digest(`${replay}/report.json`)},asset:a.routedAsset,assetSha256:a.candidateSha256,
  commonSources,sourceDifferences,verifiedCaptureSnapshots,setupExact:true,selectedCards:audit.selectedCards,selectedTriangles:audit.selectedTriangles,
  frameCount:frames.length,frames,reusedSummary:audit.summary,
  limits:['No new body oracle was run for the unchanged control. Exact inputs link each result to the prior completed audit.','This does not qualify modified candidate geometry or infer visual pixel equality.','The prior audit scope and exclusions apply unchanged.'],
  sourceSha256:digest('tools/critic/audit-motion-replay.mjs')};
record.sourceSnapshot=path.join(path.dirname(output),`audit-motion-replay-${record.sourceSha256}.mjs`);
if(fs.existsSync(record.sourceSnapshot))assert.equal(digest(record.sourceSnapshot),record.sourceSha256);
else fs.copyFileSync('tools/critic/audit-motion-replay.mjs',record.sourceSnapshot,fs.constants.COPYFILE_EXCL);
fs.writeFileSync(output,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({frameCount:record.frameCount,status:record.status,reusedSummary:record.reusedSummary}));
