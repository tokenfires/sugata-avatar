// Isolated, single-frame artist review. No runtime avatar or asset promotion.
const canvas = document.querySelector('#views');
const status = document.querySelector('#status');
const recordElement = document.querySelector('#record');
const finishButton = document.querySelector('#finish');
const start = performance.now();
const deadline = start + 60000;
const abort = new AbortController();
const record = { state: 'preparing', starts: 1, renders: 0, finishCalls: 0,
  startUTC: new Date().toISOString(), inputs: {}, cleanupErrors: [] };
let active = true;
let renderer = null;
let context = null;
let geometry = null;
let scene = null;
let materials = [];
let lights = [];
let cameras = [];
let raf = null;
let rejectFrame = null;
let timeout = null;

function publish() {
  recordElement.textContent = JSON.stringify(record, null, 2);
  document.documentElement.dataset.reviewState = record.state;
}
function ensureOwned() {
  if (!active || performance.now() >= deadline) throw new Error('Review ownership ended or deadline reached');
}
function finish(reason) {
  if (!active) return;
  active = false;
  record.finishCalls++;
  record.finishReason = reason;
  record.finishUTC = new Date().toISOString();
  clearTimeout(timeout);
  abort.abort();
  if (raf !== null) cancelAnimationFrame(raf);
  raf = null;
  if (rejectFrame) rejectFrame(new Error('Frame cancelled by finish'));
  rejectFrame = null;
  window.removeEventListener('pagehide', pagehide);
  window.removeEventListener('resize', resized);
  canvas.removeEventListener('webglcontextlost', lost);
  finishButton.removeEventListener('click', clicked);
  const cleanup = (name, action) => {
    try { action(); } catch (error) { record.cleanupErrors.push(`${name}: ${error.message}`); }
  };
  if (scene) cleanup('scene.clear', () => scene.clear());
  if (geometry) cleanup('geometry.dispose', () => geometry.dispose());
  materials.forEach((material, i) => cleanup(`material${i}.dispose`, () => material.dispose()));
  lights.forEach((light, i) => cleanup(`light${i}.dispose`, () => light.dispose()));
  if (renderer) {
    cleanup('renderer.dispose', () => renderer.dispose());
    cleanup('renderer.forceContextLoss', () => renderer.forceContextLoss());
  } else if (context) {
    // Constructor failure still leaves the explicitly owned context collectible.
    cleanup('partial context loss', () => context.getExtension('WEBGL_lose_context')?.loseContext());
  }
  geometry = null; materials = []; lights = []; cameras = []; scene = null; renderer = null; context = null;
  // Canvas and immutable DOM record remain for collection. No GPU retirement claim.
  record.state = record.cleanupErrors.length ? 'finished-with-cleanup-errors' : 'finished';
  record.pendingOwnedRAF = 0;
  record.pendingOwnedFetch = 'Abort requested; platform may settle later';
  record.pendingModuleOrDigest = 'Non-abortable platform operation may settle; continuation checks ownership';
  status.textContent = `Review finished: ${reason}${record.cleanupErrors.length ? ' · cleanup errors recorded' : ''}`;
  finishButton.disabled = true;
  publish();
}
function clicked() { finish('Finish button'); }
function pagehide() { finish('pagehide'); }
function resized() { finish('viewport resized; fixed view not redrawn'); }
function lost(event) { event.preventDefault(); finish('context lost; no restore or redraw'); }
finishButton.addEventListener('click', clicked);
window.addEventListener('pagehide', pagehide);
window.addEventListener('resize', resized);
canvas.addEventListener('webglcontextlost', lost);
timeout = setTimeout(() => finish('60 second source deadline'), 60000);
publish();

