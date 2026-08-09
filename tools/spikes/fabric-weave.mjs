/**
 * fabric-weave — punch list **9.16**, a SPIKE. It answers a question and ships no production code.
 *
 * THE CLAIM UNDER TEST
 * --------------------
 * That a garment's *material* can be generated from `{weave, endsPerInch, picksPerInch, yarnTex,
 * gsm}` instead of sampled off a scan — weave normal, roughness, and the sheen/anisotropy lobe.
 * This is the claim that makes Phase 9 tractable where photoreal skin was not, so it gets a real
 * test rather than a demo.
 *
 * WHAT WAS ALREADY DE-RISKED, AND IS NOT REDONE HERE
 * --------------------------------------------------
 * `research/wardrobe-system.md` §4.4 records a probe that generated plain / 2-1 twill / 3-1 twill /
 * 4-1 satin height fields from thread count alone at 24.8 µm/texel over a 12.7 mm patch, and
 * measured them. Quoting it verbatim rather than re-deriving it:
 *
 *   | fabric                   | ridge° | coherence | pitch x mm | pitch y mm |
 *   | poplin, plain, 120x80    |  90.00 |    0.2887 |     0.4217 |     3.1750 |
 *   | denim, 3/1 RH twill 68x44| -90.00 |    0.5989 |     1.4883 |     2.3068 |
 *   | gabardine, 2/1 twill100x60| -90.00|    0.5560 |     0.7689 |     1.2650 |
 *   | satin, 4/1, 180x90       | -90.00 |    0.7429 |     1.4139 |     1.4139 |
 *
 * *"Coherence… separates plain weave from twill by 1.9–2.6x (0.2887 against 0.556–0.743) and orders
 * the twills by float length exactly as it should: 2/1 < 3/1 < 4/1 satin."*
 *
 * 🚩 AND THE OBVIOUS GATE IS THE WRONG ONE — PROVEN THERE, NOT PREDICTED
 * ---------------------------------------------------------------------
 * The same probe's **orientation** readout failed: *"Every twill reported −90.00°, i.e.
 * axis-aligned, not the diagonal"*, against predicted 32.91° / 30.96° / 45.00°, *"because a
 * whole-patch structure tensor is dominated by the yarn cross-section ridges… the twill diagonal is
 * a lower-amplitude, longer-wavelength modulation on top of them."* Its autocorrelation pitch was
 * also out by 2–10x *"because the repeat is `over + under` yarns, not one."*
 *
 * That agent reported it as a FAILURE instead of tuning it away, which is why this file exists at
 * all. §1.25a: the same discipline applies here. If the gate below fails, it gets reported.
 *
 * THE GATE THIS FILE IMPLEMENTS
 * -----------------------------
 * Recover the twill angle from an **FFT peak at the weave-repeat frequency**, and match it against
 * `atan((picks x advance) / ends)` — the angle from the WARP (lengthwise, +y) axis. Three things
 * make it a gate rather than a demo, and all three are executed by `--gate`:
 *
 *   RED 1 — a **plain weave**, which has no twill line to find. The refusal is principled, not a
 *           special case: a plain draft satisfies `(i−j) mod 2 == (i+j) mod 2`, so the height field
 *           is mirror-symmetric in x and the ± diagonals carry identical energy. The gate measures
 *           that symmetry (`chirality`) and declines.
 *   RED 2 — the **whole-patch structure tensor** run on a CORRECT twill, which is the −90° above.
 *           Both instruments run on the same field in the same pass, so the disagreement is
 *           demonstrated rather than asserted.
 *   RED 3 — 🚩 **and a different mechanism in the same class**, per LEARNINGS §1.25a: *"Write the
 *           known-bad you were going to write. Then write a second one you did not have in mind
 *           when you designed the gate."* `WEAVE_DEFECTS` below lists five, of which the two that
 *           matter are `s-twill` (correct magnitude, WRONG HANDEDNESS — kills any gate that
 *           compares `|angle|`) and `painted-diagonal` (a sinusoid at exactly the right wave vector
 *           with no interlacing underneath — which the FFT gate **passes**, and which is caught
 *           only by the independent draft-recovery check).
 *
 * WHAT EACH CHECK CAN AND CANNOT SEE — stated in the tool's own output, per §1.25b
 * -------------------------------------------------------------------------------
 *   `fftTwillAngle`   sees the ORIENTATION and CHIRALITY of the dominant off-axis modulation.
 *                     It is blind to whether that modulation came from an interlacing at all.
 *   `recoverDraft`    sees whether the surface is really made of warp and weft floats of the right
 *                     lengths. It is blind to the diagonal's angle.
 *   `structureTensor` sees gradient anisotropy. It is blind to the diagonal entirely — that is the
 *                     point, and it is RED 2.
 *   None of the three can see whether the maps reach the shader in the right orientation. That is
 *   `packages/testbed/src/fabric.html`'s job, and only a rendered measurement closes it (§1.25b:
 *   *"What closes it is not a third static check. It is a rendered measurement."*).
 *
 * SCOPE — THREE OF THE NINE NAMED FAMILIES ARE NOT WOVEN, AND ONE IS NOT A TEXTILE
 * -------------------------------------------------------------------------------
 * See `FABRIC_CLASSES`. Jersey / piqué / rib are **loop** structures: they have no warp, no weft,
 * no float and therefore no twill line, and the twill gate does not apply to them — they get the
 * analogous gate (wale : course frequency ratio recovered from the FFT axis peaks). Melton and
 * fleece are **napped**: the structure is fulled or brushed over and is not recoverable from thread
 * count at all. Leather is a **BRDF, not a weave** — no lattice, no repeat; it gets a cell/grain
 * model and is excluded from every weave gate here.
 *
 * RUN IT
 * ------
 *   node tools/spikes/fabric-weave.mjs --table            the parameterised taxonomy, with sources
 *   node tools/spikes/fabric-weave.mjs --measure          generate + measure every woven family
 *   node tools/spikes/fabric-weave.mjs --gate             the gate, its three reds, exit 1 on fail
 *   node tools/spikes/fabric-weave.mjs --noise            robustness sweep of the gate vs noise
 *   node tools/spikes/fabric-weave.mjs --json             machine-readable dump of --measure
 *   flags: --family <key> --res 512 --nonperiodic
 *
 * The module is dependency-free and side-effect-free on import, so
 * `packages/testbed/src/fabric.js` imports the SAME generator the gate measured. A browser page
 * that re-implements the maths would be a CPU mirror of itself (§1.25b).
 */

// =================================================================================================
// 1. Yarn geometry — the formulae, and the four in-repo values they were checked against
// =================================================================================================

const MICRONS_PER_INCH = 25400;

/**
 * Cotton count (Ne) to linear density in tex. 1 Ne = 840 yd in 1 lb; the constant is exact.
 */
export function texFromCottonCount( ne ) {

    return 590.5 / ne;

}

/**
 * Peirce (1937) yarn diameter, in the unit-safe form recorded in `research/wardrobe-system.md`
 * §5.3: `d (µm) = 37.42 · √tex`, equivalently `908.8 / √Ne`.
 *
 * ⚠️ That section also flags the trap: *"A widely-copied web source states `d(mm) = 0.0037·√tex`,
 * which is wrong by 10x — 0.0037 is the centimetre coefficient."*
 *
 * Verified by execution against the four worked values in §5.3 — see `checkYarnDiameterFormula()`,
 * which runs as part of `--gate`. Cotton-specific: substitute the polymer's specific volume for
 * polyester or nylon filament rather than reusing 908.8.
 */
export function yarnDiameterMicrons( tex ) {

    return 37.42 * Math.sqrt( tex );

}

/** 1 oz/yd² = 33.906 g/m² (28.349523125 g ÷ 0.83612736 m²), exact, from §5.3. */
export const GSM_PER_OZ_PER_SQYD = 33.906;

/**
 * The four diameters §5.3 states, re-derived here. A formula transcribed into a new file is a
 * new opportunity to transcribe it wrong; this is cheaper than finding out later.
 */
export function checkYarnDiameterFormula() {

    const cases = [
        { label: 'denim warp Ne 9.13', ne: 9.13, published: 301 },
        { label: 'denim weft Ne 14', ne: 14, published: 243 },
        { label: 'jersey Ne 30', ne: 30, published: 166 },
        { label: 'poplin Ne 45', ne: 45, published: 135 }
    ];

    return cases.map( ( c ) => {

        const computed = yarnDiameterMicrons( texFromCottonCount( c.ne ) );
        return { ...c, computed, errorMicrons: computed - c.published };

    } );

}

// =================================================================================================
// 2. The taxonomy — nine named families plus the controls, with every number's provenance
// =================================================================================================
//
// Marks follow the research doc's own convention:
//   [M] measured in this repo   [V] verified against a published source   [I] extrapolated
//   [✗] no source found — and where that is the case the field is `null`, never a plausible guess.

export const WOVEN = 'woven';
export const KNIT = 'knit';
export const NAPPED = 'napped';
export const NON_TEXTILE = 'non-textile';

export const FABRIC_CLASSES = {
    [ WOVEN ]: 'warp x weft interlacing. Height field derivable from the draft. Twill gate applies.',
    [ KNIT ]: 'intermeshed loops. No warp, no weft, no float, NO TWILL LINE. Wale:course gate applies.',
    [ NAPPED ]: 'fulled or brushed pile. The structure is destroyed on purpose; thread count does not describe the surface. Sheen lobe only.',
    [ NON_TEXTILE ]: 'not a weave at all. A BRDF plus a grain model. Excluded from every weave gate.'
};

/**
 * `weave` carries the draft: `over` / `under` picks the warp floats, and `advance` is the move
 * number — 1 for a regular twill, 2 or 3 for a 5-end satin. Sign of `advance` is handedness:
 * **positive is Z (right-hand)**, which is what denim is.
 */
export const FABRIC_FAMILIES = [

    {
        key: 'denim',
        label: 'denim, 11 oz, 3/1 Z twill',
        klass: WOVEN,
        weave: { name: '3/1 Z twill', over: 3, under: 1, advance: 1 },
        endsPerInch: 68,
        picksPerInch: 44,
        warpNe: 9.13,
        weftNe: 14,
        gsm: 360,
        gsmRange: [ 331, 390 ],
        drape: null,                                     // [✗] none published, anywhere — §5.3
        roughness: [ 0.55, 0.75 ],                       // [I]
        lobe: 'anisotropy along the twill line',
        secondaryMotion: 'hem/cuff spring bones',
        source: 'wardrobe-system §5.3 [V] 57->75 finished ends/in, 45-50 picks/in, warp Ne 7.5-9.13, weft Ne 11.25-14, 331-390 g/m². Sett 68x44 taken from the §4.4 probe so the numbers here are comparable with it.'
    },

    {
        key: 'chino',
        label: 'cotton woven twill (chino), 3/1',
        klass: WOVEN,
        weave: { name: '3/1 Z twill', over: 3, under: 1, advance: 1 },
        endsPerInch: 114.3,                              // 45 ends/cm
        picksPerInch: 67.31,                             // 26.5 picks/cm
        warpTex: 36.9,
        weftTex: 28.27,
        gsm: 248.93,
        drape: { value: 79.81, specimenCm: null, method: 'Cusick, diameter not stated in the extract' },
        thicknessMm: 0.50,                               // [V] measured, F&T 1/2018
        roughness: [ 0.60, 0.75 ],                       // [I]
        lobe: 'mild anisotropy',
        secondaryMotion: 'none if fitted',
        source: 'wardrobe-system §5.3 [V] "Analysis of a Fabric Drape Profile", Fibres and Textiles 1/2018 — the twill 3/1 row: 45 ends/cm, 26.5 picks/cm, 248.93 g/m², 0.50 mm, DC 79.81%. Yarns held constant across that comparison at warp 36.9 tex / weft 28.27 tex, 50/50 PES/Co.'
    },

    {
        key: 'gabardine',
        label: 'gabardine, 2/2 twill',
        klass: WOVEN,
        weave: { name: '2/2 Z twill', over: 2, under: 2, advance: 1 },
        endsPerInch: 114.3,                              // 45 ends/cm
        picksPerInch: 68.58,                             // 27 picks/cm
        warpTex: 36.9,
        weftTex: 28.27,
        gsm: 248.11,
        drape: { value: 85.15, specimenCm: null, method: 'Cusick, diameter not stated in the extract' },
        thicknessMm: 0.53,                               // [V]
        roughness: [ 0.55, 0.70 ],                       // [M] look-spec leather/shearling band
        lobe: 'sheen — Irawan WoolGabardine 6x9, warpArea 12, weftArea 6',
        secondaryMotion: 'drape at hem',
        source: 'wardrobe-system §5.3 [V] F&T 1/2018 twill 2/2 row. ⚠️ THE TWO IN-REPO SOURCES DISAGREE ON GABARDINE: §5.3 says 2/2 twill at 45x27 /cm; the §4.4 probe used "gabardine, 2/1 twill, 100x60 /in". Both are carried — see the `gabardine-probe` control — because picking one silently would erase the disagreement.'
    },

    {
        key: 'worsted-wool',
        label: 'worsted wool suiting, 2/2 twill',
        klass: WOVEN,
        weave: { name: '2/2 Z twill', over: 2, under: 2, advance: 1 },
        endsPerInch: 114.3,
        picksPerInch: 68.58,
        warpTex: 36.9,
        weftTex: 28.27,
        gsm: 248.11,
        drape: { value: 85.15, specimenCm: null, method: 'Cusick, diameter not stated in the extract' },
        thicknessMm: 0.53,
        roughness: [ 0.55, 0.70 ],                       // [M]
        lobe: 'sheen',
        secondaryMotion: 'drape at hem',
        source: '⚠️ SHARES gabardine\'s row. wardrobe-system §5.3 puts "wool suiting / gabardine" on ONE line, and the only measured anchor behind it is the F&T twill 2/2 fabric — whose yarns are 50/50 PES/Co, NOT wool. [✗] No worsted-specific sett or yarn count was found in repo. The geometry here is therefore a PES/Co twill wearing a wool label, and the roughness/sheen are what make it read as wool.'
    },

    {
        key: 'jersey',
        label: 'cotton single jersey',
        klass: KNIT,
        knit: { name: 'single jersey', walesPerCm: 23, coursesPerCm: 17, cell: 'plain', ribWales: 0 },
        yarnTex: 40,
        gsm: 146.7,
        gsmSet: [ 96.8, 146.7, 208.8 ],
        drape: { value: [ 18, 31 ], specimenCm: 25, method: '⚠️ 25 cm specimen, NOT Cusick — not comparable with the woven DCs above' },
        roughness: [ 0.65, 0.80 ],                       // [I]
        lobe: 'soft sheen',
        secondaryMotion: 'clings; little',
        source: 'wardrobe-system §5.3 [V] single jersey 20-27 wales/cm, 14-20 courses/cm, weft 29.5-66 tex, 96.8 / 146.7 / 208.8 g/m². Mid-range taken for wales, courses and tex.'
    },

    {
        key: 'pique',
        label: 'cotton piqué (polo)',
        klass: KNIT,
        knit: { name: 'piqué / Lacoste', walesPerCm: 20, coursesPerCm: 15, cell: 'pique', ribWales: 0, cellWales: 2, cellCourses: 4 },
        yarnTex: 45,
        gsm: null,                                       // [✗]
        drape: null,                                     // [✗]
        roughness: [ 0.65, 0.80 ],                       // [I], jersey's band
        lobe: 'soft sheen, broken by the cell',
        secondaryMotion: 'clings; little',
        source: '🚩 [✗] NO IN-REPO SOURCE. wardrobe-system has no piqué row at all — §5.3 covers single jersey only. The wale/course figures here are AUTHORED inside jersey\'s measured 20-27 / 14-20 band and the 2-wale x 4-course tuck cell is authored outright. Everything about this family is a placeholder with the right shape, and it is listed so the hole is visible rather than filled.'
    },

    {
        key: 'rib',
        label: '1x1 rib knit',
        klass: KNIT,
        knit: { name: '1x1 rib', walesPerCm: 23, coursesPerCm: 17, cell: 'plain', ribWales: 1 },
        yarnTex: 45,
        gsm: null,                                       // see source — deliberately not filled
        drape: null,
        roughness: [ 0.65, 0.80 ],                       // [I]
        lobe: 'soft sheen; the rib channel dominates the silhouette, not the lobe',
        secondaryMotion: 'clings; little',
        source: '🚩 [✗] GSM DELIBERATELY EMPTY. The only rib figure in repo is Wang/O\'Brien/Ramamoorthi\'s "Ivory Rib Knit 0.276 kg/m²", and §5.3 carries a double-flag on that dataset: *"DO NOT SHIP THE WANG VALUES… Any other use requires specific prior written permission."* Their RATIO finding is licence-free and IS used: woven stiffness is flatly anisotropic (denim c22/c11 ~4.6:1, near-constant across bias) while knit swings 2.1->5.6, i.e. knit is soft and bias-dependent. Geometry mirrors jersey with a 2-wale rib period.'
    },

    {
        key: 'melton',
        label: 'melton wool, fulled',
        klass: NAPPED,
        substrate: { name: 'plain or 2/2 twill ground, then fulled', over: 2, under: 2, advance: 1 },
        gsm: null,                                       // [✗]
        drape: null,
        roughness: [ 0.70, 0.90 ],                       // [I], §5.3 shearling/velvet/fleece row
        lobe: 'sheen — fibre ends, not a weave',
        secondaryMotion: 'stiff; hem only',
        source: '🚩 THE HONEST NEGATIVE OF THIS FILE. Melton is milled and fulled until the ground weave is mechanically destroyed; §4.5 has no row for it because there is nothing to derive. Thread count predicts NOTHING about a melton surface. What is generable is the sheen lobe and a fibre-noise normal — and those are authored, not derived.'
    },

    {
        key: 'fleece',
        label: 'polyester fleece, brushed pile',
        klass: NAPPED,
        substrate: { name: 'knit ground, brushed both faces', walesPerCm: 18, coursesPerCm: 14 },
        gsm: null,
        drape: null,
        roughness: [ 0.70, 0.90 ],                       // [I]
        lobe: '🎯 sheen, and §5.3 says the trick is GEOMETRIC: Sadeghi reproduces velvet purely with thread tangents at -90°',
        secondaryMotion: 'fuzz reads at silhouette',
        source: 'wardrobe-system §5.3 shearling/velvet/fleece row, roughness [I]. The -90° tangent finding is [V] from Sadeghi et al. 2013 Table II (velvet, both thread directions, tangent offsets -90,-50 and -90,-55,55,90). Same class as melton: the ground is not the surface.'
    },

    {
        key: 'leather',
        label: 'leather',
        klass: NON_TEXTILE,
        gsm: null,
        drape: { value: 67.22, specimenCm: null, method: 'faux leather, Cusick, diameter not stated' },
        roughness: [ 0.55, 0.70 ],                       // [M]
        lobe: 'clearcoat for patent; grain is a CELL structure (follicle/Voronoi), not a lattice',
        secondaryMotion: 'Blender preset: bending 150, 3000x silk',
        source: '🚩 LEATHER IS A BRDF, NOT A WEAVE, and it is in this file only to say so. It has no ends, no picks, no yarn tex and no repeat, so `{weave, endsPerInch, picksPerInch, yarnTex, gsm}` describes nothing about it. Every weave gate here is INAPPLICABLE by construction and the tool refuses it rather than returning a number. Numbers above are wardrobe-system §5.1/§5.3 [M].'
    }

];

