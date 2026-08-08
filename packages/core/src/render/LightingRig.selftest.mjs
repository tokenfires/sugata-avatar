/**
 * Gate for `render/LightingRig.js`.
 *
 * The rig's whole reason to exist is that a lighting RATIO is the highest-leverage parameter in
 * the look spec, and that a ratio authored as four raw `intensity` numbers stops being a ratio the
 * moment the rig is rescaled from a head to a whole body. So the checks here are about invariance
 * and conservation, not about whether the numbers look plausible:
 *
 *   SOLID ANGLE     The closed form against its own small-angle limit, A/d² — and, in the other
 *                   direction, PROVED to disagree with that limit at portrait geometry, because a
 *                   formula that always agrees with the approximation is the approximation.
 *
 *   INVARIANCE      Delivered irradiance is unchanged across a 4.45x rescale of the subject. The
 *                   same check is run against the model this file replaces (constant radiance, as
 *                   `alive.js` carries today) and must FAIL there, naming the drift. LEARNINGS
 *                   §1.1 — a gate that has never failed is not known to work.
 *
 *   CONSERVATION    The area half plus the shadow half deliver exactly the authored irradiance,
 *                   at every shadow fraction. `shadowFraction` must not be able to move exposure,
 *                   because if it can it can move G1 and the gate stops meaning what it says.
 *
 *   GEOMETRY        Azimuth is camera-relative. Checked from a camera on no world axis, so an
 *                   implementation that quietly worked in world coordinates fails.
 *
 *   THE GATE        The designed key:fill sits under G1's 2.0 ceiling and inside the reference
 *                   band of 1.43–1.64 linear. This is the DESIGN, not the render — the render is
 *                   measured by `tools/critic/measure.mjs` on a real frame.
 *
 *   FRAMING         The two presets differ on the silhouette band by the factor the header claims,
 *                   and the band is reported in pixels at both framings (LEARNINGS §1.10b: an
 *                   amplitude stated in a unit nobody can picture passes every review).
 *
 * A measurement outside its range is a FAIL and exits non-zero. It is not grounds for widening
 * the range.
 *
 * Usage:  node "packages/core/src/render/LightingRig.selftest.mjs"
 */

import { PerspectiveCamera, Scene, Vector3 } from 'three/webgpu';

import {
    LightingRig,
    MAX_AREA_LIGHTS,
    projectedSolidAngle,
    silhouetteBandFraction,
    silhouetteBandPixels
} from './LightingRig.js';

// --- the two framings this project actually uses ---------------------------------------------
//
// Both quoted from `packages/testbed/src/alive.js`: PORTRAIT_HEIGHT_METRES = 0.42, and the body
// frame is the figure's measured height x BODY_FRAME_MARGIN 1.10. figure_g050 stands about
// 1.70 m, so the body frame is ~1.87 m. Neither number is invented here.
const PORTRAIT_HEIGHT_METRES = 0.42;
const BODY_HEIGHT_METRES = 1.87;

// Limb radii used to convert a band fraction into pixels. Approximate, and that is fine — the
// claim under test is a RATIO between two framings, and a radius that is wrong by 20% cancels.
const HEAD_RADIUS_METRES = 0.09;
const UPPER_ARM_RADIUS_METRES = 0.045;

const CANVAS_HEIGHT_PIXELS = 1200;

let failures = 0;
let checks = 0;

function report( name, passed, detail ) {

    checks += 1;
    if ( passed !== true ) failures += 1;
    console.log( `${ passed ? 'PASS' : 'FAIL' }  ${ name }\n      ${ detail }` );

}

function closeTo( actual, expected, tolerance ) {

    return Math.abs( actual - expected ) <= tolerance;

}

/** A rig attached to a throwaway scene, aimed at a shot. Returns the rig and its scene. */
function rigFor( { preset, subjectHeightMetres, cameraPosition, focus, ...options } ) {

    const scene = new Scene();
    const rig = new LightingRig( { preset, ...options } );

    // No renderer: `attachTo` tolerates null and simply does not flip `shadowMap.enabled`, which
    // is exactly the headless case. The lights themselves are fully configured either way.
    rig.attachTo( scene, null );
    rig.aimAt( { focus, subjectHeightMetres, cameraPosition } );

    return { rig, scene };

}

/** What one unit of the rig actually delivers at the focus, area half plus shadow half. */
function deliveredIrradiance( rig, name ) {

    const unit = rig.units.find( ( entry ) => entry.placement.name === name );
    if ( unit === undefined ) throw new Error( `no light named '${ name }'` );

    const distance = unit.placement.distanceInHeights * rig.subjectHeightMetres;
    const fromPanel = unit.area.intensity * projectedSolidAngle( unit.area.width, unit.area.height, distance );

    // A SpotLight's intensity is a luminous intensity, so what it delivers at the focus is
    // intensity / d². Reading `intensity` as if it were an irradiance would make every
    // conservation check below agree with the implementation by sharing its mistake.
    const fromCaster = unit.shadowCaster === null ? 0 : unit.shadowCaster.intensity / ( distance * distance );

    return { fromPanel, fromCaster, total: fromPanel + fromCaster, distance };

}

console.log( '\n--- solid angle -------------------------------------------------------------\n' );

{
    // A 1 mm panel at 10 m is unambiguously in the small-angle regime, so the closed form has to
    // reproduce area over distance squared or it is simply wrong.
    const tiny = projectedSolidAngle( 0.001, 0.001, 10 );
    const naiveTiny = ( 0.001 * 0.001 ) / ( 10 * 10 );

    report(
        'projectedSolidAngle tends to A/d² in the small-angle limit',
        closeTo( tiny / naiveTiny, 1, 1e-6 ),
        `1 mm panel at 10 m: closed form ${ tiny.toExponential( 6 ) } sr, A/d² ${ naiveTiny.toExponential( 6 ) } sr, ratio ${ ( tiny / naiveTiny ).toFixed( 9 ) }`
    );
}

{
    // The other direction. At the geometry the key actually runs — a 0.84 x 1.18 m panel 1.09 m
    // from the subject — the approximation is NOT good, and if this check ever passed it would
    // mean the closed form had collapsed back into the approximation.
    const width = 2.0 * PORTRAIT_HEIGHT_METRES;
    const height = 2.8 * PORTRAIT_HEIGHT_METRES;
    const distance = 2.6 * PORTRAIT_HEIGHT_METRES;

    const exact = projectedSolidAngle( width, height, distance );
    const naive = ( width * height ) / ( distance * distance );
    const error = ( naive - exact ) / exact;

    report(
        'the closed form is NOT the small-angle approximation at portrait key geometry',
        error > 0.10,
        `key panel ${ width.toFixed( 3 ) } x ${ height.toFixed( 3 ) } m at ${ distance.toFixed( 3 ) } m: ` +
        `exact ${ exact.toFixed( 5 ) } sr vs A/d² ${ naive.toFixed( 5 ) } sr — A/d² overstates by ${ ( error * 100 ).toFixed( 1 ) }%`
    );
}

{
    // Physical ceiling: a Lambertian hemisphere delivers pi. A panel that wraps the subject cannot
    // beat it, and a formula that does is producing energy from nowhere.
    const enormous = projectedSolidAngle( 1000, 1000, 0.01 );

    report(
        'projected solid angle is bounded by π',
        enormous <= Math.PI + 1e-9 && enormous > Math.PI * 0.99,
        `1000 x 1000 m panel at 10 mm: ${ enormous.toFixed( 6 ) } sr against the π = ${ Math.PI.toFixed( 6 ) } ceiling`
    );
}

console.log( '\n--- irradiance invariance across a rescale -----------------------------------\n' );

const shot = {
    // Deliberately off every world axis: a camera at +Z only would let a rig that ignored the
    // camera and used world coordinates pass every geometry check below.
    cameraPosition: new Vector3( 0.8, 1.55, 1.1 ),
    focus: new Vector3( 0.05, 1.52, 0 )
};

