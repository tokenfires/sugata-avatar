// New disposable attribution protocol. No GPU/server is created by this module or --write.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { gestureEnvelope } from '../../../../packages/core/src/motion/Gesture.js';
import { ROOT, CAMERA, SPEECH_PLAN, collectSourceHashes, hashFile, sha256 } from '../../../../tools/figure-pipeline/collar_replacement_manifest.mjs';
import { REQUIRED_SOURCE_HASHES } from './HandAttributionArm.mjs';
export { ROOT, CAMERA, SPEECH_PLAN, hashFile, sha256 };
export const DIRECTORY = 'docs/evidence/nonhair-2026-09-26/hand-clearance';
export const BASE = 'captures/collar-replacement-2026-09-26/capture-v2';
export const CASE = 'bob02-expressive-foundation_bra-accepted-installed';
export const ARMS = ['A', 'B', 'C'];
export const PHASES = [ { step: 0, label: 'happy', pad: { pleasure: .8, arousal: .8, dominance: 1 } },
    { step: 360, label: 'angry', pad: { pleasure: -.8, arousal: .8, dominance: 1 } } ];
export const TIMING = { fps: 60, steps: 720, imageEvery: 4, geometryEvery: 30, denseOffsets: [-2, -1, 0, 1, 2],
    numericalCap: 120, imageTimeCap: 300, oldGeometrySteps: [0, 637, 720], oldPhysicalSteps: [0, 636, 639, 720],
    commandBoundary: 'Native step, then happy/angry command at0/360, then image/snapshot. Stop720 before fearful command.' };
export const VIEWS = [
    { id: 'front-full-body', target: [0, .85, 0], heightMetres: 2, yawDegrees: 0 },
    { id: 'left-hand-hip', target: [.14, .73, .06], heightMetres: .60, yawDegrees: 35 },
    { id: 'right-hand-hip', target: [-.14, .73, .06], heightMetres: .60, yawDegrees: -35 }
];
export const CAPTURE_ASSETS = ['assets/wardrobe/body/g050.glb', 'assets/wardrobe/female_casualsuit01/g050.glb', 'assets/wardrobe/foundation_bra/g050.glb',
    'assets/wardrobe/foundation_briefs/g050.glb', 'assets/wardrobe/shoes01/g050.glb', 'assets/hair/bob02/g050.glb'];
