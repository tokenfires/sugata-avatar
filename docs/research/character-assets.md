# Character assets and licensing — verified research

Researched 2026-08-06. Licensing claims checked against primary license text or ToS, not
forum hearsay. Unverified items flagged. **This is the most decision-critical research in the
project** — the asset source determines the shape of everything downstream.

---

## Headline findings

1. 🚩 **Ready Player Me is dead.** Netflix acquired it December 2025; public services, avatar
   creator, and all developer APIs shut down **31 January 2026**. Union Avatars shut down
   ~July 2026. **The two most-recommended "avatar as a service" options no longer exist.**
   Any tutorial or SDK recommending RPM is stale.
2. **MetaHuman genuinely opened up in 2025** — Epic's own page states "MetaHumans can be used
   with any engine or creative software." Real, but with a redistribution problem.
3. 🚩 **Character Creator 4 explicitly prohibits our exact use case.** Not a grey area — the
   EULA names it.
4. ✅ **MakeHuman/MPFB2 is the only source cleanly satisfying all four requirements**, and its
   continuous gender macro **defaults to 0.5 — androgynous.**
5. **Textures, not geometry, are the binding constraint.** Every commercial "freebie" scan
   source forbids redistribution specifically to prevent what a browser inherently does.

---

## The recommendation: MPFB2 + Lee Perry-Smith detail maps + one-time authored ARKit 52

### Why MakeHuman/MPFB2 — **VIABLE** ✅

