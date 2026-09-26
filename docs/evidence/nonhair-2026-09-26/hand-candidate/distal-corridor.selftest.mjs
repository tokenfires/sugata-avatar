import assert from 'node:assert/strict';
import { triangles, projectedIndex, certifyLateralCorridor, nextDown, nextUp } from './distal-corridor.mjs';
const tri = (name, points) => triangles({ id: name, positions: points.flat(), fullIndices: [0, 1, 2] });
const yz = [[-.2, -.2], [.2, -.2], [0, .2]];
const plane = (name, x, points = yz) => tri(name, points.map(([y, z]) => [x, y, z]));
const run = (query, target, marginMetres = 0, side = 'l', cell = .05) => certifyLateralCorridor(query, projectedIndex(target, cell), { side, marginMetres });
const positive = run(plane('query', 2), plane('target', 1), .5);
assert.equal(positive.status, 'certified-for-selected-triangle-sets');
assert.ok(positive.minimumOverlappingYZOutwardGapLowerBoundMetres <= 1);
assert.equal(run(plane('query', -2), plane('target', -1), .5, 'r').status, positive.status);
assert.equal(run(plane('query', 1), plane('target', 1)).status, 'unproven');
assert.equal(run(plane('query', 2), plane('target', 1), 1).status, 'unproven');
// Interior triangle has no triangle crossing with this closed box surface.
const corners = [[-1,-1,-1],[-1,-1,1],[-1,1,-1],[-1,1,1],[1,-1,-1],[1,-1,1],[1,1,-1],[1,1,1]];
const box = triangles({ id:'box',positions:corners.flat(),fullIndices:[0,1,3,0,3,2,4,6,7,4,7,5,0,4,5,0,5,1,2,3,7,2,7,6,0,2,6,0,6,4,1,5,7,1,7,3] });
const inside = plane('contained', 0);
assert.ok(inside[0].points.every(p => p.every(v => Math.abs(v) < 1)));
assert.equal(run(inside, box).status, 'unproven');
// Disjoint projected triangles nevertheless have overlapping yz AABBs.
const low = plane('low', 0, [[0,0],[.4,0],[0,.4]]), high = plane('high', 1, [[.3,.3],[.7,.3],[.3,.7]]);
assert.ok(Math.max(...low[0].points.map(p=>p[1]+p[2])) < Math.min(...high[0].points.map(p=>p[1]+p[2])));
assert.equal(run(low, high).status, 'unproven');
const boundary = plane('boundary', 0, [[0,0],[.1,0],[0,.1]]);
assert.equal(run(boundary, boundary).status, 'unproven');
// Broad phase is invariant across three grid sizes, including cell-boundary faces.
for (const cell of [.02, .05, .4]) assert.deepEqual(run(inside, box, 0, 'l', cell), run(inside, box));
assert.ok(nextDown(1) < 1 && nextUp(1) > 1 && nextDown(0) < 0 && nextUp(0) > 0);
assert.throws(() => certifyLateralCorridor(inside, projectedIndex(box), { side: 'l' }));
console.log('PASS: 9 diagnostic control groups (positive/right, contact, exact margin, containment, projected overconservatism, connected boundary, grid equivalence, outward rounding, explicit margin).');
