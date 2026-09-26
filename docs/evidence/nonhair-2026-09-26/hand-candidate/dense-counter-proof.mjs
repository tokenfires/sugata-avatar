// CPU-only forensic receipt for the first dense run's invalid frame-count assumption.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
const ROOT = process.cwd(), SELF = 'docs/evidence/nonhair-2026-09-26/hand-candidate/dense-counter-proof.mjs';
const PRIMARY = 'captures/hand-candidate-2026-09-26/candidate-primary-v3';
const FAILED = 'captures/hand-candidate-2026-09-26/candidate-dense-v1';
const CONTROLLER = 'docs/evidence/nonhair-2026-09-26/hand-candidate/candidate-dense-window.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = file => fs.readFileSync(path.join(ROOT, file));
const read = file => JSON.parse(bytes(file));
const binding = file => ({ file, sha256: sha(bytes(file)), bytes: bytes(file).length });
assert.equal(process.argv.length, 3, 'usage: node dense-counter-proof.mjs FRESH_OUTPUT_DIRECTORY');
const out = path.resolve(process.argv[2]); assert.equal(fs.existsSync(out), false);
const primary = read(PRIMARY + '/report.json'), failed = read(FAILED + '/report.json');
assert.equal(sha(bytes(PRIMARY + '/report.json')), '34305cf143306ae7818c159159e2eb7aa1514992da696cc8a27b948467b0b877');
assert.equal(sha(bytes(PRIMARY + '/manifest.json')), 'a4bd27fcef48d9efb2cdcd71d7df3c2523d4e2b2416e6002a834c56efa382515');
assert.equal(primary.completed, true); assert.equal(failed.completed, false);
assert.equal(failed.manifestSHA256, '726d42f44bcb2b4edf338b600758dbabe0cea29fff47b772020592a5e9781885');
assert.equal(sha(bytes(FAILED + '/manifest.json')), failed.manifestSHA256);
assert.equal(failed.sourceHashes[CONTROLLER], 'ddd6dba29dc9808473eb2b4fcb0f1d4fffa309afd9faf2a2dce904bd940154b8');
assert.equal(fs.existsSync(path.join(ROOT, FAILED, 'seal.json')), false);
for (const report of [primary, failed]) for (const entry of report.sourceFreeze) {
    const directory = report === primary ? PRIMARY : FAILED;
    assert.equal(sha(bytes(directory + '/' + entry.file)), entry.sha256, entry.file);
}
function bound(directory, entry) {
    const compressed = bytes(directory + '/' + entry.file); assert.equal(sha(compressed), entry.sha256);
    const raw = gunzipSync(compressed); assert.equal(sha(raw), entry.decodedSHA256); return JSON.parse(raw);
}
const priorStates = bound(PRIMARY, primary.states), states = bound(FAILED, failed.states);
assert.equal(priorStates.length, 721); assert.equal(states.length, 586);
assert.equal(failed.states.partial, true); assert.equal(failed.geometry.length, 0);
for (let i = 0; i < states.length; i++) { assert.equal(states[i].step, i); assert.deepEqual(states[i], priorStates[i]); }
assert.deepEqual(bound(FAILED, failed.failureState), states.at(-1));
assert.match(failed.failure, /1171 !== 586/);
assert.equal(failed.failurePhysical.attemptedLoopStep, 585);
assert.equal(failed.failurePhysical.lastRetainedSemanticStep, 585);
assert.equal(failed.failurePhysical.physical.clock, states.at(-1).clock);
assert.equal(failed.failurePhysical.physical.steps, 1171);
assert.equal(failed.failurePhysical.rendering.rendererFrame, 1000257 + 585);
assert.deepEqual(failed.errors, []);
for (const key of ['cleanupFailure', 'sourceFailure']) assert.equal(failed[key], undefined);
const finish = failed.finish, receipt = finish.result.receipt;
assert.equal(finish.error, null); assert.equal(receipt.completed, true); assert.equal(receipt.disposed, true);
assert.deepEqual(receipt.cleanup, {restored:['bindArmBudget','load'], lost:[]});
assert.equal(receipt.retirement.status, 'disposed'); assert.equal(receipt.retirement.failure, null);
assert.equal(receipt.retirement.completedFrames, 586); assert.deepEqual(receipt.retirement.cleanup.lost, []);
assert.equal(receipt.candidateTelemetry.failure, null);
assert.deepEqual(receipt.candidateTelemetry.frames, Array.from({length:586}, (_, i) => i + 2));
for (const d of [finish.disposal, receipt.retireResult]) {
    assert.equal(d.disposed, true); assert.deepEqual(d.leaks, []);
    assert.ok(Object.values(d.memory).every(v => v === 0));
    assert.equal(d.instrument.status, 'disposed'); assert.equal(d.instrument.failure, null);
    assert.equal(d.instrument.completedFrames, 586); assert.deepEqual(d.instrument.cleanup.lost, []);
}
assert.ok(Object.values(finish.memory).every(v => v === 0));
const sourceFiles = ['packages/core/src/motion/HairDynamics.js', 'packages/core/src/Avatar.js',
    'tools/figure-pipeline/collar_capture_browser.mjs',
    'docs/evidence/nonhair-2026-09-26/hand-clearance/hand-attribution-runtime.mjs',
    'docs/evidence/nonhair-2026-09-26/hand-candidate/candidate-runtime.mjs'];
