/**
 * Authored colourways on the three qualified g050 fragments. Exact source bytes are checked
 * before GLTF parsing: both the UV repair and vertex-index regions depend on this asset layout.
 * Materials borrow imported textures. Wardrobe owns originals and replacements together.
 * No added geometry attributes: a colour-only attribute can escape Three's shadow-first teardown.
 */
import { Color, MeshStandardNodeMaterial } from 'three/webgpu';
import { vertexIndex, varying, vec3, float, texture, dot, uv, vec2, mix, smoothstep } from 'three/tsl';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { resolveWardrobeStyle } from './WardrobeStyleOptions.js';

const SOURCES = Object.freeze( {
    female_casualsuit01: '44ebc3eb3a09408a3563d369ae74be15a5bc4beb8040bc43c2c5446d6e65c783',
    female_elegantsuit01: '0acd22bbf9a847de6fa051bec0860157b72ba626f9504a26f8313713938f1440',
    shoes01: '28e15257130da9eabf790b5dda55e96c985b3504e5905fa9b230195b2f27fde4'
} );
const PALETTES = Object.freeze( {
    ecru: Object.freeze( { top: '#dbd5c6', denim: '#26364c', skirt: '#303643', shoes: '#49342b', socks: '#34363b' } ),
    charcoal: Object.freeze( { top: '#4a5154', denim: null, skirt: '#343c44', shoes: '#333237', socks: '#303238' } )
} );
const hasRecipe = id => Object.hasOwn( SOURCES, id );
const colour = hex => { const c = new Color( hex ); return vec3( c.r, c.g, c.b ); };
const luma = rgb => dot( rgb, vec3( .2126, .7152, .0722 ) );

/** A different host/base URL is supported when it serves the same qualified garment bytes. */
export async function validateStyledFragmentBytes( id, bytes ) {
    if ( !hasRecipe( id ) ) return;
    const digest = await globalThis.crypto.subtle.digest( 'SHA-256', bytes );
    const actual = Array.from( new Uint8Array( digest ), n => n.toString( 16 ).padStart( 2, '0' ) ).join( '' );
    if ( actual !== SOURCES[ id ] ) throw new Error(
        `Avatar wardrobe: '${ id }' differs from the qualified g050 colourway asset. Use style 'original' for an unqualified asset.` );
}

/** Paired loader/factory; the factory accepts only meshes from this loader's verified GLBs. */
export function createWardrobeStyle( value ) {
    const style = resolveWardrobeStyle( value );
    if ( style === 'original' ) return { materialStyle: style };
    const verified = new WeakMap();
    return {
        materialStyle: style,
        async loadFragment( url, id ) {
            const loader = new GLTFLoader();
            if ( !hasRecipe( id ) ) return loader.loadAsync( url );
            const response = await fetch( url );
            if ( !response.ok ) throw new Error( `Avatar wardrobe: '${ id }' returned HTTP ${ response.status }.` );
            const bytes = await response.arrayBuffer();
            await validateStyledFragmentBytes( id, bytes );
            const loaded = await loader.parseAsync( bytes, new URL( '.', url ).href );
            loaded.scene.traverse( mesh => { if ( mesh.isSkinnedMesh ) verified.set( mesh, id ); } );
            return loaded;
        },
        createMaterial( id, mesh ) {
            if ( !hasRecipe( id ) ) return null;
            if ( verified.get( mesh ) !== id ) throw new Error( `Avatar wardrobe: unverified colourway mesh '${ id }'.` );
            return styledMaterial( id, mesh.material, style );
        }
    };
}

function styledMaterial( id, original, style ) {
    if ( Array.isArray( original ) || !original?.map || !original.normalScale ) {
        throw new Error( `Avatar wardrobe: '${ id }' needs its qualified source material.` );
    }
    const material = new MeshStandardNodeMaterial();
    try {
        material.name = `wardrobe.${ style }.${ id }`;
        // Keep .map discoverable by applyFragmentShading (anisotropy), alpha/shadow code and
        // resource accounting. colorNode supplies the colour; normal/AO remain original.
        for ( const key of [ 'map', 'normalMap', 'normalMapType', 'aoMap', 'aoMapIntensity', 'side',
            'shadowSide', 'depthWrite', 'depthTest', 'transparent', 'opacity', 'alphaTest',
            'envMapIntensity', 'flatShading', 'metalness', 'roughness' ] ) {
            if ( original[ key ] !== undefined ) material[ key ] = original[ key ];
        }
        material.normalScale.copy( original.normalScale );
        const palette = PALETTES[ style ], sampled = texture( original.map ).rgb;
        if ( id === 'female_casualsuit01' ) {
            const region = varying( vertexIndex.greaterThanEqual( 1427 ).select( float( 1 ), float( 0 ) ), 'wardrobeDenimRegion' );
            const denim = palette.denim ? colour( palette.denim ).mul( luma( sampled ).div( .15 ).clamp( .35, 1.6 ) ) : sampled;
            // Replace the front print with the unprinted back cloth, preserving neck/cuff trim.
            const t = uv(), print = smoothstep( .700, .710, t.x )
                .mul( float( 1 ).sub( smoothstep( .875, .885, t.x ) ) )
                .mul( smoothstep( .145, .155, t.y ) )
                .mul( float( 1 ).sub( smoothstep( .310, .320, t.y ) ) );
            const clean = mix( sampled, texture( original.map, t.sub( vec2( .5, 0 ) ) ).rgb, print );
            const orange = clean.r.greaterThan( clean.g.mul( 1.3 ) ).and( clean.g.greaterThan( clean.b.mul( 1.3 ) ) );
            const tone = luma( clean ).div( .075 ).sub( 1 ).mul( .16 ).add( 1 ).clamp( .78, 1.12 );
            const tee = colour( palette.top ).mul( orange.select( float( .92 ), tone ) );
            material.colorNode = region.greaterThan( .5 ).select( denim, tee );
            material.roughnessNode = region.greaterThan( .5 ).select( float( .83 ), float( .9 ) );
        } else if ( id === 'female_elegantsuit01' ) {
            const region = varying( vertexIndex.lessThan( 408 ).select( float( 1 ), float( 0 ) ), 'wardrobeSkirtRegion' );
            const skirt = colour( palette.skirt ).mul( luma( sampled ).div( .065 ).clamp( .65, 1.35 ) );
            const blouse = colour( palette.top ).mul( luma( sampled ).div( .25 ).clamp( 0, 1 ).mul( .24 ).add( .88 ) );
            material.colorNode = region.greaterThan( .5 ).select( skirt, blouse );
            material.roughnessNode = region.greaterThan( .5 ).select( float( .85 ), float( .82 ) );
        } else {
            const region = varying( vertexIndex.greaterThanEqual( 1542 ).select( float( 1 ), float( 0 ) ), 'wardrobeSockRegion' );
            const leather = colour( palette.shoes ).mul( luma( sampled ).div( .15 ).clamp( .3, 1.8 ) );
            const knit = colour( palette.socks ).mul( luma( sampled ).div( .38 ).clamp( .55, 1.8 ) );
            material.colorNode = region.greaterThan( .5 ).select( knit, leather );
            material.roughnessNode = region.greaterThan( .5 ).select( float( .93 ), float( .6 ) );
        }
        return material;
    } catch ( error ) {
        // The caller cannot own an allocation that a failed factory never returned.
        material.dispose();
        throw error;
    }
}
