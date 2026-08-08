/**
 * Gate for `material/EyeMaterial.js`, `material/EyeCatchlight.js` and `material/EyeOcclusion.js`.
 *
 * The eye shader is a stack of arithmetic on numbers measured off the mesh at load. If any one of
 * those measurements is wrong the shader still compiles, still runs at 60 fps, and produces a
 * plausible eye with the pupil in the wrong place — `docs/LEARNINGS.md` §1.2 in its purest form.
 * So this file measures the measurements.
 *
 * Built around checks that are known to fail on known-bad input (§1.1):
 *
 *   REAL ASSETS       All five bakes. Every geometric quantity the shader runs on, against a band
 *                     derived from anatomy or from an independently-recorded figure in
 *                     `docs/PROGRESS.md`, never from this implementation's own previous output.
 *
 *   THE OTHER WAY     A synthesised PERFECT SPHERE. The check that says "the cornea is a genuine
 *                     second surface" must FAIL on it and say by how much, because that check is
 *                     the one thing standing between this shader and the low-poly proxy that had
 *                     no dome at all (§1.11c). A second synthetic shell with a real 7.25 mm cap
 *                     inside a 15.3 mm globe must PASS, so the two directions are both proven.
 *
 *   RIGID DECOMPOSITION  The gaze rotations this file recovers from the morph deltas are checked
 *                     against `tools/spikes/eye-geometry.mjs`'s independently measured rotation
 *                     angles, which were derived a different way (a full rigid fit, not a
 *                     least-squares rotation vector).
 *
 *   ROUND TRIPS       Rodrigues, and the claim the shader depends on most quietly: that
 *                     `worldToEye` really is the inverse of `eyeToWorld`. The shader transposes
 *                     one to get the other, so if the basis were ever non-orthonormal the view
 *                     ray would be transformed by a wrong matrix that still looked like a rotation.
 *
 *   THE PUPIL REMAP   The two-piece radial map `motion/Pupil.js` specifies, checked for the two
 *                     properties its usefulness rests on: continuity at the pupil edge, and the
 *                     annulus actually being REMAPPED as the pupil opens rather than a circle
 *                     merely scaling. A plain circle scale passes neither. The direction of that
 *                     second one is stated wrong as often as right; see the check itself.
 *
 * A measurement outside its range is printed as FAIL and the process exits non-zero. It is not
 * grounds for widening the range.
 *
 * Usage:  node "packages/core/src/material/EyeMaterial.selftest.mjs"
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// three's GLTFLoader assumes a browser when it decodes embedded textures. Nothing here inspects
// pixels, so two stubs get the loader to the geometry.
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );

const { GLTFLoader } = await import( 'three/examples/jsm/loaders/GLTFLoader.js' );
const { Matrix3 } = await import( 'three' );

const {
    EyeMaterial,
    measureEye,
    measureEyeGeometry,
    findEyeMeshes,
    IRIS_RADIUS_UV,
    PUPIL_RADIUS_UV,
    CORNEA_IOR,
    SCLERA_SPEC_SRGB,
    SCLERA_CHROMA,
    lumaNeutralGain
} = await import( './EyeMaterial.js' );

const {
    CATCHLIGHT_PRESETS,
    CATCHLIGHT_SIZE,
    angularHalfSize,
    evaluateCatchlight,
    resolveCatchlightRig
} = await import( './EyeCatchlight.js' );
const { measureAperture, findLashMesh } = await import( './EyeOcclusion.js' );

const REPOSITORY_ROOT = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..', '..', '..', '..' );
const FIGURES = [ 'g000', 'g025', 'g050', 'g075', 'g100' ];

// Rotation angles per gaze morph, in degrees, as `tools/spikes/eye-geometry.mjs` measures them on
// figure_g050 by a full rigid fit. Quoted, not re-derived — the point of comparing against them is
// that they came from different arithmetic.
const SPIKE_GAZE_DEGREES = {
    eyeLookDownLeft: 11.32,
    eyeLookInLeft: 15.08,
    eyeLookOutLeft: 14.57,
    eyeLookUpLeft: 9.85
};

const results = [];

await main();

async function main() {

    console.log( '\nEyeMaterial — geometry, gaze frame, pupil remap, catchlight, aperture\n' );

    console.log( 'the five bakes' );
    console.log( '  figure  eye     sclera R   cornea R    R ratio   cap RMS   band RMS   iris plane   iris R' );

    const measurements = {};

    for ( const figure of FIGURES ) {

        const scene = await loadScene( path.join( REPOSITORY_ROOT, 'assets', 'figures', `figure_${ figure }.glb` ) );
        const meshes = findEyeMeshes( scene );
        const geometry = measureEyeGeometry( meshes.globe, meshes.cornea );
        measurements[ figure ] = { scene, meshes, geometry };

        for ( const side of [ 'left', 'right' ] ) {

            const eye = geometry[ side ];
            console.log( `  ${ figure }   ${ side.padEnd( 6 ) } ` +
                `${ mm( eye.scleraRadius ).padStart( 8 ) }   ${ mm( eye.corneaRadius ).padStart( 8 ) }   ` +
                `${ ( eye.scleraRadius / eye.corneaRadius ).toFixed( 3 ).padStart( 7 ) }   ` +
                `${ mm( eye.corneaResidualRms ).padStart( 7 ) }   ${ mm( eye.scleraResidualRms ).padStart( 8 ) }   ` +
                `${ mm( eye.irisPlaneZ ).padStart( 10 ) }   ${ mm( eye.irisRadius ).padStart( 6 ) }` );

        }

    }

    console.log();
    checkRealAssets( measurements );

    console.log( '\nthe other way — synthetic shells with a known answer' );
    checkSyntheticShells();

    console.log( '\nthe gaze frame' );
    checkGazeFrame( measurements.g050 );

    console.log( '\nthe pupil remap' );
    checkPupilRemap();

    console.log( '\nthe catchlight' );
    checkCatchlight( measurements );

    console.log( '\nthe sclera tint' );
    checkScleraTint();

    console.log( '\nthe palpebral aperture' );
    checkAperture( measurements.g050 );

    report();

}

// --- the five bakes --------------------------------------------------------------------------

function checkRealAssets( measurements ) {

    for ( const figure of FIGURES ) {

        const { left, right } = measurements[ figure ].geometry;

        // Anatomy, not our own output. A human eyeball is ~12 mm in radius and PROGRESS records
        // this asset's corneal shell at a 15.11-15.50 mm sclera band, so the globe's own band sits
        // just inside that. Anything outside says the band filter picked up the cornea or the dish.
        check( `${ figure } sclera radius (mm)`, left.scleraRadius * 1000, [ 14.4, 15.3 ] );

        // PROGRESS's corneal radius table spans 6.910-7.644 mm across the sweep, measured about the
        // WHOLE SHELL's fit centre along an assumed +Z. This file cuts the same 15 degree cap about
        // the GLOBE's sclera-band centre along the MEASURED axis, so the two are entitled to differ
        // — most at g100, whose axis is 6.7 degrees off +Z. The band is widened to admit both
        // conventions rather than pretending they are the same measurement.
        check( `${ figure } cornea anterior radius (mm)`, left.corneaRadius * 1000, [ 6.8, 7.8 ] );

        // 🚩 THE CHECK THAT MATTERS. A cornea is a second surface with its own radius; the
        // superseded low-poly proxy was one sphere and had none (LEARNINGS §1.11c). Two radii
        // differing by a factor of two cannot be produced by a single-radius shell, which is what
        // the synthetic sphere below proves in the other direction.
        check( `${ figure } sclera / cornea radius ratio`, left.scleraRadius / left.corneaRadius, [ 1.85, 2.20 ],
            'a single-radius shell reads 1.00' );

        // And the cap fit has to be TIGHTER than the band fit, or the "second radius" is fit noise.
        check( `${ figure } band RMS / cap RMS`, left.scleraResidualRms / left.corneaResidualRms, [ 4.0, 30 ],
            'the cap is a real surface, not a noisy corner of the band' );

        // The flat iris plane. Depth from the eye centre, and how flat "flat" is.
        check( `${ figure } iris plane depth (mm)`, left.irisPlaneZ * 1000, [ 12.3, 13.4 ] );
        check( `${ figure } iris plane RMS (mm)`, left.irisPlaneRms * 1000, [ 0, 0.55 ],
            'the dish is a bowl; this is how much of one' );

        // Iris radius, converted from the texture-space constant through the fitted UV jacobian.
        // A human iris is 5.5-6.5 mm in radius.
        check( `${ figure } iris radius (mm)`, left.irisRadius * 1000, [ 5.8, 6.8 ] );

        // The anterior chamber the refracted ray crosses: corneal apex to iris plane. A real eye is
        // about 3.0-3.6 mm cornea-to-iris. Note this is NOT the spike's 2.291 mm, which is apex to
        // apex between the two SHELLS and a different quantity.
        const chamber = ( left.corneaCentreZ + left.corneaRadius - left.irisPlaneZ ) * 1000;
        check( `${ figure } anterior chamber, apex to iris plane (mm)`, chamber, [ 2.8, 3.8 ] );

        // The two eyes are a mirrored pair, so every scalar has to agree.
        check( `${ figure } left/right sclera radius (mm apart)`,
            Math.abs( left.scleraRadius - right.scleraRadius ) * 1000, [ 0, 0.01 ] );
        check( `${ figure } left/right cornea radius (mm apart)`,
            Math.abs( left.corneaRadius - right.corneaRadius ) * 1000, [ 0, 0.05 ] );

        // The planar UV map. R-squared is recorded in the spike at 0.9945/0.9958; what the shader
        // needs is that the fit REPRODUCES the shipped uv, so this is checked as a residual.
        check( `${ figure } UV fit residual (texels at 1024)`, uvResidualTexels( measurements[ figure ], 'left' ),
            [ 0, 14 ], 'the affine map really is the shipped layout' );

    }

    // The gender sweep steepens the cornea monotonically — PROGRESS records g000 7.644 -> g100
    // 6.910. Direction only; the magnitudes are checked per figure above.
    const radii = FIGURES.map( ( figure ) => measurements[ figure ].geometry.left.corneaRadius );
    const monotone = radii.every( ( value, index ) => index === 0 || value < radii[ index - 1 ] );
    check( 'cornea steepens monotonically with gender', monotone ? 1 : 0, [ 1, 1 ],
        `${ radii.map( ( r ) => ( r * 1000 ).toFixed( 3 ) ).join( ' > ' ) }` );

}

/**
 * How far the fitted affine UV map lands from the shipped UVs, in texels of a 1024 map, over the
 * globe's front hemisphere.
 */
