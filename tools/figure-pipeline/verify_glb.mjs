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

// Punch-list 9.8's hem measurement, shared with the runtime gate rather than reimplemented here.
// One module means the asset gate and `hem.selftest.mjs` cannot report different depths for the
// same file, which is the failure `cornea_geometry.mjs` exists to prevent for the eye.
const { measureHemRoll, percentile } = await import(
  "../../packages/core/src/wardrobe/HemGeometry.js");

// Punch-list 3.6's groom measurements. Same arrangement as the two above: the arithmetic lives in
// its own module so it can be pointed at shapes whose answer is known, and the thresholds live
// here with the rest of the gate.
const {
  SurfaceGrid, connectedComponents, isRibbon, rayTriangle, scalpTransmittance,
  uvExtentsPerComponent,
} = await import("./hair_geometry.mjs");

const { readAccessor, readGlb } = await import("../lut-bake/glb.mjs");
const { decodePng } = await import("../critic/png.mjs");

/** Half the authored FOUNDATION_HEM_ROLL_M. See `reportFoundationHem`. */
const MINIMUM_HEM_ROLL_MM = 0.6;

/** Which meshes carry a hem worth measuring. The build names a shell `Human.<garment id>`. */
const FOUNDATION_MESH_PATTERN = /foundation_/i;

/** The three numbers `reportFoundationHem` needs, without carrying the welded mesh out with them. */
function summariseHemRoll(geometry) {
  const measured = measureHemRoll(geometry.attributes.position.array, geometry.index.array);

  return {
    boundaryEdges: measured.boundaryEdges,
    bandTriangles: measured.bandTriangles,
    medianDepthMm: percentile(measured.depthsMm, 0.5),
  };
}

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
      // Punch-list 9.8. Behind a name test for the same reason the eye positions are: it welds
      // and re-topologises the whole mesh, and only a foundation shell has a rolled hem to find.
      hemRoll: FOUNDATION_MESH_PATTERN.test(object.name)
        ? summariseHemRoll(object.geometry)
        : null,
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
  failures.push(...reportFoundationHem(garment, threeMeshes[0]));

  return failures;
}

/**
 * Punch-list 9.8: a foundation shell must arrive with its hem ROLLED, not with a knife edge.
 *
 * 🚩 A SHELL WITH NO BAND IS A SILENT FAILURE. It still loads, still covers, still passes every
 * other clause in this file — the only symptom is that a viewer reads the garment as painted on,
 * which is precisely what three blind judges did before `roll_the_hem()` existed. So the default
 * asset run gates it, and the same measurement drives
 * `packages/core/src/wardrobe/hem.selftest.mjs`'s pixel half rather than being written twice.
 *
 * The threshold is a floor at half the authored roll: the shipped shells read 1.200 mm at the
 * median across all twelve fragments and a `--no-hem-roll` build of the same command reads
 * 0.112–0.125 mm, so 0.6 mm sits five times clear of the broken case.
 */
function reportFoundationHem(garment, mesh) {
  if (garment === null || garment.layer !== "FOUNDATION") {
    return [];
  }

  const measured = mesh?.hemRoll ?? null;

  if (measured === null) {
    console.log(`  FAIL rolled hem        no hem was measured on '${mesh?.name}', which the ` +
                `manifest puts at layer FOUNDATION`);
    return [`${garment.id}'s mesh was not recognised as a foundation shell`];
  }

  const median = measured.medianDepthMm;
  const quadPerEdge = measured.bandTriangles === measured.boundaryEdges * 2;
  const deepEnough = median >= MINIMUM_HEM_ROLL_MM;

  console.log(`  ${quadPerEdge && deepEnough ? "ok  " : "FAIL"} rolled hem        ` +
              `${measured.boundaryEdges} boundary edges, ${measured.bandTriangles} band tris, ` +
              `median depth ${median.toFixed(3)} mm ` +
              `(floor ${MINIMUM_HEM_ROLL_MM}, one extruded quad per edge)`);

  const failures = [];
  if (!quadPerEdge) {
    failures.push(`${garment.id} has ${measured.bandTriangles} band triangles for ` +
                  `${measured.boundaryEdges} boundary edges; the hem is not an extruded band`);
  }
  if (!deepEnough) {
    failures.push(`${garment.id} has a hem ${median.toFixed(3)} mm deep, under the ` +
                  `${MINIMUM_HEM_ROLL_MM} mm floor — the shell is a knife edge`);
  }

  return failures;
}

// --- the hair clause (punch-list 3.6) ----------------------------------------------------------
//
// 🎯 **A GROOM IS THE ONE ASSET IN THIS REPOSITORY WHOSE FAILURES ARE ALL SILENT.** Hair that goes
// through the skull still loads, still skins, still exports a valid glTF. Hair with a bald patch
// passes every count. Hair whose cards straddle two atlas strips has perfect geometry. None of it
// shows up in a file size, and only the last of them is visible in a wireframe.
//
// So this clause measures four things off the exported bytes, and three of the four need the FIGURE
// as well as the fragment — a clearance has no meaning without the body it is clear of. The figure
// is required rather than optional: a clause that quietly skips is the failure mode
// `packages/testbed/pages.selftest.mjs`'s header is about.

/** Minimum signed distance from any hair vertex to the body. Matches hair_cards.HAIR_CLEARANCE_M. */
const MINIMUM_HAIR_CLEARANCE_MM = 3.0;

/**
 * How much of the cranium the groom has to hide, measured through the cutout rather than through
 * the triangles.
 *
 * The floor is set from both directions of the red proof rather than from taste. Measured at g050:
 * the shipped groom hides **99.61%** of the cranium and the same build with `--no-hair-cap` hides
 * **94.43%**, so 0.97 sits 2.6 points below the good case and 2.6 above the broken one.
 *
 * ⚠️ **THE GAP IS SMALL, AND THAT IS THE MEASUREMENT RATHER THAN A WEAKNESS OF THE THRESHOLD.**
 * 254 cards over a scalp already hide most of it; the cap is worth five points, and five points of
 * bare crown is what a top-down render shows as thinning hair. The primary gate on the cap is
 * `reportHairComponents`, which fails a groom with no non-ribbon component at all — this clause is
 * the one that would catch a cap that existed and did not cover.
 */
const MINIMUM_SCALP_COVERAGE = 0.97;