/**
 * Controls that are not shipping families. `poplin` is the plain-weave RED the twill gate must
 * refuse; `satin` and `gabardine-probe` are the other two rows of the §4.4 probe, carried so this
 * file's coherence figures can be read against that table.
 */
export const CONTROL_FABRICS = [

    {
        key: 'poplin',
        label: 'poplin / shirting, plain — RED 1',
        klass: WOVEN,
        weave: { name: 'plain', over: 1, under: 1, advance: 1 },
        endsPerInch: 120,
        picksPerInch: 80,
        warpNe: 45,
        weftNe: 45,
        gsm: 110,
        roughness: [ 0.45, 0.60 ],
        lobe: 'slight sheen',
        source: 'the §4.4 probe\'s own plain row, 120x80. §5.3 records the sett as vendor-only (100-144 x 60-76 /in) with measured plain wovens at 93-95 EPI / 47-81 PPI, so 120x80 is inside the published envelope.'
    },

    {
        key: 'satin',
        label: 'satin, 4/1, 5-end, move 2',
        klass: WOVEN,
        weave: { name: '4/1 satin, move 2', over: 4, under: 1, advance: 2 },
        endsPerInch: 180,
        picksPerInch: 90,
        warpNe: 45,
        weftNe: 45,
        gsm: 245,
        drape: { value: [ 43.0, 69.7 ], specimenCm: null, method: 'Cusick' },
        roughness: [ 0.30, 0.40 ],                       // [M]
        lobe: 'strong anisotropy; Sadeghi charmeuse γs 2.5 / γv 5',
        source: 'the §4.4 probe\'s satin row, 180x90. Its predicted 45.00° only comes out at move 2 — atan(2·90/180) = 45.00 — which is how this file knows the probe used a move-2 satin.'
    },

    {
        key: 'gabardine-probe',
        label: 'gabardine as the §4.4 probe had it, 2/1 twill 100x60',
        klass: WOVEN,
        weave: { name: '2/1 Z twill', over: 2, under: 1, advance: 1 },
        endsPerInch: 100,
        picksPerInch: 60,
        warpTex: 36.9,
        weftTex: 28.27,
        gsm: 248,
        roughness: [ 0.55, 0.70 ],
        lobe: 'sheen',
        source: 'the §4.4 probe row. Predicted 30.96° = atan(60/100). Kept alongside the §5.3 gabardine so the disagreement between the two in-repo specs stays visible.'
    }

];

export function fabricByKey( key ) {

    const all = [ ...FABRIC_FAMILIES, ...CONTROL_FABRICS ];
    const found = all.find( ( f ) => f.key === key );
    if ( found === undefined ) throw new Error( `no fabric "${ key }". Known: ${ all.map( ( f ) => f.key ).join( ', ' ) }` );
    return found;

}

// =================================================================================================
// 3. The defects — five of them, and only ONE is the one the gate was designed around
// =================================================================================================
//
// 🚩 LEARNINGS §1.25a: *"A gate that only catches its OWN known-bad is decorative… Write the
// known-bad you were going to write. Then write a second one you did not have in mind when you
// designed the gate."* And: *"State the class out loud, because a class can be enumerated and a
// hunch cannot."*
//
// THE CLASS: **any height field whose visible float structure does not correspond to the specified
// interlacing.** That is enumerable — the correspondence can break in the angle, in the handedness,
// in the aspect, in the amplitude, or in the provenance — and there is one defect below for each.

export const WEAVE_DEFECTS = {

    'wrong-advance': {
        summary: 'move number 2 on a weave whose real move is 1. A valid, plausible steep twill at the wrong angle.',
        shipped: false,
        designedFor: true,
        caughtBy: 'fftTwillAngle — the angle moves and the tolerance catches it'
    },

    's-twill': {
        summary: '🚩 handedness flipped. Denim is a Z twill; this is the same fabric woven S. |angle| is IDENTICAL, so any gate that compares magnitudes is green on it.',
        shipped: false,
        designedFor: false,
        caughtBy: 'fftTwillAngle ONLY BECAUSE it is signed. This is the defect that decided the gate reports a signed angle rather than a magnitude.'
    },

    'transposed': {
        summary: 'draft built with the pick and end indices swapped. Correct-looking weave, wrong aspect, complementary angle.',
        shipped: false,
        designedFor: false,
        caughtBy: 'fftTwillAngle'
    },

    'flat-floats': {
        summary: 'crimp amplitude zero. The yarn cross-section ridges are all still there, so the normal map LOOKS like cloth, but the float structure carries no height and there is no diagonal.',
        shipped: false,
        designedFor: false,
        caughtBy: 'fftTwillAngle refuses (no diagonal left in the band) AND repeatProfile refuses (the repeat carries zero depth). NOT caught by coherence — the yarn ridges keep that high.'
    },

    'painted-diagonal': {
        summary: '🎯 THE INTERESTING ONE. Axis-aligned yarn ridges plus a cosine at exactly the correct twill wave vector, with NO interlacing underneath at all. It is a picture of a twill, not a twill.',
        shipped: false,
        designedFor: false,
        caughtBy: '🚩 NOT caught by fftTwillAngle — it passes, cleanly, at exactly the right angle, and that is reported rather than hidden. Caught by repeatProfile: folded onto one repeat it is a pure sinusoid, harmonic fraction 0.048 against a real denim\'s 0.345 and an ideal 3/1 square wave\'s 1.040.'
    }

};

// =================================================================================================
// 4. Weave draft and height field
// =================================================================================================

/**
 * The interlacing matrix. `1` = warp over weft at that crossing.
 *
 * Row `i` is a pick (weft, running along x), column `j` is an end (warp, running along y). The
 * draft phase is `i·advance − j (mod repeat)`, which is the standard twill construction: the
 * float boundary walks `advance` ends to the right for every pick upward.
 *
 * That sign convention is what makes positive `advance` a **Z (right-hand)** twill, and it is
 * load-bearing — `s-twill` in `WEAVE_DEFECTS` is nothing but `advance → −advance`.
 */
export function weaveDraft( { over, under, advance }, rows, cols ) {

    const repeat = over + under;
    const cells = new Uint8Array( rows * cols );

    for ( let i = 0; i < rows; i ++ ) {

        for ( let j = 0; j < cols; j ++ ) {

            const raw = i * advance - j;
            const phase = ( ( raw % repeat ) + repeat ) % repeat;
            cells[ i * cols + j ] = phase < over ? 1 : 0;

        }

    }

    return cells;

}

/**
 * The angle the gate has to hit: `atan((picks x advance) / ends)`, in degrees, **measured from the
 * warp (lengthwise, +y) axis toward +x**.
 *
 * The derivation, because a convention nobody can re-derive is a convention that gets flipped:
 * going up one pick moves the float boundary `advance` ends across, so the twill line advances
 * `advance / endsPerInch` inches in x for every `1 / picksPerInch` inches in y.
 *
 * Sanity, against the three predictions §4.4 states: denim atan(44/68) = 32.91°,
 * gabardine-probe atan(60/100) = 30.96°, satin atan(2·90/180) = 45.00°.
 */
export function predictedTwillAngleDeg( spec ) {

    const { weave, endsPerInch, picksPerInch } = spec;
    return Math.atan2( weave.advance * picksPerInch, endsPerInch ) * 180 / Math.PI;

}

/** The twill fundamental's spatial frequency vector, in cycles per inch. */
export function twillWaveVector( spec ) {

    const repeat = spec.weave.over + spec.weave.under;
    return {
        fx: - spec.endsPerInch / repeat,
        fy: spec.weave.advance * spec.picksPerInch / repeat
    };

}

/** Catmull-Rom through the cell-centre values, so a long float reads as a plateau and a plain
 *  weave reads as a full-amplitude zigzag. A box or triangular smoothing kernel is what you reach
 *  for first and it is wrong: it annihilates the plain weave (weights 0.25/0.5/0.25 on an
 *  alternating ±1 sum to exactly zero), which would hand the generator a crimp model that gets
 *  *quieter* the more the fabric interlaces — backwards. */
function catmullRom( p0, p1, p2, p3, t ) {

    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * ( ( 2 * p1 ) +
        ( - p0 + p2 ) * t +
        ( 2 * p0 - 5 * p1 + 4 * p2 - p3 ) * t2 +
        ( - p0 + 3 * p1 - 3 * p2 + p3 ) * t3 );

}

function mulberry32( seed ) {

    let a = seed >>> 0;
    return function () {

        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul( a ^ a >>> 15, 1 | a );
        t = t + Math.imul( t ^ t >>> 7, 61 | t ) ^ t;
        return ( ( t ^ t >>> 14 ) >>> 0 ) / 4294967296;

    };

}

/**
 * Resolve a family record into the flat parameter set the generator actually needs, filling yarn
 * tex from cotton count where that is how the source stated it.
 */
export function resolveSpec( family, overrides = {} ) {

    const warpTex = family.warpTex ?? ( family.warpNe !== undefined ? texFromCottonCount( family.warpNe ) : family.yarnTex );
    const weftTex = family.weftTex ?? ( family.weftNe !== undefined ? texFromCottonCount( family.weftNe ) : family.yarnTex );

    return {
        key: family.key,
        label: family.label,
        klass: family.klass,
        weave: family.weave,
        knit: family.knit,
        endsPerInch: family.endsPerInch,
        picksPerInch: family.picksPerInch,
        warpTex,
        weftTex,
        gsm: family.gsm,
        roughness: family.roughness,
        ...overrides
    };

}

/**
 * Generate the height field, in microns, from the parameters alone.
 *
 * THE MODEL, stated so it can be argued with:
 *
 *   - Each warp end is a cylinder of diameter `d = 37.42·√tex`, flattened in width to at most its
 *     spacing (real yarns flatten under weaving tension; the cap is `1.25·d`).
 *   - Its centreline height oscillates between ±`½·d_weft` following the draft, interpolated
 *     Catmull-Rom so a float is a plateau and a crossing is a corner. Weft, mirrored.
 *   - The surface is the upper envelope of the two: `h = max(warpTop, weftTop)`.
 *
 * That produces exactly the structure §4.4 diagnosed: **high-amplitude, short-wavelength ridges at
 * the yarn spacing, plus a low-amplitude, long-wavelength diagonal at the repeat.** The generator
 * was not built to make the gate pass; it was built from yarn geometry, and the reason the
 * whole-patch tensor still reads ±90° on its output is that §4.4's diagnosis was right.
 *
 * PERIODICITY IS DELIBERATE. The patch is an integer number of weave repeats in both axes, so the
 * field tiles seamlessly (which a normal map must anyway) and its spectrum lands on exact bins.
 * `--nonperiodic` breaks that on purpose and forces the gate through sub-bin interpolation, because
 * a gate that only works when the answer lands on a bin is a gate about the sampling grid.
 */
