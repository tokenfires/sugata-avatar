# Generative 3D, auto-rigging, and template bases — verified research

Researched 2026-08-06. Licences read from repo LICENSE files and vendor ToS, not from papers
or summaries. **This report revises the character-source decision in
[`character-assets.md`](character-assets.md).**

---

## 1. The thesis, stated precisely

> **ARKit 52 blendshapes are authored once on a fixed template topology. They are not, and
> cannot be, generated per-character on arbitrary topology.** Every service shipping ARKit
> blendshapes does so by *owning* the topology — 52 shapes sculpted once, on one head.
> Generative models emit a novel vertex layout every run, so there is nothing stable to attach
> morph targets to.

Therefore: **don't generate a character — fit a pre-rigged, pre-UV'd, pre-blendshaped template
to a generated or reconstructed shape.**

This independently confirms the architecture already chosen in the design spec. An April 2026
survey ([arXiv:2604.23629](https://arxiv.org/html/2604.23629v1)) finds **no quad-mesh character
generation systems** and **no automated blendshape generation** anywhere in the open literature.

The proof case: [LAM_Audio2Expression](https://github.com/aigc3d/LAM_Audio2Expression)
(Apache-2.0) is the only open ARKit path that exists, and its authors *"adapted ARKit
blendshapes to align with FLAME's facial topology through **manual customization**."* Even the
researchers hand-authored onto a fixed template.

## 2. Text-to-3D for the character body — NOT VIABLE

No tool in 2026, commercial or open, goes text prompt → UV'd, rigged, ARKit-blendshaped human.
Not one.

**Correction to a common claim:** "triangle soup" is outdated. Meshy, Tripo, Rodin and Alpha3D
all ship quad remeshing and UV unwrap as pipeline stages now. But native output is still
triangles from isosurface extraction, and **quad-dominant ≠ artist edge flow** — an isotropic
remesher gives uniform quads with *no edge loops around eyes, mouth, or joints*. Irrelevant for
a prop. For a face that must blink and speak, it is the whole game.

The accurate 2026 description is **"machine-quadded, atlas-UV'd, edge-flow-free."**

**Where generative 3D genuinely earns its place — and it does:** hair, clothing, accessories,
props, environment. Step1X-3D (Apache-2.0) or TRELLIS (MIT) → DeepMesh retopo →
SkinTokens/Puppeteer if it needs to deform. Real win. Just not for the body.

## 3. 🚩 Template bases — this revises our decision

Two Apache-2.0 parametric bodies that **ship blendshapes**, which MPFB2 does not:

| Base | Licence | Verts | Parameters | Ships |
|---|---|---|---|---|
| **[MHR](https://github.com/facebookresearch/MHR)** (Meta) | **Apache-2.0** | 18,439 | 45 shape / 204 pose / **72 expression** | **7 LODs**, `lod?.fbx` "rig with **identity and expression blendshapes**", SMPL/SMPL-X converter |
| **[Anny](https://github.com/naver/anny)** (Naver) | **Apache-2.0** (MakeHuman assets CC0) | 13,718 | **11 semantic shape** + 256 local blendshapes | **UVs**, infant→elder range |
| MPFB2 (incumbent choice) | CC0 assets | ~14.8k faces | 9 macro (gender defaults 0.5) | **No blendshapes at all** |

🚩 **MPFB2 confirmed to have no ARKit path** — it is an open feature request with **no
maintainer response** ([mpfb2 issue #302](https://github.com/makehumancommunity/mpfb2/issues/302)).

**Anny is built on MakeHuman assets (CC0) but adds blendshapes and UVs** — potentially the best
of both, keeping the semantic parameter story while removing MPFB2's two weaknesses.

**Open question requiring verification before the design is finalised:** does MHR or Anny expose
a *continuous, semantic gender axis*? MHR's "45 shape params" is likely a learned PCA space —
gender would exist as a *direction* in it but not as a labelled slider. Anny's "**11 semantic**
shape params" is the promising phrase. Our identity requirement needs a dial the AI can set, not
a PCA direction we have to discover.

## 4. ⛔ Licence blocks worth knowing

| Model | Why not |
|---|---|
| **Hunyuan3D 2.x** | Tencent Community Licence **excludes the EU, UK, and South Korea** — "must not use… outside the Territory." Plus a 1M MAU discretionary cap. Unenforceable-to-comply-with for a global browser product. |
| **Hunyuan3D 2.5/3.0/PolyGen** | Hosted API only; weights never released. |
| **SMPL / SMPL-X** | Non-commercial. **Transitively kills LHM, LHM++, IDOL, ECON, TeCH, HumanGaussian, StructLDM** and every SMPL-X-conditioned reconstructor. ⚠ The commercial path is now in limbo: **Epic acquired Meshcapade (closed Apr 2026), the exclusive sub-licensor, and shut its platform down 18 Apr 2026.** Use MHR or Anny instead. |
| **MeshFlow** (Meta) | FAIR **Noncommercial** licence. |
| **Anymate** | CC-BY-**SA**-4.0 — share-alike on an embedded model is a real product problem. |
| **MeshAnything v1/v2** | MIT but **≤1600 face hard cap** — cannot carry a human face. |
| **AniGen** | MIT, first open model emitting rigged GLB from one image — ⚠ but `extensions/CUBVH` derives from NVIDIA instant-ngp (**non-commercial**). Strip before shipping. |
| **Anny** | ⚠ Apache-2.0, but **do not enable the optional `smplx` topology** — that path is non-commercial. |

## 5. Auto-rigging — solved, and free

| Tool | Licence | Note |
|---|---|---|
| **[SkinTokens/TokenRig](https://github.com/VAST-AI-Research/SkinTokens)** | **MIT** | Skeleton + **dense per-vertex** skin weights, GLB→GLB, batch CLI. 98–133% skinning gain over UniRig. Needs ≥14 GB VRAM — fine on 128 GB unified. **Best local rigger.** `--use_skeleton` supplies our own canonical skeleton and solves weights only. |
| [UniRig](https://github.com/VAST-AI-Research/UniRig) | MIT | Superseded by the above. |
| [Puppeteer](https://github.com/Seed3D/Puppeteer) | Apache-2.0 | Skeleton + skinning + video-guided animation. |

🚩 **Mixamo is not viable** — no API ("only available on the web"), FAQ last updated **Sep 2021**,
auto-rigger repeatedly broken through 2025–26. Its "Enable Facial Blendshapes" flag only
*preserves* existing ones (built for the discontinued Adobe Fuse).

🚩 **Blender Rigify is not an auto-rigger** — it expands a *hand-placed* metarig, no auto-fit.
Bone-heat `ARMATURE_AUTO` fails routinely on generated meshes. Blender remains essential as
**headless glue** (`--background`): GLB I/O, cleanup, bone renaming, morph transfer.

## 6. Facial blendshape transfer — staged plan

| Tool | Headless | Verdict |
|---|---|---|
| **Blender Surface Deform** | ✅ fully scriptable | **Start here.** Bind template → `Save as Shape Key` per shape. Free. ⚠ Proximity binding with no semantic understanding — **eyelids and lip seals are exactly what breaks.** |
| **[Faceform Wrap + WrapCmd](https://docs.faceform.com/Wrap/CommandLineInterface/CommandLineInterface.html)** | ✅ **real CLI, Windows *and Linux*** | **The best automatable professional face path.** PointDetector + FacialAnnotation + FacialWrapping automate correspondence; 2025.11 added blendshape-retarget nodes. **Indie $570 perpetual** (<$100K rev). ⚠ Node-locked licence fights autoscaling. |
| Faceit | ❌ GUI landmark workflow | Not headless. Still fine for a **one-time** authoring pass. |
| ARKit Blendshape Baker addons | ❌ | Scaffolds **names only** — you sculpt every shape by hand. Plumbing, not a solution. |

**Plan: prove the architecture with free Surface Deform and measure exactly how bad eyelids and
lips get. If that's not good enough (likely), Faceform Wrap Indie at $570 perpetual is trivial
against the engineering cost of doing it worse ourselves.**

## 7. ⚠ The landscape collapsed in the last 8 months

Verified by direct HTTP check, not search results:

| Service | Status |
|---|---|
| **Ready Player Me** | **DEAD.** Netflix acquired Dec 2025; APIs offline 31 Jan 2026. Domains **no longer resolve.** |
| **Meshcapade** | **DEAD.** Epic acquisition; platform + API shut down 18 Apr 2026. |
| **CSM.ai** | **DEAD.** Alphabet acquisition; Cube + APIs off 5 Jan 2026; domain doesn't resolve. |
| **Union Avatars** | Dead. |
| **Polywink** | Maintenance banner, effectively dead. |
| **Luma Genie** | Gone — company pivoted to video. |

Ready Player Me was *the* pragmatic "ships ARKit blendshapes + Three.js" answer. **It no longer
exists.** Any 2025-vintage advice recommending it is now wrong.

📌 **Lesson for this project: prefer self-hosted, permissively-licensed assets over any hosted
service.** Six services in this space died in eight months. Our chosen path (Apache-2.0 / CC0
bases, MIT riggers, local Blender) has no such failure mode.

## 8. Consequences for our design

1. **Revisit the character base.** MHR and Anny ship expression blendshapes; MPFB2 does not.
   That was MPFB2's single biggest weakness and it may be solved for free.
2. **Verify the gender axis** on MHR and Anny before switching. Our requirement is a semantic
   dial the AI sets, not a PCA direction.
3. **Keep the template-fit architecture** — independently confirmed as the only workable one.
4. **Adopt SkinTokens (MIT)** for rigging rather than writing our own weight solver.
5. **Generative 3D moves to the accessory pipeline** — hair, clothing, props. Not the body.