const originals = [
  { name: 'mesh', url: '../midi-skirt-first-cpu/output/mesh.json', bytes: 1172984,
    sha256: '20dc492fd50bfd2302b096713fe3cee549485f9027eac409a0d234bfe28954c4' },
  { name: 'check', url: '../midi-skirt-first-cpu/output/CHECK.json', bytes: 2655,
    sha256: '796fb85236e8972ff2f824a648595ee8a2ce92c2369f5b189a337570a07def72' }
];
async function readOriginal(input) {
  ensureOwned();
  const response = await fetch(input.url, { signal: abort.signal, cache: 'no-store' });
  ensureOwned();
  if (!response.ok) throw new Error(`${input.name} HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  ensureOwned();
  if (bytes.byteLength !== input.bytes) throw new Error(`${input.name} byte count mismatch`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  ensureOwned();
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  if (hash !== input.sha256) throw new Error(`${input.name} SHA-256 mismatch`);
  record.inputs[input.name] = { bytes: bytes.byteLength, sha256: hash };
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
async function firstFrame() {
  ensureOwned();
  return new Promise((resolve, reject) => {
    rejectFrame = reject;
    raf = requestAnimationFrame(() => {
      raf = null; rejectFrame = null;
      try { ensureOwned(); resolve(); } catch (error) { reject(error); }
    });
  });
}
async function observeAttribute(attribute) {
  ensureOwned();
  const array = attribute.array;
  const bytes = array.buffer.slice(array.byteOffset, array.byteOffset + array.byteLength);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  ensureOwned();
  return { type: array.constructor.name, itemSize: attribute.itemSize, count: attribute.count,
    normalized: attribute.normalized, bytes: array.byteLength,
    sha256: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('') };
}
function observeCamera(camera) {
  return { type: camera.type, position: camera.position.toArray(), up: camera.up.toArray(),
    quaternion: camera.quaternion.toArray(), zoom: camera.zoom,
    frustum: [camera.left,camera.right,camera.top,camera.bottom,camera.near,camera.far],
    matrix: camera.matrix.elements.slice(), matrixWorld: camera.matrixWorld.elements.slice(),
    matrixWorldInverse: camera.matrixWorldInverse.elements.slice(),
    projectionMatrix: camera.projectionMatrix.elements.slice() };
}

async function prepare() {
  const meshData = await readOriginal(originals[0]);
  ensureOwned();
  const check = await readOriginal(originals[1]);
  ensureOwned();
  if (check.decision !== 'A' || check.counts.vertices !== 2688 || check.counts.triangles !== 5376 ||
      check.export_inputs.find(x => x.path.endsWith('/mesh.json'))?.sha256 !== originals[0].sha256 ||
      JSON.stringify(meshData.source_hashes) !== JSON.stringify(check.source_hashes)) {
    throw new Error('Saved checker/source association mismatch');
  }
  const THREE = await import('/@fs/Users/robault/GitHub/sugata-avatar/node_modules/three/build/three.module.js');
  ensureOwned();
  if (THREE.REVISION !== '185') throw new Error('Installed Three revision mismatch');
  THREE.ColorManagement.enabled = true;
  const width = document.documentElement.clientWidth;
  if (window.innerWidth !== 1280 || window.innerHeight !== 720 || width !== 1280 ||
      canvas.clientWidth !== width || canvas.clientHeight !== 560) throw new Error('Default review viewport mismatch');
  const positions64 = meshData.vertices.flatMap(v => v.xyz_lattice.map(x => x / 1e8));
  const normals64 = new Array(positions64.length).fill(0);
  // Cross products and accumulation use JS binary64, in original triangle order.
  for (const [a, b, c] of meshData.triangles) {
    const ax = positions64[3*a], ay = positions64[3*a+1], az = positions64[3*a+2];
    const ux = positions64[3*b]-ax, uy = positions64[3*b+1]-ay, uz = positions64[3*b+2]-az;
    const vx = positions64[3*c]-ax, vy = positions64[3*c+1]-ay, vz = positions64[3*c+2]-az;
    const cross = [uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx];
    for (const id of [a,b,c]) for (let k=0;k<3;k++) normals64[3*id+k] += cross[k];
  }
  for (let i=0;i<normals64.length;i+=3) {
    const length = Math.hypot(normals64[i],normals64[i+1],normals64[i+2]);
    if (!(length > 0) || !Number.isFinite(length)) throw new Error('Invalid shared normal');
    for (let k=0;k<3;k++) normals64[i+k] /= length;
  }
  ensureOwned();
  geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions64), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals64), 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(meshData.triangles.flat()), 1));
  geometry.addGroup(0,768,0);
  geometry.addGroup(768,6912,1);
  geometry.addGroup(7680,7680,2);
  geometry.addGroup(15360,768,0);
  record.assignedBufferIdentity = { scope: 'Actual geometry attribute/index CPU storage submitted to renderer; no GPU buffer readback',
    nativeEndian: new Uint8Array(new Uint16Array([0x0102]).buffer)[0] === 2 ? 'little' : 'big' };
  record.assignedBufferIdentity.position = await observeAttribute(geometry.getAttribute('position'));
  ensureOwned();
  record.assignedBufferIdentity.normal = await observeAttribute(geometry.getAttribute('normal'));
  ensureOwned();
  record.assignedBufferIdentity.index = await observeAttribute(geometry.getIndex());
  ensureOwned();
  record.groups = geometry.groups.map(group => ({ ...group }));
  for (const name of ['band','plum','inside']) {
    const m = meshData.materials[name];
    materials.push(new THREE.MeshStandardMaterial({ color: m.srgb_hex, roughness: m.roughness,
      metalness: m.metalness, side: THREE.FrontSide, opacity: 1, transparent: false }));
  }
  record.materials = materials.map((material,i) => ({ role: ['band','plum','inside'][i],
    type: material.type, srgbHex: `#${material.color.getHexString(THREE.SRGBColorSpace)}`,
    linearRGB: material.color.toArray(), roughness: material.roughness, metalness: material.metalness,
    side: material.side, opacity: material.opacity, transparent: material.transparent }));
  scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geometry, materials));
  const ambient = new THREE.AmbientLight(0xffffff, .4);
  lights.push(ambient); scene.add(ambient);
  for (const [position, intensity] of [[[2,3,4],2],[[-2,1,1],.8]]) {
    const light = new THREE.DirectionalLight(0xffffff, intensity);
    lights.push(light);
    light.position.set(...position);
    light.target.position.set(0,.5,0);
    scene.add(light,light.target);
  }
  record.lights = lights.map(light => ({ type: light.type, srgbHex: `#${light.color.getHexString(THREE.SRGBColorSpace)}`,
    intensity: light.intensity, position: light.position.toArray(), target: light.target?.position.toArray() ?? null }));
  ensureOwned();
  const contextOptions = { antialias: true, alpha: false, depth: true,
    stencil: false, preserveDrawingBuffer: true, powerPreference: 'default' };
  context = canvas.getContext('webgl2', contextOptions);
  if (!context) throw new Error('WebGL2 context creation failed');
  renderer = new THREE.WebGLRenderer({ canvas, context, ...contextOptions });
  renderer.debug.checkShaderErrors = true;
  renderer.debug.onShaderError = () => { record.shaderFailure = true; };
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = false;
  renderer.setPixelRatio(1);
  renderer.setSize(width,560,false);
  renderer.setClearColor('#e8e3df',1);
  renderer.autoClear = false;
  renderer.info.autoReset = false;
  record.renderer = { outputColorSpace: renderer.outputColorSpace, toneMapping: renderer.toneMapping,
    pixelRatio: renderer.getPixelRatio(), shadowMap: renderer.shadowMap.enabled,
    contextAttributes: renderer.getContextAttributes(), clearSrgbHex: `#${renderer.getClearColor(new THREE.Color()).getHexString(THREE.SRGBColorSpace)}` };
  const boundaries = [0,Math.floor(width/3),Math.floor(2*width/3),width];
  const cameraPositions = [[0,.5,3],[3,.5,0],[0,.5,-3]];
  for (let i=0;i<3;i++) {
    const columnWidth = boundaries[i+1]-boundaries[i];
    const halfWidth = .7*columnWidth/560;
    const camera = new THREE.OrthographicCamera(-halfWidth,halfWidth,.7,-.7,.1,10);
    camera.position.set(...cameraPositions[i]); camera.up.set(0,1,0); camera.lookAt(0,.5,0);
    cameras.push(camera);
  }
  await firstFrame();
  ensureOwned();
  renderer.setScissorTest(true);
  record.firstRenderUTC = new Date().toISOString();
  record.views = [];
  for (let i=0;i<3;i++) {
    const x = boundaries[i], w = boundaries[i+1]-x;
    renderer.setViewport(x,0,w,560); renderer.setScissor(x,0,w,560);
    renderer.clear(true,true,true);
    renderer.render(scene,cameras[i]);
    record.renders++;
    record.views.push({ ordinal: i, viewport: renderer.getViewport(new THREE.Vector4()).toArray(),
      scissor: renderer.getScissor(new THREE.Vector4()).toArray(), scissorTest: renderer.getScissorTest(),
      camera: observeCamera(cameras[i]), cumulativeCalls: renderer.info.render.calls,
      cumulativeTriangles: renderer.info.render.triangles });
  }
  record.lastRenderUTC = new Date().toISOString();
  ensureOwned();
  const gl = renderer.getContext();
  const error = gl.getError();
  if (record.shaderFailure || gl.isContextLost() || error !== gl.NO_ERROR) throw new Error(`First frame GL failure ${error}`);
  record.state = 'ready';
  record.readyUTC = new Date().toISOString();
  record.viewport = [window.innerWidth,window.innerHeight];
  record.canvas = [canvas.clientWidth,canvas.clientHeight,canvas.width,canvas.height];
  record.columns = boundaries;
  record.threeRevision = THREE.REVISION;
  record.precision = 'original lattice/1e8 binary64; fixed cross sum and normalize once; Float32 upload; Uint16 indices';
  record.info = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
  record.elapsedMilliseconds = performance.now()-start;
  status.textContent = 'Ready · first unchanged front, right profile and rear · no fit or motion claim';
  publish();
}
prepare().catch(error => {
  if (!active) return;
  record.failure = String(error?.message ?? error);
  finish(`preparation failed: ${record.failure}`);
});
