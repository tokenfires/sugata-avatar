/**
 * hem.selftest.mjs — punch-list 9.8's HEM, measured twice: in the exported artefact, and in
 * rendered pixels.
 *
 * ## The defect this exists because of, and the wrong reading of it
 *
 * A blind judge shown the wardrobe browsercheck reported that the foundation garment's hem "reads
 * painted-on" — the edge where the briefs meet the thigh looked like a texture boundary rather than
 * the edge of a physical object. Two of the three judges ranked the foundation layer their single
 * strongest tell that the image was a render.
 *
 * 🚩 THE OBVIOUS READING — "the hem casts no shadow" — IS WRONG, AND IT WAS TESTED TO DESTRUCTION.
 * `shadow.selftest.mjs` swept 34 boxes down both thighs from the hip joint to 16 cm below it,
 * garment shadows on against off, and not one box moved by more than 0.5%. That is the geometry,
 * not a broken probe: a foundation shell stands 2.0 mm off the skin, and at full-body framing that
 * page renders about 1 mm per pixel.
 *
 * The fix is THICKNESS. `roll_the_hem()` in `tools/figure-pipeline/build_figure.py` extrudes the
 * shell's open boundary back toward the skin as a band of real faces. That band has been in the
 * shipped artefacts since R11 and **nobody had ever measured whether it reads.** The build printed
 * a face count out of its own bookkeeping; the judge's complaint was about pixels. Under this
 * repository's rules the item was therefore not closed. This gate closes it.
 *
 * ## The two halves, and which is the strong one
 *
 * **THE ARTEFACT.** `HemGeometry.js` welds each shipped foundation GLB, finds its open boundary,
 * and measures how far each boundary vertex sits BENEATH the shell's own surface along that
 * surface's normal. Rolled shells read the authored 1.200 mm at the median; a shell with no band
 * reads about 0.12 mm, which is tessellation residue. Nothing in this half trusts a flag, a
 * comment or the build's log — it is read off the bytes that ship.
 *
 * **THE PIXELS, and this is the half that answers the judge.** The page frames the briefs' leg
 * opening on the front of the thigh and the gate measures THE HEM TROUGH:
 *
 *     how much darker the garment is in the 1.5 mm immediately inside its own colour boundary
 *     than the same garment is 4–8 mm inside, per column, aligned on that boundary.
 *
 * ⚠️ WHY THAT STATISTIC AND NOT A GRADIENT OR A DARK-BAND WIDTH. The judge's distinction is
 * "object edge" against "texture boundary", and the two differ in exactly one place: a surface with
 * thickness turns under and darkens BEFORE it ends, a painted region carries its flat shading right
 * up to the cut. A gradient magnitude cannot tell them apart — both have a hard step, because the
 * garment and the skin are different colours either way. The trough is the part of the signal that
 * only geometry can produce.
 *
 * The boundary is located on CHROMA (red minus blue: the shell is neutral grey, the skin is warm)
 * and the trough is measured on LUMA. Locating on luma would let the darkening being measured move
 * the locator that measures it.
 *
 * ## Its red proof
 *
 * `'hem-roll'` collapses the band onto the ring it was extruded from and rebuilds every normal
 * from the shell alone — the geometry `build_figure.py --no-hem-roll` produces, reproduced in the
 * page. That flag exists for this, and the break was VALIDATED AGAINST A REAL BUILD OF IT rather
 * than assumed: built at R12 to a scratch directory and rendered through `?foundation=`, the two
 * agree to within a point on the same statistic. Point `HEM_NOROLL_FRAGMENTS` at such a directory
 * and this gate measures the built artefacts as well.
 *
 * ⚠️ The break moves POSITIONS AND NORMALS, and the version that moved only positions read
 * 52.32% against the shipped shell's 52.32% — no effect at all, having moved 1,003 vertices. At
 * this hem the band extrudes along the view direction and its projected area is nearly zero: the
 * roll reads because it bends the shading of the shell's last ring, not because it paints a stripe.
 * That is the single most useful thing this round measured and it is in `flattenHemRoll`'s note.
 *
 *     node packages/core/src/wardrobe/hem.selftest.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { measureHemRoll, nearestApproachMm, percentile } from './HemGeometry.js';

globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );

const { GLTFLoader } = await import( 'three/examples/jsm/loaders/GLTFLoader.js' );

const REPOSITORY_ROOT = path.resolve(
    path.dirname( fileURLToPath( import.meta.url ) ), '..', '..', '..', '..' );

const { decodePng } = await import(
    pathToFileURL( path.join( REPOSITORY_ROOT, 'tools', 'critic', 'png.mjs' ) ).href );
const { encodedLuma } = await import(
    pathToFileURL( path.join( REPOSITORY_ROOT, 'tools', 'critic', 'color.mjs' ) ).href );

const WARDROBE_DIR = path.join( REPOSITORY_ROOT, 'assets', 'wardrobe' );

const FOUNDATION_IDS = [
    'foundation_bra', 'foundation_vest', 'foundation_briefs', 'foundation_boxer_brief' ];

/** Every identity the foundation layer ships at. The hem is cut per identity, so it is checked so. */
const FIGURE_KEYS = [ 'g000', 'g050', 'g100' ];

