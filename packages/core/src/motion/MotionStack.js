/**
 * MotionStack — the one place that writes to the figure.
 *
 * Several independent procedural systems want the same bones and morphs on the same frame.
 * Blink and emotion both want the eyelids. Breath and sway both want the spine. Gaze and head
 * motion both want the neck. If each one writes directly, they overwrite each other and whoever
 * ran last wins — which changes when you reorder an import. The stack fixes that by making every
 * layer a *contributor*: layers state what they want, the stack sums it in a fixed order, and
 * commits once per channel per frame.
 *
 * The rules, in full:
 *
 *   MORPHS ADD, then clamp to [0, 1] at commit. A layer may deliberately overdrive past 1; the
 *   clamp is the stack's, and how much was lost to it is recorded rather than swallowed.
 *
 *   BONES compose as quaternion deltas from the normalised rest pose, in layer order:
 *   `final = rest * delta1 * delta2 * ...`. Rotations do not commute, so order is meaningful
 *   here in a way it is not for morphs. Translation offsets add, because the things that use
 *   them (breath, sway) are millimetre-scale and superpose linearly at that amplitude.
 *
 *   EVERY DECLARED CHANNEL IS COMMITTED EVERY FRAME, including channels nobody wrote. That is
 *   what makes a blink end and a disabled layer let go: unwritten means rest, not "whatever was
 *   there last frame". The corollary is an ownership rule — once a channel is declared by any
 *   layer, nothing outside the stack may write it, ever.
 *
 *   DETERMINISM. Given the same seed and the same dt sequence, the stack produces an identical
 *   trace. Each layer draws from its own stream forked off the root seed by name, so adding a
 *   layer does not perturb the layers that were already there. This is what makes a critic run
 *   comparable to the one before it.
 *
 * Bone masking is done by filtering which bones a layer declares — three.js has no AvatarMask
 * API, and the `AnimationMixer._propertyBindings` hack circulating on the forum touches private
 * fields and will break.
 *
 * Usage:
 *
 *     const stack = new MotionStack( { seed: 20260807 } );
 *     stack.bind( createMotionTarget( figureRoot ) );
 *     stack.add( new Breath() );
 *     stack.add( new Blink() );
 *     stage.onFrame( ( deltaSeconds ) => stack.update( deltaSeconds ) );
 *     console.log( stack.describeConflicts() );
 */

import { Quaternion, Vector3 } from 'three';

import { MotionRandom } from './Signals.js';

/**
 * The agreed running order. Layers register against these slots so independent modules can be
 * ordered relative to each other without knowing one another exists. Gaps of 100 leave room to
 * slide something in between without renumbering.
 *
 * Note what order does and does not do. Morphs add, so order never changes a morph sum. Order
 * decides bone composition, and it decides how the conflict report reads. It is not a priority
 * system: a later layer does not override an earlier one, it adds to it.
 */
export const MOTION_ORDER = {
    POSTURE: 100,    // base stance — the pose everything else is a deviation from
    BREATH: 200,     // ribcage and belly, always running
    SWAY: 300,       // postural sway and weight shift
    GESTURE: 400,    // arm and hand strokes
    HEAD: 500,       // head orientation from gaze policy, backchannel nods
    GAZE: 600,       // eyes — after HEAD, so VOR can counter-rotate against this frame's head
    EXPRESSION: 700, // affect to AU morphs: brow, eye, cheek
    VISEME: 800,     // lipsync owns the mouth
    BLINK: 900,      // reflex, last, on top of whatever the eyelids are already doing
};

// A morph below this is treated as unwritten, so a layer sitting at zero stays out of the report.
const MORPH_EPSILON = 1e-6;

// A quaternion this close to identity is treated as unwritten. 1e-9 on w is about 0.005 degrees.
const IDENTITY_EPSILON = 1e-9;

// A backgrounded tab hands back a multi-second delta on the frame it returns. Every integrator
// below would jump. Clamping here means stack.time is *motion time* — the integral of clamped
// deltas — and deliberately not wall clock.
const DEFAULT_MAX_DELTA_SECONDS = 0.1;

export class MotionStack {

