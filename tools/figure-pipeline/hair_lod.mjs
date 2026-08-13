#!/usr/bin/env node
//
// hair_lod.mjs — at what mip level does the camera actually read the strand atlas?
//
// ## Why a whole tool for one number
//
// Every statistic anyone has quoted about `hair_texture.py`'s sheet — mean alpha, coverage at the
// cutoff, the share of texels that are strand rather than gap — has been read off MIP 0, and mip 0
// is not what the renderer samples. A box mip chain conserves the MEAN alpha exactly (measured
// again this session: 0.4993 at every level of the shipped `albedo.png`), so minification cannot
// lose coverage. What it does is convert a hard-edged strand into a mid-alpha wash: the shipped
// sheet's strip 2 is 14.50% mid-band at mip 0 and 36.15% mid-band at mip 2, which is the same
// picture going from "hairs with gaps" to "grey smear" without a single number about coverage
// moving. **A sub-strand thinner than about two texels AT THE SAMPLED LOD is not a strand.**
//
// So the sampled lod is the constraint on how fine the atlas may be authored, and it is a property
// of the framing rather than of the sheet. It has to be measured off the real page.
//
// ## What it measures, and why it is not a screenshot
//
// The GPU's own trilinear rule, evaluated on the CPU for every hair triangle the camera can see:
//
//     J   = d(u,v)/d(x,y)      the affine screen->UV Jacobian of the triangle
//     lod = log2( max( |J·x̂|, |J·ŷ| ) · atlasSize )
//
// which is the WebGPU/GL minification formula for an isotropic sampler. `--aniso N` reports the
// same figure with the footprint's long axis divided by N, which is what an anisotropic sampler
// would read; the shipped material sets no anisotropy, so 1 is the default and the number the
// atlas has to be authored against.
//
// Every triangle is rasterised with the live camera, the live skinning and a z-buffer of every
// NON-hair mesh, so the histogram is weighted by PIXELS ACTUALLY LOOKED AT and counts only cards
// nearer than the first opaque surface — the same mask discipline as `hair_opacity.mjs`, and for
// standing rule 4's reason: a lod averaged over the whole sheet or over back-facing cards is a
// number about the asset rather than about the picture.
//
// 🚩 **THE PER-STRIP SPLIT IS THE POINT, NOT THE HEADLINE MEDIAN.** The strips are not sampled at
// the same rate: the interior strips ride cards that lie flat across the face and fill the frame,
// the wisps ride the outermost cards which are edge-on and tiny. Authoring the sheet against one
// median would over-resolve one end of it and smear the other.
//
//   node tools/figure-pipeline/hair_lod.mjs
//   node tools/figure-pipeline/hair_lod.mjs --out captures/hair-lod --aniso 4
//
// With no --url it starts vite itself on a free port and stops it again.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 🚩 fileURLToPath, never string surgery on `import.meta.url`: this repository's own path carries a
// space and a non-ASCII character. `hair_shots.mjs` records the same trap.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');

/**
 * The framings the blind critic judged, as a yaw on the FIGURE rather than an orbit of the camera —
 * `hair_opacity.mjs`'s VIEWS records why: turning the figure keeps `alive.js`'s own portrait
 * framing and its camera-relative lighting exactly as shipped.
 *
 * 35° rather than 45° because the critic's "3/4 pose" is the one where the curtain crosses the eye,
 * and past about 40° the far curtain has left the face.
 */
const VIEWS = [
  { name: 'portrait', yaw: 0 },
  { name: 'three-quarter', yaw: 35 }
];

/** The atlas the groom samples, so the Jacobian can be turned into texels. Read off the material. */
const FALLBACK_ATLAS_SIZE = 1024;

/** The lod histogram's bins. 0.05 of a mip level, over the whole range a projection can produce. */
const BIN_FROM = -8;
const BIN_WIDTH = 0.05;
const BIN_COUNT = 320;

