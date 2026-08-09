/**
 * The whole-state defects, plantable on any page that builds a `LightingRig` and a `GroundContact`.
 *
 * 🎯 WHY THIS IS A MODULE RATHER THAN A BLOCK IN `lighting.js`. These are the rejection proofs for
 * `LightingRig.selftest.mjs`'s light-state fingerprint and `GroundContact.selftest.mjs`'s surface
 * fingerprint — a gate whose whole claim is that it can see a mechanism nobody has met yet
 * (LEARNINGS §1.25t). A rejection proof that can only be run on the browsercheck page is a
 * paragraph describing an edit somebody once made, and `alive.html` is the page the seven objective
 * gates are measured on. Both pages import from here so one table answers for both.
 *
 * ⚠️ THE PIXEL FIGURES IN THE TABLE BELOW ARE `lighting.html` AT BODY FRAMING AND ARE NOT
 * TRANSFERABLE. A defect's pixel footprint is a property of the plate (§1.20): the same `decay`
 * injection measured 96.11% here and 41.64% on `alive.html`, and neither number supersedes the
 * other. Quote a figure with its page, its framing and its step count, or do not quote it.
 */

/**
 * 🎯 EVERY MECHANISM THE WHOLE-STATE FINGERPRINT CLAIMS TO CATCH, PLANTABLE ON THIS PAGE.
 *
 * `LightingRig.selftest.mjs` and `GroundContact.selftest.mjs` prove these red in headless
 * arithmetic. That is the right place for the proof and it is not the right place for the
 * EVIDENCE, because the claim a reviewer cares about is "this would have shown up in the picture",
 * and the last three rounds of this gate turned on exactly that gap: the caster defects were found
 * by an independent verifier measuring RENDERED PIXELS, after the selftests had scored 98/98 and
 * 65/65 through them.
 *
 * So each one is a URL parameter rather than a committed plate or a patch somebody once made —
 * the cheapest form a rejection proof can take and the only one that is re-runnable by anyone
 * (LEARNINGS §1.11e, `?cards=0`). To reproduce the two figures this round was handed:
 *
 *     /lighting.html?frame=body&bare&statedefect=decay     41.64% of the frame, worst delta 8/255
 *     /lighting.html?frame=body&bare&statedefect=cutoff    79.47%, 87/255, the key's modelling gone
 *
 * ⚠️ **A `?bare` defect plate looks like a clean plate and is not one.** There is no watermark; the
 * whole point is that these are invisible to everything except a difference. The plate is
 * identified by its URL, by `__LIGHTING_INFO__().stateDefect`, and by a `console.warn` on load, and a
 * number quoted from one of these without naming the parameter is a number about nothing.
 *
 * The mutation is installed on the rig's `solve`, not on its constructor, for the reason the
 * selftest records: `solve()` runs on every re-aim and every slider drag, so a one-shot mutation is
 * a no-op wearing a defect's name. Measured there — a body caster reads 25.835991187 shipped and
 * 25.835991187 with the build-time patch applied.
 */
export const LIGHT_STATE_DEFECTS = {

    decay: ( light ) => {

        if ( light.isSpotLight !== true ) return false;
        light.decay = 1;
        return true;

    },

    cutoff: ( light ) => {

        if ( light.isSpotLight !== true ) return false;
        light.distance = 1.2;
        return true;

    },

    shadowintensity: ( light ) => {

        if ( light.isSpotLight !== true ) return false;
        light.shadow.intensity = 0.5;
        return true;

    },

    shadowfocus: ( light ) => {

        if ( light.isSpotLight !== true ) return false;
        light.shadow.focus = 1.6;
        return true;

    },

    rimlayer: ( light ) => {

        if ( light.name !== 'rim' ) return false;
        light.layers.set( 1 );
        return true;

    },

    skyaxis: ( light ) => {

        if ( light.isHemisphereLight !== true ) return false;
        light.position.set( 0.6, 0.8, 0 );
        return true;

    },

    // ⚠️ A MIRROR, NOT A NON-UNIFORM SCALE. `?statedefect=panelscale` was written first with
    // (1, 2, 1) on the argument that `extractRotation` skews the basis, and measured **0.00% of
    // the frame moved** — the function NORMALISES each column, so a positive per-axis scale is
    // removed exactly. A negative one is not: `.length()` is positive, the sign survives, and the
    // panel's half-height points the other way. 98.86% of a 900x1200 body frame, worst Δ140/255.
    panelmirror: ( light ) => {

        if ( light.name !== 'key' ) return false;
        light.scale.set( 1, -1, 1 );
        return true;

    },

    panelaim: ( light ) => {

        if ( light.name !== 'fill' ) return false;
        light.rotateY( 0.2 );
        return true;

    }

};

