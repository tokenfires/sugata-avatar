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

/** Loads the same buffer through three.js and returns each mesh's morphTargetDictionary keys. */
async function readMorphNamesViaThree(fileBuffer) {
  const loader = new GLTFLoader();
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);

  const gltf = await new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, "", resolve, reject);
  });

  const perMesh = [];
  gltf.scene.traverse((object) => {
    if (object.isMesh && object.morphTargetDictionary) {
      perMesh.push({ name: object.name, morphNames: Object.keys(object.morphTargetDictionary) });
    }
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
  const threeMeshes = await readMorphNamesViaThree(fileBuffer);
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
  // MakeHuman's eyeball proxy is named for its topology ("low-poly"), not its anatomy, so
  // matching on /eye/ finds the lashes and brows instead and never finds the eyeballs.
  { match: /low-poly|eyeball/i, label: "eyes", mustCarry: "eyeLookUpLeft" }
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
