/** Browser-safe calibration for the measured long-bob contact domain.
 * Geometry identity matters: chain counts alone cannot identify a card ordering.
 * Callers must check their load token after this asynchronous validation returns.
 */
import { HAIR_BODY_CONTACT_DATA } from './HairBodyContactCalibration.data.js';
import { HAIR_BODY_CONTACT_DATA as G025_DATA } from './HairBodyContactCalibration.g025.data.js';
import { createHairSkinTransform } from './HairSkinTransform.js';

function freeze( value ) {
    if ( value && typeof value === 'object' ) {
        Object.values( value ).forEach( freeze ); Object.freeze( value );
    }
    return value;
}
export const HAIR_BODY_CONTACT_CALIBRATION = freeze( HAIR_BODY_CONTACT_DATA );
// Preserve the existing g050 export identity; support requires an exact registered record.
export const HAIR_BODY_CONTACT_CALIBRATIONS = Object.freeze( [
    HAIR_BODY_CONTACT_CALIBRATION, freeze( G025_DATA )
] );
const attributes = { position: 3, normal: 3, uv: 2, skinIndex: 4, skinWeight: 4 };
const mismatch = reason => ( { enabled: false, reason } );

// Copy through BufferAttribute accessors: interleaving and normalized integer attributes
// must hash their actual component values, not unrelated backing-buffer bytes.
function copyAttribute( attribute, size, name, integer = false ) {
    if ( !attribute || attribute.itemSize !== size || !Number.isInteger( attribute.count ) || attribute.count < 1 ||
        typeof attribute.getComponent !== 'function' ) throw Error( `Invalid ${ name } attribute.` );
    const result = integer ? new Uint32Array( attribute.count * size ) : new Float32Array( attribute.count * size );
    for ( let i = 0; i < attribute.count; i ++ ) for ( let k = 0; k < size; k ++ ) {
        const value = attribute.getComponent( i, k );
        if ( !Number.isFinite( value ) || !Number.isFinite( Math.fround( value ) ) ||
            integer && ( !Number.isInteger( value ) || value < 0 || value > 0xffffffff ) ) throw Error( `Invalid ${ name } component.` );
        result[ i * size + k ] = value;
    }
    return result;
}
function copyIndex( input ) {
    if ( input?.isBufferAttribute || input?.isInterleavedBufferAttribute ) return copyAttribute( input, 1, 'index', true );
    if ( !( Array.isArray( input ) || ArrayBuffer.isView( input ) && !( input instanceof DataView ) ) ||
        !input.length || input.length % 3 ) throw Error( 'A complete canonical triangle index is required.' );
    const copy = new Uint32Array( input.length );
    for ( let i = 0; i < input.length; i ++ ) {
        const value = input[ i ];
        if ( !Number.isInteger( value ) || value < 0 || value > 0xffffffff ) throw Error( 'Invalid canonical index.' );
        copy[ i ] = value;
    }
    return copy;
}
function snapshot( mesh, index ) {
    if ( !mesh?.isSkinnedMesh || !mesh.geometry || !mesh.skeleton ) throw Error( 'A skinned body and groom are required.' );
    const geometry = mesh.geometry;
    const arrays = Object.fromEntries( Object.entries( attributes ).map( ( [ name, size ] ) =>
        [ name, copyAttribute( geometry.getAttribute( name ), size, name, name === 'skinIndex' ) ] ) );
    arrays.index = copyIndex( index ?? geometry.index );
    const vertexCount = arrays.position.length / 3;
    for ( const [ name, size ] of Object.entries( attributes ) ) if ( arrays[ name ].length !== vertexCount * size ) throw Error( 'Mismatched attribute counts.' );
    if ( arrays.index.some( value => value >= vertexCount ) ) throw Error( 'Canonical index exceeds the vertex count.' );
    const boneNames = mesh.skeleton.bones.map( bone => bone.name );
    const inverses = mesh.skeleton.boneInverses;
    if ( inverses.length !== boneNames.length || !boneNames.length ) throw Error( 'Mismatched skeleton inverses.' );
    const inverseBind = new Float32Array( inverses.length * 16 );
    for ( let i = 0; i < inverses.length; i ++ ) {
        const values = inverses[ i ]?.elements;
        if ( !values || values.length !== 16 || !values.every( Number.isFinite ) ) throw Error( 'Invalid inverse bind.' );
        inverseBind.set( values, i * 16 );
    }
    return { arrays, inverseBind, boneNames, vertexCount };
}
async function hash( values ) {
    // Canonical little-endian Float32/Uint32 independent of backing-array byte order.
    const bytes = new ArrayBuffer( values.length * 4 ), view = new DataView( bytes );
    const integer = values instanceof Uint32Array;
    for ( let i = 0; i < values.length; i ++ ) {
        if ( integer ) view.setUint32( i * 4, values[ i ], true );
        else view.setFloat32( i * 4, values[ i ], true );
    }
    const digest = new Uint8Array( await globalThis.crypto.subtle.digest( 'SHA-256', bytes ) );
    return Array.from( digest, byte => byte.toString( 16 ).padStart( 2, '0' ) ).join( '' );
}
async function check( actual, expected, name ) {
    if ( actual.vertexCount !== expected.vertexCount || actual.arrays.index.length !== expected.indexCount ||
        JSON.stringify( actual.boneNames ) !== JSON.stringify( expected.boneNames ) ) return `${ name } layout or skeleton does not match the contact calibration.`;
    const hashes = await Promise.all( Object.entries( actual.arrays ).map( async ( [ key, array ] ) => [ key, await hash( array ) ] ) );
    for ( const [ key, value ] of hashes ) if ( expected.hashes[ key ] !== value ) return `${ name } ${ key } does not match the contact calibration.`;
    if ( await hash( actual.inverseBind ) !== expected.inverseBindSha256 ) return `${ name } inverse bind does not match the contact calibration.`;
    return null;
}

