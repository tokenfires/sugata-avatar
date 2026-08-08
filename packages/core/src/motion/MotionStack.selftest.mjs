#!/usr/bin/env node
//
// MotionStack.selftest.mjs — proves the stack does what its documentation claims.
//
// Run: node packages/core/src/motion/MotionStack.selftest.mjs
//
// The stack is the thing every motion layer plugs into, so a wrong assumption here is a wrong
// assumption in blink, gaze, breath, sway, gesture and lipsync simultaneously. That makes it worth
// testing against the real asset rather than a mock: the figure GLB is loaded, its 53-joint
// skeleton is driven, and its morphs are read back off the actual seven meshes. The one thing a mock
// would hide is exactly the thing that bites — `jawOpen` exists on the body AND the teeth AND the
// tongue, and "set a morph" has to mean all three.
//
// Three required proofs, from the punch list:
//   (a) two layers writing the same morph sum correctly and clamp;
//   (b) the same seed gives an identical 600-frame trace;
//   (c) the conflict report names both layers.
//
// Everything else here exists because it would otherwise be an untested assumption.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Euler, Quaternion } from 'three';

import { Layer } from './Layer.js';
import { MotionStack, MOTION_ORDER, createMotionTarget } from './MotionStack.js';
import { MotionRandom, CoherentNoise1D, PoissonSchedule } from './Signals.js';

// three's GLTFLoader assumes a browser when it decodes embedded textures. Nothing here looks at a
// pixel, so the two smallest possible stubs get the loader as far as the morph and skin data.
// (Same trick, same reason, as tools/figure-pipeline/verify_glb.mjs.)
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );

const { GLTFLoader } = await import( 'three/examples/jsm/loaders/GLTFLoader.js' );

const HERE = path.dirname( fileURLToPath( import.meta.url ) );
const FIGURE_PATH = path.resolve( HERE, '../../../../assets/figures/figure_g050.glb' );

const checks = [];

function check( name, condition, detail = '' ) {

    checks.push( { name, passed: condition === true, detail } );

}

function checkClose( name, actual, expected, tolerance = 1e-6 ) {

    const difference = Math.abs( actual - expected );
    check( name, difference <= tolerance, `expected ${ expected }, got ${ actual } (delta ${ difference.toExponential( 2 ) })` );

}

// --- test layers ------------------------------------------------------------------------------

/** Writes a fixed value into one morph every frame. The simplest possible contributor. */
class ConstantMorphLayer extends Layer {

    constructor( name, channel, value, order ) {

        super( { name, order, morphChannels: [ channel ] } );
        this.channel = channel;
        this.value = value;

    }

    update() {

        this.contribution.setMorph( this.channel, this.value );
        return this.contribution;

    }

}

/** Draws from its own stream every frame — the layer shape that determinism has to survive. */
class NoisyMorphLayer extends Layer {

    constructor( name, channel, order ) {

        super( { name, order, morphChannels: [ channel ] } );
        this.channel = channel;
        this.noise = null;
        this.phase = 0;

    }

    onBind() {

        this.noise = new CoherentNoise1D( this.random.integer( 0, 1e9 ) );

    }

    update( deltaSeconds, context ) {

        // A drifting phase plus a fresh draw each frame, so both the noise table and the raw
        // stream have to be reproduced for the trace to match.
        this.phase += deltaSeconds * this.random.range( 0.5, 1.5 );

        this.contribution.setMorph( this.channel, this.noise.unitAt( context.time + this.phase ) );

        return this.contribution;

    }

    reset() {

        this.phase = 0;

    }

}

/** Rotates one bone by a fixed euler delta from rest. */
class BoneRotationLayer extends Layer {

    constructor( name, boneName, euler, order ) {

        super( { name, order, boneChannels: [ boneName ] } );
        this.boneName = boneName;
        this.euler = euler;

    }

    update() {

        this.contribution.rotateBoneEuler( this.boneName, this.euler.x, this.euler.y, this.euler.z );
        return this.contribution;

    }

}

/** Offsets one bone by a fixed translation from rest. */
class BoneOffsetLayer extends Layer {

    constructor( name, boneName, offset, order ) {

        super( { name, order, boneChannels: [ boneName ] } );
        this.boneName = boneName;
        this.offset = offset;

    }

    update() {

        this.contribution.offsetBone( this.boneName, this.offset.x, this.offset.y, this.offset.z );
        return this.contribution;

    }

}

