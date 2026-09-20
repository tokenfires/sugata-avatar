/** Measured eye geometry for finite point aim; created once for each loaded figure. */
import { Matrix4 } from 'three';
import { measureEye } from '../material/EyeMaterial.js';

export class EyeAimCalibrationError extends Error {}
const requireGeometry = ( valid, message ) => { if ( !valid ) throw new EyeAimCalibrationError( message ); };
const DIRECTIONS = [ 'In', 'Out', 'Up', 'Down' ];

export function calibrateEyeAim( globe, cornea ) {
    const records = [];
    let head = null, objectToHead = null;
    for ( const mesh of [ globe, cornea ] ) {
        requireGeometry( mesh?.isSkinnedMesh && mesh.bindMode === 'attached', 'Eye aim needs attached skinned eye meshes.' );
        const geometry = mesh.geometry, p = geometry.attributes.position;
        const indices = geometry.attributes.skinIndex, weights = geometry.attributes.skinWeight;
        requireGeometry( geometry.morphTargetsRelative === true && p && indices && weights
            && indices.count === p.count && weights.count === p.count, 'Eye aim needs relative morphs and complete skinning data.' );
        const index = indices.getX( 0 ), bone = mesh.skeleton.bones[ index ];
        requireGeometry( bone?.name === 'head' && ( !head || head === bone ), 'Both eyes must be rigidly bound to the same head.' );
        head = bone;
        for ( let i = 0; i < p.count; i++ ) {
            requireGeometry( indices.getX( i ) === index && weights.getX( i ) === 1
                && weights.getY( i ) === 0 && weights.getZ( i ) === 0 && weights.getW( i ) === 0,
            'Eye aim does not support blended eye skin weights.' );
        }
        const transform = new Matrix4().multiplyMatrices( mesh.skeleton.boneInverses[ index ], mesh.bindMatrix );
        requireGeometry( !objectToHead || transform.equals( objectToHead ), 'The eye shells need the same bind frame.' );
        objectToHead = transform;
        const required = new Set( [ 'Left', 'Right' ].flatMap( side => DIRECTIONS.map( d => 'eyeLook' + d + side ) ) );
        for ( const name of required ) requireGeometry( geometry.morphAttributes.position?.[ mesh.morphTargetDictionary?.[ name ] ],
            'Eye aim is missing ' + name + '.' );
        // A calibrated eye may not be deformed by another active facial channel. Reject this
        // unsupported geometry at calibration time, rather than silently ignore its motion.
        for ( const [ name, index ] of Object.entries( mesh.morphTargetDictionary ?? {} ) ) {
            const a = geometry.morphAttributes.position?.[ index ];
            if ( !a ) continue;
            requireGeometry( a.count === p.count, 'Eye morph vertex count differs from its base.' );
            for ( let i = 0; i < a.count; i++ ) {
                const x = a.getX( i ), y = a.getY( i ), z = a.getZ( i );
                requireGeometry( [ x, y, z ].every( Number.isFinite ), 'Eye morph contains non-finite coordinates.' );
                if ( !required.has( name ) || ( name.endsWith( 'Left' ) ? p.getX( i ) <= 0 : p.getX( i ) > 0 ) )
                    requireGeometry( x === 0 && y === 0 && z === 0, 'Eye aim needs independent per-eye gaze morphs.' );
            }
        }
        const attributes = [ ...Object.values( geometry.attributes ), ...geometry.morphAttributes.position ];
        records.push( { mesh, geometry, skeleton: mesh.skeleton, index, bone, bind: mesh.bindMatrix.clone(),
            inverse: mesh.skeleton.boneInverses[ index ].clone(), dictionary: mesh.morphTargetDictionary, dictionaryEntries: Object.entries( mesh.morphTargetDictionary ),
            baseAttributes: Object.entries( geometry.attributes ),
            attributes: attributes.map( a => ( { a, array: a.array, version: a.version,
                itemSize: a.itemSize, count: a.count, normalized: a.normalized, skinIndex: a === indices } ) ),
            position: p, morphs: [ ...geometry.morphAttributes.position ] } );
    }
    requireGeometry( globe.geometry.attributes.uv, 'Eye aim needs globe UVs for the physical eye fit.' );
    const profile = {};
    for ( const side of [ 'left', 'right' ] ) {
        const sign = side === 'left' ? 1 : -1;
        const fit = weights => {
            const g = cloud( globe, sign, weights ), c = cloud( cornea, sign, weights );
            const result = measureEye( g.points, g.uvs, c.points );
            requireGeometry( [ ...result.axis, ...result.centre ].every( Number.isFinite ), 'The eye geometry cannot be calibrated.' );
            return result;
        };
        const base = fit( {} ), responses = {}, suffix = side === 'left' ? 'Left' : 'Right';
        for ( const direction of DIRECTIONS ) {
            const name = 'eyeLook' + direction + suffix, unit = fit( { [ name ]: 1 } );
            responses[ name ] = { axisDelta: unit.axis.map( ( v, i ) => v - base.axis[ i ] ),
                centreDelta: unit.centre.map( ( v, i ) => v - base.centre[ i ] ) };
        }
        profile[ side ] = { base: { axis: base.axis, centre: base.centre }, responses };
    }
    return {
        profile, head, objectToHead, globe, cornea,
        // Geometry is immutable between figure binds. Normal Three attribute invalidation or
        // replacement invalidates this calibration; a new figure receives a fresh profile.
        isCurrent() {
            return records.every( r => r.mesh.geometry === r.geometry && r.mesh.skeleton === r.skeleton
                && r.mesh.bindMode === 'attached' && r.mesh.bindMatrix?.equals( r.bind ) === true
                && r.skeleton.bones[ r.index ] === r.bone && r.skeleton.boneInverses[ r.index ]?.equals( r.inverse ) === true
                && r.mesh.morphTargetDictionary === r.dictionary && r.geometry.morphTargetsRelative === true
                && r.dictionaryEntries.every( ( [ name, index ] ) => r.mesh.morphTargetDictionary[ name ] === index )
                && r.baseAttributes.every( ( [ name, a ] ) => r.geometry.attributes[ name ] === a )
                && r.geometry.attributes.position === r.position
                && Array.isArray( r.geometry.morphAttributes.position )
                && r.geometry.morphAttributes.position.length === r.morphs.length
                && r.morphs.every( ( a, i ) => r.geometry.morphAttributes.position[ i ] === a )
                && r.attributes.every( attributeIsCurrent ) );
        }
    };
}

