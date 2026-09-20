// Pinned measurement regions derived from corresponding authored body surfaces, not scaled boxes.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Matrix4, Vector3, Quaternion, BufferGeometry, Float32BufferAttribute, SkinnedMesh } from 'three';
import { readGlb, readPrimitive, readAccessor, readMorphTargets } from '../lut-bake/glb.mjs';
import { PORTRAIT_BAKES } from '../../packages/testbed/src/portrait-selection.mjs';
export const CALIBRATION_SHA256 = 'afbc1707c868c6286f84be12ae09cf40902ac4ea3c6710191966f04155e017ea';
const sha = bytes => createHash( 'sha256' ).update( bytes ).digest( 'hex' );
const bytes = fs.readFileSync( new URL( './fixtures/portrait-anatomy-v1.json', import.meta.url ) );
if ( sha( bytes ) !== CALIBRATION_SHA256 ) throw new Error( 'Portrait anatomy fixture changed; revalidate its body correspondence before use.' );
const fixture = JSON.parse( bytes );
const freeze = value => { if ( value && typeof value === 'object' ) { Object.values( value ).forEach( freeze ); Object.freeze( value ); } return value; };
freeze( fixture );
export const hashFloat32 = values => sha( Buffer.from( new Float32Array( values ).buffer ) );
export const hashUint32 = values => sha( Buffer.from( new Uint32Array( values ).buffer ) );
export function calibrationForBake( bake ) {
    const record = fixture.bakes.find( b => b.bake === bake );
    if ( ! record ) throw new Error( `Unsupported calibrated body bake ${ bake }.` );
    return record;
}
export const decodeBounds = bounds => ( { min: bounds.min.map( x => x ?? -Infinity ), max: bounds.max.map( x => x ?? Infinity ) } );
export function captureRegion( bake ) {
    const { proposed } = calibrationForBake( bake );
    return { bake, gender: PORTRAIT_BAKES[ bake ], calibration: `figure-${ bake }-head-rest-v1`,
        minY: proposed.face.min[ 1 ], maxY: proposed.face.max[ 1 ], minZ: proposed.face.min[ 2 ] };
}
export function captureAnatomy( bake ) {
    const b = calibrationForBake( bake );
    return { version: 1, id: fixture.id, fixtureSha256: CALIBRATION_SHA256, bake,
        bodySha256: b.hashes.file, geometryHashes: Object.fromEntries( [ 'positionFloat32', 'normalFloat32', 'uvFloat32', 'indexUint32', 'jointUint32', 'weightFloat32' ].map( key => [ key, b.hashes[ key === 'weightFloat32' ? 'runtimeWeightFloat32' : key ] ] ) ),
        runtimeWeightDerivation: fixture.runtimeWeightDerivation, faceBounds: b.proposed.face, headBounds: b.proposed.head,
        neckShoulder: { selection: 'corresponding neck/clavicle support at or below reference chin; all touching body triangles',
            coordinateSpace: 'same-frame posed world body surface', triangleCount: b.neckPatchTriangleIds.length,
            vertexCount: b.neckPatchVertexIds.length, sourceTriangleIdsSha256: hashUint32( b.neckPatchTriangleIds ),
            sourceVertexIdsSha256: hashUint32( b.neckPatchVertexIds ) } };
}
export function validateBodyTopology( indices, positionCount, bake ) {
    const b = calibrationForBake( bake );
    if ( positionCount !== b.vertexCount * 3 || ! Array.isArray( indices ) || indices.length !== b.triangleCount * 3 ||
        indices.some( i => ! Number.isInteger( i ) || i < 0 || i >= b.vertexCount ) || hashUint32( indices ) !== b.hashes.indexUint32 ) throw new Error( `Captured ${ bake } body topology disagrees with calibrated source triangle IDs.` );
}
export function bodyGeometryHashes( attributes ) {
    return Object.fromEntries( [ [ 'position', 'positionFloat32', hashFloat32 ], [ 'normal', 'normalFloat32', hashFloat32 ],
        [ 'uv', 'uvFloat32', hashFloat32 ], [ 'index', 'indexUint32', hashUint32 ],
        [ 'skinIndex', 'jointUint32', hashUint32 ], [ 'skinWeight', 'weightFloat32', hashFloat32 ] ].map( ( [ name, key, hash ] ) => {
        if ( ! Array.isArray( attributes?.[ name ] ) || ! attributes[ name ].every( Number.isFinite ) ) throw new Error( `Invalid captured body ${ name } attributes.` );
        return [ key, hash( attributes[ name ] ) ];
    } ) );
}
export function validateBodyGeometryHashes( hashes, bake ) {
    const expected = captureAnatomy( bake ).geometryHashes;
    if ( ! hashes || Object.keys( hashes ).length !== Object.keys( expected ).length || Object.entries( expected ).some( ( [ key, value ] ) => hashes[ key ] !== value ) ) throw new Error( 'Captured body rest geometry disagrees with the calibrated body.' );
}