// --- figure -----------------------------------------------------------------------------------

async function loadFigure() {

    const bytes = fs.readFileSync( FIGURE_PATH );
    const buffer = bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength );

    const loader = new GLTFLoader();

    return new Promise( ( resolve, reject ) => {

        loader.parse( buffer, '', ( gltf ) => resolve( gltf.scene ), reject );

    } );

}

/** Every mesh in the figure that carries the named morph, as (mesh name, influence index) pairs. */
function findMorphCarriers( root, morphName ) {

    const carriers = [];

    root.traverse( ( object ) => {

        if ( object.morphTargetDictionary === undefined ) return;

        const index = object.morphTargetDictionary[ morphName ];
        if ( index === undefined ) return;

        carriers.push( { mesh: object, index } );

    } );

    return carriers;

}

// --- the tests --------------------------------------------------------------------------------

const figureRoot = await loadFigure();
const target = createMotionTarget( figureRoot );
const pristinePose = capturePose( figureRoot );

check( 'figure loads and exposes morphs', target.morphNames.length >= 89, `${ target.morphNames.length } distinct morph names` );
check( 'figure exposes the skeleton', target.getBone( 'neck_01' ) !== null && target.getBone( 'spine_02' ) !== null );

// --- (a) two layers on one morph sum, and clamp ------------------------------------------------

{
    const stack = new MotionStack( { seed: 1 } );
    stack.bind( target );

    const emotion = stack.add( new ConstantMorphLayer( 'emotion', 'eyeBlinkLeft', 0.3, MOTION_ORDER.EXPRESSION ) );
    const blink = stack.add( new ConstantMorphLayer( 'blink', 'eyeBlinkLeft', 0.45, MOTION_ORDER.BLINK ) );

    const carriers = findMorphCarriers( figureRoot, 'eyeBlinkLeft' );

    stack.update( 1 / 60 );
    checkClose( 'two layers sum: 0.3 + 0.45 = 0.75', carriers[ 0 ].mesh.morphTargetInfluences[ carriers[ 0 ].index ], 0.75 );

    // Push the sum past 1 and confirm the clamp lands at the commit, not inside a layer.
    blink.value = 0.9;
    stack.update( 1 / 60 );
    checkClose( 'sum 1.20 clamps to 1', carriers[ 0 ].mesh.morphTargetInfluences[ carriers[ 0 ].index ], 1 );

    // The clamp must not be silent. This is the number that says "signal was thrown away".
    const clamped = stack.conflictReport().channels.find( ( channel ) => channel.channel === 'eyeBlinkLeft' );
    checkClose( 'clamped overflow is recorded, not swallowed', clamped.clampLossMax, 0.2, 1e-6 );

    // Negative sums clamp at the bottom of the range too.
    emotion.value = -1.5;
    stack.update( 1 / 60 );
    checkClose( 'negative sum clamps to 0', carriers[ 0 ].mesh.morphTargetInfluences[ carriers[ 0 ].index ], 0 );

    // Layer weight scales a morph contribution before it is summed.
    emotion.value = 0.5;
    emotion.weight = 0.4;
    blink.value = 0;
    stack.update( 1 / 60 );
    checkClose( 'layer weight scales the contribution', carriers[ 0 ].mesh.morphTargetInfluences[ carriers[ 0 ].index ], 0.2 );

    // A disabled layer must let go of its channel, not freeze it where it was.
    emotion.enabled = false;
    stack.update( 1 / 60 );
    checkClose( 'a disabled layer releases its channel to rest', carriers[ 0 ].mesh.morphTargetInfluences[ carriers[ 0 ].index ], 0 );
}

// --- the six-mesh morph spread -----------------------------------------------------------------

{
    const stack = new MotionStack( { seed: 1 } );
    stack.bind( target );
    stack.add( new ConstantMorphLayer( 'viseme', 'jawOpen', 0.5, MOTION_ORDER.VISEME ) );

    const carriers = findMorphCarriers( figureRoot, 'jawOpen' );

    stack.update( 1 / 60 );

    const allSet = carriers.every( ( carrier ) => Math.abs( carrier.mesh.morphTargetInfluences[ carrier.index ] - 0.5 ) < 1e-9 );

    check(
        'a morph is written to every mesh that carries it',
        carriers.length >= 3 && allSet,
        `jawOpen lives on ${ carriers.length } meshes: ${ carriers.map( ( carrier ) => carrier.mesh.name ).join( ', ' ) }`
    );
}

