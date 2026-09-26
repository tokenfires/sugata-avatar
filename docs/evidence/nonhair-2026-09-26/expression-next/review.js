// Static, neutral-label review only. Never imports the experiment or its hidden arm mapping.
const el = Object.fromEntries( [ 'title', 'scope', 'groups', 'previous', 'play', 'next', 'time',
    'frame-detail', 'timeline', 'markers', 'status', 'error', 'error-message', 'retry', 'comparison' ]
    .map( id => [ id, document.getElementById( id ) ] ) );
const manifestURL = new URL( './review-manifest.json', import.meta.url );
const cache = new Map(), CACHE_LIMIT = 24, FRAME_MS = 1000 / 15;
let manifest = null, group = null, index = 0, playing = false, timer = null, generation = 0, loading = false;
let playbackTime = 0, playEpoch = 0, playAnchor = 0;

function validate( data ) {
    if ( !data || typeof data.title !== 'string' || typeof data.scope !== 'string' ||
        !Array.isArray( data.groups ) || data.groups.length !== 2 ) throw Error( 'Manifest must describe two sequences and a title/scope.' );
    const groupIds = new Set();
    for ( const g of data.groups ) {
        if ( ![ 'quiet', 'speech' ].includes( g.id ) || groupIds.has( g.id ) || typeof g.label !== 'string' ) throw Error( 'Manifest sequence identity is invalid.' );
        groupIds.add( g.id );
        if ( !Array.isArray( g.samples ) || g.samples.length < 2 || !Array.isArray( g.arms ) || g.arms.length !== 3 ) throw Error( `${ g.label } requires samples and exactly three views.` );
        for ( let i = 0; i < g.samples.length; i++ ) {
            const s = g.samples[ i ], previous = g.samples[ i - 1 ];
            if ( !Number.isInteger( s.step ) || s.step < 0 || !Number.isFinite( s.time ) || s.time < 0 ||
                previous && ( s.step <= previous.step || s.time <= previous.time ) ) throw Error( `${ g.label } sample steps/times must increase.` );
        }
        const ids = new Set();
        for ( const arm of g.arms ) {
            if ( typeof arm.id !== 'string' || ids.has( arm.id ) || !/^View [123]$/.test( arm.label ) ||
                !Array.isArray( arm.images ) || arm.images.length !== g.samples.length ) throw Error( 'Each sequence needs three unique neutral views with complete image lists.' );
            ids.add( arm.id );
            const byStep = new Map();
            for ( const image of arm.images ) {
                if ( !Number.isInteger( image.step ) || byStep.has( image.step ) || typeof image.src !== 'string' || !image.src ) throw Error( 'Manifest image step/source is invalid.' );
                const url = new URL( image.src, manifestURL );
                if ( ![ 'http:', 'https:' ].includes( url.protocol ) || url.origin !== location.origin ) throw Error( 'Review images must be served from this same local site.' );
                byStep.set( image.step, url.href );
            }
            if ( g.samples.some( s => !byStep.has( s.step ) ) ) throw Error( 'One view is missing a matched sample.' );
            arm.sources = g.samples.map( s => byStep.get( s.step ) );
        }
        if ( new Set( g.arms.map( arm => arm.label ) ).size !== 3 ) throw Error( 'View labels must be unique.' );
    }
    return data;
}