export function generateHeightField( spec, options = {} ) {

    const {
        resolution = 512,
        defect = null,
        noiseMicrons = 0,
        rivalMicrons = 0,
        seed = 1,
        periodic = true
    } = options;

    if ( spec.klass === NON_TEXTILE ) {

        throw new Error( `${ spec.key } is ${ NON_TEXTILE }: ${ FABRIC_CLASSES[ NON_TEXTILE ] }` );

    }

    if ( spec.klass === KNIT || spec.klass === NAPPED ) {

        return generateKnitHeightField( spec, options );

    }

    let weave = { ...spec.weave };
    let endsPerInch = spec.endsPerInch;
    let picksPerInch = spec.picksPerInch;
    let crimpScale = 1;
    let painted = false;

    if ( defect === 'wrong-advance' ) weave.advance = weave.advance * 2;
    if ( defect === 's-twill' ) weave.advance = - weave.advance;
    if ( defect === 'flat-floats' ) crimpScale = 0;
    if ( defect === 'painted-diagonal' ) { crimpScale = 0; painted = true; }
    if ( defect === 'transposed' ) {
        const e = endsPerInch; endsPerInch = picksPerInch; picksPerInch = e;
    }

    const repeat = weave.over + weave.under;

    // Patch size: aim for the §4.4 probe's 12.7 mm, but never let a yarn fall below 8 texels or the
    // cross-section ridge is aliased and every gradient statistic is a statistic about the sampler.
    const finestPerInch = Math.max( endsPerInch, picksPerInch );
    const targetInches = Math.min( 0.5, resolution / ( 8 * finestPerInch ) );

    const repeatsX = Math.max( 2, Math.round( targetInches * endsPerInch / repeat ) );
    const repeatsY = Math.max( 2, Math.round( targetInches * picksPerInch / repeat ) );

    let patchWidthIn = repeatsX * repeat / endsPerInch;
    let patchHeightIn = repeatsY * repeat / picksPerInch;

    // Deliberately incommensurate: 1.137 is not a ratio of small integers, so no repeat lands on a
    // bin and the FFT peak has to be interpolated.
    if ( ! periodic ) { patchWidthIn *= 1.137; patchHeightIn *= 1.0731; }

    const patchWidth = patchWidthIn * MICRONS_PER_INCH;
    const patchHeight = patchHeightIn * MICRONS_PER_INCH;

    const warpSpacing = MICRONS_PER_INCH / endsPerInch;
    const weftSpacing = MICRONS_PER_INCH / picksPerInch;

    const dWarp = yarnDiameterMicrons( spec.warpTex );
    const dWeft = yarnDiameterMicrons( spec.weftTex );

    const warpWidth = Math.min( warpSpacing, dWarp * 1.25 );
    const weftWidth = Math.min( weftSpacing, dWeft * 1.25 );

    const ampWarp = 0.5 * dWeft * crimpScale;
    const ampWeft = 0.5 * dWarp * crimpScale;

    const totalEnds = Math.ceil( patchWidth / warpSpacing ) + 4;
    const totalPicks = Math.ceil( patchHeight / weftSpacing ) + 4;
    const draft = weaveDraft( weave, totalPicks, totalEnds );
    const signAt = ( i, j ) => {

        const ii = ( ( i % totalPicks ) + totalPicks ) % totalPicks;
        const jj = ( ( j % totalEnds ) + totalEnds ) % totalEnds;
        return draft[ ii * totalEnds + jj ] === 1 ? 1 : -1;

    };

    const heights = new Float32Array( resolution * resolution );
    const texelX = patchWidth / resolution;
    const texelY = patchHeight / resolution;
    const floor = - ( ampWarp + ampWeft ) - 0.5 * Math.max( dWarp, dWeft );

    // The painted defect's cosine: exactly the twill fundamental, at the same amplitude the real
    // crimp would have had. It has to be indistinguishable in the spectrum or it proves nothing.
    const pf = { fx: - endsPerInch / repeat, fy: weave.advance * picksPerInch / repeat };
    const paintedAmp = 0.5 * ( dWarp + dWeft ) * 0.5;

    for ( let py = 0; py < resolution; py ++ ) {

        const y = ( py + 0.5 ) * texelY;
        const fi = y / weftSpacing - 0.5;               // continuous pick coordinate
        const i0 = Math.floor( fi );                    // interpolation segment [i0, i0+1]
        const ti = fi - i0;
        const iNear = Math.round( fi );                 // the pick whose body covers this texel
        const v = ( fi - iNear ) * weftSpacing;

        for ( let px = 0; px < resolution; px ++ ) {

            const x = ( px + 0.5 ) * texelX;
            const fj = x / warpSpacing - 0.5;           // continuous end coordinate
            const j0 = Math.floor( fj );
            const tj = fj - j0;
            const jNear = Math.round( fj );
            const u = ( fj - jNear ) * warpSpacing;

            // 🚩 `floor` and `round` are BOTH needed here and mixing them up is the bug this file
            // was written with first. `floor` names the interpolation SEGMENT — the pair of yarn
            // centres a Catmull-Rom span runs between. `round` names the yarn whose BODY covers
            // this texel. Using the floor index for the cross-section puts every ridge in the
            // gutter between two yarns, which (a) looks almost right, (b) breaks the field's
            // mirror symmetry because floor is not symmetric about a centre where round is, and
            // therefore (c) hands a PLAIN WEAVE a chirality of 4.5x and defeats RED 1. Measured
            // before the fix: poplin's ± diagonal bins read 1.99e6 against 4.40e5.

            // Warp end jNear owns this texel; its centreline height varies along y.
            const zWarp = ampWarp * catmullRom(
                signAt( i0 - 1, jNear ), signAt( i0, jNear ), signAt( i0 + 1, jNear ), signAt( i0 + 2, jNear ), ti );

            // Weft pick iNear owns this texel; its centreline height varies along x.
            const zWeft = - ampWeft * catmullRom(
                signAt( iNear, j0 - 1 ), signAt( iNear, j0 ), signAt( iNear, j0 + 1 ), signAt( iNear, j0 + 2 ), tj );

            const hw = Math.abs( u ) < warpWidth / 2
                ? zWarp + 0.5 * dWarp * Math.sqrt( Math.max( 0, 1 - ( 2 * u / warpWidth ) ** 2 ) )
                : floor;

            const hf = Math.abs( v ) < weftWidth / 2
                ? zWeft + 0.5 * dWeft * Math.sqrt( Math.max( 0, 1 - ( 2 * v / weftWidth ) ** 2 ) )
                : floor;

            let h = Math.max( hw, hf );

            if ( painted ) {

                h += paintedAmp * Math.cos( 2 * Math.PI * ( pf.fx * x + pf.fy * y ) / MICRONS_PER_INCH );

            }

            // A rival diagonal of the OPPOSITE hand, for the contamination sweep. White noise is
            // the easy case; this puts energy exactly where a WRONG answer would live, so the
            // question it asks is "does the gate ever lie, or does it refuse?"
            if ( rivalMicrons > 0 ) {

                h += rivalMicrons * Math.cos( 2 * Math.PI * ( - pf.fx * x + pf.fy * y ) / MICRONS_PER_INCH );

            }

            heights[ py * resolution + px ] = h;

        }

    }

    if ( noiseMicrons > 0 ) {

        const rand = mulberry32( seed );
        for ( let n = 0; n < heights.length; n ++ ) {

            // Box-Muller, one draw per texel; the second normal is discarded rather than cached
            // because correlating adjacent texels would make the noise a texture, not noise.
            const u1 = Math.max( 1e-12, rand() );
            const u2 = rand();
            heights[ n ] += noiseMicrons * Math.sqrt( -2 * Math.log( u1 ) ) * Math.cos( 2 * Math.PI * u2 );

        }

    }

    return {
        heights,
        resolution,
        patchWidth,
        patchHeight,
        texelX,
        texelY,
        warpSpacing,
        weftSpacing,
        dWarp,
        dWeft,
        weave,
        endsPerInch,
        picksPerInch,
        repeatsX,
        repeatsY,
        periodic,
        defect,
        thicknessMicrons: max( heights ) - min( heights ),
        spec
    };

}

/**
 * Knits, briefly and honestly.
 *
 * A knit is intermeshed loops on a wale x course lattice: two legs per loop leaning outward, a
 * needle loop over the top. There is no warp, no weft and no float, so **there is no twill angle
 * to recover and the twill gate does not apply.** What the FFT can be held to instead is the
 * lattice itself — the wale and course frequencies, which come straight from the parameters.
 *
 * ⚠️ This model is coarser than the woven one and is validated against nothing. §5.3's knit row
 * carries wales/cm, courses/cm, tex and GSM and no surface measurement at all, so there is no
 * published number in repo for it to be right or wrong about. It is here so the generator covers
 * the families the punch list names, and it is labelled so nobody quotes it as measured.
 */
function generateKnitHeightField( spec, options = {} ) {

    const { resolution = 512, defect = null, noiseMicrons = 0, seed = 1 } = options;

    const knit = spec.knit ?? spec.substrate ?? { walesPerCm: 20, coursesPerCm: 15, cell: 'plain', ribWales: 0 };
    const walesPerCm = knit.walesPerCm;
    const coursesPerCm = knit.coursesPerCm;

    const waleSpacing = 10000 / walesPerCm;             // µm
    const courseSpacing = 10000 / coursesPerCm;

    const tex = spec.warpTex ?? spec.yarnTex ?? 40;
    const d = yarnDiameterMicrons( tex );

    const walesAcross = 12;
    const coursesDown = Math.max( 4, Math.round( 12 * waleSpacing / courseSpacing ) );
    const patchWidth = walesAcross * waleSpacing;
    const patchHeight = coursesDown * courseSpacing;

    const heights = new Float32Array( resolution * resolution );
    const texelX = patchWidth / resolution;
    const texelY = patchHeight / resolution;

    // `ribWales` is the number of face wales before the same number of reverse wales, so 0 is a
    // plain jersey face and 1 is a 1x1 rib whose channel repeats every 2 wales.
    const ribWales = knit.ribWales ?? 0;
    const cell = knit.cell ?? 'plain';

    // Face wales stand proud; reverse wales (rib) sit back by a yarn diameter. A piqué tuck cell
    // raises a 2-wale x 4-course block. Both are lattice modulations, which is exactly what the
    // wale:course gate measures.
    const waleOffset = ( waleIndex, courseIndex ) => {

        if ( ribWales > 0 ) {

            const period = ribWales * 2;
            const phase = ( ( waleIndex % period ) + period ) % period;
            return phase < ribWales ? 0 : - d;

        }

        if ( cell === 'pique' ) {

            const w = ( ( waleIndex % 2 ) + 2 ) % 2;
            const c = ( ( courseIndex % 4 ) + 4 ) % 4;
            return ( w === 0 ) === ( c < 2 ) ? 0.35 * d : - 0.35 * d;

        }

        return 0;

    };

    const distanceToSegment = ( px, py, ax, ay, bx, by ) => {

        const vx = bx - ax, vy = by - ay;
        const wx = px - ax, wy = py - ay;
        const t = Math.max( 0, Math.min( 1, ( wx * vx + wy * vy ) / ( vx * vx + vy * vy ) ) );
        const dx = wx - t * vx, dy = wy - t * vy;
        return Math.sqrt( dx * dx + dy * dy );

    };

    for ( let py = 0; py < resolution; py ++ ) {

        const y = ( py + 0.5 ) * texelY;

        for ( let px = 0; px < resolution; px ++ ) {

            const x = ( px + 0.5 ) * texelX;
            let best = - d;

            const wc = Math.round( x / waleSpacing );
            const cc = Math.round( y / courseSpacing );

            for ( let dw = -1; dw <= 1; dw ++ ) {

                for ( let dc = -1; dc <= 1; dc ++ ) {

                    const wi = wc + dw;
                    const ci = cc + dc;
                    const cx = wi * waleSpacing;
                    const cy = ci * courseSpacing;
                    const z = waleOffset( wi, ci );

                    // Two legs leaning out of the loop base, plus the needle loop across the top.
                    const legs = [
                        [ cx, cy, cx - waleSpacing * 0.5, cy + courseSpacing * 0.9 ],
                        [ cx, cy, cx + waleSpacing * 0.5, cy + courseSpacing * 0.9 ],
                        [ cx - waleSpacing * 0.5, cy + courseSpacing * 0.9, cx + waleSpacing * 0.5, cy + courseSpacing * 0.9 ]
                    ];

                    for ( const [ ax, ay, bx, by ] of legs ) {

                        const dist = distanceToSegment( x, y, ax, ay, bx, by );
                        if ( dist < d / 2 ) {

                            const h = z + 0.5 * d * Math.sqrt( Math.max( 0, 1 - ( 2 * dist / d ) ** 2 ) );
                            if ( h > best ) best = h;

                        }

                    }

                }

            }

            heights[ py * resolution + px ] = best;

        }

    }

    if ( noiseMicrons > 0 ) {

        const rand = mulberry32( seed );
        for ( let n = 0; n < heights.length; n ++ ) {

            const u1 = Math.max( 1e-12, rand() );
            const u2 = rand();
            heights[ n ] += noiseMicrons * Math.sqrt( -2 * Math.log( u1 ) ) * Math.cos( 2 * Math.PI * u2 );

        }

    }

    return {
        heights,
        resolution,
        patchWidth,
        patchHeight,
        texelX,
        texelY,
        walesPerCm,
        coursesPerCm,
        ribWales,
        cellWales: knit.cellWales ?? 1,
        dWarp: d,
        dWeft: d,
        knit,
        periodic: true,
        defect,
        thicknessMicrons: max( heights ) - min( heights ),
        spec
    };

}

function max( a ) { let m = -Infinity; for ( let i = 0; i < a.length; i ++ ) if ( a[ i ] > m ) m = a[ i ]; return m; }
function min( a ) { let m = Infinity; for ( let i = 0; i < a.length; i ++ ) if ( a[ i ] < m ) m = a[ i ]; return m; }

// =================================================================================================
// 5. The maps — normal, roughness, anisotropy
// =================================================================================================

/**
 * Central-difference normals, wrapping at the edges because the patch tiles.
 *
 * `strength` scales the gradient before normalising; 1.0 is the physical slope. The height field is
 * in microns and the texel size is in microns, so the ratio is dimensionless and correct without a
 * fudge factor — which is the whole point of generating from real yarn geometry.
 */
export function normalMap( field, strength = 1 ) {

    const { heights, resolution, texelX, texelY } = field;
    const out = new Uint8Array( resolution * resolution * 4 );
    const at = ( x, y ) => heights[ ( ( y + resolution ) % resolution ) * resolution + ( ( x + resolution ) % resolution ) ];

    for ( let y = 0; y < resolution; y ++ ) {

        for ( let x = 0; x < resolution; x ++ ) {

            const dhdx = ( at( x + 1, y ) - at( x - 1, y ) ) / ( 2 * texelX ) * strength;
            const dhdy = ( at( x, y + 1 ) - at( x, y - 1 ) ) / ( 2 * texelY ) * strength;

            const nx = - dhdx, ny = - dhdy, nz = 1;
            const len = Math.hypot( nx, ny, nz );

            const o = ( y * resolution + x ) * 4;
            out[ o ] = Math.round( ( nx / len * 0.5 + 0.5 ) * 255 );
            out[ o + 1 ] = Math.round( ( ny / len * 0.5 + 0.5 ) * 255 );
            out[ o + 2 ] = Math.round( ( nz / len * 0.5 + 0.5 ) * 255 );
            out[ o + 3 ] = 255;

        }

    }

    return { data: out, resolution };

}