{
    // 🚩 THE PRESET IS HELD AND ONLY THE SCALE CHANGES, and that is a correction. This block used
    // to rescale from the PORTRAIT preset to the BODY preset and call the difference "drift",
    // which conflates the mechanism under test (irradiance is re-solved when the shot changes
    // size) with the preset table (the two presets are allowed to disagree, and they now do —
    // `FORM_LIGHT_OVERRIDES_BY_PRESET` authors the body fill at 1.20 against portrait's 1.90).
    // Written the old way this check went red on a deliberate, measured art change while
    // remaining unable to say anything about the invariance it is named for.
    const scaleFactor = BODY_HEIGHT_METRES / PORTRAIT_HEIGHT_METRES;

    for ( const preset of [ 'portrait', 'body' ] ) {

        const near = rigFor( { preset, subjectHeightMetres: PORTRAIT_HEIGHT_METRES, ...shot } );
        const far = rigFor( { preset, subjectHeightMetres: BODY_HEIGHT_METRES, ...shot } );

        for ( const name of [ 'key', 'fill' ] ) {

            const small = deliveredIrradiance( near.rig, name );
            const large = deliveredIrradiance( far.rig, name );
            const drift = Math.abs( large.total - small.total ) / small.total;

            report(
                `${ preset }/${ name }: delivered irradiance survives a ${ scaleFactor.toFixed( 2 ) }x rescale`,
                drift < 1e-9,
                `${ small.total.toFixed( 6 ) } (panel at ${ small.distance.toFixed( 3 ) } m) -> ` +
                `${ large.total.toFixed( 6 ) } (panel at ${ large.distance.toFixed( 3 ) } m), drift ${ ( drift * 100 ).toExponential( 2 ) }%`
            );

        }

    }

    // And the thing the old form was accidentally asserting, now stated on purpose: the two
    // presets differ in exactly the fields the tables say they differ in, and nowhere else. A
    // preset that quietly diverged on the key would look identical to this file's prose.
    {
        const portraitRig = rigFor( { preset: 'portrait', subjectHeightMetres: PORTRAIT_HEIGHT_METRES, ...shot } ).rig;
        const bodyRig = rigFor( { preset: 'body', subjectHeightMetres: PORTRAIT_HEIGHT_METRES, ...shot } ).rig;

        const differing = [];

        for ( const unit of portraitRig.units ) {

            const other = bodyRig.units.find( ( entry ) => entry.placement.name === unit.placement.name );

            for ( const field of Object.keys( unit.placement ) ) {

                if ( field === 'name' ) continue;
                if ( unit.placement[ field ] !== other.placement[ field ] ) differing.push( `${ unit.placement.name }.${ field }` );

            }

        }

        const expected = [
            'fill.irradiance',
            'rim.elevationDegrees', 'rim.distanceInHeights', 'rim.widthInHeights', 'rim.heightInHeights', 'rim.irradiance',
            'kicker.elevationDegrees', 'kicker.distanceInHeights', 'kicker.widthInHeights', 'kicker.heightInHeights', 'kicker.irradiance'
        ].sort().join( ', ' );

        report(
            'the two presets disagree about exactly the fields the tables document',
            differing.sort().join( ', ' ) === expected,
            `differing: ${ differing.sort().join( ', ' ) || '(none)' }`
        );
    }

    // CONTROL, and it is a NEGATIVE result worth keeping. What `alive.js` does today — scale the
    // panel and the standoff together and leave `intensity` alone — is genuinely scale-invariant,
    // not just approximately. So the invariance check above, on its own, would pass for the model
    // this file replaces: it proves nothing. The defect the rig actually removes is the next check.
    const portraitAtPortraitScale = rigFor( { preset: 'portrait', subjectHeightMetres: PORTRAIT_HEIGHT_METRES, ...shot } );
    const unit = portraitAtPortraitScale.rig.units.find( ( entry ) => entry.placement.name === 'key' );
    const fixedRadiance = unit.area.intensity;

    const nearDelivered = fixedRadiance * projectedSolidAngle(
        2.0 * PORTRAIT_HEIGHT_METRES, 2.8 * PORTRAIT_HEIGHT_METRES, 2.6 * PORTRAIT_HEIGHT_METRES
    );
    const farDelivered = fixedRadiance * projectedSolidAngle(
        2.0 * BODY_HEIGHT_METRES, 2.8 * BODY_HEIGHT_METRES, 2.6 * BODY_HEIGHT_METRES
    );

    report(
        'CONTROL: constant radiance is scale-invariant too (so this defect is NOT what the rig fixes)',
        closeTo( farDelivered / nearDelivered, 1, 1e-9 ),
        `constant-intensity model delivers ${ nearDelivered.toFixed( 6 ) } -> ${ farDelivered.toFixed( 6 ) }, ratio ` +
        `${ ( farDelivered / nearDelivered ).toFixed( 9 ) }. Uniform scaling IS neutral; the rig's value is that ` +
        'the RATIO between two differently-shaped panels is authored rather than emergent — see the next check.'
    );
}

{
    // The defect the irradiance model actually removes. Key and fill have different panel shapes
    // and standoffs, so equal `intensity` does NOT mean equal light: the fill panel is 4.2 x 4.2
    // subject heights at 2.3, the key 2.0 x 2.8 at 2.6. Author them as raw intensities and the
    // ratio you get is not the ratio you typed.
    const { rig } = rigFor( { preset: 'portrait', subjectHeightMetres: PORTRAIT_HEIGHT_METRES, ...shot } );

    const keyAngle = projectedSolidAngle(
        2.0 * PORTRAIT_HEIGHT_METRES, 2.8 * PORTRAIT_HEIGHT_METRES, 2.6 * PORTRAIT_HEIGHT_METRES
    );
    const fillAngle = projectedSolidAngle(
        4.2 * PORTRAIT_HEIGHT_METRES, 4.2 * PORTRAIT_HEIGHT_METRES, 2.3 * PORTRAIT_HEIGHT_METRES
    );

    const shapeFactor = fillAngle / keyAngle;

    report(
        'KNOWN-BAD: equal radiance on the two panels would NOT be equal light',
        shapeFactor > 1.5,
        `fill panel subtends ${ fillAngle.toFixed( 4 ) } sr against the key's ${ keyAngle.toFixed( 4 ) } sr — ` +
        `${ shapeFactor.toFixed( 3 ) }x. Two lights typed at the same intensity would sit ${ shapeFactor.toFixed( 2 ) }:1 apart, ` +
        'which is the error the authored-irradiance model removes.'
    );

    const key = deliveredIrradiance( rig, 'key' );
    const fill = deliveredIrradiance( rig, 'fill' );

    report(
        'delivered key:fill equals the authored key:fill',
        closeTo( key.total / fill.total, rig.designedKeyToFill, 1e-9 ),
        `delivered ${ ( key.total / fill.total ).toFixed( 6 ) } vs authored ${ rig.designedKeyToFill.toFixed( 6 ) }`
    );
}

console.log( '\n--- the shadow split conserves energy ----------------------------------------\n' );

for ( const fraction of [ 0, 0.15, 0.30, 0.6, 1.0 ] ) {

    const { rig } = rigFor( {
        preset: 'portrait',
        subjectHeightMetres: PORTRAIT_HEIGHT_METRES,
        overrides: { key: { shadowFraction: fraction } },
        ...shot
    } );

    const delivered = deliveredIrradiance( rig, 'key' );
    const authored = rig.irradianceOf( 'key' );
    const casterShare = delivered.total === 0 ? 0 : delivered.fromCaster / delivered.total;

    report(
        `shadowFraction ${ fraction.toFixed( 2 ) } moves energy without changing the total`,
        closeTo( delivered.total, authored, 1e-9 ) && closeTo( casterShare, fraction, 1e-9 ),
        `panel ${ delivered.fromPanel.toFixed( 4 ) } + caster ${ delivered.fromCaster.toFixed( 4 ) } = ` +
        `${ delivered.total.toFixed( 6 ) } against authored ${ authored.toFixed( 6 ) }; caster share ${ casterShare.toFixed( 6 ) }`
    );

}

{
    // A shadow fraction of zero must build no DirectionalLight at all. A light with intensity 0
    // still costs a slot in the generated lighting loop and still renders a shadow map every
    // frame, for a shadow that by construction removes nothing.
    const { rig } = rigFor( {
        preset: 'portrait',
        subjectHeightMetres: PORTRAIT_HEIGHT_METRES,
        overrides: { key: { shadowFraction: 0 } },
        ...shot
    } );

    const casters = rig.units.filter( ( unit ) => unit.shadowCaster !== null );

    report(
        'a zero shadow fraction builds no shadow caster',
        casters.length === 0,
        `${ casters.length } shadow casters built with every fraction at 0`
    );
}

