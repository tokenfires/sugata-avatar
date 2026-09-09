import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SHOWCASE_PRESETS, SHOWCASE_OUTFITS, SHOWCASE_FOUNDATION, resolveShowcaseSelection, optionsForShowcase, configurationFromReport } from './showcase-presets.mjs';
import { GarmentManifest } from '../../core/src/wardrobe/GarmentManifest.js';
import { FoundationLayer } from '../../core/src/wardrobe/FoundationLayer.js';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const source = root + 'assets/wardrobe/manifest.json', manifest = new GarmentManifest(JSON.parse(fs.readFileSync(source)), pathToFileURL(source).href);
let checks = 0; const check = (name, fn) => { fn(); checks++; console.log('PASS ' + name); };
check('every preset uses an authored g050 groom and existing manifest-valid outfit plus complete foundation', () => {
    assert.equal(SHOWCASE_PRESETS.length, 2);
    for (const p of SHOWCASE_PRESETS) {
        const selection = resolveShowcaseSelection(new URLSearchParams({preset:p.id})), options = optionsForShowcase(selection);
        assert.equal(options.identity.gender, .5); assert.equal(options.identity.mode, 'nearest');
        assert.ok(fs.existsSync(root + `assets/hair/${options.hair}/g050.glb`));
        const foundation = new FoundationLayer(manifest, {preference: options.wardrobe.foundation});
        assert.deepEqual(foundation.problems(), []);
        const worn = [...options.wardrobe.outfit, ...foundation.currentFloor()]; assert.deepEqual(manifest.conflicts(worn), []);
        for (const id of worn) assert.ok(fs.existsSync(new URL(manifest.fragmentUrl(id, 'g050'))));
        assert.ok(!worn.includes('fedora01')); assert.deepEqual(options.wardrobe.foundation, SHOWCASE_FOUNDATION);
    }
});
check('contradictory, repeated, unknown and unsupported URL selections fail rather than mislabel a render', () => {
    for (const query of ['preset=casual&preset=elegant','outfit=bad','frame=neck','light=void','gender=0','bake=g100','hair=bob01','foundation=none'])
        assert.throws(() => resolveShowcaseSelection(new URLSearchParams(query)));
    const mixed = optionsForShowcase(resolveShowcaseSelection(new URLSearchParams('preset=casual&outfit=elegant&frame=portrait&light=warm')));
    assert.equal(mixed.hair, 'bob02'); assert.equal(mixed.wardrobe.outfit[0], 'female_elegantsuit01'); assert.equal(mixed.frame, 'portrait'); assert.equal(mixed.lighting, 'warm');
});
function report() { return {disposal:{disposed:false},identity:{gender:.5,bake:'figure_g050'},hair:{style:'bob02',loadedStyle:'bob02',attached:true},wardrobe:{attached:true,pendingCandidates:0,foundation:{...SHOWCASE_FOUNDATION},requestedOutfit:['female_elegantsuit01','shoes01'],state:{worn:[...SHOWCASE_OUTFITS.casual.garments,...Object.values(SHOWCASE_FOUNDATION)]}},framing:{mode:'body'},scene:{id:'studio',lighting:{look:'studio'}},quality:{requested:'balanced'},motion:{seed:20260807}}; }
check('export derives current attached garments rather than the last request, and copies mutable values', () => {
    const r = report(), config = configurationFromReport(r); assert.deepEqual(config.wardrobe.outfit, [...SHOWCASE_OUTFITS.casual.garments]);
    config.wardrobe.foundation.TORSO = 'bad'; config.wardrobe.outfit.length = 0; assert.equal(r.wardrobe.foundation.TORSO, 'foundation_bra'); assert.equal(r.wardrobe.state.worn.length, 4);
    const options = optionsForShowcase(resolveShowcaseSelection(new URLSearchParams())); assert.deepEqual(configurationFromReport(r), options);
});
check('export refuses partial, retired, mismatched or unsupported actual runtime states', () => {
    for (const mutate of [r=>r.disposal.disposed=true,r=>r.identity.bake='figure_g025',r=>r.hair.attached=false,r=>r.hair.loadedStyle='bob01',r=>r.wardrobe.attached=false,r=>r.wardrobe.pendingCandidates=1,r=>r.wardrobe.state.worn.pop(),r=>r.wardrobe.state.worn.push('fedora01'),r=>r.framing.mode='neck',r=>r.scene.lighting.look='cool']) {
        const r = report(); mutate(r); assert.throws(()=>configurationFromReport(r));
    }
});
console.log(`PASS ${checks} showcase preset groups`);
