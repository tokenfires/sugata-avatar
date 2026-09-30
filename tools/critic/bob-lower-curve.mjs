/** One isolated lower-curve probe. Fixed widths; frozen upper geometry; no production writes. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {BufferGeometry, BufferAttribute, Vector3} from 'three';
import {readGlb, readPrimitive, readAccessor} from '../lut-bake/glb.mjs';
import {encodeGlb, sha256, updateMovedFrames} from '../figure-pipeline/hair_fall.mjs';
import {SurfaceGrid} from '../figure-pipeline/hair_geometry.mjs';
import {measureHairSurface} from '../figure-pipeline/hair_surface.mjs';

const started = new Date().toISOString();
const input = 'captures/bob-side-envelope-v3/candidate.glb';
const inputSha256 = 'bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9';
const bodyPath = 'assets/figures/figure_g050.glb';
const bodySha256 = 'b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14';
const out = 'captures/bob-lower-curve-v1';
const read = file => JSON.parse(fs.readFileSync(file));
const sourceReport = read('captures/bob-side-envelope-v3/candidate-report.json');
assert.equal(sha256(fs.readFileSync(input)), inputSha256);
assert.equal(sha256(fs.readFileSync(bodyPath)), bodySha256);
assert.ok(!fs.existsSync(out), 'Preserve existing candidate; do not overwrite');
// Construction stays gated while either frozen comparison is still running or unresolved.
const prerequisites = [];
for (const [protocol, view, states] of [['head', 'right-profile', 556], ['ordinary', 'left-profile', 721]]) {
  for (const arm of ['baseline', 'candidate']) {
    const dir = `captures/side-${protocol}-v1/${arm}-${view}-brown`;
    const capture = read(`${dir}/report.json`);
    const audit = read(`${dir}/numerical-checks.json`);
    assert.equal(capture.status, 'captured');
    assert.deepEqual(capture.errors, []);
    assert.equal(capture.arm, arm); assert.equal(capture.protocol, protocol); assert.equal(capture.view, view);
    assert.equal(capture.candidateSha256, inputSha256);
    assert.deepEqual(audit.selectedCards, sourceReport.selected);
    assert.equal(audit.status, 'complete');
    assert.equal(audit.rows.length, states);
    assert.deepEqual(audit.rows.map(row => row.frame), Array.from({length: states}, (_, i) => i));
    assert.deepEqual(read(`${dir}/audit-progress.json`), audit);
    assert.equal(audit.reportSha256, sha256(fs.readFileSync(`${dir}/report.json`)));
    if (arm === 'candidate') {
      assert.equal(capture.routedAsset, input);
      assert.equal(audit.summary.totalTriangleBodyPairs, 0);
      assert.ok(audit.summary.minimumVertexClearanceMm > 0);
    }
    prerequisites.push({protocol, arm, file: `${dir}/numerical-checks.json`, sha256: sha256(fs.readFileSync(`${dir}/numerical-checks.json`))});
  }
}

const sourceGlb = readGlb(input), glb = readGlb(input);
console.log(JSON.stringify({status: 'constructing isolated lower-curve probe', pid: process.pid, started, input, out}));
const original = readPrimitive(sourceGlb, 'hair_bob02');
const body = readPrimitive(readGlb(bodyPath), 'base.001');
const selected = sourceReport.selected;
const affectedCards = sourceReport.changedFromAcceptedCards;
assert.equal(selected.length, 338);
assert.equal(affectedCards.length, 336);
assert.deepEqual(affectedCards, selected.filter(c => c !== 47 && c !== 182));
const parameters = {centreZ: 0.03419020026922226, maximumSpan: 0.060, fractionOfDrop: 0.65,
  amplitudeAtMaximumSpan: 0.010, polynomial: '2*u^3-u^4', direction: 'inward XZ at each frozen ring centre',
  widths: 'translate both frozen edge vertices equally; no frame transport'};
const point = (positions, card, ring, side) => new Vector3().fromArray(positions, (652 + card * 34 + ring * 2 + side) * 3);
const centre = (positions, card, ring) => point(positions, card, ring, 0).add(point(positions, card, ring, 1)).multiplyScalar(0.5);
const geo = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(original.positions), 3));
geo.setIndex(new BufferAttribute(new Uint32Array(original.indices), 1));
const positions = geo.attributes.position.array;
const moved = [], records = [];
for (const card of affectedCards) {
  const centres = Array.from({length: 17}, (_, ring) => centre(original.positions, card, ring));
  for (let r = 1; r < 17; r++) assert.ok(centres[r].y < centres[r - 1].y, `non-descending card ${card}`);
  const drop = centres[0].y - centres[16].y;
  const span = Math.min(parameters.maximumSpan, parameters.fractionOfDrop * drop);
  const amplitude = parameters.amplitudeAtMaximumSpan * span / parameters.maximumSpan;
  const joinY = centres[16].y + span;
  const rings = [];
  for (let ring = 0; ring < 17; ring++) {
    const p = centres[ring];
    if (p.y >= joinY) continue;
    const u = Math.max(0, Math.min(1, (joinY - p.y) / span));
    const h = 2 * u ** 3 - u ** 4;
    const inward = new Vector3(-p.x, 0, parameters.centreZ - p.z);
    assert.ok(inward.length() > 1e-6);
    const offset = inward.normalize().multiplyScalar(amplitude * h);
    for (let side = 0; side < 2; side++) {
      const vertex = 652 + card * 34 + ring * 2 + side;
      // Preserve Y exactly; only the two horizontal components receive Float32 writes.
      positions[vertex * 3] = original.positions[vertex * 3] + offset.x;
      positions[vertex * 3 + 2] = original.positions[vertex * 3 + 2] + offset.z;
      moved.push(vertex);
    }
    rings.push({ring, u, offset: offset.toArray()});
  }
  assert.ok(rings[0].ring >= 2, 'Insufficient protected upper rings');
  records.push({card, dropMm: drop * 1000, spanMm: span * 1000, amplitudeMm: amplitude * 1000,
    joinY, firstMovedRing: rings[0].ring, protectedThroughRing: rings[0].ring - 1, rings});
}
assert.equal(moved.length, 2451 * 2, 'Recipe differs from the preserved read-only calculation');
const movedSet = new Set(moved);
const frames = updateMovedFrames(geo, original, moved);
const primitive = glb.json.meshes.find(m => m.name === 'hair_bob02').primitives[0];
assert.equal(primitive.attributes.TANGENT, undefined);
for (const [name, values] of [['POSITION', positions], ['NORMAL', frames.normals]]) {
  const a = glb.json.accessors[primitive.attributes[name]], b = glb.json.bufferViews[a.bufferView];
  assert.equal(a.componentType, 5126); assert.ok(!a.sparse);
  const start = (b.byteOffset ?? 0) + (a.byteOffset ?? 0), stride = b.byteStride ?? 12;
  for (const vertex of moved) for (let k = 0; k < 3; k++) {
    assert.ok(Number.isFinite(values[vertex * 3 + k]));
    glb.bin.writeFloatLE(values[vertex * 3 + k], start + vertex * stride + k * 4);
  }
  a.min = [0, 1, 2].map(k => Math.min(...Array.from({length: a.count}, (_, v) => values[v * 3 + k])));
  a.max = [0, 1, 2].map(k => Math.max(...Array.from({length: a.count}, (_, v) => values[v * 3 + k])));
}

// Exact authored isolation, independently read back from the edited GLB buffer.
const originalPrimitive = sourceGlb.json.meshes.find(m => m.name === 'hair_bob02').primitives[0];
const attributes = {};
for (const name of Object.keys(originalPrimitive.attributes)) {
  const before = readAccessor(sourceGlb, originalPrimitive.attributes[name]);
  const after = readAccessor(glb, primitive.attributes[name]);
  assert.equal(before.count, after.count); assert.equal(before.components, after.components);
  let changed = 0;
  for (let v = 0; v < before.count; v++) {
    const differs = Array.from({length: before.components}, (_, k) => before.data[v * before.components + k] !== after.data[v * after.components + k]).some(Boolean);
    if (differs) { assert.ok(movedSet.has(v) && ['POSITION', 'NORMAL'].includes(name), `${name}: protected ${v}`); changed++; }
  }
  attributes[name] = {changedRecords: changed};
}
assert.deepEqual(readAccessor(sourceGlb, originalPrimitive.indices).data, readAccessor(glb, primitive.indices).data);
for (const key of ['nodes', 'skins', 'scenes', 'materials', 'textures', 'images']) assert.deepEqual(sourceGlb.json[key], glb.json[key]);
const result = readPrimitive(glb, 'hair_bob02');
let maximumWidthVectorDeltaMm = 0, maximumWidthLengthDeltaMm = 0, maximumEdgeYDeltaMm = 0;
let maximumOrthogonalityDepartureDegrees = 0, orthogonalityWitness = null;
let maximumNormalChangeDegrees = 0, normalWitness = null;
for (const card of affectedCards) for (let ring = 0; ring < 17; ring++) {
  const oldWidth = point(original.positions, card, ring, 1).sub(point(original.positions, card, ring, 0));
  const newWidth = point(result.positions, card, ring, 1).sub(point(result.positions, card, ring, 0));
  maximumWidthVectorDeltaMm = Math.max(maximumWidthVectorDeltaMm, newWidth.clone().sub(oldWidth).length() * 1000);
  maximumWidthLengthDeltaMm = Math.max(maximumWidthLengthDeltaMm, Math.abs(newWidth.length() - oldWidth.length()) * 1000);
  const tangent = centre(result.positions, card, Math.min(16, ring + 1)).sub(centre(result.positions, card, Math.max(0, ring - 1))).normalize();
  const departure = Math.asin(Math.min(1, Math.abs(newWidth.clone().normalize().dot(tangent)))) * 180 / Math.PI;
  if (departure > maximumOrthogonalityDepartureDegrees) { maximumOrthogonalityDepartureDegrees = departure; orthogonalityWitness = {card, ring}; }
  for (let side = 0; side < 2; side++) {
    const vertex = 652 + card * 34 + ring * 2 + side;
    maximumEdgeYDeltaMm = Math.max(maximumEdgeYDeltaMm, Math.abs(result.positions[vertex * 3 + 1] - original.positions[vertex * 3 + 1]) * 1000);
    const a = new Vector3().fromArray(original.normals, vertex * 3), b = new Vector3().fromArray(result.normals, vertex * 3);
    const angle = a.angleTo(b) * 180 / Math.PI;
    if (angle > maximumNormalChangeDegrees) { maximumNormalChangeDegrees = angle; normalWitness = {card, ring, side, vertex, changed: movedSet.has(vertex)}; }
  }
}
assert.equal(maximumEdgeYDeltaMm, 0);
const joinNormalComparisons = [];
const normal = (values, card, ring, side) => new Vector3().fromArray(values, (652 + card * 34 + ring * 2 + side) * 3);
const angleDegrees = (a, b) => a.angleTo(b) * 180 / Math.PI;
for (const record of records) for (let side = 0; side < 2; side++) {
  const card = record.card, first = record.firstMovedRing, last = first - 1;
  const oldUpper = normal(original.normals, card, last, side);
  const oldLower = normal(original.normals, card, first, side);
  const newUpper = normal(result.normals, card, last, side);
  const newLower = normal(result.normals, card, first, side);
  assert.deepEqual(newUpper.toArray(), oldUpper.toArray());
  const beforeDegrees = angleDegrees(oldUpper, oldLower), afterDegrees = angleDegrees(newUpper, newLower);
  joinNormalComparisons.push({card, side, lastProtectedRing: last, firstMovedRing: first,
    beforeDegrees, afterDegrees, increaseDegrees: afterDegrees - beforeDegrees,
    firstMovedNormalChangeDegrees: angleDegrees(oldLower, newLower)});
}
joinNormalComparisons.sort((a, b) => b.increaseDegrees - a.increaseDegrees);
const joinNormalSummary = {largestAngleIncrease: joinNormalComparisons[0],
  largestFirstMovedNormalChange: joinNormalComparisons.reduce((a, b) => a.firstMovedNormalChangeDegrees > b.firstMovedNormalChangeDegrees ? a : b)};
const selectedSet = new Set(selected), indices = [];
for (let i = 0; i < original.indices.length; i += 3) {
  if ([0, 1, 2].every(k => original.indices[i + k] >= 652 && selectedSet.has(Math.floor((original.indices[i + k] - 652) / 34)))) indices.push(...original.indices.slice(i, i + 3));
}
assert.equal(indices.length / 3, 10816);
const bounds = {min: [-Infinity, -Infinity, -Infinity], max: [Infinity, Infinity, Infinity]};
const crossings = measureHairSurface({...result, indices}, body, {headBounds: bounds, faceBounds: bounds});
const grid = new SurfaceGrid(body.positions, body.normals, body.indices);
let minimumSelectedVertexClearanceMm = Infinity, clearanceWitness = null, negativeVertices = 0;
for (const card of selected) for (let v = 652 + card * 34; v < 652 + (card + 1) * 34; v++) {
  const p = Array.from(result.positions.slice(v * 3, v * 3 + 3)), mm = grid.nearest(p).signed * 1000;
  if (mm < 0) negativeVertices++;
  if (mm < minimumSelectedVertexClearanceMm) { minimumSelectedVertexClearanceMm = mm; clearanceWitness = {card, vertex: v, point: p, signedMm: mm}; }
}
const report = {status: 'unqualified inward lower-curve prototype', pid: process.pid, started, finished: new Date().toISOString(), input, inputSha256, bodyPath, bodySha256,
  parameters, prerequisites, selected, affectedCards, records, movedVertices: moved.length, attributes,
  protectedPositionAndNormalRecordsExact: true, topologyAndProtectedAttributesExact: true,
  maximumWidthVectorDeltaMm, maximumWidthLengthDeltaMm, maximumEdgeYDeltaMm,
  maximumOrthogonalityDepartureDegrees, orthogonalityWitness, maximumNormalChangeDegrees, normalWitness,
  joinNormalSummary, joinNormalComparisons,
  restTriangleBodyPairs: crossings.head.pairs,
  restContactCards: crossings.head.cards.map(c => selected[c]),
  restContactExamples: crossings.head.examples.map(e => ({...e, selectedComponent: e.card, card: selected[e.card]})),
  minimumSelectedVertexClearanceMm, clearanceWitness, negativeVertices, crossings,
  limits: ['One isolated recipe and one figure; actual intact images must establish any styling gain.',
    'No moving, garment, alpha/occlusion, all-view or promotion claim; this asset inherits no previous moving qualification.',
    'Protected upper and fallback geometry is exact, but shared fitted colliders and other live cards may still change.',
    'Finite Float32 width errors and the first updated normal are reported; mathematical C2 continuity is not perceptual proof.']};
glb.json.asset.extras ??= {};
glb.json.asset.extras.sugataUnqualifiedExperiment = {status: report.status, parameters};
const bytes = encodeGlb(glb);
report.outputSha256 = sha256(bytes);
const source = 'tools/critic/bob-lower-curve.mjs';
report.sourceSha256 = sha256(fs.readFileSync(source));
fs.mkdirSync(out, {recursive: true});
fs.writeFileSync(`${out}/candidate.glb`, bytes, {flag: 'wx'});
fs.writeFileSync(`${out}/candidate-report.json`, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
fs.copyFileSync(source, `${out}/bob-lower-curve.mjs`);
console.log(JSON.stringify({...report, records: undefined, crossings: undefined, joinNormalComparisons: undefined,
  selected: selected.length, affectedCards: affectedCards.length}, null, 2));
