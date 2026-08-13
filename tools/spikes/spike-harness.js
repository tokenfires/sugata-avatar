// Shared plumbing for the Phase 0 performance spikes.
//
// A spike answers one question: "what does this feature cost per frame, and where
// does it stop fitting in a 16.6 ms budget?" Everything here exists to make that
// answer trustworthy rather than convenient:
//
//   - The number that matters is GPU time from a timestamp query, not wall clock.
//     rAF is vsync-locked, so wall-clock frame time floors at 16.6 ms (8.3 ms on a
//     ProMotion display) and tells you nothing until you are already over budget.
//   - Timestamp queries only produce sane per-frame totals when three.js drives the
//     loop, because `renderer.info.frame` is stamped inside `setAnimationLoop` and
//     nowhere else. A hand-rolled rAF loop makes every pass share frame id 0.
//   - When the GPU timer is unavailable (common on the WebGL2 fallback, where Chrome
//     usually withholds EXT_disjoint_timer_query_webgl2), we say so rather than
//     quietly reporting vsync-shaped wall clock as if it were cost.
//
// Results are published to `window.__SPIKE_RESULTS__` and echoed to the console with
// a `SPIKE_RESULT ` prefix so `run.mjs` can scrape them headlessly.

import * as THREE from 'three/webgpu';

// ---------------------------------------------------------------------------
// Renderer setup and provenance
// ---------------------------------------------------------------------------

/**
 * Builds the renderer and gathers everything a reader needs to judge the numbers:
 * which backend actually ran, which physical GPU answered, and whether the GPU
 * timer is available. A benchmark without its provenance is a rumour.
 */
export async function createSpikeRenderer( { canvas, width, height, forceWebGL = false } ) {
  const renderer = new THREE.WebGPURenderer( {
    canvas,
    antialias: false,
    forceWebGL,
    trackTimestamp: true
  } );

  renderer.setPixelRatio( 1 ); // fix the pixel budget so results compare across machines
  renderer.setSize( width, height, false );

  await renderer.init();

  const backend = renderer.backend;
  const usingWebGPU = backend.isWebGPUBackend === true;

  const environment = {
    backend: usingWebGPU ? 'webgpu' : 'webgl2',
    threeRevision: THREE.REVISION,
    canvasWidth: width,
    canvasHeight: height,
    pixelRatio: 1,
    devicePixelRatio: globalThis.devicePixelRatio || 1,
    userAgent: navigator.userAgent,
    adapter: await describeAdapter( renderer, usingWebGPU ),
    compatibilityMode: usingWebGPU ? backend.compatibilityMode === true : null,
    timestampsAvailable: false,
    timestampNote: ''
  };

  return { renderer, environment };
}

/**
 * Confirms the GPU timer actually produces values before a run commits to it.
 * `trackTimestamp: true` is a request, not a guarantee — the WebGL2 backend needs
 * EXT_disjoint_timer_query_webgl2, which most browsers withhold.
 */
export async function probeTimestampSupport( renderer, scene, camera, environment ) {
  const supportsFeature = environment.backend === 'webgpu'
    ? renderer.hasFeature( 'timestamp-query' )
    : renderer.backend.disjoint !== undefined && renderer.backend.disjoint !== null;

  if ( supportsFeature !== true ) {
    environment.timestampsAvailable = false;
    environment.timestampNote = environment.backend === 'webgpu'
      ? 'WebGPU adapter does not expose the timestamp-query feature.'
      : 'WebGL2 backend has no EXT_disjoint_timer_query_webgl2; GPU timing unavailable.';
    return false;
  }

  // Render a handful of frames and see whether a resolve ever returns a real number.
  for ( let attempt = 0; attempt < 30; attempt ++ ) {
    await renderOneAnimationFrame( renderer, () => renderer.render( scene, camera ) );
    const duration = await renderer.resolveTimestampsAsync( THREE.TimestampQuery.RENDER );
    if ( typeof duration === 'number' && duration > 0 ) {
      environment.timestampsAvailable = true;
      environment.timestampNote = 'GPU timestamp queries active.';
      return true;
    }
  }

  environment.timestampsAvailable = false;
  environment.timestampNote = 'Timestamp feature reported present but never resolved a non-zero duration.';
  return false;
}

// ---------------------------------------------------------------------------
// The measurement loop
// ---------------------------------------------------------------------------

