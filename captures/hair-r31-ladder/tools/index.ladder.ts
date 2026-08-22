//
// index.ladder.ts — strand-count -> ms/frame ladder for MULTIPLE grooms in ONE process.
//
// Inherits index.timing.ts wholesale: N frames encoded back-to-back into ONE command buffer,
// one submit, one onSubmittedWorkDone, wall/N. Batch-size independent from BATCH=16 up.
//
// What this adds over index.timing.ts:
//
//   1. MULTIPLE GROOMS IN ONE PROCESS. index.timing.ts reads CONFIG.hairFile once, inside
//      loadScene(). Process-to-process drift on this machine is ~11%, larger than the
//      differences we are extracting, so a groom-vs-groom comparison run as separate
//      processes is not measurable. Here every groom is loaded up front into its own
//      HairObject and `scene.hairObject` is swapped between arms, so groom differences are
//      round-robined inside one process exactly as index.timing.ts round-robins mode/lod.
//
//      Safety note: every hair-consuming pass caches its bind group under
//      `hairObject.name` (hwHairPass.ts:104, hairFinePass.ts:78, hairTilesPass.ts:86,
//      hairShadingPass.ts:49, shadowMapPass.ts:110, and the three sim passes). loadScene()
//      hardcodes the name 'sintelHair', so two grooms sharing a name would silently reuse
//      the FIRST groom's buffers. Every groom here therefore gets a unique name.
//
//   2. A FIXED-WORKLOAD CONTENTION GATE. A standalone compute shader with a fixed loop count
//      and a fixed dispatch size, timed the same way, run once per repeat round. It touches
//      nothing the renderer touches and does not change with viewport or groom, so its
//      spread across the run is a direct readout of how contended the GPU was WHILE THESE
//      ROWS WERE TAKEN.
//
import { Dimensions, ensureIntegerDimensions } from './utils/index.ts';
import { Renderer } from './renderer.ts';
import { createGpuDevice } from './utils/webgpu.ts';
import { createErrorSystem } from './utils/errors.ts';
import { CONFIG, MODELS_DIR, HairFile } from './constants.ts';
import {
  textFileReader_Deno,
  createTextureFromFile_Deno,
  binaryFileReader_Deno,
} from './sys_deno/loadersDeno.ts';
import { Scene } from './scene/scene.ts';
import { loadScene, createHairObject } from './scene/loadScene.ts';
import { parseTfxFile } from './scene/hair/tfxFileLoader.ts';
import { GpuProfiler } from './gpuProfiler.ts';
import { DISPLAY_MODE } from './constants.ts';

CONFIG.loaders.textFileReader = textFileReader_Deno;
CONFIG.loaders.binaryFileReader = binaryFileReader_Deno;
CONFIG.loaders.createTextureFromFile = createTextureFromFile_Deno;
CONFIG.colors.gamma = 1.0;

const num = (name: string, fallback: number) => {
  const raw = Deno.env.get(name);
  return raw === undefined ? fallback : Number(raw);
};
const col = (r: number, g: number, b: number): [number, number, number] => [r / 255, g / 255, b / 255]; // prettier-ignore

const VIEWPORT: Dimensions = { width: num('W', 720), height: num('H', 900) };
const WARMUP = num('WARMUP', 6);
const BATCH = num('BATCH', 40);
const REPEATS = num('REPEATS', 8);

// Same scene overrides as index.control.ts / index.timing.ts, so the thing timed here is the
// thing the control judged.
const BG = [num('BGR', 4.53125), num('BGG', 4.984375), num('BGB', 5.890625)] as const;
CONFIG.background.color0 = col(BG[0], BG[1], BG[2]);
CONFIG.background.color1 = col(BG[0], BG[1], BG[2]);
CONFIG.background.gradientStrength = 0.0;
CONFIG.background.noiseScale = 0.0;
CONFIG.hairRender.material.color0 = col(59, 38, 27);
CONFIG.hairRender.material.color1 = col(92, 63, 44);
CONFIG.drawColliders = false;
CONFIG.colliderGizmo.lineLength = 0.0;
CONFIG.colliderGizmo.lineWidth = 0.0;
CONFIG.camera.position.position = [num('CX', 0.0), num('CY', 1.47), num('CZ', 1.07)];
CONFIG.camera.position.rotation = [num('YAW', 0.0), num('PITCH', 0.0)];
CONFIG.camera.projection.fovDgr = num('FOV', 30);

const device = (await createGpuDevice())!;
if (!device) Deno.exit(1);
const errorSystem = createErrorSystem(device);
errorSystem.startErrorScope('init');

// --------------------------------------------------------------------------------------
// Grooms. GROOMS is a comma list of `label=file.tfx`.
// --------------------------------------------------------------------------------------
const GROOM_SPEC = (Deno.env.get('GROOMS') ??
  'sintel11400=SintelHairOriginal-sintel_hair.16points.tfx').split(',');