function attributeIsCurrent( record ) {
    const { a, array, version, itemSize, count, normalized, skinIndex } = record;
    if ( a.version !== version || a.itemSize !== itemSize || a.count !== count || a.normalized !== normalized ) return false;
    if ( a.array === array ) return true;
    // Three's WebGPU upload widens unnormalized 8/16-bit indices in place. It replaces the
    // backing array without changing the attribute version or physical skinning. Accept only
    // that exact lossless conversion, once; changed indices or other replaced arrays reject.
    if ( !skinIndex || normalized || !( array instanceof Uint16Array || array instanceof Uint8Array )
        || !( a.array instanceof Uint32Array ) || a.array.length !== array.length ) return false;
    for ( let i = 0; i < array.length; i++ ) if ( a.array[ i ] !== array[ i ] ) return false;
    record.array = a.array;
    return true;
}

function cloud( mesh, sign, weights ) {
    const p = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
    const points = [], uvs = [], seen = new Set();
    for ( let i = 0; i < p.count; i++ ) {
        const point = [ p.getX( i ), p.getY( i ), p.getZ( i ) ], key = point.join( ',' );
        if ( ( sign > 0 ? point[ 0 ] <= 0 : point[ 0 ] > 0 ) || seen.has( key ) ) continue;
        seen.add( key );
        for ( const [ name, weight ] of Object.entries( weights ) ) {
            const a = mesh.geometry.morphAttributes.position[ mesh.morphTargetDictionary[ name ] ];
            point[ 0 ] += weight * a.getX( i ); point[ 1 ] += weight * a.getY( i ); point[ 2 ] += weight * a.getZ( i );
        }
        points.push( point ); uvs.push( uv ? [ uv.getX( i ), uv.getY( i ) ] : [ 0, 0 ] );
    }
    return { points, uvs };
}
