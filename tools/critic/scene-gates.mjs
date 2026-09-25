#!/usr/bin/env node
//
// scene-gates.mjs — punch-list 11.7. CAN YOU STILL READ THE PERSON?
//
// 🔴 TWO OF THE FIVE CLAUSES ARE DEFECTIVE AS SHIPPED, FOUND BY AN ADVERSARY ON THE SAME DAY AND
// DECLARED HERE RATHER THAN LEFT FOR A LATER READER TO TRUST. Both are about the MATTE, which is
// the one input every masked clause shares, so neither is a tuning question.
//
//   🔴 L3 (silhouette separation) IS MEASURING A DITHER CLOUD, NOT A SILHOUETTE, on all five
//      interiors. The boundary it samples is a ~30 px speckled band floating ~100 px OUT IN THE
//      WALL, with the figure's real edge unsampled — read off `kitchen-overlay.png` and
//      `living-room-overlay.png` by opening them. So L3 goes RED on pictures where the subject is
//      plainly readable, which is exactly half of the brief this file was written against ("try to
//      make one fail on a picture where they clearly are"). Its reds on interiors are NOT evidence
//      about those scenes.
//   🔴 L4's DENOMINATOR IS THE CONTAMINATED MATTE, inflated 1.2140–1.2853× on the five interiors,
//      so it UNDER-REPORTS subject clipping by 15.2–22.2%. ⚠️ And the guard written to catch this
//      fires at a 90% matte share while the worst measured is 80.58% (`desk`) — **the clause
//      written to fix a denominator ships with a 28%-wrong denominator, under its own guard.**
//
// ⚠️ THE OTHER THREE ARE NEAR-INERT ON THIS CORPUS AND THAT IS ALSO A FINDING: L1, L2, L4 and L5
// are green on all nine scenes, and L1 reads 0.9907 GREEN on a deliberately blown arm where 42.30%
// of the subject is clipped to white. A gate that cannot go red on the corpus it was written for is
// not yet evidence about anything. What DID survive: every clause is genuinely a ratio, a rank or
// masked — no whole-frame mean was smuggled in, so this is not the ninth structurally blind
// statistic. The frame was right; the matte under it is not.
//
// ⏭️ The repair is the matte, once, for all five clauses — a real subject matte rather than one
// derived by thresholding a figure-hidden difference through a dithered transparency path. Until
// then, read L3's interior reds as UNKNOWN and L4's clipping share as a floor, not a value.
//
// ## 🚩 WHY THIS FILE EXISTS, IN THIS PROJECT'S OWN NUMBERS
//
// Every committed gate assumes the studio rig. Put the same figure outdoors and four of seven go
// red — and TWO OF THOSE REDS ARE THE GATE'S OWN FRAME rather than the scene's light
// (`docs/PUNCHLIST.md` 11.2):
//
//   * `park`'s G1 reads 0.5076 because `regions.lighting-portrait.json` hard-codes `faceKey` to the
//     STUDIO rig's right-hand key while park's sun is on the camera's LEFT (rig azimuth −58°).
//     Inverted, the same measurement is 1.9700 and inside G1's band. The gate read the ratio
//     backwards. **No amount of re-lighting repairs that.**
//   * `park`'s G6 reads 0.03613 because it is a black-point clause on a frame whose darkest 0.1%
//     is SKY. An exterior has no blacks in it; that is not a defect, it is an exterior.
//
// So a scene gate may not measure absolute pixel values against studio constants. It measures the
// one property that has to hold in a studio, on a beach and by candlelight alike: **can you still
// read the person?** `docs/research/scene-system.md` §7 names the five clauses; this file
// implements them, and where it departs from the doc the departure is argued in the clause.
//
// ## ⚠️ EVERY CLAUSE IS A RATIO, A RANK, OR MASKED — AND HERE IS WHY, CLAUSE BY CLAUSE
//
// This is not a style rule. Six of this project's eight structurally blind statistics were
// whole-frame means, and a scene system is exactly where a seventh gets written. Each clause below
// states the sentence that entitles it to be called scene-invariant. If a clause cannot say that
// sentence it is a studio gate wearing a scene hat and it does not belong here.
//
//   L1  face-in-frame position   (faceMedian − frameBlack) / (frameWhite − frameBlack), FLOOR ONLY
//       INVARIANT BECAUSE both endpoints come from the frame being measured. A candle frame and a
//       beach frame have wildly different absolute levels and the same question is asked of both:
//       where does the face sit inside the range THIS picture actually spends? It had a ceiling
//       until the control refuted it — the reason is in `BANDS.faceInFrame` and it is worth reading,
//       because it is a whole class of clause that misfires on any portrait against a dark ground.
//
//   L2  cheek:cheek across the face  median(brighter cheek band) / median(darker cheek band)
//       INVARIANT BECAUSE it is a ratio of two bands of the same mask in the same frame, and
//       BECAUSE THE BANDS ARE RANKED RATHER THAN NAMED. This is the repair for park's G1: the
//       gate never has to know which side the key is on, so it cannot read the ratio backwards.
//       Its floor is the one number here taken from a calibration rather than from a derivation,
//       and both calibration plates are named in `BANDS.keyToFill`.
//
//   L3  silhouette separation, PER SIDE, low-rank
//       INVARIANT BECAUSE Michelson contrast |a−b|/(a+b) across the figure's own edge is
//       dimensionless, and BECAUSE the statistic is a 10th percentile per side rather than a mean
//       over the outline. A mean over the whole outline is precisely the blind statistic this
//       project has shipped eight of — `--selftest` proves it goes green on a frame where one
//       whole side has vanished.
//
//   L4  clipping, MASKED TO THE SUBJECT, under G5's own share
//       INVARIANT BECAUSE it is a fraction of the subject's own pixels. G5 counts the whole image,
//       and on an exterior the whole image is mostly sky: a legitimately bright sky fails G5 while
//       a blown FACE hides inside it at 5% of the frame. Same threshold, different denominator.
//
//   L5  catchlight, per eye, against the eye's OWN median
//       INVARIANT BECAUSE p99.5(eye) / p50(eye) compares the eye to itself. `EyeCatchlight.js`
//       exists because a face without one is dead, and the thing that makes it a CATCHLIGHT rather
//       than a bright eye is that it is a small specular far above the rest of the aperture. The
//       aperture is a MATTE — see `buildEyePixels`, and see what happened when it was a projected
//       bounding box instead.
//
// ## 🎯 THE KEY-SIDE ASYMMETRY IS SOLVED, NOT DOCUMENTED — AND THE FRAME DECIDES
//
// Two ways to stop L2 reading backwards when the sun crosses the camera axis:
//
//   (a) take the region set from the scene's declared sun azimuth, or
//   (b) derive the key side FROM THE FRAME — the brighter half of the face is the key side.
//
// **This file does (b), and the choice is not a coin toss.** (a) only works for a scene that has a
// `sun`: `studio` has none, an interior's key is a window, and a candle is a `lights` entry. (a)
// also trusts a declaration rather than the picture — and this project's whole method is that a
// number in a description is a claim and the plate is the evidence. (b) needs nothing but pixels,
// so it holds for all twelve scenes in the corpus, for a scene an embedder writes by hand, and for
// a rig with no sun in it at all.
//
// (a) is still computed, from `report().scene.lighting.placements`, and printed as an INDEPENDENT
// AGREEMENT CHECK. Two derivations of one fact that never touch each other: if the brighter half of
// the face is not the half the key's rig azimuth points at, one of them is wrong and the run says
// so. On `park` the rig azimuth is −58° and the frame agrees the key is image-LEFT; on `beach` it
// is +46° and the frame agrees image-RIGHT. Same code, opposite answers, no region file edited.
//
// ## THE MASKS COME FROM THE RUNTIME, NOT FROM A NORMALISED RECT FILE
//
// `regions.lighting-portrait.json` is a table of fractions of a 900×1200 plate. That is what makes
// it studio-shaped: the rects encode where the studio key lands. Here the geometry is read off the
// figure itself in the page — the two eye-socket meshes give a midline and an inter-pupil distance,
// and every face dimension is stated in IPD. A mask in IPD is the same mask at any framing, any
// figure scale and any scene.
//
// The SUBJECT mask is a real matte, not a guess: the same frozen frame is rendered twice from two
// fresh page loads with `figure.root.visible` false in the second, and the subject is where they
// differ. `?freeze` plus a pinned `nodeFrame.frameId` makes the background bit-identical between
// the arms, so the matte's tolerance is a noise floor and not a colour heuristic.
//
// ## ⚠️ DISPLAY-REFERRED ON PURPOSE, AND IT IS THE ONE PLACE THIS FILE DIFFERS FROM ITS NEIGHBOURS
//
// `scene-probe.mjs` and `lightpath-probe.mjs` invert ACES + sRGB before summing, because they are
// decomposing light transport and transport is additive in linear radiance. **Legibility is not
// transport.** The question here is what a person looking at the screen can see, and what they see
// is code values after the curve. Inverting the curve would also throw away every clipped pixel,
// which is exactly the pixel L3 and L4 exist to count. So every statistic in this file is on
// ENCODED Rec.709 luma in 0..1, the same domain `measure.mjs` states for G5 and G6.
//
// ## ⚠️ WHAT THIS FILE DOES NOT MEASURE, SAID HERE RATHER THAN DISCOVERED LATER
//
//   * **Portrait framing only.** Every clause is about a face, and at body framing the ground comes
//     into shot — the figure's own cast shadow then moves between the two matte arms and joins the
//     matte at the feet. The component filter would keep it. Body framing needs a shadow-aware matte
//     and it is not written.
//   * **The plate `avatar-plate.html` builds is BALD.** No groom is requested, so L3's `top` side is
//     scalp against sky rather than hair against sky, and it is the easier case: hair is dark, a
//     bright scalp is not. A groom can only make `top` harder, never easier, so a `top` that is
//     already red is red for every groom — but a green `top` here is not a claim about `bob01`.
//   * **Hue-only separation is invisible to L3.** Michelson contrast is on LUMA, so a figure that
//     differs from its background only in colour reads as no separation at all. That is deliberate —
//     legibility at a glance is a luminance property — but it is a limit, not an oversight.
//
// ## Usage
//
//   node tools/critic/scene-gates.mjs --selftest
//   node tools/critic/scene-gates.mjs --url-base <origin+path-to-avatar-plate.html> \
//        --out captures/scene-gates --scene studio,beach,park
//   ... add --overlays to write the mask overlays that must be LOOKED at before a verdict is quoted.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { decodePng, encodePng } from './png.mjs';
import { GPU_FLAGS, codesAt, loadPlaywright } from './lightpath-probe.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const WIDTH = 900;
const HEIGHT = 1200;
const READY_TIMEOUT_MS = 180_000;

