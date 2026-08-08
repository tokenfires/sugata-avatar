/**
 * Gate for the optical claims this project makes about the eye asset in prose.
 *
 * WHY A DOC GATE EXISTS AT ALL
 *
 * For two phases nothing anywhere recorded the cornea's radius of curvature. Every gate measured
 * a proxy for it — the dome's height proud of the sclera, the anterior chamber depth, the globe
 * radius — and all of them stayed green while `PROGRESS.md` stated, in committed prose, that the
 * corneal power would be "somewhat under-strength", justified by the chamber depth and the globe
 * radius. Corneal power is `(n - 1) / R` of the CORNEA'S OWN anterior surface. Neither of those two
 * quantities appears in it, and the measured answer has the opposite sign: this cornea is steeper
 * than a human one, so its power is at or above human, never under.
 *
 * That defect is not reachable by any assertion about the GLB, because the GLB was correct. It
 * lived entirely in the prose, and prose is where this project has repeatedly put its unmeasured
 * numbers (LEARNINGS 1.5: "verifiers found zero invented constants in code, but several in prose").
 * So this file measures the radius from the shipped assets and then asserts the documents agree
 * with the measurement.
 *
 * THREE KINDS OF CHECK, IN ORDER
 *
 *   1. The instrument, on synthesised geometry where the answer is known by construction. The
 *      load-bearing one is deliberately shaped like the conceptual error: given a shell with a
 *      7.25 mm cap blended into a 15.3 mm globe, a fit to the front cap must recover 7.25 and must
 *      NOT recover 15.3. A measurement that cannot separate the two surfaces cannot catch a claim
 *      that conflates them.
 *   2. The asset, on every shipped figure: the radius, its left/right agreement, and whether the
 *      cap fit is tight enough relative to the sclera fit to be a genuine second radius.
 *   3. The documents: every corneal radius they state must match the measurement, the direction
 *      they claim (steeper or flatter than human) must match the measurement, and the retracted
 *      "under-strength" claim must not reappear as a live assertion.
 *
 * Usage:  node docs/eye-optics-claims.selftest.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} });
const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { fitSphere, splitIntoEyes, positionsOf, FRONT_CAP_DEGREES } =
  await import(path.join(repoRoot, "tools/figure-pipeline/cornea_geometry.mjs"));

// A human anterior cornea. Gullstrand's schematic eye puts it at 7.7 mm; population keratometry
// centres nearer 7.8. Both are quoted because the comparison the docs make is a range against a
// range, and picking one end silently would make the margin look tighter or looser than it is.
const HUMAN_CORNEA_RADIUS_MM = [7.7, 7.8];

// The refractive index of corneal stroma. This is the n in (n - 1) / R for the air->cornea
// interface, and it is NOT the 1.3333 the GLB material carries (that is aqueous) nor the 1.3375 of
// the clinical keratometric convention (which folds in the negative posterior surface).
const CORNEA_INDEX = 1.376;

// The cap fit is only meaningful inside the dome. At 30 degrees the cap has walked onto the sclera
// on the masculine figures and the fit degrades by an order of magnitude — measured 9.088 mm at an
// RMS of 0.3034 mm on g100, against 6.910 mm at 0.0419 mm here. So the gate quotes the same 15
// degrees the dome gate already uses, and asserts the fit stayed tight.
const CAP_FIT_RMS_CEILING_MM = 0.06;

// Left and right eye are the same asset mirrored. Anything above this is an instrument fault, not
// anatomy — measured worst case 0.0162 mm across the sweep.
const LEFT_RIGHT_AGREEMENT_CEILING_MM = 0.05;

// How much tighter the cap fit has to be than the sclera fit before "this is a second radius" is a
// measurement rather than an assertion. Measured 5.9x (g100) to 10.5x (g000).
const CAP_VERSUS_SCLERA_RMS_MULTIPLE = 3;

const SCLERA_BAND_MIN_DEGREES = 40;

let failures = 0;
let checks = 0;

function check(label, condition, detail) {
  checks += 1;
  console.log(`  ${condition ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failures += 1;
}

function heading(text) {
  console.log("");
  console.log(text);
  console.log("-".repeat(text.length));
}

function powerDioptres(index, radiusMm) {
  return (index - 1) / (radiusMm / 1000);
}

// --- geometry helpers ----------------------------------------------------------------------------

/**
 * A tessellated shell facing +Z, in metres, whose front `capExtentDegrees` follow a TIGHTER radius
 * than the rest — which is what a cornea is. The two surfaces are joined by taking whichever radius
 * the ring angle calls for and lifting the transition so the surface stays continuous.
 *
 * Built as a genuine two-radius solid rather than a sphere with a bump, because the question this
 * shape is here to answer is "does a cap fit recover the cap's radius or the globe's" and a bump on
 * a sphere would let a fit split the difference and still look plausible.
 */
