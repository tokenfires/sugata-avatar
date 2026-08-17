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
 * ## 🚩 AND THE THIRD VERSION DID NOT STOP IT EITHER. THE ENUMERATION MOVED TO THE SUBJECT LIST
 *
 * That version walked, deny-by-default, every readable property of two objects — and the two
 * objects were a hand-written list. `renderer.render( scene, camera )` takes THREE, and the walk
 * took the first two. Reproduced 2026-08-08 with a one-line patch routing `?cards=0` through
 * `stage.camera.filmOffset`: **`PASS: 147/147 checks green`**, the file's own reach check among
 * them. An independent verifier measured the confounded plate against the baseline at 900x1200,
 * `?bare&freeze&seed=1&capture`, 60 steps — **53.8625% of samples differing, worst 247/255**,
 * against `0.0000%` for two separate launches of the baseline, and against the **1.0672%** the
 * PUNCHLIST records for what `?cards=0` legitimately does. Roughly fifty times the pixel area of
 * the thing being attributed.
 *
 * The model error is the same one A THIRD TIME, one level further up, and this is the version to
 * remember: **each fix closed the surface it had just been burned on and left the container of that
 * surface enumerated.** Nine counters -> the whole scene keyed by entity, whose renderer was a
 * nineteen-field row. Nineteen fields -> every property of the renderer and the scene, whose
 * SUBJECT LIST was two names. There is no reason to expect the next one to be different, so the
 * subject list is now closed the same way the toggle list is: the walk reports every object-valued
 * member of the `Stage`, and every one of them must be walked here or carry a written reason.
 * FIFTEEN exist; three are walked; the twelve that are not are named below with what does cover
 * them — and where nothing fully does, the gate says so on every run rather than implying closure.
 * The fifteenth is punch-list 3.10's `stage.ambientOcclusion`, and the day it landed this file went
 * red with `UNCLASSIFIED SUBJECT: ambientOcclusion`, which is the mechanism working.
 *
 * A second mechanism in the same class, found while fixing the first and just as invisible:
 * `describe()` recorded a `Vector3` as the string `object:Vector3`. Adding the camera as a subject
 * would have caught `filmOffset`, a scalar, and still missed `camera.position.z += 0.02` — a dolly
 * that moves every pixel — because the property it lives on is a VALUE OBJECT and the walk was
 * recording its type name. Both confounds ship as `--confound=camera` and `--confound=cameraTransform`.
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
 * 5. FRAME SUBJECT STATE, ENUMERATED. The subjects are the arguments of the draw call —
 *    `renderer.render( scene, camera )` — because that is the closure the claim needs, and any
 *    shorter list is a sample of it. Each is WALKED rather than listed: every own property and
 *    every prototype accessor that returns a scalar, every three math value read as its NUMBERS
 *    rather than its type name, and one level into any configuration bag (a member carrying
 *    nothing but scalars, which is what reaches `shadowMap.enabled`, `debug.checkShaderErrors`,
 *    `camera.view.fullWidth` and `camera.layers.mask`). 184 properties on the shipped plate,
 *    PROPERTY-GRANULAR rather than entity-granular, and deny-by-default — a toggle declares the
 *    exact property paths it may move and any other movement is collateral.
 *
 *    And the subject list itself is closed rather than trusted: the walk also records every
 *    object-valued member of the `Stage` by identity, and `UNWALKED_SUBJECTS` below must carry a
 *    written reason for each of the twelve that are not walked. A `Stage` that grows a sixteenth
 *    member turns this file red on the run after it lands, and a fifteenth one just did.
 *
 *    ⚠️ Seven of those twelve are the post stack, and their reason is an ADMISSION rather than a
 *    closure — the run prints it every time rather than leaving it in a comment. What is checkable
 *    about it is checked: `GRADE_UNIFORMS` holds the `Grade` to the exact set of knobs something is
 *    known to carry, so the day it grows one this file goes red instead of the knob going ungated.
 *    `stage.ambientOcclusion` is an eighth post-stack member with a BETTER reason and its own
 *    remaining hole — the pipeline row carries its whole `describe()`, but four of its eight live
 *    uniforms are outside that report, so `OCCLUSION_UNIFORMS` states and checks the same closure.
 *
 *    Measured, so the reader knows what it costs. On two loads of the same url the 184 values are
 *    identical bar two, `camera.view.offsetX` and `camera.view.offsetY`, which are excluded and say
 *    why at their exclusion. Across the toggle table exactly EIGHT rows move anything, all of them
 *    declared and all of them measured rather than reasoned out:
 *
 *      | toggle                                | what it moves on the frame subjects              |
 *      |---------------------------------------|--------------------------------------------------|
 *      | `?shadows=0`                          | `renderer.shadowMap.enabled`, `scene.children`   |
 *      | `?aa=msaa`                            | the sample count, and the camera's view offset   |
 *      | `?aa=off`                             | the camera's view offset, `stage.temporal`       |
 *      | `?scale=1`                            | the four view-offset extents (the input size)    |
 *      | `?grade=0`                            | `stage.grade`                                    |
 *      | `?gtao=0`                             | `stage.ambientOcclusion`, and `scene.children`   |
 *      |                                       | — the ambient goes back in as a HemisphereLight  |
 *      | `?frame=body` `?height=` `?pose=` `?gender=` | the camera placement, four properties     |
 *
 *    The last row is the one worth reading twice: four toggles that nothing in this repo had ever
 *    recorded as MOVING THE CAMERA now say so out loud, so a plate captured at `?frame=body` is
 *    known to be a plate from a different viewpoint and not merely a wider lens.
 *
 *    🎯 AND THE PROOF, RUN FIVE WAYS, every number below RE-RUN against THIS file at 194 clean
 *    checks — the counts moved when punch-list 3.5/3.6's groom added three, so they were measured
 *    again rather than adjusted by arithmetic. Four of the five are caught by EXACTLY ONE check —
 *    the instrument-5 row for `?cards=0` — and that is the finding rather than a detail:
 *    instruments 1-4 stay green, so the confound really is invisible to everything that existed
 *    before this instrument.
 *
 *      | --confound      | mechanism                      | result  | what fires                        |
 *      |-----------------|--------------------------------|---------|-----------------------------------|
 *      | exposure        | renderer scalar                | 193/195 | instrument 5 AND the pipeline row |
 *      | shadowmap       | nested configuration bag       | 194/195 | `renderer.shadowMap.enabled`      |
 *      | scene           | not on the renderer at all     | 194/195 | `scene.backgroundIntensity 1 ->   |
 *      |                 |                                |         | 0.6`                              |
 *      | camera          | THE THIRD SUBJECT              | 194/195 | `camera.filmOffset 0 -> 0.6`, and |
 *      |                 |                                |         | the two projection matrices       |
 *      | cameraTransform | a VALUE OBJECT on that subject | 194/195 | `camera.position`, and the three  |
 *      |                 |                                |         | matrices derived from it          |
 *
 *    (A confound run carries one check more than a clean one, because it adds the check that the
 *    rewrite reached the page.)
 *
 *    ⚠️ `exposure` IS THE ODD ROW AND IT USED TO BE THE TYPICAL ONE. When it was first planted it
 *    fired one check, here. `toneMappingExposure` was then added to `shadingFingerprint`'s pipeline
 *    row by name, so today it fires two — which is precisely the point made further up: naming the
 *    field that got caught fixes that confound and nothing else. The other four still fire once.
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
 * It loads about ninety plates and takes ~3.7 minutes (measured 220.26 s for the 194-check clean
 * run at this commit, and 218.43 s for the run before it — the spread is the machine, not the file). That is the price of the pairwise sweep, which is quadratic in the number of
 * scene off-switches, and it is worth stating up front so a slow run is not mistaken for a hang.
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

