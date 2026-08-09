/**
 * Turns the installed MPFB target library into the two things the runtime needs for identity:
 * a catalogue of the sliders, and the packed vertex offsets those sliders drive.
 *
 * This is build-time only, and it is the only place that reads the MPFB install. **MPFB2's CODE
 * is GPLv3 and never ships** (standing constraint); its target DATA is CC0 (MPFB2 LICENSE §D,
 * the same clause that makes the shipped GLBs unrestricted), which is what makes packing it into
 * `assets/identity/` legitimate.
 *
 *
 * WHY A PACKED BINARY RATHER THAN THE .target.gz FILES
 *
 * A `.target` file is `index x y z`, one line per moved vertex, in MakeHuman units, with no
 * header and no solver — docs/research/identity-sculpting.md §1.1, read at source in
 * `targetservice.py:415-440`. 530 detail files hold 676,127 moved-vertex lines between them
 * (measured here, printed by this script). Shipping 530 gzipped text files means 530 requests
 * and 530 text parses; shipping one binary per region means 21 requests and zero parsing.
 *
 *
 * THE AXIS CONVERSION IS THE IDENTITY, AND THAT IS NOT A COINCIDENCE
 *
 * MakeHuman is Y-up. glTF is Y-up. Blender is Z-up, so MPFB reads a target line as the Blender
 * delta (x, −z, y) — `targetservice.py:436-438` — and the glTF exporter then converts Blender
 * (bx, by, bz) back to (bx, bz, −by), which lands on (x, y, z): **the file's own column order.**
 * So the numbers below go into the bin exactly as the file wrote them, and the one thing that
 * changes is the unit: MakeHuman decimetres × `scale_factor` = metres, and MPFB builds this
 * project's figures at `scale=0.1` (`humanservice.py:1485`, measured back out of a built
 * basemesh as 0.10000000149011612 — the float32 of 0.1, which is the value that has to be used
 * if the JS is to reproduce Blender rather than merely approximate it).
 *
 *
 * NO SENTENCE IN THE OUTPUT RESTATES A NUMBER THE OUTPUT ALREADY CARRIES
 *
 * `census.notes` used to be five hand-typed English sentences, and one of them said "203
 * bidirectional sliders" for the whole of the round in which research §2.2 was corrected to
 * "195 bidirectional and 8 unipolar". The correction could not reach it: the sentence was a
 * literal in this file, it duplicated a fact the very same artefact carries as `sliders[].range`,
 * and no gate read it. A hand-typed restatement of your own data has no mechanism to be right.
 *
 * So `censusNotes()` templates every number in those sentences out of the finished catalogue, and
 * `identityassets.selftest.mjs` re-derives them from the SHIPPED file and demands the strings
 * back. Change the library and the prose follows; hand-edit the prose and the gate goes red.
 *
 * Usage:
 *   node tools/identity-pipeline/build_identity_assets.mjs
 *   node tools/identity-pipeline/build_identity_assets.mjs --targets-dir /path/to/mpfb/data/targets
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname( fileURLToPath( import.meta.url ) );
const REPO = path.resolve( HERE, "../.." );

const DEFAULT_TARGETS_DIR = path.join(
    process.env.HOME,
    "Library/Application Support/Blender/5.2/extensions/user_default/mpfb/data/targets"
);

/** The value MPFB stamps on a figure built by `tools/figure-pipeline/build_figure.py`. */
const SCALE_FACTOR = 0.10000000149011612;

/** hm08 with helper geometry. The export deletes the helpers; the fit rules of 10.7/10.9 read them. */
const BASEMESH_VERTEX_COUNT = 19158;

/**
 * Regions kept out of the exposed set, and the reason, because a silent exclusion is a lie by
 * omission. `asym` and `expression` need no entry here — they are not in `target.json` at all,
 * so the library's own taxonomy excludes them and the census below proves it.
 */
const EXCLUDED_REGIONS = {
    genitals: "Phase 9.8's decency invariant makes them unreachable, so a slider nothing can show "
        + "would be a lie. research/identity-sculpting.md §2.3."
};

// ---------------------------------------------------------------------------------------------

