#!/usr/bin/env node
/**
 * Triangle/surface crossing gate for hair cards. Unlike vertex/centreline clearance, this tests
 * the actual indexed triangle interiors; a broad card can cut through a cheek while its corners
 * are all outside. No vertex normals, solver proxies, alpha rejection or shaders decide a hit.
 *
 * API inputs must share one coordinate system. The CLI reads raw rest-space mesh attributes;
 * it does not apply scene transforms, skinning or morphs. Runtime probes can pass posed arrays.
 * A zero result establishes no triangle-shell crossings in the selected box, to the numeric
 * tolerance. It does NOT establish positive clearance, rule out a triangle wholly inside a
 * closed body, or prove a render has no visible collision. Retain signed-distance and render tests.
 *
 * Alpha annotations sample a few witnesses on each intersection from the base atlas (nearest
 * texel, mip zero). A positive witness establishes textured geometry there, not final shader
 * visibility. Zero sampled alpha does not establish transparency along the whole intersection.
 *
 * node tools/figure-pipeline/hair_surface.mjs --hair assets/hair/bob02/g050.glb \
 *   --body assets/figures/figure_g050.glb --out /tmp/crossings.json
 * Exit 0 = selected region has no crossings; 1 = crossings; 2 = invalid input/instrument failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readGlb, readPrimitive } from '../lut-bake/glb.mjs';
import { decodePng } from '../critic/png.mjs';
import { connectedComponents, isRibbon } from './hair_geometry.mjs';

export const DEFAULT_HEAD_BOUNDS = Object.freeze( { min: [ -Infinity, 1.40, 0.03 ], max: [ Infinity, 1.585, Infinity ] } );
export const DEFAULT_FACE_BOUNDS = Object.freeze( { min: [ -Infinity, 1.43, 0.06 ], max: [ Infinity, 1.565, Infinity ] } );
const EPSILON = 1e-9; // metres for metre-scale assets; callers can override for another scale.
const sub = ( a, b ) => a.map( ( x, i ) => x - b[ i ] );
const dot = ( a, b ) => a.reduce( ( sum, x, i ) => sum + x * b[ i ], 0 );
const cross = ( a, b ) => [ a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ], a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ], a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ] ];
const mix = ( a, b, t ) => a.map( ( x, i ) => x + ( b[ i ] - x ) * t );
const distance = ( a, b ) => Math.hypot( ...sub( a, b ) );
const unit = a => { const length = Math.hypot( ...a ); return a.map( x => x / length ); };
const unique = ( points, epsilon ) => points.filter( ( p, i ) => points.slice( 0, i ).every( q => distance( p, q ) > epsilon ) );

function validateBounds( bounds ) {
    if ( ! bounds || ! [ 'min', 'max' ].every( key => bounds[ key ]?.length === 3 && bounds[ key ].every( x => typeof x === 'number' && ! Number.isNaN( x ) ) ) ||
        bounds.min.some( ( x, i ) => x > bounds.max[ i ] || x === Infinity || bounds.max[ i ] === -Infinity ) ) throw new Error( 'Invalid region bounds' );
}
function validateTriangle( triangle, epsilon ) {
    if ( ! triangle || triangle.length !== 3 || triangle.some( p => p.length !== 3 || p.some( x => ! Number.isFinite( x ) ) ) ) throw new Error( 'Triangle needs three finite xyz vertices' );
    const normal = cross( sub( triangle[ 1 ], triangle[ 0 ] ), sub( triangle[ 2 ], triangle[ 0 ] ) );
    const longest = Math.max( distance( triangle[ 0 ], triangle[ 1 ] ), distance( triangle[ 1 ], triangle[ 2 ] ), distance( triangle[ 2 ], triangle[ 0 ] ) );
    if ( longest <= epsilon || Math.hypot( ...normal ) / longest <= epsilon ) throw new Error( 'Degenerate triangle (altitude at or below tolerance)' );
    return unit( normal );
}

// Sutherland-Hodgman against an inward-facing plane. Works for convex polygons, segments and
// points, so region clipping uses the entire intersection rather than whichever edge hit first.
function clipPlane( polygon, signedDistance, epsilon ) {
    if ( polygon.length === 0 ) return [];
    const output = [];
    for ( let i = 0; i < polygon.length; i ++ ) {
        const a = polygon[ i ], b = polygon[ ( i + 1 ) % polygon.length ];
        const da = signedDistance( a ), db = signedDistance( b );
        const insideA = da >= -epsilon, insideB = db >= -epsilon;
        if ( insideA ) output.push( a );
        if ( insideA !== insideB ) output.push( mix( a, b, Math.max( 0, Math.min( 1, da / ( da - db ) ) ) ) );
    }
    return unique( output, epsilon );
}

/** Clip a point, segment or ordered convex polygon to an axis-aligned region. */
export function clipIntersectionToBounds( points, bounds, epsilon = EPSILON ) {
    validateBounds( bounds );
    let clipped = points;
    for ( let axis = 0; axis < 3; axis ++ ) {
        if ( Number.isFinite( bounds.min[ axis ] ) ) clipped = clipPlane( clipped, p => p[ axis ] - bounds.min[ axis ], epsilon );
        if ( Number.isFinite( bounds.max[ axis ] ) ) clipped = clipPlane( clipped, p => bounds.max[ axis ] - p[ axis ], epsilon );
    }
    return clipped;
}

