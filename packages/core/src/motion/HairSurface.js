/**
 * HairSurface — CPU posed-body patch, threaded BVH and submitted-pose history.
 * The caller supplies canonical source topology and calibrated triangle selection.
 * No region selection, GPU query kernel or contact policy is inferred here.
 *
 * Packed GPU contract (unchanged from surface-patch-v2):
 * - positions/normals: Float32 vec4, xyz used, w reserved;
 * - triangles: Uint32 vec4 [localA, localB, localC, sourceBodyTriangle];
 * - meta: Uint32 vec4 [escapeNode, firstTriangle, triangleCount, rightChild].
 *   An interior node has count=0 and leftChild=node+1. Leaves have contiguous spans.
 * - boundaryMasks: bits0–2 mark open edges opposite corners0–2; bits3–5 mark
 *   corners incident to any open edge, including ties in an interior fan triangle.
 *
 * Nearest-normal sign on an OPEN patch is not closed-body containment. The contact
 * caller must establish an anatomical/proximity domain before using that sign.
 * Buffers are caller-readable, but topology mutation after construction is forbidden.
 * Direct position mutation requires refit(); staged update APIs are transactional.
 * This module owns no GPU resources and infers no body selection or contact policy.
 */
import { Vector3, Vector4, Matrix3 } from 'three';

const usable = new WeakSet();
const topologyValidated = new WeakSet();
const disposed = new WeakSet();
const histories = new WeakMap();
const staging = new WeakMap();
const integerFields = new Set(['sourceVertexIds', 'triangles', 'boundaryMasks', 'meta']);
const packedFields = [...integerFields, 'positions', 'normals', 'boundsMin', 'boundsMax'];
const isArray = value => Array.isArray(value)
    || (ArrayBuffer.isView(value) && !(value instanceof DataView));

function finiteArray(value, name, stride = 1) {
    if (!isArray(value) || !value.length || value.length % stride) {
        throw Error(`${name}: nonempty array with stride ${stride} required`);
    }
    for (const item of value) {
        if (!Number.isFinite(item) || !Number.isFinite(Math.fround(item))) {
            throw Error(`${name}: finite Float32-representable values required`);
        }
    }
}

function integerArray(value, name, maximum = 0xffffffff, stride = 1) {
    if (!isArray(value) || !value.length || value.length % stride) {
        throw Error(`${name}: nonempty array with stride ${stride} required`);
    }
    for (const item of value) {
        if (!Number.isInteger(item) || item < 0 || item > maximum) {
            throw Error(`${name}: integer index out of range`);
        }
    }
}

function requireLive(patch) {
    if (!patch || typeof patch !== 'object' || disposed.has(patch)) {
        throw Error('A live patch is required');
    }
}

function requireUsable(patch) {
    requireLive(patch);
    if (!usable.has(patch)) throw Error('Patch must be constructed and successfully refitted');
}

function queryPoint(point, name = 'query point') {
    if (!isArray(point) || point.length !== 3) throw Error(`${name}: three components required`);
    finiteArray(point, name, 3);
}

function validateSource(bodyIndices, sourceTriangleIds, positions, normals) {
    finiteArray(positions, 'sourcePositions', 3);
    finiteArray(normals, 'sourceNormals', 3);
    if (positions.length !== normals.length) throw Error('Position/normal length mismatch');
    integerArray(bodyIndices, 'bodyIndices', positions.length / 3 - 1, 3);
    integerArray(sourceTriangleIds, 'sourceTriangleIds', bodyIndices.length / 3 - 1);
    if (new Set(sourceTriangleIds).size !== sourceTriangleIds.length) {
        throw Error('sourceTriangleIds: duplicate triangle');
    }
}

