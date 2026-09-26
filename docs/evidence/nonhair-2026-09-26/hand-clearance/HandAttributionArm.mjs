/** Disposable CPU/native-capture instrument, not a production motion API or a clearance fix. */
import { MotionStack } from '../../../../packages/core/src/motion/MotionStack.js';
import { MotionContribution } from '../../../../packages/core/src/motion/Layer.js';
import { PostureLayer } from '../../../../packages/core/src/affect/PostureLayer.js';
import { GestureLayer } from '../../../../packages/core/src/motion/Gesture.js';
import { HUMANOID_TO_FIGURE_BONE } from '../../../../packages/core/src/figure/Skeleton.js';

export const REQUIRED_SOURCE_HASHES = Object.freeze( {
    'packages/core/src/motion/MotionStack.js': 'fbbee9c9608d9cf33e59596a147c24a14c270ad2fadb0edee47fd7aeed6ad9c9',
    'packages/core/src/motion/Layer.js': 'e62f85746d87e4e4b7fc24449a2bb1c15e0ff1c0d2a254b4a146f4fab397a5a8',
    'packages/core/src/affect/PostureLayer.js': '9f72fb58dfdb1646934b61e75c6187fe4bfc7c1c642198842c9eb57dbe31470c',
    'packages/core/src/motion/Gesture.js': 'c52205441a5d963579813a68fe1642097df7ba44a1166b66d2b7c4f20e9ac1ea',
    'packages/core/src/figure/Skeleton.js': '375919bb260cd3de2d3f8ab1b1849603f25b2c26da3e83a695bdfedbae30caa4',
    'assets/figures/figure_g050.glb': 'b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14'
} );
const POSTURE_KEYS = [ 'spine', 'head', 'leftUpperArm', 'rightUpperArm', 'hips', 'leftUpperLeg', 'leftLowerLeg', 'rightUpperLeg', 'rightLowerLeg' ];
const GESTURE_KEYS = [ 'leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm' ];
const owners = new WeakMap(), retiredAvatars = new WeakSet();
const same = ( a, b ) => a.length === b.length && a.every( ( item, i ) => item === b[ i ] );
const serial = c => ( { ownerName: c.ownerName, morphs: [ ...c.morphs ],
    rotations: [ ...c.boneRotations ].map( ( [ n, q ] ) => [ n, q.toArray() ] ),
    offsets: [ ...c.boneOffsets ].map( ( [ n, v ] ) => [ n, v.toArray() ] ) } );
const sameDescriptor = ( a, b ) => !!a && !!b && [ 'value', 'get', 'set', 'writable', 'enumerable', 'configurable' ].every( key => a[ key ] === b[ key ] );
const bindingState = ( p, g ) => JSON.stringify( { budget: p.maxAdductionRadians, postureSides: p.armSides, gestureSides: g.armSides,
    postureFrames: [ ...p.restFrames ].map( ( [ name, q ] ) => [ name, q.toArray() ] ),
    gestureFrames: [ ...g.restFrames ].map( ( [ name, q ] ) => [ name, q.toArray() ] ) } );