    /**
     * @param {Object} [options]
     * @param {number} [options.seed=1] - Root seed. Every layer's stream is forked from this.
     * @param {number} [options.maxDeltaSeconds=0.1] - Upper bound on a single frame's dt.
     * @param {Object} [options.shared={}] - A bag handed to every layer through the context, for
     *   cross-layer state that is genuinely shared: affect, speech timing, the gaze target.
     */
    constructor( options = {} ) {

        this.layers = [];
        this.target = null;

        this.random = new MotionRandom( options.seed ?? 1 );
        this.maxDeltaSeconds = options.maxDeltaSeconds ?? DEFAULT_MAX_DELTA_SECONDS;

        this.frame = 0;
        this.time = 0;

        // Channel state, keyed by name. These records outlive a channel rebuild so that lifetime
        // conflict statistics survive a layer being added or removed mid-run.
        this.morphChannels = new Map();
        this.boneChannels = new Map();
        this.channelsDirty = false;

        // Channels a layer declared that the bound figure does not have. Not fatal — a figure
        // variant may legitimately lack a bone — but it is always worth reporting, because the
        // usual cause is a typo in a channel name and the symptom is silence.
        this.missingChannels = [];

        this.context = {
            stack: this,
            target: null,
            dt: 0,
            time: 0,
            frame: 0,
            random: this.random,
            shared: options.shared ?? {}
        };

        this.scratchQuaternion = new Quaternion();

    }

    // --- wiring ---------------------------------------------------------------------------

    /**
     * Points the stack at a figure and snapshots its rest pose.
     *
     * The rest pose is captured here, from whatever pose the rig is in at bind time. That is
     * deliberately not "the GLB's bind pose": punch-list 1.5 normalises the skeleton to a
     * VRM-style identity rest, and the stack should treat the result of that as its zero. If the
     * rig is normalised after binding, call `captureRestPose()` again.
     *
     * ⚠️ REPRODUCIBILITY GOTCHA, and it is not theoretical — it cost two selftest failures and
     * one browser run. Because rest is read from the live pose, binding a *new* stack to a figure
     * some other stack has already been driving captures a displaced rest, and every absolute
     * bone rotation downstream differs. Layer output is identical; the pose it lands on is not.
     * A critic run that has to be comparable frame-for-frame must therefore restore the figure to
     * a known pose before binding, not merely pass the same seed. `MotionStack.reset()` does not
     * do this for you: it rewinds the stack, not the figure.
     *
     * @param {Object} target - Anything implementing the motion target contract:
     *   `setMorph(name, value)`, `hasMorph(name) -> boolean`, `getBone(name) -> Object3D|null`.
     *   `figure/Figure.js` will implement this natively; `createMotionTarget()` below builds one
     *   from a loaded GLB scene in the meantime.
     */
    bind( target ) {

        assertIsMotionTarget( target );

        this.target = target;
        this.context.target = target;

        this.rebuildChannels();

        for ( const layer of this.layers ) {

            layer.onBind( this.context );

        }

        return this;

    }

    /**
     * Adds a layer and sorts the stack by `layer.order`. Sorting is stable, so two layers sharing
     * an order slot keep the sequence they were added in.
     */
    add( layer ) {

        if ( this.findLayer( layer.name ) !== null ) {

            throw new Error( `MotionStack already has a layer named "${ layer.name }"; names must be unique because they seed the layer's random stream.` );

        }

        layer.stack = this;
        layer.random = this.random.fork( layer.name );

        this.layers.push( layer );
        this.layers.sort( ( a, b ) => a.order - b.order );

        if ( this.target !== null ) {

            this.rebuildChannels();
            layer.onBind( this.context );

        }

        return layer;

    }

    /** Removes a layer. Its channels are committed at rest on the next update. */
    remove( layer ) {

        const index = this.layers.indexOf( layer );
        if ( index === -1 ) return;

        this.layers.splice( index, 1 );
        layer.stack = null;
        layer.dispose();

        if ( this.target !== null ) this.rebuildChannels();

    }

    findLayer( name ) {

        for ( const layer of this.layers ) {

            if ( layer.name === name ) return layer;

        }

        return null;

    }

