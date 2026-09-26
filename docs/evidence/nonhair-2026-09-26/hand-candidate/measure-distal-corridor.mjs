// New postprocessing only. Input geometry is never modified. Writes fresh diagnostic files.
// node docs/evidence/nonhair-2026-09-26/hand-candidate/measure-distal-corridor.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { readGlb, readPrimitive, readAccessor } from '../../../../tools/lut-bake/glb.mjs';
import { triangles, projectedIndex, certifyLateralCorridor } from './distal-corridor.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const BASE = path.join(ROOT, 'captures/hand-attribution-2026-09-26/primary-v4');
const OUT = fileURLToPath(new URL('./', import.meta.url));
const hash = b => createHash('sha256').update(b).digest('hex'), hashJSON = v => hash(JSON.stringify(v));
const read = p => fs.readFileSync(p), readJSON = p => JSON.parse(read(p));
for (const name of ['distal-regions-v1.json', 'distal-corridor-v1.json']) assert.ok(!fs.existsSync(path.join(OUT, name)), 'Fresh outputs required');
const rawReport = read(path.join(BASE, 'report.json')), report = JSON.parse(rawReport), seal = readJSON(path.join(BASE, 'seal.json'));
assert.equal(hash(rawReport), seal.reportSHA256); assert.equal(report.completed, true); assert.equal(report.mode, 'primary');
assert.equal(report.manifestSHA256, 'fc0e017fba7da12f6c511b53e705b2441b440fa8cb8731bd65f36a839514793d');
assert.equal(hash(read(path.join(BASE, 'manifest.json'))), report.manifestSHA256);
assert.deepEqual(report.runs.map(r => r.arm), ['A', 'B', 'C']);
const ids = ['body', 'foundation_bra', 'foundation_briefs', 'female_casualsuit01', 'shoes01'];
const sources = {}, primitives = {}, glbs = {};
for (const id of ids) {
    const rel = `assets/wardrobe/${id}/g050.glb`, source = path.join(BASE, 'source', rel);
    sources[rel] = hash(read(source)); assert.equal(sources[rel], report.sourceHashes[rel]);
    glbs[id] = readGlb(source); primitives[id] = readPrimitive(glbs[id], id === 'body' ? 'base.001' : id);
}
const readerPath = 'tools/lut-bake/glb.mjs'; sources[readerPath] = hash(read(path.join(ROOT, readerPath)));
assert.equal(sources[readerPath], report.sourceHashes[readerPath]);
for (const name of ['distal-corridor.mjs', 'measure-distal-corridor.mjs', 'distal-corridor.selftest.mjs']) sources[name] = hash(read(path.join(OUT, name)));
const priorPath = path.join(ROOT, 'captures/hand-attribution-2026-09-26/analysis-v4/analysis.json'), prior = readJSON(priorPath);
assert.equal(prior.completed, true); assert.equal(prior.captureReportSHA256, seal.reportSHA256);
const b = primitives.body, g = glbs.body, primitive = g.json.meshes[0].primitives[0];
const joints = readAccessor(g, primitive.attributes.JOINTS_0).data, weights = readAccessor(g, primitive.attributes.WEIGHTS_0).data;
const names = g.json.skins[0].joints.map(i => g.json.nodes[i].name);
const entries = v => [0, 1, 2, 3].map(k => ({ name: names[joints[v * 4 + k]], weight: weights[v * 4 + k] }));
const sum = (v, re) => entries(v).reduce((s, x) => s + (re.test(x.name) ? x.weight : 0), 0);
const distalRE = /^(lowerarm|hand|thumb|index|middle|ring|pinky)_/, armRE = /^(upperarm|lowerarm|hand|thumb|index|middle|ring|pinky)_/;
const distalSupport = Array.from({ length: b.vertexCount }, (_, v) => sum(v, distalRE) > 0);
const armSupport = Array.from({ length: b.vertexCount }, (_, v) => sum(v, armRE) > 0);
const faces = Array.from({ length: b.indices.length / 3 }, (_, f) => Array.from(b.indices.slice(f * 3, f * 3 + 3)));
const distal = { l: [], r: [] }, legacy = {}, connectedSeam = {}, bodyExceptOwnDistal = {}, bodyExceptOwnDistalSeam = {};
const bodyNonArm = faces.flatMap((vs, f) => vs.some(v => armSupport[v]) ? [] : [f]);
for (const [f, vs] of faces.entries()) if (vs.some(v => distalSupport[v])) {
    const side = vs.every(v => b.positions[v * 3] > 0) ? 'l' : vs.every(v => b.positions[v * 3] < 0) ? 'r' : null;
    assert.ok(side, 'Any midline-crossing distal face requires a new region review'); distal[side].push(f);
}
const exactPositionKey = v => Array.from(b.positions.slice(v * 3, v * 3 + 3)).join(',');
const regionSummary = {};
for (const side of ['l', 'r']) {
    const re = new RegExp('^(hand|thumb|index|middle|ring|pinky)_.*' + side + '$');
    const handWeights = Array.from({ length: b.vertexCount }, (_, v) => sum(v, re));
    legacy[side] = faces.flatMap((vs, f) => vs.every(v => handWeights[v] >= .5) ? [f] : []);
    const selected = new Set(distal[side]), selectedPositions = new Set(distal[side].flatMap(f => faces[f]).map(exactPositionKey));
    assert.ok(legacy[side].every(f => selected.has(f)));
    bodyExceptOwnDistal[side] = faces.flatMap((_, f) => selected.has(f) ? [] : [f]);
    connectedSeam[side] = bodyExceptOwnDistal[side].filter(f => faces[f].some(v => selectedPositions.has(exactPositionKey(v))));
    const seam = new Set(connectedSeam[side]);
    bodyExceptOwnDistalSeam[side] = bodyExceptOwnDistal[side].filter(f => !seam.has(f));
    const allVertices = [...new Set(distal[side].flatMap(f => faces[f]))];
    regionSummary[side] = { distalFaces: distal[side].length, legacyFaces: legacy[side].length,
        addedBeyondLegacy: distal[side].length - legacy[side].length,
        boundaryFaces: distal[side].filter(f => !faces[f].every(v => distalSupport[v])).length,
        incidentVertices: allVertices.length, connectedSeamFaces: connectedSeam[side].length,
        sourceBounds: [0, 1, 2].map(k => [Math.min(...allVertices.map(v => b.positions[v * 3 + k])), Math.max(...allVertices.map(v => b.positions[v * 3 + k]))]) };
}
const straySupport = [];
for (let v = 0; v < b.vertexCount; v++) {
    const x = b.positions[v * 3];
    if (entries(v).some(e => e.weight > 0 && distalRE.test(e.name) && ((x < 0 && e.name.endsWith('_l')) || (x > 0 && e.name.endsWith('_r')))))
        straySupport.push({ vertex: v, position: Array.from(b.positions.slice(v * 3, v * 3 + 3)), entries: entries(v) });
}
const regions = { version: 1, bodySHA256: sources['assets/wardrobe/body/g050.glb'], bodyVertices: b.vertexCount, bodyFaces: faces.length,
    method: 'Union of all positive lowerarm/hand/finger skin support, closed over incident full triangles. Partition by exact source-rest x sign; no selected face crosses x=0. Boundary triangles are retained. This is exact source coverage, not independently proven anatomical segmentation.',
    seamMethod: 'For each side, only nonselected body faces sharing an exact source-rest position with a selected face. No rounded position weld, distance expansion or dynamic exclusion.',
    bodyNonArmMethod: 'All full body faces with no positive upperarm/lowerarm/hand/finger support at any vertex, either side. Excludes all proximal arms and mixed shoulder faces; cannot certify whole-body clearance.',
    summary: regionSummary, straySupport, distal, legacy, connectedSeam, bodyExceptOwnDistal, bodyExceptOwnDistalSeam, bodyNonArm };
