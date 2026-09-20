/** Offline height fit for the calibrated trouser cuff, with a longitudinal spacing constraint.
 * The gap is vertical over common XZ footprints, not a nearest-surface distance guarantee.
 * General folded surfaces, degenerate projections and arbitrary garments are not supported.
 */
export function fitCuffHeight( original, positions, shoes, { clearance = .002, movableBelow = .18, maximumLift = .035 } = {} ) {
    const pointAt = ( p, i ) => [ p[ i * 3 ], p[ i * 3 + 1 ], p[ i * 3 + 2 ] ];
    const cross = ( a, b ) => a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ];
    function barycentric( point, tri ) {
        const a = [ tri[ 1 ][ 0 ] - tri[ 0 ][ 0 ], tri[ 1 ][ 2 ] - tri[ 0 ][ 2 ] ];
        const b = [ tri[ 2 ][ 0 ] - tri[ 0 ][ 0 ], tri[ 2 ][ 2 ] - tri[ 0 ][ 2 ] ];
        const q = [ point[ 0 ] - tri[ 0 ][ 0 ], point[ 1 ] - tri[ 0 ][ 2 ] ];
        const determinant = cross( a, b );
        if ( Math.abs( determinant ) < 1e-10 ) return null;
        const v = cross( q, b ) / determinant, w = cross( a, q ) / determinant;
        return [ 1 - v - w, v, w ];
    }
    function clip( polygon, triangle ) {
        const orientation = Math.sign( cross(
            [ triangle[ 1 ][ 0 ] - triangle[ 0 ][ 0 ], triangle[ 1 ][ 2 ] - triangle[ 0 ][ 2 ] ],
            [ triangle[ 2 ][ 0 ] - triangle[ 0 ][ 0 ], triangle[ 2 ][ 2 ] - triangle[ 0 ][ 2 ] ]
        ) );
        if ( ! orientation ) return [];
        for ( let edge = 0; edge < 3; edge ++ ) {
            const a = triangle[ edge ], b = triangle[ ( edge + 1 ) % 3 ];
            const side = p => orientation * cross( [ b[ 0 ] - a[ 0 ], b[ 2 ] - a[ 2 ] ], [ p[ 0 ] - a[ 0 ], p[ 1 ] - a[ 2 ] ] );
            const output = [];
            if ( ! polygon.length ) break;
            for ( let i = 0; i < polygon.length; i ++ ) {
                const p = polygon[ i ], q = polygon[ ( i + 1 ) % polygon.length ];
                const dp = side( p ), dq = side( q ), insideP = dp >= -1e-12, insideQ = dq >= -1e-12;
                if ( insideP ) output.push( p );
                if ( insideP !== insideQ ) {
                    const t = dp / ( dp - dq );
                    output.push( [ p[ 0 ] + ( q[ 0 ] - p[ 0 ] ) * t, p[ 1 ] + ( q[ 1 ] - p[ 1 ] ) * t ] );
                }
            }
            polygon = output;
        }
        return polygon;
    }

    // Duplicate UV vertices receive exactly the same vertical displacement.
    const keyMap = new Map(), groups = [], groupOf = [];
    for ( let i = 0; i < original.vertexCount; i ++ ) {
        const key = pointAt( original.positions, i ).map( value => Math.round( value / 1e-7 ) ).join( ':' );
        let group = keyMap.get( key );
        if ( ! group ) {
            group = { id: groups.length, vertices: [], lift: 0, movable: original.positions[ i * 3 + 1 ] < movableBelow };
            keyMap.set( key, group ); groups.push( group );
        }
        group.vertices.push( i ); groupOf[ i ] = group;
    }
    const shoeTriangles = [];
    for ( let t = 0; t < shoes.indices.length; t += 3 ) {
        const tri = Array.from( shoes.indices.slice( t, t + 3 ), i => pointAt( shoes.positions, i ) );
        shoeTriangles.push( {
            tri, minX: Math.min( ...tri.map( p => p[ 0 ] ) ), maxX: Math.max( ...tri.map( p => p[ 0 ] ) ),
            minZ: Math.min( ...tri.map( p => p[ 2 ] ) ), maxZ: Math.max( ...tri.map( p => p[ 2 ] ) )
        } );
    }
    const constraints = [];
    let skippedDegenerateProjections = 0;
    for ( let t = 0; t < original.indices.length; t += 3 ) {
        const ids = Array.from( original.indices.slice( t, t + 3 ) );
        if ( ! ids.some( i => groupOf[ i ].movable ) ) continue;
        const tri = ids.map( i => pointAt( positions, i ) );
        const minX = Math.min( ...tri.map( p => p[ 0 ] ) ), maxX = Math.max( ...tri.map( p => p[ 0 ] ) );
        const minZ = Math.min( ...tri.map( p => p[ 2 ] ) ), maxZ = Math.max( ...tri.map( p => p[ 2 ] ) );
        if ( ! barycentric( [ tri[ 0 ][ 0 ], tri[ 0 ][ 2 ] ], tri ) ) { skippedDegenerateProjections ++; continue; }
        for ( const shoe of shoeTriangles ) {
            if ( minX > shoe.maxX || maxX < shoe.minX || minZ > shoe.maxZ || maxZ < shoe.minZ ) continue;
            const polygon = clip( tri.map( p => [ p[ 0 ], p[ 2 ] ] ), shoe.tri );
            for ( const point of polygon ) {
                let weights = barycentric( point, tri );
                const shoeWeights = barycentric( point, shoe.tri );
                if ( ! weights || ! shoeWeights ) { skippedDegenerateProjections ++; continue; }
                weights = weights.map( weight => Math.max( 0, weight ) );
                const sum = weights.reduce( ( a, b ) => a + b, 0 );
                weights = weights.map( weight => weight / sum );
                const clothY = weights.reduce( ( value, weight, i ) => value + weight * tri[ i ][ 1 ], 0 );
                const shoeY = shoeWeights.reduce( ( value, weight, i ) => value + weight * shoe.tri[ i ][ 1 ], 0 );
                const rhs = shoeY + clearance - clothY;
                if ( rhs <= 0 ) continue;
                const terms = new Map();
                for ( let i = 0; i < 3; i ++ ) if ( groupOf[ ids[ i ] ].movable ) {
                    const id = groupOf[ ids[ i ] ].id;
                    terms.set( id, ( terms.get( id ) || 0 ) + weights[ i ] );
                }
                const values = [ ...terms ].filter( ( [ , weight ] ) => weight > 1e-10 );
                if ( ! values.length ) throw new Error( 'Cuff requires moving a fixed upper point' );
                constraints.push( { triangle: t / 3, values, rhs } );
            }
        }
    }
    // Positive corrections cannot undo an earlier positive-weight clearance constraint.
    constraints.sort( ( a, b ) => b.rhs - a.rhs );
    for ( const constraint of constraints ) {
        const deficit = constraint.rhs - constraint.values.reduce( ( sum, [ i, weight ] ) => sum + groups[ i ].lift * weight, 0 );
        if ( deficit <= 0 ) continue;
        const norm = constraint.values.reduce( ( sum, [ , weight ] ) => sum + weight * weight, 0 );
        for ( const [ i, weight ] of constraint.values ) groups[ i ].lift += deficit * weight / norm;
    }

    // Carry a lifted hem into its next longitudinal row. A hem-only lift had folded one triangle.
    // This preserves half the source vertical spacing on steep edges; self contacts are separately checked.
    const longitudinal = [];
    for ( let t = 0; t < original.indices.length; t += 3 ) for ( let k = 0; k < 3; k ++ ) {
        let a = original.indices[ t + k ], b = original.indices[ t + ( k + 1 ) % 3 ];
        if ( original.positions[ a * 3 + 1 ] > original.positions[ b * 3 + 1 ] ) [ a, b ] = [ b, a ];
        const dy = original.positions[ b * 3 + 1 ] - original.positions[ a * 3 + 1 ];
        const horizontal = Math.hypot( original.positions[ b * 3 ] - original.positions[ a * 3 ], original.positions[ b * 3 + 2 ] - original.positions[ a * 3 + 2 ] );
        if ( dy > .008 && dy > horizontal * .5 ) longitudinal.push( { a: groupOf[ a ].id, b: groupOf[ b ].id, dy, y: original.positions[ a * 3 + 1 ] } );
    }
    longitudinal.sort( ( a, b ) => a.y - b.y );
    let propagated = 0;
    for ( const edge of longitudinal ) {
        const required = groups[ edge.a ].lift - edge.dy * .5;
        if ( required > groups[ edge.b ].lift ) {
            if ( ! groups[ edge.b ].movable ) throw new Error( 'Cuff smoothing reaches the fixed upper region' );
            groups[ edge.b ].lift = required; propagated ++;
        }
    }
    const maxLift = Math.max( ...groups.map( group => group.lift ) );
    if ( maxLift > maximumLift ) throw new Error( 'Cuff exceeds the authored lift limit: ' + maxLift );
    for ( const group of groups ) if ( group.lift > 0 ) for ( const i of group.vertices ) positions[ i * 3 + 1 ] += group.lift;
    const minimumResidual = Math.min( ...constraints.map( c => c.values.reduce( ( sum, [ i, weight ] ) => sum + groups[ i ].lift * weight, 0 ) - c.rhs ) );
    return {
        clearance, movableBelow, maximumLift, constraints: constraints.length, longitudinalPropagation: propagated,
        minimumVerticalSpacingFraction: .5, skippedDegenerateProjections, maxLift, minimumResidual,
        liftedVertices: groups.filter( group => group.lift > 0 ).flatMap( group => group.vertices ),
        limit: 'Projected nondegenerate triangle constraints in authored rest; exact intersections and posed appearance checked separately.'
    };
}
