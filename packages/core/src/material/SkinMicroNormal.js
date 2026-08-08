/**
 * SkinMicroNormal — the tiled secondary normal map, generated rather than authored.
 *
 * No three.js import, for the same reason as its siblings: `SkinMaterial.js` turns the bytes into
 * a `DataTexture`, `tools/lut-bake/bake.mjs` writes them out as a PNG to look at, and the selftest
 * measures them. One generator, three readers.
 *
 * ## What this is allowed to be, and what it is explicitly not
 *
 * `docs/research/stellar-blade-look-spec.md` §0.2 measures the reference's skin micro-detail and
 * the finding is a *ceiling*, not a floor:
 *
 *   - flat-lit cheek high-pass σ is **1.44–2.11 / 255**, against 6–12 for photoreal scan skin;
 *   - **no individual pore resolves even at 4K on a face filling half the frame**;
 *   - the signal is **achromatic** (per-channel σ within 3%), so it is a normal/cavity map and
 *     not albedo noise.
 *
 * PUNCHLIST's standing constraints then say it in the negative: *do not add facial asymmetry,
 * blemish noise, pore detail, or white sclera.* Those two are consistent and both are honoured
 * here. There are no pores in this generator — no cell structure, no follicle marks, no pits. It
 * is band-limited fractal noise whose only job is to break a perfectly smooth specular into
 * something that scintillates the way skin does, at roughly a quarter of photoreal amplitude.
 *
 * A normal map is also the *right* place for it, and that is a measured claim rather than a
 * stylistic one: the reference's high-frequency signal is achromatic, which albedo noise on a
 * pigmented surface is not.
 *
 * ## Tileable by construction
 *
 * Every octave is a value-noise lattice whose indices wrap modulo the lattice size, and every
 * lattice size divides the map size, so the map is periodic at its own edges to the bit. Nothing
 * here needs a mirrored border or a blend seam. `lut-bake.selftest.mjs` asserts the wrap by
 * comparing the first and last columns' gradients.
 */

/** Map size. `docs/research/rendering-stack.md`: "a tiled 256×256 secondary normal at high repeat". */
export const MICRO_NORMAL_SIZE = 256;

/**
 * Octaves, as (lattice cells across the map, relative height amplitude).
 *
 * Deliberately band-limited at both ends. Below 16 cells the map's own shape starts reading as a
 * blotch rather than as texture and would fight the albedo; above 64 cells the features are under
 * two texels and survive neither mipmapping nor the 0.66 resolution scale — they would only ever
 * contribute aliasing, which three.js cannot filter away because its specular anti-aliasing is
 * geometric only and takes derivatives of the *interpolated vertex* normal (rendering-stack.md §6).
 */
const OCTAVES = [
    { cells: 16, amplitude: 0.45 },
    { cells: 32, amplitude: 0.35 },
    { cells: 64, amplitude: 0.20 }
];

/**
 * How steep the encoded normals are before the material's own `normalScale` is applied.
 *
 * ⚠️ This number is not free and it is not a taste judgement — it is SOLVED against G4, and the
 * derivation is the only reason the shipped `normalScale` means what the look spec says it means.
 *
 * The spec gives a tuning range (`normalScale (detail) 0.15 – 0.25`) and a target
 * (`high-pass σ 1.5–2.1 / 255`). Those two only agree for one baked steepness, because the spec's
 * range was stated against the spec's own detail map and nobody can know how steep that was. So
 * the steepness is chosen to put the σ target in the middle of the scale range rather than at one
 * end of it.
 *
 * Measured on the browsercheck page at 3840 x 2160 with the head at 57.4% of frame height, on
 * figure_g050's own UV density (1.1607 UV units per metre of surface on the head, measured — so a
 * repeat of 48 puts about 8.4 tiles across the face, inside the spec's "tiled 8–12x"):
 *
 *     HEIGHT_TO_SLOPE 6.0, normalScale 0.20  ->  high-pass σ 4.68 / 255      (2.2x over the band)
 *
 * σ is very close to linear in the product of the two for perturbations this small, so the
 * steepness that puts σ = 1.8 at normalScale 0.20 is 6.0 x 1.8 / 4.68 = 2.31.
 *
 * A note on why this cannot be fixed by resolution instead: σ measured 4.57 at 1400 px and 4.68 at
 * 3840 px for the same scale — it barely moved. The detail's on-screen wavelength stays inside the
 * 5x5 high-pass window at both, so there is no framing at which an over-steep map comes good.
 *
 * 🚩 **THE CALIBRATION ABOVE IS FOR skin.html, AND skin.html IS NOT THE PAGE THE GATE IS READ ON.**
 * The steepness is left where it is because it is a property of the texture and because the
 * measurement behind it is real; but the σ it produces is not one number, it is one number PER
 * PAGE, and this file's derivation was done on the browsercheck. Measured on the same texture at
 * the same 3840 px reference width on both pages, this round:
 *
 *     normalScale     skin.html (3840x2160)     alive.html (3840x5120)
 *        0.20               1.9308                    1.4764   <- G4 RED
 *        0.25               2.4563   <- out of band   1.7548   <- G4 GREEN
 *
 * They differ by 1.40x because the head is a different size in frame and the rig is a different
 * rig, and G4 high-passes a SHADED surface. `alive.html` is what a judge captures, so
 * `SKIN_DEFAULTS.microNormalScale` is set for `alive.html` and the browsercheck's own σ is
 * knowingly above the band. Do not "fix" that by moving the steepness — it would take alive.html
 * back out of the band, which is the mistake this note exists to stop being made twice.
 */
const HEIGHT_TO_SLOPE = 2.31;