    /** Called by a layer that changed its declaration mid-frame; rebuilt at the next update. */
    markChannelsDirty() {

        this.channelsDirty = true;

    }

    // --- the frame ------------------------------------------------------------------------

    /**
     * One frame: advance every enabled layer, accumulate what they contribute, commit once.
     *
     * @param {number} deltaSeconds - Frame time. Clamped to `maxDeltaSeconds`.
     */
    update( deltaSeconds ) {

        if ( this.target === null ) {

            throw new Error( 'MotionStack.update() called before bind(). Bind a motion target first.' );

        }

        if ( this.channelsDirty ) this.rebuildChannels();

        const dt = Math.min( Math.max( deltaSeconds, 0 ), this.maxDeltaSeconds );

        this.frame ++;
        this.time += dt;

        this.context.dt = dt;
        this.context.time = this.time;
        this.context.frame = this.frame;

        this.beginFrame();

        for ( const layer of this.layers ) {

            if ( layer.enabled === false ) continue;

            layer.contribution.clear();

            const contribution = layer.update( dt, this.context );
            if ( contribution === null || contribution === undefined ) continue;

            this.accumulate( layer, contribution );

        }

        this.commit();

    }

    /**
     * Returns the stack to exactly the state it was in immediately after `bind()`: frame time,
     * frame counter, every random stream, every layer's internal state, and the diagnostics. The
     * layers themselves stay in place.
     *
     * All three steps are needed, and the third is the one that is easy to miss. Rewinding the
     * streams alone leaves a layer holding a phase or a gaze target, so `reset()` is called on
     * every layer. And `onBind()` is re-run, because a layer that draws from its stream while
     * binding — seeding a noise table, say — would otherwise find its stream rewound to *before*
     * that draw and pull a different number on its first frame. Layers must therefore keep
     * `onBind()` idempotent.
     */
    reset() {

        this.frame = 0;
        this.time = 0;

        this.random.reset();

        for ( const layer of this.layers ) {

            layer.random = this.random.fork( layer.name );
            layer.reset();

            if ( this.target !== null ) layer.onBind( this.context );

        }

        this.resetDiagnostics();

    }

    dispose() {

        for ( const layer of this.layers ) {

            layer.stack = null;
            layer.dispose();

        }

        this.layers.length = 0;
        this.morphChannels.clear();
        this.boneChannels.clear();
        this.target = null;
        this.context.target = null;

    }

    // --- conflict reporting -----------------------------------------------------------------

    /**
     * Every channel more than one layer wrote on the frame that just ran. Cheap enough to poll
     * from a HUD every frame.
     *
     * @returns {Array<Object>} `{ channel, kind, writers: [ { layer, value } ], sum, committed }`
     */
    get conflicts() {

        const found = [];

        for ( const channel of this.morphChannels.values() ) {

            if ( channel.writerNames.length < 2 ) continue;

            found.push( {
                channel: channel.name,
                kind: 'morph',
                writers: channel.writerNames.map( ( layerName, index ) => ( {
                    layer: layerName,
                    value: channel.writerValues[ index ]
                } ) ),
                sum: channel.sum,
                committed: channel.committed
            } );

        }

        for ( const channel of this.boneChannels.values() ) {

            if ( channel.rotationWriters.length >= 2 ) {

                found.push( {
                    channel: channel.name,
                    kind: 'boneRotation',
                    writers: channel.rotationWriters.map( ( layerName ) => ( { layer: layerName } ) ),
                    sum: null,
                    committed: null
                } );

            }

            if ( channel.offsetWriters.length >= 2 ) {

                found.push( {
                    channel: channel.name,
                    kind: 'boneOffset',
                    writers: channel.offsetWriters.map( ( layerName ) => ( { layer: layerName } ) ),
                    sum: null,
                    committed: null
                } );

            }

        }

        return found;

    }