function boundaryMasksFor(triangles) {
    const edges = new Map(), boundaryVertices = new Set();
    for (let t = 0; t < triangles.length; t += 4) {
        for (const [i, j] of [[1, 2], [2, 0], [0, 1]]) {
            const a = triangles[t + i], b = triangles[t + j];
            const key = Math.min(a, b) + ':' + Math.max(a, b);
            const record = edges.get(key) ?? { a, b, count: 0 };
            record.count++;
            edges.set(key, record);
        }
    }
    for (const { a, b, count } of edges.values()) {
        if (count === 1) { boundaryVertices.add(a); boundaryVertices.add(b); }
    }
    return Uint32Array.from({ length: triangles.length / 4 }, (_, triangle) => {
        const offset = triangle * 4;
        let mask = 0;
        for (const [opposite, i, j] of [[0, 1, 2], [1, 2, 0], [2, 0, 1]]) {
            const a = triangles[offset + i], b = triangles[offset + j];
            if (edges.get(Math.min(a, b) + ':' + Math.max(a, b)).count === 1) mask |= 1 << opposite;
        }
        for (let corner = 0; corner < 3; corner++) {
            if (boundaryVertices.has(triangles[offset + corner])) mask |= 1 << (corner + 3);
        }
        return mask;
    });
}

function validatePacked(patch, checkBounds = true) {
    requireLive(patch);
    integerArray(patch.sourceVertexIds, 'sourceVertexIds');
    for (let i = 1; i < patch.sourceVertexIds.length; i++) {
        if (patch.sourceVertexIds[i] <= patch.sourceVertexIds[i - 1]) {
            throw Error('sourceVertexIds: strictly increasing IDs required');
        }
    }
    finiteArray(patch.positions, 'positions', 4);
    finiteArray(patch.normals, 'normals', 4);
    if (patch.positions.length !== patch.sourceVertexIds.length * 4
        || patch.normals.length !== patch.positions.length) throw Error('Packed vertex length mismatch');
    integerArray(patch.triangles, 'triangles', 0xffffffff, 4);
    for (let t = 0; t < patch.triangles.length; t += 4) {
        for (let corner = 0; corner < 3; corner++) {
            if (patch.triangles[t + corner] >= patch.sourceVertexIds.length) {
                throw Error('triangles: local vertex out of range');
            }
        }
    }
    integerArray(patch.boundaryMasks, 'boundaryMasks', 63);
    if (patch.boundaryMasks.length !== patch.triangles.length / 4) throw Error('Boundary count mismatch');
    const expectedMasks = boundaryMasksFor(patch.triangles);
    if (expectedMasks.some((mask, i) => mask !== patch.boundaryMasks[i])) {
        throw Error('boundaryMasks: v2 topology masks required');
    }
    integerArray(patch.meta, 'meta', 0xffffffff, 4);
    finiteArray(patch.boundsMin, 'boundsMin', 4);
    finiteArray(patch.boundsMax, 'boundsMax', 4);
    if (patch.boundsMin.length !== patch.meta.length || patch.boundsMax.length !== patch.meta.length) {
        throw Error('BVH bounds length mismatch');
    }
    const nodes = patch.meta.length / 4, triangleCount = patch.triangles.length / 4;
    let cursor = 0;
    if (patch.meta[0] !== nodes) throw Error('BVH root escape does not cover tree');
    for (let node = 0; node < nodes; node++) {
        const offset = node * 4;
        const [escape, first, count, right] = patch.meta.slice(offset, offset + 4);
        if (escape <= node || escape > nodes) throw Error('BVH invalid escape index');
        if (count) {
            if (escape !== node + 1 || first !== cursor || first + count > triangleCount) {
                throw Error('BVH invalid leaf span');
            }
            cursor += count;
        } else if (right <= node + 1 || right >= escape
            || patch.meta[(node + 1) * 4] !== right || patch.meta[right * 4] !== escape) {
            throw Error('BVH invalid child topology');
        }
        if (checkBounds) {
            for (let k = 0; k < 3; k++) {
                if (patch.boundsMin[offset + k] > patch.boundsMax[offset + k]) throw Error('BVH inverted bounds');
            }
        }
    }
    if (cursor !== triangleCount) throw Error('BVH leaves do not cover triangles');
}