function pause() { playing = false; clearTimeout( timer ); timer = null; ++generation; loading = false; el.play.textContent = 'Play'; }
function fail( error ) {
    pause(); loading = false; el.error.hidden = false; el[ 'error-message' ].textContent = error.message;
    el.status.textContent = 'Loading failed. The last complete matched frame is retained.';
    el.play.disabled = true;
}
function nearest( time ) {
    let best = 0;
    for ( let i = 1; i < group.samples.length; i++ )
        if ( Math.abs( group.samples[ i ].time - time ) < Math.abs( group.samples[ best ].time - time ) ) best = i;
    return best;
}
function atOrBefore( time ) {
    let selected = 0;
    for ( let i = 1; i < group.samples.length && group.samples[ i ].time <= time; i++ ) selected = i;
    return selected;
}
function loadImage( url ) {
    if ( cache.has( url ) ) { const found = cache.get( url ); cache.delete( url ); cache.set( url, found ); return found.promise; }
    const entry = { ready: false, promise: null };
    entry.promise = new Promise( ( resolve, reject ) => {
        const image = new Image(); image.decoding = 'async';
        image.onload = async () => {
            try { await image.decode(); if ( !image.naturalWidth || !image.naturalHeight ) throw Error( 'Empty image' ); entry.ready = true; resolve( image ); }
            catch { cache.delete( url ); reject( Error( `Could not decode ${ new URL( url ).pathname }` ) ); }
        };
        image.onerror = () => { cache.delete( url ); reject( Error( `Could not preload ${ new URL( url ).pathname }` ) ); };
        image.src = url;
    } );
    cache.set( url, entry );
    while ( cache.size > CACHE_LIMIT ) cache.delete( cache.keys().next().value );
    return entry.promise;
}
function preloadNext( token ) {
    const active = group, from = index + 1, through = Math.min( active.samples.length, from + 4 );
    for ( let i = from; i < through; i++ ) for ( const arm of active.arms )
        loadImage( arm.sources[ i ] ).catch( error => { if ( token === generation && active === group ) fail( error ); } );
}
function updateControls() {
    const sample = group.samples[ index ];
    el.time.textContent = `${ sample.time.toFixed( 2 ) } s`;
    el[ 'frame-detail' ].textContent = `Native step ${ sample.step } · sample ${ index + 1 } of ${ group.samples.length }`;
    el.timeline.value = sample.time; el.timeline.setAttribute( 'aria-valuetext', `${ sample.time.toFixed( 2 ) } seconds, native step ${ sample.step }` );
    el.previous.disabled = index === 0; el.next.disabled = index === group.samples.length - 1;
    el.timeline.disabled = false; el.play.disabled = !el.error.hidden;
}
async function show( next, { fromPlayback = false } = {} ) {
    if ( !group ) return;
    const token = ++generation, active = group;
    const bufferingSince = fromPlayback && active.arms.some( arm => !cache.get( arm.sources[ next ] )?.ready ) ? performance.now() : null;
    loading = true; el.status.textContent = 'Loading all three matched views…';
    try {
        const images = await Promise.all( active.arms.map( async arm => {
            const decoded = await loadImage( arm.sources[ next ] );
            // Independent DOM nodes also handle a manifest deliberately reusing one PNG.
            const image = decoded.cloneNode(); await image.decode(); return image;
        } ) );
        if ( token !== generation || active !== group ) return;
        if ( bufferingSince !== null && playing ) playEpoch += performance.now() - bufferingSince;
        // Commit only after all three decode. A slow image cannot leave mismatched times.
        images.forEach( ( image, i ) => {
            image.alt = `${ active.arms[ i ].label }, ${ active.label }, action time ${ active.samples[ next ].time.toFixed( 2 ) } seconds`;
            el.comparison.children[ i ].querySelector( '.image' ).replaceChildren( image );
        } );
        index = next; if ( !fromPlayback ) playbackTime = active.samples[ index ].time;
        loading = false; updateControls();
        el.status.textContent = playing ? 'Playing matched images at 15 Hz. Loading pauses all views together.' : 'Paused · use the shared slider, marked times, or frame buttons.';
        preloadNext( token );
    } catch ( error ) { if ( token === generation ) fail( error ); }
}
function schedule( delay = FRAME_MS ) {
    clearTimeout( timer );
    timer = setTimeout( async () => {
        if ( !playing || loading ) { if ( playing ) schedule(); return; }
        const began = performance.now(), active = group, end = active.samples.at( -1 ).time;
        playbackTime = Math.min( end, playAnchor + ( performance.now() - playEpoch ) / 1000 );
        await show( atOrBefore( playbackTime ), { fromPlayback: true } );
        if ( !playing || !el.error.hidden || active !== group ) return;
        if ( playbackTime >= end ) { pause(); el.status.textContent = 'End of sequence · Play restarts from the first sample.'; }
        else if ( playing ) schedule( Math.max( 0, FRAME_MS - ( performance.now() - began ) ) );
    }, delay );
}
async function selectGroup( id ) {
    pause(); ++generation; group = manifest.groups.find( g => g.id === id ); index = 0;
    el.error.hidden = true;
    for ( const button of el.groups.children ) button.setAttribute( 'aria-pressed', String( button.dataset.group === id ) );
    el.comparison.replaceChildren();
    for ( const arm of group.arms ) {
        const figure = document.createElement( 'figure' ), caption = document.createElement( 'figcaption' ), holder = document.createElement( 'div' );
        caption.textContent = arm.label; holder.className = 'image';
        const placeholder = document.createElement( 'span' ); placeholder.className = 'placeholder'; placeholder.textContent = 'Loading matched image…';
        holder.append( placeholder ); figure.append( caption, holder ); el.comparison.append( figure );
    }
    const start = group.samples[ 0 ].time, end = group.samples.at( -1 ).time;
    el.timeline.min = start; el.timeline.max = end; el.markers.replaceChildren();
    const times = [ ...new Set( [ start, .25, .85, 2.6, 3.4, end ].filter( t => t >= start && t <= end ) ) ].sort( ( a, b ) => a - b );
    for ( const time of times ) {
        const button = document.createElement( 'button' ); button.type = 'button'; button.textContent = `${ time.toFixed( 2 ) } s`;
        button.setAttribute( 'aria-label', `Show matched sample nearest ${ time.toFixed( 2 ) } seconds` );
        button.addEventListener( 'click', () => { pause(); show( nearest( time ) ); } ); el.markers.append( button );
    }
    await show( 0 );
}
async function loadManifest() {
    pause(); el.error.hidden = true; el.status.textContent = 'Loading manifest…';
    try {
        const response = await fetch( manifestURL, { cache: 'no-store' } );
        if ( !response.ok ) throw Error( `review-manifest.json is unavailable (HTTP ${ response.status }). The review data may not have been generated yet.` );
        manifest = validate( await response.json() );
        el.title.textContent = manifest.title; document.title = manifest.title; el.scope.textContent = manifest.scope;
        el.groups.replaceChildren();
        for ( const g of manifest.groups ) {
            const button = document.createElement( 'button' ); button.type = 'button'; button.textContent = g.label; button.dataset.group = g.id;
            button.setAttribute( 'aria-pressed', 'false' ); button.addEventListener( 'click', () => selectGroup( g.id ) ); el.groups.append( button );
        }
        await selectGroup( manifest.groups[ 0 ].id );
    } catch ( error ) { fail( error ); }
}

el.play.addEventListener( 'click', async () => {
    if ( playing ) { pause(); el.status.textContent = 'Paused · all views retain the same action time.'; return; }
    if ( loading ) return;
    if ( index === group.samples.length - 1 ) await show( 0 );
    if ( !el.error.hidden ) return;
    playAnchor = group.samples[ index ].time; playEpoch = performance.now();
    playing = true; el.play.textContent = 'Pause'; schedule();
} );
el.previous.addEventListener( 'click', () => { pause(); show( Math.max( 0, index - 1 ) ); } );
el.next.addEventListener( 'click', () => { pause(); show( Math.min( group.samples.length - 1, index + 1 ) ); } );
el.timeline.addEventListener( 'input', () => { pause(); show( nearest( Number( el.timeline.value ) ) ); } );
el.retry.addEventListener( 'click', () => { cache.clear(); if ( manifest && group ) { el.error.hidden = true; show( index ); } else loadManifest(); } );
document.addEventListener( 'visibilitychange', () => { if ( document.hidden ) { pause(); el.status.textContent = 'Paused while the gallery is in the background.'; } } );
window.addEventListener( 'pagehide', pause );
loadManifest();