/**
 * Roughness from float length, which is a real mechanism rather than a look.
 *
 * Where a yarn floats over several crossings its fibres lie parallel and flat, so the sub-texel
 * normal distribution is narrow — lower roughness, and a directional highlight. At a crossing the
 * yarn bends out of plane and the fibres splay — higher roughness, no direction. So a 4/1 satin is
 * mostly smooth warp float and a plain weave is all crossing, which is the same ordering §4.4's
 * coherence found and is arrived at independently here.
 *
 * The band comes from the family's own `roughness` pair, so the absolute values stay the ones the
 * look spec and §5.3 own; only the modulation across the patch is generated.
 */
export function roughnessMap( field ) {

    const { heights, resolution, spec } = field;
    const [ rMin, rMax ] = spec?.roughness ?? [ 0.5, 0.8 ];

    // Local height variance over a yarn-sized window is a direct proxy for "is this a flat float or
    // a crossing" and needs no draft, so it works on the knit path too.
    const window = Math.max( 2, Math.round( ( field.warpSpacing ?? field.patchWidth / 12 ) / field.texelX / 2 ) );
    const out = new Float32Array( resolution * resolution );
    const at = ( x, y ) => heights[ ( ( y + resolution ) % resolution ) * resolution + ( ( x + resolution ) % resolution ) ];

    let lo = Infinity, hi = -Infinity;

    for ( let y = 0; y < resolution; y ++ ) {

        for ( let x = 0; x < resolution; x ++ ) {

            let sum = 0, sumSq = 0, n = 0;

            for ( let dy = - window; dy <= window; dy ++ ) {

                for ( let dx = - window; dx <= window; dx ++ ) {

                    const h = at( x + dx, y + dy );
                    sum += h; sumSq += h * h; n ++;

                }

            }

            const variance = Math.max( 0, sumSq / n - ( sum / n ) ** 2 );
            const v = Math.sqrt( variance );
            out[ y * resolution + x ] = v;
            if ( v < lo ) lo = v;
            if ( v > hi ) hi = v;

        }

    }

    const span = Math.max( 1e-9, hi - lo );
    for ( let n = 0; n < out.length; n ++ ) out[ n ] = rMin + ( rMax - rMin ) * ( out[ n ] - lo ) / span;

    return { data: out, resolution, band: [ rMin, rMax ], localSigmaMicrons: [ lo, hi ] };

}

/**
 * The material-level anisotropy and sheen, **derived from the measurement rather than authored**.
 *
 * This is the join that makes the render a test instead of a picture: `strength` is the coherence
 * this file measured off the generated field, and `rotationDeg` is the twill angle the FFT gate
 * recovered off the same field. If either measurement were wrong the highlight would visibly point
 * the wrong way — which is what `packages/testbed/src/fabric.html` is for.
 */
export function anisotropyFromMeasurement( family, tensor, fft ) {

    if ( family.klass === NON_TEXTILE ) {

        return {
            applicable: false,
            reason: `${ family.key } is a BRDF, not a weave — no yarn axis, so no anisotropy direction to derive`
        };

    }

    const napped = family.klass === NAPPED;

    return {
        applicable: true,
        strength: Number( tensor.coherence.toFixed( 4 ) ),
        strengthSource: 'structure-tensor coherence of the generated height field',
        // KHR_materials_anisotropy / three measure `anisotropyRotation` counter-clockwise from
        // the tangent (+U). `PlaneGeometry`'s U runs along +x and this generator lays the warp
        // along +y, so a twill line at θ from the warp sits at (90 − θ) from +U. That is a basis
        // change, not a fudge, and `packages/testbed/src/fabric.js` is what proves it lands right.
        rotationDeg: fft.refused ? null : Number( ( 90 - fft.angleDeg ).toFixed( 3 ) ),
        rotationSource: fft.refused
            ? `no twill line: ${ fft.reason } — fall back to the warp axis`
            : 'FFT twill angle, converted from warp-relative to tangent-space +U',
        sheen: napped
            ? { intensity: 0.8, roughness: 0.3, tangentDeg: -90, source: 'Autodesk Standard Surface defaults for intensity/roughness; the −90° tangent is Sadeghi et al. 2013 velvet, via §5.3' }
            : { intensity: 0.0, roughness: 0.3, tangentDeg: 0, source: 'woven and knit families carry the lobe in anisotropy, not sheen' }
    };

}

// =================================================================================================
// 6. Instrument A — the whole-patch structure tensor. RED 2, and it is meant to be wrong.
// =================================================================================================

/**
 * Sobel gradients accumulated over the entire patch.
 *
 * `coherence = (λ1 − λ2) / (λ1 + λ2)`, 0 isotropic, 1 perfectly aligned. `ridgeDeg` is the
 * direction of LEAST gradient variation — i.e. along the ridges — reported in degrees from +x,
 * wrapped to (−90, 90].
 *
 * 🚩 **`ridgeDeg` is RED 2 of the gate.** On a correct twill it returns ±90° — the warp axis — not
 * the diagonal, exactly as §4.4 measured. It is kept and printed beside the FFT answer so the
 * disagreement is demonstrated on the same field in the same run, rather than asserted from a
 * document. `coherence` from the same tensor is the half that DOES work.
 */
export function structureTensor( field ) {

    const { heights, resolution, texelX, texelY } = field;
    const at = ( x, y ) => heights[ ( ( y + resolution ) % resolution ) * resolution + ( ( x + resolution ) % resolution ) ];

    let jxx = 0, jyy = 0, jxy = 0;

    for ( let y = 0; y < resolution; y ++ ) {

        for ( let x = 0; x < resolution; x ++ ) {

            const gx = ( ( at( x + 1, y - 1 ) + 2 * at( x + 1, y ) + at( x + 1, y + 1 ) )
                - ( at( x - 1, y - 1 ) + 2 * at( x - 1, y ) + at( x - 1, y + 1 ) ) ) / ( 8 * texelX );

            const gy = ( ( at( x - 1, y + 1 ) + 2 * at( x, y + 1 ) + at( x + 1, y + 1 ) )
                - ( at( x - 1, y - 1 ) + 2 * at( x, y - 1 ) + at( x + 1, y - 1 ) ) ) / ( 8 * texelY );

            jxx += gx * gx; jyy += gy * gy; jxy += gx * gy;

        }

    }

    const n = resolution * resolution;
    jxx /= n; jyy /= n; jxy /= n;

    const trace = jxx + jyy;
    const diff = Math.sqrt( ( jxx - jyy ) ** 2 + 4 * jxy * jxy );
    const l1 = 0.5 * ( trace + diff );
    const l2 = 0.5 * ( trace - diff );

    const gradientDeg = 0.5 * Math.atan2( 2 * jxy, jxx - jyy ) * 180 / Math.PI;
    let ridgeDeg = gradientDeg + 90;
    while ( ridgeDeg > 90 ) ridgeDeg -= 180;
    while ( ridgeDeg <= -90 ) ridgeDeg += 180;

    return {
        coherence: trace > 0 ? diff / trace : 0,
        ridgeDeg,
        eigen: [ l1, l2 ]
    };

}

// =================================================================================================
// 7. Instrument B — the FFT. THIS IS THE GATE.
// =================================================================================================

/** In-place iterative radix-2 complex FFT. Length must be a power of two. */
function fft1d( re, im, n, offset, stride ) {

    for ( let i = 1, j = 0; i < n; i ++ ) {

        let bit = n >> 1;
        for ( ; j & bit; bit >>= 1 ) j ^= bit;
        j ^= bit;

        if ( i < j ) {

            const a = offset + i * stride, b = offset + j * stride;
            let t = re[ a ]; re[ a ] = re[ b ]; re[ b ] = t;
            t = im[ a ]; im[ a ] = im[ b ]; im[ b ] = t;

        }

    }

    for ( let len = 2; len <= n; len <<= 1 ) {

        const ang = -2 * Math.PI / len;
        const wRe = Math.cos( ang ), wIm = Math.sin( ang );

        for ( let i = 0; i < n; i += len ) {

            let curRe = 1, curIm = 0;

            for ( let k = 0; k < len / 2; k ++ ) {

                const a = offset + ( i + k ) * stride;
                const b = offset + ( i + k + len / 2 ) * stride;

                const tRe = re[ b ] * curRe - im[ b ] * curIm;
                const tIm = re[ b ] * curIm + im[ b ] * curRe;

                re[ b ] = re[ a ] - tRe; im[ b ] = im[ a ] - tIm;
                re[ a ] += tRe; im[ a ] += tIm;

                const nRe = curRe * wRe - curIm * wIm;
                curIm = curRe * wIm + curIm * wRe;
                curRe = nRe;

            }

        }

    }

}

function fft2d( values, n ) {

    // 🚩 A radix-2 FFT on a non-power-of-two length does not error — it returns a plausible-looking
    // spectrum that is wrong, and every gate downstream reads a number off it. Found by running
    // `--gate --res 384`: all five twills went from an exact recovery to REFUSED at uniqueness
    // 1.03–1.13, which reads as "the generator broke" rather than "the instrument is invalid".
    if ( ( n & ( n - 1 ) ) !== 0 ) {

        throw new Error( `fft2d needs a power-of-two size; got ${ n }. Use --res 128/256/512/1024.` );

    }

    const re = Float64Array.from( values );
    const im = new Float64Array( n * n );

    for ( let y = 0; y < n; y ++ ) fft1d( re, im, n, y * n, 1 );
    for ( let x = 0; x < n; x ++ ) fft1d( re, im, n, x, n );

    return { re, im };

}

/**
 * Recover the twill angle from the FFT peak at the weave-repeat frequency. **This is punch-list
 * 9.16's gate, written exactly as the item states it.**
 *
 * THE SEARCH BAND, and why it is not circular. Search every genuinely off-axis bin — `kx ≠ 0` and
 * `ky ≥ 1`, because "diagonal" means exactly that — with `|fx| ≤ ends/2` and `|fy| ≤ picks/2`.
 *
 * That band is derived from the thread count and from nothing else, and it is airtight for a
 * reason worth spelling out: **the warp yarns sample the surface `ends` times per inch and the
 * wefts `picks` times per inch, so nothing above half those rates is weave structure** — it is the
 * yarn lattice itself, or an intermodulation product of it. Meanwhile the twill fundamental sits at
 * `(ends/R, advance·picks/R)` with `R = over + under ≥ 2`, so **for every weave that exists it
 * lands inside the band by construction.** Every wrong angle is inside the search space too; the
 * gate has to pick the right one out of 400–1200 candidates.
 *
 * This is the correction §4.4 asked for in its own words: *"My predicted pitch formula was simply
 * wrong for twills: I predicted one yarn spacing where the repeat is `over + under` yarns, not
 * one."* Measured consequence of getting the band wrong: at the looser `|f| ≤ min(ends, picks)`
 * this file started with, denim's search space contains bin (8,15) at 9.5e5 — the weft ridge
 * beating against the twill — which is a genuine opposite-hand peak and drags the uniqueness
 * margin from 6.7x down to 2.04x, i.e. onto the floor.
 *
 * THE REFUSAL: `uniqueness`, the ratio of the strongest peak to the strongest peak lying more than
 * 5° away from it. **A twill line is a unique direction, and this is the test of that.** Two
 * structures fail it, for two different reasons, and both are correct:
 *
 *   - a **plain weave** measures exactly **1.000**, because `(i−j) mod 2` and `(i+j) mod 2` are the
 *     same function, so the field is mirror-symmetric in x and both diagonals carry identical
 *     energy. Its "diagonal" also sits exactly on the corner of the band — at the yarn lattice's
 *     own Nyquist in both axes — which is the same fact said a second way: a plain weave's diagonal
 *     is not a repeat structure, it IS the yarn lattice.
 *   - a **satin** measures **1.468** on the 4/1 move-2 field, because a satin's interlacing lattice
 *     has two generators: `(2i − j) ≡ 4 (mod 5)` and `(i + 2j) ≡ 2 (mod 5)` describe the *same*
 *     point set, and the second one is the stronger peak. That is not a defect in the gate — a
 *     satin is *constructed* to have no visible twill line, and this measures it. See the honest
 *     note in `tools/spikes/README.md`: §4.4's predicted 45.00° for satin applies the twill formula
 *     to a weave the formula does not describe.
 *
 * ⚠️ `UNIQUENESS_MIN = 2.0` and `PROMINENCE_MIN = 4.0` are set from the principle — "the twill line
 * must be at least twice any competing direction", "a peak must stand four times above the band's
 * mean" — and are NOT fitted to the measured values. The measured margins are printed beside them
 * so a reader can see how much room there is. The narrowest is gabardine at 3.39x, 1.7x above the
 * floor; the widest refusal is a plain weave at 1.000, exactly half of it.
 */
export const UNIQUENESS_MIN = 2.0;
export const RIVAL_SEPARATION_DEG = 5.0;
export const PROMINENCE_MIN = 4.0;
export const ANGLE_TOLERANCE_DEG = 1.0;