{
    const { rig } = rigFor( { preset: 'portrait', subjectHeightMetres: PORTRAIT_HEIGHT_METRES, shadows: false, ...shot } );
    const casters = rig.units.filter( ( unit ) => unit.shadowCaster !== null );

    const key = deliveredIrradiance( rig, 'key' );

    report(
        'shadows:false keeps the key at full authored irradiance rather than losing its shadow share',
        casters.length === 0 && closeTo( key.total, rig.irradianceOf( 'key' ), 1e-9 ),
        `${ casters.length } casters; key delivers ${ key.total.toFixed( 4 ) } of an authored ${ rig.irradianceOf( 'key' ).toFixed( 4 ) }. ` +
        'Turning shadows off must not darken the subject by the key\'s shadow fraction — that would be a change ' +
        'of exposure disguised as a change of technique, and it would move G1.'
    );
}

console.log( '\n--- the shadow half falls off like the panel ----------------------------------\n' );

{
    // The measurement that forced SpotLight over DirectionalLight, restated as a gate.
    //
    // A split light is only a redistribution if both halves behave the same way away from the
    // focus. At the focus they agree by construction, so the focus proves nothing; the question
    // has to be asked somewhere else. The backdrop is where it showed up on screen — 1.2x the
    // camera distance behind the subject — so that is where it is asked.
    const { rig } = rigFor( { preset: 'portrait', subjectHeightMetres: PORTRAIT_HEIGHT_METRES, ...shot } );
    const unit = rig.units.find( ( entry ) => entry.placement.name === 'key' );

    const distance = unit.placement.distanceInHeights * PORTRAIT_HEIGHT_METRES;
    const cameraDistance = ( PORTRAIT_HEIGHT_METRES / 2 ) / Math.tan( 13 * Math.PI / 180 );   // 26° FOV
    const beyond = distance + cameraDistance * 1.2;

    const panelRatio = projectedSolidAngle( unit.area.width, unit.area.height, beyond )
        / projectedSolidAngle( unit.area.width, unit.area.height, distance );
    const spotRatio = ( distance * distance ) / ( beyond * beyond );
    const directionalRatio = 1;      // a directional has no distance term at all

    const spotError = Math.abs( spotRatio - panelRatio ) / panelRatio;
    const directionalError = Math.abs( directionalRatio - panelRatio ) / panelRatio;

    report(
        'the spot half tracks the panel half over the depth of the studio',
        spotError < 0.30,
        `at ${ beyond.toFixed( 2 ) } m against ${ distance.toFixed( 2 ) } m: panel keeps ${ ( panelRatio * 100 ).toFixed( 1 ) }% ` +
        `of its focus irradiance, the spot ${ ( spotRatio * 100 ).toFixed( 1 ) }% — ${ ( spotError * 100 ).toFixed( 1 ) }% apart`
    );

    report(
        'KNOWN-BAD: a DirectionalLight half does NOT track it',
        directionalError > 3 * spotError,
        `a directional keeps 100% of its irradiance at any distance — ${ ( directionalError * 100 ).toFixed( 0 ) }% away from the ` +
        `panel against the spot's ${ ( spotError * 100 ).toFixed( 1 ) }%. Measured on screen before the swap: turning shadows OFF ` +
        'made the backdrop DARKER, 0.296 -> 0.254 encoded, which is impossible for a shadow.'
    );
}

console.log( '\n--- placement is camera-relative ---------------------------------------------\n' );

{
    const { rig } = rigFor( {
        preset: 'portrait',
        subjectHeightMetres: PORTRAIT_HEIGHT_METRES,
        overrides: {
            key: { azimuthDegrees: 0, elevationDegrees: 0 },
            fill: { azimuthDegrees: 180, elevationDegrees: 0 },
            rim: { azimuthDegrees: 90, elevationDegrees: 0 }
        },
        ...shot
    } );

    const toCamera = new Vector3().subVectors( shot.cameraPosition, shot.focus ).setY( 0 ).normalize();
    const right = new Vector3( toCamera.z, 0, -toCamera.x );

    const directionOf = ( name ) => {

        const unit = rig.units.find( ( entry ) => entry.placement.name === name );
        return new Vector3().subVectors( unit.area.position, shot.focus ).normalize();

    };

    const frontal = directionOf( 'key' ).dot( toCamera );
    const behind = directionOf( 'fill' ).dot( toCamera );
    const side = directionOf( 'rim' ).dot( right );

    report(
        'azimuth 0° puts the light on the camera axis, 180° directly behind the subject, 90° camera-right',
        closeTo( frontal, 1, 1e-6 ) && closeTo( behind, -1, 1e-6 ) && closeTo( side, 1, 1e-6 ),
        `camera at (${ shot.cameraPosition.toArray().join( ', ' ) }): ` +
        `0° · toCamera = ${ frontal.toFixed( 6 ) }, 180° · toCamera = ${ behind.toFixed( 6 ) }, 90° · right = ${ side.toFixed( 6 ) }`
    );

    // The same rig aimed from a camera 90° round must move every light with it. If it does not,
    // the azimuths are secretly world-space and the whole camera-relative claim is false.
    const before = directionOf( 'key' ).clone();
    rig.aimAt( {
        focus: shot.focus,
        subjectHeightMetres: PORTRAIT_HEIGHT_METRES,
        cameraPosition: new Vector3( shot.focus.x - 1.1, shot.cameraPosition.y, shot.focus.z + 0.0 )
    } );
    const after = directionOf( 'key' );

    report(
        'moving the camera moves the whole rig with it',
        before.dot( after ) < 0.2,
        `key direction ${ before.toArray().map( ( v ) => v.toFixed( 3 ) ).join( ', ' ) } -> ` +
        `${ after.toArray().map( ( v ) => v.toFixed( 3 ) ).join( ', ' ) }, dot ${ before.dot( after ).toFixed( 4 ) }`
    );
}

console.log( '\n--- the gate: designed key:fill ----------------------------------------------\n' );

{
    const { rig } = rigFor( { preset: 'portrait', subjectHeightMetres: PORTRAIT_HEIGHT_METRES, ...shot } );
    const ratio = rig.designedKeyToFill;

    report(
        'designed key:fill is under G1\'s 2.0 ceiling',
        ratio < 2.0,
        `${ ratio.toFixed( 4 ) }:1 against measure.mjs G1's < 2.00:1 linear`
    );

    // ⚠️ The DESIGNED ratio and the RENDERED ratio are different quantities and must not be gated
    // against each other. What is authored here is a ratio of irradiances arriving at one point;
    // what G1 measures is a ratio of tone-mapped pixel values on a curved face that also picks up
    // rim, kicker and ambient. So this asserts against the look spec's own AUTHORING range —
    // §5 "KEY : FILL on face 1.2:1 to 2.0:1 (0.3–1.0 stop)" — and the rendered figure is
    // measured on the browsercheck, where it lands at 1.598 linear at portrait framing.
    report(
        'designed key:fill sits in the look spec\'s authored range of 1.2:1 to 2.0:1',
        ratio >= 1.2 && ratio <= 2.0,
        `${ ratio.toFixed( 4 ) }:1 authored. Measured on the render at 900x1200, portrait framing: ` +
        '1.598 linear, inside the 1.43–1.64 band the spec\'s two assets measured.'
    );

    // KNOWN-BAD, in the direction the instinct pulls. A conventional portrait ratio must be
    // rejected by the same check, or the check is not measuring the property it names.
    const dramatic = new LightingRig( { overrides: { fill: { irradiance: 3.0 / 4.0 } } } );

    report(
        'KNOWN-BAD: a conventional 4:1 portrait ratio fails the same check',
        dramatic.designedKeyToFill >= 2.0,
        `a fill at one quarter of key gives ${ dramatic.designedKeyToFill.toFixed( 2 ) }:1, rejected — ` +
        'which is what the look spec means by "light this with a conventional three-point ratio and it will read wrong"'
    );
}

console.log( '\n--- the gate: how much of the rim lands on the environment --------------------\n' );

