/**
 * Gate for the attribution toggles on `packages/testbed/src/alive.js`.
 *
 * ## What this file exists to stop
 *
 * Every rendering claim in this project is made by TOGGLE: capture the shipped plate, capture
 * `?x=0`, measure both, and attribute the difference to x. That inference is only valid if `?x=0`
 * switches x AND NOTHING ELSE — and nothing on the page ever asserted that, so for two review
 * rounds it was not true.
 *
 * `?eyes=0` returned before both `new EyeMaterial()` and `buildEyeOcclusion()`. It removed the eye
 * SHADER and the four occlusion/lacrimal meshes, and every number attributed to "the eye shader"
 * was a sum over two subsystems whose contributions have OPPOSITE SIGNS. Measured on one page load
 * of `?bare&freeze&seed=1` at 900x1200 CSS, `measure.mjs` G2 luma ratio against the committed
 * portrait regions: shipped 0.9203, sheet off only 0.9449, material off only 0.8815, both off
 * 0.9086. The old control reported 0.0117 of movement for a shader worth 0.0388.
 *
 * ## 🚩 AND THE FIRST VERSION OF THIS FILE DID NOT STOP IT — IT STOPPED ONE INSTANCE OF IT
 *
 * That version checked a CENSUS of nine named counters. Nine is not the render state; it is a
 * sample of the render state, and "switches nothing else" is a claim about ALL of it. A confound
 * planted on any subsystem outside the nine was invisible by construction, and `alive.js` reads
 * THIRTY-SEVEN url keys. Reproduced 2026-08-08 with a one-line patch to `alive.js` —
 *
 *     skinSpecularAntiAliasing: query.get( 'specaa' ) !== '0'
 *  -> skinSpecularAntiAliasing: query.get( 'specaa' ) !== '0' && query.get( 'cards' ) !== '0'
 *
 * so `?cards=0` silently removed the skin's Toksvig specular-AA term as well as the eyelash and
 * brow cards. All nine counters sat exactly on their baselines and the file reported `PASS: 24/24
 * checks green`. `?specaa=0` on its own is worth 24.88% of the frame's pixels, so a quarter of the
 * frame's worth of a second subsystem was riding inside every card attribution, undetected.
 *
 * The model error was not a missing row. It was **treating an enumeration as a closure**: two
 * hand-written lists — which toggles exist, and which subsystems exist — each of which the page is
 * free to outgrow without telling anyone, and both of which already had.
 *
 * ## 🚩 AND THE SECOND VERSION DID NOT STOP IT EITHER — IT STOPPED A SECOND INSTANCE OF IT
 *
 * That version's answer to "an enumeration is not a closure" was the FINGERPRINT: the whole scene,
 * keyed by entity, deny-by-default. It closed the mesh surface and the light surface completely.
 * It did not close the RENDERER, and nobody noticed, because `shadingFingerprint`'s `pipeline`
 * entry looks like a whole-object reading and is nineteen hand-picked fields. Reproduced
 * 2026-08-08 by an independent verifier with a one-line patch to `alive.js` routing `?cards=0`
 * through `renderer.toneMappingExposure` — a property the `pipeline` row does not carry, sitting
 * one identifier away from `toneMapping`, which it does. **The file reported 109/109 green.** The
 * confound is worth **48.64% of the frame's samples at a mean of 4.60/255**, against the 0.478%
 * at 0.424/255 that `?cards=0` legitimately does: **102x the pixel area and 10.8x the magnitude**
 * of the thing being attributed.
 *
 * The model error is the SAME ONE, one level up, and that is the part worth carrying forward: a
 * hand-written list of nineteen pipeline fields is a sample of the renderer's state, and "the
 * toggle changed nothing else" is a claim about all of it. Adding `toneMappingExposure` to the
 * list would fix this confound and nothing else. Walked rather than listed, the renderer and the
 * scene between them carry **116** readable configuration properties on this page — the gate
 * prints the count every run — so a nineteen-field row leaves the next confound 97 others to pick
 * from.
 *
 * ## The FIVE instruments, and why no four of them are enough
 *
 * 1. SURFACE CLOSURE. `alive.js` now records the url keys it actually reads and reports them from
 *    `window.sugata.toggleSurface()`. Every key must be classified here — gated, mode switch, or
 *    explicitly ungated with a reason. A toggle added to the page without a line in this file
 *    turns the gate red. This is what stops the inventory falling behind again, and it is a
 *    RUNTIME RECORD of what the code did, not a regex over what the code says.
 *
 * 2. FINGERPRINT. `window.sugata.shadingState()` returns the whole shading configuration keyed by
 *    entity — every mesh's material scalars, textures and node-graph STRUCTURE, every light, and
 *    the post pipeline. For each gated toggle the set of entities that change must equal the set
 *    it declares. Deny by default, so an entity nobody thought of is collateral; and the declared
 *    set must be fully used, so an allowlist cannot be padded to make a red gate green.
 *
 * 3. PAIRWISE PIXELS. Bookkeeping-free, and the backstop for anything the fingerprint does not
 *    model. If `?A=0` has already removed B's subsystem, then adding `&B=0` has nothing left to
 *    remove and the two renders come back BYTE-IDENTICAL. Checked for every ordered pair of the
 *    scene off-switches, which is the generalisation of the eye-pair check the old file ran for
 *    one pair only.
 *
 * 4. THE CENSUS, kept. Nine counters read off the scene graph. It is the most readable statement
 *    of "the toggle did its job", and unlike the fingerprint it distinguishes a mesh that went
 *    away from a mesh that changed. It is no longer load-bearing for closure.
 *
 * 5. RENDERER AND SCENE STATE, ENUMERATED. The `WebGPURenderer` and the `Scene` are the two
 *    objects the fingerprint samples rather than reads, so this walks them instead of listing
 *    them: every own property and every prototype accessor that returns a scalar, plus one level
 *    into any plain-object member (which is what reaches `shadowMap.enabled` and
 *    `debug.checkShaderErrors`). 116 properties on the shipped plate, PROPERTY-GRANULAR rather
 *    than entity-granular, and deny-by-default — a toggle declares the exact property paths it
 *    may move and any other movement is collateral.
 *
 *    It lives HERE rather than inside `shadingFingerprint` because `alive.js` belongs to another
 *    agent this round; the equivalent one-line widening of the page's own fingerprint is filed as
 *    a diff request. The gate does not depend on that landing.
 *
 *    Measured, so the reader knows what it costs: on two loads of the same url the 116 values are
 *    identical, and across every toggle in the table exactly TWO move anything — `?shadows=0`
 *    (`renderer.shadowMap.enabled`, `scene.children`) and `?aa=msaa` (`renderer._samples` and its
 *    accessor). Everything else is inert on both objects, which is what makes a single moved
 *    property a signal rather than noise. `scene.uuid` is excluded and says why at its exclusion.
 *
 *    🎯 AND THE PROOF, RUN THREE WAYS. Each `--confound` below turns the file red and is caught by
 *    EXACTLY ONE check — the instrument-5 row for `?cards=0` — which is the finding rather than a
 *    detail: instruments 1-4 stay green on all three, so the confound really is invisible to
 *    everything that existed before this instrument, and instrument 5 really is what catches it.
 *
 *      | --confound | shipped | with the confound | the one check that fires                        |
 *      |------------|---------|-------------------|-------------------------------------------------|
 *      | exposure   | 144/144 | 144/145           | `renderer.toneMappingExposure 1 -> 1.35`        |
 *      | shadowmap  | 144/144 | 144/145           | `renderer.shadowMap.enabled true -> false`      |
 *      | scene      | 144/144 | 144/145           | `scene.backgroundIntensity 1 -> 0.6`            |
 *
 *    (145 rather than 144 because a confound run adds the check that the rewrite reached the page.)
 *
 * ## 🚩 THE PIXEL CHECKS RUN ON THE FORWARD PATH, AND THEY HAVE TO
 *
 * The old file compared bytes on the SHIPPED default plate. Measured 2026-08-08, four loads of
 * `?bare&freeze&seed=1` with nothing changed between them: no two were byte-identical. Three loads
 * with `&grade=0`: still no two identical. Three loads with `&grade=0&aa=msaa`: BYTE-IDENTICAL,
 * every pair. The temporal resolve accumulates over however many frames the page happened to run
 * before the screenshot, so on the default path "these two plates differ" is a claim that is true
 * for free and a check that cannot fail — the old file's three pixel checks were decorative for
 * exactly that reason, in the same class as the defect they were written to catch.
 *
 * So the pixel plates are built on `&aa=msaa&grade=0`, which is the deterministic forward path, and
 * `PIXEL_BASE` determinism is itself the first thing checked. If someone breaks it, this file says
 * so and reports the pixel section as unusable rather than passing thirty checks for free.
 *
 * (That nondeterminism is a real defect and it is not this file's — `?capture` plus a pinned frame
 * epoch is what fixes it, and `alive-capture-determinism.selftest.mjs` owns that. This file only
 * has to avoid being fooled by it.)
 *
 * ## Why it is a browser test and not a unit test
 *
 * The claim under test is about what a PLATE CONTAINS, and only a rendered page can answer it.
 * Reading `alive.js` and reasoning about its control flow is exactly the method that missed the
 * defect, and asserting against the page's own flags would be a tautology — the flags were correct
 * the whole time; the thing they were supposed to control was not. So this file drives a real
 * Chromium against a real vite, and reads the scene graph.
 *
 * Usage:  node "packages/testbed/src/alive-toggles.selftest.mjs"
 *
 * It loads about seventy plates and takes ~3.5 minutes. That is the price of the pairwise sweep,
 * which is quadratic in the number of scene off-switches, and it is worth stating up front so a
 * slow run is not mistaken for a hang.
 *
 * Exit codes follow tools/critic/measure.mjs, so a caller can tell a red gate from a broken tool:
 *   0 = every check green
 *   1 = at least one check FAILED
 *   2 = tool error — no Chromium, no vite, the page never became ready. NOT a pass.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPOSITORY_ROOT = path.resolve( fileURLToPath( new URL( '.', import.meta.url ) ), '../../..' );

/**
 * 🚩 THE REJECTION PROOFS, AS A FLAG, WITH NOTHING WRITTEN TO THE WORKING TREE.
 *
 *     node "packages/testbed/src/alive-toggles.selftest.mjs" --confound=exposure
 *
 * Each entry is a one-line patch to `alive.js` — the same shape as the patch an independent
 * verifier used to walk past 109 green checks — applied by intercepting the module vite serves
 * and rewriting it in flight. `alive.js` on disk is never touched, which matters for two reasons:
 * it belongs to another agent this round, and a proof that lives in the gate can be re-run by
 * anyone, where a paragraph describing an edit somebody once made cannot.
 *
 * The anchor is `window.sugata = {`, which sits inside the function where both `stage` and
 * `query` are in scope and runs once the renderer exists. It survives vite's transform — checked
 * by fetching the served module and counting occurrences, which is exactly one.
 *
 * All three route a `?cards=0` confound somewhere the shipped `pipeline` fingerprint row does not
 * look, and they are three DIFFERENT mechanisms rather than three spellings of one:
 *
 *   exposure     `renderer.toneMappingExposure`, the reported defect. One identifier away from
 *                `toneMapping`, which the pipeline row DOES carry.
 *   shadowmap    `renderer.shadowMap.enabled`, a nested plain-object member — a property path
 *                that no flat list of renderer fields would reach even if somebody wrote one.
 *   scene        `scene.backgroundIntensity`, which is not on the renderer at all. It exists to
 *                prove the fix closed a SURFACE and not a property list: a gate that had only
 *                learned to enumerate the renderer would sail through this one.
 */
