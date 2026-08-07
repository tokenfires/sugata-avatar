/**
 * Gate for `figure/BodyMass.js` — is the centre of mass in the right place?
 *
 * This class exists to convert force-plate literature into animation, so everything downstream
 * of it inherits its errors silently. A centre of mass in the wrong place produces a perfectly
 * smooth, perfectly plausible weight shift of the wrong size, and nothing about the output says
 * so. `docs/LEARNINGS.md` §1.1 — a gate that has never failed is not known to work — so this
 * file is built around checks that are known to fail on known-bad input:
 *
 *   ANALYTIC ORACLE   A synthetic rig whose centre of mass can be worked out on paper. The
 *                     expected answer is derived from the segment table by hand, not read off
 *                     the implementation, so an implementation bug cannot agree with it.
 *
 *   ANATOMY           The real figure's centre of mass against Winter's INDEPENDENT whole-body
 *                     figure of 0.553 of stature. Independent is the point: it is not derived
 *                     from the segment table, so mis-resolved landmarks are caught by anatomy
 *                     rather than by our own previous output.
 *
 *   THE OTHER WAY     The trunk deliberately mis-resolved to a chest bone — the exact mistake
 *                     the class's header warns about — and the anatomy check must FAIL and say
 *                     by how much. A check that only ever runs on correct input proves nothing.
 *
 *   RENORMALISATION   A rig with no toes. The lost mass must be redistributed rather than
 *                     quietly pulling the centre of mass toward the origin.
 *
 * A measurement outside its range is printed as FAIL and the process exits non-zero. It is not
 * grounds for widening the range.
 *
 * Usage:  node "packages/core/src/figure/bodymass.selftest.mjs"
 *         node "packages/core/src/figure/bodymass.selftest.mjs" assets/figures/figure_g100.glb
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// three's GLTFLoader assumes a browser when it decodes embedded textures. Nothing here inspects
// pixels, so two stubs get the loader to the skinning data.
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );

const { Box3, Object3D, Vector3 } = await import( 'three' );
const { Figure } = await import( './Figure.js' );
const { BodyMass, WHOLE_BODY_COM_FRACTION_OF_STATURE } = await import( './BodyMass.js' );
const { HUMANOID_TO_FIGURE_BONE, Skeleton } = await import( './Skeleton.js' );
const { RestPose } = await import( './RestPose.js' );

/**
 * How far the computed centre of mass may sit from Winter's 0.553 of stature.
 *
 * 🎯 THE POSE THIS IS MEASURED IN IS PART OF THE GATE. Winter's figure is a standing adult with
 * the arms down. The GLB's bind pose holds the arms 41.8 degrees out from vertical, which lifts a
 * tenth of the body's mass and reads 0.5745 — 0.022 high, and enough slack that a mis-resolved
 * trunk landmark hides inside the tolerance. Measured in `relaxed-standing`, the posture the
 * motion stack actually runs in, it lands much closer, and the band can close to a quarter of
 * what the bind pose would need.
 *
 * 🚩 This check CANNOT catch a mis-resolved trunk on its own, and `measureMisresolvedTrunk` says
 * so out loud rather than tuning the number until it appears to. The wrong landmark moves the
 * centre of mass from 0.015 above Winter's figure to 0.021 below it, so any tolerance admitting
 * the right answer admits the wrong one. The trunk-span check is what catches that.
 */
const STATURE_FRACTION_TOLERANCE = 0.03;

/**
 * How far the measured trunk span may sit from Winter's 0.288 of stature (shoulder joint at
 * 0.818, hip joint at 0.530). Our figure reads 0.269 — within 7% — and the chest-bone mistake
 * reads 0.133, which is outside by a factor of two. A third of the expected value sits between
 * them with a wide margin on both sides and is anchored to the anatomy rather than to what
 * happens to pass.
 */
const TRUNK_SPAN_TOLERANCE = 0.096;

/** A symmetric figure's centre of mass must sit on the midline. Millimetres. */
const MIDLINE_TOLERANCE_MM = 1.0;

const results = [];
const ZERO = new Vector3();

// --- the figure -------------------------------------------------------------------------------

const here = path.dirname( fileURLToPath( import.meta.url ) );
const repoRoot = path.resolve( here, '../../../..' );
const figurePath = process.argv[ 2 ]
    ? path.resolve( process.cwd(), process.argv[ 2 ] )
    : path.join( repoRoot, 'assets/figures/figure_g050.glb' );

