/**
 * The measured gate for punch-list 9.1, 9.2 and 9.3, run against real built GLBs — not fixtures.
 *
 * Usage:
 *
 *   node packages/core/src/wardrobe/wardrobe.selftest.mjs
 *
 * It needs three build artefacts, all gitignored build output like `assets/figures/*.glb`:
 *
 *   assets/wardrobe/body/g050.glb              --hide-mask-attribute, four garments' masks
 *   assets/wardrobe/baked/suit_shoes_g050.glb  the same two garments, masks BAKED
 *   assets/wardrobe/baked/suit_g050.glb        the suit alone, mask BAKED
 *
 * `tools/figure-pipeline/README.md` has the three commands. A missing artefact is reported as
 * SKIP and turns the run red, because a gate that quietly stops measuring is worse than no gate.
 *
 * ## What each clause is for, and how it was proven red
 *
 * 🚩 **A triangle COUNT is a weak identity, and this file demonstrates that rather than asserting
 * it.** Clause 3 constructs a corrupted hide mask with the SAME number of flagged vertices that
 * yields the SAME kept-triangle count as the correct one, and shows that the count clause reads
 * green on it while the centroid clause reads red. That is the difference between a gate and a
 * decoration.
 *
 * 🚩 **AND A CENTROID IS A WEAK IDENTITY IN EXACTLY THE SAME WAY, WHICH THIS FILE MISSED FOR A
 * ROUND.** A centroid is the MEAN of three vertices, so it is invariant under every permutation of
 * them — including the one that matters. Reverse the winding of every rebuilt triangle and the
 * count is unchanged, the centroid multiset is unchanged, and every assertion this file
 * used to make read green on a body that renders inside out: `Human.body` is `doubleSided: false`,
 * measured off the GLB and re-measured here as `material.side === FrontSide`, so a back-facing
 * triangle is not drawn at all. **A triangle is an ORDERED TRIPLE OF VERTICES, and modelling it as
 * a point discards the one property backface culling reads.** Clauses 5 and 6 below key on the
 * ordered triple instead, canonicalised over rotations only — a rotation is three ways of writing
 * the same oriented triangle, a reflection is the defect.
 *
 * The five ways the rebuild is broken, all in the same defect class — "the runtime body does not
 * match the baked body":
 *
 *   1. the hide masks are absent    (`export_attributes` off — the exporter's silent default)
 *   2. the keep rule is inverted    (drop a triangle only when ALL THREE vertices are hidden)
 *   3. the mask flags the wrong vertices, in the right quantity, to the same triangle count
 *   4. the winding is reversed      (invisible to count AND centroid; the body is backface culled)
 *   5. a corner is swapped for its UV-SEAM TWIN — same position, same normal, different UV, so it
 *      is invisible to count, to centroid, AND to the facing clause that catches 4. It is the
 *      second mechanism inside 4's own class, and only the ordered-corner clause sees it.
 *
 * And the manifest gate (9.1) is proven red three ways too: a duplicate layer NAME, two distinct
 * layer names at the same ORDER — which a name-uniqueness check cannot see — and an outfit whose
 * two garments claim the same body slot at the same layer, which is the exact state MPFB attaches
 * today with no warning.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// three's GLTFLoader assumes a browser when it decodes embedded textures: it reads `self.URL` and
// hands the resulting blob URL to createImageBitmap. Nothing here inspects pixels, so the two
// smallest possible stubs let the loader finish. Must be in place before three is imported.
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );

const { GLTFLoader } = await import( 'three/examples/jsm/loaders/GLTFLoader.js' );
const { FrontSide } = await import( 'three' );
const { Figure } = await import( '../figure/Figure.js' );
const { GarmentManifest, validateManifest } = await import( './GarmentManifest.js' );
const { Wardrobe } = await import( './Wardrobe.js' );

const repoRoot = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..', '..', '..', '..' );

const MANIFEST_PATH = path.join( repoRoot, 'assets', 'wardrobe', 'manifest.json' );
const BODY_PATH = path.join( repoRoot, 'assets', 'wardrobe', 'body', 'g050.glb' );
const BAKED_SUIT_SHOES_PATH = path.join( repoRoot, 'assets', 'wardrobe', 'baked', 'suit_shoes_g050.glb' );
const BAKED_SUIT_PATH = path.join( repoRoot, 'assets', 'wardrobe', 'baked', 'suit_g050.glb' );

// The measured reference, from docs/research/wardrobe-system.md §2.4 and reproduced by this repo's
// own builds. Quoted, not re-derived — and every one of them is also read back off a baked GLB
// below, so a change in the pipeline fails against the artefact and not only against a constant.
const EXPECTED_TRIANGLES = { nude: 26756, suit: 21380, suitAndShoes: 17012 };

// How close two triangle centroids have to be to be the same triangle. The baked body and the
// runtime body come out of the same Blender mesh through the same exporter, so the positions are
// expected to agree exactly; 1 µm is four orders below the 9.19 mm poke-through the fit gate
// works in, and exists so a float that has been through a file does not fail on its last bit.
const CENTROID_TOLERANCE_M = 1e-6;

// The same argument for the UV half of a corner key. UVs are unitless in [0,1] over a 4096² atlas,
// so 1e-6 is a quarter of a texel and cannot merge two distinct seam corners: the closest pair
// measured on this body is 0.107 apart in u.
const UV_TOLERANCE = 1e-6;

/**
 * How far a kept vertex's normal may drift from the baked build's OFF THE MASK CUT.
 *
 * ⚠️ This is the one place the runtime rebuild and the bake are ENTITLED to disagree, and it is
 * bounded here rather than left as folklore. Blender recomputes vertex normals along the boundary
 * the MASK modifier cuts, so the baked body's normals are genuinely different there — measured on
 * `suit_g050.glb`: of 11,779 kept vertices, the 127 that lie on the cut diverge by up to
 * **16.365°**, while every vertex off the cut agrees to within **0.0316°**. A 518× separation.
 *
 * That is why the corner key below is POSITION + UV and NOT normal: adding the normal would make
 * the comparative clause fail on 244 correct triangles. Recorded as a gate so the next reader who
 * reaches for "surely the normal belongs in the key too" is stopped by a measurement.
 */
const OFF_CUT_NORMAL_TOLERANCE_DEG = 0.1;

const results = [];

