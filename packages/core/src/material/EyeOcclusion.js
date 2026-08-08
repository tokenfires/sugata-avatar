/**
 * EyeOcclusion — punch-list 3.4's first two items: the eye occlusion sheet and the lacrimal fluid.
 *
 * WHY THE SHEET EXISTS
 * --------------------
 * `docs/research/eyes-and-lighting.md` §6, quoting Epic: *"wherever the eye comes in contact with
 * other tissues such as the eyelid or the tear duct (caruncle), you will see very soft shadowing
 * due to the fact that the eye itself is translucent."* And the sentence that makes it a punch-list
 * item rather than a nicety: **"Without this, eyes look pasted on."**
 *
 * It is not a shadow. Our shadow path cannot produce it — RectAreaLights cast none at all
 * (three.js issue #14161, open since 2018), and a shadow map at portrait framing cannot resolve a
 * 0.3 mm lid margin. Screen-space contact shadows are punch-list 3.9 and would help, but the
 * darkening under a lid is mostly *translucency* rather than occlusion: light that entered the lid
 * and did not come back out. A dedicated sheet is how every AAA pipeline draws it.
 *
 * WHERE THE APERTURE COMES FROM — MEASURED, NOT AUTHORED
 * ------------------------------------------------------
 * The one number a sheet like this needs is the shape of the palpebral fissure, and inventing it
 * would put a made-up ellipse over a measured eye. It is read instead off the figure's own
 * `Humaneyelashes01` mesh, whose roots sit ON the lid margins by construction. Measured on
 * `figure_g050.glb`, left eye, 125 vertices in front of the eye's equator, as the 20th-percentile
 * radial distance from the eye axis in each 30° azimuth sector (eye-local millimetres, 90° = up,
 * 180° = toward the nose). The minimum is shown beside it because the difference between the two
 * columns is a whole gate — see `measureAperture`:
 *
 *     sector      n    min    p20
 *      90-120°    4   3.18   3.18   upper lid, covering the top of a 6.35 mm iris — real anatomy
 *      60- 90°    3   3.21   3.21
 *      30- 60°    7   4.14   4.51
 *       0- 30°   20   6.36   9.25   <- one stray lash; p20 is the open temporal sclera
 *     -30-  0°   24   8.99  10.37   the lateral canthus
 *     -60--30°    9   5.44   5.53
 *     -90--60°    3   6.38   6.38   lower lid, at about the limbus
 *    -120--90°    6   4.39   4.53
 *   -150--120°   11   5.50   6.67
 *  -180--150°   24   9.04  10.07   the medial canthus
 *
 * So the fissure is wide at the corners and closes to 3.2 mm top and 4.5-6.4 mm bottom. That is a
 * real eye's shape and no ellipse fitted by hand would have found it.
 *
 * The sheet is a spherical patch just outside the globe, running from the measured aperture
 * outward under the lid, with its opacity strongest at the margin and fading toward the middle of
 * the opening. It hangs off the HEAD bone rather than off the eye, because it belongs to the lids:
 * an occlusion sheet that turned with gaze would drag the socket around with the eye.
 *
 * THE LACRIMAL STRIP
 * ------------------
 * §6 again: a separate mesh for the wetness gathering under the lower lid. This is a narrow
 * spherical band hugging the lower margin, given a near-black albedo and a mirror roughness so it
 * reads as a wet line rather than a bright one — it is a reflector, not an emitter.
 *
 * ⚠️ Research flags the "raise the occlusion mesh's emissive to read as a wet tearline" trick as
 * coming from an Epic forum thread rather than official docs. It is not used here; the tearline is
 * geometry with a specular material, which needs no such claim.
 */

import {
    BufferAttribute,
    BufferGeometry,
    DoubleSide,
    Matrix4,
    Mesh,
    MeshBasicNodeMaterial,
    MeshPhysicalNodeMaterial,
    Vector3
} from 'three/webgpu';

import { attribute, float, uniform, vec3 } from 'three/tsl';

export const EYELASH_MESH_PATTERN = /eyelash/i;

// Azimuth resolution of the aperture curve. 24 sectors is 15° each, and the lash mesh carries
// 125 vertices per eye — about five per sector, which is enough for a minimum to mean something
// and coarse enough that a single stray lash cannot cut a notch in the curve.
const APERTURE_SECTORS = 24;

// The aperture curve is smoothed with a three-sector moving average before it is used. The lash
// roots are a scatter, not a curve, and an unsmoothed per-sector statistic has millimetre steps in
// it that show up as scalloping along the lid margin. ONE pass, not two: two passes mix a 30° span
// and drag the wide temporal sector down toward its narrow neighbour, which is the same defect the
// percentile fixed, arriving by a different route (measured: G2 0.8841 at two passes, 0.9361 at one).
const APERTURE_SMOOTHING_PASSES = 1;

