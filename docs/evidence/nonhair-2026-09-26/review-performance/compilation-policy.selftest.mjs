import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {assessCompilationWarmup,assessWarningBoundary,assessWarmWorkload} from './startup-policy.mjs';
const bytes=gunzipSync(fs.readFileSync(new URL('./native-warmup-v2/report.json.gz',import.meta.url)));
assert.equal(createHash('sha256').update(bytes).digest('hex'),'17ece5d26cb808b762472a2e5d6bb4e4978ff05166e0867d69963078c9ce9d3e');
const r=JSON.parse(bytes),manifest=JSON.parse(gunzipSync(fs.readFileSync(new URL('./native-warmup-v2/manifest.json.gz',import.meta.url))));
const d=r.warmupDiagnostic.startupEvidence,ready=structuredClone(r.ready);
// The old runtime did not return an intermediate observer.report(). Reconstruct only
// its source-stated startup slice from retained event contexts, explicitly a CPU fixture.
ready.startupDiagnostic={...structuredClone(d),restored:false,warnings:d.warnings.filter(w=>w.context.step===0),zeroIndexDraws:d.zeroIndexDraws.filter(w=>w.context.step===0)};
const x={pageName:'showcase',warnings:r.warnings,ready,warm:{step:8,startupEvidence:d,checkpoint:r.warmupDiagnostic.checkpoints[0]},sourceHashes:manifest.sources};
const before=JSON.stringify(x);assert.equal(assessCompilationWarmup(x).admitted,true);assert.equal(JSON.stringify(x),before);
const bad=(change,pattern)=>{const y=structuredClone(x);change(y);assert.throws(()=>assessCompilationWarmup(y),pattern);};
bad(y=>y.warnings.pop(),/exactly six/);bad(y=>y.warnings.push(y.warnings[5]),/exactly six/);
for(const i of [4,5]){bad(y=>y.warnings[i].phase='measured-samples',/compile-warm/);bad(y=>y.warnings[i].message+='forged',/Raw JS/);}
bad(y=>y.warm.startupEvidence.warnings[4].context.step=2,/phase or step/);
bad(y=>y.warm.startupEvidence.warnings[3].emissionStack='unobserved',/origin/);
bad(y=>y.warm.startupEvidence.warnings.pop(),/five raw/);
bad(y=>y.ready.startupDiagnostic.restored=true,/ownership/);
bad(y=>y.warm.startupEvidence.restored=false,/retire/);
bad(y=>y.warm.checkpoint.native.nodeCaptureStackTrace=true,/retire/);
bad(y=>y.warm.startupEvidence.zeroIndexDraws.at(-1).mesh='other',/Unattributed/);
bad(y=>y.warm.startupEvidence.zeroIndexDraws.at(-1).context.step=9,/outside tracing/);
assert.equal(assessWarmWorkload(r.ready,x.warm.checkpoint,{updates:8}).admitted,true);
assert.equal(assessWarningBoundary(r.warnings,structuredClone(r.warnings)).unchanged,true);
assert.throws(()=>assessWarningBoundary([...r.warnings,r.warnings[5]],r.warnings),/late warning/);
console.log(JSON.stringify({groups:4,retainedWarmupReportSHA256:'17ece5d26cb808b762472a2e5d6bb4e4978ff05166e0867d69963078c9ce9d3e',scope:'Exact retained warning/context pairing plus explicitly reconstructed intermediate startup fixture; no timing run.'}));