// --- the bands, and the derivation of every number in them ---------------------------------------
//
// 🚩 A BAND WITH NO DERIVATION IS A FITTED CONSTANT AND THIS PROJECT HAS SHIPPED ENOUGH OF THOSE.
// Each entry says what failure the edge is the boundary of, in the statistic's own units. None of
// them was chosen by running the three scenes and picking a number that let them through — the
// bands were written before the first scene was measured, and where a scene lands outside one the
// run is expected to argue scene-versus-gate rather than move the edge.

export const BANDS = Object.freeze({
  /**
   * L1. Where the face's midtone sits inside the frame's own black-to-white span.
   *
   * FLOOR 0.20 — below this the face's midtone is in the bottom fifth of everything the picture
   * contains: the frame is spending its range on something that is not the person, which is the
   * definition of a silhouette.
   *
   * 🔴 **THERE WAS A CEILING OF 0.90 AND THE CONTROL KILLED IT, WHICH IS WHAT A CONTROL IS FOR.**
   * The argument for it was "the face's midtone is within a tenth of the frame's own white, so half
   * the face is above it with nowhere to go, and L4 is about to fire." `studio` measured **0.8968
   * with L4 reading 0.000000** — no clipped subject pixel anywhere in the frame. The derivation is
   * simply wrong whenever the SUBJECT OWNS THE TOP OF THE RANGE, which is true of every portrait on
   * a dark ground: a studio on black, a candle, a night interior. There the frame's p99.5 IS the
   * face's own highlight, the ratio collapses to a face-internal median-to-highlight number around
   * 0.9, and it says nothing at all about headroom. Removed rather than raised — "too bright to
   * read" is clipping, L4 owns clipping, and it owns it with G5's own threshold and share.
   */
  faceInFrame: Object.freeze([0.20, Infinity]),

  /**
   * L2. Ratio of the two CHEEKS — the outer band of the face mask on each side of the midline,
   * brighter over darker.
   *
   * CEILING 4.00 — two stops. At more than two stops the shadow cheek sits below a quarter of the lit
   * cheek, which combined with L1's floor of 0.20 puts it in the bottom 5% of the frame's range:
   * half the face has left the picture. This is the clause that lets a scene be DRAMATIC — it is far
   * wider than G1's studio band of 1.43–2.00, on purpose, because a beach at noon is allowed to be
   * harder than a softbox. ⚠️ **THE CEILING IS DERIVED AND HAS NO MEASURED NULL.** Nothing in the
   * corpus comes near it — the widest reading so far is `park` at 1.2182 — so unlike the floor it has
   * never been proved to fire on a real plate. Stated so nobody quotes it as measured.
   * FLOOR 1.0847 — and it is the one number in this file that is CALIBRATED rather than reasoned,
   * because it is the one the punch list says to calibrate: *"`studio` is the calibration control
   * and must pass everything."* It is the geometric midpoint — equidistant in STOPS — between two
   * measured plates, both taken by this file, both pasted in the round note:
   *
   *     flat-lit null   `studio` + `?sceneover={"lights":{"key":{"azimuthDegrees":2}}}`   1.0270
   *     the control     `studio` as shipped                                              1.1456
   *     sqrt( 1.0270 x 1.1456 ) = sqrt( 1.176531 ) = 1.084680
   *
   * That is 0.0784 of a stop of headroom on each side, which is the maximum margin available between
   * a face with provably no directional light on it and the rig every committed number in this
   * project was measured on. A floor of 1.15 — the first guess, reasoned from "a fifth of a stop" —
   * put the CONTROL 0.0044 under it.
   *
   * ⚠️ **AND THE OBVIOUS WAY TO WIDEN THAT MARGIN WAS TRIED AND REFUTED.** The compression comes
   * from each band spanning the whole height of the face, so the natural fix is to keep only the
   * upper cheek. Measured on the same four plates, cheek bands restricted to the upper half of the
   * ellipse (`v` in −1..0) and to a narrow strip (−0.9..−0.3):
   *
   *     band        studio   beach    park     flat null   control:null separation
   *     full        1.1456   1.1570   1.2182   1.0270      1.1157x
   *     upper half  1.1245   1.1353   1.1814   1.0566      1.0643x
   *     strip       1.1159   1.1388   1.1826   1.0756      1.0375x
   *
   * Narrowing moves the null UP faster than it moves the control up, so it costs separation rather
   * than buying it. The full-height band is kept, and the 0.0784-stop margin is a STATED LIMIT of
   * this clause rather than a number to be improved by fiddling.
   *
   * 🔴 **THE OPERATOR WAS SPECIFIED WRONG FIRST AND THE CONTROL CAUGHT IT.** The first version took
   * the median of each WHOLE HALF of the face mask, and `studio` measured **1.1336 against this
   * floor of 1.15** — red, on the calibration control, whose designed key:fill is 1.7142 and whose
   * G1 reads 1.5635. The band was not the problem. Each half of a face contains its own terminator,
   * so a half-median averages lit skin with shadowed skin and compresses the very quantity the band
   * was derived about. The band is a claim about STOPS BETWEEN THE LIT AND SHADOWED SIDES; the
   * operator has to measure that quantity, so it now reads the outer band of each side — the two
   * cheeks, which is what G1's hand-placed rects were always looking at, taken from the figure's own
   * geometry instead of from a studio-shaped table.
   */
  keyToFill: Object.freeze([1.0847, 4.0]),

  /**
   * L2. Which part of the face mask is a "cheek": normalised distance along the eye axis from the
   * mask's centre, as a fraction of its half-width. 0.5 puts the inner edge outboard of the nose and
   * leaves the two bands non-overlapping by the whole width of the nose.
   */
  cheekBandFromCentre: 0.5,

  /**
   * How far the subject matte is eroded before the FACE mask is cut out of it, in pixels.
   *
   * ⚠️ NOT COSMETIC, AND `regions.lighting-portrait.json` LEARNED IT THE HARD WAY: its `faceShadow`
   * rect is "deliberately inboard of the silhouette: the rim's band is the outer ~9 px of that edge
   * and a patch further out would measure the rim, not the fill." A face mask that runs to the
   * silhouette measures the rim on the shadow side and reports it as fill — and on an exterior the
   * rim is a differently-coloured light. 10 px clears the measured 9.
   */
  faceMatteErosion: 10,

  /**
   * L3. 10th-percentile Michelson contrast across the figure's edge, PER SIDE.
   *
   * 0.05 — a Michelson contrast of 0.05 is a luminance step of 1.105× across the edge, about 0.14
   * of a stop. At a mid code of 128 that is 13 code values, an order of magnitude above the grade's
   * own grain and dither floor of ~1 code value, so an edge that clears it is an edge a viewer
   * resolves rather than one only a difference operator can find.
   * The statistic is the 10th percentile and not the mean: a side "separates" only if nearly all of
   * it does, and p10 lets a tenth of a side be lost to antialiasing without letting a fifth of it be
   * lost to a blown background.
   */
  sideSeparationP10: 0.05,

  /**
   * L4. Fraction of SUBJECT pixels above 0.99 encoded luma. G5's own threshold and share,
   * `measure.mjs` `TARGETS.clippedLumaThreshold` / `clippedFractionMax`, with the denominator
   * changed from the whole image to the subject.
   */
  clippedLuma: 0.99,
  subjectClippedFraction: 0.005,

  /**
   * L5. p99.5 over p50 of one eye's cornea pixels.
   *
   * 1.50 — a catchlight is a specular reflection of a source that is orders of magnitude brighter
   * than the diffuse iris under it, so a real one lands at 2–5× the cornea's own median even after
   * the tone curve has compressed it. 1.50 is the floor below which what is being measured is a
   * gradient across a wet-looking eyeball rather than the image of a panel. Both eyes must clear it:
   * one catchlight and one dead eye is the uncanniest of all the failures this can find.
   */
  catchlightPeakOverMedian: 1.5,
});

/** Face-mask geometry, every dimension in INTER-PUPIL DISTANCES so the mask is framing-invariant. */
export const FACE_IN_IPD = Object.freeze({
  /** How far below the eye line the mask's centre sits. Puts the top edge under the lower lids. */
  centreBelowEyeLine: 0.75,
  /** Half-width across the face, along the eye-to-eye axis. Inboard of the jaw silhouette. */
  halfWidth: 0.72,
  /** Half-height. 0.55 keeps the brows and the hairline out and reaches the chin. */
  halfHeight: 0.55,
});

// --- pure statistics, all exported because all of them are what `--selftest` points at ------------

/** Encoded Rec.709 luma in 0..1 from 8-bit codes. The domain every clause in this file is stated in. */
export function encodedLuma([r, g, b]) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Nearest-rank percentile over an ASCENDING sorted array.
 *
 * Nearest-rank and not interpolated, deliberately: it returns a value that is actually present in
 * the data, so a selftest's expected answer is a number that was painted rather than a number that
 * came out of a weighted average of two of them.
 */
export function percentile(sortedAscending, p) {
  const n = sortedAscending.length;
  if (n === 0) return Number.NaN;
  const index = Math.min(n - 1, Math.max(0, Math.ceil(p * n) - 1));
  return sortedAscending[index];
}

/** Luma values over a pixel-index list, sorted ascending — the input every rank clause reads. */
export function sortedLuma(png, pixelSet) {
  const out = new Float64Array(pixelSet.length);
  for (let i = 0; i < pixelSet.length; i += 1) out[i] = encodedLuma(codesAt(png, pixelSet[i] * 4));
  return out.sort();
}

/** Luma over every pixel of a plate, sorted ascending. Used ONLY for the frame's own black/white. */
export function sortedFrameLuma(png) {
  const n = png.width * png.height;
  const out = new Float64Array(n);
  for (let k = 0; k < n; k += 1) out[k] = encodedLuma(codesAt(png, k * 4));
  return out.sort();
}

/**
 * The subject matte: where two arms of the SAME frozen frame differ, one of them with the figure
 * hidden.
 *
 * `tolerance` is in code values and is a noise floor rather than a colour threshold — with
 * `?freeze` and a pinned `nodeFrame.frameId` the two arms are bit-identical everywhere the figure
 * is not, so anything above the dither is the figure.
 */
export function buildSubjectMask(lit, background, tolerance = 2) {
  const w = lit.width;
  const h = lit.height;
  const mask = new Uint8Array(w * h);
  let hits = 0;
  for (let k = 0; k < w * h; k += 1) {
    const a = codesAt(lit, k * 4);
    const b = codesAt(background, k * 4);
    const delta = Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
    if (delta > tolerance) {
      mask[k] = 1;
      hits += 1;
    }
  }
  return { mask, hits };
}

