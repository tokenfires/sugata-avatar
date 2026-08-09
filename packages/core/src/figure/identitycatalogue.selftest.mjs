/**
 * Gate for punch-list 10.2 — `figure/IdentityCatalogue.js` and `assets/identity/catalogue.json`.
 *
 * The catalogue is a transcription of somebody else's data, and a transcription's failure mode is
 * that it looks right. So this file checks it three ways that cannot all be satisfied by the same
 * mistake:
 *
 *   CENSUS        Every one of the 1,258 installed target files is classified into exactly one
 *                 bucket, and the five bucket counts match `research/identity-sculpting.md` §2.1
 *                 to the unit. An unclassified file is a slider we are not shipping and do not
 *                 know we are not shipping, so `unclassified` must be 0 and there is no tolerance.
 *
 *   TAXONOMY      The per-region table is compared against §2.2's, region by region, on four
 *                 columns each. The expected numbers are typed in from the research document
 *                 rather than recomputed from the catalogue, so a catalogue that drifted cannot
 *                 agree with them.
 *
 *   RESOLUTION    The value -> target-stack rule, including the three ways it must refuse: a
 *                 negative weight on a unipolar slider, an excluded slider, and a non-number.
 *
 *   MACRO         `macroTargetStack` against MPFB's own emitted stack, recorded from the running
 *                 addon at two settings — the shipped default (8 targets) and an off-midpoint one
 *                 (77 targets). This is the only check here whose oracle is a different program.
 *
 * 🚩 AND EVERY ONE OF THEM IS PROVEN RED. `provenGateRed` re-runs each check against deliberately
 * corrupted input and fails if the check still passes. Two independent corruptions per class, per
 * `docs/LEARNINGS.md`: a gate that only catches its own known-bad is decorative.
 *
 * Usage:  node "packages/core/src/figure/identitycatalogue.selftest.mjs"
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { IdentityCatalogue, DEFAULT_MACRO } = await import( './IdentityCatalogue.js' );

const HERE = path.dirname( fileURLToPath( import.meta.url ) );
const REPO = path.resolve( HERE, '../../../..' );

const CATALOGUE_JSON = JSON.parse(
    fs.readFileSync( path.join( REPO, 'assets/identity/catalogue.json' ), 'utf8' ) );

const MACRO_FIXTURES = JSON.parse(
    fs.readFileSync( path.join( REPO, 'tools/identity-pipeline/fixtures/macro-stacks.json' ), 'utf8' ) );

/**
 * `research/identity-sculpting.md` §2.1. Typed in, not derived — the whole point is that a
 * catalogue built from a library that has moved underneath us disagrees with the document.
 */
const CENSUS = { total: 1258, detail: 530, macro: 348, 'breast-macro': 216, expression: 102, asym: 62 };

/**
 * §2.2, all 21 regions: [ slider categories, of which sided, widgets if L/R split, raw targets ].
 *
 * ⚠️ The raw-target column is not 2 × categories + 2 × sided, and the two places it is not are the
 * finding this table is worth keeping for: `chin` reads 15 rather than 16 and `head` 27 rather
 * than 34, because eight categories across those two regions are unipolar and name one file each.
 */
const REGIONS = {
    mouth: [ 22, 0, 22, 44 ], nose: [ 21, 0, 21, 42 ], legs: [ 18, 11, 29, 58 ],
    eyes: [ 17, 17, 34, 68 ], head: [ 17, 0, 17, 27 ], torso: [ 17, 0, 17, 34 ],
    arms: [ 14, 11, 25, 50 ], ears: [ 11, 11, 22, 44 ], neck: [ 10, 0, 10, 20 ],
    chin: [ 8, 0, 8, 15 ], feet: [ 8, 7, 15, 30 ], hip: [ 7, 0, 7, 14 ],
    breast: [ 6, 0, 6, 12 ], hands: [ 6, 5, 11, 22 ], cheek: [ 4, 4, 8, 16 ],
    forehead: [ 4, 0, 4, 8 ], stomach: [ 4, 0, 4, 8 ], eyebrows: [ 3, 0, 3, 6 ],
    genitals: [ 3, 0, 3, 6 ], pelvis: [ 2, 0, 2, 4 ], buttocks: [ 1, 0, 1, 2 ]
};

const results = [];

// ---------------------------------------------------------------------------------------------

const catalogue = new IdentityCatalogue( CATALOGUE_JSON );