    /**
     * The accumulated picture since the last `resetDiagnostics()`. This is the artifact that
     * matters when emotion and lipsync collide in Phase 5: not "these two touched the same
     * morph" — which is normal and fine — but "these two pushed it past 1 on 63% of frames and
     * 0.34 of the signal was thrown away".
     *
     * Severity is the thing to read first:
     *   'clamping'    — the sum exceeded [0, 1] and signal was lost. A real bug or a real
     *                   authoring decision, never an accident worth ignoring.
     *   'overlapping' — more than one layer wrote it, but the total stayed in range. Usually fine.
     *   'single'      — one writer. Listed only in `channels`, never a problem.
     *
     * @returns {Object}
     */
    conflictReport() {

        const channels = [];

        for ( const channel of this.morphChannels.values() ) {

            if ( channel.writtenFrames === 0 ) continue;
            channels.push( channel.toReport() );

        }

        for ( const channel of this.boneChannels.values() ) {

            if ( channel.writtenFrames === 0 ) continue;
            channels.push( channel.toReport() );

        }

        channels.sort( compareBySeverity );

        return {
            frames: this.frame,
            elapsedSeconds: this.time,
            layers: this.layers.map( ( layer ) => ( {
                name: layer.name,
                order: layer.order,
                enabled: layer.enabled,
                weight: layer.weight,
                morphChannels: layer.morphChannels.length,
                boneChannels: layer.boneChannels.length
            } ) ),
            channels,
            missingChannels: [ ...this.missingChannels ],
            currentFrameConflicts: this.conflicts
        };

    }

    /**
     * The same report as a block of text, sized for a HUD or a terminal.
     *
     * Peaks carry their unit because the two kinds are not comparable: a morph peak is the summed
     * influence before clamping, a bone peak is degrees of deviation from rest. "mean lost" is
     * per clamped frame rather than a running total, because a total grows with run length and
     * tells you nothing about how badly the channel is actually being overdriven.
     */
    describeConflicts() {

        const report = this.conflictReport();
        const lines = [];

        lines.push( `MotionStack — ${ report.frames } frames, ${ report.elapsedSeconds.toFixed( 2 ) } s of motion time, ${ report.layers.length } layers` );

        const contested = report.channels.filter( ( channel ) => channel.severity !== 'single' );

        if ( contested.length === 0 ) {

            lines.push( '  no contested channels — every written channel had a single writer' );

        } else {

            const rows = [ [ 'channel', 'kind', 'writers (peak)', 'contested', 'clamped', 'peak', 'mean lost' ] ];

            for ( const channel of contested ) {

                const unit = channel.kind === 'bone' ? '°' : '';

                const writers = channel.writers
                    .map( ( writer ) => `${ writer.layer } ${ writer.peak.toFixed( 2 ) }${ unit }` )
                    .join( ' + ' );

                rows.push( [
                    channel.channel,
                    channel.kind,
                    writers,
                    formatFrameCount( channel.contestedFrames, report.frames ),
                    channel.clampedFrames === 0 ? '-' : formatFrameCount( channel.clampedFrames, report.frames ),
                    `${ channel.peak.toFixed( 2 ) }${ unit }`,
                    channel.clampedFrames === 0 ? '-' : channel.clampLossMean.toFixed( 3 )
                ] );

            }

            for ( const line of formatTable( rows ) ) lines.push( `  ${ line }` );

        }

        const singleWriterCount = report.channels.length - contested.length;

        if ( singleWriterCount > 0 ) {

            lines.push( `  ${ singleWriterCount } further ${ singleWriterCount === 1 ? 'channel had' : 'channels had' } one writer each` );

        }

        if ( report.missingChannels.length > 0 ) {

            lines.push( '  MISSING on this figure (declared but absent — usually a typo):' );

            for ( const missing of report.missingChannels ) {

                lines.push( `    ${ missing.kind } "${ missing.channel }" declared by ${ missing.layers.join( ', ' ) }` );

            }

        }

        return lines.join( '\n' );

    }

    resetDiagnostics() {

        for ( const channel of this.morphChannels.values() ) channel.resetStatistics();
        for ( const channel of this.boneChannels.values() ) channel.resetStatistics();

    }

    // --- rest pose ------------------------------------------------------------------------

