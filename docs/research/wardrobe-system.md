# The wardrobe system — measured feasibility

Researched 2026-08-08. Every number below that describes *this* pipeline was produced by building
GLBs in headless Blender 5.2.0 LTS and measuring the exported files. Nothing about our own
pipeline is inferred.

Confidence markers, matching `research/stellar-blade-look-spec.md`:

- **[X]** Executed — a build was run, a file was written, a number came out of it
- **[V]** Verified against a primary source (spec text, standard, source code read)
- **[M]** Measured from the artefact
- **[I]** Inference, explicitly flagged
- **[✗]** Searched for, does not exist

🚩 **Provenance for every `[X]`/`[M]` number about our pipeline.** Blender 5.2.0 LTS
(`fbe6228777e7`), MPFB build `20260722`, data dir
`~/Library/Application Support/Blender/5.2/extensions/.user/user_default/mpfb/data`, on the M5 Max.
The measuring scripts and the scratch build script live outside the repo at
`…/scratchpad/wardrobe/`. **The scratch build script reproduces the shipped pipeline exactly** —
built with no garment it emits a GLB whose sha256 is `b56115d0cb52…`, **byte-identical to the
committed `assets/figures/figure_g050.glb`**. Every difference reported below is therefore
attributable to the garment and to nothing else.

---

## 0. What was already true before this document

Established by the coordinator, not re-derived here:

- The project **already uses MakeHuman's CLOTHES system**. The mhclo proxies for eyes, teeth,
  tongue, eyebrows and eyelashes go through `ClothesService` and `mpfb.entities.clothes.mhclo`,
  and `build_figure.py` already calls `ClothesService.set_up_rigging`.
- MPFB ships **20 CC0 garments** (14 suits, 6 shoes, 2 hats) and **10 CC0 hairstyles** as `.mhclo`.
- The mhclo format carries `delete_verts`, `z_depth`, `x/y/z_scale` and a `.mhmat` with
  diffuse + normal + AO PNGs.

**And one scope correction that reframes half this document:** we are **not** importing
VTuber/Booth clothing. Anime-proportioned cel-shaded garments on a figure that took four rounds to
make photoreal would read worse than no clothes at all. **We author our own garments.** The
quality reference is the Fab seller *Nice Pictures* — MetaHuman-rigged, real-garment construction
(coveralls, turnout gear, tactical jackets, hazmat, puffers, field jackets), 4K PBR, ~$39.99/item.
§4 answers whether that bar is reachable from a terminal. A third-party import path still gets a
short section (§4.6), because a user who legally buys an asset should be able to use it — but the
library must never *bundle* one.

---

## 1. 🎯 The four findings that decide the phase size

### 🎯 1. The pipeline clothes the figure, first try, and clothing is roughly vertex-neutral **[X]**

`HumanService.add_mhclo_asset(..., asset_type="Clothes")` followed by the existing
`bind_face_parts_to_rig` is the entire change. No new code path. The garment arrives **skinned,
2,197 of 2,197 vertices weighted, 0 strays bound to the fallback bone**, and every ARKit and
viseme morph survives.

| build | total verts | total tris | draw calls | file bytes | embedded image bytes |
|---|---:|---:|---:|---:|---:|
| nude (control, = shipped `figure_g050.glb`) | 20,714 | 36,924 | 7 | 11,567,392 | 7,608,541 |
| + `female_casualsuit01` | 20,353 | **35,784** | 8 | 20,307,776 | 16,372,300 |
| + suit, `shoes01`, `fedora01` | 20,363 | 35,980 | 10 | 30,109,108 | 26,160,219 |
| + suit, shoes, `ponytail01` (hair) | — | — | 10 | 26,653,820 | — |

> 🎯 **A fully dressed figure has FEWER triangles than a naked one.** 35,784 clothed against
> 36,924 nude. `delete_verts` removes more body geometry than the garment adds. The geometry
> budget is a non-issue — the same surprise Phase 0 got from morph targets.

**The cost is textures, entirely.** +8.76 MB of PNG for one suit; +18.55 MB for three garments.
See §3.4 — this is the only real constraint in the whole phase.

### 🎯 2. `delete_verts` is load-bearing for correctness, not an optimisation — and it can be moved to runtime with zero geometric loss **[X]**

With body hiding stripped (`--no-body-hiding`), **525 body vertices sit within 2 mm outside the
suit shell, 152 of them within 0.5 mm** — literal z-fighting across the torso. With hiding on,
that collapses to **9 vertices within 2 mm**, all at the garment's own boundary. The CC0 suits do
not enclose the body; the delete set is what makes them look like they do.

That is normally fatal for runtime dressing, because a baked GLB with the skin deleted **cannot
undress**. It is not fatal here:

> 🎯 **Body hiding survives as DATA.** Writing each `Delete.*` vertex group as a custom per-vertex
> glTF attribute (`_HIDE_FEMALE_CASUALSUIT01`) and rebuilding the body's index buffer in JS
> produces **17,012 triangles — byte-for-byte the same count as the baked build**, and
> `_hide_female_casualsuit01` alone gives **21,380**, again identical to the baked suit-only
> figure. Cost: **0.1609 ms median** over 30 runs, once per outfit change. Not per frame.

Full detail and the two gotchas in §2.

### 🎯 3. Poke-through is a FIT property of the CC0 asset, not a SKINNING failure — proven by posing **[X]**

The suit's poke-through, measured over the 2,738 skin vertices the garment's own hide mask says
it covers, through three.js's own linear blend skinning:

| pose | skin outside the cloth | median depth | max depth |
|---|---:|---:|---:|
| rest (control) | **26.37%** | 1.322 mm | 9.190 mm |
| arms ±45° | 26.41% | 1.331 mm | 9.181 mm |
| arms ±90°, elbows 60°, spine twist 25° | 26.84% | 1.322 mm | 9.175 mm |
| arms ±120°, spine 40° + 30° | 27.47% | 1.369 mm | 9.174 mm |
| **hips 70°, knees −90°** | **30.75%** | 1.378 mm | **14.988 mm** |

> 🎯 **A 120° shoulder raise plus a 40° spine twist moves the poke-through by 1.10 percentage
> points and moves the worst depth by −0.016 mm.** The skinning is right. The garment is simply
> cut too close to the CC0 body, at rest, before anything moves.
>
> The one pose that matters is the **knee**: hips 70° / knees −90° takes the worst poke-through
> from 9.19 mm to **14.99 mm**. That is the classic LBS collapse zone with no cloth simulation,
> and it is where 6.6 SpringBones / a cloth layer buys something.

🚩 **A red flag that execution disproved, recorded because the project's standard says to.** A
nearest-vertex weight comparison reported only **52.50% dominant-bone agreement** between the suit
and the skin under it, concentrated as `spine_03 ← nearest skin upperarm_l/r` (373 of 531
disagreements). That looks like a sleeve driven by the torso. It is not: the armpit is a place
where "nearest body vertex" is genuinely ambiguous between arm skin and torso skin, and the posed
measurement above shows the error does not exist. **Do not gate on the weight comparison. Gate on
the posed distance.** (Same lesson as the `?eyes=0` compound-toggle correction in 3.3/3.4.)

### 🎯 4. Procedural garment authoring IS reachable — and the gap that remains is pockets, hardware and wear, not cloth

The reframed headline question. The short answer is **yes, and clothing is genuinely more
tractable than a face** — for a structural reason, not an optimistic one. A face's realism lives
in non-repeating asymmetric detail that has to be scanned. A garment is a manufactured object: its
geometry is derivable from a documented pattern, and its material is a **periodic structure with
published physical parameters**. Both halves are *specified* in a way a face is not.

Three things establish it, and two are measurements taken here:

- **The weave is generable and measurable from thread count alone.** **[X]** Height fields
  generated from `{weave, ends/in, picks/in}` give a structure-tensor coherence that separates
  plain weave from twill by **1.9–2.6×** (0.2887 vs 0.5560 / 0.5989 / 0.7429) and orders the twills
  by float length correctly. No scan, no sample. §4.4.
- **A bake-time drape costs seconds; a runtime drape is impossible.** **[X]** 0.65–3.58 s to settle
  1,681–5,041 cloth verts on our real body, against **10.8–59.7 ms per frame** versus a 16.6 ms
  whole-frame budget. That is a 1–4× *whole frame* for one garment. §4.2.
- **A complete open pipeline exists.** **[V]** GarmentCode/`pygarment` is **MIT**, headless,
  already emits **GLB**, and published **30 s/garment** on an RTX 3090. §4.3.

> 🚩 **But we do not clear the Nice Pictures bar procedurally, and the gap is specific and
> nameable: pockets, hardware, and worn-in wear.** A procedurally generated jacket reads as a
> *clean, correct, empty* jacket. GarmentCode says in its own paper that it *"cannot seamlessly
> represent panels with holes"* — blocking eyelets and buttonholes at the pattern level — and
> cannot model fabric layers or *"elements sewn on top of a fabric piece, such as pockets."* For a
> reference set of coveralls, turnout gear and tactical jackets, **those are not garnish, they are
> the garment.**
>
> 🎯 **The important difference from the face, though: this gap is BOUNDED.** Hardware is a
> one-time library of ~15 parametric models; placement is derivable from pattern edges.
> Contact-driven wear is the one genuinely open problem — **[✗] the weathering canon exists and has
> never been applied to garments in a published venue** — and it gets its own spike with an honest
> chance of a negative. That is a materially better position than the face, where the missing
> content was unbounded scan data. §4.5.

---

## 2. Layering, z_depth, and body hiding

### 2.1 🚩 `z_depth` is INERT in MPFB. It is neither render order nor fitting offset. **[V]**

Exhaustive grep of the entire MPFB source tree for `z_depth` / `zdepth` / `MhZDepth` returns
**four sites and no consumer**:

| site | what it does |
|---|---|
| `ui/create_assets/makeclothes/objectproperties/z_depth.json` | declares an int property, default 50, described as *"The order value of the clothes, for if several pieces of clothes are on top of each other"* |
| `entities/clothes/mhclo.py:30,162–163` | initialises `self.zdepth = 50`, parses `z_depth` from the file |
| `entities/clothes/mhclo.py:283–284` | writes it back out when saving an mhclo |
| `services/clothesservice.py:606` | copies it onto a Blender custom property |

**Nothing reads it.** It is metadata that round-trips and is never applied. Its only historical
meaning is inside legacy MakeHuman's own OpenGL viewport sorting, which MPFB does not implement.

Shipped values, measured across all 20 garments: **14 suits at 50, 2 hats at 50, 6 shoes at 5.**
Note the shoes are *lower* than the suits, so even the authored values do not encode a sensible
outer-to-inner order.

> **Design consequence: we own layer order entirely.** There is no upstream convention to honour
> and no upstream code to fight. Our own `z_depth` must be an authored field on our own garment
> manifest, and it must mean something specific — see §3.5.

### 2.2 What actually happens with two garments at the same depth **[X]**

Built `female_casualsuit01` + `female_elegantsuit01`, both `z_depth 50`:

```
MASK modifiers: ['Hide helpers', 'Delete.female_casualsuit01', 'Delete.female_elegantsuit01']
  Delete.female_casualsuit01 : 5,156 verts
  Delete.female_elegantsuit01: 3,898 verts
  union                      : 6,288 verts     (sum would be 9,054 — they overlap by 2,766)
exported: both meshes, 2,197 and 2,205 verts, both skinned
```

Both attach. Both delete groups apply, as a **union**. No ordering, no offset, no conflict
detection, no warning. The two suits interpenetrate and MPFB does not care. **Layering is not a
feature we inherit; it is a feature we build.**

Suit + shoes + hat coexist fine, because they occupy disjoint body regions:
`Delete.female_casualsuit01` 5,156 + `Delete.shoes01` 3,130 = union 8,174 (no overlap). The
fedora carries **no `delete_verts` at all** — hats do not hide anything.

### 2.3 How body hiding is actually implemented **[V]**

`ClothesService.update_delete_group` (`clothesservice.py:295`) does **not** delete anything. It
creates a vertex group named `Delete.<assetname>` on the basemesh, adds the mhclo's `delverts` to
it (index-checked against the basemesh vertex count, then passed through `_conservative_mask`
which drops outliers), and adds a Blender **MASK modifier** with `invert_vertex_group = True`.

The deletion becomes permanent only at
`ExportService.bake_modifiers_remove_helpers(bake_masks=True)` — the call `build_figure.py`
already makes. **So the destruction is ours, at one line, and it is optional.**

Measured through the bake, `female_casualsuit01` at g050:

```
basemesh verts before bake : 19,158      (with helpers)
Delete.female_casualsuit01 :  5,156      (of those 19,158)
basemesh verts after bake  : 10,756      against 13,380 for the nude control
                             → 2,624 real body verts destroyed
```

The delete-group vertex indices are **identical at g000, g050 and g100** (all three dumps are
34,565 bytes and the same set) — the mhclo names vertices by index, and the index set does not
depend on the macro shape.

### 2.4 The runtime-hide prototype, and the two gotchas **[X]**

Path: write each `Delete.*` group as a `FLOAT`/`POINT` mesh attribute named `_hide_<asset>`
**before** the bake, so Blender remaps it through the helper strip exactly as it remaps positions;
skip the `Delete.*` MASK modifiers; export.

🚩 **Gotcha 1 — the attribute is silently dropped by default.** Blender's glTF exporter has
`export_attributes`, which `build_figure.py` does not set, and it defaults off. The first build
exported cleanly, reported success, and carried
`POSITION,NORMAL,TEXCOORD_0,JOINTS_0,WEIGHTS_0` and nothing else. With `export_attributes=True`
the body primitive carries `_HIDE_FEMALE_CASUALSUIT01,_HIDE_SHOES01,POSITION,…`.

🚩 **Gotcha 2 — the name is upper-cased, AND THEN IT IS LOWER-CASED BACK.** Authored
`_hide_female_casualsuit01`, exported `_HIDE_FEMALE_CASUALSUIT01` — read out of the GLB's own JSON
chunk. But three r185's `GLTFLoader` lower-cases unknown attributes on the way in, so
`geometry.attributes` carries `_hide_female_casualsuit01` again — read off the loaded geometry.

**Both halves are true and they cancel, which is worse than either alone.** A reader who follows
the original advice and matches on the UPPER-CASE spelling because the file has it will find
nothing in three. Case-insensitive is the right rule; the reason is that **both spellings occur,
one on each side of the file**, not that the exporter shouts.