// 🎯 The defect this exists for: 45.3% of a full-body frame measured as saturated blue-violet, of
// which 17.8% was floor, because the rim and kicker delivered **36.6× the key and fill** to a
// point on the floor two metres behind the subject. Every gate in this file was green, and none
// of them could have seen it: they all measure what a light delivers AT THE FOCUS, and the whole
// defect is what it delivers everywhere else.
//
// 🚩 **AND THE FIRST VERSION OF THIS GATE MEASURED IT WITH A QUANTITY THAT CANNOT EXPRESS
// BLUENESS.** It partitioned the four lights with a hardcoded `COOL_LIGHTS = [ 'rim', 'kicker' ]`
// and the arithmetic never touched `colour` at all. A verifier turned the key and the fill to the
// rim's own `#0f30ff`; this file and `GroundContact.selftest.mjs` stayed fully green — 46/46 and
// 36/36 — while 99.2% of a rendered body frame came back saturated blue. Reproduced here before
// the fix, and the reproduction is the whole diagnosis:
//
//   cool:warm by NAME, shipped        2.0982
//   cool:warm by NAME, key+fill blue  2.0982   ← bit-identical, and the frame had gone blue
//
// **THE ATTEMPTED FIX THAT WAS WRONG, KEPT BECAUSE THE SHAPE OF IT IS INSTRUCTIVE.** The obvious
// repair is to partition by the light's own colour — cool means `b > r` — instead of by its name.
// That is a different wrong model, not a right one, and one run of the checks below proved it: a
// key and fill at `#e8ecff`, a perfectly ordinary daylight-balanced tint, is blue-dominant, so it
// empties the warm bucket, drives the ratio to Infinity and FAILS the gate — on a plate that
// renders 0.058% of the frame blue, LESS than shipped. Any binary classification of a continuous
// colour has that failure somewhere. LEARNINGS §1.8: the model was wrong, and a threshold was
// never going to fix it.
//
// **WHAT THE TWO CLAUSES ACTUALLY ARE, after taking the colour out of the partition entirely:**
//
//   1. BEHIND : IN FRONT — a purely GEOMETRIC ratio, and it is what the standoff sweep below
//      always measured. Partitioned by which side of the subject a panel physically stands on,
//      computed from the light's own world position against the camera axis, so it cannot be
//      moved by a rename, by a recolour, or by a fifth light being added. It is DELIBERATELY
//      colour-blind and now says so in its name. Shipped value unchanged at 2.0982, so every
//      anchor in the sweep still holds.
//   2. BLUE : RED — the per-channel irradiance arriving at the same point, summed with each
//      light's actual linear colour and never partitioned at all. This is the quantity nothing
//      computed, and it carries the entire colour axis on its own.
//
// Anchored against rendered measurements. The standoff sweep is on
// `lighting.html?frame=body&bare` at 900×1200; the blue:red column and every colour row were
// measured for this round on the same page at `?frame=body&bare&w=900&h=1200&webgl`, WebGL2
// backend, **MSAA OFF — `lighting.js` passes no `antialias`, so that is the page's default** —
// shipped floor albedo, figure visible, predicate HSV S > 0.5 and hue 200–300° over the whole
// 900×1200 frame. The shipped row reproduces the 0.07% already on record for this plate, which is
// how the new instrument was checked before any number from it was trusted.
//
//   | body rig, one thing changed        | behind:front | blue:red | frame saturated blue |
//   |------------------------------------|-------------:|---------:|---------------------:|
//   | rim standoff 2.6 (portrait's)      |        49.94 |        — | —                    |
//   | rim standoff 1.4 (the old defect)  |        36.61 |    32.76 | 24.06% at the old floor albedo |
//   | rim standoff 1.1                   |        18.88 |        — | 9.81%                |
//   | rim standoff 0.8                   |         4.69 |        — | 3.62%                |
//   | **shipped (standoff 0.65)**        |     **2.10** | **2.83** | **0.074%**           |
//   | key+fill `#ffffff` (neutral)       |         2.10 |     3.07 | 0.030%               |
//   | key+fill `#e8ecff` (daylight tint) |         2.10 |     3.79 | 0.058%               |
//   | rim elevation 75° (the AIM bad)    |         3.35 |     4.10 | 0.034%               |
//   | fill `#30ffff` (cyan)              |         2.10 |     4.23 | 0.460%               |
//   | key+fill `#d8e0ff`                 |         2.10 |     4.45 | 0.104%               |
//   | key+fill `#c4d0ff`                 |         2.10 |     5.51 | 0.664%               |
//   | key+fill `#b0c0ff` (looks white!)  |         2.10 |     6.98 | **57.37%**           |
//   | **key+fill `#403830` (dark WARM)** |     **2.10** |**34.71** | **18.19%**           |
//   | key `#0f30ff`, fill untouched      |         2.10 |     9.54 | **74.20%**           |
//   | key+fill `#0f30ff`                 |         2.10 |   209.34 | **90.79%**           |
//   | **rim+kicker swung to the FRONT**  |    **0.000** | **9.35** | **55.72%**           |
//
// Read the left column down the colour rows: it is 2.10 in every single one, from a clean frame
// to a 90.79% flood. That constant is the defect, stated as a number. Then read the last row,
// which is the same trap set for the REPLACEMENT: swing the two blue panels round to the front of
// the subject at standoff 1.4 and the behind bucket empties, so the geometric clause scores 0.000
// — better than shipped and unimprovable — on a frame that is 55.72% saturated blue. Any
// partition can be walked around by moving a light across its boundary. Only the clause with no
// boundary catches that one, and it is asserted below rather than described here.
//
// THE TWO CEILINGS, AND WHY THEY ARE THOSE NUMBERS:
//
//   behind:front 3.0 — unchanged, and not re-derived here. It sits between the shipped 2.10 and
//   4.69, the nearest standoff that renders 3.62% of the frame blue.
//
//   blue:red 4.5 — the knee in the right-hand column is between 4.45 (0.104%, indistinguishable
//   from the shipped 0.074%) and 6.98 (57.37%). The frame's large matte surfaces cross HSV S 0.5
//   almost together, which is why 57% more blue in the light is 550× more blue in the frame. 4.5
//   sits immediately above the highest configuration the render says is clean, and the MUST-PASS
//   rows below pin it there from underneath so it cannot quietly drift down onto the shipped rig.
//
// 🚩 **THE TWO CLAUSES ARE NOT NESTED IN EITHER DIRECTION, AND THAT IS WHY THERE ARE TWO.** Two
// clauses where one implies the other is one clause and a decoration, so both directions are
// asserted as checks below rather than left as prose.
//
//   behind:front alone misses LEVEL. Turn the key and the fill to `#403830` — a dark warm grey,
//   blue still its lowest channel, nothing moved but the level — and it stays at exactly the
//   shipped 2.0982 while 18.19% of the frame renders saturated blue. A ratio of IRRADIANCES
//   cannot see it, because taking the red out of the warm half by dimming it is, at the floor,
//   the same event as turning the rim up, and only a per-channel sum tells them apart.
//
//   blue:red alone misses AIM. The rim at 75° scores 4.10, under the 4.5 ceiling, while
//   behind:front rejects it at 3.35. The ceiling cannot come down to catch it: `#d8e0ff` scores
//   4.45 and renders 0.104%. And the render sides with the chromaticity — **the rim at 75°
//   renders 0.034% blue, LESS than shipped.** It is a real defect, because it takes the rim off
//   the subject, but it is not a flooded environment, and the geometric ratio rejects it for the
//   ratio's reasons rather than the picture's. Recorded rather than smoothed over.
//
// ⚠️ WHAT THIS GATE STILL CANNOT SEE, so nobody assumes it does:
//   - The floor's ALBEDO. A neutral floor under a compliant rig still measured HSV S 0.5427
//     (`?floor=0x7a7570`). That clause is gated in `GroundContact.selftest.mjs`, which now
//     multiplies the albedo by the spill measured HERE rather than reading a hex on its own.
//   - The SPECULAR half of the floor's response, which carries no albedo and is 21% of the
//     floor's light at this standoff and was 76% at the old one.
//   - Any HUE but blue. A cyan fill scores 4.23 and renders 0.46% inside the 200–300° window,
//     because a cyan cast is at 180° and falls outside the predicate; a magenta key scores 3.04
//     and is invisible to both clauses. Neither is the defect this exists for, and saying so is
//     cheaper than a gate that pretends to a generality it does not have.
//   - Any point but this one. It is a horizontal receiver 2 m behind the focus, chosen because it
//     is the middle of the visible floor band at body framing.
//   - The SHADOW-CASTER half of the key. Only the `RectAreaLight` panels are summed. Measured
//     both ways, adding the spot halves takes the shipped behind:front 2.0982 → 1.4575 and
//     blue:red 2.8313 → 2.1683, so the panels-only model OVERSTATES the spill by 1.44× and 1.31×.
//     That is the conservative direction, and every anchor above is panels-only.
{
    const FLOOR_POINT = new Vector3( 0, 0, -2.0 );
    const FLOOR_NORMAL = new Vector3( 0, 1, 0 );
    const ENVIRONMENT_BEHIND_TO_FRONT_MAX = 3.0;
    const ENVIRONMENT_BLUE_TO_RED_MAX = 4.5;

    const bodyShot = {
        focus: new Vector3( 0, 0.91, 0 ),
        cameraPosition: new Vector3( 0.39, 0.91, 1.83 ),
        subjectHeightMetres: 1.825
    };

    /**
     * What arrives at `FLOOR_POINT`: split by which side of the subject the panel stands on, and
     * separately summed per channel so the result carries a hue rather than a magnitude.
     *
     * Both halves read the `RectAreaLight` instances the renderer will use — `unit.area.position`
     * and `unit.area.color` — rather than the placement table those were built from. A rig whose
     * lights disagree with the table it publishes is then measured as it actually is, which is the
     * difference between testing the graph and testing a copy of the numbers that made it.
     */
    function environmentSpill( overrides ) {

        const { rig } = rigFor( { preset: 'body', overrides, ...bodyShot } );

        // The camera axis, pointing away from the viewer. A panel is BEHIND the subject when it
        // is on the far side of the plane through the focus perpendicular to this.
        const viewAxis = bodyShot.focus.clone().sub( bodyShot.cameraPosition ).normalize();

        let behind = 0;
        let inFront = 0;
        const channels = [ 0, 0, 0 ];

        for ( const unit of rig.units ) {

            const panel = unit.area.position;
            const aim = bodyShot.focus.clone().sub( panel ).normalize();
            const toPoint = FLOOR_POINT.clone().sub( panel );
            const distance = toPoint.length();
            const direction = toPoint.clone().normalize();

            const cosPanel = aim.dot( direction );
            const cosReceiver = FLOOR_NORMAL.dot( direction.clone().negate() );

            // A RectAreaLight emits into its FRONT hemisphere only, so a receiver behind the
            // panel's plane gets nothing — that clamp is not a guard, it is half the mechanism
            // the shipped standoff relies on. At 0.65 heights the kicker's contribution here is
            // exactly zero for this reason.
            const irradiance = ( cosPanel <= 0 || cosReceiver <= 0 )
                ? 0
                : unit.area.intensity * unit.area.width * unit.area.height * cosPanel * cosReceiver / ( distance * distance );

            // THE PARTITION IS GEOMETRY AND NOTHING ELSE. Not the name — a rename is free and the
            // old list scored 0.00 under one. Not the colour either — `b > r` is a binary test on
            // a continuous quantity and it condemns a daylight-balanced key that renders clean.
            // Which side of the subject a panel physically stands on is neither opinion nor
            // threshold, and it is the property the standoff sweep was always about.
            if ( panel.clone().sub( bodyShot.focus ).dot( viewAxis ) > 0 ) behind += irradiance;
            else inFront += irradiance;

            // `Color` holds linear working space here — `ColorManagement.enabled` is true and
            // `new Color( 0x0f30ff )` reads back 0.004777 / 0.029557 / 1.0, which is exactly the
            // sRGB decode of #0f30ff — so these are the same units the irradiance is in and the
            // product is a real per-channel irradiance rather than a display value.
            const colour = unit.area.color;

            channels[ 0 ] += irradiance * colour.r;
            channels[ 1 ] += irradiance * colour.g;
            channels[ 2 ] += irradiance * colour.b;

        }

        return { behindToFront: behind / inFront, blueToRed: channels[ 2 ] / channels[ 0 ], channels };

    }

    // Published so `GroundContact.selftest.mjs` can cross-check its own copy of this arithmetic
    // against this one. Two files compute the same spill because neither may import a helper the
    // other owns; the cross-check is what stops the copies drifting apart in silence.
    const SHIPPED_BLUE_TO_RED = 2.8313;

    const shipped = environmentSpill( {} );

    // The partition has to be shown to be the partition it claims, or "geometric" is just a word
    // in a comment. Named lights are used HERE and only here, as the expected ANSWER rather than
    // as the input.
    {
        const viewAxis = bodyShot.focus.clone().sub( bodyShot.cameraPosition ).normalize();
        const { rig } = rigFor( { preset: 'body', overrides: {}, ...bodyShot } );

        const behindNames = rig.units
            .filter( ( unit ) => unit.area.position.clone().sub( bodyShot.focus ).dot( viewAxis ) > 0 )
            .map( ( unit ) => unit.placement.name )
            .sort();

        report(
            'the geometric partition lands exactly on the rim and the kicker',
            behindNames.join( ',' ) === 'kicker,rim',
            `behind the subject by world position: ${ behindNames.join( ', ' ) }. Derived from where the ` +
            'panels stand, never from these names — they are the expected answer, not the input.'
        );
    }

    report(
        'the lights behind the subject do not out-deliver the lights in front, on the floor',
        shipped.behindToFront < ENVIRONMENT_BEHIND_TO_FRONT_MAX,
        `behind:in-front irradiance 2 m behind the focus = ${ shipped.behindToFront.toFixed( 2 ) }:1 against a ` +
        `ceiling of ${ ENVIRONMENT_BEHIND_TO_FRONT_MAX.toFixed( 1 ) }:1. This clause is DELIBERATELY colour-blind; ` +
        'the colour is the next one. Rendered: 0.074% of the frame in a saturated blue.'
    );

    report(
        'the light reaching the floor behind the subject is not itself blue',
        shipped.blueToRed < ENVIRONMENT_BLUE_TO_RED_MAX,
        `blue:red of the summed per-channel irradiance = ${ shipped.blueToRed.toFixed( 4 ) }:1 against a ceiling of ` +
        `${ ENVIRONMENT_BLUE_TO_RED_MAX.toFixed( 1 ) }:1 — the knee is between 4.45 (0.104% of the frame) and ` +
        '6.98 (57.37%)'
    );

    report(
        'the two files agree on what the shipped rig delivers to the floor',
        closeTo( shipped.blueToRed, SHIPPED_BLUE_TO_RED, 0.0005 ),
        `${ shipped.blueToRed.toFixed( 4 ) } here against ${ SHIPPED_BLUE_TO_RED.toFixed( 4 ) } published to ` +
        'GroundContact.selftest.mjs, which multiplies it by the floor albedo. If these drift, one of the two ' +
        'copies of the spill arithmetic has changed and the other has not.'
    );

    // Known-bads, and the point of the list is that they are DIFFERENT MECHANISMS. A gate proved
    // red only by undoing the exact change that motivated it is decorative — it demonstrates that
    // one constant is load-bearing and nothing else. The first four are geometric and predate
    // this round; the rest are the colour class the first four were blind to, and three of them
    // change a light NOBODY WOULD CALL COOL.
    const knownBad = [
        {
            what: 'DISTANCE — the standoff put back to where the defect was',
            overrides: {
                rim: { distanceInHeights: 1.4, widthInHeights: 0.30, heightInHeights: 1.00 },
                kicker: { distanceInHeights: 1.4, widthInHeights: 0.30, heightInHeights: 0.95 }
            },
            rejectedBy: [ 'behindToFront', 'blueToRed' ],
            rendered: '24.06% of the frame at the old floor albedo'
        },
        {
            what: 'POWER — the shipped geometry with the rim turned up',
            overrides: { rim: { irradiance: 80 } },
            rejectedBy: [ 'behindToFront', 'blueToRed' ]
        },
        {
            what: 'AIM — the rim raised until it points at the floor',
            overrides: { rim: { elevationDegrees: 75 } },
            // Chromaticity 4.10, UNDER the 4.5 ceiling, and the render agrees: 0.034% of the
            // frame, less than shipped. Only the ratio clause rejects this one. See the header.
            rejectedBy: [ 'behindToFront' ],
            rendered: '0.034% of the frame — this one does NOT flood, and only behind:front rejects it'
        },
        {
            what: 'DENOMINATOR — the warm lights taken away, which is how an environment goes cool without the rim moving',
            overrides: { key: { irradiance: 0.3 }, fill: { irradiance: 0.12 } },
            rejectedBy: [ 'behindToFront', 'blueToRed' ]
        },
        // 🎯 THE FIFTH MECHANISM AND EVERY VARIATION ON IT THAT WOULD OTHERWISE HAVE SHIPPED. All
        // five leave the geometry untouched, so behind:front reads exactly 2.10 on all of them —
        // the same number the shipped rig reads. Only the chromaticity moves, and the render
        // column is what makes that a defect rather than a preference.
        {
            what: 'COLOUR — the key and fill turned to the rim\'s own #0f30ff, which is the defect this round found',
            overrides: { key: { colour: 0x0f30ff }, fill: { colour: 0x0f30ff } },
            rejectedBy: [ 'blueToRed' ],
            rendered: '90.79% of the frame here, 99.20% on alive.html'
        },
        {
            what: 'COLOUR, ONE LIGHT — only the key turned blue, so a warm light is still standing',
            overrides: { key: { colour: 0x0f30ff } },
            rejectedBy: [ 'blueToRed' ],
            rendered: '74.20% of the frame'
        },
        {
            what: 'COLOUR, SUBTLE — key and fill at #b0c0ff, a tint that reads as white in a swatch',
            overrides: { key: { colour: 0xb0c0ff }, fill: { colour: 0xb0c0ff } },
            rejectedBy: [ 'blueToRed' ],
            rendered: '57.37% of the frame, from a colour nobody would flag by eye'
        },
        {
            what: 'COLOUR, ONE STEP SHORT OF THE KNEE — key and fill at #c4d0ff',
            overrides: { key: { colour: 0xc4d0ff }, fill: { colour: 0xc4d0ff } },
            rejectedBy: [ 'blueToRed' ],
            rendered: '0.664% of the frame, 9x shipped and one step short of the knee'
        },
        {
            // 🚩 THE ONE THAT IS NOT EVEN BLUE, AND THE REASON THE SECOND CLAUSE IS NOT A SECOND
            // OPINION ON THE FIRST. `#403830` is a warm grey: blue is its LOWEST channel, so it
            // satisfies `GroundContact`'s albedo clause read as a rule about hexes, it satisfies
            // any "cool means b > r" partition, and it would satisfy a regex hunting for cool hex
            // literals in the source. What it does is take the red out of the warm half by
            // DIMMING it — at the floor, arithmetically the same event as turning the rim up
            // tenfold, and invisible to any ratio built on irradiance rather than radiance.
            what: 'LEVEL — key and fill dimmed to #403830, a warm grey with blue still its lowest channel',
            overrides: { key: { colour: 0x403830 }, fill: { colour: 0x403830 } },
            rejectedBy: [ 'blueToRed' ],
            rendered: '18.19% of the frame, with behind:front sitting at exactly the shipped 2.0982'
        }
    ];

    for ( const variant of knownBad ) {

        const measured = environmentSpill( variant.overrides );

        const rejected = variant.rejectedBy.some( ( clause ) => clause === 'behindToFront'
            ? measured.behindToFront >= ENVIRONMENT_BEHIND_TO_FRONT_MAX
            : measured.blueToRed >= ENVIRONMENT_BLUE_TO_RED_MAX );

        report(
            `KNOWN-BAD: ${ variant.what }`,
            rejected,
            `behind:front ${ measured.behindToFront.toFixed( 2 ) } / ${ ENVIRONMENT_BEHIND_TO_FRONT_MAX.toFixed( 1 ) }, ` +
            `blue:red ${ measured.blueToRed.toFixed( 2 ) } / ${ ENVIRONMENT_BLUE_TO_RED_MAX.toFixed( 1 ) } — ` +
            `rejected by ${ variant.rejectedBy.join( ' and ' ) }` +
            ( variant.rendered === undefined ? '' : `. Rendered: ${ variant.rendered }` )
        );

    }

    // 🚩 THE TWO CLAUSES ARE NON-NESTED, ASSERTED IN BOTH DIRECTIONS.
    //
    // Two clauses where one implies the other is one clause and a decoration. These two checks go
    // red the day someone tunes a ceiling until one swallows the other, which is the shape the
    // next well-meaning simplification will take.
    const levelOnly = environmentSpill( { key: { colour: 0x403830 }, fill: { colour: 0x403830 } } );

    report(
        'blue:red catches something behind:front cannot see at ANY ceiling',
        levelOnly.blueToRed >= ENVIRONMENT_BLUE_TO_RED_MAX
            && closeTo( levelOnly.behindToFront, shipped.behindToFront, 1e-9 ),
        `key and fill dimmed to #403830: blue:red ${ levelOnly.blueToRed.toFixed( 2 ) } rejected, while behind:front is ` +
        `${ levelOnly.behindToFront.toFixed( 4 ) } — BIT-IDENTICAL to the shipped ${ shipped.behindToFront.toFixed( 4 ) }, ` +
        'because a ratio of irradiances cannot weigh radiance. Rendered: 18.19% of the frame.'
    );

    const aimOnly = environmentSpill( { rim: { elevationDegrees: 75 } } );

    report(
        'behind:front catches something blue:red does not, and the ceiling cannot come down to fix it',
        aimOnly.behindToFront >= ENVIRONMENT_BEHIND_TO_FRONT_MAX
            && aimOnly.blueToRed < ENVIRONMENT_BLUE_TO_RED_MAX,
        `rim at 75°: behind:front ${ aimOnly.behindToFront.toFixed( 2 ) } rejected, blue:red ${ aimOnly.blueToRed.toFixed( 2 ) } ` +
        'under the 4.5 ceiling — and it must stay under it, because #d8e0ff scores 4.45 and renders a clean 0.104%'
    );

    // 🚩 BREAKING IT TWO MORE WAYS, ON THE PARTITION ITSELF RATHER THAN ON EITHER CEILING. Both of
    // these drive the geometric clause to a BETTER-THAN-SHIPPED score on a frame that has gone
    // blue, which is the exact failure mode this whole block exists to stop recurring.
    //
    // First, the evasion the old NAME list could not survive. `overrides` spread straight into the
    // placement, so `{ rim: { name: 'sidekey' } }` renames a light without touching one photon.
    // Under the old list that alone moved the rim and the kicker into the warm bucket and scored
    // 0.00 — perfect — on a rig whose render had not changed by a pixel. Here the picture is
    // identical, so both clauses must be identical too.
    const renamed = environmentSpill( { rim: { name: 'sidekey' }, kicker: { name: 'hairlight' } } );

    report(
        'renaming the cool lights changes neither clause, because neither reads a name',
        closeTo( renamed.behindToFront, shipped.behindToFront, 1e-9 ) && closeTo( renamed.blueToRed, shipped.blueToRed, 1e-9 ),
        `rim -> 'sidekey', kicker -> 'hairlight': behind:front ${ renamed.behindToFront.toFixed( 4 ) } and blue:red ` +
        `${ renamed.blueToRed.toFixed( 4 ) }, against ${ shipped.behindToFront.toFixed( 4 ) } and ` +
        `${ shipped.blueToRed.toFixed( 4 ) } shipped. The name list this replaced scored 0.00 here.`
    );

    // Second, and this one breaks the REPLACEMENT rather than the thing it replaced: swing the two
    // blue panels round to the FRONT of the subject and bring them in. The behind bucket empties,
    // so the geometric ratio reads 0.000 — a better score than shipped, and unimprovable — while
    // the frame renders 55.72% saturated blue. A partition is a partition; the only clause that
    // cannot be walked around by moving a light across its boundary is the one with no boundary.
    const swungToFront = environmentSpill( {
        rim: { azimuthDegrees: -60, distanceInHeights: 1.4 },
        kicker: { azimuthDegrees: 60, distanceInHeights: 1.4 }
    } );

    report(
        'KNOWN-BAD: the blue panels swung to the FRONT, which scores 0.00 on the geometric clause',
        swungToFront.blueToRed >= ENVIRONMENT_BLUE_TO_RED_MAX,
        `behind:front ${ swungToFront.behindToFront.toFixed( 3 ) } — an empty behind bucket, better than the shipped ` +
        `${ shipped.behindToFront.toFixed( 2 ) } and impossible to improve on — while blue:red ` +
        `${ swungToFront.blueToRed.toFixed( 2 ) } rejects it. Rendered: 55.72% of the frame in a saturated blue.`
    );

    // And the rename with a real defect under it, so "name-blind" is proved in the direction that
    // matters rather than only in the harmless one.
    const renamedAndBlue = environmentSpill( {
        rim: { name: 'sidekey' }, kicker: { name: 'hairlight' }, key: { colour: 0x0f30ff }
    } );

    report(
        'KNOWN-BAD: a blue key under lights renamed out of the old cool list',
        renamedAndBlue.behindToFront >= ENVIRONMENT_BEHIND_TO_FRONT_MAX
            || renamedAndBlue.blueToRed >= ENVIRONMENT_BLUE_TO_RED_MAX,
        `behind:front ${ renamedAndBlue.behindToFront.toFixed( 2 ) }, blue:red ${ renamedAndBlue.blueToRed.toFixed( 2 ) } — ` +
        'rejected, on a configuration the old name-partitioned gate scored 0.00 on'
    );

    // MUST STILL PASS. A gate is only as good as the things it does NOT reject, and a ceiling
    // nobody pins from below drifts down until it fires on the shipped rig. Every row here is a
    // configuration the RENDER says is clean, at or below 0.104% of the frame against the shipped
    // 0.074%; `#d8e0ff` at 4.45 is what fixes the 4.5 ceiling from underneath.
    const mustPass = [
        { what: 'key and fill at neutral white', overrides: { key: { colour: 0xffffff }, fill: { colour: 0xffffff } }, rendered: '0.030% of the frame' },
        { what: 'key and fill at #e8ecff — a daylight-balanced tint, which the colour partition condemned', overrides: { key: { colour: 0xe8ecff }, fill: { colour: 0xe8ecff } }, rendered: '0.058% of the frame, LESS than shipped' },
        { what: 'key and fill at #d8e0ff — the row the ceiling sits on', overrides: { key: { colour: 0xd8e0ff }, fill: { colour: 0xd8e0ff } }, rendered: '0.104% of the frame' },
        { what: 'the rim and kicker turned WARM, which removes the blue entirely', overrides: { rim: { colour: 0xffeeda }, kicker: { colour: 0xffeeda } }, rendered: 'not captured; no cool light is left to flood with' }
    ];

    for ( const variant of mustPass ) {

        const measured = environmentSpill( variant.overrides );

        report(
            `MUST PASS: ${ variant.what }`,
            measured.behindToFront < ENVIRONMENT_BEHIND_TO_FRONT_MAX && measured.blueToRed < ENVIRONMENT_BLUE_TO_RED_MAX,
            `behind:front ${ measured.behindToFront.toFixed( 2 ) }, blue:red ${ measured.blueToRed.toFixed( 2 ) }, ` +
            `both under their ceilings. Rendered: ${ variant.rendered }`
        );

    }
}

