/**
 * Gate for punch-list item 0.3: prove a built figure really carries the 52 canonical ARKit
 * morph targets, addressable by name, both in the file and after three.js has loaded it.
 *
 * Two independent checks, deliberately:
 *
 *   1. The GLB container is parsed by hand. The JSON chunk is the ground truth about what was
 *      written, with no loader between us and the bytes.
 *   2. three.js GLTFLoader.parse() then loads the same buffer and we read
 *      mesh.morphTargetDictionary — because "addressable by name in three.js" is the actual
 *      requirement, and glTF only preserves names through a mesh 'extras.targetNames' array
 *      that a loader is free to ignore.
 *
 * Usage:  node tools/figure-pipeline/verify_glb.mjs assets/figures/figure_g050.glb
 *         node tools/figure-pipeline/verify_glb.mjs            (verifies every figure)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// three's GLTFLoader assumes a browser when it decodes embedded textures: it reads `self.URL`
// and hands the resulting blob URL to createImageBitmap. Nothing here inspects pixels, so the
// two smallest possible stubs let the loader finish and get us to the morph data.
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} });

const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");

const {
  measureCornealDome, measureAnteriorChamberMm, splitIntoEyes, positionsOf,
  DOME_NOISE_MULTIPLE, FRONT_CAP_DEGREES, POSTERIOR_BAND_MIN_DEGREES,
} = await import("./cornea_geometry.mjs");

const ARKIT_52 = [
  "browDownLeft", "browDownRight", "browInnerUp", "browOuterUpLeft", "browOuterUpRight",
  "cheekPuff", "cheekSquintLeft", "cheekSquintRight",
  "eyeBlinkLeft", "eyeBlinkRight", "eyeLookDownLeft", "eyeLookDownRight",
  "eyeLookInLeft", "eyeLookInRight", "eyeLookOutLeft", "eyeLookOutRight",
  "eyeLookUpLeft", "eyeLookUpRight", "eyeSquintLeft", "eyeSquintRight",
  "eyeWideLeft", "eyeWideRight",
  "jawForward", "jawLeft", "jawOpen", "jawRight",
  "mouthClose", "mouthDimpleLeft", "mouthDimpleRight", "mouthFrownLeft", "mouthFrownRight",
  "mouthFunnel", "mouthLeft", "mouthLowerDownLeft", "mouthLowerDownRight",
  "mouthPressLeft", "mouthPressRight", "mouthPucker", "mouthRight",
  "mouthRollLower", "mouthRollUpper", "mouthShrugLower", "mouthShrugUpper",
  "mouthSmileLeft", "mouthSmileRight", "mouthStretchLeft", "mouthStretchRight",
  "mouthUpperUpLeft", "mouthUpperUpRight",
  "noseSneerLeft", "noseSneerRight", "tongueOut",
];

const OVR_VISEMES = [
  "viseme_aa", "viseme_CH", "viseme_DD", "viseme_E", "viseme_FF", "viseme_I", "viseme_kk",
  "viseme_nn", "viseme_O", "viseme_PP", "viseme_RR", "viseme_sil", "viseme_SS", "viseme_TH",
  "viseme_U",
];

// The two halves of the eyeball. MakeHuman names its eyeball proxies for their topology rather
// than their anatomy, so the globe arrives as "high-poly"; the corneal shell is split off it by
// build_figure.py and named for what it is. Both patterns keep the superseded "low-poly" and a
// plain "eyeball" as alternatives so this gate still recognises an older or hand-built figure —
// and, on such a figure, fails it for having no cornea rather than silently skipping the check.
const EYEBALL_GLOBE_PATTERN = /high-poly|low-poly|eyeball/i;
const EYEBALL_CORNEA_PATTERN = /cornea/i;

// What the runtime needs from the corneal material: a refracting dielectric, not a blended
// surface. A blended material writes no depth, which is the defect the whole material pass in
// build_figure.py exists to prevent, so the cornea travels as alphaMode OPAQUE carrying
// KHR_materials_transmission instead. See docs/research/eyes-and-lighting.md §1.
const CORNEA_MIN_TRANSMISSION = 0.9;
const CORNEA_IOR_RANGE = [1.333, 1.400];

// The anterior chamber: how far in front of the globe the corneal apex has to sit before there is
// a gap for a refracted ray to cross. Measured across the five shipping figures it runs 2.150 mm
// (g100) to 2.402 mm (g000); a real eye is nearer 3 mm. 0.5 mm is a floor that a collapsed or
// inverted split cannot clear, not a target.
//
// This check exists because the dome check above structurally cannot catch an inverted split — put
// the globe on the cornea material and the cornea on the globe material and the corneal shell is
// still domed, still measured, still passes. Only the sign of the gap between the two shells
// changes. See docs/LEARNINGS.md 1.11: the answer to "my gate cannot catch this" is a different
// kind of assertion, not a tighter threshold.
const MINIMUM_ANTERIOR_CHAMBER_MM = 0.5;

const GLB_MAGIC = 0x46546c67;          // "glTF"
const CHUNK_TYPE_JSON = 0x4e4f534a;    // "JSON"
const CHUNK_TYPE_BIN = 0x004e4942;     // "BIN\0"

/** Splits a .glb into its JSON chunk and its binary chunk without any glTF library. */
function readGlbContainer(fileBuffer) {
  const view = new DataView(fileBuffer.buffer, fileBuffer.byteOffset, fileBuffer.byteLength);

  const magic = view.getUint32(0, true);
  if (magic !== GLB_MAGIC) {
    throw new Error("Not a GLB: magic header is not 'glTF'.");
  }

  const version = view.getUint32(4, true);
  const totalLength = view.getUint32(8, true);

  let json = null;
  let binaryLength = 0;
  let offset = 12;

  while (offset < totalLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;

    if (chunkType === CHUNK_TYPE_JSON) {
      const bytes = new Uint8Array(fileBuffer.buffer, fileBuffer.byteOffset + chunkStart, chunkLength);
      json = JSON.parse(new TextDecoder().decode(bytes));
    } else if (chunkType === CHUNK_TYPE_BIN) {
      binaryLength = chunkLength;
    }

    offset = chunkStart + chunkLength;
  }

  if (json === null) {
    throw new Error("GLB has no JSON chunk.");
  }

  return { version, json, binaryLength };
}

/** Reports what each mesh in the glTF JSON contains: vertices, morph count, morph names. */
function summariseMeshes(gltfJson) {
  const meshes = [];

  for (const mesh of gltfJson.meshes ?? []) {
    // Blender writes one primitive per material; morph target names live on the mesh, not the
    // primitive, so they are shared across primitives by design.
    const targetNames = mesh.extras?.targetNames ?? [];

    let vertexCount = 0;
    let morphTargetCount = 0;
    for (const primitive of mesh.primitives ?? []) {
      vertexCount += gltfJson.accessors[primitive.attributes.POSITION].count;
      morphTargetCount = Math.max(morphTargetCount, (primitive.targets ?? []).length);
    }

    meshes.push({ name: mesh.name, vertexCount, morphTargetCount, targetNames });
  }

  return meshes;
}

/** Vertices whose bone weights all sum to zero — present in the skin, but pinned to the bind pose.
 *
 * A mesh can carry a full JOINTS_0/WEIGHTS_0 pair and still have vertices nothing drives, which
 * is the quiet half of the unskinned-face bug: the part travels with the head except for the
 * strip that stays behind, tearing it open.
 */
function countUnweightedVertices(geometry) {
  const weights = geometry.attributes.skinWeight;
  if (!weights) {
    return 0;
  }

  let unweighted = 0;
  for (let index = 0; index < weights.count; index += 1) {
    const total = weights.getX(index) + weights.getY(index) +
                  weights.getZ(index) + weights.getW(index);
    if (total <= 0) {
      unweighted += 1;
    }
  }

  return unweighted;
}

