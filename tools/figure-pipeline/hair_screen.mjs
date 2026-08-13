#!/usr/bin/env node
//
// hair_screen.mjs — the strand run-count statistic, computed on the RENDERED FRAME.
//
// ## Why this tool exists
//
// `hair_alpha.mjs` measures how many separate strand runs a row of the atlas crosses, and the last
// round moved strip 1 from 1.15 runs per row to 4.13 at the sampled lod. A blind critic then looked
// at the rendered avatar and reported *"a single near-vertical ~10px dithered band … no strand
// frequency inside the mass"*. Both can be true: the atlas is a FILE and the critic judged PIXELS,
// and every stage between the two can destroy structure. Nothing in this repository had ever
// measured the screen side, so the atlas number had no counterpart to be contradicted by.
//
// This computes the same KIND of number on the other end of the chain, so that the two are one
// comparison rather than two claims:
//
//   RUNS PER CARD WIDTH. The atlas statistic is runs per row of one 128-texel strip. On screen a
//   strip covers `128 / |grad u|` pixels, where `grad u` is the per-pixel across-strand texel
//   gradient read off the same Jacobian `hair_lod.mjs` uses. Counting screen runs and dividing by
//   the number of card widths the row crossed puts both on one axis.
//
// ## What the screen operator is, and the one that was tried first and could not see the defect
//
// The atlas cutoff is `alpha >= 0.5` — "is this texel more strand than gap". The frame has no
// alpha, so the equivalent question is "is this pixel more hair than face", asked on the axis that
// actually separates them: every pixel is projected onto the vector from the mean near-hair face
// colour to the mean hair colour, giving `t` = 0 at face and 1 at hair. A run is a maximal span of
// `t >= 0.5` along a row, normalised to one card width — which is exactly what
// `hair_alpha.runsPerRow` counts along a row of a 128-texel strip.
//
// 🚩 **THE FIRST VERSION OF THIS TOOL USED A LOCAL LUMINANCE BASELINE AND COULD NOT SEE THE
// DEFECT.** A box baseline one card wide plus a deadband read 4.0 runs per card on the shipped
// plate and looked like a pass, while a 4x crop of that same plate is the critic's *"unbroken flat
// mauve wall"*. It was counting card-silhouette steps and shading ripple, because a baseline one
// card wide passes everything finer than a card and a strand is forty times finer than that.
// Standing rule 4, third round running.
//
// ⚠️ **AND THE FACE ENDPOINT HAS TO EXCLUDE OCCLUDED SKIN, WHICH IS MOST OF IT.** `probe.skin` is
// the frontmost non-hair surface, and under a bob that is mostly scalp and cheek WITH THE GROOM IN
// FRONT. Averaging those in put the face endpoint at rgb 104.8,77.6,81.4 against a hair endpoint of
// 97.5,70.8,77.8 — a separation of 10.62 code values, an axis made of hair. Requiring
// `mask === 0` as well moves the face endpoint to 154.6,124.2,105.9 and the separation to **83.10**
// (52.38 on luminance alone). Both figures are off the same shipped plate, this session.
//
// ## Two masks, because they are two different questions
//
//   BOUNDARY  the row segment is `hair ∪ face`, so a strand gap can show as the face behind it.
//             The cheek crossing the critic described, and the only place on the figure where the
//             atlas's alpha has anything to be alpha AGAINST.
//   INTERIOR  the row segment is hair only. A gap there reveals the next card, not the face, so
//             this number is near 1 by construction. It is printed to make that explicit.
//
//   node tools/figure-pipeline/hair_screen.mjs
//   node tools/figure-pipeline/hair_screen.mjs --arm 'aa=off&hairoit=cutout' --out captures/hair-screen
//
// With no --url it starts vite itself on a free port and stops it again.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 🚩 fileURLToPath, never string surgery on `import.meta.url`: this repository's own path carries a
// space and a non-ASCII character. `hair_lod.mjs` records the same trap.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');

const { decodePng, encodePng } = await import(
  pathToFileURL(path.join(REPO_ROOT, 'tools', 'critic', 'png.mjs')).href);
const { areaResample, stripAlpha, runsPerRow } = await import(
  pathToFileURL(path.join(HERE, 'hair_alpha.mjs')).href);

/** `hair_texture.STRIP_COLUMNS`. One card strip is `atlasSize / STRIPS` texels of u. */
const STRIPS = 8;