Verification, in node against three r185's `GLTFLoader`:

```
body: 14,517 verts, 26,756 triangles
  _hide_female_casualsuit01: 2,738 of 14,517 flagged (18.9%)
  _hide_shoes01            : 2,574 of 14,517 flagged (17.7%)

triangles kept, dropping both masks : 17,012   baked control (layered_g050): 17,012   IDENTICAL
triangles kept, suit mask only      : 21,380   baked control (suit_g050)   : 21,380   IDENTICAL
triangles kept, no mask (undressed) : 26,756
rebuild cost, median of 30 runs     : 0.1609 ms   (min 0.1440, max 0.2782)
```

**The runtime path is geometrically lossless.** It is not an approximation of the bake; it is the
same result.

**What it costs.** Keeping the body whole is 14,517 verts against the baked 9,247 — +5,270 verts,
+9,744 triangles. **[I]** Scaling Phase 0's measured 0.219 ms for 69 morphs on 13.7k verts by
14,517/13,380 gives ≈ **0.238 ms**, still under 1.5% of a 16.6 ms frame. The mask attributes cost
**58,068 bytes per garment** as FLOAT32 (14,517 × 4); as `UNSIGNED_BYTE` that is 14.5 KB, and as a
packed bitfield 1.8 KB. Ship it as bytes — a hide flag is a boolean.

### 2.5 Recommendation, with the tradeoffs stated

| option | undress? | body cost | correctness | verdict |
|---|---|---|---|---|
| **Bake `delete_verts` (today)** | ❌ never | smallest | exact | fine for one fixed outfit, fatal for the product |
| **Per-vertex hide attribute + index rebuild** | ✅ | +5,270 verts, +58 KB/garment (14.5 KB as bytes) | **proven identical to the bake** | ✅ **recommended** |
| Per-vertex alpha mask + `alphaTest` | ✅ | same verts, no rebuild | ⚠️ alpha-tested skin is a shading path change; interacts with 3.12's TAAU and 3.16's cutoff-0.1 card work | worse, for a subsystem this project has already been bitten by |
| Shader-side hide map (texture) | ✅ | a texture per garment | ⚠️ needs UV-space authoring the mhclo does not give us; the hide set is per-VERTEX by construction | mismatched to the data |
| Separate baked GLB per outfit | ✅ (by reload) | 5 figures × N outfits | exact | see §3 — the combinatorics kill it |

> **Recommendation: per-vertex hide attribute, rebuilt on the CPU at dress time.** The deciding
> factor is that it was *measured* to reproduce the bake exactly at 0.16 ms, so it costs nothing
> and risks nothing. What would change my mind: if a future garment needed sub-vertex hiding (a
> lace panel, a sheer sleeve) the per-vertex granularity would show as a ragged edge, and that
> case wants the alpha route. Author the manifest so a garment can declare which it needs.

---

## 3. Runtime swapping versus baked — the architecture

### 3.1 The bake is 12–15 seconds. That settles it. **[X]**

`/usr/bin/time -p`, wall clock, this machine:

| build | real | marginal |
|---|---:|---:|
| nude figure | 12.30 s | — |
| + 1 garment | 13.44 s | +1.14 s |
| + 3 garments | 14.88 s | +2.58 s (0.86 s/garment) |

⚠️ **THESE ARE MACHINE-STATE NUMBERS, NOT PIPELINE CONSTANTS, and they must travel with their
provenance.** Re-measured on the same script, the same Blender 5.2.0 LTS `fbe6228777e7` and the
same machine class during Phase 9's build: **nude 8.56 s, suit + shoes 8.73 s, four garments with
masks and fragments 9.54 s.** The CONCLUSION below is untouched and in fact gets stronger — an
agent still cannot wait ~9 s and still cannot ship Blender — but quoting 12.30 s as a property of
the pipeline is quoting a warm cache and a cold one as if they were the same measurement.

**An AI agent choosing an outfit by mood cannot wait 13 seconds and cannot ship Blender.** (It
also cannot ship MPFB at all — GPLv3, build-time only, per the standing constraint.) Runtime
dressing is not a preference; it is forced.

### 3.2 The combinatorics kill per-outfit whole-figure bakes **[I], arithmetic on [X] measurements**

The figure ships as **5 gender bakes**. A whole-figure GLB per outfit is 5 × N files at
20–30 MB each. Ten outfits is 50 files and ~1.1 GB. That is not a library anyone embeds.

### 3.3 🚩 And a garment CANNOT be shared across the five figures. Measured. **[X]**

The obvious saving — one garment fragment, five bodies — does not survive contact.

```
garment mesh drift, female_casualsuit01, g000 vs g100:
  mean 95.145 mm   median 98.981 mm   p95 127.669 mm   max 143.066 mm
body  mesh drift, same two figures:
  mean 105.614 mm  median 124.014 mm  p95 135.739 mm   max 147.194 mm
```

The garment moves **90% as far as the body does**, because `ClothesService.fit_clothes_to_human`
re-solves every garment vertex as a barycentric combination of three named basemesh vertices plus
an offset scaled by three measured body dimensions (`clothesservice.py:175–235`). That is the
whole of the `x/y/z_scale` "morph tracking" mechanism, and it is why the fit tracks the gender
axis exactly.

Put the wrong figure's garment on a body and it fails hard. Paired measurement, same 462 body
vertices, g100 body:

```
inside the correctly-fitted suit : 462
still inside the g000-fitted suit:  72
NOW OUTSIDE (skin through cloth) : 390  (84.4%)
   exposure depth  median 42.14 mm   p95 118.21 mm   max 125.59 mm
```

> 🎯 **A garment fragment is per-figure, not universal.** Five bakes of a garment, not one. The
> good news: a garment fragment is small — 2,197 verts and 4,236 triangles for the suit — so five
> of them is cheap *in geometry*. It is the **textures** that must be shared across the five, and
> they can be: the fit changes vertex positions, not UVs.

### 3.4 🚩 Textures are the entire budget, and the current path is worse than it looks **[M]**

Measured PNG payload actually embedded in the GLB (the AO map is absent — see §3.6):

| | file bytes | image bytes | image share |
|---|---:|---:|---:|
| nude | 11,567,392 | 7,608,541 | 66% |
| + suit | 20,307,776 | 16,372,300 | **81%** |
| + suit + shoes + hat | 30,109,108 | 26,160,219 | **87%** |

Across all 20 CC0 garments: **122 MB of PNG**, individual files up to 9.6 MB
(`male_casualsuit03_normal.png`, 4096×4096). Six of the fourteen suits ship a **4096²** normal map.

**[I]** GPU footprint, arithmetic not measurement: a 4096² RGBA8 normal is **64 MB** uncompressed
in VRAM, ×1.333 with mips = **85.3 MB**; plus a 2048² diffuse at 16 MB → **≈106 MB of VRAM for one
suit**. That is not survivable for a wardrobe.

> **This is the phase's binding constraint, and it has a known answer: KTX2/Basis (ETC1S for
> albedo, UASTC for normals) via `KHR_texture_basisu`, which three.js loads through
> `KTX2Loader`.** ETC1S is typically 6–8× smaller on disk than PNG and stays compressed in VRAM.
> **[I]** — I did not run a transcode, so treat the ratio as the format's published behaviour and
> **measure it in the phase**, not here. Also drop the normal maps to 2048² unless a measurement
> says 4096 buys something at portrait framing; §5 of the look spec puts the *skin* detail normal
> at 2K tiled 8–12×, so a 4K garment normal is out of proportion with the face.

### 3.5 The recommendation

**Ship a per-figure body GLB carrying every hide mask, plus per-garment fragment GLBs loaded on
demand.** Concretely:

```
assets/figures/figure_g050.glb          body + face parts + _HIDE_* masks for the whole catalogue
assets/wardrobe/<garment>/g050.glb      garment mesh only: POSITION/NORMAL/UV/JOINTS_0/WEIGHTS_0
assets/wardrobe/<garment>/textures.ktx2 shared across all five figure variants
assets/wardrobe/manifest.json           id, layer, clo, fabric, hide-mask name, formality, palette
```

Weighed against the three candidates the brief named:

| | atlas GLB, everything present and hidden | **fragments on demand** | VRM-style bone-compatible attach |
|---|---|---|---|
| first paint | worst — the whole catalogue downloads before anything renders | best — body only | good |
| swap latency | zero | one fetch + parse | one fetch + parse |
| VRAM | all garments resident (§3.4 makes this fatal) | only what is worn | only what is worn |
| per-figure cost | catalogue × 5 | fragment × 5, textures × 1 | depends on the retarget |
| complexity | lowest | low | highest — see §4.7 |

**Fragments win on VRAM, and §3.4 says VRAM is the constraint.** The atlas is only viable if
KTX2 gets the whole catalogue under a budget we have not measured; if it does, revisit — the
zero-latency swap is genuinely attractive for a mood-driven avatar.

**Against the measured frame budget:** dressing costs **0.1609 ms** of CPU, once, at dress time.
Rendering costs **+1 draw call per garment** (7 → 8 → 10 measured) and **fewer triangles than
nude**. Against 4 RectAreaLights at 3.604 ms, one shadow pass at 2.62 ms, 69 morphs at 0.219 ms
and `SkinMaterial` at 0.301 ms — leaving ~9.8 ms of the 16.6 ms frame — **the wardrobe's geometry
and dressing cost is noise.** The costs that are *not* noise are the fabric shader (3.7, unbuilt)
and cloth/spring physics (6.6, unbuilt).

**What would change my mind:** a measurement showing KTX2 puts a ten-garment catalogue under
~40 MB resident. Then the atlas is simpler and swaps instantly, and simplicity wins.

### 3.6 🚩 Two defects in the current material path, found while measuring

**(a) The AO map is discarded.** Every CC0 garment mhmat declares
`aomapTexture <name>_ao.png` — measured 0.7–2.2 MB per garment, 2048² — and it never reaches the
GLB. Cause, read at source: `NodeWrapperGameEngine.setup_group_nodes`
(`entities/nodemodel/v2/materials/nodewrappergameengine.py:150–160`) wires exactly three things —
diffuse→Base Color, diffuse alpha→Alpha, normal→Normal Map. **There is no occlusion node at all.**
This is not a glTF exporter limitation; MPFB's game-engine material has no AO input. Punch-list
3.10 exists because un-occluded ambient specular is why WebGL characters look like plastic, and we
are throwing away hand-baked AO for free.

**(b) Garments arrive with one scalar roughness and no roughness map.** Read out of the built GLB:

```
Human.female_casualsuit01  metallic 0    roughness 0.8039   normalTexture ✓  occlusionTexture ✗
Human.shoes01              metallic 0    roughness 0.6000   normalTexture ✓  occlusionTexture ✗
Human.fedora01             metallic 0    roughness 0.6000   normalTexture ✓  occlusionTexture ✗
```

The 0.8039 is `1 − shininess(0.1961)` from the mhmat. **That is the whole material.** No sheen,
no anisotropy, no clearcoat, no roughness variation. **This is precisely the hole punch-list 3.7
`FabricMaterial` exists to fill**, and §4 is how we fill it.

### 3.7 🚩 The existing asset gate REJECTS a clothed figure, by construction **[X]**

`node tools/figure-pipeline/verify_glb.mjs <clothed.glb>`:

```
nude_g050    : PASS
suit_g050    : FAIL — 1 problem
   FAIL Human.female_casualsuit01: unrecognised material, no expected alpha mode
layered_g050 : FAIL — 3 problems  (fedora01, female_casualsuit01, shoes01)
```

Everything else passes on the clothed figures — all 52 ARKit morphs, all 15 OVR visemes, the
corneal dome (0.680/0.688 mm proud, 3.37×/3.41× noise), the anterior chamber (2.291/2.292 mm),
the cornea material (transmission 1, IOR 1.3333), the neutral lip seal (0.022 mm) and the teeth
coverage (1.279 mm) are all green and **numerically identical to the nude figure**. Adding a
garment perturbs nothing the gate already measures.

The failure is a whitelist. `verify_glb.mjs:688–691`:

```js
const OPAQUE_MATERIAL_PARTS = [/body/i, EYEBALL_GLOBE_PATTERN, EYEBALL_CORNEA_PATTERN, /teeth/i, /tongue/i];
const MASK_MATERIAL_PARTS   = [/brow/i, /lash/i];
```

A garment matches neither and is reported as unrecognised. **The gate must gain a garment clause,
and the clause has to be per-garment rather than a regex** — a wool coat is OPAQUE, a mesh top or
a lace panel is MASK or BLEND. That is a manifest field, which is another reason §3.5 has a
manifest.

---

## 4. Authoring photoreal garments from a terminal

This is the same wall `docs/PROGRESS.md` records for the face:

> *"Stellar Blade's character fidelity is largely art labor: scan-derived multi-thousand-pixel PBR
> texture stacks, artist-groomed hair, baked lighting. That content cannot be authored from a
> terminal."*

**The claim I want to test is that clothing is more tractable than a face.** The argument for it
is structural, and I think it holds: a face is a unique organic surface whose realism lives in
asymmetric, non-repeating detail. A garment is a **manufactured object** — cut from flat panels to
a documented pattern, from a woven material with a periodic structure and published physical
parameters. Both halves of a garment, geometry and material, are *specified* in a way a face is
not.

### 4.1 🎯 The tools for panel-sewing are already installed. Measured. **[X]**

Blender's cloth modifier has **sewing springs** — verified by introspecting the shipped RNA in
Blender 5.2, not by reading a wiki:

```
use_sewing_springs   (default False)
sewing_force_max     (default 0.0)
vertex_group_shrink, shrink_min, shrink_max
use_pressure, uniform_pressure_force, pressure_factor, use_pressure_volume
bending_model = ANGULAR
```

That is the mechanism CLO3D and Marvelous Designer are built on: flat panels, springs pulling
loose seam edges together, relaxation onto a collider. **We already run Blender headlessly. We
already have the sewing solver.**

🎯 **And it ships five fabric presets**, read straight out of
`/Applications/Blender.app/Contents/Resources/5.2/scripts/presets/cloth/`:

| preset | quality | mass | tension | compression | shear | **bending** | damping (t/c/s) |
|---|---:|---:|---:|---:|---:|---:|---:|
| **Silk** | 5 | 0.150 | 5 | 5 | 5 | **0.05** | 0 / 0 / 0 |
| **Cotton** | 5 | 0.300 | 15 | 15 | 15 | **0.50** | 5 / 5 / 5 |
| **Rubber** | 7 | 3.0 | 15 | 15 | 15 | **25** | 25 / 25 / 25 |
| **Denim** | 12 | 1.0 | 40 | 40 | 40 | **10** | 25 / 25 / 25 |
| **Leather** | 15 | 0.4 | 80 | 80 | 80 | **150** | 25 / 25 / 25 |