/** Loads the buffer through three.js and reports what the runtime will actually get per mesh. */
async function readMeshesViaThree(fileBuffer) {
  const loader = new GLTFLoader();
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);

  const gltf = await new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, "", resolve, reject);
  });

  const perMesh = [];
  gltf.scene.traverse((object) => {
    if (!object.isMesh) {
      return;
    }
    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    const isEyePart = EYEBALL_GLOBE_PATTERN.test(object.name) ||
                      EYEBALL_CORNEA_PATTERN.test(object.name);
    perMesh.push({
      name: object.name,
      materialName: material.name,
      morphNames: Object.keys(object.morphTargetDictionary ?? {}),
      isSkinnedMesh: object.isSkinnedMesh === true,
      hasSkeleton: Boolean(object.skeleton),
      unweightedVertexCount: countUnweightedVertices(object.geometry),
      transparent: material.transparent,
      depthWrite: material.depthWrite,
      alphaTest: material.alphaTest,
      side: material.side,
      transmission: material.transmission,
      ior: material.ior,
      // Only the eye parts, because this is the one place the gate measures shape rather than
      // metadata and there is no reason to copy 13,380 body vertices to do it.
      positions: isEyePart ? positionsOf(object.geometry) : null,
      // The lip seal needs the BODY and the TEETH, and it needs the jawOpen delta as well as the
      // rest positions. Kept behind a name test for the same reason as above.
      mouthGeometry: LIP_SEAL_MESHES.some((pattern) => pattern.test(object.name))
        ? { positions: positionsOf(object.geometry), jawOpen: jawOpenDeltasOf(object) }
        : null,
      // Counted here rather than in the clause, because this is the only place the loaded
      // geometry is in hand. An empty list on a body is what a build with export_attributes
      // left off produces, and it is indistinguishable from a nude figure without the manifest.
      hideMasks: hideMasksOf(object.geometry),
    });
  });

  return perMesh;
}

/** Every `_HIDE_*` attribute on a geometry, with how many vertices each one flags.
 *
 * Case-insensitive by construction: the exporter upper-cases what the build authored in
 * lower-case, so neither spelling can be the one to match on.
 */
function hideMasksOf(geometry) {
  const masks = [];
  const vertexCount = geometry.attributes.position.count;

  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    if (!name.toLowerCase().startsWith("_hide_")) {
      continue;
    }

    let flagged = 0;
    for (let vertex = 0; vertex < vertexCount; vertex += 1) {
      if (attribute.getX(vertex) > 0.5) {
        flagged += 1;
      }
    }

    masks.push({ name, flagged, vertexCount });
  }

  return masks.sort((first, second) => first.name.localeCompare(second.name));
}

// --- the lip seal ---------------------------------------------------------------------------
//
// docs/LEARNINGS.md §1.1 records teeth drawing through closed lips once already, from alphaMode
// BLEND. That cause is fixed and gated below (reportMaterials / reportRuntimeMaterials). The band
// came back anyway in round 7, and it is a DIFFERENT defect with the same appearance: the mouth is
// genuinely open. Measured on a 2160x2700 alive.html portrait — a hard row of upper teeth across
// the whole lip line, with the dark oral cavity visible above it — while the SAME GLB on eye.html,
// which applies no pose and no morphs, renders a sealed mouth. So the asset seals and something
// opens it.
//
// What this gate can assert, and the only thing it should, is the asset's half of that: the mouth
// must be SHUT with all morphs at zero, and the upper teeth must be tucked behind the lip by a
// real margin rather than sitting flush with it. Two numbers, both measured off the mesh:
//
//   aperture       the vertical gap at the midline lip seam, morphs at zero. 0.02 mm on all five
//                  shipping figures — the lips are in contact.
//   seal margin    how far the upper arch's front biting edge sits ABOVE that seam. 0.98 mm (g100)
//                  to 1.53 mm (g000). It is the depth of cover the lips have over the teeth, and
//                  it is what an animation layer is spending when it opens the jaw.
//
// The margin is also the number a motion layer needs: jawOpen drops the lower lip 32.9-34.8 mm per
// unit weight, so the weight at which the teeth become visible is margin / that — 0.028 (g100) to
// 0.045 (g000). Any idle layer writing jawOpen above ~0.02 will show teeth on this asset. That
// belongs in the layer, not here; this gate exists so a future asset cannot ship with the margin
// already spent.
//
// ⚠️ WHAT THIS GATE DOES NOT COVER, measured and stated rather than left to be discovered. It reads
// the MIDLINE column only. Rendered at a 60 mm frame with every morph at zero, the shipped figure
// already shows 364 desaturated pixels above luma 0.80 in a 670x80 strip on the lip line — a
// hairline of enamel, invisible at portrait framing but real. The midline aperture at that same
// moment reads 0.022 mm. So the leak is OFF-CENTRE and this gate cannot see it. A slice-wise
// version was written and withdrawn in the same round: at ~5 mm a slice the columns are too sparse
// for the delta-split seam finder and it reported 1-4 mm apertures on four of five figures, which
// is measurably wrong against the render. Fixing it needs the seam found from the mesh's edge
// topology rather than from a sorted column. Until then this gate covers the midline, and it says
// so in its own output.
const LIP_SEAL_MESHES = [/^Human$/i, /body/i, /base/i, /teeth/i];

const MIDLINE_HALF_WIDTH_M = 0.006;
const MOUTH_FRONT_MIN_Z_M = 0.090;
const ARCH_FRONT_MIN_Z_M = 0.125;
const ARCH_HALF_WIDTH_M = 0.020;

// Bands. The aperture ceiling is 20x the measured 0.02 mm, so a real gap fails and float noise
// does not. The margin floor is 0.5 mm against a measured 0.98-1.53 mm — half the tightest
// shipping figure, so it rejects a flush or protruding arch without pinning the art.
const MAX_NEUTRAL_APERTURE_MM = 0.4;
const MIN_SEAL_MARGIN_MM = 0.5;

/** The jawOpen morph's per-vertex Y displacement, or null if this mesh does not carry it. */
function jawOpenDeltasOf(mesh) {
  const index = mesh.morphTargetDictionary?.jawOpen;
  if (index === undefined) {
    return null;
  }
  const attribute = mesh.geometry.morphAttributes.position?.[index];
  if (!attribute) {
    return null;
  }
  const out = new Float64Array(attribute.count);
  for (let vertex = 0; vertex < attribute.count; vertex += 1) {
    out[vertex] = attribute.getY(vertex);
  }
  return out;
}

/**
 * The two lip-seal numbers for one figure.
 *
 * The SEAM is found from the jawOpen field rather than from the shape, and that is the load-bearing
 * choice: on a closed mouth the upper and lower lip vertices are geometrically coincident, so there
 * is no gap to look for. What separates them is that the upper lip barely moves when the jaw opens
 * and the lower lip follows it — so the seam is the adjacent pair, top to bottom down the midline,
 * whose jawOpen deltas differ most. That works on a sealed mouth precisely because it does not use
 * the seal.
 */
