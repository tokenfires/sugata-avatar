import { Color, Mesh, MeshBasicNodeMaterial, PlaneGeometry, RenderTarget, Vector3,
  NoColorSpace, NoToneMapping, UnsignedByteType } from 'three/webgpu';
import { vec4 } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Stage } from '../../../packages/core/src/render/Stage.js';
import { configureHairMaterial } from '../../../packages/core/src/render/HairOIT.js';

const query = new URLSearchParams(location.search);
const config = JSON.parse(query.get('config'));
const size = 256;
const stage = await new Stage().create(document.getElementById('stage'), {
  width: size, height: size, maxPixelRatio: 1, temporalAA: config.temporal,
  antialias: false, hairOIT: config.mode
});
const renderer = stage.renderer;
if (!renderer.backend.isWebGPUBackend) throw Error('Expected actual WebGPU');
renderer._animation.stop();
renderer.toneMapping = NoToneMapping;
stage.camera.position.set(0, 0, 5);
stage.camera.lookAt(0, 0, 0);
stage.camera.updateMatrixWorld(true);
stage.scene.background = new Color(1, 1, 1);
// Linear fixture output. TAAU keeps its scene pass, velocity, depth and default scale.
if (stage.renderPipeline) {
  stage.renderPipeline.outputNode = stage.temporal.node;
  stage.renderPipeline.outputColorTransform = false;
  stage.renderPipeline.needsUpdate = true;
}
const material = (value, alpha = 1) => {
  const m = new MeshBasicNodeMaterial();
  m.colorNode = vec4(value, value, value, alpha);
  m.toneMapped = false;
  return m;
};
const body = new Mesh(new PlaneGeometry(6, 6), material(1));
body.position.z = 0;
stage.add(body);
const geometries = [0.5, 0.25].map(z => new PlaneGeometry(1.5, 1.5).translate(0, 0, z));
const makeHair = alpha => configureHairMaterial(material(0, alpha), config.mode);
const cards = [];
if (config.merged) {
  const geometry = mergeGeometries(geometries);
  if (config.reverse) {
    const indices = Array.from(geometry.index.array), triangles = [];
    for (let i = 0; i < indices.length; i += 3) triangles.push(indices.slice(i, i + 3));
    geometry.setIndex(triangles.reverse().flat());
  }
  cards.push(new Mesh(geometry, makeHair(config.alphas[0])));
} else {
  for (let i = 0; i < config.alphas.length; i++) {
    const mesh = new Mesh(geometries[i], makeHair(config.alphas[i]));
    mesh.renderOrder = config.reverse ? 10 - i : 10 + i;
    cards.push(mesh);
  }
}
cards.forEach((card, i) => {
  // Diagnostic use of the existing per-material phase handle, not a production candidate.
  if (config.phases) card.material.hairDitherPhase = config.phases[i];
  stage.add(card);
});
if (config.frontBody) {
  const occluder = new Mesh(new PlaneGeometry(3, 3), material(1));
  occluder.position.z = 1;
  stage.add(occluder);
}
stage.scene.updateMatrixWorld(true);
const projected = geometries.map(g => {
  const points = Array.from({length: g.attributes.position.count}, (_, i) => {
    const p = new Vector3().fromBufferAttribute(g.attributes.position, i).project(stage.camera);
    return [(p.x * 0.5 + 0.5) * size, (0.5 - p.y * 0.5) * size];
  });
  return {x0: Math.min(...points.map(p => p[0])), x1: Math.max(...points.map(p => p[0])),
    y0: Math.min(...points.map(p => p[1])), y1: Math.max(...points.map(p => p[1]))};
});
// Fixed intersection of both projected card geometries, eroded eight pixels for resolve support.
const bounds = {x0: Math.ceil(Math.max(...projected.map(p => p.x0))) + 8,
  x1: Math.floor(Math.min(...projected.map(p => p.x1))) - 8,
  y0: Math.ceil(Math.max(...projected.map(p => p.y0))) + 8,
  y1: Math.floor(Math.min(...projected.map(p => p.y1))) - 8};
const mask = [];
for (let y = bounds.y0; y < bounds.y1; y++) for (let x = bounds.x0; x < bounds.x1; x++) mask.push(y * size + x);
if (mask.length === 0) throw Error('Empty geometry mask');
const target = new RenderTarget(size, size, {type: UnsignedByteType, depthBuffer: true});
target.texture.colorSpace = NoColorSpace;
const frame = renderer._nodes.nodeFrame;
frame.frameId = 0; frame.time = 0; frame.deltaTime = 0; frame.lastTime = undefined;
stage.temporal?.resetFrameEpoch();
const adapter = await navigator.gpu.requestAdapter();
const adapterInfo = {vendor: adapter.info.vendor, architecture: adapter.info.architecture, description: adapter.info.description};
async function draw() {
  frame.update(); frame.time = 0; frame.deltaTime = 0;
  renderer.setRenderTarget(target);
  await stage.draw();
  renderer.setRenderTarget(null);
  const bytes = await renderer.readRenderTargetPixelsAsync(target, 0, 0, size, size);
  if (!(bytes instanceof Uint8Array) || bytes.length !== size * size * 4) throw Error('Unexpected linear target layout');
  let sum = 0, min = 255, max = 0;
  for (const i of mask) {
    const value = bytes[i * 4];
    if (bytes[i * 4 + 1] !== value || bytes[i * 4 + 2] !== value) throw Error('Non-neutral fixture output');
    sum += value; min = Math.min(min, value); max = Math.max(max, value);
  }
  return {bytes, mean: sum / mask.length / 255, min: min / 255, max: max / 255,
    offsets: cards.map(c => c.material.hairDitherOffset?.value ?? null), frameId: frame.frameId};
}
globalThis.layerProbe = {
  async run(count = 128) {
    const frames = [], sums = new Float64Array(mask.length);
    let last;
    for (let n = 0; n < count; n++) {
      last = await draw();
      frames.push({frameId: last.frameId, mean: last.mean, min: last.min, max: last.max, offsets: last.offsets});
      for (let j = 0; j < mask.length; j++) sums[j] += last.bytes[mask[j] * 4] / 255;
    }
    return {config, actual: {stats: stage.stats, adapter: adapterInfo, frameId: frame.frameId,
      captureTime: frame.time, materials: cards.map(c => ({transparent:c.material.transparent,
        depthWrite:c.material.depthWrite, alphaTest:c.material.alphaTest, alphaTestNode:!!c.material.alphaTestNode,
        triangles:c.geometry.index.count/3, renderOrder:c.renderOrder}))},
      size, projected, bounds, maskPixels: mask.length, frames,
      temporalMean: frames.reduce((sum, f) => sum + f.mean, 0) / count,
      pixelMeans: Array.from(sums, v => v / count),
      final: {mean: last.mean, min: last.min, max: last.max, rgba: Array.from(last.bytes)}};
  },
  dispose() {target.dispose(); stage.dispose();}
};
