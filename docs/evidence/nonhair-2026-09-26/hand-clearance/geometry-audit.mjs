// Discrete hand-contact diagnostic. No asset writes, motion changes or clearance qualification.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readGlb, readPrimitive, readAccessor } from '../../../../tools/lut-bake/glb.mjs';
import { intersectTriangles } from '../../../../tools/figure-pipeline/hair_surface.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const E = 1e-10;
const triangleKey = ids => ids.join(',');
const drawnFaces = indices => new Set(Array.from({ length: indices.length / 3 }, (_, f) => triangleKey(indices.slice(f * 3, f * 3 + 3))));
function selectedTriangles(mesh, select) {
    const result = [];
    for (let face = 0; face < mesh.fullIndices.length / 3; face++) {
        const ids = mesh.fullIndices.slice(face * 3, face * 3 + 3);
        if (!select(ids, face)) continue;
        const vertices = ids.map(i => mesh.positions.slice(i * 3, i * 3 + 3));
        result.push({ face, ids, vertices,
            min: [0, 1, 2].map(k => Math.min(...vertices.map(v => v[k]))),
            max: [0, 1, 2].map(k => Math.max(...vertices.map(v => v[k]))) });
    }
    return result;
}
function crossings(hands, target, handDrawn, targetDrawn, witnessLimit) {
    let pairs = 0; const handFaces = new Set(), targetFaces = new Set(), witnesses = [];
    for (const a of hands) for (const b of target) {
        if ([0, 1, 2].some(k => a.max[k] < b.min[k] - E || b.max[k] < a.min[k] - E)) continue;
        const hit = intersectTriangles(a.vertices, b.vertices, E);
        if (!hit) continue;
        pairs++; handFaces.add(a.face); targetFaces.add(b.face);
        if (witnesses.length < witnessLimit) witnesses.push({ handFace: a.face, targetFace: b.face,
            handVertexIds: a.ids, targetVertexIds: b.ids, handVertices: a.vertices, targetVertices: b.vertices,
            kind: hit.kind, points: hit.points, handDrawn: handDrawn.has(triangleKey(a.ids)),
            targetDrawn: targetDrawn.has(triangleKey(b.ids)),
            sameAt1e9: !!intersectTriangles(a.vertices, b.vertices, 1e-9),
            sameAt1e11: !!intersectTriangles(a.vertices, b.vertices, 1e-11) });
    }
    return { pairs, handFaces: handFaces.size, targetFaces: targetFaces.size, witnesses };
}