const xyz = (array, index) => [array[index * 4], array[index * 4 + 1], array[index * 4 + 2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = value => {
    const length = Math.hypot(...value);
    return length > 0 ? value.map(component => component / length) : [0, 0, 0];
};

// Voronoi-region closest point, retaining v2's arithmetic and deterministic edge
// fallback for zero-area triangles. No import from build-time figure tools.
function closestTriangle(point, a, b, c) {
    const ab = sub(b, a), ac = sub(c, a), area = cross(ab, ac);
    if (dot(area, area) <= 1e-24) {
        let best = null;
        for (const [u, v, i, j] of [[a, b, 0, 1], [b, c, 1, 2], [c, a, 2, 0]]) {
            const direction = sub(v, u);
            const t = Math.max(0, Math.min(1, dot(sub(point, u), direction) / (dot(direction, direction) || 1)));
            const closest = u.map((value, k) => value + direction[k] * t);
            const difference = sub(point, closest), distanceSquared = dot(difference, difference);
            const bary = [0, 0, 0]; bary[i] = 1 - t; bary[j] = t;
            if (!best || distanceSquared < best.distanceSquared) best = { closest, bary, distanceSquared };
        }
        return best;
    }
    const ap = sub(point, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
    if (d1 <= 0 && d2 <= 0) return { closest: a, bary: [1, 0, 0] };
    const bp = sub(point, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) return { closest: b, bary: [0, 1, 0] };
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) {
        const v = d1 / (d1 - d3);
        return { closest: a.map((value, k) => value + ab[k] * v), bary: [1 - v, v, 0] };
    }
    const cp = sub(point, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
    if (d6 >= 0 && d5 <= d6) return { closest: c, bary: [0, 0, 1] };
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
        const w = d2 / (d2 - d6);
        return { closest: a.map((value, k) => value + ac[k] * w), bary: [1 - w, 0, w] };
    }
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
        const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
        return { closest: b.map((value, k) => value + (c[k] - value) * w), bary: [0, 1 - w, w] };
    }
    const denominator = 1 / (va + vb + vc), v = vb * denominator, w = vc * denominator;
    return { closest: a.map((value, k) => value + ab[k] * v + ac[k] * w), bary: [1 - v - w, v, w] };
}

/** Build once from explicitly selected source-body triangle ordinals. */
export function createPatch({ bodyIndices, sourceTriangleIds, sourcePositions, sourceNormals, leafSize = 4 } = {}) {
    validateSource(bodyIndices, sourceTriangleIds, sourcePositions, sourceNormals);
    if (!Number.isInteger(leafSize) || leafSize < 1 || leafSize > 32) throw Error('Invalid leaf size');
    const used = new Set();
    for (const triangle of sourceTriangleIds) {
        for (let corner = 0; corner < 3; corner++) used.add(bodyIndices[triangle * 3 + corner]);
    }
    const sourceVertexIds = Uint32Array.from([...used].sort((a, b) => a - b));
    const local = new Map(Array.from(sourceVertexIds, (id, index) => [id, index]));
    const patch = {
        sourceVertexIds, positions: new Float32Array(sourceVertexIds.length * 4),
        normals: new Float32Array(sourceVertexIds.length * 4), leafSize
    };
    copySelected(patch, sourcePositions, sourceNormals, patch.positions, patch.normals);
    const triangles = Array.from(sourceTriangleIds, t => [
        local.get(bodyIndices[t * 3]), local.get(bodyIndices[t * 3 + 1]), local.get(bodyIndices[t * 3 + 2]), t
    ]);
    const nodes = [], ordered = [];
    function build(list) {
        const node = { escape: 0, first: 0, count: 0, right: 0 };
        nodes.push(node);
        if (list.length <= leafSize) {
            node.first = ordered.length; node.count = list.length; ordered.push(...list);
        } else {
            const centroids = list.map(t => [0, 1, 2].map(k =>
                (patch.positions[t[0] * 4 + k] + patch.positions[t[1] * 4 + k] + patch.positions[t[2] * 4 + k]) / 3));
            const extent = [0, 1, 2].map(k => Math.max(...centroids.map(p => p[k])) - Math.min(...centroids.map(p => p[k])));
            const axis = extent.indexOf(Math.max(...extent));
            const sorted = list.map((triangle, index) => ({ triangle, centre: centroids[index][axis] }))
                .sort((a, b) => a.centre - b.centre || a.triangle[3] - b.triangle[3]).map(value => value.triangle);
            const middle = Math.floor(sorted.length / 2);
            build(sorted.slice(0, middle)); node.right = nodes.length; build(sorted.slice(middle));
        }
        node.escape = nodes.length;
    }
    build(triangles);
    patch.triangles = Uint32Array.from(ordered.flat());
    patch.boundaryMasks = boundaryMasksFor(patch.triangles);
    patch.meta = Uint32Array.from(nodes.flatMap(n => [n.escape, n.first, n.count, n.right]));
    patch.boundsMin = new Float32Array(nodes.length * 4);
    patch.boundsMax = new Float32Array(nodes.length * 4);
    validatePacked(patch, false); topologyValidated.add(patch);
    return refit(patch);
}

function copySelected(patch, positions, normals, targetPositions, targetNormals) {
    for (let i = 0; i < patch.sourceVertexIds.length; i++) {
        const source = patch.sourceVertexIds[i];
        for (let k = 0; k < 3; k++) {
            targetPositions[i * 4 + k] = positions[source * 3 + k];
            targetNormals[i * 4 + k] = normals[source * 3 + k];
        }
    }
}

function stageFor(patch) {
    let stage = staging.get(patch);
    if (!stage) {
        stage = {
            positions: new Float32Array(patch.positions.length), normals: new Float32Array(patch.normals.length),
            boundsMin: new Float32Array(patch.boundsMin.length), boundsMax: new Float32Array(patch.boundsMax.length)
        };
        staging.set(patch, stage);
    }
    return stage;
}

function commit(patch, stage, refitBounds, { advanceHistory = false, reset = false } = {}) {
    requireLive(patch);
    if (typeof advanceHistory !== 'boolean' || typeof reset !== 'boolean') throw Error('History options must be boolean');
    if (!refitBounds && (advanceHistory || reset)) throw Error('Atomic history update requires refitBounds');
    if (advanceHistory && !reset) requireUsable(patch);
    finiteArray(stage.positions, 'updated positions', 4);
    finiteArray(stage.normals, 'updated normals', 4);
    const oldHistory = histories.get(patch);
    if (refitBounds) {
        // Refit staging first. A failed read/pose/bounds operation must not publish half a frame.
        refitInto(patch, stage.boundsMin, stage.boundsMax, null, stage.positions);
        const previous = reset ? null : advanceHistory ? patch.positions
            : oldHistory?.historyValid ? oldHistory.previousPositions : null;
        if (previous) {
            stage.unionBoundsMin ??= new Float32Array(patch.boundsMin.length);
            stage.unionBoundsMax ??= new Float32Array(patch.boundsMax.length);
            refitInto(patch, stage.unionBoundsMin, stage.unionBoundsMax, previous, stage.positions);
        }
    }
    requireLive(patch); // A custom body getter may have disposed the patch while staging.
    const history = (advanceHistory || reset) ? historyFor(patch) : oldHistory;
    if (advanceHistory && !reset) {
        history.previousPositions.set(patch.positions); history.previousNormals.set(patch.normals);
        history.historyValid = true;
    }
    patch.positions.set(stage.positions); patch.normals.set(stage.normals);
    usable.delete(patch);
    if (refitBounds) {
        patch.boundsMin.set(stage.boundsMin); patch.boundsMax.set(stage.boundsMax);
        if (history) {
            if (reset || !history.historyValid) collapseHistory(patch, history);
            else {
                history.unionBoundsMin.set(stage.unionBoundsMin);
                history.unionBoundsMax.set(stage.unionBoundsMax);
            }
        }
        usable.add(patch);
    }
    return patch;
}

/** A failed source-array update leaves current pose, history and query validity intact. */
export function updateFromCaptured(patch, positions, normals, options = {}) {
    requireUsable(patch);
    finiteArray(positions, 'captured positions', 3);
    finiteArray(normals, 'captured normals', 3);
    if (positions.length !== normals.length) throw Error('Captured position/normal length mismatch');
    integerArray(patch.sourceVertexIds, 'sourceVertexIds', positions.length / 3 - 1);
    const stage = stageFor(patch);
    copySelected(patch, positions, normals, stage.positions, stage.normals);
    return commit(patch, stage, true, options);
}

/**
 * Includes current morphs, all four skin weights, bind transforms and world normal matrix.
 * sourceIndex is canonical full topology (for example Wardrobe.fullIndex), never a compacted
 * garment mask. It is checked once against the patch's source ordinals; later render-index
 * changes are irrelevant to pose sampling. The returned function stages pose/refit/history
 * together with update({advanceHistory:true, reset}); explicit snapshot APIs remain available.
 */
export function makeSkinnedUpdater(body, patch, { sourceIndex = body?.geometry?.index?.array } = {}) {
    requireUsable(patch);
    if (!body?.isSkinnedMesh || !body.geometry || !body.skeleton) throw Error('Skinned body required');
    const geometry = body.geometry, skeleton = body.skeleton;
    const vertexCount = geometry.getAttribute('position')?.count;
    if (!Number.isInteger(vertexCount) || vertexCount < 1) throw Error('Body position attribute required');
    integerArray(sourceIndex, 'sourceIndex (canonical full topology)', vertexCount - 1, 3);
    for (let offset = 0; offset < patch.triangles.length; offset += 4) {
        const source = patch.triangles[offset + 3];
        for (let corner = 0; corner < 3; corner++) {
            if (sourceIndex[source * 3 + corner] !== patch.sourceVertexIds[patch.triangles[offset + corner]]) {
                throw Error('sourceIndex does not match patch source triangle ordinals; supply canonical full topology (Wardrobe.fullIndex)');
            }
        }
    }
    const p = new Vector3(), n = new Vector3(), delta = new Vector3();
    const normal4 = new Vector4(), normalMatrix = new Matrix3();
    return function update({ refitBounds = true, updateSkeleton = true, advanceHistory = false, reset = false } = {}) {
        requireLive(patch);
        if (!topologyValidated.has(patch)) throw Error('Unknown patch topology');
        if (body.geometry !== geometry || body.skeleton !== skeleton) throw Error('Body geometry or skeleton changed; rebuild the surface updater');
        const normalAttribute = body.geometry.getAttribute('normal');
        const positionAttribute = body.geometry.getAttribute('position');
        const maximumId = patch.sourceVertexIds[patch.sourceVertexIds.length - 1];
        if (!normalAttribute || !positionAttribute || normalAttribute.itemSize !== 3 || positionAttribute.itemSize !== 3
            || normalAttribute.count <= maximumId || positionAttribute.count <= maximumId) {
            throw Error('Body attributes do not cover selected source vertices');
        }
        const skinIndex = geometry.getAttribute('skinIndex'), skinWeight = geometry.getAttribute('skinWeight');
        if (!skinIndex || !skinWeight || skinIndex.itemSize !== 4 || skinWeight.itemSize !== 4
            || skinIndex.count <= maximumId || skinWeight.count <= maximumId) throw Error('Four-weight skin attributes must cover selected source vertices');
        for (const vertex of patch.sourceVertexIds) {
            for (let component = 0; component < 4; component++) {
                const joint = skinIndex.getComponent(vertex, component), weight = skinWeight.getComponent(vertex, component);
                if (!Number.isInteger(joint) || joint < 0 || joint >= skeleton.bones.length || !Number.isFinite(weight)) {
                    throw Error('Invalid selected skin joint or weight');
                }
            }
        }
        if (updateSkeleton) body.skeleton.update();
        const morphs = body.geometry.morphAttributes.normal ?? [];
        const weights = body.morphTargetInfluences ?? [];
        for (const weight of weights) {
            if (!Number.isFinite(weight)) throw Error('Morph weights must be finite');
        }
        const active = [];
        for (let i = 0; i < morphs.length; i++) {
            if (weights[i]) {
                if (morphs[i].itemSize !== 3 || morphs[i].count <= maximumId) throw Error('Invalid morph normal attribute');
                active.push(i);
            }
        }
        const baseWeight = body.geometry.morphTargetsRelative ? 1 : 1 - weights.reduce((sum, weight) => sum + weight, 0);
        normalMatrix.getNormalMatrix(body.matrixWorld);
        const stage = stageFor(patch);
        for (let i = 0; i < patch.sourceVertexIds.length; i++) {
            const vertex = patch.sourceVertexIds[i];
            body.getVertexPosition(vertex, p).applyMatrix4(body.matrixWorld).toArray(stage.positions, i * 4);
            n.fromBufferAttribute(normalAttribute, vertex);
            if (morphs.length) {
                n.multiplyScalar(baseWeight);
                for (const morph of active) n.addScaledVector(delta.fromBufferAttribute(morphs[morph], vertex), weights[morph]);
            }
            normal4.set(n.x, n.y, n.z, 0);
            body.applyBoneTransform(vertex, normal4);
            n.set(normal4.x, normal4.y, normal4.z).applyMatrix3(normalMatrix).normalize().toArray(stage.normals, i * 4);
        }
        return commit(patch, stage, refitBounds, { advanceHistory, reset });
    };
}

// Refit into supplied bounds. With previousPositions, each leaf covers both endpoints
// of every vertex, hence the entire LINEAR interpolation of every triangle/subtree.
function refitInto(patch, boundsMin, boundsMax, previousPositions = null, positions = patch.positions) {
    const { meta, triangles } = patch;
    for (let node = meta.length / 4 - 1; node >= 0; node--) {
        const offset = node * 4, count = meta[offset + 2];
        if (count) {
            for (let k = 0; k < 3; k++) {
                let low = Infinity, high = -Infinity;
                for (let t = meta[offset + 1]; t < meta[offset + 1] + count; t++) {
                    for (let corner = 0; corner < 3; corner++) {
                        const index = triangles[t * 4 + corner] * 4 + k, value = positions[index];
                        low = Math.min(low, value); high = Math.max(high, value);
                        if (previousPositions) {
                            low = Math.min(low, previousPositions[index]); high = Math.max(high, previousPositions[index]);
                        }
                    }
                }
                boundsMin[offset + k] = low; boundsMax[offset + k] = high;
            }
        } else {
            const left = (node + 1) * 4, right = meta[offset + 3] * 4;
            for (let k = 0; k < 3; k++) {
                boundsMin[offset + k] = Math.min(boundsMin[left + k], boundsMin[right + k]);
                boundsMax[offset + k] = Math.max(boundsMax[left + k], boundsMax[right + k]);
            }
        }
    }
}

/** Required after intentional direct vertex edits. A failed refit invalidates queries. */
export function refit(patch) {
    requireLive(patch); usable.delete(patch);
    if (!topologyValidated.has(patch)) { validatePacked(patch, false); topologyValidated.add(patch); }
    finiteArray(patch.positions, 'positions', 4); finiteArray(patch.normals, 'normals', 4);
    refitInto(patch, patch.boundsMin, patch.boundsMax);
    const history = histories.get(patch);
    if (history) {
        if (history.historyValid) refitInto(patch, history.unionBoundsMin, history.unionBoundsMax, history.previousPositions);
        else collapseHistory(patch, history);
    }
    usable.add(patch);
    return patch;
}

function collapseHistory(patch, history) {
    history.previousPositions.set(patch.positions); history.previousNormals.set(patch.normals);
    history.unionBoundsMin.set(patch.boundsMin); history.unionBoundsMax.set(patch.boundsMax);
    history.historyValid = false;
}

function historyFor(patch) {
    let history = histories.get(patch);
    if (!history) {
        history = {
            previousPositions: new Float32Array(patch.positions.length),
            previousNormals: new Float32Array(patch.normals.length),
            unionBoundsMin: new Float32Array(patch.boundsMin.length),
            unionBoundsMax: new Float32Array(patch.boundsMax.length), historyValid: false
        };
        collapseHistory(patch, history); histories.set(patch, history);
    }
    return history;
}

/** Call ONCE before updating the body for a submitted frame, never between substeps. */
export function snapshotPreviousPose(patch) {
    requireUsable(patch);
    const history = historyFor(patch);
    collapseHistory(patch, history); history.historyValid = true;
    return motionBuffers(patch);
}

/** Discontinuity/attach reset: collapse the interval to current; alpha=1 remains usable. */
export function resetHistory(patch) {
    requireUsable(patch); collapseHistory(patch, historyFor(patch));
    return motionBuffers(patch);
}

/** Stable typed arrays; callers must not mutate snapshots or union bounds. */
export function motionBuffers(patch) {
    requireUsable(patch);
    const history = historyFor(patch);
    return { ...history, currentPositions: patch.positions, currentNormals: patch.normals };
}

function interpolationView(patch, alpha) {
    requireUsable(patch);
    if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) throw Error('alpha must be in [0,1]');
    if (alpha === 1) return { previous: null, alpha, boundsMin: patch.boundsMin, boundsMax: patch.boundsMax };
    const history = histories.get(patch);
    if (!history?.historyValid) throw Error('No valid previous/current interval; use alpha=1 after reset');
    return { previous: history, alpha, boundsMin: history.unionBoundsMin, boundsMax: history.unionBoundsMax };
}