export function fftTwillAngle( field ) {

    const { heights, resolution: n, patchWidth, patchHeight, endsPerInch, picksPerInch } = field;

    if ( endsPerInch === undefined ) {

        return { refused: true, reason: 'not a woven field — no ends/picks, therefore no twill line' };

    }

    // A non-periodic patch leaks across the whole spectrum without a window; a periodic one is
    // damaged by one. Apply the Hann only where it is needed and say which was used.
    const values = new Float64Array( n * n );
    const mean = heights.reduce( ( a, b ) => a + b, 0 ) / heights.length;

    if ( field.periodic ) {

        for ( let i = 0; i < values.length; i ++ ) values[ i ] = heights[ i ] - mean;

    } else {

        const w = new Float64Array( n );
        for ( let i = 0; i < n; i ++ ) w[ i ] = 0.5 * ( 1 - Math.cos( 2 * Math.PI * i / ( n - 1 ) ) );
        for ( let y = 0; y < n; y ++ ) for ( let x = 0; x < n; x ++ ) values[ y * n + x ] = ( heights[ y * n + x ] - mean ) * w[ x ] * w[ y ];

    }

    const { re, im } = fft2d( values, n );

    const widthIn = patchWidth / MICRONS_PER_INCH;
    const heightIn = patchHeight / MICRONS_PER_INCH;
    const halfEnds = endsPerInch / 2;
    const halfPicks = picksPerInch / 2;

    const mag = ( kx, ky ) => {

        const ix = ( ( kx % n ) + n ) % n;
        const iy = ( ( ky % n ) + n ) % n;
        const o = iy * n + ix;
        return Math.hypot( re[ o ], im[ o ] );

    };

    // The twill LINE is perpendicular to the wave vector. Take the representative with a positive
    // y component and report its angle from the warp (+y) axis toward +x — the same convention
    // `predictedTwillAngleDeg` uses.
    const lineAngleDeg = ( fx, fy ) => {

        let lx = fy, ly = - fx;
        if ( ly < 0 ) { lx = - lx; ly = - ly; }
        return Math.atan2( lx, ly ) * 180 / Math.PI;

    };

    const band = [];

    for ( let ky = 1; ky <= n / 2; ky ++ ) {

        for ( let kx = - n / 2 + 1; kx < n / 2; kx ++ ) {

            if ( kx === 0 ) continue;

            const fx = kx / widthIn;
            const fy = ky / heightIn;
            if ( Math.abs( fx ) > halfEnds + 1e-6 || Math.abs( fy ) > halfPicks + 1e-6 ) continue;

            band.push( { kx, ky, m: mag( kx, ky ), angle: lineAngleDeg( fx, fy ) } );

        }

    }

    if ( band.length === 0 ) {

        return { refused: true, reason: 'the search band is empty — patch too small for the repeat' };

    }

    band.sort( ( a, b ) => b.m - a.m );
    const strong = band[ 0 ];

    // Harmonics of the twill line share its angle, so the rival test skips them without ever
    // needing to know which bin is a harmonic of which.
    const rival = band.find( ( b ) => Math.abs( b.angle - strong.angle ) > RIVAL_SEPARATION_DEG );

    const uniqueness = rival === undefined ? Infinity : ( rival.m > 0 ? strong.m / rival.m : Infinity );

    // Mean, not median: on a periodic patch most bins are exactly 0 and a median of 0 makes every
    // prominence Infinity, which is a number that cannot fail (LEARNINGS §1.3).
    const bandMean = band.reduce( ( a, b ) => a + b.m, 0 ) / band.length;
    const prominence = bandMean > 0 ? strong.m / bandMean : Infinity;
    const mirrorRatio = mag( - strong.kx, strong.ky ) > 0 ? strong.m / mag( - strong.kx, strong.ky ) : Infinity;

    const diagnostics = {
        uniqueness, prominence, mirrorRatio,
        peakBin: [ strong.kx, strong.ky ],
        peakAngleDeg: strong.angle,
        rival: rival === undefined ? null : { bin: [ rival.kx, rival.ky ], angleDeg: rival.angle, ratio: strong.m / rival.m },
        bandSize: band.length,
        bandLimit: [ halfEnds, halfPicks ]
    };

    if ( uniqueness < UNIQUENESS_MIN ) {

        return {
            refused: true,
            reason: `no unique diagonal — the strongest peak at ${ strong.angle.toFixed( 2 ) }° is only ${ uniqueness.toFixed( 3 ) }x a competing direction at ${ rival.angle.toFixed( 2 ) }° (floor ${ UNIQUENESS_MIN }). There is no single twill line to report.`,
            ...diagnostics
        };

    }

    if ( prominence < PROMINENCE_MIN ) {

        return {
            refused: true,
            reason: `no dominant off-axis peak — the strongest is only ${ prominence.toFixed( 2 ) }x the band mean (floor ${ PROMINENCE_MIN }).`,
            ...diagnostics
        };

    }

    // Sub-bin refinement by three-point parabolic interpolation, needed whenever the repeat does
    // not divide the patch. On a periodic patch the peak sits on a bin and the correction is ~0,
    // which is itself worth printing.
    const parabolic = ( a, b, c ) => {

        const denom = a - 2 * b + c;
        return denom === 0 ? 0 : 0.5 * ( a - c ) / denom;

    };

    const dx = parabolic( mag( strong.kx - 1, strong.ky ), strong.m, mag( strong.kx + 1, strong.ky ) );
    const dy = parabolic( mag( strong.kx, strong.ky - 1 ), strong.m, mag( strong.kx, strong.ky + 1 ) );

    const angleDeg = lineAngleDeg( ( strong.kx + dx ) / widthIn, ( strong.ky + dy ) / heightIn );

    // Angular quantisation: how far one whole bin step moves the answer. The tolerance can never be
    // tighter than this, and saying so is cheaper than discovering it (LEARNINGS §1.10b).
    const binStepDeg = Math.max(
        Math.abs( lineAngleDeg( ( strong.kx + 1 ) / widthIn, strong.ky / heightIn ) - strong.angle ),
        Math.abs( lineAngleDeg( strong.kx / widthIn, ( strong.ky + 1 ) / heightIn ) - strong.angle )
    );

    return {
        refused: false,
        angleDeg,
        subBin: [ dx, dy ],
        binStepDeg,
        windowed: ! field.periodic,
        ...diagnostics
    };

}

/**
 * The knit analogue of the twill gate: recover the wale and course frequencies from the FFT's AXIS
 * peaks and check them against `walesPerCm` and `coursesPerCm`.
 *
 * A different gate for a different structure, rather than the twill gate returning a wrong number
 * on a fabric it does not describe.
 */
export function fftKnitLattice( field ) {

    const { heights, resolution: n, patchWidth, patchHeight, walesPerCm, coursesPerCm } = field;

    if ( walesPerCm === undefined ) return { refused: true, reason: 'not a knit field' };

    const mean = heights.reduce( ( a, b ) => a + b, 0 ) / heights.length;
    const values = Float64Array.from( heights, ( h ) => h - mean );
    const { re, im } = fft2d( values, n );

    const mag = ( kx, ky ) => {

        const ix = ( ( kx % n ) + n ) % n;
        const iy = ( ( ky % n ) + n ) % n;
        return Math.hypot( re[ iy * n + ix ], im[ iy * n + ix ] );

    };

    let bestX = { m: 0, k: 0 }, bestY = { m: 0, k: 0 };
    for ( let k = 1; k < n / 2; k ++ ) {

        const mx = mag( k, 0 );
        if ( mx > bestX.m ) bestX = { m: mx, k };
        const my = mag( 0, k );
        if ( my > bestY.m ) bestY = { m: my, k };

    }

    // 🚩 The strongest axis peak is NOT the lattice frequency, and taking it as one reads every
    // knit at exactly 2x. A knit loop has TWO legs per wale and its needle loop spans two courses,
    // so the surface's dominant period is half the wale pitch. That is a real structural fact about
    // knitting, not a sampling artefact, so the fix is textbook fundamental detection rather than
    // a factor of two: walk the submultiples and take the lowest one that still carries energy.
    const fundamental = ( best, axis ) => {

        for ( let divisor = 6; divisor >= 2; divisor -- ) {

            if ( best.k % divisor !== 0 ) continue;
            const k = best.k / divisor;
            const m = axis === 'x' ? mag( k, 0 ) : mag( 0, k );
            if ( m >= 0.05 * best.m ) return { k, harmonic: divisor };

        }

        return { k: best.k, harmonic: 1 };

    };

    const fx = fundamental( bestX, 'x' );
    const fy = fundamental( bestY, 'y' );

    const widthCm = patchWidth / 10000;
    const heightCm = patchHeight / 10000;

    // A 1x1 rib alternates face and reverse wales, so its surface period is two wales; a piqué
    // tuck cell spans `cellWales`. Both divisors come from the structure parameters, not from the
    // measurement.
    const ribWales = field.ribWales ?? 0;
    const surfacePeriodWales = ribWales > 0 ? ribWales * 2 : ( field.cellWales ?? 1 );
    const expectedWalesPerCm = walesPerCm / surfacePeriodWales;

    return {
        refused: false,
        walesPerCmRecovered: fx.k / widthCm,
        coursesPerCmRecovered: fy.k / heightCm,
        harmonics: [ fx.harmonic, fy.harmonic ],
        expectedWalesPerCm,
        surfacePeriodWales,
        expectedCoursesPerCm: coursesPerCm,
        walesPerCm,
        coursesPerCm,
        ribWales
    };

}

// =================================================================================================
// 8. Instrument C — the folded repeat profile. The independent mechanism, and the only one that
//    sees `painted-diagonal`.
// =================================================================================================

/**
 * Fold the whole patch onto ONE weave repeat along the twill-line normal, and ask what SHAPE the
 * repeat has.
 *
 * The question this answers is the complement of the FFT's. The FFT asks *which direction* the
 * diagonal runs. This asks *whether the surface is really made of floats* — because an interlacing
 * is a square-ish alternation between a warp float and a weft float, and a painted sinusoid is not,
 * however perfectly its wave vector is aimed. Two numbers come out:
 *
 *   `fundamentalMicrons`  the amplitude of the repeat modulation. Zero means the float structure
 *                         carries no height at all, whatever the normal map looks like.
 *   `harmonicFraction`    (h2 + h3 + h4) / h1 of the folded profile. A pure sinusoid is 0. An ideal
 *                         square wave of duty d has harmonic k ∝ |sin(π k d)| / k, which for a 3/1
 *                         twill (d = 0.75) works out to **1.040** — it can never vanish.
 *
 * It folds along the direction the SPEC claims, not the direction the FFT found, which is
 * deliberate: the two instruments then answer independent questions and a defect has to defeat both
 * separately. It also means this instrument cannot tell "wrong angle" from "no interlacing" — it
 * reports a dead profile either way — and that limit is stated rather than papered over.
 *
 * ⚠️ TWO EARLIER RECOVERY ATTEMPTS FAILED, and both failures are worth keeping because they are
 * about this height model rather than about this file.
 *
 *   (a) **Thresholding the height at each crossing cannot work at all.** The upper envelope at a
 *       crossing is `amp_top + ½·d_top`, and since `amp_warp = ½·d_weft` and `amp_weft = ½·d_warp`,
 *       those are *identical* — a warp-up and a weft-up crossing are exactly the same height. That
 *       is physically right for a balanced fabric.
 *   (b) **Per-cell orientation, by structure tensor or by curvature, is degenerate on an open
 *       weave.** Denim's weft covers only 304 µm of its 577 µm pitch, so a weft-up cell's
 *       neighbourhood is full of exposed warp ridge. Measured: the windowed tensor called 75.7% of
 *       denim's cells warp-up and the curvature probe 75.0%, against a warp-face fraction of
 *       exactly 75% — i.e. both had learnt to answer "warp" and nothing else. A gate built on
 *       either would have read a plausible number and measured the class prior.
 */
export function repeatProfile( field, spec, bins = 64 ) {

    if ( spec?.weave === undefined || field.warpSpacing === undefined ) {

        return { applicable: false, reason: 'not a woven field' };

    }

    const { fx, fy } = twillWaveVector( spec );
    const { heights, resolution: n, texelX, texelY } = field;

    const sum = new Float64Array( bins );
    const count = new Float64Array( bins );

    for ( let py = 0; py < n; py ++ ) {

        const y = ( py + 0.5 ) * texelY / MICRONS_PER_INCH;

        for ( let px = 0; px < n; px ++ ) {

            const x = ( px + 0.5 ) * texelX / MICRONS_PER_INCH;
            let phase = ( fx * x + fy * y ) % 1;
            if ( phase < 0 ) phase += 1;

            const b = Math.min( bins - 1, Math.floor( phase * bins ) );
            sum[ b ] += heights[ py * n + px ];
            count[ b ] ++;

        }

    }

    const profile = Array.from( sum, ( v, i ) => ( count[ i ] > 0 ? v / count[ i ] : 0 ) );
    const lo = Math.min( ...profile );
    const hi = Math.max( ...profile );
    const mean = profile.reduce( ( a, b ) => a + b, 0 ) / bins;

    const harmonic = ( k ) => {

        let re = 0, im = 0;
        for ( let i = 0; i < bins; i ++ ) {

            const a = -2 * Math.PI * k * i / bins;
            re += ( profile[ i ] - mean ) * Math.cos( a );
            im += ( profile[ i ] - mean ) * Math.sin( a );

        }
        return Math.hypot( re, im ) / bins;

    };

    // The float structure has to move the surface by a real fraction of a yarn before "the weave
    // has depth" means anything. 2% of the mean yarn diameter is the floor; a clean denim reads
    // 10.8% of it, i.e. 5.4x clear.
    const yarnMicrons = 0.5 * ( field.dWarp + field.dWeft );

    const h1 = harmonic( 1 );

    // Below a ten-thousandth of a yarn the fundamental is numerical dust and the ratio built on it
    // is a very large meaningless number. Say Infinity, which reads as "no fundamental to compare
    // against" rather than as a measurement.
    const harmonics = h1 > 1e-4 * yarnMicrons ? ( harmonic( 2 ) + harmonic( 3 ) + harmonic( 4 ) ) / h1 : Infinity;

    // An ideal square wave of duty d: harmonic k ∝ |sin(π·k·d)| / k. Printed so the measured
    // harmonic fraction has a computed anchor above it as well as a measured one below it.
    const duty = spec.weave.over / ( spec.weave.over + spec.weave.under );
    const sq = ( k ) => Math.abs( Math.sin( Math.PI * k * duty ) ) / k;
    const idealHarmonics = sq( 1 ) > 0 ? ( sq( 2 ) + sq( 3 ) + sq( 4 ) ) / sq( 1 ) : Infinity;

    return {
        applicable: true,
        profile,
        peakToPeakMicrons: hi - lo,
        fundamentalMicrons: h1,
        fundamentalFractionOfYarn: h1 / yarnMicrons,
        harmonicFraction: harmonics,
        idealSquareHarmonicFraction: idealHarmonics,
        dutyCycle: profile.filter( ( v ) => v > ( lo + hi ) / 2 ).length / bins,
        expectedDuty: duty
    };

}

export const REPEAT_DEPTH_MIN = 0.02;      // fraction of a yarn diameter
export const HARMONIC_FRACTION_MIN = 0.15; // a sinusoid is 0; an ideal 3/1 square is 1.040

/** Verdict form of `repeatProfile`, so the gate and the report agree by construction. */
export function repeatProfileVerdict( rp ) {

    if ( ! rp.applicable ) return { ok: false, reason: rp.reason };

    if ( rp.fundamentalFractionOfYarn < REPEAT_DEPTH_MIN ) {

        return { ok: false, reason: `the repeat carries no depth — ${ ( rp.fundamentalFractionOfYarn * 100 ).toFixed( 2 ) }% of a yarn diameter, floor ${ REPEAT_DEPTH_MIN * 100 }%` };

    }

    if ( rp.harmonicFraction < HARMONIC_FRACTION_MIN ) {

        return { ok: false, reason: `the repeat is a SINUSOID, not an interlacing — harmonic fraction ${ rp.harmonicFraction.toFixed( 3 ) }, floor ${ HARMONIC_FRACTION_MIN } (ideal square for this weave: ${ rp.idealSquareHarmonicFraction.toFixed( 3 ) })` };

    }

    return { ok: true };

}

/**
 * The comparison §4.4 could not make, and it changes the conclusion.
 *
 * §4.4 reports *"coherence… orders the twills by float length exactly as it should: 2/1 < 3/1 < 4/1
 * satin"* — but each of those four fabrics had a **different sett** (plain 120x80, denim 68x44,
 * gabardine 100x60, satin 180x90), so float length and sett imbalance moved together and the
 * measurement cannot tell which caused the ordering.
 *
 * This holds the sett and the yarns fixed and changes only the weave — which is the same control
 * §5.3 praises in the Fibres & Textiles 1/2018 dataset: *"the yarns are held identical (50/50
 * PES/Co, warp 36.9 tex, weft 28.27 tex) and only the weave changes."*
 */