/**
 * The largest 4-connected component of a mask, and nothing else.
 *
 * ⚠️ NOT COSMETIC. A figure's own cast shadow on the ground moves when the figure is hidden, so the
 * raw difference includes it; so does any stray dither that cleared the tolerance. Both are joined
 * to nothing, or joined to the floor rather than to the head. Keeping one component makes the mask
 * a FIGURE and lets the run report how much was discarded, which is the number that says whether
 * the framing put ground in shot.
 */
export function largestComponent(mask, w, h) {
  const label = new Int32Array(w * h).fill(-1);
  const queue = new Int32Array(w * h);
  let best = null;
  let bestSize = 0;
  let components = 0;
  for (let seed = 0; seed < w * h; seed += 1) {
    if (mask[seed] === 0 || label[seed] !== -1) continue;
    const id = components;
    components += 1;
    let head = 0;
    let tail = 0;
    queue[tail] = seed;
    tail += 1;
    label[seed] = id;
    let size = 0;
    while (head < tail) {
      const k = queue[head];
      head += 1;
      size += 1;
      const x = k % w;
      const y = (k - x) / w;
      if (x > 0 && mask[k - 1] === 1 && label[k - 1] === -1) { label[k - 1] = id; queue[tail] = k - 1; tail += 1; }
      if (x < w - 1 && mask[k + 1] === 1 && label[k + 1] === -1) { label[k + 1] = id; queue[tail] = k + 1; tail += 1; }
      if (y > 0 && mask[k - w] === 1 && label[k - w] === -1) { label[k - w] = id; queue[tail] = k - w; tail += 1; }
      if (y < h - 1 && mask[k + w] === 1 && label[k + w] === -1) { label[k + w] = id; queue[tail] = k + w; tail += 1; }
    }
    if (size > bestSize) { bestSize = size; best = id; }
  }
  const kept = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k += 1) if (label[k] === best) kept[k] = 1;
  return { mask: kept, size: bestSize, components };
}

/** Mask pixels with at least one 4-neighbour outside the mask, away from the image border. */
export function boundaryPixels(mask, w, h, border = 2) {
  const out = [];
  for (let y = border; y < h - border; y += 1) {
    for (let x = border; x < w - border; x += 1) {
      const k = y * w + x;
      if (mask[k] === 0) continue;
      if (mask[k - 1] === 0 || mask[k + 1] === 0 || mask[k - w] === 0 || mask[k + w] === 0) out.push(k);
    }
  }
  return out;
}

/**
 * The OUTWARD normal at a boundary pixel: the direction of the background's centroid inside a disc.
 *
 * A disc rather than a 3×3 Sobel because a one-pixel operator on an antialiased edge points at the
 * antialiasing. Radius 5 averages over enough of the outline to name a side and not so much that a
 * jaw and a shoulder get the same answer.
 */
export function outwardNormal(mask, w, h, x, y, radius = 5) {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const px = x + dx;
      const py = y + dy;
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      if (mask[py * w + px] === 1) continue;
      sx += dx;
      sy += dy;
      n += 1;
    }
  }
  if (n === 0) return null;
  const length = Math.hypot(sx, sy);
  if (length < 1e-9) return null;
  return [sx / length, sy / length];
}

/** Four sectors of 90°, in IMAGE coordinates — y runs down, so a normal with ny<0 points at the sky. */
export function sideOf([nx, ny]) {
  if (Math.abs(nx) >= Math.abs(ny)) return nx >= 0 ? 'right' : 'left';
  return ny >= 0 ? 'bottom' : 'top';
}

/**
 * Michelson contrast across one boundary pixel, sampled `reach` px inside and outside along the
 * normal. `null` when either sample lands on the wrong side of the matte — a hair-thin feature or a
 * concavity — because a sample that crossed back over the edge measures nothing.
 */
export function separationAt(png, mask, w, h, x, y, normal, reach = 4) {
  const ix = Math.round(x - normal[0] * reach);
  const iy = Math.round(y - normal[1] * reach);
  const ox = Math.round(x + normal[0] * reach);
  const oy = Math.round(y + normal[1] * reach);
  if (ix < 0 || iy < 0 || ix >= w || iy >= h) return null;
  if (ox < 0 || oy < 0 || ox >= w || oy >= h) return null;
  if (mask[iy * w + ix] !== 1) return null;
  if (mask[oy * w + ox] !== 0) return null;
  const inside = encodedLuma(codesAt(png, (iy * w + ix) * 4));
  const outside = encodedLuma(codesAt(png, (oy * w + ox) * 4));
  const sum = inside + outside;
  return sum <= 0 ? 0 : Math.abs(inside - outside) / sum;
}

/** Every boundary pixel's separation, bucketed by side, plus the ⚠️ whole-outline pool. */
export function silhouetteSeparation(png, mask, w, h, options = {}) {
  const radius = options.radius ?? 5;
  const reach = options.reach ?? 4;
  const bySide = { left: [], right: [], top: [], bottom: [] };
  const all = [];
  let skipped = 0;
  for (const k of boundaryPixels(mask, w, h)) {
    const x = k % w;
    const y = (k - x) / w;
    const normal = outwardNormal(mask, w, h, x, y, radius);
    if (normal === null) { skipped += 1; continue; }
    const value = separationAt(png, mask, w, h, x, y, normal, reach);
    if (value === null) { skipped += 1; continue; }
    bySide[sideOf(normal)].push(value);
    all.push(value);
  }
  const summary = {};
  for (const [side, values] of Object.entries(bySide)) {
    const sorted = Float64Array.from(values).sort();
    summary[side] = {
      count: values.length,
      p10: values.length === 0 ? Number.NaN : percentile(sorted, 0.1),
      median: values.length === 0 ? Number.NaN : percentile(sorted, 0.5),
    };
  }
  const allSorted = Float64Array.from(all).sort();
  return {
    bySide: summary,
    skipped,
    outlineMean: all.length === 0 ? Number.NaN : all.reduce((a, b) => a + b, 0) / all.length,
    outlineP10: all.length === 0 ? Number.NaN : percentile(allSorted, 0.1),
    total: all.length,
  };
}

// --- the five clauses -----------------------------------------------------------------------------

const band = (value, [low, high]) => (Number.isFinite(value) && value >= low && value <= high ? 'PASS' : 'FAIL');

/** L1 — where the face's midtone sits inside the frame's own black-to-white span. */
export function clauseFaceInFrame(litPng, facePixels) {
  const frame = sortedFrameLuma(litPng);
  const frameBlack = percentile(frame, 0.005);
  const frameWhite = percentile(frame, 0.995);
  const face = sortedLuma(litPng, facePixels);
  const faceMedian = percentile(face, 0.5);
  const span = frameWhite - frameBlack;
  const value = span <= 0 ? Number.NaN : (faceMedian - frameBlack) / span;
  return {
    id: 'L1',
    name: 'face sits inside the frame\'s own range',
    value,
    band: BANDS.faceInFrame,
    status: band(value, BANDS.faceInFrame),
    detail: { faceMedian, frameBlack, frameWhite, facePixels: facePixels.length },
  };
}

/**
 * L2 — key:fill across the face, with the key side RANKED out of the frame rather than named.
 *
 * `axis` is the projected eye-to-eye direction; a pixel's signed distance along it from the eye
 * midpoint is which half of the face it is on. Taking the brighter half as the numerator is what
 * makes this clause immune to the sun crossing the camera axis.
 */
export function clauseKeyToFill(litPng, face, geometry) {
  const { cx, cy, a } = face.ellipse;
  const [ax, ay] = geometry.faceAxis;
  const w = litPng.width;
  const inner = BANDS.cheekBandFromCentre;
  const positive = [];
  const negative = [];
  for (const k of face.pixels) {
    const x = k % w;
    const y = (k - x) / w;
    const u = ((x - cx) * ax + (y - cy) * ay) / a;
    if (u > inner) positive.push(k);
    else if (u < -inner) negative.push(k);
  }
  const positiveMedian = positive.length === 0 ? Number.NaN : percentile(sortedLuma(litPng, positive), 0.5);
  const negativeMedian = negative.length === 0 ? Number.NaN : percentile(sortedLuma(litPng, negative), 0.5);
  // `axis` points from the character's RIGHT eye to their LEFT eye, i.e. toward image right. The
  // key side is RANKED out of these two numbers and never named — that is the whole clause.
  const keySide = positiveMedian >= negativeMedian ? 'right' : 'left';
  const bright = Math.max(positiveMedian, negativeMedian);
  const dark = Math.min(positiveMedian, negativeMedian);
  const value = dark <= 0 ? Number.NaN : bright / dark;
  return {
    id: 'L2',
    name: 'cheek:cheek inside a legibility band',
    value,
    band: BANDS.keyToFill,
    status: band(value, BANDS.keyToFill),
    detail: {
      keySideFromFrame: keySide,
      imageRightMedian: positiveMedian,
      imageLeftMedian: negativeMedian,
      imageRightPixels: positive.length,
      imageLeftPixels: negative.length,
    },
  };
}

/** L3 — silhouette separation on EVERY side, p10 per side, with the outline mean as the ⚠️ control. */
export function clauseSilhouette(litPng, subjectMask, sides = ['left', 'right', 'top']) {
  const separation = silhouetteSeparation(litPng, subjectMask, litPng.width, litPng.height);
  const failed = sides.filter((side) => {
    const entry = separation.bySide[side];
    return entry.count === 0 || !(entry.p10 >= BANDS.sideSeparationP10);
  });
  const worst = sides.reduce(
    (acc, side) => (separation.bySide[side].p10 < acc.p10 ? { side, p10: separation.bySide[side].p10 } : acc),
    { side: null, p10: Infinity }
  );
  return {
    id: 'L3',
    name: 'silhouette separates on every side',
    value: worst.p10,
    band: [BANDS.sideSeparationP10, Infinity],
    status: failed.length === 0 ? 'PASS' : 'FAIL',
    detail: { sidesTested: sides, failed, worstSide: worst.side, separation },
  };
}

/** L4 — clipping under G5's share, masked to the subject, with the whole frame as the ⚠️ control. */
export function clauseClipping(litPng, subjectPixels) {
  const n = litPng.width * litPng.height;
  let subjectClipped = 0;
  for (const k of subjectPixels) if (encodedLuma(codesAt(litPng, k * 4)) > BANDS.clippedLuma) subjectClipped += 1;
  let frameClipped = 0;
  for (let k = 0; k < n; k += 1) if (encodedLuma(codesAt(litPng, k * 4)) > BANDS.clippedLuma) frameClipped += 1;
  const value = subjectClipped / subjectPixels.length;
  return {
    id: 'L4',
    name: 'subject clipping under G5\'s share',
    value,
    band: [0, BANDS.subjectClippedFraction],
    status: value < BANDS.subjectClippedFraction ? 'PASS' : 'FAIL',
    detail: {
      subjectClipped,
      subjectPixels: subjectPixels.length,
      frameClippedFraction: frameClipped / n,
      frameClipped,
    },
  };
}

