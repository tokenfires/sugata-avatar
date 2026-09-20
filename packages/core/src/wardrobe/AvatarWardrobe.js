/**
 * Opt-in Avatar wardrobe assets. Only g050 has declared, measured fragment coverage. These are
 * the existing manifest's plumbing stand-ins; authored clothing and other body bakes remain open.
 * Literal URLs let Vite emit GLBs with hashes without breaking the manifest's relative paths.
 */
import { GarmentManifest } from './GarmentManifest.js';
import { FoundationLayer } from './FoundationLayer.js';
import { Wardrobe } from './Wardrobe.js';
import { resolveWardrobeStyle } from './WardrobeStyleOptions.js';

const BODY_URL = new URL( '../../../../assets/wardrobe/body/g050.glb', import.meta.url ).href;
const MANIFEST_URL = new URL( '../../../../assets/wardrobe/manifest.json', import.meta.url ).href;
const FRAGMENTS = Object.freeze( {
    'foundation_bra/g050.glb': new URL( '../../../../assets/wardrobe/foundation_bra/g050.glb', import.meta.url ).href,
    'foundation_vest/g050.glb': new URL( '../../../../assets/wardrobe/foundation_vest/g050.glb', import.meta.url ).href,
    'foundation_briefs/g050.glb': new URL( '../../../../assets/wardrobe/foundation_briefs/g050.glb', import.meta.url ).href,
    'foundation_boxer_brief/g050.glb': new URL( '../../../../assets/wardrobe/foundation_boxer_brief/g050.glb', import.meta.url ).href,
    'female_casualsuit01/g050.glb': new URL( '../../../../assets/wardrobe/female_casualsuit01/g050.glb', import.meta.url ).href,
    'female_elegantsuit01/g050.glb': new URL( '../../../../assets/wardrobe/female_elegantsuit01/g050.glb', import.meta.url ).href,
    'shoes01/g050.glb': new URL( '../../../../assets/wardrobe/shoes01/g050.glb', import.meta.url ).href,
    'fedora01/g050.glb': new URL( '../../../../assets/wardrobe/fedora01/g050.glb', import.meta.url ).href
} );

export function bundledWardrobeFragmentUrl( relative ) {

    if ( !Object.hasOwn( FRAGMENTS, relative ) ) {

        throw new Error( `Avatar wardrobe: manifest fragment '${ relative }' has no bundled asset.` );

    }
    return FRAGMENTS[ relative ];

}

/** An external asset base preserves the existing assets/wardrobe directory structure. */
export function wardrobeAssetUrls( assetBaseUrl = null ) {

    if ( assetBaseUrl == null ) return { bodyUrl: BODY_URL, manifestUrl: MANIFEST_URL, bundled: true };
    const absolute = new URL( assetBaseUrl, globalThis.location?.href ?? 'http://localhost/' );
    if ( !absolute.pathname.endsWith( '/' ) ) absolute.pathname += '/';
    return {
        bodyUrl: new URL( 'wardrobe/body/g050.glb', absolute ).href,
        manifestUrl: new URL( 'wardrobe/manifest.json', absolute ).href,
        bundled: false
    };

}

/** FoundationLayer is the policy authority for preferences and the minimum outfit. */
export async function loadAvatarWardrobe( request, assetBaseUrl = null ) {

    const style = resolveWardrobeStyle( request.style );
    const styleOptions = style === 'original' ? {} :
        ( await import( './WardrobeStyles.js' ) ).createWardrobeStyle( style );
    const urls = wardrobeAssetUrls( assetBaseUrl );
    const manifest = await GarmentManifest.load( urls.manifestUrl,
        urls.bundled ? { resolveFragmentUrl: bundledWardrobeFragmentUrl } : {} );
    const foundation = new FoundationLayer( manifest );
    const preferences = { TORSO: 'foundation_vest', HIPS: 'foundation_boxer_brief', ...request.foundation };
    for ( const [ slot, id ] of Object.entries( preferences ) ) {

        // FoundationLayer distinguishes primary floor slots from secondary coverage (e.g. a
        // boxer brief also covers LEGS). A preference for a non-floor slot would do nothing.
        if ( !foundation.slots.includes( slot ) ) {

            throw new Error( `Avatar wardrobe: foundation slot '${ slot }' is not a floor slot. Choose ${ foundation.slots.join( ', ' ) }.` );

        }
        foundation.prefer( slot, id );

    }
    const problems = foundation.problems();
    if ( problems.length ) throw new Error( `Avatar wardrobe: invalid foundation: ${ problems.join( '; ' ) }` );
    // Validate all requested paths before loading a body or disturbing the active avatar.
    const outfit = manifest.sortByLayer( [ ...new Set( [ ...foundation.currentFloor(), ...request.outfit ] ) ] );
    const conflicts = manifest.conflicts( outfit );
    if ( conflicts.length ) throw new Error( `Avatar wardrobe: invalid outfit: ${ conflicts.join( '; ' ) }` );
    for ( const id of outfit ) manifest.fragmentUrl( id, 'g050' );
    return {
        ...urls, manifest, foundation,
        create: figure => new Wardrobe( figure, manifest, { figureKey: 'g050', decencyFloor: foundation.floor, ...styleOptions } )
    };

}