⚠️ **These are Blender's authored values, not measurements of fabric.** They carry no citation and
no units traceable to a textile instrument. What they *are* is a defensible, shipped, internally
consistent bracket — bending stiffness spanning **3,000×** from silk to leather, mass spanning
**20×** — and a starting point that costs nothing. Treat them as priors to be replaced by real
KES-F or Wang-et-al measurements, not as physics.

### 4.2 🎯 A bake-time drape costs seconds. A per-frame drape is impossible. Measured on our own figure. **[X]**

Cloth simulation with the **real exported body as the collider** (14,517 verts), 60 frames to
settle, `distance_min` 5 mm:

| cloth verts | preset | total | per frame |
|---:|---|---:|---:|
| 1,681 | Cotton | **0.65 s** | 10.8 ms |
| 1,681 | Denim | **1.09 s** | 18.1 ms |
| 5,041 | Cotton | **2.28 s** | 38.0 ms |
| 5,041 | Denim | **3.58 s** | 59.7 ms |

Our suit is 2,197 verts, so a garment-density drape lands in that bracket.

> 🎯 **Read both columns.** At bake time, 0.65–3.58 s against a 12.30 s figure bake and a measured
> 0.86 s marginal cost per mhclo garment — **a drape roughly triples the per-garment bake cost and
> is entirely affordable.** Per frame, 10.8–59.7 ms against a **16.6 ms budget for the whole
> frame** — **1 to 4× the entire frame, for one garment, before anything is rendered.**
>
> That settles the simulate-vs-approximate question in §5 without argument: **cloth simulation is
> a bake-time tool. Runtime secondary motion is spring bones (6.6), always.**

⚠️ **Honest limit on this measurement.** `use_sewing_springs` was enabled but the test panel is a
closed grid with no loose seam edges, so **the sewing solver was not exercised** — this is a
drape-and-collide cost, not a sewing cost. Real panel assembly adds a seam-closure phase before
the drape. The number is a floor.

### 4.3 Garment geometry from 2D patterns — there is exactly one complete open path

#### GarmentCode is the answer, and it is closer to us than expected **[V]**

| project | what it is | licence | headless | verdict |
|---|---|---|---|---|
| **GarmentCode** (SIGGRAPH Asia 2023) + **GarmentCodeData** (ECCV 2024) | a DSL for garments, a sewing-pattern generator, a Warp/XPBD drape pipeline, and **115,000** generated samples with patterns, draped meshes, UVs and body measurements | **MIT** (code, verified in the repo LICENSE); ⚠️ **[✗] the 115k dataset's own licence could not be retrieved** — ETH Research Collection refused every access route | ✅ `pattern_sampler.py`, `pattern_fitter.py`, `pattern_data_sim.py`; `pygarment` on PyPI | ✅ **the only fully open, MIT, runnable-headless pipeline that exists** |
| Sewing Pattern dataset (NeurIPS 2021), >20,000 samples | MIT | ⚠️ **requires Maya 2022+ and commercial Qualoth** | data-only for us |
| NeuralTailor (TOG 2022) | MIT | pattern reconstruction from point clouds | not our direction |
| SewFormer / SewFactory (TOG 2023), ~1M images | ⚠️ **no licence file** | — | unusable |
| Deep Fashion3D (563 captured garments) | `NOASSERTION`, form-gated | **no sewing patterns** | — |
| CLOTH3D, BCNet | ⚠️ unverified / **research-only** | no patterns / research-only | — |

🎯 **Three findings that materially shorten the work:**

1. **GarmentCode already exports GLB.** `pygarment/meshgen/sim_config.py` declares
   `g_sim_glb = …_sim.glb` alongside the OBJ, and generates a UV texture with configurable
   `seam_width` at `dpi: 1500`. **Blender may not be needed in the geometry path at all** — only
   for baking.
2. **Swapping in our hm08 body is three files, and the config already anticipates it.**
   `sim_config.py` selects a segmentation file behind a flag
   (`'ggg_body_segmentation.json' if not self.use_smpl_seg else 'smpl_vert_segmentation.json'`),
   so a third is a supported extension rather than a fork. We need: `<name>.obj` (our exported
   body — drop-in), `<name>.yaml` (26 measurements, computable from the mesh), and a segmentation
   JSON with keys `body / left_arm / left_leg / right_arm / right_leg / face_internal`. **hm08
   already ships 172 named groups**, so generating that JSON is a script, not an art task.
3. **Its body input is a 26-measurement vector** — `bust, underbust, waist, hips, bust_line,
   waist_line, hips_line, shoulder_w, shoulder_incl, armscye_depth, arm_length, arm_pose_angle,
   wrist, leg_circ, crotch_hip_diff, hip_inclination, neck_w, head_l, height, back_width,
   hip_back_width, waist_back_width, bust_points, bum_points, vert_bust_line,
   waist_over_bust_line` — which is exactly the interface an *AI dialling its own body* wants.

⚠️ **Two licence and maintenance traps, both real.** GarmentCode depends on
`maria-korosteleva/NvidiaWarp-GarmentCode`, a fork under the **NVIDIA Source Code License, not
Apache-2.0** — check §3.3 before shipping. And it targets Warp's **deprecated `warp.sim`** module;
the successor is **Newton** (Apache-2.0, Linux Foundation, Disney Research + DeepMind + NVIDIA),
which *"extends and generalizes Warp's (deprecated) `warp.sim`"*. **Budget a migration.**

#### Parametric block drafting exists in code, and its honest limit is documented **[V]**

- **JBlockCreator** — **GPL-3.0**, published in *SoftwareX*, University of Manchester. The source
  tree literally contains `src/aldrich/SkirtPattern.java`, `src/aldrich/TrouserPattern.java`,
  `src/beazleybond/BodicePattern.java`, `src/gill/SweatShirtPattern.java`, and
  `src/dxfwriter/DxfFile.java`. **Aldrich, Beazley & Bond and Gill drafting methods, taking body
  measurements, emitting DXF.**
- **FreeSewing** — **MIT**, JavaScript, headless-native, 18+ designs. Its `Sarah` skirt block is
  explicitly *"the natural waist skirt block from W. Aldrich's Metric Pattern Cutting for Women's
  Wear, 6th Edition"*.
- **Seamly2D** — GPLv3+, formula-based drafting with multi-size measurement tables; the community
  has authored Aldrich menswear blocks.

🚩 **And here is the finding that should temper the optimism, from FreeSewing's own designer:**
several dimensions in Aldrich's original are **"magic" values**, and the curves are subjectively
defined — *"whatever looks good"* — which is what prevented clean scaling in digital software
without a constraint solver. **The tailoring books are parametric in the linear measurements and
hand-waved in the curves.** "Parametric by construction" is true of the straight lines and false
of the shapes that make a garment read as tailored.

#### Cost, from published numbers **[V]** and our own measurement **[X]**

| | | |
|---|---|---|
| GarmentCodeData, verbatim | *"each sample takes **30 seconds** to simulate on average"* on an **RTX 3090**, capped at **2400 frames / 5 minutes**; body 47.5k tris, garment ~30k tris | **simulation success rate 72%** |
| GarmentCodeData, pattern generation | ~7 hours for 5,000 designs on **one** EPYC 9654 core | patterns are cheap; drape is the cost |
| C-IPC (highest quality) | **0.7–10.6 s per time step** on 4–8 CPU cores | 2–3 orders of magnitude slower. Not a candidate. |
| **our own Blender drape (§4.2)** | **0.65–3.58 s** to settle 1,681–5,041 cloth verts on our real 14,517-vert body | our meshes are ~6× smaller than theirs |

> 🎯 **Bake-time drape is affordable at every published price.** 30 s/garment on a GPU, or seconds
> in Blender at our mesh density, against a 12.30 s figure bake. **The 72% success rate is the
> number to design around, not the 30 seconds** — one garment in four fails and needs a retry or
> a human.

### 4.4 Fabric PBR from physical parameters

#### 🎯 A weave normal map IS generable from thread count — and my probe found the gate that will NOT work **[X]**

I generated plain, 2/1 twill, 3/1 twill and 4/1 satin height fields at 24.8 µm/texel over a
12.7 mm patch, from `{weave, ends-per-inch, picks-per-inch}` alone, and measured the result with a
structure tensor and an autocorrelation:

| fabric | ridge° | **coherence** | pitch x mm | naive prediction | pitch y mm | naive prediction |
|---|---:|---:|---:|---:|---:|---:|
| poplin, plain, 120×80 | 90.00 | **0.2887** | 0.4217 | 0.4233 | 3.1750 | 0.6350 |
| denim, 3/1 RH twill, 68×44 | −90.00 | **0.5989** | 1.4883 | 0.3735 | 2.3068 | 0.5773 |
| gabardine, 2/1 twill, 100×60 | −90.00 | **0.5560** | 0.7689 | 0.2540 | 1.2650 | 0.4233 |
| satin, 4/1, 180×90 | −90.00 | **0.7429** | 1.4139 | 0.1411 | 1.4139 | 0.2822 |

**What worked.** Coherence — the structure tensor's anisotropy, 0 = isotropic, 1 = perfectly
aligned — **separates plain weave from twill by 1.9–2.6×** (0.2887 against 0.556–0.743) and orders
the twills by float length exactly as it should: 2/1 < 3/1 < 4/1 satin. **That is the anisotropic
highlight strength, derived from nothing but the weave type and the thread count, and it is
measurable.** Generating the structure procedurally is not the hard part.

🚩 **CORRECTED BY 9.16's SPIKE: THE SEPARATION IS REAL AND ITS CAUSE IS MISATTRIBUTED.** The four
fabrics above have **four different setts** (plain 120×80, denim 68×44, gabardine 100×60, satin
180×90), so float length and sett imbalance moved together and this table cannot say which caused
the ordering. Varying each alone, with sett and yarns held at 114.3 × 67.3 /in and 36.9/28.27 tex:

| weave | float | warp-face fraction | coherence |
|---|---:|---:|---:|
| plain | 1 | 0.500 | 0.1406 |
| **2/2 twill** | **2** | **0.500** | **0.1743** |
| 2/1 twill | 2 | 0.667 | 0.3754 |
| 3/1 twill | 3 | 0.750 | 0.3807 |
| 4/1 satin (move 2) | 4 | 0.800 | 0.5689 |

The 2/2 twill shares the 2/1's float length and lands **nearer the plain weave**, and 2/1 vs 3/1
differ by 1.4% across a whole float. **Coherence tracks WARP-FACE FRACTION, not float length.**

And the confound measured directly: holding the weave at *plain* and moving only the sett spans
**0.0036** (90×90, isotropic) to **0.5592** (68×44) — a plain weave at denim's sett is *more*
coherent than a 3/1 twill at a balanced sett. **A bare coherence number is not a statement about
the weave.** Consequence for 9.11: drive anisotropy strength from measured coherence, never from a
float-length lookup, or a 2/2 gabardine gets a lobe it does not have. (The spike's absolute values
do not reproduce this table's — different generator — so quote coherence *with its sett* or not at
all. `tools/spikes/fabric-weave.mjs --gate`.)

🚩 **What did NOT work, and it changes the gate.** The **orientation** readout failed. Every twill
reported −90.00°, i.e. axis-aligned, not the diagonal. The predicted twill angles from the thread
count ratio are 32.91° (denim), 30.96° (gabardine) and 45.00° (satin) — the probe recovered none
of them. The autocorrelation pitches also disagree with the naive prediction by 2–10×.

**Why, and this is the useful part:** a whole-patch structure tensor is dominated by the *yarn
cross-section ridges*, which run along the yarn axes at 0° and 90° and carry most of the gradient
energy. The twill diagonal is a **lower-amplitude, longer-wavelength modulation** on top of them.
Recovering it needs a band-pass to the weave-repeat scale first, or an FFT peak picked at the
repeat frequency — not a global tensor. My "predicted pitch" formula was also simply wrong for
twills: I predicted one yarn spacing where the repeat is `over + under` yarns.

> **Consequence for punch-list 9.11: "measure the diagonal with a structure tensor" is a gate that
> passes a wrong implementation.** It reports −90° on a correct twill. The gate must be an FFT
> peak at the repeat frequency, or a band-passed tensor, and it must be **proven red against a
> plain weave** — which has no diagonal to find. Recorded here so the spike does not spend a round
> discovering it. (Same shape as 3.13's `Grade.selftest.mjs`: a check that reads green on a
> decorative implementation is worse than no check.)

✅ **9.16's SPIKE BUILT THAT GATE AND IT PASSES — with two corrections to the paragraph above and
one addition the paragraph did not anticipate.** `tools/spikes/fabric-weave.mjs --gate`:

- **The two twills are recovered exactly.** 32.91° and 30.96°, error 0.0000–0.0001° on a periodic
  patch and 0.018–0.197° through an incommensurate Hann-windowed one, against a stated ±1.0°.
- 🚩 **The satin's predicted 45.00° IS THE FORMULA APPLIED OFF ITS DOMAIN, and the gate is right to
  refuse it.** A 4/1 move-2 satin's interlacing set satisfies *both* `(2i − j) ≡ 4 (mod 5)` and
  `(i + 2j) ≡ 2 (mod 5)` — multiply the first by 3, the inverse of 2 mod 5 — so it has two
  generators and two diagonals, and the stronger peak is at **−14.04°**, only 1.468× the 45.00°
  family. That is the textile definition of satin: it is *constructed* so the interlacings never
  line up into a visible twill. A gate returning 45.00° would be reading a number off a structure
  that does not have one. The plain weave is refused at uniqueness **exactly 1.000000**, because
  `(i − j) mod 2` and `(i + j) mod 2` are the same function.
- 🚩 **AN FFT PEAK GATE IS STILL BLIND TO WHETHER THE DIAGONAL CAME FROM AN INTERLACING.**
  `painted-diagonal` — axis-aligned yarn ridges plus a cosine at exactly the right wave vector,
  with no weave underneath — **passes it cleanly at 32.91°.** A second, independent instrument is
  required: fold the patch onto one weave repeat and measure its SHAPE. Harmonic fraction 0.048 for
  the painted sinusoid, 0.345 for real generated denim, 1.040 for an ideal 3/1 square wave.
