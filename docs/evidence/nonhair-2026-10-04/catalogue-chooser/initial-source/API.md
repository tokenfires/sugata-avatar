# CatalogueDresser

Opt-in selection from explicit recipes, using the manifest's authored formality scale. It can supply WardrobeAgency's existing dresser seam without changing the current diagnostic or showcase defaults.

```js
import { CatalogueDresser } from './CatalogueDresser.js';

const dresser = new CatalogueDresser(wardrobe, [
  { id: 'casual', label: 'Tee + denim', garments: ['female_casualsuit01', 'shoes01'] },
  { id: 'elegant', label: 'Blouse + skirt', garments: ['female_elegantsuit01', 'shoes01'] }
]);
const available = dresser.catalogue();
const proposal = dresser.choose({ formality: 4 });
const reason = dresser.explain();
// Pass dresser to a caller-created WardrobeAgency. Its mode and confirmation policy remain owned there.
```

The caller supplies 1–32 recipes. The chooser validates all of them against the live wardrobe, including current foundation and declared figure-fragment policy. Non-foundation garments must collectively declare TORSO/ARMS/HIPS/LEGS/FEET. The rating is the maximum non-foundation formality; these numbers and the aggregation are authored. Choose the nearest rating to an integer1–5 request, retaining the current recipe on a tie and otherwise caller order. Inputs and results are copied. An invalid request or stale catalogue refuses before replacing the last explanation; no clothing is fetched or changed by this class.

Declared slots and supported paths establish metadata availability. Physical coverage, clearance, movement, weather/comfort and intended mood meaning require separate evidence. The full PAD/thermal/colour/time-of-day Dresser in punch-list9.11 remains open. Existing g050 restrictions remain enforced by Wardrobe.validateOutfit; no g100 clothing or new appearance is introduced.

Run the policy/agency test from the repository root: `node packages/core/src/wardrobe/CatalogueDresser.selftest.mjs`. It uses the real manifest/body/fragments and CPU image stubs, with no rendered appearance claim. Candidate source remains isolated until the reviewed single test and final handoff qualify its bounded behavior.
