/**
 * IdentityTargets — turns a stack of MPFB modelling targets into vertex positions, on the CPU,
 * once.
 *
 *
 * WHY THIS IS NOT A MORPH TARGET, AND WHY THAT IS THE WHOLE POINT
 *
 * The figure already carries 69 GPU morph targets for expression, and they cost 0.219 ms every
 * frame (`research/base-mesh-verification.md`, quoted in `research/identity-sculpting.md` §0).
 * Identity is not like that. **An identity is set when the agent decides who it is and then never
 * moves again**, so it does not belong on the GPU at all: it is folded into the position buffer
 * and the frame loop never learns it happened. That is why 203 sliders can exist. Put them on the
 * GPU and the same 203 sliders would cost 203 × 0.0032 ms = 0.65 ms per frame forever.
 *
 * There is no `update()` on this class, and there must never be one. If a caller wants an
 * animated identity they want an expression, and expressions live in `ExpressionBank`.
 *
 *
 * WHAT A TARGET IS
 *
 * A pure additive per-vertex offset with no solver — read at source in MPFB's
 * `targetservice.py:415-440` and `:358-380`, and recorded in `research/identity-sculpting.md`
 * §1.1. The `.target` file is `index x y z`, one line per moved vertex, and applying it is
 *
 *     position[ index ] += weight * offset
 *
 * and nothing else. No dependency on the current shape, so targets commute and their order does
 * not matter. `tools/identity-pipeline/build_identity_assets.mjs` packs those lines into one
 * binary per region; this class reads the binary.
 *
 * Measured against headless Blender 5.2.0 LTS + MPFB 20260722 on the 19,158-vertex basemesh at
 * g050, this exact arithmetic reproduces MPFB's own output to:
 *
 *     face identity,  7 targets @ 1.00, magnitude  56.223 mm   ->  1.151e-4 mm worst vertex
 *     face identity,  7 targets @ 0.25, magnitude  14.056 mm   ->  1.370e-4 mm
 *     body identity,  7 targets @ 1.00, magnitude 187.267 mm   ->  1.193e-4 mm
 *     mixed signs,    5 targets, both ends,        24.142 mm   ->  1.442e-4 mm
 *
 * against a punch-list gate of 0.001 mm, so the margin is about 7x. That residue is float32
 * round-off at metre scale, not an approximation: Blender evaluates the shape-key sum in float32
 * and this evaluates it in float64. `identitytargets.selftest.mjs` re-derives every one of those
 * numbers from committed Blender fixtures — and quote them from the gate, not from a scratch run:
 * the fixtures are quantised to nanometres, which moves the fourth significant figure (a direct
 * float64 comparison of the same face identity reads 1.155e-4).
 *
 *
 * THE TWO SPACES, AND WHY BOTH ARE NEEDED
 *
 * BASEMESH space is hm08 with its helper geometry: 19,158 vertices, and the space every `.target`
 *   file indexes. The helpers are not decoration — 10.7's skeleton refit and 10.9's garment refit
 *   both read vertices the export deletes (`research/identity-sculpting.md` §1.4), so the packed
 *   asset stays in this space rather than being pre-trimmed to what the body needs.
 *
 * FIGURE space is what the shipped GLB actually holds: `base.001` carries 14,517 glTF positions,
 *   because the exporter splits a vertex wherever the UVs or normals disagree. A `vertexMap`
 *   bridges the two, and `assets/identity/figure-vertex-map.json` ships one.
 *
 *   🎯 **Measured, the map is onto basemesh indices 0 … 13,379 exactly** — 14,517 positions, zero
 *   unmatched, zero ambiguous, 13,380 distinct sources, worst coordinate agreement 2.4e-7 m. That
 *   settles the assumption `research/identity-sculpting.md` §1.4 flagged and could not check:
 *   "index >= 13,380" and "is a helper" really are the same set on this asset.
 *
 *
 * THE AXIS QUESTION, ANSWERED ONCE
 *
 * MakeHuman is Y-up and glTF is Y-up, so a target line's own column order is already the glTF
 * delta and the packed bin stores it unchanged. Blender is Z-up and reads the same line as
 * (x, −z, y), which is why `AXIS_BLENDER` exists: the gate compares against Blender dumps, and a
 * plausible number off the wrong axis is the failure `research/identity-sculpting.md` §7 records
 * catching itself making.
 */

