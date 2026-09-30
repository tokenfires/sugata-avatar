# Independent critique — original bob authoring trace

## Decision

**The trace is a valid reconstruction of the original fixture's geometry. Proceed with one isolated source-stage diagnostic for cards 322 and 449 before changing the broader representation.** Retain their original pre-clearance clump blends, original ribbon construction and RNG draws, and the complete final body clamp. Transplant only those two resulting cards onto the accepted asset so its unrelated post-export corrections remain intact. This is a diagnostic proposal, not a production clearance bypass or an accepted hairstyle.

The competing alternative is a shared smooth support envelope for the posterior guides, with a continuous ribbon frame and a separate check against the actual body. That has stronger potential to address the widespread problem, but introduces enough changes that it should follow the smaller discriminating experiment unless a new constraint makes the small experiment uninformative.

Do not reopen the rejected five-card endpoint or one-card width-frame tuning loop. The new evidence identifies original source stages, which gives a different and testable intervention.

## Observer and correspondence review

I read [the archived observer](../../../../captures/bob-authoring-trace-v1/source/tools/critic/trace-bob-authoring.py) and the production functions it wraps. I found no apparent RNG or geometry interference in the wrappers:

- `grow_layer` calls the original once and leaves its order intact. The production layer RNG is seeded by `hair_seed * 1000 + HAIR_LAYERS.index(layer)` (`hair_cards.py:2068`). Card order follows `grow_layer` output followed by `cards.extend`, at lines 1650–1654.
- The observer's pre-clearance blend reproduces the original `point.lerp(lock_guide[index], tightness * s ** CLUMP_POWER)` expression at lines 2034–2037. It performs no random draw. Original draw, ribbon, and clamp functions are each called once.
- The card trace is collected at `ribbon_of`, where the production code consumes twist and width random values at lines 2567–2568. The observer does not redraw those values or replace the ribbon result.
- Array snapshots are copied from vector values. The captured ribbon rings equal the corresponding pre-clamp mesh vertices exactly for all 496 cards, independently checked. Every card has 17 rings.

I independently decoded the rebuilt and fixture GLBs with a separate Python accessor reader. `POSITION`, `NORMAL`, `TEXCOORD_0`, `TEXCOORD_1`, `JOINTS_0`, and `WEIGHTS_0` have identical finite values and matching schemas. Indices, nodes, skins, scenes, and inverse bind matrices also match. The recorded post-clamp Blender positions convert with `[x,z,−y]` to all 52,548 exported position components exactly. The object matrix is identity and the card vertex base is 652. This resolves the potential coordinate and ordering ambiguity for this particular run; it is not a general promise that every Blender export preserves vertex order.

The [analysis-v2 report](../../../../captures/bob-authoring-trace-v1/analysis-v2.json) additionally records exact lock extras. The raw GLB hashes differ—original `25376e139cd498bf2bdb36dfdc6df80cb8f5f4ec026ca033ca2dd1cae23913d4`, rebuilt `0d21439f6368e298845eb6b827106f0d9fb84266cf56d703d139fbe124c58821`—so the result is **geometry/binding correspondence**, not identical artifact bytes or newly reviewed rendered appearance. The six named witness cards have zero positional changes between original export and accepted asset. Other accepted cards do contain post-export edits and must be preserved during a local experiment.

## Finding 1 — the guide-clearance stage introduces specific sharp bends

The geometric witness is stronger than a correlation with a tunable parameter:

| Card | Original grown/cut maximum turn | Before guide clearance | After guide clearance | After final vertex clamp |
| --- | ---: | ---: | ---: | ---: |
|322, surface|6.189°|6.363°|53.840° at ring 2|53.840°|
|449, veil|14.771°|13.912°|61.994° at ring 2|63.332°|
|276, body|4.741°|4.315°|4.315°|20.528°|
|281, body|14.650°|49.261°|49.261°|49.261°|