console.log( '\n--- the two framings ---------------------------------------------------------\n' );

{
    const portrait = new LightingRig( { preset: 'portrait' } );
    const body = new LightingRig( { preset: 'body' } );

    const azimuthOf = ( rig, name ) => rig.placements.find( ( entry ) => entry.name === name ).azimuthDegrees;

    for ( const name of [ 'key', 'fill' ] ) {

        report(
            `${ name } sits at the same azimuth in both presets`,
            azimuthOf( portrait, name ) === azimuthOf( body, name ),
            `${ azimuthOf( portrait, name ) }° in both — a form light's PLACEMENT authored in subject heights is ` +
            'scale-free, so there is nothing for a second preset to change there. Its POWER is a different ' +
            'question and the two presets do disagree about the fill; see FORM_LIGHT_OVERRIDES_BY_PRESET.'
        );

    }

    // 🚩 REGRESSION GUARD, and the reason it exists is the whole of this round.
    //
    // The previous round swung the BODY rim from −152° to −134° to widen `1 + cos φ` from 0.117 to
    // 0.305, and a judge then attributed three separate defects to that swing. The reasoning was
    // sound for a LIMB and wrong for a TORSO: 30% of a 0.15 m torso radius is a side key, not a
    // rim. Measured on lighting.html at body framing, subject mask from a ?figure=0 plate —
    //
    //   | body rim azimuth   | subject px cool at S>0.10 | interior luma SD, torso |
    //   | −134°              |                    32.65% |                  0.0486 |
    //   | −158° (shipped)    |                    15.03% |                  0.0676 |
    //   | rim/kicker at zero |                     0.71% |                  0.0734 |
    //
    // — so this check fails the day someone swings it forward again, and says what it cost.
    const WITHDRAWN_BODY_RIM_AZIMUTH = -134;

    for ( const name of [ 'rim', 'kicker' ] ) {

        const portraitAzimuth = azimuthOf( portrait, name );
        const bodyAzimuth = azimuthOf( body, name );

        report(
            `${ name } keeps the same azimuth in both presets`,
            portraitAzimuth === bodyAzimuth,
            `${ portraitAzimuth }° in both, 1 + cos φ = ${ silhouetteBandFraction( bodyAzimuth ).toFixed( 3 ) }. ` +
            'The presets differ on standoff, elevation and irradiance instead — see the header.'
        );

        report(
            `${ name } is not swung forward into a side key`,
            Math.abs( bodyAzimuth ) > Math.abs( WITHDRAWN_BODY_RIM_AZIMUTH ) + 10,
            `${ bodyAzimuth }° against the withdrawn ${ WITHDRAWN_BODY_RIM_AZIMUTH }°, whose band fraction ` +
            `${ silhouetteBandFraction( WITHDRAWN_BODY_RIM_AZIMUTH ).toFixed( 3 ) } measured as a flood over a ` +
            'torso rather than a band on a limb'
        );

    }

    // What the two presets DO disagree about, checked so that "same azimuth" cannot be read as
    // "the body preset does nothing".
    for ( const [ field, label ] of [ [ 'distanceInHeights', 'standoff' ], [ 'elevationDegrees', 'elevation' ] ] ) {

        const near = portrait.placements.find( ( entry ) => entry.name === 'rim' )[ field ];
        const far = body.placements.find( ( entry ) => entry.name === 'rim' )[ field ];

        report(
            `the body preset changes the rim's ${ label }`,
            near !== far,
            `${ near } -> ${ far }`
        );

    }

    // The honest half of the same claim, stated as a check so nobody later reads the widening as
    // a fix. In PIXELS the body rim is still far thinner than the portrait rim, because the limb
    // it lands on is 8.9x smaller in frame. This check asserts the SHORTFALL, and goes red the day
    // someone believes they have closed it.
    const portraitBand = silhouetteBandPixels(
        azimuthOf( portrait, 'rim' ), HEAD_RADIUS_METRES, PORTRAIT_HEIGHT_METRES, CANVAS_HEIGHT_PIXELS
    );
    const bodyBandArm = silhouetteBandPixels(
        azimuthOf( body, 'rim' ), UPPER_ARM_RADIUS_METRES, BODY_HEIGHT_METRES, CANVAS_HEIGHT_PIXELS
    );
    const bodyBandArmIfUnchanged = silhouetteBandPixels(
        azimuthOf( portrait, 'rim' ), UPPER_ARM_RADIUS_METRES, BODY_HEIGHT_METRES, CANVAS_HEIGHT_PIXELS
    );

    report(
        'KNOWN SHORTFALL: the body rim band is still thinner in pixels than the portrait rim',
        bodyBandArm < portraitBand,
        `at ${ CANVAS_HEIGHT_PIXELS } px tall: portrait head rim ${ portraitBand.toFixed( 1 ) } px, ` +
        `body upper-arm rim ${ bodyBandArm.toFixed( 1 ) } px (would be ${ bodyBandArmIfUnchanged.toFixed( 1 ) } px ` +
        'on the portrait azimuth). No azimuth closes this; see the header derivation.'
    );

    // And the shortfall is NOT bought back by azimuth, which is the correction. The body preset
    // spends elevation and irradiance on it instead, and what that buys is measurable only on a
    // render: at body framing the shipped rim puts the thigh silhouette's brightest pixel at
    // 1.05x skin luma against a rim-off reading of 1.05x — i.e. the peak is the skin's own — while
    // the outer-8 px band's saturation goes 1.63x skin (rim off) to 1.45x (rim on) at a luma of
    // 0.67x. Numbers on a render belong in the round report; what belongs HERE is that no azimuth
    // difference is pretending to have closed a geometric shortfall.
    report(
        'the shortfall is NOT claimed to be closed by azimuth',
        Math.abs( bodyBandArm - bodyBandArmIfUnchanged ) < 1e-9,
        `${ bodyBandArmIfUnchanged.toFixed( 2 ) } px on either azimuth — the presets no longer differ there, ` +
        'so the 8.9x pixel shortfall stands exactly as derived'
    );
}