const bytes = fs.readFileSync( figurePath );
const figure = await Figure.parse( bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength ) );

figure.root.updateMatrixWorld( true );

const bounds = new Box3().setFromObject( figure.root );
const stature = bounds.max.y - bounds.min.y;

const bindPoseMass = new BodyMass().bind( { getBone: ( name ) => figure.root.getObjectByName( name ) ?? null } );
const bindPoseFraction = bindPoseMass.selfCheckFractionOfStature( stature ).fraction;
const bindPoseMidlineMm = bindPoseMass.centreOfMass( new Vector3() ).x * 1000;

// Everything below is measured in the posture the motion stack runs in, not in the bind pose.
// See STATURE_FRACTION_TOLERANCE — which pose this is measured in is part of the gate.
const skeleton = new Skeleton( figure.root );
const absent = RestPose.load( 'relaxed-standing' ).applyTo( skeleton );

if ( absent.length > 0 ) console.warn( `relaxed-standing: this figure has no ${ absent.join( ', ' ) }` );

skeleton.update();
figure.root.updateMatrixWorld( true );

/** The `getBone` surface `BodyMass.bind` wants, over the loaded rig. */
const target = { getBone: ( name ) => figure.root.getObjectByName( name ) ?? null };

console.log( `\nfigure: ${ path.relative( repoRoot, figurePath ) }` );
console.log( `stature: ${ stature.toFixed( 4 ) } m (bounding box, floor to vertex)\n` );

measureAnalyticOracle();
measureRealFigure();
measureMisresolvedTrunk();
measureRenormalisation();

report();

// ==============================================================================================

/**
 * A rig built so the answer is known on paper.
 *
 * Every landmark is placed at a round coordinate and the expected centre of mass is worked out
 * from the segment table's own published fractions, written out below as arithmetic a reader can
 * follow. If the implementation and this disagree, one of them is wrong and it is visible which.
 */
function measureAnalyticOracle() {

    section( 'ANALYTIC ORACLE — a synthetic rig whose centre of mass is known on paper' );

    // Every humanoid landmark at the origin except the head, which sits one metre up. With all
    // mass but the head-and-neck segment collapsed to a point at the origin, the centre of mass
    // must land at exactly the head-and-neck mass fraction times its own centre-of-mass fraction,
    // times one metre: 0.081 x 1.40 x 1 m = 0.1134 m. Nothing else can contribute.
    const flat = syntheticRig( { head: new Vector3( 0, 1, 0 ) } );
    const flatMass = new BodyMass().bind( flat );
    const flatCom = flatMass.centreOfMass( new Vector3() );

    check( 'oracle: synthetic mass accounted', flatMass.massAccountedFor, [ 0.9999, 1.0001 ],
        'every segment resolves on a complete synthetic rig' );

    check( 'oracle: COM height (mm)', flatCom.y * 1000, [ 113.3, 113.5 ],
        '0.081 head mass x 1.40 COM fraction x 1000 mm = 113.4' );

    check( 'oracle: COM lateral (mm)', flatCom.x * 1000, [ -0.001, 0.001 ],
        'nothing is off the midline' );

    // Now move only the left hand out to x = +1 m. The hand is 0.006 of body mass with its centre
    // of mass 0.506 of the way from the wrist to the middle finger; both of those are at x = +1
    // here, so the whole hand segment's centre of mass is at x = +1 and it contributes
    // 0.006 x 1 m = 6.0 mm. The forearm's distal landmark is the wrist, so it contributes
    // 0.016 x 0.430 x 1 m = 6.88 mm as well. Total 12.88 mm.
    const reached = syntheticRig( {
        head: new Vector3( 0, 1, 0 ),
        hand_l: new Vector3( 1, 0, 0 ),
        middle_02_l: new Vector3( 1, 0, 0 )
    } );

    const reachedCom = new BodyMass().bind( reached ).centreOfMass( new Vector3() );

    check( 'oracle: one arm out, COM lateral (mm)', reachedCom.x * 1000, [ 12.8, 12.96 ],
        'hand 0.006 x 1 m + forearm 0.016 x 0.430 x 1 m = 12.88 mm' );

}