// Which order statistic of each sector's lash radii is taken as the lid margin. See the block
// comment in `measureAperture` — this was 0 (the minimum) and it cost a gate.
const APERTURE_PERCENTILE = 0.20;

// How far past the measured aperture the sheet continues, in millimetres of eye-local radius. Only
// ever seen if a lid opens further than bind; 4 mm covers the full blink range with margin.
const SHEET_OUTER_MARGIN_MM = 4.0;

// Where the darkening starts, as a fraction of the aperture radius, and how hard it is squeezed
// against the margin.
//
// ⚠️ Both were MEASURED against the gate, and the first values failed it badly. At an inner
// fraction of 0.42 with a plain smoothstep, the sheet carried alpha 0.31 out at the point where G2
// samples the temporal sclera — and it took the sclera:cheek ratio from 0.9157 to 0.6322 against a
// target of 0.98 +/- 0.06. The sheet was doing exactly what it was told; what it was told covered
// most of the visible eye rather than the contact band. Squeezing the ramp against the margin and
// cubing it, together with the percentile fix below, puts the shipped gate at 0.9361 — while the
// upper lid margin, 3.2 mm off the axis and INSIDE the iris, keeps its full contact shadow, which
// is where the effect is worth having in the first place.
const SHEET_INNER_FRACTION = 0.72;
const SHEET_RAMP_POWER = 3.0;

// Peak opacity at the lid margin. Kept well under 1: this is soft translucent shadowing, and an
// opaque black ring round the eye is a worse artefact than no sheet at all.
const SHEET_STRENGTH = 0.28;

// Standoff from the globe, in millimetres, so the sheet never z-fights the sclera. The corneal
// shell already sits 0.17-0.40 mm out (measured); the sheet goes outside both.
const SHEET_STANDOFF_MM = 0.55;

// The lacrimal strip's extent, as a fraction of the way from the aperture margin inward, and the
// azimuth range it covers. Tears gather along the LOWER lid, which is azimuth -180..0 in the eye
// frame with +90 up.
const TEAR_INNER_FRACTION = 0.86;
const TEAR_OUTER_FRACTION = 1.02;
const TEAR_AZIMUTH_RANGE = [ -175, -5 ];
const TEAR_STANDOFF_MM = 0.35;

const RADIAL_SEGMENTS = 14;

/**
 * Builds the occlusion sheet and the lacrimal strip for both eyes and parents them to the head.
 *
 * @param {Object} options
 * @param {Object} options.figure    - a `Figure`, for `root` and `bone('head')`.
 * @param {Object} options.geometry  - `EyeMaterial#geometry`, i.e. `{ left, right }` measurements.
 * @param {number} [options.strength=0.28]
 * @param {boolean} [options.tearline=true]
 * @returns {{meshes: Array<Mesh>, strengthUniform: Object, dispose: function}}
 */
export function buildEyeOcclusion( options ) {

    const figure = options.figure;
    const root = figure.root ?? figure;
    const head = typeof figure.bone === 'function' ? figure.bone( 'head' ) : null;

    const lashes = findLashMesh( root );
    const strengthUniform = uniform( options.strength ?? SHEET_STRENGTH );

    const sheetMaterial = new MeshBasicNodeMaterial();
    sheetMaterial.name = 'sugata.eye.occlusion';
    sheetMaterial.transparent = true;
    sheetMaterial.depthWrite = false;
    sheetMaterial.side = DoubleSide;
    sheetMaterial.colorNode = vec3( 0, 0, 0 );
    sheetMaterial.opacityNode = attribute( 'aOcclusion', 'float' ).mul( strengthUniform );

    const tearMaterial = new MeshPhysicalNodeMaterial();
    tearMaterial.name = 'sugata.eye.lacrimal';
    tearMaterial.transparent = true;
    tearMaterial.depthWrite = false;
    tearMaterial.side = DoubleSide;
    tearMaterial.roughness = 0.03;
    tearMaterial.metalness = 0;
    tearMaterial.ior = 1.336;
    tearMaterial.colorNode = vec3( 0.02, 0.02, 0.025 );
    tearMaterial.opacityNode = attribute( 'aOcclusion', 'float' ).mul( float( 0.85 ) );

    const meshes = [];
    const apertures = {};

    // Resolved once, from the skeleton rather than from the head's current transform, so this
    // works on a figure that has already been posed. See findHeadBindInverse.
    const headBindInverse = head === null ? null : findHeadBindInverse( root, head );

    for ( const side of [ 'left', 'right' ] ) {

        const eye = options.geometry[ side ];
        const aperture = measureAperture( lashes, eye );
        apertures[ side ] = aperture;

        meshes.push( placeOnHead(
            new Mesh( buildSheetGeometry( eye, aperture ), sheetMaterial ),
            eye, head, root, `eyeOcclusion.${ side }`, headBindInverse ) );

        if ( options.tearline !== false ) {

            meshes.push( placeOnHead(
                new Mesh( buildTearGeometry( eye, aperture ), tearMaterial ),
                eye, head, root, `eyeLacrimal.${ side }`, headBindInverse ) );

        }

    }

    return {
        meshes,
        strengthUniform,
        apertures,
        dispose() {

            for ( const mesh of meshes ) {

                mesh.removeFromParent();
                mesh.geometry.dispose();

            }
            sheetMaterial.dispose();
            tearMaterial.dispose();

        }
    };

}