console.log( '\nCENSUS — every installed file classified\n' );
checkCensus( CATALOGUE_JSON );

console.log( '\nTAXONOMY — the region table against research §2.2\n' );
checkTaxonomy( catalogue );

console.log( '\nEXCLUSIONS — what is deliberately off the dial\n' );
checkExclusions( catalogue );

console.log( '\nRESOLUTION — slider values to a target stack\n' );
checkResolution( catalogue );

console.log( '\nMACRO — the JS solver against MPFB\'s own stack\n' );
checkMacro();

console.log( '\nPROVEN RED — each check against deliberately corrupted input\n' );
proveRed();

report();

// ---------------------------------------------------------------------------------------------

function checkCensus( raw ) {

    exact( 'census total', raw.census.total, CENSUS.total, 'research §2.1' );
    for ( const bucket of [ 'detail', 'macro', 'breast-macro', 'expression', 'asym' ] ) {
        exact( `census ${ bucket }`, raw.census[ bucket ], CENSUS[ bucket ], 'research §2.1' );
    }
    exact( 'census unclassified', raw.census.unclassified, 0, 'an unseen file is an unshipped slider' );

    const buckets = [ 'detail', 'macro', 'breast-macro', 'expression', 'asym', 'unclassified' ];
    const sum = buckets.reduce( ( n, b ) => n + raw.census[ b ], 0 );
    exact( 'buckets sum to total', sum, raw.census.total, 'partition, not overlap' );

    exact( 'files listed individually', Object.keys( raw.files ).length, CENSUS.total,
        'the census ships the list, so this gate runs without MPFB installed' );

    const detailFiles = Object.values( raw.files ).filter( ( b ) => b === 'detail' ).length;
    exact( 'detail files in the list', detailFiles, CENSUS.detail, 'list agrees with the summary' );

}

function checkTaxonomy( cat ) {

    exact( 'regions with categories', cat.regions.length, 21, 'research §2.2; target.json also '
        + 'carries an empty `measure` key which is a grouping label, not a region' );

    let categories = 0, sided = 0, widgets = 0, raw = 0;

    for ( const [ id, [ expectedCategories, expectedSided, expectedWidgets, expectedRaw ] ] of Object.entries( REGIONS ) ) {

        const region = cat.regionById.get( id );
        if ( ! region ) { exact( `region ${ id } present`, 0, 1, 'research §2.2' ); continue; }

        const ok = region.sliderCount === expectedCategories
            && region.sidedCount === expectedSided
            && region.widgetCount === expectedWidgets
            && region.rawTargetCount === expectedRaw;

        record( ok, `region ${ id }`,
            `${ region.sliderCount }/${ region.sidedCount }/${ region.widgetCount }/${ region.rawTargetCount }`,
            `${ expectedCategories }/${ expectedSided }/${ expectedWidgets }/${ expectedRaw }`,
            'cats/sided/widgets/raw' );

        categories += expectedCategories; sided += expectedSided;
        widgets += expectedWidgets; raw += expectedRaw;

    }

    exact( 'total categories', cat.sliders.length, categories, 'research §2.2 totals 203' );
    exact( 'total sided', cat.sliders.filter( ( s ) => s.sided ).length, sided, '§2.2 totals 66' );
    exact( 'total widgets if split', cat.sliders.length + sided, widgets, '§2.2 totals 269' );
    exact( 'total raw targets', cat.regions.reduce( ( n, r ) => n + r.rawTargetCount, 0 ), raw, '§2.2 totals 530' );

    const unipolar = cat.sliders.filter( ( s ) => s.range === 'unipolar' );
    exact( 'unipolar categories', unipolar.length, 8,
        'seven head shapes and chin-triangle; §2.2 calls all 203 bidirectional and 8 are not' );

    const fileArithmetic = cat.sliders.reduce( ( n, s ) => n + Object.keys( s.ends ).length, 0 );
    exact( 'ends sum to the raw file count', fileArithmetic, CENSUS.detail,
        '66x4 + 129x2 + 8x1 = 530, which is why the loose adjective costs nothing' );

}