async function main() {
  const options = parseArguments(process.argv.slice(2));

  const playwright = await loadPlaywright();
  const server = options.url === null ? await startVite() : null;
  const url = `${options.url ?? `${server.origin}/alive.html`}` +
    '?bare&freeze&capture&seed=1&grain=0&hair=1&shadows=0&grade=0';

  const browser = await playwright.chromium.launch({
    channel: 'chromium',
    headless: true,
    args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--hide-scrollbars']
  });

  try {
    const page = await openPage(browser, url);
    await installProbe(page);

    for (const view of VIEWS) {
      await page.evaluate((yaw) => globalThis.__hairLod.setYaw(yaw), view.yaw);
      const measured = await page.evaluate(() => globalThis.__hairLod.measure());
      report(view, measured, options.aniso);
    }
  } finally {
    await browser.close();
    if (server !== null) server.stop();
  }
}

/**
 * One view's table, read off the per-strip HISTOGRAM the probe returns.
 *
 * 🚩 **A HISTOGRAM RATHER THAN THE SAMPLES, AND THAT IS NOT AN OPTIMISATION.** The first version
 * returned one (lod, strip) pair per hair pixel and it worked at 484 cards and died at 648: ten
 * million numbers crossing the Playwright bridge as JSON is a node heap overflow, and a
 * measurement tool that falls over when the thing it measures gets denser is a tool that will be
 * absent exactly when it is wanted. The bins are 0.05 of a mip level wide over −8 to +8, which is
 * a twentieth of the resolution any number below is quoted to.
 */
function report(view, measured, aniso) {
  const shift = Math.log2(aniso);

  console.log('');
  console.log(`${view.name}  yaw ${view.yaw}°  ${measured.width}x${measured.height}  ` +
    `atlas ${measured.atlasSize}²  ${measured.total.toLocaleString()} hair px in front  ` +
    `aniso ${aniso}`);
  console.log('  strip        px      p10      p50      p90     mean   texels/strand-width-1px');

  for (let strip = -1; strip < 8; strip += 1) {
    const bins = strip === -1
      ? measured.histograms.reduce((total, one) =>
        total.map((count, index) => count + one[index]), new Array(BIN_COUNT).fill(0))
      : measured.histograms[strip];
    const count = bins.reduce((total, value) => total + value, 0);
    if (count === 0) continue;

    const lodOf = (bin) => BIN_FROM + (bin + 0.5) * BIN_WIDTH - shift;
    const at = (share) => {
      let seen = 0;
      for (let bin = 0; bin < BIN_COUNT; bin += 1) {
        seen += bins[bin];
        if (seen >= share * count) return lodOf(bin);
      }
      return lodOf(BIN_COUNT - 1);
    };
    let weighted = 0;
    for (let bin = 0; bin < BIN_COUNT; bin += 1) weighted += bins[bin] * lodOf(bin);

    // What one texel of mip-0 authoring is worth at the median lod: the divisor a strand's
    // authored width is scaled by before the sampler sees it.
    const scale = 2 ** at(0.5);
    console.log(`  ${strip === -1 ? 'all  ' : `s${strip}   `} ${String(count).padStart(9)} ` +
      `${at(0.1).toFixed(3).padStart(8)} ${at(0.5).toFixed(3).padStart(8)} ` +
      `${at(0.9).toFixed(3).padStart(8)} ${(weighted / count).toFixed(3).padStart(8)}   ` +
      `${(1 / scale).toFixed(3)}`);
  }
}

/**
 * The probe. Reads the scene graph `alive.js` publishes and writes nothing to it but the figure's
 * own yaw, which `hair_opacity.mjs` already does for the same reason — that file belongs to
 * another agent.
 */