**License.** [MakeHuman license page](https://static.makehumancommunity.org/about/license.html),
verbatim: *"All core assets are shared under Creative Commons, CC0. The effective consequence
of this is that you are free to do as you see fit with the asset or derivates of the assets."*
Code is GPLv3/AGPL, **assets are CC0 1.0** — a clean split confirmed in
[LICENSE.md](https://github.com/makehumancommunity/mpfb2/blob/master/LICENSE.md), which adds:
*"It is the opinion of the MakeHuman team that no output from MPFB contains any trace of
program logic."* **No AGPL contamination of exported meshes.**

⚠️ Caveat, verified: community-uploaded assets on makehumancommunity.org are **not**
automatically CC0. **Stick to the `makehuman_system_assets` pack.**

**Mesh quality.** Homunculus 08: **14,766 faces, quads only, zero triangles**, minimal poles,
max 5 edges per pole, optimized for subdivision and animation. ~29.5k tris — genuinely
professional topology, appropriate for a browser hero character.

**The gender axis — the standout.** Macro targets are *gender, age, muscle, weight, race,
proportions, height, cupsize, firmness*, **each defaulting to 0.5**, blended via
`calculate_target_stack_from_macro_info_dict()` which "interpolates across all combinations…
to produce a weighted list of target files." Race is a three-way simplex.

So: **a true continuous male↔androgynous↔female morph where the neutral default literally is
androgynous.** This is our identity requirement natively, not bolted on. Nothing else on the
list has it.

**Programmatic generation:**

```python
macro = TargetService.get_default_macro_info_dict()
macro["gender"] = 1.0
basemesh = HumanService.create_human(macro_detail_dict=macro)
HumanService.add_builtin_rig(basemesh, "default", import_weights=True)
HumanService.set_character_skin(path, basemesh, skin_type="GAMEENGINE")
```

`HumanService` also does MHM import, JSON serialize/deserialize, asset fitting, `refit()`.

### 🎯 The architectural insight that makes this work

MakeHuman targets are **per-vertex delta shape keys against a fixed base topology. Vertex
order is invariant across every macro and micro morph.**

Therefore: **author ARKit 52 once on the base mesh, and those deltas are valid for every
character ever generated** — male, female, androgynous, any age, any build. Same for the UV
layout, so baked texture maps are authored once and fit forever.

This converts the two weaknesses (no blendshapes, weak stock skins) from *per-character*
problems into *one-time* asset-production costs. **Nothing else on this list gives us that**,
and it is the single reason this option wins.

### Known weaknesses, honestly

- **Textures are below AAA.** The [system assets pack](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html)
  (267 MB) ships ~24 skins that are **diffuse-only, CC0, resolution undocumented**. The
  material system supports full PBR, but its procedural Blender node trees don't cross to
  Three.js — we bake.
- **No blendshapes at all.** MPFB has no facial expression system (AnimationService is
  armature-only). MakeHuman ships pose-based expressions via a face bone rig, not ARKit shapes.

### 🚩 Highest-risk assumption in the whole project

**MPFB2 headless operation is undocumented.** MPFB's docs never mention background mode. The
service layer is plain `bpy` data manipulation so `blender --background --python` *should*
work, but **some Blender addons need GUI context.**

**Spike this before architecting around it.** Everything rests on it.

---

## Quality path

1. MPFB2 CC0 diffuse as albedo base.
2. Derive roughness / cavity / SSS masks from the **Lee Perry-Smith** scan's cavity /
   thickness / translucency maps.
3. Bake in Blender → glTF → KTX2.

**[Lee Perry-Smith head scan (Infinite-Realities)](https://github.com/keijiro/InfiniteScan) —
CC BY 3.0**, confirmed in two independent places. Unusually complete map set for skin work:
diffuse, high-res bump, normal, **cavity**, **thickness**, **translucency**, occlusion,
curvature. 8.8k-tri base with higher-subdiv sources. **Attribution to Lee Perry-Smith required.**
⚠️ Texture resolutions not stated — verify on download.

### Getting ARKit 52 onto a CC0 mesh

- [`deformation_transfer_ARkit_blendshapes`](https://github.com/vasiliskatr/deformation_transfer_ARkit_blendshapes)
  implements deformation transfer — **but requires a source ARKit blendshape set as input.**
  Chicken-and-egg: no permissively-licensed ARKit 52 mesh set exists (GitHub's
  `arkit-blendshapes` topic has two repos, neither ships assets).
- **[Faceit](https://faceit-doc.readthedocs.io/en/latest/)** (Blender addon, ~$70–100)
  semi-automatically generates all 52 ARKit shape keys on arbitrary human meshes. Output shape
  keys become part of our own CC0 mesh. GUI-driven — **but per the topology insight, we run it
  once.**
- [`avatar-stage`](https://github.com/rana-jatin/avatar-stage) (MIT, updated July 2026) — a
  useful Three.js runtime layer: humanoid rig detection, ARKit expression presets, viseme
  lip-sync. Drives existing blendshapes; doesn't create them.

---

## The alternatives, and why they lose

### VRM / VRoid — **VIABLE-WITH-CAVEATS** ⚠️ (only if we pivot to stylized)

Best-in-class permissive runtime: [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) is
**MIT**, v3.5.5, actively maintained, three.js ≥ r137.
[VRM-Addon-for-Blender](https://github.com/saturday06/VRM-Addon-for-Blender) is MIT/GPL with a
**Python API for automation** — a clean headless export path. Spring-bone physics is a
first-class spec feature.

Licensing is **per-model metadata, author-set**: `avatarPermission`, `commercialUsage`,
`creditNotation`, `modification`, `allowRedistribution`. Defaults are restrictive. If we author
the model, we set the flags.

**Expressions:** 18 presets (5 visemes, 3 blinks, 5 emotions, neutral, 4 look) + custom.
**Not ARKit 52** — we'd carry ARKit as custom expressions.

🚩 **The disqualifier: it cannot reach realism.** VRoid's base is a fixed anime topology —
oversized eye sockets, simplified nasal geometry, flat-shaded MToon. **This is baked into the
mesh, not a texture we can swap. Do not plan to "push it toward realism."** Excellent *if* we
pivot to stylized; structurally incapable of AAA realism.

⚠️ pixiv's ToS pages 403'd every fetch. Model ownership and commercial rights **unconfirmed**.

### MetaHuman — **VIABLE-WITH-CAVEATS** ⚠️ (highest quality ceiling, wrong licensing shape)

**Definitive answer to "is any non-Unreal use permitted": yes, since UE 5.6 / mid-2025.**
[Epic's licensing page](https://www.metahuman.com/license): *"MetaHumans can be used with any
engine or creative software."* The [UE EULA](https://www.unrealengine.com/eula/unreal) grants
royalty-free distribution of *"asset files, such as character models and animations… including
in Products that use or rely on other video game engines."* A Three.js app contains no Engine
Code → Non-Engine Product → no royalty.

Why it still loses:
- 🚩 **Redistribution in an open repo is almost certainly out.** Fab EULA §6(b)(iii) forbids
  allowing *"any third party to incorporate Content into their own products."* Fails our open-distribution requirement.
- 🚩 **No continuous gender axis.** Discrete body archetypes plus face blending between presets.
- **Face rig is RigLogic (joint-based, ~800 controls), not blendshapes.** Baking to morph
  targets for glTF loses the corrective logic.
- ⚠️ **Two Epic documents contradict each other.** [MetaHuman-DNA-Calibration](https://github.com/EpicGames/MetaHuman-DNA-Calibration)'s
  LICENSE still restricts MetaHuman Characters to use *"in conjunction with Unreal Engine."*
  A residual EULA carve-out also remains for assets "available under separate agreement."
  **Get written clarification before betting on this.**

📌 **Verification note worth carrying forward:** an automated summary of the UE EULA PDF
confidently claimed MetaHuman was "UE-Only Content" and other-engine distribution was
prohibited. Extracting and grepping the actual document showed **that phrase appears nowhere in
it, and neither does "MetaHuman."** The summary was fabricated. **Treat any licensing claim in
this space — including secondhand summaries of primary sources — as unverified until the clause
is read directly.**

### Avaturn — **blocked pending verification** ⚠️

ARKit 52 + visemes out of the box on "T2" avatars is attractive. But: **discrete male/female
presets only, no androgynous option, no continuous morph** — fails our identity requirement
outright. API/SDK is **$800/month** (PRO tier). ⚠️ No fetchable ToS found; export ownership and
redistribution rights unknown. And an external dependency is exactly the single point of
failure that just destroyed every RPM integration.

### ❌ Not viable

| Source | Decisive reason |
|---|---|
| **Character Creator 4** | [EULA](https://www.reallusion.com/Content/EULA/EULA.htm) prohibits use *"For online or in-software character generation. In character generation APIs or API licensing. As embedded content within applications or online services."* **That is a verbatim description of this project.** Also mandates models be *"contained in proprietary formats so that they cannot be opened or imported into a publicly available software application"* — a GLB over HTTP opens in any glTF viewer. Two independent decisive failures. |
| **Daz3D Genesis 9** | [EULA §3.0](https://www.daz3d.com/eula) requires content *"not available to end users in their native formats"* and forbids distributing anything from which content *"can be separately exported, extracted, or de-compiled."* Browser-delivered glTF fails categorically. |
| **Ready Player Me / Union Avatars** | Shut down. (Pre-shutdown consumer avatars were CC BY-**NC-SA** — non-commercial *and* share-alike.) |
| **SMPL / SMPL-X** | [Model license](https://smpl-x.is.tue.mpg.de/modellicense.html): non-commercial only, and prohibits redistribution *"in whole or in part."* Trap: the CC BY 4.0 **SMPL-X Body** subset **explicitly excludes the shape blendshapes** — the only part we'd want. Topology is research-grade anyway: no UVs, no facial blendshapes. |
| **MB-Lab / CharMorph** | Frequently recommended as MakeHuman alternatives, but their base meshes descend from ManuelBastioniLAB under **AGPL, not CC0** — strictly worse for permissive distribution. MB-Lab archived 2024-07-21. |

---

## Textures — the hard wall

Our constraint set (commercial + open distribution + browser-delivered) eliminates the entire
commercial freebie market in one stroke. Vendors write these licenses specifically to prevent
asset re-extraction, and open-source distribution is the purest form of what they prohibit.
**Two name open-source licenses explicitly as a prohibited act.**

| Source | License | Redistributable | Verdict |
|---|---|---|---|
| **Lee Perry-Smith head scan** | **CC BY 3.0** | Yes, w/ attribution | ✅ **VIABLE** |
| **MakeHuman core skins** | **CC0** | Yes, unconditional | ✅ **VIABLE** (quality-limited) |
| ambientCG / Poly Haven / TextureCan | CC0 | Yes | ✅ but **no human skin** |
| 3D Scan Store | Personal use; open-source banned | No | ❌ |
| Texturing.xyz | Open-source banned | No | ❌ (open); OK closed+commercial |
| RenderPeople free | GTC §4.2 anti-extraction | No | ❌ |
| Quixel / Fab | Fab EULA §4(b), §6(b) | No | ❌ (no free human skin exists anyway) |
| Eisko "Louise" | CC BY-**NC-ND** | No | ❌ |
| Digital Emily / Basel / FaceScape | Research-only | No | ❌ |
| Ten24, AXYZ, Human Alloy | Not published | Unknown | ❌ treat as not viable |

Decisive verbatim clauses:

- **[3D Scan Store](https://www.3dscanstore.com/terms-and-conditions-licensing)** prohibits
  *"Release the 3D Models or scans or derivative products under Open Source Licences."* Their
  free HD Female Head Scan (8192² albedo/normal/displacement/roughness/specular, 16-bit TIF
  displacement, pore-level, 1.9 GB) is **the best free asset in existence** — and its page says
  **"Personal use only."**
- **[Texturing.xyz](https://texturing.xyz/pages/terms-of-service)** — same open-source
  prohibition. Their paid Business Commercial license *does* permit game/VR integration —
  viable only if we abandon open distribution.
- **[RenderPeople GTC §4.2](https://renderpeople.com/general-terms-and-conditions/)** prohibits
  *"making the 3D data available in a way that allows third parties to easily download,
  extract, distribute, or otherwise access the 3D data as individual files."*

**No CC0 library has human skin.** ambientCG / Poly Haven / TextureCan are clean CC0 with
explicit redistribution rights and zero human skin assets — useful for eyes, clothing,
environment, not skin.

---

## Blendshape target: ARKit 52 as the wire format

Not because it is the best-designed set, but because it is what everything **emits**: iOS
ARKit face tracking, MediaPipe FaceLandmarker (same 52), MetaHuman Live Link, and every
audio-to-face model.

Facts worth having straight:

- **ARKit 52 already includes the tongue** — `tongueOut` is the 52nd shape. Correct regional
  breakdown: **eye 14, mouth 23, brow 5, jaw 4, cheek 3, nose 2, tongue 1.**
  ⚠️ A widely-circulated breakdown ("brow 4 / eye 12 / jaw 4 / cheek 4 / mouth 23 / nose 5")
  also sums to 52 but is garbled and omits tongue — **don't use it.**
- **One tongue shape is not enough for speech.** Add 3–6 tongue/viseme shapes for lip-sync quality.
- 🚩 **Don't target raw FACS** — no tooling consumes it. ARKit is FACS-derived but incomplete;
  per the [ARKit-to-FACS cheat sheet](https://melindaozel.com/arkit-to-facs-cheat-sheet/) it
  omits AU11 (nasolabial deepener), AU13 (sharp lip puller), AU23 (lip tightener), AU38/39
  (nostril dilator/compressor), and vertical lip tightening. **Target ARKit 52 and add custom
  shapes for the gaps that matter to us** — our affect→AU mapping will want some of those.

**What each source ships:** MPFB2 — nothing (we author). VRM — 18 presets, not ARKit.
Avaturn T2 — ARKit 52 + visemes. CC4 — full ExPlus/ARKit. MetaHuman — RigLogic joints, bake required.

Three.js handles 52+ morph targets (morph data moved to a data texture in r131, removing the
old 8-target limit). ⚠️ **But per-frame cost is O(vertices × targets) — benchmark a 52-shape
rig on the 14.7k-face base in Phase 0.**

---

## Text-to-3D character generation (2026) — **NOT VIABLE for the body**

Nearly all generators (Meshy, Tripo, Rodin, Luma, Trellis, Hunyuan3D) output **marching-cubes
or Gaussian-splat derived triangle soup: no clean topology, no animation-friendly edge loops,
atlas-projected or absent UVs, no skeleton, no blendshapes.** Auto-rig bolt-ons (UniRig,
Anymate, Mixamo) produce a body skeleton, but **none produce ARKit 52 facial blendshapes**,
which is the hard part. Most open research models carry non-commercial licenses.

**Usable for props, accessories, and clothing. Treat as an accessory pipeline, not a character
pipeline.** ⚠️ Provisional — a dedicated deep-dive was still running when this was written.

---

## Flagged as unverified

- 🚩 **MPFB2 headless operation** — undocumented. **Highest-risk assumption in the recommendation. Spike first.**
- **pixiv/VRoid ToS** — all pages 403'd.
- **Avaturn licensing** — no fetchable ToS found.
- **MetaHuman** — Epic pages 403/JS-render; DNA-Calibration LICENSE contradicts metahuman.com.
- **ARKit 52 regional breakdown** — Apple's page unfetchable; one circulating breakdown is demonstrably wrong.
- **Texture resolutions** — both MakeHuman core skins and the Lee Perry-Smith scan.
- **Ten24 / AXYZ / Human Alloy** — no license text published.
