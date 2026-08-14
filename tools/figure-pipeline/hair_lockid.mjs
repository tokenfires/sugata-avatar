//
// hair_lockid.mjs — the LOCK CHANNEL, decoded off an exported groom and re-derived from the
// generator's own sites. The operator half of `verify_glb.mjs`'s lock clause.
//
// ## What the channel is
//
// `tools/figure-pipeline/hair_cards.py` has carried a real lock identity since R22 — `LOCK_COUNT`
// dart-thrown scalp centres shared by every layer, every card assigned by `nearest_lock(root)`,
// three quarters of a card's deflection owned by its lock — and until R25 **none of it reached the
// mesh.** The GLB carried POSITION / NORMAL / TEXCOORD_0 / JOINTS_0 / WEIGHTS_0, and TEXCOORD_0's
// `u` is the ATLAS STRIP, shared by every card on it. R25 adds a second UV layer:
//
//     u1 = (lockIndex + 0.5) / lockCount        constant over a whole card
//     v1 = clamp( (d2 − d1) / edgeScale, 0, 1 ) the Voronoi edge distance at the card's root
//
// and puts the sixteen centres, the count and the metre scale into the mesh's `extras`.
//
// ## 🎯 WHY THE CENTRES TRAVEL WITH THE FILE
//
// This project's signature failure is a statistic structurally blind to the defect it was written
// for — six instances, the most recent found on the judges' own side. A gate that reads the
// emitted channel and checks it is "in range" is exactly that shape: it would pass a build that
// wrote the same index to all 496 cards, and it would pass a build whose Y-up conversion was
// wrong. So the gate does not check the channel's SHAPE, it RE-DERIVES it: nearest of the sixteen
// centres to each card's own exported root, compared against the emitted index, card by card.
//
// ⚠️ **AND THE RE-DERIVATION IS NOT EXACT, FOR A REASON THAT IS ARITHMETIC AND STATED.** The
// generator assigns a card from its ROOT — the point on the scalp `sample_roots` returned. What the
// file carries is the ribbon's first ring, which `grow_guide` starts at `root + normal · standoff`,
// 3.8–30 mm off the scalp along the surface normal depending on the layer, and which
// `clamp_cards_off_the_body` may then have walked further. Moving a point off a curved surface does
// not preserve nearest-site order for a point already near a Voronoi boundary. So the clause is
// two-sided: a high match rate AND every mismatch confined to small emitted `v1`, which is the
// channel's own statement that the root was near a boundary. A mismatch at a lock CORE would mean
// the index is wrong, and that is the thing worth failing a build over.
//
// ## The operators, and each is validated on a shape whose answer is arithmetic
//
// `hair_lockid.selftest.mjs` runs them against synthetic site sets — one site, two sites, a square
// lattice, a collinear triple — where F1, F2 and the encoded pair are known on paper. Nothing here
// is pointed at a groom before that passes.
//

/**
 * The nearest and second-nearest of a set of sites, and the nearest's index.
 *
 * Exhaustive over every site rather than over a neighbourhood, which is `hair_cards.py`'s own
 * choice and for its reason: sixteen dart-thrown centres over one scalp are not a grid, and a 3x3
 * cell scan on a set that is not a grid can miss the true second-nearest entirely. Sixteen sites is
 * 16 distance evaluations.
 *
 * Ties break on the LOWER INDEX, matching Python's `sorted` being stable over `range(len(locks))`.
 *
 * @param {Float64Array|number[]} sites - flat xyz triples.
 * @param {number[]} point - [x, y, z].
 * @returns {{ index:number, nearest:number, second:number }} distances, not squared distances.
 */
export function nearestTwoSites( sites, point ) {

    const count = sites.length / 3;

    if ( count < 1 ) throw new Error( 'hair_lockid: no sites' );

    let index = - 1;
    let nearest = Infinity;
    let second = Infinity;

    for ( let site = 0; site < count; site ++ ) {

        const dx = sites[ site * 3 ] - point[ 0 ];
        const dy = sites[ site * 3 + 1 ] - point[ 1 ];
        const dz = sites[ site * 3 + 2 ] - point[ 2 ];
        const distance = Math.sqrt( dx * dx + dy * dy + dz * dz );

        // `<` and not `<=` on both, so a tie leaves the earlier site in place — the stable-sort
        // rule the Python side gets for free.
        if ( distance < nearest ) {

            second = nearest;
            nearest = distance;
            index = site;

        } else if ( distance < second ) {

            second = distance;

        }

    }

    return { index, nearest, second: count === 1 ? nearest : second };

}