/** How far above the scalp a card can be and still count as covering it. */
const SCALP_COVERAGE_REACH_M = 0.12;

/**
 * 🎯 **THIS CLAUSE READ 99.14–100.00% ON A GROOM WITH A VISIBLE BALD PATCH, AND THE THREE REASONS
 * ARE THE THREE THINGS BELOW.** A blind critic looking at `packages/testbed/src/hair.html` saw a
 * lit scalp at the parting and a split from crown to nape; this clause said the cranium was
 * 100.00% hidden. A gate that passes a groom with a hole in it is not a slack threshold, it is
 * three wrong questions, and raising the floor would have fixed none of them:
 *
 *   1. **IT ASKED 257 VERTICES.** The cranium's own vertices are 10–20 mm apart on this base mesh,
 *      and a bald patch two centimetres across fits between them. Measured at g050 with the atlas
 *      as shipped: every one of the 257 read covered, at the cutoff, with zero fully-open. The
 *      target is now the cranium's SURFACE, sampled at SCALP_SAMPLE_SPACING_M.
 *   2. **IT BLENDED WHERE THE RENDERER MASKS.** `1 - product(1 - alpha)` is the transmittance of
 *      an alpha-BLENDED stack. The groom exports MASK at cutoff 0.5, so three cards at alpha 0.4
 *      are three holes, and that arithmetic called them 78% covered. It now samples the cutoff.
 *   3. **IT WAS A MEAN.** The floor of 0.97 tolerated 3% of the cranium bare, and 3% of a cranium
 *      gathered into ONE PLACE is the hole. A hole is local by definition and no average can see
 *      one, so the mean survives as a report and MAX_EXPOSED_PATCH_MM2 is the clause that fails.
 *
 * Spacing: 4 mm. Fine enough that a patch at the ceiling below is many samples across rather than
 * one, coarse enough that the whole cranium is a few thousand rays against 7,224 triangles.
 */
const SCALP_SAMPLE_SPACING_M = 0.004;

/**
 * The biggest hole in the groom's cover that is not a defect, and how near two exposed samples
 * have to be to count as the same hole.
 *
 * 50 mm² is about 8 mm across — the width of a parting, which is a hairstyle, against the 20 mm
 * patch the critic saw, which is not. The link distance is 1.5× the sample spacing so that a run
 * of adjacent samples joins up and two genuinely separate gaps do not.
 */
const MAX_EXPOSED_PATCH_MM2 = 50;
const SCALP_PATCH_LINK_M = SCALP_SAMPLE_SPACING_M * 1.5;

/**
 * 🎯 **AND THE NORMAL RAY IS STILL NOT THE QUESTION A CRITIC ASKS.** With the surface sampled at
 * 4 mm and the cutoff applied, g050 measured 99.87% covered and a worst patch of 37.5 mm² — under
 * the ceiling — while the front plate showed a bald wedge at the parting you could not miss. Both
 * numbers are true. They are answers to "is there hair over this bit of scalp", and a ray leaving
 * the forehead along its own normal goes UP, through the cards lying over the crown. The critic
 * was looking along a ray that goes FORWARD, between them.
 *
 * So the clause also asks the other question — can a viewer standing at one of the judge's five
 * angles see skin — by casting from each sample toward each camera. The five directions are
 * derived from the same azimuth/elevation pairs `packages/testbed/src/hair.js` builds its VIEWS
 * from, so the gate and the page a human looks at cannot drift apart.
 *
 * ⚠️ Directional rather than perspective: the page's camera is 0.78 m from a 0.19 m head, so
 * treating it as a direction is up to about 14° wrong at the silhouette. That error is in the
 * conservative direction for a gate that is looking for holes near the middle of the frame.
 */
const SCALP_VIEW_ANGLES = [
  { name: "front", azimuth: 0, elevation: 0.04 },
  { name: "three-quarter", azimuth: 40, elevation: 0.05 },
  { name: "side", azimuth: 90, elevation: 0.03 },
  { name: "back", azimuth: 180, elevation: 0.05 },
  { name: "top", azimuth: 0, elevation: 0.62 },
];

/**
 * How squarely a sample has to face a camera before its skin counts as on show. cos 65°, so a
 * patch raking away at the silhouette — where it is a few foreshortened pixels and where the
 * directional approximation above is at its worst — does not fail a groom.
 */
const SCALP_VIEW_FACING = 0.42;

/** How far toward the camera to look for a card. The groom's longest card is about 245 mm. */
const SCALP_VIEW_REACH_M = 0.40;

/** The biggest patch of skin a viewer may see through the groom, from any one of the five views. */
const MAX_VISIBLE_SKIN_MM2 = 60;

/**
 * 🎯 **THE CARD BORDER, MEASURED WHERE IT IS DRAWN.** The blind critic's worst finding was a
 * dead-straight card border running from the crown past the jaw, slicing the eyebrow, the eyelid
 * and the cheekbone. Its diagnosis — "the alpha strand shapes exist only INSIDE the card; the
 * card's own left border is untouched by them" — is a statement about the ATLAS, and it is exactly
 * measurable off the one this GLB embeds. Two clauses, because the defect had two halves:
 *
 *   BORDER TEXELS. A card samples one atlas strip edge to edge, so an opaque texel in the strip's
 *   outermost columns IS the quad's own edge, rendered. On the groom the critic saw, strip 1 —
 *   the innermost, face-framing layer's strip — had 1,895 of its 2,048 border texels kept at the
 *   cutoff, drawn there by the CAP strip's strands overflowing across the boundary.
 *
 *   BOUNDARY STRAIGHTNESS. Border texels alone are not enough: a strip whose outermost strands are
 *   pinned parallel to the boundary has a straight silhouette a few texels in, which is the same
 *   razor moved sideways. Strip 1 measured a standard deviation of 0.000 px over 1,020 of 1,024
 *   rows. The floor is 3 px — enough that a straight edge cannot pass, low enough that a strip
 *   which is simply narrow does not fail for being narrow.
 *
 * 🚩 **THE CAP STRIP IS EXEMPT FROM BOTH, and it has to be.** `hair_cards.cap_uv` tiles it around
 * the whorl, so a transparent gutter there is a radial seam repeated twelve times across the
 * crown and a wandering boundary is a wandering seam. It is checked from the other side instead —
 * `hair_texture.CAP_STRIP_MIN_COVERAGE` fails a build whose cap does not cover.
 */