async function installProbe(page) {
  await page.evaluate(({ fallbackAtlasSize, binFrom, binWidth, binCount }) => {
    const stage = globalThis.sugata.stage;

    let hair = null;
    const behind = [];
    stage.scene.traverse((object) => {
      if (object.isMesh !== true) return;
      if (object.material?.name === 'sugata.hair') hair = object;
      else behind.push(object);
    });
    if (hair === null) throw new Error('hair_lod: no mesh carries the `sugata.hair` material.');

    const atlas = hair.material.map ?? hair.material.baseColorTexture ?? null;
    const atlasSize = atlas?.image?.width ?? fallbackAtlasSize;

    globalThis.__hairLod = {
      setYaw: (degrees) => {
        globalThis.sugata.session.figure.root.rotation.y = degrees * Math.PI / 180;
        globalThis.sugata.session.figure.root.updateMatrixWorld(true);
      },

      measure: () => {
        const camera = stage.camera;
        const Vector3 = camera.position.constructor;
        const Matrix4 = camera.matrixWorld.constructor;
        camera.updateMatrixWorld(true);
        camera.updateProjectionMatrix();

        const canvas = stage.renderer.domElement;
        const width = canvas.clientWidth || canvas.width;
        const height = canvas.clientHeight || canvas.height;
        const viewProjection = new Matrix4().multiplyMatrices(
          camera.projectionMatrix, camera.matrixWorldInverse);

        const project = (mesh) => {
          mesh.updateMatrixWorld(true);
          const position = mesh.geometry.attributes.position;
          const screen = new Float32Array(position.count * 3);
          const point = new Vector3();
          const matrix = new Matrix4().multiplyMatrices(viewProjection, mesh.matrixWorld);
          for (let index = 0; index < position.count; index += 1) {
            point.fromBufferAttribute(position, index);
            if (mesh.isSkinnedMesh === true) mesh.applyBoneTransform(index, point);
            point.applyMatrix4(matrix);
            screen[index * 3] = (point.x * 0.5 + 0.5) * width;
            screen[index * 3 + 1] = (1 - (point.y * 0.5 + 0.5)) * height;
            screen[index * 3 + 2] = point.z;
          }
          return screen;
        };

        const rasterise = (screen, mesh, visit) => {
          const indices = mesh.geometry.index;
          const triangles = indices
            ? indices.count / 3
            : mesh.geometry.attributes.position.count / 3;
          for (let triangle = 0; triangle < triangles; triangle += 1) {
            const a = indices ? indices.getX(triangle * 3) : triangle * 3;
            const b = indices ? indices.getX(triangle * 3 + 1) : triangle * 3 + 1;
            const c = indices ? indices.getX(triangle * 3 + 2) : triangle * 3 + 2;
            const ax = screen[a * 3], ay = screen[a * 3 + 1], az = screen[a * 3 + 2];
            const bx = screen[b * 3], by = screen[b * 3 + 1], bz = screen[b * 3 + 2];
            const cx = screen[c * 3], cy = screen[c * 3 + 1], cz = screen[c * 3 + 2];
            const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
            const maxX = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
            const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
            const maxY = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));
            if (minX > maxX || minY > maxY) continue;
            const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
            if (area === 0) continue;
            for (let y = minY; y <= maxY; y += 1) {
              for (let x = minX; x <= maxX; x += 1) {
                const px = x + 0.5, py = y + 0.5;
                const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area;
                const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area;
                const w2 = 1 - w0 - w1;
                if (w0 < 0 || w1 < 0 || w2 < 0) continue;
                visit(y * width + x, w0 * az + w1 * bz + w2 * cz, triangle);
              }
            }
          }
        };

        const behindZ = new Float32Array(width * height).fill(Infinity);
        for (const mesh of behind) {
          if (mesh.name === 'ground') continue;
          const screen = project(mesh);
          rasterise(screen, mesh, (index, z) => {
            if (z < behindZ[index]) behindZ[index] = z;
          });
        }

        /**
         * Per triangle: the trilinear lod, and which of the eight strips it samples.
         *
         * The Jacobian is taken from the triangle's SCREEN edges against its UV edges, which is the
         * affine approximation the hardware itself uses inside a 2x2 quad. A card ring is a few
         * pixels tall, so the perspective term across one triangle is far below the half-mip the
         * table quotes to.
         */
        const hairScreen = project(hair);
        const uv = hair.geometry.attributes.uv;
        const indices = hair.geometry.index;
        const triangles = indices ? indices.count / 3 : uv.count / 3;
        const triangleLod = new Float64Array(triangles).fill(NaN);
        const triangleStrip = new Uint8Array(triangles);

        for (let triangle = 0; triangle < triangles; triangle += 1) {
          const a = indices ? indices.getX(triangle * 3) : triangle * 3;
          const b = indices ? indices.getX(triangle * 3 + 1) : triangle * 3 + 1;
          const c = indices ? indices.getX(triangle * 3 + 2) : triangle * 3 + 2;

          const e1x = hairScreen[b * 3] - hairScreen[a * 3];
          const e1y = hairScreen[b * 3 + 1] - hairScreen[a * 3 + 1];
          const e2x = hairScreen[c * 3] - hairScreen[a * 3];
          const e2y = hairScreen[c * 3 + 1] - hairScreen[a * 3 + 1];
          const determinant = e1x * e2y - e1y * e2x;
          if (determinant === 0) continue;

          const f1u = (uv.getX(b) - uv.getX(a)) * atlasSize;
          const f1v = (uv.getY(b) - uv.getY(a)) * atlasSize;
          const f2u = (uv.getX(c) - uv.getX(a)) * atlasSize;
          const f2v = (uv.getY(c) - uv.getY(a)) * atlasSize;

          // [f1 f2] · [e1 e2]^-1, written out rather than assembled, because a 2x2 inverse in a
          // hot loop is four multiplies and a divide either way and this spells the rule.
          const dudx = (f1u * e2y - f2u * e1y) / determinant;
          const dvdx = (f1v * e2y - f2v * e1y) / determinant;
          const dudy = (f2u * e1x - f1u * e2x) / determinant;
          const dvdy = (f2v * e1x - f1v * e2x) / determinant;

          const along = Math.hypot(dudx, dvdx);
          const down = Math.hypot(dudy, dvdy);
          const footprint = Math.max(along, down);
          if (!(footprint > 0)) continue;

          triangleLod[triangle] = Math.log2(footprint);
          triangleStrip[triangle] = Math.max(0, Math.min(7,
            Math.floor(((uv.getX(a) + uv.getX(b) + uv.getX(c)) / 3) * 8)));
        }

        const histograms = Array.from({ length: 8 }, () => new Array(binCount).fill(0));
        let total = 0;
        rasterise(hairScreen, hair, (index, z, triangle) => {
          if (z >= behindZ[index]) return;
          if (Number.isNaN(triangleLod[triangle])) return;
          const bin = Math.max(0, Math.min(binCount - 1,
            Math.floor((triangleLod[triangle] - binFrom) / binWidth)));
          histograms[triangleStrip[triangle]][bin] += 1;
          total += 1;
        });

        return { width, height, atlasSize, histograms, total };
      }
    };
  }, { fallbackAtlasSize: FALLBACK_ATLAS_SIZE, binFrom: BIN_FROM, binWidth: BIN_WIDTH, binCount: BIN_COUNT });
}

