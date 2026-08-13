/**
 * hair.js — the page where somebody LOOKS at punch-list 3.6's groom.
 *
 * ## Why this page exists when `verify_glb.mjs` already passes
 *
 * The gate measures the exported file: at g050 today, 294 quad-strip cards, two cap shells, zero
 * vertices inside the body with a 3.117 mm nearest approach, and 99.98% of the cranium hidden
 * through the CUTOUT rather than through the triangles. Every one of those numbers is true of a
 * groom that looks like a helmet made of ribbons, and LEARNINGS §1.2 — the most-cited entry in
 * that file — is exactly this: a selftest proves the numbers and is structurally blind to whether
 * the picture is right. So this page draws the thing, from five fixed angles including the one
 * that catches a bald crown, and prints the atlas beside it.
 *
 * 🎯 **AND THAT BLINDNESS WAS DEMONSTRATED, NOT ARGUED.** A blind critic shown this page named
 * three launch blockers the gate had passed: a dead-straight card border slicing the eyebrow, a
 * lit scalp at the parting, and a staircase at every strand tip. The coverage clause read
 * 99.14–100.00% throughout, because it asked 257 cranium VERTICES along their own normals and
 * blended the alpha where the material masks it. `verify_glb.mjs` now samples the cranium's
 * surface at 4 mm, applies the cutoff, fails on the largest CONNECTED exposed patch rather than on
 * a mean, and casts from the five camera angles this file's VIEWS define — which is the clause
 * that found the parting, at 229.1 mm² seen from the front.
 *
 * Capture the five plates with:
 *   node tools/figure-pipeline/hair_shots.mjs --out captures/hair
 *
 * ⚠️ **THIS IS NOT THE HAIR SHADER, and the page says so on screen.** Punch-list 3.5 owns the
 * anisotropic strand model, the transmission and the per-strand occlusion, and it runs after 3.6.
 * What is drawn here is the geometry under a deliberately plain material: the cutout, the strand
 * normal map, and nothing else. Judge the SHAPE here — the silhouette, the parting, whether the
 * scalp shows, whether a card intersects the ear — and judge the SHADING on 3.5's page.
 *
 * Deliberately self-contained rather than built on `Stage`. The deferred G-buffer carries the skin
 * material, the GTAO tier and the tone curve, and every one of them is another thing between a
 * card's silhouette and the eye; this page wants the geometry with as little between as possible,
 * and it must not go red when another agent changes a render pass it does not use.
 *
 *   npm run dev  ->  http://localhost:5173/src/hair.html
 */

import {
    AmbientLight,
    Box3,
    Color,
    DirectionalLight,
    PerspectiveCamera,
    Scene,
    Vector3,
    WebGPURenderer
} from 'three/webgpu';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const WIDTH = 720;
const HEIGHT = 900;

const FIGURE_URL = new URL( '../../../assets/figures/figure_g050.glb', import.meta.url ).href;
const HAIR_URL = new URL( '../../../assets/hair/bob01/g050.glb', import.meta.url ).href;
const HAIR_MANIFEST_URL = new URL( '../../../assets/hair/manifest.json', import.meta.url ).href;
const HAIR_DIRECTORY = new URL( '../../../assets/hair/bob01/', import.meta.url ).href;

/**
 * The four angles, and each one is here because it catches something the others cannot.
 *
 *   front         the fringe, the parting, and whether hair is across the eyes
 *   three-quarter the framing angle a judge plate is captured at
 *   side          the silhouette — the one view where "helmet" is unmistakable
 *   top           the crown. ⚠️ This is the view that found the bald patch the scalp cap exists
 *                 to fix, and it is the only view that could have.
 */
const VIEWS = [
    { name: 'front', azimuth: 0, elevation: 0.04, distance: 0.78 },
    { name: 'three-quarter', azimuth: 40, elevation: 0.05, distance: 0.80 },
    { name: 'side', azimuth: 90, elevation: 0.03, distance: 0.80 },
    { name: 'back', azimuth: 180, elevation: 0.05, distance: 0.80 },
    { name: 'top', azimuth: 0, elevation: 0.62, distance: 0.62 }
];

const hud = document.getElementById( 'hud' );
let hudText = '';

function log( line = '' ) {

    hudText += `${ line }\n`;
    hud.textContent = hudText;

}

main().catch( ( error ) => {

    log( `FAILED — ${ error.message }` );
    console.error( error );

} );