// Recompute the proposal from the checked-in assets. Tests run this without ignored captures.
export function verifyCalibrationAssets( root = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '../..' ) ) {
    const fail = message => { throw new Error( `Anatomy correspondence: ${ message }` ); };
    const equal = ( a, b, message ) => { if ( JSON.stringify( a ) !== JSON.stringify( b ) ) fail( message ); };
    const near = ( a, b, message ) => { if ( ! Number.isFinite( a ) || ! Number.isFinite( b ) || Math.abs( a - b ) > 1e-12 ) fail( message ); };
    const at = ( p, i ) => Array.from( p.slice( i * 3, i * 3 + 3 ) );
    const mean = ( p, ids ) => [ 0,1,2 ].map( k => ids.reduce( ( s, i ) => s + p[ i * 3 + k ], 0 ) / ids.length );
    const key = ids => [ ...ids ].sort( ( a,b ) => a-b ).join( ',' );
    const d = fixture.definitions, bodies = fixture.bakes.map( record => {
        const file = path.join( root, `assets/figures/figure_${ record.bake }.glb` );
        if ( sha( fs.readFileSync( file ) ) !== record.hashes.file ) fail( `${ record.bake } body file hash` );
        const glb = readGlb( file ), mesh = readPrimitive( glb, record.bodyMesh );
        const mi = glb.json.meshes.findIndex( m => m.name === record.bodyMesh ), ni = glb.json.nodes.findIndex( n => n.mesh === mi );
        const primitive = glb.json.meshes[ mi ].primitives[ 0 ], skin = glb.json.skins[ glb.json.nodes[ ni ].skin ];
        const joints = Array.from( readAccessor( glb, primitive.attributes.JOINTS_0 ).data ), weights = Array.from( readAccessor( glb, primitive.attributes.WEIGHTS_0 ).data );
        const attributes = { position: Array.from( mesh.positions ), normal: Array.from( mesh.normals ), uv: Array.from( mesh.uvs ), index: Array.from( mesh.indices ), skinIndex: joints, skinWeight: weights };
        const rawHashes = bodyGeometryHashes( attributes );
        for ( const [ key, value ] of Object.entries( rawHashes ) ) if ( value !== record.hashes[ key ] ) fail( record.bake + ' authored ' + key );
        const geometry = new BufferGeometry().setAttribute( 'skinWeight', new Float32BufferAttribute( weights, 4 ) );
        const meshControl = new SkinnedMesh( geometry ); meshControl.normalizeSkinWeights();
        if ( hashFloat32( geometry.getAttribute( 'skinWeight' ).array ) !== record.hashes.runtimeWeightFloat32 ) fail( record.bake + ' normalized runtime weights' );
        geometry.dispose();
        validateBodyTopology( attributes.index, attributes.position.length, record.bake );
        const names = skin.joints.map( i => glb.json.nodes[ i ].name ), ids = Array.from( { length: mesh.vertexCount }, ( _, i ) => i );
        const support = ids.filter( i => [ 0,1,2,3 ].reduce( ( s,k ) => s + ( d.neckClavicleBones.includes( names[ joints[ i*4+k ] ] ) ? weights[ i*4+k ] : 0 ), 0 ) >= d.neckClavicleThreshold );
        const morphs = readMorphTargets( glb, record.bodyMesh );
        if ( hashUint32( support ) !== record.hashes.neckClavicleSupport || sha( new Uint8Array( ids.map( i => Math.hypot( ...at( morphs.get( 'jawOpen' ), i ) ) > 1e-10 ) ) ) !== record.hashes.jawSupport ) fail( `${ record.bake } support` );
        const ib = readAccessor( glb, skin.inverseBindMatrices ).data;
        const headBind = new Vector3().setFromMatrixPosition( new Matrix4().fromArray( ib, names.indexOf( 'head' ) * 16 ).invert() ).toArray();
        const landmarks = { chin: at( mesh.positions, d.chinId ), noseTip: at( mesh.positions, d.noseId ), innerBrow: mean( mesh.positions, d.browIds ), headBind };
        for ( const [ name, point ] of Object.entries( landmarks ) ) point.forEach( ( x,k ) => near( x, record.landmarks[ name ][ k ], `${ record.bake } ${ name }` ) );
        const world = new Map();
        const walk = ( i, parent ) => { const n = glb.json.nodes[ i ], local = n.matrix ? new Matrix4().fromArray( n.matrix ) : new Matrix4().compose( new Vector3( ...( n.translation ?? [0,0,0] ) ), new Quaternion( ...( n.rotation ?? [0,0,0,1] ) ), new Vector3( ...( n.scale ?? [1,1,1] ) ) ); const matrix = parent.clone().multiply( local ); world.set( i, matrix ); for ( const c of n.children ?? [] ) walk( c, matrix ); };
        for ( const i of glb.json.scenes[ glb.json.scene ?? 0 ].nodes ) walk( i, new Matrix4() );
        world.get( ni ).elements.forEach( ( x,i ) => near( x, new Matrix4().elements[ i ], 'body scene transform must be identity' ) );
        return { record, mesh, support, landmarks, triangles: new Set( Array.from( { length: mesh.triangleCount }, ( _, i ) => key( mesh.indices.slice( i*3,i*3+3 ) ) ) ) };
    } );
    const ref = bodies.find( b => b.record.bake === 'g050' );
    const below = ref.support.filter( i => ref.mesh.positions[ i*3+1 ] <= ref.landmarks.chin[ 1 ] );
    equal( below, d.belowChinReferenceVertexIds, 'reference below-chin support' );
    const selected = new Set( below );
    const clip = ( poly, axis, limit, sign ) => { const out = []; for ( let i=0;i<poly.length;i++ ) { const a=poly[i],b=poly[(i+1)%poly.length],da=sign*(a.p[axis]-limit),db=sign*(b.p[axis]-limit);if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push({p:a.p.map((x,k)=>x+(b.p[k]-x)*t),w:a.w.map((x,k)=>x+(b.w[k]-x)*t)});} } return out; };
    const patches = Object.fromEntries( [ 'face', 'head' ].map( name => {
        const bounds = decodeBounds( d[ name+'050' ] ), patch = [];
        for ( let t=0;t<ref.mesh.indices.length;t+=3 ) { const ids=Array.from(ref.mesh.indices.slice(t,t+3));let poly=ids.map((i,k)=>({p:at(ref.mesh.positions,i),w:[0,1,2].map(j=>j===k?1:0)}));for(let axis=0;axis<3;axis++){if(Number.isFinite(bounds.min[axis]))poly=clip(poly,axis,bounds.min[axis],1);if(Number.isFinite(bounds.max[axis]))poly=clip(poly,axis,bounds.max[axis],-1);}if(poly.length)patch.push({ids,poly}); }
        return [ name, patch ];
    } ) );
    return bodies.map( b => {
        const { record, mesh, landmarks: l } = b, ids = [], vertices = new Set();
        for ( const name of [ 'uvFloat32','jointUint32','weightFloat32','neckClavicleSupport','jawSupport' ] ) equal( record.hashes[ name ], ref.record.hashes[ name ], `${ record.bake } shared ${ name }` );
        for ( let t=0;t<mesh.indices.length;t+=3 ) { const corners=Array.from(mesh.indices.slice(t,t+3));if(corners.some(i=>selected.has(i))){ids.push(t/3);corners.forEach(i=>vertices.add(i));if(!ref.triangles.has(key(corners)))fail('neck patch topology');} }
        equal( ids, record.neckPatchTriangleIds, 'neck triangle IDs' );equal( [...vertices].sort((a,b)=>a-b),record.neckPatchVertexIds,'neck vertex IDs' );
        for ( const name of [ 'face', 'head' ] ) {
            const base=decodeBounds(d[name+'050']),sy=(l.innerBrow[1]-l.chin[1])/(ref.landmarks.innerBrow[1]-ref.landmarks.chin[1]),sz=(l.noseTip[2]-l.headBind[2])/(ref.landmarks.noseTip[2]-ref.landmarks.headBind[2]);
            const mapY=y=>l.chin[1]+(y-ref.landmarks.chin[1])*sy,mapZ=z=>l.headBind[2]+(z-ref.landmarks.headBind[2])*sz;
            const bounds=record.bake==='g050'?base:{min:[-Infinity,mapY(base.min[1]),mapZ(base.min[2])],max:[Infinity,mapY(base.max[1]),Infinity]};
            for(const p of patches[name]){if(!b.triangles.has(key(p.ids)))fail(`${name} triangle correspondence`);for(const q of p.poly){const mapped=[0,1,2].map(k=>q.w.reduce((s,w,j)=>s+w*mesh.positions[p.ids[j]*3+k],0));if(record.bake!=='g050')for(let k=0;k<3;k++){bounds.min[k]=Math.min(bounds.min[k],mapped[k]);bounds.max[k]=Math.max(bounds.max[k],mapped[k]);}}}
            const expected=decodeBounds(record.proposed[name]);for(const side of ['min','max'])for(let k=0;k<3;k++)if(bounds[side][k]!==expected[side][k])near(bounds[side][k],expected[side][k],`${record.bake} ${name} mapped bound`);
        }
        return { bake: record.bake, bodySha256: record.hashes.file, vertices: mesh.vertexCount, triangles: mesh.triangleCount,
            facePatchTriangles: patches.face.length, headPatchTriangles: patches.head.length, neckPatchTriangles: ids.length, neckPatchVertices: vertices.size };
    } );
}