I recomputed the guide angles independently from the captured point arrays. Cards322/449 contain no zero-length guide spans in these stages. Their source curves are linked through exact assembly/export correspondence to accepted geometry.

For card 322, guide clearance moves only rings 0, 1, 2 by 4.7293, 3.4129, 3.9501mm respectively. The subsequent vertex clamp moves **no vertex**. That makes it a particularly clean witness: the abrupt ring 2 bend is introduced by guide clearance and survives unchanged. Its root moves despite the blend weight being zero at the root. Therefore the trace does not support blaming only the clump attraction strength.

Card 449 is a more extensive witness. Guide clearance moves multiple rings, reaching 14.7955mm at ring 14. Its original radial ribbon then has a 92.20° adjacent width-axis turn. That angle is a geometric observation, not proof of a separately visible crease; the earlier frame-only experiment did not establish a convincing appearance gain.

The [five-card ablation images](../posterior-cluster/CRITIQUE.md) already link the group containing 322/449 to visible rear diagonal structure. They do not assign every pixel to either card individually. The source trace identifies where these cards acquire bends; a new intact rendered comparison is still needed to assess whether changing that stage improves the visible region.

### Two alternatives and tradeoffs

**A — recommended: the proposed two-card mechanism ablation.** Return the captured pre-clearance blends for 322/449 in one original-source run, retaining their existing tightness values, lock guides, random draws, ribbon construction, and the full final body clamp. Keep all other cards unchanged in the final accepted-asset transplant. This isolates whether the larger per-layer guide standoff—22.5mm for 322 and 20mm for 449—creates visible distortion that the final 3.5mm body-distance floor does not require. It preserves the production construction and gives a precise prediction: the ring 2 turns should fall toward the pre-clearance values before final clamping; the final clamp may either preserve that continuity or reintroduce local distortion.

Tradeoffs: the resulting card can move inward or lose part of the intended volume. The final clamp operates on vertices, so a nominally clear result can still have triangle/body intersections. Those selected triangles need an independent body audit; a lower centreline angle is insufficient. This is also a small visual contribution and cannot repair all rear crossings.

**B — broader alternative: a shared smooth support envelope.** Author neighboring posterior guides around one smooth envelope that supplies coherent directions and volume, then enforce clearance against the actual body independently. Carry ribbon widths and frames with the guide rather than relying on unrelated pointwise push-outs to determine the visible shape. This could address the widespread short-root and outer-card pattern together. Actual motivation extends beyond 322/449: root card 24 rises from 20.221° after guide clearance to 63.110° after vertex clamp, and root card 40 rises 34.310°→66.105°, with a 20.598mm maximum vertex-clamp displacement on card 40.

Tradeoffs: an envelope is a new representation and needs explicit coverage, cut, volume, body-clearance, and view checks. It can produce broad panels, slots, or excessive smoothness—the earlier curtain experiments are relevant controls. It changes more than one mechanism and costs more to attribute. Preserve the originals and the isolated nape lead while investigating it.

### Interpretation and stop conditions for alternative A

Record the selected cards at the same stages as this trace. Preserve their identifiers and establish the final transplant's isolation by comparing all nonselected positions, normals, UVs, indices, skin data, and relevant runtime colliders. Reuse the same production material and matched native camera/pose for the before/after images.

- **Source effect absent:** if the sharp turn persists before final clamp, recheck the intervention and mapping; do not tune endpoints to force the predicted result.
- **Final clamp restores the distortion:** that is evidence that bypassing the larger guide standoff alone is insufficient. Move toward the coherent support-envelope question or retain the current asset; do not begin a standoff sweep.
- **Angles improve but visible appearance does not:** reject adoption and preserve the experiment, as with the earlier frame-only probe. A numerical continuity gain is not a beauty score.
- **Visible improvement with retained rest clearance:** freeze the new candidate for subsequent intact-view and motion qualification. Static source correspondence and zero rest contacts still do not authorize default promotion.

