// Optional per-chain surface routing shares query bindings; the single-domain path is unchanged.
/** Exact query input reuse is optional and requires a snapshot before each batch with stable surface/alpha.
 * Reuse is reported in metadata extraB.w; zero traversal counts alone do not imply root-bound rejection.
 * Finite-width hair/body contact: whole-span nearest witness, conservative endpoint width,
 * and coupled length/contact projection. Query dispatch groups the same ring across chains.
 * The contact owner selects and validates its body domain and active chain IDs.
 */
import {
    Fn, If, Loop, instancedArray, instanceIndex, uniform,
    uint, float, vec3, vec4, uvec4, dot, sqrt, max, abs, select, all, floatBitsToUint
} from 'three/tsl';

function integer( value, name, low, high ) {
    if ( !Number.isInteger( value ) || value < low || value > high ) {
        throw new Error( `${name} must be an integer in [${low}, ${high}].` );
    }
    return value;
}

/**
 * Separate parallel nearest-surface queries from serial-per-chain projection.
 * Queries use eight storage bindings; projection uses six. All positions are world
 * space. Offset norms assume the groom reaches world space by a rigid transform.
 *
 * Surface, positionBuffer, velocityBuffer and restLengthBuffer remain caller-owned.
 * Dispose this stage only after all submissions using it have completed.
 */
