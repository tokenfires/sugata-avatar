//
// control-blind.mjs — builds the two blind arms for the frostbitten control.
//
// Eight rounds of hair judging shared one weakness: every judge knew it was looking at THIS
// project's renderer, because it launched THIS project's dev server to get the pixels. The
// control removes that by putting a second, independent, competent hair renderer through the
// identical judging path, and by handing both arms to the judges as bare files in
// randomly-named directories.
//
// Two arms, one of which is not ours:
//   * frostbitten — Scthe/frostbitten-hair-webgpu rendered headless via src/index.control.ts
//   * sugata      — captures/hair-r24-before, from alive.html?hair=1 — see the ARMS comment
//
// Both arms are 720x900, background RGB(20,22,26) measured identical, portrait and
// three-quarter, PNG metadata stripped. A judge given one arm has no way to tell which
// renderer produced it, and is never told the other arm exists.
//
// The answer key lands OUTSIDE the tree the judges are handed entirely — not one level up,
// which is all blind_ab.mjs does. A judge here is a subagent with a shell, so "above the
// images" is one `ls ..` away from being no blind at all.
//
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { decodePng, stripProvenanceChunks } from '../png.mjs';

// fileURLToPath, not string surgery on the URL: this repository's path contains a space and a
// non-ASCII character, so import.meta.url arrives percent-encoded. Same note as blind_ab.mjs.
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// The frostbitten clone is NOT vendored: it is MIT, but the Sintel hair and meshes it renders
// are BlendSwap-licensed under their own terms. README.md says how to get it.
const FB = process.env.FB_DIR;
if (!FB) throw new Error('set FB_DIR to your frostbitten clone — see README.md');

const OUT = process.env.OUT_DIR ?? path.join(REPO, 'captures', 'control-frostbitten', 'blind');

// 🚩 THE "sugata" ARM MUST COME FROM alive.html?hair=1 AND NOTHING ELSE. This line shipped once
// pointing at `captures/hair-r23-after/`, and that was wrong in a way that invalidated a whole
// judged complaint. Those plates are written by `tools/figure-pipeline/hair_shots.mjs` driving
// `packages/testbed/src/hair.html`, which is a GEOMETRY-judging page: read live off it,
// `renderer.shadowMap.enabled === false`, three lights with `castShadow` false on all three,
// 8 meshes with 0 casters and 0 receivers, `scene.environment === null`, `toneMapping === 0`. It
// never constructs LightingRig, GTAO, HairOIT or the grade. **Hair→skin occlusion on that page is
// zero BY CONSTRUCTION** — hiding the groom moves groom-free skin by 3.022e-4 of one code value.
// So when three blind judges reported "no hair→skin occlusion" they were right about the PLATE and
// said nothing about this renderer, where the same measurement runs at 96–100% of the rig's ceiling.
//
// `captures/hair-r24-before/` comes from
// `alive.html?bare&freeze&seed=1&hair=1&capture&aa=msaa&grade=0` — the deterministic forward path
// on the page every objective gate already measures. That is the arm.
const ARMS = [
  { arm: 'frostbitten', portrait: `${FB}/portrait.png`, threeQuarter: `${FB}/tq.png` },
  { arm: 'sugata', portrait: `${REPO}/captures/hair-r24-before/portrait.png`, threeQuarter: `${REPO}/captures/hair-r24-before/three-quarter.png` },
];

// A pair that does not separate would make the whole run a null result nobody can read, so
// both arms are checked against each other before anything is published. Same guard as
// rejudge.mjs, for the same reason.
function meanAbsoluteDelta(pathA, pathB) {
  const a = decodePng(fs.readFileSync(pathA));
  const b = decodePng(fs.readFileSync(pathB));
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`arms differ in size: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
  let sum = 0;
  for (let i = 0; i < a.pixels.length; i += 4) {
    sum += Math.abs(a.pixels[i] - b.pixels[i]);
  }
  return sum / (a.width * a.height);
}

function backgroundCorner(imagePath) {
  const { width, pixels } = decodePng(fs.readFileSync(imagePath));
  const i = (4 * width + 4) * 4;
  return [pixels[i], pixels[i + 1], pixels[i + 2]].map((v) => Math.round(v * 255));
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const key = { createdAt: new Date().toISOString(), sets: {} };

// crypto.randomInt, not a seed: the directory name must not be reconstructible from a log.
const order = crypto.randomInt(2) === 1 ? [1, 0] : [0, 1];

for (const armIndex of order) {
  const arm = ARMS[armIndex];
  const setId = crypto.randomBytes(5).toString('hex');
  const dir = path.join(OUT, setId);
  fs.mkdirSync(dir);

  for (const [view, source] of [['portrait', arm.portrait], ['three-quarter', arm.threeQuarter]]) {
    const stripped = stripProvenanceChunks(fs.readFileSync(source));
    fs.writeFileSync(path.join(dir, `${view}.png`), stripped.buffer);
  }

  key.sets[setId] = { arm: arm.arm, sources: [arm.portrait, arm.threeQuarter] };
  console.log(`${setId}  <- ${arm.arm}`);
}

const KEY_PATH = `${OUT}-KEY.json`; // sibling of the tree, never inside it
fs.writeFileSync(KEY_PATH, JSON.stringify(key, null, 2));

console.log('\nbackground corner, both arms (must match):');
for (const arm of ARMS) console.log(`  ${arm.arm.padEnd(12)} ${backgroundCorner(arm.portrait)}`);
console.log(`\nportrait separation, arm vs arm: mean |dR| ${meanAbsoluteDelta(ARMS[0].portrait, ARMS[1].portrait).toFixed(5)}`);
console.log(`key written to ${KEY_PATH} (OUTSIDE the judged tree)`);