const CARD_BORDER_COLUMNS = 2;
const MIN_STRIP_BOUNDARY_SD_PX = 3.0;

/**
 * A groom must be mostly cards. The cap shells are the only components allowed not to be ribbons,
 * and there is one per shell — the number is not hard-coded, only the requirement that the
 * ribbons outnumber them heavily and that at least one cap exists.
 */
const MINIMUM_HAIR_CARDS = 100;

/** Displacement at which an ARKit target counts as having moved a vertex, for the scalp target. */
const FACE_MOTION_FLOOR_M = 0.00015;

function readHairManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

/**
 * The manifest groom a material name resolves to, by EXACT name.
 *
 * Exact, for the reason the garment clause is exact: a `/hair/i` pattern would accept a groom
 * nobody has described against the expectations of one somebody has.
 */
function groomForMaterial(materialName, hair) {
  if (hair === null) {
    return null;
  }
  return hair.grooms.find((groom) => groom.material === materialName) ?? null;
}

/** Whether a GLB is a hair fragment. One mesh, one material, and the manifest knows the name. */
function looksLikeHairFragment(glbPath, hair) {
  if (hair === null) {
    return false;
  }
  const { json } = readGlbContainer(fs.readFileSync(glbPath));
  const materials = json.materials ?? [];

  return materials.length === 1 && groomForMaterial(materials[0].name, hair) !== null;
}

/** Every built groom fragment under assets/hair. */
function hairTargets(hairDir) {
  if (!fs.existsSync(hairDir)) {
    return [];
  }

  const targets = [];
  for (const entry of fs.readdirSync(hairDir).sort()) {
    const candidate = path.join(hairDir, entry);
    if (!fs.statSync(candidate).isDirectory()) {
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

/** The single mesh of a fragment, read straight out of the container. */
function readOnlyPrimitive(glb) {
  if ((glb.json.meshes ?? []).length !== 1) {
    throw new Error(`expected one mesh, found ${(glb.json.meshes ?? []).length}`);
  }
  const primitive = glb.json.meshes[0].primitives[0];

  return {
    positions: readAccessor(glb, primitive.attributes.POSITION).data,
    normals: readAccessor(glb, primitive.attributes.NORMAL).data,
    uvs: readAccessor(glb, primitive.attributes.TEXCOORD_0).data,
    indices: readAccessor(glb, primitive.indices).data,
    joints: readAccessor(glb, primitive.attributes.JOINTS_0).data,
    weights: readAccessor(glb, primitive.attributes.WEIGHTS_0).data,
    vertexCount: readAccessor(glb, primitive.attributes.POSITION).count,
  };
}

/**
 * Samples the groom's own embedded baseColorTexture. This is the ONLY honest way to ask whether
 * a card is opaque at a point: the geometry says "yes, there is a quad here" everywhere.
 */
function albedoAlphaSampler(glb) {
  const material = glb.json.materials[0];
  const textureIndex = material.pbrMetallicRoughness?.baseColorTexture?.index;
  if (textureIndex === undefined) {
    return null;
  }

  const image = glb.json.images[glb.json.textures[textureIndex].source];
  const view = glb.json.bufferViews[image.bufferView];
  const bytes = glb.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);

  const { width, height, pixels } = decodePng(bytes);

  return (u, v) => {
    // Nearest sample, wrapped. Bilinear would be more faithful to the renderer and would change
    // a coverage figure in the fourth decimal on a 1024² sheet.
    const x = Math.min(width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * width)));
    const y = Math.min(height - 1, Math.max(0, Math.floor((v - Math.floor(v)) * height)));

    // ⚠️ `decodePng` returns NORMALISED floats, not bytes. Dividing by 255 here reported the
    // sheet's mean alpha as 0.0020 and the groom's scalp coverage as 2.54%, which is the shape of
    // a units bug rather than a hole in the hair — every ray was hitting a card and every card was
    // reading as transparent.
    return pixels[(y * width + x) * 4 + 3];
  };
}

/**
 * The cranium the groom is measured against, derived from the FIGURE and from a different source
 * than the build used.
 *
 * 🚩 **Deliberately not the build's own `scalp` vertex group.** The build cuts its region from
 * MakeHuman's group; if the gate read the same group it would be asking the groom to cover exactly
 * what the groom was grown from, and a region that came out too small would move the target with
 * it. This derives the target from the SKIN WEIGHTS and the ARKit morph deltas instead — head-
 * dominant vertices that no face unit moves, above the eyes — which is the same independence
 * `--foundation`'s decency regions have from its garment cuts.
 */