/**
 * The palpebral aperture as a radius per azimuth sector, in eye-local metres.
 *
 * Falls back to a circle at 1.35x the iris radius if the figure carries no lash mesh — stated in
 * the return value so a caller can tell a measurement from a guess, because they should not read
 * the same.
 */
export function measureAperture( lashMesh, eye ) {

    const buckets = Array.from( { length: APERTURE_SECTORS }, () => [] );

    if ( lashMesh !== null ) {

        const position = lashMesh.geometry.attributes.position;
        const wantPositiveX = eye.centre[ 0 ] > 0;

        for ( let vertex = 0; vertex < position.count; vertex ++ ) {

            const x = position.getX( vertex );
            if ( wantPositiveX ? x <= 0 : x > 0 ) continue;

            const offset = [
                x - eye.centre[ 0 ],
                position.getY( vertex ) - eye.centre[ 1 ],
                position.getZ( vertex ) - eye.centre[ 2 ]
            ];

            // Only lash vertices that are actually in front of the eye describe the margin; the
            // tips curl forward and away and would read as a wider aperture than there is.
            if ( dot( offset, eye.axis ) <= 0 ) continue;

            const t = dot( offset, eye.tangent );
            const s = dot( offset, eye.bitangent );

            buckets[ sectorOf( Math.atan2( s, t ) ) ].push( Math.hypot( t, s ) );

        }

    }

    const fallback = eye.irisRadius * 1.35;
    const measured = buckets.some( ( bucket ) => bucket.length > 0 );
    const sectors = buckets.map( ( bucket ) => {

        if ( bucket.length === 0 ) return fallback;

        // 🚩 A LOW PERCENTILE, NOT THE MINIMUM, and the difference is a full gate.
        //
        // The first version took the minimum radius per sector, which is the obvious reading of
        // "how far in does the lid come". It is wrong because a single lash that hangs down across
        // the open eye is indistinguishable, at a vertex, from a root at the margin. Measured on
        // g050's left eye, temporal sector 0-30°, 20 vertices: min 6.36 mm, p20 9.25 mm, median
        // 11.15 mm. The 6.36 is one stray lash, and it pulled the aperture INSIDE the point where
        // the sclera is visible — which put the sheet's full 0.38 of darkening onto open sclera and
        // took G2's sclera:cheek ratio from 0.9157 to 0.6322.
        //
        // p20 keeps the anatomy where the anatomy is real: the upper sectors have only 3-4 vertices
        // each and their p20 is still 3.18-3.21 mm, so the upper lid still covers the top of the
        // iris exactly as it should.
        const sorted = [ ...bucket ].sort( ( a, b ) => a - b );
        return sorted[ Math.min( sorted.length - 1, Math.floor( sorted.length * APERTURE_PERCENTILE ) ) ];

    } );

    for ( let pass = 0; pass < APERTURE_SMOOTHING_PASSES; pass ++ ) {

        const smoothed = sectors.map( ( value, index ) => (
            sectors[ ( index - 1 + APERTURE_SECTORS ) % APERTURE_SECTORS ] +
            value +
            sectors[ ( index + 1 ) % APERTURE_SECTORS ] ) / 3 );

        for ( let sector = 0; sector < APERTURE_SECTORS; sector ++ ) sectors[ sector ] = smoothed[ sector ];

    }

    return { radii: sectors, measured, source: measured ? 'eyelash mesh' : 'fallback circle' };

}

/** The eyelash mesh, or null. */
export function findLashMesh( root ) {

    let found = null;
    root.traverse( ( object ) => {

        if ( object.isMesh === true && found === null && EYELASH_MESH_PATTERN.test( object.name ) ) found = object;

    } );
    return found;

}