function uvResidualTexels( measurement, side ) {

    const eye = measurement.geometry[ side ];
    const geometry = measurement.meshes.globe.geometry;
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const wantPositiveX = eye.centre[ 0 ] > 0;

    let total = 0;
    let count = 0;

    for ( let vertex = 0; vertex < position.count; vertex ++ ) {

        const x = position.getX( vertex );
        if ( wantPositiveX ? x <= 0 : x > 0 ) continue;

        const offset = [ x - eye.centre[ 0 ], position.getY( vertex ) - eye.centre[ 1 ],
            position.getZ( vertex ) - eye.centre[ 2 ] ];

        const z = dot( offset, eye.axis );
        if ( z <= 0 ) continue;

        const t = dot( offset, eye.tangent );
        const s = dot( offset, eye.bitangent );

        const u = eye.uvCentre[ 0 ] + eye.uvJacobian[ 0 ] * t + eye.uvJacobian[ 1 ] * s;
        const v = eye.uvCentre[ 1 ] + eye.uvJacobian[ 2 ] * t + eye.uvJacobian[ 3 ] * s;

        total += ( u - uv.getX( vertex ) ) ** 2 + ( v - uv.getY( vertex ) ) ** 2;
        count ++;

    }

    return Math.sqrt( total / count ) * 1024;

}

