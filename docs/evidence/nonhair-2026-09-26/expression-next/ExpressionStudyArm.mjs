/** Isolated, fixed B/C comparison. Not a public cue API or a production expression change. */
import { Vector3 } from 'three';
import { Layer } from '../../../../packages/core/src/motion/Layer.js';
import { attentionTargetFromCamera } from '../../../../packages/core/src/motion/AttentionAction.js';

export const EYE_WIDE_CHANNELS = Object.freeze( [ 'eyeWideLeft', 'eyeWideRight' ] );
export const ATTENUATION = 0.45;
const EPSILON = 1e-6;
const smooth = u => { u = Math.max( 0, Math.min( 1, u ) ); return u ** 3 * ( u * ( 6 * u - 15 ) + 10 ); };
export const studyEnvelope = t => smooth( ( t - .25 ) / .6 ) * ( 1 - smooth( ( t - 2.6 ) / .8 ) );
// MotionStack tests the unweighted contribution BEFORE multiplying by layer.weight. This
// study output always has weight 1, so its requested and weighted correction are identical.
export const admittedCorrection = value => Math.abs( value ) < EPSILON ? 0 : value;
export const expectedCommit = ( expression, otherOwners, correction ) =>
    Math.min( 1, Math.max( 0, expression + otherOwners + admittedCorrection( correction ) ) );

export class ExpressionStudyArm {
    constructor( avatar, { arm } = {} ) {
        if ( arm !== 'B' && arm !== 'C' ) throw new RangeError( 'Study arm must be B or C; A has no study owner.' );
        this.avatar = avatar;
        this.stack = avatar?.stack;
        this.expression = avatar?.expression;
        this.expressionWeight = this.expression?.weight;
        this.gaze = avatar?.layers?.gaze;
        this.head = this.gaze?.head;
        this.arm = arm;
        this.disposed = false;
        this.phase = 'idle';
        this.time = this.envelope = this.startEnvelope = 0;
        this.gazeHold = null;
        this.target = this.pointWorld = null;
        this.retirementReason = null;
        this.sample = null;
        this.invocations = 0;
        this.assertReady();
        const owner = this;
        class Control extends Layer {
            constructor() { super( { name: 'expressionStudyControl', order: 50 } ); }
            update( dt ) { owner.advance( dt ); return null; }
            onDisabledFrame() { owner.retire( 'control-disabled' ); }
            onBind() { owner.retire( 'bind' ); }
            reset() { owner.retire( 'reset' ); }
            dispose() { owner.retire( 'control-disposed' ); }
        }
        class Output extends Layer {
            constructor() { super( { name: 'expressionStudyEyeWide', order: 701, morphChannels: EYE_WIDE_CHANNELS } ); }
            update() { return owner.attenuate( this ); }
            onDisabledFrame() { owner.retire( 'output-disabled' ); }
            onBind() { owner.retire( 'bind' ); }
            reset() { owner.retire( 'reset' ); }
            dispose() { owner.retire( 'output-disposed' ); }
        }
        this.control = new Control();
        this.output = arm === 'C' ? new Output() : null;
        try {
            this.stack.add( this.control );
            if ( this.output ) this.stack.add( this.output );
        } catch ( error ) {
            // Native add registers before onBind. Only remove the actual instances we own.
            this.dispose();
            throw error;
        }
    }