// --- bone composition against the rest pose ----------------------------------------------------

{
    restorePose( pristinePose );

    const stack = new MotionStack( { seed: 1 } );
    stack.bind( target );

    const neck = target.getBone( 'neck_01' );
    const restQuaternion = neck.quaternion.clone();

    const breath = stack.add( new BoneRotationLayer( 'breath', 'neck_01', new Euler( degrees( 10 ), 0, 0 ), MOTION_ORDER.BREATH ) );
    const sway = stack.add( new BoneRotationLayer( 'sway', 'neck_01', new Euler( degrees( 15 ), 0, 0 ), MOTION_ORDER.SWAY ) );

    stack.update( 1 / 60 );

    // Two rotations about the same axis compose to their sum, measured from the rest pose.
    checkClose( 'coaxial bone deltas compose additively from rest', angleBetweenDegrees( restQuaternion, neck.quaternion ), 25, 1e-4 );

    // Bone weight scales the delta by slerping it back toward identity.
    sway.weight = 0.5;
    stack.update( 1 / 60 );
    checkClose( 'bone weight slerps the delta from identity', angleBetweenDegrees( restQuaternion, neck.quaternion ), 17.5, 1e-4 );

    // Order matters for bones and must follow MOTION_ORDER, not insertion order.
    sway.weight = 1;
    breath.euler.set( degrees( 40 ), 0, 0 );
    sway.euler.set( 0, degrees( 40 ), 0 );

    stack.update( 1 / 60 );
    const breathFirst = neck.quaternion.clone();

    sway.order = MOTION_ORDER.BREATH - 50; // sway now runs first
    stack.layers.sort( ( a, b ) => a.order - b.order );
    stack.update( 1 / 60 );

    check(
        'bone composition follows layer order (rotations do not commute)',
        angleBetweenDegrees( breathFirst, neck.quaternion ) > 1,
        `reordering moved the neck by ${ angleBetweenDegrees( breathFirst, neck.quaternion ).toFixed( 2 ) } degrees`
    );

    // Both layers off: the bone must return exactly to rest, not drift.
    breath.enabled = false;
    sway.enabled = false;
    stack.update( 1 / 60 );
    checkClose( 'bones return exactly to rest when nothing writes them', angleBetweenDegrees( restQuaternion, neck.quaternion ), 0, 1e-9 );
}

// --- bone translation offsets ------------------------------------------------------------------

{
    restorePose( pristinePose );

    const stack = new MotionStack( { seed: 1 } );
    stack.bind( target );

    const spine = target.getBone( 'spine_02' );
    const restPosition = spine.position.clone();

    stack.add( new BoneOffsetLayer( 'breath', 'spine_02', { x: 0, y: 0, z: 0.003 }, MOTION_ORDER.BREATH ) );
    stack.add( new BoneOffsetLayer( 'sway', 'spine_02', { x: 0.005, y: 0, z: 0 }, MOTION_ORDER.SWAY ) );

    stack.update( 1 / 60 );

    checkClose( 'bone offsets add on x', spine.position.x - restPosition.x, 0.005, 1e-9 );
    checkClose( 'bone offsets add on z', spine.position.z - restPosition.z, 0.003, 1e-9 );
}

// --- (b) the same seed gives an identical 600-frame trace ---------------------------------------

{
    const traceA = runTrace( 20260807, 600 );
    const traceB = runTrace( 20260807, 600 );
    const traceC = runTrace( 20260808, 600 );

    check( 'the trace is 600 frames long', traceA.frames === 600, `${ traceA.frames } frames` );
    check( 'the same seed reproduces the trace exactly', traceA.checksum === traceB.checksum, `${ traceA.checksum } vs ${ traceB.checksum }` );
    check( 'a different seed produces a different trace', traceA.checksum !== traceC.checksum, `${ traceA.checksum } vs ${ traceC.checksum }` );

    // reset() must rewind the streams, or a second critic run in the same process diverges.
    const stack = buildTraceStack( 20260807 );
    const first = collectTrace( stack, 600 );
    stack.reset();
    const second = collectTrace( stack, 600 );
    check( 'reset() rewinds every layer stream', first === second, `${ first } vs ${ second }` );
}

// --- per-layer stream independence --------------------------------------------------------------