function twoRadiusShell({ capRadiusMm, globeRadiusMm, capExtentDegrees, ringCount, segmentCount }) {
  const points = [];
  const capRadius = capRadiusMm / 1000;
  const globeRadius = globeRadiusMm / 1000;

  // The cap's own centre sits forward of the globe's so the two surfaces meet at the join angle.
  const joinAngle = capExtentDegrees * Math.PI / 180;
  const joinZ = globeRadius * Math.cos(joinAngle);
  const joinR = globeRadius * Math.sin(joinAngle);
  const capCentreZ = joinZ - Math.sqrt(Math.max(0, capRadius ** 2 - joinR ** 2));

  for (let ring = 0; ring <= ringCount; ring += 1) {
    const polar = joinAngle * ring / ringCount;
    const z = capCentreZ + capRadius * Math.cos(polar);
    const radial = capRadius * Math.sin(polar);
    pushRing(points, z, radial, ring === 0 ? 1 : segmentCount);
  }
  for (let ring = 1; ring <= ringCount; ring += 1) {
    const polar = joinAngle + (120 * Math.PI / 180 - joinAngle) * ring / ringCount;
    pushRing(points, globeRadius * Math.cos(polar), globeRadius * Math.sin(polar), segmentCount);
  }
  return points;
}

function pushRing(points, z, radial, segmentCount) {
  for (let segment = 0; segment < segmentCount; segment += 1) {
    const azimuth = 2 * Math.PI * segment / segmentCount;
    points.push([radial * Math.cos(azimuth), radial * Math.sin(azimuth), z]);
  }
}

function angleFromAxisDegrees(point, centre, axis) {
  const offset = [point[0] - centre[0], point[1] - centre[1], point[2] - centre[2]];
  const length = Math.hypot(...offset);
  const cosine = Math.max(-1, Math.min(1,
    (offset[0] * axis[0] + offset[1] * axis[1] + offset[2] * axis[2]) / length));
  return Math.acos(cosine) * 180 / Math.PI;
}

/**
 * The measurement itself: fit a sphere to the front cap alone and report its radius.
 *
 * Deliberately NOT the whole-shell fit. A shell that is two radii has no single radius, and the
 * whole-shell fit returns the globe's — which is exactly the number that must not be mistaken for
 * the cornea's. Vertices are welded by position first because the glTF exporter splits them at UV
 * and normal seams, and duplicates would weight the seam rings twice in the least-squares solve.
 */
function measureAnteriorRadiusMm(points, capDegrees = FRONT_CAP_DEGREES) {
  const wholeShell = fitSphere(points);
  const withAngle = points.map((point) => ({
    point, degrees: angleFromAxisDegrees(point, wholeShell.centre, [0, 0, 1])
  }));

  const cap = withAngle.filter((entry) => entry.degrees < capDegrees).map((entry) => entry.point);
  const sclera = withAngle.filter((entry) => entry.degrees >= SCLERA_BAND_MIN_DEGREES)
    .map((entry) => entry.point);

  const capFit = fitSphere(cap);
  const scleraFit = sclera.length >= 4 ? fitSphere(sclera) : null;

  return {
    radiusMm: capFit.radius * 1000,
    capRmsMm: capFit.residualRms * 1000,
    capCount: cap.length,
    wholeShellRadiusMm: wholeShell.radius * 1000,
    scleraRadiusMm: scleraFit ? scleraFit.radius * 1000 : null,
    scleraRmsMm: scleraFit ? scleraFit.residualRms * 1000 : null,
  };
}

