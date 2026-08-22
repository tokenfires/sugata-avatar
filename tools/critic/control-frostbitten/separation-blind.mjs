//
// separation-blind.mjs — builds the THREE blind arms of the r31 separation.
//
// `control-blind.mjs` answers "are the judges reporting our defects or reporting the bar" with
// two arms. It cannot answer the question this round exists for, which is one level down:
//
//   A. our groom  x OUR renderer     captures/hair-r24-before/
//   B. our groom  x THEIR renderer   captures/hair-r31-separation/arm-b/     <- the separator
//   C. their groom x THEIR renderer  captures/control-frostbitten/
//
// A vs B holds the GROOM fixed and swaps the RENDERER. B vs C holds the RENDERER fixed and
// swaps the GROOM. Any complaint that survives into B is a property of the guide curves; any
// complaint that dies in B was being made by the card/alpha/dither path.
//
// 🚩 ARM A AND ARMS B/C ARE NOT FRAMED ALIKE AND THE BACKGROUND IS A PROVENANCE TELL.
// Arm A's corners measure RGB(2,3,4) at the top and SKIN at the bottom — it is a tight bust on
// near-black. Arms B and C measure RGB(20,22,26) at all four corners and are mid-shots. That
// difference predates this round (it is in the 2026-08-14 plates as shipped) and it is NOT
// repaired here, because re-rendering arm A would substitute a fresh plate for the one six
// judges actually saw. It is instead DECLARED: A-vs-B is confounded by framing and backdrop,
// and B-vs-C is the clean pair. Read the verdict off B-vs-C first.
//
// The arm-C COMPANION (`captures/hair-r31-separation/arm-c-companion/`) is their groom rendered
// at the same two cameras as arm B, so B-vs-C differs in the groom and in nothing else. It does
// NOT replace `captures/control-frostbitten/`, which is what was judged on 2026-08-14 and is
// left untouched. Pass ARM_C=companion to judge the matched pair, or ARM_C=original for the
// 8/14 plates.
//
// The answer key lands OUTSIDE the judged tree, as a sibling. Same reason as control-blind.mjs:
// a judge here is a subagent with a shell and "one level up" is one `ls ..` from no blind.
//
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { decodePng, stripProvenanceChunks } from '../png.mjs';

// fileURLToPath, not string surgery: this repository's path has a space and a non-ASCII
// character in it, so import.meta.url arrives percent-encoded.
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SEP = path.join(REPO, 'captures', 'hair-r31-separation');

const armC = process.env.ARM_C === 'original'
  ? { portrait: `${REPO}/captures/control-frostbitten/portrait.png`, threeQuarter: `${REPO}/captures/control-frostbitten/tq.png` }
  : { portrait: `${SEP}/arm-c-companion/portrait.png`, threeQuarter: `${SEP}/arm-c-companion/three-quarter.png` };

const ARMS = [
  { arm: 'A-our-groom-our-renderer',     portrait: `${REPO}/captures/hair-r24-before/portrait.png`, threeQuarter: `${REPO}/captures/hair-r24-before/three-quarter.png` },
  { arm: 'B-our-groom-their-renderer',   portrait: `${SEP}/arm-b/portrait.png`,                     threeQuarter: `${SEP}/arm-b/three-quarter.png` },
  { arm: 'C-their-groom-their-renderer', ...armC },
];

const OUT = process.env.OUT_DIR ?? path.join(SEP, 'blind');

function corner(imagePath) {
  const { width, pixels } = decodePng(fs.readFileSync(imagePath));
  const i = (4 * width + 4) * 4;
  return [pixels[i], pixels[i + 1], pixels[i + 2]].map((v) => Math.round(v * 255)).join(',');
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const key = { createdAt: new Date().toISOString(), armC: process.env.ARM_C ?? 'companion', sets: {} };

// crypto.randomInt, not a seed: a directory name must not be reconstructible from a log.
const order = [0, 1, 2];
for (let i = order.length - 1; i > 0; i--) {
  const j = crypto.randomInt(i + 1);
  [order[i], order[j]] = [order[j], order[i]];
}

for (const armIndex of order) {
  const arm = ARMS[armIndex];
  const setId = crypto.randomBytes(5).toString('hex');
  const dir = path.join(OUT, setId);
  fs.mkdirSync(dir);
  for (const [view, source] of [['portrait', arm.portrait], ['three-quarter', arm.threeQuarter]]) {
    fs.writeFileSync(path.join(dir, `${view}.png`), stripProvenanceChunks(fs.readFileSync(source)).buffer);
  }
  key.sets[setId] = { arm: arm.arm, sources: [arm.portrait, arm.threeQuarter] };
  console.log(`${setId}  <- ${arm.arm}`);
}

const KEY_PATH = `${OUT}-KEY.json`; // sibling of the tree, never inside it
fs.writeFileSync(KEY_PATH, JSON.stringify(key, null, 2));

console.log('\nbackground corner (4,4) per arm — B and C must match, A is declared different:');
for (const arm of ARMS) console.log(`  ${arm.arm.padEnd(32)} ${corner(arm.portrait)}`);
console.log(`\nkey written to ${KEY_PATH} (OUTSIDE the judged tree)`);