// The recommended transparency arm, IMPORTED rather than typed here. A literal would let the page
// and the module disagree and this file would certify the disagreement — which is exactly what
// happened for a round, when `alive.js` did not import `HairOIT` at all and shipped the cutout arm
// while `HairOIT.js` recommended `hash`. Verified importable under plain node: the module reaches
// `three/webgpu` and `three/tsl`, both of which resolve from this repository's node_modules.
import { HAIR_OIT_DEFAULT_MODE } from '../../core/src/render/HairOIT.js';

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
 * All five route a `?cards=0` confound somewhere an earlier version of this gate did not look, and
 * they are five DIFFERENT mechanisms rather than five spellings of one:
 *
 *   exposure         `renderer.toneMappingExposure`, the defect reported against version two. One
 *                    identifier away from `toneMapping`, which the pipeline row DOES carry.
 *   shadowmap        `renderer.shadowMap.enabled`, a nested configuration bag — a property path
 *                    that no flat list of renderer fields would reach even if somebody wrote one.
 *   scene            `scene.backgroundIntensity`, which is not on the renderer at all. It exists to
 *                    prove the fix closed a SURFACE and not a property list: a gate that had only
 *                    learned to enumerate the renderer would sail through this one.
 *   camera           `camera.filmOffset`, the defect reported against version three, whose walk
 *                    covered two of the draw call's three arguments. A scalar, so a gate that had
 *                    only learned to add the camera to its subject list catches this one.
 *   cameraTransform  `camera.position.z`, and it is here because the fix for `camera` does NOT
 *                    catch it: `position` is a `Vector3`, and a walk that records objects by
 *                    constructor name sees `object:Vector3` before and after a 20 mm dolly. It is
 *                    the SECOND MECHANISM IN THE SAME CLASS, and it is what forced the walk to
 *                    read three's math values as numbers.
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
    },
    camera: {
        code: 'if ( query.get( \'cards\' ) === \'0\' ) { stage.camera.filmOffset = 0.6; stage.camera.updateProjectionMatrix(); }',
        why: 'the THIRD argument of the draw call: ?cards=0 also shifts the camera\'s film back. The ' +
            'verifier who reported this measured it at 53.8625% of samples differing, worst 247/255'
    },
    cameraTransform: {
        code: 'if ( query.get( \'cards\' ) === \'0\' ) { stage.camera.position.z += 0.02; stage.camera.updateMatrixWorld( true ); }',
        why: 'a VALUE OBJECT on that third argument: ?cards=0 also dollies the camera 20 mm closer, ' +
            'which a walk that records a Vector3 by its constructor name cannot see'
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

/**
 * 🎯 THE FOUR PROPERTIES `placeCamera` MOVES, and the fact nothing in this repo had written down:
 * `?frame`, `?height`, `?pose` and `?gender` all MOVE THE CAMERA. They re-aim the rig — that much
 * was recorded — and they also re-place the viewpoint, because the framing is solved from the eye
 * height of whatever figure and pose the plate ended up with.
 *
 * Measured, one plate each against the baseline: `?pose=bind` lifts the camera 5.5 mm and
 * `?gender=1` lifts it 66.4 mm, both purely in Y; `?height=0.3` moves it in all three axes; and
 * `?frame=body` walks it 3.1 m back. `lookAt` re-derives the same 12° yaw each time to within a
 * few ULP, which is why the rotation is NOT in this list — see `roundedNumber` for the precision
 * that makes that a stable statement rather than a flaky one.
 *
 * Until this landed, a plate captured at another framing carried an undeclared viewpoint change,
 * and instrument 5 could not have said so because it was not looking at the camera at all.
 */
const CAMERA_PLACEMENT = [
    'camera.matrix', 'camera.matrixWorld', 'camera.matrixWorldInverse', 'camera.position'
];

/**
 * What leaves the camera when the temporal resolve does.
 *
 * TAAU jitters the projection by calling `camera.setViewOffset` before each frame and
 * `camera.clearViewOffset` after it, so on the shipped default the camera carries a disabled view
 * offset holding the last Halton sample. Take the resolve away — `?aa=off`, `?aa=msaa` — and
 * `camera.view` is null and the whole bag goes with it, including the two excluded per-frame
 * members, whose `excluded:` markers disappear alongside the properties they stand for.
 *
 * Declared as a named list because two rows need it and because it is the clearest single statement
 * of a coupling that reads as surprising: turning the anti-aliasing off changes the CAMERA.
 */
const TEMPORAL_VIEW_OFFSET = [
    'camera.view', 'camera.view.enabled',
    'camera.view.fullWidth', 'camera.view.fullHeight', 'camera.view.width', 'camera.view.height',
    'excluded:camera.view.offsetX', 'excluded:camera.view.offsetY',
    'stage.temporal'
];

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
    // 🎯 The only TOGGLES row that moves the RENDERER itself — the others that declare frame-subject
    // state move the camera, the scene or a Stage member. `LightingRig.attachTo` flips
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
    { query: 'aa=off', census: 'temporalResolve', touches: [ 'pipeline' ],
        rendererState: TEMPORAL_VIEW_OFFSET },
    { query: 'grade=0', census: 'grade', touches: [ 'pipeline' ],
        rendererState: [ 'stage.grade' ] },
    { query: 'morphvel=off', census: null, touches: [ 'pipeline' ] },
    { query: 'gsharp=none', census: null, touches: [ 'pipeline' ] },
    { query: 'sharp=0.2', census: null, touches: [ 'pipeline' ] },

    // `?scale` sets the resolve's INPUT size, and the jitter offset is expressed in input pixels,
    // so the four view-offset extents move with it. Measured: 1188x1584 -> 1800x2400 at scale=1.
    // The canvas does not move — `renderer.canvasPixels` holds — which is the distinction between
    // rendering at a different internal resolution and rendering at a different output size.
    { query: 'scale=1', census: null, touches: [ 'pipeline' ], rendererState: [
        'camera.view.fullWidth', 'camera.view.fullHeight', 'camera.view.width', 'camera.view.height'
    ] },

    // --- punch-list 3.10, the ground-truth occlusion --------------------------------------------
    //
    // 🎯 `?gtao=0` IS THE ONE ROW IN THIS BLOCK THAT MOVES A LIGHT, and that is the coupling the
    // page's own header warns about stated as a checkable claim rather than as a paragraph. With
    // 3.10 on, `LightingRig` is built `ambient: false` and the hemisphere term is re-evaluated per
    // pixel inside the composite; take the effect away and the `HemisphereLight` goes BACK INTO THE
    // SCENE. So the A side of 3.10 is not "the same frame minus an occlusion term" — it is a frame
    // whose ambient is computed somewhere else, and anything attributed to `?gtao=0` is that sum.
    //
    // Measured, one plate against the baseline: the fingerprint grows a `light:ambient` entity that
    // does not exist on the shipped plate (HemisphereLight, colour b9c4ea, intensity 0.561), the
    // pipeline row goes `ambientOcclusion=quality:low,samples:8,…` -> `ambientOcclusion=none`,
    // `scene.children` goes array(9) -> array(10) and `stage.ambientOcclusion` disappears. Nothing
    // else on any of the three frame subjects moves.
    //
    // No census row: 3.10's counter is NESTED inside `censusOfShading` rather than top-level, and
    // deliberately — see the comment at `census.ambientOcclusion` in alive.js. It reports `null`
    // here rather than 0, and `null` is not what the census check below tests for.
    { query: 'gtao=0', census: null, touches: [ 'light:ambient', 'pipeline' ],
        rendererState: [ 'scene.children', 'stage.ambientOcclusion' ] },

    // The six sub-flags, and their whole point is that they do NOT move the ambient the way the
    // master switch does: each one changes one term inside the composite and leaves the rig, the
    // meshes and all 184 frame-subject properties exactly where they were. Measured one plate each
    // against the baseline — every one of them an entity diff of `pipeline` ALONE, and an empty
    // frame-subject diff. That is the claim the punch list's separate A sides rest on: `?specocc=0`
    // is the plastic look and nothing else, `?ambspec=0` is the G6 lever and nothing else.
    //
    // The values are chosen to be different from what ships, or the row would be inert and the
    // gate would say so: `low`/`0.035`/`1` are the shipped quality, radius and strength.
    { query: 'gtaoq=high', census: null, touches: [ 'pipeline' ] },
    { query: 'bentnormal=0', census: null, touches: [ 'pipeline' ] },
    { query: 'specocc=0', census: null, touches: [ 'pipeline' ] },
    { query: 'ambspec=0', census: null, touches: [ 'pipeline' ] },
    { query: 'gtaoradius=0.06', census: null, touches: [ 'pipeline' ] },
    { query: 'gtaostrength=0', census: null, touches: [ 'pipeline' ] },

    // 🎯 A ROW THAT IS NOT AN ATTRIBUTION, AND IT IS HERE FOR THE OPPOSITE REASON TO EVERY OTHER ONE.
    // `?gtaoview=ao` does not switch a subsystem off — it REPLACES THE BEAUTY IMAGE with one of the
    // effect's own intermediates, so nobody ever measures "shipped minus this plate" and attributes
    // the difference to the flag. What this row asserts is the claim that DOES get made: that the
    // diagnostic reads the shipped scene rather than a perturbed one. The radius sweep table in
    // `render/GTAO.js` — five radii, five named boxes, code values to two decimals — was measured
    // on `?gtaoview=ao` plates, so "the view flag moved a light, a material or the camera" would
    // make every number in that table a measurement of a different figure.
    //
    // Measured: `pipeline` alone, and only the `view:off -> view:ao` field of it. Nothing else.
    { query: 'gtaoview=ao', census: null, touches: [ 'pipeline' ] },

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
    { query: 'frame=body', census: null, touches: RIG_LIGHTS, rendererState: CAMERA_PLACEMENT },
    { query: 'height=0.3', census: null, touches: RIG_LIGHTS, rendererState: CAMERA_PLACEMENT },
    { query: 'pose=bind', census: null, touches: RIG_LIGHTS, rendererState: CAMERA_PLACEMENT },

    // 🎯 `?gender=1` MOVES THE CORNEA AS WELL, and nothing had ever recorded that. It loads a
    // different bake, and `EyeMaterial` fits the corneal axis and the iris plane to the mesh it is
    // given at construction — so the g100 cornea carries different fitted constants from the g050
    // one. Found by the fingerprint the day it learned to read uniform VALUES and not just graph
    // structure; the structural version reported this plate as five lights and nothing else.
    { query: 'gender=1', census: null, touches: [ ...RIG_LIGHTS, 'mesh:Humancornea' ],
        rendererState: CAMERA_PLACEMENT },

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
    //
    // And the camera's view offset, for the same reason `?aa=off` declares it: choosing MSAA
    // switches the temporal resolve off, and the jitter it was applying to the camera goes with it.
    rendererState: [ 'renderer._samples', 'renderer.get:samples', ...TEMPORAL_VIEW_OFFSET ]
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
    // 🚩 THIS ROW USED TO RECORD A DEAD ROUTE AS INTENDED BEHAVIOUR, and that is the worst thing
    // a gate file can contain. It read: "the page refuses to build a figure at all on the default
    // temporal path. Measured: the wait for a figure times out at 120 s, so no plate exists to
    // gate." Every word of that was an accurate description of what the page did. It was also a
    // written excuse for `?webgl` rendering NOTHING — untouched 300x150 canvas, no
    // `window.sugata`, no `__SUGATA_STEP__` — on the one flag a reviewer reaches for first, and
    // the excuse is why the defect survived a full round of review with a green gate above it.
    //
    // `?webgl` now DOWNGRADES `?aa` to `msaa` instead of returning early, and this row's claim is
    // no longer prose: the WEBGL2 TIER section below loads the plate and asserts it rendered, on
    // the same flags every capture uses. It stays in UNGATED rather than moving to TOGGLES because
    // it is still not a shading switch — it swaps the BACKEND, which moves the pipeline, the
    // sample count and the resolve together, so no entity allowlist describes it.
    webgl: { readHere: true, why:
        'swaps the backend to WebGL2, which has no velocity buffer, so `?aa` downgrades to msaa on ' +
        'this tier. Not a shading switch: a backend swap moves the pipeline, the sample count and ' +
        'the resolve at once, so no entity allowlist describes it. What is asserted instead is the ' +
        'claim the tier exists to support — it RENDERS — in the WEBGL2 TIER section of this file.' },

    // 🚩 REQ-060, AND IT IS IN THIS TABLE RATHER THAN IN TOGGLES BECAUSE THE GATE REFUSED THE
    // TOGGLES ROW AND WAS RIGHT TO. The row was written first — `{ query: 'sclera=1.65', census:
    // null, touches: [ 'mesh:Humanhigh-poly' ] }` — and this file returned
    //
    //     FAIL  ?sclera=1.65 changes exactly mesh:Humanhigh-poly
    //           DECLARED BUT UNCHANGED mesh:Humanhigh-poly — either the toggle stopped working,
    //           or this row is padded
    //
    // Both halves of that were then measured on the page rather than argued about, and the answer
    // is the second one. THE TOGGLE WORKS: on `?bare&freeze&seed=1&sclera=1.65`,
    // `sugata.session.eyes.scleraBrightnessUniform.value` reads **1.65** against **1.47** on the
    // same plate without the key, `session.scleraBrightness` reads 1.65 against null, and `sclera`
    // appears in `toggleSurface()` on both. THE INSTRUMENT IS BLIND: the globe's whole signature is
    // byte-identical across the pair, 1,393 characters both times.
    //
    // 🎯 AND THE CAUSE IS A HOLE IN INSTRUMENT 2 THAT IS NOT ABOUT THIS KEY AT ALL. `nodeSignature`
    // recurses into every own property whose value has `isNode === true`. A TSL `JoinNode` — what
    // `vec4( albedo, 1 )` compiles to — holds its inputs in an ARRAY, and an array is not a node, so
    // the walk stops there. Read off the shipped plate:
    //
    //     colorNode=VarNode(node:JoinNode)
    //
    // That is the ENTIRE recorded signature of the eye's colour graph. Everything under it — the
    // sclera brightness, the sclera chroma blend, the limbal ring darkness, the iris caustic scale,
    // the catchlight intensity, both texture samples — is unreachable, and `nodesWalked` still says
    // `within budget` because nothing was truncated: the walk simply had nowhere to go. This file's
    // own header says "the eye's `colorNode` is the deepest measured at 7"; at HEAD it terminates at
    // depth 1, and `NODE_SIGNATURE_MAX_DEPTH` is not what is stopping it.
    //
    // ⚠️ THE FIX IS ONE CLAUSE IN `nodeSignature` — recurse into arrays whose entries are nodes —
    // AND IT IS DELIBERATELY NOT TAKEN HERE. It deepens the signature of every material carrying a
    // `JoinNode`, which is most of them, so it is an instrument change that has to be landed
    // against a re-measured table rather than slipped in beside a url key. Filed rather than done.
    // Until it lands, a TOGGLES row for this key would go green off an equality between two
    // signatures that cannot see the thing being toggled — the `?gtaodefect` shape exactly, where
    // a row certifies the label instead of the defect.
    //
    // What DOES gate it today, and it is the gate that matters for what the key is for:
    // `tools/critic/measure.mjs`'s G2 on a `?sclera=` plate. G2 has four clauses over the sclera
    // against the cheek, three of them chromatic, and it is the reason the constant is a
    // two-dimensional solve rather than a dial.
    sclera: { readHere: true, why:
        'REQ-060. Overrides EyeMaterial\'s SCLERA_BRIGHTNESS per plate so the two-clause G2 solve ' +
        'can be swept without a rebuild. NOT ungated by choice — a TOGGLES row was written, this ' +
        'gate reported DECLARED BUT UNCHANGED, and the cause was measured: shadingFingerprint\'s ' +
        'node walk cannot enter a JoinNode\'s array, so the eye\'s whole colour graph reads as ' +
        '`colorNode=VarNode(node:JoinNode)` and no uniform under it is visible. See the block above ' +
        'for the proof that the toggle itself works. Its real gate is measure.mjs G2 on a ?sclera= ' +
        'plate; instrument 2 gets it back when nodeSignature learns to walk arrays.' },

    clockdefect: { readHere: false, why:
        'read only inside the `?capture` branch, and this file drives the free-running clock. ' +
        'alive-capture-determinism.selftest.mjs is what exercises it.' },

    // The `?clockdefect` shape exactly: a key that exists only to be shot at. It is read on every
    // plate — the session object consults it beside `?wear` — and it changes nothing at all unless
    // `?wear` is also present, which no plate in this file carries.
    wearrace: { readHere: true, why:
        'a rejection-proof hook for the wardrobe dressing race, inert without `?wear`. It moves ' +
        'ONE visibility flag during the wardrobe\'s async window and touches no shading state, so ' +
        'a TOGGLES row would have an empty allowlist and nothing to say. Its gate is the dressed ' +
        'recipe in alive-capture-determinism.selftest.mjs, which runs both defects.' },

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
    // allowlist. Its gate is `packages/core/src/wardrobe/wardrobe.selftest.mjs` (45 assertions),
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
        'only claim the shipped plate rests on: absent, it is inert.' },

    // --- R8's six new keys. Every one of them is the `?wear` shape rather than the `?skin=0`
    // shape: none changes how the SAME scene is shaded, so no entity allowlist describes any of
    // them, and each has its own gate elsewhere. What THIS file is entitled to assert about all
    // six is the claim the shipped plate rests on — absent, they are inert — and that is what the
    // default-plate digest below measures.

    foundation: { readHere: true, why:
        'PHASE 9.8. Wears the decency floor under whatever ?wear asked for, and implies the ' +
        'wardrobe. Not a shading switch: it adds geometry. Gated by ' +
        'packages/core/src/wardrobe/decency.selftest.mjs (25 assertions, 48 reachable states, ' +
        'coverage by ray cast). ⚠️ It also changes WHEN the body first draws — with a decencyFloor ' +
        'configured the Wardrobe hides the body until the first dress resolves — which is exactly ' +
        'why it must stay opt-in and why ?wear alone still takes the no-floor path.' },

    affect: { readHere: true, why:
        'PHASE 5. Adds affect/ExpressionLayer.js AND affect/PostureLayer.js to the motion stack and ' +
        'settles them. Not a shading switch: it writes MORPH WEIGHTS and BONE ROTATIONS, so it ' +
        'changes the pose of the same materials rather than the materials. Gated by ' +
        'packages/core/src/affect/affect.selftest.mjs (114 checks), which measures the two things ' +
        'that matter — that the face composes over the viseme rather than replacing it, viseme ' +
        'unchanged to 0.00e+0, and that the BAP prescription reaches a bone at all.' },

    // 🚩 THIS KEY EXISTS BECAUSE OF A MEASUREMENT, AND THE MEASUREMENT IS THE REASON IT IS READ
    // UNCONDITIONALLY. Before `PostureLayer` landed, eight `?affect=` plates differed on the face
    // and FIVE OF SEVEN had a torso band bit-identical to neutral, because `ExpressionMap.body()`
    // had no actuator. A claim that the body now emotes is only attributable against a plate with
    // the face on and the body off, and `?affect=anger&affectbody=0` is that plate. `alive.js`
    // reads the key in `readSession` rather than inside `attachAffect`, so it lands in the surface
    // this file records even on plates carrying no `?affect` at all — a toggle that only appears on
    // plates nobody captures is a toggle no gate can classify.
    affectbody: { readHere: true, why:
        'PHASE 5/6.2. The A side of ?affect: it withholds affect/PostureLayer.js while leaving the ' +
        'face layer in place. Not a shading switch — it changes the POSE — and on a plate with no ' +
        '?affect it has nothing to withhold, which is the claim asserted here: absent, inert. Its ' +
        'own gate is the POSTURE section of affect.selftest.mjs, where the body displacement of ' +
        'every preset is measured on the real mesh against neutral.' },

    identity: { readHere: true, why:
        'PHASE 10. Rewrites the body geometry\'s position buffer once at load. Not a shading ' +
        'switch: it changes the SHAPE the same materials are on. Gated by ' +
        'packages/core/src/figure/identitytargets.selftest.mjs (47 checks), which reproduces ' +
        'headless MPFB to 1.151e-4 mm on all 19,158 vertices — a claim no pixel gate can make.' },

    nudge: { readHere: true, why:
        'Offsets the figure laterally by a commanded number of millimetres. It exists for the 2AFC ' +
        'staircase that would retire this project\'s unmeasured 1.6 px indistinguishability floor ' +
        '(LEARNINGS §1.14a), so its whole point is to move the plate by a stated amount — which ' +
        'makes "changes nothing it should not" the wrong question. What is asserted here is that ' +
        'absent, it is inert.' },

    // 🚩 THESE TWO ARE DELIBERATE KNOWN-BADS AND A TOGGLES ROW WOULD BE THE WRONG SHAPE TWICE
    // OVER. They do not turn a subsystem off; they CORRUPT one, and the corruption is invisible on
    // a ?bare plate by construction — that is the property they exist to demonstrate. Their gates
    // are the light-state and surface fingerprints in LightingRig.selftest.mjs (140 checks) and
    // GroundContact.selftest.mjs (75), where each is proved red against a state closure rather
    // than against a pixel count. See packages/testbed/src/light-defects.js.
    statedefect: { readHere: true, why:
        'KNOWN-BAD, shared with lighting.html via ./light-defects.js. Plants one whole-state light ' +
        'defect on the real rig so LightingRig.selftest.mjs\'s rejection proofs are re-runnable on ' +
        'the page the seven objective gates are measured on. Absent, plantLightDefect returns null ' +
        'and touches nothing.' },

    grounddefect: { readHere: true, why:
        'KNOWN-BAD, the surface half of the above. Gated by GroundContact.selftest.mjs\'s ' +
        'renderState() closure. Absent, plantGroundDefect returns null and touches nothing.' },

    // 🚩 THE THIRD KNOWN-BAD, AND A TOGGLES ROW FOR IT WOULD CERTIFY THE LABEL RATHER THAN THE
    // DEFECT. It is the `?statedefect` shape one file over: it does not switch a subsystem off, it
    // CORRUPTS one — the horizon search runs on normals put through `n*0.5+0.5`, confined to the
    // positive octant, and the plate looks entirely plausible.
    //
    // The wrong-shape argument is a measurement rather than a preference. Loading
    // `?gtaodefect=packed` moves exactly ONE thing in this file's instruments: the `pipeline` row's
    // `defect:none -> defect:packed`, which is `createGroundTruthOcclusion`'s `describe()`
    // REPEATING THE FLAG BACK. The uniform the defect actually rides on — `packedNormalDefect`, 0
    // -> 1 — is inside the occlusion node, which nothing here walks. So a row asserting "it changes
    // exactly the pipeline" would go green off the effect's own announcement of its name, and would
    // stay green if the defect stopped being planted. That is the shape of gate this file exists
    // because of.
    gtaodefect: { readHere: true, why:
        'PUNCH-LIST 3.10. KNOWN-BAD, the same shape as ?statedefect and ?grounddefect: it corrupts ' +
        'the occlusion rather than removing it, and the only thing this file can see of it is ' +
        'describe() echoing the flag\'s NAME back into the pipeline row — a TOGGLES row would ' +
        'certify the label, not the defect. Gated by GTAO.selftest.mjs, whose rejection proof ' +
        'measures the packed-normal search against the reference one. Absent, defect is \'none\' ' +
        'and packedNormalDefect stays 0.' },

    // --- PUNCH-LIST 3.5/3.6, THE GROOM. `?hair` is the `?wear` shape and the other seven are its
    // sub-keys, read only on a plate that already asked for a groom.
    //
    // 🚩 THE GATE FOUND `?hair` BY ITSELF, exactly as it found `?wear`. Measured at the start of
    // this round, before a line of it was written: `FAIL: 190/191 checks green`, and the one red
    // was `UNCLASSIFIED: hair`. Nobody had to remember that a key had been added.
    //
    // ⚠️ AND A TOGGLES ROW WOULD BE THE WRONG SHAPE, FOR THE `?wear` REASON VERBATIM. Every key in
    // that table changes how the SAME scene is shaded; `?hair` changes WHAT IS IN the scene — it
    // adds a several-hundred-card `SkinnedMesh` rebound to the figure's own skeleton, a shadow-casting mesh,
    // the strand sheets it samples and, on the `wboit` arm, two G-buffer attachments and a resolve
    // pass. "Changes exactly these entities and no others" has no honest allowlist for that: the
    // entity SET grows.
    // The declared-and-unchanged half of the row could not be satisfied either, because the new
    // entities have no baseline signature to differ from.
    //
    // What this file IS entitled to say about it is the claim the shipped plate rests on — absent,
    // it is inert — and that is asserted below rather than left as prose, on every plate this run
    // loads, with one `?hair=1` plate to prove the nulls mean inert and not absent.
    hair: { readHere: true, why:
        'PUNCH-LIST 3.5/3.6. Not a shading switch: it changes what is IN the scene (a several-hundred-card ' +
        'groom rebound to the figure\'s skeleton, a shadow-casting mesh, the strand sheets, and on ' +
        'the wboit arm two more G-buffer attachments), so no entity allowlist describes it — the ' +
        'entity set itself grows. Gated by packages/core/src/material/HairMaterial.selftest.mjs ' +
        'for the BSDF, packages/core/src/render/HairOIT.selftest.mjs for the transparency arm, and ' +
        'tools/figure-pipeline/hair_geometry.selftest.mjs for the groom. What is checked HERE is ' +
        'the only claim the shipped plate rests on: absent, it is inert.' },

    // The seven sub-keys. `alive.js` consults every one of them inside `readHairRequest`, which is
    // called ONLY when `?hair=1` is present — so on the ninety-odd plates this file loads without
    // it, none of them is read at all. They are `readHere: true` rather than held out because ONE
    // plate in this run does carry `?hair=1`, which is what makes them observable from here.
    //
    // None is a TOGGLES row and the reason is the same for all seven: they can only change a plate
    // that CONTAINS a groom, and the baseline this file diffs against has none. A row would be
    // comparing a hair plate to a bald one and calling the whole groom collateral.
    hairoit: { readHere: true, why:
        'PUNCH-LIST 3.6. Which of blend/cutout/hash/wboit the groom\'s fragments reach the frame ' +
        'buffer through; default HAIR_OIT_DEFAULT_MODE. Inert without ?hair, and its own gate is ' +
        'HairOIT.selftest.mjs, which measures order dependence directly by reversing the groom\'s ' +
        'triangle order — a rejection proof no entity allowlist can express.' },
    hairbsdf: { readHere: true, why:
        'PUNCH-LIST 3.5. The A side of the Karis BSDF, holding the geometry constant: the groom ' +
        'keeps its shipped GLB material. Inert without ?hair. Gated by HairMaterial.selftest.mjs.' },
    hairlobes: { readHere: true, why:
        'PUNCH-LIST 3.5. Which of R, TT and TRT are live, so the dual band can be measured as two ' +
        'plates rather than inferred from their sum. Inert without ?hair.' },
    hairscatter: { readHere: true, why:
        'PUNCH-LIST 3.5. Scales slide 39\'s multiple-scattering term; 0 removes it. Inert ' +
        'without ?hair.' },

    // 🎯 ROUND 26'S TWO NEW SUB-KEYS, AND THEY ARE THE `?hairscatter` SHAPE RATHER THAN A TOGGLES
    // ROW'S. All three are the BSDF's contrast budget — the three numbers that set how far the
    // primary lobe's bright end sits above the mass mean, which R26 measured at a ratio of 1.00 —
    // and none of them appears on the judged URL. They are inert without ?hair for the seven
    // sub-keys' reason verbatim, and their values reach a plate's manifest through
    // `material.describe()`, so a swept plate states its own arm.
    hairbeta: { readHere: true, why:
        'PUNCH-LIST 3.5, round 26. The R lobe\'s longitudinal width, HAIR_DEFAULTS.roughnessR, in ' +
        'KARIS\' variable — beta_K = 2 beta_Marschner, so Table 1\'s 5-10 degrees is 0.174533 to ' +
        '0.349066 here. beta_TT and beta_TRT follow by Marschner\'s ratios, so it is one free ' +
        'parameter. Inert without ?hair; gated by HairMaterial.selftest.mjs.' },
    hairweightr: { readHere: true, why:
        'PUNCH-LIST 3.5, round 26. Scales the R lobe, composing with ?hairlobes rather than ' +
        'replacing it. Inert without ?hair.' },
    hairvis: { readHere: true, why:
        'PUNCH-LIST 3.5. Removes the card-scale side visibility — the plate that made the term ' +
        'necessary, where the rim transmits through the head and the groom renders blue. Inert ' +
        'without ?hair.' },
    hairrootao: { readHere: true, why:
        'PUNCH-LIST 3.5. Removes the root darkening. Inert without ?hair.' },
    hairdefect: { readHere: true, why:
        'KNOWN-BAD, the ?statedefect shape: a fixed view-space strand direction welds the ' +
        'highlight to the screen and renders a plausible picture. It corrupts the anisotropy ' +
        'rather than removing it, so a TOGGLES row would certify the label. Inert without ?hair; ' +
        'gated by HairMaterial.selftest.mjs.' },

    // 🚩 THE EIGHTH SUB-KEY, AND IT IS THE `?gputime` SHAPE RATHER THAN THE OTHER SEVEN'S. Punch-
    // list 6.6's DFTL solver ships ON with `?hair=1`, and `?hairmotion=0` is its rigid control.
    //
    // A TOGGLES row would be wrong twice over and both halves are measured rather than argued.
    // First, the baseline this file diffs against has no groom, so a row would be comparing a hair
    // plate to a bald one and calling the whole groom collateral — the seven sub-keys' reason
    // verbatim. Second, and this is the `?gputime` half: the solver's output is a
    // `positionNode`, so on a plate where the head is not moving the flag moves NOTHING an
    // entity fingerprint can see except the node graph of one material, and its whole design goal
    // is that it moves no PIXELS either (`HairDynamics.selftest.mjs` clause E: 0.000132 mm from the
    // rigid pose with the head still). A row asserting "it changes exactly the hair mesh" would be
    // green whether the solver ran or was deleted.
    //
    // So it gets the `?webgl`/`?gputime` treatment: the claim the key exists to support is
    // ASSERTED, in the HAIR MOTION block below, on the page a judge captures — the solver is on the
    // plate, it is being stepped, and `?hairmotion=0` takes it away.
    hairmotion: { readHere: true, why:
        'PUNCH-LIST 6.6. The A side of the hair dynamics, which ship ON with ?hair=1: it decides ' +
        'whether the groom is a DFTL-simulated set of card centrelines or a rigid SkinnedMesh ' +
        'welded to the head. Not a shading switch — it moves vertices, through ' +
        'material.positionNode — and on a still plate it is designed to move almost no pixels, so ' +
        'an entity allowlist would be green whether the solver ran or was deleted. Gated by ' +
        'packages/core/src/motion/HairDynamics.selftest.mjs, whose ALIVE section drives this page. ' +
        'What is asserted HERE is that the wiring is present and being stepped on the plate ?hair=1 ' +
        'produces, and that ?hairmotion=0 removes it.' },

    // 🚩 THE NINTH SUB-KEY, AND IT IS `?morphvel`'S SHAPE ONE SUBSYSTEM OVER. Punch-list 3.22.
    //
    // `?hairvel=off` is three r185 unpatched for the solver path: `material.positionNode` overwrites
    // `positionLocal` and nothing assigns `positionPrevious`, so the groom reports its whole
    // displacement from the skinned rest pose as this frame's motion. It cannot be a TOGGLES row for
    // the seven sub-keys' reason — no groom in the baseline — and it could not be one anyway, for
    // `?morphvel`'s: the key writes into the G-buffer's `velocity` attachment, which no entity
    // fingerprint reads and which is not in the picture at all until a temporal resolve reprojects
    // through it. On a still plate it moves 6,272 px of 1,080,000 by at most 5 code values.
    hairvel: { readHere: true, why:
        'PUNCH-LIST 3.22. Whether the groom assigns positionPrevious to the position the DFTL ' +
        'solver just wrote (hold, shipped) or leaves three\'s default in place (off), which reports ' +
        'the displacement from the skinned rest pose as a per-frame velocity — measured at p90 ' +
        '259.9 px/frame against TAAUNode.maxVelocityLength 128. Not a shading switch: it writes the ' +
        'G-buffer velocity attachment, which is not in the picture until the temporal resolve ' +
        'reprojects through it, so an entity allowlist would be green either way. Inert without ' +
        '?hair. Gated by packages/core/src/render/HairVelocity.selftest.mjs, which reads the ' +
        'attachment back rather than the frame.' },

    // 🚩 AN INSTRUMENT, NOT A SWITCH, AND THE ONE KEY ON THIS PAGE THAT INSTRUMENT 5 CANNOT SEE AT
    // ALL. `?gputime=1` asks the ADAPTER for the `timestamp-query` feature at device creation. That
    // request lands on `renderer.backend.trackTimestamp` — measured false -> true — and `backend`
    // holds objects, so the walk records it as `object:WebGPUBackend` and descends no further, by
    // the configuration-bag rule that keeps a per-frame counter inside `info` from making the
    // instrument drift. `renderer.trackTimestamp` is not a property of the renderer at all.
    //
    // So every instrument in this file reports the flag as an EMPTY diff — measured: no entity, no
    // frame-subject property, no census entry moves — and a TOGGLES row would be a row whose green
    // is indistinguishable from the key having been deleted. That is exactly the trap the `?webgl`
    // row used to be, so it gets the `?webgl` treatment: the claim the key exists to support is
    // ASSERTED, in the GPU TIMESTAMP section below, on the page a timing is actually taken from.
    gputime: { readHere: true, why:
        'requests the timestamp-query device feature at adapter creation. Not a shading switch: it ' +
        'changes no entity, no frame-subject property and no census entry — measured, all three ' +
        'diffs empty — because the flag lands on renderer.backend.trackTimestamp, inside a ' +
        'machinery object the walk records by constructor name. A TOGGLES row would therefore be ' +
        'green whether the key worked or was deleted. What is asserted instead is the claim the ' +
        'key exists to support — the timestamp RESOLVES with it and does not without it — in the ' +
        'GPU TIMESTAMP section of this file.' }
};

