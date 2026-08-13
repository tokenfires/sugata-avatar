//
// hair_alpha.mjs — the alpha STRUCTURE of the strand atlas, as numbers.
//
// Shared by `hair_alpha.selftest.mjs`, which gates on these, exactly the way `hair_geometry.mjs` is
// shared by `verify_glb.mjs` and its own selftest: the instrument lives apart from the thresholds so
// that the instrument can be checked against answers that are known on paper.
//
// ## What the statistics are, and why the obvious one is not among them
//
// MEAN ALPHA IS NOT A STATISTIC ABOUT STRUCTURE AND NEVER WAS. Round 17 proved a box mip chain
// conserves it exactly, so it says only how opaque a card is; a filled rectangle and a picket fence
// with the same coverage have the same mean. What separates them is:
//
//   `runsPerRow`   how many separate above-cutoff runs a row crosses. This is the spatial
//                  frequency, and it is the one number that tells a slab from a bundle: the sheet
//                  that a blind critic called *"a flat mauve board"* measured **1.15 runs per row**
//                  at the lod the camera samples, which is to say one run — the board.
//   `midBandShare` the share of texels that are neither strand nor gap. A strand too fine for the
//                  sampling rate does not disappear, it turns into a wash, and this is the wash.
//   `gapShare`     the share of INTERIOR texels that are genuinely open. Measured inside the edge
//                  band, because the shipped sheet's transparent texels were nearly all in its
//                  border wisps — 14.6% of strip 1 was under 0.15 and 0.911% of strip 1's interior
//                  was, which is standing rule 4 in one line: the statistic was mostly backdrop.
//
// ## Everything is quoted twice, and the second one is the one that matters
//
// At mip 0, which is what the file contains, and at `SAMPLED_LOD`, which is what the camera reads.
// `tools/figure-pipeline/hair_lod.mjs` measures the second by evaluating the hardware's own
// trilinear rule per hair triangle off the live page. The two disagree by a factor of three on the
// mid band and nobody looks at mip 0.
//
// 🚩 **THE RESAMPLE IS A FRACTIONAL BOX FILTER RATHER THAN A ROW OF THE MIP CHAIN.** A box chain
// only exists at powers of two and the sampled lod is not one, so no level of it answers the
// question; each output texel integrates its own footprint in the input instead, which is what a
// box filter at a fractional level is. `hair_texture.area_resample` is the same arithmetic in the
// language the sheet is drawn in, and the selftest checks both against a case with a known answer.

/** Neither strand nor gap. See `hair_texture.MID_BAND` — the same band, in the other language. */
export const MID_BAND = [0.15, 0.85];

/** The cutoff a run is counted at, and `hair_texture.OPAQUE_ENOUGH`. */
export const OPAQUE_ENOUGH = 0.5;

/**
 * The lod the camera samples the atlas at, measured this session with
 * `node tools/figure-pipeline/hair_lod.mjs` on `alive.html` at 900x1200 CSS, scene pass 594x792,
 * on THIS round's 462-card groom:
 *
 *   portrait        p10 1.225  **p50 1.925**  p90 3.125
 *   three-quarter   p10 0.825  **p50 1.575**  p90 3.125
 *
 * The portrait median, because the portrait is the framing the groom is judged at and the median is
 * weighted by the pixels a viewer actually looks at. ⚠️ It is a property of the FRAMING AND OF THE
 * CARD WIDTHS: re-measure it with that tool if the camera, the canvas or the card widths move, and
 * do not tune it.
 *
 * 🚩 **THIS WAS 1.492 FOR TWO ROUNDS AND 1.492 IS THE CSS-PIXEL FIGURE, NOT THE SAMPLED ONE.** The
 * page ships TAAU at `resolutionScale` 0.66, so the sampler's derivatives are taken over a raster
 * 0.66 as wide and its footprint is 1/0.66 wider — `log2(1/0.66)` = +0.599 mip. `hair_lod.mjs` took
 * its Jacobian in CSS pixels and now takes it on the scene pass. On the SHIPPED 648-card groom, so
 * that the two readings are of the same asset and the only thing that moved is the raster:
 *
 *   CSS pixels (as it was)   1.492      scene pass (as it is)   2.075      shift +0.583
 *
 * against the +0.599 the arithmetic predicts — the histogram's bins are 0.05 wide, so that is one
 * bin. `hair_layers.mjs` measured the same quantity independently on the same build, per pixel
 * rather than per triangle, and read an all-strip p50 of 2.011: two instruments, one number.
 *
 * 🎯 **AND THE 1.925 ABOVE IS 2.075 MINUS WHAT THIS ROUND'S WIDER CARDS BOUGHT.** A card carrying a
 * 128-texel strip is read at `log2(128 / its scene-pass width)`, so widening the cards is a
 * DIRECT lever on this constant: the same sheet, on cards 12–18% wider, is sampled 0.15 of a mip
 * finer. That is the mechanism the round's `hair_cards.HAIR_LAYERS` change is aimed at.
 *
 * ⚠️ **THE CORRECTION TURNS CLAUSE A OF `hair_alpha.selftest.mjs` RED AND THAT IS THE POINT.** The
 * gate had been reading the sheet at a scale 0.6 of a mip finer than the hardware uses, which
 * flatters the exact statistic the gate exists to refuse. Declared in `docs/RED-GATES.md`. Do not
 * move the constant back to make the gate green — the constant is a measurement of the page.
 */