export function createHandGeometryAudit({ bodyPath, garmentPath }) {
    const sources = Object.fromEntries([bodyPath, garmentPath].map(p => [p, sha(fs.readFileSync(p))]));
    const glb = readGlb(bodyPath), body = readPrimitive(glb, 'base.001');
    const cloth = readPrimitive(readGlb(garmentPath), 'female_casualsuit01');
    const primitive = glb.json.meshes[0].primitives[0];
    const joints = readAccessor(glb, primitive.attributes.JOINTS_0).data;
    const weights = readAccessor(glb, primitive.attributes.WEIGHTS_0).data;
    const names = glb.json.skins[0].joints.map(i => glb.json.nodes[i].name);
    const weight = (v, predicate) => [0, 1, 2, 3].reduce((sum, k) => sum +
        (predicate(names[joints[v * 4 + k]]) ? weights[v * 4 + k] : 0), 0);
    const hands = Object.fromEntries(['l', 'r'].map(side => [side, Array.from({ length: body.vertexCount }, (_, v) =>
        weight(v, n => /^(hand|thumb|index|middle|ring|pinky)_/.test(n) && n.endsWith('_' + side)) >= .5)]));
    const legs = Array.from({ length: body.vertexCount }, (_, v) => weight(v, n => n === 'pelvis' || /^thigh_/.test(n)) >= .5);

    // The original receipt uses rounded position bins, not a Euclidean-distance weld.
    const parent = Array.from({ length: cloth.vertexCount }, (_, i) => i), keys = new Map();
    const find = i => { while (parent[i] !== i) i = parent[i]; return i; };
    for (let i = 0; i < cloth.vertexCount; i++) {
        const key = Array.from(cloth.positions.slice(i * 3, i * 3 + 3), x => Math.round(x / 1e-7)).join(':');
        if (keys.has(key)) parent[find(i)] = find(keys.get(key)); else keys.set(key, i);
    }
    for (let t = 0; t < cloth.indices.length; t += 3) for (let k = 1; k < 3; k++)
        parent[find(cloth.indices[t + k])] = find(cloth.indices[t]);
    const components = new Map();
    for (let f = 0; f < cloth.indices.length / 3; f++) {
        const ids = Array.from(cloth.indices.slice(f * 3, f * 3 + 3)), root = find(ids[0]);
        if (!components.has(root)) components.set(root, { faces: [], vertices: new Set(), min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
        const c = components.get(root); c.faces.push(f);
        for (const v of ids) { c.vertices.add(v); for (let k = 0; k < 3; k++) {
            c.min[k] = Math.min(c.min[k], cloth.positions[v * 3 + k]);
            c.max[k] = Math.max(c.max[k], cloth.positions[v * 3 + k]);
        } }
    }
    assert.equal(components.size, 2, 'Only the retained two-component outfit is supported');
    const ordered = [...components.values()].sort((a, b) => a.max[1] - b.max[1]);
    assert.equal(ordered[0].faces.length, 1712); assert.ok(ordered[0].max[1] < 1);
    const trouserFaces = new Set(ordered[0].faces);
    const summary = ordered.map(c => ({ triangles: c.faces.length, vertices: c.vertices.size, min: c.min, max: c.max,
        firstFace: Math.min(...c.faces), lastFace: Math.max(...c.faces) }));
    const method = {
        hand: 'All three vertices each have >=.5 summed source hand/finger-joint weight for that side.',
        lowerBody: 'All three vertices each have >=.5 pelvis/thigh weight. This is a subset, not the whole body.',
        trousers: 'Lower source component after rounded rest-position bins at1e-7m,1712 faces.',
        predicate: 'AABB pruning and intersectTriangles at1e-10m; boundary contacts count. Selected witnesses also checked at1e-9/1e-11m.',
        limits: 'Discrete CPU-skinned geometry, triangle-pair counts only. No depth, continuous clearance, inside test, forearm coverage or visual-severity score.'
    };
    return { sources, method, components: summary,
        analyze(snapshot, { witnessLimit = 4 } = {}) {
            assert.ok(Number.isInteger(witnessLimit) && witnessLimit >= 0 && witnessLimit <= 16);
            const b = snapshot.meshes.find(m => m.id === 'body'), g = snapshot.meshes.find(m => m.id === 'female_casualsuit01');
            assert.ok(b && g, 'Both source meshes required');
            for (const [mesh, source] of [[b, body], [g, cloth]]) {
                assert.deepEqual(mesh.fullIndices, Array.from(source.indices), 'Exact source topology required');
                assert.equal(mesh.positions.length, source.positions.length);
                assert.ok(mesh.positions.every(Number.isFinite), 'Invalid posed positions');
                assert.equal(mesh.drawnIndices.length % 3, 0);
                const full = drawnFaces(mesh.fullIndices);
                for (const key of drawnFaces(mesh.drawnIndices)) assert.ok(full.has(key), 'Drawn triangle must belong to source');
            }
            const bd = drawnFaces(b.drawnIndices), gd = drawnFaces(g.drawnIndices);
            const trousers = selectedTriangles(g, (_, f) => trouserFaces.has(f));
            const lower = selectedTriangles(b, ids => ids.every(i => legs[i]));
            const sides = {};
            for (const side of ['l', 'r']) {
                const hand = selectedTriangles(b, ids => ids.every(i => hands[side][i]));
                sides[side] = { handTriangles: hand.length, drawnHandTriangles: hand.filter(t => bd.has(triangleKey(t.ids))).length,
                    trousers: crossings(hand, trousers, bd, gd, witnessLimit),
                    lowerBody: crossings(hand, lower, bd, bd, witnessLimit) };
            }
            return { time: snapshot.time, sides };
        }
    };
}