function measureLipSeal(body, teeth) {
  if (!body?.jawOpen || !teeth?.positions) {
    return { measured: false };
  }

  const teethY = teeth.positions.map((point) => point[1]);
  const bandLow = Math.min(...teethY) - 0.010;
  const bandHigh = Math.max(...teethY) + 0.010;

  const column = [];
  for (let vertex = 0; vertex < body.positions.length; vertex += 1) {
    const [x, y, z] = body.positions[vertex];
    if (Math.abs(x) > MIDLINE_HALF_WIDTH_M) continue;
    if (y < bandLow || y > bandHigh) continue;
    if (z < MOUTH_FRONT_MIN_Z_M) continue;
    column.push({ y, delta: body.jawOpen[vertex] });
  }

  if (column.length < 8) {
    return { measured: false, columnCount: column.length };
  }

  column.sort((a, b) => b.y - a.y);

  let seam = null;
  for (let i = 0; i + 1 < column.length; i += 1) {
    const split = Math.abs(column[i + 1].delta - column[i].delta);
    if (!seam || split > seam.split) {
      seam = { split, upper: column[i], lower: column[i + 1] };
    }
  }

  // The upper arch is the tooth geometry jawOpen does not move.
  let archEdge = Infinity;
  for (let vertex = 0; vertex < teeth.positions.length; vertex += 1) {
    const [x, y, z] = teeth.positions[vertex];
    if (Math.abs(x) > ARCH_HALF_WIDTH_M) continue;
    if (z < ARCH_FRONT_MIN_Z_M) continue;
    if (teeth.jawOpen && Math.abs(teeth.jawOpen[vertex]) >= 0.002) continue;
    if (y < archEdge) archEdge = y;
  }

  return {
    measured: Number.isFinite(archEdge),
    apertureMm: (seam.upper.y - seam.lower.y) * 1000,
    sealMarginMm: (archEdge - seam.upper.y) * 1000,
    dropPerUnitWeightMm: seam.split * 1000,
    seamY: seam.upper.y,
  };
}

function reportLipSeal(threeMeshes) {
  const failures = [];
  console.log("");
  console.log("--- assertions on the lip seal ---");

  const body = threeMeshes.find((mesh) => mesh.mouthGeometry && /teeth/i.test(mesh.name) === false);
  const teeth = threeMeshes.find((mesh) => mesh.mouthGeometry && /teeth/i.test(mesh.name));

  if (!body?.mouthGeometry || !teeth?.mouthGeometry) {
    console.log("  FAIL cannot measure the lip seal: " +
                `${body ? "" : "no body mesh"}${!body && !teeth ? " and " : ""}${teeth ? "" : "no teeth mesh"}`);
    failures.push("lip seal not measurable");
    return failures;
  }

  const seal = measureLipSeal(body.mouthGeometry, teeth.mouthGeometry);

  if (!seal.measured) {
    console.log(`  FAIL the mouth region has too little geometry to measure ` +
                `(${seal.columnCount ?? 0} midline vertices)`);
    failures.push("lip seal not measurable");
    return failures;
  }

  const shut = seal.apertureMm <= MAX_NEUTRAL_APERTURE_MM;
  console.log(`  ${shut ? "ok  " : "FAIL"} neutral mouth is shut at the midline: lip aperture ` +
              `${seal.apertureMm.toFixed(3)} mm with every morph at zero, needs ` +
              `<= ${MAX_NEUTRAL_APERTURE_MM} mm`);
  if (!shut) {
    failures.push("the neutral mouth is open");
  }

  const covered = seal.sealMarginMm >= MIN_SEAL_MARGIN_MM;
  console.log(`  ${covered ? "ok  " : "FAIL"} upper teeth are covered: the front biting edge sits ` +
              `${seal.sealMarginMm.toFixed(3)} mm above the lip seam, needs ` +
              `>= ${MIN_SEAL_MARGIN_MM} mm — below that the teeth are flush with the lip line and ` +
              "any jaw motion at all exposes them");
  if (!covered) {
    failures.push("the upper teeth are not covered by the lip");
  }

  // Not an assertion, a published constant: the jawOpen weight at which this figure starts to show
  // teeth. A motion layer has no other way to know it, and getting it wrong is the round-7 defect.
  const threshold = seal.sealMarginMm / seal.dropPerUnitWeightMm;
  console.log(`  note jawOpen drops the lower lip ${seal.dropPerUnitWeightMm.toFixed(1)} mm per ` +
              `unit weight, so teeth first show at jawOpen ≈ ${threshold.toFixed(4)}`);

  return failures;
}

function reportMissing(label, required, present) {
  const missing = required.filter((name) => !present.includes(name));
  if (missing.length === 0) {
    console.log(`  OK   ${label}: all ${required.length} present`);
  } else {
    console.log(`  FAIL ${label}: ${missing.length} of ${required.length} missing`);
    console.log(`       ${missing.join(", ")}`);
  }
  return missing;
}

async function verifyFigure(glbPath, wardrobe = null) {
  console.log("");
  console.log("=".repeat(78));
  console.log(glbPath);
  console.log("=".repeat(78));

  const fileBuffer = fs.readFileSync(glbPath);
  const { version, json, binaryLength } = readGlbContainer(fileBuffer);

  console.log(`glTF version    : ${version}`);
  console.log(`file size       : ${fileBuffer.byteLength.toLocaleString()} bytes ` +
              `(${binaryLength.toLocaleString()} binary)`);
  console.log(`generator       : ${json.asset?.generator ?? "unknown"}`);
  console.log(`meshes          : ${(json.meshes ?? []).length}`);
  console.log("");

  const meshes = summariseMeshes(json);
  const skinnedBody = meshes.reduce(
    (largest, mesh) => (mesh.vertexCount > largest.vertexCount ? mesh : largest), meshes[0]);

  console.log("--- GLB container (parsed directly from the JSON chunk) ---");
  for (const mesh of meshes) {
    console.log(`  ${mesh.name.padEnd(24)} ${String(mesh.vertexCount).padStart(7)} verts   ` +
                `${String(mesh.morphTargetCount).padStart(3)} morph targets   ` +
                `${mesh.targetNames.length} names`);
  }
  console.log("");
  console.log(`Body mesh: ${skinnedBody.name}`);
  console.log(`  vertex count       : ${skinnedBody.vertexCount.toLocaleString()}`);
  console.log(`  morph target count : ${skinnedBody.morphTargetCount}`);
  console.log("");
  console.log("  morph target names:");
  skinnedBody.targetNames.forEach((name, index) => {
    console.log(`    ${String(index).padStart(3)}. ${name}`);
  });
  console.log("");

  const failures = [];
  console.log("--- assertions against the container ---");
  failures.push(...reportMissing("ARKit-52", ARKIT_52, skinnedBody.targetNames));
  failures.push(...reportMissing("OVR visemes", OVR_VISEMES, skinnedBody.targetNames));

  if (skinnedBody.targetNames.length !== skinnedBody.morphTargetCount) {
    console.log(`  FAIL name/target mismatch: ${skinnedBody.targetNames.length} names for ` +
                `${skinnedBody.morphTargetCount} targets`);
    failures.push("name/target count mismatch");
  }

  console.log("");
  console.log("--- assertions after three.js GLTFLoader.parse() ---");
  const threeMeshes = await readMeshesViaThree(fileBuffer);
  const threeBody = threeMeshes.find((mesh) => mesh.morphNames.includes("jawOpen"));

  if (!threeBody) {
    console.log("  FAIL three.js produced no mesh with a 'jawOpen' morph");
    failures.push("three.js lost the morph names");
  } else {
    console.log(`  three.js mesh      : ${threeBody.name}`);
    console.log(`  morphTargetDict    : ${threeBody.morphNames.length} entries`);
    failures.push(...reportMissing("ARKit-52 in three.js", ARKIT_52, threeBody.morphNames));
    failures.push(...reportMissing("OVR visemes in three.js", OVR_VISEMES, threeBody.morphNames));
  }

  console.log("");
  console.log(`meshes carrying morphs in three.js: ${threeMeshes.length}`);
  for (const mesh of threeMeshes) {
    console.log(`  ${mesh.name.padEnd(24)} ${mesh.morphNames.length} morphs`);
  }

  failures.push(...reportFaceParts(meshes));
  failures.push(...reportSkinning(json, threeMeshes));
  failures.push(...reportMaterials(json, threeMeshes, wardrobe));
  failures.push(...reportHideMasks(json, threeMeshes, wardrobe));
  failures.push(...reportEyeGeometry(threeMeshes));
  failures.push(...reportLipSeal(threeMeshes));

  return failures;
}