Changing `clump` to zero is not an equivalent isolation. In `draw_into_lock`, lines 2031–2032 return the guide immediately when tightness is zero, skipping both attraction and subsequent clearance. Two defensible choices are the selected pre-clearance-blend ablation above, which preserves attraction, or a separate attraction-strength experiment that explicitly retains the same clearance stage. The latter tests a different cause and is less well targeted to the current 322 witness.

## Finding 2 — collapsed spans needed explicit treatment in the analysis

The original [analysis implementation](../../../../captures/bob-authoring-trace-v1/analyse-bob-authoring.mjs), `angle`/`shape`, divides by the product of neighboring segment lengths without a zero-span guard. Card 25's post-clearance centres at rings 5 and 6 are exactly identical:

`[-0.04184485971927643, 0.029884690418839455, 1.6218444108963013]` in Blender coordinates.

Its original output consequently serialized `maxBendDegrees: null` and the misleading `maxBendRing: 0`. That is an undefined angle around a collapsed segment, not evidence of a straight or smooth guide. Other cards have the same problem. A maximum alone also becomes unstable when a very small span changes direction due to Float32 rounding.

Two alternatives were provided:

1. **Chosen: retain raw points, report zero/near-zero spans and undefined turns separately, and compute a clearly labeled maximum over only defined turns.** This preserves evidence of collapse and allows the nondegenerate 322/449 comparisons to continue. Its limit is that a finite maximum is no longer a complete descriptor of the curve, so the collapsed-span list must accompany it.
2. **Deduplicate or resample a separate diagnostic copy, preserving the raw trace.** This gives a useful shape measure independent of repeated point samples, but changes sampling and can hide the original collapse. It must be separately labeled and cannot silently replace the source evidence.

The [corrected analysis-v2 source](../../../../captures/bob-authoring-trace-v1/analyse-bob-authoring-v2.mjs) implements choice 1 with a 1e−9m segment threshold and explicit undefined-turn arrays. I inspected its output: card 25 now records `zeroOrNearZeroSegments:[5]`, `undefinedBendRings:[5,6]`, and a finite maximum 21.0156° at ring 9. The first analysis is preserved. This resolves the instrumental concern for subsequent interpretation; it does not repair the geometry.

For aggregate prose, distinguish these finite-turn maxima from collapse counts and state the median convention. Using the conventional mean of the two middle values, the 78 root-card medians are 8.7012° before guide clearance, 25.9862° after it, and 35.6007° after final clamp. An upper-middle percentile convention yields slightly different values. Both show a broad contribution, but neither should make the collapsed span disappear from the account.

## Other limits retained

- `grownToCut` already includes root-direction calculation, guide integration, per-step body projection/hug, length adjustment, cut, and resampling (`hair_cards.py:2415–2462` and 2508–2556). A bend present in that stage establishes “before clumping,” not which of those earlier operations caused it. The current clean 322/449 witness does not require reopening all those sub-stages.
- `signed_distance_to` uses `BodySurface.normal_at`, which interpolates vertex normals (`hair_cards.py:1866` and 2876–2882). Flat face-normal discontinuity is not an established explanation.
- The final clamp's 1399 moved count accumulates operations across passes (`hair_cards.py:2815–2825`). I count 1397 distinct vertices changed between captured before/after arrays; zero radial rescues are reported. The corrected analysis already explains the operation-count limit.
- The identical post-clamp mapping is strong evidence that the observer did not perturb the original result, but it does not provide a new rendered appearance review. Use the existing native ablation witnesses and the forthcoming matched diagnostic images for that separate question.
- Card 281's strong turn already enters during blending. Its isolated nape repair and measured distal-release lead remain frozen. Do not fold them into this two-card clearance-stage experiment.

No native Blender, browser, or GPU job was run by the critic. Only this assigned critique file was written.