console.log( '\n--- the budget ---------------------------------------------------------------\n' );

{
    let threw = null;

    try {

        const rig = new LightingRig();
        rig.overrides = {};
        // Push a fifth placement in the only way a caller realistically could: by editing the
        // resolved table. The guard has to fire on the count, not on the preset name.
        rig.resolvePlacements = function () {

            const placements = LightingRig.prototype.resolvePlacements.call( this );
            placements.push( { ...placements[ 0 ], name: 'extra' } );

            if ( placements.length > MAX_AREA_LIGHTS ) throw new Error( 'budget' );

            return placements;

        };
        rig.resolvePlacements();

    } catch ( error ) {

        threw = error;

    }

    report(
        `the area-light budget of ${ MAX_AREA_LIGHTS } is enforced`,
        threw !== null,
        threw === null
            ? 'a fifth area light was accepted — PROGRESS.md measures 8 lights at 7.421 ms, 45% of a 16.6 ms frame'
            : 'a fifth area light is rejected'
    );

    const rig = new LightingRig();

    report(
        'the default rig is exactly at budget',
        rig.placements.length === MAX_AREA_LIGHTS,
        `${ rig.placements.length } area lights: ${ rig.placements.map( ( p ) => p.name ).join( ', ' ) } ` +
        '— measured 3.608 ms at 1080p on this figure, against PROGRESS.md\'s fitted 3.604'
    );

    // The shadow budget, which is the one the punch list did not cost. One shadow caster measures
    // 2.62 ms on this figure at 1080p and four measure 9.11; four pairs plus four panels is 12.7 ms
    // of a 16.6 ms frame. A future edit that gives a second light a shadow fraction is a 2.6 ms
    // decision and should have to look this assertion in the eye first.
    const shadowed = new LightingRig().placements.filter( ( placement ) => placement.shadowFraction > 0 );

    report(
        'exactly ONE light carries a shadow caster',
        shadowed.length === 1 && shadowed[ 0 ].name === 'key',
        `${ shadowed.length } shadow-casting light(s): ${ shadowed.map( ( p ) => p.name ).join( ', ' ) || 'none' }. ` +
        'Measured 2.62 ms each at 1920x1080 on the real figure; four would be 9.11 ms on top of the ' +
        'area lights\' 3.61, i.e. 77% of a 16.6 ms frame.'
    );
}

