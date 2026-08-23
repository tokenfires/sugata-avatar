// Colour maths for the critic gates.
//
// ⚠️ THE SINGLE MOST IMPORTANT THING IN THIS TOOL — READ BEFORE CHANGING ANYTHING ⚠️
//
// "Luma" is ambiguous, and getting it wrong silently invalidates every gate. There are two
// different quantities, both computed with the Rec.709 coefficients (0.2126, 0.7152, 0.0722):
//
//   linearLuma   — coefficients applied to LINEARISED values (sRGB EOTF undone first).
//                  This is relative luminance: physical light. Use it for anything that is a
//                  RATIO OF LIGHT, e.g. a key:shadow lighting ratio, where "4:1" means the key
//                  delivers four times the photons.
//
//   encodedLuma  — coefficients applied to the sRGB-ENCODED values straight out of the file.
//                  This is not physical, but it is roughly perceptual, and — critically — it is
//                  the quantity the measurements in docs/research/stellar-blade-look-spec.md
//                  were taken in. Verified: the spec's `#E5C3C3 → 0.793` and `#9D7274 → 0.483`
//                  reproduce exactly under encodedLuma and not at all under linearLuma
//                  (#E5C3C3 linearises to 0.5963).
//
// Every gate therefore declares which domain it is judged in, and measure.mjs reports BOTH
// numbers for every measurement so the choice can always be re-checked against the spec.

const REC709_R = 0.2126;
const REC709_G = 0.7152;
const REC709_B = 0.0722;

// --- transfer functions -------------------------------------------------------------------

// sRGB EOTF: display-encoded value -> linear light. IEC 61966-2-1.
export function srgbToLinear(encoded) {
  if (encoded <= 0.04045) return encoded / 12.92;
  return Math.pow((encoded + 0.055) / 1.055, 2.4);
}

// sRGB OETF: linear light -> display-encoded value. Only needed when synthesising test images
// from a known linear target.
export function linearToSrgb(linear) {
  if (linear <= 0.0031308) return linear * 12.92;
  return 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
}

// --- luma ---------------------------------------------------------------------------------

// Rec.709 luma on the sRGB-encoded triple. Matches how the reference spec's values were taken.
export function encodedLuma(r, g, b) {
  return REC709_R * r + REC709_G * g + REC709_B * b;
}

// Rec.709 relative luminance: linearise first, then weight. The physically meaningful one.
export function linearLuma(r, g, b) {
  return (
    REC709_R * srgbToLinear(r) + REC709_G * srgbToLinear(g) + REC709_B * srgbToLinear(b)
  );
}

// --- HSV ----------------------------------------------------------------------------------

// HSV on the sRGB-encoded triple, which is what image editors and the reference measurements
// report. Hue in degrees [0,360), saturation and value in [0,1].
export function rgbToHsv(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;

  let hue = 0;
  if (chroma > 0) {
    if (max === r) hue = ((g - b) / chroma) % 6;
    else if (max === g) hue = (b - r) / chroma + 2;
    else hue = (r - g) / chroma + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  const saturation = max === 0 ? 0 : chroma / max;
  return { hue, saturation, value: max };
}

// How far a hue sits from pure red, as an unsigned angle in degrees. Skin hues live just above
// 0° when warm-lit and cross below 0° (i.e. wrap past 360°) as subsurface transmission takes
// over, so a plain hue subtraction gives the wrong sign. Gate G3 asks whether the terminator
// moved TOWARDS red; this makes that a single monotonic comparison.
export function hueDistanceFromRed(hue) {
  return Math.min(hue, 360 - hue);
}

// --- averaging ----------------------------------------------------------------------------

// Mean colour of a set of pixels, averaged in ENCODED space. Averaging encoded values is the
// wrong thing to do physically, but it is what a colour picker on a blurred selection does, and
// it is what the reference hexes represent. The linear-domain mean is computed separately from
// per-pixel linear values (see meanLinearLuma), never by linearising this result.
export function meanEncodedRgb(pixels, indices) {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const index of indices) {
    r += pixels[index];
    g += pixels[index + 1];
    b += pixels[index + 2];
  }
  const count = indices.length;
  return { r: r / count, g: g / count, b: b / count };
}

// --- chroma -------------------------------------------------------------------------------
//
// TWO STATISTICS, AND THE REASON THERE ARE TWO IS A DEFECT IN A PRE-REGISTRATION.
//
// `docs/superpowers/specs/2026-08-23-req-064-preregistration.md` registered its visibility floor
// as "at least 1.0 encoded code value of increase in top-decile mean C*". Those are two different
// units in one sentence: CIELAB C* runs on a roughly 0-130 perceptual scale and is not measured in
// code values at all. The registration's NUMBER and its JUSTIFICATION ("below one code value of an
// 8-bit plate the change cannot be seen") unambiguously describe a code-value quantity, so that is
// the reading the gate is applied on — `chromaInCodes` below — and `cielabChroma` is reported
// beside it so nothing is hidden by the choice.
//
// Writing the gate against the unit rather than against the name is the reading that BINDS; picking
// whichever of the two the data happened to favour is the renegotiation that
// `pre-registration-binds-the-registrant` is about. The lesson for the next registration is that a
// threshold must carry the same unit as the statistic it gates, and this one did not.

// D65 white point, CIE 1931 2-degree observer.
const D65_X = 95.047;
const D65_Y = 100.0;
const D65_Z = 108.883;

const LAB_EPSILON = 216 / 24389;
const LAB_KAPPA = 24389 / 27;

function labTransfer(t) {
  return t > LAB_EPSILON ? Math.cbrt(t) : (LAB_KAPPA * t + 16) / 116;
}

/**
 * CIELAB chroma C* = sqrt(a*^2 + b*^2) of an sRGB-encoded triple in [0,1].
 *
 * Zero for any neutral grey at any lightness, which is the property the measurement needs: the
 * complaint REQ-064 addresses is that our bright hair pixels are GREY, and R takes the light's
 * colour by construction, so a statistic that cannot separate "brighter" from "more coloured" is
 * the wrong metric — which is exactly what `docs/research/pedestal-look-2026-08-22.md` §3 says
 * about both prior assessments of REQ-064.
 */
export function cielabChroma(r, g, b) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  // sRGB D65 primaries, scaled to a 0-100 Y.
  const x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) * 100;
  const y = (0.2126729 * lr + 0.7151522 * lg + 0.0721750 * lb) * 100;
  const z = (0.0193339 * lr + 0.1191920 * lg + 0.9503041 * lb) * 100;

  const fx = labTransfer(x / D65_X);
  const fy = labTransfer(y / D65_Y);
  const fz = labTransfer(z / D65_Z);

  const aStar = 500 * (fx - fy);
  const bStar = 200 * (fy - fz);

  return Math.hypot(aStar, bStar);
}

/**
 * Chroma as a distance in 8-BIT CODE VALUES: the norm of the triple's departure from its own grey.
 *
 * This is the quantity the pre-registration's "1.0 code value" floor is a threshold on. It is the
 * Euclidean distance from (R,G,B) to the neutral axis point (m,m,m) where m is the channel mean, so
 * it is zero for any grey, it is in the same units as the plate, and a value below 1 cannot survive
 * the plate's own quantisation.
 *
 * Inputs are 0-255 code values, NOT the 0-1 floats the rest of this module takes, because the whole
 * point of the statistic is that its unit is the plate's unit.
 */
export function chromaInCodes(r255, g255, b255) {
  const mean = (r255 + g255 + b255) / 3;
  return Math.hypot(r255 - mean, g255 - mean, b255 - mean);
}