function weldByPosition(points) {
  const seen = new Map();
  for (const point of points) {
    const key = point.map((value) => value.toFixed(7)).join(",");
    if (!seen.has(key)) seen.set(key, point);
  }
  return [...seen.values()];
}

// --- 1. the instrument, on shapes whose answer is known by construction --------------------------

heading("1. the instrument");

{
  const sphere = twoRadiusShell({
    capRadiusMm: 12.7, globeRadiusMm: 12.7, capExtentDegrees: 15, ringCount: 14, segmentCount: 16
  });
  const measured = measureAnteriorRadiusMm(sphere);
  check("a single-radius shell reads its own radius",
    Math.abs(measured.radiusMm - 12.7) < 0.001, `${measured.radiusMm.toFixed(6)} mm, wanted 12.7`);
}

{
  // THE CHECK THIS FILE EXISTS FOR. Cap 7.25 mm inside a 15.3 mm globe — the shipped asset's own
  // two numbers. Recovering 15.3 here is the exact mistake PROGRESS.md made in prose.
  const shell = twoRadiusShell({
    capRadiusMm: 7.25, globeRadiusMm: 15.3, capExtentDegrees: 20, ringCount: 14, segmentCount: 16
  });
  const measured = measureAnteriorRadiusMm(shell);

  check("a two-radius shell reads the CAP radius, not the globe's",
    Math.abs(measured.radiusMm - 7.25) < 0.05,
    `${measured.radiusMm.toFixed(4)} mm, wanted 7.25`);
  check("and is nowhere near the globe radius it would be confused with",
    Math.abs(measured.radiusMm - 15.3) > 5,
    `globe is ${measured.wholeShellRadiusMm.toFixed(3)} mm on a whole-shell fit`);

  // The whole-shell fit is the wrong instrument, and this records by how much rather than asserting
  // it is wrong in the abstract: it lands between the two radii and belongs to neither surface.
  check("a whole-shell fit does NOT answer this question",
    Math.abs(measured.wholeShellRadiusMm - 7.25) > 1,
    `whole-shell ${measured.wholeShellRadiusMm.toFixed(3)} mm against a true cap of 7.25 mm`);
}

{
  // Chamber depth cannot enter the radius. Same cap, pushed 1 mm further forward on a deeper globe:
  // the anterior chamber changes, the corneal power must not.
  const shallow = measureAnteriorRadiusMm(twoRadiusShell({
    capRadiusMm: 7.25, globeRadiusMm: 15.3, capExtentDegrees: 20, ringCount: 14, segmentCount: 16
  }));
  const deep = measureAnteriorRadiusMm(twoRadiusShell({
    capRadiusMm: 7.25, globeRadiusMm: 12.0, capExtentDegrees: 20, ringCount: 14, segmentCount: 16
  }));
  check("changing the globe radius leaves the corneal radius alone",
    Math.abs(shallow.radiusMm - deep.radiusMm) < 0.05,
    `${shallow.radiusMm.toFixed(4)} mm on a 15.3 mm globe, ${deep.radiusMm.toFixed(4)} mm on a 12.0 mm globe`);
}

{
  const power = powerDioptres(CORNEA_INDEX, 7.7);
  check("the power formula reproduces the human reference",
    Math.abs(power - 48.83) < 0.01, `${power.toFixed(3)} D at R 7.7 mm, n ${CORNEA_INDEX}`);
  check("power scales as 1/R, so a steeper cornea is a STRONGER one",
    powerDioptres(CORNEA_INDEX, 6.9) > powerDioptres(CORNEA_INDEX, 7.7),
    `${powerDioptres(CORNEA_INDEX, 6.9).toFixed(2)} D at 6.9 mm > ` +
    `${powerDioptres(CORNEA_INDEX, 7.7).toFixed(2)} D at 7.7 mm`);
}

// --- 2. the asset ---------------------------------------------------------------------------------

heading("2. the shipped figures");

const figureDirectory = path.join(repoRoot, "assets/figures");
const figureFiles = fs.existsSync(figureDirectory)
  ? fs.readdirSync(figureDirectory).filter((name) => name.endsWith(".glb")).sort()
  : [];

check("there are figures to measure", figureFiles.length > 0,
  `${figureFiles.length} in assets/figures — run tools/figure-pipeline/build.sh if zero`);

const measuredByFigure = new Map();