/**
 * THE SUBJECTS INSTRUMENT 5 WALKS, and they are the argument list of the draw call rather than a
 * choice: `renderer.render( scene, camera )`. Version three of this file walked the first two, and
 * a confound on the third passed 147/147.
 */
const WALKED_SUBJECTS = [ 'renderer', 'scene', 'camera' ];

/**
 * The other object-valued members of the `Stage`, each with the reason it is not walked and what
 * does cover it. This is the closure half of instrument 5's subject list, and it exists because
 * three consecutive versions of this file were defeated by the same move: closing a surface and
 * leaving the container of that surface enumerated.
 *
 * A `Stage` that grows a member absent from both tables turns the gate red. Retiring one costs a
 * written excuse, exactly as in `UNGATED`.
 *
 * ⚠️ AND ONE OF THESE REASONS IS AN ADMISSION RATHER THAN A CLOSURE, which is why the check below
 * prints it every run instead of leaving it in a comment. The seven post-stack members are
 * identity-checked here and their STATE is covered by `shadingFingerprint`'s `pipeline` row — which
 * is nineteen hand-picked fields, i.e. the very shape this instrument exists because of. A confound
 * planted inside the `Grade` on a field that row does not carry would be caught by neither. That is
 * a known open hole in the post stack, not a claim that the post stack is closed.
 */
