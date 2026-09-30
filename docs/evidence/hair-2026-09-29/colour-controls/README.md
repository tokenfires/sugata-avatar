# Hair colour controls and saved looks

September 29 overnight work; native evidence captured September 30 UTC. **The feature is qualified for the sampled customization workflows; the independent critic recommends integration with the limits below.** Hair geometry and its existing appearance limitations are unchanged.

## What the user can do

Open **Hair colour** in Wardrobe studies. Choose Black, Brown, Auburn, Blonde, Red, Grey or White, then use Custom tint and Lightness for another shade. Apply recreates the look with that colour while retaining its applied clothes, cut, framing, room and light. Save settings or a named look to reopen it. Original preserves the exact existing material default and omits the new option.

| Original | New colour applied |
| --- | --- |
| ![Original UI](../../../../captures/hair-colour-controls/ui-v5/desktop-original.png) | ![Applied UI](../../../../captures/hair-colour-controls/ui-v5/desktop-applied.png) |

The SDK option is `hairColour: '#rrggbb'` with a hair style enabled. It is fixed for that Avatar. [API details](../../../API.md) describe validation and attachment reporting. This is a material colour control, not a physical dye model.

## Decisions supported by actual images

The first Brown input rendered copper/peach; the first Auburn was too close to vivid Red. One bounded comparison selected **Brown #413934** and **Auburn #4c3028**, retaining the other five starting shades. The independent critic agrees. The alternative was to keep those original inputs and relabel them Copper/Red-orange; it was rejected because it weakened Robert's requested base-colour choices. No shader parameters were tuned.

| Original Brown proposal | Selected Brown | Selected Auburn |
| --- | --- | --- |
| ![Copper-like first Brown](../../../../captures/hair-colour-controls/material-v1/brown/casual-front-exact-default.png) | ![Selected Brown](../../../../captures/hair-colour-controls/calibration-v1/brown-low/casual-front-exact-default.png) | ![Selected Auburn](../../../../captures/hair-colour-controls/calibration-v1/auburn-low/casual-front-exact-default.png) |

These are authored starting shades judged in the sampled Studio front view. The blue rear rim affects their apparent colour. Kitchen also changes the reading; its strongly backlit rear samples are excluded from shade-fidelity evidence. All seven were rendered on bob01 in Studio, and Black/Brown/White were sampled on bob02 in Kitchen. Colours still expose the existing broad cards, crown breaks and rear patch; they do not repair them.

## Native checks

The final source replay is **ui-v5**. It verifies:

- Brown draft changes neither attached material nor export until Apply. Keyboard lightness and the actual type=color input handler produce applied custom colours.
- Apply, haircut switching, JSON download/reopening and browser-local named-look reopening preserve the expected resolved colour. Original restores the exact derived linear vector and removes the option.
- Custom #365a78 survives a room change to Kitchen and an in-place outfit change. Desktop and390px mobile screenshots show usable controls with no horizontal page overflow.
- Eight observed Avatar owners dispose with empty reported leak arrays. No browser page or HTTP errors were recorded.
- Invalid/duplicate URL colours and invalid SDK values reject. A colour without a hair style rejects. Seven starting shades, arbitrary colour, and black/white endpoints round-trip through strict configuration and URL parsing for both presets.
- A diagnostic node without a uniform vector returns `linear:null` and `matchesAttached:false`; exporting that untracked material change rejects cleanly.

The OS colour chooser dialog itself was not visually reviewed. Browser input handling and resulting rendering were exercised. No broad test suite or performance qualification was run.

## Controls and limits

Forty-one material captures cover initial palette, calibration and confirmation. Within each matching preset/room/view, recorded physical, camera and noncolour state is exactly equal after excluding the intentional colour option. Browser/Node sRGB decoding differs by at most2.776e-17; the audit allows four machine epsilons for runtime arithmetic. This is unrelated to image acceptance.

The original-source Studio rear-oblique baseline and the feature's Original have equal recorded controls and material vectors. Their images differ at89pixels, at most4/255. Independent feature Original repeats differ at122front pixels, at most7/255; rear-oblique is exact. Therefore **no bit-exact image claim** is made. The broad palette comparisons remain visually distinguishable. No older renderer or wardrobe-colour gate was changed.

The full retained packet has **616 files / 78,338,218 bytes / 62 PNGs**. It includes failed ui-v1 (a harness predicate read configuration while navigation was pending), superseded UI rounds, exact source copies and capture reports. See [manifest](archive-manifest.json), [summary](summary.json), and [independent critique](CRITIQUE.md). The main overnight checkpoint records session identities and decisions. All native jobs have exited.

## Fixed review findings

1. The first report assumed every diagnostic colour node held a vector. A guarded read now returns an explicit mismatch; export refuses it. The alternative was additional ownership state tracking.
2. Original initially showed an unrelated brown draft swatch and36% lightness. Tint/lightness controls are now hidden until a shade is selected. The alternative was a read-only preview converted from the attached linear colour.
3. Named Brown/Auburn were calibrated once from actual images as described above. Their arbitrary Custom range remains available.

No accepted hair asset changed, and none of the isolated geometry candidates from earlier slices was installed. Motion across every colour and lighting condition, broader body identities, natural dye fidelity and complete hairstyle quality remain open.

The local overnight review page also passed native desktop (1440px) and mobile (390px) image-loading, navigation and overflow checks. Root inspected both actual page screenshots. The retained `review-page/report.json` pins its sources.
