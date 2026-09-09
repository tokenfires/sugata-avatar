/** Nearest point/whole-segment queries on a moving open surface patch.
 * Three shared storage bindings; cached seeds only tighten a complete BVH traversal.
 * Near-parallel pairs use a cross-product solve and four endpoint candidates.
 * Caller owns the validated CPU patch and the renderer; query owns only its buffers.
 */
import {
    Fn, If, Loop, Break, bool, instancedArray, uint, float, vec2, vec3, vec4,
    dot, cross, max, min, sqrt, select, clamp, abs
} from 'three/tsl';

// Ericson triangle regions, including degenerate segment/point fallbacks.
const triangleBarycentric = Fn( ( [ point, a, b, c ] ) => {
    const result = vec3( 0 ).toVar(), done = bool( false ).toVar();
    const ab = b.sub( a ).toVar(), ac = c.sub( a ).toVar();
    const area = cross( ab, ac ).toVar();
    If( dot( area, area ).lessThanEqual( 1e-24 ), () => {
        const bestDistance = float( 1e30 ).toVar();
        result.assign( vec3( 1, 0, 0 ) );
        for ( const [ start, end, weightsA, weightsB ] of [
            [ a, b, vec3( 1, 0, 0 ), vec3( 0, 1, 0 ) ],
            [ b, c, vec3( 0, 1, 0 ), vec3( 0, 0, 1 ) ],
            [ c, a, vec3( 0, 0, 1 ), vec3( 1, 0, 0 ) ]
        ] ) {
            const edge = end.sub( start ).toVar();
            const fraction = min( max( dot( point.sub( start ), edge )
                .div( max( dot( edge, edge ), 1e-30 ) ), 0 ), 1 ).toVar();
            const delta = point.sub( start.add( edge.mul( fraction ) ) ).toVar();
            const distance = dot( delta, delta ).toVar();
            If( distance.lessThan( bestDistance ), () => {
                bestDistance.assign( distance );
                result.assign( weightsA.mul( float( 1 ).sub( fraction ) ).add( weightsB.mul( fraction ) ) );
            } );
        }
        done.assign( true );
    } );
    const ap = point.sub( a ).toVar(), d1 = dot( ab, ap ).toVar(), d2 = dot( ac, ap ).toVar();
    If( done.not().and( d1.lessThanEqual( 0 ).and( d2.lessThanEqual( 0 ) ) ), () => { result.assign( vec3( 1, 0, 0 ) ); done.assign( true ); } );
    const bp = point.sub( b ).toVar(), d3 = dot( ab, bp ).toVar(), d4 = dot( ac, bp ).toVar();
    If( done.not().and( d3.greaterThanEqual( 0 ).and( d4.lessThanEqual( d3 ) ) ), () => { result.assign( vec3( 0, 1, 0 ) ); done.assign( true ); } );
    const vc = d1.mul( d4 ).sub( d3.mul( d2 ) ).toVar();
    If( done.not().and( vc.lessThanEqual( 0 ).and( d1.greaterThanEqual( 0 ) ).and( d3.lessThanEqual( 0 ) ) ), () => {
        const v = d1.div( max( d1.sub( d3 ), 1e-30 ) ).toVar();
        result.assign( vec3( float( 1 ).sub( v ), v, 0 ) ); done.assign( true );
    } );
    const cp = point.sub( c ).toVar(), d5 = dot( ab, cp ).toVar(), d6 = dot( ac, cp ).toVar();
    If( done.not().and( d6.greaterThanEqual( 0 ).and( d5.lessThanEqual( d6 ) ) ), () => { result.assign( vec3( 0, 0, 1 ) ); done.assign( true ); } );
    const vb = d5.mul( d2 ).sub( d1.mul( d6 ) ).toVar();
    If( done.not().and( vb.lessThanEqual( 0 ).and( d2.greaterThanEqual( 0 ) ).and( d6.lessThanEqual( 0 ) ) ), () => {
        const w = d2.div( max( d2.sub( d6 ), 1e-30 ) ).toVar();
        result.assign( vec3( float( 1 ).sub( w ), 0, w ) ); done.assign( true );
    } );
    const va = d3.mul( d6 ).sub( d5.mul( d4 ) ).toVar();
    If( done.not().and( va.lessThanEqual( 0 ).and( d4.sub( d3 ).greaterThanEqual( 0 ) )
        .and( d5.sub( d6 ).greaterThanEqual( 0 ) ) ), () => {
        const w = d4.sub( d3 ).div( max( d4.sub( d3 ).add( d5.sub( d6 ) ), 1e-30 ) ).toVar();
        result.assign( vec3( 0, float( 1 ).sub( w ), w ) ); done.assign( true );
    } );
    const denominator = max( va.add( vb ).add( vc ), 1e-30 ).toVar();
    const v = vb.div( denominator ).toVar(), w = vc.div( denominator ).toVar();
    If( done.not(), () => { result.assign( vec3( float( 1 ).sub( v ).sub( w ), v, w ) ); } );
    return result;
} ).setLayout( {
    name: 'hairSurfaceTriangleBarycentric', type: 'vec3', inputs: [
        { name: 'point', type: 'vec3' }, { name: 'a', type: 'vec3' },
        { name: 'b', type: 'vec3' }, { name: 'c', type: 'vec3' }
    ]
} );

