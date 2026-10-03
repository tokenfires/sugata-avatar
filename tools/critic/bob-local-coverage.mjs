/** One fixed-mesh short-coverage construction; exact exported rest admission, no production writes. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Vector3, BufferGeometry, BufferAttribute } from 'three';
import { readGlb, readPrimitive, readAccessor } from '../lut-bake/glb.mjs';
import { encodeGlb, sha256, updateMovedFrames } from '../figure-pipeline/hair_fall.mjs';
import { SurfaceGrid, closestPointOnTriangle, scalpTransmittance } from '../figure-pipeline/hair_geometry.mjs';
import { measureHairSurface } from '../figure-pipeline/hair_surface.mjs';
import { decodePng } from './png.mjs';

const started = new Date().toISOString(), deadline = Date.now() + 300000;
const out = 'captures/bob-local-coverage-2026-10-02-v1';
const input = 'captures/bob-lower-fallback-v1/candidate.glb';
const bodyPath = 'assets/figures/figure_g050.glb';
const protectionPath = 'captures/bob-side-envelope-v3/candidate-report.json';
const pins = {
    [input]: '8c458428551ca546d2aac511dec3b516067d53050de9663a563b9884a4ae5fe7',
    [bodyPath]: 'b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14',
    [protectionPath]: 'dcbc7350777000eaba71c102214a4d1239179956a33684ff47000f68ef79fded'
};
assert.ok(!fs.existsSync(out), 'Preserve prior output.');
for (const [file, hash] of Object.entries(pins)) assert.equal(sha256(fs.readFileSync(file)), hash, file);
const sourcePaths = [
    ...Object.keys(pins), 'tools/critic/bob-local-coverage.mjs', 'tools/lut-bake/glb.mjs',
    'tools/figure-pipeline/hair_fall.mjs', 'tools/figure-pipeline/hair_geometry.mjs',
    'tools/figure-pipeline/hair_surface.mjs', 'tools/critic/png.mjs',
    'packages/core/src/motion/HairDynamics.js', 'package-lock.json',
    'docs/evidence/appearance-2026-10-02/root-coverage/LOCAL-CONTRACT.md'
];
const sourceHashes = Object.fromEntries(sourcePaths.map(file => [file, sha256(fs.readFileSync(file))]));
const originalGlb = readGlb(input), glb = readGlb(input);
const original = readPrimitive(originalGlb, 'hair_bob02');
const body = readPrimitive(readGlb(bodyPath), 'base.001');
const primitive = glb.json.meshes.find(mesh => mesh.name === 'hair_bob02').primitives[0];
const oldPrimitive = originalGlb.json.meshes.find(mesh => mesh.name === 'hair_bob02').primitives[0];
assert.equal(original.vertexCount, 652 + 496 * 34);
assert.equal(primitive.attributes.TANGENT, undefined);
const protectedCards = JSON.parse(fs.readFileSync(protectionPath)).selected;
assert.equal(protectedCards.length, 338);
assert.equal(new Set(protectedCards).size, 338);
const protectedSet = new Set(protectedCards);
const vertex = (card, ring, side) => 652 + card * 34 + ring * 2 + side;
const point = (positions, index) => new Vector3().fromArray(positions, index * 3);
const edge = (card, ring, side, positions = original.positions) => point(positions, vertex(card, ring, side));
const centre = (card, ring, positions = original.positions) => edge(card, ring, 0, positions).add(edge(card, ring, 1, positions)).multiplyScalar(0.5);
const span = (card, ring) => centre(card, ring).sub(centre(card, ring - 1));
const width = (card, ring) => edge(card, ring, 1).sub(edge(card, ring, 0)).length();
const selected = Array.from({length: 78}, (_, card) => card).filter(card => {
    const root = centre(card, 0);
    return !protectedSet.has(card) && Math.abs(root.x) <= 0.035 && root.y >= 1.640 && root.z >= 0.080;
});
assert.deepEqual(selected, [11, 23, 28, 36, 38, 44, 52]);
const selectedSet = new Set(selected), moved = selected.flatMap(card => Array.from({length: 32}, (_, i) => vertex(card, 1, 0) + i));
const movedSet = new Set(moved);
const grid = new SurfaceGrid(body.positions, body.normals, body.indices);
const checkDeadline = () => assert.ok(Date.now() < deadline, 'Five-minute CPU bound reached; no retry.');

function surfaceAt(position) {
    checkDeadline();
    const hit = grid.nearest(position.toArray());
    assert.ok(hit && Number.isFinite(hit.signed), 'No finite body correspondence.');
    const indices = Array.from(body.indices.slice(hit.triangle, hit.triangle + 3));
    const corners = indices.map(index => point(body.positions, index).toArray());
    const bary = closestPointOnTriangle(hit.closest, ...corners).bary;
    const normal = indices.reduce((n, index, i) => n.addScaledVector(point(body.normals, index), bary[i]), new Vector3());
    assert.ok(normal.length() > 1e-9, 'Degenerate source normal.');
    return {point: new Vector3(...hit.closest), normal: normal.normalize(), triangle: hit.triangle / 3, signed: hit.signed};
}

// These independent source-body observations are frozen before constructing any candidate.
const observations = [];
for (let t = 0; t < body.indices.length; t += 3) {
    const ids = Array.from(body.indices.slice(t, t + 3));
    const position = ids.reduce((p, index) => p.add(point(body.positions, index)), new Vector3()).multiplyScalar(1 / 3);
    if (Math.abs(position.x) > 0.055 || position.y < 1.610 || position.z < 0.070) continue;
    const normal = ids.reduce((p, index) => p.add(point(body.normals, index)), new Vector3()).normalize();
    assert.ok(normal.length() > 0.99);
    observations.push({bodyTriangle: t / 3, indices: ids, bary: [1 / 3, 1 / 3, 1 / 3], point: position.toArray(), normal: normal.toArray()});
}
assert.equal(observations.length, 108);
fs.mkdirSync(out, {recursive: true});
fs.writeFileSync(`${out}/observations.json`, JSON.stringify({bodyPath, bodySha256: pins[bodyPath], domain: {absXMax: 0.055, minY: 1.610, minZ: 0.070}, observations}, null, 2) + '\n', {flag: 'wx'});
for (const file of sourcePaths) {
    const target = `${out}/sources/${file}`;
    fs.mkdirSync(target.slice(0, target.lastIndexOf('/')), {recursive: true});
    fs.copyFileSync(file, target, fs.constants.COPYFILE_EXCL);
}
console.log(JSON.stringify({status: 'constructing one local coverage candidate', pid: process.pid, started, out, selected, observations: observations.length}));

const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(original.positions), 3));
geometry.setIndex(new BufferAttribute(new Uint32Array(original.indices), 1));
const positions = geometry.attributes.position.array;
const records = [];
try {
for (const card of selected) {
    const root = centre(card, 0), standoff = surfaceAt(root).signed;
    assert.ok(standoff >= 0.0035 && standoff <= 0.008, 'Root requires a new attachment contract.');
    const centres = [root], spans = [];
    let previousAxis = edge(card, 0, 1).sub(edge(card, 0, 0)).normalize();
    for (let ring = 1; ring < 17; ring++) {
        const previous = centres.at(-1), support = surfaceAt(previous), wanted = span(card, ring).length();
        const direction = span(card, ring).normalize();
        direction.addScaledVector(support.normal, -direction.dot(support.normal));
        assert.ok(direction.length() > 1e-6, `No tangent flow ${card}/${ring}.`);
        direction.normalize();
        const trial = step => {
            const mesh = surfaceAt(previous.clone().addScaledVector(direction, step));
            return {centre: mesh.point.clone().addScaledVector(mesh.normal, standoff), normal: mesh.normal, bodyTriangle: mesh.triangle};
        };
        let low = 0, high = 4 * wanted;
        assert.ok(trial(low).centre.distanceTo(previous) <= wanted && trial(high).centre.distanceTo(previous) >= wanted, `Unbracketed span ${card}/${ring}.`);
        for (let iteration = 0; iteration < 16; iteration++) {
            const middle = (low + high) / 2;
            if (trial(middle).centre.distanceTo(previous) < wanted) low = middle; else high = middle;
        }
        const next = trial((low + high) / 2), errorMm = Math.abs(next.centre.distanceTo(previous) - wanted) * 1000;
        assert.ok(errorMm <= 0.002, `Span solve outside bound ${card}/${ring}.`);
        const tangent = next.centre.clone().sub(previous).normalize();
        const axis = new Vector3().crossVectors(tangent, next.normal).normalize();
        assert.ok(axis.length() > 0.99, `Degenerate ribbon frame ${card}/${ring}.`);
        if (axis.dot(previousAxis) < 0) axis.negate();
        for (let side = 0; side < 2; side++) next.centre.clone().addScaledVector(axis, (side ? 1 : -1) * width(card, ring) / 2).toArray(positions, vertex(card, ring, side) * 3);
        spans.push({ring, sourceSpanMm: wanted * 1000, stepMm: (low + high) / 2 * 1000, spanErrorMm: errorMm, bodyTriangle: next.bodyTriangle, centre: next.centre.toArray(), normal: next.normal.toArray()});
        centres.push(next.centre); previousAxis = axis;
    }
    records.push({card, standoffMm: standoff * 1000, sourceRoot: root.toArray(), spans});
}
} catch (error) {
    const failure = {status: 'construction stopped before export and native capture', started, finished: new Date().toISOString(), pid: process.pid, sourceHashes, selected, completedCards: records.map(row => row.card), observationsSha256: sha256(fs.readFileSync(`${out}/observations.json`)), error: error.message, admittedForNativeCapture: false, limits: 'One deterministic construction stopped. No candidate GLB or appearance claim; no retry or relaxed constraints.'};
    fs.writeFileSync(`${out}/construction-failure.json`, JSON.stringify(failure, null, 2) + '\n', {flag: 'wx'});
    console.log(JSON.stringify(failure, null, 2));
    process.exit(2);
}

const checks = [], add = (name, pass, actual) => checks.push({name, pass, actual});
try {
const frames = updateMovedFrames(geometry, original, moved);
for (const [name, values] of [['POSITION', positions], ['NORMAL', frames.normals]]) {
    const accessor = glb.json.accessors[primitive.attributes[name]], view = glb.json.bufferViews[accessor.bufferView];
    assert.equal(accessor.componentType, 5126); assert.ok(!accessor.sparse); assert.equal(accessor.type, 'VEC3');
    const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), stride = view.byteStride ?? 12;
    for (const v of moved) for (let axis = 0; axis < 3; axis++) {
        assert.ok(Number.isFinite(values[v * 3 + axis]));
        glb.bin.writeFloatLE(values[v * 3 + axis], base + v * stride + axis * 4);
    }
    for (const key of ['min', 'max']) if (accessor[key]) accessor[key] = [0, 1, 2].map(axis => {
        let value = key === 'min' ? Infinity : -Infinity;
        for (let v = 0; v < accessor.count; v++) value = Math[key](value, values[v * 3 + axis]);
        return value;
    });
}
glb.json.asset.extras ??= {};
glb.json.asset.extras.sugataUnqualifiedLocalCoverage = {status: 'exported rest candidate; admission and appearance pending', selected, inputSha256: pins[input], contractSha256: sourceHashes[sourcePaths.at(-1)]};
const bytes = encodeGlb(glb);
fs.writeFileSync(`${out}/candidate.glb`, bytes, {flag: 'wx'});
const exportedGlb = readGlb(`${out}/candidate.glb`), candidate = readPrimitive(exportedGlb, 'hair_bob02');
const exportedPrimitive = exportedGlb.json.meshes.find(mesh => mesh.name === 'hair_bob02').primitives[0];
const attributes = {};
for (const name of Object.keys(oldPrimitive.attributes)) {
    const before = readAccessor(originalGlb, oldPrimitive.attributes[name]), after = readAccessor(exportedGlb, exportedPrimitive.attributes[name]);
    const changed = [], illegal = [];
    for (let v = 0; v < before.count; v++) if (Array.from({length: before.components}, (_, axis) => before.data[v * before.components + axis] !== after.data[v * before.components + axis]).some(Boolean)) {
        changed.push(v); if (!movedSet.has(v) || !['POSITION', 'NORMAL'].includes(name)) illegal.push(v);
    }
    attributes[name] = {changedRecords: changed.length, illegalRecords: illegal};
    add(`${name} record boundary`, before.count === after.count && before.components === after.components && illegal.length === 0, attributes[name]);
}
const beforeIndices = readAccessor(originalGlb, oldPrimitive.indices).data;
const afterIndices = readAccessor(exportedGlb, exportedPrimitive.indices).data;
add('indices exact', beforeIndices.length === afterIndices.length && beforeIndices.every((value, i) => value === afterIndices[i]), {triangles: candidate.triangleCount});
for (const key of ['nodes', 'skins', 'scenes', 'materials', 'textures', 'images', 'samplers']) add(`${key} exact`, JSON.stringify(originalGlb.json[key]) === JSON.stringify(exportedGlb.json[key]), null);
// All non-geometry BIN bytes must also remain exact (embedded atlases, inverse binds and other accessors).
const allowedBytes = new Set();
for (const name of ['POSITION', 'NORMAL']) {
    const accessor = glb.json.accessors[primitive.attributes[name]], view = glb.json.bufferViews[accessor.bufferView];
    const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), stride = view.byteStride ?? 12;
    for (const v of moved) for (let byte = 0; byte < 12; byte++) allowedBytes.add(base + v * stride + byte);
}
const illegalBin = [];
for (let i = 0; i < originalGlb.bin.length; i++) if (originalGlb.bin[i] !== exportedGlb.bin[i] && !allowedBytes.has(i)) illegalBin.push(i);
add('all other BIN bytes exact', originalGlb.bin.length === exportedGlb.bin.length && illegalBin.length === 0, {illegalBytes: illegalBin.slice(0, 20), total: illegalBin.length});
add('finite exported positions/normals', [...candidate.positions, ...candidate.normals].every(Number.isFinite), null);
const shape = selected.map(card => {
    let beforeLength = 0, afterLength = 0, maxWidthErrorMm = 0;
    const spanResiduals = [];
    for (let ring = 0; ring < 17; ring++) {
        maxWidthErrorMm = Math.max(maxWidthErrorMm, Math.abs(edge(card, ring, 1, candidate.positions).distanceTo(edge(card, ring, 0, candidate.positions)) - width(card, ring)) * 1000);
        if (ring) {
            const beforeSpan = span(card, ring).length();
            const afterSpan = centre(card, ring, candidate.positions).distanceTo(centre(card, ring - 1, candidate.positions));
            beforeLength += beforeSpan; afterLength += afterSpan;
            spanResiduals.push({ring, beforeMm: beforeSpan * 1000, afterMm: afterSpan * 1000, errorMm: Math.abs(afterSpan - beforeSpan) * 1000});
        }
    }
    return {card, beforeLengthMm: beforeLength * 1000, afterLengthMm: afterLength * 1000, lengthChangeFraction: (afterLength - beforeLength) / beforeLength, maxWidthErrorMm, spanResiduals};
});
add('per-ring widths <= 0.001 mm error', shape.every(row => row.maxWidthErrorMm <= 0.001), shape);
add('short arc length <= 1 percent change', shape.every(row => Math.abs(row.lengthChangeFraction) <= 0.01), shape);
add('each exported span <= 0.002 mm residual', shape.every(row => row.spanResiduals.every(span => span.errorMm <= 0.002)), shape.map(row => ({card: row.card, maximumResidualMm: Math.max(...row.spanResiduals.map(span => span.errorMm))})));

const indicesFor = predicate => Uint32Array.from(Array.from(original.indices).filter((_, i) => {
    const triangle = Math.floor(i / 3) * 3, first = original.indices[triangle];
    return predicate(first < 652 ? -1 : Math.floor((first - 652) / 34));
}));
const selectedIndices = indicesFor(card => selectedSet.has(card));
assert.equal(selectedIndices.length / 3, 7 * 32);
function clearanceOf(mesh) {
    let minimumVertexMm = Infinity, vertexWitness = null, minimumSurfaceSampleMm = Infinity, triangleWitness = null, sampled = 0;
    for (const card of selected) for (let ring = 0; ring < 17; ring++) for (let side = 0; side < 2; side++) {
        const v = vertex(card, ring, side), p = point(mesh.positions, v).toArray(), signedMm = grid.nearest(p).signed * 1000;
        if (signedMm < minimumVertexMm) {minimumVertexMm = signedMm; vertexWitness = {card, ring, side, vertex: v, point: p, signedMm};}
    }
    for (let t = 0; t < selectedIndices.length; t += 3) {
        checkDeadline();
        const ids = Array.from(selectedIndices.slice(t, t + 3)), corners = ids.map(index => point(mesh.positions, index));
        for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4 - i; j++) {
            const bary = [i / 4, j / 4, 1 - (i + j) / 4], p = corners.reduce((p, corner, k) => p.addScaledVector(corner, bary[k]), new Vector3()).toArray();
            const signedMm = grid.nearest(p).signed * 1000; sampled++;
            if (signedMm < minimumSurfaceSampleMm) {minimumSurfaceSampleMm = signedMm; triangleWitness = {card: Math.floor((ids[0] - 652) / 34), selectedTriangle: t / 3, vertices: ids, bary, point: p, signedMm};}
        }
    }
    const bounds = {min: [-Infinity, -Infinity, -Infinity], max: [Infinity, Infinity, Infinity]};
    const intersections = measureHairSurface({...mesh, indices: selectedIndices}, body, {headBounds: bounds, faceBounds: bounds, exampleLimit: 30});
    return {minimumVertexMm, vertexWitness, minimumSurfaceSampleMm, triangleWitness, sampled, intersections};
}
const rest = {baseline: clearanceOf(original), candidate: clearanceOf(candidate)};
add('selected triangles/full body zero crossings', rest.candidate.intersections.head.pairs === 0, {baselinePairs: rest.baseline.intersections.head.pairs, candidatePairs: rest.candidate.intersections.head.pairs});
add('full-width exported vertex clearance >= 3.5 mm', rest.candidate.minimumVertexMm >= 3.5, rest.candidate.vertexWitness);
add('exported triangle samples clearance >= 3.5 mm', rest.candidate.minimumSurfaceSampleMm >= 3.5, rest.candidate.triangleWitness);

const textureInfo = originalGlb.json.materials[oldPrimitive.material].pbrMetallicRoughness.baseColorTexture;
assert.equal(textureInfo.texCoord ?? 0, 0); assert.ok(!textureInfo.extensions?.KHR_texture_transform);
const texture = originalGlb.json.textures[textureInfo.index], image = originalGlb.json.images[texture.source];
assert.equal(image.mimeType, 'image/png');
const imageView = originalGlb.json.bufferViews[image.bufferView], imageBytes = originalGlb.bin.subarray(imageView.byteOffset ?? 0, (imageView.byteOffset ?? 0) + imageView.byteLength);
const atlas = decodePng(imageBytes), sampler = originalGlb.json.samplers?.[texture.sampler] ?? {};
const wrap = (value, mode = 10497) => mode === 33071 ? Math.max(0, Math.min(1, value)) : mode === 33648 ? 1 - Math.abs(((value % 2) + 2) % 2 - 1) : ((value % 1) + 1) % 1;
const alphaAt = (u, v) => {
    const x = Math.min(atlas.width - 1, Math.floor(wrap(u, sampler.wrapS) * atlas.width));
    const y = Math.min(atlas.height - 1, Math.floor(wrap(v, sampler.wrapT) * atlas.height));
    return atlas.pixels[(y * atlas.width + x) * 4 + 3];
};
const scalp = {points: Float64Array.from(observations.flatMap(row => row.point)), normals: Float64Array.from(observations.flatMap(row => row.normal))};
const coverage = {};
for (const [name, indices] of Object.entries({selected: selectedIndices, cardsNoFringe: indicesFor(card => card >= 0 && card < 462), withCapNoFringe: indicesFor(card => card < 462)})) {
    checkDeadline();
    const before = Array.from(scalpTransmittance(scalp, {...original, indices}, alphaAt, 0.15));
    const after = Array.from(scalpTransmittance(scalp, {...candidate, indices}, alphaAt, 0.15));
    coverage[name] = {before, after, baselinePositiveControls: before.flatMap((value, i) => value <= 0.5 ? [{sample: i, bodyTriangle: observations[i].bodyTriangle, transmittance: value}] : []), maximumRegression: Math.max(...after.map((value, i) => value - before[i])), newlyBelowHalfCoverage: before.flatMap((value, i) => value <= 0.5 && after[i] > 0.5 ? [{sample: i, bodyTriangle: observations[i].bodyTriangle, before: value, after: after[i]}] : [])};
}
add('selected coverage positive controls nonempty', coverage.selected.baselinePositiveControls.length > 0, coverage.selected.baselinePositiveControls);
add('selected sample half-coverage retained', coverage.selected.newlyBelowHalfCoverage.length === 0, coverage.selected.newlyBelowHalfCoverage);
add('full card sample regression <= 0.05 transmittance', coverage.cardsNoFringe.maximumRegression <= 0.05, {maximumRegression: coverage.cardsNoFringe.maximumRegression});
add('source pins unchanged during run', Object.entries(sourceHashes).every(([file, hash]) => sha256(fs.readFileSync(file)) === hash), null);
const failures = checks.filter(row => !row.pass);
const report = {
    status: failures.length ? 'rejected before native capture' : 'exported-rest admission passed; appearance and motion unqualified',
    started, finished: new Date().toISOString(), pid: process.pid, input, bodyPath, sourceHashes,
    outputSha256: sha256(bytes), observationsSha256: sha256(fs.readFileSync(`${out}/observations.json`)),
    selected, protectedCards, movableRecords: moved, attributes, records, shape, rest,
    coverage: {atlasSha256: sha256(imageBytes), method: 'Outward-normal rays, nearest base-atlas alpha, source-rest geometry; 0.15 m reach. No runtime alpha/root fade/mips or final-pixel claim.', ...coverage},
    checks, failures, admittedForNativeCapture: failures.length === 0,
    limits: [
        'One fixed construction is not a feasibility proof or final hairstyle. Numerical pass requires actual visual review before promotion.',
        'Full triangle/body crossing check is separate from finite signed vertex/triangle samples. Finite clearance samples do not prove minimum clearance everywhere.',
        'Coverage observations are independently frozen source-body centroids, not complete scalp coverage or a posed correspondence.',
        'All 338 protected cards, cap, other cards and ring0 retain authored bytes; shared runtime dynamics can still change.',
        'No motion, garment/hair or hair-hair qualification and no production asset write. No tuning after failed admission.'
    ]
};
fs.writeFileSync(`${out}/candidate-report.json`, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({status: report.status, pid: process.pid, started, finished: report.finished, outputSha256: report.outputSha256, reportSha256: sha256(fs.readFileSync(`${out}/candidate-report.json`)), checks: checks.length, failures, rest: Object.fromEntries(Object.entries(rest).map(([name, value]) => [name, {pairs: value.intersections.head.pairs, vertexMm: value.minimumVertexMm, sampledSurfaceMm: value.minimumSurfaceSampleMm}])), coverage: Object.fromEntries(Object.entries(coverage).map(([name, value]) => [name, {maximumRegression: value.maximumRegression, lostHalfCoverage: value.newlyBelowHalfCoverage.length}]))}, null, 2));
if (failures.length) process.exitCode = 2;
} catch (error) {
    const candidatePath = `${out}/candidate.glb`;
    const failure = {status: 'export or rest admission interrupted; native capture refused', started, finished: new Date().toISOString(), pid: process.pid, sourceHashes, selected, candidatePath: fs.existsSync(candidatePath) ? candidatePath : null, outputSha256: fs.existsSync(candidatePath) ? sha256(fs.readFileSync(candidatePath)) : null, observationsSha256: sha256(fs.readFileSync(`${out}/observations.json`)), checks, failures: checks.filter(row => !row.pass), error: error.message, admittedForNativeCapture: false, limits: 'Accumulated checks are incomplete. Preserve the actual exported bytes if present; no passing admission or appearance claim and no retry.'};
    fs.writeFileSync(`${out}/admission-failure.json`, JSON.stringify(failure, null, 2) + '\n', {flag: 'wx'});
    console.log(JSON.stringify(failure, null, 2));
    process.exitCode = 2;
}