// The eyes are the only part of this figure whose SHAPE is load-bearing rather than incidental,
// and the only part where a wrong shape is invisible in every other assertion here.
//
// docs/research/eyes-and-lighting.md §1 states a geometry contract, not just an algorithm: cornea
// refraction traces a ray through a corneal dome into a flat iris plane, and its power scales as
// 1/R. The figure shipped for two phases with an eyeball proxy that had no dome at all — a sphere
// with a flat octagonal facet recessed 0.131 mm where the pupil goes — and every assertion above
// stayed green, because morph names, skinning and alpha modes are all perfect on a sphere.
//
// So these three checks assert the shape directly. A regression here means the eye shader silently
// delivers half its intended corneal power and an octagonal catchlight, which is exactly the kind
// of half-working that a name-and-metadata gate is structurally blind to.
function reportEyeGeometry(threeMeshes) {
  const failures = [];

  console.log("");
  console.log("--- assertions on eye geometry ---");

  const cornea = threeMeshes.find((mesh) => EYEBALL_CORNEA_PATTERN.test(mesh.name));
  const globe = threeMeshes.find((mesh) => EYEBALL_GLOBE_PATTERN.test(mesh.name));

  if (!cornea || !globe) {
    console.log(`  FAIL the figure has ${cornea ? "" : "no corneal shell"}` +
                `${!cornea && !globe ? " and " : ""}${globe ? "" : "no eyeball globe"} — ` +
                "there is nothing to refract through");
    failures.push("eye shells missing");
    return failures;
  }

  const corneaEyes = splitIntoEyes(cornea.positions);
  const globeEyes = splitIntoEyes(globe.positions);

  for (const side of ["left", "right"]) {
    const dome = measureCornealDome(corneaEyes[side]);

    if (!dome.measured) {
      console.log(`  FAIL ${side} cornea: too few vertices to measure ` +
                  `(${dome.frontCapCount} in the front cap, ${dome.posteriorCount} behind ` +
                  `${POSTERIOR_BAND_MIN_DEGREES}°)`);
      failures.push(`${side} corneal dome not measurable`);
      continue;
    }

    const threshold = DOME_NOISE_MULTIPLE * dome.noiseMm;
    const verdict = dome.hasDome ? "ok  " : "FAIL";
    console.log(`  ${verdict} ${side} corneal dome: the front ${FRONT_CAP_DEGREES}° cap sits ` +
                `${dome.meanProudMm.toFixed(3)} mm proud of a sphere fitted to the sclera ` +
                `(R ${dome.posteriorRadiusMm.toFixed(3)} mm, RMS ${dome.noiseMm.toFixed(3)} mm), ` +
                `${dome.domeRatio.toFixed(2)}x noise, needs ${DOME_NOISE_MULTIPLE}x ` +
                `(${threshold.toFixed(3)} mm)`);
    if (!dome.hasDome) {
      failures.push(`${side} eye has no corneal dome`);
    }

    const chamberMm = measureAnteriorChamberMm(corneaEyes[side], globeEyes[side]);
    const chamberOk = chamberMm >= MINIMUM_ANTERIOR_CHAMBER_MM;
    console.log(`  ${chamberOk ? "ok  " : "FAIL"} ${side} anterior chamber: the corneal apex ` +
                `sits ${chamberMm.toFixed(3)} mm in front of the globe's, needs ` +
                `${MINIMUM_ANTERIOR_CHAMBER_MM} mm`);
    if (!chamberOk) {
      failures.push(`${side} eye has no anterior chamber`);
    }
  }

  const transmission = cornea.transmission ?? 0;
  const transmissionOk = transmission >= CORNEA_MIN_TRANSMISSION;
  console.log(`  ${transmissionOk ? "ok  " : "FAIL"} cornea material '${cornea.materialName}': ` +
              `transmission ${transmission}, needs >= ${CORNEA_MIN_TRANSMISSION} — otherwise the ` +
              "clear shell renders as an opaque dome over the iris");
  if (!transmissionOk) {
    failures.push("cornea material is not transmissive");
  }

  const ior = cornea.ior ?? 0;
  const iorOk = ior >= CORNEA_IOR_RANGE[0] && ior <= CORNEA_IOR_RANGE[1];
  console.log(`  ${iorOk ? "ok  " : "FAIL"} cornea material IOR ${ior}, needs ` +
              `${CORNEA_IOR_RANGE[0]}–${CORNEA_IOR_RANGE[1]}`);
  if (!iorOk) {
    failures.push("cornea material has the wrong IOR");
  }

  return failures;
}

// The face is six separate meshes, and two regressions have already been fixed here: face parts
// being dropped from the export entirely, and face parts surviving but arriving morph-less. Both
// leave the body mesh perfect, so a body-only assertion stays green through either one. These
// checks exist so neither can come back silently.
const REQUIRED_FACE_PARTS = [
  { match: /teeth/i,  label: "teeth",     mustCarry: "jawOpen" },
  { match: /tongue/i, label: "tongue",    mustCarry: "tongueOut" },
  { match: /lash/i,   label: "eyelashes", mustCarry: "eyeBlinkLeft" },
  { match: /brow/i,   label: "eyebrows",  mustCarry: "browInnerUp" },
  // MakeHuman's eyeball proxy is named for its topology ("high-poly"), not its anatomy, so
  // matching on /eye/ finds the lashes and brows instead and never finds the eyeballs.
  { match: EYEBALL_GLOBE_PATTERN, label: "eyes",   mustCarry: "eyeLookUpLeft" },
  // The corneal shell is the second half of that proxy, split off in build_figure.py. It has to
  // carry the gaze morphs too or it stays pointing forward while the globe looks away.
  { match: EYEBALL_CORNEA_PATTERN, label: "cornea", mustCarry: "eyeLookUpLeft" }
];

function reportFaceParts(meshes) {
  const failures = [];

  console.log("");
  console.log("--- assertions on face parts ---");

  for (const part of REQUIRED_FACE_PARTS) {
    const mesh = meshes.find((candidate) => part.match.test(candidate.name));

    if (!mesh) {
      console.log(`  FAIL ${part.label}: no mesh matching ${part.match}`);
      failures.push(`${part.label} mesh missing`);
      continue;
    }

    if (mesh.morphTargetCount === 0) {
      console.log(`  FAIL ${part.label} (${mesh.name}): present but carries 0 morph targets`);
      failures.push(`${part.label} carries no morphs`);
      continue;
    }

    if (!mesh.targetNames.includes(part.mustCarry)) {
      console.log(`  FAIL ${part.label} (${mesh.name}): ${mesh.morphTargetCount} morphs but ` +
                  `'${part.mustCarry}' is not among them`);
      failures.push(`${part.label} missing ${part.mustCarry}`);
      continue;
    }

    console.log(`  ok   ${part.label.padEnd(10)} ${mesh.name.padEnd(22)} ` +
                `${String(mesh.morphTargetCount).padStart(3)} morphs, '${part.mustCarry}' present`);
  }

  return failures;
}