/**
 * The base plate every arm is a variation of — `hair_lod.mjs`'s URL, so the two agree.
 *
 * ⚠️ IT IS NOT THE SHIPPED PLATE: `shadows=0&grade=0` strip the hair's own cast shadow and the
 * ACES/bloom/RCAS chain, and RCAS in particular is a SHARPEN sitting after everything else. Pass
 * `--base 'bare&freeze&capture&seed=1&grain=0&hair=1'` for the frame a critic is shown.
 */
const BASE_QUERY = 'bare&freeze&capture&seed=1&grain=0&hair=1&shadows=0&grade=0';

/** The arms, as query fragments appended to the base. The first is the shipping configuration. */
const DEFAULT_ARMS = [
  { name: 'shipped   taau0.66 + stochastic', query: '' },
  { name: 'taau0.66 + cutout             ', query: '&hairoit=cutout' },
  { name: 'no AA, full res + stochastic  ', query: '&aa=off' },
  { name: 'no AA, full res + cutout      ', query: '&aa=off&hairoit=cutout' }
];

/**
 * A row segment shorter than this is not asked for a run count. Below about a card width the box
 * baseline has nothing to be a baseline against and the count is an artefact of the window.
 */
const MIN_SEGMENT = 24;

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.out !== null) fs.mkdirSync(options.out, { recursive: true });

  const playwright = await loadPlaywright();
  const server = options.url === null ? await startVite() : null;
  const origin = options.url ?? `${server.origin}/alive.html`;

  try {
    // 🚩 ONE BROWSER PER ARM. Sharing a process across four arms crashed the GPU process on the
    // third — `?aa=off` rebuilds the stage — and a crash mid-run destroys the arms after it as well
    // as the one that failed. A fresh process per arm also removes any chance that a previous arm's
    // pipeline state is what the next arm is measured through.
    for (const arm of options.arms) {
      const browser = await playwright.chromium.launch({
        channel: 'chromium',
        headless: true,
        args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--hide-scrollbars']
      });

      try {
        const url = `${origin}?${options.base}${arm.query}`;
        const page = await openPage(browser, url, options);
        const probe = await installProbe(page);
        const shot = await page.locator('#stage').screenshot({ type: 'png' });

        const plate = decodePng(shot);
        report(arm, url, probe, plate, options);
        if (options.out !== null) {
          const stem = `${options.stem}${arm.query}`.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'shipped';
          fs.writeFileSync(path.join(options.out, `plate-${stem}.png`), shot);
          writeMaskPng(path.join(options.out, `mask-${stem}.png`), plate, probe);
        }
      } catch (error) {
        console.log('');
        console.log(`=== ${arm.name.trim()} — FAILED ===`);
        console.log(`  ${error.message.split('\n')[0]}`);
      } finally {
        await browser.close();
      }
    }
  } finally {
    if (server !== null) server.stop();
  }
}

// --- the statistic ------------------------------------------------------------------------------

/**
 * The face→hair colour axis, and every pixel's position along it.
 *
 * `t` is 0 at the mean near-hair face colour and 1 at the mean hair colour, so `t >= 0.5` is the
 * screen's version of `alpha >= 0.5`. Both endpoints are measured off THIS plate rather than
 * carried between arms: the grade, the OIT arm and the resolve all move them.
 */
function hairnessAxis(plate, probe) {
  const NEAR = 40;
  const width = probe.width;
  const hair = [ 0, 0, 0 ];
  const face = [ 0, 0, 0 ];
  let hairCount = 0;
  let faceCount = 0;

  for (let row = 0; row < probe.height; row += 1) {
    const base = row * width;

    // Face pixels within NEAR of a hair pixel on the same row, from both sides. A mean over all
    // visible skin would drag in the shadowed neck, and this endpoint is being used as "what would
    // show if a strand gap opened HERE".
    for (const direction of [ 1, -1 ]) {
      let nearest = -Infinity;
      const from = direction === 1 ? 0 : width - 1;
      const stop = direction === 1 ? width : -1;
      for (let column = from; column !== stop; column += direction) {
        if (probe.mask[base + column] === 1) nearest = column;
        // 🚩 `skin` is the frontmost NON-HAIR surface and most of it is UNDER the groom. A face
        // endpoint averaged over occluded skin is an average of hair, and the axis collapses.
        if (probe.skin[base + column] === 1 && probe.mask[base + column] === 0 &&
            Math.abs(column - nearest) <= NEAR) {
          for (let channel = 0; channel < 3; channel += 1) {
            face[channel] += plate.pixels[(base + column) * 4 + channel] * 255;
          }
          faceCount += 1;
        }
      }
    }

    for (let column = 0; column < width; column += 1) {
      if (probe.mask[base + column] !== 1) continue;
      for (let channel = 0; channel < 3; channel += 1) {
        hair[channel] += plate.pixels[(base + column) * 4 + channel] * 255;
      }
      hairCount += 1;
    }
  }

  for (let channel = 0; channel < 3; channel += 1) {
    hair[channel] /= Math.max(1, hairCount);
    face[channel] /= Math.max(1, faceCount);
  }
  const axis = [ hair[0] - face[0], hair[1] - face[1], hair[2] - face[2] ];
  const separation = Math.hypot(axis[0], axis[1], axis[2]);

  const t = new Float64Array(width * probe.height);
  for (let index = 0; index < t.length; index += 1) {
    let projection = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      projection += (plate.pixels[index * 4 + channel] * 255 - face[channel]) * axis[channel];
    }
    t[index] = projection / (separation * separation);
  }

  return { t, hair, face, separation };
}

