/**
 * The testbed catalogue is also its source-status inventory. Keep descriptions about what a
 * page exposes separate from browser verification. The closure gate compares this list with
 * both the filesystem and vite.pages.config.js; adding a page still requires all three entries.
 */
export const CATALOGUE_REVIEWED = '2026-09-13';

const SOURCE_REVIEW = {
    kind: 'source-reviewed',
    date: CATALOGUE_REVIEWED,
    detail: 'Source reviewed; browser behaviour has not been rechecked in this catalogue pass.'
};

const PREVIEW_REVIEW = {
    kind: 'previously-verified',
    date: '2026-09-13',
    detail: 'Both bobs have matched WebGPU motion checks. Softer brow and lash coverage is verified in still and blink samples; Wardrobe image export and resizing are verified. Broader outfit and expression quality remain in development.',
    evidence: 'docs/FACE-CARD-COVERAGE-2026-09-13.md'
};

export const PAGE_GROUPS = [
    {
        id: 'previews',
        title: 'Explore the avatar',
        note: 'The current appearance, with controls made for browsing.',
        pages: [
            {
                path: 'src/portrait.html', name: 'Portrait', label: 'Current preview',
                blurb: 'Compare the chin-length and long bobs, choose an expression, and turn the avatar under studio or warm light.',
                boundary: 'Hair and expression study. Final hair shading and broader identity coverage are still developing.',
                requirements: 'No model service needed.',
                source: 'packages/testbed/src/portrait.js', review: PREVIEW_REVIEW,
                gates: [ 'Avatar' ]
            },
            {
                path: 'src/showcase.html', name: 'Wardrobe studies', label: 'Current preview',
                blurb: 'Explore two complete starting looks, change the light and framing, then save a PNG image or the avatar settings.',
                boundary: 'Two starting outfits on one body study. Clothing fit and the larger wardrobe remain works in progress.',
                requirements: 'No model service needed.',
                source: 'packages/testbed/src/showcase.js', review: PREVIEW_REVIEW,
                gates: [ 'Avatar', 'showcase-presets', 'showcase.gpu', 'showcase-image.gpu' ]
            }
        ]
    },
    {
        id: 'connected',
        title: 'Conversation',
        note: 'The avatar responds to text through a local language model.',
        pages: [
            {
                path: 'src/converse.html', name: 'Converse', label: 'Requires LM Studio',
                blurb: 'Type to the avatar and explore how a reply, facial expression and posture work together.',
                boundary: 'Text conversation and experimental affect. Mouth motion is a demonstration; spoken audio and microphone input are not connected.',
                requirements: 'LM Studio must be running with a compatible model. Connection setup is shown on the page.',
                source: 'packages/testbed/src/converse.js',
                review: {
                    kind: 'previously-verified', date: '2026-09-13',
                    detail: 'Real WebGPU page, recovery checks, and six live reply/appraisal turns with qwen3-4b-instruct-2507-mlx are verified. Open-ended reply and emotion quality remain experimental.',
                    evidence: 'docs/CONVERSE-2026-09-13.md'
                },
                gates: [ 'Avatar', 'LMStudioClient', 'converse-connection', 'converse.gpu' ]
            }
        ]
    },
    {
        id: 'labs',
        title: 'Focused labs',
        note: 'These isolate individual systems. Lighting, rendering and controls can differ from the previews.',
        pages: [
            {
                path: 'src/affect.html', name: 'Expression and posture', label: 'Diagnostic',
                blurb: 'Adjust emotional dimensions and compare the facial shapes and body prescriptions they produce.',
                boundary: 'Manually driven emotion study; it does not test open-ended conversation or prove human-level expression.',
                requirements: 'No model service needed.',
                source: 'packages/testbed/src/affect.js', review: SOURCE_REVIEW, gates: [ 'affect' ]
            },
            {
                path: 'src/voice.html', name: 'Mouth animation', label: 'Silent diagnostic',
                blurb: 'Hold individual mouth shapes or play a short synthetic sequence to inspect timing and transitions.',
                boundary: 'The audio-clock control provides timing only. This page does not generate spoken audio or match phonemes to your text.',
                requirements: 'No model service needed; the audio clock starts after a click.',
                source: 'packages/testbed/src/voice.js', review: SOURCE_REVIEW, gates: [ 'visemes', 'prosody' ]
            },
            {
                path: 'src/wardrobe.html', name: 'Garment fitting', label: 'Diagnostic',
                blurb: 'Inspect garment selection, layering, coverage, shadows and the avatar’s clothing preferences.',
                boundary: 'Uses simple diagnostic lighting and rendering. Intentional defect controls are available; use Wardrobe studies to judge the current look.',
                requirements: 'No model service needed.',
                source: 'packages/testbed/src/wardrobe.js', review: SOURCE_REVIEW,
                gates: [ 'wardrobe', 'shadow', 'hem', 'decency', 'agency' ]
            },
            {
                path: 'src/identity.html', name: 'Identity sculpting', label: 'Diagnostic',
                blurb: 'Explore the face and body modelling sliders and inspect how identity choices change the geometry.',
                boundary: 'Uses diagnostic lighting and rendering; this is not yet a polished character creator or a wardrobe fit guarantee.',
                requirements: 'No model service needed.',
                source: 'packages/testbed/src/identity.js', review: SOURCE_REVIEW,
                gates: [ 'identitytargets', 'identitycatalogue', 'identityassets' ]
            },
            {
                path: 'src/hair.html', name: 'Hair construction', label: 'Diagnostic',
                blurb: 'Inspect the authored groom from fixed viewpoints, including its crown, silhouette and texture atlas.',
                boundary: 'An asset inspection view with its own rendering. Use Portrait for the current moving avatar and hair.',
                requirements: 'No model service needed.',
                source: 'packages/testbed/src/hair.js', review: SOURCE_REVIEW, gates: [ 'verify_glb hair clause' ]
            },
            {
                path: 'src/skin.html', name: 'Skin shading', label: 'Diagnostic',
                blurb: 'Compare subsurface shading on and off and inspect the material settings under controlled lighting.',
                boundary: 'Material measurements and diagnostic views; its light and camera settings differ from Portrait.',
                requirements: 'WebGPU is needed for the default deferred view.',
                source: 'packages/testbed/src/skin.js', review: SOURCE_REVIEW, gates: [ 'SkinOcclusion', 'SkinRegions' ]
            },
            {
                path: 'src/eye.html', name: 'Eye optics', label: 'Diagnostic',
                blurb: 'Inspect the iris, cornea and sclera while comparing the eye’s optical settings and camera angle.',
                boundary: 'An isolated eye-material study rather than a complete avatar appearance preview.',
                requirements: 'No model service needed.',
                source: 'packages/testbed/src/eye.js', review: SOURCE_REVIEW, gates: [ 'EyeMaterial', 'cornea_geometry', 'eye-optics-claims' ]
            },
            {
                path: 'src/lighting.html', name: 'Lighting rig', label: 'Diagnostic',
                blurb: 'Compare controlled lighting configurations on a still figure at portrait and full-body scales.',
                boundary: 'The figure is deliberately still. Some options introduce known lighting defects for measurement.',
                requirements: 'No model service needed.',
                source: 'packages/testbed/src/lighting.js', review: SOURCE_REVIEW, gates: [ 'LightingRig', 'GroundContact' ]
            },
            {
                path: 'src/post.html', name: 'Antialiasing and colour', label: 'Diagnostic',
                blurb: 'Compare edge smoothing, temporal rendering and colour grading with controlled motion and camera changes.',
                boundary: 'Defaults to a different rendering configuration from Portrait. Each comparison must keep its chosen settings in view.',
                requirements: 'Temporal modes require WebGPU; the page also exposes non-temporal comparisons.',
                source: 'packages/testbed/src/post.js', review: SOURCE_REVIEW, gates: [ 'Grade', 'Toksvig', 'TRAAPost' ]
            },
            {
                path: 'src/stage.html', name: 'Render buffers', label: 'Diagnostic',
                blurb: 'Inspect the renderer’s colour, depth and motion outputs using controlled objects and dedicated probes.',
                boundary: 'Coloured channels and synthetic objects are expected here; this is not an avatar appearance preview.',
                requirements: 'WebGPU is needed for the deferred render-buffer probes.',
                source: 'packages/testbed/src/stage.js', review: SOURCE_REVIEW, gates: [ 'TRAAPost', 'MorphVelocity' ]
            }
        ]
    },
    {
        id: 'integration',
        title: 'Integration checks',
        note: 'Small examples for embedding the avatar or checking browser support.',
        pages: [
            {
                path: 'src/embed-example.html', name: 'Minimal avatar', label: 'Integration example',
                blurb: 'Open the smallest example that creates an animated avatar with the public runtime API.',
                boundary: 'A minimal canvas without outfit, conversation or appearance controls.',
                requirements: 'No model service needed; available rendering quality depends on the browser.',
                source: 'packages/testbed/src/embed-example.html', review: SOURCE_REVIEW, gates: [ 'Avatar' ]
            },
            {
                path: 'src/scaffold.html', name: 'Browser support', label: 'Backend check',
                blurb: 'Render a lit sphere and inspect which graphics backend is available before loading the avatar.',
                boundary: 'A sphere is the intended result. Passing this check does not verify the complete avatar pipeline.',
                requirements: 'WebGPU or WebGL2.',
                source: 'packages/testbed/src/main.js', review: SOURCE_REVIEW, gates: []
            }
        ]
    },
    {
        id: 'reference',
        title: 'Reference and experiments',
        note: 'Preserved tools for reproducible comparisons and unfinished material research.',
        pages: [
            {
                path: 'alive.html', name: 'Alive acceptance rig', label: 'Reference harness',
                blurb: 'Revisit the instrumented avatar used for motion gates, controlled captures and historical visual comparisons.',
                boundary: 'Preserves extensive experiment and defect switches. Its historical results do not certify every current preview.',
                requirements: 'No model service needed for the default page.',
                source: 'packages/testbed/src/alive.js', review: SOURCE_REVIEW,
                gates: [ 'alive-toggles', 'alive-capture-determinism', 'tools/critic/measure.mjs' ]
            },
            {
                path: 'src/fabric.html', name: 'Fabric weave', label: 'Material experiment',
                blurb: 'Explore generated cloth maps and their highlights while varying weave and fabric parameters.',
                boundary: 'A material experiment; its results are not a finished outfit or a wardrobe-wide upgrade.',
                requirements: 'No model service needed.',
                source: 'packages/testbed/src/fabric.js', review: SOURCE_REVIEW, gates: []
            }
        ]
    }
];

export const ALL_PAGES = PAGE_GROUPS.flatMap( group => group.pages );

/** Developer commands are names checked against package.json by the catalogue gate. */
export const COMMANDS = [
    { group: 'Preview', items: [
        { run: 'npm run dev', does: 'Start the testbed. Use the local address printed by the server; the port may vary.' },
        { run: 'npm run spikes', does: 'Serve the separate research pages under tools/spikes.' }
    ] },
    { group: 'Validate', items: [
        { run: 'npm run selftests', does: 'Run the repository gate runner. Read its failures and coverage; a completed run does not imply every gate passed.' },
        { run: 'npm run critic', does: 'Measure the objective image gates on a captured plate.' },
        { run: 'npm run verify:glb', does: 'Check the structure of the shipped GLB assets.' }
    ] },
    { group: 'Build', items: [
        { run: 'npm run build:pages', does: 'Compile every testbed page. This checks imports and build output, not live browser behaviour or external services.' },
        { run: 'npm run figure', does: 'Rebuild figure and wardrobe assets through Blender; this changes the asset inputs.' }
    ] }
];
