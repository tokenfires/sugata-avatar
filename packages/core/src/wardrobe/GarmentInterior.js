/**
 * Opt-in interior faces for a qualified garment's authored triangle selection.
 *
 * The GLB carries mesh.userData.sugataInterior. Its geometry and this selection must be
 * qualified together by the asset pipeline. This module validates structure, not fit or art.
 * Full vertex arrays preserve skinning, UV seams and vertex-index-based colour recipes.
 * Only the cloned geometry/material are owned; textures and the figure skeleton are borrowed.
 */
import { AttachedBindMode, BackSide, FrontSide, SkinnedMesh } from 'three';

const installed = new WeakMap();
const fields = [ 'kind', 'sourceTriangleCount', 'sourceVertexCount', 'triangles', 'version' ];
const fail = message => { throw new Error( `Garment interior: ${ message }` ); };

function validate( outer, definition, fullIndex, resources ) {

    if ( !definition || typeof definition !== 'object' || Array.isArray( definition ) ||
        Object.keys( definition ).sort().join( ',' ) !== fields.join( ',' ) ||
        definition.version !== 1 || definition.kind !== 'collar-band' ) {
        fail( 'expected an exact version 1 collar-band definition.' );
    }
    if ( !outer.isSkinnedMesh || !outer.skeleton || outer.bindMode !== AttachedBindMode ) {
        fail( 'expected an adopted skinned garment in attached bind mode.' );
    }
    const material = outer.material, geometry = outer.geometry;
    if ( Array.isArray( material ) || !material?.isMaterial || material.side !== FrontSide ||
        material.transparent !== false || material.opacity !== 1 || material.alphaTest !== 0 ||
        material.alphaHash === true ) fail( 'expected one opaque FrontSide material.' );
    if ( outer.morphTargetInfluences?.length || Object.values( geometry.morphAttributes ).some( a => a.length ) ) {
        fail( 'morphed garments require synchronized interior deformation.' );
    }
    if ( !geometry.index || !geometry.attributes.position || !geometry.attributes.normal ||
        !geometry.attributes.skinIndex || !geometry.attributes.skinWeight || geometry.groups.length > 1 ) {
        fail( 'expected one indexed skinned primitive with normals.' );
    }
    if ( !Number.isSafeInteger( definition.sourceVertexCount ) || definition.sourceVertexCount < 1 ||
        definition.sourceVertexCount !== geometry.attributes.position.count ||
        !Number.isSafeInteger( definition.sourceTriangleCount ) || definition.sourceTriangleCount < 1 ||
        !fullIndex || fullIndex.length !== definition.sourceTriangleCount * 3 ) {
        fail( 'source vertex/triangle counts do not match the full primitive.' );
    }
    for ( const index of fullIndex ) if ( !Number.isSafeInteger( index ) || index < 0 || index >= definition.sourceVertexCount ) {
        fail( 'full source index contains an invalid vertex.' );
    }
    if ( !Array.isArray( definition.triangles ) || definition.triangles.length === 0 ||
        definition.triangles.length > definition.sourceTriangleCount ) fail( 'expected a nonempty triangle selection.' );
    const selected = new Set();
    for ( const triangle of definition.triangles ) {
        if ( !Number.isSafeInteger( triangle ) || triangle < 0 || triangle >= definition.sourceTriangleCount || selected.has( triangle ) ) {
            fail( 'selected triangles must be distinct integer source ordinals in bounds.' );
        }
        selected.add( triangle );
    }
    if ( !( resources?.geometries instanceof Set ) || !( resources?.materials instanceof Set ) ) {
        fail( 'an explicit geometry/material resource owner is required.' );
    }

}

/**
 * Called after the wardrobe has remapped joints, bound its skeleton and chosen material/shading.
 * Returns null for an ordinary garment. The caller must dispose the returned owner before
 * releasing the fragment, and call syncMask with its exact any-corner hidden-vertex union.
 */
export function createGarmentInterior( outer, { fullIndex, resources } = {} ) {

    if ( !Object.hasOwn( outer.userData ?? {}, 'sugataInterior' ) ) return null;
    if ( installed.has( outer ) ) fail( 'an interior is already installed on this garment.' );
    const definition = outer.userData.sugataInterior;
    validate( outer, definition, fullIndex, resources );
    const sourceVertexCount = definition.sourceVertexCount;
    const sourceIndices = definition.triangles.flatMap( triangle => Array.from( fullIndex.slice( triangle * 3, triangle * 3 + 3 ) ) );
    const triangleIds = Object.freeze( [ ...definition.triangles ] );
    let geometry, material, mesh, disposed = false;

    const dispose = () => {
        if ( disposed ) return;
        disposed = true;
        installed.delete( outer );
        resources.geometries.delete( geometry );
        resources.materials.delete( material );
        try { mesh?.removeFromParent(); }
        finally {
            try { geometry?.dispose(); }
            finally { material?.dispose(); }
        }
    };

    try {
        geometry = outer.geometry.clone();
        geometry.setIndex( sourceIndices );
        geometry.clearGroups();
        geometry.setDrawRange( 0, sourceIndices.length );
        material = outer.material.clone();
        material.name = `${ outer.material.name }.collar-interior`;
        material.side = BackSide;
        mesh = new SkinnedMesh( geometry, material );
        mesh.name = `${ outer.name }.collar-interior`;
        mesh.frustumCulled = false;
        mesh.castShadow = false;
        mesh.receiveShadow = outer.receiveShadow;
        mesh.layers.mask = outer.layers.mask;
        mesh.renderOrder = outer.renderOrder;
        mesh.bind( outer.skeleton, outer.bindMatrix );
        outer.add( mesh );
        resources.geometries.add( geometry );
        resources.materials.add( material );

        const owner = {
            mesh,
            sourceTriangles: triangleIds,
            get fullTriangles() { return triangleIds.length; },
            get drawnTriangles() { return disposed ? 0 : geometry.drawRange.count / 3; },
            get drawCalls() { return !disposed && mesh.visible && geometry.drawRange.count > 0 ? 1 : 0; },
            syncMask( hidden ) {
                if ( disposed ) fail( 'cannot update a disposed interior.' );
                if ( hidden !== null && ( !( hidden instanceof Uint8Array ) ||
                    hidden.length !== sourceVertexCount || hidden.some( value => value !== 0 && value !== 1 ) ) ) {
                    fail( 'expected the garment any-corner Uint8 hidden-vertex union, or null.' );
                }
                const target = geometry.index.array;
                let written = 0;
                for ( let offset = 0; offset < sourceIndices.length; offset += 3 ) {
                    const a = sourceIndices[ offset ], b = sourceIndices[ offset + 1 ], c = sourceIndices[ offset + 2 ];
                    if ( hidden && ( hidden[ a ] === 1 || hidden[ b ] === 1 || hidden[ c ] === 1 ) ) continue;
                    target[ written++ ] = a; target[ written++ ] = b; target[ written++ ] = c;
                }
                geometry.index.needsUpdate = true;
                geometry.setDrawRange( 0, written );
                mesh.visible = written > 0;
                return written / 3;
            },
            dispose
        };
        installed.set( outer, owner );
        return owner;
    } catch ( error ) {
        dispose();
        throw error;
    }

}