// --- geometry -----------------------------------------------------------------------------------

/**
 * A spherical patch running from `SHEET_INNER_FRACTION` of the aperture out past it.
 *
 * Built in the eye's own frame and left there: `placeOnHead` supplies the one matrix that takes it
 * into the figure. Vertices carry an `aOcclusion` attribute, which is the whole shading model —
 * zero at the inner edge, one at the lid margin, held at one outside it.
 */
function buildSheetGeometry( eye, aperture ) {

    const outer = ( azimuth ) => apertureAt( aperture, azimuth ) + SHEET_OUTER_MARGIN_MM / 1000;
    const inner = ( azimuth ) => apertureAt( aperture, azimuth ) * SHEET_INNER_FRACTION;

    const ramp = ( fraction, azimuth ) => {

        const radius = inner( azimuth ) + ( outer( azimuth ) - inner( azimuth ) ) * fraction;
        const margin = apertureAt( aperture, azimuth );
        const t = Math.min( 1, Math.max( 0, ( radius - inner( azimuth ) ) / ( margin - inner( azimuth ) ) ) );
        return Math.pow( t * t * ( 3 - 2 * t ), SHEET_RAMP_POWER );

    };

    return buildAnnulus( eye, SHEET_STANDOFF_MM / 1000, 0, 360, inner, outer, ramp );

}

/** A narrow band along the lower margin, alpha peaking in the middle of the band. */
function buildTearGeometry( eye, aperture ) {

    const inner = ( azimuth ) => apertureAt( aperture, azimuth ) * TEAR_INNER_FRACTION;
    const outer = ( azimuth ) => apertureAt( aperture, azimuth ) * TEAR_OUTER_FRACTION;

    // Fades out at both ends of the azimuth range so the strip does not stop with a hard edge at
    // the canthi, and across the band so it reads as a meniscus rather than a ribbon.
    const ramp = ( fraction, azimuth, along ) => {

        const across = Math.sin( Math.PI * Math.min( 1, Math.max( 0, fraction ) ) );
        const ends = Math.sin( Math.PI * Math.min( 1, Math.max( 0, along ) ) );
        return across * Math.pow( ends, 0.45 );

    };

    return buildAnnulus( eye, TEAR_STANDOFF_MM / 1000,
        TEAR_AZIMUTH_RANGE[ 0 ], TEAR_AZIMUTH_RANGE[ 1 ], inner, outer, ramp );

}

/**
 * A ring of quads on the eye sphere, between two per-azimuth radii.
 *
 * Each vertex is placed by its eye-local radial distance from the axis and then pushed out to the
 * sphere along the axis, so the patch hugs the globe rather than floating as a flat disc. The patch
 * is one standoff outside the sclera radius throughout.
 */
function buildAnnulus( eye, standoff, azimuthFromDegrees, azimuthToDegrees, innerOf, outerOf, ramp ) {

    const shellRadius = eye.scleraRadius + standoff;
    const spanDegrees = azimuthToDegrees - azimuthFromDegrees;
    const closed = Math.abs( spanDegrees ) >= 359.9;
    const columns = closed ? APERTURE_SECTORS * 3 : Math.max( 8, Math.round( Math.abs( spanDegrees ) / 4 ) );

    const positions = [];
    const occlusion = [];
    const indices = [];

    for ( let column = 0; column <= columns; column ++ ) {

        const along = column / columns;
        const azimuth = ( azimuthFromDegrees + spanDegrees * along ) * Math.PI / 180;
        const inner = innerOf( azimuth );
        const outer = outerOf( azimuth );

        for ( let row = 0; row <= RADIAL_SEGMENTS; row ++ ) {

            const fraction = row / RADIAL_SEGMENTS;
            const radial = Math.min( inner + ( outer - inner ) * fraction, shellRadius * 0.985 );
            const depth = Math.sqrt( Math.max( 0, shellRadius * shellRadius - radial * radial ) );

            positions.push( Math.cos( azimuth ) * radial, Math.sin( azimuth ) * radial, depth );
            occlusion.push( ramp( fraction, azimuth, along ) );

        }

    }

    const stride = RADIAL_SEGMENTS + 1;

    for ( let column = 0; column < columns; column ++ ) {

        for ( let row = 0; row < RADIAL_SEGMENTS; row ++ ) {

            const a = column * stride + row;
            const b = a + stride;
            indices.push( a, b, a + 1, b, b + 1, a + 1 );

        }

    }

    const geometry = new BufferGeometry();
    geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( positions ), 3 ) );
    geometry.setAttribute( 'aOcclusion', new BufferAttribute( new Float32Array( occlusion ), 1 ) );
    geometry.setIndex( indices );
    geometry.computeVertexNormals();

    return geometry;

}