{
    // Adding a layer must not perturb the layers that were already there. If layers shared one
    // stream, introducing blink would silently change every gaze draw after it and no critic run
    // would be comparable to the one before it.
    const withoutBlink = new MotionStack( { seed: 4242 } );
    withoutBlink.bind( target );
    withoutBlink.add( new NoisyMorphLayer( 'gaze', 'eyeLookInLeft', MOTION_ORDER.GAZE ) );

    const withBlink = new MotionStack( { seed: 4242 } );
    withBlink.bind( target );
    withBlink.add( new NoisyMorphLayer( 'blink', 'eyeBlinkLeft', MOTION_ORDER.BLINK ) );
    withBlink.add( new NoisyMorphLayer( 'gaze', 'eyeLookInLeft', MOTION_ORDER.GAZE ) );

    let identical = true;

    for ( let frame = 0; frame < 200; frame ++ ) {

        const dt = 1 / 60;
        withoutBlink.update( dt );
        withBlink.update( dt );

        const a = withoutBlink.morphChannels.get( 'eyeLookInLeft' ).committed;
        const b = withBlink.morphChannels.get( 'eyeLookInLeft' ).committed;

        if ( a !== b ) { identical = false; break; }

    }

    check( 'adding a layer does not perturb the other layers\' streams', identical );
}

// --- (c) the conflict report names both layers ---------------------------------------------------

{
    restorePose( pristinePose );

    const stack = new MotionStack( { seed: 7 } );
    stack.bind( target );

    stack.add( new ConstantMorphLayer( 'emotion', 'mouthSmileLeft', 0.7, MOTION_ORDER.EXPRESSION ) );
    stack.add( new ConstantMorphLayer( 'lipsync', 'mouthSmileLeft', 0.6, MOTION_ORDER.VISEME ) );
    stack.add( new ConstantMorphLayer( 'breath', 'jawOpen', 0.2, MOTION_ORDER.BREATH ) );
    stack.add( new BoneRotationLayer( 'sway', 'spine_01', new Euler( 0, degrees( 3 ), 0 ), MOTION_ORDER.SWAY ) );
    stack.add( new BoneRotationLayer( 'posture', 'spine_01', new Euler( degrees( 2 ), 0, 0 ), MOTION_ORDER.POSTURE ) );

    for ( let frame = 0; frame < 120; frame ++ ) stack.update( 1 / 60 );

    const report = stack.conflictReport();
    const smile = report.channels.find( ( channel ) => channel.channel === 'mouthSmileLeft' );
    const smileWriters = smile.writers.map( ( writer ) => writer.layer ).sort();

    check( 'the conflict report names both writers of the contested morph', smileWriters.join( ',' ) === 'emotion,lipsync', smileWriters.join( ',' ) );
    check( 'the contested morph is flagged as clamping', smile.severity === 'clamping', smile.severity );
    checkClose( 'the report states how much signal the clamp discarded', smile.clampLossMean, 0.3, 1e-6 );
    check( 'the report counts the frames the conflict occurred on', smile.contestedFrames === 120, `${ smile.contestedFrames } of 120` );

    const spine = report.channels.find( ( channel ) => channel.channel === 'spine_01' );
    const spineWriters = spine.writers.map( ( writer ) => writer.layer ).sort();

    check( 'the report names both writers of a contested bone', spineWriters.join( ',' ) === 'posture,sway', spineWriters.join( ',' ) );
    check( 'a bone conflict that cannot clamp is flagged overlapping, not clamping', spine.severity === 'overlapping', spine.severity );

    const jaw = report.channels.find( ( channel ) => channel.channel === 'jawOpen' );
    check( 'an uncontested channel is flagged single', jaw.severity === 'single', jaw.severity );

    check( 'the clamping conflict sorts above the benign one', report.channels[ 0 ].channel === 'mouthSmileLeft', report.channels[ 0 ].channel );

    // The live per-frame view, for a HUD.
    const live = stack.conflicts;
    check( 'the live conflict view reports this frame\'s writers and values',
        live.some( ( conflict ) => conflict.channel === 'mouthSmileLeft' && conflict.writers.length === 2 && Math.abs( conflict.sum - 1.3 ) < 1e-9 ) );

    const description = stack.describeConflicts();
    check( 'describeConflicts() renders both layer names into the text block',
        description.includes( 'emotion' ) && description.includes( 'lipsync' ) && description.includes( 'mouthSmileLeft' ) );

    process.stdout.write( `\n${ description }\n\n` );
}