// Closest finite-segment pair: four boundary candidates and a cross-product interior solve.
// Avoid aa*ee-bb*bb: it cancels for nearly parallel segments in Float32.
const segmentParameters = Fn( ( [ a, b, c, d ] ) => {
    const u = b.sub( a ).toVar(), v = d.sub( c ).toVar(), w = a.sub( c ).toVar();
    const uu = dot( u, u ).toVar(), vv = dot( v, v ).toVar();
    const result = vec2( 0 ).toVar(), best = float( 1e30 ).toVar();
    const pointParameter = ( point, start, direction, squaredLength ) =>
        clamp( dot( point.sub( start ), direction ).div( max( squaredLength, 1e-30 ) ), 0, 1 );
    const consider = ( s, t ) => {
        const delta = a.add( u.mul( s ) ).sub( c.add( v.mul( t ) ) ).toVar();
        const distance = dot( delta, delta ).toVar();
        If( distance.lessThan( best ).or( distance.equal( best ).and( s.lessThan( result.x ) ) ), () => {
            best.assign( distance ); result.assign( vec2( s, t ) );
        } );
    };
    consider( float( 0 ), pointParameter( a, c, v, vv ).toVar() );
    consider( float( 1 ), pointParameter( b, c, v, vv ).toVar() );
    consider( pointParameter( c, a, u, uu ).toVar(), float( 0 ) );
    consider( pointParameter( d, a, u, uu ).toVar(), float( 1 ) );
    const n = cross( u, v ).toVar(), denominator = dot( n, n ).toVar();
    If( denominator.greaterThan( 1e-30 ), () => {
        const s = dot( cross( v, w ), n ).div( denominator ).toVar();
        const t = dot( cross( u, w ), n ).div( denominator ).toVar();
        If( s.greaterThanEqual( 0 ).and( s.lessThanEqual( 1 ) ).and( t.greaterThanEqual( 0 ) ).and( t.lessThanEqual( 1 ) ), () => {
            consider( s, t );
        } );
    } );
    return result;
} ).setLayout( { name: 'hairSurfaceSegmentParameters', type: 'vec2', inputs:
    [ 'a', 'b', 'c', 'd' ].map( name => ( { name, type: 'vec3' } ) ) } );

