import {auditHalf,decodeHalf} from './half-audit.mjs';
import { Color, Mesh, MeshBasicNodeMaterial, PlaneGeometry, RenderTarget, Vector3,
  NoColorSpace, NoToneMapping, UnsignedByteType, Uint32BufferAttribute } from 'three/webgpu';
import { interleavedGradientNoise, screenCoordinate, vec4, uniform, renderGroup, attribute, varying } from 'three/tsl';
import { thresholdNode, thresholdCPU } from './sampler.js';
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
const geometries = [0.5, 0.25].map((z,i) => {
  const geometry=new PlaneGeometry(1.5,1.5).translate(0,0,z);
  const id=config.sharedId?101:[101,503][i];
  geometry.setAttribute('stableCardId',new Uint32BufferAttribute(new Uint32Array(4).fill(id),1));
  return geometry;
});
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
  card.material.hairDitherPhase = config.phase ?? 0;
  if (config.mode === 'stochastic') {
    if(config.sampler==='counter'){
      // Explicit immutable fixture IDs, carried as a flat integer varying, also on a merged mesh.
      const cardId=varying(attribute('stableCardId','uint'),'vStableCardId');
      card.material.counterUniform=uniform(0,'uint').setGroup(renderGroup)
        .onRenderUpdate(frame=>(frame.frameId+card.material.hairDitherPhase)>>>0);
      card.material.alphaTestNode=thresholdNode(screenCoordinate.xy.floor().toUVec2(),cardId,card.material.counterUniform);
    }else{
      // Exact reconstruction of the shipping shared field and its original temporal offset.
      card.material.alphaTestNode=interleavedGradientNoise(screenCoordinate.xy)
        .add(card.material.hairDitherOffset).fract().clamp(1e-6,1);
    }
    card.material.needsUpdate=true;
  }
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
let previous;
async function readStage(index){
  const node=stage.temporal.node.passNode,rt=node._resolveRenderTarget;
  if(node.constructor.name!=='TAAUNode'||stage.temporal.sharpenNode!==null)throw Error('Unexpected resolve path');
  const texture=rt.textures[index];
  if(rt.width!==size||rt.height!==size||texture.type!==1016||renderer.backend.get(texture).texture.format!=='rgba16float')throw Error('Unexpected stage readback');
  const data=await renderer.readRenderTargetPixelsAsync(rt,0,0,size,size,index);
  const values=auditHalf(data,size,size,bounds);
  const digest=await crypto.subtle.digest('SHA-256',data);
  const sha256=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  return {data,values,sha256};
}
async function auditNative(){
  if(config.temporal!=='taau')return null;
  const node=stage.temporal.node.passNode;
  if(node.constructor.name!=='TAAUNode'||stage.temporal.sharpenNode!==null)throw Error('Unexpected resolve path');
  const result={owner:node.constructor.name,targets:[],colorCopyDifferences:0};let resolved;
  for(const [name,rt,index] of [['resolve',node._resolveRenderTarget,0],['historyColor',node._historyRenderTarget,0],['historyLock',node._historyRenderTarget,1]]){
    const data=await renderer.readRenderTargetPixelsAsync(rt,0,0,rt.width,rt.height,index);
    const texture=rt.textures[index];
    const values=auditHalf(data,size,size,bounds);
    result.targets.push({name,width:rt.width,height:rt.height,attachments:rt.textures.length,type:texture.type,
      gpuFormat:renderer.backend.get(texture).texture.format,values});
    if(name==='resolve')resolved=data;
    if(name==='historyColor')for(let i=0;i<data.length;i++)if(data[i]!==resolved[i])result.colorCopyDifferences++;
  }
  return result;
}
async function draw() {
  frame.update(); frame.time = 0; frame.deltaTime = 0;
  renderer.setRenderTarget(target);
  await stage.draw();
  renderer.setRenderTarget(null);
  const resolve=await readStage(0);
  const diagnostic=null; // No diagnostic attachment in the causal ablations.
  const bytes = await renderer.readRenderTargetPixelsAsync(target, 0, 0, size, size);
  if (!(bytes instanceof Uint8Array) || bytes.length !== size * size * 4) throw Error('Unexpected linear target layout');
  let sum = 0, squares = 0, deltaSquares = 0, min = 255, max = 0, oracleMismatches=0;
  const current = new Uint8Array(mask.length);
  for (let j = 0; j < mask.length; j++) {
    const i = mask[j];
    const value = bytes[i * 4];
    if (bytes[i * 4 + 1] !== value || bytes[i * 4 + 2] !== value) throw Error('Non-neutral fixture output');
    if(config.temporal==='off'&&config.sampler==='counter'&&config.mode==='stochastic'){
      const x=i%size,y=Math.floor(i/size),counter=(frame.frameId+config.phase)>>>0;
      const expected=config.frontBody||config.alphas.every((alpha,k)=>alpha<=thresholdCPU(x,y,config.sharedId?101:[101,503][k],counter))?255:0;
      if(value!==expected)oracleMismatches++;
    }
    current[j] = value;
    sum += value; squares += value * value;
    if (previous) deltaSquares += (value - previous[j]) ** 2;
    min = Math.min(min, value); max = Math.max(max, value);
  }
  const temporalRMS = previous ? Math.sqrt(deltaSquares / mask.length) / 255 : null;
  previous = current;
  return {bytes, resolve, diagnostic, oracleMismatches, counters:cards.map(c=>c.material.counterUniform?.value??null), mean: sum / mask.length / 255, min: min / 255, max: max / 255,
    spatialSD: Math.sqrt(Math.max(0, squares / mask.length - (sum / mask.length) ** 2)) / 255,
    temporalRMS,
    offsets: cards.map(c => c.material.hairDitherOffset?.value ?? null), frameId: frame.frameId};
}
globalThis.layerProbe = {
  async run(count = 512) {
    const frames = [], sums = new Float64Array(mask.length), checkpoints = [];
    let last;
    for (let n = 0; n < count; n++) {
      last = await draw();
      frames.push({frameId: last.frameId, mean: last.mean, min: last.min, max: last.max,
        spatialSD: last.spatialSD, temporalRMS: last.temporalRMS, offsets: last.offsets, counters:last.counters, oracleMismatches:last.oracleMismatches,
        resolve:{sha256:last.resolve.sha256,values:last.resolve.values},
        diagnostic:last.diagnostic?{sha256:last.diagnostic.sha256,values:last.diagnostic.values}:null});
      for (let j = 0; j < mask.length; j++) sums[j] += last.bytes[mask[j] * 4] / 255;
      if ([24, 128, 512].includes(n + 1)) {
        const tail = frames.slice(-Math.min(64, frames.length));
        checkpoints.push({resolveNativeBits:config.nativeBits?Array.from(last.resolve.data):null,native:await auditNative(),count:n+1, temporalMean:frames.reduce((s,f)=>s+f.mean,0)/frames.length,
          tailFrames:tail.length, tailMean:tail.reduce((s,f)=>s+f.mean,0)/tail.length,
          tailTemporalRMS:tail.reduce((s,f)=>s+(f.temporalRMS??0),0)/tail.length,
          finalMean:last.mean, spatialSD:last.spatialSD, rgba:Array.from(last.bytes),
          diagnosticRGBA:last.diagnostic?Array.from(last.diagnostic.data,b=>Math.round(Math.max(0,Math.min(1,decodeHalf(b)))*255)):null});
      }
    }
    return {config, actual: {stats: stage.stats, adapter: adapterInfo, frameId: frame.frameId,
      captureTime: frame.time, materials: cards.map(c => ({transparent:c.material.transparent,
        depthWrite:c.material.depthWrite, alphaTest:c.material.alphaTest, alphaTestNode:!!c.material.alphaTestNode,
        triangles:c.geometry.index.count/3, renderOrder:c.renderOrder, ids:Array.from(c.geometry.attributes.stableCardId.array), indices:Array.from(c.geometry.index.array), idArrayType:c.geometry.attributes.stableCardId.array.constructor.name}))},
      size, projected, bounds, maskPixels: mask.length, frames, checkpoints,
      temporalMean: frames.reduce((sum, f) => sum + f.mean, 0) / count,
      pixelMeans: Array.from(sums, v => v / count),
      final: {mean: last.mean, min: last.min, max: last.max, rgba: Array.from(last.bytes)}};
  },
  dispose() {target.dispose(); stage.dispose();}
};
