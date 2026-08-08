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
    });
  });

  return perMesh;
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

async function verifyFigure(glbPath) {
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
  failures.push(...reportMaterials(json, threeMeshes));
  failures.push(...reportEyeGeometry(threeMeshes));

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
const THREE_FRONT_SIDE = 0;
const THREE_DOUBLE_SIDE = 2;

function reportMaterials(gltfJson, threeMeshes) {
  const failures = [];

  console.log("");
  console.log("--- assertions on materials ---");

  for (const material of gltfJson.materials ?? []) {
    // glTF omits alphaMode when it is the default, so an absent field means OPAQUE.
    const alphaMode = material.alphaMode ?? "OPAQUE";
    const doubleSided = material.doubleSided === true;
    const isCutout = MASK_MATERIAL_PARTS.some((pattern) => pattern.test(material.name));
    const isSolid = OPAQUE_MATERIAL_PARTS.some((pattern) => pattern.test(material.name));

    if (!isCutout && !isSolid) {
      console.log(`  FAIL ${material.name}: unrecognised material, no expected alpha mode`);
      failures.push(`${material.name} is not covered by the material expectations`);
      continue;
    }

    const expectedMode = isCutout ? "MASK" : "OPAQUE";
    const problems = [];

    if (alphaMode !== expectedMode) {
      problems.push(`alphaMode ${alphaMode}, expected ${expectedMode}`);
    }
    if (isCutout && (material.alphaCutoff ?? EXPECTED_ALPHA_CUTOFF) !== EXPECTED_ALPHA_CUTOFF) {
      problems.push(`alphaCutoff ${material.alphaCutoff}, expected ${EXPECTED_ALPHA_CUTOFF}`);
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

    console.log(`  ok   ${material.name.padEnd(24)} ${alphaMode.padEnd(6)} ` +
                `${doubleSided ? "doubleSided" : "backface culled"}`);
  }

  failures.push(...reportRuntimeMaterials(threeMeshes));

  return failures;
}

// alphaMode is only the file's half of the story. What actually decides whether the teeth draw
// through the lips is three.js writing depth, so assert the loaded material directly.
function reportRuntimeMaterials(threeMeshes) {
  const failures = [];

  for (const mesh of threeMeshes) {
    const isCutout = MASK_MATERIAL_PARTS.some((pattern) => pattern.test(mesh.name));
    const problems = [];

    if (mesh.transparent) {
      problems.push("transparent");
    }
    if (!mesh.depthWrite) {
      problems.push("depthWrite off");
    }
    if (isCutout && mesh.alphaTest !== EXPECTED_ALPHA_CUTOFF) {
      problems.push(`alphaTest ${mesh.alphaTest}, expected ${EXPECTED_ALPHA_CUTOFF}`);
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

async function main() {
  const pipelineDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(pipelineDir, "..", "..");
  const figuresDir = path.join(repoRoot, "assets", "figures");

  let targets = process.argv.slice(2);
  if (targets.length === 0) {
    if (!fs.existsSync(figuresDir)) {
      console.error(`No figures directory at ${figuresDir}. Run tools/figure-pipeline/build.sh first.`);
      process.exit(1);
    }
    targets = fs.readdirSync(figuresDir)
      .filter((name) => name.endsWith(".glb"))
      .sort()
      .map((name) => path.join(figuresDir, name));
  }

  if (targets.length === 0) {
    console.error(`No .glb files found in ${figuresDir}. Run tools/figure-pipeline/build.sh first.`);
    process.exit(1);
  }

  const allFailures = [];
  for (const target of targets) {
    allFailures.push(...await verifyFigure(path.resolve(target)));
  }

  console.log("");
  console.log("=".repeat(78));
  if (allFailures.length === 0) {
    console.log(`PASS — ${targets.length} figure(s) verified.`);
    process.exit(0);
  }
  console.log(`FAIL — ${allFailures.length} problem(s) across ${targets.length} figure(s).`);
  process.exit(1);
}

await main();
