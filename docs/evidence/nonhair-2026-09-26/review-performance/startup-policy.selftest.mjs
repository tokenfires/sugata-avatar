import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {STARTUP_FIXTURE as fixture} from './startup-workload-fixture.mjs';
import {assessStartup,assessWarningBoundary,assessWarmWorkload} from './startup-policy.mjs';
const bytes=gunzipSync(fs.readFileSync(new URL('./native-startup-v4/report.json.gz',import.meta.url)));
assert.equal(createHash('sha256').update(bytes).digest('hex'),fixture.reportSHA256);
const retained=JSON.parse(bytes),clone=structuredClone;
const input={pageName:'showcase',warnings:retained.warnings,ready:clone(retained.ready),sourceHashes:fixture.sourcePins};
// V4 captured the actual warnings/draws/census, but not these new live scalar fields.
// Supplemental fields are explicitly modeled CPU input; the successor native run must read them.
input.ready.native={figure:{missingHumanoidBones:['jaw','eyeLeft','eyeRight'],bonesByRigName:53},
    hairUniforms:{kinematic:0,ftlEnabled:1},substepSeconds:1/120,computeCallsLastFrame:1,nodeCaptureStackTrace:false};
const original=JSON.stringify(input);
assert.equal(assessStartup(input).admitted,true);assert.equal(JSON.stringify(input),original);
const rejects=(change,pattern)=>{const x=clone(input);change(x);assert.throws(()=>assessStartup(x),pattern);};
rejects(x=>x.pageName='portrait',/Only the diagnosed/);
for(const key of Object.keys(fixture.sourcePins))rejects(x=>x.sourceHashes[key]='0'.repeat(64),/Undiagnosed dependency/);
rejects(x=>x.ready.native.nodeCaptureStackTrace=true,/observation/);
rejects(x=>x.ready.startupDiagnostic.restored=false,/observation/);
rejects(x=>x.ready.native.figure.bonesByRigName=54,/Missing-bone/);
rejects(x=>x.ready.native.figure.missingHumanoidBones.pop(),/Missing-bone/);
rejects(x=>x.ready.native.hairUniforms.kinematic=1,/branch uniforms/);
rejects(x=>x.ready.native.hairUniforms.ftlEnabled=0,/branch uniforms/);
for(const i of [0,1,2,3]) {
    rejects(x=>x.warnings.splice(i,1),/exactly four/);
    rejects(x=>x.warnings[i].message+=' altered',/text\/order/);
    rejects(x=>x.warnings[i].phase='measured-updates',/outside original/);
}
rejects(x=>x.warnings.push(clone(x.warnings[0])),/exactly four/);
rejects(x=>x.warnings.reverse(),/text\/order/);
rejects(x=>x.ready.startupDiagnostic.warnings.pop(),/exactly three/);
rejects(x=>x.ready.startupDiagnostic.warnings[1].arguments[0]+='changed',/Raw JS\/browser/);
rejects(x=>x.ready.startupDiagnostic.warnings[0].emissionStack='unknown',/emission/);
rejects(x=>x.ready.startupDiagnostic.warnings[1].emissionStack='unknown',/emission/);
rejects(x=>x.ready.startupDiagnostic.zeroIndexDraws=[],/not observed/);
for(const [key,value] of [['mesh','other'],['indexCount',3],['drawRange',{start:1,count:0}],['drawParameters',{vertexCount:0,firstVertex:0,instanceCount:2,firstInstance:0}]])
    rejects(x=>x.ready.startupDiagnostic.zeroIndexDraws[0][key]=value,/Unattributed/);
rejects(x=>x.ready.startupDiagnostic.zeroIndexDraws[0].material.name='unknown',/material/);
rejects(x=>x.ready.startupDiagnostic.zeroIndexDraws[0].callStack='unknown',/draw witness/);
rejects(x=>x.ready.census.meshes.find(m=>m.name==='garment_foundation_briefs').drawRange.count=3,/census changed/);
// No raw draw-count extrapolation: one retained valid call still identifies the zero submission.
const one=clone(input);one.ready.startupDiagnostic.zeroIndexDraws=one.ready.startupDiagnostic.zeroIndexDraws.slice(0,1);
assert.equal(assessStartup(one).zeroIndexSubmissions,1);
assert.equal(assessWarningBoundary(input.warnings,clone(input.warnings)).unchanged,true);
for(const late of ['unexpected','WebGPUTimestampQueryPool: maximum queries exceeded',fixture.messages[0]])
    assert.throws(()=>assessWarningBoundary([...input.warnings,{type:'console-warning',phase:'measured-updates',message:late}],input.warnings),/late warning/);

function warmed(updates) {
    const x=clone(input.ready),h=x.report.hair;
    h.solver.steps+=updates*2;h.history.commits+=updates;h.history.mode='exact';h.history.valid=true;h.history.reason=null;
    h.history.lastDraw={mode:'exact',source:{write:updates+1,reset:1,builtReset:1,ready:true,rawComputeUsed:false}};
    h.cardFrame.mode='smooth';h.cardFrame.reason=null;
    return x;
}
for(const updates of [8,20]) {
    const x=warmed(updates),before=JSON.stringify(x);
    const receipt=assessWarmWorkload(input.ready,x,{updates});assert.equal(receipt.commitsDelta,updates);assert.equal(receipt.solverStepsDelta,updates*2);
    assert.equal(JSON.stringify(x),before);
}
const warmReject=(change,pattern)=>{const x=warmed(8);change(x);assert.throws(()=>assessWarmWorkload(input.ready,x,{updates:8}),pattern);};
warmReject(x=>x.report.hair.solver.steps--,/solver progression/);
warmReject(x=>x.native.computeCallsLastFrame=3,/solver progression/);
warmReject(x=>x.native.substepSeconds=1/60,/solver progression/);
warmReject(x=>x.native.nodeCaptureStackTrace=true,/startup state/);
warmReject(x=>x.native.hairUniforms.kinematic=1,/startup state/);
warmReject(x=>x.report.hair.history.valid=false,/beauty history/);
warmReject(x=>x.report.hair.history.mode='seeding',/beauty history/);
warmReject(x=>x.report.hair.history.commits--,/fresh beauty/);
warmReject(x=>x.report.hair.history.cachedDraws++,/fresh beauty/);
warmReject(x=>x.report.hair.history.invalidations++,/fresh beauty/);
warmReject(x=>x.report.hair.history.lastDraw.source.rawComputeUsed=true,/raw-compute/);
warmReject(x=>x.report.hair.history.lastDraw.source.builtReset++,/raw-compute/);
warmReject(x=>x.report.hair.cardFrame.mode='derivative',/smooth card/);
warmReject(x=>x.report.hair.cardFrame.reason='awaiting a draw',/smooth card/);
warmReject(x=>x.census.meshes.find(m=>m.name==='Humanhair_bob02').visible=false,/census changed/);
assert.throws(()=>assessWarmWorkload(input.ready,input.ready,{updates:8}),/solver progression/);
assert.throws(()=>assessWarmWorkload(input.ready,warmed(8),{updates:841}),/checkpoints/);
console.log(JSON.stringify({groups:7,retainedRawReportSHA256:fixture.reportSHA256,sourceAndScopeRejection:true,
    exactPhaseCountAndRawPairing:true,zeroSubmissionAndFullCensus:true,noLateWarningAdmission:true,warmProgressionAndHostileCases:true,
    scope:'CPU policy checks: retained v4 warnings/census plus explicitly modeled new scalar/warm fields. No native timing or warmup result.'}));