function record( ok, label, detail ) {

    results.push( { ok, label, detail } );
    console.log( `  ${ ok ? 'ok  ' : 'FAIL' } ${ label }${ detail ? ` — ${ detail }` : '' }` );

}

function skip( label, detail ) {

    results.push( { ok: false, label, detail, skipped: true } );
    console.log( `  SKIP ${ label } — ${ detail }` );

}

// --- loading ---------------------------------------------------------------------------------

async function loadGltf( filePath ) {

    const file = fs.readFileSync( filePath );
    const buffer = file.buffer.slice( file.byteOffset, file.byteOffset + file.byteLength );

    return new Promise( ( resolve, reject ) => {
        new GLTFLoader().parse( buffer, '', resolve, reject );
    } );

}

/**
 * Reads a fragment off disk.
 *
 * The manifest stores fragment paths relative to itself and resolves them against its own URL, so
 * in node they arrive as `file://` URLs. That is deliberate — the browser and the selftest resolve
 * the same strings the same way, and neither has to know where the repo root is.
 */
function loadFragmentFromDisk( url ) {

    return loadGltf( fileURLToPath( url ) );

}

/** The largest skinned mesh in a GLB — the body, on any of these builds. */
function bodyMeshOf( gltf ) {

    let body = null;

    gltf.scene.traverse( ( object ) => {

        if ( object.isSkinnedMesh !== true ) return;
        if ( body === null || object.geometry.attributes.position.count > body.geometry.attributes.position.count ) {
            body = object;
        }

    } );

    return body;

}

/**
 * The kept triangles of a mesh as a sorted array of centroid keys.
 *
 * A multiset of positions rather than a set of indices, because the baked body and the runtime
 * body index their vertices differently — the bake renumbers everything it did not delete — so
 * indices are not comparable and positions are.
 */
function centroidKeys( geometry, indexArray, indexCount ) {

    const positions = geometry.attributes.position;
    const keys = new Array( indexCount / 3 );
    const scale = 1 / CENTROID_TOLERANCE_M;

    for ( let triangle = 0; triangle < indexCount / 3; triangle += 1 ) {

        const a = indexArray[ triangle * 3 ];
        const b = indexArray[ triangle * 3 + 1 ];
        const c = indexArray[ triangle * 3 + 2 ];

        const x = ( positions.getX( a ) + positions.getX( b ) + positions.getX( c ) ) / 3;
        const y = ( positions.getY( a ) + positions.getY( b ) + positions.getY( c ) ) / 3;
        const z = ( positions.getZ( a ) + positions.getZ( b ) + positions.getZ( c ) ) / 3;

        keys[ triangle ] = `${ Math.round( x * scale ) },${ Math.round( y * scale ) },${ Math.round( z * scale ) }`;

    }

    return keys.sort();

}

/**
 * One corner of a triangle, keyed on POSITION and UV — everything about a vertex that the drawn
 * pixel depends on and that survives the bake unchanged.
 *
 * The normal is deliberately absent; see `OFF_CUT_NORMAL_TOLERANCE_DEG`.
 */
function cornerKey( geometry, vertex ) {

    const positions = geometry.attributes.position;
    const uvs = geometry.attributes.uv;
    const positionScale = 1 / CENTROID_TOLERANCE_M;
    const uvScale = 1 / UV_TOLERANCE;

    return `${ Math.round( positions.getX( vertex ) * positionScale ) },` +
        `${ Math.round( positions.getY( vertex ) * positionScale ) },` +
        `${ Math.round( positions.getZ( vertex ) * positionScale ) }:` +
        `${ Math.round( uvs.getX( vertex ) * uvScale ) },${ Math.round( uvs.getY( vertex ) * uvScale ) }`;

}

/**
 * The kept triangles as a sorted array of ORIENTED corner keys — the identity a centroid is not.
 *
 * 🚩 This exists because the centroid multiset above is invariant under winding, and the body is
 * backface culled. Keyed on the ordered triple and canonicalised over ROTATIONS ONLY: `(a,b,c)`,
 * `(b,c,a)` and `(c,a,b)` are three spellings of one oriented triangle and must compare equal,
 * while `(c,b,a)` is the defect and must not.
 *
 * Strictly stronger than `centroidKeys` — it separates every pair the centroid separates, plus
 * winding, plus a corner swapped for a vertex at the same position with a different UV. Both
 * extra powers are proven red below.
 */
function orientedKeys( geometry, indexArray, indexCount ) {

    const keys = new Array( indexCount / 3 );

    for ( let triangle = 0; triangle < indexCount / 3; triangle += 1 ) {

        const first = cornerKey( geometry, indexArray[ triangle * 3 ] );
        const second = cornerKey( geometry, indexArray[ triangle * 3 + 1 ] );
        const third = cornerKey( geometry, indexArray[ triangle * 3 + 2 ] );

        const rotations = [
            `${ first }/${ second }/${ third }`,
            `${ second }/${ third }/${ first }`,
            `${ third }/${ first }/${ second }`
        ];

        keys[ triangle ] = rotations.sort()[ 0 ];

    }

    return keys.sort();

}

/**
 * How many kept triangles face INWARD, and by how much — an INTRINSIC check that needs no bake.
 *
 * A triangle's geometric normal is the cross product of its edges, which is the quantity the
 * rasteriser's facing test is computed from. Its shading normal comes off the NORMAL attribute,
 * which a winding change does not touch. On a closed, consistently wound surface the two agree in
 * sign everywhere; reverse the winding and every one of them flips.
 *
 * This is the §1.11 move — a structurally different assertion rather than a tightened threshold.
 * It is also the only clause here stated in the units of the defect: `Human.body` is single-sided,
 * so "faces inward" means "is not drawn".
 */