/**
 * A copied canonical index is returned with successful validation. Pass Wardrobe.fullIndex
 * when clothing compacts the draw index; never infer source triangle ordinals from drawRange.
 * This selects calibration only. It does not certify dynamic appearance or activate contact.
 */
export async function selectHairBodyContactCalibration( { style, bake, body, groom, bodyIndices } ) {
    const calibration = HAIR_BODY_CONTACT_CALIBRATIONS.find( item => item.style === style && item.bake === bake );
    if ( !calibration ) return mismatch( `No body-contact calibration for ${ style } on ${ bake }.` );
    if ( !globalThis.crypto?.subtle?.digest ) return mismatch( 'Body-contact geometry validation requires Web Crypto.' );
    let bodySnapshot, groomSnapshot;
    try {
        const head = groom?.skeleton?.bones?.findIndex( bone => bone.name === 'head' );
        if ( head === undefined || head < 0 ) throw Error( 'A driving head bone is required for hair contact.' );
        createHairSkinTransform( groom, groom.skeleton.bones[ head ], groom.skeleton.boneInverses[ head ] )( { requireRigid: true } );
        // Snapshot all mutable attributes before the first asynchronous digest.
        bodySnapshot = snapshot( body, bodyIndices ); groomSnapshot = snapshot( groom );
    } catch ( error ) { return mismatch( error.message ); }
    const errors = await Promise.all( [ check( bodySnapshot, calibration.body, 'Body' ), check( groomSnapshot, calibration.groom, 'Groom' ) ] );
    const reason = errors.find( value => value !== null );
    if ( reason ) return mismatch( reason );
    return { enabled: true, calibration, bodyIndices: bodySnapshot.arrays.index,
        bodyPositions: bodySnapshot.arrays.position, bodyNormals: bodySnapshot.arrays.normal };
}