function craniumTarget(figureGlb) {
  const json = figureGlb.json;
  const body = json.meshes.find((mesh) => /base|body|^Human$/i.test(mesh.name));
  if (body === undefined) {
    throw new Error(`no body mesh in the figure; it has ${json.meshes.map((m) => m.name)}`);
  }

  const primitive = body.primitives[0];
  const positions = readAccessor(figureGlb, primitive.attributes.POSITION).data;
  const normals = readAccessor(figureGlb, primitive.attributes.NORMAL).data;
  const joints = readAccessor(figureGlb, primitive.attributes.JOINTS_0).data;
  const weights = readAccessor(figureGlb, primitive.attributes.WEIGHTS_0).data;
  const indices = readAccessor(figureGlb, primitive.indices).data;
  const vertexCount = readAccessor(figureGlb, primitive.attributes.POSITION).count;

  const jointNames = json.skins[0].joints.map((node) => json.nodes[node].name);
  const headJoint = jointNames.indexOf("head");

  // Anything a facial action moves is face, not cranium — SkinRegions.js's argument, and the same
  // one the build's hairline uses, reached from the other side of the export.
  const moved = new Uint8Array(vertexCount);
  const targetNames = body.extras?.targetNames ?? [];
  targetNames.forEach((name, index) => {
    if (!ARKIT_52.includes(name)) {
      return;
    }
    const deltas = readAccessor(figureGlb, primitive.targets[index].POSITION).data;
    for (let vertex = 0; vertex < vertexCount; vertex += 1) {
      const size = Math.hypot(deltas[vertex * 3], deltas[vertex * 3 + 1], deltas[vertex * 3 + 2]);
      if (size > FACE_MOTION_FLOOR_M) {
        moved[vertex] = 1;
      }
    }
  });

  // Eye height, off the eyeball mesh, so "above the eyes" is measured rather than assumed. The
  // glTF is Y-up, so height is the y component.
  const eyes = json.meshes.find((mesh) => /high-poly|low-poly|eyeball/i.test(mesh.name));
  const eyePositions = readAccessor(figureGlb, eyes.primitives[0].attributes.POSITION).data;
  let eyeHeight = 0;
  for (let vertex = 0; vertex < eyePositions.length; vertex += 3) {
    eyeHeight += eyePositions[vertex + 1];
  }
  eyeHeight /= eyePositions.length / 3;

  const onCranium = new Uint8Array(vertexCount);
  const points = [];
  const pointNormals = [];
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    let best = -1;
    let bestWeight = 0;
    for (let slot = 0; slot < 4; slot += 1) {
      if (weights[vertex * 4 + slot] > bestWeight) {
        bestWeight = weights[vertex * 4 + slot];
        best = joints[vertex * 4 + slot];
      }
    }
    if (best !== headJoint || moved[vertex] === 1 || positions[vertex * 3 + 1] <= eyeHeight) {
      continue;
    }
    onCranium[vertex] = 1;
    points.push(positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]);
    pointNormals.push(normals[vertex * 3], normals[vertex * 3 + 1], normals[vertex * 3 + 2]);
  }

  // The cranium's own SURFACE, not just its corners — every body triangle all three of whose
  // corners are on the cranium. `scalpSurfaceSamples` spreads samples over these; see
  // MAX_EXPOSED_PATCH_MM2 for why the vertices alone were never going to find a hole.
  const faces = [];
  for (let corner = 0; corner < indices.length; corner += 3) {
    if (onCranium[indices[corner]] === 1 && onCranium[indices[corner + 1]] === 1
        && onCranium[indices[corner + 2]] === 1) {
      faces.push(indices[corner], indices[corner + 1], indices[corner + 2]);
    }
  }

  return {
    scalp: { points: Float64Array.from(points), normals: Float64Array.from(pointNormals) },
    body: { positions, normals, indices },
    craniumFaces: Uint32Array.from(faces),
    eyeHeight,
  };
}

/**
 * Points spread evenly over the cranium's triangles, at a stated spacing, each with the surface
 * normal interpolated from its triangle's corners.
 *
 * A triangle gets ceil(area / (spacing²/2)) samples on a jittered barycentric lattice, and always
 * at least its own centroid, so a triangle smaller than the spacing is still asked the question.
 * The lattice is deterministic — index-derived, no RNG — because a gate whose sample set moves
 * between runs reports a hole intermittently, which is worse than not reporting it.
 */
function scalpSurfaceSamples(cranium, spacingMetres) {
  const { body, craniumFaces } = cranium;
  const points = [];
  const normals = [];
  const areas = [];
  const perSample = spacingMetres * spacingMetres * 0.5;

  for (let face = 0; face < craniumFaces.length; face += 3) {
    const a = craniumFaces[face] * 3;
    const b = craniumFaces[face + 1] * 3;
    const c = craniumFaces[face + 2] * 3;

    const edge1 = [body.positions[b] - body.positions[a], body.positions[b + 1] - body.positions[a + 1],
                   body.positions[b + 2] - body.positions[a + 2]];
    const edge2 = [body.positions[c] - body.positions[a], body.positions[c + 1] - body.positions[a + 1],
                   body.positions[c + 2] - body.positions[a + 2]];
    const cross = [edge1[1] * edge2[2] - edge1[2] * edge2[1],
                   edge1[2] * edge2[0] - edge1[0] * edge2[2],
                   edge1[0] * edge2[1] - edge1[1] * edge2[0]];
    const area = 0.5 * Math.hypot(cross[0], cross[1], cross[2]);

    const wanted = Math.max(1, Math.ceil(area / perSample));
    // A k×k barycentric lattice yields k² samples; pick the smallest k that reaches `wanted`.
    const side = Math.max(1, Math.ceil(Math.sqrt(wanted)));

    for (let row = 0; row < side; row += 1) {
      for (let column = 0; column < side; column += 1) {
        // Alternating up and down triangles of the subdivided lattice, which is what fills a
        // triangle evenly rather than piling every sample into one corner.
        const up = column <= row;
        const u = up ? (row + 0.67 - column) / side : (row + 0.33 - column + 1) / side;
        const v = up ? (column + 0.33) / side : (column - 0.33) / side;
        if (u < 0 || v < 0 || u + v > 1) continue;

        for (let axis = 0; axis < 3; axis += 1) {
          points.push(body.positions[a + axis] + edge1[axis] * u + edge2[axis] * v);
          normals.push(body.normals[a + axis] * (1 - u - v) + body.normals[b + axis] * u
                       + body.normals[c + axis] * v);
        }
        areas.push(area / (side * side));
      }
    }
  }

  // Unit-length the interpolated normals; a barycentric blend of three unit vectors is not one.
  for (let sample = 0; sample < points.length; sample += 3) {
    const length = Math.hypot(normals[sample], normals[sample + 1], normals[sample + 2]) || 1;
    normals[sample] /= length;
    normals[sample + 1] /= length;
    normals[sample + 2] /= length;
  }

  return {
    points: Float64Array.from(points),
    normals: Float64Array.from(normals),
    areas: Float64Array.from(areas),
  };
}

/**
 * The atlas as the renderer sees it: a kept/dropped mask at the material's own cutoff, decoded
 * from the GLB's embedded baseColorTexture rather than from the PNG beside it — the sidecar is a
 * build artefact and the embedded copy is what ships.
 */
function albedoCutoutMask(glb, cutoff) {
  const material = glb.json.materials[0];
  const textureIndex = material.pbrMetallicRoughness?.baseColorTexture?.index;
  if (textureIndex === undefined) {
    return null;
  }

  const image = glb.json.images[glb.json.textures[textureIndex].source];
  const view = glb.json.bufferViews[image.bufferView];
  const bytes = glb.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  const { width, height, pixels } = decodePng(bytes);

  const kept = new Uint8Array(width * height);
  for (let texel = 0; texel < width * height; texel += 1) {
    kept[texel] = pixels[texel * 4 + 3] >= cutoff ? 1 : 0;
  }

  return { width, height, kept };
}

/**
 * Per strip: how many of its border texels survive the cutoff, and how much its kept boundary
 * moves from row to row. See CARD_BORDER_COLUMNS for what each half of this catches.
 */
