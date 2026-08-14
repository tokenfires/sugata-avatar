//
// solve-bg.mjs — finds the background value that COMES OUT of this renderer as our plate's.
//
// The control's background has to match our own plate's RGB(20,22,26) in the FINISHED PNG,
// otherwise a judge can tell the two renderers apart by their backdrop alone. But the value
// set in CONFIG is written into an HDR target and then travels a tonemap and an sRGB store,
// so it is not the value that lands. Feeding (20,22,26) produced (74,80,90).
//
// Rather than model that chain, this bisects it. Each channel's transfer is monotonic, so a
// per-channel bisection on the measured corner pixel converges in a handful of ~4s renders.
//
//   node solve-bg.mjs
//
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { decodePng } from '../png.mjs';

// The frostbitten clone is not vendored — see README.md.
const FB = process.env.FB_DIR;
if (!FB) throw new Error('set FB_DIR to your frostbitten clone — see README.md');

const TARGET = [20, 22, 26];
const ROUNDS = 12;

function render(bg) {
  execFileSync(
    'deno',
    ['run', '--allow-read=.', '--allow-write=.', '--allow-env', '--unstable-webgpu', 'src/index.control.ts'],
    {
      cwd: FB,
      env: {
        ...process.env,
        DENO_NO_PACKAGE_JSON: '1',
        OUT: './bg-probe.png',
        BGR: String(bg[0]), BGG: String(bg[1]), BGB: String(bg[2]),
      },
      stdio: 'pipe',
    }
  );
  const { width, pixels } = decodePng(fs.readFileSync(`${FB}/bg-probe.png`));
  // (4,4) is background in every framing this control uses.
  const i = (4 * width + 4) * 4;
  return [pixels[i], pixels[i + 1], pixels[i + 2]].map((v) => Math.round(v * 255));
}

// Bisect each channel independently between 0 and its current (too bright) value.
let lo = [0, 0, 0];
let hi = [20, 22, 26];
let best = null;

for (let round = 0; round < ROUNDS; round++) {
  const mid = lo.map((l, c) => (l + hi[c]) / 2);
  const got = render(mid);
  console.log(
    `round ${round}: in [${mid.map((v) => v.toFixed(4))}] -> out [${got}] target [${TARGET}]`
  );
  best = { input: mid, output: got };
  if (got.every((v, c) => v === TARGET[c])) break;
  for (let c = 0; c < 3; c++) {
    if (got[c] > TARGET[c]) hi[c] = mid[c];
    else lo[c] = mid[c];
  }
}

console.log(`\nSOLVED: BGR=${best.input[0]} BGG=${best.input[1]} BGB=${best.input[2]}`);
console.log(`lands as [${best.output}], target [${TARGET}]`);
