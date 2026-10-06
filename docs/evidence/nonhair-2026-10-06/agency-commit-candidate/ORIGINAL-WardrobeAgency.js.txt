/**
 * WardrobeAgency — punch-list 9.13. Who decides what the avatar wears, and when.
 *
 * THREE MODES, AND THE USER OWNS THE SWITCH
 * -----------------------------------------
 *   `pinned`  the user fixes an outfit and it does not change. **The default on first run.**
 *   `agent`   the AI picks, gated on the mood layer.
 *   `ask`     the AI proposes and the user confirms.
 *
 * 🎯 **`pinned` is the default because an avatar that changes its own appearance before being
 * asked to is a surprise, and the first impression of an identity should be the user's choice.**
 * That is a product decision, and it is enforced by `DEFAULT_MODE` rather than by a comment: a
 * store with nothing in it produces a pinned agency, and the only way to leave that state is
 * `setMode`.
 *
 * ## 🎯 The preference, and why it is a method and not a comment
 *
 * The user's words, and they are binding: an AI able to express a preference even when overruled
 * is *"the difference between a puppet and a someone."*
 *
 * So `expressPreference()` is a first-class call that works in EVERY mode, including `pinned`, and
 * its result is recorded in `preferences` whether or not it was honoured. Being pinned means the
 * avatar does not change its clothes; it does not mean it has no opinion, and it does not mean the
 * opinion is discarded. `unheardPreferences()` is what a wardrobe screen shows the user when they
 * want to know what their agent would have worn.
 *
 * ⚠️ The preference is deliberately NOT a nag. Nothing here retries, escalates, or applies a
 * preference after enough refusals. It is stated once per call, kept, and that is all.
 *
 * ## Gated on the MOOD layer, never on affect
 *
 * 🚩 The affect layer has a 150–250 ms attack. Selecting an outfit from it would change the
 * avatar's clothes mid-sentence. Selection reads the MOOD layer, and `readMood` REFUSES a reading
 * that does not say it is one — see `MOOD_LAYER`. Two periods, both from research §6.5 by way of
 * punch-list 9.11: ten minutes before the outfit may change at all, twenty before it may change
 * BACK to something recently taken off, which is what stops a mood hovering on a boundary from
 * oscillating an outfit.
 *
 * ## What this class does not import, and the interface it needs instead
 *
 * ⚠️ `AffectState` was built in the same round as this file. Importing it would couple two things
 * that were both moving, so this file defines the shape it needs — `MoodReading` below — and the
 * integration was filed as a diffRequest rather than taken as an import.
 *
 * ✅ That request landed: `affect/AffectState.js` now exposes `readMood()`, which returns the slow
 * layer already tagged. `.pad` is the sum of emotion and mood and is the WRONG reader here. The
 * call site is one line and it names the layer out loud:
 *
 *     agency.consider( { ...situation, mood: affect.readMood() } )
 *
 * The tag is not ceremony. `pad` and `mood` are the same three field names with two different time
 * constants, so passing the wrong one is type-correct and silent, and the tag is the only thing
 * standing between that mistake and an avatar that changes clothes mid-sentence.
 *
 * Likewise `Dresser` (9.11): this class does not choose outfits, it decides whether a choice may
 * be applied. Anything with a `choose( context )` returning garment ids is a dresser, and 9.11's
 * is the real one.
 *
 * ## And it cannot violate 9.8
 *
 * Every applied outfit goes through `Wardrobe.dress`, which unions the decency floor into every
 * outfit in `#resolveOutfit`. There is no path from here to the body that skips it, in any mode.
 * `wardrobe.dress` is called; `wardrobe.body` is never touched.
 */

/** The three modes, and the one a fresh store produces. */
export const AGENCY_MODES = [ 'pinned', 'agent', 'ask' ];
export const DEFAULT_MODE = 'pinned';

/**
 * The layer a mood reading must declare itself to be from.
 *
 * 🚩 A guard rather than a convention. The affect layer and the mood layer are the same three
 * numbers with two different time constants, so a reading from the wrong one is type-correct,
 * plausible, and produces an avatar that changes clothes mid-sentence.
 */
export const MOOD_LAYER = 'mood';

/**
 * How long the outfit must hold before it may change, and before it may change BACK.
 *
 * Punch-list 9.11: "Gate selection on the MOOD layer (10 min change / 20 min return), never on the
 * affect layer (attack 150–250 ms)". The asymmetry is hysteresis: without the longer return, a
 * mood sitting on a decision boundary flips the outfit every period.
 */