    /**
     * Re-snapshots the rest pose from the figure's current pose. Call this after skeleton
     * normalisation, or after swapping the figure for a different identity.
     */
    captureRestPose() {

        for ( const channel of this.boneChannels.values() ) {

            if ( channel.bone === null ) continue;

            channel.restQuaternion.copy( channel.bone.quaternion );
            channel.restPosition.copy( channel.bone.position );

        }

    }

    /** The rest rotation a layer's delta is measured against. Null if the bone is not declared. */
    restRotationOf( boneName ) {

        const channel = this.boneChannels.get( boneName );
        return channel === undefined ? null : channel.restQuaternion;

    }

    /** The rest position a layer's offset is measured against. Null if the bone is not declared. */
    restPositionOf( boneName ) {

        const channel = this.boneChannels.get( boneName );
        return channel === undefined ? null : channel.restPosition;

    }

    // --- helpers ----------------------------------------------------------------------------

    /**
     * Rebuilds the set of channels the stack owns from every layer's declaration — including
     * disabled layers, so that disabling a layer returns its channels to rest rather than
     * freezing them wherever they happened to be.
     */
    rebuildChannels() {

        this.channelsDirty = false;
        this.missingChannels.length = 0;

        const declaredMorphs = new Map();  // channel -> layer names, for the missing-channel report
        const declaredBones = new Map();

        for ( const layer of this.layers ) {

            for ( const channel of layer.morphChannels ) {

                appendToListInMap( declaredMorphs, channel, layer.name );

            }

            for ( const channel of layer.boneChannels ) {

                appendToListInMap( declaredBones, channel, layer.name );

            }

        }

        // Records are kept across a rebuild so lifetime statistics survive; only channels that
        // nobody declares any more are dropped.
        for ( const name of [ ...this.morphChannels.keys() ] ) {

            if ( declaredMorphs.has( name ) === false ) this.morphChannels.delete( name );

        }

        for ( const name of [ ...this.boneChannels.keys() ] ) {

            if ( declaredBones.has( name ) === false ) this.boneChannels.delete( name );

        }

        for ( const [ name, layerNames ] of declaredMorphs ) {

            let channel = this.morphChannels.get( name );

            if ( channel === undefined ) {

                channel = new MorphChannelState( name );
                this.morphChannels.set( name, channel );

            }

            channel.present = this.target.hasMorph( name ) === true;

            if ( channel.present === false ) {

                this.missingChannels.push( { kind: 'morph', channel: name, layers: layerNames } );

            }

        }

        for ( const [ name, layerNames ] of declaredBones ) {

            let channel = this.boneChannels.get( name );

            if ( channel === undefined ) {

                channel = new BoneChannelState( name );
                this.boneChannels.set( name, channel );

            }

            const bone = this.target.getBone( name ) ?? null;
            const isNewBone = channel.bone !== bone;

            channel.bone = bone;

            if ( bone === null ) {

                this.missingChannels.push( { kind: 'bone', channel: name, layers: layerNames } );

            } else if ( isNewBone ) {

                channel.restQuaternion.copy( bone.quaternion );
                channel.restPosition.copy( bone.position );

            }

        }

    }

    /** Zeroes the frame-local accumulators. Lifetime statistics are untouched. */
    beginFrame() {

        for ( const channel of this.morphChannels.values() ) channel.beginFrame();
        for ( const channel of this.boneChannels.values() ) channel.beginFrame();

    }

