# Opt-in Avatar wardrobe — 2026-09-09

September 13 addition: optional finite `wardrobe.style` selects coordinated colours while retaining the original garment IDs and coverage. See [colourways and ownership](WARDROBE-COLOURWAYS-2026-09-13.md); the default API path remains original. The following evidence records the initial wardrobe integration.

> This records the original runtime integration. The later [g050 foundation mask correction](WARDROBE-MASKS-2026-09-09.md) changes the covered foundation regions; the original counts and fit observations below describe the pre-correction assets. The [lookbook](SHOWCASE-2026-09-09.md) documents the current demonstration.

This is a runtime prerequisite for clothing demonstrations, **not visual acceptance of the current clothes**. Only the resolved **g050** body is supported. The existing manifest labels these CC0 clothes as plumbing stand-ins; g000/g100 files on disk do not establish declared or validated coverage. No garment assets, hair physics, foundation policy, portrait UI, or outfit gallery were changed.

## Public API

```js
const avatar = await Avatar.create({
  canvas,
  frame: 'body',
  wardrobe: {
    outfit: ['female_casualsuit01', 'shoes01'],
    foundation: { TORSO: 'foundation_vest', HIPS: 'foundation_boxer_brief' }
  }
});
await avatar.dress(['female_elegantsuit01', 'shoes01']);
await avatar.dress([]); // Returns to the foundation floor.
const state = avatar.report().wardrobe;
avatar.dispose();
```

Omitting `wardrobe` preserves the existing default Avatar path. Omitting foundation preferences selects vest + boxer brief. Alternatives are validated by `FoundationLayer`; secondary coverage slots that cannot change its floor are refused. The report distinguishes the requested outfit from attached garments, loaded URLs, pending candidates and errors. Initial examples omit hats.

Unsupported identity changes reject with a named g050 error before changing the current identity or retiring its figure. Validation uses the resolved bake: nearest-mode requests resolving to g050 work; other bakes and two-bake cross-fades do not. Outfit changes load completely before application. The latest valid request wins; failed changes retain the current clothing. Rebuilds prepare a clothed candidate before replacing the visible figure.

Wardrobe owns loaded garment geometry, materials, textures and source skeletons; the body and rebound shared skeleton remain borrowed. Pending fragment loads are shared, and active, cached, failed and late resources are disposed once. Avatar teardown retires active and pending wardrobes before traversing its figure. Shipping cleanup uses public disposal APIs; only the browser test reads Three r185 backend records.

## Evidence

Raw bundle: `captures/wardrobe-avatar-2026-09-09/` (ignored). It contains final development/production reports and six views each, six controlled layer-isolation views, logs, source snapshots and the old Wardrobe source. `hashes.json` covers 37 artifacts; its SHA-256 is `181498a16c28511d31958310e78402515bd974899f8832d0d69404c4a025620d`.

| Check | Result |
| --- | --- |
| New CPU contract/ownership groups | 13/13 |
| Existing Avatar / wardrobe / agency / decency checks | 137/137 · 50/50 · 28/28 · 25/25 |
| Real WebGPU development / production groups | 7/7 · 8/8; zero browser, console, network or GPU validation errors |
| Same-renderer rebuild | 8 uploaded old garment textures → 0; 0 retained old garment index buffers |
| Disposal during a pending candidate | Late loaded geometry disposed; pending count 0; retired body hidden; leaked handles empty |
| Old-source control | Slower earlier casual request overwrites later shoes on the old Wardrobe; corrected source retains shoes |
| Body equivalence | 7 mesh indices, 35 base attributes, 236 morph attributes, bone transforms/inverses, node hierarchy and material records exactly equal; all 6 embedded images byte-identical |

Base figure SHA-256: `b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14`. Masked wardrobe body: `fc4445c95ed3f423734ff272ee78ebb44d762a8f16edb94b26039de7a8a96b3a`. Different file hashes reflect the extra mask data/accessor layout; they are not a claim of identical files.

Production loads were verified from emitted hashed URLs, including `assets/g050-DwVJw10x.glb` (body), `g050-DMnsMVfX.glb` (boxer), `g050-Cg-XGIK8.glb` (vest), `g050-DUZiKyIG.glb` (casual), and `g050-DqfWZ86u.glb` (shoes). The full manifest/elegant URLs and HTTP statuses are in `production/report.json`. The manifest remains the authority; `AvatarWardrobe` maps its relative paths to bundler-emitted URLs. External `assetBaseUrl` retains the `wardrobe/manifest.json`, `wardrobe/body/g050.glb`, and manifest-relative fragment layout.

Reproduce:

```sh
node packages/core/src/wardrobe/AvatarWardrobe.selftest.mjs --old-source captures/wardrobe-avatar-2026-09-09/Wardrobe-before-avatar.js
node packages/core/src/wardrobe/AvatarWardrobe.browser.selftest.mjs
node packages/core/src/wardrobe/AvatarWardrobe.browser.selftest.mjs --production
```

## Remaining fit limits

Existing `_UNDER_*` masks **are applied**. Vest triangles fall from 28,832 to 5,512 under casual and 6,519 under elegant. Boxer triangles fall from 12,674 to 0 under casual and 5,000 under elegant. The unchanged runtime hides only authored mask regions under opaque outer garments; it restores them when those garments leave.

A fixed-pose visibility isolation attributes the casual collar/elegant chest white patches and elegant skirt dark patches to surviving foundation geometry. This identifies the contributing layer; it does not measure geometric crossings or distinguish an intersection from a legitimately visible neckline or hem. Hiding the shoe fragment removes white patches through casual trouser calves: that fragment includes socks, declares only FEET, has no `_UNDER_*` masks, and sits at FOOTWEAR outside BASE. Those diagnostic hidden-layer views are **not acceptable outfit configurations**.

First compare existing bra + briefs preferences with vest + boxer under each outfit; those are legitimate foundation choices. If measured crossings remain, a future fit slice can author pair-specific coverage or geometry while preserving neck openings, skirt hems and the floor-only state. Sock coverage may need separate hosiery geometry rather than inference from a footwear slot. No blanket garment hiding was added. The existing decency ray-cast sweep stays required after such changes.

These checks do not certify attractive styling, broad motion fit, cloth secondary motion, other body bakes, WebGL fallback, overall renderer leak freedom, GPU timing or throughput. No full repository selftest sweep was run for this slice.

## Frozen source hashes

| File | SHA-256 |
| --- | --- |
| `packages/core/src/Avatar.js` | `5006312c4f089b14dd5ce3b07ab402a090ec0ab1dfda9ca7b0736ae0965f9bad` |
| `packages/core/src/wardrobe/Wardrobe.js` | `9b938ce42f49cac21f8de3e4bee1d9427df40dbd029c983732c73b4b8ade6e0c` |
| `packages/core/src/wardrobe/GarmentManifest.js` | `f39d9112e7ed002ec1a02b2c4dbb170bbfc9243be71fb49446eda4693fb3b9cd` |
| `packages/core/src/wardrobe/AvatarWardrobe.js` | `5fc8649ab17942b729332a7678d1ae2aa0488cbda73a3f902aa8a53338726d18` |
| `packages/core/src/wardrobe/AvatarWardrobe.selftest.mjs` | `36b1efdfda80cd831b4b34838a59ddc985346bef33c76930293d585c9e24f116` |
| `packages/core/src/wardrobe/AvatarWardrobe.browser.selftest.mjs` | `f3fd6e9d8ac3e369ec463a4faa1aae89bc0f483bc0f5e0ec31f9242fbab2abdc` |
