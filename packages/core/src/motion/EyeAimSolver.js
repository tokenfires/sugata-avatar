// Bounded point aiming over a measured neutral/unit-morph eye profile. No scene writes.
import { Matrix4, Vector3 } from 'three';

const RAD = Math.PI / 180;
const clamp = ( x, lo, hi ) => Math.max( lo, Math.min( hi, x ) );
const dot = ( a, b ) => a.reduce( ( sum, x, i ) => sum + x * b[ i ], 0 );
const finite3 = v => Array.isArray( v ) && v.length === 3 && v.every( Number.isFinite );

/** This measured affine approximation has only been qualified on g050 eye morphs. */
export class EyeAimSolver {
    constructor( profile, { maxWeight = 0.85, toleranceDegrees = 0.25, iterations = 12, weightLimits = {} } = {} ) {
        if ( !Number.isFinite( maxWeight ) || maxWeight <= 0 || maxWeight > 1
            || !Number.isFinite( toleranceDegrees ) || toleranceDegrees <= 0
            || !Number.isInteger( iterations ) || iterations < 1 || iterations > 32 )
            throw new RangeError( 'Invalid bounded eye solver configuration.' );
        for ( const side of [ 'left', 'right' ] ) {
            const p = profile?.[ side ], suffix = side === 'left' ? 'Left' : 'Right';
            if ( !finite3( p?.base?.axis ) || !finite3( p?.base?.centre )
                || Math.abs( Math.hypot( ...p.base.axis ) - 1 ) > 1e-6 )
                throw new TypeError( 'Eye calibration needs a finite centre and unit axis.' );
            for ( const dir of [ 'In', 'Out', 'Up', 'Down' ] ) {
                const r = p.responses?.[ 'eyeLook' + dir + suffix ];
                if ( !finite3( r?.axisDelta ) || !finite3( r?.centreDelta ) )
                    throw new TypeError( 'Eye calibration is missing a finite morph response.' );
            }
        }
        this.weightLimits = { In: maxWeight, Out: maxWeight, Up: maxWeight, Down: maxWeight, ...weightLimits };
        if ( Object.keys( this.weightLimits ).some( k => ![ 'In', 'Out', 'Up', 'Down' ].includes( k ) )
            || Object.values( this.weightLimits ).some( v => !Number.isFinite( v ) || v <= 0 || v > maxWeight ) )
            throw new RangeError( 'Eye channel bounds must be positive and within maxWeight.' );
        this.profile = structuredClone( profile );
        this.maxWeight = maxWeight;
        this.toleranceDegrees = toleranceDegrees;
        this.iterations = iterations;
    }