    /**
     * Folds one layer's contribution into the accumulators, applying the layer's weight.
     *
     * Bone weight is applied by slerping the delta away from identity, which is the rotational
     * equivalent of scaling. Slerp is only defined on [0, 1], so bone weight is clamped there;
     * morph weight is not, because deliberately overdriving a morph past 1 and letting the stack
     * clamp is a legitimate authoring move.
     */
    accumulate( layer, contribution ) {

        const morphWeight = layer.weight;
        const boneWeight = Math.min( Math.max( layer.weight, 0 ), 1 );

        for ( const [ name, value ] of contribution.morphs ) {

            if ( Math.abs( value ) < MORPH_EPSILON ) continue;

            const channel = this.morphChannels.get( name );
            if ( channel === undefined ) continue; // declaration changed mid-frame

            channel.addContribution( layer.name, value * morphWeight );

        }

        for ( const [ name, delta ] of contribution.boneRotations ) {

            if ( isIdentityQuaternion( delta ) ) continue;

            const channel = this.boneChannels.get( name );
            if ( channel === undefined ) continue;

            // Post-multiplying composes in the bone's local space, in layer order. Rotations do
            // not commute, so this is where MOTION_ORDER earns its keep.
            const scaled = this.scratchQuaternion.set( 0, 0, 0, 1 ).slerp( delta, boneWeight );
            channel.addRotation( layer.name, scaled );

        }

        for ( const [ name, offset ] of contribution.boneOffsets ) {

            if ( offset.x === 0 && offset.y === 0 && offset.z === 0 ) continue;

            const channel = this.boneChannels.get( name );
            if ( channel === undefined ) continue;

            channel.addOffset( layer.name, offset, boneWeight );

        }

    }

    /** One write per channel, per frame. The only place this module touches the figure. */
    commit() {

        for ( const channel of this.morphChannels.values() ) {

            const value = Math.min( Math.max( channel.sum, 0 ), 1 );

            channel.recordCommit( value );

            if ( channel.present ) this.target.setMorph( channel.name, value );

        }

        for ( const channel of this.boneChannels.values() ) {

            channel.recordCommit();

            if ( channel.bone === null ) continue;

            channel.bone.quaternion.multiplyQuaternions( channel.restQuaternion, channel.deltaRotation );
            channel.bone.position.copy( channel.restPosition ).add( channel.offset );

        }

    }

}

/**
 * Builds a motion target from a loaded scene graph.
 *
 * This is a bridge, not the destination: `figure/Figure.js` (punch-list 1.1) will implement the
 * same three methods natively over its morph registry. It exists so that the stack is testable
 * and usable before Figure lands, and it solves the same problem Figure has to — the figure GLB
 * spreads morphs across six meshes, and `jawOpen` lives on the body, the teeth AND the tongue.
 * Setting a morph by name means setting it everywhere it occurs.
 *
 * @param {Object3D} root - A loaded GLB scene, or any subtree containing the meshes and bones.
 * @returns {{ setMorph: Function, hasMorph: Function, getBone: Function, morphNames: string[], boneNames: string[] }}
 */
export function createMotionTarget( root ) {

    // morph name -> every (influences array, index) pair that carries it, across all meshes.
    const morphWriters = new Map();
    const bones = new Map();

    root.traverse( ( object ) => {

        if ( object.morphTargetDictionary !== undefined && object.morphTargetInfluences !== undefined ) {

            for ( const [ name, index ] of Object.entries( object.morphTargetDictionary ) ) {

                appendToListInMap( morphWriters, name, { influences: object.morphTargetInfluences, index } );

            }

        }

        if ( object.name === '' ) return;

        // Bones win over any other object sharing a name: a GLB commonly carries a mesh and a
        // joint with the same label, and motion always means the joint.
        const existing = bones.get( object.name );
        if ( existing === undefined || ( existing.isBone !== true && object.isBone === true ) ) {

            bones.set( object.name, object );

        }

    } );

    return {

        setMorph( name, value ) {

            const writers = morphWriters.get( name );
            if ( writers === undefined ) return;

            for ( const writer of writers ) {

                writer.influences[ writer.index ] = value;

            }

        },

        hasMorph( name ) {

            return morphWriters.has( name );

        },

        getBone( name ) {

            return bones.get( name ) ?? null;

        },

        get morphNames() {

            return [ ...morphWriters.keys() ];

        },

        get boneNames() {

            return [ ...bones.keys() ];

        }

    };

}

// --- channel state ------------------------------------------------------------------------

/**
 * One morph channel: this frame's accumulator, and the lifetime record of who fought over it.
 *
 * Writer names and values are held in two parallel arrays rather than an array of objects so a
 * running frame allocates nothing after the first few. They are read together, always by index.
 */
class MorphChannelState {