/**
 * Intersect triangle A with B's triangular prism, then with B's plane. The prism's three inward
 * half-planes are perpendicular to B's plane. Their intersection on that plane is exactly B.
 * Clipping A keeps its true triangle interior. Plane slicing yields a point/segment, or the
 * entire convex overlap polygon when coplanar. Winding changes the normal and side planes
 * together, so either winding works. This is floating-point geometry with a stated tolerance,
 * not an exact-arithmetic predicate. Boundary contact is conservatively a crossing.
 */
export function intersectTriangles( a, b, epsilon = EPSILON ) {
    if ( ! Number.isFinite( epsilon ) || epsilon <= 0 ) throw new Error( 'epsilon must be finite and positive' );
    validateTriangle( a, epsilon );
    const normal = validateTriangle( b, epsilon );
    const distances = a.map( p => dot( normal, sub( p, b[ 0 ] ) ) );
    if ( distances.every( d => d > epsilon ) || distances.every( d => d < -epsilon ) ) return null;
    let clipped = a;
    for ( let edge = 0; edge < 3; edge ++ ) {
        const start = b[ edge ], end = b[ ( edge + 1 ) % 3 ];
        const inward = unit( cross( normal, sub( end, start ) ) );
        clipped = clipPlane( clipped, p => dot( inward, sub( p, start ) ), epsilon );
        if ( clipped.length === 0 ) return null;
    }
    const d = clipped.map( p => dot( normal, sub( p, b[ 0 ] ) ) );
    if ( d.every( value => Math.abs( value ) <= epsilon ) ) return { kind: distances.every( value => Math.abs( value ) <= epsilon ) ? 'coplanar' : 'transverse', points: clipped };
    const hits = [];
    for ( let i = 0; i < clipped.length; i ++ ) {
        const next = ( i + 1 ) % clipped.length;
        if ( Math.abs( d[ i ] ) <= epsilon ) hits.push( clipped[ i ] );
        if ( d[ i ] * d[ next ] < 0 ) hits.push( mix( clipped[ i ], clipped[ next ], d[ i ] / ( d[ i ] - d[ next ] ) ) );
    }
    const points = unique( hits, epsilon );
    return points.length ? { kind: 'transverse', points } : null;
}