// --- declaration is enforced ---------------------------------------------------------------------

{
    class SloppyLayer extends Layer {

        constructor() { super( { name: 'sloppy', morphChannels: [ 'jawOpen' ] } ); }

        update() {

            this.contribution.setMorph( 'mouthPucker', 1 ); // never declared
            return this.contribution;

        }

    }

    const stack = new MotionStack( { seed: 1 } );
    stack.bind( target );
    stack.add( new SloppyLayer() );

    let message = '';
    try { stack.update( 1 / 60 ); } catch ( error ) { message = error.message; }

    check( 'writing an undeclared channel throws and names the layer and the channel',
        message.includes( 'sloppy' ) && message.includes( 'mouthPucker' ) && message.includes( 'morphChannels' ),
        message );
}

// --- a mistyped channel is reported, not silently ignored -----------------------------------------

{
    const stack = new MotionStack( { seed: 1 } );
    stack.bind( target );
    stack.add( new ConstantMorphLayer( 'typo', 'eyeBlinkleft', 1, MOTION_ORDER.BLINK ) ); // lowercase l
    stack.add( new BoneRotationLayer( 'ghost', 'spine_09', new Euler( 0, 0, 0 ), MOTION_ORDER.SWAY ) );

    stack.update( 1 / 60 );

    const missing = stack.missingChannels;

    check( 'a morph the figure does not have is reported as missing',
        missing.some( ( entry ) => entry.channel === 'eyeBlinkleft' && entry.layers.includes( 'typo' ) ) );
    check( 'a bone the figure does not have is reported as missing',
        missing.some( ( entry ) => entry.channel === 'spine_09' && entry.layers.includes( 'ghost' ) ) );
    check( 'describeConflicts() surfaces missing channels', stack.describeConflicts().includes( 'MISSING' ) );
}

// --- Signals ---------------------------------------------------------------------------------------