/**
 * Runs one configuration and returns its timing distribution.
 *
 * The loop is driven by `renderer.setAnimationLoop` so three.js stamps a fresh frame
 * id each tick — that stamping is what makes the resolved timestamp mean "this
 * frame's GPU cost" instead of "some arbitrary window of passes".
 *
 * While a resolve is outstanding the loop renders nothing. That looks wasteful and is
 * the difference between a result and a fiction: `resolveQueriesAsync` reports the
 * total for whichever frame happens to be last in the pending set, and if several
 * ticks' worth of queries pool up before a resolve lands, that total no longer
 * corresponds to the passes you divided by. Skipping ticks guarantees at most one
 * tick is ever pending, so every sample means exactly one tick's passes.
 *
 * The cost is that gathering N samples takes two to three times N ticks. `sampleFrames`
 * counts frames actually rendered, so runs simply take a little longer in wall time.
 *
 * @param {Object} options
 * @param {THREE.WebGPURenderer} options.renderer
 * @param {THREE.Scene} options.scene
 * @param {THREE.Camera} options.camera
 * @param {Function} options.onBeforeFrame - Called with the frame index; animate here.
 * @param {number} options.warmupFrames - Frames rendered and discarded before sampling.
 * @param {number} options.sampleFrames - Frames rendered while sampling.
 * @param {number} options.passesPerFrame - Renders per tick; see below.
 * @param {boolean} options.collectGpuTimestamps
 * @param {boolean} [options.collectComputeTimestamps=false] - Also resolve the COMPUTE pool.
 *   three.js keeps a separate timestamp pool per pass type, so a spike that dispatches compute
 *   from `onBeforeFrame` gets nothing back from the RENDER pool. ⚠️ A frame in which no compute
 *   ran resolves to the pool's *previous* value rather than zero, so a variant that dispatches
 *   nothing must not be measured this way — give the sweep a smallest-nonzero variant instead.
 * @returns {Promise<Object>} Raw per-sample arrays, normalised to one render pass.
 */
export function measureConfiguration( options ) {
  const {
    renderer,
    scene,
    camera,
    onBeforeFrame,
    warmupFrames,
    sampleFrames,
    passesPerFrame = 1,
    collectGpuTimestamps,
    collectComputeTimestamps = false
  } = options;

  return new Promise( ( resolve ) => {
    const cpuSamples = [];
    const wallSamples = [];
    const gpuSamples = [];
    const computeSamples = [];

    let frameIndex = 0;
    let previousFrameStart = 0;
    let resolveInFlight = false;

    renderer.setAnimationLoop( () => {
      // Wait out any outstanding resolve rather than piling more queries behind it.
      if ( resolveInFlight ) {
        previousFrameStart = 0; // the gap is not a frame time; do not record it
        return;
      }

      const sampling = frameIndex >= warmupFrames;
      const frameStart = performance.now();

      if ( previousFrameStart > 0 && sampling ) {
        wallSamples.push( frameStart - previousFrameStart );
      }
      previousFrameStart = frameStart;

      onBeforeFrame( frameIndex );

      // Rendering the same scene several times per tick is how a sub-millisecond effect is
      // lifted clear of the noise floor. three.js sums every pass in a tick into that frame's
      // timestamp total, so dividing by the pass count returns a per-pass figure — and the
      // denser GPU workload keeps the clocks pinned, which is where most of the jitter came
      // from in the first place.
      const submitStart = performance.now();
      for ( let pass = 0; pass < passesPerFrame; pass ++ ) {
        renderer.render( scene, camera );
      }
      const submitEnd = performance.now();

      if ( sampling ) {
        cpuSamples.push( ( submitEnd - submitStart ) / passesPerFrame );
      }

      if ( collectGpuTimestamps ) {
        const pending = [ renderer.resolveTimestampsAsync( THREE.TimestampQuery.RENDER ) ];
        if ( collectComputeTimestamps ) {
          pending.push( renderer.resolveTimestampsAsync( THREE.TimestampQuery.COMPUTE ) );
        }

        resolveInFlight = true;
        Promise.all( pending ).then( ( [ renderDuration, computeDuration ] ) => {
          resolveInFlight = false;
          if ( sampling === false ) return;
          if ( typeof renderDuration === 'number' && renderDuration > 0 ) {
            gpuSamples.push( renderDuration / passesPerFrame );
          }
          if ( typeof computeDuration === 'number' && computeDuration > 0 ) {
            computeSamples.push( computeDuration / passesPerFrame );
          }
        } );
      }

      frameIndex ++;

      if ( frameIndex >= warmupFrames + sampleFrames ) {
        renderer.setAnimationLoop( null );
        resolve( {
          gpu: gpuSamples,
          gpuCompute: computeSamples,
          cpuSubmit: cpuSamples,
          wallFrame: wallSamples,
          framesRendered: frameIndex
        } );
      }
    } );
  } );
}