/**
 * `hair_alpha.runsPerRow`'s rule along screen rows, normalised to one card width.
 *
 * The row is walked in segments of `region` rather than whole, because a row crosses the head twice
 * and the backdrop between the two would merge two runs into one. Card widths accumulate only over
 * HAIR pixels: the face half of a boundary segment is where a run can end, not a width the count is
 * divided by.
 */
function runsPerCardWidth(t, region, widthMask, probe, cutoff) {
  const width = probe.width;
  let runs = 0;
  let cardWidths = 0;
  let pixels = 0;
  let segments = 0;

  for (let row = 0; row < probe.height; row += 1) {
    let column = 0;
    while (column < width) {
      if (region[row * width + column] === 0) { column += 1; continue; }
      let end = column;
      while (end < width && region[row * width + end] === 1) end += 1;

      if (end - column >= MIN_SEGMENT) {
        let previous = 0;
        for (let at = column; at < end; at += 1) {
          const kept = t[row * width + at] >= cutoff ? 1 : 0;
          if (kept === 1 && previous === 0) runs += 1;
          previous = kept;
          if (widthMask[row * width + at] === 1) cardWidths += 1 / probe.cardWidth[row * width + at];
        }
        pixels += end - column;
        segments += 1;
      }

      column = end;
    }
  }

  return { runs, pixels, segments, perCard: cardWidths === 0 ? 0 : runs / cardWidths };
}

/**
 * The atlas side, at the width one card covers ON THE SCENE PASS.
 *
 * ⚠️ NOT at `hair_alpha.SAMPLED_LOD`. That constant is 1.492 and was measured in CSS pixels, while
 * the page ships `resolutionScale` 0.66 — the coverage decision is made once per scene-pass pixel,
 * and that is the rate the structure has to survive.
 */
function atlasRunsAtWidth(atlas, strip, sceneCardWidth) {
  const plane = stripAlpha(atlas, strip, STRIPS);

  return runsPerRow(areaResample(plane, plane.width / Math.max(2, sceneCardWidth)));
}

// --- reporting ----------------------------------------------------------------------------------

