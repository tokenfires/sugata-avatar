#!/usr/bin/env node
//
// hair_layers.mjs — how much of the atlas's strand structure is still ALPHA by the time the groom
// has been stacked on itself, measured per screen pixel.
//
// ## The question this exists for
//
// `hair_alpha.selftest.mjs` gates the atlas and reads 4.13 separate strand runs per row on strip 1
// at the sampled lod. A blind critic looked at the rendered avatar and reported *"an unbroken flat
// mauve wall … no skin shows between locks"*. `hair_screen.mjs` measures the finished frame, but a
// frame cannot say WHERE the structure went, because everything — sampler, coverage arm, resolve,
// upsample, grade — has already happened by then.
//
// This measures the one link between the atlas and the shading that nothing in this repository had
// ever looked at: **the groom is stacked several cards deep, and the union of several 62%-opaque
// cards is opaque.** A gap in the front card is not a gap in the hair; it is a window onto the card
// behind it, which is the same albedo half a millimetre away.
//
// ## How, and why it is a CPU model rather than a screenshot
//
// Every hair triangle is rasterised with the live camera, the live skinning and a z-buffer of every
// non-hair mesh, exactly as `hair_lod.mjs` does. For each covered pixel it evaluates what the GPU
// would sample — the atlas's own alpha, trilinear, through a box mip chain, at the lod the triangle
// produces IN SCENE-PASS PIXELS — and then accumulates two things:
//
//   `frontAlpha`   the alpha of the nearest card alone. This is the structure the atlas offers.
//   `coverage`     `1 - Π(1 - alphaᵢ)` over every card in front of the skin. This is the structure
//                  that survives the stack, and it is what a viewer can see as a gap, because
//                  behind a gap in card 1 is card 2 and not the face.
//
// Both are run through `hair_alpha.runsPerRow` against the same 0.5 cutoff the gate uses, so the
// three numbers — atlas, front card on screen, stacked on screen — are ONE comparison.
//
// 🚩 **THE LOD IS TAKEN IN SCENE-PASS PIXELS AND `hair_lod.mjs` TAKES IT IN CSS PIXELS.** The page
// ships TAAU at `resolutionScale` 0.66, so the sampler sees a footprint 1/0.66 wider than that tool
// reports and the true lod is 0.599 higher than the 1.492 the atlas is authored against. Measured
// here rather than assumed: the scene-pass size is read off the stage.
//
//   node tools/figure-pipeline/hair_layers.mjs
//   node tools/figure-pipeline/hair_layers.mjs --arm 'aa=off'

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 🚩 fileURLToPath, never string surgery on `import.meta.url`: this repository's own path carries a
// space and a non-ASCII character.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');

const { decodePng } = await import(
  pathToFileURL(path.join(REPO_ROOT, 'tools', 'critic', 'png.mjs')).href);
const { OPAQUE_ENOUGH, areaResample, meanAlpha, runsPerRow, stripAlpha, strandTexels } =
  await import(pathToFileURL(path.join(HERE, 'hair_alpha.mjs')).href);

const STRIPS = 8;
const BASE_QUERY = 'bare&freeze&capture&seed=1&grain=0&hair=1';

/** A row segment shorter than this is not asked for a run count — see `hair_screen.MIN_SEGMENT`. */
const MIN_SEGMENT = 24;

async function main() {
  const options = parseArguments(process.argv.slice(2));

  const playwright = await loadPlaywright();
  const server = options.url === null ? await startVite() : null;
  const origin = options.url ?? `${server.origin}/alive.html`;

  const browser = await playwright.chromium.launch({
    channel: 'chromium',
    headless: true,
    args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--hide-scrollbars']
  });

  try {
    const url = `${origin}?${options.base}${options.arm}`;
    console.log(url);
    const page = await openPage(browser, url, options);
    const measured = await probe(page);
    report(measured, options);
  } finally {
    await browser.close();
    if (server !== null) server.stop();
  }
}

// --- reporting -----------------------------------------------------------------------------------

