/**
 * Opt-in recipe selection by authored formality, through WardrobeAgency's dresser seam.
 * The caller owns the catalogue. Manifest policy and declared slots establish availability;
 * they do not qualify physical fit, mood meaning, climate suitability or punch-list 9.11.
 * No fetching, dressing, mode changes or renderer access.
 */
export const CATALOGUE_BODY_SLOTS = Object.freeze( [ 'TORSO', 'ARMS', 'HIPS', 'LEGS', 'FEET' ] );

const sameIds = ( a, b ) => Array.isArray( b ) && a.length === b.length && a.every( id => b.includes( id ) );
const plain = value => value !== null && typeof value === 'object' && !Array.isArray( value );

export class CatalogueDresser {

    #wardrobe;
    #recipes;
    #reason = 'No catalogue choice has been requested.';

    constructor( wardrobe, recipes ) {

        if ( typeof wardrobe?.validateOutfit !== 'function' || typeof wardrobe?.manifest?.require !== 'function' ) {
            throw new TypeError( 'CatalogueDresser: needs a live Wardrobe and its manifest.' );
        }
        if ( !Array.isArray( recipes ) || recipes.length === 0 || recipes.length > 32 ) {
            throw new TypeError( 'CatalogueDresser: supply 1–32 explicit recipes.' );
        }
        for ( let index = 0; index < recipes.length; index++ ) {
            if ( !Object.hasOwn( recipes, index ) ) throw new TypeError( 'CatalogueDresser: recipes must be a dense array.' );
        }
        const ids = new Set();
        this.#recipes = recipes.map( recipe => {

            if ( !plain( recipe ) || Object.keys( recipe ).length !== 3 ||
                ![ 'id', 'label', 'garments' ].every( key => Object.hasOwn( recipe, key ) ) ||
                typeof recipe.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test( recipe.id ) ||
                typeof recipe.label !== 'string' || !recipe.label.trim() || recipe.label.length > 80 ||
                /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test( recipe.label ) ||
                !Array.isArray( recipe.garments ) || recipe.garments.length === 0 ||
                recipe.garments.some( id => typeof id !== 'string' || id.length === 0 ) || ids.has( recipe.id ) ) {
                throw new TypeError( 'CatalogueDresser: recipes need distinct ids, single-line labels and garment ids.' );
            }
            ids.add( recipe.id );
            return { id: recipe.id, label: recipe.label.trim(), garments: [ ...recipe.garments ] };

        } );
        this.#wardrobe = wardrobe;
        this.#resolve();

    }

    #resolve() {

        return this.#recipes.map( recipe => {

            const garments = this.#wardrobe.validateOutfit( recipe.garments );
            const outer = garments.map( id => this.#wardrobe.manifest.require( id ) )
                .filter( garment => garment.layer !== 'FOUNDATION' );
            const slots = new Set( outer.flatMap( garment => garment.slots ) );
            if ( CATALOGUE_BODY_SLOTS.some( slot => !slots.has( slot ) ) ) {
                throw new Error( `CatalogueDresser: '${ recipe.id }' lacks a complete declared outer outfit.` );
            }
            const formality = Math.max( ...outer.map( garment => garment.formality ) );
            if ( !Number.isInteger( formality ) || formality < 1 || formality > 5 ) {
                throw new Error( `CatalogueDresser: '${ recipe.id }' has no valid authored formality.` );
            }
            return { id: recipe.id, label: recipe.label, garments: [ ...garments ], formality };

        } );

    }

    /** Fresh canonical proposals, including the live floor; no shared arrays. */
    catalogue() {

        return this.#resolve();

    }

    /** Returns garment ids only. WardrobeAgency owns whether this preference is applied. */
    choose( context ) {

        if ( !plain( context ) || !Number.isInteger( context.formality ) || context.formality < 1 || context.formality > 5 ) {
            throw new TypeError( 'CatalogueDresser: formality must be an integer from 1 to 5.' );
        }
        const choices = this.#resolve();
        const distance = Math.min( ...choices.map( choice => Math.abs( choice.formality - context.formality ) ) );
        const tied = choices.filter( choice => Math.abs( choice.formality - context.formality ) === distance );
        const current = tied.find( choice => sameIds( choice.garments, this.#wardrobe.worn ) );
        const selected = current ?? tied[ 0 ];
        this.#reason = `${ selected.label }: authored catalogue formality ${ selected.formality }/5, ` +
            `closest to requested ${ context.formality }/5.` +
            ( tied.length > 1 ? ( current ? ' Kept the current recipe on a tie.' : ' Used catalogue order on a tie.' ) : '' );
        return [ ...selected.garments ];

    }

    explain() {

        return this.#reason;

    }

}