function boundsOf( vertices ) {
    return { min: [ 0, 1, 2 ].map( axis => Math.min( ...vertices.map( p => p[ axis ] ) ) ),
        max: [ 0, 1, 2 ].map( axis => Math.max( ...vertices.map( p => p[ axis ] ) ) ) };
}
function overlaps( a, b, epsilon ) {
    return ! a.min.some( ( x, axis ) => x > b.max[ axis ] + epsilon || a.max[ axis ] < b.min[ axis ] - epsilon );
}
function meshTriangles( mesh, region, epsilon ) {
    if ( ! mesh.positions?.length || mesh.positions.length % 3 || ! mesh.indices?.length || mesh.indices.length % 3 ) throw new Error( 'Mesh needs packed xyz positions and triangle indices' );
    if ( Array.from( mesh.positions ).some( x => ! Number.isFinite( x ) ) ) throw new Error( 'Mesh positions must be finite' );
    const triangles = [];
    for ( let offset = 0; offset < mesh.indices.length; offset += 3 ) {
        const indices = Array.from( mesh.indices.slice( offset, offset + 3 ) );
        if ( indices.some( index => ! Number.isInteger( index ) || index < 0 || index >= mesh.positions.length / 3 ) ) throw new Error( `Invalid triangle index at ${ offset / 3 }` );
        const vertices = indices.map( index => Array.from( mesh.positions.slice( index * 3, index * 3 + 3 ) ) );
        const bounds = boundsOf( vertices );
        if ( ! overlaps( bounds, region, epsilon ) ) continue;
        try { validateTriangle( vertices, epsilon ); } catch ( error ) { throw new Error( `Triangle ${ offset / 3 }: ${ error.message }` ); }
        triangles.push( { index: offset / 3, indices, vertices, ...bounds } );
    }
    return triangles;
}
function barycentric( point, triangle ) {
    const v0 = sub( triangle[ 1 ], triangle[ 0 ] ), v1 = sub( triangle[ 2 ], triangle[ 0 ] ), v2 = sub( point, triangle[ 0 ] );
    const a = dot( v0, v0 ), b = dot( v0, v1 ), c = dot( v1, v1 ), d = dot( v2, v0 ), e = dot( v2, v1 );
    const determinant = a * c - b * b, v = ( c * d - b * e ) / determinant, w = ( a * e - b * d ) / determinant;
    return [ 1 - v - w, v, w ];
}
function alphaWitnesses( points, triangle, hair, sampler ) {
    if ( ! sampler ) return [];
    const centroid = [ 0, 1, 2 ].map( axis => points.reduce( ( sum, p ) => sum + p[ axis ], 0 ) / points.length );
    return unique( [ ...points, centroid ], EPSILON ).map( point => {
        const bary = barycentric( point, triangle.vertices );
        const uv = [ 0, 1 ].map( axis => triangle.indices.reduce( ( sum, index, k ) => sum + hair.uvs[ index * 2 + axis ] * bary[ k ], 0 ) );
        const alpha = sampler( uv );
        if ( ! Number.isFinite( alpha ) || alpha < 0 || alpha > 1 ) throw new Error( 'Alpha sampler must return a finite value in [0,1]' );
        return { point, uv, alpha };
    } );
}

