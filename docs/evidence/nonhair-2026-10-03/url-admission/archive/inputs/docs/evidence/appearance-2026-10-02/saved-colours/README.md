# See a saved look's colour recipe before opening it

Saved looks now show labelled colour chips for explicit Top/Bottom/Shoes choices, Hair base and Tint hue/amount. Two recipes that previously shared `Custom colours: top, shoes · Brown + 35% tint` now show distinct sage/purple and rose/teal choices. Existing names and Open/Rename/Remove controls remain the browsing actions. Original hair and base-palette parts retain their text without invented swatches.

The chips show configured shades, not calibrated material output. Percentages use the existing two-decimal summary convention; stored values are preserved. Each chip has visible text and a decorative swatch. Open references the recipe in its accessible description; actual screen-reader speech is untested.

Root independently inspected the original saved-look failure, the source label functions, actual candidate desktop/mobile PNGs, the final source diff and the critic's findings. Root then recomputed the baseline/final report and image hashes, all 380 current final-capture source hashes, the unchanged stored envelope and reopened recipe. [Independent review](CRITIQUE.md) records separate V1 visual and V2 accessible-description receipts.

## Focused native observations

| Run | Command | Root exec | Report SHA256 |
| --- | --- | --- | --- |
| Existing UI witness | `node tools/critic/saved-colour-recipe-ui.mjs baseline` | 71499 | `db6a56fb71a7db09a23eadab684060f544dc1c0998680232b2b38674912d9005` |
| Colour chips | `node tools/critic/saved-colour-recipe-ui.mjs candidate` | 84141 | `f5c64cc03bfc46d59b2998b77557de3c4144faa115cb54626505a2265a2db1ad` |
| Open description | `node tools/critic/saved-colour-recipe-ui.mjs candidate v2` | 79143 | `34ad69a509134e92c20d81d9d8bd25ab57a4f0b462cde981e2f1c42320a6d98a` |

All exit 0 with no recorded page/console/HTTP errors. Each retains 12 warnings. The browser contexts close; two explicitly inspected retirements per run report no leaked handles. Do not infer every navigation's disposal receipt from that count.

Five stored v1 examples cover two different hue recipes with identical older summaries, a custom hair base and 0% white tint, Original, and an unavailable future configuration. At 1440×1000 and 390×844, the customized chips and regular actions are readable and wrap. The mobile page has no horizontal overflow. Keyboard Tab from Open reaches Rename. Browsing preserves the avatar owner, configuration and exact storage bytes; actual Open restores the rose/teal configuration. Fixtures are confined to the probe browser, not the user's saved collection.

`npm run build:pages` passes with the existing large-chunk warning. `git diff --check` passes. Accepted runtime assets, core sources, storage schema and saved recipe values are preserved. New screenshot equality, appearance, motion, broader wardrobe support or assistive-technology qualification is not claimed. The older exact-image reproduction failure remains open.

The [visual comparison](review.html) shows actual originals. Raw packets live under `captures/saved-colour-recipe-2026-10-02-*`; the [manifest](archive-manifest.json) records their exact files. This is local preservation, not an off-machine backup.