export function createSurfaceContactStage( {
    renderer, groom, positionBuffer, velocityBuffer, restLengthBuffer, surface,
    activeChains, outerIterations = 16, lengthIterations = 1, cacheQueryInputs = false
} ) {
    if ( !renderer || typeof surface?.query !== 'function' || typeof surface?.querySegment !== 'function' || typeof surface?.mayOverlapSegment !== 'function' ) throw new Error( 'Renderer, surface.query, surface.querySegment and surface.mayOverlapSegment are required.' );
    if ( surface.forChain !== undefined && typeof surface.forChain !== 'function' ) throw Error( 'surface.forChain must be a function when supplied.' );
    if ( typeof cacheQueryInputs !== 'boolean' ) throw new Error( 'cacheQueryInputs must be a boolean.' );
    const chainCount = integer( groom?.chainCount, 'groom.chainCount', 1, 1000000 );
    const pointsPerChain = integer( groom?.pointsPerChain, 'groom.pointsPerChain', 2, 256 );
    const particleCount = chainCount * pointsPerChain;
    if ( particleCount >= 0x1000000 || groom.particleCount !== undefined && groom.particleCount !== particleCount ) {
        throw new Error( 'Particle count is inconsistent or exceeds packed contact index precision.' );
    }
    integer( outerIterations, 'outerIterations', 1, 128 );
    integer( lengthIterations, 'lengthIterations', 1, 32 );
    if ( !groom.restOffsets || groom.restOffsets.length !== particleCount * 3 || !Array.from( groom.restOffsets ).every( Number.isFinite ) ) {
        throw new Error( 'Finite per-particle groom.restOffsets are required.' );
    }
    for ( const [ name, buffer ] of Object.entries( { positionBuffer, velocityBuffer, restLengthBuffer } ) ) {
        if ( typeof buffer?.element !== 'function' || !buffer.value || buffer.value.count < particleCount ) {
            throw new Error( `${name} must contain every groom particle.` );
        }
    }
    if ( !activeChains || typeof activeChains[ Symbol.iterator ] !== 'function' ) throw new Error( 'activeChains must contain explicit chain IDs.' );
    const chains = Array.from( activeChains );
    if ( !chains.length || new Set( chains ).size !== chains.length ) throw new Error( 'activeChains must be nonempty and unique.' );
    for ( const chain of chains ) integer( chain, 'active chain ID', 0, chainCount - 1 );

    const spans = pointsPerChain - 1, contactsPerChain = spans * 2;
    const contactCount = chains.length * contactsPerChain;
    const radii = new Float32Array( particleCount );
    for ( let i = 0; i < particleCount; i ++ ) radii[ i ] = Math.hypot( ...groom.restOffsets.slice( i * 3, i * 3 + 3 ) );
    const packed = new Float32Array( contactCount * 4 );
    for ( let localChain = 0; localChain < chains.length; localChain ++ ) {
        const base = chains[ localChain ] * pointsPerChain;
        let contact = localChain * contactsPerChain;
        // Endpoints are represented as t=1 on the preceding segment; no aliased writes.
        for ( let ring = 1; ring < pointsPerChain; ring ++ ) {
            packed.set( [ base + ring - 1, base + ring, 1, radii[ base + ring ] ], contact ++ * 4 );
        }
        // z=-1 selects the adaptive whole-span query; w conservatively bounds both endpoint offsets.
        // The ribbon is within this norm tube even when its two offset directions differ.
        // Max endpoint radius can add stand-off versus the interpolated width; report it separately.
        for ( let span = 0; span < spans; span ++ ) {
            packed.set( [ base + span, base + span + 1, -1,
                Math.max( radii[ base + span ], radii[ base + span + 1 ] ) ], contact ++ * 4 );
        }
    }
    // Optional input cache shares the metadata binding; the first contactCount records are unchanged.
    // ExtraA=(previousA.xyz,valid), ExtraB=(previousB.xyz,reused). No cross-batch reuse is allowed.
    const metadataArray = cacheQueryInputs ? new Float32Array( packed.length * 3 ) : packed;
    if ( cacheQueryInputs ) metadataArray.set( packed );
    const metadata = instancedArray( metadataArray, 'vec4' );
    const planes = instancedArray( contactCount, 'vec4' );
    // Query-produced segment t. It is not the dispatch selector stored in metadata.z.
    const parameters = instancedArray( contactCount, 'float' );
    const cacheArray = new Uint32Array( contactCount * 4 );
    for ( let i = 0; i < contactCount; i ++ ) cacheArray[ i * 4 ] = 0xffffffff;
    // x=ordered nearest triangle, y=active plane, z=triangle tests, w=BVH visits.
    const cache = instancedArray( cacheArray, 'uvec4' );
    const chainMap = instancedArray( new Uint32Array( chains ), 'uint' );
    const snapshot = instancedArray( particleCount, 'vec3' );
    const buffers = [ metadata, planes, cache, chainMap, snapshot, parameters ];
    const dt = uniform( 1 / 120 );
    let disposed = false;
    const requireLive = () => { if ( disposed ) throw new Error( 'Surface contact stage is disposed.' ); };

    const snapshotNode = Fn( () => {
        snapshot.element( instanceIndex ).assign( positionBuffer.element( instanceIndex ) );
        if ( cacheQueryInputs ) {
            // contactCount <= 2*particleCount: two disjoint guarded writes cover every record.
            // Every submitted batch must begin here; body/alpha must remain fixed within that batch.
            const invalidate = contact => If( contact.lessThan( uint( contactCount ) ), () => {
                metadata.element( contact.add( uint( contactCount ) ) ).assign( vec4( 0 ) );
                metadata.element( contact.add( uint( contactCount * 2 ) ) ).assign( vec4( 0 ) );
            } );
            invalidate( instanceIndex );
            invalidate( instanceIndex.add( uint( particleCount ) ) );
        }
    } )().compute( particleCount ).setName( 'surface contact snapshot' );

    const queryNode = Fn( () => {
        // Dispatch ring-major while all persistent records remain card-major. This bijection
        // groups the same ring and query type across chains without changing contact math,
        // metadata layout, cached triangle ownership, or serial projection order.
        const contact = instanceIndex.mod( uint( chains.length ) ).mul( uint( contactsPerChain ) )
            .add( instanceIndex.div( uint( chains.length ) ) ).toVar();
        const record = metadata.element( contact ).toVar();
        const a = positionBuffer.element( uint( record.x ) ).toVar();
        const b = positionBuffer.element( uint( record.y ) ).toVar();
        const margin = record.w.add( 0.0001 ).toVar();
        const seed = cache.element( contact ).x.toVar();
        const executeQuery = () => {
            // Derive the authored chain from the immutable particle index; no ninth storage binding.
            // Construct the scoped facade only on cache misses, inside the executing TSL branch.
            const scopedSurface = surface.forChain ? surface.forChain( uint( record.y ).div( uint( pointsPerChain ) ) ) : surface;
            // Disjoint root-bound queries cannot touch a patch triangle. Clear previous planes and
            // telemetry, retain the nearest ID as a future traversal seed, and provide a valid t.
            // This deliberately no longer applies distant local-normal "inside" projections when
            // the complete constant-width tube cannot intersect the open patch at all.
            planes.element( contact ).assign( vec4( 0 ) );
            parameters.element( contact ).assign( select( record.z.greaterThan( 0 ), float( 1 ), float( 0 ) ) );
            cache.element( contact ).assign( uvec4( seed, uint( 0 ), uint( 0 ), uint( 0 ) ) );
            const storeHit = ( hit, point, t ) => {
                const delta = point.sub( hit.closest ).toVar(), distanceSquared = dot( delta, delta ).toVar();
                const normal = vec3( 0 ).toVar();
                // At exact intersection/coplanar contact, Float32 closest-point arithmetic can leave
                // a tiny tangent residue. Normalizing it invents a lateral collision plane. Use the
                // authored outward normal within a conservative coordinate-scale uncertainty band:
                // 8 * Float32 epsilon * max(1 metre, |point|_infinity, |closest|_infinity).
                // This is a numerical direction fallback, not an additional collision margin.
                const coordinateMagnitude = max( abs( point ), abs( hit.closest ) ).toVar();
                const coordinateScale = max( max( coordinateMagnitude.x, coordinateMagnitude.y ), coordinateMagnitude.z ).toVar();
                const directionUncertainty = max( coordinateScale, 1 ).mul( 8 * 2 ** -23 ).toVar();
                If( distanceSquared.greaterThan( directionUncertainty.mul( directionUncertainty ) ), () => {
                    normal.assign( delta.div( sqrt( distanceSquared ) ).mul(
                        select( hit.signedDistance.lessThan( 0 ), float( -1 ), float( 1 ) ) ) );
                } ).Else( () => {
                    const normalSquared = dot( hit.normal, hit.normal ).toVar();
                    normal.assign( hit.normal.div( sqrt( max( normalSquared, 1e-30 ) ) ) );
                } );
                // This open-patch domain is intentionally different from CPU whole-body rechecks.
                const active = hit.valid.and( dot( normal, normal ).greaterThan( 0.5 ) ).and(
                    abs( hit.signedDistance ).lessThan( margin ).or(
                        hit.signedDistance.lessThan( 0 ).and( hit.openBoundary.not() ) ) ).toVar();
                planes.element( contact ).assign( select( active,
                    vec4( normal, dot( normal, hit.closest ).add( margin ) ), vec4( 0 ) ) );
                parameters.element( contact ).assign( t );
                cache.element( contact ).assign( uvec4( hit.orderedTriangle,
                    select( active, uint( 1 ), uint( 0 ) ), hit.trianglesTested ?? uint( 0 ), hit.nodesVisited ?? uint( 0 ) ) );
            };
            // Build the segment traversal inside the runtime branch; endpoint invocations only query a point.
            If( record.z.greaterThan( 0 ), () => {
                If( scopedSurface.mayOverlapSegment( b, b, margin ), () => {
                    const hit = scopedSurface.query( b, seed );
                    storeHit( hit, b, float( 1 ) );
                } );
            } ).Else( () => {
                If( scopedSurface.mayOverlapSegment( a, b, margin ), () => {
                    const hit = scopedSurface.querySegment( a, b, seed );
                    storeHit( hit, hit.segmentPoint, hit.segmentT );
                } );
            } );
        };
        if ( cacheQueryInputs ) {
            const previousA = metadata.element( contact.add( uint( contactCount ) ) ).toVar();
            const previousB = metadata.element( contact.add( uint( contactCount * 2 ) ) ).toVar();
            const sameB = all( floatBitsToUint( b ).equal( floatBitsToUint( previousB.xyz ) ) ).toVar();
            const sameA = all( floatBitsToUint( a ).equal( floatBitsToUint( previousA.xyz ) ) ).toVar();
            const sameInput = sameB.and( record.z.greaterThan( 0 ).or( sameA ) ).toVar();
            If( previousA.w.greaterThan( 0 ).and( sameInput ), () => {
                // Keep collision results and nearest seed; no traversal happened in this dispatch.
                const prior = cache.element( contact ).toVar();
                cache.element( contact ).assign( uvec4( prior.x, prior.y, uint( 0 ), uint( 0 ) ) );
                metadata.element( contact.add( uint( contactCount * 2 ) ) ).assign( vec4( b, 1 ) );
            } ).Else( () => {
                executeQuery();
                metadata.element( contact.add( uint( contactCount ) ) ).assign( vec4( a, 1 ) );
                metadata.element( contact.add( uint( contactCount * 2 ) ) ).assign( vec4( b, 0 ) );
            } );
        } else {
            executeQuery();
        }
    } )().compute( contactCount ).setName( 'surface adaptive contact ring-major queries' );

    const projectionNode = Fn( () => {
        const chain = chainMap.element( instanceIndex ).toVar();
        const base = chain.mul( uint( pointsPerChain ) ).toVar();
        const distanceConstraint = ring => {
            const index = base.add( ring ).toVar();
            const a = positionBuffer.element( index.sub( uint( 1 ) ) ).toVar();
            const b = positionBuffer.element( index ).toVar();
            const delta = b.sub( a ).toVar(), lengthSquared = dot( delta, delta ).toVar();
            const length = sqrt( lengthSquared ).toVar();
            const direction = vec3( 0, -1, 0 ).toVar();
            If( lengthSquared.greaterThan( 1e-24 ), () => { direction.assign( delta.div( length ) ); } );
            const wa = select( ring.equal( uint( 1 ) ), float( 0 ), float( 1 ) ).toVar();
            const correction = direction.mul( length.sub( restLengthBuffer.element( index ) ).div( wa.add( 1 ) ) ).toVar();
            If( wa.greaterThan( 0 ), () => {
                positionBuffer.element( index.sub( uint( 1 ) ) ).assign( a.add( correction.mul( wa ) ) );
            } );
            positionBuffer.element( index ).assign( b.sub( correction ) );
        };
        Loop( { start: 0, end: lengthIterations, type: 'uint' }, () => {
            Loop( { start: 1, end: pointsPerChain, type: 'uint' }, ( { i } ) => { distanceConstraint( i ); } );
            Loop( { start: 1, end: pointsPerChain, type: 'uint' }, ( { i } ) => {
                distanceConstraint( uint( pointsPerChain ).sub( i ) );
            } );
        } );
        const contactBase = instanceIndex.mul( uint( contactsPerChain ) ).toVar();
        Loop( { start: 0, end: contactsPerChain, type: 'uint' }, ( { i } ) => {
            const contact = contactBase.add( i ).toVar();
            const plane = planes.element( contact ).toVar();
            If( dot( plane.xyz, plane.xyz ).greaterThan( 0.5 ), () => {
                const record = metadata.element( contact ).toVar();
                const ia = uint( record.x ).toVar(), ib = uint( record.y ).toVar();
                const a = positionBuffer.element( ia ).toVar(), b = positionBuffer.element( ib ).toVar();
                const beta = parameters.element( contact ).toVar(), alpha = float( 1 ).sub( beta ).toVar();
                const wa = select( ia.equal( base ), float( 0 ), float( 1 ) ).toVar();
                const wb = select( ib.equal( base ), float( 0 ), float( 1 ) ).toVar();
                const point = a.mul( alpha ).add( b.mul( beta ) ).toVar();
                const deficit = max( plane.w.sub( dot( plane.xyz, point ) ), 0 ).toVar();
                const denominator = max( wa.mul( alpha.mul( alpha ) ).add( wb.mul( beta.mul( beta ) ) ), 1e-12 ).toVar();
                const correction = plane.xyz.mul( deficit.div( denominator ) ).toVar();
                If( wa.mul( alpha ).greaterThan( 0 ), () => {
                    positionBuffer.element( ia ).assign( a.add( correction.mul( wa.mul( alpha ) ) ) );
                } );
                If( wb.mul( beta ).greaterThan( 0 ), () => {
                    positionBuffer.element( ib ).assign( b.add( correction.mul( wb.mul( beta ) ) ) );
                } );
            } );
        } );
    } )().compute( chains.length ).setName( 'surface contact coupled chain projection' );

    const finalizeNode = Fn( () => {
        const delta = positionBuffer.element( instanceIndex ).sub( snapshot.element( instanceIndex ) ).toVar();
        velocityBuffer.element( instanceIndex ).addAssign( delta.div( max( dt, 1e-9 ) ) );
    } )().compute( particleCount ).setName( 'surface contact velocity correction' );

    const nodes = [ snapshotNode ];
    for ( let i = 0; i < outerIterations; i ++ ) nodes.push( queryNode, projectionNode );
    nodes.push( finalizeNode );
    const uniqueNodes = [ snapshotNode, queryNode, projectionNode, finalizeNode ];
    return {
        get nodes() { requireLive(); return nodes; },
        snapshotNode, queryNode, projectionNode, finalizeNode,
        buffers, namedBuffers: { metadata, planes, cache, chainMap, snapshot, parameters }, dt,
        counts: { particleCount, activeChainCount: chains.length, contactCount, contactsPerChain,
            queryStorageBindings: 8, projectionStorageBindings: 6, outerIterations, lengthIterations,
            queryInputReuse: { enabled: cacheQueryInputs, metadataRecords: contactCount * ( cacheQueryInputs ? 3 : 1 ),
                validBlock: cacheQueryInputs ? contactCount : null, reusedBlock: cacheQueryInputs ? contactCount * 2 : null,
                snapshotInvalidates: cacheQueryInputs, traversalCountsExcludeReused: cacheQueryInputs } },
        setDt( seconds ) {
            requireLive();
            if ( !Number.isFinite( seconds ) || seconds <= 0 ) throw new Error( 'Contact dt must be finite and positive.' );
            dt.value = seconds;
        },
        dispose() {
            if ( disposed ) return;
            disposed = true;
            const errors = [];
            for ( const node of uniqueNodes ) {
                try { node.dispose(); } catch ( error ) { errors.push( error ); }
            }
            for ( const buffer of buffers ) {
                try { renderer?._attributes?.delete( buffer.value ); } catch ( error ) { errors.push( error ); }
            }
            if ( errors.length === 1 ) throw errors[ 0 ];
            if ( errors.length > 1 ) throw new AggregateError( errors, 'Surface contact disposal failed.' );
        }
    };
}
