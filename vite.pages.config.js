import { defineConfig, mergeConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

import base from './vite.config.js';

const testbed = fileURLToPath( new URL( 'packages/testbed/', import.meta.url ) );

/**
 * Every HTML page in the testbed, built for real.
 *
 * This exists because `npm run build` builds ONE entry — `packages/testbed/index.html`, vite's
 * default — and nothing reaches `alive.html` or anything under `src/`. A broken import in
 * `alive.js`, `post.js`, `skin.js`, `eye.js`, `lighting.js` or `stage.js` therefore passes a green
 * build, which is the worst kind of green: the page a judge captures is the page the build never
 * compiled. It had been documented as "make a temp config listing all the entries", which is
 * tribal knowledge that has to be rediscovered every round, and the page count has already grown
 * from six to eight.
 *
 * A new page under `packages/testbed/` belongs in this list on the same commit that adds it.
 *
 *   npm run build:pages
 */
const PAGES = [
    'index.html',
    'alive.html',
    'src/stage.html',
    'src/skin.html',
    'src/eye.html',
    'src/lighting.html',
    'src/post.html',
    'src/voice.html',
    'src/wardrobe.html',
    'src/fabric.html'
];

export default mergeConfig( base, defineConfig( {

    build: {
        outDir: fileURLToPath( new URL( 'dist-pages', import.meta.url ) ),
        rollupOptions: { input: PAGES.map( ( page ) => testbed + page ) }
    }

} ) );