/** Plain arrays API, suitable for rest bakes or captured GPU vertices in a shared posed space. */
export function measureHairSurface( hair, body, {
    headBounds = DEFAULT_HEAD_BOUNDS, faceBounds = DEFAULT_FACE_BOUNDS, epsilon = EPSILON,
    alphaSampler = null, exampleLimit = 20
} = {} ) {
    validateBounds( headBounds ); validateBounds( faceBounds );
    if ( ! Number.isFinite( epsilon ) || epsilon <= 0 ) throw new Error( 'epsilon must be finite and positive' );
    if ( ! Number.isInteger( exampleLimit ) || exampleLimit < 0 ) throw new Error( 'exampleLimit must be a nonnegative integer' );
    if ( alphaSampler && ( hair.uvs?.length !== hair.positions.length / 3 * 2 || Array.from( hair.uvs ).some( x => ! Number.isFinite( x ) ) ) ) throw new Error( 'Alpha annotation needs finite UVs for every hair vertex' );
    const hairTriangles = meshTriangles( hair, headBounds, epsilon ), bodyTriangles = meshTriangles( body, headBounds, epsilon );
    const cardByTriangle = new Map();
    connectedComponents( hair.indices, hair.positions.length / 3 ).filter( isRibbon ).forEach( ( component, card ) => component.triangles.forEach( triangle => cardByTriangle.set( triangle, card ) ) );
    const totals = () => ( { pairs: 0, transversePairs: 0, coplanarPairs: 0, hairTriangles: new Set(), cards: new Set(), pairsWithNonzeroAlphaWitness: 0, pairsWithAlphaAtLeastHalfWitness: 0, examples: [] } );
    const head = totals(), face = totals(), nonFace = totals(); let candidatePairs = 0;
    function record( accumulator, intersection, points, h, b ) {
        accumulator.pairs ++; accumulator[ `${ intersection.kind }Pairs` ] ++;
        accumulator.hairTriangles.add( h.index );
        const card = cardByTriangle.get( h.index ) ?? null;
        if ( card !== null ) accumulator.cards.add( card );
        const alpha = alphaWitnesses( points, h, hair, alphaSampler );
        if ( alpha.some( witness => witness.alpha > 0 ) ) accumulator.pairsWithNonzeroAlphaWitness ++;
        if ( alpha.some( witness => witness.alpha >= 0.5 ) ) accumulator.pairsWithAlphaAtLeastHalfWitness ++;
        if ( accumulator.examples.length < exampleLimit ) accumulator.examples.push( { hairTriangle: h.index, bodyTriangle: b.index, card, kind: intersection.kind, points, alphaWitnesses: alpha } );
    }
    for ( const h of hairTriangles ) for ( const b of bodyTriangles ) {
        if ( ! overlaps( h, b, epsilon ) ) continue;
        candidatePairs ++;
        const intersection = intersectTriangles( h.vertices, b.vertices, epsilon );
        if ( ! intersection ) continue;
        const headPoints = clipIntersectionToBounds( intersection.points, headBounds, epsilon );
        if ( ! headPoints.length ) continue;
        record( head, intersection, headPoints, h, b );
        const facePoints = clipIntersectionToBounds( headPoints, faceBounds, epsilon );
        if ( facePoints.length ) record( face, intersection, facePoints, h, b );
        else record( nonFace, intersection, headPoints, h, b );
    }
    const finish = value => ( { ...value, hairTriangles: value.hairTriangles.size, cards: [ ...value.cards ].sort( ( a, b ) => a - b ) } );
    const jsonBounds = bounds => ( { min: bounds.min.map( x => Number.isFinite( x ) ? x : null ), max: bounds.max.map( x => Number.isFinite( x ) ? x : null ) } );
    return { version: 1, method: 'Triangle-prism clipping plus plane slicing; AABB broad phase; closed-box region clipping; boundary contact included.',
        epsilon, coordinateSpace: 'caller-supplied shared space', headBounds: jsonBounds( headBounds ), faceBounds: jsonBounds( faceBounds ), unboundedAxisValue: null,
        selectedHairTriangles: hairTriangles.length, selectedBodyTriangles: bodyTriangles.length, candidatePairs,
        head: finish( head ), face: finish( face ), headPairsWithoutFaceIntersection: finish( nonFace ),
        alpha: { enabled: !! alphaSampler, method: 'Intersection vertices and centroid; CLI uses nearest base-atlas texel, mip zero.',
            limitation: 'Finite alpha witnesses do not classify the entire crossing or final shader visibility; alpha never changes geometric pair counts.' },
        limitation: 'No shell crossings does not prove positive clearance or exclude triangles wholly inside the body. Raw CLI attributes exclude morphs, skinning and scene transforms. Face counts include intersections within both head and face bounds.' };
}

function atlasSampler( glb, meshName ) {
    const primitive = glb.json.meshes.find( mesh => mesh.name === meshName ).primitives[ 0 ];
    const textureInfo = glb.json.materials?.[ primitive.material ]?.pbrMetallicRoughness?.baseColorTexture;
    if ( ! textureInfo ) return null;
    if ( ( textureInfo.texCoord ?? 0 ) !== 0 || textureInfo.extensions?.KHR_texture_transform ) throw new Error( 'Alpha annotation only supports untransformed TEXCOORD_0' );
    const texture = glb.json.textures[ textureInfo.index ], image = glb.json.images[ texture.source ];
    if ( image.mimeType !== 'image/png' || image.bufferView === undefined ) throw new Error( 'Alpha annotation needs an embedded PNG base atlas' );
    const view = glb.json.bufferViews[ image.bufferView ], atlas = decodePng( glb.bin.subarray( view.byteOffset ?? 0, ( view.byteOffset ?? 0 ) + view.byteLength ) );
    const sampler = glb.json.samplers?.[ texture.sampler ] ?? {};
    const wrap = ( value, mode = 10497 ) => mode === 33071 ? Math.max( 0, Math.min( 1, value ) ) : mode === 33648 ? 1 - Math.abs( ( ( value % 2 ) + 2 ) % 2 - 1 ) : ( ( value % 1 ) + 1 ) % 1;
    return uv => {
        const x = Math.min( atlas.width - 1, Math.floor( wrap( uv[ 0 ], sampler.wrapS ) * atlas.width ) );
        const y = Math.min( atlas.height - 1, Math.floor( wrap( uv[ 1 ], sampler.wrapT ) * atlas.height ) );
        return atlas.pixels[ ( y * atlas.width + x ) * 4 + 3 ];
    };
}