- **And the angle must be SIGNED.** An S-twill has identical |angle|, coherence, yarn diameter and
  GSM to its Z-twill twin; the sign is the only thing that separates them.

#### The measured data that can actually be shipped

🎯 **Only two sources of measured fabric appearance are redistributable.**

| source | contents | licence |
|---|---|---|
| **RGL EPFL material database** | 62 materials incl. 6× `acrylic_felt_*`, 5× `satin_*`, `aniso_sari_silk_2color`, `vch_silk_blue`, `ilm_aniso_darth_vader_pants`, `ilm_aniso_tarkin_tunic` | ✅ **CC0** — *"all material data is licensed under the Creative Commons Zero (CC0) license"*. **The only unrestricted measured fabric appearance data found.** |
| **Irawan & Marschner presets, as embedded in LuxCoreRender** | six weave configs, full yarn tables | ✅ **Apache-2.0** (Mitsuba's `irawan` plugin needs external `.weave` files; LuxCore embeds them in source) |
| UTIA BTF (150 materials, 96 fabric) | ⚠️ **[✗] licence unverified**, server refused |
| Bonn UBO2014 (84 materials incl. fabric/felt) | ⚠️ **[✗] licence unverified**, 403 |

**LuxCore's Irawan presets, extracted** — `tileWidth × tileHeight`, α (uniform scattering),
β (forward scattering), `ss` (filament smoothing), `hWidth`, warp/weft area, fineness, period:

| preset | tile | α | β | ss | hWidth | warpArea | weftArea | fineness | period |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| DenimWeave | 3×6 | 0.01 | 4.0 | 0.0 | 0.5 | 5.0 | 1.0 | 3.0 | 0 |
| CottonTwill | 4×8 | 0.01 | 4.0 | 0.0 | 0.5 | 6.0 | 2.0 | 4.0 | 0 |
| WoolGabardine | 6×9 | 0.01 | 4.0 | 0.0 | 0.5 | 12.0 | 6.0 | 0.0 | 0 |
| SilkShantung | 6×8 | 0.02 | 1.5 | 0.5 | 0.5 | 8.0 | 16.0 | 0.0 | 500 |
| SilkCharmeuse | 5×10 | 0.02 | 7.3 | 0.5 | 0.5 | 9.0 | 1.0 | 3.0 | 0 |
| Polyester | 2×2 | 0.015 | 4.0 | 0.5 | 0.5 | 1.0 | 1.0 | 0.0 | 50 |

⚠️ Their "DenimWeave" tile is 3 wide × 6 high with roughly 2 warp + 1 weft per row — a *visible
float ratio of 2:1, not 3:1*. **Do not treat Irawan's denim as an authoritative 3/1.**

**Sadeghi et al. 2013 microcylinder parameters (Table II), fitted from their own gonioreflectometer
measurements** — γ in degrees, `a` the thread weight:

| fabric | η | thread | A | k_d | γ_s | γ_v | a | tangent offsets ° |
|---|---:|---|---|---:|---:|---:|---:|---|
| linen, plain | 1.46 | both | (0.2,0.8,1)×0.3 | 0.3 | 12 | 24 | 0.33 | −25, 25 |
| silk crepe de chine | 1.345 | flat | (1,0.95,0.05)×0.12 | 0.2 | 5 | 10 | 0.75 | −35,−35,35,35 |
| | | twisted | (1,0.95,0.05)×0.16 | 0.3 | 18 | 32 | 0.25 | 0, 0 |
| polyester satin charmeuse | 1.539 | flat | (1,0.37,0.3)×0.035 | 0.1 | 2.5 | 5 | 0.9 | −32,−32,−18,0,0,18,32,32 |
| | | twisted | (1,0.37,0.3)×0.2 | 0.7 | 30 | 60 | 0.1 | 0, 0 |
| silk shot | 1.345 | dir 1 | (0.1,1,0.4)×0.2 | 0.1 | 4 | 8 | 0.86 | −25,−25,25,25 |
| | | dir 2 | (1,0,0.1)×0.6 | 0.1 | 5 | 10 | 0.14 | 0, 0 |
| **velvet** | 1.46 | dir 1 | (0.05,0.02,0)×0.3 | 0.1 | 6 | 12 | 0.5 | **−90, −50** |
| | | dir 2 | (0.05,0.02,0)×0.3 | 0.1 | 6 | 12 | 0.5 | **−90,−55,55,90** |

> 🎯 **Velvet is reproduced entirely by setting thread tangents near-perpendicular to the surface
> (−90°).** The whole retroreflective-fuzz look is one parameter. That is the clearest single
> demonstration that fabric appearance is structural rather than sampled.

### 4.5 Where procedural runs out — the honest boundary

| | reachable today? | evidence |
|---|---|---|
| **weave normal / roughness / anisotropy from thread count** | ✅ **yes, for WOVEN cloth** — §4.4, and 9.16's spike recovers the twill angle to 0.0001° from `{weave, ends, picks, tex, gsm}` alone. See the three closer limits below | measured here |

🚩 **THREE LIMITS ARRIVE BEFORE THE ONES IN THIS TABLE, all measured by 9.16's spike.**

1. **It generates NEW cloth and cannot generate OWNED cloth — and the gate's own precision is the
   evidence.** Every yarn is the same diameter, every crimp the same amplitude, the repeat exact to
   floating point, which is *why* the FFT recovers the angle to 0.0001°. Real cloth's spectrum is
   broadened by hairiness, count variation, tension drift, skew, bow and wear. A fabric that returns
   a delta function where a real one returns a smeared peak reads as rendered. Adding white noise is
   **not** the mitigation: at σ 400 µm — larger than a yarn — coherence collapses 0.3954 → 0.0390
   while the angle error stays at 0.012°, i.e. it destroys the appearance statistic and leaves the
   structural one untouched, the opposite of ageing. **Recommendation for 9.19: perturb the LATTICE**
   (per-yarn diameter and tension from a distribution, a slow skew field, correlated hairiness)
   rather than starting from the weathering canon, which §4.5 already records has never been applied
   to garments in a published venue. "How wide should the peak be" is a question a photograph of
   real denim can answer.
2. **Thread count describes the surface for FOUR of the nine named families, not nine.** Denim,
   chino, gabardine and worsted wool are wovens and the model applies. Jersey, piqué and rib are
   *loops* and get a coarser model validated against nothing (§5.3 carries no knit surface
   measurement). Melton and fleece are *napped* — melton is milled until the ground weave is
   mechanically destroyed — and leather is a BRDF with no ends, picks, tex or repeat at all. What is
   generable for the last three is the sheen lobe, not the weave.
3. **Generated fabric THICKNESS is 24–48% too thin** against the F&T 1/2018 control set, and the
   correction it would need varies by **1.47×** across four weaves whose real thicknesses span only
   1.15× — so no single crimp constant fixes it, and the generated *order* is wrong (the 3/1 twill
   generates thinnest and measures thicker than the plain weave). Invisible under a normal map;
   visible under displacement or at a silhouette, which is where a garment edge lives. Reported by
   the spike and deliberately **not gated**, because turning it green means fitting a constant to
   four points and §5.3 calls this the single best calibration target in the document.
| **topstitching** | ✅ **yes, and it is the lowest-risk item on the list.** Seam curves come free from pattern topology; instancing stitch geometry along a curve with jitter is a Geometry Nodes group. ⚠️ **[✗] zero academic papers exist** — nobody wrote it up because it is not hard | — |
| **printed graphics** | ✅ **yes, structurally.** In a sewing-pattern pipeline **your UV space IS your pattern space** — composite artwork onto the flat panel *before* drape and the drape carries it. Seam registration is trivial in pattern space; you would have to *add* misregistration to look real | FabricDiffusion (SA 2024), DressWild — *"projected onto the UV parameterization induced by the sewing patterns, ensuring seam consistency"* |
| **dirt / grime masks** | ✅ **yes.** AO + curvature → mask is documented product behaviour, and every required bake is headless-Blender-native | Substance Dirt generator / Mask Builder docs |
| **pre-creased rest shape** | ✅ **yes, for stills.** Blender's cloth **Rest Shape Key** *"can be used to start the simulation with the cloth in a pre-draped state without applying that shape as a plastic deformation"* | Blender manual, verified |
| **embroidery paths** | ✅ **yes.** Ink/Stitch is **GPL-3.0** with a real CLI — `stitch_plan_preview --needle-points=True` emits SVG needle points to lift into 3D. ⚠️ headless via xvfb is undocumented; prototype in a container | — |
| **hardware placement** | ✅ derivable from pattern edges | — |
| **seam pucker, faked** | 🟡 seam-band stiffness multiplier + tiled pucker normal | — |
| **wrinkle memory** | 🟡 pre-bake into the rest shape; no runtime plasticity | Narain et al. 2013; Gong et al. CGF 2025 — **no code released** |
| **hardware MODELS** (zips, buckles, rivets, eyelets) | ❌ **no academic work.** Bounded, though: ~15 base models is a **one-time** cost | — |
| **physical seam pucker parameters** | ❌ **research-only.** The mapping from (fabric, thread tension, stitch length, seam type) → (band width, stiffness, amplitude) exists only inside FE papers on swatches. Seam-allowance stiffening is **patented** (US10872184B2) and *True Seams* (TOG 2022) released no code | — |
| **contact-driven WEAR** | ❌ **no published method, and this is the real gap** | see below |

🚩 **The three places procedural genuinely runs out, and they are not the obvious ones:**

1. **Contact-driven wear.** AO and curvature are *geometry*-driven. Wear is *use*-driven — knees,
   seat, cuffs, collar folds, pocket mouths. The generic weathering canon exists (Dorsey &
   Hanrahan patinas 1996; γ-ton tracing 2005; Bellini et al. time-varying weathering 2016) and
   **[✗] has never been applied to garments in a published venue.** This is what separates a
   generated jacket from a Nice Pictures jacket, and there is no paper to copy.
2. **Hardware models.** Not placement — models. Compounded by a GarmentCode limitation stated in
   its own paper: *"the simplified definition of a panel does not allow specification of internal
   loops, hence GarmentCode cannot seamlessly represent panels with holes"* — **which blocks
   eyelets, buttonholes and grommets at the pattern level, before hardware is even a question.**
   It also *"cannot model layers of fabric"* and lacks *"elements sewn on top of a fabric piece,
   such as pockets and flounces."* For a reference set that is coveralls, turnout gear and
   tactical jackets, **pockets and hardware are not garnish — they are the garment.**
3. **Physical pucker parameters** (above).

> 🎯 **The verdict on the headline question.** Clothing IS more tractable than a face, and the
> reason is structural: a garment's geometry is derivable from a documented pattern and its
> material is a periodic structure with published parameters, whereas a face's realism lives in
> non-repeating asymmetric detail. §4.4 shows the weave is generable and measurable from thread
> count alone; §4.3 shows a complete MIT pipeline exists and already emits GLB; §4.2 shows the
> drape is seconds at bake time.
>
> **But we do NOT clear the Nice Pictures bar procedurally, and the gap is specific.** It is not
> the cloth — it is the **pockets, the hardware, and the worn-in wear**, and all three are
> exactly what a workwear/tactical reference set is made of. A procedurally generated jacket will
> read as a *clean, correct, empty* jacket.
>
> **The phasing that follows:** procedural gets us a correct garment with real fabric, at zero
> marginal cost per item, across the whole gender axis. Hardware is a **one-time library of ~15
> parametric models** — a bounded art task, not an unbounded one. Wear is the genuinely open
> problem and should be scoped as its own spike with an honest chance of a negative result.
> **That is a materially better position than the face was in**, where the missing content was
> unbounded scan data.

### 4.6 The third-party import path — and why it must stay an import path

**The library must never BUNDLE a licensed garment. It must CONSUME one the user legally
acquired.** That constraint turns out to be not just prudent but the only lawful reading.

#### The Fab licence forbids exactly what we would be building **[V]**

Read from <https://www.fab.com/eula>. Three clauses decide it, and one of them names our use case
almost verbatim:

> §6(b)(iii) — *"allow any third party to incorporate Content into their own products, services,
> or other projects (this means, for example, that you may not make Content available in world- or
> level-editing tools or templates **or other modeling tools that allow works to be exported**)"*

> §4(c) — *"you may … only authorize end users to make use of Content **solely as incorporated in
> the Project in object code** and you **must restrict end users from extracting** or otherwise
> using Content outside of the Project."*

> §4(a) — *"'Distribute' means … to provide or otherwise make a copy of the Project available
> publicly or to any other person or entity or **make the Project's functionality available on a
> network**."*

Also verified: **both price tiers grant identical rights** (§2(a) — *"Both pricing tiers (Personal
and Professional) grant you the same scope of rights"*), so paying the ~$180 Professional tier
buys nothing here; the Professional tier is a revenue threshold ($100,000 USD/12 months), not
extra permissions. And **every Nice Pictures listing sampled carries `isAiForbidden: true`** —
NoAI — which §6(b)(vii) and §16(l)(i) turn into a prohibition on use in or as training input to
generative AI programs.

**[I]** The EULA never says "browser" or "glTF", so there is no clause on point. But a browser
served a raw `.glb` satisfies *neither* limb of §4(c): a GLB is not object code, and the browser
hands the user a downloadable file. **Reading: bundling a Fab garment in this library is not
permitted at either tier.** A custom licence is possible out of band (§7(b)) by contacting the
seller; that is a business conversation, not an engineering one.

🚩 **And what Nice Pictures actually ships is not what we would want anyway.** Verified verbatim
from a listing: the garment is *"Rigged (ALL male and female Metahuman bodies and UE5 Skeleton
Manny and Quinn)"* in the **Unreal project** and in the **Blender 4** file. The `glTF`, `glb`,
`OBJ` and `usdz` deliverables are labelled **"Static Mesh"**, and the listing's format chips read
*"Converted GLB, glTF, and USDZ"* — i.e. **Fab's automatic conversion, not seller-authored, and
unrigged.** The web-native format on the box is the one with the rig removed.

#### Booth is worse, and it has no machine-readable gate **[V]**