/**
 * How deep the rolled band has to be at the median, in millimetres.
 *
 * ⚠️ A FLOOR, NOT THE AUTHORED VALUE. `FOUNDATION_HEM_ROLL_M` is 1.2 mm and the shipped shells
 * read 1.200 at the median across all twelve fragments, so a gate set at 1.2 would be a gate on
 * float rounding. What it has to separate is a shell with a band from one without: a
 * `--no-hem-roll` build of the same command reads 0.112–0.125 mm at the median, which is the
 * residue of measuring a flat surface's own tessellation. 0.6 mm is half the authored roll and
 * about five times the residue.
 */
const MINIMUM_MEDIAN_ROLL_MM = 0.6;

/**
 * How deep the hem trough has to be for the edge to read as an edge.
 *
 * ⚠️ AUTHORED BETWEEN TWO MEASUREMENTS, FITTED TO NEITHER. The shipped shells read 52.3% at
 * `detail` and 40.2% at `approach`. The same shells with the roll removed read 3.9% and 3.7% —
 * that residue is the shell's own shading falling off toward a silhouette, and it is what a
 * painted-on edge is worth. 15% is nearly four times the residue and under half the weaker of the
 * two working readings, so neither a small regression nor a light change lands on it.
 */
const MINIMUM_HEM_TROUGH = 0.15;

/**
 * How shallow a hem with no roll has to read. The other side of the same question, and the one
 * that makes the floor above mean something: if a flattened band could produce 15% by some other
 * mechanism then 52% would be evidence of nothing.
 */
const MAXIMUM_FLAT_TROUGH = 0.10;

/**
 * How far apart the shadowed and shadow-free readings may be before the trough is a SHADOW.
 *
 * 🚩 THE QUESTION THIS GATE WOULD OTHERWISE BE WIDE OPEN TO. 3.9 found no measurable garment
 * shadow at the hem, but it looked at full-body framing where a hem is one pixel; this framing is
 * twenty times closer, so "the dark line is the band's shadow on the thigh" is a live alternative
 * explanation and it would make this whole gate a re-measurement of 3.9. Clearing `castShadow` on
 * the worn fragments answers it: measured, the two readings are identical to five decimals.
 */
const MAXIMUM_SHADOW_SHARE = 0.02;

/** The window the trough is read in, and the window it is read against, in millimetres of skin. */
const TROUGH_INSIDE_MM = 1.5;
const TROUGH_PLATEAU_MM = [ 4, 8 ];

const GPU_FLAGS = [ '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--hide-scrollbars' ];
const WIDTH = 900;
const HEIGHT = 1600;

let checks = 0;
let failures = 0;

function report( ok, label, detail ) {

    checks ++;
    if ( ok !== true ) failures ++;

    console.log( `  ${ ok ? 'ok  ' : 'FAIL' } ${ label }${ detail ? ` — ${ detail }` : '' }` );

}

function toolError( message ) {

    console.error( `\nTOOL ERROR: ${ message }\n` );
    process.exit( 2 );

}

// --- the instrument, driven with input whose answer is known -------------------------------------

/**
 * 🚩 THE OTHER WAY (docs/LEARNINGS.md §1.1). Every clause below passes on the shipped shells, which
 * by itself proves only that the shells and the instrument agree. This drives `measureHemRoll` with
 * two hand-built meshes whose right answer is arithmetic: a flat strip of quads with an open edge,
 * and the same strip with a band of KNOWN depth extruded off that edge.
 *
 * The knife-edged tube is the case that matters, because it is what a `--no-hem-roll` build is: it
 * has an open boundary and it has triangles touching that boundary, so an instrument that took
 * "there is a boundary" for "there is a band" would pass the broken build. It has to come back with
 * the depth at zero.
 *
 * ⚠️ AND IT SHOWS WHAT THE TRIANGLE-COUNT CLAUSE IS AND IS NOT. The knife-edged tube ALSO has
 * exactly two boundary-touching triangles per boundary edge, because a clean row of quads does.
 * That clause is an exactness check on the band — it catches a partial extrusion, a decimation, a
 * corner where two band quads share a triangle — and it is NOT what separates rolled from flat.
 * The depth is. A round that reads the count as the discriminator will set the wrong threshold.
 */