export const MOOD_CHANGE_PERIOD_MS = 10 * 60 * 1000;
export const MOOD_RETURN_PERIOD_MS = 20 * 60 * 1000;

/** Where the agency's state lives between sessions. One key, one JSON document. */
export const STORE_KEY_PREFIX = 'sugata.wardrobe.agency.v1';

/** The persisted document's shape version, so a future field can be added without guessing. */
const STATE_VERSION = 1;

/**
 * A mood reading, as this class needs it. The interface, not an import — see the header.
 *
 * @typedef {Object} MoodReading
 * @property {'mood'} layer - Must be `MOOD_LAYER`. A reading from the affect layer is refused.
 * @property {number} pleasure - −1…+1.
 * @property {number} arousal - −1…+1.
 * @property {number} dominance - −1…+1.
 */

/** In-memory persistence. The node gate's store, and the fallback when there is no `localStorage`. */
export class MemoryStore {

    constructor( initial = {} ) {

        this.values = new Map( Object.entries( initial ) );

    }

    read( key ) {

        return this.values.get( key ) ?? null;

    }

    write( key, value ) {

        this.values.set( key, value );

    }

}

/**
 * `localStorage` persistence. The browser's store.
 *
 * Reads and writes are wrapped because `localStorage` throws rather than returning null in two
 * real cases — Safari's private mode, and a full quota — and an avatar that cannot remember what
 * it is wearing should still be able to get dressed.
 */
export class LocalStorageStore {

    constructor( storage = globalThis.localStorage ) {

        this.storage = storage;
        this.lastError = null;

    }

    read( key ) {

        try {

            return this.storage?.getItem( key ) ?? null;

        } catch ( error ) {

            this.lastError = error;
            return null;

        }

    }

    write( key, value ) {

        try {

            this.storage?.setItem( key, value );

        } catch ( error ) {

            this.lastError = error;

        }

    }

}

export class WardrobeAgency {

    /**
     * @param {Wardrobe} wardrobe
     * @param {Object} options
     * @param {{ choose: ( context: Object ) => string[] }} options.dresser - 9.11's Dresser, or
     *   anything with the same one method. Required: an agency with nothing to prefer has no
     *   preference to express, and the preference is half of what this class is for.
     * @param {{ read: ( key: string ) => ?string, write: ( key: string, value: string ) => void }}
     *   [options.store] - Defaults to `localStorage` in a browser and to memory elsewhere.
     * @param {string} [options.profile='default'] - Which identity's wardrobe this is. Continuity
     *   of appearance is continuity of identity, so two identities do not share a pin.
     * @param {() => number} [options.clock] - Milliseconds. Injected so the gate can prove the
     *   mood period without waiting ten minutes for it.
     */
    constructor( wardrobe, options ) {

        this.wardrobe = wardrobe;
        this.dresser = options.dresser;

        if ( this.dresser === undefined || typeof this.dresser.choose !== 'function' ) {

            throw new Error( 'WardrobeAgency: needs a dresser — an object with choose( context ) ' +
                'returning garment ids. 9.11\'s Dresser is the real one; the point of the seam is ' +
                'that this class decides whether a choice may be applied, not what it should be.' );

        }

        this.profile = options.profile ?? 'default';
        this.store = options.store ?? defaultStore();
        this.clock = options.clock ?? ( () => Date.now() );

        this.key = `${ STORE_KEY_PREFIX }:${ this.profile }`;

        const restored = readState( this.store, this.key );

        this.mode = restored.mode;
        this.pinnedOutfit = restored.pinnedOutfit;
        this.lastChangeAt = restored.lastChangeAt;
        this.lastWornAt = new Map( Object.entries( restored.lastWornAt ) );
        this.preferences = restored.preferences;
        this.currentRequest = restored.currentRequest;

        this.pending = null;
        this.pendingId = null;

    }

    /**
     * Restores the persisted appearance onto the figure. The "wakes up in the same clothes" call.
     *
     * Separate from the constructor because it is asynchronous — it fetches garment fragments —
     * and because a caller that only wants to read the mode should not have to pay for a dress.
     */
    async wake() {

        const outfit = this.pinnedOutfit ?? [];

        if ( outfit.length === 0 && this.mode !== 'pinned' ) return this.wardrobe.stats();

        return this.wardrobe.dress( outfit );

    }