export function controlledWeaveSweep( options = {} ) {

    const base = {
        key: 'controlled', klass: WOVEN,
        endsPerInch: 114.3, picksPerInch: 67.3,
        warpTex: 36.9, weftTex: 28.27,
        roughness: [ 0.5, 0.8 ]
    };

    const weaves = [
        [ 'plain', { over: 1, under: 1, advance: 1 } ],
        [ '2/2 twill', { over: 2, under: 2, advance: 1 } ],
        [ '2/1 twill', { over: 2, under: 1, advance: 1 } ],
        [ '3/1 twill', { over: 3, under: 1, advance: 1 } ],
        [ '4/1 satin m2', { over: 4, under: 1, advance: 2 } ],
        [ '5/1 sateen m2', { over: 5, under: 1, advance: 2 } ]
    ];

    return weaves.map( ( [ name, weave ] ) => {

        const field = generateHeightField( { ...base, weave }, { resolution: options.resolution ?? 512 } );
        const tensor = structureTensor( field );
        return {
            name, weave,
            warpFaceFraction: weave.over / ( weave.over + weave.under ),
            floatLength: weave.over,
            coherence: tensor.coherence,
            ridgeDeg: tensor.ridgeDeg
        };

    } );

}

/**
 * Generated fabric THICKNESS against real measured thickness — the one external validation in this
 * file, and it is a partial failure.
 *
 * `research/wardrobe-system.md` §5.3 calls the Fibres & Textiles 1/2018 weave comparison *"the
 * single best calibration target in this whole document"* precisely because the yarns are held
 * identical (warp 36.9 tex, weft 28.27 tex, 50/50 PES/Co) and only the weave changes. It publishes
 * a measured thickness per weave, so it can be compared against a generated height field directly.
 *
 * This is REPORTED, NOT GATED. A gate would be dishonest: the model fails it, the failure is
 * understood, and turning it green would mean fitting a constant to four data points.
 */
export function thicknessAgainstMeasured( options = {} ) {

    const base = { key: 'calibration', klass: WOVEN, warpTex: 36.9, weftTex: 28.27, roughness: [ 0.5, 0.8 ] };

    const rows = [
        { name: 'plain', weave: { over: 1, under: 1, advance: 1 }, endsPerCm: 46, picksPerCm: 20, measuredMm: 0.48 },
        { name: 'twill 2/2', weave: { over: 2, under: 2, advance: 1 }, endsPerCm: 45, picksPerCm: 27, measuredMm: 0.53 },
        { name: 'twill 3/1', weave: { over: 3, under: 1, advance: 1 }, endsPerCm: 45, picksPerCm: 26.5, measuredMm: 0.50 },
        { name: 'weft rib 2/2', weave: { over: 2, under: 2, advance: 1 }, endsPerCm: 46, picksPerCm: 22, measuredMm: 0.46 }
    ];

    return rows.map( ( row ) => {

        const field = generateHeightField( {
            ...base, weave: row.weave,
            endsPerInch: row.endsPerCm * 2.54,
            picksPerInch: row.picksPerCm * 2.54
        }, { resolution: options.resolution ?? 512 } );

        const generatedMm = field.thicknessMicrons / 1000;
        return { ...row, generatedMm, ratio: row.measuredMm / generatedMm };

    } );

}

/** The other half of the confound: hold the WEAVE fixed and move only the sett. */
export function controlledSettSweep( options = {} ) {

    const base = {
        key: 'controlled', klass: WOVEN,
        warpTex: 36.9, weftTex: 28.27,
        weave: { over: 1, under: 1, advance: 1 },
        roughness: [ 0.5, 0.8 ]
    };

    return [ [ 90, 90 ], [ 100, 100 ], [ 114.3, 67.3 ], [ 120, 80 ], [ 68, 44 ] ].map( ( [ e, p ] ) => {

        const field = generateHeightField( { ...base, endsPerInch: e, picksPerInch: p }, { resolution: options.resolution ?? 512 } );
        const tensor = structureTensor( field );
        return { sett: `${ e } x ${ p }`, imbalance: e / p, coherence: tensor.coherence, ridgeDeg: tensor.ridgeDeg };

    } );

}

// =================================================================================================
// 9. One-call measurement of a fabric
// =================================================================================================

export function measureFabric( family, options = {} ) {

    if ( family.klass === NON_TEXTILE ) {

        return {
            key: family.key,
            klass: family.klass,
            inapplicable: true,
            reason: family.source
        };

    }

    const spec = resolveSpec( family );
    const field = generateHeightField( spec, options );
    const tensor = structureTensor( field );

    const woven = family.klass === WOVEN;
    const fft = woven ? fftTwillAngle( field ) : { refused: true, reason: `${ family.klass }: no warp/weft interlacing, so no twill line` };
    const lattice = woven ? null : fftKnitLattice( field );
    const repeat = woven ? repeatProfile( field, spec ) : { applicable: false, reason: `${ family.klass }` };
    const repeatVerdict = repeatProfileVerdict( repeat );

    const predicted = woven ? predictedTwillAngleDeg( spec ) : null;
    const isPlain = woven && family.weave.over === 1 && family.weave.under === 1;

    return {
        key: family.key,
        label: family.label,
        klass: family.klass,
        defect: options.defect ?? null,
        spec,
        field: {
            resolution: field.resolution,
            patchMm: [ field.patchWidth / 1000, field.patchHeight / 1000 ],
            texelMicrons: [ field.texelX, field.texelY ],
            thicknessMm: field.thicknessMicrons / 1000,
            dWarpMicrons: field.dWarp,
            dWeftMicrons: field.dWeft,
            periodic: field.periodic
        },
        tensor,
        fft,
        lattice,
        repeat,
        repeatVerdict,
        predictedTwillDeg: predicted,
        isPlain,
        anisotropy: anisotropyFromMeasurement( family, tensor, fft ),
        _field: field
    };

}

// =================================================================================================
// 10. CLI
// =================================================================================================

const isNode = typeof process !== 'undefined' && process.argv !== undefined;

function fmt( v, dp = 4 ) {

    if ( v === null || v === undefined ) return '—';
    if ( typeof v === 'number' ) return Number.isFinite( v ) ? v.toFixed( dp ) : String( v );
    return String( v );

}

function pad( s, w, right = false ) {

    s = String( s );
    return right ? s.padStart( w ) : s.padEnd( w );

}

function printTable() {

    console.log( '\n=== FABRIC TAXONOMY, PARAMETERISED ===\n' );
    console.log( 'Classes:' );
    for ( const [ k, v ] of Object.entries( FABRIC_CLASSES ) ) console.log( `  ${ pad( k, 12 ) } ${ v }` );

    console.log( '\n' + [
        pad( 'family', 16 ), pad( 'class', 12 ), pad( 'structure', 22 ),
        pad( 'ends/in', 8, true ), pad( 'picks/in', 9, true ),
        pad( 'warp µm', 9, true ), pad( 'weft µm', 9, true ),
        pad( 'g/m²', 8, true ), pad( 'drape%', 8, true ), pad( 'rough', 12 ), pad( 'twill°', 8, true )
    ].join( ' ' ) );

    for ( const f of [ ...FABRIC_FAMILIES, ...CONTROL_FABRICS ] ) {

        const spec = f.klass === NON_TEXTILE ? null : resolveSpec( f );
        const structure = f.weave?.name ?? f.knit?.name ?? f.substrate?.name ?? '—';
        const drape = f.drape === null || f.drape === undefined ? '[✗]'
            : Array.isArray( f.drape.value ) ? f.drape.value.join( '–' ) : String( f.drape.value );

        console.log( [
            pad( f.key, 16 ), pad( f.klass, 12 ), pad( structure.slice( 0, 22 ), 22 ),
            pad( f.endsPerInch !== undefined ? f.endsPerInch.toFixed( 1 ) : '—', 8, true ),
            pad( f.picksPerInch !== undefined ? f.picksPerInch.toFixed( 1 ) : '—', 9, true ),
            pad( spec?.warpTex ? yarnDiameterMicrons( spec.warpTex ).toFixed( 0 ) : '—', 9, true ),
            pad( spec?.weftTex ? yarnDiameterMicrons( spec.weftTex ).toFixed( 0 ) : '—', 9, true ),
            pad( f.gsm ?? '[✗]', 8, true ), pad( drape, 8, true ),
            pad( f.roughness ? f.roughness.join( '–' ) : '—', 12 ),
            pad( f.klass === WOVEN ? predictedTwillAngleDeg( f ).toFixed( 2 ) : '—', 8, true )
        ].join( ' ' ) );

    }

    console.log( '\nSources, in full:\n' );
    for ( const f of [ ...FABRIC_FAMILIES, ...CONTROL_FABRICS ] ) {

        console.log( `  ${ f.key }\n    ${ f.source }\n` );

    }

    console.log( 'Yarn diameter formula, re-derived against the four worked values in §5.3:' );
    for ( const c of checkYarnDiameterFormula() ) {

        console.log( `  ${ pad( c.label, 22 ) } published ${ pad( c.published, 4, true ) } µm   computed ${ pad( c.computed.toFixed( 2 ), 7, true ) } µm   Δ ${ c.errorMicrons.toFixed( 2 ) }` );

    }

}

function printMeasure( options ) {

    const families = options.family
        ? [ fabricByKey( options.family ) ]
        : [ ...FABRIC_FAMILIES, ...CONTROL_FABRICS ];

    console.log( '\n=== GENERATED AND MEASURED ===' );
    console.log( `resolution ${ options.resolution }, ${ options.periodic ? 'periodic patch' : 'NON-PERIODIC patch (Hann window + sub-bin interpolation)' }, noise ${ options.noiseMicrons } µm\n` );

    console.log( [
        pad( 'family', 18 ), pad( 'patch mm', 12 ), pad( 'µm/texel', 9, true ),
        pad( 'thick mm', 9, true ), pad( 'coherence', 10, true ), pad( 'tensor°', 9, true ),
        pad( 'FFT°', 9, true ), pad( 'predict°', 9, true ), pad( 'unique', 8, true ), pad( 'promin', 8, true ),
        pad( 'repeat µm', 10, true ), pad( 'harm frac', 10, true ), pad( 'interlaced', 11 )
    ].join( ' ' ) );

    const rows = [];

    for ( const f of families ) {

        if ( f.klass === NON_TEXTILE ) {

            console.log( `${ pad( f.key, 18 ) } INAPPLICABLE — leather is a BRDF, not a weave. No lattice, no repeat, no gate.` );
            continue;

        }

        const m = measureFabric( f, options );
        rows.push( m );

        console.log( [
            pad( f.key, 18 ),
            pad( `${ m.field.patchMm[ 0 ].toFixed( 2 ) }x${ m.field.patchMm[ 1 ].toFixed( 2 ) }`, 12 ),
            pad( m.field.texelMicrons[ 0 ].toFixed( 1 ), 9, true ),
            pad( m.field.thicknessMm.toFixed( 3 ), 9, true ),
            pad( m.tensor.coherence.toFixed( 4 ), 10, true ),
            pad( m.tensor.ridgeDeg.toFixed( 2 ), 9, true ),
            pad( m.fft.refused ? 'REFUSED' : m.fft.angleDeg.toFixed( 2 ), 9, true ),
            pad( m.predictedTwillDeg === null ? '—' : m.predictedTwillDeg.toFixed( 2 ), 9, true ),
            pad( m.fft.uniqueness === undefined ? '—' : ( Number.isFinite( m.fft.uniqueness ) ? m.fft.uniqueness.toFixed( 2 ) : '∞' ), 8, true ),
            pad( m.fft.prominence === undefined ? '—' : ( Number.isFinite( m.fft.prominence ) ? m.fft.prominence.toFixed( 1 ) : '∞' ), 8, true ),
            pad( m.repeat.applicable ? m.repeat.fundamentalMicrons.toFixed( 1 ) : '—', 10, true ),
            pad( m.repeat.applicable ? ( Number.isFinite( m.repeat.harmonicFraction ) ? m.repeat.harmonicFraction.toFixed( 3 ) : 'n/a' ) : '—', 10, true ),
            pad( m.repeat.applicable ? ( m.repeatVerdict.ok ? 'yes' : 'NO' ) : '—', 11 )
        ].join( ' ' ) );

        if ( m.fft.refused && m.fft.reason ) console.log( `${ ' '.repeat( 19 ) }↳ ${ m.fft.reason }` );
        if ( m.repeat.applicable && ! m.repeatVerdict.ok ) console.log( `${ ' '.repeat( 19 ) }↳ ${ m.repeatVerdict.reason }` );
        if ( m.lattice !== null && m.lattice.refused === false ) {

            console.log( `${ ' '.repeat( 19 ) }↳ knit lattice: wales ${ m.lattice.walesPerCmRecovered.toFixed( 2 ) }/cm recovered vs ${ m.lattice.expectedWalesPerCm.toFixed( 2 ) } expected (${ m.lattice.walesPerCm } wales/cm, rib ${ m.lattice.ribWales }); courses ${ m.lattice.coursesPerCmRecovered.toFixed( 2 ) } vs ${ m.lattice.expectedCoursesPerCm }; harmonics discarded ${ m.lattice.harmonics.join( '/' ) }` );

        }

    }

    return rows;

}