function runInstrumentSelftest() {

    console.log( '\n--- the instrument, on input whose answer is known ---' );

    const AROUND = 48;
    const RINGS = 5;
    const RADIUS = 0.05;
    const SPACING = 0.01;
    const ROLL_DEPTH = 0.0012;

    // A capped tube, so its ONLY open boundary is the ring at y = 0 — the hem. Its surface normal
    // is radial by symmetry, which makes the right answer for the depth arithmetic rather than
    // approximate: a band rolled inward by d measures exactly d.
    const positions = [];
    for ( let ring = 0; ring < RINGS; ring ++ ) {

        for ( let step = 0; step < AROUND; step ++ ) {

            const angle = ( step / AROUND ) * Math.PI * 2;
            positions.push( Math.cos( angle ) * RADIUS, ring * SPACING, Math.sin( angle ) * RADIUS );

        }

    }

    const pole = positions.length / 3;
    positions.push( 0, ( RINGS - 1 ) * SPACING, 0 );

    const indices = [];
    for ( let ring = 0; ring < RINGS - 1; ring ++ ) {

        for ( let step = 0; step < AROUND; step ++ ) {

            const next = ( step + 1 ) % AROUND;
            const low = ring * AROUND;
            const high = ( ring + 1 ) * AROUND;
            indices.push( low + step, high + next, low + next, low + step, high + step, high + next );

        }

    }

    for ( let step = 0; step < AROUND; step ++ ) {

        const top = ( RINGS - 1 ) * AROUND;
        indices.push( top + step, pole, top + ( step + 1 ) % AROUND );

    }

    const knifeEdged = measureHemRoll( positions, indices );

    // The same tube with its hem rolled inward: every ring-0 vertex copied at a smaller radius.
    const rolledPositions = positions.slice();
    const rolledIndices = indices.slice();
    const ringStart = rolledPositions.length / 3;

    for ( let step = 0; step < AROUND; step ++ ) {

        const angle = ( step / AROUND ) * Math.PI * 2;
        rolledPositions.push( Math.cos( angle ) * ( RADIUS - ROLL_DEPTH ), 0,
            Math.sin( angle ) * ( RADIUS - ROLL_DEPTH ) );

    }

    for ( let step = 0; step < AROUND; step ++ ) {

        const next = ( step + 1 ) % AROUND;
        rolledIndices.push( step, ringStart + next, ringStart + step,
            step, next, ringStart + next );

    }

    const rolled = measureHemRoll( rolledPositions, rolledIndices );
    const rolledMedian = percentile( rolled.depthsMm, 0.5 );
    const knifeMedian = percentile( knifeEdged.depthsMm, 0.5 );

    console.log( `       knife-edged tube  ${ knifeEdged.boundaryEdges } boundary edges, ` +
        `${ knifeEdged.bandTriangles } band tris, median depth ${ knifeMedian.toFixed( 4 ) } mm` );
    console.log( `       rolled tube       ${ rolled.boundaryEdges } boundary edges, ` +
        `${ rolled.bandTriangles } band tris, median depth ${ rolledMedian.toFixed( 4 ) } mm` );

    // Not exact, and the residue is the synthetic shape's rather than the instrument's: a 48-gon's
    // vertex normal is the area-weighted average of facets at ±3.75°, and the quad triangulation
    // makes that average asymmetric by a fraction of a degree. At 12 segments the same reading was
    // 1.1952; at 48 it is 1.1997. A quarter of one per cent is two orders under anything the gate
    // above it decides.
    const recovered = Math.abs( rolledMedian - ROLL_DEPTH * 1000 ) / ( ROLL_DEPTH * 1000 );
    report( recovered < 0.005,
        'the instrument recovers a known roll depth to a quarter of one per cent',
        `${ rolledMedian.toFixed( 6 ) } mm for a band built at ${ ROLL_DEPTH * 1000 } mm, ` +
        `${ ( recovered * 100 ).toFixed( 3 ) }% out` );

    report( rolled.bandTriangles === rolled.boundaryEdges * 2,
        'the instrument counts two band triangles per boundary edge on a real extrusion',
        `${ rolled.bandTriangles } for ${ rolled.boundaryEdges } edges` );

    report( Math.abs( knifeMedian ) < MINIMUM_MEDIAN_ROLL_MM,
        'THE OTHER WAY — an open tube with no band is NOT read as a rolled hem',
        `median depth ${ knifeMedian.toFixed( 4 ) } mm, under the ` +
        `${ MINIMUM_MEDIAN_ROLL_MM } mm floor` );

}