function stripBorderReport(mask, stripCount) {
  const { width, height, kept } = mask;
  const stripWidth = Math.floor(width / stripCount);
  const report = [];

  for (let strip = 0; strip < stripCount; strip += 1) {
    const left = strip * stripWidth;
    let borderKept = 0;
    const lefts = [];
    const rights = [];

    for (let row = 0; row < height; row += 1) {
      const base = row * width + left;
      for (let column = 0; column < CARD_BORDER_COLUMNS; column += 1) {
        borderKept += kept[base + column];
        borderKept += kept[base + stripWidth - 1 - column];
      }

      let first = -1;
      let last = -1;
      for (let column = 0; column < stripWidth; column += 1) {
        if (kept[base + column] === 0) continue;
        if (first === -1) first = column;
        last = column;
      }
      if (first !== -1) {
        lefts.push(first);
        rights.push(last);
      }
    }

    report.push({
      strip,
      borderKept,
      rows: lefts.length,
      leftSd: standardDeviation(lefts),
      rightSd: standardDeviation(rights),
    });
  }

  return report;
}

function standardDeviation(values) {
  if (values.length === 0) {
    return 0;
  }
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;

  return Math.sqrt(variance);
}

/**
 * The card-border clause. Runs over the strips the groom's CARDS actually sample, taken from the
 * UVs rather than from a list — a strip nobody uses is not a card border.
 */
function reportCardBorders(groom, glb, mesh) {
  const mask = albedoCutoutMask(glb, groom.alphaCutoff);
  if (mask === null) {
    console.log("  FAIL card borders      no baseColorTexture to measure the atlas from");
    return [`${groom.id} has no embedded atlas to measure its card borders on`];
  }

  const stripCount = groom.atlas.strips;
  const components = connectedComponents(mesh.indices, mesh.vertexCount);
  const extents = uvExtentsPerComponent(components, mesh.uvs, stripCount);

  // The same floor-with-an-epsilon `uvExtentsPerComponent` uses to decide which strip an edge
  // lands in, so the two cannot disagree about a card sitting exactly on a boundary.
  const cardStrips = new Set();
  extents.forEach((extent, index) => {
    if (isRibbon(components[index])) {
      cardStrips.add(Math.floor((extent.minU + 1e-6) * stripCount));
    }
  });

  const report = stripBorderReport(mask, stripCount)
    .filter((entry) => cardStrips.has(entry.strip) && entry.strip !== groom.atlas.capStrip);

  const opaqueBorders = report.filter((entry) => entry.borderKept > 0);
  const straight = report.filter((entry) =>
    Math.min(entry.leftSd, entry.rightSd) < MIN_STRIP_BOUNDARY_SD_PX);

  const worst = report.reduce((lowest, entry) =>
    (lowest === null || Math.min(entry.leftSd, entry.rightSd)
      < Math.min(lowest.leftSd, lowest.rightSd)) ? entry : lowest, null);

  console.log(`  ${opaqueBorders.length === 0 ? "ok  " : "FAIL"} card borders     ` +
              ` ${report.length} card strip(s), ` +
              `${opaqueBorders.reduce((total, entry) => total + entry.borderKept, 0)} opaque texel(s) ` +
              `in their outermost ${CARD_BORDER_COLUMNS} column(s) — a card's own quad edge`);
  console.log(`  ${straight.length === 0 ? "ok  " : "FAIL"} border is hair   ` +
              ` worst strip ${worst === null ? "n/a" : worst.strip} boundary sd ` +
              `${worst === null ? "n/a" : Math.min(worst.leftSd, worst.rightSd).toFixed(3)} px ` +
              `over ${worst === null ? 0 : worst.rows} rows (floor ${MIN_STRIP_BOUNDARY_SD_PX} px)`);

  const failures = [];
  if (opaqueBorders.length > 0) {
    failures.push(`${groom.id} draws the atlas opaque at the border of strip(s) ` +
                  `${opaqueBorders.map((entry) => entry.strip).join(", ")}, so every card ` +
                  "carrying one shows its own quad edge as a straight line");
  }
  if (straight.length > 0) {
    failures.push(`${groom.id} has a straight cutout boundary on strip(s) ` +
                  `${straight.map((entry) => `${entry.strip} (sd ` +
                    `${Math.min(entry.leftSd, entry.rightSd).toFixed(3)} px)`).join(", ")} — ` +
                  "the card's silhouette there is a line rather than hairs");
  }

  return failures;
}

/**
 * The unit vector from the head's centre toward a camera placed the way
 * `packages/testbed/src/hair.js`'s `place()` places one. Kept in the same arithmetic so the
 * gate's five angles and the page's five buttons are the same five angles.
 */
function viewDirection({ azimuth, elevation }) {
  const angle = azimuth * Math.PI / 180;
  const lift = elevation * 1.4;
  const flat = Math.cos(Math.asin(Math.min(1, lift)));
  const vector = [Math.sin(angle) * flat, lift, Math.cos(angle) * flat];
  const length = Math.hypot(vector[0], vector[1], vector[2]);

  return vector.map((value) => value / length);
}

/**
 * Which cranium samples show bare skin to a camera in `direction`. A sample counts when it faces
 * that camera at all and no card with an opaque texel stands between it and the camera.
 */
function skinVisibleFrom(samples, hair, opaqueAt, direction) {
  const count = samples.areas.length;
  const visible = new Array(count).fill(false);

  for (let sample = 0; sample < count; sample += 1) {
    const normal = [samples.normals[sample * 3], samples.normals[sample * 3 + 1],
                    samples.normals[sample * 3 + 2]];
    const facing = normal[0] * direction[0] + normal[1] * direction[1] + normal[2] * direction[2];
    if (facing < SCALP_VIEW_FACING) continue;

    const origin = [samples.points[sample * 3], samples.points[sample * 3 + 1],
                    samples.points[sample * 3 + 2]];

    let blocked = false;
    for (let triangle = 0; triangle < hair.indices.length && !blocked; triangle += 3) {
      const hit = rayTriangle(origin, direction, hair.positions, hair.indices, triangle);
      if (hit === null || hit.distance > SCALP_VIEW_REACH_M) continue;

      const uv = interpolateHairUv(hair.uvs, hair.indices, triangle, hit.bary);
      if (opaqueAt(uv[0], uv[1]) > 0) blocked = true;
    }

    visible[sample] = !blocked;
  }

  return visible;
}