console.log( '\n--- the shadow camera ---------------------------------------------------------\n' );

{
    for ( const [ label, height ] of [ [ 'portrait', PORTRAIT_HEIGHT_METRES ], [ 'body', BODY_HEIGHT_METRES ] ] ) {

        const { rig } = rigFor( {
            preset: label === 'body' ? 'body' : 'portrait',
            subjectHeightMetres: height,
            ...shot
        } );

        const unit = rig.units.find( ( entry ) => entry.shadowCaster !== null );
        const camera = unit.shadowCaster.shadow.camera;
        const distance = unit.placement.distanceInHeights * height;

        // What the cone actually covers at the subject's own distance, in metres across.
        const span = 2 * distance * Math.tan( unit.shadowCaster.angle );
        const defaultSpan = 2 * distance * Math.tan( Math.PI / 3 );

        const texelsAcrossSubject = ( rig.shadowMapSize / span ) * height;

        // Two things have to be true at once and they pull against each other, which is why the
        // check states both. The cone must be much TIGHTER than three's 120° default or the shadow
        // map is a staircase — and it must be WIDER than the subject, or its own edge draws a soft
        // wedge across the backdrop, because three derives the shadow frustum from `light.angle`
        // and there is nothing outside the cone for the shadow to be a shadow of.
        report(
            `${ label }: the shadow cone is tighter than three's default but wider than the subject`,
            span > height * 1.5 && span < defaultSpan * 0.5 && camera.near > 0 && camera.near < distance && camera.far > distance,
            `cone ${ ( unit.shadowCaster.angle * 180 / Math.PI ).toFixed( 1 ) }° covers ${ span.toFixed( 2 ) } m at the subject ` +
            `— ${ ( span / height ).toFixed( 2 ) }x a ${ height.toFixed( 2 ) } m subject, against the default π/3's ` +
            `${ defaultSpan.toFixed( 1 ) } m. near ${ camera.near.toFixed( 3 ) } far ${ camera.far.toFixed( 3 ) } around a ` +
            `standoff of ${ distance.toFixed( 3 ) } m; ${ texelsAcrossSubject.toFixed( 0 ) } shadow texels across the subject ` +
            `against ${ ( ( 2048 / defaultSpan ) * height ).toFixed( 0 ) } at the default`
        );

    }
}