    unsupported() {
        const s = this.stack, e = this.expression;
        if ( this.disposed ) return 'disposed';
        if ( !s?.target || this.avatar.stack !== s ) return 'inactive-stack';
        if ( !e || this.avatar.expression !== e || e.stack !== s || !s.layers.includes( e ) || s.findLayer( e.name ) !== e ) return 'expression-owner-changed';
        if ( e.name !== 'expression' || e.order !== 700 || !Number.isFinite( this.expressionWeight ) || this.expressionWeight < 0 || e.weight !== this.expressionWeight ) return 'expression-order-or-weight';
        if ( EYE_WIDE_CHANNELS.some( name => !e.morphChannels.includes( name ) || !s.target.hasMorph( name ) ) ) return 'expression-channels';
        for ( const [ layer, order ] of [ [ this.control, 50 ], [ this.output, 701 ] ] ) {
            if ( !layer ) continue;
            if ( layer.stack !== s || !s.layers.includes( layer ) || s.findLayer( layer.name ) !== layer ) return 'study-layer-removed';
            if ( !layer.enabled || layer.weight !== 1 || layer.order !== order ) return 'study-layer-disabled-order-or-weight';
        }
        if ( this.control && s.layers.indexOf( this.control ) >= s.layers.indexOf( e ) ) return 'study-control-order';
        if ( this.control && ( this.control.morphChannels.length || this.control.boneChannels.length ) ) return 'study-control-declaration';
        if ( this.output && ( s.layers.indexOf( e ) >= s.layers.indexOf( this.output ) ||
            this.output.morphChannels.length !== 2 || EYE_WIDE_CHANNELS.some( n => !this.output.morphChannels.includes( n ) ) ||
            this.output.boneChannels.length !== 0 ) ) return 'study-output-declaration-or-order';
        if ( this.arm === 'B' ) {
            const g = this.gaze, h = this.head;
            if ( this.avatar.layers?.gaze !== g || !g?.holdTarget || g.head !== h || !h ||
                g.stack !== s || h.stack !== s || !s.layers.includes( g ) || !s.layers.includes( h ) || !g.enabled || !h.enabled ) return 'gaze-or-head-inactive';
            if ( g.order !== 600 || h.order !== 500 || g.headBone !== s.target.getBone( g.headBoneName ) ) return 'gaze-binding-or-order';
            const reason = g.pointAimSupport?.();
            if ( reason !== null ) return `point-aim-unsupported:${ reason ?? 'missing-api' }`;
        }
        return null;
    }

    assertReady() {
        const reason = this.unsupported();
        if ( reason ) throw new Error( `Expression study unavailable: ${ reason }.` );
    }

    /** Repeats blend from the current envelope; B acquires once, before point onset at .25s. */
    start( camera ) {
        this.assertReady();
        if ( this.arm === 'B' ) {
            const target = attentionTargetFromCamera( camera, this.gaze.headBone, this.gaze.rigRoot );
            if ( Math.abs( target.yawDegrees ) > 55 || Math.abs( target.pitchDegrees ) > 25 )
                throw new RangeError( 'Study B requires the existing frontal, eye-level reach.' );
            const point = camera.getWorldPosition( new Vector3() );
            // All fallible native validation happens before replacing the previous token.
            const hold = this.gaze.holdTarget( target, { predicted: true, pointWorld: point, pointWeight: 0 } );
            hold.setPointWeight( this.envelope );
            this.gazeHold = hold;
            this.target = { ...target };
            this.pointWorld = point.toArray();
        }
        this.startEnvelope = this.envelope;
        this.time = 0;
        this.phase = 'attending';
        this.retirementReason = null;
        this.invocations++;
        return this;
    }

    cancel( { immediate = false } = {} ) {
        if ( immediate ) { this.retire( 'cancel-immediate' ); return this; }
        if ( this.phase === 'idle' || this.phase === 'releasing' ) return this;
        this.gazeHold?.release( { pointFadeSeconds: .3 } );
        if ( this.arm === 'B' && !this.gazeHold?.pointFading ) { this.retire( 'cancel-complete' ); return this; }
        this.phase = 'releasing';
        this.time = 0;
        this.startEnvelope = this.envelope;
        return this;
    }