function facingAgainstShadingNormals( geometry, indexArray, indexCount ) {

    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;

    let inward = 0;
    let degenerate = 0;
    let worstDot = Infinity;

    for ( let offset = 0; offset < indexCount; offset += 3 ) {

        const a = indexArray[ offset ];
        const b = indexArray[ offset + 1 ];
        const c = indexArray[ offset + 2 ];

        const edge1X = positions.getX( b ) - positions.getX( a );
        const edge1Y = positions.getY( b ) - positions.getY( a );
        const edge1Z = positions.getZ( b ) - positions.getZ( a );
        const edge2X = positions.getX( c ) - positions.getX( a );
        const edge2Y = positions.getY( c ) - positions.getY( a );
        const edge2Z = positions.getZ( c ) - positions.getZ( a );

        const faceX = edge1Y * edge2Z - edge1Z * edge2Y;
        const faceY = edge1Z * edge2X - edge1X * edge2Z;
        const faceZ = edge1X * edge2Y - edge1Y * edge2X;
        const faceLength = Math.hypot( faceX, faceY, faceZ );

        if ( faceLength === 0 ) {

            degenerate += 1;
            continue;

        }

        const shadeX = ( normals.getX( a ) + normals.getX( b ) + normals.getX( c ) ) / 3;
        const shadeY = ( normals.getY( a ) + normals.getY( b ) + normals.getY( c ) ) / 3;
        const shadeZ = ( normals.getZ( a ) + normals.getZ( b ) + normals.getZ( c ) ) / 3;
        const shadeLength = Math.hypot( shadeX, shadeY, shadeZ );

        const dot = ( faceX * shadeX + faceY * shadeY + faceZ * shadeZ ) / ( faceLength * shadeLength );

        if ( dot <= 0 ) inward += 1;
        if ( dot < worstDot ) worstDot = dot;

    }

    return { inward, degenerate, worstDot, total: indexCount / 3 };

}

/** How many triangles are in one list and not the other, counted both ways. */
function multisetDifference( first, second ) {

    const counts = new Map();

    for ( const key of first ) counts.set( key, ( counts.get( key ) ?? 0 ) + 1 );
    for ( const key of second ) counts.set( key, ( counts.get( key ) ?? 0 ) - 1 );

    let onlyInFirst = 0;
    let onlyInSecond = 0;

    for ( const value of counts.values() ) {

        if ( value > 0 ) onlyInFirst += value;
        else if ( value < 0 ) onlyInSecond -= value;

    }

    return { onlyInFirst, onlyInSecond, identical: onlyInFirst === 0 && onlyInSecond === 0 };

}

function keptOf( wardrobe ) {

    const geometry = wardrobe.body.geometry;
    return centroidKeys( geometry, geometry.index.array, geometry.drawRange.count );

}

function bakedKeptOf( gltf ) {

    const body = bodyMeshOf( gltf );
    return centroidKeys( body.geometry, body.geometry.index.array, body.geometry.index.count );

}

/** The rebuilt index as a plain array, cut at drawRange — what the GPU would actually be given. */
function keptIndexOf( wardrobe ) {

    const geometry = wardrobe.body.geometry;
    return Array.from( geometry.index.array.slice( 0, geometry.drawRange.count ) );

}

function orientedOf( wardrobe ) {

    const geometry = wardrobe.body.geometry;
    return orientedKeys( geometry, geometry.index.array, geometry.drawRange.count );

}

function bakedOrientedOf( gltf ) {

    const body = bodyMeshOf( gltf );
    return orientedKeys( body.geometry, body.geometry.index.array, body.geometry.index.count );

}

/**
 * Where the runtime rebuild and the bake are allowed to differ, measured rather than assumed.
 *
 * Matches every kept runtime vertex to a baked vertex by position + UV, then splits the normal
 * disagreement into vertices ON the mask cut (a triangle of theirs was dropped) and OFF it.
 */
function normalDivergenceAgainstBake( wardrobe, bakedGeometry ) {

    const geometry = wardrobe.body.geometry;
    const kept = keptIndexOf( wardrobe );
    const keptVertexSet = new Set( kept );

    // A full-index triangle that is not in the kept list was dropped; every kept vertex it touches
    // sits on the cut Blender re-normalled around.
    const keptTriangles = new Set();
    for ( let offset = 0; offset < kept.length; offset += 3 ) {

        keptTriangles.add( `${ kept[ offset ] },${ kept[ offset + 1 ] },${ kept[ offset + 2 ] }` );

    }

    const onCut = new Set();
    const full = wardrobe.fullIndex;
    for ( let offset = 0; offset < full.length; offset += 3 ) {

        if ( keptTriangles.has( `${ full[ offset ] },${ full[ offset + 1 ] },${ full[ offset + 2 ] }` ) ) continue;

        for ( let corner = 0; corner < 3; corner += 1 ) {

            if ( keptVertexSet.has( full[ offset + corner ] ) ) onCut.add( full[ offset + corner ] );

        }

    }

    const bakedByCorner = new Map();
    for ( let vertex = 0; vertex < bakedGeometry.attributes.position.count; vertex += 1 ) {

        bakedByCorner.set( cornerKey( bakedGeometry, vertex ), vertex );

    }

    const runtimeNormals = geometry.attributes.normal;
    const bakedNormals = bakedGeometry.attributes.normal;

    let unmatched = 0;
    let onCutWorstDeg = 0;
    let offCutWorstDeg = 0;

    for ( const vertex of keptVertexSet ) {

        const bakedVertex = bakedByCorner.get( cornerKey( geometry, vertex ) );

        if ( bakedVertex === undefined ) {

            unmatched += 1;
            continue;

        }

        const dot = runtimeNormals.getX( vertex ) * bakedNormals.getX( bakedVertex ) +
            runtimeNormals.getY( vertex ) * bakedNormals.getY( bakedVertex ) +
            runtimeNormals.getZ( vertex ) * bakedNormals.getZ( bakedVertex );
        const degrees = Math.acos( Math.min( 1, Math.max( -1, dot ) ) ) * 180 / Math.PI;

        if ( onCut.has( vertex ) ) onCutWorstDeg = Math.max( onCutWorstDeg, degrees );
        else offCutWorstDeg = Math.max( offCutWorstDeg, degrees );

    }

    return { keptVertices: keptVertexSet.size, onCut: onCut.size, unmatched, onCutWorstDeg, offCutWorstDeg };

}

// --- 9.1: the manifest -------------------------------------------------------------------------

