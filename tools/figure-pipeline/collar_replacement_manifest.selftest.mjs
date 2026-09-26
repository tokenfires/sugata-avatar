// Focused CPU rejection checks. No browser, GPU, fitting or asset writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ACCEPTED_PATH, ACCEPTED_SHA256, INTERIOR_SHA256, NATIVE_BAKE_NAME, PROFILES, CAMERA,
    validateManifestShape, collectSourceHashes, verifyCaptureInputs, baseSnapshotSteps,
    addSchedulePeaks, captureCases, comparePoseFamilies, sha256 } from './collar_replacement_manifest.mjs';

const frozenPath = 'captures/collar-stress-2026-09-22/gpu-v1/assets/collar-interior.glb';
const manifest = { version: 2, qualificationId: 'collar-current-2026-09-26', historicalReplay: false,
    hairs: ['bob02', 'bob01'], sequences: ['expressive', 'mild'], foundations: ['foundation_bra', 'foundation_vest'], seed: 20260807,
    profiles: structuredClone(PROFILES), camera: structuredClone(CAMERA),
    assets: [ { role: 'accepted-installed', assetPath: ACCEPTED_PATH, sha256: ACCEPTED_SHA256 },
        { role: 'frozen-interior', assetPath: frozenPath, sha256: INTERIOR_SHA256 } ],
    sourceHashes: { 'packages/core/src/Avatar.js': '0'.repeat(64) } };
const checks = [], check = name => { checks.push(name); console.log('PASS ' + name); };
const nativeWitness = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/evidence/nonhair-2026-09-26/framing/accepted/report.json')));
assert.ok(nativeWitness.views.length > 0, 'native identity witness is empty');
assert.ok(nativeWitness.views.every(view => view.identity?.bake === NATIVE_BAKE_NAME), 'runtime report bake schema drift');
assert.notEqual(NATIVE_BAKE_NAME, 'g050', 'asset suffix is not the native report bake name');
check('retained native framing reports bind the actual identity.bake schema to figure_g050');
const clone = () => structuredClone(manifest);
validateManifestShape(manifest);
assert.equal(captureCases(manifest).length, 16);
assert.deepEqual(captureCases(manifest, 'foundation_bra'), [{ hair: 'bob02', sequence: 'mild', foundation: 'foundation_bra', role: 'accepted-installed' }]);
assert.deepEqual(captureCases(manifest, 'foundation_vest'), [{ hair: 'bob02', sequence: 'mild', foundation: 'foundation_vest', role: 'accepted-installed' }]);
assert.throws(() => captureCases(manifest, 'guessed-vest'), /unknown/);
for (const edit of [
    value => { value.historicalReplay = true; },
    value => { value.assets = value.assets.slice(1); },
    value => { value.assets.push({ ...value.assets[0] }); },
    value => { value.assets[0].sha256 = '0'.repeat(64); },
    value => { value.assets[1].assetPath = '../outside.glb'; },
    value => { value.profiles.mild.actions[1].step = 250; },
    value => { value.camera.yawDegrees = 26; },
    value => { value.seed = 1; },
    value => { value.hairs = ['bob02']; },
    value => { value.foundations = ['foundation_bra']; }
]) { const invalid = clone(); edit(invalid); assert.throws(() => validateManifestShape(invalid)); }
check('manifest rejects role, identity, path, seed, timing, camera and historical-equivalence substitutions');
const withTrial = clone();
withTrial.assets.push({ role: 'trial', assetPath: 'captures/future-qualified-trial.glb', sha256: '1'.repeat(64) });
validateManifestShape(withTrial);
withTrial.assets[2].sha256 = INTERIOR_SHA256;
assert.throws(() => validateManifestShape(withTrial), /distinct/);
check('optional single trial needs its own explicit, distinct identity');
const family = { states: [{ step: 0, physical: { clock: 0 }, rendererFrame: 1000000,
    bones: [1], morphs: [0], poseMeshes: { body: { bones: [1], morphs: [0] }, female_casualsuit01: { bones: [1], morphs: [] } } }],
    geometry: [{ step: 0, pose: { clock: 0, rigSHA256: 'rig', meshes: { body: 'body', female_casualsuit01: 'outer' } }, drawnIndices: [0] }] };