CONFIG.hairFile = GROOM_SPEC[0].split('=')[1] as HairFile;
const scene: Scene = await loadScene(device);

type Groom = { label: string; file: string; obj: ReturnType<typeof createHairObject> };
const grooms: Groom[] = [];
for (const spec of GROOM_SPEC) {
  const [label, file] = spec.split('=');
  const bytes = await CONFIG.loaders.binaryFileReader(`${MODELS_DIR}/${file}`);
  const tfx = parseTfxFile(bytes, 1.0);
  // Unique name per groom: the bind-group caches are keyed on it.
  const obj = createHairObject(device, `groom-${label}`, tfx);
  grooms.push({ label, file, obj });
}
// All grooms must agree on points-per-strand: CONFIG.pointsPerStrand is a single global that
// the render uniforms carry, so a mixed-topology run would silently mis-index one of them.
const ppsSet = new Set(grooms.map((g) => g.obj.pointsPerStrand));
if (ppsSet.size !== 1) {
  console.error(`ABORT: mixed pointsPerStrand across grooms: ${[...ppsSet].join(',')}`);
  Deno.exit(1);
}
CONFIG.pointsPerStrand = grooms[0].obj.pointsPerStrand;

const canvasDimensions = ensureIntegerDimensions(VIEWPORT);
const windowTexture = device.createTexture({
  label: 'ladder-target',
  size: [canvasDimensions.width, canvasDimensions.height],
  format: 'rgba8unorm-srgb',
  usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
});
const windowTextureView = windowTexture.createView();

const profiler = new GpuProfiler(device); // never enabled here; ablation only
const renderer = new Renderer(device, VIEWPORT, 'rgba8unorm-srgb', profiler);

await assertNoWebGPUErrorsAsync();
errorSystem.startErrorScope('beforeFirstFrame');
// One init per groom, so every groom's sim buffers and grid state are primed.
for (const g of grooms) {
  scene.hairObject = g.obj;
  renderer.beforeFirstFrame(scene);
}
await assertNoWebGPUErrorsAsync();

// --------------------------------------------------------------------------------------
// Fixed-workload contention gate.
// --------------------------------------------------------------------------------------
const GATE_WORKGROUPS = 256;
const GATE_ITERS = 4096;
const gateModule = device.createShaderModule({
  label: 'gate-shader',
  code: `
@group(0) @binding(0) var<storage, read_write> sink: array<f32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  var acc = f32(gid.x) * 1.000001;
  for (var i = 0u; i < ${GATE_ITERS}u; i = i + 1u) {
    acc = fma(acc, 1.0000001, 0.0000001);
  }
  sink[gid.x] = acc;
}`,
});
const gatePipeline = device.createComputePipeline({
  label: 'gate-pipeline',
  layout: 'auto',
  compute: { module: gateModule, entryPoint: 'main' },
});
const gateBuffer = device.createBuffer({
  label: 'gate-sink',
  size: GATE_WORKGROUPS * 64 * 4,
  usage: GPUBufferUsage.STORAGE,
});
const gateBindings = device.createBindGroup({
  label: 'gate-bindings',
  layout: gatePipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: { buffer: gateBuffer } }],
});
const GATE_DISPATCHES = 8;
async function runGate(): Promise<number> {
  const cmdBuf = device.createCommandEncoder({ label: 'gate' });
  const pass = cmdBuf.beginComputePass({ label: 'gate-pass' });
  pass.setPipeline(gatePipeline);
  pass.setBindGroup(0, gateBindings);
  for (let i = 0; i < GATE_DISPATCHES; i++) pass.dispatchWorkgroups(GATE_WORKGROUPS, 1, 1);
  pass.end();
  const t0 = performance.now();
  device.queue.submit([cmdBuf.finish()]);
  await device.queue.onSubmittedWorkDone();
  return performance.now() - t0;
}

// --------------------------------------------------------------------------------------
// Batch runner. Identical to index.timing.ts.
// --------------------------------------------------------------------------------------
async function runBatch(nFrames: number) {
  profiler.beginFrame();
  profiler.profileNextFrame(false);
  const cmdBuf = device.createCommandEncoder({ label: 'ladder-batch' });
  for (let i = 0; i < nFrames; i++) {
    renderer.cmdRender(cmdBuf, scene, windowTextureView);
  }
  profiler.endFrame(cmdBuf);
  const t0 = performance.now();
  device.queue.submit([cmdBuf.finish()]);
  await device.queue.onSubmittedWorkDone();
  return performance.now() - t0;
}

// ARMS: "mode:sim:lod". Every arm is run against every groom, and the whole
// groom x arm cross product is round-robined inside this one process.
const ARMS = (Deno.env.get('ARMS') ?? '0:1:100,0:0:100,1:0:100,3:0:100,3:0:0').split(',');
const samples = new Map<string, number[]>();
const gateSamples: number[] = [];