// --- the other way ------------------------------------------------------------------------------

/**
 * Two synthetic shells whose answer is known before the code runs.
 *
 * The perfect sphere is the important one. It is what the superseded `low-poly` eye proxy was —
 * measured at R 14.955 mm with a fit RMS of 0.0018 mm, so flawlessly spherical there is nothing
 * there to be a cornea — and the whole refraction technique is meaningless on it. If the ratio
 * check cannot tell a sphere from a domed shell, it is not a check.
 */
function checkSyntheticShells() {

    const sphere = synthesiseShell( { globeRadiusMm: 15.3, capRadiusMm: 15.3, capDegrees: 20 } );
    const domed = synthesiseShell( { globeRadiusMm: 15.3, capRadiusMm: 7.25, capDegrees: 20 } );

    const sphereEye = measureEye( sphere.globe, sphere.uv, sphere.cornea );
    const domedEye = measureEye( domed.globe, domed.uv, domed.cornea );

    const sphereRatio = sphereEye.scleraRadius / sphereEye.corneaRadius;
    const domedRatio = domedEye.scleraRadius / domedEye.corneaRadius;

    // KNOWN-BAD: this must be OUTSIDE the [1.85, 2.20] band the real assets are held to.
    check( 'perfect sphere: sclera / cornea ratio', sphereRatio, [ 0.95, 1.05 ],
        'the real-asset band is 1.85-2.20, so a sphere FAILS it — that is the point' );
    const sphereWouldFail = sphereRatio < 1.85 || sphereRatio > 2.20;
    check( 'perfect sphere fails the real-asset band', sphereWouldFail ? 1 : 0, [ 1, 1 ] );

    // KNOWN-GOOD: a synthetic 7.25 mm cap in a 15.3 mm globe must land where the real assets do.
    check( 'synthetic domed shell: recovered cap radius (mm)', domedEye.corneaRadius * 1000, [ 6.9, 7.7 ],
        'authored at 7.25' );
    check( 'synthetic domed shell: sclera / cornea ratio', domedRatio, [ 1.85, 2.30 ] );

}

/**
 * A two-radius shell as a point cloud: a spherical globe, and a cornea that is the same globe with
 * a cap of a different radius blended onto its front, joined so the two surfaces meet.
 *
 * Same construction as `docs/eye-optics-claims.selftest.mjs` uses for the same purpose, rebuilt
 * here rather than imported because a gate that shares its known-bad input with another gate is
 * one input, not two.
 */