/** Barycentric UV at a hit. The same three-corner blend `hair_geometry.scalpTransmittance` uses. */
function interpolateHairUv(uvs, indices, triangle, bary) {
  let u = 0;
  let v = 0;
  for (let corner = 0; corner < 3; corner += 1) {
    u += uvs[indices[triangle + corner] * 2] * bary[corner];
    v += uvs[indices[triangle + corner] * 2 + 1] * bary[corner];
  }

  return [u, v];
}

/**
 * The biggest CONNECTED run of exposed samples, in mm². Two exposed samples belong to the same
 * hole when they are within `linkMetres` of each other — union-find over the exposed set.
 */
function largestExposedPatch(samples, exposed, linkMetres) {
  const indices = [];
  for (let sample = 0; sample < exposed.length; sample += 1) {
    if (exposed[sample]) indices.push(sample);
  }
  if (indices.length === 0) {
    return { area: 0, samples: 0, centre: null };
  }

  const parent = indices.map((_, position) => position);
  const find = (node) => {
    while (parent[node] !== node) {
      parent[node] = parent[parent[node]];
      node = parent[node];
    }
    return node;
  };

  const linkSquared = linkMetres * linkMetres;
  for (let left = 0; left < indices.length; left += 1) {
    const a = indices[left] * 3;
    for (let right = left + 1; right < indices.length; right += 1) {
      const b = indices[right] * 3;
      const dx = samples.points[a] - samples.points[b];
      const dy = samples.points[a + 1] - samples.points[b + 1];
      const dz = samples.points[a + 2] - samples.points[b + 2];
      if (dx * dx + dy * dy + dz * dz > linkSquared) continue;
      const rootLeft = find(left);
      const rootRight = find(right);
      if (rootLeft !== rootRight) parent[rootRight] = rootLeft;
    }
  }

  const area = new Map();
  const count = new Map();
  const centroid = new Map();
  for (let position = 0; position < indices.length; position += 1) {
    const root = find(position);
    const sample = indices[position];
    area.set(root, (area.get(root) ?? 0) + samples.areas[sample]);
    count.set(root, (count.get(root) ?? 0) + 1);
    const running = centroid.get(root) ?? [0, 0, 0];
    running[0] += samples.points[sample * 3];
    running[1] += samples.points[sample * 3 + 1];
    running[2] += samples.points[sample * 3 + 2];
    centroid.set(root, running);
  }

  let worst = null;
  for (const [root, value] of area) {
    if (worst === null || value > area.get(worst)) worst = root;
  }

  const members = count.get(worst);
  const running = centroid.get(worst);

  return {
    area: area.get(worst) * 1e6,
    samples: members,
    centre: running.map((value) => value / members),
  };
}

/** The figure a hair fragment was grown on: assets/hair/<id>/gNNN.glb -> figure_gNNN.glb. */
function figureForFragment(glbPath, figuresDir) {
  return path.join(figuresDir, `figure_${path.basename(glbPath, ".glb")}.glb`);
}

async function verifyHairFragment(glbPath, hair, figuresDir) {
  console.log("");
  console.log("=".repeat(78));
  console.log(`${glbPath}   [hair groom]`);
  console.log("=".repeat(78));

  const failures = [];
  const glb = readGlb(glbPath);
  const fileBuffer = fs.readFileSync(glbPath);
  const threeMeshes = await readMeshesViaThree(fileBuffer);

  const groom = groomForMaterial(glb.json.materials[0].name, hair);
  const mesh = readOnlyPrimitive(glb);

  console.log(`file size       : ${fileBuffer.byteLength.toLocaleString()} bytes`);
  console.log(`groom           : ${groom.id} — ${groom.description}`);
  console.log(`geometry        : ${mesh.vertexCount.toLocaleString()} verts, ` +
              `${(mesh.indices.length / 3).toLocaleString()} triangles`);


  failures.push(...reportHairComponents(groom, mesh));
  failures.push(...reportHairUvs(groom, mesh, hair));
  failures.push(...reportCardBorders(groom, glb, mesh));
  failures.push(...reportHairMaterial(groom, glb.json.materials[0], threeMeshes[0]));
  failures.push(...reportSkinning(glb.json, threeMeshes));
  failures.push(...reportHairSkinWeights(groom, glb, mesh));
  failures.push(...reportHairAgainstFigure(groom, glb, mesh, glbPath, figuresDir));

  return failures;
}

/**
 * Card count and card SHAPE, off the index buffer.
 *
 * The build's own report says how many cards it grew. This does not read it — a count printed by
 * the thing being measured is the weak half of every gate in this repository.
 */
function reportHairComponents(groom, mesh) {
  console.log("");
  console.log("--- assertions on the cards ---");

  const components = connectedComponents(mesh.indices, mesh.vertexCount);
  const ribbons = components.filter(isRibbon);
  const patches = components.filter((component) => !isRibbon(component));

  const ringCounts = new Set(ribbons.map((ribbon) => ribbon.vertices.length / 2));

  console.log(`  ${ribbons.length >= MINIMUM_HAIR_CARDS ? "ok  " : "FAIL"} cards             ` +
              `${ribbons.length} quad-strip components, ` +
              `${[...ringCounts].sort((a, b) => a - b).join("/")} rings each ` +
              `(floor ${MINIMUM_HAIR_CARDS})`);
  console.log(`  ${patches.length >= 1 ? "ok  " : "FAIL"} scalp cap         ` +
              `${patches.length} non-ribbon component(s), ` +
              `${patches.map((patch) => patch.triangles.length).join("/")} triangles`);

  const failures = [];
  if (ribbons.length < MINIMUM_HAIR_CARDS) {
    failures.push(`${groom.id} has ${ribbons.length} cards, under the ${MINIMUM_HAIR_CARDS} floor`);
  }
  if (patches.length < 1) {
    failures.push(`${groom.id} carries no scalp cap — every component is a quad strip, so there ` +
                  "is nothing under the cards and the scalp shows through the cutouts");
  }

  return failures;
}

