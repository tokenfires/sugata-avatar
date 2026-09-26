import assert from 'node:assert/strict';
import { triangles, projectedIndex, certifyLateralCorridor } from './distal-corridor.mjs';
import { positiveMarginBound } from './distal-margin-bound.mjs';
const t = (id, points) => triangles({ id, positions: points.flat(), fullIndices: [0,1,2] });
const query = t('query', [[2,0,0],[2,.1,0],[2,0,.1]]);
const target = t('behind', [[1,0,0],[1,.1,0],[1,0,.1]]);
const measure = targets => { const index = projectedIndex(targets); return positiveMarginBound(query,index,certifyLateralCorridor(query,index,{side:'l',marginMetres:0})); };
assert.ok(measure(target).separationLowerBoundMetres > .99);
// This inward target does not overlap yz at margin zero, but is only .03 away in y.
const near = t('near-y', [[3,.13,0],[3,.23,0],[3,.13,.1]]);
const bounded = measure([...target,...near]);
assert.ok(bounded.separationLowerBoundMetres > .029 && bounded.separationLowerBoundMetres <= .03);
assert.equal(bounded.witness.target.mesh,'near-y');
const index=projectedIndex([...target,...near]);
assert.equal(certifyLateralCorridor(query,index,{side:'l',marginMetres:.029}).status,'certified-for-selected-triangle-sets');
assert.equal(certifyLateralCorridor(query,index,{side:'l',marginMetres:.031}).status,'unproven');
console.log('PASS: positive bound and non-overlapping-yz nearest obstacle controls.');