/** L5 — a catchlight in BOTH eyes, each measured against its own cornea's median. */
export function clauseCatchlight(litPng, eyePixels) {
  const perEye = {};
  let worst = Infinity;
  for (const [eye, pixels] of Object.entries(eyePixels)) {
    if (pixels.length < 20) {
      perEye[eye] = { pixels: pixels.length, ratio: Number.NaN, note: 'too few eye pixels to report' };
      worst = Number.NaN;
      continue;
    }
    const sorted = sortedLuma(litPng, pixels);
    const median = percentile(sorted, 0.5);
    const peak = percentile(sorted, 0.995);
    const ratio = median <= 0 ? Number.NaN : peak / median;
    perEye[eye] = { pixels: pixels.length, median, peak, ratio };
    if (!(ratio >= worst)) worst = ratio;
  }
  return {
    id: 'L5',
    name: 'a catchlight in every eye',
    value: worst,
    band: [BANDS.catchlightPeakOverMedian, Infinity],
    status: Number.isFinite(worst) && worst >= BANDS.catchlightPeakOverMedian ? 'PASS' : 'FAIL',
    detail: { perEye },
  };
}

// --- masks built from the runtime geometry --------------------------------------------------------

/**
 * Binary erosion by a square of half-width `radius`, done separably in two passes.
 *
 * Square rather than a disc, and separable rather than a window: two O(n·r) passes instead of one
 * O(n·r²), and the difference between a square and a disc at r=10 on a jaw edge is under a pixel.
 */
export function erodeMask(mask, w, h, radius) {
  const pass = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let keep = 1;
      for (let d = -radius; d <= radius && keep === 1; d += 1) {
        const px = x + d;
        if (px < 0 || px >= w || mask[y * w + px] === 0) keep = 0;
      }
      pass[y * w + x] = keep;
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let keep = 1;
      for (let d = -radius; d <= radius && keep === 1; d += 1) {
        const py = y + d;
        if (py < 0 || py >= h || pass[py * w + x] === 0) keep = 0;
      }
      out[y * w + x] = keep;
    }
  }
  return out;
}

/** The face mask: an ellipse in IPD units, intersected with the ERODED subject matte. */
export function buildFacePixels(geometry, subjectMask, w, h) {
  const [ax, ay] = geometry.faceAxis;
  const [px, py] = [-ay, ax];
  const d = geometry.ipdPixels;
  const [mx, my] = geometry.eyeMidpoint;
  const cx = mx + px * d * FACE_IN_IPD.centreBelowEyeLine;
  const cy = my + py * d * FACE_IN_IPD.centreBelowEyeLine;
  const a = d * FACE_IN_IPD.halfWidth;
  const b = d * FACE_IN_IPD.halfHeight;
  const pixels = [];
  let outsideMatte = 0;
  const reach = Math.ceil(Math.max(a, b)) + 2;
  for (let y = Math.max(0, Math.floor(cy - reach)); y < Math.min(h, Math.ceil(cy + reach)); y += 1) {
    for (let x = Math.max(0, Math.floor(cx - reach)); x < Math.min(w, Math.ceil(cx + reach)); x += 1) {
      const u = ((x - cx) * ax + (y - cy) * ay) / a;
      const v = ((x - cx) * px + (y - cy) * py) / b;
      if (u * u + v * v > 1) continue;
      if (subjectMask[y * w + x] === 0) { outsideMatte += 1; continue; }
      pixels.push(y * w + x);
    }
  }
  return { pixels, outsideMatte, ellipse: { cx, cy, a, b, axis: [ax, ay] } };
}

/**
 * The two largest 4-connected components of a mask, as pixel-index lists.
 *
 * Used for the eye aperture, where "the two biggest blobs" is the whole selection rule: the eyeball
 * matte has exactly two real components and whatever dither cleared the tolerance.
 */
export function topComponents(mask, w, h, count) {
  const label = new Int32Array(w * h).fill(-1);
  const queue = new Int32Array(w * h);
  const sizes = [];
  let next = 0;
  for (let seed = 0; seed < w * h; seed += 1) {
    if (mask[seed] === 0 || label[seed] !== -1) continue;
    const id = next;
    next += 1;
    let head = 0;
    let tail = 0;
    queue[tail] = seed;
    tail += 1;
    label[seed] = id;
    let size = 0;
    while (head < tail) {
      const k = queue[head];
      head += 1;
      size += 1;
      const x = k % w;
      const y = (k - x) / w;
      if (x > 0 && mask[k - 1] === 1 && label[k - 1] === -1) { label[k - 1] = id; queue[tail] = k - 1; tail += 1; }
      if (x < w - 1 && mask[k + 1] === 1 && label[k + 1] === -1) { label[k + 1] = id; queue[tail] = k + 1; tail += 1; }
      if (y > 0 && mask[k - w] === 1 && label[k - w] === -1) { label[k - w] = id; queue[tail] = k - w; tail += 1; }
      if (y < h - 1 && mask[k + w] === 1 && label[k + w] === -1) { label[k + w] = id; queue[tail] = k + w; tail += 1; }
    }
    sizes.push({ id, size });
  }
  sizes.sort((a, b) => b.size - a.size);
  const wanted = new Map(sizes.slice(0, count).map((entry, rank) => [entry.id, rank]));
  const out = Array.from({ length: Math.min(count, sizes.length) }, () => []);
  for (let k = 0; k < w * h; k += 1) {
    const rank = wanted.get(label[k]);
    if (rank !== undefined) out[rank].push(k);
  }
  return { groups: out, componentCount: sizes.length };
}

/**
 * The VISIBLE eye aperture per eye, as a matte rather than as a projected bounding box.
 *
 * 🚩 THE PROJECTED CORNEA WAS TRIED FIRST AND LOOKING AT THE OVERLAY IS WHAT REFUTED IT. The
 * `Humancornea` mesh is a full eyeball surface, not a visible cap, so the bounding box of its
 * skinned projected vertices came out **8274 px per eye** — a disc about 97 px across, where
 * `regions.lighting-portrait.json` measures the eye itself at 40 px. Two thirds of that box is
 * EYELID, and eyelid is lit skin, so the median it dragged up was face skin and the catchlight was
 * being compared against the wrong thing.
 *
 * The aperture is therefore measured the same way the subject is: one more arm of the same frozen
 * frame with the two eyeball meshes hidden, and the eye is where the two plates differ. That is the
 * region the lids actually leave open, with no anatomical constant in it.
 */
export function buildEyePixels(lit, eyesHidden, geometry, tolerance = 2) {
  const w = lit.width;
  const h = lit.height;
  const { mask, hits } = buildSubjectMask(lit, eyesHidden, tolerance);
  const { groups, componentCount } = topComponents(mask, w, h, 2);
  const [ax, ay] = geometry.faceAxis;
  const [mx, my] = geometry.eyeMidpoint;
  const out = { left: [], right: [] };
  for (const group of groups) {
    if (group.length === 0) continue;
    let sx = 0;
    let sy = 0;
    for (const k of group) { const x = k % w; sx += x; sy += (k - x) / w; }
    const t = (sx / group.length - mx) * ax + (sy / group.length - my) * ay;
    // `.left` is the CHARACTER's left eye, which is on image RIGHT — the axis's positive direction.
    out[t >= 0 ? 'left' : 'right'] = group;
  }
  return { perEye: out, rawHits: hits, componentCount };
}

// --- the browser side ------------------------------------------------------------------------------

/**
 * The geometry the masks are built from, read off the figure in the page.
 *
 * `eyeOcclusion.left` / `.right` are unskinned socket meshes parented into the head, so their world
 * bounding boxes are trustworthy and give the midline and the IPD. The cornea IS skinned, so its
 * bind-pose bounding box is not — its vertices are read through `getVertexPosition`, which applies
 * the bone transform, and the result is checked against the socket box before it is used.
 */
/**
 * The two meshes that ARE the eyeball. Declared here for the reader; the two `page.evaluate` bodies
 * below repeat the literal because an evaluated function is serialised to the page and closes over
 * nothing in this module.
 */
export const EYEBALL_MESH_NAMES = /^Human(high-poly|cornea)$/;

const READ_GEOMETRY = () => {
  const avatar = globalThis.avatar;
  const camera = avatar.stage.camera;
  const W = 900;
  const H = 1200;
  const Vector = avatar.figure.root.position.constructor;
  const project = (v) => {
    const p = v.clone().project(camera);
    return [(p.x * 0.5 + 0.5) * W, (1 - (p.y * 0.5 + 0.5)) * H];
  };

  const meshes = {};
  avatar.figure.root.traverse((o) => { if (o.isMesh) meshes[o.name] = o; });

  const socketBox = (name) => {
    const mesh = meshes[name];
    if (mesh === undefined) return null;
    mesh.updateWorldMatrix(true, false);
    if (mesh.geometry.boundingBox === null) mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    const xs = [];
    const ys = [];
    for (const x of [bb.min.x, bb.max.x]) {
      for (const y of [bb.min.y, bb.max.y]) {
        for (const z of [bb.min.z, bb.max.z]) {
          const [px, py] = project(new Vector(x, y, z).applyMatrix4(mesh.matrixWorld));
          xs.push(px);
          ys.push(py);
        }
      }
    }
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  };

  // `.left` / `.right` are the CHARACTER's sides. The character's left eye is on image RIGHT.
  const right = socketBox('eyeOcclusion.right');
  const left = socketBox('eyeOcclusion.left');
  if (right === null || left === null) throw new Error('scene-gates: no eyeOcclusion meshes on this figure');
  const centre = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  const characterRightEye = centre(right);
  const characterLeftEye = centre(left);

  const dx = characterLeftEye[0] - characterRightEye[0];
  const dy = characterLeftEye[1] - characterRightEye[1];
  const ipd = Math.hypot(dx, dy);

  return {
    ipdPixels: ipd,
    eyeMidpoint: [(characterLeftEye[0] + characterRightEye[0]) / 2, (characterLeftEye[1] + characterRightEye[1]) / 2],
    faceAxis: [dx / ipd, dy / ipd],
    socketBoxes: { left, right },
    eyeballMeshes: Object.keys(meshes).filter((name) => /^Human(high-poly|cornea)$/.test(name)),
    report: avatar.report(),
  };
};

