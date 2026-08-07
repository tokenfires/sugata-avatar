import { defineConfig } from 'vite';

// The spike pages live outside packages/testbed, so they cannot be served by the main config
// (which roots vite at the testbed and therefore SPA-falls-back to index.html for /tools/*,
// returning HTTP 200 with the wrong page). Root at the repo instead.
//
//   npm run spikes   ->  http://localhost:5173/tools/spikes/morph-cost.html
//                        http://localhost:5173/tools/spikes/rectarea-cost.html

export default defineConfig( {
    root: '.',
    server: { open: '/tools/spikes/' }
} );