function printGate( options ) {

    let failures = 0;
    const say = ( ok, line ) => { console.log( `  ${ ok ? 'PASS' : 'FAIL' }  ${ line }` ); if ( ! ok ) failures ++; };

    console.log( '\n================================================================================' );
    console.log( ' PUNCH LIST 9.16 — GATE' );
    console.log( ' "twill angle recovered by an FFT peak at the weave-repeat frequency, matching' );
    console.log( '  atan((picks x advance) / ends) within a stated tolerance"' );
    console.log( '================================================================================' );
    console.log( `\n Tolerance, stated: ±${ ANGLE_TOLERANCE_DEG.toFixed( 2 ) }° absolute.` );
    console.log( ' Refusal floors, set from principle and not fitted:' );
    console.log( `   uniqueness ≥ ${ UNIQUENESS_MIN.toFixed( 1 ) }  (a twill line is a UNIQUE direction; a plain weave sits at exactly 1.0)` );
    console.log( `   prominence ≥ ${ PROMINENCE_MIN.toFixed( 1 ) }  (a peak must stand above the band mean)` );
    console.log( ` Determinism: the generator uses no RNG unless --noise is passed, so the load-to-load` );
    console.log( ` spread of every number below is exactly 0 and no verdict here is MARGINAL.` );

    // 🚩 A RESOLUTION FLOOR, MEASURED RATHER THAN CHOSEN. Run at --res 128 and two checks fail:
    // the coherence ordering (2/2 twill nearer plain than 2/1) and piqué's course recovery
    // (10.00 against 15). Neither is a defect in the generator — at 128 a yarn cross-section is
    // two or three texels across and both the structure tensor and the lattice peak are reading
    // the sampling grid. 256 is the lowest resolution at which every check in this file holds,
    // and 512 is what every number quoted in tools/spikes/README.md was taken at.
    if ( options.resolution < 256 ) {

        console.log( `\n 🚩 REFUSING TO RUN AT --res ${ options.resolution }. Measured floor is 256: at 128 the coherence` );
        console.log( `    ordering and piqué's course recovery both fail because a yarn is only two or` );
        console.log( `    three texels wide and the instruments are reading the sampling grid, not the` );
        console.log( `    fabric. A green gate below the floor would be a gate about the sampler.\n` );
        return 1;

    }

    console.log( ` Resolution ${ options.resolution }² (measured floor 256; README numbers were taken at 512).\n` );

    // --- 0. the formula the whole thing rests on -------------------------------------------------
    console.log( '--- 0. yarn diameter formula, against the four worked values in §5.3 ---' );
    for ( const c of checkYarnDiameterFormula() ) {

        say( Math.abs( c.errorMicrons ) < 1.0,
            `${ pad( c.label, 22 ) } §5.3 says ${ c.published } µm, 37.42·√tex gives ${ c.computed.toFixed( 2 ) } µm (Δ ${ c.errorMicrons.toFixed( 2 ) })` );

    }

    // --- 1. forward: every regular twill ---------------------------------------------------------
    console.log( '\n--- 1. FORWARD — the twill angle, on every REGULAR twill ---' );

    const wovens = [ ...FABRIC_FAMILIES, ...CONTROL_FABRICS ].filter( ( f ) => f.klass === WOVEN );
    const results = new Map();

    for ( const f of wovens ) results.set( f.key, measureFabric( f, options ) );

    // A regular twill: move number 1, so exactly one diagonal exists. Plain and satin are handled
    // below, each as its own refusal, because neither HAS a unique twill line to recover.
    const regularTwills = wovens.filter( ( f ) => Math.abs( f.weave.advance ) === 1 && ! ( f.weave.over === 1 && f.weave.under === 1 ) );

    for ( const f of regularTwills ) {

        const m = results.get( f.key );
        const err = m.fft.refused ? null : Math.abs( m.fft.angleDeg - m.predictedTwillDeg );
        say( err !== null && err <= ANGLE_TOLERANCE_DEG,
            `${ pad( f.key, 18 ) } predicted ${ pad( m.predictedTwillDeg.toFixed( 2 ), 6, true ) }°  recovered ${ pad( m.fft.refused ? 'REFUSED' : m.fft.angleDeg.toFixed( 2 ), 8, true ) }°  ` +
            `err ${ err === null ? '—' : err.toFixed( 4 ) }°  bin step ${ m.fft.binStepDeg?.toFixed( 3 ) ?? '—' }°  uniqueness ${ Number.isFinite( m.fft.uniqueness ) ? m.fft.uniqueness.toFixed( 2 ) : '∞' }x${ m.fft.uniqueness < UNIQUENESS_MIN * 1.05 ? ' MARGINAL' : '' }  prominence ${ Number.isFinite( m.fft.prominence ) ? m.fft.prominence.toFixed( 1 ) : '∞' }x` );

    }

    console.log( '        Every error above is at or below the double-precision floor, because a patch' );
    console.log( '        cut to a whole number of repeats puts the peak exactly on a bin. That is a' );
    console.log( '        statement about the SAMPLING, not about the gate, which is why --nonperiodic' );
    console.log( '        exists: it cuts the patch incommensurate, windows it, and forces the answer' );
    console.log( '        through sub-bin interpolation. Run it. The stated tolerance is for that case.' );

    // --- 2. RED 1: the plain weave -------------------------------------------------------------
    console.log( '\n--- 2. RED 1 — a plain weave, which has no diagonal to find ---' );

    const poplin = results.get( 'poplin' );
    say( poplin.fft.refused, `poplin 120x80 plain: the gate ${ poplin.fft.refused ? 'REFUSES' : 'returned ' + poplin.fft.angleDeg.toFixed( 2 ) + '°' }` );
    if ( poplin.fft.reason ) console.log( `        reason: ${ poplin.fft.reason }` );
    console.log( `        uniqueness ${ poplin.fft.uniqueness.toFixed( 6 ) } and mirror ratio ${ poplin.fft.mirrorRatio.toFixed( 6 ) } — both EXACTLY 1, not approximately.` );
    console.log( '        That is not a tuned threshold catching a near miss. `(i−j) mod 2` and' );
    console.log( '        `(i+j) mod 2` are the same function, so the field is mirror-symmetric in x' );
    console.log( '        and the two diagonals are the same number to the last bit.' );
    console.log( '' );
    console.log( '        🚩 AND THE FIRST VERSION OF THIS GENERATOR FAILED THIS RED, which is the whole' );
    console.log( '        argument for writing it. It centred each yarn cross-section on the interpolation' );
    console.log( '        segment (a `floor` index) instead of on the yarn (a `round` index), putting every' );
    console.log( '        ridge in the gutter. The picture still looked like cloth. But `floor` is not' );
    console.log( '        symmetric about a yarn centre where `round` is, so the field lost its mirror' );
    console.log( '        symmetry and poplin\'s ± diagonals read 1.99e6 against 4.40e5 — a chirality of' );
    console.log( '        4.5x on a plain weave, and RED 1 green on a broken generator.' );

    // --- 2b. satin: a measured limit of the gate, reported rather than tuned ---------------------
    console.log( '\n--- 2b. SATIN — an honest limit, and the gate refuses rather than guessing ---' );

    const satin = results.get( 'satin' );
    say( satin.fft.refused,
        `satin 4/1 move-2, 180x90: predicted ${ satin.predictedTwillDeg.toFixed( 2 ) }°, gate ${ satin.fft.refused ? 'REFUSES' : 'returned ' + satin.fft.angleDeg.toFixed( 2 ) + '°' }` );
    console.log( `        ${ satin.fft.reason }` );
    console.log( '' );
    console.log( '        WHY, and it is a property of satin rather than of this instrument. The same' );
    console.log( '        interlacing point set satisfies BOTH `(2i − j) ≡ 4 (mod 5)` and' );
    console.log( '        `(i + 2j) ≡ 2 (mod 5)` — multiply the first by 3, the inverse of 2 mod 5. Two' );
    console.log( '        generators, two diagonals, and the second one is the stronger peak here' );
    console.log( `        (${ satin.fft.peakAngleDeg.toFixed( 2 ) }° at ${ satin.fft.uniqueness.toFixed( 3 ) }x the 45.00° family).` );
    console.log( '        That is the textile definition of satin: it is CONSTRUCTED so the interlacings' );
    console.log( '        do not line up into a visible twill. §4.4\'s predicted 45.00° applies the twill' );
    console.log( '        formula to the one weave family the formula does not describe.' );
    console.log( '' );
    console.log( '        Reported, not tuned. A gate that returned 45.00° here would be reading a' );
    console.log( '        number off a structure that does not have one.' );

    // --- 3. RED 2: the whole-patch structure tensor --------------------------------------------
    console.log( '\n--- 3. RED 2 — the whole-patch structure tensor, on the SAME correct twills ---' );
    console.log( '        §4.4: "Every twill reported −90.00°, i.e. axis-aligned, not the diagonal."' );
    console.log( '        Both instruments run on one field in one pass, so this is demonstrated, not quoted.' );

    console.log( '        Test, stated: the tensor lands within 10° of the WARP AXIS (i.e. ±90°) while' );
    console.log( '        sitting more than 20° away from the true twill angle. Both halves are needed —' );
    console.log( '        "not the twill angle" alone would also be satisfied by noise.' );

    for ( const key of [ 'denim', 'chino', 'gabardine-probe' ] ) {

        const m = results.get( key );
        const offWarpAxis = Math.abs( Math.abs( m.tensor.ridgeDeg ) - 90 );
        const fromTwill = Math.abs( m.tensor.ridgeDeg - m.predictedTwillDeg );
        const tensorWrong = offWarpAxis < 10 && fromTwill > 20;
        const fftRight = ! m.fft.refused && Math.abs( m.fft.angleDeg - m.predictedTwillDeg ) <= ANGLE_TOLERANCE_DEG;
        say( tensorWrong && fftRight,
            `${ pad( key, 18 ) } tensor ${ pad( m.tensor.ridgeDeg.toFixed( 2 ), 7, true ) }° (${ offWarpAxis.toFixed( 1 ) }° off the warp axis, ${ fromTwill.toFixed( 1 ) }° from the twill) — WRONG.   FFT ${ pad( m.fft.angleDeg.toFixed( 2 ), 6, true ) }° against ${ m.predictedTwillDeg.toFixed( 2 ) }° — RIGHT.` );

    }

    const gab = results.get( 'gabardine' );
    console.log( '' );
    console.log( `        ⚠️ ONE FABRIC IS EXCLUDED FROM THIS RED AND THE REASON IS WORTH KEEPING. The` );
    console.log( `        2/2 gabardine's tensor reads ${ gab.tensor.ridgeDeg.toFixed( 2 ) }°, nowhere near the warp axis — but its` );
    console.log( `        coherence is only ${ gab.tensor.coherence.toFixed( 4 ) }, and an orientation read off a nearly isotropic` );
    console.log( '        tensor is a direction picked out of noise. The angle a structure tensor reports' );
    console.log( '        is only meaningful in proportion to the coherence beside it, and neither §4.4' );
    console.log( '        nor this file should quote one without the other.' );

    // --- 4. RED 3: five different defects ------------------------------------------------------
    console.log( '\n--- 4. RED 3 — five ways to break it, only ONE of which the gate was designed around ---' );
    console.log( '        LEARNINGS §1.25a: "Write the known-bad you were going to write. Then write a' );
    console.log( '        second one you did NOT have in mind when you designed the gate."\n' );

    const base = fabricByKey( 'denim' );
    const clean = results.get( 'denim' );

    for ( const [ name, meta ] of Object.entries( WEAVE_DEFECTS ) ) {

        const m = measureFabric( base, { ...options, defect: name } );
        const angle = m.fft.refused ? null : m.fft.angleDeg;
        const fftCaught = m.fft.refused || Math.abs( angle - clean.predictedTwillDeg ) > ANGLE_TOLERANCE_DEG;
        const repeatCaught = ! m.repeatVerdict.ok;

        const caught = fftCaught || repeatCaught;
        const by = [ fftCaught ? 'FFT' : null, repeatCaught ? 'repeat-profile' : null ].filter( Boolean ).join( ' + ' ) || 'NOTHING';

        say( caught, `${ pad( name, 18 ) } FFT ${ pad( angle === null ? 'REFUSED' : angle.toFixed( 2 ) + '°', 9, true ) }  ` +
            `repeat ${ pad( m.repeat.fundamentalMicrons.toFixed( 2 ) + ' µm', 10, true ) } ` +
            `harm ${ pad( Number.isFinite( m.repeat.harmonicFraction ) ? m.repeat.harmonicFraction.toFixed( 3 ) : 'n/a', 7, true ) }  caught by ${ by }` );

        console.log( `        ${ meta.summary }` );
        if ( ! fftCaught ) console.log( `        🚩 THE FFT GATE IS GREEN ON THIS ONE. ${ meta.caughtBy }` );
        console.log( '' );

    }

    // --- 5. and prove the reds do not also reject the real thing --------------------------------
    console.log( '--- 5. the refusals must not reject the fabrics the gate exists for ---' );
    console.log( '        §1.25a: "a refusal that also rejects the clips the tool exists for is worse' );
    console.log( '        than no refusal."' );

    console.log( '        Satin is deliberately not in this list — 2b establishes that refusing it is' );
    console.log( '        the correct answer, not a false negative.' );

    for ( const key of [ 'denim', 'chino', 'gabardine', 'worsted-wool', 'gabardine-probe' ] ) {

        const m = results.get( key );
        say( ! m.fft.refused, `${ pad( key, 18 ) } accepted, angle ${ m.fft.refused ? 'REFUSED' : m.fft.angleDeg.toFixed( 2 ) + '°' }` );

    }

    // --- 6. the coherence half — and a correction to §4.4 -------------------------------------
    console.log( '\n--- 6. the half §4.4 said DOES work: coherence. And a CORRECTION to it. ---' );
    console.log( '        §4.4: "coherence separates plain weave from twill by 1.9–2.6x (0.2887 against' );
    console.log( '        0.556–0.743) and orders the twills by float length exactly as it should:' );
    console.log( '        2/1 < 3/1 < 4/1 satin."' );
    console.log( '' );
    console.log( '        🚩 THOSE FOUR FABRICS HAD FOUR DIFFERENT SETTS — plain 120x80, denim 68x44,' );
    console.log( '        gabardine 100x60, satin 180x90 — so float length and sett imbalance moved' );
    console.log( '        together and the measurement cannot say which caused the ordering. Below,' );
    console.log( '        each is varied ALONE. This is the control §5.3 praises in the F&T dataset:' );
    console.log( '        "the yarns are held identical … and only the weave changes."' );

    console.log( '\n        (a) SETT AND YARNS FIXED at 114.3 x 67.3 /in, 36.9 / 28.27 tex. Weave varies:' );
    console.log( `        ${ pad( 'weave', 16 ) } ${ pad( 'float', 6, true ) } ${ pad( 'warp-face', 10, true ) } ${ pad( 'coherence', 10, true ) } ${ pad( 'ridge°', 8, true ) }` );

    const sweep = controlledWeaveSweep( options );
    for ( const r of sweep ) {

        console.log( `        ${ pad( r.name, 16 ) } ${ pad( r.floatLength, 6, true ) } ${ pad( r.warpFaceFraction.toFixed( 3 ), 10, true ) } ${ pad( r.coherence.toFixed( 4 ), 10, true ) } ${ pad( r.ridgeDeg.toFixed( 2 ), 8, true ) }` );

    }

    const byName = Object.fromEntries( sweep.map( ( r ) => [ r.name, r ] ) );

    say( byName[ '4/1 satin m2' ].coherence > byName[ '2/1 twill' ].coherence && byName[ '2/1 twill' ].coherence > byName[ 'plain' ].coherence,
        `coherence still separates plain from a warp-faced twill with the sett held fixed ` +
        `(plain ${ byName[ 'plain' ].coherence.toFixed( 4 ) } -> 2/1 ${ byName[ '2/1 twill' ].coherence.toFixed( 4 ) } -> 4/1 ${ byName[ '4/1 satin m2' ].coherence.toFixed( 4 ) })` );

    const twoTwo = byName[ '2/2 twill' ], twoOne = byName[ '2/1 twill' ], threeOne = byName[ '3/1 twill' ];

    console.log( '' );
    console.log( '        🎯 THE CORRECTION, and it is falsifiable rather than rhetorical. §4.4 could' );
    console.log( '        not distinguish "orders by FLOAT LENGTH" from "orders by WARP-FACE FRACTION"' );
    console.log( '        because for 2/1, 3/1 and 4/1 the two rise together. A 2/2 twill breaks the' );
    console.log( '        tie: float length 2, warp-face 0.500. If coherence tracked float length it' );
    console.log( '        would land beside the 2/1. It does not.' );
    console.log( `           2/2 twill (float 2, warp-face 0.500)  ${ twoTwo.coherence.toFixed( 4 ) }` );
    console.log( `           2/1 twill (float 2, warp-face 0.667)  ${ twoOne.coherence.toFixed( 4 ) }` );
    console.log( `           3/1 twill (float 3, warp-face 0.750)  ${ threeOne.coherence.toFixed( 4 ) }` );
    console.log( `           plain     (float 1, warp-face 0.500)  ${ byName[ 'plain' ].coherence.toFixed( 4 ) }` );

    say( Math.abs( twoTwo.coherence - byName[ 'plain' ].coherence ) < Math.abs( twoTwo.coherence - twoOne.coherence ),
        `the 2/2 twill sits nearer the PLAIN weave than the 2/1 despite sharing the 2/1's float length ` +
        `— coherence tracks WARP-FACE FRACTION, not float length` );
    say( Math.abs( twoOne.coherence - threeOne.coherence ) / threeOne.coherence < 0.25,
        `2/1 and 3/1 differ by only ${ ( 100 * Math.abs( twoOne.coherence - threeOne.coherence ) / threeOne.coherence ).toFixed( 1 ) }% despite a whole float of difference` );

    console.log( '\n        (b) WEAVE FIXED at plain. Sett varies — the confound, measured:' );
    console.log( `        ${ pad( 'sett', 16 ) } ${ pad( 'ends:picks', 11, true ) } ${ pad( 'coherence', 10, true ) } ${ pad( 'ridge°', 8, true ) }` );

    const setts = controlledSettSweep( options );
    for ( const r of setts ) console.log( `        ${ pad( r.sett, 16 ) } ${ pad( r.imbalance.toFixed( 3 ), 11, true ) } ${ pad( r.coherence.toFixed( 4 ), 10, true ) } ${ pad( r.ridgeDeg.toFixed( 2 ), 8, true ) }` );

    const balanced = setts.find( ( r ) => r.sett === '90 x 90' );
    const skewed = setts.find( ( r ) => r.sett === '68 x 44' );
    say( skewed.coherence > byName[ '3/1 twill' ].coherence,
        `a PLAIN weave at denim's 68x44 sett reads ${ skewed.coherence.toFixed( 4 ) } — MORE coherent than a 3/1 TWILL ` +
        `at the balanced sett (${ byName[ '3/1 twill' ].coherence.toFixed( 4 ) }), and within 0.5% of a 5/1 sateen ` +
        `(${ byName[ '5/1 sateen m2' ].coherence.toFixed( 4 ) }). Sett alone spans nearly the whole range, so a bare ` +
        `coherence number cannot be read as a statement about the weave.` );
    // 🚩 STATED AS A RATIO, NOT AN ABSOLUTE, and the reason is a resolution dependence found by
    // running the gate at two resolutions. The residual coherence of a balanced plain weave is
    // 0.0036 at --res 512 and 0.0947 at --res 256: at 256 the yarn cross-sections are only ~5
    // texels wide and the sampling grid itself breaks the symmetry. An absolute floor of 0.05
    // therefore passes at one resolution and fails at the other, which would make the gate a
    // statement about the sampler. The physical claim — "a balanced plain weave is far less
    // directional than a skewed one" — survives both.
    say( balanced.coherence < 0.25 * skewed.coherence,
        `a balanced 90x90 plain weave reads ${ balanced.coherence.toFixed( 4 ) }, ${ ( skewed.coherence / balanced.coherence ).toFixed( 0 ) }x below the same weave at 68x44 — ` +
        `isotropic, which is the physical answer and a sanity check on the instrument. ` +
        `⚠️ the ABSOLUTE value is resolution-dependent (0.0036 at --res 512, 0.0947 at --res 256, ` +
        `where a yarn is only ~5 texels wide); this reads ${ balanced.coherence.toFixed( 4 ) } at --res ${ options.resolution }.` );

    console.log( '' );
    console.log( '        CONSEQUENCE FOR THE MATERIAL: anisotropy strength should be driven by the' );
    console.log( '        MEASURED coherence of the generated field — which is what' );
    console.log( '        anisotropyFromMeasurement does — and NOT by a float-length lookup, which' );
    console.log( '        would give a 2/2 gabardine a lobe it does not have.' );

    // --- 7. knits get their own gate ------------------------------------------------------------
    console.log( '\n--- 7. knits: the twill gate does not apply, and the lattice gate does ---' );

    for ( const f of FABRIC_FAMILIES.filter( ( x ) => x.klass === KNIT ) ) {

        const m = measureFabric( f, options );
        const l = m.lattice;
        const wErr = Math.abs( l.walesPerCmRecovered - l.expectedWalesPerCm ) / l.expectedWalesPerCm;
        const cErr = Math.abs( l.coursesPerCmRecovered - l.expectedCoursesPerCm ) / l.expectedCoursesPerCm;
        say( m.fft.refused && wErr < 0.05 && cErr < 0.05,
            `${ pad( f.key, 18 ) } twill gate ${ m.fft.refused ? 'declines (correct)' : 'RETURNED A NUMBER (wrong)' };  ` +
            `wales ${ l.walesPerCmRecovered.toFixed( 2 ) } vs ${ l.expectedWalesPerCm.toFixed( 2 ) } expected (${ ( wErr * 100 ).toFixed( 1 ) }%)  courses ${ l.coursesPerCmRecovered.toFixed( 2 ) } vs ${ l.expectedCoursesPerCm } (${ ( cErr * 100 ).toFixed( 1 ) }%)` );

    }

    // --- 8. non-textile -------------------------------------------------------------------------
    console.log( '\n--- 8. THICKNESS against real measured fabric — REPORTED, NOT GATED ---' );
    console.log( '        §5.3 calls the F&T 1/2018 weave comparison "the single best calibration' );
    console.log( '        target in this whole document" because the yarns are held identical and' );
    console.log( '        only the weave changes. It is the one external number this file can be' );
    console.log( '        checked against, and the model FAILS it. Recorded rather than fitted.' );
    console.log( `        ${ pad( 'weave', 14 ) } ${ pad( 'ends/cm', 8, true ) } ${ pad( 'picks/cm', 9, true ) } ${ pad( 'F&T mm', 8, true ) } ${ pad( 'generated', 10, true ) } ${ pad( 'ratio', 7, true ) }` );

    const thickness = thicknessAgainstMeasured( options );
    for ( const r of thickness ) {

        console.log( `        ${ pad( r.name, 14 ) } ${ pad( r.endsPerCm, 8, true ) } ${ pad( r.picksPerCm, 9, true ) } ${ pad( r.measuredMm.toFixed( 2 ), 8, true ) } ${ pad( r.generatedMm.toFixed( 3 ), 10, true ) } ${ pad( r.ratio.toFixed( 3 ), 7, true ) }` );

    }

    const ratios = thickness.map( ( r ) => r.ratio );
    const measured = thickness.map( ( r ) => r.measuredMm );
    console.log( `        The model is ${ ( 100 * ( 1 - 1 / Math.min( ...ratios ) ) ).toFixed( 0 ) }–${ ( 100 * ( 1 - 1 / Math.max( ...ratios ) ) ).toFixed( 0 ) }% too thin, and the correction it would need varies by` );
    console.log( `        ${ ( Math.max( ...ratios ) / Math.min( ...ratios ) ).toFixed( 2 ) }x across four weaves whose REAL thicknesses span only ${ ( Math.max( ...measured ) / Math.min( ...measured ) ).toFixed( 2 ) }x. So no single crimp` );
    console.log( '        constant fixes it: crimp interchange between warp and weft is a mechanical' );
    console.log( '        equilibrium this model does not solve. It even gets the ORDER wrong — the' );
    console.log( `        3/1 twill generates thinnest (${ thickness[ 2 ].generatedMm.toFixed( 3 ) }) and measures thicker than the plain` );
    console.log( `        weave (${ thickness[ 2 ].measuredMm.toFixed( 2 ) } against ${ thickness[ 0 ].measuredMm.toFixed( 2 ) }).` );
    console.log( '        Invisible under a normal map. Visible under a DISPLACEMENT map or at a' );
    console.log( '        silhouette, which is where a garment edge lives.' );

    console.log( '\n--- 9. leather ---' );
    let threw = false;
    try { generateHeightField( resolveSpec( fabricByKey( 'leather' ) ) ); } catch ( e ) { threw = true; }
    say( threw, 'leather refuses to generate a weave height field at all — it is a BRDF, not a weave' );

    console.log( '\n================================================================================' );
    console.log( failures === 0 ? ` GATE: ${ failures } failures.` : ` GATE: ${ failures } FAILURES.` );
    console.log( '================================================================================\n' );

    return failures;

}

