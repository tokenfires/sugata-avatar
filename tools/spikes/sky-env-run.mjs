#!/usr/bin/env node
//
// sky-env-run.mjs — drives tools/spikes/sky-env.html headlessly and takes the pictures.
//
// `run.mjs` scrapes the Phase 0 spikes and is the right tool for a cost curve. This spike's
// headline is not a curve: it is "the object goes black when the environment is removed", and that
// is a claim about PIXELS. So this runner does what run.mjs does — start vite at the repo root,
// launch the real Chromium in new-headless mode so there is a GPU, scrape
// `window.__SPIKE_RESULTS__` — and then additionally calls `window.skyEnvShot( name )` for each
// arm and writes one PNG of the canvas per arm, so the red proof can be LOOKED at.
//
// Playwright is looked up the way capture.mjs and run.mjs look it up, and for the same reason: it
// is a development instrument, not a dependency of the build.
//
//   node tools/spikes/sky-env-run.mjs
//   node tools/spikes/sky-env-run.mjs --out /tmp/shots --query "pmrem=512&frames=60"

import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

// 🚩 fileURLToPath, never string surgery on import.meta.url: this repository's own path carries a
// space and a CJK character, and `.replace('file://','')` hands back a directory that is not there.
const SPIKE_DIRECTORY = path.dirname( fileURLToPath( import.meta.url ) );
const REPOSITORY_ROOT = path.resolve( SPIKE_DIRECTORY, '..', '..' );
const RESULTS_DIRECTORY = path.join( SPIKE_DIRECTORY, 'results' );

const PAGE_TIMEOUT_MS = 20 * 60 * 1000;

// Measured in run.mjs, not guessed here: WebGPU comes up headless on the real Metal adapter with
// these two flags and no others, and `--enable-features=Vulkan,WebGPU` REMOVES WebGPU on macOS.
const GPU_FLAGS = [ '--enable-unsafe-webgpu', '--ignore-gpu-blocklist' ];

main().catch( ( error ) => {
  console.error( '\nsky-env-run.mjs failed:', error );
  process.exitCode = 1;
} );