/** Every UV inside the atlas, and every card inside ONE strip of it. */
function reportHairUvs(groom, mesh, hair) {
  const components = connectedComponents(mesh.indices, mesh.vertexCount);
  const extents = uvExtentsPerComponent(components, mesh.uvs, groom.atlas.strips);

  const outside = extents.filter((extent) => extent.minU < 0 || extent.maxU > 1 ||
                                             extent.minV < 0 || extent.maxV > 1);
  const straddling = extents.filter((extent, index) =>
    isRibbon(components[index]) && extent.strips > 1);

  // A card is a quad strip whose two rails sit on the strip's two edges, so exactly two distinct u
  // values. See `uvExtentsPerComponent` for why the strand shader depends on it.
  const skewed = extents.filter((extent, index) =>
    isRibbon(components[index]) && extent.uColumns !== 2);

  console.log(`  ${outside.length === 0 ? "ok  " : "FAIL"} UV bounds         ` +
              `${extents.length} components, all within [0,1]` +
              (outside.length === 0 ? "" : ` — ${outside.length} are NOT`));
  console.log(`  ${straddling.length === 0 ? "ok  " : "FAIL"} one strip a card  ` +
              `${straddling.length} card(s) straddle an atlas strip boundary ` +
              `(${groom.atlas.strips} strips)`);
  console.log(`  ${skewed.length === 0 ? "ok  " : "FAIL"} axis-aligned UV   ` +
              `${extents.length - skewed.length - (extents.length - components.filter(isRibbon).length)}` +
              ` of ${components.filter(isRibbon).length} cards sit on exactly two u columns ` +
              `— the groom exports no TANGENT and the strand direction is this UV's bitangent`);

  const failures = [];
  if (outside.length > 0) {
    failures.push(`${groom.id} has ${outside.length} components with UVs outside the atlas`);
  }
  if (straddling.length > 0) {
    failures.push(`${groom.id} has ${straddling.length} cards spanning two atlas strips, which ` +
                  "cuts a neighbouring bundle's strands down the card's edge");
  }
  if (skewed.length > 0) {
    failures.push(`${groom.id} has ${skewed.length} cards whose UV is not axis-aligned; the ` +
                  "strand direction derived from it would be rotated by an unknown angle");
  }

  return failures;
}

/** The cutout and the sidedness, against the manifest rather than against a name pattern. */
function reportHairMaterial(groom, material, threeMesh) {
  const cutoff = material.alphaCutoff ?? 0.5;
  const problems = [];

  if (material.alphaMode !== groom.alphaMode) {
    problems.push(`alphaMode ${material.alphaMode}, expected ${groom.alphaMode}`);
  }
  if (Math.abs(cutoff - groom.alphaCutoff) > 1e-6) {
    problems.push(`alphaCutoff ${cutoff}, expected ${groom.alphaCutoff}`);
  }
  if ((material.doubleSided === true) !== groom.doubleSided) {
    problems.push(`doubleSided ${material.doubleSided === true}, expected ${groom.doubleSided}`);
  }
  if (threeMesh.side !== THREE_DOUBLE_SIDE) {
    problems.push(`three.js side ${threeMesh.side}, expected DoubleSide`);
  }

  console.log(`  ${problems.length === 0 ? "ok  " : "FAIL"} material          ` +
              `${material.alphaMode}, cutoff ${cutoff}, ` +
              `${material.doubleSided ? "double sided" : "backface culled"}` +
              (problems.length === 0 ? "" : ` — ${problems.join("; ")}`));

  return problems.length === 0 ? [] : [`${groom.id}: ${problems.join("; ")}`];
}

/**
 * Every vertex weighted, weights normalised, and weighted to the bone the manifest names.
 *
 * `reportSkinning` already fails a vertex with no weight at all. This is the other half: a groom
 * weighted to `spine_01` would pass that and would stay behind when the head turned.
 */
function reportHairSkinWeights(groom, glb, mesh) {
  const jointNames = glb.json.skins[0].joints.map((node) => glb.json.nodes[node].name);

  const used = new Set();
  let worstSum = 1;
  for (let vertex = 0; vertex < mesh.vertexCount; vertex += 1) {
    let sum = 0;
    for (let slot = 0; slot < 4; slot += 1) {
      const weight = mesh.weights[vertex * 4 + slot];
      sum += weight;
      if (weight > 0) {
        used.add(jointNames[mesh.joints[vertex * 4 + slot]]);
      }
    }
    worstSum = Math.min(worstSum, sum);
  }

  const bones = [...used].sort();
  const onlyTheBone = bones.length === 1 && bones[0] === groom.bone;
  const normalised = Math.abs(worstSum - 1) < 1e-4;

  console.log(`  ${onlyTheBone && normalised ? "ok  " : "FAIL"} skin weights      ` +
              `bones {${bones.join(", ")}}, worst weight sum ${worstSum.toFixed(6)} ` +
              `(manifest bone '${groom.bone}')`);

  const failures = [];
  if (!onlyTheBone) {
    failures.push(`${groom.id} is weighted to {${bones.join(", ")}}, not to '${groom.bone}'`);
  }
  if (!normalised) {
    failures.push(`${groom.id} has a vertex whose weights sum to ${worstSum.toFixed(6)}`);
  }

  return failures;
}

/**
 * The two measurements that need the body: does the groom go through the head, and does the head
 * show through the groom.
 */
