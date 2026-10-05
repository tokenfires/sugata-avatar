import { AmbientLight, Box3, DirectionalLight, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Stage } from '/@fs/Users/robault/GitHub/sugata-avatar/packages/core/src/render/Stage.js';
import { Figure } from '/@fs/Users/robault/GitHub/sugata-avatar/packages/core/src/figure/Figure.js';
import { GarmentManifest } from '/@fs/Users/robault/GitHub/sugata-avatar/packages/core/src/wardrobe/GarmentManifest.js';
import { Wardrobe } from '/@fs/Users/robault/GitHub/sugata-avatar/packages/core/src/wardrobe/Wardrobe.js';
import { FoundationLayer } from '/@fs/Users/robault/GitHub/sugata-avatar/packages/core/src/wardrobe/FoundationLayer.js';
import { CatalogueDresser } from '/@fs/Users/robault/GitHub/sugata-avatar/packages/core/src/wardrobe/CatalogueDresser.js';
import { MemoryStore, WardrobeAgency } from '/@fs/Users/robault/GitHub/sugata-avatar/packages/core/src/wardrobe/WardrobeAgency.js';
import { ASSETS } from './asset-pins.js';

const el = Object.fromEntries(['load','view','worn','pin','formality','request','proposal','recipe','pieces','reason','dismiss','status','record'].map(id => [id, document.getElementById(id)]));
const abort = new AbortController();
const receipts = [], disposals = [];
const recipes = [
  { id: 'casual', label: 'Tee + denim', garments: ['female_casualsuit01', 'shoes01'] },
  { id: 'elegant', label: 'Blouse + skirt', garments: ['female_elegantsuit01', 'shoes01'] }
];
let stage, figure, wardrobe, agency, dresser, baseline, ready = false, stopped = false, startupTimer;
const mood = Object.freeze({ layer: 'mood', pleasure: 0.2, arousal: 0.1, dominance: 0 });
function record(event, extra = {}) {
  receipts.push({ utc: new Date().toISOString(), event, ...extra });
  el.record.textContent = JSON.stringify({ receipts, disposals }, null, 2);
}
function status(message, kind = 'normal') { el.status.textContent = message; el.status.dataset.kind = kind; }
function release() {
  stopped = true; ready = false; clearTimeout(startupTimer); abort.abort();
  el.load.disabled = true; el.formality.disabled = true; el.request.disabled = true; el.dismiss.disabled = true;
  for (const [name, resource] of [['stage',stage],['wardrobe',wardrobe],['figure',figure]]) {
    if (!resource) continue;
    try { resource.dispose(); disposals.push({ name, returned: true }); }
    catch (error) { disposals.push({ name, returned: false, error: error.message }); }
  }
  record('dispose-attempts');
}
function fail(error) { record('failure', { message: error.message }); status(error.message, 'error'); release(); }
function active() { if (stopped) throw new Error('The preview has closed.'); }
async function bytes(role) {
  active(); const pin = ASSETS[role]; if (!pin) throw new Error(`Unowned asset role: ${role}`);
  const response = await fetch(pin.url, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(30_000)]) });
  if (!response.ok) throw new Error(`Asset request failed: ${role} (${response.status}).`);
  const buffer = await response.arrayBuffer(); active();
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(n => n.toString(16).padStart(2,'0')).join('');
  if (buffer.byteLength !== pin.bytes || hash !== pin.sha256) throw new Error(`Asset bytes do not match: ${role}.`);
  record('asset', { role, requested: pin.url, responseUrl: response.url, bytes: buffer.byteLength, sha256: hash });
  return buffer;
}
async function gltf(role) {
  const buffer = await bytes(role);
  const loaded = await new Promise((resolve,reject) => new GLTFLoader().parse(buffer, '', resolve, reject));
  active(); return loaded;
}
function snapshot() {
  const state = agency.state();
  return { worn: [...wardrobe.worn], mode: state.mode, pinnedOutfit: state.pinnedOutfit, pinHolds: state.pinHolds };
}
function holds() {
  const current = snapshot();
  if (!current.pinHolds || current.mode !== 'pinned' || JSON.stringify(current) !== JSON.stringify(baseline)) {
    throw new Error('The fixed outfit changed. The preview has stopped.');
  }
  return current;
}
function frame() {
  const bounds = new Box3().setFromObject(figure.root), size = new Vector3(), centre = new Vector3();
  bounds.getSize(size); bounds.getCenter(centre);
  const distance = (size.y * 1.12 / 2) / Math.tan(30 * Math.PI / 360), azimuth = 14 * Math.PI / 180;
  stage.camera.position.set(centre.x + Math.sin(azimuth)*distance, centre.y, centre.z + Math.cos(azimuth)*distance);
  stage.camera.lookAt(centre);
}
el.load.addEventListener('click', async () => {
  if (el.load.disabled) return;
  el.load.disabled = true; status('Loading the sample look…');
  startupTimer = setTimeout(() => fail(new Error('Preview startup exceeded 60 seconds.')), 60_000);
  try {
    record('explicit-load-click');
    const manifest = new GarmentManifest(JSON.parse(new TextDecoder().decode(await bytes('manifest'))), new URL(ASSETS.manifest.url, location.href).href);
    figure = new Figure(await gltf('body')); active();
    const foundation = new FoundationLayer(manifest, {});
    wardrobe = new Wardrobe(figure, manifest, { figureKey: 'g050', decencyFloor: foundation.floor,
      loadFragment: (url,id) => {
        if (!ASSETS[id] || new URL(url).href !== new URL(ASSETS[id].url, location.href).href) throw new Error(`Unowned fragment route: ${id}`);
        return gltf(id);
      }
    });
    dresser = new CatalogueDresser(wardrobe, recipes);
    agency = new WardrobeAgency(wardrobe, { dresser, store: new MemoryStore(), profile: 'isolated-catalogue-preview' });
    await agency.pin(recipes[0].garments, { by: 'user' }); active();
    stage = new Stage(); await stage.create(el.view, { fieldOfView: 30, temporalAA: 'off', antialias: false, hairOIT: 'off' }); active();
    stage.scene.add(new AmbientLight(0xffffff,0.55));
    for (const [x,y,z,intensity] of [[2,3,3,2.4],[-3,2,1,1.1],[0,2,-4,1.6]]) {
      const light = new DirectionalLight(0xffffff,intensity); light.position.set(x,y,z); stage.scene.add(light);
    }
    stage.add(figure.root); frame();
    baseline = snapshot(); holds(); clearTimeout(startupTimer); ready = true;
    el.load.hidden = true; el.worn.textContent = 'Tee + denim · Shoes'; el.pin.textContent = 'Outfit fixed · Pin holds';
    el.formality.disabled = false; el.request.disabled = false;
    record('ready', { baseline, backend: stage.backendName, preferences: agency.preferences.length });
    status('Ready. Requests will leave this look fixed.');
  } catch (error) { fail(error); }
});
el.request.addEventListener('click', () => {
  if (!ready || stopped) return;
  try {
    holds(); const requested = Number(el.formality.value);
    const preference = agency.expressPreference({ formality: requested, mood });
    const current = holds();
    const row = dresser.catalogue().find(row => row.garments.length === preference.outfit.length && row.garments.every(id => preference.outfit.includes(id)));
    if (!row) throw new Error('The proposal is outside this catalogue.');
    el.recipe.textContent = row.label;
    el.pieces.textContent = preference.outfit.map(id => wardrobe.manifest.require(id)).filter(g => g.layer !== 'FOUNDATION').map(g => g.name).join(' · ');
    el.reason.textContent = preference.reason; el.proposal.hidden = false;
    record('request', { requested, recipe: row.id, proposal: [...preference.outfit], state: current, preferences: agency.preferences.length, honoured: preference.honoured });
    status('Suggestion recorded. Worn outfit unchanged; pin holds.');
  } catch (error) { fail(error); }
});
el.dismiss.addEventListener('click', () => {
  if (!ready || stopped) return;
  try {
    const current = holds(); el.proposal.hidden = true;
    el.recipe.textContent = ''; el.pieces.textContent = ''; el.reason.textContent = '';
    record('dismiss', { state: current, preferences: agency.preferences.length });
    status('Suggestion dismissed. Worn outfit unchanged; pin holds.'); el.request.focus();
  } catch (error) { fail(error); }
});
window.addEventListener('pagehide', release, { once: true });
record('unstarted', { scope: 'Isolated current-asset proposal preview; no persistent profile or automatic apply.' });