function synthesiseShell( { globeRadiusMm, capRadiusMm, capDegrees, rings = 16, segments = 20 } ) {

    const globe = [];
    const cornea = [];
    const uv = [];

    // The cap's centre sits forward of the globe's so the two surfaces meet at the join angle.
    const capExtent = capDegrees * Math.PI / 180;
    const joinRadial = globeRadiusMm * Math.sin( capExtent );
    const joinAxial = globeRadiusMm * Math.cos( capExtent );
    const capCentreZ = joinAxial - Math.sqrt( Math.max( 0, capRadiusMm ** 2 - joinRadial ** 2 ) );

    for ( let ring = 0; ring <= rings; ring ++ ) {

        // 0 at the pole, 120 degrees at the back edge — the same open cap the real shells are.
        const polar = ring / rings * ( 120 * Math.PI / 180 );

        for ( let segment = 0; segment < segments; segment ++ ) {

            const azimuth = segment / segments * Math.PI * 2;
            const sin = Math.sin( polar );
            const cos = Math.cos( polar );

            const on = ( radial, axial ) => [
                Math.cos( azimuth ) * radial / 1000,
                Math.sin( azimuth ) * radial / 1000,
                axial / 1000
            ];

            globe.push( on( globeRadiusMm * sin, globeRadiusMm * cos ) );
            uv.push( [ 0.5 + Math.cos( azimuth ) * sin * 0.3, 0.5 + Math.sin( azimuth ) * sin * 0.3 ] );

            if ( polar <= capExtent ) {

                const capPolar = Math.asin( Math.min( 1, globeRadiusMm * sin / capRadiusMm ) );
                cornea.push( on( capRadiusMm * Math.sin( capPolar ), capCentreZ + capRadiusMm * Math.cos( capPolar ) ) );

            } else {

                cornea.push( on( globeRadiusMm * sin, globeRadiusMm * cos ) );

            }

        }

    }

    return { globe, cornea, uv };

}

// --- the gaze frame -------------------------------------------------------------------------------

function checkGazeFrame( measurement ) {

    const eyes = new EyeMaterial( {
        globeMesh: measurement.meshes.globe,
        corneaMesh: measurement.meshes.cornea,
        catchlight: null
    } );

    const recovered = {};
    for ( const rotation of eyes.frames.left.gazeRotationVectors ) {

        recovered[ rotation.name ] = Math.hypot( ...rotation.omega ) * 180 / Math.PI;

    }

    check( 'gaze morphs recovered for the left eye', Object.keys( recovered ).length, [ 4, 4 ],
        Object.keys( recovered ).join( ' ' ) );

    for ( const [ name, spikeDegrees ] of Object.entries( SPIKE_GAZE_DEGREES ) ) {

        check( `${ name } vs the spike's ${ spikeDegrees }°`, recovered[ name ] ?? 0,
            [ spikeDegrees - 0.5, spikeDegrees + 0.5 ], 'independent arithmetic, same answer' );

    }

    // The rig's own left/right symmetry, through the whole recovery path.
    const mirrored = {};
    for ( const rotation of eyes.frames.right.gazeRotationVectors ) {

        mirrored[ rotation.name ] = Math.hypot( ...rotation.omega ) * 180 / Math.PI;

    }
    check( 'right eye recovers the mirrored four', Object.keys( mirrored ).length, [ 4, 4 ],
        Object.keys( mirrored ).join( ' ' ) );

    // 🚩 The claim the shader leans on hardest and never states: the shader inverts `eyeToWorld` by
    // transposing it. That is only an inverse if the matrix is orthonormal, and `update()` builds
    // it out of a bone's world matrix — which carries whatever scale the scene put there.
    eyes.update();

    for ( const side of [ 'left', 'right' ] ) {

        const frame = eyes.frames[ side ];
        const product = new Matrix3().copy( frame.eyeToWorld.value ).multiply( frame.worldToEye.value );
        check( `${ side } worldToEye is the inverse of eyeToWorld`, distanceFromIdentity( product ), [ 0, 1e-6 ] );

    }

    // Drive a gaze and confirm the frame actually turns by the amount the morph says. This is the
    // part that makes the eye-local frame survive gaze at all; if it silently did nothing, every
    // still frame would still look right.
    const dictionary = measurement.meshes.globe.morphTargetDictionary;
    const restingAxis = frameAxis( eyes.frames.left );

    measurement.meshes.globe.morphTargetInfluences[ dictionary.eyeLookInLeft ] = 1;
    eyes.update();
    const turnedAxis = frameAxis( eyes.frames.left );
    measurement.meshes.globe.morphTargetInfluences[ dictionary.eyeLookInLeft ] = 0;
    eyes.update();

    const turnedDegrees = Math.acos( Math.min( 1, dot( restingAxis, turnedAxis ) ) ) * 180 / Math.PI;
    check( 'eyeLookInLeft at 1.0 turns the eye frame (°)', turnedDegrees,
        [ SPIKE_GAZE_DEGREES.eyeLookInLeft - 0.5, SPIKE_GAZE_DEGREES.eyeLookInLeft + 0.5 ] );

    const restoredDegrees = Math.acos( Math.min( 1, dot( restingAxis, frameAxis( eyes.frames.left ) ) ) ) * 180 / Math.PI;
    check( 'and returns to rest when the weight does', restoredDegrees, [ 0, 0.01 ] );

    // The right eye must NOT move on a *Left morph. The spike proves the morphs are one-sided; this
    // proves the recovery kept them one-sided.
    measurement.meshes.globe.morphTargetInfluences[ dictionary.eyeLookInLeft ] = 1;
    eyes.update();
    const rightMoved = Math.acos( Math.min( 1, dot( frameAxis( eyes.frames.right ),
        mirrorX( restingAxis ) ) ) ) * 180 / Math.PI;
    measurement.meshes.globe.morphTargetInfluences[ dictionary.eyeLookInLeft ] = 0;
    eyes.update();

    check( 'a *Left morph leaves the right eye alone (°)', rightMoved, [ 0, 0.05 ] );

    eyes.dispose();

}