Booth's 3D衣装 category holds ~55,650 items shipping **`.unitypackage` + `.prefab`**, with FBX as
raw mesh; a representative listing requires Unity 2022.3.22f1, lilToon and Modular Avatar. The
value is in the prefab graph and the shader setup, both Unity-editor-only, emitting no portable
artefact. **[✗] There is no licence field**: the item JSON's only structured policy flag is
`is_adult`, and the existence of `booth-license-checker`, which works by *text-parsing PDFs out of
product descriptions*, is the proof. The nearest thing to a standard is the **VN3 License**
template (2020, attorney-drafted, PDF generator, 23 conditions A–W) — a template, not a registry.
Typical terms prohibit redistribution near-universally, often require *"appropriate measures to
prevent easy extraction of data"*, and are frequently scoped **to VRChat specifically**. Two of
those are structurally unsatisfiable in a browser.

**[✗] There is no cross-vendor rig or naming convention.** Listings advertising "19アバター対応"
ship **19 separately hand-fitted prefabs**. Shared-base families are marketed as a *feature*, which
is the market telling you generic import across bases does not work.

#### VRM's licence block: yes, honour it programmatically **[V]**

VRM is glTF 2.0 in both generations, and the licence metadata is typed, enumerated and defaulted —
trivially enforceable.

| | VRM 0.x `VRM.meta` | VRM 1.0 `VRMC_vrm.meta` |
|---|---|---|
| usage fields | `violentUssageName`, `sexualUssageName`, `commercialUssageName` — 🚩 **the "Ussage" misspelling is real and is in the schema** | `allowExcessivelyViolentUsage`, `commercialUsage`, … — **spelled correctly** |
| who may use | `allowedUserName` ∈ `OnlyAuthor \| ExplicitlyLicensedPerson \| Everyone` | `avatarPermission` ∈ `onlyAuthor \| onlySeparatelyLicensedPerson \| everyone` (default `onlyAuthor`) |
| commercial | `commercialUssageName` | `commercialUsage` ∈ `personalNonProfit \| personalProfit \| corporation` (default `personalNonProfit`) |
| modification | — | `modification` ∈ `prohibited \| allowModification \| allowModificationRedistribution` (default `prohibited`) |
| credit | — | `creditNotation` ∈ `required \| unnecessary` (default `required`) |
| licence | `licenseName` (9-value enum incl. `Redistribution_Prohibited`, `CC0`, …), `otherLicenseUrl` | `licenseUrl`, **required**, must point at `https://vrm.dev/licenses/1.0/` |
| required fields | **none** — an empty meta block is legal | `name`, `authors`, `licenseUrl` |

> 🎯 **For VRM 1.0 the metadata is not advisory — it IS the licence.** The VRM Public License 1.0
> states that the *"License Setting constitutes, together with this Public License, the terms and
> conditions of the license"*, and 1.0 requires `licenseUrl` to point at it. A conformant file's
> meta block is the operative instrument. **Honour it, and default to most-restrictive** — on 0.x
> (where every field is optional), on any unmapped 0.x↔1.0 value, and on a missing block.
>
> ⚠️ No Consortium text imposes an enforcement *duty* on applications; obligations are worded at
> users. Enforcing is a defensible policy choice we are making, not a spec requirement. Say that
> in the code.

**But VRM buys nothing for garment transfer.** Its 55 humanoid bones (15 required) are a *mapping*
onto arbitrary glTF nodes and cover the humanoid skeleton only. Garments skin to skirt bones,
ribbon chains and spring-bone chains that nothing normalises.

### 4.7 Retargeting a MetaHuman garment onto our rig: hard, and mostly for a reason that is not the skeleton

#### Our rig, measured from our own GLB **[X]**

```
skin joints: 53
Root pelvis spine_01 spine_02 spine_03 neck_01 head
clavicle_l/r upperarm_l/r lowerarm_l/r hand_l/r
{thumb,index,middle,ring,pinky}_{01,02,03}_{l,r}
thigh_l/r calf_l/r foot_l/r ball_l/r
```

🎯 **MPFB's `game_engine` rig is already Unreal-named.** Independently corroborated by counting
the keys of MPFB2's shipped `rig.game_engine.json`: **exactly 53 bones**, same set. (Note for
anyone carrying the older belief: `clavicle.L` / `upperarm01.L` / `spine01` belong to MakeHuman's
**default** rig, a different 163-bone skeleton. Not ours.)

Structural gaps against UE5's Manny:

| | ours (`game_engine`) | UE5 Manny |
|---|---|---|
| root | `Root` — 🚩 **capital R**, and **0 weighted vertices** (counted in MPFB's `weights.game_engine.json`; `pelvis` has 2,322, `head` 5,757) | `root` |
| spine | `spine_01..03` | `spine_01..05` |
| neck | `neck_01` | `neck_01`, `neck_02` |
| twist bones | **none** | 8 |
| IK bones | **none** | 6 |
| metacarpals | **none** (folded into `hand_*`) | 8 |
| toes | **none** (folded into `ball_*`) | — |

The merges are explicit in MakeHuman's own `.mhskel` reference table:
`upperarm_l ← [upperarm01.L, upperarm02.L]`, `neck_01 ← [neck01, neck02, neck03]`,
`ball_l ← ` all 15 `toe*.L`. **The twist bones were deliberately collapsed, not forgotten.**

⚠️ Bone counts on the UE side are **single-source** (a Reallusion Live Link manual: UE4 68,
UE5 89, MetaHuman 342, CC3+ 108) and **[✗] Epic publishes neither number**. The commonly cited
"700–800 MetaHuman facial joints" is third-party and unverified.
⚠️ And **our own `Root` transform depends on MPFB's age**: MPFB2 changed `Root`'s position and
roll in commit `cba2a82e` (2024-11-01, issue #215).

#### The state of the art, and why it does not reach

**"Robust Skin Weights Transfer via Weight Inpainting"** — Abdrashitov, Raichstat, Monsen, Hill,
**all four at Epic Games**, SIGGRAPH Asia 2023 Technical Communications,
[10.1145/3610543.3626180](https://dl.acm.org/doi/10.1145/3610543.3626180). Real, shipped, and
open: reference code MIT at <https://github.com/rin-23/RobustSkinWeightsTransferCode>, plus a
Blender addon and a Godot port. It ships in Unreal as the Chaos Cloth `TransferSkinWeights`
Dataflow node with `InpaintWeights` as the default method.

Method, verbatim specifics: stage 1 accepts a closest-point match only if distance
< **0.05 × d_bbox** and normal deviation < **35°**; stage 2 inpaints the rest by minimising a
combined Dirichlet + Laplacian energy, `Q = −L + L M⁻¹ L`, per bone column, by Cholesky.
Non-negativity is not constrained — measured weights went no lower than **−0.03**, so they clamp
and renormalise. (⚠️ Unreal's shipped `NormalThreshold` default is **30°**, not the paper's 35°.
Both confirmed, no rationale published.)

🚩 **But its own §3 says: *"We assume that two meshes are aligned."*** It solves *shape* mismatch
on a **shared, aligned skeleton**. Ours is a different skeleton and a different body. Its §5 also
lists no interpenetration guarantee and an assumption that all clothing parts are connected —
which disconnected panels and buttons violate.

🚩 **Blender's `data_transfer` fails SILENTLY at exactly our case.** Three documented facts chain:
the operator's `use_create=True` default *creates* vertex groups named after the **source**
skeleton's bones; the Armature modifier binds strictly by name (*"bones of a given name will
deform vertices which belong to vertex groups of the same name"*); and Blender has **no bone-name
remapping in data transfer at all**. Net: the transfer reports success, writes correctly-shaped
weights under wrong names, and the garment does not move. Blender 4.x/5.x "Transfer Weights" is a
thin wrapper over the same operator, not a new algorithm.

Tool triage: **Rokoko is animation-only** (mocap + animation retarget, no skin weights).
**Auto-Rig Pro has no proprietary transfer** — its docs tell you to use Blender's data transfer —
though it does have from-scratch binders. **Maya's `Copy Skin Weights`** is the only tool
documented for this exact case (`UV space` surface association, *"when the skinned characters vary
widely in scale or proportion"*, plus a Label → Name → Closest-joint influence cascade) and it is
not in our pipeline.

🚩 **[✗] Nobody has published the proportion-mismatch error measurement.** The one paper directly
on garment weight transfer **reports no metrics at all** — its Results section is figure
comparisons. The nearest anchors measure different things: HeterSkinNet (arXiv 2103.10602, Table 3)
measures weight *prediction* (L1 0.3269 vs Maya GeoVoxel's 0.6057), and TailorNet
(arXiv 2003.04583) measures garment *drape* across body shapes on a shared SMPL skeleton
(**8.04 mm average, 14.50 mm max for loose fit, 6.56 mm for fitted**). **[I]** The gap exists
because graphics assumes a shared skeleton and vision uses SMPL where the skeleton derives from
shape, so mismatch never arises. Our case falls between two literatures.

🚩 **And a web-specific ceiling that bites before any of that.** glTF 2.0 permits >4 influences via
`JOINTS_1`/`WEIGHTS_1`, but **three.js hard-caps at 4 and silently drops the rest** —
[three.js#26137, still open](https://github.com/mrdoob/three.js/issues/26137): *"When a loader
sees more than 4 it arbitrarily removes some of them and emits a warning."* MetaHuman-class
garments routinely exceed 4.

#### 🎯 The recommendation, and it inverts the problem

> **Do not retarget skin weights. Discard them, and re-bind.**
>
> That is not a workaround, it is **what our pipeline already does**. A MakeHuman garment *is not a
> skinned mesh*: the `.mhclo` positions each garment vertex by barycentric coordinates on a
> base-mesh triangle plus an offset, and MPFB interpolates the weights from the body at import
> (`ClothesService.set_up_rigging`, which `build_figure.py` already calls). **In our model the
> skeleton is irrelevant to the asset.** Measured: 2,197 of 2,197 suit vertices weighted, 0
> strays, and §1.3 shows the result is pose-correct to 1.1 percentage points across a 120°
> shoulder raise.
>
> So the import path is: **take the foreign garment as GEOMETRY ONLY** — positions, normals, UVs,
> textures — fit it to our body, and generate weights from our own body the way we already do for
> the CC0 garments. Proportion mismatch stops being a weight problem and becomes a *fitting*
> problem, which §4(a) is about solving anyway.
>
> **Is it worth supporting? Yes, but as 9.13 and last.** The engineering is genuinely modest once
> framed this way. The blocker is not technical — it is that the two asset sources the user named
> both forbid redistribution, so the import path can only ever serve a user's own local files. It
> is a feature for one user at a time, not a catalogue. Build our own garments first.
>
> **What would change my mind:** a creator granting a redistribution licence out of band (Fab
> §7(b) allows it), or Epic's June 2025 change — MetaHuman content is no longer engine-locked
> (*"MetaHumans can be used with any engine or creative software"*) — being followed by a Fab
> licence tier that permits asset-library inclusion. Neither exists today.

⚠️ Unit and axis mismatch, for whoever writes the importer: UE is **centimetres, X-forward,
Z-up**; glTF is **metres, +Y up, +Z front**; MPFB/Blender is Z-up metres at default scale 0.1.
Three conversions, all silent if wrong.

---

## 5. Fabric taxonomy

Punch-list 3.7 currently reads *"latex/PVC clearcoat, satin, sheen for shearling"*. That is three
families named in a phrase. This section turns it into a table with numbers, a decision per family
about whether it needs simulation, and an honest note where a number is authored rather than
measured.

### 5.1 The anchors this project already owns **[M]**

From `research/stellar-blade-look-spec.md` §4 — measured, in-repo, and not to be re-derived:

| material | roughness | notes |
|---|---|---|
| black suit panels (latex/PVC) | **0.12–0.22** | tight primary highlight **plus** broad secondary sheen → **clearcoat 0.4–0.7, cc roughness 0.15–0.25** |
| white/cream panels (satin/coated) | **0.30–0.40** | broad soft highlight, no glints, **not matte** |
| flesh-toned "skinsuit" | **0.38–0.48** | deliberately fabric-over-skin so the two reflect differently — **[V]** the designer says that contrast *is* the design |
| metal hardware | **0.15–0.35** | **anisotropic** on cylindrical parts, metalness 1.0 |
| leather / shearling | **0.55–0.70** | shearling reads as a **sheen/fuzz lobe**, not diffuse |

> *"Everything is wet-adjacent. There are no true Lambertian surfaces on the character."*

⚠️ **These are back-solved from compressed JPEGs of one game, not read from an engine.** They are
the right *target* for the look and the wrong thing to call physics. The new reference — real
workwear, turnout gear, tactical, hazmat, puffers, field jackets — is a broader material set than
a stylised bodysuit, and needs the physical vocabulary in §5.3, not just these five rows.

### 5.2 The simulate / spring-bone / nothing decision, settled by measurement **[X]**

§4.2 measured a garment-density cloth drape at **10.8–59.7 ms per frame** against a **16.6 ms
whole-frame budget**. So:

| tier | what it is | when |
|---|---|---|
| **nothing** | skinned to the body rig, no secondary motion | fitted garments — measured pose-invariant to **1.10 pp** across a 120° shoulder raise (§1.3) |
| **spring bones (6.6)** | VRM algorithm, fixed 60 Hz timestep, depth-distribution curves | hems, coat tails, skirts, straps, hoods, webbing. Start `stiffness 0.75 / drag 0.05 / gravity 0`; §6.8 already separates **hair drag 0.4** (over-damped drape) from **tissue 0.05** (fast ring) — cloth sits between |
| **simulation** | Blender cloth, **bake time only** | pattern-to-garment (§4.3), rest-pose drape, and baking a wrinkle normal map. **Never at runtime.** |

🎯 **The knee is where this budget should go.** §1.3: every upper-body pose moves poke-through by
≤ 1.10 pp and the worst depth by −0.016 mm; hips 70° / knees −90° takes the worst depth
**9.190 → 14.988 mm**. Spend on knees, hems and loose panels; spend nothing on a fitted torso.

### 5.3 Physical parameters per fabric family

#### The one controlled dataset worth calibrating against **[V]**

*Analysis of a Fabric Drape Profile*, **Fibres and Textiles 1/2018**, open access
(`vat.ft.tul.cz/2018/1/VaT_2018_1_6.pdf`) — 37 fabrics with tex, threads/cm, GSM, thickness, crimp,
weave **and** matched Cusick drape coefficient, all measured.

🎯 **Its weave-only comparison is the single best calibration target in this whole document**, because
the yarns are held identical (50/50 PES/Co, warp 36.9 tex, weft 28.27 tex) and only the weave changes:

| weave | ends/cm | picks/cm | g/m² | thickness mm | **drape coeff %** |
|---|---:|---:|---:|---:|---:|
| plain | 46 | 20 | 221.46 | 0.48 | **80.35** |
| twill 2/2 | 45 | 27 | 248.11 | 0.53 | **85.15** |
| **twill 3/1** | 45 | 26.5 | 248.93 | 0.50 | **79.81** |
| panama 3/1 | 44 | 27 | 241.76 | 0.60 | **76.63** |
| weft rib 2/2 | 46 | 22 | 231.31 | 0.46 | **89.00** |
| cross twill | 46 | 26 | 245.90 | 0.53 | **78.60** |

Density sweep on one cotton plain weave (warp 18.52 tex / weft 23.5 tex) — **drape coefficient
rises 48.06 → 71.87% as picks/cm goes 18.5 → 32**, i.e. **thread count alone moves drape by 24
points.** Five-thread satin: 185.65–303.95 g/m², DC 43.00–69.70%. Cotton twill 4/1 DC 58.07%,
twill 3/2 64.05%, five-thread satin 61.75%, warp rib 4/1 63.53%. Fold counts 5–8 throughout.

🚩 **Store drape coefficient as a triple: `(value, specimen diameter, method)`.** ISO 9073-9:2008
allows 24 / 30 / 36 cm specimens on an 18 cm disc and states that results at different diameters
*"are not directly comparable"*; methods A (paper rings weighed) and B (image processing) are also
not interchangeable. A bare percentage is not portable. (⚠️ **[✗] ISO 9073-9's current status could
not be confirmed** — iso.org refused access. And BS 5058:1973 is **still Current**, not withdrawn.)

#### The taxonomy, with numbers

Roughness/clearcoat/sheen columns are the project's own **[M]** anchors from the look spec where
one exists, and **[I]** extrapolation from the material class where it does not — marked.
Simulation column is settled by §5.2.

| family | weave / structure | thread count | GSM | drape coeff % | roughness | extra lobe | secondary motion |
|---|---|---|---:|---:|---|---|---|
| **denim** | **3/1 RH (Z) twill** above ~10.5 oz/yd²; **2/1 twill** below (coveralls, chore coats, 5–11 oz); broken twill as a variant | 57→**75 finished** ends/in, 45–50 picks/in **[V]**, warp Ne 7.5–9.13, weft Ne 11.25–14 | 331–390 | ⚠️ **[✗] none published, anywhere** | 0.55–0.75 **[I]** | anisotropy along the twill line | hem/cuff spring bones |
| **cotton twill / chino** | 2/1 or 3/1 twill | 45 ends/cm, 26.5 picks/cm | 249 | **79.81** | 0.60–0.75 **[I]** | mild anisotropy | none if fitted |
| **poplin / shirting** | plain | ⚠️ vendor-only: 100–144 × 60–76 /in; benchmark `45×45 / 133×72`. Cross-check the measured plain wovens: 93–95 EPI, 47–81 PPI | 60–163 | **48–80** | 0.45–0.60 **[I]** | slight sheen | collar/cuff only |
| **wool suiting / gabardine** | 2/2 twill | 45 × 27 /cm | 248 | **85.15** | 0.55–0.70 **[M]** (look spec leather/shearling band) | **sheen** (Irawan `WoolGabardine` 6×9, warpArea 12, weftArea 6) | drape at hem |
| **satin / silk** | 4/1 or 5/1, warp-faced | 40–46 × 30–36 /cm | 186–304 | **43.0–69.7** | **0.30–0.40** **[M]** | strong **anisotropy**; Sadeghi charmeuse γ_s 2.5 / γ_v 5 | ✅ real spring bones |
| **knit jersey** | single jersey, 20–27 wales/cm, 14–20 courses/cm | weft 29.5–66 tex | **96.8 / 146.7 / 208.8** | **18–31** ⚠️ *(25 cm specimen, not Cusick)* | 0.65–0.80 **[I]** | soft sheen | clings; little |
| **latex / PVC / coated** | film, not woven | — | — | — | **0.12–0.22** **[M]** | **clearcoat 0.4–0.7, cc roughness 0.15–0.25** **[M]**; coat IOR **1.5** (Filament fixes it *"to be representative of polyurethane"*); a measured multilayer PVC used a 20 µm acrylic coat at n = **1.55** | stiff, minimal |
| **leather** | — | — | — | faux leather **67.22** | **0.55–0.70** **[M]** | clearcoat for patent | Blender preset: bending **150**, 3000× silk |
| **shearling / velvet / fleece** | pile | — | — | — | 0.70–0.90 **[I]** | 🎯 **sheen — and the trick is geometric**: Sadeghi reproduces velvet purely with thread tangents at **−90°** | fuzz reads at silhouette |
| **ripstop / technical nylon** | plain ground + thicker grid threads at **5–8 mm** (20D ≈ 3 mm) ⚠️ **all vendor sources, [✗] no standard found** | 20–70D ultralight, 150–400D packs, 1000D heavy; 20D ≈ 28–40 g/m² | 28–200 | — | 0.35–0.55 **[I]** | clearcoat if coated; the grid is a **normal-map** feature | ✅ light and mobile |

**Yarn diameter from count — the formula, and a published error to avoid.** Peirce (1937) gives
`d (inch) = 1 / (28·√Ne)` from cotton specific volume 1.1 cm³/g. The unit-safe form:

```
d (µm) = 37.42 · √tex   ⟺   d (µm) = 908.8 / √Ne   ⟺   d (µm) = 12.47 · √denier
```

Cross-checked three ways: 908.8 µm = 1/27.95 inch ≈ Peirce's 1/28; Ashenhurst's cotton constant
gives 1/(27.53·√Ne), within **1.7%**. 🚩 **A widely-copied web source states `d(mm) = 0.0037·√tex`,
which is wrong by 10×** — 0.0037 is the centimetre coefficient; the mm form is 0.0374·√tex.
Worked values: denim warp Ne 9.13 → **301 µm**; denim weft Ne 14 → **243 µm**; jersey Ne 30 →
**166 µm**; poplin Ne 45 → **135 µm**. ⚠️ Cotton-specific — substitute the polymer's specific
volume for polyester/nylon filament rather than reusing 908.8.

**Unit conversion, exact:** **1 oz/yd² = 33.906 g/m²** (28.349523125 g ÷ 0.83612736 m²). ⚠️ Weight
bands are trade conventions and **published sources disagree** (light <9 vs <12 oz). Expose oz and
thread density independently; do not bake a band into the API.

#### Simulation stiffness — real measured values, and the biggest licence trap in this document

Wang, O'Brien & Ramamoorthi, *Data-Driven Elastic Models for Cloth*, SIGGRAPH 2011 — **10 measured
fabrics**, 24 stretching parameters (c₁₁, c₁₂, c₂₂, c₃₃ at six bias angles) + 15 bending
parameters. Areal densities: 11oz Black Denim **0.324 kg/m²**, Camel Ponte Roma 0.284, Ivory Rib
Knit 0.276, Gray Interlock 0.187, White Swim Solid 0.204, Tango Red Jet Set 0.113, White Dots on
Black 0.128. Shipped machine-readable in ARCSim's `materials/*.json`.

🎯 **The signal worth reproducing procedurally, which is free of the licence problem because it is
a ratio rather than a table:** denim's **c₂₂/c₁₁ ≈ 4.6:1 and near-constant across bias angle**,
while Gray Interlock's swings **2.1 → 5.6**. **Woven stiffness is stiff and flatly anisotropic;
knit is soft and bias-dependent.** That is a rule an engine can implement from the weave type.

> 🚩🚩 **DO NOT SHIP THE WANG VALUES.** The data licence reads: *"Any persons using these data or
> images for purposes other than scholarly publication shall notify the authors of such use…
> **Any other use requires specific prior written permission.**"* ARCSim compounds it —
> *"educational, research, and not-for-profit purposes"* only, commercial licensing via UC
> Berkeley's Office of Technology Licensing. **This is the same shape as the NRC-VAD landmine and
> it must be logged the same way.** Use them to calibrate a procedural model; ship the model, not
> the table. Blender's five presets (§4.1) are unencumbered and are the shippable fallback.

⚠️ **[✗] No public bulk KES-F dataset exists.** Searched Zenodo, Figshare, Mendeley Data, GitHub
and the literature: what exists is per-paper tables of a handful of fabrics inside PDFs, and the
Kawabata standard control charts are in two out-of-print Japanese volumes. Units, at least, are
settled by IEEE SA's *Measurement of Fabric Properties for Virtual Simulation* (2020): bending
rigidity **B in gf·cm²/cm**, shear stiffness **G in gf/(cm·degree)**, SMD in µm, specimen 30×30 cm
at 20 °C / 65% RH — and *"in 8 hours, 6–10 fabrics can be tested"*, which is why the data is
scarce. FAST is the cheaper instrument and gives **G (N/m) = 123 / EB5**.

#### Runtime: what glTF and three.js will actually carry **[V]**

Blender's glTF exporter emits `KHR_materials_sheen`, `KHR_materials_anisotropy`,
`KHR_materials_clearcoat`, `KHR_materials_specular`, `KHR_materials_ior`,
`KHR_materials_transmission`, `KHR_materials_volume`, `KHR_materials_variants` and
`KHR_texture_transform`. **Every lobe in the taxonomy above has a transport.**

🚩 **Two export traps, both documented and both silent:**
- **Sheen.** Khronos, verbatim: *"the model used by Blender for sheen in BSDF is not compatible
  with the model used by glTF files."* You must attach a dedicated **Sheen BSDF** node — *"only
  available on Cycles render engine. You may have to temporarily switch to Cycles to add this
  node."* And *"if a Sheen Roughness Texture is used, glTF requires the values be written to the
  alpha (A) channel."*
- **Anisotropy.** The tangent socket must link to a tangent node using the **same UVMap as the
  normal map**, or the direction is wrong without an error.

Reference defaults: Autodesk Standard Surface `sheen` 0.8, `sheen_roughness` 0.3,
`coat_roughness` 0.1, `coat_IOR` 1.5, `specular_roughness` 0.2. Disney's sheen lobe is
`sheen · (1 − cos θ_d)⁵`, optionally tinted toward base colour — *"the predominant effect missing
from the base diffuse + specular model is the extra grazing reflectance"* on fabric.

🚩 **`KHR_materials_variants` is worth a second look for the wardrobe.** It is the glTF-native way
to carry alternative materials on one mesh, and it is a candidate for garment *colourways* — one
geometry, N palettes — which is directly useful to §6's colour selection. Not evaluated here.

---

## 6. Mood and season selection

The brief asks for a mapping from `{PAD, season, formality, time of day}` to a garment choice,
grounded in something real. **Exactly one of those four inputs has a real, standards-backed
mapping. One has a usable-but-damaged equation set. Two have nothing and must be authored.** Say
so in the code, the way `research/affect-and-animation.md` says it about NRC-VAD.

### 6.1 🎯 Season is not a vibe. It is a published equation over a standardised unit. **[V]**

**Do not implement a four-season enum.** Implement clothing insulation.

1 clo = 0.155 m²·K/W (ANSI/ASHRAE 55 Normative Appendix B, `ICL = .155 * CLO`).

Schiavon & Lee (2013), *Building and Environment* 59, 250–260,
[10.1016/j.buildenv.2012.08.024](https://doi.org/10.1016/j.buildenv.2012.08.024), derived from
**6,333 field observations** in ASHRAE RP-884 and RP-921 and **adopted into ASHRAE 55 as Figure
5.2.2.2**, with `t` = outdoor air temperature at 06:00 in °C:

```
t <  -5 °C          Icl = 1.00
-5 ≤ t <  5 °C      Icl = 0.818 − 0.0364·t
 5 ≤ t < 26 °C      Icl = 10^(−0.1635 − 0.0066·t)
t ≥  26 °C          Icl = 0.46
```

Continuous at every breakpoint (checked: t=−5 → 1.000; t=5 → 0.636 both branches; t=26 → 0.462).
Open CC-BY companion: <https://escholarship.org/uc/item/3sx6n876>.

Then solve for an ensemble whose per-garment clo values sum to the target. ASHRAE 55-2013 Table
5.2.2.2B, **additive by §5.2.2.2(c)** — a usable subset:

| garment | clo | | garment | clo |
|---|---:|---|---|---:|
| T-shirt | 0.08 | | long-sleeve sweater, thin | 0.25 |
| shoes | 0.02 | | long-sleeve sweater, thick | 0.36 |
| boots | 0.10 | | suit jacket, single-breasted, thin | 0.36 |
| walking shorts | 0.08 | | suit jacket, single-breasted, thick | 0.44 |
| trousers, thin | 0.15 | | sweatshirt, long-sleeve | 0.34 |
| trousers, thick | 0.24 | | sweatpants | 0.28 |
| short-sleeve knit sport shirt | 0.17 | | overalls | 0.30 |
| long-sleeve dress shirt | 0.25 | | coveralls | 0.49 |
| long-sleeve flannel shirt | 0.34 | | insulated coveralls ensemble | 1.37 |

Ensembles for calibration (Table 5.2.2.2A): walking shorts + short-sleeve **0.36**; trousers +
short-sleeve **0.57**; trousers + long-sleeve **0.61**; + suit jacket **0.96**; + sweater **1.01**.
ASHRAE's own comfort zones are drawn at **0.5 and 1.0 clo** — so the folk "summer 0.5, winter 1.0"
is right, and now it has a citation and a continuous interpolant between them.

Seated adjustment: standard office chair **+0.10**, executive chair **+0.15** (Table 5.2.2.2C).
Moving occupant: `Icl,active = Icl × (0.6 + 0.4/M)` for 1.2 < M < 2.0 met.

⚠️ **ASHRAE 55 is an indoor standard and has no coat or overcoat entry**; it excludes occupants
above 1.5 clo. Outerwear needs ISO 9920, which is paywalled and **[✗] was not obtained** — do not
accept an "ISO 9920 says…" number without the standard in hand.

⚠️ Also note ASHRAE 55 Normative Appendix B reproduces **ISO 7730 Annex D's complete PMV-PPD BASIC
source with ISO's permission**, so the Fanger model is implementable from a freely readable
document. We probably do not need it — Equation 3 above already goes straight from temperature to
clo — but it is there if the avatar is ever placed in a described room.

> **This is the strongest thing in the whole selection design.** It is objective, continuous,
> standards-backed, and it replaces a four-bucket enum with a real number the wardrobe manifest
> can carry per garment. **Every garment we author gets a `clo` field.**

### 6.2 Colour and affect — one usable equation set, with a sign that must be flipped **[V]**

Valdez & Mehrabian (1994), *JEP: General* 123(4), 394–409,
[10.1037/0096-3445.123.4.394](https://doi.org/10.1037/0096-3445.123.4.394). Standardised
regression on Munsell brightness (B) and saturation (S) — **the only published colour→PAD mapping
found**:

```
Pleasure  =  0.69·B + 0.22·S
Arousal   = −0.31·B + 0.60·S
Dominance = −0.76·B + 0.32·S
```

🚩 **Three corrections you must carry, or you will ship a wrong sign.**

1. **The arousal brightness coefficient is contradicted by the best replication.** Wilms &
   Oberfeld (2018), *Psychological Research* 82, 896–914,
   [10.1007/s00426-017-0880-8](https://doi.org/10.1007/s00426-017-0880-8), N = 62, calibrated LED
   panel, CIE LCh stimuli, SCR + ECG: arousal **increased** with brightness,
   F(2,60) = 25.46, p < .001, **ηp² = 0.459**, dz 0.66–0.91. V&M have it negative.
   **Flip it to positive and record that you did.**
2. **Hue barely matters for pleasure.** In the same study hue's main effect on valence
   **failed significance** — F(2,60) = 3.13, **p = .051**, ηp² = .094 — once saturation and
   brightness were controlled. Saturation ηp² = 0.343, brightness ηp² = 0.491 on valence;
   saturation ηp² = **0.693** on arousal. **Build the map on saturation and brightness. Treat hue
   as a small arousal-only modifier** (blue < green < red, which did hold).
   Valence was also highest at **medium** saturation (M = 5.82) over high (5.52) and low (5.16) —
   non-monotonic, unlike V&M.
3. **The Dominance equation has never been replicated.** Wilms & Oberfeld measured valence and
   arousal only. V&M's D carries the largest coefficient in the whole set (−0.76·B) and has zero
   independent support. **Author the D axis and mark it authored.**

⚠️ **[✗] V&M's R², F values and effect sizes could not be obtained** — the full text is paywalled
and the abstract says only "strong and consistent". Do not quote a magnitude for V&M.

⚠️ These are **standardised** coefficients. Z-score B and S against the palette's own range before
applying them, or the magnitudes are meaningless.

**Cross-cultural evidence, and why it does not do what you want.** Jonauskaite et al. (2020),
*Psychological Science* 31(10), 1245–1260,
[10.1177/0956797620948810](https://doi.org/10.1177/0956797620948810), 4,598 participants,
30 nations: mean cross-national pattern similarity **r = .88**. Genuinely strong — **but
participants rated 12 colour TERMS, not colour patches.** It is a study of the semantics of the
word "red". You cannot derive a hex→PAD lookup from it. It also found nation predicted
associations *above* the universal pattern, with similarity tracking linguistic and geographic
proximity — "universal core plus a real cultural residual", not one mapping for everyone.

### 6.3 🚩 Licensing — the good news, and the landmine that stays live

| resource | licence | verdict |
|---|---|---|
| **Valdez & Mehrabian equations** | three lines of published mathematics, not a dataset | ✅ **implement and cite.** Implementing a regression equation is not redistributing a work |
| **Jonauskaite colour-emotion datasets** — [osf.io/468g9](https://osf.io/468g9/), [osf.io/2w6gh](https://osf.io/2w6gh/), [osf.io/g5srf](https://osf.io/g5srf/) | **CC-BY 4.0**, verified via the OSF API licence field rather than the landing page | ✅ shippable with attribution |
| **ASHRAE 55 clo tables** | numerical facts from a public standard | ✅ cite the standard |
| **NRC-VAD v2.1** | *"non-commercial research and educational purposes"* + **"Do not redistribute the data"** | 🚩 **still blocked, and worse than logged** — the no-redistribution clause bites even inside a compiled artefact |
| ISO 9920 garment database | paid ISO standard | ⚠️ **[✗] not obtained.** Do not accept second-hand numbers |

> 🎯 **The V&M route is legally clean precisely because it is an equation and not a table.** That
> is the shape of the answer to the NRC-VAD problem generally: prefer published *models* over
> published *data*.

### 6.4 Mood → garment: the literature does not support this, and we should say so

- **Enclothed cognition points the wrong way and failed its key replication.** Adam & Galinsky
  (2012), *JESP* 48(4), 918–925 — Exp 1 **N = 58**, headline interaction **p = .02, ηp² = .09**,
  critical simple effect **p = .04, ηp² = .07**. Burns et al. (2019), *JESP* 83, 150–156, a
  **preregistered direct replication with ~10× the data, found no effect**, and demonstrated
  sensitivity to effects as small as 7 ms so the null is not underpowering. Adam & Galinsky's own
  reply concedes the replication was competently run. Horton, Adam & Galinsky (2025), *PSPB*
  51(2), 203–221, meta-analyse 105 effects / 40 studies / N = 3,789 and conclude the pre-2015
  literature is doubtful while post-2015 work has evidential value — **note two of three authors
  are the original authors**, and **[✗] the actual meta-analytic effect size is paywalled and was
  not verified.** In any case this is *clothing → cognition*; we need the reverse arrow.
- **Choosing clothes by mood: one small real study.** Moody & Sinha (2010), *JFMM* 14(1), 161–179,
  **N = 27**, all female, all one dress size, one campus, PANAS + NEO-FFI with real wearer trials.
  Of 8 outfits, **3 showed a significant positive-mood correlation and 2 a significant negative
  one; the rest were null.** Exploratory, and the authors say so.
- 🚩 **Pine's "Mind What You Wear" is a press release and a self-published book, not a paper.**
  The widely-quoted numbers (N = 100; 51% wear jeans when sad vs 33% when happy; 57% a baggy top
  when depressed vs 2% when happy) are retrospective self-report with no control and no
  statistics beyond percentages. **Do not cite it as science.** Use the direction — low mood
  → looser, less structured, less saturated — as an authored hypothesis and label it one.
- **[✗] Formality by time of day does not exist.** No validated garment-formality scale, no
  published mapping. Menswear convention is internally coherent and empirically ungrounded.
- **Colour seasonality: one strong result, and one piece of folklore.** Chu, Wang & Liu (2025),
  *J. Retailing & Consumer Services* 82, 104154,
  [10.1016/j.jretconser.2024.104154](https://doi.org/10.1016/j.jretconser.2024.104154) —
  **3,184,162 transactions across 99 Italian fashion stores** matched to weather: higher
  temperature → **cooler** colours, higher humidity → cooler, higher wind → warmer. Revealed
  preference at a scale nothing else here approaches. ⚠️ **[✗] paywalled; magnitudes not
  obtained** — use the direction only. The four-season / twelve-season colour-analysis palette
  taxonomy is **[✗] commercial styling doctrine with no empirical basis found**; ship it as a
  labelled style preset or not at all.

### 6.5 The recommended selection design

Two layers, and the boundary between them is the point.

**Layer 1 — derived, cited, objective.**
```
season      →  Icl_target = schiavonLee(outdoorTemperatureAt0600)      [ASHRAE 55 / Schiavon & Lee]
ensemble    →  choose garments whose manifest clo values sum to Icl_target ± tolerance
colour temp →  warmer/cooler shift with temperature and humidity        [Chu et al. 2025, direction only]
PAD → colour → brightness and saturation via Valdez & Mehrabian, arousal-brightness sign FLIPPED
               hue as a small arousal modifier only; dominance AUTHORED
```

**Layer 2 — authored, and declared authored in the code.**
```
PAD → silhouette   (looseness, structure, coverage)
formality ladder   (5 points, from menswear convention)
time of day        (sleepwear / casual / work / evening bands)
palette presets    (the four-season palettes, if wanted at all)
```

> **A well-designed rule set that says it is authored beats a fake citation.** Put the citation in
> the docstring where there is one, and put the words "this is authored; no literature supports
> it" where there is not. That is the same discipline
> `research/affect-and-animation.md` applied to NRC-VAD, and it is why that file is trusted.

⚠️ **One thing to be careful of that is our own doing, not the literature's.** The PAD vector is a
live signal that changes on a timescale of seconds (5.1: attack 150–250 ms, decay 1.5–3 s). An
avatar that re-dresses every time its mood moves is a strobe light. **Outfit selection must be
gated by a hysteresis far slower than affect** — the mood layer (10 min change, 20 min return) is
the right clock, not the affect layer. That is an architectural constraint the literature will
never tell you and a judge will notice immediately.

---

## 7. Dependencies, what this unblocks, and the phase

### 7.1 What must exist first

| dependency | state | why it blocks |
|---|---|---|
| **3.7 `FabricMaterial`** | **not built** | §3.6(b) measured what a garment ships with today: one scalar roughness, no sheen, no anisotropy, no clearcoat, no AO. A photoreal garment is 90% material. **Hard prerequisite.** |
| **6.6 `SpringBones`** | **not built** | §1.3 measured the knee taking worst poke-through from 9.19 → 14.99 mm under flexion. Coats, skirts and long hems need secondary motion or they read as painted armour. **Hard prerequisite for loose garments; soft for fitted ones.** |
| 6.7 collider pruning | not built | follows 6.6 immediately — VRoid ships 460–1362 checks/frame; a garment adds colliders |
| 3.10 GTAO + bent normals | not built | §3.6(a): we are already discarding hand-baked AO. Cloth without occlusion in the folds is the plastic look |
| 6.1 `MotionStack` / 6.5 IK | not built | not blocking; a garment is skinned by the same rig |

**Neither hard prerequisite is built.** That is the honest headline for phase sizing: the wardrobe
is not a small phase, because the two things that make a garment look like cloth do not exist yet.
What §1–§3 establish is that the *plumbing* is a small phase — a day, not a week — and the
*appearance* is the large one.

### 7.2 What this unblocks — and the hair coupling nobody has drawn yet

🎯 **The 10 CC0 hairstyles come through the identical code path, and I proved it.** Building with
`Hair:ponytail01.mhclo` attaches, rigs and exports it exactly as a garment:
`Human.ponytail01, 3,718 verts, 49 morphs, skinned`. Measured across all ten:

| | verts | faces | z_depth | texture |
|---|---:|---:|---:|---|
| `short04` (smallest) | 865 | 525 | 50 | 2048² diffuse |
| `ponytail01` | 3,718 | 2,676 | 50 | 2048² diffuse |
| `bob01` (largest) | 5,203 | 4,237 | 50 | 2048² diffuse |

All ten are **card-based, single 2048² diffuse, no normal map except `short02`** — which is exactly
the representation `research/stellar-blade-look-spec.md` §Hair calls for
(*"alpha-blended sorted cards; strand grooms baked to cards"*).

Consequences, and they are load-bearing for three other punch-list items:

- **0.9 (SPIKE: hair perf) has had a real asset available the whole time.** The spike is written
  against "the frostbitten-hair demo"; it can be run against `ponytail01` at 2,676 cards on the
  real figure instead. **Do that first — it is a better spike.**
- **3.5 `HairMaterial`** needs near-black albedo at `#150F17` with ~10:1 spec-to-albedo contrast.
  The CC0 hair diffuse maps are not authored that way and will need the same albedo correction
  §4/§5 describe for fabric. Same machinery.
- **3.6 hair OIT** and a wardrobe both need **sorted transparency**. A mesh top, a sheer sleeve
  and a hair card are the same rendering problem. **Build the OIT path once, for both.** That is a
  genuine scope saving and it argues for sequencing 3.6 with the wardrobe rather than with 3.5.
- **3.16's card lesson applies verbatim.** Eyelash and eyebrow cards rendered as saturated royal-
  blue spikes for three rounds because `applyShading` skipped them and they kept a roughness-0.5
  slab; the fix was `specularIntensity 0` + alpha-to-coverage at cutoff **0.1**, not the glTF
  default 0.5, which was discarding 15,368 lash and 20,262 brow texels. **Any garment with an
  alpha cutout inherits that bug.** Gate G7 (card-band cool-chroma outliers) should be extended to
  cover garment cards, or a mesh panel will do exactly what the lashes did.

Also unblocked: **7.4 (identity configuration UI)** gains a wardrobe, and **8.2 (blind emote
comparison vs Live2D)** gets materially harder to lose — a clothed figure with secondary cloth
motion is not something Live2D can do at all.

### 7.3 The phase, ready to paste

Numbered **Phase 9** so it does not collide; renumber on paste if it belongs elsewhere. Every item
carries a MEASURED or CRITIC gate, and every threshold below is either measured in this document
or cited to a standard.

```markdown
## Phase 9 — Wardrobe

- [ ] **9.1** `wardrobe/GarmentManifest.js` + `assets/wardrobe/manifest.json` — per garment:
      `id`, `layer`, `hideMask`, `alphaMode`, `clo` (ASHRAE 55 Table 5.2.2.2B), `fabric` (the §5
      taxonomy key), `formality` (authored 1–5), `palette`. **`z_depth` from the mhclo is inert
      and must not be trusted** — exhaustive grep of MPFB finds four write sites and no consumer,
      and the shipped values put shoes (5) *under* suits (50). Gate: **MEASURED** — a selftest
      asserts every catalogue entry validates, that `layer` is a total order, and that two
      garments claiming the same layer are rejected rather than silently interpenetrating (proven
      red by two suits at z_depth 50, which MPFB today attaches without a warning).
- [ ] **9.2** `tools/figure-pipeline/build_figure.py` gains `--garment` and `--hide-mask-attribute`.
      Body hiding moves from a baked MASK modifier to a per-vertex `_HIDE_*` attribute.
      🚩 **`export_attributes` defaults OFF in Blender's glTF exporter and the build reports
      success without it** — the attribute vanishes silently. 🚩 **The exporter upper-cases the
      name**: authored `_hide_x`, exported `_HIDE_X`; match case-insensitively.
      Gate: **MEASURED** — the runtime index rebuild reproduces the baked triangle count exactly.
      Proven: 17,012 = 17,012 for suit+shoes, 21,380 = 21,380 for suit alone, at **0.1609 ms**
      median over 30 runs.
- [ ] **9.3** `wardrobe/Wardrobe.js` — `dress(garmentIds)` / `undress()`. Loads garment fragments
      on demand, rebuilds the body index buffer from the union of hide masks, adds/removes the
      garment `SkinnedMesh` against the figure's existing skeleton.
      Gate: **MEASURED** — dress → undress → dress returns the body to **26,756 triangles**
      (measured undressed count) with no drift, and the dress step stays under **1 ms** on this
      hardware against the 0.1609 ms measured for the rebuild alone.
- [ ] **9.4** Per-figure garment bakes. 🚩 **One garment fragment CANNOT serve all five figures**:
      `female_casualsuit01` drifts **mean 95.145 mm / max 143.066 mm** between g000 and g100, 90%
      of the body's own 105.614 mm, because `fit_clothes_to_human` re-solves every vertex
      barycentrically against the current basemesh. Cross-fitting the g000 suit onto the g100 body
      puts **390 of 462 covered skin vertices (84.4%) outside the cloth, median 42.14 mm proud.**
      Textures are shared across the five; only positions differ.
      Gate: **MEASURED** — for all five figures, covered skin outside the cloth at rest is no worse
      than the g050 baseline of **26.37%** and the worst depth no worse than **9.19 mm**.
- [ ] **9.5** `tools/figure-pipeline/verify_glb.mjs` gains a garment clause. It currently **FAILS a
      clothed figure by construction** — `OPAQUE_MATERIAL_PARTS` is a five-regex whitelist
      (`verify_glb.mjs:688`) and a garment matches nothing, so `suit_g050` reports 1 problem and
      `layered_g050` reports 3, while every eye, lip-seal and morph assertion stays green and
      numerically identical to the nude figure. The clause must read `alphaMode` from the manifest
      per garment, not from a regex — a wool coat is OPAQUE, a mesh panel is MASK.
      Gate: **MEASURED** — the gate passes a clothed figure and is proven red by a manifest that
      declares OPAQUE for a cutout garment.
- [ ] **9.6** KTX2/Basis for every garment texture via `KHR_texture_basisu` + `KTX2Loader`.
      🚩 **This is the phase's binding constraint and the only major number in this research that
      is NOT measured.** Textures are **81% of a one-garment GLB and 87% of a three-garment one**;
      the 20 CC0 garments carry **122 MB of PNG** with six suits shipping 4096² normals, and a
      4096² RGBA8 normal is **≈85 MB of VRAM with mips** — arithmetic, not measurement.
      Gate: **MEASURED** — transcode ratio and VRAM residency measured for real, and a ten-garment
      catalogue held under a stated budget. Also measure whether a 2048² normal is
      distinguishable from 4096² at portrait framing before paying for the larger one.
- [ ] **9.7** 🚩 Recover the discarded AO. Every CC0 garment mhmat declares `aomapTexture`
      (0.7–2.2 MB, 2048²) and **none of it reaches the GLB**, because
      `NodeWrapperGameEngine.setup_group_nodes` wires only diffuse → Base Color, diffuse alpha →
      Alpha and normal → Normal Map. There is no occlusion node in MPFB's game-engine material at
      all. Punch-list 3.10 exists because un-occluded ambient specular is the plastic look, and we
      are throwing hand-baked AO away for free.
      Gate: **MEASURED** — `occlusionTexture` present on every garment material in the built GLB,
      and a rendered on/off difference measured in the folds, not asserted.
- [ ] **9.8** `wardrobe/Dresser.js` — `{PAD, temperature, formality, timeOfDay} → outfit`.
      Layer 1 is derived and cited: Schiavon & Lee (2013) Equation 3, adopted into ASHRAE 55 Fig
      5.2.2.2, from 6,333 field observations, gives a target clo from outdoor temperature at 06:00;
      ASHRAE 55 Table 5.2.2.2B gives additive per-garment clo. Colour brightness/saturation from
      Valdez & Mehrabian (1994), 🚩 **with the arousal-brightness coefficient FLIPPED POSITIVE** —
      Wilms & Oberfeld (2018) measured brightness *raising* arousal at ηp² = 0.459 against V&M's
      −0.31, and hue's effect on valence failed significance at p = .051.
      🚩 **The dominance equation has never been replicated and must be marked authored**, as must
      silhouette, the formality ladder and time of day — no literature supports those.
      🚩 **Selection is gated on the MOOD layer (10 min change / 20 min return), never on the
      affect layer (attack 150–250 ms)**, or the avatar strobes.
      Gate: **MEASURED** — a selftest reproduces Equation 3's published breakpoints
      (t=−5 → 1.000, t=5 → 0.636 from both branches, t=26 → 0.462), asserts every catalogue
      ensemble sums to within tolerance of its target clo across −20…+40 °C, and proves the
      hysteresis by feeding a PAD trace that would otherwise change outfit more than once a minute.
- [ ] **9.9** Cloth secondary motion on hems, skirts and coat tails, over 6.6's `SpringBones`.
      🚩 Scope it from the measurement: pose is NOT the problem for fitted garments — a 120°
      shoulder raise plus a 40° spine twist moves the suit's poke-through by **1.10 percentage
      points** and its worst depth by **−0.016 mm**. The knee is: hips 70° / knees −90° takes the
      worst depth **9.190 → 14.988 mm**. Spend the budget on knees, hems and loose panels.
      Gate: **MEASURED** — worst posed poke-through over a defined pose set no worse than the rest
      pose, plus **CRITIC** on a walk/turn clip.
- [ ] **9.10** Extend gate **G7** (card-band cool-chroma outliers) to garment cutout cards.
      3.16 records lash and brow cards rendering as saturated royal-blue spikes for three rounds
      while G1–G6 read green, fixed by `specularIntensity 0` and alpha-to-coverage at cutoff **0.1**
      rather than the glTF default 0.5, which was discarding 15,368 lash and 20,262 brow texels.
      Any garment with an alpha cutout inherits that bug.
      Gate: **MEASURED** — G7 over hand-drawn rects on the garment's cutout regions, < 0.10% of
      the band, proven red against the un-shaded material.
- [ ] **9.11** SPIKE: procedural fabric — weave normal + roughness + sheen/anisotropy generated
      from `{weave, endsPerInch, picksPerInch, yarnTex, gsm}` rather than sampled. Isolated
      prototype first, per the standing preference for proving unfamiliar domains outside the app.
      Half of this is already de-risked: a probe generated plain / 2-1 twill / 3-1 twill / 4-1
      satin height fields from thread count alone and the structure tensor's **coherence separates
      plain from twill by 1.9–2.6×** (0.2887 against 0.5560 / 0.5989 / 0.7429), ordering the twills
      by float length correctly.
      🚩 **AND THE OBVIOUS GATE IS THE WRONG ONE — proven, not predicted.** "Measure the twill
      diagonal with a structure tensor" reports **−90.00° on all three twills**, against predicted
      angles of 32.91° / 30.96° / 45.00°, because a whole-patch tensor is dominated by the
      axis-aligned yarn cross-section ridges and the float diagonal is a lower-amplitude,
      longer-wavelength modulation on top of them. A naive autocorrelation pitch was also out by
      2–10× because the repeat is `over + under` yarns, not one.
      Gate: **MEASURED** — the twill angle recovered by an **FFT peak at the weave-repeat
      frequency** (or a band-passed tensor), matching `atan((picks × advance) / ends)` within a
      stated tolerance; **proven red against a plain weave, which has no diagonal to find, and
      against the whole-patch structure tensor above, which returns −90° on a correct twill.**
      Plus the anisotropic highlight running along the twill line on a rendered plate.
- [ ] **9.12** SPIKE: pattern-to-garment. **Start from GarmentCode/`pygarment` (MIT), not from
      scratch** — it is the only complete open headless pipeline, it already emits **GLB** and a
      UV texture, and hm08 support is three files the config already anticipates: `<name>.obj`,
      a 26-measurement `<name>.yaml`, and a segmentation JSON (`body / left_arm / left_leg /
      right_arm / right_leg / face_internal`) which hm08's 172 named groups make scriptable.
      🚩 **Two traps to plan for, not discover:** its Warp fork is under the **NVIDIA Source Code
      License, not Apache-2.0**, and it targets Warp's **deprecated `warp.sim`**, whose successor
      is Apache-2.0 **Newton**. 🚩 And design for the published **72% simulation success rate** —
      one garment in four fails — not for the 30 s/garment average.
      Timebox it and report an honest negative if it does not land.
      Gate: **MEASURED** — one drafted garment reaches the same rest-pose fit as the CC0 baseline
      (covered skin outside the cloth ≤ **26.37%**, worst depth ≤ **9.19 mm**, measured by the same
      signed point-to-triangle tool), and the bake stays inside a stated wall-clock budget against
      the measured **0.86 s/garment** marginal cost of the mhclo path and the **0.65–3.58 s**
      measured for a Blender drape at our mesh density.
- [ ] **9.13** Hardware library — ~15 parametric models (zips, buckles, buttons, rivets, eyelets,
      snaps, webbing keepers, cord locks, D-rings). 🚩 **This is the bounded art task the phase
      cannot avoid**: there is no academic work on procedural garment hardware, and GarmentCode
      states in its own paper that *"the simplified definition of a panel does not allow
      specification of internal loops, hence GarmentCode cannot seamlessly represent panels with
      holes"* — which blocks eyelets and buttonholes **at the pattern level**. It also cannot model
      fabric layers or *"elements sewn on top of a fabric piece, such as pockets and flounces."*
      For a workwear/tactical reference set, pockets and hardware ARE the garment.
      **Placement is derivable from pattern edges; only the models are hand-made, and only once.**
      Gate: **CRITIC** — a judge cannot tell a placed zip from an authored one at portrait framing.
- [ ] **9.14** SPIKE: contact-driven wear, with an honest chance of a negative result.
      🚩 **This is the one genuinely open problem in the phase.** AO and curvature are
      *geometry*-driven and every bake we can run derives from them; wear is *use*-driven — knees,
      seat, cuffs, collar folds, pocket mouths. The generic weathering canon exists (Dorsey &
      Hanrahan 1996; γ-ton tracing 2005; Bellini et al. 2016) and **has never been applied to
      garments in a published venue**. This is what separates a generated jacket from a bought one.
      Gate: **CRITIC** — blind, generated-with-wear against generated-without, and the judge must
      pick the worn one as more real. **Report a negative if it does not land; do not tune.**
- [ ] **9.15** Third-party import path. The library **CONSUMES** a garment the user legally
      acquired and **NEVER BUNDLES** one. No licensed asset in the repo, in the npm package, or in
      any example.
      Gate: **MEASURED** — a repo scan asserts no third-party garment binary is tracked, and the
      importer refuses an asset whose licence metadata forbids the use.
```

⚠️ **One item deliberately NOT in the list.** There is no "match Nice Pictures' quality" gate,
because that is 8.1's job and 8.1 is a blind CRITIC comparison. Putting a subjective quality bar
inside the wardrobe phase would let it be declared passed by whoever built it. The wardrobe phase
delivers measurable plumbing and measurable material parameters; a judge decides whether it looks
like clothing.

---

## 8. What could not be checked, and why

- **[✗] KTX2/Basis transcode ratio and VRAM residency.** No `toktx`, `basisu` or `ktx` binary on
  this machine and `gltf-transform` is not installed. Installing one would add a dependency to the
  user's machine for a research pass. The 6–8× figure in §3.4 is the format's published behaviour,
  **not a measurement**, and the ≈106 MB VRAM figure is arithmetic on measured texture dimensions.
  **This is the single most important unmeasured number in the document** — it decides §3.5.
- **[✗] Nothing was rendered.** Every fit number here is geometric — signed point-to-triangle
  distance through three.js's own skinning. No plate was captured, no gate in
  `tools/critic/measure.mjs` was run on a clothed figure, and no judge has seen one. A 1.3 mm
  poke-through may or may not be visible at the framings this project captures; the standing
  constraint records that there is **no measured visibility threshold for this project's framing**,
  only a 0.48–10.6 px bracket. **Do not read §1.3's percentages as a verdict on appearance.**
- **[✗] The 4096² vs 2048² normal-map question** was not tested at portrait framing.
- **[✗] Cloth simulation was not run.** §9.9's scope comes from posed LBS geometry, not from a
  simulation.
- **⚠️ The poke-through region is defined by the asset's own hide mask**, which is MakeHuman's
  statement of what the garment covers. If that statement is wrong the percentages inherit the
  error. It is the best region definition available and it is better than a distance threshold,
  but it is not independent of the asset.
- **[✗] The twill-diagonal orientation readout failed and is reported as a failure, not omitted.**
  §4.4: the coherence half worked and separates weaves 1.9–2.6×; the angle half returned −90.00°
  on all three twills against predictions of 32.91° / 30.96° / 45.00°. The diagnosis (whole-patch
  tensor dominated by axis-aligned yarn ridges) is reasoned, **not proven** — I did not implement
  the FFT alternative to confirm it recovers the diagonal. 9.11 is written so the spike inherits
  the failing gate rather than re-discovering it.
- **[✗] Licences that could not be retrieved:** GarmentCodeData's 115k-sample dataset (ETH
  Research Collection refused every route — the *code* is MIT and the *paper* CC BY-SA 4.0, but
  the dataset's own terms are unknown); UTIA BTF; Bonn UBO2014; SewFormer/SewFactory and CLOTH3D
  have no licence file at all. **Do not assume any of these are usable.**
- **[✗] ISO 9073-9:2008's current status** — iso.org refused access. Conversely BS 5058:1973 was
  confirmed **still Current**, not withdrawn.
- **[✗] No published Cusick drape coefficient for denim exists**, in any source searched — nor for
  named wool suitings. Two studies tested 40 and 86 fabrics respectively and published only
  correlations and graphs, no per-fabric tables. **If drape fidelity matters for denim, the test
  has to be run.**
- **[✗] No public bulk KES-F dataset exists**, and the Kawabata standard control charts are in two
  out-of-print volumes. Units and instrument settings are verified; the data is not available.
- **[✗] Nice Pictures' full catalogue** — pagination failed at 240 of 775 listings (31%), so the
  format and price distributions are a sample, and NoAI was verified on 5 listings rather than all.
- **[✗] UE5 and MetaHuman bone counts are single-source** (a Reallusion manual: 89 and 342) and
  **Epic publishes neither**. Our own 53 is measured twice — from our GLB and from MPFB's rig JSON.
- **⚠️ The Blender fabric presets in §4.1 are Blender's authored values**, carrying no citation and
  no traceability to a textile instrument. They are a shipped, consistent bracket, not physics.
- **⚠️ Every build here is at the default macro settings** (age/muscle/weight/height/proportions/
  cupsize/firmness all 0.5) with only `gender` swept. Fit across the *other* six macro axes is
  untested, and `weight` in particular is the one most likely to break a fitted garment.