function main() {

    const targetsDir = argValue( "--targets-dir" ) ?? DEFAULT_TARGETS_DIR;

    if ( ! fs.existsSync( path.join( targetsDir, "target.json" ) ) ) {
        console.error( `No target.json under ${ targetsDir }. Install MPFB, or pass --targets-dir.` );
        process.exit( 1 );
    }

    const census = takeCensus( targetsDir );
    const grouping = JSON.parse( fs.readFileSync( path.join( targetsDir, "target.json" ), "utf8" ) );

    const regions = [];
    const sliders = [];
    const outDir = path.join( REPO, "assets/identity" );
    fs.mkdirSync( path.join( outDir, "targets" ), { recursive: true } );

    let packedEntries = 0;

    for ( const regionId of Object.keys( grouping ).sort() ) {

        const categories = grouping[ regionId ].categories;
        if ( categories.length === 0 ) continue;   // `measure` is an empty grouping key in target.json

        const excludedBecause = EXCLUDED_REGIONS[ regionId ] ?? null;
        const rawNames = [ ...new Set( categories.flatMap( ( c ) => c.targets ) ) ].sort();

        const { buffer, index } = packRegion( targetsDir, rawNames, census.pathOf );
        const records = [ ...index.values() ].reduce( ( n, e ) => n + e.count, 0 );

        const binName = `targets/${ regionId }.bin`;
        if ( ! excludedBecause ) {
            fs.writeFileSync( path.join( outDir, binName ), buffer );
            packedEntries += records;
        }

        regions.push( {
            id: regionId,
            label: grouping[ regionId ].label ?? regionId,
            sliderCount: categories.length,
            sidedCount: categories.filter( ( c ) => c.has_left_and_right ).length,
            widgetCount: categories.length + categories.filter( ( c ) => c.has_left_and_right ).length,
            rawTargetCount: rawNames.length,
            movedVertexRecords: excludedBecause ? 0 : records,
            exposed: ! excludedBecause,
            excludedBecause,
            bin: excludedBecause ? null : binName,
            binBytes: excludedBecause ? 0 : buffer.length,
            binSha256: excludedBecause ? null : crypto.createHash( "sha256" ).update( buffer ).digest( "hex" )
        } );

        for ( const category of categories ) {
            sliders.push( describeSlider( regionId, category, index, excludedBecause ) );
        }

    }

    // The notes are written LAST, from the finished regions and sliders, because a note is a
    // restatement and a restatement has to be derived from the thing it restates.
    census.summary.notes = censusNotes( census.summary, taxonomyOf( regions, sliders ) );

    const catalogue = {
        format: "sugata-identity-catalogue",
        formatVersion: 1,

        library: {
            id: "mpfb-20260722",
            licence: "CC0 (MPFB2 LICENSE.md §D)",
            grouping: "targets/target.json, MPFB's own slider taxonomy — not re-derived here",
            fileCount: census.files.length,
            basemeshVertexCount: BASEMESH_VERTEX_COUNT,
            unitScale: SCALE_FACTOR,
            unitScaleNote: "MakeHuman decimetres to metres. The float32 of 0.1, as MPFB stores it.",
            axisOrder: "xyz as written in the .target file, which is already glTF Y-up order"
        },

        census: census.summary,
        files: census.classification,

        regions,
        sliders
    };

    fs.writeFileSync(
        path.join( outDir, "catalogue.json" ),
        JSON.stringify( catalogue, null, 1 ) + "\n"
    );

    report( catalogue, packedEntries );

}

// ---------------------------------------------------------------------------------------------

/**
 * Classifies every `.target`/`.target.gz` file in the install into exactly one bucket.
 *
 * The buckets are the ones research §2.1 counted, and the point of doing it here rather than
 * trusting that table is that an unclassified file has to become visible: a target the library
 * grows and this build does not recognise is a slider we are not shipping and do not know we are
 * not shipping.
 */