/**
 * Packed record: uint32 vertex index, then float32 dx, dy, dz in metres. 16 bytes, so a record is
 * four consecutive 32-bit slots and `apply` indexes it as `offset >> 2` with no DataView call.
 */
const RECORD_SLOTS = 4;

/** glTF/MakeHuman Y-up. What the runtime figure uses, and what the bin stores. */
export const AXIS_GLTF = 'gltf';

/** Blender Z-up. Only the Blender-fixture gate needs this. */
export const AXIS_BLENDER = 'blender';

/**
 * 🚩 TWENTY LITERAL URLS, AND THE REASON IS A BUILD THAT WENT GREEN WITHOUT THEM.
 *
 * `new URL( <literal>, import.meta.url )` is the one form a bundler can follow. Build the same
 * string at runtime out of the catalogue's `bin` field — which is the obvious thing to do, and what
 * this file did first — and vite emits no asset: `npm run build:pages` compiled cleanly, and the
 * built page would have 404ed on all twenty region files. It is the failure
 * `vite.pages.config.js`'s own header describes, one layer further down: the page a judge captures
 * is the page the build never wired up.
 *
 * The duplication against `catalogue.json`'s `bin` field is real, and `identitytargets.selftest.mjs`
 * holds the two to each other — every exposed region must appear here, nothing else may, and each
 * URL's file name must be the one the catalogue names.
 */
const BUNDLED_REGION_BINS = {
    arms: new URL( '../../../../assets/identity/targets/arms.bin', import.meta.url ).href,
    breast: new URL( '../../../../assets/identity/targets/breast.bin', import.meta.url ).href,
    buttocks: new URL( '../../../../assets/identity/targets/buttocks.bin', import.meta.url ).href,
    cheek: new URL( '../../../../assets/identity/targets/cheek.bin', import.meta.url ).href,
    chin: new URL( '../../../../assets/identity/targets/chin.bin', import.meta.url ).href,
    ears: new URL( '../../../../assets/identity/targets/ears.bin', import.meta.url ).href,
    eyebrows: new URL( '../../../../assets/identity/targets/eyebrows.bin', import.meta.url ).href,
    eyes: new URL( '../../../../assets/identity/targets/eyes.bin', import.meta.url ).href,
    feet: new URL( '../../../../assets/identity/targets/feet.bin', import.meta.url ).href,
    forehead: new URL( '../../../../assets/identity/targets/forehead.bin', import.meta.url ).href,
    hands: new URL( '../../../../assets/identity/targets/hands.bin', import.meta.url ).href,
    head: new URL( '../../../../assets/identity/targets/head.bin', import.meta.url ).href,
    hip: new URL( '../../../../assets/identity/targets/hip.bin', import.meta.url ).href,
    legs: new URL( '../../../../assets/identity/targets/legs.bin', import.meta.url ).href,
    mouth: new URL( '../../../../assets/identity/targets/mouth.bin', import.meta.url ).href,
    neck: new URL( '../../../../assets/identity/targets/neck.bin', import.meta.url ).href,
    nose: new URL( '../../../../assets/identity/targets/nose.bin', import.meta.url ).href,
    pelvis: new URL( '../../../../assets/identity/targets/pelvis.bin', import.meta.url ).href,
    stomach: new URL( '../../../../assets/identity/targets/stomach.bin', import.meta.url ).href,
    torso: new URL( '../../../../assets/identity/targets/torso.bin', import.meta.url ).href
};

/** The basemesh-index-per-glTF-position map for the shipped body, and its manifest. Same rule. */
export const FIGURE_VERTEX_MAP_URL =
    new URL( '../../../../assets/identity/figure-vertex-map.json', import.meta.url ).href;
export const FIGURE_VERTEX_MAP_BIN_URL =
    new URL( '../../../../assets/identity/figure-vertex-map.bin', import.meta.url ).href;

