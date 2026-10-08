import { Matrix4 } from '../../../../node_modules/three/src/math/Matrix4.js';
import { Quaternion } from '../../../../node_modules/three/src/math/Quaternion.js';
import { Vector3 } from '../../../../node_modules/three/src/math/Vector3.js';
import fs from 'node:fs';
const data = JSON.parse( fs.readFileSync( 0, 'utf8' ) );
const matrix = rows => new Matrix4().set( ...rows.flat() );
const rows = m => Array.from( { length: 4 }, ( _, i ) => Array.from( { length: 4 }, ( _, j ) => m.elements[ j * 4 + i ] ) );
const require = ( value, label ) => { if ( ! value ) throw new Error( label ); };
const metric = ( a, b ) => {
    const d = a.elements.map( ( x, i ) => x - b.elements[ i ] );
    require( d.every( Number.isFinite ), 'Nonfinite residual' );
    const max = Math.max( ...d.map( Math.abs ) ), k = d.findIndex( x => Math.abs( x ) === max );
    return { max_abs: max, element: [ k % 4, Math.floor( k / 4 ) ], pass: max <= 1e-6 };
};
const byname = new Map(), records = [];
for ( const r of data.records ) {
    const u = new Quaternion().setFromRotationMatrix( matrix( r.U4 ) ).normalize();
    const v = new Quaternion().setFromRotationMatrix( matrix( r.Vt4 ) ).normalize();
    require( Math.abs( u.length() - 1 ) <= 1e-12 && Math.abs( v.length() - 1 ) <= 1e-12, 'Quaternion unit' );
    const h1 = new Matrix4().compose( new Vector3( ...r.translation ), u, new Vector3( ...r.scale ) );
    const h2 = new Matrix4().compose( new Vector3(), v, new Vector3( 1, 1, 1 ) );
    const local = h1.clone().multiply( h2 );
    const record = { ...r, H1: { translation: r.translation, rotation_xyzw: u.toArray(), scale: r.scale, matrix: rows( h1 ) },
        H2: { translation: [ 0, 0, 0 ], rotation_xyzw: v.toArray(), scale: [ 1, 1, 1 ], matrix: rows( h2 ) },
        J: { translation: [ 0, 0, 0 ], rotation_xyzw: [ 0, 0, 0, 1 ], scale: [ 1, 1, 1 ] },
        local_product: rows( local ), local_metric: metric( local, matrix( r.raw_local ) ), legacy_local_metric: metric( local, matrix( r.legacy_local ) ) };
    byname.set( r.bone, { record, local, world: null } ); records.push( record );
}
function world( name, visiting = new Set() ) {
    const item = byname.get( name ); require( item && ! visiting.has( name ), 'Missing/cyclic parent' );
    if ( item.world ) return item.world;
    visiting.add( name ); const parent = item.record.parent ? world( item.record.parent, visiting ) : matrix( data.rig_global );
    item.world = parent.clone().multiply( item.local ); visiting.delete( name );
    return item.world;
}
for ( const r of records ) {
    const w = world( r.bone ); r.composed_world = rows( w ); r.global_metric = metric( w, matrix( r.raw_global ) );
    r.rest_action_metric = metric( w.clone().multiply( matrix( r.raw_inverse ) ), new Matrix4() );
    r.float32_inverse_metric = metric( w.clone().multiply( matrix( r.float32_inverse ) ), new Matrix4() );
}
const kinds = [ 'local_metric', 'legacy_local_metric', 'global_metric', 'rest_action_metric', 'float32_inverse_metric' ];
const summary = Object.fromEntries( kinds.map( k => { const worst = records.reduce( ( a, b ) => a[ k ].max_abs >= b[ k ].max_abs ? a : b );
    return [ k, { worst_bone: worst.bone, ...worst[ k ], failed_bones: records.filter( r => ! r[ k ].pass ).map( r => r.bone ) } ]; } ) );
console.log( JSON.stringify( { input: data.input, records, summary, nominated: kinds.every( k => summary[ k ].failed_bones.length === 0 ),
    scope: 'Pure NumPy/Three math;106 helper transforms/53 identity joints; no Bone/Object3D/model/GLB/animation proof' }, null, 2 ) );