// Every mesh in the figure lives on the head or the body and must deform with the skeleton. The
// face parts once exported as plain child nodes of the skinned body: POSITION/NORMAL/TEXCOORD_0
// and nothing else, inheriting the body's identity object transform and none of its deformation.
// The body mesh alone stayed perfect throughout, so every body-only assertion above stayed green
// while the eyebrows floated over the temple at a 14 degree head yaw.
function reportSkinning(gltfJson, threeMeshes) {
  const failures = [];

  console.log("");
  console.log("--- assertions on skinning ---");

  for (const node of gltfJson.nodes ?? []) {
    if (node.mesh === undefined) {
      continue;
    }

    const mesh = gltfJson.meshes[node.mesh];
    const problems = [];

    if (node.skin === undefined) {
      problems.push("node references no skin");
    }
    for (const primitive of mesh.primitives ?? []) {
      if (primitive.attributes.JOINTS_0 === undefined) {
        problems.push("primitive has no JOINTS_0");
      }
      if (primitive.attributes.WEIGHTS_0 === undefined) {
        problems.push("primitive has no WEIGHTS_0");
      }
    }

    if (problems.length > 0) {
      console.log(`  FAIL ${node.name} (mesh '${mesh.name}'): ${problems.join(", ")}`);
      failures.push(`${node.name} is not skinned`);
      continue;
    }

    console.log(`  ok   ${node.name.padEnd(24)} JOINTS_0 + WEIGHTS_0, skin ${node.skin}`);
  }

  // The container can be correct and three.js still build a plain Mesh, which silently ignores
  // the skin data. SkinnedMesh with a live skeleton is the thing the runtime needs.
  for (const mesh of threeMeshes) {
    if (!mesh.isSkinnedMesh || !mesh.hasSkeleton) {
      console.log(`  FAIL ${mesh.name}: three.js built ` +
                  `${mesh.isSkinnedMesh ? "a SkinnedMesh with no skeleton" : "a plain Mesh"}`);
      failures.push(`${mesh.name} is not a SkinnedMesh in three.js`);
      continue;
    }
    if (mesh.unweightedVertexCount > 0) {
      console.log(`  FAIL ${mesh.name}: ${mesh.unweightedVertexCount} vertices have no bone ` +
                  "weight at all and would stay at the bind pose");
      failures.push(`${mesh.name} has unweighted vertices`);
    }
  }

  return failures;
}

// MakeHuman puts an alpha channel on every skin texture and Blender used to take it literally,
// exporting alphaMode BLEND on all six materials — including the solid body. A blended material
// does not write depth, so the teeth and tongue drew straight through closed lips and the
// eyeballs drew over the lids. Only the flat brow and lash cards are genuinely cutouts.
//
// The cornea belongs on this list even though it is see-through. glTF's alphaMode is about
// compositing, and the cornea is not composited: it is a dielectric that refracts what is behind
// it, declared through KHR_materials_transmission and rendered depth-writing like any solid.
// Calling it BLEND would reintroduce the very defect this list exists to prevent.
const OPAQUE_MATERIAL_PARTS = [
  /body/i, EYEBALL_GLOBE_PATTERN, EYEBALL_CORNEA_PATTERN, /teeth/i, /tongue/i
];
const MASK_MATERIAL_PARTS = [/brow/i, /lash/i];
const EXPECTED_ALPHA_CUTOFF = 0.5;

/**
 * 🎯 Punch-list 9.7's BUILD-SIDE HALF. Which garments must carry an `occlusionTexture`, and which
 * must not.
 *
 * MPFB's `NodeWrapperGameEngine` wires diffuse, diffuse alpha and normal, and has no occlusion node
 * at all, so every garment's hand-baked `aomapTexture` was read off disk by nobody.
 * `build_figure.py`'s `wire_garment_ao_maps()` now feeds it to the exporter's Occlusion socket.
 *
 * 🚩 THIS CHECK EXISTS BECAUSE THE FIX WAS GATED ONLY BY A BROWSER. Reverting
 * `wire_garment_ao_maps` to a no-op and rebuilding takes the rendered gate
 * (`packages/core/src/wardrobe/shadow.selftest.mjs`) from 0.91% to exactly 0.00% — and leaves
 * `wardrobe.selftest.mjs` at PASS and this file at PASS. A file-level fact that only a GPU can
 * check is a file-level fact nobody checks on a machine without one.
 *
 * ⚠️ IT IS A PIN, NOT A DERIVATION, AND THAT IS A DELIBERATE LIMIT. The authority is the mhmat
 * beside each mhclo, which lives in MPFB's asset tree and is reachable only from inside Blender —
 * so this table cannot be read from the source here, and a garment ADDED to the catalogue with an
 * AO map is invisible to this gate until somebody adds a row. Re-derive it with:
 *
 *     grep -l aomapTexture "$MPFB_CLOTHES"/<the garment>/*.mhmat
 *
 * ⚠️ AND THE COUNT IN 9.7 WAS WRONG WHEN IT WAS WRITTEN. The item said every CC0 garment declares
 * one; measured, it is TWO OF FOUR — `female_casualsuit01` (2,153,148 bytes) and
 * `female_elegantsuit01` (1,350,953 bytes) do, `shoes01` and `fedora01` do not. Both directions are
 * asserted below, because a build that wired occlusion onto everything would be just as wrong as
 * one that wired it onto nothing, and only the `false` rows can catch it.
 */
const GARMENT_OCCLUSION_EXPECTATIONS = new Map([
  ["female_casualsuit01", true],
  ["female_elegantsuit01", true],
  ["shoes01", false],
  ["fedora01", false]
]);
const THREE_FRONT_SIDE = 0;
const THREE_DOUBLE_SIDE = 2;

function reportMaterials(gltfJson, threeMeshes, wardrobe) {
  const failures = [];

  console.log("");
  console.log("--- assertions on materials ---");

  for (const material of gltfJson.materials ?? []) {
    // glTF omits alphaMode when it is the default, so an absent field means OPAQUE.
    const alphaMode = material.alphaMode ?? "OPAQUE";
    const doubleSided = material.doubleSided === true;

    // 🚩 Punch-list 9.5. A garment matched NONE of the five regexes above, so a clothed figure
    // failed this gate BY CONSTRUCTION: `suit_g050` reported one problem and `layered_g050`
    // reported three while every eye, lip-seal and morph assertion stayed green (research §3.7).
    // The fix is not a sixth regex. A wool coat is OPAQUE and a mesh panel is MASK, and no name
    // pattern can know which — so the expectation is read from the garment's own manifest entry.
    const { garment, isCutout, isSolid, expectedCutoff } =
      expectationFor(material.name, wardrobe);

    if (!isCutout && !isSolid) {
      const because = garment !== null
        ? `manifest alphaMode ${garment.alphaMode} is not handled by this gate`
        : "unrecognised material, no expected alpha mode";
      console.log(`  FAIL ${material.name}: ${because}`);
      failures.push(`${material.name} is not covered by the material expectations`);
      continue;
    }

    const expectedMode = isCutout ? "MASK" : "OPAQUE";
    const problems = [];

    if (alphaMode !== expectedMode) {
      problems.push(`alphaMode ${alphaMode}, expected ${expectedMode}` +
                    (garment !== null ? ` (manifest: ${garment.id})` : ""));
    }
    if (isCutout && (material.alphaCutoff ?? EXPECTED_ALPHA_CUTOFF) !== expectedCutoff) {
      problems.push(`alphaCutoff ${material.alphaCutoff}, expected ${expectedCutoff}`);
    }
    // Closed geometry seen from inside is a rendering artefact; a lash card seen from behind is
    // still a lash.
    if (isSolid && doubleSided) {
      problems.push("doubleSided, expected backface culled");
    }
    if (isCutout && !doubleSided) {
      problems.push("single sided, expected doubleSided");
    }

    if (problems.length > 0) {
      console.log(`  FAIL ${material.name}: ${problems.join("; ")}`);
      failures.push(`${material.name} has the wrong alpha settings`);
      continue;
    }

    console.log(`  ok   ${material.name.padEnd(28)} ${alphaMode.padEnd(6)} ` +
                `${doubleSided ? "doubleSided" : "backface culled"}` +
                `${garment !== null ? `   [manifest: ${garment.id}]` : ""}`);

    // Punch-list 9.7. See GARMENT_OCCLUSION_EXPECTATIONS.
    if (garment !== null && GARMENT_OCCLUSION_EXPECTATIONS.has(garment.id)) {
      const shouldCarry = GARMENT_OCCLUSION_EXPECTATIONS.get(garment.id);
      const carries = material.occlusionTexture !== undefined;

      if (carries !== shouldCarry) {
        const because = shouldCarry
          ? "its mhmat declares an aomapTexture and the built material has no occlusionTexture — " +
            "the AO recovery in build_figure.py's wire_garment_ao_maps() is not reaching the export"
          : "its mhmat declares no aomapTexture, so an occlusionTexture here is sampling something " +
            "the asset never supplied";
        console.log(`  FAIL ${material.name}: ${because}`);
        failures.push(`${garment.id} has the wrong occlusionTexture state`);
        continue;
      }

      console.log(`  ok   ${garment.id.padEnd(28)} occlusion ` +
                  `${carries ? `texture ${material.occlusionTexture.index}` : "absent, as declared"}` +
                  `   [9.7]`);
    }
  }

  failures.push(...reportRuntimeMaterials(threeMeshes, wardrobe));

  return failures;
}