    constructor( name ) {

        this.name = name;
        this.kind = 'morph';
        this.present = false;

        this.sum = 0;
        this.committed = 0;
        this.writerNames = [];
        this.writerValues = [];

        this.writtenFrames = 0;
        this.contestedFrames = 0;
        this.clampedFrames = 0;
        this.clampLossTotal = 0;
        this.clampLossMax = 0;
        this.peak = 0;
        this.writerStatistics = new Map(); // layer name -> { frames, total, peak }

    }

    beginFrame() {

        this.sum = 0;
        this.writerNames.length = 0;
        this.writerValues.length = 0;

    }

    addContribution( layerName, value ) {

        this.sum += value;
        this.writerNames.push( layerName );
        this.writerValues.push( value );

        recordWriterStatistic( this.writerStatistics, layerName, value );

    }

    recordCommit( value ) {

        this.committed = value;

        if ( this.writerNames.length === 0 ) return;

        this.writtenFrames ++;
        if ( this.writerNames.length > 1 ) this.contestedFrames ++;
        if ( Math.abs( this.sum ) > this.peak ) this.peak = Math.abs( this.sum );

        const loss = Math.abs( this.sum - value );

        if ( loss > MORPH_EPSILON ) {

            this.clampedFrames ++;
            this.clampLossTotal += loss;
            if ( loss > this.clampLossMax ) this.clampLossMax = loss;

        }

    }

    resetStatistics() {

        this.writtenFrames = 0;
        this.contestedFrames = 0;
        this.clampedFrames = 0;
        this.clampLossTotal = 0;
        this.clampLossMax = 0;
        this.peak = 0;
        this.writerStatistics.clear();

    }

    toReport() {

        return buildChannelReport( this, {
            clampedFrames: this.clampedFrames,
            clampLossTotal: this.clampLossTotal,
            clampLossMax: this.clampLossMax
        } );

    }

}

/**
 * One bone channel: rest pose, this frame's composed delta and summed offset, and the record of
 * who touched it. Rotation and translation are tracked separately because a breath layer that
 * only offsets the ribcage should not read as fighting a sway layer that only rotates it.
 */
class BoneChannelState {

    constructor( name ) {

        this.name = name;
        this.kind = 'bone';
        this.bone = null;

        this.restQuaternion = new Quaternion();
        this.restPosition = new Vector3();

        this.deltaRotation = new Quaternion();
        this.offset = new Vector3();

        this.rotationWriters = [];
        this.offsetWriters = [];

        this.writtenFrames = 0;
        this.contestedFrames = 0;
        this.peak = 0; // largest total deviation from rest, in degrees
        this.writerStatistics = new Map();

    }

    beginFrame() {

        this.deltaRotation.set( 0, 0, 0, 1 );
        this.offset.set( 0, 0, 0 );
        this.rotationWriters.length = 0;
        this.offsetWriters.length = 0;

    }

    addRotation( layerName, scaledDelta ) {

        this.deltaRotation.multiply( scaledDelta );
        this.rotationWriters.push( layerName );

        recordWriterStatistic( this.writerStatistics, layerName, quaternionAngleDegrees( scaledDelta ) );

    }

    addOffset( layerName, offset, weight ) {

        this.offset.addScaledVector( offset, weight );
        this.offsetWriters.push( layerName );

        recordWriterStatistic( this.writerStatistics, layerName, offset.length() * weight );

    }

    recordCommit() {

        const writerCount = this.rotationWriters.length + this.offsetWriters.length;
        if ( writerCount === 0 ) return;

        this.writtenFrames ++;

        if ( this.rotationWriters.length > 1 || this.offsetWriters.length > 1 ) this.contestedFrames ++;

        const deviation = quaternionAngleDegrees( this.deltaRotation );
        if ( deviation > this.peak ) this.peak = deviation;

    }

    resetStatistics() {

        this.writtenFrames = 0;
        this.contestedFrames = 0;
        this.peak = 0;
        this.writerStatistics.clear();

    }

    toReport() {

        // Bones cannot clamp — a quaternion has no range to exceed — so the clamp columns are
        // reported as zero rather than omitted, to keep one shape for every channel row.
        return buildChannelReport( this, { clampedFrames: 0, clampLossTotal: 0, clampLossMax: 0 } );

    }

}