/**
 * The channel `hair_cards.lock_channel` writes, in JavaScript. The gate's prediction.
 *
 * @param {Float64Array|number[]} sites - flat xyz triples, in the mesh's own space.
 * @param {number[]} point - [x, y, z].
 * @param {number} edgeScale - metres per unit of the edge channel.
 */
export function encodeLockChannel( sites, point, edgeScale ) {

    const { index, nearest, second } = nearestTwoSites( sites, point );
    const count = sites.length / 3;

    return {
        index,
        identity: ( index + 0.5 ) / count,
        edge: Math.min( Math.max( ( second - nearest ) / edgeScale, 0 ), 1 )
    };

}

/**
 * The index a shader recovers from the emitted `u1`, and the recovery is EXACT rather than nearly.
 *
 * `(i + 0.5) / n` sits in the middle of its own 1/n bin, so `floor(u1 · n)` returns `i` for every
 * `i` and every `n` — and at `n = 16` every emitted value is an odd multiple of 1/32, which is a
 * binary fraction and therefore exact in f32 with no rounding to argue about. The selftest asserts
 * the round trip over every index and over a sweep of counts.
 */
export function decodeLockIndex( identity, count ) {

    return Math.min( count - 1, Math.max( 0, Math.floor( identity * count ) ) );

}

/**
 * The root ring of one quad-strip card, as the midpoint of the two rail vertices at `v = MIN`.
 *
 * 🚩 **MIN AND NOT MAX, AND THE FIRST VERSION OF THIS FUNCTION HAD IT THE OTHER WAY.**
 * `hair_cards.assemble_cards` writes `v = 1 − s` with `s` running 0 at the root, so in BLENDER the
 * root is at `v = 1` — and Blender's glTF exporter flips `v` on every UV layer, so in the FILE the
 * root is at `v = 0`. Reading the source and stopping there put this on the tip, and the gate then
 * re-derived 23% of the lock indices and looked like a broken channel. Measured on the shipped
 * `g050.glb`: the ring at `v = 0` sits at y 1.5083 and the ring at `v = 1` at y 1.4362, and the
 * scalp is the higher of the two.
 *
 * The midpoint of the root ring's two corners is the guide point the ribbon was built around —
 * `ribbon_of` places them at `point ∓ across · half` — up to whatever `clamp_cards_off_the_body`
 * moved afterwards.
 *
 * @param {number[]} vertices - vertex indices of one connected component.
 * @param {Float32Array} positions - flat xyz.
 * @param {Float32Array} uvs - flat uv, TEXCOORD_0.
 */
export function cardRoot( vertices, positions, uvs ) {

    let best = Infinity;

    for ( const vertex of vertices ) {

        if ( uvs[ vertex * 2 + 1 ] < best ) best = uvs[ vertex * 2 + 1 ];

    }

    let x = 0;
    let y = 0;
    let z = 0;
    let found = 0;

    for ( const vertex of vertices ) {

        // The two rails of one ring carry the same v bit-for-bit — both are written from the same
        // `previous[2]` — so an exact comparison is right here and a tolerance would pull in the
        // next ring on a short card.
        if ( uvs[ vertex * 2 + 1 ] !== best ) continue;

        x += positions[ vertex * 3 ];
        y += positions[ vertex * 3 + 1 ];
        z += positions[ vertex * 3 + 2 ];
        found ++;

    }

    return { point: [ x / found, y / found, z / found ], corners: found };

}

/**
 * Whether one component's TEXCOORD_1 is CONSTANT, which is the property that makes it a label.
 *
 * A card is one lock. If a card's own vertices disagreed, the value would interpolate across the
 * card and `floor(u1 · n)` would sweep through indices that are not its own — a hash of that is
 * noise wearing a lock's name, which is the exact failure R24 spent a round on.
 */
export function componentLockSpread( vertices, lockUvs ) {

    let minIdentity = Infinity;
    let maxIdentity = - Infinity;
    let minEdge = Infinity;
    let maxEdge = - Infinity;

    for ( const vertex of vertices ) {

        const identity = lockUvs[ vertex * 2 ];
        const edge = lockUvs[ vertex * 2 + 1 ];

        if ( identity < minIdentity ) minIdentity = identity;
        if ( identity > maxIdentity ) maxIdentity = identity;
        if ( edge < minEdge ) minEdge = edge;
        if ( edge > maxEdge ) maxEdge = edge;

    }

    return {
        identity: minIdentity,
        edge: minEdge,
        identitySpread: maxIdentity - minIdentity,
        edgeSpread: maxEdge - minEdge
    };

}
