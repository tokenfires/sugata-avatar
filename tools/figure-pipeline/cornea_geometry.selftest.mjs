/**
 * Selftest for the corneal-dome measurement that `verify_glb.mjs` gates on.
 *
 * Why this file exists: the gate's cornea checks stop at "the figure has no corneal shell" the
 * moment the mesh is absent, which is what both real known-bad figures do — the superseded
 * low-poly proxy and a high-poly build with the material split omitted. Neither of them ever
 * reaches the dome measurement, so running the gate against them proves the gate notices a
 * missing cornea and proves nothing whatever about whether it can tell a dome from a sphere.
 * That is docs/LEARNINGS.md 1.1 exactly: a check that has never failed is not known to work.
 *
 * So the shapes here are synthesised, where the answer is known by construction:
 *
 *   - a perfect sphere must read as NO dome, however finely it is tessellated;
 *   - a sphere with a dome of height h must read as a dome, and must measure h;
 *   - tessellation noise alone must not manufacture a dome;
 *   - an inverted split — globe and cornea swapped — must show a negative anterior chamber.
 *
 * The five shipped figures are then measured as the known-good real asset, and their numbers
 * printed, so the margin the gate is running on is visible rather than assumed.
 *
 * Usage:  node tools/figure-pipeline/cornea_geometry.selftest.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  measureCornealDome, measureAnteriorChamberMm, splitIntoEyes, positionsOf, fitSphere,
  DOME_NOISE_MULTIPLE, FRONT_CAP_DEGREES, POSTERIOR_BAND_MIN_DEGREES,
} from "./cornea_geometry.mjs";

globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} });
const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");

// The asset's own numbers, so the synthetic shapes are the size of the real problem rather than a
// convenient one. Both measured on assets/figures/figure_g050.glb.
const GLOBE_RADIUS_MM = 15.3;
const REAL_DOME_HEIGHT_MM = 0.688;

// The shell is an open cap, not a ball — it stops behind the equator where the eyelids and the
// skull hide it. Matches the shipped shell, which spans 0–120 degrees off the forward axis.
const SHELL_MAX_DEGREES = 120;

let failures = 0;
let checks = 0;

function check(label, condition, detail) {
  checks += 1;
  if (condition) {
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

function heading(text) {
  console.log("");
  console.log(text);
  console.log("-".repeat(text.length));
}

/**
 * A tessellated spherical cap facing +Z, in metres, centred at the origin.
 *
 * `domeHeightMm` displaces everything inside `domeExtentDegrees` radially outward, tapered to zero
 * at the dome's edge so the surface stays continuous — which is what a real corneal dome is: a
 * second, tighter radius blended into the sclera, not a step.
 */
function sphericalCap({ radiusMm, ringCount, segmentCount, domeHeightMm = 0,
                        domeExtentDegrees = 25, noiseMm = 0, seed = 1 }) {
  const random = seededRandom(seed);
  const points = [];

  for (let ring = 0; ring <= ringCount; ring += 1) {
    const degrees = SHELL_MAX_DEGREES * ring / ringCount;
    const polar = degrees * Math.PI / 180;

    const insideDome = degrees < domeExtentDegrees;
    const taper = insideDome ? Math.cos(degrees / domeExtentDegrees * Math.PI / 2) : 0;
    const radius = radiusMm + domeHeightMm * taper + (random() * 2 - 1) * noiseMm;

    for (let segment = 0; segment < segmentCount; segment += 1) {
      const azimuth = 2 * Math.PI * segment / segmentCount;
      points.push([
        radius * Math.sin(polar) * Math.cos(azimuth) / 1000,
        radius * Math.sin(polar) * Math.sin(azimuth) / 1000,
        radius * Math.cos(polar) / 1000,
      ]);
    }
  }

  return points;
}

/** Deterministic PRNG so a failure is reproducible. Mulberry32. */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- 1. a sphere is not a dome ----------------------------------------------------------------

heading("1. a sphere must not read as a dome");

for (const [label, shell] of [
  ["coarse (6 rings x 8 segments, the low-poly tessellation)",
    sphericalCap({ radiusMm: GLOBE_RADIUS_MM, ringCount: 6, segmentCount: 8 })],
  ["fine (16 rings x 16 segments, the high-poly tessellation)",
    sphericalCap({ radiusMm: GLOBE_RADIUS_MM, ringCount: 16, segmentCount: 16 })],
]) {
  const dome = measureCornealDome(shell);
  check(`perfect sphere, ${label}`, dome.measured && !dome.hasDome,
    `front cap sits ${dome.meanProudMm.toFixed(4)} mm proud, noise ${dome.noiseMm.toFixed(4)} mm`);
}