function report(arm, url, probe, plate, options) {
  const atlas = decodePng(fs.readFileSync(
    path.join(REPO_ROOT, 'assets', 'hair', 'bob01', 'albedo.png')));

  if (probe.width !== plate.width || probe.height !== plate.height) {
    throw new Error(`hair_screen: probe raster ${probe.width}x${probe.height} does not match the ` +
      `screenshot ${plate.width}x${plate.height}; the run statistic would read a misaligned mask.`);
  }

  const axis = hairnessAxis(plate, probe);

  console.log('');
  console.log(`=== ${arm.name.trim()} ===`);
  console.log(`  ${url}`);
  console.log(`  canvas ${plate.width}x${plate.height}   scene pass ${probe.sceneWidth}x${probe.sceneHeight} ` +
    `(resolutionScale ${probe.resolutionScale})   atlas ${probe.atlasSize}²   anisotropy ` +
    `${probe.anisotropy}  minFilter ${probe.minFilter}  generateMipmaps ${probe.generateMipmaps}`);
  console.log(`  face→hair axis: face rgb ${axis.face.map((v) => v.toFixed(1)).join(',')}  ` +
    `hair rgb ${axis.hair.map((v) => v.toFixed(1)).join(',')}  separation ` +
    `${axis.separation.toFixed(2)} code values (luma alone separates them by ` +
    `${Math.abs(0.2126 * (axis.hair[0] - axis.face[0]) + 0.7152 * (axis.hair[1] - axis.face[1]) +
      0.0722 * (axis.hair[2] - axis.face[2])).toFixed(2)})`);

  console.log('');
  console.log('  strip    hairPx   cardPx(css/scene)   ATLAS runs/card   BOUNDARY runs/card   ' +
    'INTERIOR runs/card   share');

  for (const strip of options.strips) {
    const hairOnly = new Uint8Array(probe.width * probe.height);
    let widthTotal = 0;
    let counted = 0;
    for (let index = 0; index < hairOnly.length; index += 1) {
      if (probe.mask[index] === 0) continue;
      if (strip !== -1 && probe.strip[index] !== strip) continue;
      hairOnly[index] = 1;
      widthTotal += probe.cardWidth[index];
      counted += 1;
    }
    if (counted === 0) continue;

    // The boundary region is those hair pixels PLUS every face pixel, so a run of hair can end at
    // the face. Without the face half the answer is one run per segment by construction.
    const boundary = new Uint8Array(probe.width * probe.height);
    for (let index = 0; index < boundary.length; index += 1) {
      const visibleFace = probe.skin[index] === 1 && probe.mask[index] === 0;
      boundary[index] = (hairOnly[index] === 1 || visibleFace) ? 1 : 0;
    }

    const cssCardWidth = widthTotal / counted;
    const sceneCardWidth = cssCardWidth * probe.resolutionScale;
    const atlasRuns = atlasRunsAtWidth(atlas, strip === -1 ? 1 : strip, sceneCardWidth);
    const onBoundary = runsPerCardWidth(axis.t, boundary, hairOnly, probe, 0.5);
    const onInterior = runsPerCardWidth(axis.t, hairOnly, hairOnly, probe, 0.5);

    console.log(`  ${strip === -1 ? 'all ' : `s${strip}  `} ${String(counted).padStart(9)} ` +
      `${`${cssCardWidth.toFixed(1)}/${sceneCardWidth.toFixed(1)}`.padStart(19)} ` +
      `${atlasRuns.toFixed(3).padStart(17)} ${onBoundary.perCard.toFixed(3).padStart(20)} ` +
      `${onInterior.perCard.toFixed(3).padStart(20)} ` +
      `${(onBoundary.perCard / Math.max(1e-9, atlasRuns) * 100).toFixed(1).padStart(6)}%`);
  }

  console.log('  share — BOUNDARY as a percentage of ATLAS. 100% would mean every strand run in the');
  console.log('          file arrives at the frame buffer as a distinguishable run of hair.');
}


/** The mask, as a picture, so a reader can see what the statistic was allowed to look at. */
function writeMaskPng(file, plate, probe) {
  const bytes = Buffer.alloc(plate.width * plate.height * 4);
  for (let index = 0; index < plate.width * plate.height; index += 1) {
    const on = probe.mask[index] === 1;
    const value = on ? 40 + probe.strip[index] * 30 : (probe.skin[index] === 1 ? 60 : 0);
    bytes[index * 4] = value;
    bytes[index * 4 + 1] = on && probe.strip[index] === 1 ? 255 : value;
    bytes[index * 4 + 2] = value;
    bytes[index * 4 + 3] = 255;
  }
  fs.writeFileSync(file, encodePng(plate.width, plate.height, bytes));
}

// --- the probe ----------------------------------------------------------------------------------

/**
 * Rasterises the groom against a z-buffer of every non-hair mesh, exactly as `hair_lod.mjs` does,
 * and returns the per-pixel mask, strip and across-strand card width in CSS pixels — plus the
 * render-target and sampler state, which are two of the links this round is walking.
 */
