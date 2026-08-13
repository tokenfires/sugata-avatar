// Headless runner for the Phase 0 spikes.
//
// Starts vite programmatically, drives each spike page in Chromium with the GPU enabled,
// scrapes `window.__SPIKE_RESULTS__`, and writes the JSON to tools/spikes/results/.
//
// Two things this runner exists to get right:
//
//   1. Headless Chromium normally runs `headless_shell`, which has no GPU at all and would
//      quietly fall through to SwiftShader. Passing `channel: 'chromium'` selects the full
//      browser in new-headless mode, which does have one. The runner still checks the
//      adapter string afterwards and refuses to present software-rasterised numbers as real.
//   2. Playwright is intentionally not a dependency of this repo. Point the runner at an
//      installation with --playwright or PLAYWRIGHT_MODULE, e.g.
//        npm i --prefix /tmp/pw playwright && npx --prefix /tmp/pw playwright install chromium
//        node tools/spikes/run.mjs --playwright /tmp/pw/node_modules/playwright
//
// Usage:
//   node tools/spikes/run.mjs [--mode auto|headless|headed] [--webgl] [--playwright <path>]

import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SPIKE_DIRECTORY = path.dirname( fileURLToPath( import.meta.url ) );
const REPOSITORY_ROOT = path.resolve( SPIKE_DIRECTORY, '..', '..' );
const RESULTS_DIRECTORY = path.join( SPIKE_DIRECTORY, 'results' );

const PAGE_TIMEOUT_MS = 20 * 60 * 1000; // a full sweep is minutes of real rendering

// Measured on macOS with Chromium 151, not assumed. Three findings worth keeping:
//
//   - WebGPU comes up headless on the real Apple Metal adapter with no flags at all, and
//     exposes `timestamp-query`. Resist adding more flags; two of the obvious ones hurt.
//   - `--enable-features=Vulkan,WebGPU` *removes* WebGPU on macOS. It replaces the default
//     feature set and asks for a backend that does not exist there, so `navigator.gpu` ends
//     up undefined and the run silently degrades to WebGL2.
//   - `--disable-frame-rate-limit` halves the headless rAF rate (121 fps -> 58 fps) instead
//     of unthrottling it. It is not the escape hatch it sounds like.
//
// WebGPU also needs a secure context: `about:blank` does not qualify, `http://localhost` does.
// That is why the runner always serves the pages through vite rather than from file://.
const GPU_FLAGS = [
  '--enable-unsafe-webgpu',
  '--ignore-gpu-blocklist'
];

const SPIKE_RUNS = [
  { name: 'morph-cost', page: 'morph-cost.html', query: '' },
  { name: 'morph-cost-with-normals', page: 'morph-cost.html', query: 'normals=1' },
  { name: 'rectarea-cost-720p', page: 'rectarea-cost.html', query: 'width=1280&height=720' },
  { name: 'rectarea-cost-1080p', page: 'rectarea-cost.html', query: 'width=1920&height=1080' },
  { name: 'hair-motion', page: 'hair-motion.html', query: '' }
];

// Which field of a measurement names the variant, per spike. Only the summary printer needs it.
const VARIANT_KEY = {
  'morph-cost': 'morphTargets',
  'rectarea-cost': 'rectAreaLights',
  'hair-motion': 'variant'
};

main().catch( ( error ) => {
  console.error( '\nrun.mjs failed:', error );
  process.exitCode = 1;
} );