const UNWALKED_SUBJECTS = {
    canvas: 'the HTMLCanvasElement. Its only render-bearing state is its pixel size, and that IS ' +
        'walked, as renderer.canvasPixels. Walking a DOM node would drag in the element prototype.',

    // 🎯 THE EIGHTH POST-STACK MEMBER, AND THE ONLY ONE WHOSE STATE IS NOT PART OF THE HOLE. It is
    // deliberately NOT written as `POST STACK — …` like the seven below, because the sentence those
    // seven share would be false of it: the pipeline row does not carry a hand-picked field or two
    // of the occlusion, it carries `createGroundTruthOcclusion().describe()` WHOLE, thirteen fields
    // serialised key:value — which is how all eight of 3.10's sub-flags (`?gtaoq`, `?bentnormal`,
    // `?specocc`, `?ambspec`, `?gtaoradius`, `?gtaostrength`, `?gtaoview`, `?gtaodefect`) have any
    // foothold in the fingerprint at all.
    //
    // `describe()` is still a list, and a list is not a closure — so the closure is checked rather
    // than assumed, exactly as `GRADE_UNIFORMS` does for the Grade: `OCCLUSION_UNIFORMS` below
    // holds the occlusion node to the exact set of live-mutable uniforms it is known to carry, and
    // says of each one whether `describe()` reaches it. Four of the eight it does not, and the run
    // prints that rather than implying closure.
    ambientOcclusion: 'PUNCH-LIST 3.10 — identity only, and the identity is load-bearing: ' +
        '`?gtao=0` shows up here as `stage.ambientOcclusion` disappearing. Its STATE reaches the ' +
        'fingerprint whole, as the pipeline row\'s `ambientOcclusion=` field (describe(), 13 ' +
        'key:value pairs), and the uniforms describe() does not reach are enumerated in ' +
        'OCCLUSION_UNIFORMS.',

    renderPipeline: 'POST STACK — identity only; state via the fingerprint pipeline row (19 fields)',
    scenePass: 'POST STACK — identity only; state via the fingerprint pipeline row (19 fields)',
    gbuffer: 'POST STACK — identity only; state via the fingerprint pipeline row (19 fields)',
    temporal: 'POST STACK — identity only; state via the fingerprint pipeline row (19 fields)',
    grade: 'POST STACK — identity only; state via the fingerprint pipeline row (19 fields)',
    velocityGain: 'POST STACK — identity only; state via the fingerprint pipeline row (19 fields)',
    depthGain: 'POST STACK — identity only; state via the fingerprint pipeline row (19 fields)',

    frameCallbacks: 'an array of bound per-frame functions. It carries no shading configuration; ' +
        'anything a callback CHANGED would show up on the subject it changed.',
    resizeObserver: 'a browser ResizeObserver. No render state of its own.',
    pixelRatioWatcher: 'a MediaQueryList. No render state of its own.'
};

/** How many of `UNWALKED_SUBJECTS` are the post stack, so the open-hole line can count itself. */
const POST_STACK_SUBJECTS = Object.entries( UNWALKED_SUBJECTS )
    .filter( ( [ , why ] ) => why.startsWith( 'POST STACK' ) ).map( ( [ name ] ) => name );

/**
 * 🎯 THE ONE HALF OF THE POST-STACK HOLE THAT CAN BE CLOSED FROM HERE, and it is worth reading as a
 * worked example of what "identity-checked, not walked" is actually worth.
 *
 * Measured at this commit rather than assumed: `Grade` owns EIGHT live-mutable uniforms, and seven
 * of them are carried by `shadingFingerprint`'s `pipeline` row, which unwraps a TSL uniform to its
 * `.value` — see `rounded` in alive.js, and the round where not unwrapping made six attribution
 * knobs measure as an empty diff. So there is no post-boot confound to plant on the `Grade` today:
 * `toneCurve` is the one field the row does not carry, and patching it after boot is INERT because
 * it is consumed when the node graph is built. `grainFrame` is the eighth uniform and is written
 * every frame, so nothing set on it survives either.
 *
 * That is a coincidence, not a guarantee, and it is exactly the shape of LEARNINGS §1.25i — an
 * instrument defeated by a feature that shipped after it. So the coincidence is gated: the set of
 * uniforms the `Grade` owns must be exactly this set. Add one to `Grade.js` and this file goes red
 * on the next run, which is the prompt to carry it in the pipeline row before anyone attributes
 * anything to it.
 */
const GRADE_UNIFORMS = {
    exposure: 'pipeline row: exposure=',
    bloomStrength: 'pipeline row: bloom= (first of three)',
    bloomThreshold: 'pipeline row: bloom= (second of three)',
    bloomRadius: 'pipeline row: bloom= (third of three)',
    grainSigmaCodes: 'pipeline row: grain=',
    vignette: 'pipeline row: vignette=',
    saturation: 'pipeline row: saturation=',

    grainFrame: 'NOT in the pipeline row, and it cannot be: it is driven per frame by onFrameUpdate, ' +
        'so nothing a toggle sets on it survives to the next frame. Grade.selftest.mjs owns the grain.'
};