function takeCensus( targetsDir ) {

    const files = [];
    const pathOf = new Map();

    ( function walk( dir ) {
        for ( const entry of fs.readdirSync( dir, { withFileTypes: true } ) ) {
            const full = path.join( dir, entry.name );
            if ( entry.isDirectory() ) { walk( full ); continue; }
            if ( ! entry.name.endsWith( ".target" ) && ! entry.name.endsWith( ".target.gz" ) ) continue;
            const rel = path.relative( targetsDir, full ).split( path.sep ).join( "/" );
            files.push( rel );
            pathOf.set( basenameOf( rel ), full );
        }
    } )( targetsDir );

    files.sort();

    const grouping = JSON.parse( fs.readFileSync( path.join( targetsDir, "target.json" ), "utf8" ) );
    const detailNames = new Set();
    for ( const region of Object.values( grouping ) ) {
        for ( const category of region.categories ) {
            for ( const name of category.targets ) detailNames.add( name );
        }
    }

    const classification = {};
    const counts = { detail: 0, macro: 0, "breast-macro": 0, expression: 0, asym: 0, unclassified: 0 };

    for ( const rel of files ) {

        const name = basenameOf( rel );
        let bucket;

        if ( detailNames.has( name ) ) bucket = "detail";
        else if ( rel.startsWith( "macrodetails/" ) ) bucket = "macro";
        else if ( rel.startsWith( "breast/" ) ) bucket = "breast-macro";
        else if ( rel.startsWith( "expression/" ) ) bucket = "expression";
        else if ( rel.startsWith( "asym/" ) ) bucket = "asym";
        else bucket = "unclassified";

        classification[ rel ] = bucket;
        counts[ bucket ] ++;

    }

    return {
        files,
        pathOf,
        classification,
        summary: {
            total: files.length,
            detail: counts.detail,
            macro: counts.macro,
            "breast-macro": counts[ "breast-macro" ],
            expression: counts.expression,
            asym: counts.asym,
            unclassified: counts.unclassified
            // `notes` is attached by main() once the sliders exist. See censusNotes().
        }
    };

}

/**
 * The four counts every prose claim about this library is really a claim about, read off the
 * catalogue's own slider list rather than off `target.json` a second time.
 *
 * `bipolar` and `unipolar` are the pair the corrected research §2.2 turns on: a bipolar category
 * names a file at each end and runs −1 → +1, a unipolar one names a single file and runs 0 → +1,
 * and describeSlider() decides which purely by whether `target.json` gave it an `opposites` block.
 */
export function taxonomyOf( regions, sliders ) {
    return {
        categories: sliders.length,
        bipolar: sliders.filter( ( s ) => s.range === "bipolar" ).length,
        unipolar: sliders.filter( ( s ) => s.range === "unipolar" ).length,
        sided: sliders.filter( ( s ) => s.sided ).length,
        regions: regions.length
    };
}

/**
 * The five census sentences, with every number templated out of the measured counts.
 *
 * 🚩 THIS FUNCTION IS THE FIX FOR A REAL DEFECT, so do not "simplify" it back into literals. The
 * detail note is the sentence that said "203 bidirectional sliders" while the catalogue sitting
 * around it recorded 195 bipolar and 8 unipolar ranges. Nothing was wrong with the DATA; the
 * English beside it had simply never been derived from anything.
 *
 * Two numbers here are structural rather than counted, and are asserted rather than templated:
 * the expression corpus is three ethnicity folders deep and the asym set is left/right pairs. If
 * either stops dividing, the sentence would be a new claim and the build should stop instead.
 */
export function censusNotes( counts, taxonomy ) {

    const facsUnits = exactQuotient( counts.expression, 3, "expression files over 3 ethnicities" );
    const asymPairs = exactQuotient( counts.asym, 2, "asym files over left/right" );

    return {
        detail: `${ counts.detail } files, grouped by target.json into ${ taxonomy.categories } `
            + `slider categories — ${ taxonomy.bipolar } bidirectional, ${ taxonomy.unipolar } `
            + `unipolar — across ${ taxonomy.regions } regions.`,
        macro: "The interpolation corpus for the eight macro.json parameters. "
            + `NOT ${ counts.macro } sliders.`,
        "breast-macro": "The corpus for cupsize and firmness, by the same combinatorial rule.",
        expression: `${ facsUnits } legacy FACS units x 3 ethnicities. `
            + "Expressions belong to Phase 5, not identity.",
        asym: `${ asymPairs } randomiser asymmetry pairs, no semantic label. Out of the exposed `
            + `set; 10.12 handles author-declared asymmetry through the ${ taxonomy.sided } sided `
            + "detail categories instead."
    };

}