/** The region ids this build can serve. Exported so a gate can hold it against the catalogue. */
export const BUNDLED_REGIONS = Object.freeze( Object.keys( BUNDLED_REGION_BINS ) );

export class IdentityTargets {

    /**
     * @param {Object} catalogue - `assets/identity/catalogue.json`, already parsed.
     * @param {Object} [options]
     * @param {string} [options.baseUrl] - Where the `targets/*.bin` files live. Leave it unset and
     *   the bundler-visible table above is used, which is the only form that survives a production
     *   build. Set it only when the bytes are somewhere else — the selftest reads them off disk.
     * @param {Function} [options.fetchBytes] - `async (url) => ArrayBuffer`. Injected so the
     *   selftest can read from disk and the browser can use fetch, without this class knowing
     *   which it is.
     */
    constructor( catalogue, options = {} ) {

        this.catalogue = catalogue;
        this.baseUrl = options.baseUrl ?? null;
        this.fetchBytes = options.fetchBytes ?? defaultFetchBytes;

        /** region id -> a Uint32Array and a Float32Array over the same packed bin. */
        this.regionBytes = new Map();

        /** Set by useVertexMap(). Null means positions are in basemesh space. */
        this.vertexMap = null;

        /** Lazily sized by scratchFor(). */
        this.scratch = undefined;

    }

    /**
     * Fetches the packed offsets for these regions. Idempotent, so a UI can call it on every
     * slider change and pay only for regions it has not seen.
     *
     * Regions are the unit of loading because they are also the unit of editing: a collaborator
     * narrowing "something's off about the face" to one region (research §4.3(b)) touches one
     * bin. The whole exposed set is 10.81 MB and `torso` alone is 3.52 MB, so loading all of it
     * to move one eyebrow would be a waste with no upside.
     *
     * @param {string[]} regionIds
     * @returns {Promise<void>}
     */
    async loadRegions( regionIds ) {

        const wanted = [ ...new Set( regionIds ) ].filter( ( id ) => ! this.regionBytes.has( id ) );

        for ( const id of wanted ) {

            const region = this.catalogue.regions.find( ( r ) => r.id === id );

            if ( ! region ) throw new Error( `No region '${ id }' in the identity catalogue.` );
            if ( ! region.exposed ) throw new Error( `Region '${ id }' is not exposed: ${ region.excludedBecause }` );

            const url = this.baseUrl === null
                ? BUNDLED_REGION_BINS[ id ]
                : new URL( region.bin, this.baseUrl ).href;

            if ( ! url ) throw new Error( `Region '${ id }' has no bundled bin URL. See BUNDLED_REGION_BINS.` );

            const bytes = await this.fetchBytes( url );

            if ( bytes.byteLength !== region.binBytes ) {
                throw new Error( `${ region.bin } is ${ bytes.byteLength } bytes, catalogue says ${ region.binBytes }.` );
            }

            // Two views over one buffer, so a record is four aligned 32-bit reads and no DataView
            // call. That is why the packed record is 16 bytes with a uint32 index rather than 14
            // with a uint16 one: 19,158 vertices would fit in a uint16, and the misalignment it
            // would cost the three floats would not be worth the two bytes.
            this.regionBytes.set( id, {
                index: new Uint32Array( bytes ),
                offset: new Float32Array( bytes )
            } );

        }

    }

