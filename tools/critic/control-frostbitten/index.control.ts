//
// index.control.ts — renders THIS renderer's hair at OUR capture framing, so it can be
// judged by our critics on the same terms as our own plates.
//
// This is a CONTROL, not an integration. Nothing here changes how frostbitten shades or
// rasterizes hair; it changes only the four things that would otherwise tell a judge which
// renderer it is looking at:
//
//   1. VIEWPORT   1280x720 -> 720x900. Our portrait plate size.
//   2. BACKGROUND the cyan gradient -> our flat RGB(20,22,26), measured off
//                 captures/hair-r23-after/front.png at all four corners.
//   3. HAIR COLOUR the demo default is literally purple — RGB(119,43,119) root,
//                 RGB(76,0,255) tip. Left in, it hands a judge the same word ("purple")
//                 that five of our own judges reached for, for a completely unrelated
//                 reason, and the control would prove nothing. Neutralised to a plausible
//                 warm dark brown. Deliberately NOT our own albedo #1A0E0C: matching it
//                 would smuggle our colour result into the control.
//   4. PROPS      the yellow collision ball and its RGB axis gizmo are scene furniture.
//
// Camera framing is driven from the environment so it can be solved by looking, at ~2s a
// render, without editing this file each time.
//
// Everything else — lights, shadow, AO, fibre radius, lobe weights, roughness, the strand
// file — is the author's, untouched.
//
import { getRowPadding, createCapture } from 'std/webgpu';
import { Dimensions, ensureIntegerDimensions } from './utils/index.ts';
import { Renderer } from './renderer.ts';
import { createGpuDevice } from './utils/webgpu.ts';
import { createErrorSystem } from './utils/errors.ts';
import { writePngFromGPUBuffer } from './sys_deno/fakeCanvas.ts';
import { CONFIG } from './constants.ts';
import {
  textFileReader_Deno,
  createTextureFromFile_Deno,
  binaryFileReader_Deno,
} from './sys_deno/loadersDeno.ts';
import { Scene } from './scene/scene.ts';
import { loadScene } from './scene/loadScene.ts';

CONFIG.loaders.textFileReader = textFileReader_Deno;
CONFIG.loaders.binaryFileReader = binaryFileReader_Deno;
CONFIG.loaders.createTextureFromFile = createTextureFromFile_Deno;
CONFIG.colors.gamma = 1.0;

// --- the control's overrides, and nothing else ------------------------------------------

const num = (name: string, fallback: number) => {
  const raw = Deno.env.get(name);
  return raw === undefined ? fallback : Number(raw);
};

/**
 * The author's own convention, copied from `col()` in constants.ts: a plain /255, NOT a
 * gamma decode. Values written here therefore live wherever the demo's GUI values live,
 * and the number that lands in the PNG is measured off the PNG rather than predicted.
 */
const col = (r: number, g: number, b: number): [number, number, number] => [
  r / 255,
  g / 255,
  b / 255,
];

const VIEWPORT: Dimensions = { width: num('W', 720), height: num('H', 900) };
const OUTPUT = Deno.env.get('OUT') ?? './control.png';

// Our plate's background, measured, flat. color0 == color1 kills the gradient.
//
// The number set here is NOT the number that lands in the PNG: this value is written into
// an HDR target and then travels a tonemap and an sRGB-format store before it is read back.
// Feeding it (20,22,26) produced (74,80,90) on the plate. So the value is SOLVED against a
// measurement of the output rather than predicted from the pipeline, which is why it is an
// env knob — see the `--solve-bg` loop in solve-bg.mjs.
// Solved: these three land as exactly (20,22,26) on the written PNG. `node solve-bg.mjs`.
const BG = [num('BGR', 4.53125), num('BGG', 4.984375), num('BGB', 5.890625)] as const;
CONFIG.background.color0 = col(BG[0], BG[1], BG[2]);
CONFIG.background.color1 = col(BG[0], BG[1], BG[2]);
CONFIG.background.gradientStrength = 0.0;
CONFIG.background.noiseScale = 0.0;