function vertexAt(current, previous, index, alpha) {
    if (!previous) return xyz(current, index);
    return [0, 1, 2].map(k => previous[index * 4 + k]
        + (current[index * 4 + k] - previous[index * 4 + k]) * alpha);
}

function boxDistanceSquared(boundsMin, boundsMax, node, point) {
    let distance = 0;
    for (let k = 0; k < 3; k++) {
        const outside = Math.max(boundsMin[node * 4 + k] - point[k], 0, point[k] - boundsMax[node * 4 + k]);
        distance += outside * outside;
    }
    return distance;
}

/** Same current-pose result as v2, including deterministic source-triangle ties. */
export function nearest(patch, point, options = {}) { return nearestAt(patch, point, 1, options); }

/** Linear endpoint-vertex interpolation, not evaluation of an intermediate skeletal pose. */
export function nearestAt(patch, point, alpha, { maxDistance = Infinity, bruteForce = false } = {}) {
    const view = interpolationView(patch, alpha);
    queryPoint(point);
    if (!(maxDistance >= 0) || (maxDistance !== Infinity && !Number.isFinite(maxDistance))) {
        throw Error('maxDistance must be nonnegative and finite or Infinity');
    }
    let best = null, bestD2 = maxDistance * maxDistance, nodesVisited = 0, trianglesTested = 0;
    const position = index => vertexAt(patch.positions, view.previous?.previousPositions, index, alpha);
    function visitTriangle(triangle) {
        trianglesTested++;
        const offset = triangle * 4;
        const a = position(patch.triangles[offset]), b = position(patch.triangles[offset + 1]), c = position(patch.triangles[offset + 2]);
        const hit = closestTriangle(point, a, b, c), difference = sub(point, hit.closest);
        const distanceSquared = dot(difference, difference);
        if (distanceSquared > bestD2 || (distanceSquared === bestD2 && best
            && patch.triangles[offset + 3] >= best.sourceBodyTriangle)) return;
        bestD2 = distanceSquared;
        best = { ...hit, orderedTriangle: triangle, sourceBodyTriangle: patch.triangles[offset + 3],
            geometricNormal: normalize(cross(sub(b, a), sub(c, a))) };
    }
    if (bruteForce) {
        for (let triangle = 0; triangle < patch.triangles.length / 4; triangle++) visitTriangle(triangle);
    } else {
        let node = 0;
        while (node < patch.meta.length / 4) {
            nodesVisited++;
            const offset = node * 4;
            if (boxDistanceSquared(view.boundsMin, view.boundsMax, node, point) > bestD2) { node = patch.meta[offset]; continue; }
            const count = patch.meta[offset + 2];
            if (count) {
                for (let t = patch.meta[offset + 1]; t < patch.meta[offset + 1] + count; t++) visitTriangle(t);
                node = patch.meta[offset];
            } else node++;
        }
    }
    if (!best) return null;
    const offset = best.orderedTriangle * 4;
    let normal = [0, 0, 0];
    for (let corner = 0; corner < 3; corner++) {
        const n = vertexAt(patch.normals, view.previous?.previousNormals, patch.triangles[offset + corner], alpha);
        for (let k = 0; k < 3; k++) normal[k] += n[k] * best.bary[corner];
    }
    normal = normalize(normal);
    const mask = patch.boundaryMasks[best.orderedTriangle], distance = Math.sqrt(bestD2);
    return { ...best, barycentric: best.bary, distance, distanceSquared: bestD2, interpolatedNormal: normal,
        signedDistance: distance * (dot(sub(point, best.closest), normal) < 0 ? -1 : 1),
        boundaryTriangle: (mask & 7) !== 0, boundaryVertexTriangle: (mask & 56) !== 0,
        closestOnOpenBoundary: best.bary.some((weight, corner) =>
            (weight < 1e-7 && (mask & (1 << corner))) || (weight > 1 - 1e-7 && (mask & (1 << (corner + 3))))),
        nodesVisited, trianglesTested };
}

