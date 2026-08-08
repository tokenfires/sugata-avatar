/**
 * glb.mjs — the smallest glTF binary reader that can answer the curvature bake's questions.
 *
 * Deliberately not `GLTFLoader`. That loader needs a DOM for its image decode path and pulls the
 * whole three.js render stack in behind it, and the bake needs exactly four things out of one
 * primitive: positions, normals, texture coordinates and indices. Roughly eighty lines against a
 * DOM shim and an 11 MB parse, on the same reasoning `tools/critic/png.mjs` was written by hand.
 *
 * Scope, stated so nobody is surprised later: single-buffer `.glb` only (the chunk-1 BIN case,
 * which is what `tools/figure-pipeline/build.sh` emits), no sparse accessors, no external `.bin`,
 * no draco. Any of those throws rather than silently returning something plausible.
 */

import fs from 'node:fs';

const GLB_MAGIC = 0x46546c67;        // 'glTF'
const CHUNK_JSON = 0x4e4f534a;       // 'JSON'
const CHUNK_BIN = 0x004e4942;        // 'BIN\0'

const COMPONENT_READERS = {
    5120: { bytes: 1, read: ( view, at ) => view.getInt8( at ) },
    5121: { bytes: 1, read: ( view, at ) => view.getUint8( at ) },
    5122: { bytes: 2, read: ( view, at ) => view.getInt16( at, true ) },
    5123: { bytes: 2, read: ( view, at ) => view.getUint16( at, true ) },
    5125: { bytes: 4, read: ( view, at ) => view.getUint32( at, true ) },
    5126: { bytes: 4, read: ( view, at ) => view.getFloat32( at, true ) }
};

const COMPONENTS_PER_ELEMENT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

/**
 * @typedef {Object} Glb
 * @property {Object} json - the glTF JSON chunk, verbatim.
 * @property {Buffer} bin - the binary chunk.
 */

/**
 * @param {string} path
 * @returns {Glb}
 */
export function readGlb( path ) {

    const buffer = fs.readFileSync( path );

    if ( buffer.readUInt32LE( 0 ) !== GLB_MAGIC ) throw new Error( `${ path } is not a .glb` );

    let json = null;
    let bin = null;
    let offset = 12;

    while ( offset + 8 <= buffer.length ) {

        const length = buffer.readUInt32LE( offset );
        const type = buffer.readUInt32LE( offset + 4 );
        const start = offset + 8;

        if ( type === CHUNK_JSON ) json = JSON.parse( buffer.subarray( start, start + length ).toString( 'utf8' ) );
        else if ( type === CHUNK_BIN ) bin = buffer.subarray( start, start + length );

        offset = start + length;

    }

    if ( json === null ) throw new Error( `${ path } has no JSON chunk` );
    if ( bin === null ) throw new Error( `${ path } has no BIN chunk — external buffers are not supported` );

    return { json, bin };

}

/**
 * Reads one accessor into a flat Float64Array (or Uint32Array for indices).
 *
 * @param {Glb} glb
 * @param {number} index - accessor index.
 * @returns {{data: Float64Array|Uint32Array, count: number, components: number}}
 */
export function readAccessor( glb, index ) {

    const accessor = glb.json.accessors[ index ];

    if ( accessor === undefined ) throw new Error( `no accessor ${ index }` );
    if ( accessor.sparse !== undefined ) throw new Error( `accessor ${ index } is sparse — not supported` );

    const reader = COMPONENT_READERS[ accessor.componentType ];
    if ( reader === undefined ) throw new Error( `accessor ${ index } has componentType ${ accessor.componentType }` );

    const components = COMPONENTS_PER_ELEMENT[ accessor.type ];
    if ( components === undefined ) throw new Error( `accessor ${ index } has type ${ accessor.type }` );

    const bufferView = glb.json.bufferViews[ accessor.bufferView ];
    const base = ( bufferView.byteOffset ?? 0 ) + ( accessor.byteOffset ?? 0 );

    // An interleaved bufferView declares its own stride; a tightly packed one does not.
    const stride = bufferView.byteStride ?? components * reader.bytes;

    const view = new DataView( glb.bin.buffer, glb.bin.byteOffset, glb.bin.byteLength );
    const isIndexLike = accessor.type === 'SCALAR' && accessor.componentType !== 5126;
    const data = isIndexLike
        ? new Uint32Array( accessor.count * components )
        : new Float64Array( accessor.count * components );

    for ( let element = 0; element < accessor.count; element ++ ) {

        for ( let c = 0; c < components; c ++ ) {

            data[ element * components + c ] = reader.read( view, base + element * stride + c * reader.bytes );

        }

    }

    return { data, count: accessor.count, components };

}

/**
 * The named mesh's single primitive, with everything the bake needs already read out.
 *
 * @param {Glb} glb
 * @param {string} meshName
 * @returns {{positions: Float64Array, normals: Float64Array, uvs: Float64Array,
 *            indices: Uint32Array, vertexCount: number, triangleCount: number}}
 */
export function readPrimitive( glb, meshName ) {

    const mesh = glb.json.meshes.find( ( candidate ) => candidate.name === meshName );
    if ( mesh === undefined ) {

        const names = glb.json.meshes.map( ( m ) => m.name ).join( ', ' );
        throw new Error( `no mesh named '${ meshName }'. This file has: ${ names }` );

    }

    if ( mesh.primitives.length !== 1 ) throw new Error( `mesh '${ meshName }' has ${ mesh.primitives.length } primitives` );

    const primitive = mesh.primitives[ 0 ];
    const attributes = primitive.attributes;

    for ( const required of [ 'POSITION', 'NORMAL', 'TEXCOORD_0' ] ) {

        if ( attributes[ required ] === undefined ) throw new Error( `mesh '${ meshName }' has no ${ required }` );

    }

    const positions = readAccessor( glb, attributes.POSITION );
    const normals = readAccessor( glb, attributes.NORMAL );
    const uvs = readAccessor( glb, attributes.TEXCOORD_0 );
    const indices = readAccessor( glb, primitive.indices );

    return {
        positions: positions.data,
        normals: normals.data,
        uvs: uvs.data,
        indices: indices.data,
        vertexCount: positions.count,
        triangleCount: indices.count / 3
    };

}