/**
 * 🎯 THE SAME QUESTION FOR PUNCH-LIST 3.10'S OCCLUSION NODE, AND IT DOES NOT COME OUT AS TIDY.
 *
 * `stage.ambientOcclusion` is identity-checked and not walked, so what the fingerprint knows about
 * it is whatever `describe()` chooses to report. Measured at this commit rather than assumed: the
 * node owns EIGHT live-mutable numeric uniforms, and `describe()` reaches FOUR of them —
 *
 *   radius              -> `radius:`,   moved by `?gtaoradius`
 *   samples             -> `samples:`,  moved by `?gtaoq`
 *   scale               -> `strength:`, moved by `?gtaostrength`
 *   packedNormalDefect  -> `defect:`,   set by `?gtaodefect`
 *
 * — and the other four it does not. Those four are the search's shape constants. No url key sets
 * any of them, which is why nothing has gone wrong yet and is NOT why they are safe: a confound
 * planted on `thickness` after boot would change every crease in the frame and no instrument in
 * this file would report a thing. That is a KNOWN OPEN HOLE of exactly the post-stack kind, it is
 * printed on every run, and the check below is the half of it that can be closed from here: the day
 * `GTAO.js` grows a ninth uniform, or a url key starts driving one of the four, this file goes red
 * and the prompt is to carry it in `describe()` before attributing anything to it.
 */
const OCCLUSION_UNIFORMS = {
    radius: 'describe(): radius — ?gtaoradius',
    samples: 'describe(): samples — ?gtaoq',
    scale: 'describe(): strength — ?gtaostrength',
    packedNormalDefect: 'describe(): defect — ?gtaodefect',

    thickness: 'NOT REACHED by describe(). How far behind a sample the search still calls it the ' +
        'same surface; no url key drives it.',
    distanceFallOff: 'NOT REACHED by describe(). Distance weighting of the march; no url key drives it.',
    distanceExponent: 'NOT REACHED by describe(). Step spacing of the march; no url key drives it.',
    _temporalDirection: 'NOT REACHED by describe(). The node\'s temporal jitter phase, and ' +
        '`useTemporalFiltering` is false on this page, so nothing writes it.'
};

/** The uniforms `describe()` does NOT reach, so the open-hole line can count itself. */
const UNCARRIED_OCCLUSION_UNIFORMS = Object.entries( OCCLUSION_UNIFORMS )
    .filter( ( [ , why ] ) => why.startsWith( 'NOT REACHED' ) ).map( ( [ name ] ) => name );

/**
 * Property paths the walk records as EXCLUDED rather than by value, checked below to be live: an
 * exclusion for a property that no longer exists is a line nobody will delete on their own.
 *
 * `uuid` is excluded by suffix on every subject and is not listed here — there is no fixed set of
 * subjects to enumerate it over, so the check asserts that at least one `excluded:*.uuid` marker
 * came back instead.
 */
const PER_FRAME_EXCLUSIONS = [ 'camera.view.offsetX', 'camera.view.offsetY' ];

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
/*
 * `?gtao=0` IS IN THE SWEEP, and it belongs there by this list's own definition rather than by
 * analogy: it takes the composite out of the frame AND puts a `HemisphereLight` back into the
 * scene, so it adds and removes scene content in the same move. `PIXEL_BASE` does not pin it —
 * `pipeline:` is still true at `aa=msaa&grade=0` because the occlusion asks for it — so unlike the
 * grade and resolve rows it is a live off-switch on the forward path. Measured before it was added:
 * reproducible over two loads, different from the base plate, and all seven pairs different in both
 * directions.
 */
const PIXEL_SWEEP = [ 'skin=0', 'eyes=0', 'eyeocc=0', 'cards=0', 'shadows=0', 'cavity=0', 'specaa=0', 'gtao=0' ];

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
 * ## The subjects are the draw call's arguments, and that is the point
 *
 * `renderer.render( scene, camera )`. Three previous versions of this instrument each closed the
 * surface they had just been burned on and left the CONTAINER of that surface enumerated — nine
 * counters inside a scene nobody was reading whole; nineteen pipeline fields inside a renderer
 * nobody was reading whole; and then the renderer and the scene, read whole, inside a subject list
 * of two. A `?cards=0` confound on `camera.filmOffset` passed 147/147 against the third.
 *
 * So the subject list is derived from what actually produces the frame rather than chosen, and the
 * `stage.*` rows at the bottom close it: every object-valued member of the `Stage` is recorded by
 * identity, and the gate requires each one to be walked or excused in `UNWALKED_SUBJECTS`.
 *
 * ## What it reads, and the deliberate limits
 *
 * - **Own properties**, including the underscore-prefixed ones. `_samples` is where the MSAA count
 *   actually lives and its public accessor is a second reading of the same thing; both are kept,
 *   because deny-by-default is cheaper than deciding which of two spellings is canonical.
 * - **Prototype accessors**, read through a try/catch. A getter that throws is recorded as
 *   `threw` rather than skipped, so a property that STARTS throwing is a change.
 * - **Three's math values BY VALUE.** A `Vector3`, `Euler`, `Quaternion` or `Matrix4` states itself
 *   as a flat numeric array through `toArray`, so that is what gets recorded. Identified by the
 *   method rather than by a list of class names, because a list of class names is the mistake this
 *   file keeps being defeated by. Recording them as `object:Vector3` is how a 20 mm camera dolly
 *   stayed invisible — `--confound=cameraTransform`.
 * - **One level into CONFIGURATION BAGS** — a member carrying nothing but scalars. That is what
 *   reaches `shadowMap.enabled`, `debug.checkShaderErrors`, `camera.view.fullWidth` and
 *   `camera.layers.mask`, and what keeps `backend`, `info`, `_nodes` and the other machinery
 *   instances out: they all hold objects, so they are recorded by constructor name only and a
 *   per-frame counter inside `info` cannot make the instrument drift. This replaces the older
 *   `constructor === Object` test, which was a narrower spelling of the same idea that could not
 *   see into `Layers`.
 * - **`undefined` values are dropped, not recorded.** Measured: `scene.backgroundNode` is an own
 *   property holding `undefined` on some plates and absent on others, reproducibly, and the two
 *   states are the same state. Recording it made `?shadows=0` carry a difference that means
 *   nothing.
 * - **Numbers are rounded to 1e-6**, and the cost is stated rather than hidden: a confound smaller
 *   than a micron of camera travel or a millionth of a stop of exposure is invisible here. What it
 *   buys is that `lookAt` re-deriving the same 12° yaw to within a few ULP does not read as the
 *   camera having rotated, which would have made four honest toggles carry two spurious properties
 *   each and taught the next reader to widen allowlists.
 * - **Exclusions are RECORDED, not skipped.** An excluded path comes back as
 *   `excluded:<path>` holding its reason, so the marker moves when the property stops existing and
 *   the gate can check that no exclusion has gone stale. Two kinds exist, and both say why at the
 *   point of exclusion: `uuid` on any subject, and the temporal resolve's per-frame jitter offsets.
 *
 * @returns {Object<string,string>} property path -> value. Compared for equality, never parsed.
 */
function frameSubjectState() {

    const stage = globalThis.sugata.stage;
    const subjects = { renderer: stage.renderer, scene: stage.scene, camera: stage.camera };
    const state = {};

    const excludedReason = ( propertyPath ) => {

        // three mints a fresh uuid per instance, so it differs on every load and would report the
        // whole instrument as noise. Same reason `textureIdentity` in alive.js refuses to use it.
        if ( propertyPath.endsWith( '.uuid' ) ) return 'a fresh uuid is minted per instance, every load';

        // TAAU calls `camera.setViewOffset` before each frame and `camera.clearViewOffset` after it,
        // which disables the offset and leaves the last Halton sample sitting in these two fields.
        // Measured over two loads of ?bare&freeze&seed=1: offsetX -0.125 / 0.375, offsetY -0.2778 /
        // 0.0556, and they are the ONLY two of the 183 properties that move. They record which
        // frame the screenshot landed on, and nothing a toggle could set survives in them, because
        // the next frame overwrites both.
        if ( propertyPath === 'camera.view.offsetX' || propertyPath === 'camera.view.offsetY' ) {

            return 'the temporal resolve rewrites it every frame; it records the frame, not the configuration';

        }

        return null;

    };

    const roundedNumber = ( value ) => {

        if ( Number.isFinite( value ) === false ) return String( value );

        // `Number` on the fixed form rather than the fixed form itself, so 100 stays "100" and the
        // -2.8e-17 that `lookAt` leaves in a matrix collapses onto the 0 in the other plate's.
        return String( Number( value.toFixed( 6 ) ) );

    };

    const describe = ( value ) => {

        if ( value === null ) return 'null';
        if ( typeof value === 'number' ) return roundedNumber( value );
        if ( typeof value === 'boolean' || typeof value === 'string' ) return String( value );
        if ( typeof value === 'function' ) return null;
        if ( Array.isArray( value ) ) return `array(${ value.length })`;
        if ( typeof value !== 'object' ) return String( value );

        if ( value.isColor === true ) return `color:${ value.getHexString() }`;

        if ( typeof value.toArray === 'function' ) {

            try {

                const numbers = value.toArray();

                if ( Array.isArray( numbers ) ) {

                    const described = numbers
                        .map( ( entry ) => typeof entry === 'number' ? roundedNumber( entry ) : String( entry ) );

                    return `${ value.constructor?.name ?? '?' }(${ described.join( ',' ) })`;

                }

            } catch {

                // not a value object after all — fall through to the type name
            }

        }

        return `object:${ value.constructor?.name ?? '?' }`;

    };

    /** A member carrying nothing but scalars is configuration; anything holding an object is machinery. */
    const isConfigurationBag = ( value ) => {

        if ( value === null || typeof value !== 'object' || Array.isArray( value ) ) return false;
        if ( typeof value.toArray === 'function' ) return false;

        for ( const key of Object.keys( value ) ) {

            const inner = value[ key ];
            if ( inner !== null && typeof inner === 'object' ) return false;

        }

        return true;

    };

    const record = ( propertyPath, value ) => {

        if ( value === undefined ) return;

        const reason = excludedReason( propertyPath );

        if ( reason !== null ) {

            state[ `excluded:${ propertyPath }` ] = reason;
            return;

        }

        const described = describe( value );

        if ( described !== null ) state[ propertyPath ] = described;

    };

    for ( const [ label, subject ] of Object.entries( subjects ) ) {

        const seen = new Set();

        for ( const key of Object.keys( subject ).sort() ) {

            seen.add( key );

            const propertyPath = `${ label }.${ key }`;
            let value;

            try {

                value = subject[ key ];

            } catch {

                state[ propertyPath ] = 'threw';
                continue;

            }

            record( propertyPath, value );

            let bag = false;

            try {

                bag = isConfigurationBag( value );

            } catch {

                bag = false;

            }

            if ( bag === false ) continue;

            for ( const inner of Object.keys( value ).sort() ) {

                try {

                    record( `${ propertyPath }.${ inner }`, value[ inner ] );

                } catch {

                    state[ `${ propertyPath }.${ inner }` ] = 'threw';

                }

            }

        }

        let prototype = Object.getPrototypeOf( subject );

        while ( prototype !== null && prototype !== Object.prototype ) {

            for ( const key of Object.getOwnPropertyNames( prototype ).sort() ) {

                if ( seen.has( key ) ) continue;

                const descriptor = Object.getOwnPropertyDescriptor( prototype, key );

                if ( descriptor === undefined || typeof descriptor.get !== 'function' ) continue;

                seen.add( key );

                try {

                    record( `${ label }.get:${ key }`, subject[ key ] );

                } catch {

                    state[ `${ label }.get:${ key }` ] = 'threw';

                }

            }

            prototype = Object.getPrototypeOf( prototype );

        }

    }

    // Not a property of any subject, and the one piece of render state that lives on the canvas:
    // `?scale` is applied with `setSize`, so this is where a resolution confound would show.
    const canvas = stage.renderer.domElement;

    state[ 'renderer.canvasPixels' ] = `${ canvas.width }x${ canvas.height }`;

    // THE SUBJECT LIST, CLOSED. Every object-valued member of the Stage, by identity. Two jobs: the
    // gate checks this inventory against WALKED_SUBJECTS + UNWALKED_SUBJECTS, so a new member is a
    // red gate rather than a silent hole; and an identity is itself a weak state check — `?grade=0`
    // shows up here as `stage.grade` disappearing, which is how the post stack gets any coverage at
    // all from an instrument that does not walk it.
    for ( const key of Object.keys( stage ).sort() ) {

        const member = stage[ key ];

        if ( member === null || typeof member !== 'object' ) continue;

        state[ `stage.${ key }` ] = `object:${ member.constructor?.name ?? '?' }`;

    }

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

/**
 * One page load. Returns everything the page can say about itself, plus the rendered bytes.
 *
 * `alsoReady` is an extra readiness predicate, shipped into the page and polled there, so it reads
 * `globalThis.sugata` itself and takes no arguments. The default wait is for the figure, and
 * everything that lands after it — the wardrobe, the groom — arrives inside the 1500 ms below on a
 * warm cache and not always on a cold one. A plate read early is a plate of a page that has not
 * finished, and a flaky check is worse than no check.
 */
async function loadPlate( page, baseUrl, query, alsoReady = null ) {

    await page.goto( `${ baseUrl }/alive.html?${ query }`, { waitUntil: 'load' } );
    await page.waitForFunction( () => globalThis.sugata?.session?.figure != null, null, { timeout: 120_000 } );

    if ( alsoReady !== null ) {

        await page.waitForFunction( alsoReady, null, { timeout: 120_000 } );

    }

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
            : globalThis.sugata.wardrobe.stats().worn,

        // The page's OWN copy of the walk. Not used for any verdict — a confound is a patch to
        // `alive.js`, so an instrument that lives there could be patched with it — but its key set
        // is checked against this file's walk on the baseline, which is what stops the two copies
        // drifting apart and a doc quoting a property count that stopped being true.
        pageRenderState: Object.keys( globalThis.sugata.renderState() ).sort(),

        // Every live-mutable uniform the Grade owns. The Grade is one of the post-stack members
        // instrument 5 does NOT walk, so this is how the gate notices it growing a knob that
        // nothing carries — see GRADE_UNIFORMS.
        gradeUniforms: globalThis.sugata.stage.grade == null ? null : Object.keys( globalThis.sugata.stage.grade )
            .filter( ( key ) => {

                const member = globalThis.sugata.stage.grade[ key ];
                return member !== null && typeof member === 'object' && typeof member.value === 'number';

            } ).sort(),

        // The same question for 3.10's occlusion node, which is the other Stage member instrument 5
        // identity-checks rather than walks — see OCCLUSION_UNIFORMS. Read off `.occlusion`, the
        // node itself, rather than off the effect wrapper: the wrapper's own fields are the
        // constructor arguments and describe() reports every one of them.
        occlusionUniforms: globalThis.sugata.stage.ambientOcclusion == null ? null
            : Object.keys( globalThis.sugata.stage.ambientOcclusion.occlusion ).filter( ( key ) => {

                const member = globalThis.sugata.stage.ambientOcclusion.occlusion[ key ];
                return member !== null && typeof member === 'object' && typeof member.value === 'number';

            } ).sort()
    } ) );

    // Instrument 5. A second evaluate rather than a fifth field above, because this function is
    // defined in THIS file and shipped into the page — see `frameSubjectState` for why that
    // is deliberate rather than awkward.
    state.rendererState = await page.evaluate( frameSubjectState );

    // Punch-list 3.5/3.6's inertness claim, read off the census rather than fetched separately —
    // `censusOfShading` already reports the groom as a SHAPE, null when the plate has none, and a
    // second reading would be a second chance for the two to disagree.
    state.hair = state.census.hair;

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