function frameAxis( frame ) {

    // The third column of eyeToWorld is the eye's forward axis in world space.
    const e = frame.eyeToWorld.value.elements;
    return [ e[ 6 ], e[ 7 ], e[ 8 ] ];

}

function mirrorX( axis ) {

    return [ -axis[ 0 ], axis[ 1 ], axis[ 2 ] ];

}

function distanceFromIdentity( matrix ) {

    const e = matrix.elements;
    let worst = 0;
    for ( let index = 0; index < 9; index ++ ) {

        worst = Math.max( worst, Math.abs( e[ index ] - ( index % 4 === 0 ? 1 : 0 ) ) );

    }
    return worst;

}

// --- the pupil remap -------------------------------------------------------------------------------

/**
 * The shader's two-piece radial map, in plain JavaScript.
 *
 * Kept as a separate implementation on purpose: the point is to check the ALGEBRA that
 * `motion/Pupil.js` specifies, and reading it back out of a node graph would only prove the graph
 * matches itself.
 */
function remap( radius, pupilScale ) {

    const authored = PUPIL_RADIUS_UV / IRIS_RADIUS_UV;
    const edge = Math.min( 0.9, Math.max( 0.02, authored * pupilScale ) );

    return radius < edge
        ? ( radius / edge ) * authored
        : authored + ( radius - edge ) / ( 1 - edge ) * ( 1 - authored );

}

function checkPupilRemap() {

    const authored = PUPIL_RADIUS_UV / IRIS_RADIUS_UV;

    check( 'authored pupil radius, as a fraction of the iris', authored, [ 0.18, 0.26 ],
        `measured off brown_eye.png: pupil ${ PUPIL_RADIUS_UV } uv, iris ${ IRIS_RADIUS_UV } uv` );

    for ( const scale of [ 0.5, 1.0, 1.6 ] ) {

        // Continuity: the two pieces have to meet at the pupil edge, or a hard ring appears there.
        const edge = authored * scale;
        const inside = remap( edge - 1e-6, scale );
        const outside = remap( edge + 1e-6, scale );
        check( `pupilScale ${ scale }: the two pieces meet`, Math.abs( inside - outside ), [ 0, 1e-4 ] );

        // Endpoints are pinned, so the limbus never moves and the centre never inverts.
        check( `pupilScale ${ scale }: r=0 maps to 0`, remap( 0, scale ), [ 0, 1e-9 ] );
        check( `pupilScale ${ scale }: r=1 maps to 1`, remap( 1, scale ), [ 1 - 1e-9, 1 + 1e-9 ] );

        // Monotone, or the iris folds through itself.
        let monotone = true;
        let previous = -1;
        for ( let step = 0; step <= 200; step ++ ) {

            const value = remap( step / 200, scale );
            if ( value < previous - 1e-9 ) monotone = false;
            previous = value;

        }
        check( `pupilScale ${ scale }: monotone`, monotone ? 1 : 0, [ 1, 1 ] );

    }

    // 🚩 The property that distinguishes this from scaling a circle, and the FIRST VERSION OF THIS
    // CHECK ASSERTED IT BACKWARDS — worth keeping the correction visible, because the direction is
    // genuinely easy to get wrong and the check caught the prose rather than the code.
    //
    // The map takes a GEOMETRIC radius on the eye to a TEXTURE radius in the iris disc. Opening the
    // pupil pushes the pupil edge outward, so the iris tissue is squeezed into a narrower annulus
    // on the eye — which means a fixed geometric point now shows fibres that used to sit CLOSER to
    // the pupil. The sample coordinate therefore moves INWARD while the image of the fibres moves
    // outward on screen. Those are the same event described from the two ends of the map.
    //
    // A plain circle scale would leave every annulus sample exactly where it was, and both numbers
    // below would be 0.
    const midAnnulus = ( authored + 1 ) / 2;
    const resting = remap( midAnnulus, 1.0 );

    check( 'opening the pupil pulls the annulus sample inward', remap( midAnnulus, 1.6 ) - resting,
        [ -0.30, -0.03 ], 'a plain circle scale would read exactly 0' );

    check( 'closing the pupil pushes it outward', remap( midAnnulus, 0.5 ) - resting, [ 0.03, 0.30 ] );

}

// --- the catchlight ---------------------------------------------------------------------------------