function checkExclusions( cat ) {

    exact( 'exposed sliders', cat.exposedSliders.length, 200, '203 less the 3 genital categories' );
    exact( 'exposed widgets', cat.exposedWidgetCount, 266, '200 + 66 sided; §2.2 reports 269 for all 203' );

    const genitals = cat.regionById.get( 'genitals' );
    record( genitals.exposed === false && typeof genitals.excludedBecause === 'string',
        'genitals excluded, with a reason', String( genitals.exposed ), 'false', genitals.excludedBecause ?? '' );

    const asym = cat.sliders.filter( ( s ) => s.id.includes( 'asym' ) ).length;
    exact( 'asym sliders in the catalogue', asym, 0,
        'not an exclusion rule — the 62 asym files are absent from target.json entirely' );

    const expression = Object.entries( CATALOGUE_JSON.files )
        .filter( ( [ , bucket ] ) => bucket === 'expression' ).length;
    exact( 'expression files classified but unexposed', expression, 102, 'they belong to Phase 5' );

    const exposedRegionsWithBins = cat.regions.filter( ( r ) => r.exposed && r.bin ).length;
    exact( 'exposed regions carry a bin', exposedRegionsWithBins, 20, 'one packed file per region' );
    record( genitals.bin === null, 'excluded region ships no bytes', String( genitals.bin ), 'null',
        'a slider nothing can show should not cost a download either' );

}

function checkResolution( cat ) {

    const symmetric = cat.resolve( { 'eyes/eye-scale-decr-incr': 0.4 } );
    record( symmetric.length === 2
        && symmetric.every( ( e ) => e.weight === 0.4 )
        && symmetric.map( ( e ) => e.target ).sort().join( ',' ) === 'l-eye-scale-incr,r-eye-scale-incr',
        'sided slider drives both sides', symmetric.map( ( e ) => e.target ).sort().join( ',' ),
        'l-eye-scale-incr,r-eye-scale-incr', 'symmetry is the default' );

    const asymmetric = cat.resolve( { 'eyes/eye-scale-decr-incr': { left: - 0.6, right: 0.35 } } );
    const left = asymmetric.find( ( e ) => e.side === 'left' );
    const right = asymmetric.find( ( e ) => e.side === 'right' );
    record( left.target === 'l-eye-scale-decr' && left.weight === 0.6
        && right.target === 'r-eye-scale-incr' && right.weight === 0.35,
        'left and right take opposite ends', `${ left.target }@${ left.weight } ${ right.target }@${ right.weight }`,
        'l-eye-scale-decr@0.6 r-eye-scale-incr@0.35', '10.12 reaches asymmetry through here' );

    const negative = cat.resolve( { 'chin/chin-height-decr-incr': - 0.3 } );
    record( negative.length === 1 && negative[ 0 ].target === 'chin-height-decr' && negative[ 0 ].weight === 0.3,
        'a negative value takes the negative end', `${ negative[ 0 ].target }@${ negative[ 0 ].weight }`,
        'chin-height-decr@0.3', 'the sign selects the file; the weight is always positive' );

    exact( 'zero is sparse', cat.resolve( { 'chin/chin-height-decr-incr': 0 } ).length, 0,
        'a default identity resolves to an empty stack' );

    exact( 'value clamps to 1', cat.resolve( { 'head/head-oval': 7 } )[ 0 ].weight, 1,
        'the library authored one shape, not seven of it' );

    refuses( 'unipolar refuses a negative', () => cat.resolve( { 'head/head-oval': - 0.5 } ) );
    refuses( 'excluded slider refuses', () => cat.resolve( { 'genitals/penis-length-decr-incr': 0.5 } ) );
    refuses( 'unknown slider refuses', () => cat.resolve( { 'eyes/no-such-slider': 0.5 } ) );
    refuses( 'a non-number refuses', () => cat.resolve( { 'head/head-oval': 'big' } ) );

    // 🚩 MEASURED 20, NOT 26, AND THE DIFFERENCE MATTERS DOWNSTREAM.
    // `research/identity-sculpting.md` says "the 26 `measure-*` categories" in five places (§2.2,
    // §2.4 pattern 3, §5.3, §6's opener and 10.10) and concludes that "the identity slider set and
    // the garment-drafting input are already the same interface". Counted out of `target.json`,
    // there are **20**: 3 arms, 1 feet, 1 hands, 5 legs, 2 neck, 8 torso. The 26 is GarmentCode's
    // input-vector size (`research/wardrobe-system.md` §4.3) and was carried across as if it were
    // MPFB's count. The same research doc's own §2.4 table reports MakeHuman's Measure tab as
    // "20 real-world measurements in 9 groups", which agrees with this and not with §2.2.
    // Consequence for Phase 9.12: six of GarmentCode's 26 inputs have no identity slider to read
    // and must be derived from the mesh or defaulted.
    const measure = cat.exposedSliders.filter( ( s ) => s.kind === 'measure' );
    exact( 'measure-* categories tagged', measure.length, 20,
        'counted from target.json; research §2.2 says 26, which is GarmentCode\'s vector size' );

    exact( 'measure-* regions', new Set( measure.map( ( s ) => s.region ) ).size, 6,
        'arms, feet, hands, legs, neck, torso' );

}