    // --- the user's switch -------------------------------------------------------------------

    /**
     * Changes the mode. The user's call, and only the user's.
     *
     * `by` is required and must be `'user'`. It cannot be enforced technically — anything holding
     * the object can pass the string — but it makes the one line where agency changes hands
     * greppable, and it makes an agent that calls this a deliberate act rather than an accident.
     */
    setMode( mode, { by } = {} ) {

        if ( AGENCY_MODES.includes( mode ) === false ) {

            throw new Error( `WardrobeAgency: '${ mode }' is not a mode. ` +
                `Known: ${ AGENCY_MODES.join( ', ' ) }.` );

        }

        if ( by !== 'user' ) {

            throw new Error( 'WardrobeAgency: the user owns the mode switch. Pass ' +
                '{ by: \'user\' } from a control the user operated. An agent that wants a ' +
                'different mode should express a preference and let the user decide.' );

        }

        this.mode = mode;
        this.pending = null;
        this.pendingId = null;
        this.#persist();

        return this.mode;

    }

    /**
     * Fixes an outfit. Switches to `pinned` and wears it.
     *
     * Passing nothing pins whatever is currently worn, which is the case a "keep this" button in
     * the wardrobe screen wants.
     */
    async pin( garmentIds = null, { by } = {} ) {

        if ( by !== 'user' ) {

            throw new Error( 'WardrobeAgency: pinning is the user\'s call. Pass { by: \'user\' }.' );

        }

        const outfit = garmentIds ?? [ ...this.wardrobe.worn ];
        const stats = await this.wardrobe.dress( outfit );

        this.mode = 'pinned';
        this.pinnedOutfit = [ ...stats.worn ];
        this.currentRequest = [ ...outfit ];
        this.pending = null;
        this.pendingId = null;
        this.#persist();

        return stats;

    }

    // --- the AI's voice ----------------------------------------------------------------------

    /**
     * 🎯 What the AI would wear, asked in every mode including `pinned`, honoured or not.
     *
     * Returns the preference and records it. Never dresses anything — a preference that changed
     * the avatar would be `agent` mode with extra steps, and the whole point is that it is not.
     */
    expressPreference( context ) {

        const mood = readMood( context );
        const outfit = this.wardrobe.manifest.sortByLayer( this.dresser.choose( { ...context, mood } ) );

        const preference = {
            outfit,
            reason: describePreference( this.dresser, context, mood ),
            at: this.clock(),
            mode: this.mode,
            differsFromWorn: sameOutfit( outfit, this.wardrobe.worn ) === false,
            honoured: false
        };

        this.preferences.push( preference );
        this.#persist();

        return preference;

    }

    /** Every preference expressed that was never applied. What the agent would have worn. */
    unheardPreferences() {

        return this.preferences.filter( ( preference ) =>
            preference.honoured === false && preference.differsFromWorn );

    }

    // --- deciding ------------------------------------------------------------------------------

    /**
     * The AI asks to change. Returns what happened and why, and applies it only if it may.
     *
     * The preference is expressed FIRST, unconditionally, and then the mode decides what becomes
     * of it. That ordering is the design: there is no branch in which the AI is not asked.
     */
    async consider( context ) {

        const preference = this.expressPreference( context );

        if ( this.mode === 'pinned' ) {

            return this.#outcome( 'pinned', preference,
                'the user pinned this outfit; the preference is recorded, not applied' );

        }

        if ( preference.differsFromWorn === false ) {

            return this.#outcome( 'unchanged', preference, 'already wearing it' );

        }

        const held = this.#heldBy( preference.outfit );

        if ( held !== null ) {

            return this.#outcome( 'mood-period', preference, held );

        }