const CONFOUNDS = {
    exposure: {
        code: 'if ( query.get( \'cards\' ) === \'0\' ) stage.renderer.toneMappingExposure = 1.35;',
        why: 'the reported defect: ?cards=0 also lifts the renderer exposure by 35%'
    },
    shadowmap: {
        code: 'if ( query.get( \'cards\' ) === \'0\' ) stage.renderer.shadowMap.enabled = false;',
        why: 'a nested plain-object member: ?cards=0 also switches the shadow map off'
    },
    scene: {
        code: 'if ( query.get( \'cards\' ) === \'0\' ) stage.scene.backgroundIntensity = 0.6;',
        why: 'not on the renderer at all: ?cards=0 also dims the scene background'
    }
};

const CONFOUND_ANCHOR = 'window.sugata = {';

const CONFOUND = process.argv
    .find( ( argument ) => argument.startsWith( '--confound=' ) )?.split( '=' )[ 1 ] ?? null;

if ( CONFOUND !== null && CONFOUNDS[ CONFOUND ] === undefined ) {

    console.error( `\n--confound: '${ CONFOUND }' is not one of ${ Object.keys( CONFOUNDS ).join( ', ' ) }\n` );
    process.exit( 2 );

}

// The same flags capture.mjs launches with. `headless_shell` has no GPU and therefore no WebGPU,
// so the channel matters as much as the flags.
const GPU_FLAGS = [ '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--hide-scrollbars' ];

/**
 * The plate the census and the fingerprint are read from.
 *
 * `?freeze` with NO `?preroll` is chosen deliberately: with freeze on and no pre-roll the motion
 * stack never advances, so no layer ever writes a morph and the scene stands in one pose. The
 * fingerprint needs that far less than the old pixel checks did — it reads configuration, not
 * frames — but a still plate keeps the two instruments looking at the same thing.
 */
const BASE_QUERY = 'bare&freeze&seed=1';

/**
 * The plate the PIXEL checks are read from, and the reason it is not `BASE_QUERY`.
 *
 * Byte equality is the whole mechanism of instrument 3, so it needs a plate where byte equality
 * means something. It does not on the shipped default: see the header for the four-load
 * measurement. `aa=msaa` puts the frame on the forward path with no temporal history, `grade=0`
 * takes out the frame-indexed grain, and three loads of the result came back byte-identical.
 *
 * The cost is stated rather than hidden: these checks are made about the forward-path render, not
 * the shipped one. What they assert — that `?eyes=0` does not also take the occlusion sheet — is a
 * fact about which meshes and materials are in the scene, and the anti-aliasing mode does not
 * change which meshes are in the scene. `PIXEL_BASE_IS_REPRODUCIBLE` below is what keeps that
 * substitution honest.
 */
const PIXEL_BASE = `${ BASE_QUERY }&aa=msaa&grade=0`;

/**
 * EVERY TOGGLE THAT CHANGES WHAT THE FRAME IS SHADED WITH, and the exact set of fingerprint
 * entities each one is allowed to move.
 *
 * `touches` is an EQUALITY, not a maximum: the entities that change must be exactly these. Too many
 * is collateral — the confound this file exists to catch. Too few means the toggle stopped doing
 * its job, or that somebody widened the list to quieten a red gate. Both are failures and both are
 * reported with the difference spelled out.
 *
 * Every row below was MEASURED rather than reasoned about, by loading the plate and diffing the
 * fingerprint against the baseline. Two of them record couplings nobody had written down:
 *
 *   - `?shadows=0` moves TWO light entities, `key` and `key-shadow`, because `LightingRig` builds a
 *     shadow-casting companion beside the area light rather than casting from it.
 *   - `?frame=body`, `?height=`, `?pose=` and `?gender=` each move FIVE lights, because the rig is
 *     re-aimed at whatever the new framing put in shot. That is legitimate and it is exactly the
 *     kind of thing a reader needs told: a plate captured at `?frame=body` is not a plate of the
 *     portrait rig with a wider lens.
 *
 * `census` is the counter this toggle should drive to zero, where one exists. Six of these toggles
 * have no counter and never did — which is the point: the fingerprint gates them anyway.
 */

/** The five entities `LightingRig` re-aims when the framing changes. Named once; used four times. */
const RIG_LIGHTS = [ 'light:key', 'light:key-shadow', 'light:fill', 'light:rim', 'light:kicker' ];