function report(measured, options) {
  const width = measured.width;
  const height = measured.height;
  const mask = Uint8Array.from(measured.mask);
  const strip = Uint8Array.from(measured.strip);
  const frontAlpha = Float64Array.from(measured.frontAlpha);
  const coverage = Float64Array.from(measured.coverage);
  const layers = Uint16Array.from(measured.layers);
  const cardWidth = Float64Array.from(measured.cardWidth);
  const lod = Float64Array.from(measured.lod);
  const anisoLoss = Float64Array.from(measured.anisoLoss);

  console.log('');
  console.log(`  raster ${width}x${height} CSS   scene pass ${measured.sceneWidth}x${measured.sceneHeight} ` +
    `(resolutionScale ${measured.resolutionScale})   atlas ${measured.atlasSize}²`);
  console.log(`  sampler: anisotropy ${measured.anisotropy}  minFilter ${measured.minFilter}  ` +
    `magFilter ${measured.magFilter}  generateMipmaps ${measured.generateMipmaps}`);
  console.log(`  the atlas read back off the LIVE page: strip 1 mean alpha ` +
    `${measured.stripMeanAlpha[1].toFixed(4)} (the file reads 0.6198 — if these disagree the ` +
    'runtime is not sampling the sheet this tool measures)');

  // The atlas side of the comparison, computed at the width one card covers ON THE SCENE PASS,
  // which is the resolution the sampler and the coverage decision both work at.
  const atlas = decodePng(fs.readFileSync(
    path.join(REPO_ROOT, 'assets', 'hair', 'bob01', 'albedo.png')));

  let totalHair = 0;
  for (let index = 0; index < mask.length; index += 1) if (mask[index] === 1) totalHair += 1;

  console.log('');
  console.log('  strip      px   layers p50/p90   lod p50   anisoLoss   cardPx(css/scene)   ' +
    'lod_u   ATLAS runs   SAMPLED runs   FRONT runs   STACKED runs   stackedOpaque');

  for (const which of options.strips) {
    const rows = collect(which, { width, height, mask, strip, frontAlpha, coverage, layers, cardWidth, lod, anisoLoss });
    if (rows.pixels === 0) continue;

    const scenePx = rows.meanCardWidth * measured.resolutionScale;
    const plane = stripAlpha(atlas, which === -1 ? 1 : which, STRIPS);
    // ATLAS: the strip at the width one card covers on the scene pass — the finest structure the
    // file can offer at this sampling rate, with a perfect (anisotropic) filter.
    const atlasAtScene = areaResample(plane, plane.width / Math.max(2, scenePx));
    // SAMPLED: the same strip at the lod the sampler ACTUALLY chooses, which is the isotropic rule
    // and therefore coarser on u than u needs. This is the atlas as the hardware reads it.
    const atlasAtLod = areaResample(plane, 2 ** rows.lodP50);

    console.log(`  ${which === -1 ? 'all ' : `s${which}  `} ${String(rows.pixels).padStart(8)} ` +
      `${`${rows.layersP50}/${rows.layersP90}`.padStart(15)} ${rows.lodP50.toFixed(3).padStart(9)} ` +
      `${rows.anisoLossP50.toFixed(3).padStart(11)} ` +
      `${`${rows.meanCardWidth.toFixed(1)}/${scenePx.toFixed(1)}`.padStart(19)} ` +
      `${Math.log2(128 / scenePx).toFixed(3).padStart(7)} ` +
      `${runsPerRow(atlasAtScene).toFixed(3).padStart(12)} ${runsPerRow(atlasAtLod).toFixed(3).padStart(14)} ` +
      `${rows.frontRunsPerCard.toFixed(3).padStart(12)} ${rows.stackedRunsPerCard.toFixed(3).padStart(14)} ` +
      `${(rows.stackedOpaqueShare * 100).toFixed(2).padStart(14)}%`);
  }

  // 🎯 THE ACTIONABLE NUMBER: how deep the stack may be before the atlas stops mattering. Each row
  // restricts the statistic to pixels with at most that many cards in front of the face, so it says
  // what a thinner groom would buy without any of it being an argument.
  console.log('');
  console.log('  depth cap   px    share of hair   STACKED runs/card   stackedOpaque');
  for (const cap of [1, 2, 3, 4, 6, 8, 12, 16, 24, 999]) {
    const capped = new Uint8Array(width * height);
    let pixels = 0;
    let opaque = 0;
    for (let index = 0; index < capped.length; index += 1) {
      if (mask[index] === 0 || layers[index] > cap) continue;
      capped[index] = 1;
      if (coverage[index] > 0.99) opaque += 1;
      pixels += 1;
    }
    if (pixels === 0) continue;
    const runs = runsPerCardWidth(coverage, capped, cardWidth, width, height);
    console.log(`  ${String(cap === 999 ? 'all' : cap).padStart(9)} ${String(pixels).padStart(8)} ` +
      `${(pixels / totalHair * 100).toFixed(1).padStart(14)}% ${runs.toFixed(3).padStart(19)} ` +
      `${(opaque / pixels * 100).toFixed(2).padStart(14)}%`);
  }

  console.log('');
  console.log('  lod_u         — log2(128 / scene-pass card width): the minification the ACROSS-STRAND');
  console.log('                  axis actually needs. `anisoLoss` is how many mip levels beyond it the');
  console.log('                  isotropic sampler applies, and anisotropy 1 is why it is not zero.');
  console.log('  ATLAS runs    — `hair_alpha.runsPerRow` on the strip resampled to the card\'s own');
  console.log('                  scene-pass width. The best the file could do with a perfect filter.');
  console.log('  SAMPLED runs  — the same, at the lod the sampler chooses. The atlas as hardware reads it.');
  console.log('  FRONT runs    — the same cutoff on the NEAREST card\'s sampled alpha, per card width.');
  console.log('  STACKED runs  — the same cutoff on 1 - Π(1-α) over every card in front of the skin.');
  console.log('  stackedOpaque — share of hair pixels where the stack is over 0.99 opaque, i.e. where');
  console.log('                  no strand gap can reveal anything but another card.');
}