// --- shared helpers ---------------------------------------------------------------------------

function buildChannelReport( channel, clampStatistics ) {

    const writers = [];

    for ( const [ layerName, statistic ] of channel.writerStatistics ) {

        writers.push( {
            layer: layerName,
            frames: statistic.frames,
            peak: statistic.peak,
            mean: statistic.frames === 0 ? 0 : statistic.total / statistic.frames
        } );

    }

    writers.sort( ( a, b ) => b.frames - a.frames );

    let severity = 'single';
    if ( clampStatistics.clampedFrames > 0 ) severity = 'clamping';
    else if ( channel.contestedFrames > 0 ) severity = 'overlapping';

    return {
        channel: channel.name,
        kind: channel.kind,
        severity,
        writers,
        writtenFrames: channel.writtenFrames,
        contestedFrames: channel.contestedFrames,
        peak: channel.peak,
        clampedFrames: clampStatistics.clampedFrames,
        clampLossTotal: clampStatistics.clampLossTotal,
        clampLossMax: clampStatistics.clampLossMax,
        clampLossMean: clampStatistics.clampedFrames === 0
            ? 0
            : clampStatistics.clampLossTotal / clampStatistics.clampedFrames
    };

}

const SEVERITY_RANK = { clamping: 0, overlapping: 1, single: 2 };

function compareBySeverity( a, b ) {

    if ( SEVERITY_RANK[ a.severity ] !== SEVERITY_RANK[ b.severity ] ) {

        return SEVERITY_RANK[ a.severity ] - SEVERITY_RANK[ b.severity ];

    }

    if ( a.clampLossTotal !== b.clampLossTotal ) return b.clampLossTotal - a.clampLossTotal;
    if ( a.contestedFrames !== b.contestedFrames ) return b.contestedFrames - a.contestedFrames;

    return a.channel.localeCompare( b.channel );

}

function recordWriterStatistic( statistics, layerName, magnitude ) {

    let statistic = statistics.get( layerName );

    if ( statistic === undefined ) {

        statistic = { frames: 0, total: 0, peak: 0 };
        statistics.set( layerName, statistic );

    }

    statistic.frames ++;
    statistic.total += magnitude;
    if ( Math.abs( magnitude ) > statistic.peak ) statistic.peak = Math.abs( magnitude );

}

function appendToListInMap( map, key, value ) {

    const existing = map.get( key );

    if ( existing === undefined ) map.set( key, [ value ] );
    else existing.push( value );

}

function isIdentityQuaternion( quaternion ) {

    return 1 - Math.abs( quaternion.w ) < IDENTITY_EPSILON;

}

function quaternionAngleDegrees( quaternion ) {

    // Clamped because accumulated multiplications drift |w| a hair past 1 and acos() then returns
    // NaN, which would poison every statistic downstream of it.
    const w = Math.min( Math.abs( quaternion.w ), 1 );

    return 2 * Math.acos( w ) * ( 180 / Math.PI );

}

/**
 * Pads a table of rows to its own widest cell per column, so channel and layer names of any
 * length stay in their columns instead of shunting the numbers sideways.
 */
function formatTable( rows, gap = '  ' ) {

    const widths = [];

    for ( const row of rows ) {

        row.forEach( ( cell, column ) => {

            widths[ column ] = Math.max( widths[ column ] ?? 0, cell.length );

        } );

    }

    return rows.map( ( row ) =>
        row.map( ( cell, column ) => cell.padEnd( widths[ column ] ) ).join( gap ).trimEnd()
    );

}

function formatFrameCount( count, total ) {

    if ( total === 0 ) return String( count );

    return `${ count } (${ Math.round( ( count / total ) * 100 ) }%)`;

}

function assertIsMotionTarget( target ) {

    const missing = [ 'setMorph', 'hasMorph', 'getBone' ].filter(
        ( method ) => typeof target?.[ method ] !== 'function'
    );

    if ( missing.length > 0 ) {

        throw new Error( `MotionStack.bind() needs a motion target implementing ${ missing.join( ', ' ) }. Use createMotionTarget( root ), or a Figure.` );

    }

}
