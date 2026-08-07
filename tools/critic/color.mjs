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