// Convex minimum: the two endpoint/face cases, three segment/edge cases, and interior crossing.
const segmentTriangleCoordinates = Fn( ( [ p, q, a, b, c ] ) => {
    const result = vec4( 1, 0, 0, 0 ).toVar(), bestDistance = float( 1e30 ).toVar();
    const direction = q.sub( p ).toVar();
    const consider = ( t, bary ) => {
        const onSegment = p.add( direction.mul( t ) ).toVar();
        const onTriangle = a.mul( bary.x ).add( b.mul( bary.y ) ).add( c.mul( bary.z ) ).toVar();
        const delta = onSegment.sub( onTriangle ).toVar(), d2 = dot( delta, delta ).toVar();
        If( d2.lessThan( bestDistance ), () => { bestDistance.assign( d2 ); result.assign( vec4( bary, t ) ); } );
    };
    consider( float( 0 ), triangleBarycentric( p, a, b, c ).toVar() );
    consider( float( 1 ), triangleBarycentric( q, a, b, c ).toVar() );
    for ( const [ start, end, wa, wb ] of [
        [ a, b, vec3( 1, 0, 0 ), vec3( 0, 1, 0 ) ],
        [ b, c, vec3( 0, 1, 0 ), vec3( 0, 0, 1 ) ],
        [ c, a, vec3( 0, 0, 1 ), vec3( 1, 0, 0 ) ]
    ] ) {
        const parameters = segmentParameters( p, q, start, end ).toVar();
        consider( parameters.x, wa.mul( float( 1 ).sub( parameters.y ) ).add( wb.mul( parameters.y ) ).toVar() );
    }
    const ab = b.sub( a ).toVar(), ac = c.sub( a ).toVar(), h = cross( direction, ac ).toVar();
    const determinant = dot( ab, h ).toVar();
    If( abs( determinant ).greaterThan( 1e-20 ), () => {
        const inverse = float( 1 ).div( determinant ).toVar(), r = p.sub( a ).toVar();
        const u = dot( r, h ).mul( inverse ).toVar(), k = cross( r, ab ).toVar();
        const v = dot( direction, k ).mul( inverse ).toVar(), t = dot( ac, k ).mul( inverse ).toVar();
        If( u.greaterThanEqual( 0 ).and( v.greaterThanEqual( 0 ) ).and( u.add( v ).lessThanEqual( 1 ) )
            .and( t.greaterThanEqual( 0 ) ).and( t.lessThanEqual( 1 ) ), () => {
            consider( t, vec3( float( 1 ).sub( u ).sub( v ), u, v ) );
        } );
    } );
    return result;
} ).setLayout( { name: 'hairSurfaceSegmentTriangleCoordinates', type: 'vec4', inputs:
    [ 'p', 'q', 'a', 'b', 'c' ].map( name => ( { name, type: 'vec3' } ) ) } );