function checkManifest( source ) {

    console.log( '' );
    console.log( '--- 9.1 the garment manifest ---' );

    const problems = validateManifest( source );
    record( problems.length === 0, 'the shipped manifest validates',
        problems.length === 0 ? `${ source.garments.length } garments, ${ source.layers.length } layers`
            : problems.join( '; ' ) );

    const manifest = new GarmentManifest( source, pathToFileURL( MANIFEST_PATH ).href );

    // Total order: every layer comparable, strictly increasing, no ties.
    const orders = manifest.layers.map( ( layer ) => layer.order );
    const strictlyIncreasing = orders.every(
        ( order, position ) => position === 0 || order > orders[ position - 1 ] );
    record( strictlyIncreasing, 'layer order is a total order',
        manifest.layers.map( ( layer ) => `${ layer.name }=${ layer.order }` ).join( ' < ' ) );

    // Sorting garments is deterministic and innermost-first.
    const shuffled = [ 'fedora01', 'female_casualsuit01', 'shoes01' ];
    const sorted = manifest.sortByLayer( shuffled );
    record( sorted.join( ',' ) === 'female_casualsuit01,shoes01,fedora01',
        'garments sort innermost-first', sorted.join( ' -> ' ) );

    // 🚩 RED 1 — a duplicate layer NAME.
    const duplicateName = structuredClone( source );
    duplicateName.layers.push( { name: 'BASE', order: 350, description: 'a second BASE' } );
    record( validateManifest( duplicateName ).some( ( problem ) => problem.includes( 'declared twice' ) ),
        'RED: a duplicate layer name is rejected' );

    // 🚩 RED 2 — a DIFFERENT MECHANISM in the same class. Two distinct layer names at the same
    // order value. A name-uniqueness check reads green on this while the order it claims to
    // establish is not total: which of the two is outer has no answer.
    const tiedOrder = structuredClone( source );
    tiedOrder.layers.push( { name: 'OVERSHIRT', order: 300, description: 'ties with BASE' } );
    const tiedProblems = validateManifest( tiedOrder );
    record( tiedProblems.some( ( problem ) => problem.includes( 'would not be total' ) ),
        'RED: two layer names at the same order are rejected',
        tiedProblems.find( ( problem ) => problem.includes( 'would not be total' ) ) );

    // 🚩 RED 3 — the state MPFB attaches today. Two suits, same layer, same slots.
    const conflicts = manifest.conflicts( [ 'female_casualsuit01', 'female_elegantsuit01' ] );
    record( conflicts.length === 4,
        'RED: two suits at the same layer are rejected, not silently interpenetrated',
        `${ conflicts.length } slot collisions: ${ conflicts[ 0 ] }` );

    // And the case the unqualified rule would get wrong: same layer, disjoint slots is fine.
    record( manifest.conflicts( [ 'female_casualsuit01', 'shoes01', 'fedora01' ] ).length === 0,
        'a suit, shoes and a hat are wearable together' );

    // 🚩 RED 4 — a required field missing. One knockout per field would be noise; alphaMode is the
    // one 9.5 reads, so it is the one proven.
    const noAlphaMode = structuredClone( source );
    delete noAlphaMode.garments[ 0 ].alphaMode;
    record( validateManifest( noAlphaMode ).some( ( problem ) => problem.includes( '.alphaMode' ) ),
        'RED: a garment with no alphaMode is rejected' );

    // A MASK garment with no cutoff of its own. Item 3.16 lost 15,368 lash and 20,262 brow texels
    // to the inherited glTF default of 0.5; a cutout garment inherits that bug.
    const maskNoCutoff = structuredClone( source );
    maskNoCutoff.garments[ 0 ].alphaMode = 'MASK';
    record( validateManifest( maskNoCutoff ).some( ( problem ) => problem.includes( 'alphaCutoff' ) ),
        'RED: a MASK garment with no alphaCutoff is rejected' );

    return manifest;

}

// --- 9.2 / 9.3: the hide-mask rebuild ------------------------------------------------------------

