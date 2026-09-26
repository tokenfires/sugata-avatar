// Capture-local sufficient separation test. A failed certificate is not penetration.
import assert from 'node:assert/strict';

const buffer = new ArrayBuffer(8), view = new DataView(buffer);
export function nextDown(x) {
    if (Number.isNaN(x) || x === -Infinity) return x;
    if (x === Infinity) return Number.MAX_VALUE;
    if (x === 0) return -Number.MIN_VALUE;
    view.setFloat64(0, x); view.setBigUint64(0, view.getBigUint64(0) + (x > 0 ? -1n : 1n));
    return view.getFloat64(0);
}
export const nextUp = x => -nextDown(-x);

export function triangles(mesh, select = () => true) {
    assert.equal(mesh.fullIndices.length % 3, 0);
    const result = [];
    for (let face = 0; face < mesh.fullIndices.length / 3; face++) {
        const ids = mesh.fullIndices.slice(face * 3, face * 3 + 3);
        if (!select(ids, face)) continue;
        const points = ids.map(i => mesh.positions.slice(i * 3, i * 3 + 3));
        assert.ok(points.every(p => p.length === 3 && p.every(Number.isFinite)));
        result.push({ mesh: mesh.id, face, ids, points,
            min: [0, 1, 2].map(k => Math.min(...points.map(p => p[k]))),
            max: [0, 1, 2].map(k => Math.max(...points.map(p => p[k]))) });
    }
    return result;
}

// Grid size is solely a broad-phase performance choice. Exact inclusive bounds follow it.
export function projectedIndex(targets, cellMetres = .05) {
    assert.ok(Number.isFinite(cellMetres) && cellMetres > 0);
    const bins = new Map();
    for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        for (let y = Math.floor(t.min[1] / cellMetres); y <= Math.floor(t.max[1] / cellMetres); y++)
            for (let z = Math.floor(t.min[2] / cellMetres); z <= Math.floor(t.max[2] / cellMetres); z++) {
                const key = `${y}:${z}`; if (!bins.has(key)) bins.set(key, []); bins.get(key).push(i);
            }
    }
    return { targets, cellMetres, query(minY, maxY, minZ, maxZ) {
        const found = new Set();
        for (let y = Math.floor(minY / cellMetres); y <= Math.floor(maxY / cellMetres); y++)
            for (let z = Math.floor(minZ / cellMetres); z <= Math.floor(maxZ / cellMetres); z++)
                for (const i of bins.get(`${y}:${z}`) ?? []) found.add(i);
        return found;
    } };
}

/** Every query triangle must lie strictly outward of every target with overlapping
 * margin-expanded yz bounds. Otherwise the result is unproven. This suffices for
 * >margin Euclidean separation of the selected triangle sets and an outward ray
 * corridor. It does not certify anatomical completeness or continuous motion. */
export function certifyLateralCorridor(queries, index, { side, marginMetres } = {}) {
    assert.ok(side === 'l' || side === 'r');
    assert.ok(Number.isFinite(marginMetres) && marginMetres >= 0, 'Explicit nonnegative margin required');
    let pairChecks = 0, failedTriangles = 0, unconstrainedTriangles = 0, minGap = Infinity, witness = null;
    const failedFaceIds = [];
    for (const a of queries) {
        const loY = nextDown(a.min[1] - marginMetres), hiY = nextUp(a.max[1] + marginMetres);
        const loZ = nextDown(a.min[2] - marginMetres), hiZ = nextUp(a.max[2] + marginMetres);
        let constrained = false, failed = false;
        for (const i of index.query(loY, hiY, loZ, hiZ)) {
            const b = index.targets[i];
            if (b.max[1] < loY || b.min[1] > hiY || b.max[2] < loZ || b.min[2] > hiZ) continue;
            constrained = true; pairChecks++;
            const gap = nextDown(side === 'l' ? a.min[0] - b.max[0] : b.min[0] - a.max[0]);
            if (gap < minGap) {
                minGap = gap;
                witness = { query: { mesh: a.mesh, face: a.face, ids: a.ids, points: a.points },
                    target: { mesh: b.mesh, face: b.face, ids: b.ids, points: b.points },
                    gapLowerBoundMetres: gap, queryBounds: { min: a.min, max: a.max }, targetBounds: { min: b.min, max: b.max } };
            }
            if (!(gap > marginMetres)) failed = true;
        }
        if (!constrained) unconstrainedTriangles++;
        if (failed) { failedTriangles++; failedFaceIds.push(a.face); }
    }
    return { status: failedTriangles ? 'unproven' : 'certified-for-selected-triangle-sets', side, marginMetres,
        queryTriangles: queries.length, targetTriangles: index.targets.length, failedTriangles, unconstrainedTriangles, pairChecks,
        minimumOverlappingYZOutwardGapLowerBoundMetres: Number.isFinite(minGap) ? minGap : null,
        failedFaceIds, witness };
}