// --- 2. a dome is a dome, and is measured at its true height -----------------------------------

heading("2. a dome must read as a dome, and measure its own height");

for (const heightMm of [0.3, REAL_DOME_HEIGHT_MM, 2.0]) {
  const shell = sphericalCap({
    radiusMm: GLOBE_RADIUS_MM, ringCount: 16, segmentCount: 16, domeHeightMm: heightMm });
  const dome = measureCornealDome(shell);

  // The front cap is tapered, so its mean proudness is below the apex height by the mean of the
  // taper over the cap — around 0.83 for a cosine taper sampled to 15 of 25 degrees. Asserting a
  // band rather than an equality keeps the check about the measurement, not about the fixture.
  const withinBand = dome.meanProudMm > heightMm * 0.6 && dome.meanProudMm < heightMm * 1.05;
  // An exactly-tessellated sphere has no residual at all, so the ratio is a divide-by-zero dressed
  // up as a large number. Report the noise instead, where the reader can see it is zero.
  check(`dome of ${heightMm} mm reads as a dome`, dome.hasDome,
    `${dome.meanProudMm.toFixed(3)} mm proud against a noise floor of ` +
    `${dome.noiseMm.toExponential(1)} mm`);
  check(`dome of ${heightMm} mm measures its own height`, withinBand,
    `measured ${dome.meanProudMm.toFixed(3)} mm against ${heightMm} mm authored`);
}

// --- 3. noise must not manufacture a dome ------------------------------------------------------

heading("3. tessellation noise alone must not manufacture a dome");

// 0.24 mm is the largest posterior-fit RMS across the five shipping figures (g100), so this is the
// real asset's noise floor rather than a token amount.
for (const seed of [1, 2, 3, 4, 5]) {
  const shell = sphericalCap({
    radiusMm: GLOBE_RADIUS_MM, ringCount: 16, segmentCount: 16, noiseMm: 0.24, seed });
  const dome = measureCornealDome(shell);
  check(`sphere + 0.24 mm noise, seed ${seed}`, !dome.hasDome,
    `${dome.meanProudMm.toFixed(3)} mm proud against a ${(DOME_NOISE_MULTIPLE * dome.noiseMm).toFixed(3)} mm threshold`);
}

heading("3b. a real dome must survive that same noise");

for (const seed of [1, 2, 3, 4, 5]) {
  const shell = sphericalCap({
    radiusMm: GLOBE_RADIUS_MM, ringCount: 16, segmentCount: 16,
    domeHeightMm: REAL_DOME_HEIGHT_MM, noiseMm: 0.24, seed });
  const dome = measureCornealDome(shell);
  check(`sphere + ${REAL_DOME_HEIGHT_MM} mm dome + 0.24 mm noise, seed ${seed}`, dome.hasDome,
    `${dome.meanProudMm.toFixed(3)} mm proud, ${dome.domeRatio.toFixed(2)}x noise`);
}

// --- 4. the anterior chamber, including the inverted split -------------------------------------

heading("4. the anterior chamber must be signed, so an inverted split cannot pass");

const globeShell = sphericalCap({ radiusMm: GLOBE_RADIUS_MM, ringCount: 16, segmentCount: 16 });
const corneaShell = sphericalCap({
  radiusMm: GLOBE_RADIUS_MM + 1.3, ringCount: 16, segmentCount: 16,
  domeHeightMm: REAL_DOME_HEIGHT_MM });

const chamberMm = measureAnteriorChamberMm(corneaShell, globeShell);
check("cornea in front of globe gives a positive chamber",
  Math.abs(chamberMm - (1.3 + REAL_DOME_HEIGHT_MM)) < 0.01,
  `${chamberMm.toFixed(3)} mm, authored ${(1.3 + REAL_DOME_HEIGHT_MM).toFixed(3)} mm`);

const invertedMm = measureAnteriorChamberMm(globeShell, corneaShell);
check("swapping the two shells makes it negative", invertedMm < 0,
  `${invertedMm.toFixed(3)} mm — this is the case the dome check alone cannot catch, because the ` +
  "corneal shell is still domed when it is on the wrong material");

// --- 5. splitting a two-eye cloud --------------------------------------------------------------

heading("5. a two-eye cloud must split into two eyes");

const interpupillaryMm = 58;
const twoEyes = [
  ...globeShell.map(([x, y, z]) => [x + interpupillaryMm / 2000, y, z]),
  ...globeShell.map(([x, y, z]) => [x - interpupillaryMm / 2000, y, z]),
];
const split = splitIntoEyes(twoEyes);
const centroidX = (points) => points.reduce((total, p) => total + p[0], 0) / points.length * 1000;

