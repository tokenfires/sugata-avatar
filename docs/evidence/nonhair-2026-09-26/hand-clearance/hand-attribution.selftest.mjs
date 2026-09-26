import assert from 'node:assert/strict';
import { baseline, baseSteps, scheduleSampling, createManifest, validate, PHASES, TIMING } from './hand-attribution-manifest.mjs';
const { run } = baseline(); const steps = baseSteps(), intervals = [];
for (const phase of PHASES) { const p = scheduleSampling(run.commands.find(c => c.step === phase.step).actual.schedule, phase.step); p.steps.forEach(n => steps.add(n)); intervals.push(...p.intervals); }
assert.deepEqual(intervals.map(i => i.center), [98, 270, 455, 637]);
assert.deepEqual(PHASES.map(p => p.step), [0, 360]); assert.ok(!PHASES.some(p => p.label === 'fearful'));
assert.ok(steps.has(0) && steps.has(637) && steps.has(720)); assert.ok(steps.size <= TIMING.numericalCap);
for (const i of intervals) for (const anchor of [i.first, i.center, i.last]) for (const d of [-2,-1,0,1,2]) assert.ok(steps.has(anchor+d));
console.log('PASS native retained schedules derive bounded plateau boundaries/centres, exact fixed anchors and no fearful command');
assert.throws(() => scheduleSampling({ gestures: [] }, 0));
const bad = structuredClone(run.commands[0].actual.schedule); bad.gestures[0].hand = 'left'; assert.throws(() => scheduleSampling(bad, 0));
assert.throws(() => scheduleSampling(run.commands[0].actual.schedule, 720));
console.log('PASS unexpected schedule shape, unilateral owner and non-prefix phase rejected');
const manifest = createManifest(); validate(manifest);
for (const mutate of [m=>m.arms.reverse(),m=>m.timing.imageEvery=3,m=>m.phases.push({step:720,label:'fearful'}),m=>m.views[0].heightMetres=.5,m=>m.seed++,m=>m.sourceHashes['packages/core/src/motion/Gesture.js']='0'.repeat(64)]) {
    const bad = structuredClone(manifest); mutate(bad); assert.throws(()=>validate(bad,{verifyFiles:false}));
}
console.log('PASS explicit protocol/source pins reject timing, arms, fearful extension, camera, seed and source drift');
console.log(JSON.stringify({ passed: true, groups: 3, numericalSamples: steps.size, sources: Object.keys(manifest.sourceHashes).length, intervals }));