for (const file of figureFiles) {
  const bytes = fs.readFileSync(path.join(figureDirectory, file));
  const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "", resolve, reject));

  const meshes = [];
  gltf.scene.traverse((object) => { if (object.isMesh || object.isSkinnedMesh) meshes.push(object); });
  const cornea = meshes.find((mesh) => /cornea/i.test(mesh.name));

  const key = file.replace(/^figure_|\.glb$/g, "");
  if (!cornea) {
    check(`${key} has a corneal shell to measure`, false, "no mesh matching /cornea/");
    continue;
  }

  const eyes = splitIntoEyes(weldByPosition(positionsOf(cornea.geometry)));
  const left = measureAnteriorRadiusMm(eyes.left);
  const right = measureAnteriorRadiusMm(eyes.right);
  measuredByFigure.set(key, { left, right });

  const power = powerDioptres(CORNEA_INDEX, left.radiusMm);
  console.log(`  .... ${key}: R ${left.radiusMm.toFixed(3)} / ${right.radiusMm.toFixed(3)} mm, ` +
              `cap RMS ${left.capRmsMm.toFixed(4)} mm, sclera R ${left.scleraRadiusMm.toFixed(3)} mm ` +
              `(RMS ${left.scleraRmsMm.toFixed(4)}), ${power.toFixed(2)} D at n ${CORNEA_INDEX}`);

  check(`${key} left and right corneas agree`,
    Math.abs(left.radiusMm - right.radiusMm) < LEFT_RIGHT_AGREEMENT_CEILING_MM,
    `${Math.abs(left.radiusMm - right.radiusMm).toFixed(4)} mm apart, ceiling ` +
    `${LEFT_RIGHT_AGREEMENT_CEILING_MM}`);

  check(`${key} the cap fit stayed inside the dome`,
    left.capRmsMm < CAP_FIT_RMS_CEILING_MM && right.capRmsMm < CAP_FIT_RMS_CEILING_MM,
    `RMS ${Math.max(left.capRmsMm, right.capRmsMm).toFixed(4)} mm, ceiling ${CAP_FIT_RMS_CEILING_MM}`);

  check(`${key} the cornea is a genuine second radius, not fit noise`,
    left.scleraRmsMm / left.capRmsMm >= CAP_VERSUS_SCLERA_RMS_MULTIPLE,
    `sclera fit is ${(left.scleraRmsMm / left.capRmsMm).toFixed(1)}x looser than the cap fit, ` +
    `needs ${CAP_VERSUS_SCLERA_RMS_MULTIPLE}x`);

  // The direction claim, stated as a gate rather than as prose. This is the assertion whose
  // opposite was committed to PROGRESS.md for a phase.
  check(`${key} is STEEPER than a human cornea, so stronger not weaker`,
    left.radiusMm < HUMAN_CORNEA_RADIUS_MM[0],
    `R ${left.radiusMm.toFixed(3)} mm < ${HUMAN_CORNEA_RADIUS_MM[0]} mm, ` +
    `${power.toFixed(2)} D against ${powerDioptres(CORNEA_INDEX, HUMAN_CORNEA_RADIUS_MM[0]).toFixed(2)} D`);
}

const allRadii = [...measuredByFigure.values()].flatMap((eye) => [eye.left.radiusMm, eye.right.radiusMm]);
const measuredSpan = allRadii.length
  ? { min: Math.min(...allRadii), max: Math.max(...allRadii) }
  : { min: NaN, max: NaN };

// --- 3. the documents -----------------------------------------------------------------------------

heading("3. the documents");

const DOCUMENTS = [
  { label: "PROGRESS.md", file: "docs/PROGRESS.md" },
  { label: "LEARNINGS.md", file: "docs/LEARNINGS.md" },
  { label: "figure-pipeline README", file: "tools/figure-pipeline/README.md" },
];

// Table rows of the form `| g050 | 7.252 / 7.236 mm | ...`, which is how PROGRESS.md and the README
// publish the per-figure radius. Anything stated has to match what the asset measures.
const RADIUS_ROW = /^\|\s*(g\d{3})\s*\|\s*([\d.]+)\s*\/\s*([\d.]+)\s*mm\s*\|/gm;