async function checkRebuild( manifest ) {

    console.log( '' );
    console.log( '--- 9.2 the runtime hide-mask rebuild against the baked build ---' );

    const figure = new Figure( await loadGltf( BODY_PATH ) );
    const wardrobe = new Wardrobe( figure, manifest, {
        figureKey: 'g050',
        loadFragment: loadFragmentFromDisk
    } );

    record( wardrobe.availableHideMasks().length === 3,
        'the body carries the exported _HIDE_* attributes',
        wardrobe.availableHideMasks().join( ', ' ) );

    record( wardrobe.fullTriangleCount === EXPECTED_TRIANGLES.nude,
        `the whole body is ${ EXPECTED_TRIANGLES.nude } triangles`,
        `${ wardrobe.fullTriangleCount }` );

    // 🚩 THE FACT THAT MAKES WINDING LOAD-BEARING, measured rather than assumed. `Human.body` is
    // `doubleSided: false` in the GLB, so three gives it FrontSide and a back-facing triangle is
    // not drawn. If the pipeline ever ships a double-sided body this clause goes red, and the two
    // orientation clauses below become advisory instead of silently pointless.
    record( wardrobe.body.material.side === FrontSide,
        'the body is BACKFACE CULLED, so triangle winding decides whether it renders at all',
        `material.side = ${ wardrobe.body.material.side } (THREE.FrontSide = ${ FrontSide })` );

    const bakedSuitShoes = await loadGltf( BAKED_SUIT_SHOES_PATH );
    const bakedSuit = await loadGltf( BAKED_SUIT_PATH );

    // --- suit + shoes ---
    await wardrobe.dress( [ 'female_casualsuit01', 'shoes01' ] );
    const runtimeSuitShoes = keptOf( wardrobe );
    const bakedSuitShoesKept = bakedKeptOf( bakedSuitShoes );

    record( runtimeSuitShoes.length === bakedSuitShoesKept.length &&
            runtimeSuitShoes.length === EXPECTED_TRIANGLES.suitAndShoes,
        'suit + shoes: the rebuilt triangle COUNT equals the baked one',
        `runtime ${ runtimeSuitShoes.length } = baked ${ bakedSuitShoesKept.length } ` +
        `(research §2.4: ${ EXPECTED_TRIANGLES.suitAndShoes })` );

    const suitShoesDifference = multisetDifference( runtimeSuitShoes, bakedSuitShoesKept );
    record( suitShoesDifference.identical,
        'suit + shoes: the rebuilt triangle SET equals the baked one',
        `${ suitShoesDifference.onlyInFirst } only in the rebuild, ` +
        `${ suitShoesDifference.onlyInSecond } only in the bake` );

    // 🎯 The clause the centroid multiset above cannot make. Same triangles, and the same way round.
    const suitShoesOriented = multisetDifference(
        orientedOf( wardrobe ), bakedOrientedOf( bakedSuitShoes ) );
    record( suitShoesOriented.identical,
        'suit + shoes: the rebuilt triangles equal the baked ones AS ORIENTED CORNER TRIPLES',
        `${ EXPECTED_TRIANGLES.suitAndShoes } triangles, ${ suitShoesOriented.onlyInFirst } ` +
        'differing in winding, vertex or UV' );

    // --- suit alone ---
    await wardrobe.dress( [ 'female_casualsuit01' ] );
    const runtimeSuit = keptOf( wardrobe );
    const bakedSuitKept = bakedKeptOf( bakedSuit );

    record( runtimeSuit.length === bakedSuitKept.length && runtimeSuit.length === EXPECTED_TRIANGLES.suit,
        'suit alone: the rebuilt triangle COUNT equals the baked one',
        `runtime ${ runtimeSuit.length } = baked ${ bakedSuitKept.length } ` +
        `(research §2.4: ${ EXPECTED_TRIANGLES.suit })` );

    record( multisetDifference( runtimeSuit, bakedSuitKept ).identical,
        'suit alone: the rebuilt triangle SET equals the baked one' );

    const bakedSuitOriented = bakedOrientedOf( bakedSuit );
    const suitOriented = multisetDifference( orientedOf( wardrobe ), bakedSuitOriented );
    record( suitOriented.identical,
        'suit alone: the rebuilt triangles equal the baked ones AS ORIENTED CORNER TRIPLES',
        `${ EXPECTED_TRIANGLES.suit } triangles, ${ suitOriented.onlyInFirst } differing` );

    // The intrinsic clause, needing no bake at all: every triangle the rebuild keeps faces outward.
    // Stated on both regimes, because the dressed body is the rebuild's output and the nude body is
    // the restore path — a winding defect could live in either branch of `#rebuildBodyIndex`.
    const dressedFacing = facingAgainstShadingNormals(
        wardrobe.body.geometry, wardrobe.body.geometry.index.array, wardrobe.body.geometry.drawRange.count );

    await wardrobe.undress();
    const nudeFacing = facingAgainstShadingNormals(
        wardrobe.body.geometry, wardrobe.body.geometry.index.array, wardrobe.body.geometry.drawRange.count );

    record( dressedFacing.inward === 0 && nudeFacing.inward === 0 &&
            dressedFacing.degenerate === 0 && nudeFacing.degenerate === 0,
        'every kept triangle FACES OUTWARD — geometric normal agrees with the shading normal',
        `dressed ${ dressedFacing.inward }/${ dressedFacing.total } inward (worst dot ` +
        `${ dressedFacing.worstDot.toFixed( 6 ) }), nude ${ nudeFacing.inward }/${ nudeFacing.total } ` +
        `(worst dot ${ nudeFacing.worstDot.toFixed( 6 ) }), 0 degenerate` );

    // ⚠️ And what the comparative identity is NOT entitled to claim. See OFF_CUT_NORMAL_TOLERANCE_DEG.
    await wardrobe.dress( [ 'female_casualsuit01' ] );
    const divergence = normalDivergenceAgainstBake( wardrobe, bodyMeshOf( bakedSuit ).geometry );

    record( divergence.unmatched === 0 && divergence.offCutWorstDeg < OFF_CUT_NORMAL_TOLERANCE_DEG,
        'the runtime and baked vertices correspond 1:1, and their normals differ only ON the cut',
        `${ divergence.keptVertices } kept vertices, ${ divergence.unmatched } unmatched; ` +
        `${ divergence.onCut } on the cut diverge up to ${ divergence.onCutWorstDeg.toFixed( 3 ) }°, ` +
        `off the cut ${ divergence.offCutWorstDeg.toFixed( 4 ) }° — which is why the corner key is ` +
        'position + UV and NOT normal' );

    return { figure, wardrobe, bakedSuitKept, bakedSuitOriented, runtimeSuit };

}

// --- 9.2 red: three ways to break the same thing --------------------------------------------------

async function checkRebuildRed( manifest, bakedSuitKept ) {

    console.log( '' );
    console.log( '--- 9.2 RED: three mechanisms, one defect class ---' );

    // 🚩 RED 1 — the exporter's silent default. `export_attributes` is OFF unless asked for, and
    // the build reports success without it. Simulated by deleting the attributes from a loaded
    // body, which is exactly what such a GLB arrives as.
    const strippedFigure = new Figure( await loadGltf( BODY_PATH ) );
    for ( const name of Object.keys( strippedFigure.body.geometry.attributes ) ) {

        if ( name.toLowerCase().startsWith( '_hide_' ) ) strippedFigure.body.geometry.deleteAttribute( name );

    }

    const strippedWardrobe = new Wardrobe( strippedFigure, manifest, {
        loadFragment: loadFragmentFromDisk
    } );
    await strippedWardrobe.dress( [ 'female_casualsuit01' ] );
    const stripped = keptOf( strippedWardrobe );

    record( multisetDifference( stripped, bakedSuitKept ).identical === false &&
            stripped.length === EXPECTED_TRIANGLES.nude,
        'RED 1: hide masks absent (export_attributes off) is caught',
        `${ stripped.length } triangles, the whole body, against the baked ${ bakedSuitKept.length }` );

    // 🚩 RED 2 — a different mechanism: the keep rule inverted. Dropping a triangle only when ALL
    // THREE of its vertices are hidden is a plausible implementation and a wrong one; it leaves a
    // one-triangle fringe of skin around every hidden region.
    const ruleFigure = new Figure( await loadGltf( BODY_PATH ) );
    const allThree = rebuildWithRule( ruleFigure.body, '_hide_female_casualsuit01', 'all' );

    record( allThree.count !== bakedSuitKept.length,
        'RED 2: the all-three-vertices keep rule is caught',
        `${ allThree.count } triangles against the baked ${ bakedSuitKept.length }, ` +
        `${ allThree.count - bakedSuitKept.length } too many` );

    // 🚩 RED 3 — THE ONE A COUNT CANNOT SEE. A hide mask with the same number of flagged vertices,
    // engineered to leave the kept-triangle count unchanged while flagging different vertices.
    const wrongFigure = new Figure( await loadGltf( BODY_PATH ) );
    const swap = findCountPreservingCorruption( wrongFigure.body, '_hide_female_casualsuit01' );

    if ( swap === null ) {

        skip( 'RED 3: a count-preserving wrong mask', 'no swap pair found in the search budget' );
        return;

    }

    record( swap.count === bakedSuitKept.length,
        'RED 3: the corrupted mask flags the same number of vertices AND yields the same count',
        `hid vertex ${ swap.hidden } instead of ${ swap.revealed }, both move ${ swap.delta } ` +
        `triangles; count ${ swap.count } = baked ${ bakedSuitKept.length }` );

    const swapDifference = multisetDifference( swap.kept, bakedSuitKept );
    record( swapDifference.identical === false,
        'RED 3: and the centroid clause catches it where the count clause cannot',
        `${ swapDifference.onlyInFirst } triangles in the rebuild that are not in the bake` );

}

