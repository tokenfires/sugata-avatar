# Independent starting critique — October 2

This pass is read-only apart from this receipt. No browser, GPU, geometry writer or product mutation was launched. I read the September 30 day report, current product roadmap, bob brief, current saved-list/colour controls, and the earlier front attribution/failed-construction decisions. The full AAA and representative-character direction remains the target; the bounded slices below are steps toward it.

## Usable slice: distinguish saved recipes before opening them

**Observed:** `captures/neutral-studio-ui-2026-09-30-v2/desktop-neutral-saved.png` shows a visibly lavender-haired, sage-shirt look whose saved description says `Custom colours: top, shoes · Brown + 35% tint`. It does not identify the top/shoe values or tint hue. Current `showcase-hair-colours.mjs:9–11` omits tint colour, `showcase-colours.mjs:33–35` omits garment values, and `showcase.js:114–115` composes those labels for the saved list. Distinct recipes can consequently have the same description. Opening each recipe restarts its view and creates unnecessary navigation while browsing looks.

**A — selected by root:** add compact labelled swatches and visible names/hex values to saved entries for actual explicit Top/Bottom/Shoes overrides, Hair base, and Tint plus percentage. Keep the original/base-palette text where no explicit colour exists. Explain once that swatches show chosen shades and fabrics/lighting affect their appearance. This gives immediate recipe recognition without storage or renderer changes. Tradeoff: it describes inputs, not the rendered garment/hair, so it must not imply calibrated colour or invent an Original-fabric swatch.

**B:** store native avatar thumbnails with each saved look. This communicates overall style and silhouette more directly, but adds image storage, capture timing/ownership and stale-thumbnail handling. Its cost is disproportionate for this first browsing improvement.

**Review contract:** exact configured values remain visible as text, decorative swatches are `aria-hidden`, chips wrap at 390px, and the existing Open/Rename/Remove actions remain readable and operable. Include a stored 0% tint, a custom hair base, Original, and two recipes with identical legacy summaries but different actual hues. Confirm Open preserves the source recipe. Root has independently viewed the saved-list witness and selected A; candidate review is pending.

## Bounded research: decide the short front cards' coverage role

**Question:** can the exposed short root layer become coherent scalp coverage beneath a styled front sweep while retaining its short length, or does the front need explicit guide/layer reauthoring? This can change the next construction; another smoothing score with the old arbitrary endpoints cannot.

**Actual witnesses:** in `bob-fringe-ablation-v1/control/casual-front-right-medium-brown.png`, the eyebrow band and upper crown slit are visible. In its `hidden/` pair, the band recedes but short forehead stubs and the enlarged crown gap remain. `bob-front-layers-v1/casual-front-right-medium-brown.png` colours those stubs red, with blue/purple/yellow crown contributors and the cap visible through the slit. The source root layer at `hair_cards.py:585` is 78 short coverage cards with `cut: None`; coverage is its stated role. R2 shows a continuous part-to-cheek sweep, and R3 shows distinct shorter framing layers connected to the rounded longer body. These references do not require assigning every short coverage card a distant temple endpoint.

The rejected `bob-front-support-v1/neutral/casual-front-left-medium-brown.png` has raised, angular arches above the crown and fans at the front. The prior feasibility report finds 2.200×/2.399× minimum arc growth for short cards 7/46 to reach its requested temple endpoints; that is a design choice, not a target inferred from R2/R3. The one-ring proxy line is already closed.

**A — preferred next discriminator:** declare one small forehead sector, its short coverage cards and the longer cards that currently reveal their ends. Test a mesh-conforming coverage layout under the existing visible sweep, preserving short-card role/length, cap, accepted assets and the qualified side/posterior lead. Before capture, require full-ribbon rest clearance and explicitly list changed records; one matched beauty/layer packet should answer whether scalp coverage can remain complete while the stubs disappear. Tradeoff: it can decide the coverage architecture with little scope, but does not by itself repair the mixed-layer crown gap or complete the front style. Stop after one prototype if the sector cannot be isolated or loses coverage; do not tune offsets repeatedly.

**B:** deliberately reauthor the entire front guide/layer layout, giving scalp coverage and visible framing separate paths and enough multi-ring joining space. Enumerate the released suffix/root/attachment boundaries before construction. Tradeoff: more likely to address the joint crown/front problem, but requires broader representation, contact, appearance and motion qualification. It should follow a deliberate authoring decision rather than silently expand the previous boundary.

This recommendation is a representation question, not proof of a cause or a new geometry result. Do not repeat broad fringe attribution, global shell/handle sweeps, band offset/weight/mask cycles or capture-epoch searches. Keep accepted assets and failed witnesses intact.

## Images actually inspected

- `captures/hair-tint-controls-v3/base-canvas.png`
- `captures/hair-tint-controls-v3/mixed-canvas.png`
- `captures/hair-tint-controls-v3/full-tint-canvas.png`
- `captures/hair-tint-controls-v3/mixed-ui.png`
- `captures/hair-tint-controls-v3/mobile-long-bob-ui.png`
- `captures/neutral-studio-ui-2026-09-30-v2/desktop-neutral-saved.png`
- `captures/neutral-studio-ui-2026-09-30-v2/mobile-neutral-controls.png`
- `captures/bob-fringe-ablation-v1/control/casual-front-right-medium-brown.png`
- `captures/bob-fringe-ablation-v1/hidden/casual-front-right-medium-brown.png`
- `captures/bob-front-layers-v1/casual-front-right-medium-brown.png`
- `captures/bob-front-support-v1/neutral/casual-front-left-medium-brown.png`
- `reference/bob-appearance-2026-09-29/02-medium-face-framing.jpg`
- `reference/bob-appearance-2026-09-29/03-medium-side-volume.jpg`

These are existing frozen frames, not new live observations. Motion and new candidate quality are unassessed.