function exactQuotient( total, divisor, what ) {
    if ( total % divisor !== 0 ) {
        throw new Error( `${ what }: ${ total } is not divisible by ${ divisor }, so the sentence `
            + "that assumes it would be a guess. Re-read the library before editing this note." );
    }
    return total / divisor;
}

/** `eyes/l-eye-scale-incr.target.gz` -> `l-eye-scale-incr`. */
function basenameOf( rel ) {
    const base = rel.slice( rel.lastIndexOf( "/" ) + 1 );
    return base.endsWith( ".gz" ) ? base.slice( 0, - ".target.gz".length ) : base.slice( 0, - ".target".length );
}

/**
 * Packs one region's raw targets into a single little-endian buffer.
 *
 * Record layout, 16 bytes, chosen so a runtime can take a Uint32Array view and a Float32Array
 * view over the same bytes with no copy and no misalignment:
 *
 *     uint32  basemesh vertex index      (0 .. 19157, so uint16 would fit — uint32 is what keeps
 *                                         the record 4-byte aligned for the three floats)
 *     float32 dx, dy, dz                 metres, glTF axis order
 */
function packRegion( targetsDir, rawNames, pathOf ) {

    const chunks = [];
    const index = new Map();
    let offset = 0;

    for ( const name of rawNames ) {

        const file = pathOf.get( name );
        if ( ! file ) throw new Error( `target.json names '${ name }' and no file carries it.` );

        const rows = readTargetFile( file );
        const buffer = Buffer.allocUnsafe( rows.length * 16 );

        rows.forEach( ( row, i ) => {
            buffer.writeUInt32LE( row[ 0 ], i * 16 );
            buffer.writeFloatLE( row[ 1 ] * SCALE_FACTOR, i * 16 + 4 );
            buffer.writeFloatLE( row[ 2 ] * SCALE_FACTOR, i * 16 + 8 );
            buffer.writeFloatLE( row[ 3 ] * SCALE_FACTOR, i * 16 + 12 );
        } );

        index.set( name, { offset, count: rows.length } );
        offset += buffer.length;
        chunks.push( buffer );

    }

    return { buffer: Buffer.concat( chunks ), index };

}

function readTargetFile( file ) {

    const raw = fs.readFileSync( file );
    const text = file.endsWith( ".gz" ) ? zlib.gunzipSync( raw ).toString( "utf8" ) : raw.toString( "utf8" );
    const rows = [];

    for ( const line of text.split( "\n" ) ) {
        const trimmed = line.trim();
        if ( ! trimmed || trimmed.startsWith( "#" ) || trimmed.startsWith( '"' ) ) continue;
        const parts = trimmed.split( /\s+/ );
        const index = Number( parts[ 0 ] );
        if ( ! Number.isInteger( index ) || index < 0 || index >= BASEMESH_VERTEX_COUNT ) {
            throw new Error( `${ file }: vertex index ${ parts[ 0 ] } is outside the basemesh.` );
        }
        rows.push( [ index, Number( parts[ 1 ] ), Number( parts[ 2 ] ), Number( parts[ 3 ] ) ] );
    }

    return rows;

}

/**
 * One catalogue entry per `target.json` category — which is literally one slider running −1 → +1,
 * because MPFB's `opposites` block already says which file is the negative end and which the
 * positive, per side.
 */