function checkCatchlight( measurements ) {

    // The rig's emitters are stated as a fraction of iris diameter, so they only become angles
    // against a real figure. Every check below therefore runs on the RESOLVED rig for g050, and
    // the size clause is checked across all five bakes.
    const eye = measurements.g050.geometry.left;
    const rig = resolveCatchlightRig( CATCHLIGHT_PRESETS.softbox, eye );
    const key = rig.emitters[ 0 ];

    // --- the size clause, which is the whole of the spec's numeric statement about a catchlight --
    //
    // "Single dominant catchlight, small (2-4% of iris diameter)". The model that converts a
    // fraction to an angle is in EyeCatchlight.angularHalfSize; this asserts the round trip on
    // every figure, so a bake whose cornea drifts cannot silently take the highlight out of band.
    for ( const figure of FIGURES ) {

        for ( const side of [ 'left', 'right' ] ) {

            const measured = measurements[ figure ].geometry[ side ];
            const resolved = resolveCatchlightRig( CATCHLIGHT_PRESETS.softbox, measured );
            const dominant = resolved.emitters[ 0 ];

            // Invert the model: the arc the highlight paints, as a fraction of iris diameter.
            const widthFraction = dominant.halfWidth * measured.corneaRadius / ( 2 * measured.irisRadius );
            const heightFraction = dominant.halfHeight * measured.corneaRadius / ( 2 * measured.irisRadius );

            check( `${ figure } ${ side } catchlight width (% of iris diameter)`,
                widthFraction * 100, [ 2.0, 4.0 ] );
            check( `${ figure } ${ side } catchlight height (% of iris diameter)`,
                heightFraction * 100, [ 2.0, 4.0 ],
                `half-angle ${ dominant.halfHeight.toFixed( 4 ) } rad on a ${ mm( measured.corneaRadius ) } mm cornea` );

        }

    }

    check( 'the size model is monotone in the fraction',
        angularHalfSize( 0.04, 0.00635, 0.00733 ) - angularHalfSize( 0.02, 0.00635, 0.00733 ),
        [ 1e-3, 1 ] );

    // 🚩 THE OTHER WAY (LEARNINGS §1.1). The size gate has to be able to FAIL, so run it against
    // the sizes this file shipped before the rewrite — halfWidth 0.115, halfHeight 0.160 rad — and
    // confirm they land outside the 2-4% band rather than inside it.
    const legacyWidth = 0.115 * eye.corneaRadius / ( 2 * eye.irisRadius ) * 100;
    const legacyHeight = 0.160 * eye.corneaRadius / ( 2 * eye.irisRadius ) * 100;
    check( 'the superseded 0.115 rad panel is REJECTED by the same band', legacyWidth, [ 4.0, 40 ],
        `${ legacyWidth.toFixed( 1 ) }% — outside 2-4%, which is why it was replaced` );
    check( 'the superseded 0.160 rad panel is REJECTED too', legacyHeight, [ 4.0, 40 ],
        `${ legacyHeight.toFixed( 1 ) }%` );

    // --- ONE dominant emitter ------------------------------------------------------------------
    //
    // The spec: "Single dominant catchlight ... plus soft ambient wash — not a multi-light array."
    // The previous rig failed this by construction: two panels, the second at 0.16 of the first's
    // intensity and nearly twice its angular size, so it rendered as a second rectangle. The count
    // is now a structural property of the preset, so assert it as one.
    check( 'exactly ONE emitter in the cubemap', rig.emitters.length, [ 1, 1 ],
        'the wash is a constant, so anything above 1 here is a second catchlight' );
    check( 'the wash is far dimmer than the dominant emitter',
        key.intensity / Math.max( rig.wash.intensity, 1e-9 ), [ 20, 1e4 ] );

    const onAxis = luminance( evaluateCatchlight( rig, key.direction ) );
    const behind = luminance( evaluateCatchlight( rig, key.direction.map( ( value ) => -value ) ) );
    const wash = luminance( rig.wash.colour ) * rig.wash.intensity;

    check( 'the key panel is the brightest direction', onAxis, [ 0.5, 3.0 ] );
    check( 'the texture is BLACK away from the panel', behind, [ 0, 1e-9 ],
        'the wash is a shader constant, not a texel — see CATCHLIGHT_PRESETS.softbox.wash' );
    check( 'panel against wash', onAxis / Math.max( wash, 1e-6 ), [ 20, 1e6 ],
        'a catchlight that is not many times the field is not a catchlight' );

    // 🚩 RECTANGULAR, not round. Two directions the same angle off the panel axis — one along the
    // panel's short axis, one along its long axis — must NOT read the same. A round emitter would
    // give them identical values, and a round catchlight is the commonest tell of a real-time eye.
    const probe = ( alongRight, alongUp ) => {

        const direction = [
            key.direction[ 0 ] + 0, key.direction[ 1 ] + 0, key.direction[ 2 ] + 0
        ];
        // Build the same frame the emitter does, then step off-axis by the given angles.
        const forward = normalise( direction );
        const up = normalise( subtract( [ 0, 1, 0 ], scale( forward, dot( [ 0, 1, 0 ], forward ) ) ) );
        const right = cross( up, forward );
        return luminance( evaluateCatchlight( rig, normalise( [
            forward[ 0 ] + right[ 0 ] * Math.tan( alongRight ) + up[ 0 ] * Math.tan( alongUp ),
            forward[ 1 ] + right[ 1 ] * Math.tan( alongRight ) + up[ 1 ] * Math.tan( alongUp ),
            forward[ 2 ] + right[ 2 ] * Math.tan( alongRight ) + up[ 2 ] * Math.tan( alongUp )
        ] ) ) );

    };

    // Probe between the two half-angles: outside the panel's width, inside its height. Derived
    // from the resolved rig rather than hardcoded, because the angles now come from the asset.
    const between = ( key.halfWidth + key.halfHeight ) / 2;
    const acrossShortAxis = probe( between, 0 );
    const acrossLongAxis = probe( 0, between );

    check( 'the panel is wider one way than the other', acrossLongAxis - acrossShortAxis, [ 0.2, 2.0 ],
        `short-axis ${ acrossShortAxis.toFixed( 3 ) }, long-axis ${ acrossLongAxis.toFixed( 3 ) } ` +
        '— a round emitter gives 0' );

    // Well outside the dominant panel the TEXTURE is black. The "soft ambient wash" half of the
    // spec sentence lives in rig.wash and is added by the shader at unit scale, which is what keeps
    // it out of the peak multiplier.
    check( 'outside the panel entirely, the texture is black',
        probe( key.halfWidth * 8, key.halfHeight * 8 ), [ 0, 1e-9 ] );

}

