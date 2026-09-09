/** Owns the calibrated moving-body surface and each hair substep's contact stage.
 * Imported only for the long-bob calibration. It borrows all body/groom/solver resources.
 */
import { uniform } from 'three/tsl';
import { createHairSkinTransform } from './HairSkinTransform.js';
import { createPatch, makeSkinnedUpdater, resetHistory, motionBuffers, disposePatch } from './HairSurface.js';
import { createSurfaceQuery } from './HairSurfaceQuery.js';
import { createSurfaceContactStage } from './HairSurfaceContact.js';
import { HAIR_BODY_CONTACT_CALIBRATION } from './HairBodyContactCalibration.js';

function integer( value, name, min, max ) {
    if ( !Number.isInteger( value ) || value < min || value > max ) throw Error( `Invalid ${ name }.` );
    return value;
}
function cleanup( actions ) {
    const errors = [];
    for ( const action of actions ) { try { action(); } catch ( error ) { errors.push( error ); } }
    if ( errors.length === 1 ) throw errors[ 0 ];
    if ( errors.length > 1 ) throw new AggregateError( errors, 'Body contact disposal failed.' );
}

/** Call only after selectHairBodyContactCalibration and the caller's post-await token guard. */
export function createHairBodyContactFactory( { body, groomMesh, selection, outerIterations = 16, resetIterations = 64 } ) {
    if ( selection?.enabled !== true || selection.calibration !== HAIR_BODY_CONTACT_CALIBRATION ) throw Error( 'Validated body-contact calibration is required.' );
    integer( outerIterations, 'outerIterations', 1, 128 );
    integer( resetIterations, 'resetIterations', outerIterations, 128 );
    const { calibration, bodyIndices, bodyPositions, bodyNormals } = selection;
    const head = groomMesh?.skeleton?.bones?.findIndex( bone => bone.name === 'head' );
    if ( head === undefined || head < 0 ) throw Error( 'The calibrated skinned groom and its head bone are required.' );
    const skinTransform = createHairSkinTransform( groomMesh, groomMesh.skeleton.bones[ head ], groomMesh.skeleton.boneInverses[ head ] );
    return context => {
        const { renderer, groom, substepSeconds, maxSubstepsPerFrame } = context;
        for ( const [ key, value ] of Object.entries( calibration.layout ) ) if ( groom?.[ key ] !== value ) throw Error( `Calibrated groom ${ key } changed.` );
        integer( maxSubstepsPerFrame, 'maxSubstepsPerFrame', 1, 16 );
        if ( !Number.isFinite( substepSeconds ) || substepSeconds <= 0 ) throw Error( 'A finite positive contact timestep is required.' );
        let patch = null, surface = null, updateSkin = null, disposed = false, frames = 0, resetFrame = false, preparedSubsteps = 0;
        const stages = [], alphas = [], resetNodes = [];
        const requireLive = () => { if ( disposed ) throw Error( 'Body contact has been disposed.' ); };
        const dispose = () => {
            if ( disposed ) return; disposed = true;
            cleanup( [ ...stages.map( stage => () => stage.dispose() ),
                () => surface?.dispose( renderer ), () => { if ( patch ) disposePatch( patch ); } ] );
        };
        try {
            skinTransform( { requireRigid: true } );
            patch = createPatch( { bodyIndices, sourceTriangleIds: calibration.sourceTriangleIds,
                sourcePositions: bodyPositions, sourceNormals: bodyNormals } );
            updateSkin = makeSkinnedUpdater( body, patch, { sourceIndex: bodyIndices } );
            updateSkin(); resetHistory( patch );
            surface = createSurfaceQuery( patch, motionBuffers( patch ) );
            for ( let i = 0; i < maxSubstepsPerFrame; i ++ ) {
                const alpha = uniform( 1 ); alphas.push( alpha );
                const perStep = {
                    query: ( point, seed ) => surface.query( point, seed, alpha ),
                    querySegment: ( a, b, seed ) => surface.querySegment( a, b, seed, alpha ),
                    mayOverlapSegment: ( a, b, radius ) => surface.mayOverlapSegment( a, b, radius )
                };
                // Each normal/reset batch starts with a snapshot; surface and alpha stay fixed within it.
                const stage = createSurfaceContactStage( { ...context, surface: perStep,
                    activeChains: calibration.activeChains, outerIterations, lengthIterations: 1, cacheQueryInputs: true } );
                stages.push( stage ); stage.setDt( substepSeconds );
                // More settling at attachment/reset, with no startup velocity impulse.
                const nodes = [ stage.snapshotNode ];
                for ( let pass = 0; pass < resetIterations; pass ++ ) nodes.push( stage.queryNode, stage.projectionNode );
                resetNodes.push( nodes );

            }
        } catch ( cause ) {
            try { dispose(); } catch ( cleanupError ) { throw new AggregateError( [ cause, cleanupError ], 'Body contact construction and cleanup failed.' ); }
            throw cause;
        }
        return {
            prepare( { substeps, reset } ) {
                requireLive(); integer( substeps, 'submitted substeps', 1, stages.length );
                skinTransform( { requireRigid: true } );
                // Full staged skinning/refit/history commit; zero-step frames never call prepare.
                updateSkin( { advanceHistory: true, reset: reset === true } );
                requireLive(); surface.update();
                resetFrame = reset === true; preparedSubsteps = substeps;
                for ( let i = 0; i < substeps; i ++ ) alphas[ i ].value = resetFrame ? 1 : ( i + 1 ) / substeps;
                frames ++;
            },
            nodesFor( substep ) {
                requireLive(); integer( substep, 'prepared substep', 0, preparedSubsteps - 1 );
                return resetFrame ? resetNodes[ substep ] : stages[ substep ].nodes;
            },
            dispose,
            report() {
                requireLive();
                return { calibration: calibration.id, frames, activeChains: calibration.activeChains.length,
                    patchVertices: patch.sourceVertexIds.length, patchTriangles: patch.triangles.length / 4,
                    surfaceBuffers: surface.buffers.length, stages: stages.length, outerIterations, resetIterations, queryEvery: 1,
                    regularQueries: outerIterations, resetQueries: resetIterations,
                    queryInputReuse: { ...stages[ 0 ].counts.queryInputReuse },
                    contactModel: 'whole-span maximum endpoint radius; coupled length and contact constraints',
                    temporalSurface: 'linear vertices/normals between submitted body poses; swept endpoint bounds',
                    velocityCorrection: 'contact displacement / substep; omitted on reset',
                    limitation: 'Open neck/shoulder patch; scalp, higher neck and garments need separate clearance checks.' };
            }
        };
    };
}
