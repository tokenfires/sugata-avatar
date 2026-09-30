# Independent UV editor-state recovery review

## Disposition

The exact-name/schema admission proposed in [EDITOR-STATE-RECOVERY](EDITOR-STATE-RECOVERY.md) is justified for this pipeline. Preserve V1 as failed. Its unknown-attribute guard stopped before domain emission; no domain candidate was exported. Admitting these three identified editor fields does not authorize dropping arbitrary attributes or weakening geometric/data checks.

Reviewed [V1 report](../../../../captures/foundation-domain-native-2026-09-30-v1/report.json), SHA256 `2c11d88c0ab19653321d2577fc25e751558d1633b97cde264136779eec43db48`, and verified the encoded/decoded `domain-before.json.gz` bindings. Its schema contains exactly these additional fields:

| Name | Type | Domain |
|---|---|---|
| `.uv_select_vert` | BOOLEAN | CORNER |
| `.uv_select_edge` | BOOLEAN | CORNER |
| `.uv_select_face` | BOOLEAN | FACE |

**V1 did not archive their boolean arrays. Those values remain unknown.** Its full 204-group definitions, surface data, schema and sole `UVMap` coordinates were retained.

## Source and actual export witnesses

The cached, signed Blender runtime's `io_scene_gltf2/blender/exp/primitive_extract.py`, SHA256 `55e14cbe849b0c4ec5545c85a1aae3d8c2c7d65eade67de43eb1a43b05738684`, is preserved in the [V2 source packet](../../../../captures/foundation-domain-native-2026-09-30-v2/source/tmp/foundation-domain-native-sep30/primitive_extract.py).

- Lines 181–217 retain generic custom attributes by default only when names start with `_` or `KHR_`. All three dot-prefixed names fail that filter. The extension hook can override the decision; no `gather_attribute_keep` or `glTF2ExportUserExtension` implementation was found in the inspected isolated MPFB profile.
- Lines 1435–1438 fetch the UV layer's coordinate vectors, separately from selection metadata.
- Actual V1 `band-control.glb`, SHA256 `e29d6851bcba596d1a2f41518b657c78c5b135f6cdedf05a3bba2fd7138f48d4`, contains `POSITION`, `NORMAL`, `TEXCOORD_0`, joint/weight attributes, the three under-masks and `_NATIVE_VERTEX`. None of the three selection names appears anywhere in its glTF JSON.
- The cached `bl_operators/uvcalc_transform.py` uses face/edge UV selection in editor selection helpers at lines 30–46 and 72–99. Its observed SHA256 was `6c06be55c97ff582ae6d7466e1fecd8e8012eb585a53235dc971ce71166fab71`. This supporting source was read from the mounted runtime; it was not among V2's declared source bindings at review time.
- The actual [foundation material](../../../../tools/figure-pipeline/build_figure.py:1817) is a plain Principled material with palette colour and no named-attribute inputs. The later offset/clamp/relax/roll functions do not query these UV selection flags.

These witnesses support an editor-state distinction for the declared pipeline. They are not a universal claim that any arbitrary Blender material or export extension must ignore similarly named attributes.

## Alternatives

- **A — selected:** admit only the exact three name/type/domain tuples; archive their boolean arrays before reconstruction; record their actual reset or absence afterward. UV coordinates, weights, masks, topology and final export checks remain independently enforced. This is the smaller recovery and intentionally does not retain the previous UV editor selection session.
- **B:** preserve original boolean metadata through face/corner lineage and predeclare ownership for new corners/edges. This retains more editable state, but adds selection semantics unrelated to the band geometry or rendered result.

The reviewed V2 source implements A. Its newly captured pre-rebuild arrays contain **41,084 false corner-vertex flags, 41,084 false corner-edge flags and 10,062 false face flags**. These are actual V2 observations, not recovered V1 values. V2 subsequently failed during vertex-group restoration, before its post-rebuild editor-state receipt; therefore no successful reset/readback is claimed from that run.

The separate group failure and bounded repair are reviewed in [RECONSTRUCTION-CRITIQUE](RECONSTRUCTION-CRITIQUE.md). Neither source recovery supplies final geometry, skin, coverage, clearance or appearance acceptance. No native process was launched by the critic.