const source = Object.fromEntries(sourceFiles.map(file => [file, bytes(PRIMARY + '/source/' + file).toString()]));
const dynamics = source[sourceFiles[0]];
for (const text of ['const SUBSTEP_SECONDS = 1 / 120;', 'const MAX_SUBSTEPS_PER_FRAME = 4;',
    'let accumulatorSeconds = 0;', 'let stepsTaken = 0;', 'let resetPending = true;',
    'accumulatorSeconds += Math.max( deltaSeconds, 0 );',
    'while ( accumulatorSeconds >= SUBSTEP_SECONDS && substeps < MAX_SUBSTEPS_PER_FRAME )',
    'accumulatorSeconds -= SUBSTEP_SECONDS;',
    'if ( resetPending === true && substeps === 0 ) substeps = 1;',
    'stepsTaken += substeps;', 'steps: stepsTaken']) assert.ok(dynamics.includes(text), text);
assert.ok(source[sourceFiles[1]].includes('this.hairUpdate?.( deltaSeconds );'));
assert.ok(source[sourceFiles[1]].includes('return dynamics.update( deltaSeconds );'));
assert.ok(source[sourceFiles[2]].includes('clock:a.clockSeconds,steps:c.steps'));
assert.ok(source[sourceFiles[2]].includes('await a.step(0)'));
assert.ok(source[sourceFiles[3]].includes('await helper.step(avatar, 1 / 60)'));
// Exact JS accumulator arithmetic from the pinned source, not a fit to measured samples.
let accumulator = 0, solverSteps = 0, resetPending = true;
const predicted = [];
for (let step = 0; step <= 720; step++) {
    accumulator += Math.max(step === 0 ? 0 : 1 / 60, 0);
    let substeps = 0;
    while (accumulator >= 1 / 120 && substeps < 4) { accumulator -= 1 / 120; substeps++; }
    if (substeps === 4) accumulator = 0;
    if (resetPending && substeps === 0) substeps = 1;
    if (substeps) { resetPending = false; solverSteps += substeps; }
    assert.equal(accumulator, 0); assert.equal(substeps, step === 0 ? 1 : 2);
    assert.equal(solverSteps, 1 + 2 * step); predicted.push(solverSteps);
}
const sampleChecks = primary.geometry.map(g => {
    assert.equal(g.physical.clock, priorStates[g.step].clock); assert.equal(g.time, priorStates[g.step].clock);
    assert.equal(g.physical.steps, predicted[g.step]);
    return {step:g.step, clock:g.physical.clock, observedSolverSubsteps:g.physical.steps, expectedSolverSubsteps:predicted[g.step]};
});
assert.equal(sampleChecks.length, 109);
const oldController = bytes(FAILED + '/source/' + CONTROLLER);
const reportRaw = bytes(FAILED + '/report.json'), reportGzip = gzipSync(reportRaw);
const result = {
    version:1, kind:'dense-window-counter-instrument-correction', nativeRerun:false,
    script:binding(SELF), primary:{report:binding(PRIMARY+'/report.json'),manifest:binding(PRIMARY+'/manifest.json'),seal:binding(PRIMARY+'/seal.json')},
    rejected:{directory:FAILED, report:binding(FAILED+'/report.json'),manifest:binding(FAILED+'/manifest.json'),
        states:{...failed.states, file:FAILED+'/'+failed.states.file},failureState:{...failed.failureState,file:FAILED+'/'+failed.failureState.file},
        sourceFilesVerified:failed.sourceFreeze.length, controller:binding(FAILED+'/source/'+CONTROLLER),
        semanticStatesExactAgainstOwnPrimary:586,geometrySamples:0,attemptedStep:585, observedCounter:1171,invalidExpectedCounter:586,
        cleanRetirement:true,errors:failed.errors, memory:finish.memory},
    preserved:{reportGzip:{file:'rejected-native-v1-report.json.gz',sha256:sha(reportGzip),decodedSHA256:sha(reportRaw)},
        controller:{file:'rejected-native-v1-controller.mjs',sha256:sha(oldController)}},
    sourceBindings:sourceFiles.map(file=>({file,sha256:primary.sourceHashes[file]})),
    counter:{meaning:'HairDynamics submitted fixed solver substeps, not Avatar/native updates', solverHz:120,nativeHz:60,
        initialResetSubsteps:1,substepsPerPositiveNativeUpdate:2,formula:'1 + 2 * nativeStep',
        accumulatorModelFrames:predicted.length, allAccumulatorRemaindersExactlyZero:true, knownPrimarySamples:sampleChecks},
    scope:'CPU proof and preserved rejected run only. No additional native geometry, clearance, visual acceptance, hair change or promotion.'
};
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'rejected-native-v1-report.json.gz'),reportGzip,{flag:'wx'});
fs.writeFileSync(path.join(out,'rejected-native-v1-controller.mjs'),oldController,{flag:'wx'});
fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({receipt:path.join(out,'receipt.json'),sha256:sha(fs.readFileSync(path.join(out,'receipt.json'))),primarySamples:109,failedStates:586,cleanRetirement:true}));
