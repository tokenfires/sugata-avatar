import { float, max, select, uniform, velocity } from 'three/tsl';
import { hairDitherOffsetValue, hairDitherThresholdNode } from './HairOIT.js';

export const FACE_CARD_COVERAGE_MODES = Object.freeze( [ 'auto', 'binary' ] );
const CUTOFF = 0.1;
const owners = new WeakMap();

function belongsTo( object, root ) {
    for ( let current = object; current !== null; current = current.parent ) if ( current === root ) return true;
    return false;
}

/**
 * Fractional coverage for the Avatar's existing brow/lash materials. The numeric alpha test and
 * color alpha stay untouched for the native shadow override. Unsupported render paths use the
 * original binary test inside the same shader, including a later temporal-off/debug transition.
 *
 * One Stage participant scopes observation to its owned main pass. Object-update uniforms read
 * the actual camera/material/target and active velocity projection; no mesh callback or global
 * renderer prototype is changed. Material retirement removes its graph and listener independently.
 */
export function createFaceCardCoverage( { stage, root, materials, mode = 'auto' } ) {
    if ( ! FACE_CARD_COVERAGE_MODES.includes( mode ) ) throw new TypeError( 'FaceCardCoverage mode must be auto or binary.' );
    if ( ! stage || ! root?.traverse || ! Array.isArray( materials ) || new Set( materials ).size !== materials.length )
        throw new TypeError( 'FaceCardCoverage requires a Stage, figure root and unique card materials.' );

    let disposed = false, unregister = null, receipt = null, transaction = null;
    let lastReason = mode === 'binary' ? 'explicit binary' : 'awaiting owned temporal beauty';
    const entries = new Map();
    const renderer = stage.renderer, camera = stage.camera, scene = stage.scene;

    function clearActive( reason ) {
        receipt = null;
        for ( const entry of entries.values() ) if ( entry.enabled ) entry.enabled.value = 0;
        lastReason = reason;
    }
    function intact( entry, object ) {
        return ! disposed && entries.get( entry.material ) === entry && owners.get( entry.material ) === owner &&
            object?.material === entry.material && object.geometry === entry.objects.get( object ) &&
            belongsTo( object, root ) && entry.material.alphaTestNode === entry.threshold &&
            entry.material.alphaTest === CUTOFF && entry.material.alphaToCoverage === false &&
            entry.material.colorNode === entry.colorNode && entry.material.positionNode === entry.positionNode &&
            entry.material.mrtNode === entry.mrtNode;
    }
    function eligible( entry, frame ) {
        const temporal = stage.temporal;
        return !! ( receipt && ! disposed && transaction === stage.renderParticipants.transaction &&
            receipt.transaction === transaction && transaction.inPass && transaction.passes === 1 &&
            receipt.pass === stage.scenePass && receipt.frame.renderer === renderer &&
            stage.renderer === renderer && stage.camera === camera && stage.scene === scene &&
            frame.renderer === renderer && frame.camera === camera && frame.scene === scene &&
            frame.material === entry.material && intact( entry, frame.object ) &&
            renderer._initialized === true && ! renderer.xr?.isPresenting && ! stage.multisampled &&
            stage.renderPipeline && stage.viewMode === 'beauty' &&
            [ 'taau', 'traa' ].includes( temporal?.mode ) &&
            typeof temporal.getUnjitteredProjection === 'function' &&
            velocity.projectionMatrix === temporal.getUnjitteredProjection() &&
            velocity.projectionMatrix !== null &&
            renderer.getRenderTarget() === stage.scenePass.renderTarget &&
            scene.overrideMaterial === null && stage.scenePass.overrideMaterial === null );
    }
    function retire( entry ) {
        if ( ! entries.has( entry.material ) ) return;
        entries.delete( entry.material );
        owners.delete( entry.material );
        const errors = [], release = fn => { try { fn(); } catch ( error ) { errors.push( error ); } };
        release( () => { if ( entry.onDispose ) entry.material.removeEventListener( 'dispose', entry.onDispose ); } );
        release( () => {
            if ( entry.threshold && entry.material.alphaTestNode === entry.threshold ) {
                entry.material.alphaTestNode = entry.previousThreshold;
                entry.material.needsUpdate = true;
            }
        } );
        // A retained compiled node must neither retain this owner nor re-enable coverage.
        release( () => { if ( entry.enabled ) { entry.enabled.onObjectUpdate( () => 0 ); entry.enabled.value = 0; } } );
        release( () => entry.enabled?.dispose() );
        release( () => entry.offset?.dispose() );
        release( () => entry.threshold?.dispose() );
        entry.objects.clear();
        if ( entries.size === 0 ) { release( () => unregister?.() ); unregister = null; clearActive( 'no managed card materials' ); }
        if ( errors.length ) throw new AggregateError( errors, 'Face card coverage retirement failed.' );
    }
    const owner = {
        begin( tx ) {
            transaction = tx; clearActive( 'no eligible card draw observed' );
            for ( const entry of [ ...entries.values() ] ) {
                for ( const object of [ ...entry.objects.keys() ] ) if ( ! intact( entry, object ) ) entry.objects.delete( object );
                if ( entry.objects.size === 0 ) retire( entry );
            }
        },
        mainPassBegin( next ) { receipt = next.direct || next.pass !== stage.scenePass ? null : next; },
        mainPassEnd() { receipt = null; },
        finish() { receipt = null; transaction = null; },
        abort() { transaction = null; clearActive( 'image aborted' ); },
        invalidate( { reason } = {} ) { transaction = null; clearActive( reason ?? 'render path invalidated' ); },
        report() {
            return { requested: mode, live: ! disposed, managedMaterials: entries.size, registered: unregister !== null,
                lastObservedMode: disposed ? 'disposed' : [ ...entries.values() ].some( e => e.enabled.value > 0.5 ) ? 'coverage' : 'binary',
                reason: lastReason, shadowAlphaTest: CUTOFF, ownedStorageBuffers: 0 };
        },
        dispose() {
            if ( disposed ) return;
            disposed = true; transaction = null;
            const errors = [];
            try { clearActive( 'disposed' ); } catch ( error ) { errors.push( error ); }
            for ( const entry of [ ...entries.values() ] ) try { retire( entry ); } catch ( error ) { errors.push( error ); }
            try { unregister?.(); } catch ( error ) { errors.push( error ); }
            unregister = null; lastReason = 'disposed';
            if ( errors.length ) throw new AggregateError( errors, 'Face card coverage cleanup failed.' );
        }
    };
    if ( materials.some( material => owners.has( material ) ) ) throw new Error( 'Face card coverage is already owned.' );

    // These creation-time controls retain even the original material graph and callback shape.
    if ( mode === 'binary' || stage.multisampled || materials.length === 0 ) {
        if ( stage.multisampled ) lastReason = 'original MSAA alpha-to-coverage';
        return owner;
    }
    if ( renderer?._initialized !== true || typeof stage.registerRenderParticipant !== 'function' || ! stage.renderParticipants )
        throw new Error( 'FaceCardCoverage requires initialized Stage render participants.' );

    const plans = materials.map( material => {
        if ( owners.has( material ) ) throw new Error( 'Face card coverage is already owned.' );
        if ( ! material?.isMeshPhysicalNodeMaterial || material.alphaTest !== CUTOFF || material.alphaTestNode !== null ||
            material.alphaToCoverage || material.alphaHash || material.transparent || ! material.depthWrite ||
            ! material.map || ! material.colorNode ) throw new Error( 'Unexpected original face card material.' );
        const objects = new Map();
        root.traverse( object => { if ( object.isMesh && object.material === material ) objects.set( object, object.geometry ); } );
        if ( objects.size === 0 ) throw new Error( 'Face card material is not attached to the supplied figure.' );
        return { material, objects, previousThreshold: material.alphaTestNode, colorNode: material.colorNode,
            positionNode: material.positionNode, mrtNode: material.mrtNode };
    } );
    try {
        unregister = stage.registerRenderParticipant( owner );
        for ( const entry of plans ) {
            // Own each partial entry before its first node allocation, so a later allocation or
            // listener failure can release every completed node without publishing the graph.
            entries.set( entry.material, entry ); owners.set( entry.material, owner );
            entry.enabled = uniform( 0 );
            entry.enabled.setName( 'faceCardCoverageEnabled' ).onObjectUpdate( frame => {
                const active = eligible( entry, frame );
                lastReason = active ? null : 'original binary for unsupported active pass';
                return active ? 1 : 0;
            } );
            entry.offset = uniform( 0 );
            entry.offset.setName( 'faceCardCoverageOffset' )
                .onRenderUpdate( frame => hairDitherOffsetValue( frame.frameId ) );
            const stochastic = max( CUTOFF, hairDitherThresholdNode( entry.offset ) );
            entry.threshold = select( entry.enabled.greaterThan( 0.5 ), stochastic, float( CUTOFF ) );
            entry.onDispose = () => retire( entry );
            entry.material.addEventListener( 'dispose', entry.onDispose );
            entry.material.alphaTestNode = entry.threshold;
            entry.material.needsUpdate = true;
        }
        return owner;
    } catch ( error ) {
        try { owner.dispose(); } catch ( cleanup ) {
            throw new AggregateError( [ error, cleanup ], 'Face card coverage construction failed.', { cause: error } );
        }
        throw error;
    }
}