async function arm(browser, urlBase, query, file, { hideFigure = false, hideEyes = false, readGeometry = false, geometryMask = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${urlBase}?${query}&freeze&seed=1&capture`, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => typeof globalThis.__SUGATA_STEP__ === 'function', null, {
      timeout: READY_TIMEOUT_MS,
      polling: 200,
    });
  } catch (error) {
    const shown = await page.evaluate(() => document.getElementById('failure')?.textContent ?? '');
    throw new Error(`page never came up: ${shown || error.message}`);
  }
  if (hideFigure) await page.evaluate(() => { globalThis.avatar.figure.root.visible = false; });
  if (hideEyes) {
    await page.evaluate(() => {
      globalThis.avatar.figure.root.traverse((o) => {
        if (o.isMesh === true && /^Human(high-poly|cornea)$/.test(o.name)) o.visible = false;
      });
    });
  }
  await page.evaluate(() => globalThis.__SUGATA_STEP__(1 / 60));
  // 🚩 AFTER THE STEP, AND THE ORDER IS NOT A DETAIL. Read before it, the eye sockets project to
  // an eye midpoint at x = −320.8 and an IPD of 211.2 px — the camera and the skinned matrices have
  // not been committed for this frame yet, so the geometry describes a picture that was never
  // drawn. Measured: same code, same page, 293.1/147.9 for the two eye centres after the step and a
  // midpoint off the left of the canvas before it.
  const geometry = readGeometry ? await page.evaluate(READ_GEOMETRY) : null;
  if (geometryMask) await page.evaluate(() => globalThis.__SUGATA_GEOMETRY_MASK__());
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, animations: 'disabled' });
  await context.close();
  if (errors.length > 0) console.warn(`  ⚠️ page errors: ${errors.join(' | ')}`);
  return { file, geometry, png: decodePng(fs.readFileSync(file)) };
}

/**
 * The overlay that has to be LOOKED at before any verdict from this file is quoted.
 *
 * Two rounds running on this project the numbers were right and the picture was wrong. A mask that
 * has not been opened is a mask nobody has checked, so `--overlays` is not optional in practice
 * even though the code will run without it.
 */
function writeOverlay(litPng, subjectMask, face, eyePixels, geometry, target) {
  const w = litPng.width;
  const h = litPng.height;
  const rgba = Buffer.alloc(w * h * 4);
  for (let k = 0; k < w * h; k += 1) {
    rgba[k * 4] = Math.round(litPng.pixels[k * 4] * 255);
    rgba[k * 4 + 1] = Math.round(litPng.pixels[k * 4 + 1] * 255);
    rgba[k * 4 + 2] = Math.round(litPng.pixels[k * 4 + 2] * 255);
    rgba[k * 4 + 3] = 255;
  }
  const paint = (k, colour, blend = 0.55) => {
    for (let c = 0; c < 3; c += 1) rgba[k * 4 + c] = Math.round(rgba[k * 4 + c] * (1 - blend) + colour[c] * blend);
  };
  // The silhouette, coloured by the side it was assigned to — this is what proves the sectors.
  const sideColours = { left: [255, 64, 64], right: [64, 160, 255], top: [255, 220, 0], bottom: [140, 140, 140] };
  for (const k of boundaryPixels(subjectMask, w, h)) {
    const x = k % w;
    const y = (k - x) / w;
    const normal = outwardNormal(subjectMask, w, h, x, y, 5);
    if (normal === null) continue;
    paint(k, sideColours[sideOf(normal)], 0.95);
  }
  // The face mask in green, and the two CHEEK bands L2 actually ranks in a stronger green — a
  // reader has to be able to see that the bands are cheeks and that the nose is in neither of them.
  const { cx, cy, a } = face.ellipse;
  const [fx, fy] = geometry.faceAxis;
  for (const k of face.pixels) {
    const x = k % w;
    const y = (k - x) / w;
    const u = ((x - cx) * fx + (y - cy) * fy) / a;
    paint(k, [0, 255, 120], Math.abs(u) > BANDS.cheekBandFromCentre ? 0.55 : 0.18);
  }
  for (const pixels of Object.values(eyePixels)) for (const k of pixels) paint(k, [255, 0, 255], 0.8);
  // The eye midpoint and the split line L2 ranks its halves about.
  const [ax, ay] = geometry.faceAxis;
  const [mx, my] = geometry.eyeMidpoint;
  for (let t = -Math.round(geometry.ipdPixels * 1.4); t <= Math.round(geometry.ipdPixels * 1.4); t += 1) {
    const x = Math.round(mx - ay * t);
    const y = Math.round(my + ax * t);
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    paint(y * w + x, [255, 255, 255], 0.9);
  }
  fs.writeFileSync(target, encodePng(w, h, rgba));
  console.log(`    overlay -> ${target}`);
}

// --- the run ----------------------------------------------------------------------------------------

/**
 * 🔴 THE RED SET, AND IT IS THE ITEM'S OWN GATE: *"each clause goes red on a deliberately unreadable
 * scene, pasted."*
 *
 * ⚠️ **NOT ONE OF THESE EDITS A SCENE.** Every arm is `?sceneover=<json>` on top of a SHIPPED scene,
 * merged in the page by `avatar-plate.html`'s own resolver — the same defect-injection idiom `?noenv`
 * and `?noenvground` are. `SCENES` is not touched, so a scene cannot be quietly bent to make a gate
 * pass and the red proofs cannot rot the corpus.
 */
const RED_INJECTIONS = Object.freeze([
  {
    label: 'RED-L1-silhouetted',
    scene: 'beach',
    // Every analytic light down to 2%, and the image-based light removed, against the same sky. The
    // subject falls to the bottom of a frame whose range is still being spent on the sky: L1's
    // definition of a silhouette.
    extra: `&noenv&sceneover=${encodeURIComponent(JSON.stringify({
      scales: { key: { irradiance: 0.02 }, fill: { irradiance: 0.02 }, rim: { irradiance: 0.02 }, kicker: { irradiance: 0.02 } },
    }))}`,
  },
  {
    label: 'RED-L2-flat',
    scene: 'studio',
    // The key swung onto the camera axis. ⚠️ NOT "the fill raised until it swamps the key" — that was
    // tried and it is a worse injection: at `scales.fill.irradiance` 6 the fill spills onto the
    // BACKDROP CARD, the figure-hidden arm then differs over the whole frame, and the subject matte
    // comes back as 1 080 000 px — 100.00% of the plate. Moving the key's AZIMUTH changes no
    // irradiance anywhere, so the matte survives and only the modelling on the face goes.
    extra: `&sceneover=${encodeURIComponent(JSON.stringify({ lights: { key: { azimuthDegrees: 2 } } }))}`,
  },
  {
    label: 'RED-L4-blown',
    scene: 'studio',
    // `exposure` is range-checked at [0.25, 4] by `Avatar.resolveLightingOption` (6 is refused in
    // words), so the ceiling is taken and the key carries the rest.
    //
    // 🚩 **AND THIS ARM IS ALSO WHERE THE MATTE'S OWN LIMIT WAS MEASURED, WHICH IS WHY IT IS THE ONE
    // KEPT.** A difference matte cannot survive a GLOBAL VEIL: the grade's bloom spreads the blown
    // figure over the whole plate, every background pixel moves by more than the 2-code tolerance,
    // and the subject mask comes back as 1 080 000 px — 100.00%. Both weaker injections were tried:
    // `scales.key.irradiance` 4 alone floods the matte the same way AND does not clip (subject
    // 0.000001), because the tone curve holds a 4x key; `scales.fill.irradiance` 6 floods it too.
    // So L4's REAL-PLATE red is quoted from this arm's VALUE — 0.4230 of the subject's pixels above
    // 0.99 luma — while its status is reported INVALID, because with a degenerate mask the clause
    // has collapsed into G5 and is no longer the thing it claims to be. The masking half of L4 is
    // proved in `--selftest`, by arithmetic, on 80 pixels that are 2.00% of a subject and 0.40% of a
    // frame.
    extra: `&sceneover=${encodeURIComponent(JSON.stringify({ exposure: 4, scales: { key: { irradiance: 4 } } }))}`,
  },
]);

// --- the run body -------------------------------------------------------------------------------------

/** The key side the SCENE declares, from the rig placement. Printed as an agreement check only. */
function declaredKeySide(report) {
  const key = report?.scene?.lighting?.placements?.find((p) => p.name === 'key') ?? null;
  if (key === null) return { side: null, azimuth: null };
  // `LightingRig` azimuth is measured from the camera, positive toward image RIGHT — the convention
  // `regions.lighting-portrait.json` states for the studio key at +42.
  const a = key.azimuthDegrees;
  if (Math.abs(a) < 1e-6 || Math.abs(Math.abs(a) - 180) < 1e-6) return { side: 'axial', azimuth: a };
  return { side: a > 0 ? 'right' : 'left', azimuth: a };
}

async function runScene(browser, urlBase, out, scene, { overlays, label = scene, extra = '' }) {
  const query = `scene=${scene}&frame=portrait${extra}`;
  const lit = await arm(browser, urlBase, query, `${out}/${label}-lit.png`, { readGeometry: true });
  const bg = await arm(browser, urlBase, query, `${out}/${label}-matte.png`, { geometryMask: true });
  const noEyes = await arm(browser, urlBase, query, `${out}/${label}-noeyes.png`, { hideEyes: true });

  const w = lit.png.width;
  const h = lit.png.height;
  // An ID pass counts visible geometry. Bloom and changing background light cannot join the mask.
  const raw = { mask: Uint8Array.from({ length: w * h }, (_, k) =>
    Math.max(...bg.png.pixels.slice(k * 4, k * 4 + 3)) > 0.5 ? 1 : 0) };
  const component = largestComponent(raw.mask, w, h);
  const subjectPixels = [];
  for (let k = 0; k < w * h; k += 1) if (component.mask[k] === 1) subjectPixels.push(k);
  // L1 and L2 read the FACE, and the outer band of the silhouette belongs to the rim (L3's clause,
  // and `regions.lighting-portrait.json`'s measured 9 px). L3 and L4 use the unereoded matte.
  const faceMatte = erodeMask(component.mask, w, h, BANDS.faceMatteErosion);

  // 🚩 THE MATTE IS AN INSTRUMENT AND IT CAN BREAK. If the figure-hidden arm differs from the lit one
  // over most of the frame, the difference is no longer "the figure" — a light that reaches the
  // backdrop moves when the figure does, and the matte swallows the whole plate. Measured: a
  // `scales.fill.irradiance` 6 injection returns 1 080 000 px, 100.00%. Said out loud, because every
  // clause downstream would otherwise report a confident number about a mask that is the whole image.
  const matteShare = component.size / (w * h);
  const matteSuspect = matteShare > 0.9;

  const geometry = lit.geometry;
  const face = buildFacePixels(geometry, faceMatte, w, h);
  const eyes = buildEyePixels(lit.png, noEyes.png, geometry);

  const clauses = [
    clauseFaceInFrame(lit.png, face.pixels),
    clauseKeyToFill(lit.png, face, geometry),
    clauseSilhouette(lit.png, component.mask),
    clauseClipping(lit.png, subjectPixels),
    clauseCatchlight(lit.png, eyes.perEye),
  ];

  // 🚩 A CLAUSE WHOSE MASK IS BROKEN REPORTS **INVALID**, NEVER **FAIL**. L3 and L4 are the two that
  // read the subject matte itself — L1, L2 and L5 read the face ellipse and the eye matte, which do
  // not care how far the subject matte spread. A broken instrument that prints a red is worse than
  // one that prints nothing, because a red gets acted on.
  if (matteSuspect) {
    for (const clause of [clauses[2], clauses[3]]) {
      clause.status = 'INVALID';
      clause.detail.invalidBecause = 'the subject matte is not a figure';
    }
  }

  const declared = declaredKeySide(geometry.report);
  const fromFrame = clauses[1].detail.keySideFromFrame;

  console.log(`\n=== SCENE '${label}' — ${w}x${h} portrait, 1 step at 60 fps, seed 1, frozen` +
    `${extra === '' ? '' : `\n    injected  ${decodeURIComponent(extra)}`}`);
  console.log(`    matte      ${component.size} px subject (${(matteShare * 100).toFixed(2)}% of frame), ` +
    `${raw.hits - component.size} px discarded outside the largest of ${component.components} components` +
    `${matteSuspect ? '\n    🚩 THE MATTE IS NOT A FIGURE — it covers more than 90% of the plate, so something other than the ' +
      'figure moved between the two arms (a light that reaches the backdrop does). L3 and L4 read this mask and are ' +
      'reported INVALID rather than FAIL; L1, L2 and L5 read the face ellipse and the eye matte and still stand.' : ''}`);
  console.log(`    geometry   IPD ${geometry.ipdPixels.toFixed(1)} px, eye midpoint ` +
    `${geometry.eyeMidpoint.map((v) => v.toFixed(1)).join(',')}, axis ` +
    `${geometry.faceAxis.map((v) => v.toFixed(4)).join(',')}; eyeball meshes [${geometry.eyeballMeshes.join(', ')}]`);
  console.log(`    face mask  ${face.pixels.length} px inside the ellipse and the matte eroded by ` +
    `${BANDS.faceMatteErosion} px (${face.outsideMatte} px of the ellipse fell outside it and were dropped)`);
  console.log(`    eye matte  ${eyes.rawHits} px where the eyeballs are drawn, in ${eyes.componentCount} ` +
    `components; the two largest are the apertures`);
  console.log(`    🎯 KEY SIDE — from the FRAME: ${fromFrame.toUpperCase()}.  ` +
    `Declared by the rig: ${String(declared.side).toUpperCase()} (key azimuth ${declared.azimuth}°).  ` +
    `${declared.side === null ? 'no rig placement to check against' : declared.side === fromFrame ? '✅ the two independent derivations AGREE' : '🔴 THEY DISAGREE — one of them is wrong'}`);

  for (const clause of clauses) {
    const bandText = clause.band[1] === Infinity ? `>= ${clause.band[0]}` : `${clause.band[0]}..${clause.band[1]}`;
    console.log(`    ${clause.status === 'PASS' ? '✅' : clause.status === 'INVALID' ? '⛔' : '🔴'} ${clause.id} ${clause.name.padEnd(42)} ` +
      `${Number.isFinite(clause.value) ? clause.value.toFixed(4) : String(clause.value)}  band ${bandText}`);
  }

  const s = clauses[2].detail.separation;
  console.log(`       L3 per side  ` + ['left', 'right', 'top', 'bottom'].map((side) =>
    `${side} p10 ${Number.isFinite(s.bySide[side].p10) ? s.bySide[side].p10.toFixed(4) : 'n/a'} (n=${s.bySide[side].count})`).join('   '));
  console.log(`       ⚠️ L3 WHOLE-OUTLINE MEAN ${s.outlineMean.toFixed(4)} — this is what a statistic ` +
    'without the per-side split would have reported');
  console.log(`       ⚠️ L4 whole-frame clipped fraction ${clauses[3].detail.frameClippedFraction.toFixed(6)} ` +
    `against the subject's ${clauses[3].value.toFixed(6)} — G5's denominator against this one's`);
  console.log(`       L5 per eye  ` + Object.entries(clauses[4].detail.perEye).map(([eye, e]) =>
    `${eye} ${Number.isFinite(e.ratio) ? e.ratio.toFixed(3) : 'n/a'} (n=${e.pixels})`).join('   '));
  console.log(`       L1 detail    face median ${clauses[0].detail.faceMedian.toFixed(4)}, ` +
    `frame p0.5 ${clauses[0].detail.frameBlack.toFixed(4)}, frame p99.5 ${clauses[0].detail.frameWhite.toFixed(4)}`);
  console.log(`       L2 detail    image-right median ${clauses[1].detail.imageRightMedian.toFixed(4)}, ` +
    `image-left median ${clauses[1].detail.imageLeftMedian.toFixed(4)}`);

  // 🔴 L5's NULL CONTROL, ON THE REAL PLATE. The same operator pointed at a patch of forehead skin
  // the size of an eye. Skin has no specular spot in it, so a statistic that is genuinely finding a
  // CATCHLIGHT must collapse here; one that is merely finding "the brightest pixel in a small region"
  // would not. Costs nothing — it reads the plate that is already decoded.
  const skinPatch = [];
  {
    const [mx, my] = geometry.eyeMidpoint;
    const d = geometry.ipdPixels;
    const [ax2, ay2] = geometry.faceAxis;
    const [px2, py2] = [-ay2, ax2];
    const cxp = mx + px2 * d * -0.42;                     // forehead: above the eye line
    const cyp = my + py2 * d * -0.42;
    const radius = Math.sqrt(Object.values(eyes.perEye)[0].length / Math.PI);
    for (let y = Math.floor(cyp - radius); y <= Math.ceil(cyp + radius); y += 1) {
      for (let x = Math.floor(cxp - radius); x <= Math.ceil(cxp + radius); x += 1) {
        if ((x - cxp) ** 2 + (y - cyp) ** 2 > radius * radius) continue;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        if (component.mask[y * w + x] === 1) skinPatch.push(y * w + x);
      }
    }
  }
  const skinControl = clauseCatchlight(lit.png, { forehead: skinPatch });
  console.log(`       🔴 L5 NULL CONTROL  the same operator on ${skinPatch.length} px of FOREHEAD SKIN reads ` +
    `${Number.isFinite(skinControl.value) ? skinControl.value.toFixed(3) : 'n/a'} — ` +
    `${skinControl.status === 'FAIL' ? 'red, as skin must be' : '⚠️ GREEN ON SKIN, the operator is not finding a catchlight'}`);

  if (overlays) writeOverlay(lit.png, component.mask, face, eyes.perEye, geometry, `${out}/${label}-overlay.png`);

  const failed = clauses.filter((c) => c.status === 'FAIL').map((c) => c.id);
  const invalid = clauses.filter((c) => c.status === 'INVALID').map((c) => c.id);
  console.log(`    VERDICT ${failed.length === 0 ? '✅ ALL MEASURABLE CLAUSES GREEN' : `🔴 ${failed.join(', ')} RED`}` +
    `${invalid.length === 0 ? '' : `   ⛔ ${invalid.join(', ')} NOT MEASURABLE ON THIS ARM`}`);

  return { scene: label, clauses, keySide: { fromFrame, declared }, subjectPixels: component.size };
}

// --- selftest ----------------------------------------------------------------------------------------
//
// 🎯 EVERY CLAUSE IS VALIDATED AGAINST A CASE WHOSE ANSWER IS ARITHMETIC BEFORE IT IS POINTED AT A
// RENDER, AND EVERY CLAUSE HAS A RED PROOF. This project's own rule, and it has been paid for twice:
// "validating my specified statistic on synthetic data did not catch it" was a memory written after
// a statistic that was arithmetically correct and structurally blind. So the synthetics here are not
// only checked for the right NUMBER — three of them are built specifically so that the statistic
// this file rejected (a whole-frame mean, a whole-outline mean, a named key side) reads GREEN on a
// frame the shipped clause reads RED.

function synthetic(w, h, paint) {
  const pixels = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const codes = paint(x, y);
      pixels[i] = codes[0] / 255;
      pixels[i + 1] = codes[1] / 255;
      pixels[i + 2] = codes[2] / 255;
      pixels[i + 3] = 1;
    }
  }
  return { width: w, height: h, pixels };
}

