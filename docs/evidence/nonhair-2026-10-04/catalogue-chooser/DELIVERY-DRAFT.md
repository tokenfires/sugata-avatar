# Opt-in catalogue outfit proposals

`CatalogueDresser` proposes a recipe from a catalogue the caller supplies. An explicit formality request can select the current casual or elegant combinations through WardrobeAgency's existing `choose` / `explain` interface. It changes no showcase or diagnostic defaults.

For a script at the repository root:

```js
import { CatalogueDresser } from './packages/core/src/wardrobe/CatalogueDresser.js';
import { WardrobeAgency } from './packages/core/src/wardrobe/WardrobeAgency.js';

// wardrobe is the application's existing live Wardrobe.
const dresser = new CatalogueDresser(wardrobe, [
  { id: 'casual', label: 'Tee + denim', garments: ['female_casualsuit01', 'shoes01'] },
  { id: 'elegant', label: 'Blouse + skirt', garments: ['female_elegantsuit01', 'shoes01'] }
]);
const proposal = dresser.choose({ formality: 4 });
console.log(dresser.explain());

// A caller may provide this dresser when constructing its own agency.
// Preserve that identity's existing profile/store and mood source.
const agency = new WardrobeAgency(wardrobe, { dresser, profile: 'my-avatar' });
// agency.consider({ formality: 4, mood: currentMood }) records a preference;
// the existing agency mode decides whether it can be applied.
```

Supply a dense array of 1–32 recipes, each with exactly `id`, `label`, `garments`. IDs contain1–80 ASCII letters/numbers/underscores/hyphens; labels are nonempty single-line text of at most80 UTF-16 code units. Inputs, catalogue rows and proposals are copied. `catalogue()` returns the current canonical recipes and their ratings.

Every recipe must pass the live wardrobe's foundation, conflict and declared figure-fragment policy each time it is inspected or chosen. Non-foundation garments must jointly declare torso, arms, hips, legs and feet. The recipe rating is the maximum non-foundation formality, including footwear/accessories. These integer1–5 ratings and their aggregation are authored design choices. Selection minimizes absolute distance from the requested integer1–5, retaining a matching worn recipe on ties and otherwise caller order. Invalid input or changed policy refuses before replacing the prior explanation or changing clothes.

One externally60-second bounded CPU invocation passed all12 policy/agency checks on October4 Pacific. It used the actual manifest, g050 body, foundation and pinned casual/footwear fragments, plus1×1 CPU image stubs. Elegant proposals and the unsupported-figure refusal were metadata checks; no g100 body or elegant fragment was loaded. The existing rig warning about missing jaw/eye bones is recorded. The chooser's source had a sparse-array rejection added before the first run; the harness's explicit user pin was also corrected before execution.

This is an opt-in engine API. It supplies no new wardrobe UI, automatic integration, actual-fit guarantee, mood interpretation or climate advice. The full PAD/thermal/colour/time-of-day Dresser in punch-list9.11 remains open, as do finished characters, layering/separates, all-body/motion fit, expressions, representation and performance qualification.

From the repository root, the delivered test is `node packages/core/src/wardrobe/CatalogueDresser.selftest.mjs`. Current draft awaits final critic/root handoff; the isolated test source and core delivery must be byte-identical.
