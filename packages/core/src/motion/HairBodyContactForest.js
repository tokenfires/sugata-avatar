/** Calibrated disjoint hair-region contact with independently bounded surface domains. */
import { uniform } from 'three/tsl';
import { createHairSkinTransform } from './HairSkinTransform.js';
import { createPatch, makeSkinnedUpdater, resetHistory, motionBuffers, disposePatch } from './HairSurface.js';
import { createSurfaceForestQuery } from './HairSurfaceForestQuery.js';
import { createSurfaceContactStage } from './HairSurfaceContact.js';
import { HAIR_BODY_CONTACT_CALIBRATIONS } from './HairBodyContactCalibration.js';

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
export function resolveContactDomains( calibration ) {
    const specs = calibration.contactDomains ?? [ { id: calibration.id,
        activeChains: calibration.activeChains, sourceTriangleIds: calibration.sourceTriangleIds } ];
    if ( !Array.isArray( specs ) || specs.length < 1 || specs.length > 8 ) throw Error( 'Explicit contact domains are required.' );
    const expected = new Set( calibration.activeChains ), seen = new Set(), ids = new Set();
    for ( const spec of specs ) {
        if ( typeof spec?.id !== 'string' || !spec.id || ids.has( spec.id ) ) throw Error( 'Unique contact domain IDs are required.' );
        ids.add( spec.id );
        if ( !Array.isArray( spec.activeChains ) || !spec.activeChains.length ) throw Error( 'Each contact domain needs explicit active chains.' );
        for ( const chain of spec.activeChains ) {
            integer( chain, 'contact domain chain', 0, calibration.layout.chainCount - 1 );
            if ( !expected.has( chain ) || seen.has( chain ) ) throw Error( 'Contact domains must partition calibrated chains exactly once.' );
            seen.add( chain );
        }
        if ( !Array.isArray( spec.sourceTriangleIds ) || !spec.sourceTriangleIds.length ) throw Error( 'Each contact domain needs explicit body triangles.' );
        const triangles = new Set( spec.sourceTriangleIds );
        if ( triangles.size !== spec.sourceTriangleIds.length || calibration.sourceTriangleIds.some( id => !triangles.has( id ) ) ) {
            throw Error( 'Every contact domain must retain all original calibrated neck/shoulder triangles.' );
        }
    }
    if ( seen.size !== expected.size ) throw Error( 'Contact domains omit calibrated chains.' );
    return specs;
}