/** Rebuilds a body index with a chosen keep rule, and returns the kept triangles. */
function rebuildWithRule( body, maskName, rule ) {

    const attribute = attributeNamed( body.geometry, maskName );
    const index = body.geometry.index.array;
    const kept = [];

    for ( let offset = 0; offset < index.length; offset += 3 ) {

        const flags = [ index[ offset ], index[ offset + 1 ], index[ offset + 2 ] ]
            .map( ( vertex ) => attribute.getX( vertex ) > 0.5 );

        const drop = rule === 'all' ? flags.every( Boolean ) : flags.some( Boolean );
        if ( drop === false ) kept.push( index[ offset ], index[ offset + 1 ], index[ offset + 2 ] );

    }

    return { count: kept.length / 3, kept: centroidKeys( body.geometry, kept, kept.length ) };

}

function attributeNamed( geometry, name ) {

    for ( const [ candidate, attribute ] of Object.entries( geometry.attributes ) ) {

        if ( candidate.toLowerCase() === name.toLowerCase() ) return attribute;

    }

    throw new Error( `no attribute named ${ name }` );

}

/**
 * A wrong hide mask with the same cardinality AND the same kept-triangle count as the right one.
 *
 * Built by swapping one hidden vertex for one visible vertex whose triangles are affected equally.
 * `delta` is how many triangles a vertex is solely responsible for hiding: unhide a vertex with
 * delta = k and k triangles reappear; hide a fresh vertex with delta = k and k different triangles
 * vanish. The count is unchanged and the geometry is not.
 *
 * This exists to make the case concretely rather than to argue it. Without a search like this,
 * "count equality is a weak identity" is an opinion.
 */
function findCountPreservingCorruption( body, maskName ) {

    const attribute = attributeNamed( body.geometry, maskName );
    const index = body.geometry.index.array;
    const vertexCount = body.geometry.attributes.position.count;

    const hidden = new Uint8Array( vertexCount );
    for ( let vertex = 0; vertex < vertexCount; vertex += 1 ) {
        if ( attribute.getX( vertex ) > 0.5 ) hidden[ vertex ] = 1;
    }

    // For each vertex: how many triangles it ALONE is responsible for dropping (for a hidden
    // vertex), or would alone be responsible for dropping (for a visible one).
    const soleResponsibility = new Int32Array( vertexCount );

    for ( let offset = 0; offset < index.length; offset += 3 ) {

        const triangle = [ index[ offset ], index[ offset + 1 ], index[ offset + 2 ] ];
        const hiddenIn = triangle.filter( ( vertex ) => hidden[ vertex ] === 1 );

        if ( hiddenIn.length === 1 ) soleResponsibility[ hiddenIn[ 0 ] ] += 1;
        else if ( hiddenIn.length === 0 ) {
            for ( const vertex of triangle ) soleResponsibility[ vertex ] += 1;
        }

    }

    const revealCandidates = [];
    const hideCandidates = [];

    for ( let vertex = 0; vertex < vertexCount; vertex += 1 ) {

        if ( soleResponsibility[ vertex ] === 0 ) continue;
        ( hidden[ vertex ] === 1 ? revealCandidates : hideCandidates ).push( vertex );

    }

    for ( const revealed of revealCandidates ) {

        const delta = soleResponsibility[ revealed ];
        const match = hideCandidates.find( ( candidate ) => soleResponsibility[ candidate ] === delta );

        if ( match === undefined ) continue;

        hidden[ revealed ] = 0;
        hidden[ match ] = 1;

        const kept = [];
        for ( let offset = 0; offset < index.length; offset += 3 ) {

            const a = index[ offset ];
            const b = index[ offset + 1 ];
            const c = index[ offset + 2 ];
            if ( hidden[ a ] === 1 || hidden[ b ] === 1 || hidden[ c ] === 1 ) continue;
            kept.push( a, b, c );

        }

        return {
            revealed, hidden: match, delta,
            count: kept.length / 3,
            kept: centroidKeys( body.geometry, kept, kept.length )
        };

    }

    return null;

}

// --- 9.2 red: two mechanisms a CENTROID cannot see -------------------------------------------------

/**
 * 🚩 THE SECTION THAT EXISTS BECAUSE THE FILE ABOVE USED TO PASS ON A BODY THAT DOES NOT RENDER.
 *
 * Both breaks below leave the triangle COUNT and the triangle CENTROID MULTISET exactly as the
 * correct rebuild leaves them, so every clause this file made before them reads green on both. Each
 * one records that fact as an assertion rather than a remark — a gate that cannot see a defect
 * should have to say so out loud.
 */