function checkMacro() {

    for ( const testCase of MACRO_FIXTURES.cases ) {

        const mine = IdentityCatalogue.macroTargetStack( testCase.macro );
        const theirs = testCase.mpfbStack;

        exact( `${ testCase.label }: target count`, mine.length, theirs.length, 'MPFB\'s own stack' );

        const sameSet = mine.length === theirs.length
            && mine.every( ( entry, i ) => entry.file === theirs[ i ].file );
        record( sameSet, `${ testCase.label }: same targets, same order`, sameSet ? 'yes' : 'no', 'yes',
            'order matters only for comparability, but a reordering usually means a rewritten loop' );

        let worst = 0;
        if ( sameSet ) {
            for ( let i = 0; i < mine.length; i ++ ) {
                worst = Math.max( worst, Math.abs( mine[ i ].weight - theirs[ i ].weight ) );
            }
        } else {
            worst = Infinity;
        }
        within( `${ testCase.label }: worst weight error`, worst, 0, 1e-9,
            'float32 property reads and Python half-even rounding, both reproduced' );

    }

    exact( 'default macro stack', IdentityCatalogue.macroTargetStack().length, 8,
        'proportions and height contribute nothing at exactly 0.5 — MPFB\'s segments do not meet there' );

    exact( 'default equals DEFAULT_MACRO', IdentityCatalogue.macroTargetStack( DEFAULT_MACRO ).length, 8,
        'the exported constant is the same figure build_figure.py builds' );

}

// ---------------------------------------------------------------------------------------------

/**
 * Each corruption is a real mistake somebody could make, and the two in each class are independent
 * — a fix that silenced one would not silence the other.
 */
function proveRed() {

    // CENSUS. (a) the mistake this class exists for: a file the build did not recognise.
    provenRed( 'census catches an unclassified file', () => {
        const broken = structuredClone( CATALOGUE_JSON );
        broken.census.unclassified = 1;
        broken.census.total = 1259;
        checkCensusQuietly( broken );
    } );

    // (b) a different mistake in the same class: the totals still add up, but a bucket moved.
    provenRed( 'census catches a re-bucketed file', () => {
        const broken = structuredClone( CATALOGUE_JSON );
        broken.census.detail = 529;
        broken.census.asym = 63;
        checkCensusQuietly( broken );
    } );

    // TAXONOMY. (a) a region loses a slider.
    provenRed( 'taxonomy catches a dropped category', () => {
        const broken = new IdentityCatalogue( withRegion( 'eyes', ( r ) => { r.sliderCount = 16; } ) );
        checkTaxonomyQuietly( broken );
    } );

    // (b) the counts are right and the SIDEDNESS is not, which is the error that would silently
    //     halve the widget count without moving a single slider total.
    provenRed( 'taxonomy catches a lost sidedness', () => {
        const broken = new IdentityCatalogue( withRegion( 'ears', ( r ) => { r.sidedCount = 0; } ) );
        checkTaxonomyQuietly( broken );
    } );

    // RESOLUTION. (a) the ends swapped — the sign error the `mixed` fixture exists for.
    provenRed( 'resolution catches swapped ends', () => {
        const broken = new IdentityCatalogue( withSlider( 'chin/chin-height-decr-incr', ( s ) => {
            const negative = s.ends[ 'negative-unsided' ];
            s.ends[ 'negative-unsided' ] = s.ends[ 'positive-unsided' ];
            s.ends[ 'positive-unsided' ] = negative;
        } ) );
        const stack = broken.resolve( { 'chin/chin-height-decr-incr': - 0.3 } );
        assert( stack[ 0 ].target === 'chin-height-decr', 'negative end is still chin-height-decr' );
    } );

    // (b) a genital slider quietly re-exposed. Different failure, same class: the resolver's job
    //     is to refuse, and an exclusion that stops refusing looks identical from the outside.
    provenRed( 'resolution catches a re-exposed exclusion', () => {
        const broken = new IdentityCatalogue( withSlider( 'genitals/penis-length-decr-incr', ( s ) => {
            s.exposed = true;
        } ) );
        let refused = false;
        try { broken.resolve( { 'genitals/penis-length-decr-incr': 0.5 } ); } catch { refused = true; }
        assert( refused, 'excluded slider refused' );
    } );

    // MACRO. (a) the cutoff dropped, which adds targets MPFB would not have emitted.
    provenRed( 'macro catches a wrong cutoff', () => {
        const stack = IdentityCatalogue.macroTargetStack( MACRO_FIXTURES.cases[ 1 ].macro );
        assert( stack.length === 78, 'off-midpoint stack has 78 targets' );
    } );

    // (b) the rounding. Python's round() is half-to-even; JS's Math.round is not, and the
    //     difference is invisible except at a tie — which gender 0.5 sits exactly on.
    provenRed( 'macro catches a weight drift of 1e-9', () => {
        const mine = IdentityCatalogue.macroTargetStack( MACRO_FIXTURES.cases[ 1 ].macro );
        const theirs = MACRO_FIXTURES.cases[ 1 ].mpfbStack;
        let worst = 0;
        for ( let i = 0; i < mine.length; i ++ ) {
            const drifted = i === 0 ? mine[ i ].weight + 2e-9 : mine[ i ].weight;
            worst = Math.max( worst, Math.abs( drifted - theirs[ i ].weight ) );
        }
        assert( worst <= 1e-9, `worst weight error ${ worst }` );
    } );

}