/**
 * Runs every variant of a sweep, several times, and merges the samples per variant.
 *
 * The repeats are not padding. A single pass measured on this machine produced a
 * non-monotonic RectAreaLight curve — 4 lights "costing" more than 7 — because the GPU
 * clocks up and down over the couple of minutes a sweep takes, and each variant happened
 * to sample a different part of that drift. Repeating the sweep and alternating its
 * direction decorrelates a variant's position in the run from the variant itself, so the
 * drift lands as spread rather than as a false shape in the curve.
 *
 * @param {Object} options
 * @param {Array} options.variants - The values being swept (target counts, light counts…).
 * @param {Function} options.prepareVariant - `(variant) => Promise<void>`; makes the scene match.
 * @param {Function} options.onBeforeFrame - `(frameIndex, variant) => void`; per-frame animation.
 * @param {number} options.repeats - Whole-sweep passes to merge.
 * @param {Function} options.onProgress - Called with a human-readable status string.
 * @returns {Promise<Array<Object>>} One entry per variant, in sweep order.
 */
export async function runSweep( options ) {
  const {
    renderer,
    scene,
    camera,
    variants,
    prepareVariant,
    onBeforeFrame,
    repeats,
    warmupFrames,
    sampleFrames,
    passesPerFrame = 1,
    collectGpuTimestamps,
    collectComputeTimestamps = false,
    onProgress
  } = options;

  const collected = new Map();
  for ( const variant of variants ) {
    collected.set( variant, {
      gpu: [], gpuCompute: [], cpuSubmit: [], wallFrame: [], framesRendered: 0
    } );
  }

  for ( let repeat = 0; repeat < repeats; repeat ++ ) {
    const order = repeat % 2 === 0 ? variants : variants.slice().reverse();

    for ( const variant of order ) {
      onProgress( `pass ${ repeat + 1 }/${ repeats } — measuring ${ variant }…` );

      await prepareVariant( variant );

      const samples = await measureConfiguration( {
        renderer,
        scene,
        camera,
        onBeforeFrame: ( frameIndex ) => onBeforeFrame( frameIndex, variant ),
        warmupFrames,
        sampleFrames,
        passesPerFrame,
        collectGpuTimestamps,
        collectComputeTimestamps
      } );

      const bucket = collected.get( variant );
      bucket.gpu.push( ...samples.gpu );
      bucket.gpuCompute.push( ...samples.gpuCompute );
      bucket.cpuSubmit.push( ...samples.cpuSubmit );
      bucket.wallFrame.push( ...samples.wallFrame );
      bucket.framesRendered += samples.framesRendered;
    }
  }

  return variants.map( ( variant ) => {
    const bucket = collected.get( variant );
    return {
      variant,
      gpu: summarise( bucket.gpu ),
      gpuCompute: summarise( bucket.gpuCompute ),
      cpuSubmit: summarise( bucket.cpuSubmit ),
      wallFrame: summarise( bucket.wallFrame ),
      framesRendered: bucket.framesRendered
    };
  } );
}