async function checkWindingRed( wardrobe, bakedSuitKept, bakedSuitOriented ) {

    console.log( '' );
    console.log( '--- 9.2 RED: winding and seam twins, both invisible to count and centroid ---' );

    await wardrobe.dress( [ 'female_casualsuit01' ] );

    const geometry = wardrobe.body.geometry;
    const kept = keptIndexOf( wardrobe );

    // 🚩 RED 4 — THE REPORTED DEFECT. Reverse the winding of every rebuilt triangle: one character
    // in `#rebuildBodyIndex`, `target[written] = c ... = a`. The body is backface culled, so this
    // is a figure that vanishes when it is dressed.
    const reversed = [];
    for ( let offset = 0; offset < kept.length; offset += 3 ) {

        reversed.push( kept[ offset + 2 ], kept[ offset + 1 ], kept[ offset ] );

    }

    const reversedCentroids = centroidKeys( geometry, reversed, reversed.length );

    record( reversed.length / 3 === bakedSuitKept.length &&
            multisetDifference( reversedCentroids, bakedSuitKept ).identical,
        'RED 4: reversed winding — the COUNT and CENTROID clauses both read GREEN on it',
        `${ reversed.length / 3 } triangles, centroid multiset identical to the bake; this is why ` +
        'those two clauses alone were a decoration' );

    const reversedOriented = multisetDifference(
        orientedKeys( geometry, reversed, reversed.length ), bakedSuitOriented );

    record( reversedOriented.onlyInFirst === reversed.length / 3,
        'RED 4: the ORIENTED CORNER clause catches it — every triangle, not a sample',
        `${ reversedOriented.onlyInFirst } of ${ reversed.length / 3 } triangles differ from the bake` );

    const reversedFacing = facingAgainstShadingNormals( geometry, reversed, reversed.length );

    record( reversedFacing.inward === reversedFacing.total,
        'RED 4: and the intrinsic FACING clause catches it independently, with no bake to compare to',
        `${ reversedFacing.inward }/${ reversedFacing.total } triangles face inward, worst dot ` +
        `${ reversedFacing.worstDot.toFixed( 6 ) } against ${ '+0.263262' } when correct` );

    // 🚩 RED 5 — A DIFFERENT MECHANISM IN THE SAME CLASS, and the reason RED 4's facing clause is
    // not enough on its own. Swap one corner for its UV-SEAM TWIN: the body has 1,122 pairs of
    // vertices at an identical position with an identical normal and a different UV, because that
    // is what a UV seam is. Substituting one for the other moves nothing and re-textures three
    // triangles from a different island — 0.107 in u and 0.434 in v away, a third of the atlas.
    //
    // Invisible to the count, invisible to the centroid, and invisible to the facing clause, which
    // reads positions and normals and sees neither change. Only the corner key carries UV.
    const twin = findSeamTwinSubstitution( geometry, kept );

    if ( twin === null ) {

        skip( 'RED 5: a UV-seam twin substitution', 'no twin pair found among the kept vertices' );
        return;

    }

    const twinCentroids = centroidKeys( geometry, twin.index, twin.index.length );
    const twinFacing = facingAgainstShadingNormals( geometry, twin.index, twin.index.length );
    const correctFacing = facingAgainstShadingNormals( geometry, kept, kept.length );

    record( twin.index.length / 3 === bakedSuitKept.length &&
            multisetDifference( twinCentroids, bakedSuitKept ).identical &&
            twinFacing.inward === 0 && twinFacing.worstDot === correctFacing.worstDot,
        'RED 5: a UV-seam twin — COUNT, CENTROID and FACING all read GREEN on it',
        `${ twin.index.length / 3 } triangles, centroid multiset identical, facing worst dot ` +
        `${ twinFacing.worstDot.toFixed( 6 ) } byte-identical to the correct rebuild's` );

    const twinOriented = multisetDifference(
        orientedKeys( geometry, twin.index, twin.index.length ), bakedSuitOriented );

    record( twinOriented.onlyInFirst === twin.touched,
        'RED 5: only the ORIENTED CORNER clause catches it, because only its key carries UV',
        `corner ${ twin.from } -> its twin ${ twin.to } (same position, same normal, UV ` +
        `${ twin.uvDistance.toFixed( 4 ) } away); ${ twinOriented.onlyInFirst } of ` +
        `${ twin.touched } touched triangles differ from the bake` );

}

/**
 * One kept vertex and a twin of it: same position, same normal, a different UV.
 *
 * Returns the substituted index array and how many triangles it touched. The point of the pair is
 * that every quantity the other clauses measure is preserved exactly.
 */
function findSeamTwinSubstitution( geometry, keptIndex ) {

    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;
    const uvs = geometry.attributes.uv;
    const scale = 1 / CENTROID_TOLERANCE_M;

    const byPosition = new Map();
    for ( let vertex = 0; vertex < positions.count; vertex += 1 ) {

        const key = `${ Math.round( positions.getX( vertex ) * scale ) },` +
            `${ Math.round( positions.getY( vertex ) * scale ) },` +
            `${ Math.round( positions.getZ( vertex ) * scale ) }`;

        if ( byPosition.has( key ) ) byPosition.get( key ).push( vertex );
        else byPosition.set( key, [ vertex ] );

    }

    const kept = new Set( keptIndex );

    for ( const group of byPosition.values() ) {

        if ( group.length !== 2 ) continue;

        const [ from, to ] = group;
        if ( kept.has( from ) === false ) continue;

        const sameNormal = Math.abs( normals.getX( from ) - normals.getX( to ) ) < 1e-7 &&
            Math.abs( normals.getY( from ) - normals.getY( to ) ) < 1e-7 &&
            Math.abs( normals.getZ( from ) - normals.getZ( to ) ) < 1e-7;

        const uvDistance = Math.hypot( uvs.getX( from ) - uvs.getX( to ), uvs.getY( from ) - uvs.getY( to ) );

        if ( sameNormal === false || uvDistance < UV_TOLERANCE ) continue;

        const index = keptIndex.slice();
        let touched = 0;

        for ( let offset = 0; offset < index.length; offset += 3 ) {

            let hit = false;

            for ( let corner = 0; corner < 3; corner += 1 ) {

                if ( index[ offset + corner ] !== from ) continue;
                index[ offset + corner ] = to;
                hit = true;

            }

            if ( hit ) touched += 1;

        }

        return { from, to, touched, uvDistance, index };

    }

    return null;

}

// --- 9.3: dress, undress, dress again ----------------------------------------------------------