function describeSlider( regionId, category, index, excludedBecause ) {

    const ends = {};

    // 🚩 Eight of the 203 are NOT bidirectional and target.json says so by omitting `opposites`
    // entirely: the seven `head-<shape>` categories and `chin-triangle` each name one file and run
    // 0 → +1. research/identity-sculpting.md §2.2 USED TO call all 203 "bidirectional slider
    // categories" and was corrected 2026-08-09; measured against the library, 195 are and 8 are
    // not. The arithmetic still lands on 530 files (66 sided × 4 + 129 unsided-bidirectional × 2
    // + 8 unipolar × 1), so the count the research gates on is right and only the adjective was
    // loose. `censusNotes()` above now derives the adjective instead of typing it.
    const opposites = category.opposites ?? { "positive-unsided": category.targets[ 0 ] };

    for ( const [ key, name ] of Object.entries( opposites ) ) {
        if ( ! name ) continue;
        const entry = index.get( name );
        if ( ! entry ) throw new Error( `${ regionId }/${ category.name }: no packed data for '${ name }'.` );
        ends[ key ] = { target: name, offset: entry.offset, count: entry.count };
    }

    return {
        id: `${ regionId }/${ category.name }`,
        region: regionId,
        name: category.name,
        label: category.label,
        sided: category.has_left_and_right,

        // "bipolar" runs −1 → +1 with a named file at each end; "unipolar" runs 0 → +1 and a
        // negative weight would apply a shape backwards, which is not a shape the library authored.
        range: category.opposites ? "bipolar" : "unipolar",

        // `measure-*` categories are keyed to a body measurement rather than to a shape adjective,
        // and research §2.3 puts them in a centimetres panel rather than on a −1 → +1 dial. The
        // engine treats both the same; the tag is for 10.10 and for Phase 9.12's body vector.
        kind: category.name.startsWith( "measure-" ) ? "measure" : "shape",

        // `<part>-<verb>-<direction>`, collapsed to the axis a person would name. research §4.3(c)
        // needs 3–5 axes per region rather than 22 sliders, and this is where that comes from.
        axis: axisOf( category.name ),

        exposed: ! excludedBecause,
        ends
    };

}

const AXIS_BY_VERB = [
    [ /-scale-(horiz|vert|depth)|^measure-.*-(circ|dist|length|height)/, "size" ],
    [ /-scale-/, "size" ],
    [ /-trans-/, "position" ],
    [ /-push\d?-/, "position" ],
    [ /-volume-|-fat-|-muscle-/, "volume" ],
    [ /-width\d?-|-height\d?-/, "size" ],
    [ /-down-up$|-in-out$|-backward-forward$/, "position" ]
];

function axisOf( name ) {
    for ( const [ pattern, axis ] of AXIS_BY_VERB ) {
        if ( pattern.test( name ) ) return axis;
    }
    return "shape";
}

function report( catalogue, packedEntries ) {

    const exposed = catalogue.sliders.filter( ( s ) => s.exposed );
    const bytes = catalogue.regions.reduce( ( n, r ) => n + r.binBytes, 0 );

    console.log( `library          ${ catalogue.census.total } files` );
    for ( const bucket of [ "detail", "macro", "breast-macro", "expression", "asym", "unclassified" ] ) {
        console.log( `  ${ bucket.padEnd( 14 ) } ${ String( catalogue.census[ bucket ] ).padStart( 5 ) }` );
    }
    console.log( `regions          ${ catalogue.regions.length } (${ catalogue.regions.filter( ( r ) => r.exposed ).length } exposed)` );
    console.log( `sliders          ${ catalogue.sliders.length } (${ exposed.length } exposed, `
        + `${ exposed.filter( ( s ) => s.sided ).length } sided -> `
        + `${ exposed.length + exposed.filter( ( s ) => s.sided ).length } widgets)` );
    console.log( `packed           ${ packedEntries } moved-vertex records shipped, ${ ( bytes / 1e6 ).toFixed( 2 ) } MB` );
    const widest = [ ...catalogue.regions ].filter( ( r ) => r.exposed )
        .sort( ( a, b ) => b.binBytes - a.binBytes ).slice( 0, 3 );
    console.log( `largest regions  ${ widest.map( ( r ) => `${ r.id } ${ ( r.binBytes / 1e6 ).toFixed( 2 ) } MB` ).join( ", " ) }` );

}

function argValue( flag ) {
    const i = process.argv.indexOf( flag );
    return i === - 1 ? null : process.argv[ i + 1 ];
}

// Only build when run as a script. `identityassets.selftest.mjs` imports censusNotes() and
// taxonomyOf() to re-derive the shipped catalogue's prose, and it must be able to do that on a
// machine with no MPFB install — which is every machine that is not the one that baked the assets.
if ( process.argv[ 1 ] && path.resolve( process.argv[ 1 ] ) === fileURLToPath( import.meta.url ) ) {
    main();
}