/** Per-pixel arrays reduced to the row statistics, for one strip or for all of them. */
function collect(which, plane) {
  const { width, height, mask, strip, frontAlpha, coverage, layers, cardWidth, lod, anisoLoss } = plane;

  const chosen = new Uint8Array(width * height);
  const layerList = [];
  const lodList = [];
  const anisoList = [];
  let widthTotal = 0;
  let pixels = 0;
  let opaque = 0;

  for (let index = 0; index < width * height; index += 1) {
    if (mask[index] === 0) continue;
    if (which !== -1 && strip[index] !== which) continue;
    chosen[index] = 1;
    layerList.push(layers[index]);
    lodList.push(lod[index]);
    anisoList.push(anisoLoss[index]);
    widthTotal += cardWidth[index];
    if (coverage[index] > 0.99) opaque += 1;
    pixels += 1;
  }
  if (pixels === 0) return { pixels: 0 };

  layerList.sort((a, b) => a - b);
  lodList.sort((a, b) => a - b);
  anisoList.sort((a, b) => a - b);
  const meanCardWidth = widthTotal / pixels;

  return {
    pixels,
    meanCardWidth,
    layersP50: layerList[Math.floor(pixels * 0.5)],
    layersP90: layerList[Math.floor(pixels * 0.9)],
    lodP50: lodList[Math.floor(pixels * 0.5)],
    anisoLossP50: anisoList[Math.floor(pixels * 0.5)],
    stackedOpaqueShare: opaque / pixels,
    frontRunsPerCard: runsPerCardWidth(frontAlpha, chosen, cardWidth, width, height),
    stackedRunsPerCard: runsPerCardWidth(coverage, chosen, cardWidth, width, height)
  };
}

/**
 * `hair_alpha.runsPerRow`'s rule — a run is a maximal span at or above `OPAQUE_ENOUGH` — applied
 * along screen rows and normalised to one card width, so it is the same number the gate quotes.
 *
 * The row is walked in mask segments rather than whole, because a row crosses the head twice and a
 * span of backdrop between the two would otherwise merge two runs into one.
 */
function runsPerCardWidth(values, mask, cardWidth, width, height) {
  let runs = 0;
  let cardWidths = 0;

  for (let row = 0; row < height; row += 1) {
    let column = 0;
    while (column < width) {
      if (mask[row * width + column] === 0) { column += 1; continue; }
      let end = column;
      while (end < width && mask[row * width + end] === 1) end += 1;

      if (end - column >= MIN_SEGMENT) {
        let previous = 0;
        for (let at = column; at < end; at += 1) {
          const kept = values[row * width + at] >= OPAQUE_ENOUGH ? 1 : 0;
          if (kept === 1 && previous === 0) runs += 1;
          previous = kept;
          cardWidths += 1 / cardWidth[row * width + at];
        }
      }

      column = end;
    }
  }

  return cardWidths === 0 ? 0 : runs / cardWidths;
}