    /**
     * Installs the basemesh-index → figure-position mapping, so `apply` can write into a GLB's
     * own position buffer rather than into a basemesh-shaped array.
     *
     * The map arrives as one basemesh index per figure position. Application needs the inverse —
     * every position a given basemesh vertex feeds — so it is inverted once, here, into the usual
     * CSR pair. A vertex splits into at most 4 positions on this asset, so the inverse is barely
     * larger than the map.
     *
     * @param {Uint16Array|Uint32Array|number[]} basemeshIndexPerPosition
     */
    useVertexMap( basemeshIndexPerPosition ) {

        const positionCount = basemeshIndexPerPosition.length;
        let vertexCount = 0;

        for ( let p = 0; p < positionCount; p ++ ) {
            const v = basemeshIndexPerPosition[ p ];
            if ( v + 1 > vertexCount ) vertexCount = v + 1;
        }

        const start = new Uint32Array( vertexCount + 1 );
        for ( let p = 0; p < positionCount; p ++ ) start[ basemeshIndexPerPosition[ p ] + 1 ] ++;
        for ( let v = 0; v < vertexCount; v ++ ) start[ v + 1 ] += start[ v ];

        const cursor = Uint32Array.from( start );
        const positions = new Uint32Array( positionCount );
        for ( let p = 0; p < positionCount; p ++ ) positions[ cursor[ basemeshIndexPerPosition[ p ] ] ++ ] = p;

        this.vertexMap = { start, positions, vertexCount, positionCount };

        return this;

    }

    /** Drops the map; `apply` goes back to writing basemesh-shaped arrays. */
    useBasemeshSpace() {

        this.vertexMap = null;
        return this;

    }