const TOGGLES = [

    // --- the scene's shading subsystems ---------------------------------------------------------
    { query: 'skin=0', census: 'skinMaterial', touches: [ 'mesh:Human' ] },
    { query: 'eyes=0', census: 'eyeMaterial', touches: [ 'mesh:Humancornea', 'mesh:Humanhigh-poly' ] },
    { query: 'eyeocc=0', census: 'eyeOcclusion', touches: [
        'mesh:eyeOcclusion.left', 'mesh:eyeOcclusion.right',
        'mesh:eyeLacrimal.left', 'mesh:eyeLacrimal.right'
    ] },
    { query: 'cards=0', census: 'cardShading', touches: [ 'mesh:Humaneyebrow001', 'mesh:Humaneyelashes01' ] },
    { query: 'cavity=0', census: 'skinCavityStrength', touches: [ 'mesh:Human' ] },

    // No counter has ever existed for either of these, and that is how a confound on `specaa` hid
    // from twenty-four green checks. The fingerprint is their gate.
    { query: 'specaa=0', census: null, touches: [ 'mesh:Human' ] },
    { query: 'ground=0', census: null, touches: [ 'mesh:ground' ] },
    { query: 'backdrop=0x11151f', census: null, touches: [ 'mesh:backdrop' ] },

    // --- the rig ---------------------------------------------------------------------------------
    // 🎯 The only TOGGLES row with a non-empty `rendererState`. `LightingRig.attachTo` flips
    // `renderer.shadowMap.enabled`, and the caster and its target leave the scene graph, so the
    // scene's own child count moves. Both were MEASURED by instrument 5 rather than reasoned out,
    // and writing them down is what turns "the renderer never moves" into a checkable claim.
    { query: 'shadows=0', census: 'shadowCastingLights', touches: [ 'light:key', 'light:key-shadow' ],
        rendererState: [ 'renderer.shadowMap.enabled', 'scene.children' ] },
    { query: 'ov=rim.irradiance:0', census: null, touches: [ 'light:rim' ] },

    // --- the post pipeline -------------------------------------------------------------------------
    // `?msaa=0` is a synonym and lands on `aa=off` too. It used to own `multisampleSamples`, and
    // when the page moved to TAAU that row went decorative overnight: MSAA is off by default now,
    // so the check read "multisampleSamples 0 -> 0" and PASSED without being able to fail. The
    // toggle that removes this page's anti-aliasing is the one that removes the temporal resolve.
    { query: 'aa=off', census: 'temporalResolve', touches: [ 'pipeline' ] },
    { query: 'grade=0', census: 'grade', touches: [ 'pipeline' ] },
    { query: 'morphvel=off', census: null, touches: [ 'pipeline' ] },
    { query: 'gsharp=none', census: null, touches: [ 'pipeline' ] },
    { query: 'sharp=0.2', census: null, touches: [ 'pipeline' ] },
    { query: 'scale=1', census: null, touches: [ 'pipeline' ] },

    // The grade's own parameters. Every one of them measured as an EMPTY diff until the fingerprint
    // learned to unwrap a TSL uniform — six live attribution knobs that the instrument was
    // reporting as inert. Kept as individual rows because that is what makes the next one visible.
    { query: 'tone=agx', census: null, touches: [ 'pipeline' ] },
    { query: 'exposure=1.1', census: null, touches: [ 'pipeline' ] },
    { query: 'bloom=0', census: null, touches: [ 'pipeline' ] },
    { query: 'thresh=0.9', census: null, touches: [ 'pipeline' ] },
    { query: 'grain=0', census: null, touches: [ 'pipeline' ] },
    { query: 'vignette=0', census: null, touches: [ 'pipeline' ] },
    { query: 'sat=1', census: null, touches: [ 'pipeline' ] },

    // --- framing and identity ----------------------------------------------------------------------
    // All four re-aim the rig, and nothing else. Gating them with an explicit five-light allowlist
    // says out loud that a plate captured at another framing carries a differently-aimed rig.
    { query: 'frame=body', census: null, touches: RIG_LIGHTS },
    { query: 'height=0.3', census: null, touches: RIG_LIGHTS },
    { query: 'pose=bind', census: null, touches: RIG_LIGHTS },

    // 🎯 `?gender=1` MOVES THE CORNEA AS WELL, and nothing had ever recorded that. It loads a
    // different bake, and `EyeMaterial` fits the corneal axis and the iris plane to the mesh it is
    // given at construction — so the g100 cornea carries different fitted constants from the g050
    // one. Found by the fingerprint the day it learned to read uniform VALUES and not just graph
    // structure; the structural version reported this plate as five lights and nothing else.
    { query: 'gender=1', census: null, touches: [ ...RIG_LIGHTS, 'mesh:Humancornea' ] },

    // --- and the ones whose allowlist is EMPTY -----------------------------------------------------
    // The strictest row shape in the table: these may change the motion, the dials or the DOM, and
    // they may not touch the shading configuration AT ALL. A confound that reached shading from any
    // of them would show up as a non-empty diff against an empty allowlist.
    { query: 'seed=42', census: null, touches: [] },
    { query: 'preroll=0.1', census: null, touches: [] },
    { query: 'arousal=0.8', census: null, touches: [] },
    { query: 'load=0.4', census: null, touches: [] },
    { query: 'attention=0.9', census: null, touches: [] }
];

/**
 * A mode SWITCH rather than an off switch: it must turn one census entry on and the other off.
 *
 * Its `touches` carries a coupling worth reading twice. `?aa=msaa` moves the two CARD entities as
 * well as the pipeline, because alpha-to-coverage is only applied when the target is actually
 * multisampled — `applyCardShading` is told which target it got. That is not collateral, it is the
 * documented reason the flag is passed down at all, and the fingerprint is what makes it visible
 * instead of a paragraph in a comment.
 */
const MUTUALLY_EXCLUSIVE = {
    query: 'aa=msaa',
    turnsOn: 'multisampleSamples',
    turnsOff: 'temporalResolve',
    touches: [ 'mesh:Humaneyebrow001', 'mesh:Humaneyelashes01', 'pipeline' ],

    // Both spellings of the same fact, because instrument 5 enumerates rather than curates: the
    // MSAA count lives in the private field and `samples` is its accessor. Declaring both is
    // cheaper than deciding which one is canonical, and neither may move on its own.
    rendererState: [ 'renderer._samples', 'renderer.get:samples' ]
};

/**
 * URL keys `alive.js` reads that are NOT shading toggles, each with the reason it is not gated
 * here. This table is the other half of the closure check: without it "classify every key" would be
 * satisfiable by gating nothing, and with it, retiring a key from the gate costs a written excuse.
 *
 * `readHere` is whether the plates THIS FILE loads consult the key at all. It is not a detail: the
 * surface is recorded from live reads, so a key the gate never causes to be read cannot be checked
 * from here, and saying so is more honest than a row that looks gated and is not. Both `false`
 * entries below were found by the gate rather than reasoned out in advance, and the second is the
 * more interesting of the two.
 */
const UNGATED = {
    bare: { readHere: true, why: 'hides the DOM overlays. Already on in every plate this file loads.' },
    freeze: { readHere: true, why: 'stops the motion stack. Already on in every plate this file loads.' },
    capture: { readHere: true, why: 'hands the frame clock to the caller. Its own gate is alive-capture-determinism.selftest.mjs.' },
    msaa: { readHere: true, why: 'the legacy synonym for ?aa — `?msaa=0` resolves to `aa=off`, which is gated above.' },
    webgl: { readHere: true, why:
        'swaps the backend to WebGL2, which has no velocity buffer, so the page refuses to build a ' +
        'figure at all on the default temporal path. Measured: the wait for a figure times out at ' +
        '120 s, so no plate exists to gate.' },

    clockdefect: { readHere: false, why:
        'read only inside the `?capture` branch, and this file drives the free-running clock. ' +
        'alive-capture-determinism.selftest.mjs is what exercises it.' },

    // 🚩 `?trace=0` IS INERT ON EVERY PLATE THIS FILE TAKES, and it took the gate to notice. The
    // read is `if ( bare || query.get( 'trace' ) === '0' )`, and `||` short-circuits — so on any
    // `?bare` plate the key is never even consulted, which is why it never appeared in the recorded
    // surface. That is not a bug in the page (bare already hides the strip chart) but it does mean
    // `?trace=0` cannot be attributed from a bare plate, and a row claiming to gate it here would
    // have been gating nothing.
    trace: { readHere: false, why:
        '`?bare` short-circuits the read, so no plate this file loads ever consults it. It also ' +
        'has nothing to change on such a plate: bare has already hidden the strip chart.' },

    // 🚩 THE GATE FOUND THIS ONE THE HOUR IT LANDED, which is the whole point of recording the
    // surface from live reads rather than maintaining a list. Phase 9 added `?wear` to `alive.js`
    // and this file went 144/144 -> 143/144 with `UNCLASSIFIED: wear` before anybody had a chance
    // to forget about it.
    //
    // It is NOT a shading switch and a TOGGLES row would be the wrong shape for it. Every other
    // key in that table changes how the SAME scene is shaded; `?wear` changes WHAT IS IN the scene
    // — it swaps the body for the hide-mask bake, rebuilds the body's index buffer and adds up to
    // three `SkinnedMesh`es — so "changes exactly these entities and no others" has no honest
    // allowlist. Its gate is `packages/core/src/wardrobe/wardrobe.selftest.mjs` (35 assertions),
    // which measures the thing that actually matters about it: the rebuilt index equals the baked
    // one as a multiset of triangle centroids, not merely in count.
    //
    // ⚠️ What THIS file is entitled to say about it is the claim the shipped plate depends on, and
    // it is asserted below rather than left as prose: **with `?wear` absent, the page must not
    // consult the wardrobe at all.** `readHere: true` is honest — the key IS read on every plate
    // here, because `query.has( 'wear' )` runs unconditionally — and what the check asserts is that
    // reading it and finding nothing costs the plate nothing.
    wear: { readHere: true, why:
        'PHASE 9. Not a shading switch: it changes what is IN the scene (a different body bake, a ' +
        'rebuilt index buffer, up to three garment meshes), so no entity allowlist describes it. ' +
        'Gated by packages/core/src/wardrobe/wardrobe.selftest.mjs. What is checked HERE is the ' +
        'only claim the shipped plate rests on: absent, it is inert.' }
};