/** Renders exactly one animation-loop tick. Used by the timestamp probe. */
function renderOneAnimationFrame( renderer, draw ) {
  return new Promise( ( resolve ) => {
    renderer.setAnimationLoop( () => {
      draw();
      renderer.setAnimationLoop( null );
      resolve();
    } );
  } );
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/**
 * Median and p95 over the samples. Median is the headline because a benchmark's mean is
 * hostage to whatever else the OS decided to do that second; p95 is kept because a hitch
 * you can feel does not show up in the median. Warmup is excluded upstream by
 * `warmupFrames`, so nothing is trimmed here.
 */
export function summarise( rawSamples ) {
  if ( rawSamples.length === 0 ) {
    return { count: 0, median: null, p95: null, min: null, max: null };
  }

  const sorted = rawSamples.slice().sort( ( a, b ) => a - b );

  return {
    count: sorted.length,
    median: percentile( sorted, 0.5 ),
    p95: percentile( sorted, 0.95 ),
    min: sorted[ 0 ],
    max: sorted[ sorted.length - 1 ]
  };
}

function percentile( sorted, fraction ) {
  const index = Math.min( sorted.length - 1, Math.floor( sorted.length * fraction ) );
  return sorted[ index ];
}

/** Formats a millisecond value for the on-page table. Null means "not measured". */
export function formatMs( value ) {
  if ( value === null || value === undefined ) return '—';
  if ( value < 1 ) return value.toFixed( 3 );
  return value.toFixed( 2 );
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/**
 * Publishes results in the two places an automated runner looks: a global object and
 * a prefixed console line. Both carry the same JSON so a scrape and a manual read
 * can never disagree.
 */
export function publishResults( payload ) {
  globalThis.__SPIKE_RESULTS__ = payload;
  globalThis.__SPIKE_DONE__ = true;
  console.log( 'SPIKE_RESULT ' + JSON.stringify( payload ) );
}

/** Reports a hard failure in the same channels, so a runner never hangs waiting. */
export function publishFailure( spikeName, error ) {
  const payload = { spike: spikeName, failed: true, error: String( error && error.stack || error ) };
  globalThis.__SPIKE_RESULTS__ = payload;
  globalThis.__SPIKE_DONE__ = true;
  console.log( 'SPIKE_RESULT ' + JSON.stringify( payload ) );
}

/** Reflects live progress into the DOM so a human watching the page is not guessing. */
export function setStatus( message ) {
  const element = document.getElementById( 'status' );
  if ( element ) element.textContent = message;
}

/** Renders a plain table. Columns are `{ key, label }`; rows are plain objects. */
export function renderTable( containerId, columns, rows ) {
  const container = document.getElementById( containerId );
  if ( ! container ) return;

  const head = columns.map( ( column ) => `<th>${ escapeHtml( column.label ) }</th>` ).join( '' );
  const body = rows.map( ( row ) => {
    const cells = columns.map( ( column ) => `<td>${ escapeHtml( row[ column.key ] ?? '—' ) }</td>` ).join( '' );
    return `<tr>${ cells }</tr>`;
  } ).join( '' );

  container.innerHTML = `<table><thead><tr>${ head }</tr></thead><tbody>${ body }</tbody></table>`;
}

/** Renders the provenance block: backend, GPU, timer status. */
export function renderEnvironment( containerId, environment ) {
  const container = document.getElementById( containerId );
  if ( ! container ) return;

  const lines = [
    [ 'backend', environment.backend ],
    [ 'three.js', 'r' + environment.threeRevision ],
    [ 'adapter', environment.adapter ],
    [ 'compatibility mode', String( environment.compatibilityMode ) ],
    [ 'canvas', `${ environment.canvasWidth } x ${ environment.canvasHeight } @ dpr 1` ],
    [ 'GPU timestamps', environment.timestampsAvailable ? 'available' : 'UNAVAILABLE' ],
    [ 'note', environment.timestampNote ]
  ];

  container.innerHTML = lines
    .map( ( [ label, value ] ) => `<div><span class="k">${ escapeHtml( label ) }</span><span class="v">${ escapeHtml( value ) }</span></div>` )
    .join( '' );
}

/** Driver and UA strings land in the DOM; keep them inert. */
function escapeHtml( value ) {
  return String( value ).replace( /[&<>"']/g, ( character ) => {
    if ( character === '&' ) return '&amp;';
    if ( character === '<' ) return '&lt;';
    if ( character === '>' ) return '&gt;';
    if ( character === '"' ) return '&quot;';
    return '&#39;';
  } );
}

/** Reads an integer query-string parameter, falling back to a default. */
export function readNumberParam( name, fallback ) {
  const raw = new URLSearchParams( location.search ).get( name );
  if ( raw === null ) return fallback;
  const parsed = Number( raw );
  return Number.isFinite( parsed ) ? parsed : fallback;
}

/** Reads a boolean query-string parameter (`?forceWebGL=1`). */
export function readFlagParam( name ) {
  const raw = new URLSearchParams( location.search ).get( name );
  return raw === '1' || raw === 'true';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Names the physical GPU. On WebGPU this comes from GPUAdapterInfo; on WebGL2 from
 * WEBGL_debug_renderer_info. Either way the point is the same: catch a software
 * rasteriser (SwiftShader, llvmpipe) before its numbers get written into a budget.
 */
async function describeAdapter( renderer, usingWebGPU ) {
  if ( usingWebGPU ) {
    if ( navigator.gpu === undefined ) return 'unknown (no navigator.gpu)';
    const adapter = await navigator.gpu.requestAdapter();
    if ( adapter === null ) return 'unknown (no adapter)';
    const info = adapter.info || {};
    const parts = [ info.vendor, info.architecture, info.device, info.description ].filter( Boolean );
    return parts.length > 0 ? parts.join( ' / ' ) : 'WebGPU adapter (no info exposed)';
  }

  const gl = renderer.backend.gl;
  if ( ! gl ) return 'unknown (no WebGL context)';
  const debugInfo = gl.getExtension( 'WEBGL_debug_renderer_info' );
  if ( ! debugInfo ) return gl.getParameter( gl.RENDERER );
  return gl.getParameter( debugInfo.UNMASKED_RENDERER_WEBGL );
}

/**
 * True when the adapter string smells like a software rasteriser. Those numbers are
 * real measurements of the wrong machine, which is worse than no measurement.
 */
export function looksLikeSoftwareRenderer( adapterDescription ) {
  const lowered = String( adapterDescription ).toLowerCase();
  return lowered.includes( 'swiftshader' )
    || lowered.includes( 'llvmpipe' )
    || lowered.includes( 'softwarerasterizer' )
    || lowered.includes( 'software rasterizer' );
}