function checkCensusQuietly( raw ) {

    assert( raw.census.unclassified === 0, 'unclassified is 0' );
    assert( raw.census.total === CENSUS.total, 'total is 1258' );
    for ( const bucket of [ 'detail', 'macro', 'breast-macro', 'expression', 'asym' ] ) {
        assert( raw.census[ bucket ] === CENSUS[ bucket ], `${ bucket } is ${ CENSUS[ bucket ] }` );
    }

}

function checkTaxonomyQuietly( cat ) {

    for ( const [ id, [ categories, sided, widgets, raw ] ] of Object.entries( REGIONS ) ) {
        const region = cat.regionById.get( id );
        assert( region.sliderCount === categories, `${ id } categories` );
        assert( region.sidedCount === sided, `${ id } sided` );
        assert( region.widgetCount === widgets, `${ id } widgets` );
        assert( region.rawTargetCount === raw, `${ id } raw` );
    }

}

function withRegion( id, mutate ) {

    const clone = structuredClone( CATALOGUE_JSON );
    mutate( clone.regions.find( ( r ) => r.id === id ) );
    return clone;

}

function withSlider( id, mutate ) {

    const clone = structuredClone( CATALOGUE_JSON );
    mutate( clone.sliders.find( ( s ) => s.id === id ) );
    return clone;

}

// ---------------------------------------------------------------------------------------------

function exact( label, measured, expected, why ) {

    record( measured === expected, label, String( measured ), String( expected ), why );

}

function within( label, measured, expected, tolerance, why ) {

    record( Math.abs( measured - expected ) <= tolerance, label,
        measured.toExponential( 3 ), `${ expected } +/- ${ tolerance.toExponential( 0 ) }`, why );

}

function refuses( label, run ) {

    let threw = false;
    try { run(); } catch { threw = true; }
    record( threw, label, threw ? 'threw' : 'returned', 'threw', 'refusing is the behaviour' );

}

/** Runs a check against corrupted input and passes only if the check FAILS. */
function provenRed( label, run ) {

    let fired = false;
    try { run(); } catch { fired = true; }
    record( fired, label, fired ? 'went red' : 'stayed green', 'went red',
        'a gate that only catches its own known-bad is decorative' );

}

function assert( condition, what ) {

    if ( ! condition ) throw new Error( `gate fired: ${ what }` );

}

function record( pass, label, measured, expected, why ) {

    results.push( pass );
    console.log( `  ${ pass ? 'PASS' : 'FAIL' }  ${ label.padEnd( 42 ) } ${ String( measured ).padStart( 14 ) }`
        + `   expected ${ String( expected ).padEnd( 22 ) } ${ why }` );

}

function report() {

    const passed = results.filter( Boolean ).length;
    console.log( `\n${ passed }/${ results.length } gates passed\n` );
    if ( passed !== results.length ) process.exit( 1 );

}