{
    const a = new MotionRandom( 99 );
    const b = new MotionRandom( 99 );

    let same = true;
    for ( let index = 0; index < 1000; index ++ ) if ( a.next() !== b.next() ) same = false;
    check( 'MotionRandom reproduces its stream from a seed', same );

    const forkedOnce = new MotionRandom( 5 ).fork( 'blink' );
    const forkedAfterDraws = new MotionRandom( 5 );
    for ( let index = 0; index < 50; index ++ ) forkedAfterDraws.next();

    check( 'fork() ignores how much the parent has been drawn from',
        forkedOnce.next() === forkedAfterDraws.fork( 'blink' ).next() );
    check( 'fork() gives different labels different streams',
        new MotionRandom( 5 ).fork( 'blink' ).next() !== new MotionRandom( 5 ).fork( 'gaze' ).next() );

    // Exponential sampling: the mean of an exponential is its parameter. 200k samples puts the
    // standard error of the mean at mean/sqrt(n) ~ 0.22% , so 2% is a loose, non-flaky bound.
    const sampler = new MotionRandom( 12345 );
    const meanSeconds = 0.4;
    let total = 0;
    const sampleCount = 200000;
    for ( let index = 0; index < sampleCount; index ++ ) total += sampler.exponential( meanSeconds );
    const observedMean = total / sampleCount;
    check( 'exponential() has the mean it advertises', Math.abs( observedMean - meanSeconds ) / meanSeconds < 0.02,
        `mean ${ observedMean.toFixed( 5 ) } s against ${ meanSeconds } s` );

    check( 'exponential() respects its floor', sampler.exponential( 0.4, { min: 0.15 } ) >= 0.15 );

    // 🎯 THE FORCED-ZERO DRAW. `next()` returns `t / 2^32` and `t` can be exactly 0, so the
    // complement can be exactly 1 and the sample exactly 0 — an exponential is almost surely
    // positive and this one was not. The consequence is not a wrong number, it is a HANG: a
    // `PoissonSchedule` whose `waiting` is 0 hands its caller a step of 0 forever.
    //
    // Forced rather than waited for. 2^-32 per draw is unreachable in a test and inevitable in a
    // long run, which is the whole shape of this defect.
    const zeroFirst = new MotionRandom( 1 );
    let zerosLeft = 1;
    const realNext = zeroFirst.next.bind( zeroFirst );
    zeroFirst.next = () => ( zerosLeft -- > 0 ? 0 : realNext() );

    check( 'exponential() never returns zero, even on a zero draw', zeroFirst.exponential( 1 ) > 0,
        'an exponential is almost surely positive; a zero here hangs every PoissonSchedule caller' );

    // The caller shape verbatim: `Blink.advanceTimeline` and `Sway.advanceAxis` both cut the frame
    // at the arrival, which is what turns a zero wait into a step of zero.
    const spinCount = ( schedule, rate ) => {

        let remaining = 1 / 30;
        let iterations = 0;

        while ( remaining > 0 && iterations < 1e6 ) {

            const step = Math.min( remaining, schedule.secondsUntilArrival( rate ) );
            schedule.advance( rate, step );
            remaining -= step;
            iterations ++;

        }

        return iterations;

    };

    zerosLeft = 1;
    const zeroDrawnAtConstruction = new PoissonSchedule( zeroFirst );

    check( 'a schedule built on a zero draw still advances a frame',
        spinCount( zeroDrawnAtConstruction, 0.02 ) < 10,
        `${ spinCount( new PoissonSchedule( new MotionRandom( 7 ) ), 0.02 ) } iterations for a normal draw` );

    zerosLeft = 1;
    const zeroDrawnAtReset = new PoissonSchedule( new MotionRandom( 7 ) );
    zeroDrawnAtReset.random = zeroFirst;
    zeroDrawnAtReset.reset();

    check( 'and so does one that drew a zero on reset()', spinCount( zeroDrawnAtReset, 0.02 ) < 10 );

    // §1.1 — the known-bad direction. `waiting = 0` IS the pre-fix state, so the gate is proven
    // against the defect itself rather than against a model of it. 1e6 is the spin cap above.
    const hung = new PoissonSchedule( new MotionRandom( 7 ) );
    hung.waiting = 0;

    check( 'the gate REJECTS a schedule parked at zero wait', spinCount( hung, 0.02 ) === 1e6,
        'the state the constructor could reach before the fix: 1e6 iterations for one 1/30 s frame, ' +
        'with `remaining` never decreasing' );

    // Poisson event timing: at 20 blinks/min over 30 simulated minutes, expect ~600 events.
    // sqrt(600) ~ 24.5, so +/-12% is about 3 sigma.
    const blinkRandom = new MotionRandom( 555 );
    const blinksPerSecond = 20 / 60;
    let events = 0;
    const frames = 30 * 60 * 60; // 30 minutes at 60 fps
    for ( let frame = 0; frame < frames; frame ++ ) {

        if ( blinkRandom.poissonEventOccurs( blinksPerSecond, 1 / 60 ) ) events ++;

    }
    check( 'poissonEventOccurs() fires at the rate it is given', Math.abs( events - 600 ) / 600 < 0.12,
        `${ events } events in 30 simulated minutes, expected ~600` );

    // The noise range claim in the Signals docstring is measured here rather than assumed.
    const noise = new CoherentNoise1D( 2026 );
    let minimum = Infinity;
    let maximum = -Infinity;
    for ( let index = 0; index < 400000; index ++ ) {

        const value = noise.at( index * 0.017 );
        if ( value < minimum ) minimum = value;
        if ( value > maximum ) maximum = value;

    }
    check( 'CoherentNoise1D stays inside [-1, 1]', minimum >= -1 && maximum <= 1,
        `measured range [${ minimum.toFixed( 3 ) }, ${ maximum.toFixed( 3 ) }]` );

    check( 'CoherentNoise1D is continuous across a lattice boundary',
        Math.abs( noise.at( 8 - 1e-7 ) - noise.at( 8 + 1e-7 ) ) < 1e-5 );

    check( 'CoherentNoise1D reproduces from a seed',
        new CoherentNoise1D( 77 ).at( 3.14159 ) === new CoherentNoise1D( 77 ).at( 3.14159 ) );
}

// --- trace helpers ----------------------------------------------------------------------------------