async function checkDressCycle( wardrobe ) {

    console.log( '' );
    console.log( '--- 9.3 dress -> undress -> dress ---' );

    const outfit = [ 'female_casualsuit01', 'shoes01', 'fedora01' ];

    const dressed = await wardrobe.dress( outfit );
    const undressed = await wardrobe.undress();
    const redressed = await wardrobe.dress( outfit );

    record( undressed.bodyTriangles === EXPECTED_TRIANGLES.nude,
        `undress returns the body to ${ EXPECTED_TRIANGLES.nude } triangles`,
        `${ undressed.bodyTriangles }` );

    record( redressed.bodyTriangles === dressed.bodyTriangles,
        'dress -> undress -> dress has no drift',
        `${ dressed.bodyTriangles } -> ${ undressed.bodyTriangles } -> ${ redressed.bodyTriangles }` );

    record( undressed.worn.length === 0 && undressed.drawCalls === 1,
        'undress removes every garment mesh from the scene',
        `${ undressed.drawCalls } draw call` );

    record( redressed.worn.join( ',' ) === 'female_casualsuit01,shoes01,fedora01',
        'garments are worn innermost-first', redressed.worn.join( ' -> ' ) );

    record( redressed.drawCalls === 4, 'one draw call per garment, plus the body',
        `${ redressed.drawCalls }` );

    // 🎯 A fully dressed figure has FEWER triangles than a nude one — research §1.1, 35,784
    // against 36,924, measured on the whole figure. Here, on the body plus garments alone.
    record( redressed.bodyTriangles + redressed.garmentTriangles < EXPECTED_TRIANGLES.nude,
        'a dressed body draws fewer triangles than a nude one',
        `${ redressed.bodyTriangles } body + ${ redressed.garmentTriangles } garment = ` +
        `${ redressed.bodyTriangles + redressed.garmentTriangles } against ${ EXPECTED_TRIANGLES.nude } nude` );

    record( redressed.jointRemapIsIdentity === true,
        'every garment binds to the figure\'s own skeleton by bone name',
        'the remap came out as the identity — both GLBs export the same 53-bone game_engine rig' );

    // The gate's own number: the dress step, excluding the fetch, against the 1 ms budget.
    const timings = [];
    for ( let run = 0; run < 30; run += 1 ) {

        await wardrobe.dress( run % 2 === 0 ? outfit : [ 'female_casualsuit01' ] );
        timings.push( wardrobe.lastDressMs );

    }
    timings.sort( ( first, second ) => first - second );
    const median = timings[ Math.floor( timings.length / 2 ) ];

    record( median < 1, 'a dress step costs under 1 ms once the fragments are loaded',
        `median ${ median.toFixed( 4 ) } ms over 30 runs ` +
        `(min ${ timings[ 0 ].toFixed( 4 ) }, max ${ timings.at( -1 ).toFixed( 4 ) }); ` +
        `research §2.4 measured the rebuild alone at 0.1609 ms` );

    // 🚩 The conflict the manifest exists to prevent, refused at the API rather than in a comment.
    let refused = false;
    try {
        await wardrobe.dress( [ 'female_casualsuit01', 'female_elegantsuit01' ] );
    } catch ( error ) {
        refused = /cannot be worn/.test( error.message );
    }
    record( refused, 'RED: dressing two suits at the same layer is refused' );

    record( wardrobe.worn.join( ',' ) === 'female_casualsuit01',
        'a refused outfit leaves the previous one untouched', wardrobe.worn.join( ',' ) );

    // VRAM is the wardrobe's binding constraint (research §3.4), so "taken off" must be able to
    // mean "gone", not only "not drawn".
    let refusedRelease = false;
    try {
        wardrobe.release( 'female_casualsuit01' );
    } catch ( error ) {
        refusedRelease = /being worn/.test( error.message );
    }
    record( refusedRelease, 'RED: releasing a worn garment is refused' );

    const before = wardrobe.stats().residentFragments;
    await wardrobe.undress();
    const released = wardrobe.release( 'female_casualsuit01' );

    record( released && wardrobe.stats().residentFragments === before - 1,
        'release() frees a garment that is no longer worn',
        `${ before } resident -> ${ wardrobe.stats().residentFragments }` );

    // And it must be refetchable afterwards, or release is a one-way door.
    const again = await wardrobe.dress( [ 'female_casualsuit01' ] );
    record( again.bodyTriangles === EXPECTED_TRIANGLES.suit,
        'a released garment can be worn again', `${ again.bodyTriangles } triangles` );

}

// --- 9.8's hook ---------------------------------------------------------------------------------

async function checkDecencyHook( manifest ) {

    console.log( '' );
    console.log( '--- 9.8 hook: the floor is unioned into every state, including undress ---' );

    // What is being tested here is the FUNNEL, not the foundation layer: that no path to the body
    // skips `#resolveOutfit`. `shoes01` stands in for a floor garment deliberately — 9.8's own
    // gate is `decency.selftest.mjs`, which measures coverage geometrically off the built shells,
    // and a funnel test that used the real floor would fail for two different reasons at once.
    const figure = new Figure( await loadGltf( BODY_PATH ) );
    const wardrobe = new Wardrobe( figure, manifest, {
        decencyFloor: () => [ 'shoes01' ],
        loadFragment: loadFragmentFromDisk
    } );

    const dressed = await wardrobe.dress( [ 'female_casualsuit01' ] );
    record( dressed.worn.includes( 'shoes01' ), 'dress() cannot omit a floor garment',
        dressed.worn.join( ', ' ) );

    const undressed = await wardrobe.undress();
    record( undressed.worn.join( ',' ) === 'shoes01', 'undress() returns to the floor, not to bare',
        undressed.worn.join( ', ' ) );

    const stripped = await wardrobe.takeOff( [ 'shoes01' ] );
    record( stripped.worn.includes( 'shoes01' ), 'takeOff() cannot remove a floor garment',
        stripped.worn.join( ', ' ) );

}

// --- main ---------------------------------------------------------------------------------------

console.log( '=' .repeat( 78 ) );
console.log( 'wardrobe selftest — punch-list 9.1, 9.2, 9.3' );
console.log( '=' .repeat( 78 ) );

const missing = [ MANIFEST_PATH, BODY_PATH, BAKED_SUIT_SHOES_PATH, BAKED_SUIT_PATH ]
    .filter( ( candidate ) => fs.existsSync( candidate ) === false );

if ( missing.length > 0 ) {

    console.log( '' );
    for ( const candidate of missing ) skip( path.relative( repoRoot, candidate ), 'not built' );
    console.log( '' );
    console.log( 'FAIL — build the artefacts first; tools/figure-pipeline/README.md has the commands.' );
    process.exit( 1 );

}

const manifestSource = JSON.parse( fs.readFileSync( MANIFEST_PATH, 'utf8' ) );
const manifest = checkManifest( manifestSource );

const { wardrobe, bakedSuitKept, bakedSuitOriented } = await checkRebuild( manifest );
await checkRebuildRed( manifest, bakedSuitKept );
await checkWindingRed( wardrobe, bakedSuitKept, bakedSuitOriented );
await checkDressCycle( wardrobe );
await checkDecencyHook( manifest );

const failures = results.filter( ( result ) => result.ok === false );

console.log( '' );
console.log( '=' .repeat( 78 ) );
console.log( failures.length === 0
    ? `PASS — ${ results.length } assertions.`
    : `FAIL — ${ failures.length } of ${ results.length }: ${ failures.map( ( f ) => f.label ).join( '; ' ) }` );

process.exit( failures.length === 0 ? 0 : 1 );
