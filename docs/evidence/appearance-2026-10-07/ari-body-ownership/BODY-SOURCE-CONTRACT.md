# Ari: body source decision

Nominate the existing **standalone `assets/figures/figure_g050.glb` plus identity-detail catalogue** as an unqualified body-authoring lead. The current clothed-avatar control remains **`assets/wardrobe/body/g050.glb`**. This selects a source inquiry; it establishes neither an Ari body match nor a need for new geometry. No values, asset edits or runtime body controls were delivered.

[Original character and limits](../larger-frame-character/ARTIST-HANDOFF.md) · [Editable bomber and limits](../ari-bomber-drawing/ARTIST-HANDOFF.md) · [Exact control declarations](CONTROL-LEADS.json) · [Recovery receipt](README.md).

## Why this owner

`Identity.js:72–77` selects five standalone figure bakes. Its `resolve()` selects by gender and mode; build, age and height are stored but do not change that loading plan (`:117`, `:202–246`, `:258`). Ari's authored gender-neutral styling supplies no gender-axis value. A build setting alone cannot deliver the intended body through this loader.

The detail path is separate: `IdentityCatalogue.resolve()` returns named detail ends; `IdentityTargets.apply()` adds their offsets to a supplied position buffer. The shipped text catalogue declares relevant width/depth/volume targets. `figure-vertex-map.json` names `base.001`, 14,517 positions, 19,158 basemesh vertices and `figure_g050.glb` as its solved-on source. Those are metadata declarations, without a fresh map, binary, geometry or visual check.

Current `Avatar.swapFigure()` (`Avatar.js:3032–3046`) loads the wardrobe body when wardrobe is requested. `validateWardrobePlan()` (`:4692–4700`) permits only one resolved g050 bake. `AvatarWardrobe.js:11`, `:79–82` binds the separate body and fragments to g050. The inspected swap path does not apply an identity-detail stack. A g050 name does not establish equal vertices, bind transforms, materials or garment fit across these two files.

`Figure.body` selects the first morphed SkinnedMesh in scene traversal (`Figure.js:342–372`). A later source proposal must name the intended body primitive and every associated anatomy owner explicitly. That runtime selector is working ownership policy, not evidence of a complete semantic body surface or an asset defect.

## Exact candidate controls, with values deliberately unset

The eight entries below exist, are exposed, and are bipolar in the inspected `assets/identity/catalogue.json`. Names are search leads, without measured effects or endorsed values. Sided entries require an explicit left/right policy. `CONTROL-LEADS.json` retains complete end names, offsets, record counts and declared region metadata. No packed offsets were read or applied.

| Intended discussion cue | Exact declared slider ID | Open question |
| --- | --- | --- |
| Broad upper torso | `torso/torso-scale-horiz-decr-incr` | Does it give the desired whole outline without unwanted head/shoulder/attachment changes? |
| Rounded profile torso depth | `torso/torso-scale-depth-decr-incr` | What surface and rig changes occur in the exact source frame? |
| Middle width | `torso/measure-waist-circ-decr-incr` | Is the authored effect appropriate for the clothed target, rather than simply a circumference change? |
| Hip breadth | `hip/hip-scale-horiz-decr-incr` | Does it preserve the intended hip-to-leg transition? |
| Hip depth | `hip/hip-scale-depth-decr-incr` | Does it change the intended profile region and attachment positions? |
| Seat volume | `buttocks/buttocks-volume-decr-incr` | Does the actual form agree with the target's clothed seat direction? |
| Upper-arm volume | `arms/upperarm-fat-decr-incr` | Can it support substantial arms without transferring sleeve volume into anatomy? |
| Upper-leg volume | `legs/upperleg-fat-decr-incr` | Can it support the intended body while preserving deliberate trouser ease? |

The image cannot supply hidden anatomy, physical dimensions or a registered turnaround. Jacket, tee and trouser ease belong to garment authoring. Do not trace their outer contour onto a body. Do not infer health, ethnicity, gender-axis settings or physical weight from target names or the illustration.

The macro solver's header explicitly separates its unshipped corpus (`IdentityCatalogue.js:44–59`) from available detail targets. Macro weight, build and a named detail target are different contracts. This inquiry does not verify library performance or historical accuracy claims in source comments.

## What the next source proposal must resolve

Before any body candidate, select one canonical input frame and primitive association for the standalone g050 body and the eight declared detail ends. Reuse existing qualified identity/source evidence when it owns those exact inputs; identify any missing association instead of repeating a reader or arithmetic trial. The map's declared solved-on standalone source cannot silently become a wardrobe mapping. Preserve pristine rest arrays and every auxiliary owner; no first-mesh shortcut or anatomy omission.

Choose whether the deliverable is an isolated artist body source or an integrated moving clothed avatar. An artist source can make a later original front/profile/rear comparison useful, but earns no runtime, rig or garment acceptance. An integrated route must first own the source-index bridge, skeleton/rest/bind consequences, full influences, expression/anatomy preservation and the complete body/foundation/garment relationship. Existing finite native-refit/full-influence work and the [pose-aware fit proposal](../../../research/POSE-AWARE-FIT-NEXT-2026-09-30.md) remain separate prerequisites, not transferred approvals.

**Next nomination:** one fresh worth review of the existing g050 identity/body authoring evidence to determine whether it already owns the exact body/helper-to-export and rig/frame associations needed for an isolated Ari source. If it does, prepare one bounded candidate contract around those saved inputs. If it does not, name the missing authority and choose an original-source acquisition/authoring proposal. No binary read, reader retry, target values, constructor or capture is admitted by this handoff.

## Alternatives and decision gates

**A — qualify the existing standalone detail source first (selected lead).** Existing source provenance and named detail controls may reduce new authoring. It still needs exact source/frame authority and actual appearance review; the current clothes cannot inherit compatibility from g050 labels. Stop before construction if those associations are absent. A later visual refusal must retain a concrete whole-image witness, not be inferred from a control name.

**B — propose a new original body source.** It can give an artist explicit torso, middle, hip and limb responsibility with greater freedom, but expands material, anatomy, rig, expression and wardrobe work. Choose it only under a fresh source/visual contract if the existing lead cannot supply the needed authority or useful form. Current metadata does not prove this geometry is necessary.

The usable result is this source decision and exact control shortlist. Full AAA characters, representation, expression, wardrobe, fit, motion, performance and later VTuber/Mii goals remain open. The checklist stays at 19 scoped checks and ten broad open goals.