async function installProbe(page) {
  const measured = await page.evaluate(({ strips }) => {
    const stage = globalThis.sugata.stage;

    let hair = null;
    const behind = [];
    stage.scene.traverse((object) => {
      if (object.isMesh !== true) return;
      if (object.material?.name === 'sugata.hair') hair = object;
      else behind.push(object);
    });
    if (hair === null) throw new Error('hair_screen: no mesh carries the `sugata.hair` material.');

    // 🚩 `material.map` IS NULL ON THIS MATERIAL AND `hair_lod.mjs` SILENTLY FELL BACK TO A LITERAL
    // 1024 BECAUSE OF IT. `HairMaterial` carries the strand coverage inside `colorNode` —
    // `vec4( baseColour, texture( alphaMap ).a )` — so the only handle on the atlas is the
    // `TextureNode` in the graph. A sampler-state reading taken off a null texture is a reading
    // about nothing, which is the failure mode this round exists to find.
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
    const atlas = hair.material.map ?? findTexture(hair.material.colorNode) ?? null;
    if (atlas === null) throw new Error('hair_screen: no Texture reachable from the hair colorNode.');
    const atlasSize = atlas.image.width;

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
    const skinMask = new Uint8Array(width * height);
    for (const mesh of behind) {
      if (mesh.name === 'ground') continue;
      // Every opaque mesh that is not the groom and not the floor. The skin is not separable by
      // material name — `SkinMaterial` sets none — and at portrait framing this set IS the face.
      const screen = project(mesh);
      rasterise(screen, mesh, (index, z) => {
        if (z < behindZ[index]) { behindZ[index] = z; skinMask[index] = 1; }
      });
    }

    // Per triangle: which strip it samples, and the across-strand texel gradient. `u` runs across
    // the strand — the strips are columns of the atlas — so `128 / |grad u|` is the number of screen
    // pixels one card strip covers, which is the axis the atlas run count lives on.
    const hairScreen = project(hair);
    const uv = hair.geometry.attributes.uv;
    const indices = hair.geometry.index;
    const triangles = indices ? indices.count / 3 : uv.count / 3;
    const triangleCardWidth = new Float64Array(triangles).fill(NaN);
    const triangleStrip = new Uint8Array(triangles);
    const stripTexels = atlasSize / strips;

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
      const f2u = (uv.getX(c) - uv.getX(a)) * atlasSize;

      const dudx = (f1u * e2y - f2u * e1y) / determinant;
      const dudy = (f2u * e1x - f1u * e2x) / determinant;
      const gradient = Math.hypot(dudx, dudy);
      if (!(gradient > 0)) continue;

      triangleCardWidth[triangle] = stripTexels / gradient;
      triangleStrip[triangle] = Math.max(0, Math.min(strips - 1,
        Math.floor(((uv.getX(a) + uv.getX(b) + uv.getX(c)) / 3) * strips)));
    }

    const mask = new Uint8Array(width * height);
    const strip = new Uint8Array(width * height);
    const cardWidth = new Float64Array(width * height);
    const frontZ = new Float32Array(width * height).fill(Infinity);
    rasterise(hairScreen, hair, (index, z, triangle) => {
      if (z >= behindZ[index]) return;
      if (Number.isNaN(triangleCardWidth[triangle])) return;
      if (z >= frontZ[index]) return;
      frontZ[index] = z;
      mask[index] = 1;
      strip[index] = triangleStrip[triangle];
      cardWidth[index] = triangleCardWidth[triangle];
    });

    return {
      width, height, atlasSize,
      mask: Array.from(mask), strip: Array.from(strip), cardWidth: Array.from(cardWidth),
      skin: Array.from(skinMask),
      anisotropy: atlas.anisotropy ?? null,
      minFilter: atlas.minFilter ?? null,
      magFilter: atlas.magFilter ?? null,
      generateMipmaps: atlas.generateMipmaps ?? null,
      mipmapCount: atlas.mipmaps?.length ?? 0,
      colorSpace: atlas.colorSpace ?? null,
      resolutionScale: stage.resolutionScale ?? null,
      drawingWidth: stage.renderer.domElement.width,
      drawingHeight: stage.renderer.domElement.height,
      sceneWidth: Math.round(stage.renderer.domElement.width * (stage.resolutionScale ?? 1)),
      sceneHeight: Math.round(stage.renderer.domElement.height * (stage.resolutionScale ?? 1))
    };
  }, { strips: STRIPS });

  measured.mask = Uint8Array.from(measured.mask);
  measured.strip = Uint8Array.from(measured.strip);
  measured.cardWidth = Float64Array.from(measured.cardWidth);
  measured.skin = Uint8Array.from(measured.skin);

  return measured;
}

// --- plumbing ------------------------------------------------------------------------------------

function parseArguments(argv) {
  const options = {
    url: null, out: null, arms: DEFAULT_ARMS, base: BASE_QUERY,
    strips: [-1, 0, 1, 2, 3, 4, 5, 6, 7], width: 900, height: 1200, stem: ''
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index + 1];
    if (argv[index] === '--url') options.url = value;
    if (argv[index] === '--out') options.out = value;
    if (argv[index] === '--base') options.base = value;
    if (argv[index] === '--width') options.width = Number(value);
    if (argv[index] === '--height') options.height = Number(value);
    if (argv[index] === '--arm') options.arms = [{ name: value, query: `&${value}` }];
    if (argv[index] === '--stem') options.stem = value;
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

  // 🚩 SIXTEEN STEPS, NOT ONE, AND THAT IS THE WHOLE POINT ON THE SHIPPED ARM. `stochastic` is a
  // per-pixel coverage ESTIMATE that only becomes a coverage value once a temporal resolve has
  // integrated it; judging it on frame 0 measures the dither pattern rather than the arm. Every arm
  // gets the same count so the comparison holds the clock constant.
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