function measureRealFigure() {

    section( 'ANATOMY — the real rig against Winter\'s independent whole-body figure' );

    const bodyMass = new BodyMass().bind( target );
    const com = bodyMass.centreOfMass( new Vector3() );
    const selfCheck = bodyMass.selfCheckFractionOfStature( stature );

    note( 'segments resolved', `${ bodyMass.segments.length } of 15` );
    note( 'segments missing', bodyMass.missingSegments.length === 0 ? '(none)' : bodyMass.missingSegments.join( ', ' ) );
    note( 'centre of mass (m)', `x=${ com.x.toFixed( 4 ) }  y=${ com.y.toFixed( 4 ) }  z=${ com.z.toFixed( 4 ) }` );
    note( 'bind pose, for comparison', `${ bindPoseFraction.toFixed( 4 ) } of stature — arms 41.8 deg out lift it` );

    check( 'mass accounted for', bodyMass.massAccountedFor, [ 0.9999, 1.0001 ],
        'Winter\'s fractions sum to 1; a shortfall means a landmark did not resolve' );

    check( 'COM as fraction of stature', selfCheck.fraction,
        [ WHOLE_BODY_COM_FRACTION_OF_STATURE - STATURE_FRACTION_TOLERANCE,
            WHOLE_BODY_COM_FRACTION_OF_STATURE + STATURE_FRACTION_TOLERANCE ],
        'Winter 0.553, measured in relaxed-standing' );

    // Symmetry is a property of the RIG, so it is asserted on the bind pose. `relaxed-standing`
    // is deliberately asymmetric — the two upper arms differ by a couple of degrees — and reads
    // about a millimetre off the midline, which is the pose being right rather than wrong.
    check( 'COM off the midline, bind pose (mm)', Math.abs( bindPoseMidlineMm ), [ 0, MIDLINE_TOLERANCE_MM ],
        'the figure is laterally symmetric, so the centre of mass must be too' );

    note( 'COM off the midline, relaxed-standing (mm)', ( com.x * 1000 ).toFixed( 3 ) );

    const span = bodyMass.selfCheckTrunkSpan( stature );

    check( 'trunk span as fraction of stature', span.fraction,
        [ span.expected - TRUNK_SPAN_TOLERANCE, span.expected + TRUNK_SPAN_TOLERANCE ],
        'Winter: shoulder 0.818 less hip 0.530 = 0.288 of stature' );

    check( 'COM sits between hips and shoulders (m)', com.y,
        [ heightOf( 'pelvis' ), heightOf( 'upperarm_l' ) ],
        'a standing body\'s centre of mass is above the hip joint and below the shoulder' );

}

/**
 * 🎯 THE CHECK RUN THE OTHER WAY.
 *
 * `BodyMass.js`'s header warns that substituting a chest bone for the shoulder joint drops the
 * whole-body centre of mass by about 5 cm. So do exactly that, and require the anatomy check to
 * notice. If this passes, the anatomy check above is decorative.
 */
function measureMisresolvedTrunk() {

    section( 'THE OTHER WAY — the trunk deliberately mis-resolved, which must FAIL the check' );

    const wrong = new BodyMass( { bones: { leftUpperArm: 'spine_03', rightUpperArm: 'spine_03' } } );

    wrong.bind( target );

    const selfCheck = wrong.selfCheckFractionOfStature( stature );
    const good = new BodyMass().bind( target ).selfCheckFractionOfStature( stature );

    note( 'correct landmarks, fraction of stature', good.fraction.toFixed( 4 ) );
    note( 'trunk to spine_03, fraction of stature', selfCheck.fraction.toFixed( 4 ) );
    note( 'centre of mass moved (mm)', ( ( good.fraction - selfCheck.fraction ) * stature * 1000 ).toFixed( 1 ) );

    const span = wrong.selfCheckTrunkSpan( stature );
    const goodSpan = new BodyMass().bind( target ).selfCheckTrunkSpan( stature );

    note( 'correct landmarks, trunk span', `${ goodSpan.fraction.toFixed( 4 ) } of stature` );
    note( 'trunk to spine_03, trunk span', `${ span.fraction.toFixed( 4 ) } of stature` );

    const statureCheckCatchesIt = Math.abs( selfCheck.deviation ) > STATURE_FRACTION_TOLERANCE;
    const spanCheckCatchesIt = Math.abs( span.fraction - span.expected ) > TRUNK_SPAN_TOLERANCE;

    // Stated as a gate rather than as prose so it cannot quietly stop being true. The whole-body
    // check is NOT expected to catch this, and pretending otherwise is how a decorative gate is
    // born; the span check is the one that must.
    check( 'stature check alone does NOT catch it', statureCheckCatchesIt ? 1 : 0, [ 0, 0 ],
        'recorded, not tolerated: a 60 mm error that lands on the far side of Winter\'s figure' );

    check( 'trunk span check REJECTS it', spanCheckCatchesIt ? 1 : 0, [ 1, 1 ],
        '1 means the landmark check caught it; 0 means it is decorative' );

    check( 'and by a real margin (x the tolerance)',
        Math.abs( span.fraction - span.expected ) / TRUNK_SPAN_TOLERANCE, [ 1.4, 100 ],
        'the error must be large enough that the tolerance is not what decided it' );

}