// Arm = "mode:sim:lod" or "mode:sim:lod:fibreRadiusMultiplier". The fourth field is the
// other lever on apparent density, and unlike strand count it adds no per-strand work --
// only per-fragment work -- so its price is worth having beside the strand ladder's.
const BASE_FIBER_RADIUS = CONFIG.hairRender.fiberRadius;
function applyArm(groom: Groom, arm: string) {
  const [mode, sim, lod, rad] = arm.split(':').map(Number);
  scene.hairObject = groom.obj;
  CONFIG.displayMode = mode;
  CONFIG.hairSimulation.enabled = sim === 1;
  CONFIG.hairRender.lodRenderPercent = lod;
  CONFIG.hairRender.fiberRadius = BASE_FIBER_RADIUS * (Number.isFinite(rad) ? rad : 1);
}

errorSystem.startErrorScope('ladder');
for (let i = 0; i < WARMUP; i++) {
  await runGate();
  for (const g of grooms) {
    applyArm(g, ARMS[0]);
    await runBatch(BATCH);
  }
}

// The full groom x arm cross product, flattened. Any FIXED visiting order gives the arms at
// the start of a round a systematically different thermal/contention position from those at
// the end, and here that bias would fall along groom boundaries — exactly the axis being
// compared. So the starting offset rotates every round.
const pairs: Array<{ g: Groom; arm: string }> = [];
for (const g of grooms) for (const arm of ARMS) pairs.push({ g, arm });

// EXTRA is a comma list of `groomLabel|mode:sim:lod` for arms that only make sense on one
// groom -- the prefix-LOD arms, which exist to be differenced against a stratified groom of
// the same strand count.
for (const spec of (Deno.env.get('EXTRA') ?? '').split(',').filter(Boolean)) {
  const [label, arm] = spec.split('|');
  const g = grooms.find((x) => x.label === label);
  if (!g) { console.error(`ABORT: EXTRA names unknown groom '${label}'`); Deno.exit(1); }
  pairs.push({ g: g!, arm });
}

for (let r = 0; r < REPEATS; r++) {
  gateSamples.push(await runGate());
  for (let i = 0; i < pairs.length; i++) {
    const { g, arm } = pairs[(i + r) % pairs.length];
    const key = `${g.label}|${arm}`;
    applyArm(g, arm);
    await runBatch(BATCH); // settle this arm's state before timing it
    const wall = await runBatch(BATCH);
    if (!samples.has(key)) samples.set(key, []);
    samples.get(key)!.push(wall / BATCH);
  }
}
gateSamples.push(await runGate());

await assertNoWebGPUErrorsAsync();

const stat = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return {
    n: s.length,
    min: s[0],
    median: s[(s.length / 2) | 0],
    mean: s.reduce((p, c) => p + c, 0) / s.length,
    max: s[s.length - 1],
  };
};

const gateStat = stat(gateSamples);
const out = {
  tool: 'src/index.ladder.ts',
  viewport: `${VIEWPORT.width}x${VIEWPORT.height}`,
  warmup: WARMUP,
  batch: BATCH,
  repeats: REPEATS,
  arms: ARMS,
  contentionGate: {
    description: `fixed compute: ${GATE_DISPATCHES} dispatches x ${GATE_WORKGROUPS} workgroups x 64 threads x ${GATE_ITERS} fma`,
    ms: gateStat,
    spreadPctOfMin: ((gateStat.max - gateStat.min) / gateStat.min) * 100,
    perRoundMs: gateSamples,
  },
  grooms: grooms.map((g) => ({
    label: g.label,
    file: g.file,
    strands: g.obj.strandsCount,
    pointsPerStrand: g.obj.pointsPerStrand,
    segments: g.obj.segmentCount,
    boundsSphere: g.obj.bounds.sphere,
  })),
  extra: (Deno.env.get('EXTRA') ?? ''),
  rows: [...samples.entries()].map(([key, v]) => {
    const [label, arm] = key.split('|');
    const [mode, sim, lod, rad] = arm.split(':').map(Number);
    const g = grooms.find((x) => x.label === label)!;
    const strands = Math.min(
      Math.ceil((g.obj.strandsCount * Math.max(0, Math.min(100, lod))) / 100),
      g.obj.strandsCount
    );
    return {
      groom: label,
      arm,
      mode,
      sim,
      lod,
      fibreRadiusMul: Number.isFinite(rad) ? rad : 1,
      strandsRendered: strands,
      segmentsRendered: strands * (g.obj.pointsPerStrand - 1),
      msPerFrame: stat(v),
    };
  }),
};
console.log(JSON.stringify(out));

async function assertNoWebGPUErrorsAsync() {
  const lastError = await errorSystem.reportErrorScopeAsync();
  if (lastError) {
    console.error(lastError);
    Deno.exit(1);
  }
}