    advance( dt ) {
        if ( this.phase === 'idle' ) return;
        const reason = this.unsupported();
        if ( reason ) { this.retire( reason ); return; }
        if ( this.arm === 'B' && ( this.phase === 'attending' ? !this.gazeHold?.active :
            this.startEnvelope > 0 && !this.gazeHold?.pointFading ) ) {
            this.retire( 'gaze-superseded' ); return;
        }
        this.time += dt;
        if ( this.phase === 'releasing' ) {
            this.envelope = this.startEnvelope * ( 1 - smooth( this.time / .3 ) );
            if ( this.time >= .3 ) { this.retire( 'cancel-complete' ); return; }
        } else {
            this.envelope = ( this.startEnvelope + ( 1 - this.startEnvelope ) * smooth( ( this.time - .25 ) / .6 ) ) *
                ( 1 - smooth( ( this.time - 2.6 ) / .8 ) );
            if ( this.time >= 3.4 ) { this.retire( 'complete' ); return; }
        }
        if ( this.gazeHold?.active ) this.gazeHold.setPointWeight( this.envelope );
    }

    attenuate( layer ) {
        const reason = this.unsupported();
        if ( reason ) { this.retire( reason ); return null; }
        const records = {};
        // Read both before writing either: a bad right owner cannot leave a left correction.
        for ( const name of EYE_WIDE_CHANNELS ) {
            const c = this.stack.morphChannels.get( name );
            const matches = c.writerNames.flatMap( ( owner, i ) => owner === this.expression.name ? [ c.writerValues[ i ] ] : [] );
            if ( matches.length > 1 || matches.some( v => !Number.isFinite( v ) || v < 0 ) ) {
                this.retire( 'invalid-current-expression-writer' ); return null;
            }
            const expression = matches[ 0 ] ?? 0;
            const requested = -ATTENUATION * this.envelope * expression;
            records[ name ] = { expression, requested, expectedAdmitted: admittedCorrection( requested ) };
        }
        this.sample = { frame: this.stack.frame, envelope: this.envelope, channels: records };
        for ( const name of EYE_WIDE_CHANNELS ) layer.contribution.setMorph( name, records[ name ].requested );
        return layer.contribution;
    }

    /** In-place retirement is safe inside native bind/reset/remove/dispose iteration. */
    retire( reason = 'retired' ) {
        this.gazeHold?.release();
        this.gazeHold = null;
        this.phase = 'idle';
        this.time = this.envelope = this.startEnvelope = 0;
        this.retirementReason = reason;
    }

    report() {
        const channels = {};
        for ( const name of EYE_WIDE_CHANNELS ) {
            const c = this.stack?.morphChannels.get( name );
            const current = this.sample?.frame === this.stack.frame ? this.sample.channels[ name ] : null;
            const i = c?.writerNames.indexOf( this.output?.name ) ?? -1;
            channels[ name ] = { ...( current ?? { expression: null, requested: null, expectedAdmitted: null } ),
                actualAdmitted: i >= 0 ? c.writerValues[ i ] : 0, committed: c?.committed ?? null,
                writers: c ? c.writerNames.map( ( owner, j ) => ( { owner, value: c.writerValues[ j ] } ) ) : [] };
        }
        return { arm: this.arm, phase: this.phase, time: this.time, envelope: this.envelope,
            invocations: this.invocations, disposed: this.disposed, retirementReason: this.retirementReason,
            frame: this.stack?.frame ?? null, sampleFrame: this.sample?.frame ?? null,
            sampleCurrent: this.sample?.frame === this.stack?.frame, channels,
            expressionWeight: this.expressionWeight, holdsGaze: this.gazeHold?.active === true,
            pointFading: this.gazeHold?.pointFading === true, pointStatus: this.gaze?.pointAimOutput?.status ?? null,
            target: this.target ? { ...this.target } : null, pointWorld: this.pointWorld?.slice() ?? null,
            onset: this.arm === 'B' ? 'native-hold-at-0; point-refinement-at-.25' : 'eye-wide-correction-at-.25' };
    }

    dispose() {
        if ( this.disposed ) return;
        this.disposed = true;
        this.retire( 'disposed' );
        for ( const layer of [ this.control, this.output ] ) if ( layer ) this.stack?.remove( layer );
        this.retirementReason = 'disposed';
    }
}