/**
 * Census entries that are DELIBERATELY ZERO on the shipped plate, with the reason. Everything else
 * must be live, or the "went to zero" checks below pass for the wrong reason.
 *
 * `multisampleSamples` is here because MSAA and the temporal resolve are mutually exclusive —
 * `Stage.create` throws on the pair — so no single plate can carry both. It is not left unguarded:
 * MUTUALLY_EXCLUSIVE above asserts that `?aa=msaa` really does swap one for the other.
 */
const EXPECTED_ZERO_AT_BASELINE = {
    multisampleSamples: 'MSAA is mutually exclusive with the temporal resolve, which ships on'
};

/**
 * The off switches the pairwise pixel sweep runs over: the ones that add or remove something from
 * the SCENE, which is what "adding the second toggle had nothing left to remove" is a statement
 * about. The pipeline and grade rows are excluded because `PIXEL_BASE` has already pinned both.
 *
 * 🚩 `?ground=0` IS NOT HERE, AND THE REASON IS A MEASUREMENT, NOT A JUDGEMENT. On the portrait
 * plate it renders BYTE-IDENTICAL to the base — the floor is simply not in a head-and-shoulders
 * frame — so every pair containing it was byte-identical too, and seven checks were failing for one
 * reason that had nothing to do with a confound. Dropping it from the sweep would be exactly the
 * move this file exists to prevent, so it is not dropped: `GROUND_IS_A_BODY_FRAME_TOGGLE` below
 * asserts both halves of the excuse, that it is inert at portrait AND live at `?frame=body`.
 */
const PIXEL_SWEEP = [ 'skin=0', 'eyes=0', 'eyeocc=0', 'cards=0', 'shadows=0', 'cavity=0', 'specaa=0' ];

/**
 * ONE TOGGLE ABSORBS ANOTHER: adding `inner` to a plate that already has `outer` changes nothing,
 * because `inner` is a term inside the thing `outer` removed.
 *
 * ⚠️ AND IT IS DIRECTIONAL. The first version of this table was keyed on the unordered pair and
 * exempted BOTH directions, which is wrong and was caught by execution: `?skin=0` absorbs
 * `?cavity=0` — measured byte-identical — but `?cavity=0` plainly does not absorb `?skin=0`, and
 * the symmetric exemption was quietly retiring that second, perfectly good check. An exemption that
 * covers more than it was argued for is the same failure as a census that counts fewer things than
 * exist.
 *
 * Gated in the direction it claims, like every other exemption in this file: the pairs named here
 * are REQUIRED to be byte-identical, so declaring an absorption is not a way to skip a check by
 * writing its name in a list. If the cavity ever becomes something that survives `?skin=0`, this
 * goes red and the row comes out.
 */
const ABSORBS = {
    'skin=0': {
        'cavity=0': 'the cavity term lives in the skin shader, so ?skin=0 leaves nothing to carry it',
        'specaa=0': 'the specular-AA filter is a node on the skin roughness node, so ?skin=0 takes it too'
    }
};

/**
 * The two halves of the excuse for `?ground=0` sitting out of the pairwise sweep. Both are asserted,
 * because "it changes nothing here" is also what a broken toggle looks like, and only the second
 * check tells those two apart.
 */
const GROUND_IS_A_BODY_FRAME_TOGGLE = {
    inertAt: `${ BASE_QUERY }&aa=msaa&grade=0`,
    liveAt: `${ BASE_QUERY }&aa=msaa&grade=0&frame=body`,
    toggle: 'ground=0'
};

let checks = 0;
let failures = 0;

function report( label, ok, detail ) {

    checks ++;
    if ( ok !== true ) failures ++;

    console.log( `${ ok ? 'PASS' : 'FAIL' }  ${ label }` );
    if ( detail !== undefined ) console.log( `        ${ detail }` );

}

function toolError( message ) {

    console.error( `\nTOOL ERROR: ${ message }\n` );
    process.exit( 2 );

}

/**
 * INSTRUMENT 5, and it runs INSIDE the page — it is handed to `page.evaluate`, so it may not
 * reference anything in this module's scope.
 *
 * ## Why a walk and not a list
 *
 * `shadingFingerprint`'s `pipeline` row is nineteen hand-picked fields, and a confound planted on
 * any of the other 118 readable properties of the renderer and the scene is invisible to it. That
 * is the same "enumeration is not a closure" error the fingerprint itself was built to fix, one
 * level up. So this enumerates rather than lists: own properties, prototype accessors, and one
 * level into plain-object members.
 *
 * ## What it reads, and the three deliberate limits
 *
 * - **Own properties**, including the underscore-prefixed ones. `_samples` is where the MSAA count
 *   actually lives and its public accessor is a second reading of the same thing; both are kept,
 *   because deny-by-default is cheaper than deciding which of two spellings is canonical.
 * - **Prototype accessors**, read through a try/catch. A getter that throws is recorded as
 *   `threw` rather than skipped, so a property that STARTS throwing is a change.
 * - **One level into plain objects** — members whose constructor is `Object` and nothing else.
 *   That is what reaches `shadowMap.enabled`, `shadowMap.type` and `debug.checkShaderErrors`, and
 *   what keeps `backend`, `info`, `_nodes` and the other twenty machinery instances out. A class
 *   instance is recorded by its constructor name only, so a per-frame counter inside `info`
 *   cannot make the instrument drift.
 * - **`undefined` values are dropped, not recorded.** Measured: `scene.backgroundNode` is an own
 *   property holding `undefined` on some plates and absent on others, reproducibly, and the two
 *   states are the same state. Recording it made `?shadows=0` carry a difference that means
 *   nothing.
 * - **`uuid` is excluded and this is the only exclusion.** three mints a fresh one per instance,
 *   so `scene.uuid` differs on every load and would report the instrument as pure noise — the same
 *   reason `textureIdentity` in `alive.js` refuses to use it. Anything else that drifts is a real
 *   finding and the baseline check below is what surfaces it.
 *
 * @returns {Object<string,string>} property path -> value. Compared for equality, never parsed.
 */
