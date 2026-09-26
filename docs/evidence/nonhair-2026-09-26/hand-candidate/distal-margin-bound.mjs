// A measured sufficient bound, not a chosen product margin or a motion/fit solver.
import assert from 'node:assert/strict';
import { nextDown, nextUp } from './distal-corridor.mjs';

export function positiveMarginBound(queries, index, zeroCertificate) {
    assert.equal(zeroCertificate.status, 'certified-for-selected-triangle-sets');
    assert.equal(zeroCertificate.marginMetres, 0);
    const side = zeroCertificate.side;
    assert.ok(queries.length && index.targets.length, 'Nonempty exact triangle sets required');
    const gaps = (a, b) => ({
        outwardX: nextDown(side === 'l' ? a.min[0] - b.max[0] : b.min[0] - a.max[0]),
        y: Math.max(nextDown(a.min[1] - b.max[1]), nextDown(b.min[1] - a.max[1])),
        z: Math.max(nextDown(a.min[2] - b.max[2]), nextDown(b.min[2] - a.max[2]))
    });
    let upper = zeroCertificate.minimumOverlappingYZOutwardGapLowerBoundMetres;
    const seedMethod = upper === null ? 'minimum directional AABB bound from first query triangle to every target (no yz-overlap pairs)' : 'zero-margin overlapping-yz outward gap';
    if (upper === null) upper = Math.min(...index.targets.map(b => Math.max(...Object.values(gaps(queries[0], b)))));
    assert.ok(Number.isFinite(upper) && upper > 0, 'A finite positive initial bound is required');
    let lower = upper, checks = 0, witness = null;
    for (const a of queries) {
        const loY = nextDown(a.min[1] - upper), hiY = nextUp(a.max[1] + upper);
        const loZ = nextDown(a.min[2] - upper), hiZ = nextUp(a.max[2] + upper);
        for (const i of index.query(loY, hiY, loZ, hiZ)) {
            const b = index.targets[i];
            if (b.max[1] < loY || b.min[1] > hiY || b.max[2] < loZ || b.min[2] > hiZ) continue;
            const { outwardX: x, y, z } = gaps(a, b);
            const bound = Math.max(x, y, z); checks++;
            if (bound < lower || witness === null && bound === lower) {
                lower = bound;
                witness = { query: { mesh: a.mesh, face: a.face, ids: a.ids, points: a.points },
                    target: { mesh: b.mesh, face: b.face, ids: b.ids, points: b.points },
                    signedAxisGapLowerBoundsMetres: { outwardX: x, y, z }, separationLowerBoundMetres: bound };
            }
        }
    }
    assert.ok(lower > 0, 'A claimed positive zero-margin certificate must have a positive discrete bound');
    return { separationLowerBoundMetres: lower, initialSearchBoundMetres: upper, seedMethod, pairChecks: checks, witness,
        semantics: 'Every selected query/target point pair has Euclidean distance at least this downward-rounded AABB lower bound. Any mathematically smaller nonnegative margin is sufficient for the directional criterion. This is not a required product margin, penetration depth or continuous-motion guarantee.' };
}