export function createSurfaceQuery( patch, motion ) {
    if ( !patch.meta?.length || !patch.triangles?.length ) throw new Error( 'A nonempty validated surface patch is required.' );
    // Three storage bindings keep this query below the default WebGPU limit.
    const vertexCount = patch.positions.length / 4;
    const nodeCount = patch.meta.length / 4;
    const vertexArray = new Float32Array( patch.positions.length * 4 );
    const boundsArray = new Float32Array( patch.boundsMin.length * 2 );
    const topologyArray = new Uint32Array( patch.meta.length + patch.triangles.length );
    topologyArray.set( patch.meta );
    topologyArray.set( patch.triangles, patch.meta.length );
    for ( let i = 0; i < patch.triangles.length / 4; i ++ ) {
        const source = patch.triangles[ i * 4 + 3 ];
        if ( source > 0x00ffffff ) throw new Error( 'Source triangle ID exceeds packed query capacity.' );
        topologyArray[ patch.meta.length + i * 4 + 3 ] = ( source << 8 ) | patch.boundaryMasks[ i ];
    }
    const copyDynamic = () => {
        vertexArray.set( patch.positions ); vertexArray.set( patch.normals, patch.positions.length );
        vertexArray.set( motion.previousPositions, patch.positions.length * 2 );
        vertexArray.set( motion.previousNormals, patch.positions.length * 3 );
        boundsArray.set( motion.unionBoundsMin ); boundsArray.set( motion.unionBoundsMax, patch.boundsMin.length );
    };
    copyDynamic();
    const vertices = instancedArray( vertexArray, 'vec4' );
    const bounds = instancedArray( boundsArray, 'vec4' );
    const topology = instancedArray( topologyArray, 'uvec4' );
    const buffers = [ vertices, bounds, topology ];
    let disposed = false;
    return {
        buffers,
        update() {
            if ( disposed ) throw new Error( 'Surface query is disposed.' );
            copyDynamic();
            vertices.value.needsUpdate = true; bounds.value.needsUpdate = true;
        },
        // Conservative broad phase for the entire finite-width ribbon span. Every ribbon
        // point lies within max(endpoint offset norms) of the center segment. Segment-AABB
        // distance to the patch root union-AABB is a lower bound, so a disjoint tube cannot
        // intersect any patch triangle at any interpolated submitted pose. It is NOT an SDF.
        mayOverlapSegment( a, b, radius ) {
            if ( disposed ) throw new Error( 'Surface query is disposed.' );
            const segmentLow = min( a, b ).toVar(), segmentHigh = max( a, b ).toVar();
            const low = bounds.element( uint( 0 ) ).xyz.toVar();
            const high = bounds.element( uint( nodeCount ) ).xyz.toVar();
            const gap = max( max( low.sub( segmentHigh ), segmentLow.sub( high ) ), vec3( 0 ) ).toVar();
            const magnitude = max( max( abs( a ), abs( b ) ), max( abs( low ), abs( high ) ) ).toVar();
            const scale = max( max( magnitude.x, magnitude.y ), max( magnitude.z, 1 ) ).toVar();
            // Extra numerical allowance only admits more narrow-phase work; contact margin is unchanged.
            const guardedRadius = radius.add( scale.mul( 8 * 2 ** -23 ) ).toVar();
            return dot( gap, gap ).lessThanEqual( guardedRadius.mul( guardedRadius ) );
        },
        // Invoke while constructing a TSL Fn. The returned fields are nodes in that kernel.
        query( point, seedTriangle = uint( 0xffffffff ), alpha = float( 1 ) ) {
            if ( disposed ) throw new Error( 'Surface query is disposed.' );
            const positionAt = index => vertices.element( index.add( uint( vertexCount * 2 ) ) ).xyz.mul( float( 1 ).sub( alpha ) ).add( vertices.element( index ).xyz.mul( alpha ) );
            const normalAt = index => vertices.element( index.add( uint( vertexCount * 3 ) ) ).xyz.mul( float( 1 ).sub( alpha ) ).add( vertices.element( index.add( uint( vertexCount ) ) ).xyz.mul( alpha ) );
            const bestDistanceSquared = float( 1e30 ).toVar();
            const closest = vec3( 0 ).toVar(), normal = vec3( 0 ).toVar(), barycentric = vec3( 0 ).toVar();
            const sourceTriangle = uint( 0xffffffff ).toVar(), orderedTriangle = uint( 0xffffffff ).toVar(), bestMask = uint( 0 ).toVar();
            const node = uint( 0 ).toVar(), nodesVisited = uint( 0 ).toVar(), trianglesTested = uint( 0 ).toVar();
            const considerTriangle = triangleIndex => {
                trianglesTested.addAssign( 1 );
                const triangle = topology.element( triangleIndex.add( uint( nodeCount ) ) ).toVar();
                const triangleId = triangle.w.shiftRight( uint( 8 ) ).toVar();
                const a = positionAt( triangle.x ).toVar();
                const b = positionAt( triangle.y ).toVar();
                const c = positionAt( triangle.z ).toVar();
                const weights = triangleBarycentric( point, a, b, c ).toVar();
                const candidate = a.mul( weights.x ).add( b.mul( weights.y ) ).add( c.mul( weights.z ) ).toVar();
                const delta = point.sub( candidate ).toVar(), distanceSquared = dot( delta, delta ).toVar();
                If( distanceSquared.lessThan( bestDistanceSquared ).or(
                    distanceSquared.equal( bestDistanceSquared ).and( triangleId.lessThan( sourceTriangle ) ) ), () => {
                    bestDistanceSquared.assign( distanceSquared );
                    closest.assign( candidate );
                    barycentric.assign( weights );
                    sourceTriangle.assign( triangleId );
                    orderedTriangle.assign( triangleIndex );
                    bestMask.assign( triangle.w.bitAnd( uint( 255 ) ) );
                    const interpolated = normalAt( triangle.x ).mul( weights.x )
                        .add( normalAt( triangle.y ).mul( weights.y ) )
                        .add( normalAt( triangle.z ).mul( weights.z ) ).toVar();
                    normal.assign( interpolated.div( sqrt( max( dot( interpolated, interpolated ), 1e-30 ) ) ) );
                } );
            };
            // A cached nearest triangle is a distance upper bound, never an exclusive candidate.
            If( seedTriangle.lessThan( uint( patch.triangles.length / 4 ) ), () => {
                considerTriangle( seedTriangle );
            } );
            Loop( { start: 0, end: nodeCount, type: 'uint' }, () => {
                If( node.greaterThanEqual( uint( nodeCount ) ), () => Break() );
                nodesVisited.addAssign( 1 );
                const boxLow = bounds.element( node ).xyz.toVar(), boxHigh = bounds.element( node.add( uint( nodeCount ) ) ).xyz.toVar();
                const boxDelta = max( max( boxLow.sub( point ), point.sub( boxHigh ) ), vec3( 0 ) ).toVar();
                const meta = topology.element( node ).toVar();
                If( dot( boxDelta, boxDelta ).greaterThan( bestDistanceSquared ), () => {
                    node.assign( meta.x );
                } ).Else( () => {
                    If( meta.z.greaterThan( 0 ), () => {
                        Loop( { start: meta.y, end: meta.y.add( meta.z ), type: 'uint' }, ( { i } ) => {
                            considerTriangle( i );
                        } );
                        node.assign( meta.x );
                    } ).Else( () => { node.addAssign( 1 ); } );
                } );
            } );
            const distance = sqrt( bestDistanceSquared ).toVar();
            const signedDistance = select( dot( point.sub( closest ), normal ).lessThan( 0 ), distance.negate(), distance ).toVar();
            const openBoundary = barycentric.x.lessThan( 1e-7 ).and( bestMask.bitAnd( uint( 1 ) ).notEqual( 0 ) )
                .or( barycentric.y.lessThan( 1e-7 ).and( bestMask.bitAnd( uint( 2 ) ).notEqual( 0 ) ) )
                .or( barycentric.z.lessThan( 1e-7 ).and( bestMask.bitAnd( uint( 4 ) ).notEqual( 0 ) ) )
                .or( barycentric.x.greaterThan( 1 - 1e-7 ).and( bestMask.bitAnd( uint( 8 ) ).notEqual( 0 ) ) )
                .or( barycentric.y.greaterThan( 1 - 1e-7 ).and( bestMask.bitAnd( uint( 16 ) ).notEqual( 0 ) ) )
                .or( barycentric.z.greaterThan( 1 - 1e-7 ).and( bestMask.bitAnd( uint( 32 ) ).notEqual( 0 ) ) );
            return { closest, normal, barycentric, signedDistance, sourceTriangle, orderedTriangle, openBoundary,
                nodesVisited, trianglesTested, valid: sourceTriangle.notEqual( uint( 0xffffffff ) ) };
        },
        querySegment( segmentStart, segmentEnd, seedTriangle = uint( 0xffffffff ), alpha = float( 1 ) ) {
            if ( disposed ) throw new Error( 'Surface query is disposed.' );
            const positionAt = index => vertices.element( index.add( uint( vertexCount * 2 ) ) ).xyz.mul( float( 1 ).sub( alpha ) ).add( vertices.element( index ).xyz.mul( alpha ) );
            const normalAt = index => vertices.element( index.add( uint( vertexCount * 3 ) ) ).xyz.mul( float( 1 ).sub( alpha ) ).add( vertices.element( index.add( uint( vertexCount ) ) ).xyz.mul( alpha ) );
            const bestDistanceSquared = float( 1e30 ).toVar();
            const segmentPoint = vec3( segmentStart ).toVar(), segmentT = float( 0 ).toVar();
            const closest = vec3( 0 ).toVar(), normal = vec3( 0 ).toVar(), barycentric = vec3( 0 ).toVar();
            const sourceTriangle = uint( 0xffffffff ).toVar(), orderedTriangle = uint( 0xffffffff ).toVar(), bestMask = uint( 0 ).toVar();
            const node = uint( 0 ).toVar(), nodesVisited = uint( 0 ).toVar(), trianglesTested = uint( 0 ).toVar();
            const considerTriangle = triangleIndex => {
                trianglesTested.addAssign( 1 );
                const triangle = topology.element( triangleIndex.add( uint( nodeCount ) ) ).toVar();
                const triangleId = triangle.w.shiftRight( uint( 8 ) ).toVar();
                const a = positionAt( triangle.x ).toVar();
                const b = positionAt( triangle.y ).toVar();
                const c = positionAt( triangle.z ).toVar();
                const coordinates = segmentTriangleCoordinates( segmentStart, segmentEnd, a, b, c ).toVar();
                const weights = coordinates.xyz.toVar();
                const onSegment = segmentStart.add( segmentEnd.sub( segmentStart ).mul( coordinates.w ) ).toVar();
                const candidate = a.mul( weights.x ).add( b.mul( weights.y ) ).add( c.mul( weights.z ) ).toVar();
                const delta = onSegment.sub( candidate ).toVar(), distanceSquared = dot( delta, delta ).toVar();
                If( distanceSquared.lessThan( bestDistanceSquared ).or(
                    distanceSquared.equal( bestDistanceSquared ).and( triangleId.lessThan( sourceTriangle ) ) ), () => {
                    bestDistanceSquared.assign( distanceSquared );
                    closest.assign( candidate );
                    segmentPoint.assign( onSegment ); segmentT.assign( coordinates.w );
                    barycentric.assign( weights );
                    sourceTriangle.assign( triangleId );
                    orderedTriangle.assign( triangleIndex );
                    bestMask.assign( triangle.w.bitAnd( uint( 255 ) ) );
                    const interpolated = normalAt( triangle.x ).mul( weights.x )
                        .add( normalAt( triangle.y ).mul( weights.y ) )
                        .add( normalAt( triangle.z ).mul( weights.z ) ).toVar();
                    normal.assign( interpolated.div( sqrt( max( dot( interpolated, interpolated ), 1e-30 ) ) ) );
                } );
            };
            // A cached nearest triangle is a distance upper bound, never an exclusive candidate.
            If( seedTriangle.lessThan( uint( patch.triangles.length / 4 ) ), () => {
                considerTriangle( seedTriangle );
            } );
            Loop( { start: 0, end: nodeCount, type: 'uint' }, () => {
                If( node.greaterThanEqual( uint( nodeCount ) ), () => Break() );
                nodesVisited.addAssign( 1 );
                const boxLow = bounds.element( node ).xyz.toVar(), boxHigh = bounds.element( node.add( uint( nodeCount ) ) ).xyz.toVar();
                const boxDelta = max( max( boxLow.sub( max( segmentStart, segmentEnd ) ), min( segmentStart, segmentEnd ).sub( boxHigh ) ), vec3( 0 ) ).toVar();
                const meta = topology.element( node ).toVar();
                If( dot( boxDelta, boxDelta ).greaterThan( bestDistanceSquared ), () => {
                    node.assign( meta.x );
                } ).Else( () => {
                    If( meta.z.greaterThan( 0 ), () => {
                        Loop( { start: meta.y, end: meta.y.add( meta.z ), type: 'uint' }, ( { i } ) => {
                            considerTriangle( i );
                        } );
                        node.assign( meta.x );
                    } ).Else( () => { node.addAssign( 1 ); } );
                } );
            } );
            const distance = sqrt( bestDistanceSquared ).toVar();
            const signedDistance = select( dot( segmentPoint.sub( closest ), normal ).lessThan( 0 ), distance.negate(), distance ).toVar();
            const openBoundary = barycentric.x.lessThan( 1e-7 ).and( bestMask.bitAnd( uint( 1 ) ).notEqual( 0 ) )
                .or( barycentric.y.lessThan( 1e-7 ).and( bestMask.bitAnd( uint( 2 ) ).notEqual( 0 ) ) )
                .or( barycentric.z.lessThan( 1e-7 ).and( bestMask.bitAnd( uint( 4 ) ).notEqual( 0 ) ) )
                .or( barycentric.x.greaterThan( 1 - 1e-7 ).and( bestMask.bitAnd( uint( 8 ) ).notEqual( 0 ) ) )
                .or( barycentric.y.greaterThan( 1 - 1e-7 ).and( bestMask.bitAnd( uint( 16 ) ).notEqual( 0 ) ) )
                .or( barycentric.z.greaterThan( 1 - 1e-7 ).and( bestMask.bitAnd( uint( 32 ) ).notEqual( 0 ) ) );
            return { closest, segmentPoint, segmentT, normal, barycentric, signedDistance, sourceTriangle, orderedTriangle, openBoundary,
                nodesVisited, trianglesTested, valid: sourceTriangle.notEqual( uint( 0xffffffff ) ) };
        },
        dispose( renderer ) {
            if ( disposed ) return;
            disposed = true;
            const errors = [];
            for ( const buffer of buffers ) {
                try { renderer?._attributes?.delete( buffer.value ); } catch ( error ) { errors.push( error ); }
            }
            if ( errors.length === 1 ) throw errors[ 0 ];
            if ( errors.length > 1 ) throw new AggregateError( errors, 'Surface query buffer disposal failed.' );
        }
    };
}