        if ( this.mode === 'ask' ) {

            // 🚩 The preference itself, not a copy of it. `#apply` marks `honoured` on the object
            // it is handed, and a spread here means the entry sitting in `preferences` is a
            // different object — so a proposal the user accepted would still be listed as one the
            // AI asked for and did not get, forever.
            this.pending = preference;
            this.pendingId = `${ preference.at }`;

            return this.#outcome( 'awaiting-user', preference,
                'proposed; waiting for the user to confirm' );

        }

        return this.#apply( preference );

    }

    /** The user says yes to an `ask` proposal. */
    async confirm( proposalId, { by } = {} ) {

        if ( by !== 'user' ) {

            throw new Error( 'WardrobeAgency: confirming a proposal is the user\'s call.' );

        }

        if ( this.pending === null || this.pendingId !== proposalId ) {

            throw new Error( `WardrobeAgency: there is no pending proposal '${ proposalId }'.` );

        }

        const preference = this.pending;
        this.pending = null;
        this.pendingId = null;

        return this.#apply( preference );

    }

    /** The user says no. Recorded, not argued with. */
    decline( proposalId, { by } = {} ) {

        if ( by !== 'user' ) {

            throw new Error( 'WardrobeAgency: declining a proposal is the user\'s call.' );

        }

        if ( this.pending === null || this.pendingId !== proposalId ) {

            throw new Error( `WardrobeAgency: there is no pending proposal '${ proposalId }'.` );

        }

        this.pending = null;
        this.pendingId = null;
        this.#persist();

        return this.#outcome( 'declined', this.preferences.at( -1 ) ?? null,
            'the user declined; the preference stays on the record' );

    }

    // --- what a gate and a UI both need to see ---------------------------------------------------

    /** Everything about the current state, as data. */
    state() {

        return {
            profile: this.profile,
            mode: this.mode,
            pinnedOutfit: this.pinnedOutfit === null ? null : [ ...this.pinnedOutfit ],
            worn: [ ...this.wardrobe.worn ],
            pending: this.pending === null ? null : { ...this.pending, id: this.pendingId },
            lastChangeAt: this.lastChangeAt,
            preferencesExpressed: this.preferences.length,
            preferencesUnheard: this.unheardPreferences().length,
            pinHolds: this.pinHolds()
        };

    }

    /**
     * 🚩 Whether what is worn is still what was pinned.
     *
     * A pin the agency honours is not the same claim as a pin that HOLDS: anything else in the
     * process can call `wardrobe.dress` directly, and the punch list names exactly that as the
     * red proof. This is the assertion that sees it, and it reads the wardrobe rather than this
     * object's own record of what it did.
     */
    pinHolds() {

        if ( this.mode !== 'pinned' || this.pinnedOutfit === null ) return true;

        return sameOutfit( this.pinnedOutfit, this.wardrobe.worn );

    }

    /** Puts the pinned outfit back on after something else changed it. */
    async restorePin() {

        if ( this.mode !== 'pinned' || this.pinnedOutfit === null ) return this.wardrobe.stats();

        return this.wardrobe.dress( this.pinnedOutfit );

    }

    // --- internals -------------------------------------------------------------------------------

    /** Why this outfit may not be worn yet, or null. The mood period, both halves of it. */
    #heldBy( outfit ) {

        const now = this.clock();

        if ( this.lastChangeAt !== null && now - this.lastChangeAt < MOOD_CHANGE_PERIOD_MS ) {

            const remaining = MOOD_CHANGE_PERIOD_MS - ( now - this.lastChangeAt );
            return `the outfit changed ${ Math.round( ( now - this.lastChangeAt ) / 1000 ) } s ` +
                `ago; ${ Math.round( remaining / 1000 ) } s of the mood period remain`;

        }

        const wornAt = this.lastWornAt.get( outfitKey( outfit ) );

        if ( wornAt !== undefined && now - wornAt < MOOD_RETURN_PERIOD_MS ) {

            const remaining = MOOD_RETURN_PERIOD_MS - ( now - wornAt );
            return `this outfit came off ${ Math.round( ( now - wornAt ) / 1000 ) } s ago; ` +
                `${ Math.round( remaining / 1000 ) } s of the return period remain`;

        }

        return null;

    }

    async #apply( preference ) {

        const stats = await this.wardrobe.dress( preference.outfit );

        preference.honoured = true;
        this.lastChangeAt = this.clock();

        // 🚩 Keyed on the REQUEST that produced the outgoing outfit, not on `wardrobe.worn`.
        //
        // `worn` is the request plus the decency floor, and `#heldBy` is asked about a request. The
        // first build of this keyed the two sides differently, so no key ever matched and the
        // return period was inert while the change period covered for it — the agency oscillated
        // between two outfits every eleven minutes and every other clause read green.
        if ( this.currentRequest !== null ) {

            this.lastWornAt.set( outfitKey( this.currentRequest ), this.lastChangeAt );

        }

        this.currentRequest = [ ...preference.outfit ];
        this.#persist();

        return { applied: true, reason: 'applied', preference, stats };

    }

    #outcome( status, preference, reason ) {

        return { applied: false, status, reason, preference, stats: this.wardrobe.stats() };

    }

    #persist() {

        // Only the tail of the preference log is kept. It is a record of what the agent wanted,
        // not an audit trail, and an unbounded list in localStorage is a quota error waiting for
        // the longest-running session.
        this.preferences = this.preferences.slice( -PREFERENCE_LOG_LIMIT );

        this.store.write( this.key, JSON.stringify( {
            version: STATE_VERSION,
            mode: this.mode,
            pinnedOutfit: this.pinnedOutfit,
            lastChangeAt: this.lastChangeAt,
            lastWornAt: Object.fromEntries( this.lastWornAt ),
            currentRequest: this.currentRequest,
            preferences: this.preferences
        } ) );

    }

}