function printNoiseSweep( options ) {

    console.log( '\n=== NOISE ROBUSTNESS — where does the gate stop working? ===' );
    console.log( 'Gaussian height noise, σ in microns, added per texel. Denim: yarn diameters 301/243 µm,' );
    console.log( 'so σ = 100 µm is a third of a yarn.\n' );

    console.log( [ pad( 'σ µm', 8, true ), pad( 'FFT°', 10, true ), pad( 'err°', 9, true ), pad( 'unique', 9, true ), pad( 'promin', 9, true ), pad( 'coherence', 10, true ), pad( 'repeat µm', 10, true ), pad( 'harm', 8, true ), pad( 'verdict', 9 ) ].join( ' ' ) );

    const denim = fabricByKey( 'denim' );
    const predicted = predictedTwillAngleDeg( denim );

    for ( const sigma of [ 0, 5, 10, 25, 50, 100, 200, 400 ] ) {

        const m = measureFabric( denim, { ...options, noiseMicrons: sigma, seed: 1 } );
        console.log( [
            pad( sigma, 8, true ),
            pad( m.fft.refused ? 'REFUSED' : m.fft.angleDeg.toFixed( 2 ), 10, true ),
            pad( m.fft.refused ? '—' : Math.abs( m.fft.angleDeg - predicted ).toFixed( 3 ), 9, true ),
            pad( m.fft.uniqueness === undefined ? '—' : ( Number.isFinite( m.fft.uniqueness ) ? m.fft.uniqueness.toFixed( 2 ) : '∞' ), 9, true ),
            pad( m.fft.prominence === undefined ? '—' : ( Number.isFinite( m.fft.prominence ) ? m.fft.prominence.toFixed( 1 ) : '∞' ), 9, true ),
            pad( m.tensor.coherence.toFixed( 4 ), 10, true ),
            pad( m.repeat.fundamentalMicrons.toFixed( 2 ), 10, true ),
            pad( Number.isFinite( m.repeat.harmonicFraction ) ? m.repeat.harmonicFraction.toFixed( 3 ) : 'n/a', 8, true ),
            pad( m.fft.refused ? 'REFUSED' : ( Math.abs( m.fft.angleDeg - predicted ) <= ANGLE_TOLERANCE_DEG ? 'ok' : 'WRONG' ), 9 )
        ].join( ' ' ) );

    }

    console.log( '\n=== CONTAMINATION — a RIVAL diagonal of the OPPOSITE hand ===' );
    console.log( 'White noise is the easy case: it spreads across every bin and barely touches a' );
    console.log( 'single-bin peak, which is why the table above looks so comfortable. This puts the' );
    console.log( 'energy exactly where a wrong answer lives. The question is not whether the angle' );
    console.log( 'drifts — it is whether the gate ever returns a CONFIDENT WRONG NUMBER, or refuses.\n' );

    console.log( [ pad( 'rival µm', 9, true ), pad( '% of true', 10, true ), pad( 'FFT°', 10, true ), pad( 'unique', 9, true ), pad( 'verdict', 24 ) ].join( ' ' ) );

    const trueAmplitude = measureFabric( denim, options ).repeat.fundamentalMicrons;

    for ( const rival of [ 0, 10, 20, 29, 40, 60, 100 ] ) {

        const m = measureFabric( denim, { ...options, rivalMicrons: rival } );
        const wrong = ! m.fft.refused && Math.abs( m.fft.angleDeg - predicted ) > ANGLE_TOLERANCE_DEG;
        console.log( [
            pad( rival, 9, true ),
            pad( ( 100 * rival / trueAmplitude ).toFixed( 0 ) + '%', 10, true ),
            pad( m.fft.refused ? 'REFUSED' : m.fft.angleDeg.toFixed( 2 ), 10, true ),
            pad( m.fft.uniqueness === undefined ? '—' : ( Number.isFinite( m.fft.uniqueness ) ? m.fft.uniqueness.toFixed( 2 ) : '∞' ), 9, true ),
            // Standing constraint: a value closer to a band edge than the gate's spread licenses
            // no bare verdict, and the literal token MARGINAL is required. The spread here is
            // exactly 0 (no RNG on this path), but 2.01 against a floor of 2.00 is the same shape
            // as the `G2 0.9201 PASS` this project already paid for, so it is called out anyway.
            pad( m.fft.refused ? 'refuses (safe)'
                : ( wrong ? '🚩 CONFIDENT AND WRONG'
                    : ( m.fft.uniqueness < UNIQUENESS_MIN * 1.05 ? 'correct but MARGINAL' : 'correct' ) ), 24 )
        ].join( ' ' ) );

    }

}

/**
 * 🚩 `import.meta.url === \`file://${process.argv[1]}\`` — the idiom everyone reaches for — is
 * FALSE in this repo and the script silently does nothing. The directory is `Sugata 姿`, so
 * `import.meta.url` percent-encodes both the space and the kanji while `process.argv[1]` does not.
 * Decode the URL's pathname before comparing.
 */
const invokedDirectly = isNode && ( () => {

    try { return decodeURIComponent( new URL( import.meta.url ).pathname ) === process.argv[ 1 ]; }
    catch { return false; }

} )();

if ( invokedDirectly ) {

    const argv = process.argv.slice( 2 );
    const flag = ( name ) => argv.includes( `--${ name }` );
    const value = ( name, fallback ) => {

        const i = argv.indexOf( `--${ name }` );
        return i >= 0 && argv[ i + 1 ] !== undefined ? argv[ i + 1 ] : fallback;

    };

    const options = {
        resolution: Number( value( 'res', 512 ) ),
        periodic: ! flag( 'nonperiodic' ),
        noiseMicrons: Number( value( 'noise-sigma', 0 ) ),
        family: value( 'family', null ),
        seed: Number( value( 'seed', 1 ) )
    };

    let exit = 0;

    if ( flag( 'table' ) ) printTable();
    if ( flag( 'measure' ) ) printMeasure( options );
    if ( flag( 'noise' ) ) printNoiseSweep( options );
    if ( flag( 'gate' ) ) exit = printGate( options ) > 0 ? 1 : 0;

    if ( flag( 'json' ) ) {

        const rows = ( options.family ? [ fabricByKey( options.family ) ] : [ ...FABRIC_FAMILIES, ...CONTROL_FABRICS ] )
            .filter( ( f ) => f.klass !== NON_TEXTILE )
            .map( ( f ) => { const m = measureFabric( f, options ); delete m._field; return m; } );
        console.log( JSON.stringify( rows, null, 2 ) );

    }

    if ( ! flag( 'table' ) && ! flag( 'measure' ) && ! flag( 'gate' ) && ! flag( 'json' ) && ! flag( 'noise' ) ) {

        console.log( 'usage: node tools/spikes/fabric-weave.mjs [--table] [--measure] [--gate] [--noise] [--json]' );
        console.log( '                                          [--family <key>] [--res 512] [--nonperiodic]' );

    }

    process.exit( exit );

}