// --- the artefact half --------------------------------------------------------------------------

async function loadGltf( filePath ) {

    const file = fs.readFileSync( filePath );
    const buffer = file.buffer.slice( file.byteOffset, file.byteOffset + file.byteLength );

    return new Promise( ( resolve, reject ) => {
        new GLTFLoader().parse( buffer, '', resolve, reject );
    } );

}

/** The largest mesh in a GLB, which on a fragment is the garment and on a body is the skin. */
function largestMeshOf( gltf ) {

    let found = null;

    gltf.scene.traverse( ( object ) => {

        if ( object.isMesh !== true ) return;
        if ( found === null ||
            object.geometry.attributes.position.count > found.geometry.attributes.position.count ) {

            found = object;

        }

    } );

    return found;

}

async function measureShippedArtefacts() {

    console.log( '\n' + '='.repeat( 78 ) );
    console.log( 'the rolled hem in the EXPORTED artefacts — geometry, not the build\'s own log' );
    console.log( '='.repeat( 78 ) );

    for ( const figureKey of FIGURE_KEYS ) {

        const bodyPath = path.join( WARDROBE_DIR, 'body', `${ figureKey }.glb` );

        if ( fs.existsSync( bodyPath ) === false ) {

            toolError( `no body at ${ bodyPath }. See tools/figure-pipeline/README.md.` );

        }

        const body = largestMeshOf( await loadGltf( bodyPath ) );
        const skinPositions = body.geometry.attributes.position.array;
        const skinIndices = body.geometry.index.array;

        console.log( `\n--- ${ figureKey }, against a ${ ( skinIndices.length / 3 ).toLocaleString() }` +
            `-triangle body ---` );

        for ( const id of FOUNDATION_IDS ) {

            const fragmentPath = path.join( WARDROBE_DIR, id, `${ figureKey }.glb` );

            if ( fs.existsSync( fragmentPath ) === false ) {

                toolError( `no fragment at ${ fragmentPath }. See tools/figure-pipeline/README.md.` );

            }

            const mesh = largestMeshOf( await loadGltf( fragmentPath ) );
            const positions = mesh.geometry.attributes.position.array;
            const measured = measureHemRoll( positions, mesh.geometry.index.array );

            const median = percentile( measured.depthsMm, 0.5 );
            const low = percentile( measured.depthsMm, 0.05 );
            const high = percentile( measured.depthsMm, 0.95 );

            // 🚩 THE CLEARANCE IS MEASURED AND REPORTED AND DELIBERATELY NOT ASSERTED ON, because
            // THIS GATE AND THE BUILD ARE LOOKING AT TWO DIFFERENT SURFACES and the gap between
            // them is wider than any floor worth setting. `describe_foundation` measures against
            // `skin_surface_of`, a BVH of the SUBDIVIDED PATCH the shell was cut from, and its own
            // comment says why it must: triangulating a curved base-mesh quad moves the surface by
            // up to 1.25 mm. This gate can only measure against what SHIPS, which is the exporter's
            // triangulation of those same quads. Measured this round they are not close — the g050
            // briefs report a 0.77 mm minimum standoff from the build and their band ring comes
            // within 0.055 mm of the triangulated body.
            //
            // ⚠️ WHICH OF THE TWO MATTERS FOR Z-FIGHTING IS THE TRIANGULATION, because that is what
            // the GPU rasterises and a foundation garment hides no body vertices — the skin is
            // drawn underneath it. That is a real question and it is not this round's: it needs a
            // rendered probe at the tightest identity and the wardrobe page ships only g050.
            //
            // So the ring and the rest of the shell are measured separately against the same body
            // with the same instrument, because only the COMPARISON survives the caveat: the
            // triangulation error is common to both, so the gap between them is the roll's own
            // contribution and is readable even though neither absolute number is.
            const ring = [];
            const interior = [];

            for ( let vertex = 0; vertex < measured.vertexCount; vertex ++ ) {

                const target = measured.boundary.has( vertex ) ? ring : interior;
                target.push( measured.coordinates[ vertex * 3 ],
                    measured.coordinates[ vertex * 3 + 1 ],
                    measured.coordinates[ vertex * 3 + 2 ] );

            }

            const ringClearance = nearestApproachMm(
                Float64Array.from( ring ), skinPositions, skinIndices );
            const shellClearance = nearestApproachMm(
                Float64Array.from( interior ), skinPositions, skinIndices );

            console.log( `\n  ${ id } ${ figureKey }` );
            console.log( `    ${ measured.triangleCount.toLocaleString() } tris, ` +
                `${ measured.vertexCount.toLocaleString() } welded verts, ` +
                `${ measured.boundaryEdges } boundary edges, ` +
                `${ measured.bandTriangles } band tris, ` +
                `${ measured.nonManifoldEdges } non-manifold edges` );
            console.log( `    roll depth mm  p05 ${ low.toFixed( 3 ) }  ` +
                `median ${ median.toFixed( 3 ) }  p95 ${ high.toFixed( 3 ) }` );
            console.log( `    REPORTED, NOT ASSERTED — nearest approach to the DRAWN body: ` +
                `ring ${ ringClearance.millimetres.toFixed( 4 ) } mm, ` +
                `rest of shell ${ shellClearance.millimetres.toFixed( 4 ) } mm` );

            // 🎯 THE TOPOLOGICAL SIGNATURE OF AN EXTRUSION, and it is exact rather than a
            // tolerance: `extrude_edge_only` makes one quad per boundary edge and the exporter
            // triangulates each into two. A shell with no band still has a boundary — its hem —
            // but the triangles touching it are the shell's own and there are fewer of them.
            report( measured.bandTriangles === measured.boundaryEdges * 2,
                `${ id } ${ figureKey } — the band is one extruded quad per boundary edge`,
                `${ measured.bandTriangles } band tris against ${ measured.boundaryEdges } × 2` );

            report( median >= MINIMUM_MEDIAN_ROLL_MM,
                `${ id } ${ figureKey } — the hem ring sits under the shell's own surface`,
                `median ${ median.toFixed( 3 ) } mm against a ${ MINIMUM_MEDIAN_ROLL_MM } mm floor` );

        }

    }

}

