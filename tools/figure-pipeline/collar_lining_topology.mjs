// A source-topology collar band for diagnostic rendering. No original geometry is moved.
export function collarBand(positions, indices, {width = .045} = {}) {
    if (!(width > 0 && width <= .08)) throw Error('Collar band width must be in (0, 80 mm]');
    const groups = [], byPosition = new Map(), groupOf = [];
    for (let i = 0; i < positions.length / 3; i++) {
        const p = Array.from(positions.slice(i * 3, i * 3 + 3));
        const key = p.map(v => Math.round(v / 1e-7)).join(':');
        let g = byPosition.get(key);
        if (!g) { g = {id: groups.length, position: p, vertices: [], neighbors: new Map(), distance: Infinity}; groups.push(g); byPosition.set(key, g); }
        g.vertices.push(i); groupOf[i] = g.id;
    }
    const edges = new Map();
    for (let t = 0; t < indices.length; t += 3) for (let k = 0; k < 3; k++) {
        const a = groupOf[indices[t+k]], b = groupOf[indices[t+(k+1)%3]], key = [a,b].sort((a,b)=>a-b).join(':');
        if (!edges.has(key)) edges.set(key, {a, b, count: 0});
        edges.get(key).count++;
        const distance = Math.hypot(...groups[a].position.map((v,k)=>v-groups[b].position[k]));
        groups[a].neighbors.set(b, distance); groups[b].neighbors.set(a, distance);
    }
    // Source-space anatomical selection, inherited from the frozen solve; the boundary must
    // independently form one simple closed loop before any band can be selected.
    const rim = [...edges.values()].filter(e => e.count === 1 && [e.a,e.b].every(i => {
        const p = groups[i].position; return p[1] > 1.28 && Math.abs(p[0]) < .13;
    }));
    if (rim.length !== 20) throw Error('Expected the qualified 20-edge collar rim');
    const rimNeighbors = new Map();
    for (const {a,b} of rim) {
        for (const [x,y] of [[a,b],[b,a]]) { if (!rimNeighbors.has(x)) rimNeighbors.set(x, []); rimNeighbors.get(x).push(y); }
    }
    if ([...rimNeighbors.values()].some(n => n.length !== 2)) throw Error('Collar boundary is not a simple loop');
    const ordered = [rim[0].a]; let previous = null;
    while (true) {
        const current = ordered.at(-1), next = rimNeighbors.get(current).find(i => i !== previous);
        if (next === ordered[0]) break;
        if (ordered.includes(next)) throw Error('Disconnected or repeated collar boundary');
        ordered.push(next); previous = current;
    }
    if (ordered.length !== rim.length) throw Error('More than one selected collar loop');
    for (const i of ordered) groups[i].distance = 0;
    const unvisited = new Set(groups.map(g => g.id));
    while (unvisited.size) {
        let best = null;
        for (const i of unvisited) if (best === null || groups[i].distance < groups[best].distance) best = i;
        if (groups[best].distance > width) break;
        unvisited.delete(best);
        for (const [neighbor, length] of groups[best].neighbors) groups[neighbor].distance = Math.min(groups[neighbor].distance, groups[best].distance + length);
    }
    const triangles = [], bandIndices = [];
    for (let t = 0; t < indices.length; t += 3) {
        const vertices = Array.from(indices.slice(t,t+3));
        if (!vertices.some(i => groups[groupOf[i]].distance < width)) continue;
        if (vertices.some(i => i >= 1427)) throw Error('Band entered the source denim vertex region');
        triangles.push(t/3); bandIndices.push(...vertices);
    }
    for (const witness of [597,598,599,1432]) if (!triangles.includes(witness)) throw Error('Band omits a localized back-face witness');
    return {width, boundaryEdges: rim.length, boundaryVertices: ordered.map(i => groups[i].vertices), triangles, indices: bandIndices,
        uniqueVertices: [...new Set(bandIndices)], limits: ['Selects complete incident triangles inside a source-space geodesic band.',
            'Zero-thickness interior prototype. No vertex displacement, seam rounding, general garment support, or positive clearance certificate.']};
}