/** Disjoint-domain forest: duplicate CPU skinners, one all-chain stage per substep. */
export function createHairBodyContactForestFactory( { body, groomMesh, selection, outerIterations = 16, resetIterations = 64 } ) {
    if ( selection?.enabled !== true || !HAIR_BODY_CONTACT_CALIBRATIONS.includes( selection.calibration ) ) throw Error( 'Validated body-contact calibration is required.' );
    integer( outerIterations, 'outerIterations', 1, 128 );
    integer( resetIterations, 'resetIterations', outerIterations, 128 );
    const { calibration, bodyIndices, bodyPositions, bodyNormals } = selection;
    const specs = resolveContactDomains( calibration );
    // The forest selector addresses every authored chain, including any unprojected root chains.
    if ( calibration.activeChains.length !== calibration.layout.chainCount ) throw Error( 'Forest control requires a complete calibrated chain partition.' );
    const head = groomMesh?.skeleton?.bones?.findIndex( bone => bone.name === 'head' );
    if ( head === undefined || head < 0 ) throw Error( 'The calibrated skinned groom and its head bone are required.' );
    const skinTransform = createHairSkinTransform( groomMesh, groomMesh.skeleton.bones[ head ], groomMesh.skeleton.boneInverses[ head ] );
    return context => {
        const { renderer, groom, substepSeconds, maxSubstepsPerFrame } = context;
        for ( const [ key, value ] of Object.entries( calibration.layout ) ) if ( groom?.[ key ] !== value ) throw Error( 'Calibrated groom ' + key + ' changed.' );
        integer( maxSubstepsPerFrame, 'maxSubstepsPerFrame', 1, 16 );
        if ( !Number.isFinite( substepSeconds ) || substepSeconds <= 0 ) throw Error( 'A finite positive contact timestep is required.' );
        let disposed = false, frames = 0, resetFrame = false, preparedSubsteps = 0, forest = null;
        const domains = [], stages = [], alphas = [], normalNodes = [], resetNodes = [];
        const requireLive = () => { if ( disposed ) throw Error( 'Body contact has been disposed.' ); };
        const dispose = () => {
            if ( disposed ) return; disposed = true;
            cleanup( [ ...stages.map( stage => () => stage.dispose() ), () => forest?.dispose( renderer ),
                ...domains.map( domain => () => { if ( domain.patch ) disposePatch( domain.patch ); } ) ] );
        };
        try {
            skinTransform( { requireRigid: true } );
            for ( const spec of specs ) {
                const domain = { spec, patch: null, updateSkin: null };
                domains.push( domain );
                domain.patch = createPatch( { bodyIndices, sourceTriangleIds: spec.sourceTriangleIds,
                    sourcePositions: bodyPositions, sourceNormals: bodyNormals } );
                domain.updateSkin = makeSkinnedUpdater( body, domain.patch, { sourceIndex: bodyIndices } );
                domain.updateSkin(); resetHistory( domain.patch );
            }
            forest = createSurfaceForestQuery( domains.map( d => ( {
                id: d.spec.id, patch: d.patch, motion: motionBuffers( d.patch ), chains: d.spec.activeChains
            } ) ), { chainCount: calibration.layout.chainCount } );
            for ( let i = 0; i < maxSubstepsPerFrame; i ++ ) {
                const alpha = uniform( 1 ); alphas.push( alpha );
                const perStep = {
                    query: ( point, seed ) => forest.query( point, seed, alpha ),
                    querySegment: ( a, b, seed ) => forest.querySegment( a, b, seed, alpha ),
                    mayOverlapSegment: ( a, b, radius ) => forest.mayOverlapSegment( a, b, radius ),
                    forChain: chain => forest.forChain( chain, alpha )
                };
                const stage = createSurfaceContactStage( { ...context, surface: perStep,
                    activeChains: calibration.activeChains, outerIterations, lengthIterations: 1, cacheQueryInputs: true } );
                stages.push( stage ); stage.setDt( substepSeconds );
                normalNodes.push( [ ...stage.nodes ] );
                const reset = [ stage.snapshotNode ];
                for ( let pass = 0; pass < resetIterations; pass ++ ) reset.push( stage.queryNode, stage.projectionNode );
                resetNodes.push( reset );
            }
        } catch ( cause ) {
            try { dispose(); } catch ( cleanupError ) { throw new AggregateError( [ cause, cleanupError ], 'Body contact construction and cleanup failed.' ); }
            throw cause;
        }
        return {
            prepare( { substeps, reset } ) {
                requireLive(); integer( substeps, 'submitted substeps', 1, maxSubstepsPerFrame );
                skinTransform( { requireRigid: true } );
                // Keep both existing CPU skin/refit histories. The forest packs them only after both succeed.
                for ( const domain of domains ) {
                    requireLive(); domain.updateSkin( { advanceHistory: true, reset: reset === true } );
                    requireLive();
                }
                forest.update(); requireLive();
                resetFrame = reset === true; preparedSubsteps = substeps;
                for ( let i = 0; i < substeps; i ++ ) alphas[ i ].value = resetFrame ? 1 : ( i + 1 ) / substeps;
                frames ++;
            },
            nodesFor( substep ) {
                requireLive(); integer( substep, 'prepared substep', 0, preparedSubsteps - 1 );
                return resetFrame ? resetNodes[ substep ] : normalNodes[ substep ];
            },
            dispose,
            report() {
                requireLive();
                return { calibration: calibration.id, frames, activeChains: calibration.activeChains.length,
                    patchVertices: domains.reduce( ( total, d ) => total + d.patch.sourceVertexIds.length, 0 ),
                    patchTriangles: domains.reduce( ( total, d ) => total + d.patch.triangles.length / 4, 0 ),
                    surfaceBuffers: forest.buffers.length, stages: stages.length, outerIterations, resetIterations, queryEvery: 1,
                    regularQueries: outerIterations, resetQueries: resetIterations,
                    queryInputReuse: { ...stages[ 0 ].counts.queryInputReuse },
                    queryDispatchesPerSubstep: outerIterations, resetQueryDispatches: resetIterations,
                    forest: forest.layout,
                    domains: domains.map( d => ( { id: d.spec.id, activeChains: d.spec.activeChains.length,
                        patchVertices: d.patch.sourceVertexIds.length, patchTriangles: d.patch.triangles.length / 4 } ) ),
                    contactModel: 'whole-span maximum endpoint radius; coupled length and contact constraints',
                    temporalSurface: 'linear vertices/normals between submitted body poses; swept endpoint bounds',
                    velocityCorrection: 'contact displacement / substep; omitted on reset',
                    limitation: 'Open calibrated body patches; scalp, higher neck and garments need separate clearance checks.' };
            }
        };
    };
}