function buildTraceStack( seed ) {

    // Every trace has to start from the same pose, or two stacks with the same seed capture
    // different rest quaternions and diverge for a reason that has nothing to do with the seed.
    restorePose( pristinePose );

    const stack = new MotionStack( { seed } );
    stack.bind( target );

    stack.add( new NoisyMorphLayer( 'blink', 'eyeBlinkLeft', MOTION_ORDER.BLINK ) );
    stack.add( new NoisyMorphLayer( 'emotion', 'eyeBlinkLeft', MOTION_ORDER.EXPRESSION ) );
    stack.add( new NoisyMorphLayer( 'viseme', 'jawOpen', MOTION_ORDER.VISEME ) );
    stack.add( new BoneRotationLayer( 'sway', 'spine_01', new Euler( 0, degrees( 4 ), 0 ), MOTION_ORDER.SWAY ) );

    return stack;

}

/**
 * Runs the stack for `frameCount` frames on a varying but fixed dt sequence, and folds every
 * committed value into one checksum. Varying dt matters: a fixed 1/60 would hide any place the
 * stack accidentally depends on frame count rather than elapsed time.
 */
function collectTrace( stack, frameCount ) {

    let checksum = 0x811c9dc5;

    for ( let frame = 0; frame < frameCount; frame ++ ) {

        const deltaSeconds = 1 / 60 + ( frame % 7 ) * 0.0007;
        stack.update( deltaSeconds );

        for ( const channel of stack.morphChannels.values() ) {

            checksum = foldIntoChecksum( checksum, channel.committed );

        }

        for ( const channel of stack.boneChannels.values() ) {

            if ( channel.bone === null ) continue;

            checksum = foldIntoChecksum( checksum, channel.bone.quaternion.x );
            checksum = foldIntoChecksum( checksum, channel.bone.quaternion.y );
            checksum = foldIntoChecksum( checksum, channel.bone.quaternion.z );
            checksum = foldIntoChecksum( checksum, channel.bone.quaternion.w );

        }

    }

    return ( checksum >>> 0 ).toString( 16 );

}

function runTrace( seed, frameCount ) {

    const stack = buildTraceStack( seed );

    return { checksum: collectTrace( stack, frameCount ), frames: stack.frame };

}

function foldIntoChecksum( checksum, value ) {

    // Rounded to 1e-9 so the checksum compares numbers, not float print artefacts, while still
    // being far finer than any difference a real divergence would produce.
    const text = value.toFixed( 9 );

    for ( let index = 0; index < text.length; index ++ ) {

        checksum ^= text.charCodeAt( index );
        checksum = Math.imul( checksum, 0x01000193 );

    }

    return checksum;

}

function degrees( value ) {

    return value * ( Math.PI / 180 );

}

/**
 * The angle between two rotations, in degrees.
 *
 * MEASURED GOTCHA, and it is not academic: the figure GLB stores bone rotations as float32, so
 * `neck_01`'s rest quaternion has a length of 0.9999999965 — off unit by 7e-9. `Quaternion.invert()`
 * is `conjugate()` and assumes unit length, and `acos` near 1 amplifies that 7e-9 into 0.013
 * degrees of phantom error. Both clones are normalised first for that reason. Any motion layer
 * that measures an angle against a rest pose read from the GLB has to do the same.
 */
function angleBetweenDegrees( a, b ) {

    const from = a.clone().normalize();
    const to = b.clone().normalize();

    return 2 * Math.acos( Math.min( Math.abs( from.dot( to ) ), 1 ) ) * ( 180 / Math.PI );

}

/**
 * The figure is loaded once and shared by every block below, so each block that moves bones has
 * to hand the pose back the way it found it. Without this, a stack that binds after another test
 * has run captures a *rotated* pose as its rest, and the determinism trace fails for a reason
 * that has nothing to do with determinism.
 */
function capturePose( root ) {

    const pose = [];

    root.traverse( ( object ) => {

        pose.push( { object, quaternion: object.quaternion.clone(), position: object.position.clone() } );

    } );

    return pose;

}

function restorePose( pose ) {

    for ( const entry of pose ) {

        entry.object.quaternion.copy( entry.quaternion );
        entry.object.position.copy( entry.position );

    }

}

// Keeps the Quaternion import honest for readers scanning the header.
void Quaternion;

// --- results ------------------------------------------------------------------------------------

let failed = 0;

for ( const result of checks ) {

    const status = result.passed ? 'PASS' : 'FAIL';
    if ( result.passed === false ) failed ++;

    process.stdout.write( `${ status }  ${ result.name }${ result.detail ? `\n        ${ result.detail }` : '' }\n` );

}

process.stdout.write( `\n${ checks.length - failed } passed, ${ failed } failed\n` );
process.exit( failed === 0 ? 0 : 1 );
