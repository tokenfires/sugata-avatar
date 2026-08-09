/**
 * FoundationLayer — punch-list 9.8. What the avatar is wearing when it is wearing nothing.
 *
 * WHY THIS IS A CORRECTNESS REQUIREMENT AND NOT A STYLE CHOICE
 * -----------------------------------------------------------
 * The mix-and-match screen (9.12) lets a user take a top off. `Wardrobe.undress()` exists. An
 * outfit change passes through states in which the old garment is gone. **The avatar has to be
 * decent in all of them**, and "all of them" includes the empty set — a body with no garments at
 * all still has to render this layer.
 *
 * ⚠️ It is also the one garment in the phase with no target to measure against: `docs/BRIEF.md`
 * records that the 638 reference images the user supplied contain no foundation layer anywhere.
 * It is authored blind, and the standard it is authored to is that nobody notices it.
 *
 * ## The floor is a SET PER BODY SLOT, and it is strict
 *
 * `GarmentManifest` refuses two garments that share a layer and a body slot, because that is the
 * state MPFB attaches silently and it produces two interpenetrating garments (research §2.2). The
 * four foundation garments are therefore two pairs of alternatives, not four things to wear:
 *
 *     TORSO   foundation_bra  |  foundation_vest
 *     HIPS    foundation_briefs  |  foundation_boxer_brief
 *
 * So the floor is one garment per slot, chosen by `preference`, and the choice is the identity's
 * to make. What is NOT the identity's to make is whether a slot is filled.
 *
 * 🚩 **A preferred garment that is missing from the manifest is a hard error, and that is
 * deliberate rather than defensive.** Substituting the other garment in the slot would keep the
 * avatar decent and would also make a broken build invisible: the wardrobe would quietly dress the
 * agent in something it did not choose, forever, and the only symptom would be that its appearance
 * changed one day. `Wardrobe#resolveOutfit` calls `manifest.require()` on every floor id, so the
 * failure surfaces as a refused `dress()` at the first attempt rather than as a drift in identity.
 *
 * ## What this class deliberately does NOT do
 *
 * It does not know about affect, mood, season or agency. 9.13's `WardrobeAgency` owns the question
 * of who may change an outfit and when; this class owns the question of what is underneath every
 * answer to that. The two meet at one line — the agency passes `foundation.floor` to the wardrobe
 * as its `decencyFloor` — and neither imports the other.
 */

/** The layer name in `assets/wardrobe/manifest.json` that this class is about. */
export const FOUNDATION_LAYER = 'FOUNDATION';

export class FoundationLayer {

    /**
     * @param {GarmentManifest} manifest
     * @param {Object} [options]
     * @param {Object<string,string>} [options.preference] - Body slot -> garment id. Any slot not
     *   named here falls to the first foundation garment for that slot in manifest order, which
     *   makes the default deterministic rather than absent.
     */
    constructor( manifest, options = {} ) {

        this.manifest = manifest;

        this.bySlot = new Map();

        for ( const id of manifest.ids() ) {

            const garment = manifest.get( id );
            if ( garment.layer !== FOUNDATION_LAYER ) continue;

            for ( const slot of garment.slots ) {

                if ( this.bySlot.has( slot ) === false ) this.bySlot.set( slot, [] );
                this.bySlot.get( slot ).push( id );

            }

        }

        // A garment claiming two slots — the boxer brief claims HIPS and LEGS — must not make LEGS
        // a slot the floor tries to fill on its own. A slot is only a floor slot if some garment
        // claims it FIRST, and a garment's first slot is the one it is primarily for.
        this.slots = [ ...new Set(
            [ ...this.#foundationGarments() ].map( ( garment ) => garment.slots[ 0 ] ) ) ].sort();

        this.preference = new Map( Object.entries( options.preference ?? {} ) );

        // Bound so it can be handed straight to `new Wardrobe( …, { decencyFloor } )` without a
        // wrapper closure at every call site. The floor is a function because the preference can
        // change at runtime and the wardrobe must pick that up on the next dress, not at wiring.
        this.floor = () => this.currentFloor();

    }

    /** The garment ids that must be worn in every reachable state, innermost-first. */
    currentFloor() {

        return this.manifest.sortByLayer( this.slots.map( ( slot ) => this.forSlot( slot ) ) );

    }

    /** Which garment fills one slot: the preference if it is a real choice, else the default. */
    forSlot( slot ) {

        const candidates = this.bySlot.get( slot ) ?? [];

        if ( candidates.length === 0 ) {

            throw new Error( `FoundationLayer: no ${ FOUNDATION_LAYER } garment claims the ` +
                `'${ slot }' slot. The avatar cannot be decent there, and every reachable ` +
                'wardrobe state includes the empty outfit.' );

        }

        const wanted = this.preference.get( slot );

        if ( wanted === undefined ) return candidates[ 0 ];

        if ( candidates.includes( wanted ) === false ) {

            throw new Error( `FoundationLayer: '${ wanted }' is preferred for the '${ slot }' ` +
                `slot but does not claim it. Candidates: ${ candidates.join( ', ' ) }.` );

        }

        return wanted;

    }

    /** Every alternative for a slot, so a wardrobe screen can offer them. */
    alternativesFor( slot ) {

        return [ ...( this.bySlot.get( slot ) ?? [] ) ];

    }

    /**
     * Chooses which foundation garment fills a slot. Validated here rather than at the next dress.
     *
     * Returns the new floor, so a caller can persist it in one expression.
     */
    prefer( slot, garmentId ) {

        const candidates = this.bySlot.get( slot ) ?? [];

        if ( candidates.includes( garmentId ) === false ) {

            throw new Error( `FoundationLayer: '${ garmentId }' cannot fill the '${ slot }' ` +
                `slot. Candidates: ${ candidates.join( ', ' ) }.` );

        }

        this.preference.set( slot, garmentId );

        return this.currentFloor();

    }

    /** The preference as a plain object, which is what gets persisted across sessions. */
    toJSON() {

        return Object.fromEntries( this.preference );

    }

    /**
     * Why this floor could not be worn, as human-readable reasons. Empty means it is wearable.
     *
     * Called by the gate on every reachable state rather than trusted once at construction,
     * because `prefer` can be called at any time and a floor that conflicts with itself is a
     * `dress()` that throws — which is an UNDRESSED avatar, not a refused change.
     */
    problems() {

        try {

            return this.manifest.conflicts( this.currentFloor() );

        } catch ( error ) {

            return [ error.message ];

        }

    }

    * #foundationGarments() {

        for ( const id of this.manifest.ids() ) {

            const garment = this.manifest.get( id );
            if ( garment.layer === FOUNDATION_LAYER ) yield garment;

        }

    }

}
