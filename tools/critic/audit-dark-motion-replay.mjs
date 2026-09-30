// Same physical sequence under declared camera/light/material changes. No fresh body oracle claim.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';
const arm=process.argv.find(a=>a.startsWith('--arm='))?.slice(6);assert.ok(['baseline','candidate'].includes(arm));
const root='captures/lower-fallback-dark-head-v1',prior=arm==='baseline'?'captures/side-head-v1/candidate-right-profile-brown':'captures/lower-fallback-head-v1/candidate-right-profile-brown',replay=`${root}/${arm}-rear-oblique-dark`,out=`${root}/${arm}-physical-replay.json`;
assert.ok(!fs.existsSync(out));const read=p=>JSON.parse(fs.readFileSync(p)),sha=b=>createHash('sha256').update(b).digest('hex'),digest=p=>sha(fs.readFileSync(p));
const a=read(`${prior}/report.json`),b=read(`${replay}/report.json`),audit=read(`${prior}/numerical-checks.json`);
for(const r of[a,b]){assert.equal(r.status,'captured');assert.deepEqual(r.errors,[]);assert.equal(r.samples.length,556);}
assert.equal(a.arm,'candidate');assert.equal(b.arm,arm);assert.equal(a.routedAsset,b.routedAsset);assert.equal(digest(a.routedAsset),a.candidateSha256);assert.equal(b.sourceHashes[b.routedAsset],a.candidateSha256);
for(const k of['protocol','fps','geometryStride','totalFrames','selectedCards'])assert.deepEqual(a[k],b[k],k);
assert.equal(a.view,'right-profile');assert.equal(b.view,'rear-oblique');assert.equal(a.colour,'brown');assert.equal(b.colour,'dark');
const intentional=new Set(['camera','lights','lightingChanges','material','configuration']);for(const k of Object.keys(a.setup))if(!intentional.has(k))assert.deepEqual(a.setup[k],b.setup[k],k);
assert.equal(a.setup.configuration.hairColour,'#765344');assert.equal(b.setup.configuration.hairColour,undefined);const configuration=r=>Object.fromEntries(Object.entries(r.setup.configuration).filter(([k])=>k!=='hairColour'));assert.deepEqual(configuration(a),configuration(b));
assert.deepEqual(b.setup.lightingChanges,[]);
const stripColour=lights=>lights.map(l=>Object.fromEntries(Object.entries(l).filter(([k])=>!['color','groundColor'].includes(k))));assert.deepEqual(stripColour(a.setup.lights),stripColour(b.setup.lights));
assert.equal(audit.status,'complete');assert.deepEqual(audit,read(`${prior}/audit-progress.json`));assert.equal(audit.sourceReport,`${prior}/report.json`);assert.equal(audit.reportSha256,digest(`${prior}/report.json`));assert.equal(audit.rows.length,556);assert.equal(audit.summary.totalTriangleBodyPairs,0);assert.equal(audit.rows.reduce((n,r)=>n+r.negativeVertices,0),0);assert.deepEqual(audit.selectedCards,b.selectedCards);
const auditRoot=arm==='baseline'?'captures/side-motion-audit-source-v1':'captures/lower-fallback-motion-audit-source-v1';const auditSources=[];
for(const [p,h]of Object.entries(audit.sourceHashes)){const file=`${auditRoot}/${p}`;assert.equal(digest(file),h);auditSources.push({file,sha256:h});}
const snapshots=[];for(const[dir,r]of[[prior,a],[replay,b]])for(const[p,h]of Object.entries(r.sourceHashes)){const file=p.startsWith('tools/')||p.startsWith('packages/')?`${dir}/source/${p}`:p;assert.equal(digest(file),h,p);snapshots.push({file,sha256:h});}
const common=[];for(const[p,h]of Object.entries(a.sourceHashes))if(Object.hasOwn(b.sourceHashes,p)){assert.equal(b.sourceHashes[p],h,p);common.push({file:p,sha256:h});}
const frames=[];for(let frame=0;frame<556;frame++){
 const raws=[a,b].map((r,i)=>{const s=r.samples[frame],bytes=fs.readFileSync(`${i?replay:prior}/${s.geometryFile}`);assert.equal(sha(bytes),s.geometrySha256);const raw=JSON.parse(gunzipSync(bytes));assert.equal(raw.frame,frame);assert.deepEqual(raw.hashes,s.hashes);return raw;});
 assert.deepEqual(raws[0],raws[1],`Physical replay changed at${frame}; no audit reuse`);assert.equal(audit.rows[frame].frame,frame);assert.equal(audit.rows[frame].time,raws[0].time);
 frames.push({frame,allPhysicalFieldsExact:true,priorGeometrySha256:a.samples[frame].geometrySha256,replayGeometrySha256:b.samples[frame].geometrySha256});
}
for(const[dir,r]of[[prior,a],[replay,b]])for(const im of r.images)assert.equal(digest(`${dir}/${im.file}`),im.sha256);
const source='tools/critic/audit-dark-motion-replay.mjs',sourceSha256=digest(source),snapshot=`${root}/audit-dark-motion-replay-${sourceSha256}.mjs`;
if(fs.existsSync(snapshot))assert.equal(digest(snapshot),sourceSha256);else fs.copyFileSync(source,snapshot,fs.constants.COPYFILE_EXCL);
const record={status:'exact full physical replay; prior body audit linked',generated:new Date().toISOString(),pid:process.pid,arm,asset:a.routedAsset,assetSha256:a.candidateSha256,
 prior:{directory:prior,reportSha256:digest(`${prior}/report.json`),auditFile:`${prior}/numerical-checks.json`,auditSha256:digest(`${prior}/numerical-checks.json`)},
 replay:{directory:replay,reportSha256:digest(`${replay}/report.json`)},declaredAppearanceChanges:{camera:[a.setup.camera,b.setup.camera],material:[a.setup.material,b.setup.material],lights:[a.setup.lights,b.setup.lights],lightingChanges:[a.setup.lightingChanges,b.setup.lightingChanges],configuration:[a.setup.configuration,b.setup.configuration]},
 commonSourceHashes:common,sourceDifferences:{priorOnly:Object.keys(a.sourceHashes).filter(k=>!Object.hasOwn(b.sourceHashes,k)),replayOnly:Object.keys(b.sourceHashes).filter(k=>!Object.hasOwn(a.sourceHashes,k))},snapshots,auditSources,frameCount:556,frames,reusedAuditSummary:audit.summary,sourceSha256,sourceSnapshot:snapshot,
 limits:['No fresh body oracle ran for this render-only condition; each full physical sample is exactly equal to a prior audited sample.','Camera, hair colour and light chromaticity intentionally differ; no pixel equality or appearance acceptance is inferred.','Prior338-card audit scope applies; no all-motion, garment, other-card or continuous-time guarantee.']};
fs.writeFileSync(out,JSON.stringify(record,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:record.status,arm,frameCount:556,reusedAuditSummary:record.reusedAuditSummary}));