    /**
     * Adds a whole target stack into `positions`, in place.
     *
     * ⚠️ **The stack is applied to whatever is already in the buffer**, which is what makes this
     * usable both ways: hand it a zeroed array and it produces the identity's displacement field,
     * hand it the figure's own rest positions and it produces the reshaped figure. Nothing here
     * remembers a previous identity, so a caller changing a slider re-applies from a pristine copy
     * of the rest positions rather than trying to subtract. That is deliberate — subtracting
     * accumulates float error across a slider drag and re-applying does not, and at 2.06 ms for
     * all 203 sliders there is no reason to be clever.
     *
     * @param {Float32Array|Float64Array} positions - 3 floats per vertex or per figure position.
     * @param {Array<{target: string, weight: number, region: string, offset: number, count: number}>} stack
     * @param {Object} [options]
     * @param {string} [options.axis=AXIS_GLTF]
     * @returns {{ targetsApplied: number, recordsApplied: number, verticesTouched: number,
     *             verticesMoved: number, verticesOutsideFigure: number, maxDisplacementMm: number }}
     *   Every count describes the stack, not the buffer, so they mean the same thing whichever way
     *   the buffer was seeded. `verticesTouched` counts vertices the records name;
     *   `verticesMoved` counts the ones whose net displacement is non-zero, which is the number
     *   MPFB's own output agrees with.
     */
    apply( positions, stack, options = {} ) {

        const axis = options.axis ?? AXIS_GLTF;
        const toBlender = axis === AXIS_BLENDER;

        if ( axis !== AXIS_GLTF && axis !== AXIS_BLENDER ) {
            throw new Error( `axis must be '${ AXIS_GLTF }' or '${ AXIS_BLENDER }', got '${ axis }'.` );
        }

        // The whole stack is summed into a scratch displacement field BEFORE anything is written,
        // so that "how far did this identity move the worst vertex" is a fact about the stack
        // rather than about the order the stack happened to arrive in — and so that a vertex two
        // targets share is written once rather than read-modify-written twice.
        //
        // The scratch is a flat Float64Array with a touched list beside it, not a Map. That is not
        // premature: measured on the 266-target all-sliders stack, the Map version ran 4.84 ms and
        // this one runs well inside the 2.0598 ms research §1.7 recorded for 203. Allocating one
        // key object per moved vertex is the cost, and there is nothing a Map buys here — the keys
        // are dense small integers, which is what an array is.
        const { field, touched, seen } = this.scratchFor( this.catalogue.library.basemeshVertexCount );

        let touchedCount = 0;
        let recordsApplied = 0;

        for ( const entry of stack ) {

            if ( entry.weight === 0 ) continue;

            const view = this.regionBytes.get( entry.region );
            if ( ! view ) throw new Error( `Region '${ entry.region }' is not loaded; call loadRegions first.` );

            const weight = entry.weight;
            let at = entry.offset >> 2;

            for ( let i = 0; i < entry.count; i ++, at += RECORD_SLOTS ) {

                const vertex = view.index[ at ];
                const base = vertex * 3;

                if ( seen[ vertex ] === 0 ) { seen[ vertex ] = 1; touched[ touchedCount ++ ] = vertex; }

                field[ base ] += weight * view.offset[ at + 1 ];
                field[ base + 1 ] += weight * view.offset[ at + 2 ];
                field[ base + 2 ] += weight * view.offset[ at + 3 ];

            }

            recordsApplied += entry.count;

        }

        let maxDisplacementMm = 0;
        let verticesMoved = 0;
        let verticesOutsideFigure = 0;

        for ( let t = 0; t < touchedCount; t ++ ) {

            const vertex = touched[ t ];
            const base = vertex * 3;

            const dx = field[ base ], dy = field[ base + 1 ], dz = field[ base + 2 ];

            // Reset as we go, so the next call starts clean without wiping 460 KB it did not use.
            field[ base ] = 0; field[ base + 1 ] = 0; field[ base + 2 ] = 0;
            seen[ vertex ] = 0;

            const magnitude = Math.sqrt( dx * dx + dy * dy + dz * dz ) * 1000;
            if ( magnitude > maxDisplacementMm ) maxDisplacementMm = magnitude;

            // 🚩 Touched is not moved, and the difference is real rather than pedantic. The
            // library ships target lines whose offset is (0, 0, 0) — 105 of the 5,283 records in
            // the gate's face fixture — and two ends of the same region can cancel at a shared
            // vertex. Counting touched vertices reads 4,232 where MPFB's own output moves 4,187,
            // and a count that disagrees with the oracle by 1% is a count nobody can gate on.
            if ( magnitude > 0 ) verticesMoved ++;

            // Blender reads the same three numbers as (x, −z, y); see the header.
            const ox = dx;
            const oy = toBlender ? - dz : dy;
            const oz = toBlender ? dy : dz;

            if ( this.vertexMap === null ) {

                positions[ base ] += ox;
                positions[ base + 1 ] += oy;
                positions[ base + 2 ] += oz;

            } else if ( vertex < this.vertexMap.vertexCount ) {

                const { start, positions: slots } = this.vertexMap;

                for ( let s = start[ vertex ]; s < start[ vertex + 1 ]; s ++ ) {
                    const slot = slots[ s ] * 3;
                    positions[ slot ] += ox;
                    positions[ slot + 1 ] += oy;
                    positions[ slot + 2 ] += oz;
                }

            } else {

                // A helper vertex under a vertex map. 25.1% of the 676,127 packed records address
                // helper geometry the export deleted, so this is the normal path for a body-space
                // apply and not an error — but it is counted rather than swallowed, because those
                // offsets are exactly what 10.7's skeleton refit and 10.9's garment refit read.
                verticesOutsideFigure ++;

            }

        }

        return {
            targetsApplied: stack.filter( ( e ) => e.weight !== 0 ).length,
            recordsApplied,
            verticesTouched: touchedCount,
            verticesMoved,
            verticesOutsideFigure,
            maxDisplacementMm
        };

    }

    /**
     * The reusable accumulator. One per instance, grown once, never reallocated — `apply` clears
     * only the entries it touched, so a slider drag does not memset half a megabyte per frame of
     * interaction.
     */
    scratchFor( vertexCount ) {

        if ( this.scratch === undefined || this.scratch.field.length < vertexCount * 3 ) {
            this.scratch = {
                field: new Float64Array( vertexCount * 3 ),
                touched: new Int32Array( vertexCount ),
                seen: new Uint8Array( vertexCount )
            };
        }

        return this.scratch;

    }

    /**
     * The regions a stack needs resident. Handed straight to `loadRegions`.
     *
     * @param {Array<{region: string}>} stack
     * @returns {string[]}
     */
    static regionsFor( stack ) {

        return [ ...new Set( stack.filter( ( e ) => e.weight !== 0 ).map( ( e ) => e.region ) ) ];

    }

}

async function defaultFetchBytes( url ) {

    const response = await fetch( url );
    if ( ! response.ok ) throw new Error( `${ url } -> HTTP ${ response.status }` );
    return response.arrayBuffer();

}