async function openPage(browser, url) {
  const context = await browser.newContext({
    viewport: { width: 900, height: 1200 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    reducedMotion: 'no-preference'
  });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (error) => problems.push(error.message));

  console.log(url);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof globalThis.__SUGATA_STEP__ === 'function', null,
    { timeout: 120000, polling: 200 }).catch(() => {
    throw new Error(`page never exposed __SUGATA_STEP__.${problems.length > 0
      ? ` page errors: ${problems.join('; ')}` : ''}`);
  });
  await page.evaluate(() => globalThis.__SUGATA_STEP__(0));

  return page;
}

// --- plumbing ----------------------------------------------------------------------------------

function parseArguments(argv) {
  const options = { url: null, aniso: 1 };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--url') options.url = argv[index + 1];
    if (argv[index] === '--aniso') options.aniso = Number(argv[index + 1]);
  }
  return options;
}

/** Starts the repo's own vite and waits for it to say which port it took. Same as hair_shots.mjs. */
function startVite() {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['vite', '--port', '0', '--strictPort=false'], {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const stop = () => child.kill('SIGTERM');
    const timer = setTimeout(() => {
      stop();
      reject(new Error('vite did not report a URL within 60 s'));
    }, 60000);

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      const match = /(http:\/\/localhost:\d+)/.exec(chunk);
      if (match !== null) {
        clearTimeout(timer);
        resolve({ origin: match[1], stop });
      }
    });
    child.on('error', reject);
  });
}

async function loadPlaywright() {
  const candidates = ['playwright'];
  const cache = path.join(process.env.HOME ?? '', '.npm', '_npx');
  if (fs.existsSync(cache)) {
    for (const entry of fs.readdirSync(cache)) {
      const candidate = path.join(cache, entry, 'node_modules', 'playwright');
      if (fs.existsSync(candidate)) candidates.push(candidate);
    }
  }

  const require = createRequire(import.meta.url);
  for (const candidate of candidates) {
    try {
      const namespace = await import(pathToFileURL(require.resolve(candidate)).href);
      return namespace.chromium ? namespace : namespace.default;
    } catch {
      // next candidate; only the last failure matters
    }
  }

  throw new Error('playwright not resolvable. See tools/critic/capture.mjs --playwright.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
