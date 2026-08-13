/**
 * Every page in the testbed, described once, in the order somebody new should meet them.
 *
 * ## Why this is a module and not a list typed into `index.html`
 *
 * A hand-maintained index is a claim about the repository, and this repository has been caught
 * four separate times by claims about itself that drifted — a gate roster where twelve of thirteen
 * counts had moved, a build config that did not know two pages existed, a comment citing a ledger
 * entry nobody had filed. An index page is exactly that shape: it is right the day it is written
 * and silently wrong the first time somebody adds a page.
 *
 * So the list lives here, `index.html` renders it, and `pages.selftest.mjs` closes it in BOTH
 * directions against two independent sources of truth:
 *
 *   - the filesystem — every `.html` under `packages/testbed/` appears below, and every entry
 *     below exists on disk;
 *   - `vite.pages.config.js` — the same set, because a page nobody builds is a page that can rot
 *     behind a green `npm run build:pages`, which is the defect that config exists to prevent.
 *
 * 🎯 **Adding a page therefore costs three edits and the gate names all three if you miss one.**
 * That is the intended price. The alternative is the index quietly becoming a museum of the pages
 * that existed in August.
 *
 * ## What `blurb` is for, and what it is not
 *
 * One sentence answering "why would I open this rather than one of the others". It is NOT a
 * summary of the page's source header — those are long, and they are already the right place for
 * detail. If a blurb needs a second sentence, the page probably needs splitting.
 */

/**
 * The acceptance page. It is listed on its own because it is not a browsercheck: it is the page
 * the seven objective gates are measured on and the page a blind judge captures.
 */
export const ACCEPTANCE = [
    {
        path: 'alive.html',
        name: 'alive',
        phase: 'Phase 2 · the acceptance page',
        blurb: 'Does the figure read as alive when it is silent? Every judge plate and every ' +
            'objective gate is captured here — so a number taken anywhere else is compared ' +
            'against this page, not the other way round.',
        gates: [ 'alive-toggles', 'alive-capture-determinism', 'tools/critic/measure.mjs' ]
    }
];

/**
 * One page per thing that has to be LOOKED at. Each exists because its selftest proves the numbers
 * and cannot prove the picture — LEARNINGS §1.2, which is the most-cited entry in that file.
 */
export const BROWSERCHECKS = [
    {
        path: 'src/stage.html',
        name: 'stage',
        phase: 'Phase 3.1 · G-buffer',
        blurb: 'A deferred pipeline that compiles is not a deferred pipeline that works. Every ' +
            'MRT attachment is drawn here so you can see what is actually in it.',
        gates: [ 'TRAAPost', 'MorphVelocity' ]
    },
    {
        path: 'src/skin.html',
        name: 'skin',
        phase: 'Phase 3.2 · subsurface',
        blurb: 'Is the subsurface term doing anything, and how much? A skin shader that renders ' +
            'grey is the failure this page exists to catch.',
        gates: [ 'SkinOcclusion', 'SkinRegions' ]
    },
    {
        path: 'src/eye.html',
        name: 'eye',
        phase: 'Phase 3.3 / 3.4 · ocular optics',
        blurb: 'The eye, A/B-able and measurable without touching alive.html, which the motion ' +
            'work owns.',
        gates: [ 'EyeMaterial', 'cornea_geometry', 'eye-optics-claims' ]
    },
    {
        path: 'src/lighting.html',
        name: 'lighting',
        phase: 'Phase 3.8 · the rig',
        blurb: 'Produces the frame G1 is measured on, at both framings, under conditions that do ' +
            'not drift. Carries the plantable whole-state light defects.',
        gates: [ 'LightingRig', 'GroundContact' ]
    },
    {
        path: 'src/post.html',
        name: 'post',
        phase: 'Phase 3.11–3.13 · AA and grade',
        blurb: 'Answers antialiasing and grade questions by A/B rather than by argument, on the ' +
            'same figure, rig and framing constants alive.html uses.',
        gates: [ 'Grade', 'Toksvig', 'TRAAPost' ]
    },
    {
        path: 'src/voice.html',
        name: 'voice',
        phase: 'Phase 4.1 / 4.2 / 4.4 · speech',
        blurb: 'The viseme schedule is proven in numbers elsewhere. This is where you find out ' +
            'whether the mouth moves.',
        gates: [ 'visemes', 'prosody' ]
    },
    {
        path: 'src/affect.html',
        name: 'affect',
        phase: 'Phase 5 · PAD and the body',
        blurb: 'Poses the demonstration PAD points. The selftest proves 114 things about the ' +
            'numbers and none of them is whether a face is legible.',
        gates: [ 'affect' ]
    },
    {
        path: 'src/wardrobe.html',
        name: 'wardrobe',
        phase: 'Phase 9 · garments',
        blurb: 'Dress, undress, the decency floor and the agency modes — and the shadow and hem ' +
            'probes, whose breakage toggles are how both gates reintroduce their defects.',
        gates: [ 'wardrobe', 'shadow', 'hem', 'decency', 'agency' ]
    },
    {
        path: 'src/fabric.html',
        name: 'fabric',
        phase: 'Phase 9.16 · procedural cloth',
        blurb: 'The rendered half of the weave spike. The CPU gate proves a twill angle is ' +
            'recoverable from a height field; it is structurally blind to whether it looks woven.',
        gates: []
    },
    {
        path: 'src/hair.html',
        name: 'hair',
        phase: 'Phase 3.6 · the groom',
        blurb: 'The procedural hair cards, from five angles including the top-down one that ' +
            'catches a bald crown. The gate proves 254 cards clear the skull and cannot tell ' +
            'you whether they read as hair.',
        gates: [ 'verify_glb hair clause' ]
    },
    {
        path: 'src/identity.html',
        name: 'identity',
        phase: 'Phase 10.1 / 10.2 · sculpting',
        blurb: 'Every modelling target, drawn. The selftest proves the CPU application reproduces ' +
            'headless MPFB to 1.2e-4 mm and cannot tell you the result is a person.',
        gates: [ 'identitytargets', 'identitycatalogue', 'identityassets' ]
    }
];