// A warm dark brown, root darker than tip the way real hair is. R > G > B at both ends,
// which is the one thing melanin absorption guarantees and our shipped albedo violated.
CONFIG.hairRender.material.color0 = col(59, 38, 27);
CONFIG.hairRender.material.color1 = col(92, 63, 44);

// Scene furniture. The gizmo is drawn unconditionally in FINAL mode, so it is removed by
// giving it no length rather than by patching the renderer.
CONFIG.drawColliders = false;
CONFIG.colliderGizmo.lineLength = 0.0;
CONFIG.colliderGizmo.lineWidth = 0.0;

// NOTE: `Camera.resetPosition` reads rotation[0] as YAW and rotation[1] as PITCH. The
// comment in constants.ts says "[pitch, yaw]" and is wrong — read camera.ts, not the label.
CONFIG.camera.position.position = [num('CX', 0.0), num('CY', 1.6), num('CZ', 0.62)];
CONFIG.camera.position.rotation = [num('YAW', 0.0), num('PITCH', 0.0)];
CONFIG.camera.projection.fovDgr = num('FOV', 30);

// ----------------------------------------------------------------------------------------

const device = (await createGpuDevice())!;
if (!device) Deno.exit(1);
const errorSystem = createErrorSystem(device);
errorSystem.startErrorScope('init');

const scene: Scene = await loadScene(device);
await renderSceneToFile(device, scene, OUTPUT);

async function renderSceneToFile(
  device: GPUDevice,
  scene: Scene,
  outputPath: string
) {
  const PREFERRED_CANVAS_FORMAT = 'rgba8unorm-srgb';
  const canvasDimensions = ensureIntegerDimensions(VIEWPORT);
  const { texture: windowTexture, outputBuffer } = createCapture(
    device,
    canvasDimensions.width,
    canvasDimensions.height
  );
  const windowTextureView = windowTexture.createView();

  const renderer = new Renderer(
    device,
    VIEWPORT,
    PREFERRED_CANVAS_FORMAT,
    undefined
  );

  await assertNoWebGPUErrorsAsync();
  errorSystem.startErrorScope('beforeFirstFrame');
  renderer.beforeFirstFrame(scene);
  await assertNoWebGPUErrorsAsync();

  errorSystem.startErrorScope('frame');
  const cmdBuf = device.createCommandEncoder({ label: 'control-frame' });
  renderer.cmdRender(cmdBuf, scene, windowTextureView);
  cmdCopyTextureToBuffer(cmdBuf, windowTexture, outputBuffer, renderer.viewportSize);
  device.queue.submit([cmdBuf.finish()]);
  await assertNoWebGPUErrorsAsync();

  await writePngFromGPUBuffer(outputBuffer, renderer.viewportSize, outputPath);
  console.log(
    `Result: '${outputPath}' ${VIEWPORT.width}x${VIEWPORT.height} ` +
      `cam=[${CONFIG.camera.position.position}] yaw/pitch=[${CONFIG.camera.position.rotation}] ` +
      `fov=${CONFIG.camera.projection.fovDgr}`
  );
}

function cmdCopyTextureToBuffer(
  cmdBuf: GPUCommandEncoder,
  texture: GPUTexture,
  outputBuffer: GPUBuffer,
  dimensions: Dimensions
): void {
  const { padded } = getRowPadding(dimensions.width);
  cmdBuf.copyTextureToBuffer(
    { texture },
    { buffer: outputBuffer, bytesPerRow: padded },
    dimensions
  );
}

async function assertNoWebGPUErrorsAsync() {
  const lastError = await errorSystem.reportErrorScopeAsync();
  if (lastError) {
    console.error(lastError);
    Deno.exit(1);
  }
}