const grey = (v) => [v, v, v];

function selftest() {
  let failures = 0;
  const say = (ok, label, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}\n        ${detail}`);
  };
  // ⚠️ RELATIVE 1e-6, AND THE FLOOR IS THE DECODER RATHER THAN A WIDENED TOLERANCE. `png.mjs`
  // decodes into a Float32Array as byte/255, and the synthetics here are built the same way so that
  // the selftest runs on the same numbers a real plate does. A code value therefore survives to
  // about seven significant figures: 200:40 comes back as 4.999999905005101 and not 5. Stated, not
  // silently loosened — `scene-probe.mjs --selftest` reports the same floor for the same reason, and
  // the smallest thing any band here cares about is four orders of magnitude above it.
  const close = (a, b, relative = 1e-6) => Math.abs(a - b) <= relative * Math.max(1, Math.abs(b));

  console.log('=== scene-gates.mjs --selftest — every clause against arithmetic, then a red proof\n');

  // --- 0. the percentile, because four clauses are built on it -------------------------------------
  {
    const sorted = Float64Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    say(percentile(sorted, 0.5) === 5 && percentile(sorted, 1) === 10 && percentile(sorted, 0.05) === 1,
      'nearest-rank percentile returns a value that is IN the data',
      `p50 ${percentile(sorted, 0.5)} (ceil(0.5*10)=5 -> the 5th smallest), p100 ${percentile(sorted, 1)}, p5 ${percentile(sorted, 0.05)}`);
  }

  // --- 1. L1, face position inside the frame's own range -------------------------------------------
  //
  // 200x100 = 20 000 px. 200 px painted at code 10 and 200 at code 250 pin the frame's p0.5 and
  // p99.5 EXACTLY: nearest-rank p0.5 is the 100th smallest, which is inside the block of 200 tens;
  // nearest-rank p99.5 is the 19 900th, inside the block of 200 two-hundred-and-fifties. A grey's
  // encoded luma is code/255, so the answer is (160-10)/(250-10) = 0.625 with no float slack.
  {
    const W = 200;
    const H = 100;
    const inFace = (x, y) => x >= 60 && x < 100 && y >= 30 && y < 70;   // 40x40 = 1600 px
    const anchorLow = (x, y) => y === 0 && x < 200;                      // 200 px
    const anchorHigh = (x, y) => y === 99 && x < 200;                    // 200 px
    const plate = synthetic(W, H, (x, y) => {
      if (anchorLow(x, y)) return grey(10);
      if (anchorHigh(x, y)) return grey(250);
      if (inFace(x, y)) return grey(160);
      return grey(90);
    });
    const face = [];
    for (let y = 30; y < 70; y += 1) for (let x = 60; x < 100; x += 1) face.push(y * W + x);
    const clause = clauseFaceInFrame(plate, face);
    const expected = (160 - 10) / (250 - 10);
    say(close(clause.value, expected) && clause.status === 'PASS',
      'L1 reads the face\'s position in the frame\'s own range exactly',
      `${clause.value.toFixed(6)} against the arithmetic ${expected.toFixed(6)}  ` +
      `[face median ${(clause.detail.faceMedian * 255).toFixed(1)}, frame p0.5 ${(clause.detail.frameBlack * 255).toFixed(1)}, p99.5 ${(clause.detail.frameWhite * 255).toFixed(1)} in codes]`);

    // 🔴 RED PROOF. Same frame, the face dropped to code 22: (22-10)/240 = 0.05, in the bottom
    // twentieth of the range the picture spends. A silhouette, and the clause says so.
    const dark = synthetic(W, H, (x, y) => {
      if (anchorLow(x, y)) return grey(10);
      if (anchorHigh(x, y)) return grey(250);
      if (inFace(x, y)) return grey(22);
      return grey(90);
    });
    const red = clauseFaceInFrame(dark, face);
    say(red.status === 'FAIL' && close(red.value, (22 - 10) / 240),
      '🔴 L1 RED PROOF: a face at code 22 in a frame that spans 10..250 goes red',
      `${red.value.toFixed(6)} against the arithmetic ${((22 - 10) / 240).toFixed(6)}, floor ${BANDS.faceInFrame[0]}`);

    // ⚠️ AND THE STATISTIC THIS ONE REPLACED READS GREEN ON THE SAME FRAME. "Face median above a
    // constant" is the studio-shaped form; against `measure.mjs`'s own mid-grey the dark face is
    // still 22/255 = 0.086 and a constant floor tuned on a studio plate cannot see it as different
    // in kind from a legitimately dark scene. The point of L1 is the DENOMINATOR.
    const frameOfDark = sortedFrameLuma(dark);
    say(percentile(frameOfDark, 0.5) > percentile(sortedLuma(dark, face), 0.5),
      '⚠️ CONTROL: on the red frame the face is DARKER than the frame\'s own median',
      `frame p50 ${(percentile(frameOfDark, 0.5) * 255).toFixed(1)} against face p50 ${(percentile(sortedLuma(dark, face), 0.5) * 255).toFixed(1)} in codes — ` +
      'which is why the denominator is the frame\'s black-to-white span and not its median');
  }

  // --- 2. L2, key:fill, and the key side ranked out of the frame -------------------------------------
  //
  // The clause that repairs park's G1. Two frames, identical but mirrored: the answer must be the
  // SAME ratio and the OPPOSITE side. A gate that names the key side gets one of the two backwards.
  {
    const W = 200;
    const H = 200;
    const geometry = { faceAxis: [1, 0], eyeMidpoint: [100, 100], ipdPixels: 60 };
    // A face mask 80 px wide about x=100, so `u` runs -1..1 and the two cheek bands are the outer
    // halves: x < 80 and x > 120. Everything painted either side of x=100 is uniform, so the two
    // band medians are the two painted codes and the answer is their ratio, exactly.
    const pixels = [];
    for (let y = 80; y < 120; y += 1) for (let x = 60; x <= 140; x += 1) pixels.push(y * W + x);
    const face = { pixels, ellipse: { cx: 100, cy: 100, a: 40, b: 20, axis: [1, 0] } };
    const keyRight = synthetic(W, H, (x) => grey(x >= 100 ? 180 : 90));
    const keyLeft = synthetic(W, H, (x) => grey(x >= 100 ? 90 : 180));

    const a = clauseKeyToFill(keyRight, face, geometry);
    const b = clauseKeyToFill(keyLeft, face, geometry);
    say(close(a.value, 2) && a.detail.keySideFromFrame === 'right' && a.detail.imageRightPixels === 800,
      'L2 reads the two cheeks 180:90 as exactly 2.0 and ranks the key side RIGHT',
      `${a.value.toFixed(6)} against the arithmetic 2.000000, side ${a.detail.keySideFromFrame}`);
    say(close(b.value, 2) && b.detail.keySideFromFrame === 'left',
      '🎯 L2 MIRRORED: the sun crosses the camera axis and the ratio does NOT invert',
      `${b.value.toFixed(6)} — the same 2.000000, side ${b.detail.keySideFromFrame}. ` +
      'A gate with a hard-coded key rect reads 0.500000 here; that is park\'s G1 0.5076 in arithmetic form');
    say(a.detail.imageRightPixels === a.detail.imageLeftPixels && a.detail.imageRightPixels * 2 < pixels.length,
      'the two cheek bands are equal, disjoint, and leave the middle of the face out of the ratio',
      `${a.detail.imageRightPixels} px each of ${pixels.length} in the mask — ` +
      `the ${pixels.length - a.detail.imageRightPixels * 2} px between them is where a nose lives`);

    // 🔴 RED PROOF at the dramatic end: 200:40 is 5.0, past the two-stop ceiling.
    const brutal = synthetic(W, H, (x) => grey(x >= 100 ? 200 : 40));
    const red = clauseKeyToFill(brutal, face, geometry);
    say(red.status === 'FAIL' && close(red.value, 5),
      '🔴 L2 RED PROOF: 200:40 across the face is 5.0 and goes red at the dramatic end',
      `${red.value.toFixed(6)}, ceiling ${BANDS.keyToFill[1]}`);
    // 🔴 and at the flat end: 100:96 is 1.0417, no directional information at all.
    const flat = synthetic(W, H, (x) => grey(x >= 100 ? 100 : 96));
    const red2 = clauseKeyToFill(flat, face, geometry);
    say(red2.status === 'FAIL' && close(red2.value, 100 / 96),
      '🔴 L2 RED PROOF: 100:96 is a flat cut-out and goes red at the other end',
      `${red2.value.toFixed(6)} against the arithmetic ${(100 / 96).toFixed(6)}, floor ${BANDS.keyToFill[0]} — ` +
      `and the real-plate null this floor was calibrated against reads 1.0270`);
  }

  // --- 3. the matte, then L3, per side --------------------------------------------------------------
  //
  // 🚩 THIS IS THE ONE THIS PROJECT HAS GOT WRONG EIGHT TIMES. The synthetic is a square subject on a
  // background that is dark on the LEFT and IDENTICAL TO THE SUBJECT on the RIGHT. The right side of
  // the figure has vanished. A mean over the whole outline still reads well above the threshold,
  // because three of the four edges are fine. The per-side p10 reads exactly zero on the right.
  {
    const W = 200;
    const H = 200;
    const isSubject = (x, y) => x >= 70 && x < 130 && y >= 70 && y < 130;
    const lit = synthetic(W, H, (x, y) => (isSubject(x, y) ? grey(128) : grey(x < 100 ? 20 : 128)));
    const bg = synthetic(W, H, (x) => grey(x < 100 ? 20 : 128));

    const raw = buildSubjectMask(lit, bg, 2);
    const component = largestComponent(raw.mask, W, H);
    // Only the LEFT half of the square differs from the background, so the matte is a 30x60 slab.
    say(component.size === 30 * 60,
      '⚠️ the matte is honest about what it cannot see: a subject the same colour as its background',
      `${component.size} px recovered of the 3600 px square — the right half is invisible to a difference matte, ` +
      'which is exactly the condition L3 is about to call red');

    // So the mask for the L3 arithmetic is painted rather than matted: a difference matte cannot
    // recover a region it has no difference in, and L3's question is about the PICTURE, not the matte.
    const square = new Uint8Array(W * H);
    for (let y = 70; y < 130; y += 1) for (let x = 70; x < 130; x += 1) square[y * W + x] = 1;

    const clause = clauseSilhouette(lit, square, ['left', 'right', 'top']);
    const expectedLeft = (128 - 20) / (128 + 20);
    say(close(clause.detail.separation.bySide.left.p10, expectedLeft),
      'L3 reads the left side\'s Michelson contrast exactly',
      `${clause.detail.separation.bySide.left.p10.toFixed(6)} against the arithmetic (128-20)/(128+20) = ${expectedLeft.toFixed(6)}`);
    say(clause.detail.separation.bySide.right.p10 === 0,
      '🔴 L3 RED PROOF: the right side is the same luma as its background and reads exactly 0',
      `right p10 ${clause.detail.separation.bySide.right.p10.toFixed(6)}, threshold ${BANDS.sideSeparationP10}, ` +
      `clause ${clause.status}, failed sides [${clause.detail.failed.join(', ')}]`);
    // The top edge of the square is HALF against the dark background and half against the identical
    // one, so its p10 is 0 too — and that is the point: the sector split localises the loss to the
    // sides it actually happened on rather than smearing it over the outline.
    say(clause.status === 'FAIL' && clause.detail.failed.includes('right') && clause.detail.failed.includes('top')
      && clause.detail.failed.includes('left') === false,
      'L3 names WHICH sides went, and leaves the intact one alone',
      `${clause.status}, failed [${clause.detail.failed.join(', ')}], left survived at p10 ` +
      `${clause.detail.separation.bySide.left.p10.toFixed(6)}`);
    say(clause.detail.separation.outlineMean > BANDS.sideSeparationP10 * 3,
      '🔴🔴 THE BLIND-STATISTIC PROOF: the WHOLE-OUTLINE MEAN reads GREEN on the same frame',
      `outline mean ${clause.detail.separation.outlineMean.toFixed(6)} against the ${BANDS.sideSeparationP10} threshold — ` +
      `${(clause.detail.separation.outlineMean / BANDS.sideSeparationP10).toFixed(1)}x clear, while a whole side of the figure ` +
      'has disappeared. Six of this project\'s eight blind statistics had exactly this shape.');

    // And the sides must be NAMED correctly, or "per side" means nothing.
    const left = outwardNormal(square, W, H, 70, 100, 5);
    const right = outwardNormal(square, W, H, 129, 100, 5);
    const top = outwardNormal(square, W, H, 100, 70, 5);
    say(sideOf(left) === 'left' && sideOf(right) === 'right' && sideOf(top) === 'top',
      'the outward normal names the side it is actually on',
      `left edge -> ${sideOf(left)} (${left.map((v) => v.toFixed(3)).join(',')}), ` +
      `right -> ${sideOf(right)} (${right.map((v) => v.toFixed(3)).join(',')}), ` +
      `top -> ${sideOf(top)} (${top.map((v) => v.toFixed(3)).join(',')})`);
  }

  // --- 4. L4, clipping, masked ------------------------------------------------------------------------
  //
  // 🔴 THE MASKED-VERSUS-WHOLE-FRAME PROOF, and it is arithmetic by pixel count. 200x100 = 20 000 px.
  // The subject is 4000 px, 80 of which are blown: 2.00% of the subject and 0.40% of the frame. G5's
  // own share is 0.5%, so the whole-frame denominator passes and the subject's fails, on one frame.
  {
    const W = 200;
    const H = 100;
    const inSubject = (x, y) => x >= 20 && x < 120 && y >= 20 && y < 60;    // 100x40 = 4000
    const isBlown = (x, y) => y >= 20 && y < 24 && x >= 20 && x < 40;       // 20x4 = 80
    const plate = synthetic(W, H, (x, y) => {
      if (isBlown(x, y)) return grey(255);
      if (inSubject(x, y)) return grey(150);
      return grey(60);
    });
    const subject = [];
    for (let y = 20; y < 60; y += 1) for (let x = 20; x < 120; x += 1) subject.push(y * W + x);
    const clause = clauseClipping(plate, subject);
    say(clause.detail.subjectClipped === 80 && close(clause.value, 0.02) && clause.status === 'FAIL',
      '🔴 L4 RED PROOF: 80 blown pixels are 2.00% of the subject and the clause goes red',
      `subject ${clause.detail.subjectClipped}/${clause.detail.subjectPixels} = ${(clause.value * 100).toFixed(2)}%, ` +
      `G5's share ${(BANDS.subjectClippedFraction * 100).toFixed(1)}%`);
    say(clause.detail.frameClipped === 80 && close(clause.detail.frameClippedFraction, 0.004),
      '🔴🔴 AND G5\'s OWN DENOMINATOR READS GREEN ON THE SAME 80 PIXELS',
      `whole frame ${clause.detail.frameClipped}/${W * H} = ${(clause.detail.frameClippedFraction * 100).toFixed(2)}% — ` +
      `under G5's ${(BANDS.subjectClippedFraction * 100).toFixed(1)}% by a factor of ` +
      `${(BANDS.subjectClippedFraction / clause.detail.frameClippedFraction).toFixed(2)}. A blown face hides inside a big frame.`);
  }

  // --- 5. L5, the catchlight --------------------------------------------------------------------------
  //
  // A 20x20 cornea at code 60 with a 3x3 specular at code 240. 400 px, nearest-rank p99.5 is the
  // 398th smallest and the nine bright pixels occupy 392..400, so the peak reads 240 exactly and the
  // ratio is 240/60 = 4.0.
  {
    const W = 60;
    const H = 60;
    const inEye = (x, y) => x >= 10 && x < 30 && y >= 10 && y < 30;
    const inSpot = (x, y) => x >= 14 && x < 17 && y >= 14 && y < 17;
    const withCatch = synthetic(W, H, (x, y) => (inSpot(x, y) ? grey(240) : inEye(x, y) ? grey(60) : grey(30)));
    const without = synthetic(W, H, (x, y) => (inEye(x, y) ? grey(60) : grey(30)));
    const eye = [];
    for (let y = 10; y < 30; y += 1) for (let x = 10; x < 30; x += 1) eye.push(y * W + x);

    const lit = clauseCatchlight(withCatch, { left: eye, right: eye });
    say(close(lit.value, 4) && lit.status === 'PASS',
      'L5 reads a 240-over-60 specular as exactly 4.0',
      `${lit.value.toFixed(6)} against the arithmetic 240/60 = 4.000000, floor ${BANDS.catchlightPeakOverMedian}`);
    const red = clauseCatchlight(without, { left: eye, right: eye });
    say(red.status === 'FAIL' && close(red.value, 1),
      '🔴 L5 RED PROOF: a flat cornea with no specular reads exactly 1.0 and goes red',
      `${red.value.toFixed(6)}, floor ${BANDS.catchlightPeakOverMedian}`);
    const oneEye = clauseCatchlight(withCatch, { left: eye, right: [] });
    say(oneEye.status === 'FAIL',
      '🔴 L5 RED PROOF: one live eye and one that cannot be read is still red',
      `worst ${String(oneEye.value)} — ${JSON.stringify(oneEye.detail.perEye.right)}`);
  }

  // --- 6. the matte and the component filter ------------------------------------------------------------
  {
    const W = 60;
    const H = 60;
    const lit = synthetic(W, H, (x, y) => {
      if (x >= 20 && x < 40 && y >= 20 && y < 40) return grey(200);   // the figure, 400 px
      if (x >= 5 && x < 8 && y >= 50 && y < 53) return grey(120);     // a detached blob, 9 px
      return grey(50);
    });
    const bg = synthetic(W, H, () => grey(50));
    const raw = buildSubjectMask(lit, bg, 2);
    const component = largestComponent(raw.mask, W, H);
    say(raw.hits === 409 && component.size === 400 && component.components === 2,
      'the matte finds both blobs and the component filter keeps only the figure',
      `raw ${raw.hits} px in ${component.components} components, largest ${component.size} px — ` +
      'the 9 px blob is the shape a cast shadow makes and it is discarded');
    const same = buildSubjectMask(lit, lit, 2);
    say(same.hits === 0,
      'NULL CONTROL: a matte of a plate against itself is empty',
      `${same.hits} px`);
  }

  // --- 7. the two operators the masks are built with ------------------------------------------------
  {
    const W = 40;
    const H = 40;
    // A 20x20 square eroded by 3 must be a 14x14 square: 3 px come off each of the four sides.
    const square = new Uint8Array(W * H);
    for (let y = 10; y < 30; y += 1) for (let x = 10; x < 30; x += 1) square[y * W + x] = 1;
    const eroded = erodeMask(square, W, H, 3);
    let kept = 0;
    for (let k = 0; k < W * H; k += 1) kept += eroded[k];
    say(kept === 14 * 14 && eroded[13 * W + 13] === 1 && eroded[12 * W + 13] === 0,
      'erodeMask takes exactly `radius` pixels off every side',
      `${kept} px kept of ${20 * 20}, arithmetic (20-2*3)^2 = ${14 * 14}; ` +
      'the corner at (13,13) survives and (13,12) does not');

    // The eye aperture: two blobs of different size plus a speck. `topComponents(…, 2)` must return
    // the two blobs, biggest first, and `buildEyePixels` must put them on the sides their centroids
    // are on — the axis's POSITIVE direction is the character's left eye, on image right.
    const lit = synthetic(W, H, (x, y) => {
      if (x >= 4 && x < 12 && y >= 18 && y < 26) return grey(200);    // 64 px, image LEFT
      if (x >= 26 && x < 36 && y >= 18 && y < 28) return grey(200);   // 100 px, image RIGHT
      if (x === 1 && y === 1) return grey(200);                        // 1 px speck
      return grey(50);
    });
    const flat = synthetic(W, H, () => grey(50));
    const eyes = buildEyePixels(lit, flat, { faceAxis: [1, 0], eyeMidpoint: [20, 22], ipdPixels: 22 });
    say(eyes.rawHits === 165 && eyes.componentCount === 3
      && eyes.perEye.left.length === 100 && eyes.perEye.right.length === 64,
      'buildEyePixels keeps the two eyes, drops the speck, and puts each on the right side',
      `${eyes.rawHits} px in ${eyes.componentCount} components -> character-left (image RIGHT) ` +
      `${eyes.perEye.left.length} px, character-right (image LEFT) ${eyes.perEye.right.length} px; ` +
      'the 1 px speck is third by size and is not returned');
  }

  console.log(failures === 0 ? '\nall clauses green' : `\n${failures} FAILED`);
  return failures;
}

