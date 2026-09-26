// Archive-only CPU verification. No browser, native rerender or cross-runtime camera replay.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {gunzipSync} from 'node:zlib';
const dir=new URL('./native-pilot-v1/',import.meta.url),read=p=>fs.readFileSync(new URL(p,dir)),sha=b=>createHash('sha256').update(b).digest('hex'),decoded={};
const receipt=JSON.parse(read('receipt.json'));
for(const [name,item] of Object.entries(receipt.artifacts)){const bytes=read(item.file);assert.equal(sha(bytes),item.sha256,name);if(item.decodedSHA256){const raw=gunzipSync(bytes);assert.equal(sha(raw),item.decodedSHA256,name);decoded[name]=JSON.parse(raw);}}
const r=decoded['report.json'],m=decoded['manifest.json'],p=decoded['pilot.json'],seal=decoded['seal.json'],sources=decoded['sources.json'],summary=JSON.parse(read('summary.json'));
assert.equal(seal.reportSHA256,receipt.artifacts['report.json'].decodedSHA256);assert.equal(seal.manifestSHA256,receipt.artifacts['manifest.json'].decodedSHA256);
assert.equal(r.completed,true);assert.equal(r.measurementCompleted,true);assert.equal(r.sourcesStable,true);assert.deepEqual(r.errors,[]);assert.deepEqual(r.environmentBefore,r.environmentAfter);
for(const [file,source] of Object.entries(sources)){assert.equal(sha(Buffer.from(source.text)),source.sha256,file);assert.equal(source.sha256,m.sources[file],file);}
const prefix='docs/evidence/nonhair-2026-09-26/review-performance/';
// These two archived pure modules have no imports. Execute their exact retained bytes,
// so a later local implementation cannot silently change verification arithmetic.
async function archived(file){const s=sources[prefix+file];assert.ok(s);assert.equal(/^\s*import\s/m.test(s.text),false);return import('data:text/javascript;base64,'+Buffer.from(s.text).toString('base64'));}
const {accountUpdate}=await archived('timestamp-accounting.mjs'),{warmupStability,assertSampleCensus,summarizeSamples,passSignature}=await archived('pilot-policy.mjs');
assert.equal(p.traceRecords.length,8);assert.equal(p.records.length,412);assert.equal(p.warmup,180);assert.equal(p.samples,240);assert.deepEqual(p.environmentEvents,[]);
let state=r.ready.orbit,clock=0,frame=1;
for(const [i,row] of p.traceRecords.entries()){assert.equal(row.step,i+1);assert.deepEqual(row.before,state);assert.deepEqual(row.after,row.expected.state);assert.equal(row.exactOrbitReplay,true);assert.equal(row.clockBefore,clock);assert.equal(row.frameBefore,frame);clock+=1/60;frame++;assert.equal(row.clockAfter,clock);assert.equal(row.frameAfter,frame);state=row.after;}
const seen=new Set();let passes=0;
for(const [i,row] of p.records.entries()){
 assert.equal(row.id,i+1);assert.equal(row.step,i+9);assert.deepEqual(row.orbitBefore,state);assert.deepEqual(row.orbitAfter,row.orbitExpected.state);assert.equal(row.exactOrbitReplay,true);state=row.orbitAfter;
 assert.equal(row.clockBefore,clock);assert.equal(row.stackFrameBefore,frame);clock+=1/60;frame++;assert.equal(row.clockAfter,clock);assert.equal(row.stackFrameAfter,frame);
 const accounting=accountUpdate(row,row.resolutions,seen);assert.deepEqual(accounting,row.accounting);passes+=row.queries.length;
 assert.deepEqual(row.stability.snapshot.passes,passSignature(row));assert.deepEqual(row.accounting.passes,{render:18,compute:2});
 if(row.phase==='sample'){assertSampleCensus(row.stability.snapshot,p.admittedSnapshot);assert.equal(row.stableSample,true);}else assert.equal(row.phase,'warmup');
}
assert.equal(passes,8240);assert.equal(seen.size,8240);assert.equal(frame,421);
const stability=warmupStability(p.records.filter(x=>x.phase==='warmup').map(x=>x.stability));assert.deepEqual(stability,p.stabilityChecks[0]);assert.equal(stability.stable,true);
const samples=p.records.filter(x=>x.phase==='sample');assert.deepEqual(summarizeSamples(samples),p.summary);assert.deepEqual(p.summary,r.pilotSummary);assert.deepEqual(summary.timings,r.pilotSummary);
for(const [i,row] of samples.entries())assert.deepEqual(summary.samples[i],{sample:i+1,step:row.step,simulationTime:row.clockAfter,cpuMs:row.cpuMs,pageStepMs:row.stepWallMs,queueWaitMs:row.queueWaitMs,...row.accounting.durationMs});
assert.equal(r.warnings.length,6);assert.deepEqual(r.warnings.map(x=>x.phase),['original-page-startup','original-page-startup','original-page-startup','original-page-startup','unmeasured-traced-warmup-step-1','unmeasured-traced-warmup-step-1']);assert.equal(r.warningBoundary.unchanged,true);
assert.equal(r.retirement.completed,true);assert.equal(r.retirement.failure,null);assert.deepEqual(r.retirement.cleanupErrors,[]);assert.deepEqual(r.retirement.cleanupDrains,[]);assert.deepEqual(r.retirement.cleanup.leaks,[]);assert.equal(Object.values(r.retirement.cleanup.memory).every(x=>x===0),true);assert.equal(r.retirement.cleanup.pools.every(x=>x.disposed===true),true);
for(const response of r.responses.filter(x=>x.asset))assert.equal(response.sha256,m.sources[response.asset],response.asset);
assert.equal(r.endPNG.sha256,receipt.artifacts['end.png'].sha256);
const html=read('review.html').toString();for(const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)){const target=new URL(match[1],dir);assert.equal(target.protocol,'file:');assert.equal(fs.existsSync(target),true,'Missing static artifact link '+match[1]);}
console.log(JSON.stringify({verified:true,receiptSHA256:sha(read('receipt.json')),sourceCount:Object.keys(m.sources).length,selectedArchivedSources:Object.keys(sources).length,exactRecordedInBrowserCameraSteps:420,accountedUpdates:412,freshPassQueries:8240,samples:240,stableWarmup:180,scope:'Exact archive verification and retained arithmetic. No new GPU/native run or cross-runtime camera oracle.'},null,2));
