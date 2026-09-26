// CPU contract for the newly named collar qualification, not a historical replay.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const ACCEPTED_PATH = 'assets/wardrobe/female_casualsuit01/g050.glb';
export const ACCEPTED_SHA256 = '44ebc3eb3a09408a3563d369ae74be15a5bc4beb8040bc43c2c5446d6e65c783';
export const INTERIOR_SHA256 = 'd81a6730bde9d8fee4641e18d6f9f0e3922af420bb68eea3f44b661896aeec3a';
export const NATIVE_BAKE_NAME = 'figure_g050';
export const FOUNDATION_PATHS = Object.freeze({
    foundation_bra: 'assets/wardrobe/foundation_bra/g050.glb',
    foundation_vest: 'assets/wardrobe/foundation_vest/g050.glb'
});
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const hashFile = file => sha256(fs.readFileSync(file));
export const PROFILES = Object.freeze({
    expressive: Object.freeze({ steps: 1080, fps: 60, imageEvery: 3, geometryEvery: 30,
        phases: [
            { step: 0, label: 'happy', pad: { pleasure: .8, arousal: .8, dominance: 1 } },
            { step: 360, label: 'angry', pad: { pleasure: -.8, arousal: .8, dominance: 1 } },
            { step: 720, label: 'fearful', pad: { pleasure: -.8, arousal: .8, dominance: -1 } }
        ] }),
    mild: Object.freeze({ steps: 360, fps: 60, imageEvery: 3, geometryEvery: 30,
        actions: [ { step: 60, action: 'look-toward-me', expression: 'neutral' },
            { step: 240, action: 'release-attention' } ] })
});
export const CAMERA = Object.freeze({ initialYawDegrees: 12, yawDegrees: 25,
    focusYOffsetMetres: -.03, cameraHeightAboveTargetMetres: .04, horizontalRadiusScale: 1.25,
    viewport: { width: 1280, height: 1050 }, deviceScaleFactor: 1 });