export class HandAttributionArm {
    constructor( avatar, { arm, sourceHashes } = {} ) {
        if ( ![ 'A', 'B', 'C' ].includes( arm ) ) throw Error( 'Hand study requires arm A, B or C.' );
        for ( const [ path, expected ] of Object.entries( REQUIRED_SOURCE_HASHES ) )
            if ( sourceHashes?.[ path ] !== expected ) throw Error( `Hand study source pin mismatch: ${ path }` );
        const stack = avatar?.stack, posture = avatar?.posture, gesture = avatar?.gesture;
        if ( !avatar || avatar.disposed !== false || avatar.autoStart !== false || !avatar.figure ||
            typeof avatar.dispose !== 'function' || retiredAvatars.has( avatar ) ) throw Error( 'Hand study requires a fresh, live, manually stepped avatar.' );
        if ( !( stack instanceof MotionStack ) || !stack.target || avatar.target !== stack.target ||
            stack.update !== MotionStack.prototype.update || stack.accumulate !== MotionStack.prototype.accumulate ||
            stack.channelsDirty || stack.evaluatingLayer !== null ) throw Error( 'Hand study requires the idle native stack/target and unwrapped frame path.' );
        if ( owners.has( stack ) ) throw Error( 'Hand study already owns this stack.' );
        if ( !( posture instanceof PostureLayer ) || !( gesture instanceof GestureLayer ) ||
            posture.update !== PostureLayer.prototype.update || gesture.update !== GestureLayer.prototype.update )
            throw Error( 'Hand study requires the actual native posture and gesture instances.' );
        for ( const [ layer, name, order, keys ] of [ [ posture, 'affectPosture', 100, POSTURE_KEYS ], [ gesture, 'gesture', 400, GESTURE_KEYS ] ] ) {
            if ( layer.name !== name || layer.order !== order || layer.weight !== 1 || layer.amplitude !== 1 ||
                !same( Object.keys( layer.bones ), keys ) || keys.some( k => layer.bones[ k ] !== HUMANOID_TO_FIGURE_BONE[ k ] ) ||
                !same( layer.boneChannels, keys.map( k => layer.bones[ k ] ) ) || layer.morphChannels.length )
                throw Error( `Hand study native ${ name } configuration/declaration differs.` );
        }
        if ( stack.context.shared.posture !== posture || gesture.yieldToPosture !== true || gesture.sagittalShare !== .75 ||
            gesture.dominanceDrivesAmplitude !== true || Object.values( posture.defects ).some( Boolean ) )
            throw Error( 'Hand study requires unchanged shared posture, gesture prescription and posture defect controls.' );

        Object.assign( this, { avatar, stack, posture, gesture, arm, target: stack.target, status: 'installing', failure: null,
            patches: [], frameActive: false, frameNumber: null, samples: null, completedFrames: 0, cleanup: null } );
        this.nativeDispose = avatar.dispose;
        this.originalUpdate = stack.update;
        this.originalAccumulate = stack.accumulate;
        this.layerArray = stack.layers;
        this.records = stack.layers.map( layer => ( { layer, name: layer.name, order: layer.order, weight: layer.weight, enabled: layer.enabled,
            morphs: layer.morphChannels.slice(), bones: layer.boneChannels.slice(), contribution: layer.contribution,
            update: layer.update, random: layer.random, randomSeed: layer.random?.seed } ) );
        if ( new Set( stack.layers ).size !== stack.layers.length || !stack.layers.includes( posture ) || !stack.layers.includes( gesture ) ||
            this.records.some( r => r.layer.stack !== stack || !Number.isFinite( r.weight ) || typeof r.enabled !== 'boolean' ) )
            throw Error( 'Hand study layer registration/weights are invalid.' );
        this.boneObjects = new Map( [ ...stack.boneChannels.keys() ].map( n => [ n, this.target.getBone( n ) ] ) );
        for ( const name of [ ...posture.boneChannels, ...gesture.boneChannels ] )
            if ( !this.boneObjects.get( name ) ) throw Error( `Hand study missing native bone ${ name }.` );
        this.copy = new MotionContribution( arm === 'B' ? posture.name : gesture.name, [], arm === 'B' ? posture.boneChannels : gesture.boneChannels );
        this.config = JSON.stringify( { postureBones: posture.bones, gestureBones: gesture.bones, postureDefects: posture.defects,
            postureAmplitude: posture.amplitude, knee: posture.kneeFullScaleDegrees, cop: posture.centreOfPressureFullScaleMetres,
            gestureAmplitude: gesture.amplitude, sagittal: gesture.sagittalShare, yield: gesture.yieldToPosture, liveDominance: gesture.dominanceDrivesAmplitude } );
        this.binding = bindingState( posture, gesture );
        owners.set( stack, this );
        try {
            const study = this;
            this.#method( stack, 'update', function ( dt ) {
                study.#assertIntact();
                if ( this !== stack || study.frameActive ) study.#fail( 'Foreign or reentrant frame call.' );
                study.frameActive = true;
                study.frameNumber = stack.frame + 1;
                study.samples = { posture: { status: posture.enabled ? 'no-returned-output' : 'disabled', suppressed: [] },
                    gesture: { status: gesture.enabled ? 'no-returned-output' : 'disabled', suppressed: [] } };
                study.ownerSamples = study.records.map( r => ( { name: r.name, order: r.order, weight: r.weight, enabled: r.enabled,
                    status: r.enabled ? 'no-returned-output' : 'disabled', raw: null, effective: null, randomAfterFrame: null } ) );
                try {
                    const result = study.originalUpdate.call( stack, dt ); study.#assertIntact(); study.completedFrames++;
                    for ( const [ i, r ] of study.records.entries() ) study.ownerSamples[ i ].randomAfterFrame =
                        { seed: r.random.seed, state: r.random.state, spareGaussian: r.random.spareGaussian };
                    return result;
                }
                catch ( error ) { study.status = 'failed'; study.failure ??= error.message; throw error; }
                finally { study.frameActive = false; }
            } );
            this.#method( stack, 'accumulate', function ( layer, contribution ) {
                study.#assertIntact();
                if ( this !== stack || !study.frameActive || stack.frame !== study.frameNumber || layer.stack !== stack ||
                    !study.records.some( r => r.layer === layer ) || contribution !== layer.contribution )
                    study.#fail( 'Accumulator must receive this native frame\'s actual owner contribution.' );
                return study.#fold( layer, contribution );
            } );
            for ( const name of [ 'reset', 'bind', 'captureRestPose', 'add', 'remove', 'markChannelsDirty', 'rebuildChannels', 'dispose' ] )
                this.#rejectMethod( stack, name, `stack.${ name }` );
            for ( const name of [ 'beginFrame', 'commit' ] ) {
                const original = stack[ name ];
                this.#method( stack, name, function ( ...args ) {
                    study.#assertIntact();
                    if ( this !== stack || !study.frameActive ) study.#fail( `Direct stack.${ name } is forbidden.` );
                    return original.apply( this, args );
                } );
            }
            for ( const r of this.records ) {
                for ( const name of [ 'reset', 'onBind', 'declareChannels', 'dispose' ] ) this.#rejectMethod( r.layer, name, `${ r.name }.${ name }` );
                for ( const key of [ 'name', 'order', 'weight', 'enabled', 'stack', 'morphChannels', 'boneChannels', 'contribution', 'random' ] ) this.#pin( r.layer, key );
            }
            for ( const name of [ 'bindArmBudget', 'bindKneeChains' ] ) this.#rejectMethod( posture, name, `affectPosture.${ name }` );
            for ( const key of [ 'posture', 'gesture', 'stack', 'target', 'figure', 'autoStart' ] ) this.#pin( avatar, key );
            for ( const key of [ 'target', 'layers', 'context' ] ) this.#pin( stack, key );
            for ( const key of [ 'target', 'stack', 'shared' ] ) this.#pin( stack.context, key );
            this.#pin( stack.context.shared, 'posture' );
            for ( const layer of [ posture, gesture ] ) for ( const key of [ 'bones', 'amplitude', 'restFrames', 'armSides' ] ) this.#pin( layer, key );
            for ( const key of [ 'state', 'map', 'defects', 'kneeFullScaleDegrees', 'centreOfPressureFullScaleMetres' ] ) this.#pin( posture, key );
            for ( const key of [ 'maxAdductionRadians', 'kneeLegs' ] ) this.#pin( posture, key );
            for ( const key of [ 'yieldToPosture', 'sagittalShare', 'dominanceDrivesAmplitude' ] ) this.#pin( gesture, key );
            for ( const name of [ 'setIdentity', 'dress', 'swapFigure', 'build', 'buildLayers', 'attachAffect', 'attachSpeech' ] )
                if ( typeof avatar[ name ] === 'function' ) this.#rejectMethod( avatar, name, `avatar.${ name }` );
            this.#method( avatar, 'dispose', function () {
                if ( this !== avatar ) study.#fail( 'Foreign avatar disposal receiver.' );
                return study.dispose();
            } );
            this.status = 'active';
            this.#assertIntact();
        } catch ( error ) {
            this.status = 'failed'; this.failure = error.message;
            this.cleanup = this.#restore(); owners.delete( stack );
            throw error;
        }
    }

    #method( object, key, value ) {
        const before = Object.getOwnPropertyDescriptor( object, key );
        if ( before && !before.configurable ) throw Error( `Cannot acquire hand-study method ${ key }.` );
        const installed = { value, writable: true, enumerable: before?.enumerable ?? false, configurable: true };
        Object.defineProperty( object, key, installed );
        this.patches.push( { object, key, before, installed } );
    }

    #pin( object, key ) {
        const before = Object.getOwnPropertyDescriptor( object, key );
        if ( !before || !before.configurable || !Object.hasOwn( before, 'value' ) ) throw Error( `Cannot pin hand-study field ${ key }.` );
        const study = this, value = before.value;
        const installed = { get: () => value, set: () => study.#fail( `Forbidden field mutation: ${ key }.` ), enumerable: before.enumerable, configurable: true };
        Object.defineProperty( object, key, installed );
        this.patches.push( { object, key, before, installed } );
    }

    #rejectMethod( object, key, label ) {
        if ( typeof object[ key ] !== 'function' ) throw Error( `Missing native method ${ label }.` );
        const study = this;
        this.#method( object, key, function () { study.#fail( `Forbidden lifecycle mutation: ${ label }.` ); } );
    }

    #fail( message ) {
        if ( this.status !== 'disposed' ) this.status = 'failed';
        this.failure ??= message;
        throw Error( `Hand attribution stopped: ${ message }` );
    }

    #assertIntact() {
        if ( this.status !== 'active' ) this.#fail( `Instrument is ${ this.status }; reuse is forbidden.` );
        if ( owners.get( this.stack ) !== this || this.avatar.disposed || this.avatar.stack !== this.stack ||
            this.stack.target !== this.target || this.stack.context.target !== this.target || this.stack.context.shared.posture !== this.posture ||
            this.stack.channelsDirty || this.stack.layers !== this.layerArray || !same( this.stack.layers, this.records.map( r => r.layer ) ) )
            this.#fail( 'Native owner, target, layer sequence or shared posture drift.' );
        for ( const p of this.patches ) if ( !sameDescriptor( Object.getOwnPropertyDescriptor( p.object, p.key ), p.installed ) )
            this.#fail( `Instrument descriptor ownership lost: ${ p.key }.` );
        for ( const r of this.records ) if ( r.layer.update !== r.update || r.layer.stack !== this.stack ||
            r.layer.name !== r.name || r.layer.order !== r.order || r.layer.weight !== r.weight || r.layer.enabled !== r.enabled ||
            r.layer.random !== r.random || r.random.seed !== r.randomSeed || r.layer.contribution !== r.contribution || !same( r.layer.morphChannels, r.morphs ) || !same( r.layer.boneChannels, r.bones ) ||
            !same( [ ...r.contribution.morphs.keys() ], r.morphs ) || !same( [ ...r.contribution.boneRotations.keys() ], r.bones ) || !same( [ ...r.contribution.boneOffsets.keys() ], r.bones ) )
            this.#fail( `Layer configuration or contribution map drift: ${ r.name }.` );
        for ( const [ name, bone ] of this.boneObjects ) if ( this.target.getBone( name ) !== bone ) this.#fail( `Native bound bone replaced: ${ name }.` );
        const p = this.posture, g = this.gesture;
        if ( bindingState( p, g ) !== this.binding ) this.#fail( 'Native arm budget or cached binding frame drift.' );
        if ( JSON.stringify( { postureBones: p.bones, gestureBones: g.bones, postureDefects: p.defects, postureAmplitude: p.amplitude,
            knee: p.kneeFullScaleDegrees, cop: p.centreOfPressureFullScaleMetres, gestureAmplitude: g.amplitude,
            sagittal: g.sagittalShare, yield: g.yieldToPosture, liveDominance: g.dominanceDrivesAmplitude } ) !== this.config )
            this.#fail( 'Pinned native motion configuration drift.' );
    }

    #fold( layer, raw ) {
        let effective = raw;
        const suppressed = [];
        if ( ( this.arm === 'B' && layer === this.posture ) || ( this.arm === 'C' && layer === this.gesture ) ) {
            effective = this.copy;
            for ( const [ name, value ] of raw.morphs ) effective.morphs.set( name, value );
            for ( const [ name, value ] of raw.boneRotations ) effective.boneRotations.get( name ).copy( value );
            for ( const [ name, value ] of raw.boneOffsets ) effective.boneOffsets.get( name ).copy( value );
            const keys = this.arm === 'B' ? [ 'leftUpperArm', 'rightUpperArm' ] : GESTURE_KEYS;
            for ( const key of keys ) {
                const angle = this.posture.appliedArmRadians[ key ];
                if ( this.arm === 'B' && !Number.isFinite( angle ) ) this.#fail( 'Nonfinite current native posture angle.' );
                if ( this.arm === 'C' || angle < 0 ) {
                    const name = layer.bones[ key ];
                    effective.boneRotations.get( name ).identity(); suppressed.push( name );
                }
            }
        }
        const entry = this.ownerSamples[ this.records.findIndex( r => r.layer === layer ) ];
        if ( entry.status === 'returned-output' ) this.#fail( `Duplicate ${ layer.name } accumulation.` );
        entry.status = 'returned-output'; entry.raw = serial( raw ); entry.effective = serial( effective );
        if ( layer === this.posture || layer === this.gesture ) {
            const key = layer === this.posture ? 'posture' : 'gesture';
            if ( this.samples[ key ].status === 'returned-output' ) this.#fail( `Duplicate ${ key } accumulation.` );
            this.samples[ key ] = { status: 'returned-output', suppressed, raw: entry.raw, effective: entry.effective };
        }
        return this.originalAccumulate.call( this.stack, layer, effective );
    }

    report() {
        return structuredClone( { arm: this.arm, status: this.status, failure: this.failure, frame: this.frameNumber,
            completedFrames: this.completedFrames, samples: this.samples, owners: this.ownerSamples ?? null, cleanup: this.cleanup,
            note: 'Raw native telemetry remains authored prescription; effective samples describe this study filter. CPU/source pins are caller-provided bindings, not proof of loader bytes.' } );
    }

    #restore() {
        const restored = [], lost = [];
        for ( const p of this.patches.slice().reverse() ) {
            if ( !sameDescriptor( Object.getOwnPropertyDescriptor( p.object, p.key ), p.installed ) ) { lost.push( p.key ); continue; }
            try {
                if ( p.before ) Object.defineProperty( p.object, p.key, p.before ); else delete p.object[ p.key ];
                restored.push( p.key );
            } catch ( error ) { lost.push( `${ p.key }: ${ error.message }` ); }
        }
        return { restored, lost };
    }

    /** No detach/resume API: restoration and native teardown are one synchronous operation. */
    dispose() {
        if ( this.status === 'disposed' ) throw Error( 'Hand attribution is disposed; reuse is forbidden.' );
        if ( this.frameActive ) this.#fail( 'Cannot dispose in the middle of a native frame.' );
        this.status = 'disposed'; retiredAvatars.add( this.avatar ); owners.delete( this.stack );
        this.cleanup = this.#restore();
        const errors = [];
        try { this.nativeDispose.call( this.avatar ); } catch ( error ) { errors.push( error ); }
        if ( this.cleanup.lost.length ) errors.push( Error( `Instrument ownership lost at teardown: ${ this.cleanup.lost.join( ', ' ) }` ) );
        if ( !this.avatar.disposed || this.avatar.stack !== null ) errors.push( Error( 'Native avatar teardown did not retire the captured owner.' ) );
        if ( errors.length ) throw new AggregateError( errors, 'Hand attribution teardown failed.' );
        return this.report();
    }
}