async function main() {
  const options = parseArguments( process.argv.slice( 2 ) );
  const playwright = await loadPlaywright( options.playwrightPath );

  const server = await createServer( {
    root: REPOSITORY_ROOT,
    server: { port: 5199, strictPort: false },
    logLevel: 'warn'
  } );
  await server.listen();
  const baseUrl = server.resolvedUrls.local[ 0 ].replace( /\/$/, '' );
  console.log( `vite serving ${ REPOSITORY_ROOT } at ${ baseUrl }` );

  await mkdir( RESULTS_DIRECTORY, { recursive: true } );

  const launchAttempts = options.mode === 'auto'
    ? [ { headless: true }, { headless: false } ]
    : [ { headless: options.mode === 'headless' } ];

  let browser = null;
  let launchDescription = '';

  for ( const attempt of launchAttempts ) {
    try {
      browser = await playwright.chromium.launch( {
        channel: 'chromium', // the real browser, not headless_shell — headless_shell has no GPU
        headless: attempt.headless,
        args: GPU_FLAGS
      } );
      launchDescription = attempt.headless ? 'headless (channel=chromium)' : 'headed (channel=chromium)';
      break;
    } catch ( error ) {
      console.warn( `launch attempt (headless=${ attempt.headless }) failed: ${ error.message }` );
    }
  }

  if ( browser === null ) {
    await server.close();
    throw new Error( 'Could not launch Chromium. Run: npx playwright install chromium' );
  }

  console.log( `chromium launched ${ launchDescription }` );

  const summaries = [];

  for ( const run of SPIKE_RUNS ) {
    const query = [ run.query, options.forceWebGL ? 'forceWebGL=1' : '' ]
      .filter( Boolean )
      .join( '&' );
    const url = `${ baseUrl }/tools/spikes/${ run.page }${ query ? '?' + query : '' }`;

    console.log( `\n--- ${ run.name } ---\n${ url }` );

    const suffix = options.forceWebGL ? '.webgl2' : '';
    const screenshotPath = path.join( RESULTS_DIRECTORY, `${ run.name }${ suffix }.png` );

    const result = await runSpikePage( browser, url, screenshotPath );
    await writeFile(
      path.join( RESULTS_DIRECTORY, `${ run.name }${ suffix }.json` ),
      JSON.stringify( result, null, 2 ) + '\n'
    );

    summaries.push( { name: run.name, result } );
    printSummary( run.name, result );
  }

  await browser.close();
  await server.close();

  console.log( `\nResults written to ${ RESULTS_DIRECTORY }` );

  const anyFailure = summaries.some( ( entry ) => entry.result.failed === true );
  if ( anyFailure ) process.exitCode = 1;
}

/**
 * Loads one page, waits for the sweep to publish, and returns the scraped payload. A screenshot
 * is saved next to the JSON so the visual evidence and the numbers always come from the same run
 * — a stale picture beside fresh figures is how a benchmark starts lying.
 */
async function runSpikePage( browser, url, screenshotPath ) {
  const page = await browser.newPage( { viewport: { width: 1500, height: 1400 } } );

  page.on( 'console', ( message ) => {
    const text = message.text();
    if ( text.startsWith( 'SPIKE_RESULT ' ) ) return; // captured from the page global instead
    if ( message.type() === 'error' || message.type() === 'warning' ) {
      console.log( `  [page ${ message.type() }] ${ text }` );
    }
  } );
  page.on( 'pageerror', ( error ) => console.log( `  [pageerror] ${ error.message }` ) );

  await page.goto( url, { waitUntil: 'domcontentloaded' } );

  try {
    await page.waitForFunction( () => globalThis.__SPIKE_DONE__ === true, null, {
      timeout: PAGE_TIMEOUT_MS,
      polling: 1000
    } );
  } catch ( error ) {
    await page.close();
    return { failed: true, error: `page never published results: ${ error.message }`, url };
  }

  const result = await page.evaluate( () => globalThis.__SPIKE_RESULTS__ );
  await page.screenshot( { path: screenshotPath, fullPage: true } );
  await page.close();
  return result;
}

