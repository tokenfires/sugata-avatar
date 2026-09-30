// Independent JS consumer of the native MPFB packet; no asset writes or fit claims.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {gunzipSync, gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseMhclo, requiredIndices, compactBody, fitMhclo} from '../../docs/evidence/nonhair-2026-09-26/wardrobe-coupling/cpu-refit.mjs';
import {IdentityCatalogue} from '../../packages/core/src/figure/IdentityCatalogue.js';
import {IdentityTargets, AXIS_BLENDER} from '../../packages/core/src/figure/IdentityTargets.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const oracle = path.resolve(ROOT, process.argv[2] ?? 'captures/wardrobe-native-oracle-2026-09-30-v2');
const out = path.resolve(ROOT, process.argv[3] ?? 'captures/wardrobe-native-comparison-2026-09-30-v1');
assert.ok(!fs.existsSync(out));
fs.mkdirSync(out, {recursive: true});
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const read = p => fs.readFileSync(path.resolve(ROOT, p));
const hash = p => sha(read(p));
const coupling = 'docs/evidence/nonhair-2026-09-26/wardrobe-coupling/';
const report = {started: new Date().toISOString(), pid: process.pid, status: 'running',
    errors: [], inputs: {}, cases: [], corruptions: {}, artifacts: [],
    scope: 'Three native original-garment arithmetic cases, no corrected-garment fit, motion or wider-body qualification.'};
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
function bind(p) { report.inputs[p] = hash(p); }
function decodeBound(directory, entry) {
    const encoded = fs.readFileSync(path.join(directory, entry.file));
    assert.equal(sha(encoded), entry.sha256);
    const raw = gunzipSync(encoded);
    assert.equal(sha(raw), entry.decodedSHA256);
    return JSON.parse(raw);
}
function metric(actual, expected, gateMm) {
    assert.equal(actual.length, expected.length);
    assert.equal(actual.length % 3, 0);
    let maxMm = -1, sum = 0, exact = 0, worst;
    for (let i = 0; i < actual.length / 3; i++) {
        const a = Array.from(actual.slice(i * 3, i * 3 + 3));
        const e = Array.from(expected.slice(i * 3, i * 3 + 3));
        assert.ok([...a, ...e].every(Number.isFinite));
        const mm = Math.hypot(...a.map((v, c) => v - e[c])) * 1000;
        sum += mm * mm;
        if (mm === 0) exact++;
        if (mm > maxMm) { maxMm = mm; worst = {vertex: i, actual: a, expected: e}; }
    }
    return {passed: maxMm < gateMm, strict: true, gateMm, maxMm,
        rmsMm: Math.sqrt(sum / (actual.length / 3)), vertices: actual.length / 3, exact, worst};
}
function archive(name, value) {
    const raw = Buffer.from(JSON.stringify(value) + '\n'), encoded = gzipSync(raw);
    fs.writeFileSync(path.join(out, name), encoded);
    report.artifacts.push({file: name, sha256: sha(encoded), decodedSHA256: sha(raw), bytes: encoded.length});
}