async function main() {
  const options = parseArguments( process.argv.slice( 2 ) );
  const playwright = await loadPlaywright( options.playwrightPath );

  fs.mkdirSync( options.out, { recursive: true } );
  fs.mkdirSync( RESULTS_DIRECTORY, { recursive: true } );

  const server = await createServer( {
    root: REPOSITORY_ROOT,
    server: { port: 5198, strictPort: false },
    logLevel: 'warn'
  } );
  await server.listen();
  const baseUrl = server.resolvedUrls.local[ 0 ].replace( /\/$/, '' );
  const url = `${ baseUrl }/tools/spikes/sky-env.html${ options.query ? '?' + options.query : '' }`;
  console.log( `vite serving ${ REPOSITORY_ROOT }\n${ url }\n` );

  const browser = await playwright.chromium.launch( {
    channel: 'chromium',           // headless_shell has no GPU and therefore no WebGPU
    headless: options.headless,
    args: GPU_FLAGS
  } );

  try {
    const page = await browser.newPage( { viewport: { width: 1440, height: 1200 } } );
    const problems = [];
    // ⚠️ A page CRASH is a real outcome here and not a runner bug: an uncaptured WebGPU validation
    // error repeated per frame loses the device and takes the tab with it. Recorded rather than
    // swallowed, because "the tab died" is the finding in that case.
    let crashed = false;
    page.on( 'crash', () => { crashed = true; problems.push( 'PAGE CRASHED (renderer process gone)' ); } );
    page.on( 'pageerror', ( error ) => problems.push( String( error ) ) );
    page.on( 'console', ( message ) => {
      if ( message.type() === 'error' ) problems.push( message.text() );
      if ( message.text().startsWith( 'SPIKE_RESULT ' ) === false && options.verbose ) {
        console.log( '  [page] ' + message.text().slice( 0, 300 ) );
      }
    } );

    // ⚠️ `waitUntil: 'load'` times out here where it does not on the Phase 0 spikes. This page
    // pulls three, SkyMesh, GLTFLoader and an 11.5 MB GLB through a COLD vite dep-optimise, and the
    // load event waits for the lot. `domcontentloaded` plus the page's own `__SPIKE_DONE__` flag is
    // the honest wait: the page tells us when it is finished rather than the browser guessing.
    await page.goto( url, { waitUntil: 'domcontentloaded', timeout: 120000 } );

    // The page publishes `__SPIKE_DONE__` on success AND on failure, so this never hangs on a throw.
    await page.waitForFunction( 'window.__SPIKE_DONE__ === true', null, { timeout: PAGE_TIMEOUT_MS } );

    let results;
    try {
      results = await page.evaluate( () => window.__SPIKE_RESULTS__ );
    } catch ( error ) {
      console.error( '\ncould not read results: ' + error.message );
      console.error( crashed ? 'the page crashed — see the console errors above' : '' );
      for ( const problem of problems.slice( 0, 8 ) ) console.error( '  ' + problem );
      process.exitCode = 1;
      return;
    }
    const resultsFile = path.join( RESULTS_DIRECTORY, 'sky-env.json' );
    fs.writeFileSync( resultsFile, JSON.stringify( results, null, 2 ) );
    console.log( `results -> ${ path.relative( REPOSITORY_ROOT, resultsFile ) }` );

    if ( results.failed === true ) {
      console.error( '\nSPIKE FAILED:\n' + results.error );
      for ( const problem of problems ) console.error( '  ' + problem );
      process.exitCode = 1;
      return;
    }

    printSummary( results );

    // A full-page screenshot of the tables, then the canvas per arm. The tables are evidence too:
    // a number quoted without the page it came off is a number nobody can re-derive.
    await page.screenshot( { path: path.join( options.out, 'page.png' ), fullPage: true } );

    const shots = await page.evaluate( () => window.skyEnvShotNames ?? [] );
    const canvas = page.locator( '#viewport' );
    for ( const shot of shots ) {
      await page.evaluate( ( name ) => window.skyEnvShot( name ), shot );
      const file = path.join( options.out, `${ shot }.png` );
      await canvas.screenshot( { path: file } );
      console.log( `shot      ${ shot.padEnd( 14 ) } ${ path.relative( REPOSITORY_ROOT, file ) }` );
    }

    if ( problems.length > 0 ) {
      console.log( '\npage errors and warnings:' );
      for ( const problem of problems ) console.log( '  ' + problem );
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

function printSummary( results ) {
  const proof = results.redProof;
  console.log( '\n--- §A red proof ---' );
  for ( const arm of proof.arms ) {
    const masks = arm.masks.map( ( mask ) => `${ mask.label }=${ mask.mean.toExponential( 3 ) }` ).join( '  ' );
    console.log( `  ${ arm.arm.padEnd( 20 ) } frame=${ arm.frameMean.toExponential( 3 ) }  ${ masks }` );
  }
  console.log( '  verdict: ' + JSON.stringify( proof.verdict ) );

  console.log( '\n--- §B bake ---' );
  for ( const row of results.bake.rows ) {
    console.log(
      `  ${ String( row.size ).padStart( 4 ) }  first ${ row.firstIdleMs.toFixed( 1 ) } ms   ` +
      `steady ${ row.idleMs.toFixed( 1 ) } ms   ${ ( row.bytesMeasured / 1048576 ).toFixed( 2 ) } MB`
    );
  }

  // Sections the run skipped (`?only=`) come back null. Printing them as "skipped" rather than
  // crashing keeps a narrow diagnostic run readable, and keeps a missing section visible instead of
  // letting an absent number read as a zero.
  if ( results.rebakeSurvival !== null ) {
    console.log( '\n--- §D0 re-bake survival ---' );
    for ( const step of results.rebakeSurvival.steps ) {
      console.log( `  disc ${ step.diffuseMean.toFixed( 5 ).padStart( 9 ) }  ` +
                   `atlas ${ ( step.atlasMean === null ? '—' : step.atlasMean.toFixed( 5 ) ).padStart( 9 ) }  ` +
                   `${ step.step }` );
    }
    console.log( `  re-bake into the live target survives: ${ results.rebakeSurvival.rebakeIntoLiveTargetSurvives }` );
    console.log( `  re-bake tracks the sun:                ${ results.rebakeSurvival.rebakeTracksTheSun }` );
    console.log( `  orphaned sky goes red:                 ${ results.rebakeSurvival.orphanedSkyGoesRed }` );
    console.log( `  recovers on re-parent:                 ${ results.rebakeSurvival.orphanRecoversOnReparent }` );
  }

  if ( results.frameCost !== null ) {
    console.log( '\n--- §C per frame ---' );
    for ( const measurement of results.frameCost.measurements ) {
      console.log(
        `  ${ measurement.variant.padEnd( 10 ) } gpu ${ formatOrDash( measurement.gpuMedianMs ) } ms   ` +
        `Δ ${ formatOrDash( measurement.gpuDeltaVsBlackMs ) } ms`
      );
    }
  }

  if ( results.rebake !== null ) {
    console.log( '\n--- §D sun moved ---' );
    console.log( `  re-bake median ${ results.rebake.medianReuseIdleMs.toFixed( 1 ) } ms into the same target` );
  }
  if ( results.environmentRotation !== null ) {
    console.log( `  rotation: left/right ratio swings ${ formatOrDash( results.environmentRotation.ratioSwingAcrossYaw ) }x, ` +
                 `whole-disc mean swings ${ formatOrDash( results.environmentRotation.discMeanSwingAcrossYaw ) }x` );
  }

  if ( results.backgroundFidelity !== null && results.backgroundFidelity !== undefined ) {
    console.log( '\n--- §F backdrop fidelity (sun in frame) ---' );
    for ( const arm of results.backgroundFidelity.arms ) {
      console.log( `  px>100 ${ String( arm.footprint[ 0 ] ).padStart( 6 ) }  ` +
                   `px>1k ${ String( arm.footprint[ 1 ] ).padStart( 6 ) }  ` +
                   `px>10k ${ String( arm.footprint[ 2 ] ).padStart( 6 ) }  ` +
                   `peak ${ arm.peak.toFixed( 0 ).padStart( 6 ) }  ${ arm.arm }` );
    }
    console.log( `  PMREM footprint ÷ SkyMesh at each threshold: ` +
                 results.backgroundFidelity.footprintRatioPmremOverSky.map( formatOrDash ).join( ', ' ) );
    console.log( `  peak statistic clipped at the half-float ceiling: ${ results.backgroundFidelity.peakIsClipped }` );
  }

  if ( results.sunValidation !== null ) {
    console.log( '\n--- §E sun model ---' );
    const validation = results.sunValidation;
    console.log( `  sky only ${ validation.skyOnlyDiffuse.toExponential( 3 ) }   ` +
                 `+ baked disc ${ validation.bakedDiscDiffuse.toExponential( 3 ) }   ` +
                 `+ analytic key ${ validation.analyticKeyDiffuse.toExponential( 3 ) }` );
    console.log( `  cube captured ${ validation.discEnergyCapturedByCube === null ? 'n/a'
      : ( validation.discEnergyCapturedByCube * 100 ).toFixed( 1 ) + '%' } of the analytic sun's energy` );
  }
  console.log( `  shot exposure ${ results.configuration.shotExposure.toFixed( 4 ) }` );
}

function formatOrDash( value ) {
  return value === null || value === undefined ? '  —  ' : value.toFixed( 3 );
}

function parseArguments( argv ) {
  const options = {
    out: path.join( REPOSITORY_ROOT, 'tools', 'spikes', 'results', 'sky-env-shots' ),
    query: '',
    headless: true,
    verbose: false,
    playwrightPath: null
  };

  for ( let index = 0; index < argv.length; index ++ ) {
    const argument = argv[ index ];
    if ( argument === '--out' ) options.out = path.resolve( argv[ ++ index ] );
    else if ( argument === '--query' ) options.query = argv[ ++ index ];
    else if ( argument === '--headed' ) options.headless = false;
    else if ( argument === '--verbose' ) options.verbose = true;
    else if ( argument === '--playwright' ) options.playwrightPath = argv[ ++ index ];
    else throw new Error( 'unknown argument: ' + argument );
  }

  return options;
}

async function loadPlaywright( explicitPath ) {
  const candidates = [];
  if ( explicitPath ) candidates.push( explicitPath );
  if ( process.env.PLAYWRIGHT_MODULE ) candidates.push( process.env.PLAYWRIGHT_MODULE );
  candidates.push( 'playwright' );
  candidates.push( ...findPlaywrightInNpxCache() );

  const require = createRequire( import.meta.url );

  for ( const candidate of candidates ) {
    try {
      const resolved = require.resolve( candidate );
      const namespace = await import( pathToFileURL( resolved ).href );
      if ( namespace && namespace.chromium ) return namespace;
      if ( namespace && namespace.default && namespace.default.chromium ) return namespace.default;
    } catch {
      // next candidate; only a total failure is worth reporting
    }
  }

  throw new Error(
    'playwright not resolvable. Install it somewhere and pass --playwright <path>, e.g.\n' +
    '  npm i --prefix /tmp/pw playwright && npx --prefix /tmp/pw playwright install chromium'
  );
}

function findPlaywrightInNpxCache() {
  const cache = path.join( process.env.HOME ?? '', '.npm', '_npx' );
  if ( fs.existsSync( cache ) === false ) return [];

  return fs.readdirSync( cache )
    .map( ( entry ) => path.join( cache, entry, 'node_modules', 'playwright' ) )
    .filter( ( candidate ) => fs.existsSync( candidate ) );
}
