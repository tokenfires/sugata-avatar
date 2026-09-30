// Readback diagnostics locate frames for image review. They do not score hairstyle quality.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { Matrix4, Vector3 } from 'three';

const directory = process.argv.find(x => x.startsWith('--directory='))?.slice(12);
assert.ok(directory?.startsWith('captures/'));
const reportFile = path.join(directory, 'report.json');
const report = JSON.parse(fs.readFileSync(reportFile));
assert.equal(report.status, 'captured'); assert.equal(report.geometryStride, 1);
const output = path.join(directory, 'continuity.json'); assert.ok(!fs.existsSync(output));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const selected = report.setup.descriptor.selectedCards;
const matrix = new Matrix4(), inverse = new Matrix4();
const point = new Vector3(), left = new Vector3(), right = new Vector3(), rest = new Vector3();
const rows = []; let previous = null;
for (const sample of report.samples) {
  const bytes = fs.readFileSync(path.join(directory, sample.geometryFile));
  assert.equal(sha(bytes), sample.geometrySha256);
  const raw = JSON.parse(gunzipSync(bytes));
  matrix.fromArray(raw.headMatrix); inverse.copy(matrix).invert();
  const local = new Float64Array(raw.selectedVertices.length);
  let maximumStepMm = 0, stepWitness = null, maximumRootMidpointDepartureMm = 0, rootWitness = null;
  for (let i = 0; i < raw.selectedVertices.length; i += 3) {
    point.fromArray(raw.selectedVertices, i).applyMatrix4(inverse).toArray(local, i);
    if (previous) {
      const delta = point.distanceTo(left.fromArray(previous, i)) * 1000;
      if (delta > maximumStepMm) {
        maximumStepMm = delta;
        stepWitness = { card: selected[Math.floor(i / 102)], ring: Math.floor(i % 102 / 6), side: Math.floor(i % 6 / 3), fromFrame: raw.frame - 1, toFrame: raw.frame };
      }
    }
  }
  for (let c = 0; c < selected.length; c++) {
    const offset = c * 102;
    left.fromArray(local, offset); right.fromArray(local, offset + 3);
    point.copy(left).add(right).multiplyScalar(.5);
    left.fromArray(report.setup.descriptor.restPositions, offset); right.fromArray(report.setup.descriptor.restPositions, offset + 3);
    rest.copy(left).add(right).multiplyScalar(.5);
    const delta = point.distanceTo(rest) * 1000;
    if (delta > maximumRootMidpointDepartureMm) { maximumRootMidpointDepartureMm = delta; rootWitness = { card: selected[c], frame: raw.frame }; }
  }
  rows.push({ frame: raw.frame, time: raw.time, maximumStepMm, stepWitness, maximumRootMidpointDepartureMm, rootWitness });
  previous = local;
}
const largestSteps = [...rows].sort((a,b) => b.maximumStepMm - a.maximumStepMm).slice(0, 12);
const maximumRoot = rows.reduce((a,b) => b.maximumRootMidpointDepartureMm > a.maximumRootMidpointDepartureMm ? b : a);
const result = { status: 'complete', reportSha256: sha(fs.readFileSync(reportFile)), frames: rows.length,
  summary: { maximumStepMm: largestSteps[0].maximumStepMm, maximumRootMidpointDepartureMm: maximumRoot.maximumRootMidpointDepartureMm, rootWitness: maximumRoot.rootWitness }, largestSteps, rows,
  limits: ['Step distance is measured after removing each captured head transform. It includes physical deformation and floating-point residuals.', 'Root midpoint departure does not measure edge-frame orientation. Width frames can rotate around an anchored midpoint.', 'No threshold here establishes a visible jump, dynamic stability, settling or hairstyle acceptance; inspect the actual neighboring images.'],
  sourceSha256: sha(fs.readFileSync('tools/critic/audit-envelope-continuity.mjs')) };
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
fs.copyFileSync('tools/critic/audit-envelope-continuity.mjs', path.join(directory, 'audit-envelope-continuity.mjs'));
console.log(JSON.stringify({ ...result.summary, largestStepWitness: largestSteps[0].stepWitness }));