// --- the probe -----------------------------------------------------------------------------------

/**
 * Rasterises the groom and evaluates, per covered pixel, what the sampler would read and what the
 * stack of cards in front of the skin adds up to.
 */
async function probe(page) {
  return page.evaluate(({ strips }) => {
    const stage = globalThis.sugata.stage;

    let hair = null;
    const behind = [];
    stage.scene.traverse((object) => {
      if (object.isMesh !== true) return;
      if (object.material?.name === 'sugata.hair') hair = object;
      else behind.push(object);
    });
    if (hair === null) throw new Error('hair_layers: no mesh carries the `sugata.hair` material.');

    // `material.map` is null on this material — the coverage lives in `colorNode` as
    // `vec4( baseColour, texture( alphaMap ).a )` — so the atlas has to be found in the node graph.
    const findTexture = (root) => {
      const seen = new Set();
      const queue = [root];
      while (queue.length > 0) {
        const node = queue.shift();
        if (node === null || typeof node !== 'object' || seen.has(node)) continue;
        seen.add(node);
        if (node.isTexture === true && node.image != null) return node;
        for (const key of Object.keys(node)) queue.push(node[key]);
      }
      return null;
    };
    const atlas = findTexture(hair.material.colorNode);
    if (atlas === null) throw new Error('hair_layers: no Texture reachable from the hair colorNode.');

    // The atlas's own alpha, read back off the live page rather than off the file: if the runtime
    // were sampling some other sheet this is where it would show.
    const atlasSize = atlas.image.width;
    const surface = new OffscreenCanvas(atlasSize, atlas.image.height);
    const context = surface.getContext('2d', { willReadFrequently: true });
    context.drawImage(atlas.image, 0, 0);
    const bytes = context.getImageData(0, 0, atlasSize, atlas.image.height).data;

    // A box mip chain, which is what `hair_alpha.areaResample` is at integer scales and what the
    // 2-texel rule was derived against.
    const chain = [{ width: atlasSize, height: atlas.image.height, values: new Float32Array(atlasSize * atlas.image.height) }];
    for (let index = 0; index < chain[0].values.length; index += 1) chain[0].values[index] = bytes[index * 4 + 3] / 255;
    while (chain[chain.length - 1].width > 1 && chain[chain.length - 1].height > 1) {
      const from = chain[chain.length - 1];
      const level = { width: from.width >> 1, height: from.height >> 1, values: null };
      level.values = new Float32Array(level.width * level.height);
      for (let row = 0; row < level.height; row += 1) {
        for (let column = 0; column < level.width; column += 1) {
          level.values[row * level.width + column] = 0.25 * (
            from.values[(row * 2) * from.width + column * 2] +
            from.values[(row * 2) * from.width + column * 2 + 1] +
            from.values[(row * 2 + 1) * from.width + column * 2] +
            from.values[(row * 2 + 1) * from.width + column * 2 + 1]);
        }
      }
      chain.push(level);
    }

    const bilinear = (level, u, v) => {
      const x = u * level.width - 0.5;
      const y = v * level.height - 0.5;
      const x0 = Math.floor(x), y0 = Math.floor(y);
      const fx = x - x0, fy = y - y0;
      const at = (px, py) => level.values[
        Math.min(level.height - 1, Math.max(0, py)) * level.width +
        Math.min(level.width - 1, Math.max(0, px))];
      return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) +
        (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
    };

    const trilinear = (u, v, level) => {
      const clamped = Math.max(0, Math.min(chain.length - 1, level));
      const low = Math.floor(clamped);
      const high = Math.min(chain.length - 1, low + 1);
      const blend = clamped - low;
      return bilinear(chain[low], u, v) * (1 - blend) + bilinear(chain[high], u, v) * blend;
    };

    // The per-strip mean, as the read-back check the report prints.
    const stripMeanAlpha = [];
    const stripWidth = Math.floor(atlasSize / strips);
    for (let index = 0; index < strips; index += 1) {
      let total = 0;
      for (let row = 0; row < chain[0].height; row += 1) {
        for (let column = 0; column < stripWidth; column += 1) {
          total += chain[0].values[row * atlasSize + index * stripWidth + column];
        }
      }
      stripMeanAlpha.push(total / (chain[0].height * stripWidth));
    }

    const camera = stage.camera;
    const Vector3 = camera.position.constructor;
    const Matrix4 = camera.matrixWorld.constructor;
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    const canvas = stage.renderer.domElement;
    const width = canvas.clientWidth || canvas.width;
    const height = canvas.clientHeight || canvas.height;
    const resolutionScale = stage.resolutionScale ?? 1;
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
            visit(y * width + x, w0 * az + w1 * bz + w2 * cz, triangle, w0, w1, w2);
          }
        }
      }
    };

    const behindZ = new Float32Array(width * height).fill(Infinity);
    for (const mesh of behind) {
      if (mesh.name === 'ground') continue;
      const screen = project(mesh);
      rasterise(screen, mesh, (index, z) => { if (z < behindZ[index]) behindZ[index] = z; });
    }

    const hairScreen = project(hair);
    const uv = hair.geometry.attributes.uv;
    const indices = hair.geometry.index;
    const triangles = indices ? indices.count / 3 : uv.count / 3;
    const triangleLod = new Float64Array(triangles).fill(NaN);
    const triangleStrip = new Uint8Array(triangles);
    const triangleCardWidth = new Float64Array(triangles);
    const triangleAnisoLoss = new Float64Array(triangles);
    const stripTexels = atlasSize / strips;

    for (let triangle = 0; triangle < triangles; triangle += 1) {
      const a = indices ? indices.getX(triangle * 3) : triangle * 3;
      const b = indices ? indices.getX(triangle * 3 + 1) : triangle * 3 + 1;
      const c = indices ? indices.getX(triangle * 3 + 2) : triangle * 3 + 2;

      // Screen edges in SCENE-PASS pixels, which is where the sampler's derivatives are taken.
      const e1x = (hairScreen[b * 3] - hairScreen[a * 3]) * resolutionScale;
      const e1y = (hairScreen[b * 3 + 1] - hairScreen[a * 3 + 1]) * resolutionScale;
      const e2x = (hairScreen[c * 3] - hairScreen[a * 3]) * resolutionScale;
      const e2y = (hairScreen[c * 3 + 1] - hairScreen[a * 3 + 1]) * resolutionScale;
      const determinant = e1x * e2y - e1y * e2x;
      if (determinant === 0) continue;

      const f1u = (uv.getX(b) - uv.getX(a)) * atlasSize;
      const f1v = (uv.getY(b) - uv.getY(a)) * atlasSize;
      const f2u = (uv.getX(c) - uv.getX(a)) * atlasSize;
      const f2v = (uv.getY(c) - uv.getY(a)) * atlasSize;

      const dudx = (f1u * e2y - f2u * e1y) / determinant;
      const dvdx = (f1v * e2y - f2v * e1y) / determinant;
      const dudy = (f2u * e1x - f1u * e2x) / determinant;
      const dvdy = (f2v * e1x - f1v * e2x) / determinant;

      const footprint = Math.max(Math.hypot(dudx, dvdx), Math.hypot(dudy, dvdy));
      if (!(footprint > 0)) continue;

      triangleLod[triangle] = Math.log2(footprint);

      // 🚩 THE ACROSS-STRAND RATE, WHICH IS NOT THE LOD. `footprint` is `max` over the two screen
      // axes of the whole (u, v) displacement — the isotropic rule the sampler uses — and on a card
      // it is dominated by the LONG axis, v. The run count lives on u alone, so the width one card
      // strip covers is `stripTexels / |grad u|`. `dudx` and `dudy` are per SCENE-PASS pixel here
      // (the edges were scaled), and the raster is in CSS pixels, so the CSS width is the scene
      // width divided by the resolution scale — a scene pixel is the wider of the two.
      triangleCardWidth[triangle] = (stripTexels / Math.hypot(dudx, dudy)) / resolutionScale;

      // What the sampler's isotropic choice costs the across-strand axis: the extra mip levels of
      // blur applied to u beyond what u itself needs. Zero would be a perfectly anisotropic filter.
      triangleAnisoLoss[triangle] = triangleLod[triangle] - Math.log2(Math.hypot(dudx, dudy));
      triangleStrip[triangle] = Math.max(0, Math.min(strips - 1,
        Math.floor(((uv.getX(a) + uv.getX(b) + uv.getX(c)) / 3) * strips)));
    }

    const mask = new Uint8Array(width * height);
    const strip = new Uint8Array(width * height);
    const cardWidth = new Float64Array(width * height);
    const lod = new Float64Array(width * height);
    const anisoLoss = new Float64Array(width * height);
    const frontAlpha = new Float64Array(width * height);
    const transmittance = new Float64Array(width * height).fill(1);
    const layers = new Uint16Array(width * height);
    const frontZ = new Float32Array(width * height).fill(Infinity);

    rasterise(hairScreen, hair, (index, z, triangle, w0, w1, w2) => {
      if (z >= behindZ[index]) return;
      if (Number.isNaN(triangleLod[triangle])) return;

      const a = indices ? indices.getX(triangle * 3) : triangle * 3;
      const b = indices ? indices.getX(triangle * 3 + 1) : triangle * 3 + 1;
      const c = indices ? indices.getX(triangle * 3 + 2) : triangle * 3 + 2;
      const u = w0 * uv.getX(a) + w1 * uv.getX(b) + w2 * uv.getX(c);
      const v = w0 * uv.getY(a) + w1 * uv.getY(b) + w2 * uv.getY(c);
      const alpha = trilinear(u, v, triangleLod[triangle]);

      mask[index] = 1;
      layers[index] += 1;
      transmittance[index] *= 1 - alpha;

      if (z < frontZ[index]) {
        frontZ[index] = z;
        frontAlpha[index] = alpha;
        strip[index] = triangleStrip[triangle];
        cardWidth[index] = triangleCardWidth[triangle];
        lod[index] = triangleLod[triangle];
        anisoLoss[index] = triangleAnisoLoss[triangle];
      }
    });

    const coverage = new Float64Array(width * height);
    for (let index = 0; index < coverage.length; index += 1) coverage[index] = 1 - transmittance[index];

    return {
      width, height, atlasSize, resolutionScale,
      sceneWidth: Math.round(canvas.width * resolutionScale),
      sceneHeight: Math.round(canvas.height * resolutionScale),
      anisotropy: atlas.anisotropy, minFilter: atlas.minFilter, magFilter: atlas.magFilter,
      generateMipmaps: atlas.generateMipmaps,
      stripMeanAlpha,
      mask: Array.from(mask), strip: Array.from(strip), layers: Array.from(layers),
      cardWidth: Array.from(cardWidth), lod: Array.from(lod), anisoLoss: Array.from(anisoLoss),
      frontAlpha: Array.from(frontAlpha), coverage: Array.from(coverage)
    };
  }, { strips: STRIPS });
}

// --- plumbing ------------------------------------------------------------------------------------

function parseArguments(argv) {
  const options = {
    url: null, arm: '', base: BASE_QUERY, width: 900, height: 1200,
    strips: [-1, 1, 2, 3, 4, 5, 6, 7]
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index + 1];
    if (argv[index] === '--url') options.url = value;
    if (argv[index] === '--base') options.base = value;
    if (argv[index] === '--arm') options.arm = `&${value}`;
    if (argv[index] === '--width') options.width = Number(value);
    if (argv[index] === '--height') options.height = Number(value);
  }
  return options;
}

async function openPage(browser, url, options) {
  const context = await browser.newContext({
    viewport: { width: options.width, height: options.height },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    reducedMotion: 'no-preference'
  });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (error) => problems.push(error.message));

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof globalThis.__SUGATA_STEP__ === 'function', null,
    { timeout: 120000, polling: 200 }).catch(() => {
    throw new Error(`page never exposed __SUGATA_STEP__.${problems.length > 0
      ? ` page errors: ${problems.join('; ')}` : ''}`);
  });
  for (let step = 0; step < 16; step += 1) await page.evaluate(() => globalThis.__SUGATA_STEP__(1 / 60));

  return page;
}

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
