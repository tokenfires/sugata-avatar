import { Layer } from './Layer.js';
import { MAX_CORNER_OFFSET } from '../figure/ExpressionBank.js';
const CHANNELS = [ 'mouthSmileLeft', 'mouthSmileRight' ];
export const ATTENTION_SMILE_PEAK = 0.18;
/**
 * Internal AttentionAction owner. Runs after Expression, Viseme and FacialIdle, adding only
 * the reviewed corner cue. The existing cap is per caller: this budgets only OUR addition,
 * never subtracting an existing expression or promising a global speech-safe total.
 * Explicit gaze speech cues and newer gaze commands share the owned 0.3-second return.
 * Avatar.say and viseme activity alone do not supersede an attention hold.
 * This does not infer an emotion, duck visemes, or mute on isolated silent speech frames.
 */
export class AttentionSmile extends Layer {
    constructor( action ) {
        super( { name: 'attentionSmile', order: 950, morphChannels: CHANNELS } );
        this.action = action;
        this.amount = 0;
        this.status = 'inactive';
    }
    support() {
        if ( !this.stack?.target || this.stack.layers.indexOf( this ) < 0 ) return 'inactive-smile-layer';
        if ( !this.enabled || this.weight !== 1 ) return 'inactive-or-weighted-smile-layer';
        for ( const name of CHANNELS ) if ( !this.stack.target.hasMorph( name ) ) return 'missing-smile-morphs';
        const index = this.stack.layers.indexOf( this );
        // A later declared corner writer could change the total after this budget was read.
        // Reject even a currently disabled writer; enabling it must not silently invalidate a hold.
        for ( let i = index + 1; i < this.stack.layers.length; i++ )
            for ( const name of this.stack.layers[i].morphChannels )
                if ( name === CHANNELS[0] || name === CHANNELS[1] ) return 'later-smile-writer';
        return null;
    }
    update() {
        this.amount = 0;
        this.status = 'inactive';
        if ( !Number.isFinite( this.action.smileWeight ) ) { this.status = 'invalid-smile-weight'; return null; }
        const requested = ATTENTION_SMILE_PEAK * Math.max( 0, Math.min( 1, this.action.smileWeight ) );
        if ( requested <= 1e-6 ) return null;
        const unsupported = this.support();
        if ( unsupported || this.stack.channelsDirty ) { this.status = unsupported ?? 'changing-motion-channels'; return null; }
        if ( this.stack.evaluatingLayer !== this ) throw new Error( 'Smile budgeting requires its own layer update.' );
        const left = this.stack.morphChannels.get( CHANNELS[0] )?.sum;
        const right = this.stack.morphChannels.get( CHANNELS[1] )?.sum;
        if ( !Number.isFinite( left ) || !Number.isFinite( right ) ) { this.status = 'invalid-smile-prefix'; return null; }
        const budget = Math.max( 0, MAX_CORNER_OFFSET - Math.max( 0, left, right ) );
        this.amount = Math.min( requested, budget );
        this.status = this.amount + 1e-12 < requested ? 'limited' : 'applied';
        if ( this.amount <= 1e-6 ) { this.amount = 0; return null; }
        for ( const name of CHANNELS ) this.contribution.setMorph( name, this.amount );
        return this.contribution;
    }
    clear() { this.amount = 0; this.status = 'inactive'; }
    onDisabledFrame() { this.amount = 0; this.status = 'inactive-or-weighted-smile-layer'; }
    onBind() { this.action.retire(); this.amount = 0; this.status = 'inactive'; }
    reset() { this.action.retire(); this.amount = 0; this.status = 'inactive'; }
    dispose() { this.action.retire(); this.amount = 0; this.status = 'inactive'; }
}