async function main() {

    const manifest = await ( await fetch( HAIR_MANIFEST_URL ) ).json();
    const groom = manifest.grooms[ 0 ];

    const canvas = document.getElementById( 'stage' );
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    const renderer = new WebGPURenderer( { canvas, antialias: true, alpha: false } );
    renderer.setPixelRatio( 1 );
    renderer.setSize( WIDTH, HEIGHT, false );
    await renderer.init();

    const backend = renderer.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL2';

    const scene = new Scene();
    scene.background = new Color( 0x14161a );

    const loader = new GLTFLoader();
    const figure = await loader.loadAsync( FIGURE_URL );
    const hair = await loader.loadAsync( HAIR_URL );

    scene.add( figure.scene );
    scene.add( hair.scene );

    // Head-height, off the HAIR's own bounds rather than off a constant. The groom is the subject;
    // framing it from a number typed here would be wrong the first time the style changed.
    const bounds = new Box3().setFromObject( hair.scene );
    const centre = bounds.getCenter( new Vector3() );

    const camera = new PerspectiveCamera( 38, WIDTH / HEIGHT, 0.05, 20 );

    // Three lights and no environment. A rim behind and above is what makes a hair silhouette
    // legible — it is the light that separates a card's edge from the head — and its absence is
    // why an unlit groom always looks like a solid mass.
    const key = new DirectionalLight( 0xfff2e4, 2.6 );
    const rim = new DirectionalLight( 0xcfe0ff, 3.4 );
    const fill = new AmbientLight( 0x66707f, 0.55 );
    scene.add( key, rim, fill );

    let view = VIEWS[ 1 ];

    function place() {

        const angle = view.azimuth * Math.PI / 180;
        const flat = Math.cos( Math.asin( Math.min( 1, view.elevation * 1.4 ) ) );

        camera.position.set(
            centre.x + Math.sin( angle ) * view.distance * flat,
            centre.y + view.distance * view.elevation * 1.4,
            centre.z + Math.cos( angle ) * view.distance * flat
        );
        camera.lookAt( centre );

        key.position.copy( camera.position ).add( new Vector3( 0.5, 0.6, 0.2 ) );
        rim.position.copy( centre ).addScaledVector(
            camera.position.clone().sub( centre ).normalize(), - 1.0 );
        rim.position.y += 0.9;
        key.target.position.copy( centre );
        rim.target.position.copy( centre );
        scene.add( key.target, rim.target );

        return renderer.renderAsync( scene, camera );

    }

    /**
     * The hook a capture script drives the page through, because clicking a button and guessing
     * how long the render took is how a before/after pair ends up comparing two different frames.
     * Awaits the actual `renderAsync`, so the canvas is finished when this resolves.
     *
     *   node tools/figure-pipeline/hair_shots.mjs --out /tmp/before
     */
    window.hairShot = async ( name ) => {

        const wanted = VIEWS.find( ( candidate ) => candidate.name === name );
        if ( wanted === undefined ) throw new Error( `no view named '${ name }'` );

        view = wanted;
        await place();
        return { name, width: WIDTH, height: HEIGHT };

    };

    const views = document.getElementById( 'views' );
    for ( const candidate of VIEWS ) {

        const button = document.createElement( 'button' );
        button.textContent = candidate.name;
        button.setAttribute( 'aria-pressed', String( candidate === view ) );
        button.addEventListener( 'click', () => {

            view = candidate;
            for ( const other of views.children ) {

                other.setAttribute( 'aria-pressed', String( other === button ) );

            }
            place();

        } );
        views.appendChild( button );

    }

    place();

    // --- the atlas, beside the render ----------------------------------------------------------
    //
    // All four sheets, including the two the GLB does NOT carry. A shader author arriving at 3.5
    // needs to see that `flow` and `depth` exist and what is in them; a manifest entry naming a
    // file is a claim, and an <img> pointed at it is the file.
    const maps = document.getElementById( 'maps' );
    for ( const [ name, entry ] of Object.entries( groom.maps ) ) {

        const figureElement = document.createElement( 'figure' );
        const image = document.createElement( 'img' );
        image.src = HAIR_DIRECTORY + entry.file;
        image.alt = `${ name }: ${ entry.channels }`;
        const caption = document.createElement( 'figcaption' );
        caption.textContent = `${ name }${ entry.embedded ? '' : ' (sidecar)' }`;
        figureElement.append( image, caption );
        maps.appendChild( figureElement );

    }

    // --- what the page can say for itself --------------------------------------------------------
    let triangles = 0;
    let vertices = 0;

    hair.scene.traverse( ( object ) => {

        if ( ! object.isMesh ) return;

        const position = object.geometry.attributes.position;
        vertices += position.count;
        triangles += object.geometry.index.count / 3;

    } );

    log( `Renderer            : ${ backend }` );
    log( `Groom               : ${ groom.id } — ${ groom.description }` );
    log( `Figure              : ${ FIGURE_URL.split( '/' ).pop() }` );
    log();
    log( `geometry            : ${ vertices.toLocaleString() } verts, ` +
        `${ triangles.toLocaleString() } triangles` );
    log( `material            : ${ groom.alphaMode }, cutoff ${ groom.alphaCutoff }, ` +
        `${ groom.doubleSided ? 'double sided' : 'backface culled' }` );
    log( `skinned to          : ${ groom.bone }` );
    log( `atlas               : ${ groom.atlas.size }², ${ groom.atlas.strips } strips, ` +
        `cap strip ${ groom.atlas.capStrip }` );
    log();
    log( `!! THIS IS NOT THE HAIR SHADER. Punch-list 3.5 owns the` );
    log( `anisotropic strand model and runs after this. What is drawn here is a plain` );
    log( `Principled material with the generated albedo + normal sheets, so that the` );
    log( `GEOMETRY can be judged without a shader in front of it.` );
    log();
    log( `What to look for, in the order it goes wrong:` );
    log( `  3/4    does a STRAIGHT line cross the brow, the lid or the cheekbone? That is a` );
    log( `         card's own quad edge, and it is the defect this round was about.` );
    log( `  side   is the silhouette hair, or a helmet with ribbon edges?` );
    log( `  top    does the scalp show between the cards? That is what the cap is for.` );
    log( `  front  is the parting readable, and is hair across the eyes?` );
    log( `  back   do the cards end in a line, or in a ragged edge?` );
    log();
    log( `The numbers are gated elsewhere and none of them can answer any of the above:` );
    log( `  node tools/figure-pipeline/verify_glb.mjs assets/hair/bob01/g050.glb` );

}
