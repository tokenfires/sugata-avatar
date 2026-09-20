// Numerical review of frozen CPU-skinned snapshots taken during actual GPU affect runs.
// This adapter does not render, alter geometry, or assert that the candidate is qualified.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { readGlb, readPrimitive, readAccessor } from '../lut-bake/glb.mjs';
import { compare, topology, selftest, reconstructAcceptedSource } from './collar_clearance_review.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ARCHIVE = path.join(ROOT, 'captures/collar-expression-stress-2026-09-16');
const ID = 'female_casualsuit01';
const PREVIOUS = '44ebc3eb3a09408a3563d369ae74be15a5bc4beb8040bc43c2c5446d6e65c783';
const CANDIDATE = 'd81a6730bde9d8fee4641e18d6f9f0e3922af420bb68eea3f44b661896aeec3a';
const GEOMETRY = 'ca65319add5a41147df9d894aebe6441a9ab6f5131ee639dd49c3bef74861e5e';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sha = file => hash(fs.readFileSync(file));
const relative = file => path.relative(ROOT, file);
const point = (positions, index) => Array.from(positions.slice(index * 3, index * 3 + 3));

function triangles(mesh, selected) {
    return selected.map(id => {
        const indices = Array.from(mesh.indices.slice(id * 3, id * 3 + 3));
        const vertices = indices.map(index => point(mesh.positions, index));
        return { id, indices, vertices,
            min: [0, 1, 2].map(k => Math.min(...vertices.map(v => v[k]))),
            max: [0, 1, 2].map(k => Math.max(...vertices.map(v => v[k]))) };
    });
}

function summary(result, selected = null) {
    const rows = selected === null ? result.rows : result.rows.filter(row => selected.includes(row.teeTriangle));
    const minimum = rows.reduce((best, row) => row.minimum.distance < best.distance
        ? { teeTriangle: row.teeTriangle, ...row.minimum } : best, { distance: Infinity });
    return {
        triangleCount: rows.length, targetTriangleCount: result.targetTriangleCount, minimum,
        crossingTriangles: rows.filter(row => row.minimum.distance === 0).map(row => row.teeTriangle),
        maximumAbsoluteWinding: result.winding === null ? null : Math.max(...rows.map(row => Math.abs(row.winding))),
        windingInsideTriangles: result.winding === null ? null : rows.filter(row => Math.abs(row.winding) > 0.5).map(row => row.teeTriangle),
        rayParity: result.rayParity === null ? null : {
            inside: rows.reduce((sum, row) => sum + row.parity.filter(p => p.inside === true).length, 0),
            outside: rows.reduce((sum, row) => sum + row.parity.filter(p => p.inside === false && !p.ambiguous).length, 0),
            ambiguous: rows.reduce((sum, row) => sum + row.parity.filter(p => p.ambiguous).length, 0)
        }
    };
}

function validateMesh(mesh, primitive) {
    assert.ok(mesh, 'Required mesh is missing');
    assert.equal(mesh.positions.length, primitive.positions.length);
    assert.ok(mesh.positions.every(Number.isFinite), `${mesh.id}: non-finite position`);
    assert.deepEqual(mesh.fullIndices, Array.from(primitive.indices), `${mesh.id}: source index mismatch`);
    assert.equal(mesh.drawnIndices.length % 3, 0);
    assert.ok(mesh.drawnIndices.every(i => Number.isInteger(i) && i >= 0 && i < primitive.vertexCount));
}

function verifyCaptureInstrument(captureDir, file, expected) {
    // Shared helpers already live in immutable earlier archives; the new capture
    // may bind those in place rather than copying them into its own directory.
    const candidates = [path.join(captureDir, file), path.join(captureDir, path.basename(file)), path.join(ROOT, file)];
    const frozen = candidates.find(candidate => fs.existsSync(candidate));
    assert.ok(frozen, `Frozen capture instrument missing: ${file}`);
    assert.equal(sha(frozen), expected, `Frozen capture instrument changed: ${file}`);
    return { file: relative(frozen), sha256: expected };
}