// --- the pixel half -----------------------------------------------------------------------------

/**
 * Playwright is deliberately not a dependency of this repo — it is a development instrument, not
 * part of the build. Same resolution order as `shadow.selftest.mjs`.
 */
async function loadPlaywright() {

    const cache = path.join( process.env.HOME ?? '', '.npm', '_npx' );
    const fromCache = fs.existsSync( cache )
        ? fs.readdirSync( cache )
            .map( ( entry ) => path.join( cache, entry, 'node_modules', 'playwright' ) )
            .filter( ( candidate ) => fs.existsSync( candidate ) )
        : [];

    const require = createRequire( import.meta.url );

    for ( const candidate of [ 'playwright', process.env.PLAYWRIGHT_MODULE, ...fromCache ] ) {

        if ( candidate === undefined ) continue;

        try {

            const namespace = await import( pathToFileURL( require.resolve( candidate ) ).href );
            return namespace.chromium !== undefined ? namespace : namespace.default;

        } catch {

            // try the next candidate; the error only matters if they all fail
        }

    }

    return null;

}

/** The watcher is off for the reason capture.mjs turns it off: a concurrent save would navigate. */
async function startVite() {

    const { createServer } = await import(
        path.join( REPOSITORY_ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js' ) );

    const server = await createServer( {
        configFile: path.join( REPOSITORY_ROOT, 'vite.config.js' ),
        server: { port: 5201, strictPort: false, hmr: false, watch: { ignored: [ '**' ] } },
        logLevel: 'silent'
    } );

    await server.listen();
    server.baseUrl = server.resolvedUrls.local[ 0 ].replace( /\/$/, '' );

    return server;

}

/**
 * THE STATISTIC. One reading of the hem trough, from one strip of rendered pixels.
 *
 * The strip is scanned column by column. Each column's colour boundary is found by linear
 * interpolation on chroma, then the luma is averaged over a window just inside it and over a
 * window well inside it, and the trough is the fraction of the second that the first has lost.
 * Per column rather than per row, so a hem that runs at a slight angle across the strip — this
 * one rises about six rows over its width — is measured across its own edge rather than smeared
 * along the strip's.
 */
function hemTroughOf( png, metresPerPixel ) {

    const { width, height, pixels } = decodePng( png );

    const luma = new Float64Array( width * height );
    const chroma = new Float64Array( width * height );

    for ( let pixel = 0; pixel < width * height; pixel ++ ) {

        const offset = pixel * 4;
        luma[ pixel ] = encodedLuma(
            pixels[ offset ], pixels[ offset + 1 ], pixels[ offset + 2 ] );
        chroma[ pixel ] = pixels[ offset ] - pixels[ offset + 2 ];

    }

    const meanChroma = ( from, to ) => {

        let total = 0;
        for ( let row = from; row < to; row ++ ) {

            for ( let column = 0; column < width; column ++ ) total += chroma[ row * width + column ];

        }

        return total / ( ( to - from ) * width );

    };

    const eighth = Math.max( 1, Math.floor( height / 8 ) );
    const garmentChroma = meanChroma( 0, eighth );
    const skinChroma = meanChroma( height - eighth, height );
    const threshold = ( garmentChroma + skinChroma ) / 2;

    const pixelsPerMm = 0.001 / metresPerPixel;
    const inside = Math.max( 2, Math.round( TROUGH_INSIDE_MM * pixelsPerMm ) );
    const plateauNear = Math.max( inside + 1, Math.round( TROUGH_PLATEAU_MM[ 0 ] * pixelsPerMm ) );
    const plateauFar = Math.round( TROUGH_PLATEAU_MM[ 1 ] * pixelsPerMm );

    let insideTotal = 0;
    let insideCount = 0;
    let plateauTotal = 0;
    let plateauCount = 0;
    let columns = 0;
    const edgeRows = [];

    for ( let column = 0; column < width; column ++ ) {

        let edge = -1;

        for ( let row = 1; row < height; row ++ ) {

            const above = chroma[ ( row - 1 ) * width + column ];
            const below = chroma[ row * width + column ];

            if ( ( above - threshold ) * ( below - threshold ) <= 0 && above !== below ) {

                edge = row - 1 + ( threshold - above ) / ( below - above );
                break;

            }

        }

        const base = Math.floor( edge );
        if ( edge < 0 || base - plateauFar < 0 ) continue;

        columns ++;
        edgeRows.push( [ column, edge ] );

        for ( let step = 1; step <= inside; step ++ ) {

            insideTotal += luma[ ( base - step ) * width + column ];
            insideCount ++;

        }

        for ( let step = plateauNear; step <= plateauFar; step ++ ) {

            plateauTotal += luma[ ( base - step ) * width + column ];
            plateauCount ++;

        }

    }

    const insideLuma = insideTotal / Math.max( 1, insideCount );
    const plateauLuma = plateauTotal / Math.max( 1, plateauCount );

    return {
        columns, width, height, insideLuma, plateauLuma, garmentChroma, skinChroma,
        pixelsPerMm,
        trough: plateauLuma <= 0 ? 0 : ( plateauLuma - insideLuma ) / plateauLuma,
        straightness: straightnessOf( edgeRows, pixelsPerMm )
    };

}

/**
 * 🎯 THE JUDGES SAID TWO THINGS AND THIS MEASURES THE SECOND ONE, WHICH IS NOT FIXED.
 *
 * *"A texture region, not a garment"* is the thickness complaint, and the trough above answers it.
 * *"A JAGGY texture boundary on bare skin"* is a different complaint about the same edge, and the
 * roll does nothing for it: the shell is cut by a per-vertex region rule on a body mesh whose edge
 * loops run where anatomy runs, so the hem is a staircase of whole quads no matter how thick it is.
 * `FOUNDATION_HEM_REFINEMENTS` halves the step; it cannot remove it.
 *
 * The statistic is the residual of the per-column edge row about a straight-line fit, in
 * millimetres of skin. The line is removed because a hem is allowed to slope and to curve; what a
 * viewer reads as jagged is the part that does not.
 *
 * Reported, not asserted. There is no threshold here because nothing has been done about it yet
 * and a floor no build has ever cleared is a decoration.
 */
function straightnessOf( edgeRows, pixelsPerMm ) {

    if ( edgeRows.length < 3 ) return { rmsMm: NaN, peakToPeakMm: NaN };

    let sumX = 0;
    let sumY = 0;

    for ( const [ column, row ] of edgeRows ) { sumX += column; sumY += row; }

    const meanX = sumX / edgeRows.length;
    const meanY = sumY / edgeRows.length;

    let covariance = 0;
    let variance = 0;

    for ( const [ column, row ] of edgeRows ) {

        covariance += ( column - meanX ) * ( row - meanY );
        variance += ( column - meanX ) ** 2;

    }

    const slope = variance === 0 ? 0 : covariance / variance;

    let squared = 0;
    let lowest = Infinity;
    let highest = -Infinity;

    for ( const [ column, row ] of edgeRows ) {

        const residual = row - ( meanY + slope * ( column - meanX ) );
        squared += residual * residual;
        lowest = Math.min( lowest, residual );
        highest = Math.max( highest, residual );

    }

    return {
        rmsMm: Math.sqrt( squared / edgeRows.length ) / pixelsPerMm,
        peakToPeakMm: ( highest - lowest ) / pixelsPerMm
    };

}

/** Stage one framing, screenshot the strip, and measure it. */
async function readHem( page, request ) {

    const staged = await page.evaluate( ( input ) =>
        globalThis.sugataWardrobe.stageHemProbe( input ), request );

    const [ x, y, width, height ] = staged.strip;
    const shot = await page.screenshot( { clip: { x, y, width, height }, timeout: 30000 } );

    return { ...hemTroughOf( shot, staged.metresPerPixel ), staged };

}

function describe( label, reading ) {

    console.log( `       ${ label.padEnd( 22 ) } trough ` +
        `${ ( reading.trough * 100 ).toFixed( 2 ) }%   ` +
        `inside ${ reading.insideLuma.toFixed( 5 ) }  plateau ${ reading.plateauLuma.toFixed( 5 ) }  ` +
        `${ reading.columns }/${ reading.width } columns  ` +
        `${ reading.pixelsPerMm.toFixed( 2 ) } px/mm` );

}

// --- run ------------------------------------------------------------------------------------------

console.log( '='.repeat( 78 ) );
console.log( 'the foundation hem — punch-list 9.8, in the artefact and in rendered pixels' );
console.log( '='.repeat( 78 ) );

runInstrumentSelftest();
await measureShippedArtefacts();

const playwright = await loadPlaywright();
if ( playwright === null ) {

    toolError( 'playwright not resolvable. Run: npx playwright install chromium' );

}

const server = await startVite().catch(
    ( error ) => toolError( `vite would not start: ${ error.message }` ) );

let browser = null;

try {

    browser = await playwright.chromium.launch(
        { channel: 'chromium', headless: true, args: GPU_FLAGS } );

} catch ( error ) {

    await server.close();
    toolError( `could not launch Chromium: ${ error.message }` );

}

try {

    const context = await browser.newContext( {
        viewport: { width: WIDTH, height: HEIGHT },
        deviceScaleFactor: 1,
        colorScheme: 'dark'
    } );

    const page = await context.newPage();
    await page.goto( `${ server.baseUrl }/src/wardrobe.html`,
        { waitUntil: 'load', timeout: 60000 } );
    await page.waitForFunction(
        () => globalThis.sugataWardrobe?.stageHemProbe !== undefined, null, { timeout: 60000 } );

    console.log( '\n' + '='.repeat( 78 ) );
    console.log( 'the same hem in rendered pixels — the half the judge was looking at' );
    console.log( '='.repeat( 78 ) );
    console.log( `\n${ server.baseUrl }/src/wardrobe.html   ${ WIDTH }x${ HEIGHT }` );

    for ( const framing of [ 'detail', 'approach' ] ) {

        console.log( `\n--- the briefs' leg opening, '${ framing }' framing ---` );

        const shipped = await readHem( page, { outfit: [], framing, break: 'none' } );
        const unlit = await readHem( page, { outfit: [], framing, break: 'garment-cast' } );
        const flattened = await readHem( page, { outfit: [], framing, break: 'hem-roll' } );

        console.log( `       strip ${ shipped.staged.strip.join( ',' ) }, worn ` +
            `${ shipped.staged.worn.join( ', ' ) }, aim ` +
            `${ shipped.staged.aim.map( ( value ) => value.toFixed( 3 ) ).join( ',' ) }` );
        describe( 'as shipped', shipped );
        describe( 'castShadow cleared', unlit );
        describe( 'hem roll flattened', flattened );
        console.log( `       flattened ${ JSON.stringify( flattened.staged.flattened ) } vertices` );
        console.log( `       REPORTED, NOT ASSERTED — the hem's straightness, residual about a ` +
            `line: rms ${ shipped.straightness.rmsMm.toFixed( 3 ) } mm, ` +
            `peak-to-peak ${ shipped.straightness.peakToPeakMm.toFixed( 3 ) } mm. ` +
            `This is the judges' OTHER complaint and the roll does not touch it.` );

        report( shipped.columns === shipped.width,
            `${ framing } — every column of the strip crosses the hem`,
            `${ shipped.columns } of ${ shipped.width }` );

        report( shipped.plateauLuma > 0.15,
            `${ framing } — the strip is on lit cloth, and the decode did not go to zero`,
            `plateau ${ shipped.plateauLuma.toFixed( 4 ) }` );

        // 🎯 THE HEADLINE. Nothing in this process has touched a light, a material or a flag.
        report( shipped.trough >= MINIMUM_HEM_TROUGH,
            `${ framing } — THE HEADLINE: the hem darkens before it ends, so it has thickness`,
            `${ ( shipped.trough * 100 ).toFixed( 2 ) }% against a ` +
            `${ ( MINIMUM_HEM_TROUGH * 100 ).toFixed( 0 ) }% floor` );

        // The alternative explanation, closed rather than argued. If this ever goes red the
        // trough has become a cast shadow and this gate has quietly turned into 3.9's.
        const shadowShare = Math.abs( shipped.trough - unlit.trough ) /
            Math.max( shipped.trough, Number.EPSILON );
        report( shadowShare <= MAXIMUM_SHADOW_SHARE,
            `${ framing } — the trough is the BAND, not a shadow it casts`,
            `${ ( shadowShare * 100 ).toFixed( 2 ) }% of the reading moves when castShadow is cleared` );

        // RED PROOF — the defect at its source, reproduced: no band, and normals rebuilt from the
        // shell alone, which is what `build_figure.py --no-hem-roll` exports.
        report( flattened.trough <= MAXIMUM_FLAT_TROUGH,
            `${ framing } — RED PROOF: flattening the roll takes the trough away`,
            `${ ( flattened.trough * 100 ).toFixed( 2 ) }% against a ` +
            `${ ( MAXIMUM_FLAT_TROUGH * 100 ).toFixed( 0 ) }% ceiling` );

        report( Object.values( flattened.staged.flattened ).every( ( count ) => count > 0 ),
            `${ framing } — RED PROOF: and it really moved a band`,
            JSON.stringify( flattened.staged.flattened ) );

    }

    // --- the built red proof, when one has been built -----------------------------------------
    //
    // 🎯 The break above is a reconstruction and this is the thing itself. It is optional because a
    // Blender build is not something a selftest may assume, and it is HERE rather than in a note
    // because the reconstruction's credibility rests on having been checked against it at least
    // once — R12, `--no-hem-roll`, and the two agreed to within a point.

    const builtNoRoll = process.env.HEM_NOROLL_FRAGMENTS ?? null;

    console.log( '\n--- a real --no-hem-roll build, if one has been pointed at ---' );

    if ( builtNoRoll === null ) {

        console.log( '       not run. Build one and set HEM_NOROLL_FRAGMENTS to its directory:' );
        console.log( '       blender --background --python tools/figure-pipeline/build_figure.py' );
        console.log( '         -- --gender 0.5 --output <scratch>/body/g050.glb --no-hem-roll' );
        console.log( '         --foundation foundation_briefs ... --garment-fragment-dir <scratch>' );

    } else {

        const variant = await context.newPage();
        await variant.goto( `${ server.baseUrl }/src/wardrobe.html?foundation=` +
            `/@fs${ path.resolve( builtNoRoll ) }`, { waitUntil: 'load', timeout: 60000 } );
        await variant.waitForFunction(
            () => globalThis.sugataWardrobe?.stageHemProbe !== undefined, null, { timeout: 60000 } );

        for ( const framing of [ 'detail', 'approach' ] ) {

            const built = await readHem( variant, { outfit: [], framing, break: 'none' } );
            describe( `built no-roll ${ framing }`, built );

            report( built.trough <= MAXIMUM_FLAT_TROUGH,
                `${ framing } — RED PROOF AT SOURCE: a --no-hem-roll build has no trough`,
                `${ ( built.trough * 100 ).toFixed( 2 ) }% against a ` +
                `${ ( MAXIMUM_FLAT_TROUGH * 100 ).toFixed( 0 ) }% ceiling` );

        }

        await variant.close();

    }

    await context.close();

} catch ( error ) {

    console.error( error );
    failures += 1;

} finally {

    await browser.close();
    await server.close();

}

console.log( '' );
console.log( '='.repeat( 78 ) );
console.log( failures === 0
    ? `PASS — ${ checks } assertions.`
    : `FAIL — ${ failures } of ${ checks }.` );

process.exit( failures === 0 ? 0 : 1 );