// --- the wardrobe clause (punch-list 9.5) ------------------------------------------------------
//
// Three things this section is careful about, all of them mistakes that were available here:
//
//   1. **Resolution is by EXACT id, never by pattern.** `/suit/i` would accept any garment for any
//      manifest entry, which is the same defect as the whitelist it replaces with the sign
//      flipped. A material resolves to a garment only when its name — with at most a leading
//      `Human.` removed, and with three.js's dot-stripping allowed for — equals a manifest id.
//   2. **An unlisted garment still FAILS.** Falling through to "no expectation, pass" would make
//      the gate weaker for clothed figures than for nude ones.
//   3. **The hide masks are checked on the body, not assumed from the build log.** The exporter's
//      `export_attributes` defaults off and the build reports success without it.

/**
 * What alpha settings a material is expected to have, and where the expectation came from.
 *
 * The manifest wins whenever it has an entry, and the five name regexes are the fallback for the
 * body and the face parts, which are not garments and never will be. Factored out of both
 * material clauses so the container check and the three.js check cannot drift apart, and so
 * `runGarmentClauseSelftest` can exercise the decision without a GLB.
 */
function expectationFor(materialName, wardrobe) {
  const garment = garmentForMaterial(materialName, wardrobe);

  if (garment !== null) {
    return {
      garment,
      isCutout: garment.alphaMode === "MASK",
      isSolid: garment.alphaMode === "OPAQUE",
      // A garment states its own cutoff. Item 3.16 lost 15,368 lash and 20,262 brow texels to the
      // inherited glTF default of 0.5, and any garment with an alpha cutout inherits that bug.
      expectedCutoff: garment.alphaCutoff ?? EXPECTED_ALPHA_CUTOFF
    };
  }

  return {
    garment: null,
    isCutout: MASK_MATERIAL_PARTS.some((pattern) => pattern.test(materialName)),
    isSolid: OPAQUE_MATERIAL_PARTS.some((pattern) => pattern.test(materialName)),
    expectedCutoff: EXPECTED_ALPHA_CUTOFF
  };
}

/** The manifest entry a glTF material belongs to, or null. */
function garmentForMaterial(materialName, wardrobe) {
  if (wardrobe === null || typeof materialName !== "string") {
    return null;
  }

  // 'Human.female_casualsuit01' in the file; three.js sanitises the node name to
  // 'Humanfemale_casualsuit01'. Both spellings are tried, and nothing else is.
  const candidates = [
    materialName,
    materialName.replace(/^Human\./, ""),
    materialName.replace(/^Human/, "")
  ];

  for (const candidate of candidates) {
    const garment = wardrobe.byId.get(candidate);
    if (garment !== undefined) {
      return garment;
    }
  }

  return null;
}

/** Loads the garment manifest, or null when there is no wardrobe to check against. */
function readWardrobeManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  const source = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  return {
    path: manifestPath,
    source,
    byId: new Map(source.garments.map((garment) => [garment.id, garment]))
  };
}

// A hide mask that flags nothing hides nothing, and one that flags everything erases the figure.
// Both are silent: the build prints a count nobody reads and the runtime renders something
// plausible. The measured masks on g050 are 5,156 / 3,130 / 3,898 of 14,517 body vertices, i.e.
// 21% / 36% of the body, so a band this wide cannot be tripped by a legitimate garment.
const MIN_HIDE_MASK_FRACTION = 0.001;
const MAX_HIDE_MASK_FRACTION = 0.9;

/**
 * Every `_HIDE_*` attribute on the body is a manifest garment's, and every one of them does
 * something.
 *
 * 🚩 The failure this exists for is the quietest in the whole pipeline. Blender's glTF exporter
 * drops custom attributes unless `export_attributes=True`, which defaults OFF; the first build of
 * the hide-mask path exported cleanly, printed a clean summary, and carried
 * `POSITION,NORMAL,TEXCOORD_0,JOINTS_0,WEIGHTS_0` and nothing else. A figure like that can put a
 * garment on and will never hide the body under it.
 *
 * 🚩 And the name is UPPER-CASED on the way out: authored `_hide_shoes01`, exported
 * `_HIDE_SHOES01`. Matched case-insensitively, or the gate finds nothing and says so wrongly.
 */
function reportHideMasks(gltfJson, threeMeshes, wardrobe) {
  const failures = [];

  const carriers = threeMeshes.filter((mesh) => mesh.hideMasks.length > 0);

  if (wardrobe === null || carriers.length === 0) {
    return failures;
  }

  console.log("");
  console.log("--- assertions on hide masks (punch-list 9.2) ---");

  const declared = new Map();
  for (const garment of wardrobe.source.garments) {
    if (garment.hideMask !== null) {
      declared.set(garment.hideMask.toLowerCase(), garment.id);
    }
  }

  for (const mesh of carriers) {
    for (const mask of mesh.hideMasks) {
      const garmentId = declared.get(mask.name.toLowerCase());
      const fraction = mask.flagged / mask.vertexCount;

      if (garmentId === undefined) {
        console.log(`  FAIL ${mesh.name}: ${mask.name} matches no garment's hideMask in ` +
                    `${path.basename(wardrobe.path)}`);
        failures.push(`${mask.name} is an undeclared hide mask`);
        continue;
      }

      if (fraction < MIN_HIDE_MASK_FRACTION || fraction > MAX_HIDE_MASK_FRACTION) {
        console.log(`  FAIL ${mesh.name}: ${mask.name} flags ${mask.flagged} of ` +
                    `${mask.vertexCount} vertices (${(fraction * 100).toFixed(2)}%), which is ` +
                    "outside the band a real garment can occupy");
        failures.push(`${mask.name} is degenerate`);
        continue;
      }

      console.log(`  ok   ${mask.name.padEnd(34)} ${String(mask.flagged).padStart(6)} of ` +
                  `${mask.vertexCount} verts (${(fraction * 100).toFixed(1)}%)   [${garmentId}]`);
    }
  }

  return failures;
}

/**
 * A garment fragment GLB: one skinned garment, no body, no face.
 *
 * Verified separately from a figure because none of the figure clauses apply — a jacket has no
 * ARKit morphs, no eyes and no lips — and running them would either fail a correct fragment or,
 * worse, be silently skipped. The clauses that DO apply are the ones that decide whether the
 * runtime can wear it: it is skinned, every vertex is weighted, and its material matches what the
 * manifest says the runtime and the layering will assume.
 */