export const SAMPLED_LOD = 1.925;

/**
 * The alpha plane of one atlas strip, as a Float64Array with its width, out of a decoded PNG.
 * `pixels` is `tools/critic/png.mjs`'s RGBA in 0–1.
 */
export function stripAlpha(image, strip, strips) {
  const stripWidth = Math.floor(image.width / strips);
  const left = strip * stripWidth;
  const alpha = new Float64Array(stripWidth * image.height);

  for (let row = 0; row < image.height; row += 1) {
    for (let column = 0; column < stripWidth; column += 1) {
      alpha[row * stripWidth + column] = image.pixels[((row * image.width) + left + column) * 4 + 3];
    }
  }

  return { values: alpha, width: stripWidth, height: image.height };
}

/**
 * Box-filters a plane down by a real (non-integer) factor: the mip chain evaluated at a real lod.
 *
 * Each output texel is the mean of the input texels its footprint covers, with the footprint
 * boundaries taken from the same integer division in both axes so that the partition is exact and
 * every input texel is counted once. That is what makes the mean invariant, which the selftest
 * asserts.
 */
export function areaResample(plane, scale) {
  const outHeight = Math.max(1, Math.round(plane.height / scale));
  const outWidth = Math.max(1, Math.round(plane.width / scale));
  const values = new Float64Array(outWidth * outHeight);

  const edge = (index, count, span) => Math.floor((index * span) / count);

  for (let row = 0; row < outHeight; row += 1) {
    const rowFrom = edge(row, outHeight, plane.height);
    const rowTo = edge(row + 1, outHeight, plane.height);
    for (let column = 0; column < outWidth; column += 1) {
      const columnFrom = edge(column, outWidth, plane.width);
      const columnTo = edge(column + 1, outWidth, plane.width);
      let total = 0;
      for (let y = rowFrom; y < rowTo; y += 1) {
        for (let x = columnFrom; x < columnTo; x += 1) total += plane.values[y * plane.width + x];
      }
      values[row * outWidth + column] = total / ((rowTo - rowFrom) * (columnTo - columnFrom));
    }
  }

  return { values, width: outWidth, height: outHeight };
}

/** Mean alpha. The transmittance's number, and structurally blind — see the header. */
export function meanAlpha(plane) {
  let total = 0;
  for (let index = 0; index < plane.values.length; index += 1) total += plane.values[index];

  return total / plane.values.length;
}

/** The share of texels that have committed to neither strand nor gap. */
export function midBandShare(plane) {
  let inside = 0;
  for (let index = 0; index < plane.values.length; index += 1) {
    const value = plane.values[index];
    if (value >= MID_BAND[0] && value <= MID_BAND[1]) inside += 1;
  }

  return inside / plane.values.length;
}

/**
 * Mean number of separate above-cutoff runs a row crosses — the strip's spatial frequency, and the
 * statistic that tells a bundle of hairs from a board.
 */
export function runsPerRow(plane) {
  let starts = 0;
  for (let row = 0; row < plane.height; row += 1) {
    let previous = 0;
    for (let column = 0; column < plane.width; column += 1) {
      const kept = plane.values[row * plane.width + column] >= OPAQUE_ENOUGH ? 1 : 0;
      if (kept === 1 && previous === 0) starts += 1;
      previous = kept;
    }
  }

  return starts / plane.height;
}

/** Mean width, in texels, of one of those runs. A run under two texels is a smear, not a strand. */
export function strandTexels(plane) {
  let kept = 0;
  for (let index = 0; index < plane.values.length; index += 1) {
    if (plane.values[index] >= OPAQUE_ENOUGH) kept += 1;
  }
  const runs = runsPerRow(plane) * plane.height;

  return runs === 0 ? 0 : kept / runs;
}

/**
 * The share of a strip's INTERIOR that is genuinely open, inside the border band.
 *
 * 🚩 **THE BAND IS EXCLUDED BECAUSE OF WHAT IT DID TO THIS STATISTIC ON THE SHIPPED SHEET.** Over
 * the whole of strip 1, 14.635% of texels were under 0.15 and the strip looked like it had gaps in
 * it; inside `INTERIOR_INSET` texels of each edge, 0.911% were, and the strip was a rectangle. The
 * gaps were all in the wisps at the border. Standing rule 4: check what the mask contains.
 */
export const INTERIOR_INSET = 20;

export function gapShare(plane, threshold = MID_BAND[0]) {
  let open = 0;
  let counted = 0;
  for (let row = 0; row < plane.height; row += 1) {
    for (let column = INTERIOR_INSET; column < plane.width - INTERIOR_INSET; column += 1) {
      counted += 1;
      if (plane.values[row * plane.width + column] < threshold) open += 1;
    }
  }

  return counted === 0 ? 0 : open / counted;
}

/** Every statistic for one strip, at mip 0 and at the sampled lod. */
export function stripReport(image, strip, strips, lod = SAMPLED_LOD) {
  const plane = stripAlpha(image, strip, strips);
  const sampled = areaResample(plane, 2 ** lod);

  return {
    strip,
    mean: meanAlpha(plane),
    midBand: midBandShare(plane),
    midBandAtLod: midBandShare(sampled),
    runs: runsPerRow(plane),
    runsAtLod: runsPerRow(sampled),
    strandTexelsAtLod: strandTexels(sampled),
    gapShare: gapShare(plane),
  };
}
