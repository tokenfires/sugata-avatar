# External character-authoring dependencies and provenance

**The current Ember likeness workflow depends on third-party authoring software outside Sugata.** In particular, KeenTools FaceBuilder/Core is being used as the photo-guided head-authoring route. Sugata has not implemented that reconstruction capability. A character produced with it must retain this disclosure even if the eventual exported asset runs in Sugata without the authoring tool.

## Dependency register

| Tool/source | Role in Sugata work | Dependency and current evidence |
| --- | --- | --- |
| **Blender** | External modeling, asset preparation and export application | Installed5.2.3 LTS on the current Mac. Separate application, not bundled with Sugata. Existing MPFB facial-study builds ran successfully in it. |
| **MakeHuman / MPFB** | Existing anatomical base, detailed targets, face parts and original character exports | External asset/tool pipeline. Program licenses and CC0 core/output assets are distinct; see [figure pipeline](../tools/figure-pipeline/README.md) and [primary license](https://static.makehumancommunity.org/about/license.html). The two first Ember face studies used this source and were rejected for likeness. |
| **KeenTools FaceBuilder for Blender + KeenTools Core** | **External photo-guided Ember head fitting, with potential texture and expression authoring** | Robert installed the add-on October 31, 2026 and approved one free trial/license step. Installed add-on/Core files report 2026.3.1; root opened the actual panel in Blender 5.2.3, reporting **Trial: 14 days left**. Two local portraits were fitted and projected once; separate editable projects and a static GLB were saved. Root reviewed the actual GLB in the browser. This is not a Sugata-native feature or an accepted likeness/finish result. |

## FaceBuilder installation, use and licensing

The add-on is installed outside this repository under the current user's Blender extensions. The vendor describes the add-on as an adapter to its proprietary Core library. Installing only the add-on does not by itself establish a usable Core, active trial, successful fit or export. Record each separately as work proceeds.

The [vendor product page](https://keentools.io/products/facebuilder-for-blender) describes photo-based head fitting, its own topology, export and51 ARKit-compatible facial shapes. [Download/trial information](https://keentools.io/download/facebuilder-for-blender) describes the15-day trial beginning on first Blender launch with the tool installed. Robert's approval covers **one free trial**, not a purchase or subscription. Actual start/expiry should be copied from the installed license display when verified; do not infer it from an installation timestamp.

FaceBuilder/Core has a separate [KeenTools agreement](https://link.keentools.io/eula). Sugata's MIT license does not license or redistribute that tool. Vendor output-ownership claims do not prove compatibility, likeness or visual finish. Verify image handling before loading the original portraits; no cloud image upload is authorized by this dependency record. The vendor says existing projects can open/export after a subscription ends, while FaceBuilder adjustments require valid access. Preserve an ordinary editable mesh and project as well as tool-specific fitting data.

## Record with every resulting asset

- Source/reference roles and original hashes; keep reference images unchanged and out of repository history.
- Authoring application, add-on/Core versions and license/trial state at creation.
- Which geometry, texture, rig or expression data came from each external tool; changes made in Sugata separately.
- Editable source/project and exported asset paths, hashes and export settings.
- Actual reviewed renders, critic findings, root verification and remaining likeness/finish/integration limits.

**Current outcome:** a first fitted head and photo projection exist as ordinary editable source and static GLB, reviewed in six actual browser frames with and without texture. Stronger projected Ember cues justify retaining the candidate. Painted hair/eyes/smile, texture gaps and unqualified geometry prevent character acceptance. Animated-avatar integration, finished skin/eyes/hair and expression identity remain open. [FaceBuilder trial checkpoint](evidence/ember-2026-10-31-facebuilder/README.md) · [previous rejected face studies](evidence/ember-2026-10-30/README.md) · [current character plan](EMBER-AVATAR-NEXT.md).