try {
    bind(path.relative(ROOT, path.join(oracle, 'report.json')));
    const native = JSON.parse(fs.readFileSync(path.join(oracle, 'report.json')));
    assert.equal(native.status, 'observed-awaiting-independent-comparison');
    assert.deepEqual(native.cases.map(c => c.weight), [0, .25, 1]);
    for (const [p, digest] of Object.entries(native.inputs)) assert.equal(hash(p), digest);
    const own = ['tools/critic/compare-wardrobe-native.mjs', coupling + 'cpu-refit.mjs',
        coupling + 'read-cache.py', coupling + 'inventory-v1.json', coupling + 'proof-v1/report.json',
        'packages/core/src/figure/IdentityCatalogue.js', 'packages/core/src/figure/IdentityTargets.js',
        'assets/identity/catalogue.json', 'assets/identity/targets/torso.bin', 'assets/identity/targets/legs.bin'];
    for (const p of own) {
        bind(p);
        const dest = path.join(out, 'source', p);
        fs.mkdirSync(path.dirname(dest), {recursive: true});
        fs.copyFileSync(path.join(ROOT, p), dest);
    }
    assert.equal(hash(coupling + 'cpu-refit.mjs'), 'ef7d111cd220a555abe0cb225ab5d18a6715903bc6d20e1526269b86777791e4');
    const inventory = JSON.parse(read(coupling + 'inventory-v1.json'));
    for (const p of ['packages/core/src/figure/IdentityCatalogue.js', 'packages/core/src/figure/IdentityTargets.js',
        'assets/identity/catalogue.json', 'assets/identity/targets/torso.bin', 'assets/identity/targets/legs.bin'])
        assert.equal(hash(p), inventory.files.find(f => f.path === p).sha256, p);
    const cached = JSON.parse(execFileSync('python3', [path.join(ROOT, coupling, 'read-cache.py')], {maxBuffer: 32 * 1024 * 1024}));
    const model = parseMhclo(cached.mhclo), indices = requiredIndices(model);
    const nativeModel = decodeBound(oracle, native.nativeModel);
    for (const key of ['x_scale', 'y_scale', 'z_scale'])
        assert.deepEqual(nativeModel[key], [...model.scales[key].indices, model.scales[key].denominator]);
    assert.equal(nativeModel.rules.length, model.rules.length);
    for (const [i, rule] of model.rules.entries()) {
        assert.equal(nativeModel.rules[i].id, i);
        assert.deepEqual(nativeModel.rules[i].indices, rule.indices);
        assert.deepEqual(nativeModel.rules[i].weights, rule.weights);
        assert.deepEqual(nativeModel.rules[i].offsets, rule.offsets.map(Math.fround));
    }
    report.nativeParserMatches = true;
    const cases = native.cases.map(c => decodeBound(oracle, c.artifact));
    const neutral = cases[0].bodyPositions;
    assert.equal(neutral.length, 19158 * 3);
    const catalogue = new IdentityCatalogue(JSON.parse(read('assets/identity/catalogue.json')));
    const targets = new IdentityTargets(catalogue, {baseUrl: 'file:///', fetchBytes: async url => {
        const data = read('assets/identity/' + url.slice('file:///'.length));
        return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }});
    await targets.loadRegions(['torso', 'legs']);
    let fullDelta, fullShaped;
    for (const c of cases) {
        assert.equal(c.bodyPositions.length, neutral.length);
        assert.equal(c.garmentPositions.length, 2197 * 3);
        assert.deepEqual(c.garmentPolygons, cases[0].garmentPolygons);
        assert.deepEqual(c.bodyMatrix, cases[0].bodyMatrix);
        assert.deepEqual(c.garmentMatrix, cases[0].garmentMatrix);
        const fit = fitMhclo(model, compactBody(c.bodyPositions, indices));
        assert.deepEqual(fit.scale, c.fitterObservation.scale);
        const values = {'torso/measure-shoulder-dist-decr-incr': c.weight, 'legs/upperlegs-height-decr-incr': c.weight};
        const stack = catalogue.resolve(values);
        assert.deepEqual(stack.map(t => ({file: t.region + '/' + t.target, weight: t.weight})),
            c.appliedTargets.filter(t => t.weight !== 0));
        const delta = new Float64Array(neutral.length);
        targets.useBasemeshSpace().apply(delta, stack, {axis: AXIS_BLENDER});
        const nativeDelta = c.bodyPositions.map((v, i) => v - neutral[i]);
        const shaped = Float64Array.from(neutral, (v, i) => v + delta[i]);
        const shapedFit = fitMhclo(model, compactBody(shaped, indices));
        const result = {weight: c.weight, values, stack,
            nativeInputGarment: metric(fit.positions, c.garmentPositions, .1),
            bodyDelta: metric(delta, nativeDelta, .001),
            sdkShapedGarment: metric(shapedFit.positions, c.garmentPositions, .1),
            scale: fit.scale, sdkScale: shapedFit.scale};
        result.passed = result.nativeInputGarment.passed && result.bodyDelta.passed && result.sdkShapedGarment.passed;
        result.interpretableAfterNeutral = c.weight === 0 || report.cases[0].passed;
        report.cases.push(result);
        archive('case-' + String(c.weight).replace('.', '_') + '.json.gz', {weight: c.weight,
            jsNativeInputGarment: Array.from(fit.positions), sdkBodyDelta: Array.from(delta),
            nativeBodyDelta: nativeDelta, sdkBodyPositions: Array.from(shaped), sdkGarment: Array.from(shapedFit.positions)});
        if (c.weight === 1) { fullDelta = delta; fullShaped = shaped; }
        save();
    }
    // The earlier derived helper baseline now has an independent native absolute-coordinate answer.
    const oldProof = JSON.parse(read(coupling + 'proof-v1/report.json'));
    const baselineEntry = oldProof.artifacts.find(a => a.path.endsWith('/baseline.json.gz'));
    bind(baselineEntry.path);
    const oldRaw = read(baselineEntry.path);
    assert.equal(sha(oldRaw), baselineEntry.sha256);
    const oldDecoded = gunzipSync(oldRaw);
    assert.equal(sha(oldDecoded), baselineEntry.decodedSHA256);
    report.cachedAbsoluteBody = metric(JSON.parse(oldDecoded).positions, neutral, .001);
    report.cachedAbsoluteHelpers = metric(JSON.parse(oldDecoded).positions.slice(13380 * 3), neutral.slice(13380 * 3), .001);
    report.cachedAbsoluteHelpers.worstOriginalVertex = report.cachedAbsoluteHelpers.worst.vertex + 13380;

    const expected = cases[2].garmentPositions;
    const wrongIndex = structuredClone(model);
    wrongIndex.rules[0].indices[0] = wrongIndex.rules[0].indices[1];
    const wrongAxis = structuredClone(model);
    for (const r of wrongAxis.rules) r.offsets[1] *= -1;
    const withoutHelpers = Float64Array.from(neutral, (v, i) => v + (i < 13380 * 3 ? fullDelta[i] : 0));
    const injected = Float64Array.from(expected);
    injected[0] += .0002;
    const corruptions = {
        validButWrongHelperIndex: fitMhclo(wrongIndex, compactBody(fullShaped, indices)).positions,
        reversedOffsetAxis: fitMhclo(wrongAxis, compactBody(fullShaped, indices)).positions,
        omittedHelperTargetDeltas: fitMhclo(model, compactBody(withoutHelpers, indices)).positions,
        injectedPointTwoMillimetreError: injected,
    };
    for (const [name, positions] of Object.entries(corruptions)) {
        const cleanParent = name === 'injectedPointTwoMillimetreError'
            ? metric(expected, expected, .1) : report.cases[2].sdkShapedGarment;
        report.corruptions[name] = {...metric(positions, expected, .1),
            cleanParent: name === 'injectedPointTwoMillimetreError' ? 'native original' : 'SDK full-weight original',
            cleanParentResult: cleanParent, interpretable: cleanParent.passed};
        archive(name + '.json.gz', {garmentPositions: Array.from(positions)});
        assert.equal(report.corruptions[name].passed, false, name + ' did not trip the native comparator');
    }
    for (const [p, digest] of Object.entries(report.inputs)) assert.equal(hash(p), digest);
    for (const [p, digest] of Object.entries(native.inputs)) assert.equal(hash(p), digest);
    report.nativeSeededPassed = report.cases.every(c => c.passed && c.interpretableAfterNeutral);
    report.cachedHelperBaselinePassed = report.cachedAbsoluteBody.passed && report.cachedAbsoluteHelpers.passed;
    report.corruptionsValidated = Object.values(report.corruptions).every(c => c.interpretable && !c.passed);
    report.passed = report.nativeSeededPassed && report.cachedHelperBaselinePassed && report.corruptionsValidated;
    report.status = 'compared';
} catch (error) {
    report.status = 'failed';
    report.errors.push(error.stack);
    throw error;
} finally {
    report.finished = new Date().toISOString();
    save();
    console.log(JSON.stringify({out, status: report.status, passed: report.passed, cases: report.cases.length}));
}