// --- the sclera tint -------------------------------------------------------------------------------

function checkScleraTint() {

    const gain = lumaNeutralGain( SCLERA_SPEC_SRGB );
    const weights = [ 0.2126, 0.7152, 0.0722 ];
    const toLinear = ( v ) => ( v <= 0.04045 ? v / 12.92 : Math.pow( ( v + 0.055 ) / 1.055, 2.4 ) );
    const toSrgb = ( v ) => ( v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow( v, 1 / 2.4 ) - 0.055 );
    const saturation = ( rgb ) => {

        const max = Math.max( ...rgb );
        return max === 0 ? 0 : ( max - Math.min( ...rgb ) ) / max;

    };

    // 1. Luma neutrality on a neutral input, which is the property G2 depends on.
    const grey = 0.5;
    const tinted = gain.map( ( g ) => grey * g );
    const lumaBefore = grey;
    const lumaAfter = weights.reduce( ( total, w, i ) => total + w * tinted[ i ], 0 );
    check( 'the sclera tint is luma-neutral on a neutral input', Math.abs( lumaAfter - lumaBefore ),
        [ 0, 1e-12 ], `${ lumaBefore } -> ${ lumaAfter }` );

    // 2. It actually adds chroma, and lands near the spec's own saturation. The map's sclera is
    //    RGB 160,153,145 encoded; run the real value through and read the encoded saturation.
    const mapSclera = [ 160, 153, 145 ].map( ( v ) => toLinear( v / 255 ) );
    const before = saturation( mapSclera.map( toSrgb ) );
    const after = saturation( mapSclera.map( ( v, i ) => toSrgb( v * gain[ i ] ) ) );
    const specSaturation = saturation( SCLERA_SPEC_SRGB );

    check( 'the shipped map sclera is near-neutral', before, [ 0, 0.14 ],
        `saturation ${ before.toFixed( 4 ) } — scaling this can never make it pink` );

    // Full gain overshoots the spec hex in ALBEDO, because the map's sclera is not perfectly
    // neutral and the two chromas compound. That is deliberate and it is not the number to chase:
    // the spec's hex is a RENDERED colour under the reference's lighting, and this rig's warm key
    // desaturates the pink on the way through. The albedo therefore sits above the spec hex so the
    // RENDER lands on it — measured on eye.html, sclera saturation 0.216 -> 0.267 against a cheek
    // at 0.214, i.e. the spec's "more saturated than skin" ratio of 1.25 against a reference 1.28.
    check( 'the albedo sits above the spec hex, so the render lands on it',
        after / specSaturation, [ 1.05, 1.35 ],
        `${ after.toFixed( 4 ) } against spec ${ specSaturation.toFixed( 4 ) }` );

    // What actually ships: the blend at SCLERA_CHROMA, which must be monotone in the blend and
    // must be well clear of the map's own near-grey.
    const blended = saturation(
        mapSclera.map( ( v, i ) => toSrgb( v * ( 1 + SCLERA_CHROMA * ( gain[ i ] - 1 ) ) ) ) );
    check( 'the shipped blend is at least the spec chromaticity', blended / specSaturation,
        [ 1.0, 1.35 ],
        `chroma ${ SCLERA_CHROMA }: ${ before.toFixed( 4 ) } -> ${ blended.toFixed( 4 ) }, ` +
        `spec ${ specSaturation.toFixed( 4 ) }` );

    const halfWay = saturation(
        mapSclera.map( ( v, i ) => toSrgb( v * ( 1 + 0.5 * SCLERA_CHROMA * ( gain[ i ] - 1 ) ) ) ) );
    check( 'the blend is monotone', blended - halfWay, [ 1e-3, 1 ],
        `half ${ halfWay.toFixed( 4 ) }, full ${ blended.toFixed( 4 ) }` );

    // 🚩 THE OTHER WAY. Chroma 0 is the pre-fix behaviour and must FAIL the same band — otherwise
    // the check is measuring nothing (LEARNINGS §1.1).
    const unblended = saturation( mapSclera.map( toSrgb ) );
    check( 'chroma 0 is REJECTED by the same band', unblended / specSaturation, [ 0, 0.99 ],
        `${ unblended.toFixed( 4 ) } — 0.34x the spec, which is the defect this fixes` );

    // 3. 🚩 THE OTHER WAY. A grey target must produce a gain of exactly 1 and change nothing —
    //    if this passed with a non-unit gain, the transfer function is wrong somewhere.
    const neutralGain = lumaNeutralGain( [ 0.5, 0.5, 0.5 ] );
    check( 'a neutral target gives a unit gain',
        Math.max( ...neutralGain.map( ( g ) => Math.abs( g - 1 ) ) ), [ 0, 1e-12 ],
        neutralGain.map( ( g ) => g.toFixed( 6 ) ).join( ' ' ) );

    // 4. Hue: the spec calls the sclera pink-tinted, so red must be the dominant channel.
    check( 'the tint is pink (red gain is the largest)',
        gain[ 0 ] - Math.max( gain[ 1 ], gain[ 2 ] ), [ 1e-3, 5 ],
        gain.map( ( g ) => g.toFixed( 4 ) ).join( ' ' ) );

}

