import { defineConfig } from 'vite';

// The spike pages live outside packages/testbed, so they cannot be served by the main config
// (which roots vite at the testbed and therefore SPA-falls-back to index.html for /tools/*,
// returning HTTP 200 with the wrong page). Root at the repo instead.
//
//   npm run spikes   ->  http://localhost:5173/tools/spikes/morph-cost.html
//                        http://localhost:5173/tools/spikes/rectarea-cost.html

// 🚩 NO `server.open`, AND ITS REMOVAL IS THE POINT.
//
// This config used to end `server: { open: '/tools/spikes/' }`. That is right for a human typing
// `npm run spikes` and wrong for everything else, because `createServer({ configFile })` INHERITS
// it — so `frame-budget.mjs` and `strand-spike.mjs`, both headless timing harnesses, launched a tab
// in the owner's real browser on every run. It pointed at a bare directory with no `index.html`, so
// the tab rendered nothing, and the owner reasonably wondered whether the blank pages were part of
// a measurement. They were not.
//
// Patching each caller with `open: false` was the first fix and it leaves the footgun armed for the
// next one. The convenience belonged to one npm script, so it lives there now and vite still prints
// the URL on startup either way.
export default defineConfig( {
    root: '.'
} );