function rendererAndSceneState() {

    const subjects = { renderer: globalThis.sugata.stage.renderer, scene: globalThis.sugata.stage.scene };
    const state = {};

    const describe = ( value ) => {

        if ( value === null ) return 'null';
        if ( typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string' ) return String( value );
        if ( typeof value === 'function' ) return null;
        if ( Array.isArray( value ) ) return `array(${ value.length })`;

        if ( typeof value === 'object' ) {

            if ( value.isColor === true ) return `color:${ value.getHexString() }`;
            return `object:${ value.constructor?.name ?? '?' }`;

        }

        return String( value );

    };

    for ( const [ label, subject ] of Object.entries( subjects ) ) {

        const seen = new Set();

        const record = ( key, value ) => {

            if ( value === undefined ) return;

            const described = describe( value );

            if ( described !== null ) state[ `${ label }.${ key }` ] = described;

        };

        for ( const key of Object.keys( subject ).sort() ) {

            seen.add( key );

            if ( key === 'uuid' ) continue;

            let value;

            try {

                value = subject[ key ];

            } catch {

                state[ `${ label }.${ key }` ] = 'threw';
                continue;

            }

            record( key, value );

            // The one level down. A plain object here is a configuration bag three wrote by hand
            // — `shadowMap`, `debug` — and everything else is a class with machinery in it.
            if ( value !== null && typeof value === 'object' && Array.isArray( value ) === false
                && value.constructor === Object ) {

                for ( const inner of Object.keys( value ).sort() ) {

                    try {

                        record( `${ key }.${ inner }`, value[ inner ] );

                    } catch {

                        state[ `${ label }.${ key }.${ inner }` ] = 'threw';

                    }

                }

            }

        }

        let prototype = Object.getPrototypeOf( subject );

        while ( prototype !== null && prototype !== Object.prototype ) {

            for ( const key of Object.getOwnPropertyNames( prototype ).sort() ) {

                if ( seen.has( key ) || key === 'uuid' ) continue;

                const descriptor = Object.getOwnPropertyDescriptor( prototype, key );

                if ( descriptor === undefined || typeof descriptor.get !== 'function' ) continue;

                seen.add( key );

                try {

                    record( `get:${ key }`, subject[ key ] );

                } catch {

                    state[ `${ label }.get:${ key }` ] = 'threw';

                }

            }

            prototype = Object.getPrototypeOf( prototype );

        }

    }

    // Not a property of either object, and the one piece of render state that lives on the canvas:
    // `?scale` is applied with `setSize`, so this is where a resolution confound would show.
    const canvas = globalThis.sugata.stage.renderer.domElement;

    state[ 'renderer.canvasPixels' ] = `${ canvas.width }x${ canvas.height }`;

    return state;

}

/** Entity keys whose signature is not the same in the two fingerprints. */
function changedEntities( before, after ) {

    const keys = new Set( [ ...Object.keys( before ), ...Object.keys( after ) ] );

    return [ ...keys ].filter( ( key ) => before[ key ] !== after[ key ] ).sort();

}

/** Set difference, kept as a named function because the failure messages read off both directions. */
function missingFrom( wanted, got ) {

    return wanted.filter( ( entry ) => got.includes( entry ) === false ).sort();

}

// --- the harness ------------------------------------------------------------------------------

/**
 * Playwright is deliberately not a dependency of this repo — it is a development instrument, not
 * part of the build — so it is looked up wherever it happens to live, npx's cache included. Same
 * resolution order as tools/critic/capture.mjs.
 */
async function loadPlaywright() {

    const cache = path.join( process.env.HOME ?? '', '.npm', '_npx' );
    const fromCache = fs.existsSync( cache )
        ? fs.readdirSync( cache )
            .map( ( entry ) => path.join( cache, entry, 'node_modules', 'playwright' ) )
            .filter( ( candidate ) => fs.existsSync( candidate ) )
        : [];

    const require = createRequire( import.meta.url );

    for ( const candidate of [ 'playwright', process.env.PLAYWRIGHT_MODULE, ...fromCache ] ) {

        if ( candidate === undefined ) continue;

        try {

            const namespace = await import( pathToFileURL( require.resolve( candidate ) ).href );
            return namespace.chromium !== undefined ? namespace : namespace.default;

        } catch {

            // try the next candidate; the error only matters if they all fail
        }

    }

    return null;

}

/** The watcher is off for the same reason capture.mjs turns it off: a concurrent agent's save
 *  would otherwise navigate the page out from under a check. */
async function startVite() {

    const { createServer } = await import( path.join( REPOSITORY_ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js' ) );

    const server = await createServer( {
        configFile: path.join( REPOSITORY_ROOT, 'vite.config.js' ),
        server: { port: 5194, strictPort: false, hmr: false, watch: { ignored: [ '**' ] } },
        logLevel: 'silent'
    } );

    await server.listen();
    server.baseUrl = server.resolvedUrls.local[ 0 ].replace( /\/$/, '' );

    return server;

}

/** One page load. Returns everything the page can say about itself, plus the rendered bytes. */
async function loadPlate( page, baseUrl, query ) {

    await page.goto( `${ baseUrl }/alive.html?${ query }`, { waitUntil: 'load' } );
    await page.waitForFunction( () => globalThis.sugata?.session?.figure != null, null, { timeout: 120_000 } );

    // The figure lands before its materials have all compiled; a plate read too early is a plate
    // of a half-shaded figure and would make the census right and the pixels wrong.
    await page.waitForTimeout( 1500 );

    const state = await page.evaluate( () => ( {
        census: globalThis.sugata.subsystems(),
        fingerprint: globalThis.sugata.shadingState(),
        surface: globalThis.sugata.toggleSurface(),

        // Phase 9's inertness claim, read off the page rather than assumed. `?wear` is UNGATED
        // here for the reason written in that table; this is the one thing about it this file IS
        // entitled to check, so it is carried on every plate.
        wardrobe: globalThis.sugata.wardrobe === null || globalThis.sugata.wardrobe === undefined
            ? null
            : globalThis.sugata.wardrobe.stats().worn
    } ) );

    // Instrument 5. A second evaluate rather than a fifth field above, because this function is
    // defined in THIS file and shipped into the page — see `rendererAndSceneState` for why that
    // is deliberate rather than awkward.
    state.rendererState = await page.evaluate( rendererAndSceneState );

    state.pixels = await page.screenshot( { timeout: 60_000 } );

    return state;

}

// --- run --------------------------------------------------------------------------------------

const playwright = await loadPlaywright();
if ( playwright === null ) toolError( 'playwright not resolvable. Run: npx playwright install chromium' );

const server = await startVite().catch( ( error ) => toolError( `vite would not start: ${ error.message }` ) );

let browser = null;

try {

    browser = await playwright.chromium.launch( { channel: 'chromium', headless: true, args: GPU_FLAGS } );

} catch ( error ) {

    await server.close();
    toolError( `could not launch Chromium: ${ error.message }` );

}

const context = await browser.newContext( { viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 } );
const page = await context.newPage();

if ( CONFOUND !== null ) {

    // The rewrite is asserted rather than attempted: a route that silently failed to find its
    // anchor would produce a clean run and read as "the gate did not catch it", which is the exact
    // wrong conclusion. `injected` is checked after the sweep.
    let injected = 0;

    await page.route( '**/src/alive.js*', async ( route ) => {

        const response = await route.fetch();
        const body = await response.text();

        if ( body.includes( CONFOUND_ANCHOR ) === false ) {

            await route.fulfill( { response } );
            return;

        }

        injected += 1;

        await route.fulfill( {
            status: 200,
            headers: { ...response.headers(), 'content-type': 'application/javascript' },
            body: body.replace( CONFOUND_ANCHOR, `${ CONFOUNDS[ CONFOUND ].code }\n    ${ CONFOUND_ANCHOR }` )
        } );

    } );

    globalThis.__confoundInjections = () => injected;

    console.log( `\n🚩 CONFOUND INJECTED: ${ CONFOUNDS[ CONFOUND ].why }\n   ${ CONFOUNDS[ CONFOUND ].code }\n` +
        '   alive.js on disk is untouched; the module is rewritten in flight. This run is a\n' +
        '   rejection proof, not a verdict on the repo.\n' );

}

console.log( `\nalive.html toggles — ${ server.baseUrl }/alive.html?${ BASE_QUERY }\n` );

// Every key any plate in this run was seen to read. Unioned rather than taken from one plate,
// because a key consulted only inside a branch that plate did not take goes unrecorded — see
// `recordingQuery` in alive.js for the limit this works around.
const observedSurface = new Set();

// Plate label -> what the wardrobe was wearing on it, or null if it was never built. Phase 9's
// inertness claim is checked over ALL of these rather than over the baseline alone, because "the
// boot path does not touch the wardrobe" is a claim about every reachable configuration.
const plateWardrobes = new Map();

try {

    console.log( '--- are the instruments usable at all? -------------------------------------\n' );

    const baseline = await loadPlate( page, server.baseUrl, BASE_QUERY );
    const baselineAgain = await loadPlate( page, server.baseUrl, BASE_QUERY );

    for ( const key of [ ...baseline.surface, ...baselineAgain.surface ] ) observedSurface.add( key );

    plateWardrobes.set( 'baseline', baseline.wardrobe );
    plateWardrobes.set( 'baseline (second load)', baselineAgain.wardrobe );

    // A fingerprint that drifts between two loads of the same url reports every toggle as
    // collateral and the whole of instrument 2 becomes noise. Checked first so a drift is diagnosed
    // rather than blamed on whichever toggle happens to be read next.
    const drift = changedEntities( baseline.fingerprint, baselineAgain.fingerprint );

    report(
        'the fingerprint is the same on two loads of the same url, so a difference below means something',
        drift.length === 0,
        drift.length === 0
            ? `${ Object.keys( baseline.fingerprint ).length } entities, all reproducible`
            : `DRIFTING: ${ drift.join( ', ' ) } — instrument 2 cannot separate a toggle from noise`
    );

    // The same question for instrument 5. It walks two live three.js objects, so "does it hold
    // still" is not a formality — a single per-frame counter caught by the walk would report every
    // toggle as collateral, and the walk is deliberately wide enough that one could be.
    const stateDrift = changedEntities( baseline.rendererState, baselineAgain.rendererState );

    report(
        'the renderer and scene walk is the same on two loads of the same url',
        stateDrift.length === 0,
        stateDrift.length === 0
            ? `${ Object.keys( baseline.rendererState ).length } properties across the renderer and the scene, ` +
                'all reproducible — so a property that moves below moved because a toggle moved it'
            : `DRIFTING: ${ stateDrift.map( ( key ) => `${ key } ${ baseline.rendererState[ key ] } / ` +
                `${ baselineAgain.rendererState[ key ] }` ).join( ', ' ) } — instrument 5 cannot separate a ` +
                'toggle from noise. Either exclude the property with a written reason, or fix what is drifting.'
    );

    // A walk that found almost nothing would pass every check below for free, the same way a
    // census of zeros would. 119 is what the shipped page measures; the floor is set well under it
    // so a three.js upgrade that renames a few fields does not fail this, while a walk that
    // collapsed to a handful of properties does.
    report(
        'the walk actually reaches the renderer\'s state, so "nothing moved" means something',
        Object.keys( baseline.rendererState ).length >= 80
            && baseline.rendererState[ 'renderer.toneMappingExposure' ] !== undefined
            && baseline.rendererState[ 'renderer.shadowMap.enabled' ] !== undefined
            && baseline.rendererState[ 'scene.backgroundIntensity' ] !== undefined,
        `${ Object.keys( baseline.rendererState ).length } properties, including the three a confound has ` +
        `already been routed through: toneMappingExposure=${ baseline.rendererState[ 'renderer.toneMappingExposure' ] }, ` +
        `shadowMap.enabled=${ baseline.rendererState[ 'renderer.shadowMap.enabled' ] }, ` +
        `backgroundIntensity=${ baseline.rendererState[ 'scene.backgroundIntensity' ] }`
    );

    // The same question for instrument 3, and the one the old file never asked. See PIXEL_BASE.
    const pixelBase = await loadPlate( page, server.baseUrl, PIXEL_BASE );
    const pixelBaseAgain = await loadPlate( page, server.baseUrl, PIXEL_BASE );
    const pixelsAreReproducible = pixelBase.pixels.equals( pixelBaseAgain.pixels );

    report(
        `?${ PIXEL_BASE } renders the same bytes twice, so "these two plates differ" can fail`,
        pixelsAreReproducible,
        pixelsAreReproducible
            ? `two loads byte-identical at ${ pixelBase.pixels.length } bytes`
            : 'NOT REPRODUCIBLE — every pixel check below would pass for free and none of them mean ' +
                'anything. The default path is known non-reproducible (see the header); this is the ' +
                'forward path, so something that was deterministic has stopped being so.'
    );

    // A census of zeros would make every "went to zero" check below pass for the wrong reason.
    const empty = Object.entries( baseline.census )
        .filter( ( [ name, count ] ) => count === 0 && EXPECTED_ZERO_AT_BASELINE[ name ] === undefined );

    report(
        'every subsystem is live on the shipped plate, so a zero downstream means something',
        empty.length === 0,
        empty.length === 0
            ? `${ Object.keys( baseline.census ).length } subsystems; all live except ` +
                Object.entries( EXPECTED_ZERO_AT_BASELINE )
                    .map( ( [ name, why ] ) => `${ name } (${ why })` ).join( ', ' )
            : `NOT LIVE: ${ empty.map( ( [ name ] ) => name ).join( ', ' ) } — the checks below cannot mean anything`
    );

    // The other half of that exemption. Without this, declaring an entry "expected zero" would be
    // a way to retire a check by writing its name in a list.
    for ( const [ name, why ] of Object.entries( EXPECTED_ZERO_AT_BASELINE ) ) {

        report(
            `${ name } is zero at baseline for the stated reason, not because it is broken`,
            baseline.census[ name ] === 0,
            `${ name } = ${ baseline.census[ name ] } — ${ why }`
        );

    }

    console.log( `\n        baseline census: ${ JSON.stringify( baseline.census ) }` );
    console.log( `        fingerprint entities: ${ Object.keys( baseline.fingerprint ).join( ', ' ) }\n` );

    console.log( '\n--- one toggle, one subsystem ----------------------------------------------\n' );

    for ( const toggle of TOGGLES ) {

        const plate = await loadPlate( page, server.baseUrl, `${ BASE_QUERY }&${ toggle.query }` );

        for ( const key of plate.surface ) observedSurface.add( key );

        plateWardrobes.set( `?${ toggle.query }`, plate.wardrobe );

        // Instrument 2, both directions. Exactly the declared entities, no more and no fewer.
        const changed = changedEntities( baseline.fingerprint, plate.fingerprint );
        const collateral = missingFrom( changed, toggle.touches );
        const inert = missingFrom( toggle.touches, changed );

        report(
            `?${ toggle.query } changes exactly ${ toggle.touches.length === 0 ? 'NOTHING' : toggle.touches.join( ' + ' ) }`,
            collateral.length === 0 && inert.length === 0,
            collateral.length === 0 && inert.length === 0
                ? `the other ${ Object.keys( baseline.fingerprint ).length - changed.length } entities hold their signatures`
                : [
                    collateral.length > 0
                        ? `COLLATERAL ${ collateral.join( ', ' ) } — every attribution made against ?${ toggle.query } is a sum`
                        : null,
                    inert.length > 0
                        ? `DECLARED BUT UNCHANGED ${ inert.join( ', ' ) } — either the toggle stopped working, or this row is padded`
                        : null
                ].filter( ( line ) => line !== null ).join( '; ' )
        );

        // Instrument 5, property-granular and deny-by-default. Most rows declare NOTHING here,
        // which is the strictest shape in the table: a toggle that reaches the renderer or the
        // scene at all is collateral unless it says so and says exactly what.
        const declaredState = toggle.rendererState ?? [];
        const movedState = changedEntities( baseline.rendererState, plate.rendererState );
        const stateCollateral = missingFrom( movedState, declaredState );
        const stateInert = missingFrom( declaredState, movedState );

        report(
            `?${ toggle.query } moves ${ declaredState.length === 0 ? 'NO renderer or scene state' : declaredState.join( ' + ' ) }`,
            stateCollateral.length === 0 && stateInert.length === 0,
            stateCollateral.length === 0 && stateInert.length === 0
                ? `the other ${ Object.keys( baseline.rendererState ).length - movedState.length } properties of the ` +
                    'renderer and the scene hold their values'
                : [
                    stateCollateral.length > 0
                        ? `COLLATERAL ${ stateCollateral.map( ( key ) => `${ key } ` +
                            `${ baseline.rendererState[ key ] ?? 'ABSENT' } -> ${ plate.rendererState[ key ] ?? 'ABSENT' }` )
                            .join( ', ' ) } — every attribution made against ?${ toggle.query } is a sum`
                        : null,
                    stateInert.length > 0
                        ? `DECLARED BUT UNCHANGED ${ stateInert.join( ', ' ) } — either the toggle stopped working, ` +
                            'or this row is padded'
                        : null
                ].filter( ( line ) => line !== null ).join( '; ' )
        );

        // Instrument 4, where a counter exists. It says something the fingerprint does not: that
        // the subsystem is GONE, not merely different.
        if ( toggle.census === null ) continue;

        if ( plate.census[ toggle.census ] === undefined ) {

            report( `?${ toggle.query } names a subsystem the census knows`, false,
                `'${ toggle.census }' is not in the census — this row is gating nothing` );
            continue;

        }

        report(
            `?${ toggle.query } switches ${ toggle.census } OFF`,
            plate.census[ toggle.census ] === 0,
            `${ toggle.census } ${ baseline.census[ toggle.census ] } -> ${ plate.census[ toggle.census ] }`
        );

    }

    console.log( '\n--- the anti-aliasing mode switch -------------------------------------------\n' );

    const msaaPlate = await loadPlate( page, server.baseUrl, `${ BASE_QUERY }&${ MUTUALLY_EXCLUSIVE.query }` );

    for ( const key of msaaPlate.surface ) observedSurface.add( key );

    plateWardrobes.set( `?${ MUTUALLY_EXCLUSIVE.query }`, msaaPlate.wardrobe );

    report(
        `?${ MUTUALLY_EXCLUSIVE.query } turns ${ MUTUALLY_EXCLUSIVE.turnsOn } ON`,
        msaaPlate.census[ MUTUALLY_EXCLUSIVE.turnsOn ] > 0,
        `${ MUTUALLY_EXCLUSIVE.turnsOn } ${ baseline.census[ MUTUALLY_EXCLUSIVE.turnsOn ] } -> ${ msaaPlate.census[ MUTUALLY_EXCLUSIVE.turnsOn ] }`
    );

    report(
        `?${ MUTUALLY_EXCLUSIVE.query } turns ${ MUTUALLY_EXCLUSIVE.turnsOff } OFF, because the two cannot coexist`,
        msaaPlate.census[ MUTUALLY_EXCLUSIVE.turnsOff ] === 0,
        `${ MUTUALLY_EXCLUSIVE.turnsOff } ${ baseline.census[ MUTUALLY_EXCLUSIVE.turnsOff ] } -> ${ msaaPlate.census[ MUTUALLY_EXCLUSIVE.turnsOff ] }`
    );

    const msaaChanged = changedEntities( baseline.fingerprint, msaaPlate.fingerprint );
    const msaaCollateral = missingFrom( msaaChanged, MUTUALLY_EXCLUSIVE.touches );
    const msaaInert = missingFrom( MUTUALLY_EXCLUSIVE.touches, msaaChanged );

    report(
        `?${ MUTUALLY_EXCLUSIVE.query } changes exactly ${ MUTUALLY_EXCLUSIVE.touches.join( ' + ' ) }`,
        msaaCollateral.length === 0 && msaaInert.length === 0,
        msaaCollateral.length === 0 && msaaInert.length === 0
            ? 'the pipeline and the two alpha-to-coverage cards, which is the documented coupling'
            : `COLLATERAL ${ msaaCollateral.join( ', ' ) || 'none' }; DECLARED BUT UNCHANGED ${ msaaInert.join( ', ' ) || 'none' }`
    );

    {
        const movedState = changedEntities( baseline.rendererState, msaaPlate.rendererState );
        const stateCollateral = missingFrom( movedState, MUTUALLY_EXCLUSIVE.rendererState );
        const stateInert = missingFrom( MUTUALLY_EXCLUSIVE.rendererState, movedState );

        report(
            `?${ MUTUALLY_EXCLUSIVE.query } moves ${ MUTUALLY_EXCLUSIVE.rendererState.join( ' + ' ) } and nothing else on the renderer`,
            stateCollateral.length === 0 && stateInert.length === 0,
            stateCollateral.length === 0 && stateInert.length === 0
                ? `renderer._samples ${ baseline.rendererState[ 'renderer._samples' ] } -> ` +
                    `${ msaaPlate.rendererState[ 'renderer._samples' ] }, and the other ` +
                    `${ Object.keys( baseline.rendererState ).length - movedState.length } properties hold`
                : `COLLATERAL ${ stateCollateral.join( ', ' ) || 'none' }; DECLARED BUT UNCHANGED ` +
                    `${ stateInert.join( ', ' ) || 'none' }`
        );
    }

    // 🎯 PHASE 9's INERTNESS CLAIM, which is the one thing this file is entitled to say about
    // `?wear` — see its UNGATED row. Every plate in this run was loaded WITHOUT it, so if the
    // wardrobe were being built eagerly it would be built on all of them, and the shipped default
    // a judge captures would be paying for a manifest fetch and a different body bake.
    //
    // Asserted over EVERY plate rather than over the baseline alone, because "the boot path does
    // not touch the wardrobe" is a claim about all reachable configurations and one plate is a
    // sample. 37 keys were swept; none of them may wake it.
    {
        const woken = [ ...plateWardrobes.entries() ]
            .filter( ( [ , worn ] ) => worn !== null )
            .map( ( [ label, worn ] ) => `${ label } -> [${ worn.join( ', ' ) }]` );

        report(
            'with ?wear absent the wardrobe is never built, on ANY plate this file loads',
            woken.length === 0,
            woken.length === 0
                ? `${ plateWardrobes.size } plates, sugata.wardrobe null on every one — no manifest fetch, ` +
                    'no hide-mask body, nothing added to the scene'
                : `THE WARDROBE WOKE UP UNASKED on ${ woken.join( '; ' ) } — every plate in this run is a ` +
                    'sum, and so is the shipped default'
        );

        // 🚩 AND THE PROOF THAT THE CHECK ABOVE IS NOT SATISFIED BY A PAGE THAT HAS NO WARDROBE AT
        // ALL. Thirty-five nulls are also what you get if `?wear` were deleted, if the dynamic
        // import silently failed, or if `sugata.wardrobe` were never exposed — so on its own the
        // check cannot tell "correctly inert" from "absent". One plate WITH the flag separates
        // them, and it is the cheap end of the flag: `?wear=` builds the wardrobe over the
        // hide-mask body and fetches no garment fragments, so it costs the body bake and the
        // manifest rather than 18 MB of PNG.
        const wardrobePlate = await loadPlate( page, server.baseUrl, `${ BASE_QUERY }&wear=` );

        for ( const key of wardrobePlate.surface ) observedSurface.add( key );

        report(
            'and the same check SEES a wardrobe when ?wear IS present, so the nulls above mean inert and not absent',
            Array.isArray( wardrobePlate.wardrobe ) && wardrobePlate.wardrobe.length === 0,
            Array.isArray( wardrobePlate.wardrobe )
                ? `?wear= built the wardrobe and wore [${ wardrobePlate.wardrobe.join( ', ' ) }] — ` +
                    'the decency floor, which is empty until 9.8 lands'
                : 'sugata.wardrobe is STILL null with ?wear in the url — the check above proves nothing, ' +
                    'because it cannot distinguish an inert wardrobe from a missing one'
        );
    }

    console.log( '\n--- is the gate looking at every toggle the page has? -----------------------\n' );

    // Instrument 1. The check that stops this file quietly gating eight of thirty-seven again.
    const classified = new Set( [
        ...TOGGLES.map( ( toggle ) => toggle.query.split( '=' )[ 0 ] ),
        MUTUALLY_EXCLUSIVE.query.split( '=' )[ 0 ],
        ...Object.keys( UNGATED )
    ] );

    const unclassified = [ ...observedSurface ].filter( ( key ) => classified.has( key ) === false ).sort();

    report(
        'every url key the page read is classified in this file',
        unclassified.length === 0,
        unclassified.length === 0
            ? `${ observedSurface.size } keys observed, all of them either gated or listed in UNGATED with a reason`
            : `UNCLASSIFIED: ${ unclassified.join( ', ' ) } — add a TOGGLES row with a measured 'touches', ` +
                'or an UNGATED line saying why it is not a shading switch. Until then nothing checks it.'
    );

    // And the reverse, so a row can be retired from `alive.js` without leaving a check that reads
    // green over a toggle that no longer exists. The two keys declared `readHere: false` are held
    // out — this file cannot cause them to be read — and asserted absent immediately below, so the
    // hold-out is a claim that fails rather than a hole.
    const heldOut = Object.entries( UNGATED )
        .filter( ( [ , entry ] ) => entry.readHere === false )
        .map( ( [ key ] ) => key );

    const dead = [ ...classified ]
        .filter( ( key ) => heldOut.includes( key ) === false )
        .filter( ( key ) => observedSurface.has( key ) === false )
        .sort();

    report(
        'every key this file classifies is one the page actually reads',
        dead.length === 0,
        dead.length === 0
            ? `all ${ classified.size - heldOut.length } observable classified keys were observed`
            : `NOT READ BY THE PAGE: ${ dead.join( ', ' ) } — the row is gating a toggle that is gone`
    );

    for ( const key of heldOut ) {

        // If one of these starts being read on a plain plate, the reason written beside it has
        // stopped being true and the key needs gating for real rather than excusing.
        report(
            `?${ key } is not consulted on any plate this file loads, as declared`,
            observedSurface.has( key ) === false,
            observedSurface.has( key ) === false
                ? UNGATED[ key ].why
                : `IT WAS READ — the hold-out reason no longer holds, so this key is now gateable ` +
                    'from here and should be a TOGGLES row with a measured touches list'
        );

    }

    console.log( '\n--- pairwise independence, in pixels ---------------------------------------\n' );

    if ( pixelsAreReproducible === false ) {

        console.log( '        SKIPPED — the base plate is not reproducible, so none of these could fail.\n' );

    } else {

        // Every plate the sweep needs, loaded once each and reused across both directions of each
        // pair. Keyed by the query so the pair loop reads as the comparison it is making.
        const plates = new Map();

        for ( const toggle of PIXEL_SWEEP ) {

            plates.set( toggle, ( await loadPlate( page, server.baseUrl, `${ PIXEL_BASE }&${ toggle }` ) ).pixels );

        }

        for ( const toggle of PIXEL_SWEEP ) {

            // Two ways a pair check can pass without meaning anything, and both are checked here
            // rather than assumed. A plate that does not reproduce makes "these differ" true for
            // free — the reason the whole pixel section moved to the forward path — and reproducing
            // the BASE does not establish that a TOGGLED plate reproduces, which is a different
            // claim about a different render.
            const again = ( await loadPlate( page, server.baseUrl, `${ PIXEL_BASE }&${ toggle }` ) ).pixels;

            report(
                `?${ toggle } renders the same bytes twice`,
                plates.get( toggle ).equals( again ),
                plates.get( toggle ).equals( again )
                    ? 'reproducible, so a pair containing it can fail'
                    : 'NOT REPRODUCIBLE — every pair below containing it passes for free'
            );

            // And a toggle that changes no pixels at all makes every pair containing it
            // byte-identical for a reason that has nothing to do with a confound. Same shape as the
            // non-zero baseline census: establish that each input is live before comparing them.
            report(
                `?${ toggle } moves pixels on the forward path, so a pair containing it can fail`,
                plates.get( toggle ).equals( pixelBase.pixels ) === false,
                plates.get( toggle ).equals( pixelBase.pixels )
                    ? `?${ toggle } is BYTE-IDENTICAL to the base plate — it renders nothing here, and every ` +
                        'pair below that contains it is vacuous'
                    : 'differs from the base plate'
            );

        }

        for ( let i = 0; i < PIXEL_SWEEP.length; i ++ ) {

            for ( let j = i + 1; j < PIXEL_SWEEP.length; j ++ ) {

                const a = PIXEL_SWEEP[ i ];
                const b = PIXEL_SWEEP[ j ];
                const both = ( await loadPlate( page, server.baseUrl, `${ PIXEL_BASE }&${ a }&${ b }` ) ).pixels;

                // Both directions from the one extra plate, and the absorption lookup is made per
                // direction rather than per pair — see ABSORBS for the round where it was not.
                for ( const [ first, second ] of [ [ a, b ], [ b, a ] ] ) {

                    const alone = plates.get( first );
                    const absorbed = ABSORBS[ first ]?.[ second ];

                    if ( absorbed !== undefined ) {

                        // Declaring an absorption is not a way to skip a check — the exemption is
                        // itself asserted, in exactly the direction it claims.
                        report(
                            `?${ first } absorbs ?${ second }, as declared`,
                            alone.equals( both ),
                            alone.equals( both )
                                ? absorbed
                                : `THEY DIFFER — the row says ${ absorbed }, so the absorption has stopped ` +
                                    'being true and the exemption in ABSORBS is now hiding a real check'
                        );
                        continue;

                    }

                    // The failure text states the OBSERVATION, not a cause: two identical plates
                    // mean the second toggle changed nothing, and that has two possible causes —
                    // the first toggle already removed its subsystem, or the second toggle is
                    // inert. Both were reproduced while proving this gate; naming one of them sent
                    // a reader looking in the wrong place.
                    report(
                        `?${ second } still changes the render when ?${ first } is already on`,
                        alone.equals( both ) === false,
                        alone.equals( both )
                            ? `?${ first } and ?${ first }&${ second } are BYTE-IDENTICAL — adding ?${ second } ` +
                                `removed nothing, so either ?${ first } already took its subsystem or ?${ second } is inert`
                            : 'the two plates differ'
                    );

                }

            }

        }

        console.log( '\n--- the one toggle that is out of the sweep, and why ------------------------\n' );

        // Both halves of the excuse, so "?ground=0 does nothing at portrait" cannot be used to
        // retire it. If the second check ever goes red the toggle really is dead and the first
        // check's green is meaningless.
        const groundInert = ( await loadPlate( page, server.baseUrl,
            `${ GROUND_IS_A_BODY_FRAME_TOGGLE.inertAt }&${ GROUND_IS_A_BODY_FRAME_TOGGLE.toggle }` ) ).pixels;

        report(
            `?${ GROUND_IS_A_BODY_FRAME_TOGGLE.toggle } changes nothing at PORTRAIT framing, which is why it is out of the sweep`,
            groundInert.equals( pixelBase.pixels ),
            groundInert.equals( pixelBase.pixels )
                ? 'byte-identical to the portrait base — the floor is not in a head-and-shoulders frame'
                : 'IT MOVES PIXELS AT PORTRAIT after all, so it belongs back in PIXEL_SWEEP'
        );

        const bodyBase = ( await loadPlate( page, server.baseUrl, GROUND_IS_A_BODY_FRAME_TOGGLE.liveAt ) ).pixels;
        const bodyGround = ( await loadPlate( page, server.baseUrl,
            `${ GROUND_IS_A_BODY_FRAME_TOGGLE.liveAt }&${ GROUND_IS_A_BODY_FRAME_TOGGLE.toggle }` ) ).pixels;

        report(
            `?${ GROUND_IS_A_BODY_FRAME_TOGGLE.toggle } DOES move pixels at ?frame=body, so it is out of frame rather than broken`,
            bodyGround.equals( bodyBase ) === false,
            bodyGround.equals( bodyBase )
                ? 'BYTE-IDENTICAL at body framing too — the contact occlusion reaches no plate at all, and ' +
                    'the +0.0307 floor-luma figure alive.js records for it cannot be reproduced from this page'
                : 'the contact term is visible once the floor is in shot'
        );

    }

    // 🚩 A REJECTION PROOF THAT NEVER APPLIED ITS DEFECT IS A CLEAN RUN THAT READS AS A GATE
    // FAILURE. Asserted, and asserted INSIDE the run so it lands in the same tally as everything
    // else: if the anchor ever stops appearing in the served module, this says so rather than
    // letting a green run be reported as "the gate does not catch it".
    if ( CONFOUND !== null ) {

        const injections = globalThis.__confoundInjections();

        report(
            `the --confound=${ CONFOUND } rewrite actually reached the served alive.js`,
            injections > 0,
            injections > 0
                ? `${ injections } module loads rewritten at the '${ CONFOUND_ANCHOR }' anchor`
                : `THE ANCHOR WAS NEVER FOUND — no plate in this run carried the confound, so every green ` +
                    'check above is a green check on the shipped page and proves nothing about the gate'
        );

    }

} finally {

    await browser.close();
    await server.close();

}

console.log( `\n${ failures === 0 ? 'PASS' : 'FAIL' }: ${ checks - failures }/${ checks } checks green\n` );

process.exitCode = failures === 0 ? 0 : 1;