async function verifyGarmentFragment(glbPath, wardrobe) {
  console.log("");
  console.log("=".repeat(78));
  console.log(`${glbPath}   [garment fragment]`);
  console.log("=".repeat(78));

  const fileBuffer = fs.readFileSync(glbPath);
  const { json } = readGlbContainer(fileBuffer);
  const threeMeshes = await readMeshesViaThree(fileBuffer);

  const failures = [];
  const meshes = summariseMeshes(json);

  console.log(`file size       : ${fileBuffer.byteLength.toLocaleString()} bytes`);
  for (const mesh of meshes) {
    console.log(`  ${mesh.name.padEnd(28)} ${String(mesh.vertexCount).padStart(6)} verts`);
  }

  if (meshes.length !== 1) {
    console.log(`  FAIL a fragment must carry exactly one mesh, this has ${meshes.length}`);
    failures.push(`${path.basename(glbPath)} is not a single-garment fragment`);
  }

  console.log("");
  console.log("--- assertions on the fragment ---");

  const garment = garmentForMaterial(threeMeshes[0]?.materialName ?? "", wardrobe);

  if (garment === null) {
    console.log(`  FAIL material '${threeMeshes[0]?.materialName}' resolves to no manifest garment`);
    failures.push(`${path.basename(glbPath)} is not in the manifest`);
  } else {
    console.log(`  ok   manifest entry     ${garment.id} — layer ${garment.layer}, ` +
                `${garment.alphaMode}, clo ${garment.clo ?? "unrated"}`);
  }

  failures.push(...reportSkinning(json, threeMeshes));
  failures.push(...reportMaterials(json, threeMeshes, wardrobe));

  return failures;
}

/** Whether a GLB is a garment fragment rather than a figure. */
function looksLikeGarmentFragment(glbPath, wardrobe) {
  if (wardrobe === null) {
    return false;
  }

  const { json } = readGlbContainer(fs.readFileSync(glbPath));
  const materials = json.materials ?? [];

  return materials.length === 1 && garmentForMaterial(materials[0].name, wardrobe) !== null;
}

// alphaMode is only the file's half of the story. What actually decides whether the teeth draw
// through the lips is three.js writing depth, so assert the loaded material directly.
function reportRuntimeMaterials(threeMeshes, wardrobe) {
  const failures = [];

  for (const mesh of threeMeshes) {
    // The runtime clause resolves on the MATERIAL name for a garment and falls back to the MESH
    // name for a face part, because that is what each of the two naming conventions provides.
    const { garment, expectedCutoff } = expectationFor(mesh.materialName, wardrobe);
    const isCutout = garment !== null
      ? garment.alphaMode === "MASK"
      : MASK_MATERIAL_PARTS.some((pattern) => pattern.test(mesh.name));
    const problems = [];

    if (mesh.transparent) {
      problems.push("transparent");
    }
    if (!mesh.depthWrite) {
      problems.push("depthWrite off");
    }
    if (isCutout && mesh.alphaTest !== expectedCutoff) {
      problems.push(`alphaTest ${mesh.alphaTest}, expected ${expectedCutoff}`);
    }
    if (!isCutout && mesh.side !== THREE_FRONT_SIDE) {
      problems.push(`side ${mesh.side}, expected FrontSide`);
    }
    if (isCutout && mesh.side !== THREE_DOUBLE_SIDE) {
      problems.push(`side ${mesh.side}, expected DoubleSide`);
    }

    if (problems.length > 0) {
      console.log(`  FAIL ${mesh.name} in three.js: ${problems.join("; ")}`);
      failures.push(`${mesh.name} renders wrong in three.js`);
      continue;
    }

    console.log(`  ok   ${mesh.name.padEnd(24)} three.js: opaque, depth-writing` +
                `${isCutout ? `, alphaTest ${mesh.alphaTest}` : ""}`);
  }

  return failures;
}

/**
 * 🚩 THE OTHER WAY, for the lip seal (docs/LEARNINGS.md §1.1).
 *
 * The seal check passes on all five shipping figures, which by itself proves nothing — the whole
 * point of §1.1 is that a gate which has never failed is not known to work. So this builds three
 * synthetic mouths with known answers and requires the measurement to sort them correctly:
 *
 *   sealed     lips in contact, arch 1.3 mm above the seam        must PASS both clauses
 *   parted     lips 2 mm apart with every morph at zero           must FAIL the aperture clause
 *   flush      lips in contact, arch level with the seam          must FAIL the margin clause
 *
 * `node tools/figure-pipeline/verify_glb.mjs --selftest` runs it. It is a separate mode rather than
 * part of every run because it measures the instrument, not the asset.
 */
function runLipSealSelftest() {
  console.log("");
  console.log("--- lip seal: the gate against known-bad input ---");

  // A midline column of body vertices around a seam, plus a front tooth arch. Y in metres, at the
  // real figure's height so the band filter behaves exactly as it does on an asset.
  const buildMouth = ({ apertureMm, marginMm }) => {
    const seamY = 1.4859;
    const upperY = seamY;
    const lowerY = seamY - apertureMm / 1000;

    const positions = [];
    const jawOpen = [];
    // Upper lip block: stationary under jawOpen. Lower lip block: drops 33 mm at weight 1.
    for (let i = 0; i < 12; i += 1) {
      positions.push([0.0, upperY + i * 0.0006, 0.100]);
      jawOpen.push(0);
    }
    for (let i = 0; i < 12; i += 1) {
      positions.push([0.0, lowerY - i * 0.0006, 0.100]);
      jawOpen.push(-0.033);
    }

    // The upper arch, `marginMm` above the seam, and a lower arch below it that follows the jaw.
    const teethPositions = [];
    const teethJaw = [];
    for (let i = 0; i < 20; i += 1) {
      teethPositions.push([(i - 10) * 0.001, seamY + marginMm / 1000 + i * 0.0002, 0.130]);
      teethJaw.push(0);
      teethPositions.push([(i - 10) * 0.001, seamY - 0.004 - i * 0.0002, 0.130]);
      teethJaw.push(-0.033);
    }

    return {
      body: { positions, jawOpen },
      teeth: { positions: teethPositions, jawOpen: teethJaw },
    };
  };

  const cases = [
    { label: "sealed  ", mouth: buildMouth({ apertureMm: 0.02, marginMm: 1.3 }), aperture: true, margin: true },
    { label: "parted  ", mouth: buildMouth({ apertureMm: 2.00, marginMm: 1.3 }), aperture: false, margin: true },
    { label: "flush   ", mouth: buildMouth({ apertureMm: 0.02, marginMm: 0.0 }), aperture: true, margin: false },
  ];

  const failures = [];
  for (const testCase of cases) {
    const seal = measureLipSeal(testCase.mouth.body, testCase.mouth.teeth);
    const apertureOk = seal.measured && seal.apertureMm <= MAX_NEUTRAL_APERTURE_MM;
    const marginOk = seal.measured && seal.sealMarginMm >= MIN_SEAL_MARGIN_MM;
    const correct = apertureOk === testCase.aperture && marginOk === testCase.margin;

    console.log(`  ${correct ? "ok  " : "FAIL"} ${testCase.label} aperture ` +
                `${seal.measured ? seal.apertureMm.toFixed(3) : "?"} mm (${apertureOk ? "pass" : "REJECT"}, ` +
                `expected ${testCase.aperture ? "pass" : "REJECT"}), margin ` +
                `${seal.measured ? seal.sealMarginMm.toFixed(3) : "?"} mm (${marginOk ? "pass" : "REJECT"}, ` +
                `expected ${testCase.margin ? "pass" : "REJECT"})`);

    if (!correct) {
      failures.push(`lip seal selftest: ${testCase.label.trim()} sorted wrongly`);
    }
  }

  return failures;
}