// --- entry -------------------------------------------------------------------------------------------

function flag(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

// Only when this file IS the command. Every statistic above is exported so another tool can import
// them, and a module that prints its usage line on import is a module nobody imports.
const INVOKED_DIRECTLY = process.argv[1] !== undefined
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (INVOKED_DIRECTLY && process.argv.includes('--selftest')) process.exit(selftest() === 0 ? 0 : 1);

const urlBase = flag('url-base');
const out = path.resolve(flag('out', path.join(REPO, 'captures', 'scene-gates')));
const scenes = String(flag('scene', 'studio,beach,park')).split(',').map((s) => s.trim()).filter(Boolean);
const overlays = process.argv.includes('--overlays');

if (INVOKED_DIRECTLY === false) {
  // imported, not run
} else if (urlBase === null) {
  console.log('pass --selftest, or --url-base <origin+path-to-avatar-plate.html> --out <dir> ' +
    '[--scene studio,beach,park] [--overlays]');
} else {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: GPU_FLAGS });
  const results = [];
  try {
    if (process.argv.includes('--red')) {
      for (const injection of RED_INJECTIONS) {
        results.push(await runScene(browser, urlBase, out, injection.scene, {
          overlays,
          label: injection.label,
          extra: injection.extra,
        }));
      }
    } else {
      for (const scene of scenes) results.push(await runScene(browser, urlBase, out, scene, { overlays }));
    }
  } finally {
    await browser.close();
  }
  console.log('\n=== SUMMARY');
  console.log('| scene | L1 face-in-frame | L2 key:fill | L3 worst side | L4 subject clip | L5 catchlight | key side |');
  console.log('|---|---:|---:|---:|---:|---:|---|');
  for (const r of results) {
    const cell = (c) => (c.status === 'INVALID'
      ? '⛔ n/a'
      : `${Number.isFinite(c.value) ? c.value.toFixed(4) : 'n/a'} ${c.status === 'PASS' ? '✅' : '❌'}`);
    console.log(`| \`${r.scene}\` | ${cell(r.clauses[0])} | ${cell(r.clauses[1])} | ` +
      `${cell(r.clauses[2])} (${r.clauses[2].detail.worstSide}) | ${cell(r.clauses[3])} | ${cell(r.clauses[4])} | ` +
      `${r.keySide.fromFrame} (rig ${r.keySide.declared.azimuth}°) |`);
  }
}