export const SPEECH_PLAN = Object.freeze({ synthetic: true, durationSeconds: 6, words: [
    { text: 'closer', startTime: 1.5, endTime: 1.9, stressed: true, contrastGroup: 'span' },
    { text: 'farther', startTime: 4.5, endTime: 4.9, stressed: true, contrastGroup: 'span' }
] });
export const INSTRUMENTS = Object.freeze([
    'tools/figure-pipeline/collar_replacement_capture.mjs',
    'tools/figure-pipeline/collar_replacement_manifest.mjs',
    'tools/figure-pipeline/collar_replacement_manifest.selftest.mjs',
    'tools/figure-pipeline/collar_capture_browser.mjs',
    'tools/lut-bake/glb.mjs'
]);
const digest = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
export function resolveInput(relative, root = ROOT) {
    assert.ok(typeof relative === 'string' && relative.length > 0 && !path.isAbsolute(relative), 'asset/source path must be repository-relative');
    const resolved = path.resolve(root, relative);
    assert.ok(resolved.startsWith(path.resolve(root) + path.sep), 'asset/source path escapes repository');
    return resolved;
}
export function validateManifestShape(manifest) {
    assert.equal(manifest.version, 2, 'manifest version must be 2 with explicit foundations');
    assert.ok(typeof manifest.qualificationId === 'string' && /^[a-z0-9][a-z0-9-]+$/.test(manifest.qualificationId), 'explicit qualificationId required');
    assert.equal(manifest.historicalReplay, false, 'must explicitly disclaim historical replay');
    assert.deepEqual(manifest.hairs, ['bob02', 'bob01'], 'both current bobs required');
    assert.deepEqual(manifest.sequences, ['expressive', 'mild'], 'expressive and new mild sequences required');
    assert.deepEqual(manifest.foundations, ['foundation_bra', 'foundation_vest'], 'both explicit native foundation families required');
    assert.deepEqual(manifest.profiles, PROFILES, 'capture timing/profile drift');
    assert.deepEqual(manifest.camera, CAMERA, 'capture camera drift');
    assert.equal(manifest.seed, 20260807, 'native Showcase seed required');
    assert.ok(Array.isArray(manifest.assets) && manifest.assets.length >= 2 && manifest.assets.length <= 3, 'two baselines and at most one trial required');
    const roles = new Set();
    for (const asset of manifest.assets) {
        assert.ok(asset && ['accepted-installed', 'frozen-interior', 'trial'].includes(asset.role), 'unknown asset role');
        assert.ok(!roles.has(asset.role), 'duplicate asset role'); roles.add(asset.role);
        resolveInput(asset.assetPath); assert.ok(digest(asset.sha256), 'asset sha256 required');
        if (asset.role === 'accepted-installed') {
            assert.equal(asset.assetPath, ACCEPTED_PATH, 'accepted role must name installed default');
            assert.equal(asset.sha256, ACCEPTED_SHA256, 'accepted identity changed');
        }
        if (asset.role === 'frozen-interior') assert.equal(asset.sha256, INTERIOR_SHA256, 'frozen interior identity changed');
        if (asset.role === 'trial') assert.ok(![ACCEPTED_SHA256, INTERIOR_SHA256].includes(asset.sha256), 'trial must be distinct exact bytes');
    }
    assert.ok(roles.has('accepted-installed') && roles.has('frozen-interior'), 'mandatory comparison roles missing');
    assert.equal(new Set(manifest.assets.map(a => a.assetPath)).size, manifest.assets.length, 'asset path reused across roles');
    assert.ok(manifest.sourceHashes && Object.keys(manifest.sourceHashes).length > 0, 'pinned sourceHashes required');
    for (const [name, hash] of Object.entries(manifest.sourceHashes)) { resolveInput(name); assert.ok(digest(hash), 'invalid source digest'); }
    return manifest;
}
function walk(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        if (['node_modules', 'vendor'].includes(entry.name)) return [];
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(file) : entry.isFile() ? [file] : [];
    });
}
export function collectSourceHashes(root = ROOT) {
    const extensions = /\.(?:js|mjs|html|css|json|glb|png|jpg|hdr|bin)$/;
    const files = [...INSTRUMENTS, 'package.json', 'package-lock.json', 'vite.config.js',
        'node_modules/three/package.json',
        ...['packages/core/src', 'packages/testbed/src', 'assets'].flatMap(base => walk(path.join(root, base))
            .filter(file => extensions.test(file)).map(file => path.relative(root, file)))];
    return Object.fromEntries([...new Set(files)].sort().map(file => [file, hashFile(resolveInput(file, root))]));
}
export function verifyCaptureInputs(manifest, root = ROOT) {
    validateManifestShape(manifest);
    assert.equal(hashFile(path.join(root, ACCEPTED_PATH)), ACCEPTED_SHA256, 'installed default changed');
    assert.deepEqual(collectSourceHashes(root), manifest.sourceHashes, 'runtime/instrument/asset source drift');
    return manifest.assets.map(entry => {
        const resolvedPath = resolveInput(entry.assetPath, root), bytes = fs.readFileSync(resolvedPath);
        assert.equal(sha256(bytes), entry.sha256, `${entry.role} asset bytes changed`);
        assert.equal(bytes.toString('ascii', 0, 4), 'glTF', `${entry.role} is not GLB`);
        return { ...entry, resolvedPath, bytes };
    });
}
export function baseSnapshotSteps(sequence) {
    const profile = PROFILES[sequence]; assert.ok(profile, 'unknown sequence');
    const steps = new Set();
    for (let step = 0; step <= profile.steps; step += profile.geometryEvery) steps.add(step);
    for (const step of [98, 99, 270, 720]) if (step <= profile.steps) steps.add(step);
    return steps;
}
export function captureCases(manifest, smokeFoundation = null) {
    if (smokeFoundation !== null) assert.ok(manifest.foundations.includes(smokeFoundation), 'unknown smoke foundation');
    const cases = manifest.hairs.flatMap(hair => manifest.sequences.flatMap(sequence => manifest.foundations.flatMap(foundation =>
        manifest.assets.map(asset => ({ hair, sequence, foundation, role: asset.role })))));
    return smokeFoundation ? cases.filter(item => item.hair === 'bob02' && item.sequence === 'mild' && item.role === 'accepted-installed' && item.foundation === smokeFoundation) : cases;
}
/** Compare actual body/outer pose, not foundation identity, visibility or drawn masks. */
export function comparePoseFamilies(bra, vest) {
    const differences = []; let differenceCount = 0;
    const compare = (kind, left, right, select) => {
        const byStep = new Map(right.map(item => [item.step, item]));
        if (left.length !== right.length) { differenceCount++; differences.push({ kind, field: 'sample-count', bra: left.length, vest: right.length }); }
        for (const item of left) {
            const other = byStep.get(item.step), a = select(item), b = other ? select(other) : null;
            if (!isDeepStrictEqual(a, b)) {
                differenceCount++;
                if (differences.length < 25) differences.push({ kind, step: item.step,
                    fields: b ? Object.keys(a).filter(key => !isDeepStrictEqual(a[key], b[key])) : ['missing-vest-sample'] });
            }
        }
    };
    compare('native-state', bra.states, vest.states, item => ({ clock: item.physical.clock, rendererFrame: item.rendererFrame,
        bones: item.bones, morphs: item.morphs, poseMeshes: item.poseMeshes }));
    compare('numerical-geometry', bra.geometry, vest.geometry, item => item.pose);
    return { sameSampledPose: differenceCount === 0, stateSamples: bra.states.length, geometrySamples: bra.geometry.length,
        differenceCount, firstDifferences: differences,
        classification: differenceCount === 0 ? 'matched-sampled-poses' : 'separate-actual-pose-families',
        excludes: ['foundation geometry', 'drawn masks', 'foundation visibility', 'unsampled continuous poses'] };
}
export function addSchedulePeaks(steps, schedule, phaseStep, totalSteps = 1080) {
    assert.ok(schedule && Array.isArray(schedule.gestures), 'actual schedule required');
    assert.equal(schedule.gestures.length, 2, 'expected two actual gestures');
    assert.ok(schedule.gestures.every(g => g.hand === 'both'), 'expected bilateral actual gestures');
    const peaks = schedule.gestures.map(gesture => {
        assert.ok(Number.isFinite(gesture.strokeStart) && Number.isFinite(gesture.strokeSeconds) && gesture.strokeSeconds > 0, 'invalid actual schedule timing');
        return phaseStep + Math.ceil((gesture.strokeStart + .5 * gesture.strokeSeconds) * 60);
    });
    for (const peak of peaks) {
        assert.ok(peak > phaseStep && peak < phaseStep + 360 && peak <= totalSteps, 'actual peak outside current phase');
        for (let offset = -2; offset <= 2; offset++) if (peak + offset >= phaseStep && peak + offset <= totalSteps) steps.add(peak + offset);
    }
    return peaks;
}