// --- the aperture -------------------------------------------------------------------------------

function checkAperture( measurement ) {

    const lashes = findLashMesh( measurement.scene );
    check( 'the eyelash mesh is present', lashes === null ? 0 : 1, [ 1, 1 ],
        lashes === null ? 'no /eyelash/ mesh' : lashes.name );

    const aperture = measureAperture( lashes, measurement.geometry.left );
    check( 'the aperture is measured, not a fallback circle', aperture.measured ? 1 : 0, [ 1, 1 ],
        aperture.source );

    const at = ( degrees ) => {

        const index = Math.round( ( ( degrees + 360 ) % 360 ) / 360 * aperture.radii.length ) % aperture.radii.length;
        return aperture.radii[ index ] * 1000;

    };

    // The two anatomical facts a lid aperture has to satisfy, and the sheet depends on both:
    // the upper lid comes in over the iris, and the canthi are wide open.
    check( 'upper lid margin (mm from the eye axis)', at( 90 ), [ 2.5, 5.0 ],
        `covers the top of a ${ mm( measurement.geometry.left.irisRadius ) } mm iris` );
    check( 'lateral canthus (mm)', at( 0 ), [ 7.0, 13.0 ] );
    check( 'medial canthus (mm)', at( 180 ), [ 7.0, 13.0 ] );
    check( 'the fissure is wider than it is tall', at( 0 ) / at( 90 ), [ 1.6, 5.0 ] );

    // 🚩 THE OTHER WAY. With no lash mesh the aperture must announce itself as a guess rather than
    // silently returning a plausible circle — a sheet built on an invented aperture looks exactly
    // like a sheet built on a measured one until someone changes the asset.
    const guessed = measureAperture( null, measurement.geometry.left );
    check( 'no lash mesh reports itself as a fallback', guessed.measured ? 0 : 1, [ 1, 1 ], guessed.source );
    check( 'the fallback is a circle', Math.max( ...guessed.radii ) - Math.min( ...guessed.radii ), [ 0, 1e-9 ] );

}

// --- helpers -----------------------------------------------------------------------------------

async function loadScene( file ) {

    const bytes = fs.readFileSync( file );
    const buffer = bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength );

    return new Promise( ( resolve, reject ) => {

        new GLTFLoader().parse( buffer, '', ( gltf ) => resolve( gltf.scene ), reject );

    } );

}

function luminance( colour ) {

    return 0.2126 * colour[ 0 ] + 0.7152 * colour[ 1 ] + 0.0722 * colour[ 2 ];

}

function mm( metres ) {

    return ( metres * 1000 ).toFixed( 3 );

}

function dot( a, b ) {

    return a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ] + a[ 2 ] * b[ 2 ];

}

function cross( a, b ) {

    return [
        a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ],
        a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ],
        a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ]
    ];

}

function subtract( a, b ) {

    return [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ], a[ 2 ] - b[ 2 ] ];

}

function scale( v, k ) {

    return [ v[ 0 ] * k, v[ 1 ] * k, v[ 2 ] * k ];

}

function normalise( v ) {

    const length = Math.hypot( ...v );
    return [ v[ 0 ] / length, v[ 1 ] / length, v[ 2 ] / length ];

}

function check( label, measured, [ low, high ], why = '' ) {

    const pass = measured >= low && measured <= high;
    results.push( pass );

    console.log(
        `  ${ pass ? 'PASS' : 'FAIL' }  ${ label.padEnd( 46 ) } ` +
        `${ format( measured ).padStart( 10 ) }   target ${ format( low ) } .. ${ format( high ) }   ${ why }`
    );

}

function format( value ) {

    if ( Number.isInteger( value ) ) return String( value );
    if ( Math.abs( value ) >= 100 ) return value.toFixed( 1 );
    if ( Math.abs( value ) < 1e-4 && value !== 0 ) return value.toExponential( 1 );

    return value.toFixed( 4 );

}

function report() {

    const passed = results.filter( Boolean ).length;

    console.log( `\n${ passed }/${ results.length } gates passed\n` );

    if ( passed !== results.length ) process.exit( 1 );

}
