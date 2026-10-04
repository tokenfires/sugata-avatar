import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PortraitOutfitUnavailableError, portraitOutfitSelection, portraitOutfitOptions, portraitOutfitUrl } from '../../../../packages/testbed/src/portrait-outfit.mjs';
const recipe = JSON.parse(readFileSync(new URL('../../../../looks/ink-denim.json', import.meta.url)));
for (const bake of ['g000', 'g025', 'g050', 'g075', 'g100']) {
    assert.equal(portraitOutfitSelection(new URLSearchParams(), bake), 'none');
    assert.deepEqual(portraitOutfitOptions('none', bake), {});
    assert.equal(portraitOutfitSelection(new URLSearchParams('outfit=none'), bake), 'none');
    if (bake !== 'g050') {
        assert.throws(() => portraitOutfitSelection(new URLSearchParams('outfit=ink'), bake), /unavailable/);
        assert.throws(() => portraitOutfitOptions('ink', bake), /unavailable/);
        assert.throws(() => portraitOutfitUrl('http://localhost/portrait?bake='+bake, 'ink', bake), /unavailable/);
    }
}
for (const query of ['outfit=', 'outfit=unknown', 'outfit=Ink', 'outfit=none&outfit=ink'])
    assert.throws(() => portraitOutfitSelection(new URLSearchParams(query), 'g050'));
const ink = portraitOutfitOptions('ink', 'g050');
assert.deepEqual(ink, { wardrobe: recipe.wardrobe });
const second = portraitOutfitOptions('ink', 'g050');
ink.wardrobe.colours.top = '#ffffff'; ink.wardrobe.outfit.length = 0; ink.wardrobe.foundation.TORSO = 'other';
assert.deepEqual(second, { wardrobe: recipe.wardrobe });
const source = new URL('http://localhost/src/portrait.html?hair=bob01&bake=g050&scene=kitchen&capture=#view');
const dressed = portraitOutfitUrl(source.href, 'ink', 'g050');
assert.equal(dressed.searchParams.get('outfit'), 'ink');
for (const key of ['hair', 'bake', 'scene', 'capture']) assert.equal(dressed.searchParams.get(key), source.searchParams.get(key));
assert.equal(dressed.hash, source.hash);
assert.equal(portraitOutfitUrl(dressed.href, 'none', 'g050').href, source.href);
console.log('Outfit input/body-boundary, bare omission, wardrobe-only exact recipe, independent copies and URL preservation checks passed.');

for (const bake of ['g000', 'g025', 'g075', 'g100'])
    assert.throws(() => portraitOutfitSelection(new URLSearchParams('outfit=ink'), bake), PortraitOutfitUnavailableError);
for (const query of ['outfit=', 'outfit=wrong', 'outfit=none&outfit=ink']) {
    let error; try { portraitOutfitSelection(new URLSearchParams(query), 'g100'); } catch (value) { error=value; }
    assert(error instanceof Error); assert(!(error instanceof PortraitOutfitUnavailableError));
}
const refused = new URL('http://localhost/src/portrait.html?hair=bob01&bake=g100&scene=studio&outfit=ink&outfit=ink&extra=keep#view');
const bare = portraitOutfitUrl(refused.href, 'none', 'g100');
assert.equal(bare.searchParams.has('outfit'), false);
for (const key of ['hair', 'bake', 'scene', 'extra']) assert.equal(bare.searchParams.get(key), refused.searchParams.get(key));
assert.equal(bare.hash, refused.hash);
console.log('Typed unavailable-only recovery and matching bare destination checks passed.');