/** The same, for the surface half of `albedo x occlusion x incident`. */
export const GROUND_STATE_DEFECTS = {

    receiveshadow: ( ground ) => { ground.mesh.receiveShadow = false; },
    metalness: ( ground ) => { ground.mesh.material.metalness = 0.4; },
    emissive: ( ground ) => { ground.mesh.material.emissive.setHex( 0x101010 ); },
    desync: ( ground ) => { ground.strengthUniform.value = 0; },
    tilt: ( ground ) => { ground.mesh.rotation.x += 0.05; },

    // ⚠️ KEPT WITH A MEASURED EFFECT OF ZERO, and labelled so nobody quotes it as a mover.
    // `material.toneMapped` false measures 0.00% of the frame moved on this page, because tone
    // mapping here is an OUTPUT pass rather than a per-material one. `GroundContact`'s fingerprint
    // still rejects it, and should: a closure covers a field before it matters.
    tonemapped: ( ground ) => { ground.mesh.material.toneMapped = false; }

};

/**
 * What each switch does to the picture, measured rather than argued.
 *
 * `/src/lighting.html?frame=body` at 900x1200 on WebGPU, one change at a time against the frame
 * immediately before it, element screenshots decoded and differenced, and every row's restore
 * verified to return the frame bit-for-bit. Two of the thirteen move NOTHING and are listed with
 * their zeros, because a table that quietly dropped them would be the same overclaim this whole
 * round is about (LEARNINGS §1.25h).
 *
 *   | switch                          | % of frame moved | worst Δ/255 |
 *   |---------------------------------|-----------------:|------------:|
 *   | `panelmirror`                   |           98.86% |         140 |
 *   | `decay`                         |           96.11% |          70 |
 *   | `cutoff`                        |           96.08% |         140 |
 *   | `panelaim`                      |           73.17% |           5 |
 *   | `skyaxis`                       |           42.91% |          12 |
 *   | `grounddefect=tilt`             |           31.20% |         104 |
 *   | `grounddefect=metalness`        |           26.31% |          19 |
 *   | `grounddefect=emissive`         |           26.31% |           7 |
 *   | `rimlayer`                      |           24.00% |         192 |
 *   | `grounddefect=desync`           |           19.07% |         108 |
 *   | `shadowintensity`               |            2.06% |          23 |
 *   | `grounddefect=receiveshadow`    |            1.49% |          20 |
 *   | `shadowfocus`                   |            0.74% |          26 |
 *   | `grounddefect=tonemapped`       |        **0.00%** |       **0** |
 *   | (a positive panel scale, 1x2x1) |        **0.00%** |       **0** |
 *
 * 🚩 Read the two ends together. `panelaim` moves three quarters of the frame at five code values
 * — invisible to a judge and invisible to every clause in both selftests before this round.
 * `shadowfocus` moves 0.74% at twenty-six — a shadow edge, which is the one place a viewer looks
 * for contact. Neither an area statistic nor a depth statistic alone would have ranked these; both
 * are needed, and neither is a substitute for the state fingerprint that catches them at all.
 */

/**
 * Installs one light-state defect for the life of the page, and reports how many DISTINCT light
 * objects it reached.
 *
 * Distinct objects, not calls — a call counter is how a previous round's caster finding came to be
 * reported against a rig that had not changed.
 *
 * @returns {?{ name: string, altered: number }}
 */
export function plantLightDefect( rig, name ) {

    if ( name === null || name === '' ) return null;

    const mutate = LIGHT_STATE_DEFECTS[ name ];

    if ( mutate === undefined ) {

        throw new Error( `?statedefect=${ name } is not one of ${ Object.keys( LIGHT_STATE_DEFECTS ).join( ', ' ) }` );

    }

    const solve = rig.solve.bind( rig );
    const altered = new Set();

    rig.solve = function () {

        solve();

        for ( const light of rig.lights ) if ( mutate( light ) === true ) altered.add( light );

    };

    rig.solve();

    return { name, get altered() {

        return altered.size;

    } };

}

/**
 * Installs one surface defect on a `GroundContact`, and returns the name so a report can carry it.
 *
 * Unlike the light half there is nothing to re-apply: `GroundContact` builds its mesh and its
 * uniform once and never re-solves them, so a one-shot mutation really is permanent here.
 *
 * @returns {?string}
 */
export function plantGroundDefect( ground, name ) {

    if ( name === null || name === '' ) return null;

    const mutate = GROUND_STATE_DEFECTS[ name ];

    if ( mutate === undefined ) {

        throw new Error( `?grounddefect=${ name } is not one of ` +
            `${ Object.keys( GROUND_STATE_DEFECTS ).join( ', ' ) }` );

    }

    mutate( ground );

    return name;

}