function segmentBox(patch, node, a, b) {
    let low = 0, high = 1;
    for (let k = 0; k < 3; k++) {
        const direction = b[k] - a[k], min = patch.boundsMin[node * 4 + k], max = patch.boundsMax[node * 4 + k];
        if (Math.abs(direction) < 1e-15) { if (a[k] < min || a[k] > max) return false; }
        else {
            let t0 = (min - a[k]) / direction, t1 = (max - a[k]) / direction;
            if (t0 > t1) [t0, t1] = [t1, t0];
            low = Math.max(low, t0); high = Math.min(high, t1);
            if (low > high) return false;
        }
    }
    return true;
}

/** Current pose only; returns first transverse hit. Coplanar/degenerate triangles are skipped. */
export function segmentIntersection(patch, a, b) {
    requireUsable(patch); queryPoint(a, 'segment start'); queryPoint(b, 'segment end');
    const direction = sub(b, a);
    let best = null, node = 0;
    while (node < patch.meta.length / 4) {
        const offset = node * 4;
        if (!segmentBox(patch, node, a, b)) { node = patch.meta[offset]; continue; }
        const count = patch.meta[offset + 2];
        if (!count) { node++; continue; }
        for (let t = patch.meta[offset + 1]; t < patch.meta[offset + 1] + count; t++) {
            const v0 = xyz(patch.positions, patch.triangles[t * 4]), v1 = xyz(patch.positions, patch.triangles[t * 4 + 1]);
            const v2 = xyz(patch.positions, patch.triangles[t * 4 + 2]), e1 = sub(v1, v0), e2 = sub(v2, v0);
            const h = cross(direction, e2), determinant = dot(e1, h);
            if (Math.abs(determinant) < 1e-12) continue;
            const inverse = 1 / determinant, s = sub(a, v0), u = dot(s, h) * inverse;
            if (u < 0 || u > 1) continue;
            const q = cross(s, e1), v = dot(direction, q) * inverse;
            if (v < 0 || u + v > 1) continue;
            const fraction = dot(e2, q) * inverse;
            if (fraction < 0 || fraction > 1 || (best && fraction >= best.fraction)) continue;
            best = { fraction, point: a.map((value, k) => value + direction[k] * fraction),
                orderedTriangle: t, sourceBodyTriangle: patch.triangles[t * 4 + 3], barycentric: [1 - u - v, u, v] };
        }
        node = patch.meta[offset];
    }
    return best;
}

