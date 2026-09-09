// Execute the real post-digest retirement boundary. No renderer or GLB network request.
import assert from 'node:assert/strict';
import { BufferGeometry, BufferAttribute, Matrix4, Group } from 'three';
import { Avatar } from './Avatar.js';
import { HAIR_BODY_CONTACT_CALIBRATION as C } from './motion/HairBodyContactCalibration.js';
// Warm imports so the deliberately deferred Web Crypto operation is the boundary under test.
await Promise.all( [ import( './motion/HairDynamics.js' ), import( './render/HairVelocity.js' ) ] );
function mesh( record ) {
    const geometry = new BufferGeometry();
    for ( const [ key, size ] of [ [ 'position',3 ],[ 'normal',3 ],[ 'uv',2 ],[ 'skinIndex',4 ],[ 'skinWeight',4 ] ] )
        geometry.setAttribute( key, new BufferAttribute( new Float32Array( record.vertexCount * size ), size ) );
    geometry.setIndex( new BufferAttribute( new Uint32Array( record.indexCount ), 1 ) );
    return { isSkinnedMesh: true, geometry, matrixWorld: new Matrix4(), skeleton: {
        bones: record.boneNames.map( name => ( { name, matrixWorld: new Matrix4() } ) ),
        boneInverses: record.boneNames.map( () => new Matrix4() )
    } };
}
const body = mesh( C.body ), groom = mesh( C.groom );
let groups = 0;
try {
    for ( const boundary of [ 'dispose', 'identity token' ] ) {
        const avatar = new Avatar( { identity: { gender: .5 }, scene: { id: 'studio', kind: 'studio' }, hairStyle: 'bob01' } );
        let rendererReads = 0;
        avatar.stage = { get renderer() { rendererReads++; throw Error( 'Retired load reached renderer' ); }, dispose() {} };
        const material = {}, subtle = globalThis.crypto.subtle, original = subtle.digest;
        let arrived, release;
        const started = new Promise( resolve => { arrived = resolve; } ), gate = new Promise( resolve => { release = resolve; } );
        subtle.digest = async function( ...args ) { arrived(); await gate; return original.apply( this, args ); };
        try {
            const pending = avatar.buildHairDynamics( { root: new Group(), body }, [ groom ], material, avatar.loadToken, null,
                { hairStyle: 'bob01', bakeName: 'figure_g050', bodyIndices: body.geometry.index.array } );
            await started;
            if ( boundary === 'dispose' ) avatar.dispose(); else avatar.loadToken++;
            release(); const result = await pending;
            assert.equal( result, null ); assert.equal( rendererReads, 0 ); assert.equal( material.positionNode, undefined );
            groups++; console.log( `PASS ${ groups } - ${ boundary } during actual geometry digests cannot construct or publish a solver` );
        } finally { release(); subtle.digest = original; avatar.dispose(); }
    }
    console.log( `${ groups } asynchronous contact retirement groups passed` );
} finally { body.geometry.dispose(); groom.geometry.dispose(); }
