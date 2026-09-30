// Independent endpoint arithmetic; no runtime bones, binding or asset writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {gunzipSync, gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {IdentityCatalogue} from '../../packages/core/src/figure/IdentityCatalogue.js';
import {IdentityTargets, AXIS_BLENDER} from '../../packages/core/src/figure/IdentityTargets.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const oracle = path.resolve(ROOT, process.argv[2] ?? 'captures/skeleton-native-oracle-2026-09-30-v1');
const out = path.resolve(ROOT, process.argv[3] ?? 'captures/skeleton-native-comparison-2026-09-30-v1');
assert.ok(!fs.existsSync(out));
fs.mkdirSync(out, {recursive: true});
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const read = p => fs.readFileSync(path.resolve(ROOT, p));
const hash = p => sha(read(p));
const identity = Array.from({length: 4}, (_, i) => Array.from({length: 4}, (_, j) => +(i === j)));
const report = {started: new Date().toISOString(), pid: process.pid, status: 'running', errors: [],
    inputs: {}, cases: [], corruptions: {}, artifacts: [],
    scope: 'All 106 endpoint means in three coupled body cases. No runtime matrices, skinning, appearance or whole-range pass.'};
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
function bind(p, copy = false) {
    report.inputs[p] = hash(p);
    if (copy) {
        const dest = path.join(out, 'source', p);
        fs.mkdirSync(path.dirname(dest), {recursive: true}); fs.copyFileSync(path.join(ROOT, p), dest);
    }
}
function decode(directory, entry) {
    const encoded = fs.readFileSync(path.join(directory, entry.file));
    assert.equal(sha(encoded), entry.sha256);
    const raw = gunzipSync(encoded); assert.equal(sha(raw), entry.decodedSHA256);
    return JSON.parse(raw);
}
function archive(name, value) {
    const raw = Buffer.from(JSON.stringify(value) + '\n'), encoded = gzipSync(raw);
    fs.writeFileSync(path.join(out, name), encoded);
    const entry = {file: name, sha256: sha(encoded), decodedSHA256: sha(raw), bytes: encoded.length};
    report.artifacts.push(entry); return entry;
}
function metric(actual, expected, gateMm, labels) {
    assert.equal(actual.length, expected.length); assert.equal(actual.length % 3, 0);
    let maxMm = -1, sum = 0, exact = 0, worst;
    const residuals = [];
    for (let i = 0; i < actual.length / 3; ++i) {
        const a = Array.from(actual.slice(i * 3, i * 3 + 3)), e = Array.from(expected.slice(i * 3, i * 3 + 3));
        assert.ok([...a, ...e].every(Number.isFinite));
        const mm = Math.hypot(...a.map((v, c) => v - e[c])) * 1000;
        sum += mm * mm; if (mm === 0) exact++;
        const row = {point: labels?.[i] ?? i, actual: a, expected: e, mm}; residuals.push(row);
        if (mm > maxMm) { maxMm = mm; worst = row; }
    }
    return {summary: {passed: maxMm < gateMm, strict: true, gateMm, maxMm,
        rmsMm: Math.sqrt(sum / residuals.length), points: residuals.length, exact, worst}, residuals};
}
function endpoints(table, groups, positions) {
    assert.equal(positions.length, 19158 * 3);
    return Object.keys(table).sort().flatMap(name => ['head', 'tail'].flatMap(end => {
        const s = table[name][end]; assert.ok(!('offset' in s));
        const ids = s.strategy === 'CUBE' ? groups[s.cube_name]
            : s.strategy === 'MEAN' ? s.vertex_indices : null;
        assert.ok(ids?.length, `${name}.${end} unresolved`);
        for (const id of ids) assert.ok(Number.isInteger(id) && id >= 0 && id < 19158);
        return [0, 1, 2].map(c => ids.reduce((sum, id) => sum + positions[id * 3 + c], 0) / ids.length);
    }));
}