/** Prints the shape of the curve so a run is readable without opening the JSON. */
function printSummary( name, result ) {
  if ( result.failed ) {
    console.log( `  FAILED: ${ result.error }` );
    return;
  }

  const environment = result.environment;
  console.log( `  backend: ${ environment.backend }   adapter: ${ environment.adapter }` );
  console.log( `  GPU timestamps: ${ environment.timestampsAvailable ? 'available' : 'UNAVAILABLE — ' + environment.timestampNote }` );

  if ( result.softwareRendererSuspected ) {
    console.log( '  *** SOFTWARE RASTERISER DETECTED — these numbers are not usable as a budget ***' );
  }

  const variableKey = VARIANT_KEY[ result.spike ] ?? 'rectAreaLights';

  // hair-motion's headline is a COMPUTE timestamp, not a render one, so it prints its own row.
  if ( result.spike === 'hair-motion' ) {
    for ( const measurement of result.measurements ) {
      console.log(
        `  ${ String( measurement.variant ).padEnd( 44 ) }  ` +
        `compute ${ formatOrDash( measurement.computeMedianMs ) } ms   ` +
        `per pass ${ formatOrDash( measurement.computeMsPerPass ) } ms   ` +
        `render ${ formatOrDash( measurement.renderMedianMs ) } ms   ` +
        `(n=${ measurement.computeSampleCount })`
      );
    }
    for ( const baseline of result.cpuBaselines ?? [] ) {
      console.log(
        `  ${ String( baseline.solver ).padEnd( 44 ) }  ` +
        `cpu     ${ formatOrDash( baseline.medianMs ) } ms   ` +
        `p95 ${ formatOrDash( baseline.p95Ms ) } ms`
      );
    }
    return;
  }

  for ( const measurement of result.measurements ) {
    const gpu = measurement.gpuMedianMs;
    const delta = measurement.gpuDeltaVsZeroMs;
    console.log(
      `  ${ String( measurement[ variableKey ] ).padStart( 3 ) }  ` +
      `gpu ${ formatOrDash( gpu ) } ms   ` +
      `delta ${ formatOrDash( delta ) } ms   ` +
      `wall ${ formatOrDash( measurement.wallFrameMedianMs ) } ms   ` +
      `(n=${ measurement.gpuSampleCount })`
    );
  }
}

function formatOrDash( value ) {
  return value === null || value === undefined ? '  n/a ' : value.toFixed( 3 ).padStart( 7 );
}

function parseArguments( argv ) {
  const options = { mode: 'auto', forceWebGL: false, playwrightPath: process.env.PLAYWRIGHT_MODULE || null };

  for ( let index = 0; index < argv.length; index ++ ) {
    if ( argv[ index ] === '--mode' ) options.mode = argv[ ++ index ];
    else if ( argv[ index ] === '--webgl' ) options.forceWebGL = true;
    else if ( argv[ index ] === '--playwright' ) options.playwrightPath = argv[ ++ index ];
  }

  return options;
}

/**
 * Resolves playwright from wherever it happens to live. It is deliberately not a dependency
 * of this repo — the spikes are a one-off measurement, not part of the build.
 */
async function loadPlaywright( explicitPath ) {
  if ( explicitPath ) {
    const require = createRequire( import.meta.url );
    const resolved = require.resolve( explicitPath );
    return unwrapCommonJs( await import( pathToFileURL( resolved ).href ) );
  }

  try {
    return unwrapCommonJs( await import( 'playwright' ) );
  } catch {
    throw new Error(
      'playwright not resolvable. Install it somewhere and pass --playwright <path>, e.g.\n' +
      '  npm i --prefix /tmp/pw playwright\n' +
      '  npx --prefix /tmp/pw playwright install chromium\n' +
      '  node tools/spikes/run.mjs --playwright /tmp/pw/node_modules/playwright'
    );
  }
}

/** playwright is CommonJS; importing it from ESM parks the real exports under `default`. */
function unwrapCommonJs( namespace ) {
  if ( namespace && namespace.chromium ) return namespace;
  if ( namespace && namespace.default && namespace.default.chromium ) return namespace.default;
  return namespace;
}