/**
 * A rig with no toes loses 2.9% of body mass. Renormalising is the right behaviour; NOT
 * renormalising drags the centre of mass 2.9% toward the origin, which on a 1.66 m figure is
 * 27 mm of silent bias — the same order as the weight shift this whole model exists to produce.
 */
function measureRenormalisation() {

    section( 'RENORMALISATION — a rig with no toes' );

    const toeless = {
        getBone: ( name ) => ( name === 'ball_l' || name === 'ball_r' ) ? null : target.getBone( name )
    };

    const bodyMass = new BodyMass().bind( toeless );
    const com = bodyMass.centreOfMass( new Vector3() );
    const complete = new BodyMass().bind( target ).centreOfMass( new Vector3() );

    note( 'segments missing', bodyMass.missingSegments.join( ', ' ) );

    check( 'mass accounted for', bodyMass.massAccountedFor, [ 0.9709, 0.9711 ],
        '1.0 less two feet at 0.0145 each' );

    check( 'COM height shift vs complete rig (mm)', ( com.y - complete.y ) * 1000, [ 0, 30 ],
        'losing the feet raises the centre of mass a little; it must not COLLAPSE toward zero' );

    check( 'COM is not dragged toward the origin (mm)',
        complete.y * 1000 - com.y * 1000, [ -30, 0 ],
        'un-renormalised, the loss would drop it by 0.029 x 950 = 27.6 mm' );

}

// --- helpers ------------------------------------------------------------------------------------

/**
 * A rig with every humanoid landmark present, at the origin unless `placed` says otherwise.
 *
 * Built from the humanoid mapping rather than a hand-written list so a bone added to the segment
 * table cannot silently go missing here and turn an oracle into a tautology.
 */
function syntheticRig( placed = {} ) {

    const bones = new Map();

    for ( const figureName of Object.values( HUMANOID_TO_FIGURE_BONE ) ) {

        const bone = new Object3D();

        bone.position.copy( placed[ figureName ] ?? ZERO );
        bone.updateMatrixWorld( true );

        bones.set( figureName, bone );

    }

    return { getBone: ( name ) => bones.get( name ) ?? null };

}

function heightOf( boneName ) {

    const bone = figure.root.getObjectByName( boneName );

    bone.updateWorldMatrix( true, false );

    return bone.matrixWorld.elements[ 13 ];

}

function section( title ) {

    console.log( `\n${ title }` );
    console.log( '-'.repeat( title.length ) );

}

function note( label, value ) {

    console.log( `  ....  ${ label.padEnd( 38 ) } ${ String( value ) }` );

}

function check( label, measured, [ low, high ], why = '' ) {

    const pass = measured >= low && measured <= high;

    results.push( pass );

    console.log(
        `  ${ pass ? 'PASS' : 'FAIL' }  ${ label.padEnd( 38 ) } ` +
        `${ format( measured ).padStart( 9 ) }   target ${ format( low ) } .. ${ format( high ) }   ${ why }`
    );

}

function format( value ) {

    if ( Number.isInteger( value ) ) return String( value );

    return Math.abs( value ) >= 100 ? value.toFixed( 1 ) : value.toFixed( 4 );

}

function report() {

    const passed = results.filter( Boolean ).length;

    console.log( `\n${ passed }/${ results.length } gates passed\n` );

    if ( passed !== results.length ) process.exit( 1 );

}