try {
    const native = JSON.parse(read(path.join(oracle, 'report.json')));
    bind(path.relative(ROOT, path.join(oracle, 'report.json')));
    assert.equal(native.status, 'observed-awaiting-independent-comparison');
    assert.deepEqual(native.cases.map(c => [c.weight, c.mode]), [[0, 'refit'], [0, 'fresh'], [.25, 'refit'], [.25, 'fresh'], [1, 'refit'], [1, 'fresh']]);
    const parentPath = 'captures/wardrobe-native-oracle-2026-09-30-v2/report.json';
    bind(parentPath); assert.equal(hash(parentPath), native.parentNativeReportSHA256);
    const parent = JSON.parse(read(parentPath));
    for (const [p, h] of Object.entries(parent.inputs)) assert.equal(hash(p), h, p);
    for (const [p, h] of Object.entries(native.sourceHashes)) assert.equal(hash(p), h, p);
    for (const p of ['tools/critic/compare-skeleton-native.mjs',
        'docs/evidence/wardrobe-2026-09-30/skeleton-placement/PLAN.md',
        'packages/core/src/figure/IdentityCatalogue.js', 'packages/core/src/figure/IdentityTargets.js',
        'assets/identity/catalogue.json', 'assets/identity/targets/torso.bin', 'assets/identity/targets/legs.bin']) bind(p, true);
    const table = decode(oracle, native.rigTable), names = Object.keys(table).sort();
    assert.equal(names.length, 53);
    const labels = names.flatMap(n => ['head', 'tail'].map(e => `${n}.${e}`));
    report.endpointOrder = labels;
    const cases = native.cases.map(c => decode(oracle, c.artifact));
    const neutral = cases[0].bodyPositions;
    const catalogue = new IdentityCatalogue(JSON.parse(read('assets/identity/catalogue.json')));
    const targets = new IdentityTargets(catalogue, {baseUrl: 'file:///', fetchBytes: async url => {
        const b = read('assets/identity/' + url.slice('file:///'.length));
        return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    }});
    await targets.loadRegions(['torso', 'legs']);
    const observed = c => names.flatMap(n => ['head', 'tail'].flatMap(e => c.bones[n][e]));
    let full;
    for (const weight of [0, .25, 1]) {
        const refit = cases.find(c => c.weight === weight && c.mode === 'refit');
        const fresh = cases.find(c => c.weight === weight && c.mode === 'fresh');
        for (const c of [refit, fresh]) {
            assert.equal(c.space, 'blender-z-up-metres');
            assert.deepEqual(c.bodyMatrix, identity); assert.deepEqual(c.armatureMatrix, identity);
            assert.deepEqual(Object.keys(c.bones).sort(), names);
            assert.deepEqual(c.jointGroups, cases[0].jointGroups);
            for (const n of names) {
                assert.deepEqual(c.bones[n].poseBasis, identity);
                assert.equal(c.bones[n].parent, table[n].parent);
                for (const e of ['head', 'tail']) assert.deepEqual(c.upgradedRigTable.bones[n][e], table[n][e]);
            }
        }
        assert.deepEqual(refit.bodyPositions, fresh.bodyPositions);
        assert.deepEqual(refit.upgradedRigTable, fresh.upgradedRigTable);
        const values = {'torso/measure-shoulder-dist-decr-incr': weight, 'legs/upperlegs-height-decr-incr': weight};
        const stack = catalogue.resolve(values), delta = new Float64Array(neutral.length);
        targets.useBasemeshSpace().apply(delta, stack, {axis: AXIS_BLENDER});
        const shaped = Float64Array.from(neutral, (v, i) => v + delta[i]);
        const nativeMeans = endpoints(table, refit.jointGroups, refit.bodyPositions);
        const sdkMeans = endpoints(table, refit.jointGroups, shaped);
        const nativeEnds = observed(refit), freshEnds = observed(fresh);
        const strategy = names.flatMap(n => ['head', 'tail'].flatMap(e => refit.strategyEndpoints[n][e]));
        assert.deepEqual(nativeMeans, strategy);
        const comparisons = {
            nativeExistingVersusFresh: metric(nativeEnds, freshEnds, .1, labels),
            nativeInputMeans: metric(nativeMeans, nativeEnds, .1, labels),
            nativeInputFloat32: metric(nativeMeans.map(Math.fround), nativeEnds, .1, labels),
            sdkMeans: metric(sdkMeans, nativeEnds, .1, labels),
            sdkFloat32: metric(sdkMeans.map(Math.fround), nativeEnds, .1, labels),
            sdkBody: metric(shaped, refit.bodyPositions, .001),
        };
        const nativeSkin = {
            refit: metric(refit.nativeIdentityPoseSkin, refit.bodyPositions, .342),
            fresh: metric(fresh.nativeIdentityPoseSkin, fresh.bodyPositions, .342),
        };
        const r = {weight, values, stack, comparisons: Object.fromEntries(Object.entries(comparisons).map(([k,v]) => [k,v.summary])),
            nativeIdentityPoseOnly: Object.fromEntries(Object.entries(nativeSkin).map(([k,v]) => [k,v.summary])),
            nativeMatricesExactlyEqual: names.every(n => JSON.stringify(refit.bones[n].matrixLocal) === JSON.stringify(fresh.bones[n].matrixLocal)),
            nativeRollsExactlyEqual: names.every(n => refit.bones[n].roll === fresh.bones[n].roll)};
        r.passed = Object.values(r.comparisons).every(c => c.passed);
        r.interpretableAfterNeutral = weight === 0 || report.cases[0].passed;
        r.artifact = archive(`case-${String(weight).replace('.', '_')}.json.gz`, {
            weight, nativeMeans, sdkMeans, sdkBodyPositions: Array.from(shaped), sdkDelta: Array.from(delta), comparisons, nativeSkin});
        report.cases.push(r); save();
        if (weight === 1) full = {refit, shaped, delta, nativeEnds, sdkMeans, r};
    }
    const wrong = structuredClone(table);
    wrong.upperarm_l.head.cube_name = 'joint-r-shoulder';
    const noHelperDeltas = Float64Array.from(neutral, (v, i) => v + (i < 13380 * 3 ? full.delta[i] : 0));
    const injected = Array.from(full.sdkMeans); injected[0] += .0002;
    const mutations = {
        wrongShoulderGroup: endpoints(wrong, full.refit.jointGroups, full.shaped),
        omittedHelperDeltas: endpoints(table, full.refit.jointGroups, noHelperDeltas),
        wrongAxis: full.sdkMeans.flatMap((v, i, a) => i % 3 === 0 ? [v, a[i + 2], -a[i + 1]] : []),
        injectedPointTwoMillimetres: injected,
    };
    for (const [name, values] of Object.entries(mutations)) {
        const result = metric(values, full.nativeEnds, .1, labels);
        const mutation = metric(values, full.sdkMeans, .1, labels);
        const clean = full.r.comparisons.sdkMeans;
        report.corruptions[name] = {...result.summary, cleanParent: 'full-weight SDK endpoint means', cleanParentResult: clean,
            changedFromClean: mutation.summary.maxMm > 0, mutationMaxMm: mutation.summary.maxMm,
            interpretable: clean.passed && full.r.interpretableAfterNeutral};
        archive(`${name}.json.gz`, {endpoints: values, result, mutation});
        assert.ok(report.corruptions[name].changedFromClean && !result.summary.passed);
    }
    for (const [p,h] of Object.entries(report.inputs)) assert.equal(hash(p),h,p);
    for (const [p,h] of Object.entries(parent.inputs)) assert.equal(hash(p),h,p);
    for (const [p,h] of Object.entries(native.sourceHashes)) assert.equal(hash(p),h,p);
    report.passed = report.cases.every(c => c.passed && c.interpretableAfterNeutral)
        && Object.values(report.corruptions).every(c => c.interpretable && !c.passed && c.changedFromClean);
    report.status = 'compared';
} catch (error) {report.status = 'failed'; report.errors.push(error.stack); throw error;}
finally {report.finished = new Date().toISOString(); save(); console.log(JSON.stringify({out, status: report.status, passed: report.passed, cases: report.cases.length}));}