function reportHairAgainstFigure(groom, glb, mesh, glbPath, figuresDir) {
  const figurePath = figureForFragment(glbPath, figuresDir);

  if (!fs.existsSync(figurePath)) {
    console.log(`  FAIL clearance         no figure at ${figurePath}; the clearance and the ` +
                "coverage have no body to be measured against");
    return [`${groom.id} could not be measured against ${path.basename(figurePath)}`];
  }

  const figure = readGlb(figurePath);
  const { scalp, body, craniumFaces } = craniumTarget(figure);

  // 🚩 The fragment and the figure are separate exports, and a clearance measured across two
  // coordinate systems would be a large positive number for a groom buried in the skull. Assert
  // they are in the same space before believing anything either of them says.
  const hairCentroid = centroidOf(mesh.positions);
  const scalpCentroid = centroidOf(scalp.points);
  const apart = Math.hypot(hairCentroid[0] - scalpCentroid[0], hairCentroid[1] - scalpCentroid[1],
                           hairCentroid[2] - scalpCentroid[2]);
  if (apart > 0.15) {
    console.log(`  FAIL shared space      the groom's centroid is ${(apart * 1000).toFixed(0)} mm ` +
                "from the cranium's; these two files are not in the same coordinate system");
    return [`${groom.id} and ${path.basename(figurePath)} are not in the same space`];
  }

  const grid = new SurfaceGrid(body.positions, body.normals, body.indices);

  let nearest = Infinity;
  let through = 0;
  for (let vertex = 0; vertex < mesh.vertexCount; vertex += 1) {
    const hit = grid.nearest([mesh.positions[vertex * 3], mesh.positions[vertex * 3 + 1],
                              mesh.positions[vertex * 3 + 2]]);
    if (hit === null) {
      continue;
    }
    nearest = Math.min(nearest, hit.signed);
    if (hit.signed < 0) {
      through += 1;
    }
  }

  const clearanceOk = through === 0 && nearest * 1000 >= MINIMUM_HAIR_CLEARANCE_MM - 1e-3;
  console.log(`  ${clearanceOk ? "ok  " : "FAIL"} clearance         ` +
              `nearest signed approach ${(nearest * 1000).toFixed(3)} mm, ` +
              `${through} vertices inside the body ` +
              `(floor ${MINIMUM_HAIR_CLEARANCE_MM} mm)`);

  const alphaAt = albedoAlphaSampler(glb);
  const failures = [];
  if (!clearanceOk) {
    failures.push(`${groom.id} reaches ${(nearest * 1000).toFixed(3)} mm of the body with ` +
                  `${through} vertices inside it`);
  }

  if (alphaAt === null) {
    console.log("  FAIL scalp coverage    no baseColorTexture to sample");
    failures.push(`${groom.id} hides an unmeasurable fraction of the cranium`);
    return failures;
  }

  // ⚠️ **THE RENDERER'S RULE, NOT A BLEND.** The groom is MASK at `groom.alphaCutoff`, so a texel
  // under the cutoff is not a thin hair — it is a hole, and the pixel behind it is skin. Reading
  // the raw alpha into a transmittance product asks "how much light gets through", which is the
  // question an alpha-blended groom answers; this one answers "is there a texel here at all".
  const opaqueAt = (u, v) => (alphaAt(u, v) >= groom.alphaCutoff ? 1 : 0);

  const samples = scalpSurfaceSamples({ body, craniumFaces }, SCALP_SAMPLE_SPACING_M);
  const transmittance = scalpTransmittance(samples, mesh, opaqueAt, SCALP_COVERAGE_REACH_M);
  const coverage = 1 - transmittance.reduce((total, value) => total + value, 0) / transmittance.length;

  const exposed = [...transmittance].map((value) => value > 0.5);
  const patch = largestExposedPatch(samples, exposed, SCALP_PATCH_LINK_M);

  // And the same question from where a judge stands. See SCALP_VIEW_ANGLES.
  let worstView = { name: "none", area: 0, samples: 0, centre: null };
  for (const angle of SCALP_VIEW_ANGLES) {
    const visible = skinVisibleFrom(samples, mesh, opaqueAt, viewDirection(angle));
    const seen = largestExposedPatch(samples, visible, SCALP_PATCH_LINK_M);
    if (seen.area > worstView.area) {
      worstView = { name: angle.name, ...seen };
    }
  }

  const coverageOk = coverage >= MINIMUM_SCALP_COVERAGE;
  const patchOk = patch.area <= MAX_EXPOSED_PATCH_MM2;
  const viewOk = worstView.area <= MAX_VISIBLE_SKIN_MM2;

  console.log(`  ${coverageOk ? "ok  " : "FAIL"} scalp coverage    ` +
              `${(coverage * 100).toFixed(2)}% of ${samples.areas.length} cranium surface samples ` +
              `at ${(SCALP_SAMPLE_SPACING_M * 1000).toFixed(0)} mm hidden, through the CUTOUT ` +
              `(floor ${(MINIMUM_SCALP_COVERAGE * 100).toFixed(0)}%)`);
  console.log(`  ${patchOk ? "ok  " : "FAIL"} no bald patch     ` +
              `largest connected exposed patch ${patch.area.toFixed(1)} mm²` +
              (patch.centre === null ? "" :
                ` at (${patch.centre.map((value) => value.toFixed(3)).join(", ")})`) +
              ` over ${patch.samples} sample(s) (ceiling ${MAX_EXPOSED_PATCH_MM2} mm²)`);
  console.log(`  ${viewOk ? "ok  " : "FAIL"} no skin on show   ` +
              `worst of ${SCALP_VIEW_ANGLES.length} judge views is '${worstView.name}' at ` +
              `${worstView.area.toFixed(1)} mm² of bare cranium` +
              (worstView.centre === null ? "" :
                ` at (${worstView.centre.map((value) => value.toFixed(3)).join(", ")})`) +
              ` (ceiling ${MAX_VISIBLE_SKIN_MM2} mm²)`);

  if (!coverageOk) {
    failures.push(`${groom.id} hides ${(coverage * 100).toFixed(2)}% of the cranium, under the ` +
                  `${(MINIMUM_SCALP_COVERAGE * 100).toFixed(0)}% floor`);
  }
  if (!patchOk) {
    failures.push(`${groom.id} leaves a ${patch.area.toFixed(1)} mm² hole in the cranium's cover ` +
                  `at (${patch.centre.map((value) => value.toFixed(3)).join(", ")}), over the ` +
                  `${MAX_EXPOSED_PATCH_MM2} mm² ceiling`);
  }
  if (!viewOk) {
    failures.push(`${groom.id} shows ${worstView.area.toFixed(1)} mm² of bare cranium to the ` +
                  `'${worstView.name}' view at ` +
                  `(${worstView.centre.map((value) => value.toFixed(3)).join(", ")}), over the ` +
                  `${MAX_VISIBLE_SKIN_MM2} mm² ceiling`);
  }

  return failures;
}

function centroidOf(points) {
  const centroid = [0, 0, 0];
  for (let point = 0; point < points.length; point += 3) {
    centroid[0] += points[point];
    centroid[1] += points[point + 1];
    centroid[2] += points[point + 2];
  }
  const count = points.length / 3;

  return centroid.map((value) => value / count);
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
  const hairDir = path.join(repoRoot, "assets", "hair");
  const hair = readHairManifest(path.join(hairDir, "manifest.json"));

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

    // And every groom, for exactly the reason the wardrobe line above exists: a default run that
    // only ever sees nude figures is how a clothed one went three rounds failing by construction.
    targets.push(...hairTargets(hairDir));
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

    if (looksLikeHairFragment(resolved, hair)) {
      allFailures.push(...await verifyHairFragment(resolved, hair, figuresDir));
      continue;
    }

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