function combinedSummary(states, arm) {
    const own = states.filter(state => state.arm === arm);
    const min = field => own.reduce((best, state) => state[field].minimum.distance < best.distance
        ? { id: state.id, step: state.step, time: state.time, ...state[field].minimum } : best, { distance: Infinity });
    return {
        states: own.length, fullBodyMinimum: min('fullBody'), retainedBraMinimum: min('retainedBra'),
        bodyCrossingStates: own.filter(state => state.fullBody.crossingTriangles.length).map(state => state.id),
        braCrossingStates: own.filter(state => state.retainedBra.crossingTriangles.length).map(state => state.id),
        bodyWindingInsideStates: own.filter(state => state.fullBody.windingInsideTriangles.length).map(state => state.id),
        bodyParityInsideStates: own.filter(state => state.fullBody.rayParity.inside > 0).map(state => state.id),
        bodyParityAmbiguousStates: own.filter(state => state.fullBody.rayParity.ambiguous > 0).map(state => state.id),
        ...(arm === 'owned' ? { interiorFullBodyMinimum: min('liningFullBody'), interiorRetainedBraMinimum: min('liningRetainedBra') } : {})
    };
}

export function runStressReview(captureDir, outDir) {
    captureDir = path.resolve(captureDir); outDir = path.resolve(outDir);
    assert.ok(outDir.startsWith(ARCHIVE + path.sep), 'Keep stress outputs in their separate archive');
    assert.equal(fs.existsSync(outDir), false, 'Use a fresh output directory; historical evidence is immutable');
    const captureFile = path.join(captureDir, 'report.json');
    const capture = JSON.parse(fs.readFileSync(captureFile));
    assert.equal(capture.completed, true, 'Wait for the complete GPU capture report');
    assert.equal(capture.candidateSHA256, CANDIDATE);
    assert.equal(capture.previousSHA256, PREVIOUS);
    assert.equal(capture.runs.length, 4);
    fs.mkdirSync(outDir, { recursive: true });

    const sourceReconstruction = reconstructAcceptedSource(outDir);
    const sourceFile = sourceReconstruction.file;
    assert.equal(sha(sourceFile), PREVIOUS);
    const candidateFile = path.join(ROOT, 'captures/collar-window-2026-09-16/casual-collar-interior-v1.glb');
    const geometryFile = path.join(ROOT, 'captures/collar-clearance-paused-2026-09-13/casual-collar-v2.glb');
    assert.equal(sha(candidateFile), CANDIDATE); assert.equal(sha(geometryFile), GEOMETRY);
    const source = readPrimitive(readGlb(sourceFile), ID);
    const glb = readGlb(candidateFile), candidate = readPrimitive(glb, ID);
    const geometry = readPrimitive(readGlb(geometryFile), ID);
    assert.deepEqual(candidate.positions, geometry.positions);
    assert.deepEqual(candidate.normals, geometry.normals);
    assert.deepEqual(candidate.indices, source.indices);
    assert.deepEqual(candidate.indices, geometry.indices);
    const descriptor = glb.json.meshes.find(mesh => mesh.name === ID).extras.sugataInterior;
    assert.equal(descriptor.sourceVertexCount, candidate.vertexCount);
    assert.equal(descriptor.sourceTriangleCount, candidate.indices.length / 3);
    const band = descriptor.triangles;
    assert.equal(band.length, 140); assert.equal(new Set(band).size, 140);
    const bandIndices = band.flatMap(t => Array.from(candidate.indices.slice(t * 3, t * 3 + 3)));
    const moved = new Set(), selected = [];
    for (let i = 0; i < source.vertexCount; i++) {
        if (point(source.positions, i).some((v, k) => v !== candidate.positions[i * 3 + k])) moved.add(i);
    }
    for (let t = 0; t < source.indices.length; t += 3) {
        if (Array.from(source.indices.slice(t, t + 3)).some(i => moved.has(i))) selected.push(t / 3);
    }
    assert.equal(moved.size, 96); assert.equal(selected.length, 180);
    assert.ok(band.every(t => selected.includes(t)));

    const bodyFile = path.join(ROOT, 'assets/wardrobe/body/g050.glb');
    const braFile = path.join(ROOT, 'assets/wardrobe/foundation_bra/g050.glb');
    for (const file of [bodyFile, braFile]) assert.equal(sha(file), capture.sourceHashes[relative(file)]);
    const body = readPrimitive(readGlb(bodyFile), 'base.001');
    const braGlb = readGlb(braFile), bra = readPrimitive(braGlb, 'foundation_bra');
    const braPrimitive = braGlb.json.meshes.find(mesh => mesh.name === 'foundation_bra').primitives[0];
    const mask = readAccessor(braGlb, braPrimitive.attributes._UNDER_FEMALE_CASUALSUIT01).data;
    const retained = [], retainedOriginalTriangleIds = [];
    for (let t = 0; t < bra.indices.length; t += 3) {
        const ids = Array.from(bra.indices.slice(t, t + 3));
        if (ids.every(i => mask[i] <= 0.5)) { retained.push(...ids); retainedOriginalTriangleIds.push(t / 3); }
    }

    const report = {
        version: 1, completed: false, createdAt: new Date().toISOString(),
        scope: 'Whole-triangle clearance and closed-body winding/parity for discrete CPU-skinned snapshots taken during actual GPU affect/gesture runs. Previous accepted geometry is a matched control, never assumed to fail.',
        captureReport: { file: relative(captureFile), sha256: sha(captureFile) },
        sourceReconstruction,
        assets: [sourceFile, candidateFile, geometryFile, bodyFile, braFile].map(file => ({ file: relative(file), sha256: sha(file) })),
        previousSHA256: PREVIOUS, candidateSHA256: CANDIDATE, candidateGeometrySHA256: GEOMETRY,
        changedVertexCount: moved.size, changedTriangles: selected, interior: descriptor,
        retainedBraOriginalTriangleIds: retainedOriginalTriangleIds,
        captureInstruments: Object.entries(capture.toolHashes ?? {}).map(([file, expected]) => verifyCaptureInstrument(captureDir, file, expected)),
        reviewInstruments: ['tools/figure-pipeline/collar_stress_review.mjs', 'tools/figure-pipeline/collar_clearance_review.mjs',
            'tools/figure-pipeline/hair_geometry.mjs', 'tools/figure-pipeline/hair_surface.mjs', 'tools/lut-bake/glb.mjs']
            .map(file => ({ file, sha256: sha(path.join(ROOT, file)) })),
        analyticControls: selftest(), pairedRuns: [], inputs: [], states: [],
        method: {
            distance: 'Minimum Euclidean separation over every point on each of the 180 changed-incident triangles against every full-body / retained-bra triangle: vertex-face and edge-edge features plus separate intersection predicate; exhaustive AABB lower-bound pruning.',
            intersectionToleranceMetres: 1e-10,
            containment: 'Compensated solid-angle winding and five independent ray-parity directions at each triangle centroid. For a disjoint triangle and a closed target, a consistent exterior classification extends over that triangle. Crossed triangles retain centroid diagnostics but do not inherit an all-points exterior claim.',
            localNormals: 'Order-4 dense local-normal signed distances are diagnostics, not global inside/outside classification.',
            interior: '140 exact coincident source triangles; position/index equality verified against the real runtime owner snapshot.',
            reuse: 'Only byte-identical serialized tee/body/bra position arrays and retained indices share a geometric result.'
        },
        limits: [
            'Sampled times, one deterministic trace per hair: no continuous-time or arbitrary gesture/identity qualification.',
            'Snapshot positions are CPU-skinned during the GPU run, not GPU vertex readback.',
            'Only the changed-incident 180 faces and contained 140-face interior are reviewed; unchanged garment surfaces are not certified.',
            'The retained bra is open and has no canonical enclosed volume; unsigned separation only.',
            'Floating-point geometric predicates, not interval bounds. Global body self-intersections are not audited.',
            'Visual quality, appearance in motion, and foundation coverage require the separate captured images and review.'
        ]
    };
    assert.ok(report.captureInstruments.length > 0, 'Capture instruments must be hash-bound');
    for (const instrument of report.reviewInstruments) {
        const frozen = path.join(outDir, 'instruments', instrument.file);
        fs.mkdirSync(path.dirname(frozen), { recursive: true });
        fs.copyFileSync(path.join(ROOT, instrument.file), frozen, fs.constants.COPYFILE_EXCL);
        assert.equal(sha(frozen), instrument.sha256);
        instrument.frozenFile = relative(frozen);
    }
    const save = () => fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
    save();
    const cache = new Map();
    for (const hair of ['bob02', 'bob01']) {
        const previousRun = capture.runs.find(run => run.hair === hair && run.arm === 'previous');
        const ownedRun = capture.runs.find(run => run.hair === hair && run.arm === 'owned');
        assert.ok(previousRun && ownedRun);
        assert.deepEqual(previousRun.states, ownedRun.states, 'Paired native telemetry or renderer epochs differ');
        assert.deepEqual(previousRun.phases, ownedRun.phases, 'Paired command/gesture schedules differ');
        for (const [run, expected] of [[previousRun, PREVIOUS], [ownedRun, CANDIDATE]]) {
            assert.deepEqual(run.errors, []);
            assert.equal(run.setup.seed, 20260807, 'Unexpected motion seed');
            const reported = run.assetSHA256 ?? run.routedAssetSHA256;
            if (reported !== undefined) assert.equal(reported, expected);
            const responses = run.assetResponses ?? run.loadedAssets;
            assert.ok(responses?.length > 0, `${run.name}: actual loader response must be bound`);
            assert.ok(responses.every(response => response.sha256 === expected));
        }
        const steps = previousRun.geometry.map(entry => entry.step).sort((a, b) => a - b);
        assert.equal(new Set(steps).size, steps.length);
        assert.deepEqual(ownedRun.geometry.map(entry => entry.step).sort((a, b) => a - b), steps);
        assert.equal(steps[0], 0); assert.equal(steps.at(-1), 1080);
        report.pairedRuns.push({ hair, previous: previousRun.name, owned: ownedRun.name, steps,
            previousTelemetry: previousRun.states, ownedTelemetry: ownedRun.states,
            previousSetup: previousRun.setup, ownedSetup: ownedRun.setup });
        for (const step of steps) {
            const load = run => {
                const entry = run.geometry.find(item => item.step === step);
                const file = path.join(captureDir, entry.file);
                assert.equal(sha(file), entry.sha256);
                report.inputs.push({ file: relative(file), sha256: entry.sha256 });
                return JSON.parse(gunzipSync(fs.readFileSync(file)));
            };
            const previous = load(previousRun), owned = load(ownedRun);
            assert.equal(previous.time, owned.time); assert.deepEqual(previous.rig, owned.rig);
            assert.deepEqual(previous.telemetry, owned.telemetry, 'Paired snapshot telemetry differs');
            assert.ok(Math.abs(previous.time - step / 60) < 1e-9);
            const previousBody = previous.meshes.find(mesh => mesh.id === 'body');
            const previousBra = previous.meshes.find(mesh => mesh.id === 'foundation_bra');
            const currentBody = owned.meshes.find(mesh => mesh.id === 'body');
            const currentBra = owned.meshes.find(mesh => mesh.id === 'foundation_bra');
            assert.deepEqual(previousBody, currentBody, 'Paired body geometry differs');
            assert.deepEqual(previousBra, currentBra, 'Paired foundation geometry differs');
            validateMesh(currentBody, body); validateMesh(currentBra, bra);
            assert.deepEqual(currentBra.drawnIndices, retained);
            const ownedTee = owned.meshes.find(mesh => mesh.id === ID);
            assert.deepEqual(owned.lining.positions, ownedTee.positions, 'Interior does not coincide with outer');
            assert.deepEqual(owned.lining.indices, bandIndices);
            assert.ok(previous.lining === undefined || previous.lining === null, 'Previous asset unexpectedly has an interior');
            for (const [arm, snapshot, primitive] of [['previous', previous, source], ['owned', owned, candidate]]) {
                const tee = snapshot.meshes.find(mesh => mesh.id === ID);
                validateMesh(tee, primitive);
                const id = `${hair}-${arm}-${String(step).padStart(4, '0')}`;
                const key = hash(JSON.stringify({ tee: tee.positions, body: currentBody.positions,
                    bra: currentBra.positions, retainedIndices: retained }));
                let result = cache.get(key), reusedFrom = null;
                if (result) reusedFrom = result.id;
                else {
                    const bm = { positions: currentBody.positions, indices: currentBody.fullIndices };
                    const brm = { positions: currentBra.positions, indices: retained };
                    const patch = triangles({ positions: tee.positions, indices: tee.fullIndices }, selected);
                    result = { id, bodyTopology: topology(bm, body.positions), retainedBraTopology: topology(brm, bra.positions),
                        fullBody: compare(patch, bm, { gridSteps: 4, globalInside: true }),
                        retainedBra: compare(patch, brm, { gridSteps: 4 }) };
                    assert.ok(Number.isFinite(result.fullBody.minimum.distance));
                    assert.ok(Number.isFinite(result.retainedBra.minimum.distance));
                    cache.set(key, result);
                }
                const detailFile = path.join(outDir, id + '.json');
                const detail = { ...result, id, hair, arm, step, time: snapshot.time,
                    geometryArraySHA256: key, reusedIdenticalGeometryFrom: reusedFrom,
                    telemetry: snapshot.telemetry ?? null,
                    pairedRigBodyBraIdentical: true, realOwnerPositionsCoincide: arm === 'owned' ? true : null };
                fs.writeFileSync(detailFile, JSON.stringify(detail, null, 2), { flag: 'wx' });
                const row = { id, hair, arm, step, time: snapshot.time, geometryArraySHA256: key,
                    reusedIdenticalGeometryFrom: reusedFrom, file: relative(detailFile), sha256: sha(detailFile),
                    telemetry: snapshot.telemetry ?? null,
                    pairedRigBodyBraIdentical: true, realOwnerPositionsCoincide: arm === 'owned' ? true : null,
                    bodyTopology: result.bodyTopology, retainedBraTopology: result.retainedBraTopology,
                    fullBody: summary(result.fullBody), retainedBra: summary(result.retainedBra),
                    ...(arm === 'owned' ? { liningFullBody: summary(result.fullBody, band), liningRetainedBra: summary(result.retainedBra, band) } : {}) };
                report.states.push(row); save();
                console.log(JSON.stringify({ id, bodyMinMm: row.fullBody.minimum.distance * 1000,
                    braMinMm: row.retainedBra.minimum.distance * 1000,
                    bodyCrossings: row.fullBody.crossingTriangles, braCrossings: row.retainedBra.crossingTriangles,
                    parity: row.fullBody.rayParity, reusedFrom }));
            }
        }
    }
    report.distinctGeometryStates = cache.size;
    report.summary = { previous: combinedSummary(report.states, 'previous'), owned: combinedSummary(report.states, 'owned') };
    report.completed = true; save();
    return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (!process.argv[2] || !process.argv[3]) throw Error('Usage: node collar_stress_review.mjs COMPLETE_CAPTURE_DIRECTORY FRESH_STRESS_OUTPUT_DIRECTORY');
    runStressReview(process.argv[2], process.argv[3]);
}