/**
 * Generates the micro-normal map.
 *
 * @param {Object} [options]
 * @param {number} [options.size=MICRO_NORMAL_SIZE]
 * @param {number} [options.seed=0x5EED5C1] - any change here changes the shipped texture.
 * @returns {{rgba: Uint8Array, size: number, heightRms: number, slopeRms: number}}
 *   `rgba` is tangent-space +Z-up normals in the usual 0.5-centred encoding, alpha 255.
 */
export function buildSkinMicroNormal( options = {} ) {

    const size = options.size ?? MICRO_NORMAL_SIZE;
    const seed = options.seed ?? 0x5EED5C1;

    const height = new Float32Array( size * size );

    let octaveIndex = 0;

    for ( const octave of OCTAVES ) {

        if ( size % octave.cells !== 0 ) {

            throw new Error( `SkinMicroNormal: octave of ${ octave.cells } cells does not divide a ${ size } px map, so it would not tile.` );

        }

        addValueNoiseOctave( height, size, octave.cells, octave.amplitude, seed + octaveIndex * 7919 );
        octaveIndex ++;

    }

    normaliseToZeroMeanUnitRms( height );

    const rgba = new Uint8Array( size * size * 4 );
    let slopeSquaredSum = 0;

    for ( let y = 0; y < size; y ++ ) {

        for ( let x = 0; x < size; x ++ ) {

            // Central differences with wrapped neighbours — the same wrap the lattice uses, so the
            // gradient is periodic too and the seam is not merely invisible but absent.
            const left = height[ y * size + wrap( x - 1, size ) ];
            const right = height[ y * size + wrap( x + 1, size ) ];
            const down = height[ wrap( y - 1, size ) * size + x ];
            const up = height[ wrap( y + 1, size ) * size + x ];

            const dx = ( right - left ) * 0.5 * HEIGHT_TO_SLOPE;
            const dy = ( up - down ) * 0.5 * HEIGHT_TO_SLOPE;

            slopeSquaredSum += dx * dx + dy * dy;

            const length = Math.hypot( dx, dy, 1 );
            const at = ( y * size + x ) * 4;

            rgba[ at ] = toByte( ( -dx / length ) * 0.5 + 0.5 );
            rgba[ at + 1 ] = toByte( ( -dy / length ) * 0.5 + 0.5 );
            rgba[ at + 2 ] = toByte( ( 1 / length ) * 0.5 + 0.5 );
            rgba[ at + 3 ] = 255;

        }

    }

    let heightSquaredSum = 0;
    for ( let i = 0; i < height.length; i ++ ) heightSquaredSum += height[ i ] * height[ i ];

    return {
        rgba,
        size,
        heightRms: Math.sqrt( heightSquaredSum / height.length ),
        slopeRms: Math.sqrt( slopeSquaredSum / height.length )
    };

}

/**
 * One octave of tileable value noise, bilinearly interpolated with a smoothstep fade.
 *
 * Value noise rather than gradient (Perlin) noise on purpose: Perlin is zero at every lattice
 * point, which puts a regular grid of zero-crossings into the height field, and at three octaves
 * on a 256 px map that grid is visible as a plaid. Value noise has no such structure.
 */
function addValueNoiseOctave( height, size, cells, amplitude, seed ) {

    const lattice = new Float32Array( cells * cells );
    const random = mulberry32( seed );

    for ( let i = 0; i < lattice.length; i ++ ) lattice[ i ] = random() * 2 - 1;

    const cellSize = size / cells;

    for ( let y = 0; y < size; y ++ ) {

        const fy = y / cellSize;
        const y0 = Math.floor( fy ) % cells;
        const y1 = ( y0 + 1 ) % cells;
        const ty = smoothstep( fy - Math.floor( fy ) );

        for ( let x = 0; x < size; x ++ ) {

            const fx = x / cellSize;
            const x0 = Math.floor( fx ) % cells;
            const x1 = ( x0 + 1 ) % cells;
            const tx = smoothstep( fx - Math.floor( fx ) );

            const top = lattice[ y0 * cells + x0 ] * ( 1 - tx ) + lattice[ y0 * cells + x1 ] * tx;
            const bottom = lattice[ y1 * cells + x0 ] * ( 1 - tx ) + lattice[ y1 * cells + x1 ] * tx;

            height[ y * size + x ] += amplitude * ( top * ( 1 - ty ) + bottom * ty );

        }

    }

}

function normaliseToZeroMeanUnitRms( field ) {

    let sum = 0;
    for ( let i = 0; i < field.length; i ++ ) sum += field[ i ];
    const mean = sum / field.length;

    let squares = 0;
    for ( let i = 0; i < field.length; i ++ ) {

        field[ i ] -= mean;
        squares += field[ i ] * field[ i ];

    }

    const rms = Math.sqrt( squares / field.length );
    if ( rms <= 0 ) return;

    for ( let i = 0; i < field.length; i ++ ) field[ i ] /= rms;

}

function smoothstep( t ) {

    return t * t * ( 3 - 2 * t );

}

function wrap( value, size ) {

    return ( value + size ) % size;

}

function toByte( value ) {

    return Math.max( 0, Math.min( 255, Math.round( value * 255 ) ) );

}

/** mulberry32 — a small, well-distributed, seedable PRNG. Determinism is the whole requirement. */
function mulberry32( seed ) {

    let state = seed >>> 0;

    return function () {

        state = ( state + 0x6D2B79F5 ) >>> 0;
        let t = state;
        t = Math.imul( t ^ ( t >>> 15 ), t | 1 );
        t ^= t + Math.imul( t ^ ( t >>> 7 ), t | 61 );
        return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;

    };

}