    /**
     * Inputs are in the gaze rig frame. objectToRig must be a positive similarity transform;
     * sheared, reflected, nonuniform, projective and singular transforms are unsupported.
     * Offset adds the existing microsaccade in rig yaw/pitch, just as the visual study did.
     * Each quadrant searches its two active morphs inside [0,weightLimits[direction]]. No antagonistic pair
     * can be active together. A constrained best effort is reported as limited, not success.
     */
    solve( side, { point, objectToRig = new Matrix4(), microYawDegrees = 0, microPitchDegrees = 0 } ) {
        if ( side !== 'left' && side !== 'right' ) throw new TypeError( 'Unknown eye side.' );
        if ( !point?.isVector3 || !point.toArray().every( Number.isFinite )
            || ![ microYawDegrees, microPitchDegrees ].every( Number.isFinite )
            || Math.abs( microYawDegrees ) > 5 || Math.abs( microPitchDegrees ) > 5 )
            throw new RangeError( 'Invalid eye target or microsaccade.' );
        validateSimilarity( objectToRig );
        const p = this.profile[ side ], suffix = side === 'left' ? 'Left' : 'Right';
        const centre = new Vector3( ...p.base.centre ).applyMatrix4( objectToRig );
        if ( !Number.isFinite( centre.distanceToSquared( point ) ) || centre.distanceToSquared( point ) < 1e-6 )
            throw new RangeError( 'Eye target separation must be finite and at least one millimetre.' );
        const axis = new Vector3( ...p.base.axis ).transformDirection( objectToRig );
        const delta = {};
        // Direction deltas must be rotated without normalization; normalization would erase
        // their measured amplitude. Position deltas include the uniform scale.
        const scale = new Vector3().setFromMatrixColumn( objectToRig, 0 ).length();
        const origin = new Vector3().setFromMatrixPosition( objectToRig );
        for ( const dir of [ 'In', 'Out', 'Up', 'Down' ] ) {
            const r = p.responses[ 'eyeLook' + dir + suffix ];
            delta[ dir ] = {
                axis: new Vector3( ...r.axisDelta ).applyMatrix4( objectToRig ).sub( origin ).divideScalar( scale ),
                centre: new Vector3( ...r.centreDelta ).applyMatrix4( objectToRig ).sub( origin )
            };
        }
        let evaluations = 0, best = null;
        const evaluate = ( h, v, u, w ) => {
            evaluations++;
            const c = centre.clone().addScaledVector( delta[ h ].centre, u ).addScaledVector( delta[ v ].centre, w );
            const a = axis.clone().addScaledVector( delta[ h ].axis, u ).addScaledVector( delta[ v ].axis, w );
            const d = point.clone().sub( c );
            if ( !Number.isFinite( d.lengthSq() ) || !Number.isFinite( a.lengthSq() )
                || d.lengthSq() < 1e-12 || a.lengthSq() < 1e-12 ) return null;
            a.normalize(); d.normalize();
            const yaw = Math.atan2( d.x, d.z ) + microYawDegrees * RAD;
            const pitch = Math.asin( clamp( d.y, -1, 1 ) ) + microPitchDegrees * RAD;
            d.set( Math.sin( yaw ) * Math.cos( pitch ), Math.sin( pitch ), Math.cos( yaw ) * Math.cos( pitch ) );
            const residual = a.clone().sub( d ).toArray();
            return { residual, cost: dot( residual, residual ), axis: a.toArray(), centre: c.toArray(), direction: d.toArray() };
        };
        for ( const h of [ 'In', 'Out' ] ) for ( const v of [ 'Down', 'Up' ] ) {
            const hu = this.weightLimits[ h ], hv = this.weightLimits[ v ];
            let u = 0, w = 0, state = evaluate( h, v, u, w ), used = 0;
            if ( state === null ) continue;
            for ( ; used < this.iterations && state.cost > 1e-16; used++ ) {
                // One-sided finite differences stay within this quadrant, including at bounds.
                const eu = Math.min( 1e-4, hu / 2 ), ev = Math.min( 1e-4, hv / 2 );
                const du = u + eu <= hu ? eu : -eu;
                const dw = w + ev <= hv ? ev : -ev;
                const su = evaluate( h, v, u + du, w ), sw = evaluate( h, v, u, w + dw );
                if ( !su || !sw ) break;
                const j0 = su.residual.map( ( x, i ) => ( x - state.residual[ i ] ) / du );
                const j1 = sw.residual.map( ( x, i ) => ( x - state.residual[ i ] ) / dw );
                const aa = dot( j0, j0 ) + 1e-10, bb = dot( j1, j1 ) + 1e-10, ab = dot( j0, j1 );
                const ga = dot( j0, state.residual ), gb = dot( j1, state.residual );
                const step = boundedQuadratic( aa, ab, bb, ga, gb, -u, hu - u, -w, hv - w );
                if ( Math.hypot( ...step ) < 1e-10 ) break;
                let accepted = false;
                for ( let fraction = 1; fraction >= 1 / 64; fraction /= 2 ) {
                    const nu = clamp( u + fraction * step[ 0 ], 0, hu );
                    const nw = clamp( w + fraction * step[ 1 ], 0, hv );
                    const candidate = evaluate( h, v, nu, nw );
                    if ( candidate && candidate.cost < state.cost - 1e-18 ) {
                        u = nu; w = nw; state = candidate; accepted = true; break;
                    }
                }
                if ( !accepted ) break;
            }
            if ( !best || state.cost < best.cost ) best = { ...state, h, v, u, w, iterations: used };
        }
        if ( !best ) throw new RangeError( 'No finite eye solution.' );
        const weights = Object.fromEntries( [ 'In', 'Out', 'Up', 'Down' ].map( d => [ 'eyeLook' + d + suffix, 0 ] ) );
        weights[ 'eyeLook' + best.h + suffix ] = best.u;
        weights[ 'eyeLook' + best.v + suffix ] = best.w;
        const errorDegrees = 2 * Math.asin( Math.min( 1, Math.sqrt( best.cost ) / 2 ) ) / RAD;
        return { weights, errorDegrees, status: errorDegrees <= this.toleranceDegrees ? 'aimed' : 'limited',
            axis: best.axis, centre: best.centre, direction: best.direction, evaluations, iterations: best.iterations };
    }
}

function boundedQuadratic( aa, ab, bb, ga, gb, u0, u1, v0, v1 ) {
    const options = [ [ 0, 0 ] ], det = aa * bb - ab * ab;
    if ( det > 1e-20 ) {
        const u = ( ab * gb - bb * ga ) / det, v = ( ab * ga - aa * gb ) / det;
        if ( u >= u0 && u <= u1 && v >= v0 && v <= v1 ) options.push( [ u, v ] );
    }
    for ( const u of [ u0, u1 ] ) options.push( [ u, clamp( -( gb + ab * u ) / bb, v0, v1 ) ] );
    for ( const v of [ v0, v1 ] ) options.push( [ clamp( -( ga + ab * v ) / aa, u0, u1 ), v ] );
    let best = options[ 0 ], cost = 0;
    for ( const [ u, v ] of options ) {
        const next = aa * u * u + 2 * ab * u * v + bb * v * v + 2 * ga * u + 2 * gb * v;
        if ( next < cost ) { best = [ u, v ]; cost = next; }
    }
    return best;
}

export function validateSimilarity( matrix ) {
    const e = matrix?.elements;
    if ( !matrix?.isMatrix4 || !e?.every( Number.isFinite )
        || Math.max( Math.abs( e[ 3 ] ), Math.abs( e[ 7 ] ), Math.abs( e[ 11 ] ), Math.abs( e[ 15 ] - 1 ) ) > 1e-10 )
        throw new RangeError( 'Eye transform must be a finite affine matrix.' );
    const columns = [ 0, 1, 2 ].map( i => new Vector3().setFromMatrixColumn( matrix, i ) );
    const lengths = columns.map( x => x.length() ), scale = lengths[ 0 ];
    if ( scale < 1e-6 || scale > 1e6 || lengths.some( x => Math.abs( x / scale - 1 ) > 1e-6 )
        || [ [ 0, 1 ], [ 0, 2 ], [ 1, 2 ] ].some( ( [ a, b ] ) => Math.abs( columns[ a ].dot( columns[ b ] ) / scale ** 2 ) > 1e-6 )
        || columns[ 0 ].clone().cross( columns[ 1 ] ).dot( columns[ 2 ] ) <= 0 )
        throw new RangeError( 'Eye transform needs positive uniform scale and orthogonal axes.' );
}