const PREFERENCE_LOG_LIMIT = 64;

/**
 * Reads and validates a mood reading out of a selection context.
 *
 * 🚩 Throws on an affect-layer reading rather than using it. See MOOD_LAYER.
 */
export function readMood( context ) {

    const mood = context?.mood;

    if ( mood === undefined || mood === null ) {

        throw new Error( 'WardrobeAgency: the selection context has no mood. Pass ' +
            `{ mood: { layer: '${ MOOD_LAYER }', pleasure, arousal, dominance } }.` );

    }

    if ( mood.layer !== MOOD_LAYER ) {

        throw new Error( `WardrobeAgency: refusing a '${ mood.layer }' reading. Outfit selection ` +
            `is gated on the ${ MOOD_LAYER } layer; the affect layer has a 150-250 ms attack and ` +
            'would change the avatar\'s clothes mid-sentence.' );

    }

    for ( const axis of [ 'pleasure', 'arousal', 'dominance' ] ) {

        if ( typeof mood[ axis ] !== 'number' || Number.isFinite( mood[ axis ] ) === false ) {

            throw new Error( `WardrobeAgency: mood.${ axis } is ${ mood[ axis ] }, expected a number.` );

        }

    }

    return mood;

}

/** Whether the dresser explained itself, and a usable sentence either way. */
function describePreference( dresser, context, mood ) {

    if ( typeof dresser.explain === 'function' ) return dresser.explain( { ...context, mood } );

    return `chosen by ${ dresser.constructor?.name ?? 'the dresser' } at mood ` +
        `P${ mood.pleasure.toFixed( 2 ) } A${ mood.arousal.toFixed( 2 ) } D${ mood.dominance.toFixed( 2 ) }`;

}

/** Order-independent identity for an outfit. */
function outfitKey( ids ) {

    return [ ...ids ].sort().join( '|' );

}

function sameOutfit( first, second ) {

    return outfitKey( first ) === outfitKey( second );

}

function defaultStore() {

    return globalThis.localStorage === undefined ? new MemoryStore() : new LocalStorageStore();

}

/**
 * The persisted document, or the first-run defaults.
 *
 * 🎯 The first-run branch is the one the punch list names: an empty store produces `pinned`. A
 * corrupt document takes the same branch rather than throwing, because an agency that cannot parse
 * its own memory should still refuse to change the user's avatar.
 */
function readState( store, key ) {

    const blank = {
        mode: DEFAULT_MODE,
        pinnedOutfit: null,
        lastChangeAt: null,
        lastWornAt: {},
        currentRequest: null,
        preferences: []
    };

    const raw = store.read( key );
    if ( raw === null ) return blank;

    let parsed = null;

    try {

        parsed = JSON.parse( raw );

    } catch ( error ) {

        console.warn( `WardrobeAgency: ${ key } is not JSON; starting pinned. ${ error.message }` );
        return blank;

    }

    if ( parsed?.version !== STATE_VERSION || AGENCY_MODES.includes( parsed.mode ) === false ) {

        console.warn( `WardrobeAgency: ${ key } is version ${ parsed?.version } mode ` +
            `${ parsed?.mode }; starting pinned.` );
        return blank;

    }

    return {
        mode: parsed.mode,
        pinnedOutfit: Array.isArray( parsed.pinnedOutfit ) ? parsed.pinnedOutfit : null,
        lastChangeAt: typeof parsed.lastChangeAt === 'number' ? parsed.lastChangeAt : null,
        lastWornAt: parsed.lastWornAt ?? {},
        currentRequest: Array.isArray( parsed.currentRequest ) ? parsed.currentRequest : null,
        preferences: Array.isArray( parsed.preferences ) ? parsed.preferences : []
    };

}
