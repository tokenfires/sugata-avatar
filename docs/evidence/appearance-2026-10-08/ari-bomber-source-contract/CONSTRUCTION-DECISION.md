# Ari bomber: select an original connected shell

**Choose an independently authored connected jacket template. Do not duplicate and cut Ari’s skin mesh.** The construction programme is held on one specific missing association: a jacket section/rim manifest tied to the exact body surface. This source-only inquiry is closed; no further source hunt is needed to discover that association. It must be authored.

The [drawing](../../appearance-2026-10-07/ari-bomber-drawing/original-first.jpg) supplies the recognizable collar, two open front edges, full sleeves, short gathered hem/cuffs and slanted pocket mouths. Its facings, left guard and pocket bags are proposals; rear and sleeve lining are omitted. An original 3D template must explicitly complete them rather than silently treat the sheet as a pattern.

## Literal source map

[SOURCE-MAP.json](SOURCE-MAP.json) retains the whole stored 53-bone rig, body identities, group names, evaluated body bounds and eight graphic role records. All positions below are recorded rest coordinates in native units, not measurements from the drawing or physical garment dimensions.

- `Human` is parented to `Human.rig`; both recorded world matrices and parent-inverse matrices are identity. Body mesh has 19,158 raw vertices and 18,486 polygons. The evaluated render-domain body has 13,380 vertices and 26,756 triangles. These are distinct domains, not interchangeable vertex indices.
- `Human` has an Armature modifier referencing `Human.rig`, and a `Hide helpers` MASK using group `body`. An independently authored jacket must not copy helper geometry or remove this mask.
- The rig reports `POSE`, with all 53 recorded pose basis matrices identity. This describes the stored baseline; it does not independently prove evaluated pose equals rest or supply garment deformation.
- Named centerline references exist: pelvis → spine_01 → spine_02 → spine_03; clavicle_l/r → upperarm_l/r → lowerarm_l/r → hand_l/r; neck_01. These are bone identities, not clothing attachment landmarks.
- `neck_01.head_local` is `[0, -0.0051302071660757065, 1.413631796836853]`; `spine_02.head_local` is `[0, 0.009862011298537254, 1.019595980644226]`. They could index a newly authored neckline and short-hem station, but neither already defines a surface ring.
- Left shoulder/elbow/wrist centerline candidates are `upperarm_l.head_local`, `lowerarm_l.head_local`, `hand_l.head_local`; right counterparts are explicitly recorded. Their names do not identify skin cuts or define sleeve radii/ease.

The 3D vertex-group list contains joint/helper/body/deformation groups, but no owned bomber-panel or neckline/hem/cuff cut manifest. The fixed records contain coordinates, fingerprints and hierarchy, not a garment-to-body section correspondence. This is the first missing construction association. No raw archive was decoded to search for one.

## The concrete constructor boundary to author next

The next responsibility is **one finite section manifest**, independent of skin tessellation: torso at authored hem, middle and upper stations; neckline ring; left and right sleeve shoulder/elbow/wrist stations. Each must name its source domain, plane origin/normal, sampled body component, ring order, front opening endpoints and authored clearance/ease. The stations may use the named bones above as reference coordinates. Choosing which skin component belongs to a station remains an explicit authoring choice; nearest joint, group name or all-body bounding box must not silently decide it.

That manifest changes the constructor: an original panel grid bridges the torso sections; sleeve grids bridge separately owned sections, then explicit armhole bridges join each sleeve to the torso. Front edges stay separate. Collar and trim have named attachment loops. A full inner shell and rim bridges close material thickness at collar, cuffs, hem, opening and real pocket cuts; no zero-thickness backface trick. Pocket mouths/bags, facing and left guard need their own boundary/material records. Topology indices belong to the new jacket only, with no invented skin correspondence.

This is a selected topology route and a specific missing authored input, not a constructed mesh or frozen coordinate recipe. The later programme needs a fresh contract containing that manifest before code/native work.

A, selected: original connected template. It permits a short loose silhouette, clear opening and independent topology, at the cost of authored sections, armhole joining, interiors and measured coupling.

B, retained alternative: body-derived cut shell. It starts closer to source correspondence, but there is no bomber cut boundary in the fixed records. It requires new cut selection, remeshing, thickness/interior and garment separation; it also risks inheriting a skin-tight silhouette. Existing deformation names or old foundation offsets cannot discharge those duties.

## Coupling and acceptance ownership

First prototype scope can be the **unchanged single neutral Ari state**, with complete recorded body/helpers/252 keys/53 bones/material/source-file identity preserved. Any static jacket must have an explicit fixed relationship to this body/rig coordinate frame. Rig weights, morph transfer and moving poses are separate unresolved duties, not inherited by parenting. Do not alter the body to fit the jacket.

Use deliberate bare center-front exposure for a jacket-only role study; do not imply a gray underlayer or foundation exists. The gray top and full outfit remain separately owned next tasks. Later comparisons must show the bare control beside clothed originals. Preserve expression zero and persisted roughness0.5; earlier matte/smile responses are not combined defaults.

Before qualifying the prototype, define full triangle-intersection, source-surface clearance and intended coverage/inside-contact observations against the exact evaluated body. Distinguish surface overlap, signed projections and solid-occupancy assumptions. The predicates must be selected before the trial; no gates selected after seeing a candidate. Actual first front/profile/rear/oblique images decide silhouette, collar, sleeve/hem/opening/interior coherence. Numerical controls support that decision.

Physical textile/sewing, closure engagement, pocket function, body-range coverage, rig/morph/motion, final materials/normals/UVs/export/runtime/performance remain open. Complete character/skin/hair/face/representation/meaningful agent expression and the VTuber/Mii roadmap remain intact.

## Stop and next decision

Current inquiry stops at the absent section-to-body manifest. Do not extend lookup or implement a garment here. Next worthwhile slice: author and inspect that finite manifest using the already identified body surface and recorded centerlines, with actual geometric section witnesses and a concrete pass/refusal condition. It must resolve source-domain/component/ring-order ownership rather than rerun this metadata inventory. A failure should name the unowned section; no radius/offset/weight/mask rescue. No native job or first image is admitted by this document.