// The same bookkeeping for punch-list 3.5/3.6's groom, and for the same reason: `?hair` is opt-in
// so that the plate the seven gates are stated on is a plate with no groom in it, and one plate is
// a sample of that claim rather than the claim.
const plateGrooms = new Map();

try {

    console.log( '--- are the instruments usable at all? -------------------------------------\n' );

    const baseline = await loadPlate( page, server.baseUrl, BASE_QUERY );
    const baselineAgain = await loadPlate( page, server.baseUrl, BASE_QUERY );

    for ( const key of [ ...baseline.surface, ...baselineAgain.surface ] ) observedSurface.add( key );

    plateWardrobes.set( 'baseline', baseline.wardrobe );
    plateWardrobes.set( 'baseline (second load)', baselineAgain.wardrobe );
    plateGrooms.set( 'baseline', baseline.hair );
    plateGrooms.set( 'baseline (second load)', baselineAgain.hair );

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

    // The same question for instrument 5. It walks three live three.js objects, so "does it hold
    // still" is not a formality — a single per-frame counter caught by the walk would report every
    // toggle as collateral, and the walk is deliberately wide enough that one could be. It found
    // two, and they are excluded by path with the mechanism written at the exclusion.
    const stateDrift = changedEntities( baseline.rendererState, baselineAgain.rendererState );

    report(
        'the frame-subject walk is the same on two loads of the same url',
        stateDrift.length === 0,
        stateDrift.length === 0
            ? `${ Object.keys( baseline.rendererState ).length } properties across the renderer, the scene ` +
                'and the camera, all reproducible — so a property that moves below moved because a toggle moved it'
            : `DRIFTING: ${ stateDrift.map( ( key ) => `${ key } ${ baseline.rendererState[ key ] } / ` +
                `${ baselineAgain.rendererState[ key ] }` ).join( ', ' ) } — instrument 5 cannot separate a ` +
                'toggle from noise. Either exclude the property with a written reason, or fix what is drifting.'
    );

    // A walk that found almost nothing would pass every check below for free, the same way a
    // census of zeros would. 184 is what the shipped page measures; the floor is set under it so a
    // three.js upgrade that renames a few fields does not fail this, while a walk that collapsed to
    // a handful of properties does — and so does a walk that quietly loses a whole SUBJECT, which
    // is the defect this round, because 150 is above what the renderer and the scene reach alone.
    const reachProbes = {
        'renderer.toneMappingExposure': 'a renderer scalar',
        'renderer.shadowMap.enabled': 'a nested configuration bag',
        'scene.backgroundIntensity': 'the scene rather than the renderer',
        'camera.filmOffset': 'THE THIRD SUBJECT',
        'camera.position': 'a value object on it, read as numbers rather than as object:Vector3',

        // The bag rule is a widening of `constructor === Object`, and this is the one property that
        // proves the widening reaches anything: `Layers` is a class, so the old rule stopped at
        // `object:Layers` and a camera that had been switched onto an empty layer looked identical.
        'camera.layers.mask': 'a configuration bag whose class is NOT Object'
    };

    const unreached = Object.keys( reachProbes ).filter( ( key ) => baseline.rendererState[ key ] === undefined );

    report(
        'the walk reaches every subject a confound has been routed through, so "nothing moved" means something',
        Object.keys( baseline.rendererState ).length >= 150 && unreached.length === 0,
        unreached.length === 0
            ? `${ Object.keys( baseline.rendererState ).length } properties, of which ` +
                `${ Object.keys( baseline.rendererState ).filter( ( key ) => key.startsWith( 'camera.' ) ).length } ` +
                'on the camera. ' + Object.entries( reachProbes )
                    .map( ( [ key, why ] ) => `${ key }=${ baseline.rendererState[ key ] } (${ why })` ).join( ', ' )
            : `NOT REACHED: ${ unreached.join( ', ' ) } — a confound routed through any of these is ` +
                'invisible, which is exactly how the last three versions of this file were defeated'
    );

    // 🎯 THE SUBJECT LIST, CLOSED. Three versions of this instrument were beaten by the same move —
    // close a surface, leave its container enumerated — so the container is checked too. Unioned
    // over both baseline loads; the per-toggle plates cannot add a Stage member without also
    // showing it as a diff, and the whole-run union is gathered below for the retired-row half.
    const stageMembers = new Set( [
        ...Object.keys( baseline.rendererState ), ...Object.keys( baselineAgain.rendererState )
    ].filter( ( key ) => key.startsWith( 'stage.' ) ).map( ( key ) => key.slice( 'stage.'.length ) ) );

    const unclassifiedSubjects = [ ...stageMembers ]
        .filter( ( name ) => WALKED_SUBJECTS.includes( name ) === false )
        .filter( ( name ) => UNWALKED_SUBJECTS[ name ] === undefined ).sort();

    report(
        'every object the Stage holds is either walked or excused, so the SUBJECT list is closed too',
        unclassifiedSubjects.length === 0,
        unclassifiedSubjects.length === 0
            ? `${ stageMembers.size } members: ${ WALKED_SUBJECTS.join( ' + ' ) } walked, the other ` +
                `${ stageMembers.size - WALKED_SUBJECTS.length } excused in UNWALKED_SUBJECTS`
            : `UNCLASSIFIED SUBJECT: ${ unclassifiedSubjects.join( ', ' ) } — the Stage grew a member ` +
                'nothing here looks at. Walk it, or write down what does cover it.'
    );

    // And the reverse, so an excuse cannot outlive the member it excuses.
    const deadSubjects = Object.keys( UNWALKED_SUBJECTS )
        .filter( ( name ) => stageMembers.has( name ) === false ).sort();

    report(
        'every excused subject is one the Stage actually holds',
        deadSubjects.length === 0,
        deadSubjects.length === 0
            ? `all ${ Object.keys( UNWALKED_SUBJECTS ).length } excuses correspond to a live member`
            : `NOT ON THE STAGE: ${ deadSubjects.join( ', ' ) } — the excuse is excusing nothing`
    );

    // 🚩 AND THE HOLE THAT IS LEFT, PRINTED RATHER THAN IMPLIED — LEARNINGS §1.25b: a gate that
    // overstates its own scope is worse than a missing gate. This is not a check and it is
    // deliberately not counted as one; the checkable half of it is the Grade-uniform closure below.
    console.log( `\n        ⚠️  KNOWN OPEN HOLE: ${ POST_STACK_SUBJECTS.length } post-stack members ` +
        `(${ POST_STACK_SUBJECTS.join( ', ' ) }) are identity-checked\n` +
        '            here and NOT walked. Their state is covered only by shadingFingerprint\'s 19-field\n' +
        '            `pipeline` row, which is the same shape of instrument this file exists because of.\n' +
        '            Measured at this commit: no post-boot confound can be planted on the Grade, because\n' +
        '            every uniform it owns is either carried by that row or rewritten every frame. That\n' +
        '            is a coincidence and the next check is what keeps it one.\n' +
        '            (stage.ambientOcclusion is an eighth post-stack member and is counted separately,\n' +
        '            because the pipeline row carries its describe() WHOLE rather than a field or two.)\n' );

    // The checkable half. `Grade` is not walked, so the gate cannot see INTO it — what it can see is
    // whether it has grown a knob nobody carries.
    const gradeUniforms = baseline.gradeUniforms ?? [];
    const uncarriedUniforms = gradeUniforms.filter( ( name ) => GRADE_UNIFORMS[ name ] === undefined ).sort();
    const retiredUniforms = Object.keys( GRADE_UNIFORMS )
        .filter( ( name ) => gradeUniforms.includes( name ) === false ).sort();

    report(
        'the Grade owns exactly the uniforms this file knows something covers',
        baseline.gradeUniforms !== null && uncarriedUniforms.length === 0 && retiredUniforms.length === 0,
        baseline.gradeUniforms === null
            ? 'THERE IS NO GRADE ON THE BASELINE PLATE — the shipped default is supposed to carry one, ' +
                'and without it this check and the pipeline row are both reading nothing'
            : uncarriedUniforms.length === 0 && retiredUniforms.length === 0
                ? `${ gradeUniforms.length } uniforms, each one either in the fingerprint's pipeline row ` +
                    'or written every frame: ' + gradeUniforms.join( ', ' )
                : [
                    uncarriedUniforms.length > 0
                        ? `THE GRADE GREW A KNOB: ${ uncarriedUniforms.join( ', ' ) } — instrument 5 does not ` +
                            'walk the Grade, so unless the pipeline row carries it, nothing does. Add it there ' +
                            'and here before attributing anything to it'
                        : null,
                    retiredUniforms.length > 0
                        ? `NO LONGER ON THE GRADE: ${ retiredUniforms.join( ', ' ) } — the row here is ` +
                            'describing a field that is gone'
                        : null
                ].filter( ( line ) => line !== null ).join( '; ' )
    );

    // 🚩 AND THE SAME HOLE ON THE EIGHTH POST-STACK MEMBER, PRINTED FOR THE SAME REASON. Punch-list
    // 3.10's occlusion node is identity-checked here and its state reaches the fingerprint only
    // through `describe()`. Four of its eight live uniforms are outside that report.
    console.log( `\n        ⚠️  KNOWN OPEN HOLE: ${ UNCARRIED_OCCLUSION_UNIFORMS.length } of the occlusion ` +
        `node's uniforms (${ UNCARRIED_OCCLUSION_UNIFORMS.join( ', ' ) })\n` +
        '            are not reported by describe(), so nothing here would see a confound planted on one.\n' +
        '            No url key drives any of them today; the next check is what keeps that true.\n' );

    // The checkable half, exactly as for the Grade: the gate cannot see INTO the node, but it can
    // see whether the node has grown a knob nobody carries.
    const occlusionUniforms = baseline.occlusionUniforms ?? [];
    const uncarriedOcclusion = occlusionUniforms.filter( ( name ) => OCCLUSION_UNIFORMS[ name ] === undefined ).sort();
    const retiredOcclusion = Object.keys( OCCLUSION_UNIFORMS )
        .filter( ( name ) => occlusionUniforms.includes( name ) === false ).sort();

    report(
        'the occlusion node owns exactly the uniforms this file has classified',
        baseline.occlusionUniforms !== null && uncarriedOcclusion.length === 0 && retiredOcclusion.length === 0,
        baseline.occlusionUniforms === null
            ? 'THERE IS NO OCCLUSION ON THE BASELINE PLATE — punch-list 3.10 ships ON, so without it ' +
                'this check, the pipeline row\'s ambientOcclusion field and eight TOGGLES rows are all ' +
                'reading nothing'
            : uncarriedOcclusion.length === 0 && retiredOcclusion.length === 0
                ? `${ occlusionUniforms.length } uniforms, ` +
                    `${ occlusionUniforms.length - UNCARRIED_OCCLUSION_UNIFORMS.length } of them carried by ` +
                    `describe() and therefore by the fingerprint's pipeline row: ${ occlusionUniforms.join( ', ' ) }`
                : [
                    uncarriedOcclusion.length > 0
                        ? `THE OCCLUSION GREW A UNIFORM: ${ uncarriedOcclusion.join( ', ' ) } — instrument 5 ` +
                            'does not walk the node, so unless describe() reports it, nothing does. Carry it ' +
                            'there and classify it here before attributing anything to it'
                        : null,
                    retiredOcclusion.length > 0
                        ? `NO LONGER ON THE NODE: ${ retiredOcclusion.join( ', ' ) } — the row here is ` +
                            'describing a field that is gone'
                        : null
                ].filter( ( line ) => line !== null ).join( '; ' )
    );

    // An exclusion for a property that no longer exists is a line nobody deletes on their own, and
    // it reads as caution while covering nothing. Both kinds are asserted live on the baseline.
    const staleExclusions = PER_FRAME_EXCLUSIONS
        .filter( ( propertyPath ) => baseline.rendererState[ `excluded:${ propertyPath }` ] === undefined );

    const uuidMarkers = Object.keys( baseline.rendererState )
        .filter( ( key ) => key.startsWith( 'excluded:' ) && key.endsWith( '.uuid' ) );

    report(
        'every exclusion the walk declares is a property that actually exists',
        staleExclusions.length === 0 && uuidMarkers.length > 0,
        staleExclusions.length === 0 && uuidMarkers.length > 0
            ? `${ PER_FRAME_EXCLUSIONS.length } per-frame exclusions and ${ uuidMarkers.length } uuids, ` +
                'all present on the baseline and all recorded as markers rather than silently skipped'
            : `STALE: ${ [ ...staleExclusions, uuidMarkers.length === 0 ? 'no uuid marker at all' : null ]
                .filter( ( entry ) => entry !== null ).join( ', ' ) } — the exclusion covers nothing and ` +
                'should come out, or the property it names has moved'
    );

    // The page ships its own copy of this walk as `sugata.renderState()`, for the console and for
    // anyone measuring by hand. Two copies drift, and a doc quoting the older one's property count
    // goes stale silently — which has already happened once, at 116.
    const mirrorOnly = baseline.pageRenderState
        .filter( ( key ) => baseline.rendererState[ key ] === undefined );
    const gateOnly = Object.keys( baseline.rendererState )
        .filter( ( key ) => baseline.pageRenderState.includes( key ) === false ).sort();

    report(
        'the page\'s own renderState() walks the same properties this file does',
        mirrorOnly.length === 0 && gateOnly.length === 0,
        mirrorOnly.length === 0 && gateOnly.length === 0
            ? `both walks report the same ${ baseline.pageRenderState.length } property paths`
            : `THE TWO COPIES HAVE DRIFTED — only on the page: ${ mirrorOnly.join( ', ' ) || 'none' }; ` +
                `only in this file: ${ gateOnly.join( ', ' ) || 'none' }. The gate's own copy is what ` +
                'decides the verdicts, so this is the page mirror being wrong, not the gate.'
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
        plateGrooms.set( `?${ toggle.query }`, plate.hair );

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
        // which is the strictest shape in the table: a toggle that reaches the renderer, the scene
        // or the camera at all is collateral unless it says so and says exactly what.
        const declaredState = toggle.rendererState ?? [];
        const movedState = changedEntities( baseline.rendererState, plate.rendererState );
        const stateCollateral = missingFrom( movedState, declaredState );
        const stateInert = missingFrom( declaredState, movedState );

        report(
            `?${ toggle.query } moves ${ declaredState.length === 0 ? 'NO frame-subject state' : declaredState.join( ' + ' ) }`,
            stateCollateral.length === 0 && stateInert.length === 0,
            stateCollateral.length === 0 && stateInert.length === 0
                ? `the other ${ Object.keys( baseline.rendererState ).length - movedState.length } properties of the ` +
                    'renderer, the scene and the camera hold their values'
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
    plateGrooms.set( `?${ MUTUALLY_EXCLUSIVE.query }`, msaaPlate.hair );

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
    // sample. 43 plates were swept on this commit — the run prints the count rather than trusting
    // this line — and none of them may wake it.
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
        // ALL. Forty-three nulls are also what you get if `?wear` were deleted, if the dynamic
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

    // 🎯 PUNCH-LIST 3.5/3.6's INERTNESS CLAIM, and it is the `?wear` block one file section down
    // rather than a variation on it, because the two flags have the same shape and the same risk.
    // `?hair` is opt-in SO THAT the plate every objective gate is measured on has no groom in it;
    // that is a claim about the boot path, not about one plate, so it is asserted over every plate
    // this run loaded. A groom waking up unasked would put a several-hundred-card shadow-casting mesh and its
    // sheets into the plate a judge captures, and move every recorded sha256 with it.
    {
        const grown = [ ...plateGrooms.entries() ]
            .filter( ( [ , groom ] ) => groom !== null && groom !== undefined )
            .map( ( [ label, groom ] ) => `${ label } -> ${ groom.bake } (${ groom.groomMeshes } mesh)` );

        report(
            'with ?hair absent the groom is never loaded, on ANY plate this file loads',
            grown.length === 0,
            grown.length === 0
                ? `${ plateGrooms.size } plates, census.hair null on every one — no GLB fetched, no ` +
                    'sheets, nothing added to the figure'
                : `THE GROOM APPEARED UNASKED on ${ grown.join( '; ' ) } — the default plate is not the ` +
                    'plate the seven gates are stated on'
        );

        // 🚩 AND THE SAME PROOF THE WARDROBE BLOCK NEEDS, FOR THE SAME REASON: a column of nulls is
        // also what a deleted `?hair`, a silently-failed dynamic import or an unexposed
        // `session.hair` produces, so on its own the check above cannot tell "correctly inert" from
        // "absent". One plate WITH the flag separates them. There is no cheap end of this flag the
        // way `?wear=` is the cheap end of the wardrobe — the groom is one GLB and its sheets,
        // whole or not at all — so the extra plate is simply the price of the check meaning anything.
        //
        // It carries a second job. `readHairRequest` is called only when `?hair=1` is present, so
        // this is the ONLY plate in the run on which the seven sub-keys are read at all, and their
        // UNGATED rows would otherwise be excuses for keys the surface check never sees.
        const hairPlate = await loadPlate( page, server.baseUrl, `${ BASE_QUERY }&hair=1`,
            () => globalThis.sugata?.session?.hair != null );

        for ( const key of hairPlate.surface ) observedSurface.add( key );

        const groom = hairPlate.hair;

        report(
            'and the same check SEES a groom when ?hair IS present, so the nulls above mean inert and not absent',
            groom != null && groom.groomMeshes > 0 && groom.shadedMeshesInScene > 0,
            groom == null
                ? 'census.hair is STILL null with ?hair=1 in the url — the check above proves nothing, ' +
                    'because it cannot distinguish an inert groom from a missing one'
                : `?hair=1 put the ${ groom.bake } groom on the page: ${ groom.groomMeshes } mesh, ` +
                    `${ groom.shadedMeshesInScene } of them wearing HairMaterial, oit '${ groom.oit }'`
        );

        // 🎯 AND THE ONE THING THIS ROUND ADDED THAT A NULL CANNOT CARRY: which transparency arm the
        // groom actually runs. Until this round `alive.js` never imported `render/HairOIT.js`, so
        // `createHairMaterial`'s own `alphaTest = 0.5` stood and this page ran the CUTOUT arm — the
        // arm HairOIT.js measures as the worst under motion — while nothing anywhere said so. The
        // census reads the arm off the STAGE, so this check fails if the wiring is removed again.
        report(
            'and the arm it runs is HairOIT.js\'s own recommendation, not whatever the material was left in',
            groom != null && groom.oit === HAIR_OIT_DEFAULT_MODE,
            groom == null
                ? 'no groom on the plate — not checked'
                : groom.oit === HAIR_OIT_DEFAULT_MODE
                    ? `oit '${ groom.oit }' = HAIR_OIT_DEFAULT_MODE, read off stage.hairOITMode rather ` +
                        'than echoed back from the url'
                    : `THE PAGE IS RUNNING '${ groom.oit }' AND HairOIT.js RECOMMENDS ` +
                        `'${ HAIR_OIT_DEFAULT_MODE }'. If that is 'cutout', the OIT wiring has been ` +
                        'lost and the shipped avatar is back on the arm 3.6 measured as worst under motion'
        );

        // 🎯 PUNCH-LIST 6.6, AND IT IS THE `?hairoit` CHECK ABOVE ONE ROUND LATER AND ONE SUBSYSTEM
        // OVER. That check exists because a working module — `render/HairOIT.js` — shipped without
        // `alive.js` importing it, so the judged plate ran an arm nobody chose. `motion/HairDynamics.js`
        // then did the same thing: gated at 25/25, wired onto `hair.html` only, and the blind critic
        // read the shipped build as *"nothing moves, and I can say that from the data rather than by
        // squinting"*. Two instances is a pattern, so this is a check and not a comment.
        //
        // ⚠️ THE STEP COUNT IS READ TWICE, AND THAT IS THE WHOLE CHECK. A solver that is CONSTRUCTED
        // and never stepped satisfies every other instrument here identically — the census shape is
        // there, the material carries the node, the entity fingerprint moves — and it is precisely
        // what a `trackFigure` that dropped the call would leave behind. `steps` advancing between
        // two reads separated by real rAF frames is the liveness control, and it is the same
        // question the critic asked of the position attribute's upload version.
        const motionBefore = await page.evaluate( () => globalThis.sugata.subsystems().hair.motion );
        await page.waitForTimeout( 500 );
        const motionAfter = await page.evaluate( () => globalThis.sugata.subsystems().hair.motion );

        report(
            'and the groom it puts there is SIMULATED — punch-list 6.6\'s solver is on the plate a judge captures',
            motionAfter != null && motionAfter.chains > 0 && motionAfter.particles ===
                motionAfter.chains * motionAfter.pointsPerChain,
            motionAfter == null
                ? 'census.hair.motion is null with ?hair=1 and no ?hairmotion=0 — the solver is NOT ' +
                    'wired to this page and the shipped groom is a rigid SkinnedMesh welded to the head'
                : `${ motionAfter.chains } chains x ${ motionAfter.pointsPerChain } rings = ` +
                    `${ motionAfter.particles } particles at a ${ motionAfter.substepSeconds.toFixed( 6 ) } s ` +
                    `substep, ${ motionAfter.computeCallsLastFrame } renderer.compute() call last frame`
        );

        report(
            '...and it is being STEPPED, which is the half a constructed-but-unstepped solver would also pass',
            motionAfter != null && motionBefore != null && motionAfter.steps > motionBefore.steps,
            motionAfter == null || motionBefore == null
                ? 'no solver on the plate — not checked'
                : `${ motionBefore.steps } -> ${ motionAfter.steps } fixed steps over 500 ms of rAF. ` +
                    'A solver built and never driven reads identically to this one in the census shape, ' +
                    'in the material node graph and in the entity fingerprint.'
        );

        // The control half. Without it the two checks above cannot tell "correctly wired" from "the
        // flag was deleted and the solver is unconditional" — and an A/B key nobody can switch off
        // is not a control, which is the whole thing this file exists to protect.
        const rigidPlate = await loadPlate( page, server.baseUrl, `${ BASE_QUERY }&hair=1&hairmotion=0`,
            () => globalThis.sugata?.session?.hair != null );

        for ( const key of rigidPlate.surface ) observedSurface.add( key );

        report(
            'and ?hairmotion=0 takes the solver away, so the A/B toggle is a control and not a label',
            // ⚠️ `motionAfter != null` is in this predicate, not decoration. Without it the clause
            // is green on a page where the solver was never wired at all — a null on both sides —
            // which is §1.25g and is the exact state this whole block exists to catch.
            motionAfter != null && rigidPlate.hair != null && rigidPlate.hair.motion === null &&
                rigidPlate.hair.shadedMeshesInScene > 0,
            rigidPlate.hair == null
                ? 'no groom at all on ?hair=1&hairmotion=0 — the control plate lost the hair, not the motion'
                : rigidPlate.hair.motion === null
                    ? `the groom is still there (${ rigidPlate.hair.shadedMeshesInScene } shaded mesh, oit ` +
                        `'${ rigidPlate.hair.oit }') and census.hair.motion is null — a RIGID groom, which ` +
                        'is what every plate captured off this page before punch-list 6.6 contained'
                    : 'census.hair.motion is NOT null under ?hairmotion=0 — the key does not switch the ' +
                        'solver off, so no plate in this repository is a rigid control'
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

    // --- THE WEBGL2 TIER: it must RENDER, not explain itself ------------------------------------
    //
    // 🚩 This section replaces a written excuse. The `webgl` row of UNGATED used to record "the
    // page refuses to build a figure at all… no plate exists to gate", which was true and was the
    // reason `?webgl` shipped for a whole round rendering an untouched 300x150 canvas with no
    // `window.sugata` and no `window.__SUGATA_STEP__` on it. A gate that certifies a dead route is
    // worse than no gate, because it is read as coverage.
    //
    // Four checks, and the last three are what stop the first one being satisfiable by a page that
    // quietly ignored `?webgl` and served WebGPU again — which is the obvious way to make "it
    // renders" green without a fallback tier existing at all.
    {

        console.log( '\n--- the WebGL2 fallback tier renders on the flags every plate uses ----------\n' );

        const ready = await page.goto( `${ server.baseUrl }/alive.html?webgl&${ BASE_QUERY }`,
            { waitUntil: 'load' } )
            .then( () => page.waitForFunction(
                () => globalThis.sugata?.session?.figure != null
                    && typeof globalThis.__SUGATA_STEP__ === 'function',
                null, { timeout: 120_000 } ) )
            .then( () => true )
            .catch( () => false );

        report(
            'W1 ?webgl builds a figure and exposes the capture hook, on ?bare with no other flags',
            ready,
            ready
                ? 'window.sugata.session.figure and window.__SUGATA_STEP__ both present'
                : 'NEITHER APPEARED WITHIN 120 s. This is the Phase 8 defect: the page returned ' +
                    'before Stage was constructed, so no capture.mjs plate and no measure.mjs gate ' +
                    'can be taken on the documented fallback tier at all'
        );

        // Only meaningful once W1 is green; reported as skipped rather than crashing the run, so a
        // red W1 stays one legible failure instead of an exception in the middle of the tally.
        const tier = ready === false ? null : await page.evaluate( () => {

            const renderer = globalThis.sugata.stage.renderer;
            const canvas = renderer.domElement;

            return {
                isWebGL: renderer.backend?.isWebGLBackend === true,
                samples: renderer.samples,
                canvasPixels: canvas.width * canvas.height,
                temporal: globalThis.sugata.stage.temporal == null ? null : globalThis.sugata.stage.temporal.mode
            };

        } );

        report(
            'W2 …and it really is the WebGL2 backend, not WebGPU ignoring the flag',
            tier !== null && tier.isWebGL === true,
            tier === null ? 'not checked — W1 is red' : `backend.isWebGLBackend = ${ tier.isWebGL }`
        );

        // ⚠️ The downgrade itself, and it has to be checked as WELL as "it rendered": a page that
        // built a figure and left `aa` at taau would render a WebGL2 frame with a dead velocity
        // buffer — plausible pixels, silently wrong temporal state — which is exactly the failure
        // class the old refusal was written to avoid. `samples` is the forward path's own witness.
        report(
            'W3 …with ?aa downgraded to msaa rather than left on a resolve WebGL2 cannot feed',
            tier !== null && tier.samples === 4 && tier.temporal === null,
            tier === null
                ? 'not checked — W1 is red'
                : `renderer.samples ${ tier.samples } (4 = the forward MSAA target), ` +
                    `stage.temporal ${ tier.temporal === null ? 'absent' : `STILL ${ tier.temporal }` }`
        );

        // 🚩 NON-DEGENERACY, and it is not ceremony: `canvas.width * canvas.height` is 45,000 on an
        // untouched canvas (300x150) and 4,320,000 at this file's 900x1200 dpr 2. The defect's
        // signature is the DEFAULT canvas size, so this is the one number that separates "the page
        // sized its drawing buffer" from "the page never touched it", and it fails loudly on the
        // exact artefact the Phase 8 round found.
        report(
            'W4 …onto a canvas the page actually sized, not the untouched 300x150 default',
            tier !== null && tier.canvasPixels > 45_000,
            tier === null
                ? 'not checked — W1 is red'
                : `${ tier.canvasPixels } drawing-buffer pixels; 45000 would be the 300x150 default`
        );

    }

    // --- THE GPU TIMESTAMP: ?gputime=1 must WORK, not be excused --------------------------------
    //
    // 🚩 This section exists because `?gputime=1` is INVISIBLE TO EVERY OTHER INSTRUMENT IN THIS
    // FILE. Measured: no fingerprint entity moves, no census entry moves, and not one of the
    // frame-subject properties moves, because the flag lands on `renderer.backend.trackTimestamp`
    // and `backend` holds objects — the walk records it as `object:WebGPUBackend` and stops. So a
    // TOGGLES row for it would be an empty allowlist against an empty diff: green on a working
    // flag, green on a flag somebody deleted, and green on a flag that silently stopped reaching
    // the adapter. That is the `?webgl` failure exactly, so it gets the `?webgl` answer — the claim
    // the key exists to support is asserted on a real plate instead.
    //
    // The claim is a NEGATIVE and a POSITIVE and it needs both halves. `alive.js` records that the
    // feature cannot be turned on after `init()` — "0 of 200 samples valid" — which is the whole
    // reason this is a url key; and the shipped plate must not be paying for a query nobody reads.
    // One plate each way is what separates those two from "the timestamp never works here".
    {

        console.log( '\n--- ?gputime=1 buys a GPU timestamp, and the default plate pays nothing ------\n' );

        /** Navigate, let a few frames go by, and ask the renderer what it can tell the caller. */
        const timestampReport = async ( query ) => {

            await page.goto( `${ server.baseUrl }/alive.html?${ query }`, { waitUntil: 'load' } );
            await page.waitForFunction( () => globalThis.sugata?.session?.figure != null, null, { timeout: 120_000 } );
            await page.waitForTimeout( 1500 );

            return page.evaluate( async () => {

                const renderer = globalThis.sugata.stage.renderer;

                // `resolveTimestampsAsync` reports whichever frame is last in the pending set, so a
                // single call can legitimately land between frames. Polled rather than sampled
                // once: a retry loop makes a red result mean "no timestamp at all", which is the
                // thing being asserted, rather than "asked at an unlucky moment".
                let resolved;

                for ( let attempt = 0; attempt < 10 && resolved === undefined; attempt ++ ) {

                    await new Promise( ( done ) => setTimeout( done, 300 ) );
                    resolved = await renderer.resolveTimestampsAsync( 'render' );

                }

                return {
                    backendRequestedIt: renderer.backend?.trackTimestamp === true,
                    backend: renderer.backend?.constructor?.name ?? 'none',
                    resolved: resolved === undefined ? null : resolved,
                    infoTimestamp: renderer.info?.render?.timestamp ?? null
                };

            } );

        };

        const withoutFlag = await timestampReport( BASE_QUERY );
        const withFlag = await timestampReport( `${ BASE_QUERY }&gputime=1` );

        report(
            'T1 the shipped plate does NOT pay for a timestamp — no feature requested, nothing to resolve',
            withoutFlag.backendRequestedIt === false && withoutFlag.resolved === null
                && withoutFlag.infoTimestamp === 0,
            `backend.trackTimestamp ${ withoutFlag.backendRequestedIt }, ` +
                `resolveTimestampsAsync ${ withoutFlag.resolved === null ? 'undefined' : withoutFlag.resolved }, ` +
                `info.render.timestamp ${ withoutFlag.infoTimestamp }` +
                ( withoutFlag.backendRequestedIt === true
                    ? ' — THE DEFAULT PLATE IS PAYING FOR QUERIES NOBODY READS'
                    : '' )
        );

        report(
            'T2 …and ?gputime=1 asks the ADAPTER for it, which is the half that cannot be done later',
            withFlag.backendRequestedIt === true,
            withFlag.backendRequestedIt === true
                ? `backend.trackTimestamp false -> true on ${ withFlag.backend }. This is the one ` +
                    'property the flag moves, and instrument 5 cannot see it: `backend` holds objects, ' +
                    'so the walk records it by constructor name'
                : `THE FLAG DID NOT REACH THE DEVICE — backend.trackTimestamp is still ` +
                    `${ withFlag.backendRequestedIt } on ${ withFlag.backend }, so every timing quoted ` +
                    'off ?gputime=1 came from somewhere other than a GPU query'
        );

        // 🚩 AND THE NUMBER ITSELF, because "the feature was requested" is not "the timestamp
        // works". `render/GTAO.js` argues the shipping quality on four GPU p50s taken from this
        // exact flag; if the resolve came back undefined, that table is a table of nothing.
        const timing = withFlag.resolved;

        report(
            'T3 …and a render timestamp actually RESOLVES, so the 3.10 quality table is a table of measurements',
            typeof timing === 'number' && Number.isFinite( timing ) && timing > 0
                && withFlag.infoTimestamp === timing,
            typeof timing === 'number' && Number.isFinite( timing ) && timing > 0
                ? `resolveTimestampsAsync('render') = ${ timing } ms, and info.render.timestamp agrees`
                : `NO TIMESTAMP CAME BACK (${ timing === null ? 'undefined' : timing }) after ten ` +
                    'attempts over three seconds. The feature was requested and produced nothing, which ' +
                    'is the state alive.js measured at 0 of 200 samples valid'
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