export function byteSizes(patch) {
    requireUsable(patch);
    const sizes = Object.fromEntries(packedFields.map(name => [name, patch[name].byteLength]));
    return { ...sizes, total: Object.values(sizes).reduce((sum, bytes) => sum + bytes, 0) };
}

/** Serializes current geometry only. Restore starts with no interpolation history. */
export function serializePatch(patch) {
    requireUsable(patch);
    return { leafSize: patch.leafSize, ...Object.fromEntries(packedFields.map(name => [name, Array.from(patch[name])])) };
}

export function hydratePatch(data) {
    validatePacked(data); // validate BEFORE Uint32 conversion can hide malformed input
    const patch = { leafSize: data.leafSize };
    for (const name of packedFields) patch[name] = integerFields.has(name) ? Uint32Array.from(data[name]) : Float32Array.from(data[name]);
    topologyValidated.add(patch);
    return refit(patch); // serialized finite but stale bounds cannot prune valid geometry
}

/** CPU lifecycle only. GPU owners dispose their own resources separately. Idempotent. */
export function disposePatch(patch) {
    if (patch && disposed.has(patch)) return;
    requireLive(patch);
    usable.delete(patch); topologyValidated.delete(patch); histories.delete(patch); staging.delete(patch);
    disposed.add(patch);
}