/**
 * Kept, and kept last, because it is the oldest page here and the only one that is not about the
 * avatar. It answers one question — did the backend come up — and that question is worth being
 * able to ask in isolation on a machine you have never run this on.
 */
export const SCAFFOLD = [
    {
        path: 'src/scaffold.html',
        name: 'scaffold',
        phase: 'Phase 0.1 · harness',
        blurb: 'WebGPU or WebGL2 comes up, the canvas respects devicePixelRatio, and the HUD ' +
            'says which backend actually won. Start here when nothing renders anywhere.',
        gates: []
    }
];

/**
 * The commands, because "which node do I run" is a fair question with a non-obvious answer: the
 * gates are plain node files with no test runner, the dev server is rooted at `packages/testbed`
 * rather than at the repo, and the spike pages need a DIFFERENT vite config because they live
 * outside that root.
 *
 * ⚠️ Every `run` string below must be a script in the root `package.json`, or a `node`/`bash`
 * invocation of a file that exists. `pages.selftest.mjs` checks both.
 */
export const COMMANDS = [
    {
        group: 'Look at it',
        items: [
            { run: 'npm run dev', does: 'Serves this hub at http://localhost:5173/ — every page ' +
                'below is a link from there. Rooted at packages/testbed.' },
            { run: 'npm run spikes', does: 'The spike pages under tools/spikes/, which live ' +
                'outside the dev root and need their own config.' }
        ]
    },
    {
        group: 'Prove it',
        items: [
            { run: 'npm run selftests', does: 'EVERY gate in the repo, one line each, with the ' +
                'tree state at both ends. Exit code is the number that failed. Takes a while — ' +
                'the browser-driven gates are most of it.' },
            { run: 'npm run critic', does: 'The seven objective image gates (G1–G7) over a ' +
                'captured plate.' },
            { run: 'npm run verify:glb', does: 'Structural verification of every shipped GLB.' }
        ]
    },
    {
        group: 'Build it',
        items: [
            { run: 'npm run build:pages', does: 'Builds ALL pages. Plain `npm run build` compiles ' +
                'only index.html — vite\'s default single entry — so a broken import in any page ' +
                'below passes it.' },
            { run: 'npm run figure', does: 'Rebuilds the figure and wardrobe artefacts through ' +
                'Blender. Slow, and it changes sha256-bearing gate inputs.' }
        ]
    }
];

/** Everything, in render order. The gate closes over exactly this. */
export const ALL_PAGES = [ ...ACCEPTANCE, ...BROWSERCHECKS, ...SCAFFOLD ];