// The span form, `6.91–7.64 mm`, which is how LEARNINGS.md states it. En dash, because that is what
// the docs use throughout; a hyphen here would silently match nothing.
const RADIUS_SPAN = /\*\*Corneal radius of curvature:\s*([\d.]+)–([\d.]+)\s*mm\*\*/;

// The retracted claim. It is allowed to appear, because PROGRESS.md quotes it inside a retraction —
// keeping how a wrong conclusion was written down is the house style. What is NOT allowed is for it
// to appear as a live assertion, so every occurrence must sit in a paragraph that marks it dead.
const RETRACTED_CLAIM = /corneal power[^.]{0,80}under-strength/gi;
const RETRACTION_MARKERS = ["superseded", "previously read", "was wrong", "🚩"];
const RETRACTION_CONTEXT_CHARS = 900;

for (const document of DOCUMENTS) {
  const text = fs.readFileSync(path.join(repoRoot, document.file), "utf8");
  let statedRows = 0;

  for (const match of text.matchAll(RADIUS_ROW)) {
    const [, figure, statedLeft, statedRight] = match;
    const measured = measuredByFigure.get(figure);
    if (!measured) {
      check(`${document.label} states ${figure}, which exists`, false, "no such figure was measured");
      continue;
    }
    statedRows += 1;
    const leftOff = Math.abs(Number(statedLeft) - measured.left.radiusMm);
    const rightOff = Math.abs(Number(statedRight) - measured.right.radiusMm);
    check(`${document.label} ${figure} radius matches the asset`,
      leftOff < 0.001 && rightOff < 0.001,
      `states ${statedLeft} / ${statedRight}, measures ` +
      `${measured.left.radiusMm.toFixed(3)} / ${measured.right.radiusMm.toFixed(3)}`);
  }

  const span = text.match(RADIUS_SPAN);
  if (span) {
    statedRows += 1;
    check(`${document.label} states the radius span correctly`,
      Math.abs(Number(span[1]) - measuredSpan.min) < 0.005 &&
      Math.abs(Number(span[2]) - measuredSpan.max) < 0.005,
      `states ${span[1]}–${span[2]}, measures ` +
      `${measuredSpan.min.toFixed(3)}–${measuredSpan.max.toFixed(3)}`);
  }

  check(`${document.label} records the corneal radius at all`, statedRows > 0,
    statedRows > 0
      ? `${statedRows} stated value${statedRows === 1 ? "" : "s"}, all checked above`
      : "not one corneal radius anywhere — this is the gap that let the defect through");

  for (const match of text.matchAll(RETRACTED_CLAIM)) {
    const from = Math.max(0, match.index - RETRACTION_CONTEXT_CHARS);
    const context = text.slice(from, match.index + RETRACTION_CONTEXT_CHARS).toLowerCase();
    const marked = RETRACTION_MARKERS.some((marker) => context.includes(marker.toLowerCase()));
    check(`${document.label} the "under-strength" claim is marked as retracted`, marked,
      marked ? "quoted inside its retraction" :
        `live at index ${match.index}: "${match[0]}" — the asset measures the opposite sign`);
  }
}

// --- result ---------------------------------------------------------------------------------------

console.log("");
console.log("=".repeat(98));
console.log(`corneal radius measured on the front ${FRONT_CAP_DEGREES}° cap alone: ` +
            `${measuredSpan.min.toFixed(3)}–${measuredSpan.max.toFixed(3)} mm, against a human ` +
            `${HUMAN_CORNEA_RADIUS_MM[0]}–${HUMAN_CORNEA_RADIUS_MM[1]} mm — ` +
            `${powerDioptres(CORNEA_INDEX, measuredSpan.max).toFixed(2)}–` +
            `${powerDioptres(CORNEA_INDEX, measuredSpan.min).toFixed(2)} D against ` +
            `${powerDioptres(CORNEA_INDEX, HUMAN_CORNEA_RADIUS_MM[1]).toFixed(2)}–` +
            `${powerDioptres(CORNEA_INDEX, HUMAN_CORNEA_RADIUS_MM[0]).toFixed(2)} D`);
if (failures === 0) {
  console.log(`PASS — ${checks} checks.`);
  process.exit(0);
}
console.log(`FAIL — ${failures} of ${checks} checks failed.`);
process.exit(1);