const VISUAL_POLICY = 'Fresh view passes use a fixed full-body base camera. Close views are camera-only zero-delta renders after saved native geometry, then restore full-body base. Exact primary pose/owner parity gates every saved sample. No setFraming/rig changes.';
const OWN_FILES = ['HandAttributionArm.mjs', 'HandAttributionArm.selftest.mjs', 'hand-attribution-manifest.mjs',
    'hand-attribution-runtime.mjs', 'hand-attribution-capture.mjs', 'hand-attribution.selftest.mjs',
    'retained-json-comparison.mjs', 'retained-json-comparison.selftest.mjs'].map(name => `${DIRECTORY}/${name}`);
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : e.isFile() ? [path.join(dir, e.name)] : []);
export function sources() {
    const files = [...OWN_FILES, 'packages/testbed/index.html', ...walk(path.join(ROOT, 'node_modules/three')).filter(file => /\.(?:js|json|wasm)$/.test(file)).map(file => path.relative(ROOT, file))];
    return Object.fromEntries(Object.entries({ ...collectSourceHashes(), ...Object.fromEntries(files.map(file => [file, hashFile(path.join(ROOT, file))])) }).sort(([a], [b]) => a.localeCompare(b)));
}
export function baseline() {
    const reportFile = BASE + '/report.json', report = JSON.parse(fs.readFileSync(path.join(ROOT, reportFile)));
    assert.equal(hashFile(path.join(ROOT, reportFile)), 'd948def1aa42e54fabd0a3e6b8efd4f0828c5b11b6d5295e85ad204d0f0c5963');
    const run = report.runs.find(run => run.name === CASE); assert.equal(run.completed, true); assert.deepEqual(run.errors, []);
    const inputHashes = { [reportFile]: hashFile(path.join(ROOT, reportFile)) };
    for (const step of TIMING.oldGeometrySteps) { const e = run.geometry.find(e => e.step === step); assert.ok(e); inputHashes[BASE + '/' + e.file] = e.sha256; }
    return { report, run, inputHashes };
}
export function baseSteps() { return new Set([...Array.from({ length: 25 }, (_, i) => i * 30), 1, 359, 361, 719]); }
/** Discrete plateau-boundary/centre witnesses, not exhaustive plateau or continuous sampling. */
export function scheduleSampling(schedule, phaseStep) {
    assert.ok([0, 360].includes(phaseStep)); assert.equal(schedule?.gestures?.length, 2);
    const samples = new Set(), intervals = [];
    for (const gesture of schedule.gestures) {
        assert.equal(gesture.hand, 'both');
        for (const key of ['preparationStart', 'strokeStart', 'strokeEnd', 'strokeSeconds', 'endTime']) assert.ok(Number.isFinite(gesture[key]), key);
        let t = 0; const values = [];
        for (let n = 1; n <= 360; n++) { t += 1 / 60; if (t >= gesture.preparationStart && t < gesture.endTime) values.push({ step: phaseStep + n, ...gestureEnvelope(gesture, t) }); }
        const max = Math.max(...values.map(v => v.activation)); assert.equal(max, 1, 'native held stroke required');
        const plateau = values.filter(v => v.activation === max), first = plateau[0].step, last = plateau.at(-1).step;
        const center = phaseStep + Math.ceil((gesture.strokeStart + .5 * gesture.strokeSeconds) * 60);
        assert.ok(center >= first && center <= last);
        const boundaries = [gesture.preparationStart, gesture.endTime].map(t => phaseStep + Math.ceil(t * 60));
        for (const anchor of [first, center, last]) for (const delta of TIMING.denseOffsets) if (anchor + delta >= phaseStep && anchor + delta <= phaseStep + 360) samples.add(anchor + delta);
        for (const boundary of boundaries) for (const delta of [-1, 0, 1]) if (boundary + delta >= phaseStep && boundary + delta <= phaseStep + 360) samples.add(boundary + delta);
        intervals.push({ phaseStep, first, center, last, maxActivation: max, boundaries, source: 'actual returned schedule + native gestureEnvelope; validate actual returned samples after trace' });
    }
    return { steps: [...samples].sort((a, b) => a - b), intervals };
}
function samplingPlan(run) {
    const planned = baseSteps(), sampling = [], images = new Set(Array.from({ length: 181 }, (_, i) => i * 4));
    for (const phase of PHASES) { const command = run.commands.find(c => c.step === phase.step), p = scheduleSampling(command.actual.schedule, phase.step); p.steps.forEach(n => { planned.add(n); images.add(n); }); sampling.push(...p.intervals); }
    assert.ok(planned.size <= TIMING.numericalCap);
    assert.ok(images.size <= TIMING.imageTimeCap);
    return { numericalSteps: [...planned].sort((a, b) => a - b), count: planned.size, intervals: sampling,
        visualImageSteps: [...images].sort((a, b) => a - b), imageTimes: images.size, extraClosePlates: 6,
        limit: 'Retained actual schedules used for preflight sizing only; every new run rederives and verifies its actual schedule and plateau samples.' };
}
export function createManifest() {
    const { run, inputHashes } = baseline();
    return { version: 1, studyId: 'hand-attribution-2026-09-26-v1', kind: 'new-disposable-prefix-attribution', promotion: false,
        seed: 20260807, body: 'figure_g050', hair: 'bob02', outfit: ['female_casualsuit01', 'shoes01'], foundation: { TORSO: 'foundation_bra', HIPS: 'foundation_briefs' },
        arms: ARMS, phases: PHASES, speechPlan: SPEECH_PLAN, camera: CAMERA, timing: TIMING, views: VIEWS,
        visualPolicy: VISUAL_POLICY, planned: samplingPlan(run),
        baseline: { case: CASE, inputHashes }, sourceHashes: sources() };
}
export function validate(manifest, { verifyFiles = true } = {}) {
    assert.equal(manifest.version, 1); assert.equal(manifest.studyId, 'hand-attribution-2026-09-26-v1');
    assert.equal(manifest.kind, 'new-disposable-prefix-attribution'); assert.equal(manifest.promotion, false);
    assert.equal(manifest.seed, 20260807); assert.equal(manifest.body, 'figure_g050'); assert.equal(manifest.hair, 'bob02');
    assert.deepEqual(manifest.arms, ARMS); assert.deepEqual(manifest.phases, PHASES); assert.deepEqual(manifest.speechPlan, SPEECH_PLAN);
    assert.deepEqual(manifest.camera, CAMERA); assert.deepEqual(manifest.timing, TIMING); assert.deepEqual(manifest.views, VIEWS);
    assert.equal(manifest.visualPolicy, VISUAL_POLICY);
    assert.deepEqual(manifest.outfit, ['female_casualsuit01', 'shoes01']); assert.deepEqual(manifest.foundation, { TORSO: 'foundation_bra', HIPS: 'foundation_briefs' });
    assert.ok(manifest.planned.count <= TIMING.numericalCap); assert.equal(manifest.planned.count, manifest.planned.numericalSteps.length);
    for (const [file, hash] of Object.entries(REQUIRED_SOURCE_HASHES)) assert.equal(manifest.sourceHashes[file], hash, file);
    const old = baseline();
    assert.equal(manifest.baseline.case, CASE); assert.deepEqual(manifest.baseline.inputHashes, old.inputHashes);
    assert.deepEqual(manifest.planned, samplingPlan(old.run), 'preflight sample plan drift');
    for (const file of CAPTURE_ASSETS) assert.equal(manifest.sourceHashes[file], old.report.sourceHashes[file], 'retained accepted source asset: ' + file);
    if (verifyFiles) {
        assert.deepEqual(sources(), manifest.sourceHashes, 'current source/assets drift');
        for (const [file, hash] of Object.entries(manifest.baseline.inputHashes)) assert.equal(hashFile(path.join(ROOT, file)), hash, file);
    }
    return manifest;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    assert.equal(process.argv[2], '--write'); assert.equal(process.argv.length, 4);
    const manifest = createManifest(); validate(manifest); fs.writeFileSync(process.argv[3], JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ manifest: process.argv[3], sources: Object.keys(manifest.sourceHashes).length, planned: manifest.planned }));
}