check("both halves get the same vertex count",
  split.left.length === globeShell.length && split.right.length === globeShell.length,
  `${split.left.length} / ${split.right.length}`);
check("the halves are an interpupillary distance apart",
  Math.abs((centroidX(split.left) - centroidX(split.right)) - interpupillaryMm) < 0.001,
  `${(centroidX(split.left) - centroidX(split.right)).toFixed(3)} mm`);

// --- 6. the shipped figures --------------------------------------------------------------------

heading("6. the shipped figures — the known-good real asset");

const figuresDir = path.join(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."), "assets", "figures");

if (!fs.existsSync(figuresDir)) {
  console.log("  SKIPPED: no assets/figures. Run tools/figure-pipeline/build.sh first.");
} else {
  const figures = fs.readdirSync(figuresDir).filter((name) => name.endsWith(".glb")).sort();

  for (const name of figures) {
    const bytes = fs.readFileSync(path.join(figuresDir, name));
    const gltf = await new Promise((resolve, reject) => {
      new GLTFLoader().parse(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        "", resolve, reject);
    });

    let cornea = null;
    let globe = null;
    gltf.scene.traverse((object) => {
      if (!object.isMesh) return;
      if (/cornea/i.test(object.name)) cornea = object;
      else if (/high-poly|low-poly|eyeball/i.test(object.name)) globe = object;
    });

    if (!cornea || !globe) {
      check(`${name} carries both eye shells`, false, "one of them is missing");
      continue;
    }

    const corneaEyes = splitIntoEyes(positionsOf(cornea.geometry));
    const globeEyes = splitIntoEyes(positionsOf(globe.geometry));

    for (const side of ["left", "right"]) {
      const dome = measureCornealDome(corneaEyes[side]);
      const chamber = measureAnteriorChamberMm(corneaEyes[side], globeEyes[side]);
      check(`${name} ${side}`, dome.hasDome && chamber >= 0.5,
        `dome ${dome.meanProudMm.toFixed(3)} mm at ${dome.domeRatio.toFixed(2)}x noise ` +
        `(threshold ${DOME_NOISE_MULTIPLE}x), chamber ${chamber.toFixed(3)} mm`);
    }

    // The globe is the surface the old asset was: a sphere. Measuring it with the same instrument
    // is the closest thing to a real known-bad the shipped figure contains, and it is free.
    const globeDome = measureCornealDome(splitIntoEyes(positionsOf(globe.geometry)).left);
    check(`${name} globe shell reads as NOT domed`, !globeDome.hasDome,
      `${globeDome.meanProudMm.toFixed(3)} mm proud — the globe's front is the iris bowl, which ` +
      "curves inward");
  }
}

// --- 7. the sphere fit itself ------------------------------------------------------------------

heading("7. the sphere fit");

const offsetCentre = [0.031, 1.552, 0.126];
const exactSphere = sphericalCap({ radiusMm: 12.7, ringCount: 12, segmentCount: 12 })
  .map(([x, y, z]) => [x + offsetCentre[0], y + offsetCentre[1], z + offsetCentre[2]]);
const fit = fitSphere(exactSphere);

check("recovers a known radius", Math.abs(fit.radius * 1000 - 12.7) < 1e-6,
  `${(fit.radius * 1000).toFixed(9)} mm`);
check("recovers a known centre",
  Math.max(...fit.centre.map((value, axis) => Math.abs(value - offsetCentre[axis]))) < 1e-9,
  fit.centre.map((value) => value.toFixed(9)).join(", "));
// A picometre. The closed-form fit is exact in exact arithmetic, so anything left is double
// rounding through the normal equations — measured at 2.7e-8 mm, which is 27 femtometres.
check("reports zero residual on an exact sphere", fit.residualRms * 1000 < 1e-6,
  `${(fit.residualRms * 1000).toExponential(2)} mm`);

// --- result ------------------------------------------------------------------------------------

console.log("");
console.log("=".repeat(78));
console.log(`front cap < ${FRONT_CAP_DEGREES}°, reference sphere fitted beyond ` +
            `${POSTERIOR_BAND_MIN_DEGREES}°, dome declared above ${DOME_NOISE_MULTIPLE}x that ` +
            "fit's RMS");
if (failures === 0) {
  console.log(`PASS — ${checks} checks.`);
  process.exit(0);
}
console.log(`FAIL — ${failures} of ${checks} checks failed.`);
process.exit(1);