export function runCli( argv ) {
    const options = { hair: null, body: 'assets/figures/figure_g050.glb', hairMesh: 'hair_bob02', bodyMesh: 'base.001', out: null, gate: 'face', alpha: 'on', epsilon: EPSILON,
        headBounds: DEFAULT_HEAD_BOUNDS, faceBounds: DEFAULT_FACE_BOUNDS };
    if ( argv.includes( '--help' ) ) {
        console.log( 'Usage: node hair_surface.mjs --hair FILE [--body FILE] [--hair-mesh NAME] [--body-mesh NAME] [--out FILE] [--gate face|head|none] [--alpha on|off] [--epsilon METRES] [--head-bounds xmin,ymin,zmin,xmax,ymax,zmax] [--face-bounds xmin,ymin,zmin,xmax,ymax,zmax]\nBounds accept -Infinity/Infinity. Defaults: head=-Infinity,1.40,0.03,Infinity,1.585,Infinity; face=-Infinity,1.43,0.06,Infinity,1.565,Infinity. Face is intersected with head. See module header for geometric and alpha limits.' ); return 0;
    }
    for ( let i = 0; i < argv.length; i += 2 ) {
        const key = argv[ i ].replace( /^--/, '' ).replace( /-([a-z])/g, ( _, char ) => char.toUpperCase() ), value = argv[ i + 1 ];
        if ( ! argv[ i ].startsWith( '--' ) || ! Object.hasOwn( options, key ) || value === undefined ) throw new Error( `Unknown or missing option ${ argv[ i ] }` );
        if ( key.endsWith( 'Bounds' ) ) { const parts = value.split( ',' ).map( Number ); if ( parts.length !== 6 ) throw new Error( `${ key } requires six coordinates` ); options[ key ] = { min: parts.slice( 0, 3 ), max: parts.slice( 3 ) }; }
        else options[ key ] = key === 'epsilon' ? Number( value ) : value;
    }
    if ( ! options.hair || ! [ 'face', 'head', 'none' ].includes( options.gate ) || ! [ 'on', 'off' ].includes( options.alpha ) ) throw new Error( 'Require --hair; --gate must be face|head|none; --alpha must be on|off' );
    const hairGlb = readGlb( options.hair ), bodyGlb = readGlb( options.body );
    const result = measureHairSurface( readPrimitive( hairGlb, options.hairMesh ), readPrimitive( bodyGlb, options.bodyMesh ), {
        ...options, alphaSampler: options.alpha === 'on' ? atlasSampler( hairGlb, options.hairMesh ) : null
    } );
    const source = ( file, mesh ) => ( { file: path.resolve( file ), mesh, sha256: createHash( 'sha256' ).update( fs.readFileSync( file ) ).digest( 'hex' ) } );
    result.sources = { hair: source( options.hair, options.hairMesh ), body: source( options.body, options.bodyMesh ), instrument: source( fileURLToPath( import.meta.url ), null ) };
    result.gate = { region: options.gate, pass: options.gate === 'none' ? null : result[ options.gate ].pairs === 0 };
    const json = JSON.stringify( result, null, 2 ) + '\n';
    if ( options.out ) fs.writeFileSync( options.out, json );
    else process.stdout.write( json );
    if ( options.out ) console.log( JSON.stringify( { headPairs: result.head.pairs, facePairs: result.face.pairs, faceCards: result.face.cards, gate: result.gate, out: path.resolve( options.out ) } ) );
    return result.gate.pass === false ? 1 : 0;
}
if ( process.argv[ 1 ] && path.resolve( process.argv[ 1 ] ) === fileURLToPath( import.meta.url ) ) {
    try { process.exitCode = runCli( process.argv.slice( 2 ) ); }
    catch ( error ) { console.error( error.stack ?? error.message ); process.exitCode = 2; }
}