/** Every wardrobe artefact worth gating: the body that carries the masks, and each fragment. */
function wardrobeTargets(wardrobeDir) {
  if (!fs.existsSync(wardrobeDir)) {
    return [];
  }

  const targets = [];

  for (const entry of fs.readdirSync(wardrobeDir).sort()) {
    const candidate = path.join(wardrobeDir, entry);
    if (!fs.statSync(candidate).isDirectory() || entry === "baked") {
      continue;
    }
    for (const file of fs.readdirSync(candidate).sort()) {
      if (file.endsWith(".glb")) {
        targets.push(path.join(candidate, file));
      }
    }
  }

  return targets;
}

/**
 * 🚩 THE OTHER WAY, for the garment clause (punch-list 9.5, docs/LEARNINGS.md §1.1).
 *
 * The clause passes every garment this repo builds, which by itself proves nothing. So this drives
 * the decision function with input whose right answer is known, in four mechanisms that all live
 * in one class — "the gate accepts a garment it should reject":
 *
 *   1. a garment the manifest does not list must NOT fall through to a pass;
 *   2. resolution must be by EXACT id — a manifest holding `female_casualsuit01` must not accept
 *      `female_casualsuit02`, which is the failure mode a `/suit/i` regex would have;
 *   3. a manifest declaring OPAQUE for a garment must reject a MASK material, and
 *   4. a manifest declaring MASK must reject an OPAQUE one — the direction the punch list names,
 *      and the one a whitelist of "known clothing names" would never see.
 *
 * The end-to-end version of 3 was also run once, by building the suit as a real cutout and
 * verifying it against the shipped OPAQUE manifest; `tools/figure-pipeline/README.md` has the
 * command. This selftest is the version that runs in a second and needs no Blender.
 */
function runGarmentClauseSelftest(wardrobe) {
  console.log("");
  console.log("--- garment clause: the gate against known-bad manifests ---");

  if (wardrobe === null) {
    console.log("  SKIP no garment manifest to test against");
    return ["no garment manifest"];
  }

  const opaqueGarment = wardrobe.source.garments.find((entry) => entry.alphaMode === "OPAQUE");

  if (opaqueGarment === undefined) {
    console.log("  SKIP the manifest has no OPAQUE garment to build the cases from");
    return ["no OPAQUE garment in the manifest"];
  }

  const cutoutManifest = {
    path: wardrobe.path,
    source: wardrobe.source,
    byId: new Map([[opaqueGarment.id, { ...opaqueGarment, alphaMode: "MASK", alphaCutoff: 0.1 }]])
  };

  const cases = [
    {
      label: "unlisted garment    ",
      run: () => expectationFor("Human.some_unlisted_jacket", wardrobe),
      expect: (result) => result.garment === null && !result.isCutout && !result.isSolid,
      why: "no manifest entry and no name pattern — must be reported as unrecognised"
    },
    {
      label: "near-miss id        ",
      run: () => expectationFor(`Human.${opaqueGarment.id}_variant`, wardrobe),
      expect: (result) => result.garment === null,
      why: "resolution is by exact id, so a lookalike name must NOT borrow the entry"
    },
    {
      label: "manifest OPAQUE     ",
      run: () => expectationFor(`Human.${opaqueGarment.id}`, wardrobe),
      expect: (result) => result.garment !== null && result.isSolid && !result.isCutout,
      why: "the shipped entry — a MASK material on it would be a failure"
    },
    {
      label: "manifest MASK       ",
      run: () => expectationFor(`Human.${opaqueGarment.id}`, cutoutManifest),
      expect: (result) => result.isCutout && !result.isSolid && result.expectedCutoff === 0.1,
      why: "a cutout garment must expect MASK and its OWN cutoff, not glTF's default 0.5"
    },
    {
      label: "three.js spelling   ",
      run: () => expectationFor(`Human${opaqueGarment.id}`, wardrobe),
      expect: (result) => result.garment !== null,
      why: "GLTFLoader strips the dot; both spellings must resolve to the same entry"
    }
  ];

  const failures = [];

  for (const testCase of cases) {
    const result = testCase.run();
    const correct = testCase.expect(result);

    console.log(`  ${correct ? "ok  " : "FAIL"} ${testCase.label} ` +
                `garment=${result.garment?.id ?? "none"} cutout=${result.isCutout} ` +
                `solid=${result.isSolid} cutoff=${result.expectedCutoff} — ${testCase.why}`);

    if (!correct) {
      failures.push(`garment clause: ${testCase.label.trim()} decided wrongly`);
    }
  }

  return failures;
}

async function main() {
  const pipelineDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(pipelineDir, "..", "..");
  const figuresDir = path.join(repoRoot, "assets", "figures");
  const wardrobeDir = path.join(repoRoot, "assets", "wardrobe");

  const argv = process.argv.slice(2);
  const manifestFlag = argv.indexOf("--manifest");
  const manifestPath = manifestFlag === -1
    ? path.join(wardrobeDir, "manifest.json")
    : path.resolve(argv[manifestFlag + 1]);

  const wardrobe = readWardrobeManifest(manifestPath);

  if (argv.includes("--selftest")) {
    const failures = [...runLipSealSelftest(), ...runGarmentClauseSelftest(wardrobe)];
    console.log("");
    console.log(failures.length === 0
      ? "PASS — the lip-seal and garment gates reject known-bad input and accept good input."
      : `FAIL — ${failures.length} problem(s): ${failures.join("; ")}`);
    process.exit(failures.length === 0 ? 0 : 1);
  }

  // `--manifest <path>` consumes the argument after it. `manifestFlag + 1` is 0 when the flag is
  // absent, and position 0 is the first target — so the flag has to be tested for presence first
  // or the default run silently drops whichever file was named first.
  const manifestValuePosition = manifestFlag === -1 ? -1 : manifestFlag + 1;
  let targets = argv.filter((argument, position) =>
    !argument.startsWith("--") && position !== manifestValuePosition);

  if (targets.length === 0) {
    if (!fs.existsSync(figuresDir)) {
      console.error(`No figures directory at ${figuresDir}. Run tools/figure-pipeline/build.sh first.`);
      process.exit(1);
    }
    targets = fs.readdirSync(figuresDir)
      .filter((name) => name.endsWith(".glb"))
      .sort()
      .map((name) => path.join(figuresDir, name));

    // The wardrobe body and every garment fragment, when they have been built. Without this the
    // default run would keep verifying only nude figures — which is how a clothed figure went
    // three rounds failing this gate by construction and nobody's default run ever saw it.
    targets.push(...wardrobeTargets(wardrobeDir));
  }

  if (targets.length === 0) {
    console.error(`No .glb files found in ${figuresDir}. Run tools/figure-pipeline/build.sh first.`);
    process.exit(1);
  }

  if (wardrobe === null) {
    console.log(`No garment manifest at ${manifestPath}; the wardrobe clauses will not run.`);
  }

  const allFailures = [];
  for (const target of targets) {
    const resolved = path.resolve(target);
    allFailures.push(...(looksLikeGarmentFragment(resolved, wardrobe)
      ? await verifyGarmentFragment(resolved, wardrobe)
      : await verifyFigure(resolved, wardrobe)));
  }

  console.log("");
  console.log("=".repeat(78));
  if (allFailures.length === 0) {
    console.log(`PASS — ${targets.length} file(s) verified.`);
    process.exit(0);
  }
  console.log(`FAIL — ${allFailures.length} problem(s) across ${targets.length} file(s).`);
  process.exit(1);
}

await main();