const differentMask = structuredClone(family); differentMask.geometry[0].drawnIndices = [1, 2];
assert.equal(comparePoseFamilies(family, differentMask).sameSampledPose, true);
const differentPose = structuredClone(family); differentPose.geometry[0].pose.meshes.body = 'another-actual-pose';
assert.equal(comparePoseFamilies(family, differentPose).classification, 'separate-actual-pose-families');
const differentBones = structuredClone(family); differentBones.states[0].poseMeshes.female_casualsuit01.bones[0] = 2;
assert.equal(comparePoseFamilies(family, differentBones).sameSampledPose, false);
check('foundation comparison ignores mask differences but preserves genuinely different body/outer pose families');
const expressive = baseSnapshotSteps('expressive'), mild = baseSnapshotSteps('mild');
assert.equal(expressive.size, 39); assert.equal(mild.size, 15);
for (const step of [0, 30, 98, 99, 270, 720, 1080]) assert.ok(expressive.has(step));
assert.ok(!mild.has(720)); for (const step of [60, 240, 360, 98, 99, 270]) assert.ok(mild.has(step));
const schedule = { gestures: [ { hand: 'both', strokeStart: 1.3, strokeSeconds: .5 }, { hand: 'both', strokeStart: 4.1, strokeSeconds: .6 } ] };
const expected = schedule.gestures.map(g => 360 + Math.ceil((g.strokeStart + .5 * g.strokeSeconds) * 60));
assert.deepEqual(addSchedulePeaks(expressive, schedule, 360), expected);
for (const peak of expected) for (let offset = -2; offset <= 2; offset++) assert.ok(expressive.has(peak + offset));
assert.throws(() => addSchedulePeaks(new Set(), { gestures: [] }, 0), /two/);
assert.throws(() => addSchedulePeaks(new Set(), { gestures: schedule.gestures.map(g => ({ ...g, hand: 'left' })) }, 0), /bilateral/);
assert.throws(() => addSchedulePeaks(new Set(), { gestures: schedule.gestures.map(g => ({ ...g, strokeStart: 8 })) }, 0), /outside/);
assert.throws(() => addSchedulePeaks(new Set(), { gestures: schedule.gestures.map(g => ({ ...g, strokeSeconds: NaN })) }, 0), /timing/);
check('regular snapshots, applicable fixed anchors and returned-schedule peak neighborhoods are complete; invalid schedules fail closed');
manifest.sourceHashes = collectSourceHashes();
const beforeAccepted = sha256(fs.readFileSync(path.join(ROOT, ACCEPTED_PATH)));
const beforeFrozen = sha256(fs.readFileSync(path.join(ROOT, frozenPath)));
const assets = verifyCaptureInputs(manifest);
assert.deepEqual(assets.map(asset => asset.sha256), [ACCEPTED_SHA256, INTERIOR_SHA256]);
const sourceDrift = clone(); sourceDrift.sourceHashes['packages/core/src/Avatar.js'] = '0'.repeat(64);
assert.throws(() => verifyCaptureInputs(sourceDrift), /source drift/);
const wrongFile = clone(); wrongFile.assets[1].assetPath = ACCEPTED_PATH;
assert.throws(() => verifyCaptureInputs(wrongFile), /reused/);
const mismatchedTrial = clone(); mismatchedTrial.assets.push({ role: 'trial', assetPath: 'captures/collar-stress-2026-09-22/gpu-v1/assets/accepted.glb', sha256: '1'.repeat(64) });
assert.throws(() => verifyCaptureInputs(mismatchedTrial), /bytes changed/);
assert.equal(sha256(fs.readFileSync(path.join(ROOT, ACCEPTED_PATH))), beforeAccepted);
assert.equal(sha256(fs.readFileSync(path.join(ROOT, frozenPath))), beforeFrozen);
check('current real baseline bytes verify; pinned source drift and mismatched trial bytes are refused; assets remain unchanged');
console.log(JSON.stringify({ checks: checks.length, sourceFiles: Object.keys(manifest.sourceHashes).length, browserRuns: 0, gpuRuns: 0 }));