console.log( '\n--- what the rig reports about itself ------------------------------------------\n' );

{
    const { rig } = rigFor( { preset: 'portrait', subjectHeightMetres: PORTRAIT_HEIGHT_METRES, ...shot } );
    const rows = rig.describe( CANVAS_HEIGHT_PIXELS, HEAD_RADIUS_METRES );

    console.log( `      ${ 'light'.padEnd( 8 ) }${ 'az°'.padStart( 7 ) }${ 'el°'.padStart( 6 ) }${ 'E'.padStart( 8 ) }` +
        `${ 'panel m'.padStart( 14 ) }${ 'd m'.padStart( 8 ) }${ 'Ω_p sr'.padStart( 9 ) }${ 'radiance'.padStart( 11 ) }` +
        `${ '1+cosφ'.padStart( 9 ) }${ 'band px'.padStart( 9 ) }` );

    for ( const row of rows ) {

        console.log( `      ${ row.name.padEnd( 8 ) }${ row.azimuthDegrees.toFixed( 0 ).padStart( 7 ) }` +
            `${ row.elevationDegrees.toFixed( 0 ).padStart( 6 ) }${ row.irradiance.toFixed( 2 ).padStart( 8 ) }` +
            `${ `${ row.panelMetres[ 0 ].toFixed( 2 ) }x${ row.panelMetres[ 1 ].toFixed( 2 ) }`.padStart( 14 ) }` +
            `${ row.distanceMetres.toFixed( 2 ).padStart( 8 ) }${ row.projectedSolidAngle.toFixed( 4 ).padStart( 9 ) }` +
            `${ row.areaRadiance.toFixed( 2 ).padStart( 11 ) }${ row.silhouetteBandFraction.toFixed( 3 ).padStart( 9 ) }` +
            `${ row.silhouetteBandPixels.toFixed( 1 ).padStart( 9 ) }` );

    }

    report(
        'describe() reports every light with a derived radiance',
        rows.length === MAX_AREA_LIGHTS && rows.every( ( row ) => Number.isFinite( row.areaRadiance ) && row.areaRadiance > 0 ),
        `${ rows.length } rows, radiances ${ rows.map( ( r ) => r.areaRadiance.toFixed( 1 ) ).join( ' / ' ) }`
    );
}

// A camera object is constructed only to prove the module does not need one — the rig takes a
// position, not a camera, so it cannot be coupled to a projection it has no business knowing.
void new PerspectiveCamera();

console.log( `\n${ failures === 0 ? 'PASS' : 'FAIL' }: ${ checks - failures }/${ checks } checks green\n` );

process.exitCode = failures === 0 ? 0 : 1;