const regionBytes = JSON.stringify(regions, null, 2) + '\n'; fs.writeFileSync(path.join(OUT, 'distal-regions-v1.json'), regionBytes, { flag: 'wx' });
const result = { version: 1, createdAt: new Date().toISOString(), completed: false, captureReportSHA256: seal.reportSHA256,
    manifestSHA256: report.manifestSHA256, priorSelectedCrossingAnalysisSHA256: hash(read(priorPath)), sourceHashes: sources,
    regionsSHA256: hash(regionBytes), regionSummary, bodyNonArmFaces: bodyNonArm.length,
    marginMetres: 0, marginPolicy: 'Zero is a separation diagnostic, not an approved product clearance margin. No candidate angles or passing threshold chosen.',
    certificate: 'For every query triangle, every target triangle with inclusive margin-expanded yz-AABB overlap must have its outward x bound strictly behind the query by more than margin. Arithmetic bounds round outward by one IEEE-754 ULP. Failed certification is unproven, not penetration.',
    targetPolicy: 'Full original body and worn topology, including hidden faces. Three explicit body-region alternatives; no clothing face is silently excluded. No hair, eye/cornea/accessory or continuous-motion claim.',
    poses: [] };
const save = () => fs.writeFileSync(path.join(OUT, 'distal-corridor-v1.json'), JSON.stringify(result, null, 2) + '\n');
save();
const compact = r => { const { failedFaceIds, ...rest } = r; return { ...rest, failedFaceIdsSHA256: hashJSON(failedFaceIds) }; };
for (const run of report.runs) {
    assert.equal(run.completed, true);
    for (const step of [0, 455, 637, 720]) {
        const record = run.geometry.find(x => x.step === step); assert.ok(record);
        const raw = read(path.join(BASE, record.file)); assert.equal(hash(raw), record.sha256);
        const decoded = gunzipSync(raw); assert.equal(hash(decoded), record.decodedSHA256); const s = JSON.parse(decoded);
        assert.equal(s.capture.arm, run.arm); assert.equal(s.capture.step, step); assert.equal(s.time, record.time);
        assert.deepEqual(s.meshes.map(m => m.id), ids);
        // Lateral world x is unchanged by the retained root transform; yz may rotate/translate.
        for (const [i, value] of [[0, 1], [1, 0], [2, 0], [4, 0], [8, 0], [12, 0]]) assert.equal(s.rig.Root[i], value);
        const all = {};
        for (const mesh of s.meshes) {
            assert.deepEqual(mesh.fullIndices, Array.from(primitives[mesh.id].indices));
            assert.equal(mesh.positions.length, primitives[mesh.id].positions.length);
            all[mesh.id] = triangles(mesh);
        }
        const worn = ids.filter(id => id !== 'body').flatMap(id => all[id]), wornIndex = projectedIndex(worn);
        const nonArmIndex = projectedIndex(bodyNonArm.map(f => all.body[f]));
        const sides = {};
        for (const side of ['l', 'r']) {
            const groups = { bodyExceptOwnDistal: projectedIndex(bodyExceptOwnDistal[side].map(f => all.body[f])),
                bodyExceptOwnDistalAndConnectedSeam: projectedIndex(bodyExceptOwnDistalSeam[side].map(f => all.body[f])),
                bodyNonArm: nonArmIndex, allWorn: wornIndex };
            sides[side] = {};
            for (const [queryName, selection] of Object.entries({ legacyHand: legacy[side], distalWithBoundary: distal[side] }))
                sides[side][queryName] = Object.fromEntries(Object.entries(groups).map(([name, index]) =>
                    [name, compact(certifyLateralCorridor(selection.map(f => all.body[f]), index, { side, marginMetres: 0 }))]));
        }
        const old = prior.runs.find(r => r.arm === run.arm).poses.find(p => p.step === step);
        result.poses.push({ arm: run.arm, step, time: s.time, file: record.file, sha256: record.sha256, decodedSHA256: record.decodedSHA256,
            priorSelectedCrossings: Object.fromEntries(['l', 'r'].map(side => [side, { trousers: old.sides[side].trousers.pairs, lowerBody: old.sides[side].lowerBody.pairs }])), sides });
        save(); console.log(`Measured ${run.arm} step ${step}: exact posed triangles, two query selections, four explicit target groups.`);
    }
}
result.completed = true; save();
console.log(JSON.stringify({ completed: true, poses: result.poses.length, regionsSHA256: result.regionsSHA256,
    reportSHA256: hash(read(path.join(OUT, 'distal-corridor-v1.json'))), regionSummary }, null, 2));