/**
 * The head bone's BIND inverse — its inverse world matrix at the moment the mesh was skinned,
 * taken from the skeleton that actually drives the figure.
 *
 * This exists because `head.matrixWorld` is not it. `matrixWorld` is the head's transform in
 * whatever pose the figure is standing in right now, and the eye geometry `placeOnHead` composes
 * against is measured in BIND object space. On an unposed figure the two agree and nothing shows;
 * on a posed one they differ by the whole pose. Measured on `alive.js`, which applies
 * `relaxed-standing` before any material is built: both occlusion sheets landed 29.3 mm to the
 * character's left of their own eyes — the left sheet at head-local x +0.0582 and the right at
 * +0.0004, against a bind-correct ±0.0289 — putting one of them on the temple as a visible grey
 * quad. The bind inverse is pose-independent by construction, so this is right in both cases.
 *
 * @returns {?Matrix4} null when nothing in the figure is skinned to this bone.
 */
function findHeadBindInverse( root, head ) {

    let bindInverse = null;

    root.traverse( ( object ) => {

        if ( bindInverse !== null ) return;
        if ( object.isSkinnedMesh !== true ) return;

        const index = object.skeleton.bones.indexOf( head );
        if ( index === -1 ) return;

        bindInverse = new Matrix4().copy( object.skeleton.boneInverses[ index ] );

    } );

    return bindInverse;

}

/**
 * Parents a patch built in eye-local coordinates to the head bone.
 *
 * The bind-pose transform from eye-local to object space is `[tangent | bitangent | axis]` with the
 * eye centre as translation, and the head bone's own bind transform is the inverse of its stored
 * `boneInverse`. Composing the two gives a fixed local matrix, so the patch rides the head and
 * nothing has to be recomputed per frame.
 *
 * If the figure has no head bone the patch goes on the root instead, which is right for a static
 * pose and wrong the moment the head moves — so it says so.
 */
function placeOnHead( mesh, eye, head, root, name, headBindInverse ) {

    mesh.name = name;
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false;

    const eyeToObject = new Matrix4().makeBasis(
        new Vector3().fromArray( eye.tangent ),
        new Vector3().fromArray( eye.bitangent ),
        new Vector3().fromArray( eye.axis ) );
    eyeToObject.setPosition( new Vector3().fromArray( eye.centre ) );

    if ( head === null || head === undefined ) {

        console.warn( `EyeOcclusion: no head bone; ${ name } is parented to the figure root and ` +
            'will not follow head motion.' );
        root.add( mesh );
        mesh.matrix.copy( eyeToObject );
        mesh.matrixWorld.copy( eyeToObject );
        return mesh;

    }

    let headBind = headBindInverse;

    if ( headBind === null || headBind === undefined ) {

        // Nothing is skinned to the head, so there is no bind pose to read and the current one is
        // the only answer available. Correct on an unposed figure and wrong by the pose otherwise.
        console.warn( `EyeOcclusion: no skinned mesh binds the head bone; ${ name } is placed from ` +
            'the CURRENT head transform, which is only correct if the figure is in its bind pose.' );

        head.updateWorldMatrix( true, false );
        headBind = new Matrix4().copy( head.matrixWorld ).invert();

    }

    head.add( mesh );
    mesh.matrix.copy( headBind ).multiply( eyeToObject );
    mesh.matrix.decompose( mesh.position, mesh.quaternion, mesh.scale );
    mesh.updateMatrixWorld( true );

    return mesh;

}

function apertureAt( aperture, azimuth ) {

    // Linear interpolation between sector centres, so the margin is a curve rather than a polygon.
    const scaled = ( azimuth / ( Math.PI * 2 ) * APERTURE_SECTORS + APERTURE_SECTORS * 1000 ) % APERTURE_SECTORS;
    const low = Math.floor( scaled );
    const fraction = scaled - low;

    return aperture.radii[ low % APERTURE_SECTORS ] * ( 1 - fraction ) +
        aperture.radii[ ( low + 1 ) % APERTURE_SECTORS ] * fraction;

}

function sectorOf( azimuth ) {

    const scaled = ( azimuth / ( Math.PI * 2 ) * APERTURE_SECTORS + APERTURE_SECTORS * 1000 ) % APERTURE_SECTORS;
    return Math.floor( scaled ) % APERTURE_SECTORS;

}

function dot( a, b ) {

    return a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ] + a[ 2 ] * b[ 2 ];

}
