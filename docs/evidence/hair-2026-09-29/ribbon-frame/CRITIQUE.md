# Independent critique: ribbon-frame-v1

Reviewed September 29, 2026, using captures dated September 30 UTC. Reviewer: hair_critic. Three actual image pairs were inspected directly. This review used read-only source and recorded numerical data; the reviewer ran no browser, GPU job, or asset generator.

## Disposition

| Claim | Decision |
| --- | --- |
| Sequential frame transport reduced card449's transverse rotation | **Demonstrated geometrically.** |
| That reduction creates a convincing local appearance improvement | **Inconclusive visually.** Local ribbons rearrange, but coherent flow is not clearly improved. |
| The candidate improves the hairstyle sufficiently for adoption or motion qualification | **Rejected.** Preserve as a diagnostic only. |

Do not continue small frame, seed-angle, or endpoint adjustments without a new discriminating witness. The successful nape-guide-v1 candidate remains a separate frozen result.

Input is the rejected posterior-cluster-v1, SHA-256 `de567a6307eea68731a6ad25467bf1c5c7840c4635941aec7dd9e6a8842155d4`.

Frame candidate SHA-256: `4c53ff879719d10b655d48e7d583cacddf2f43f17f61d3c6555984b052d4c0b6`.

## Actual image witnesses

All coordinates refer to the original 900 × 868 PNGs, with origin at upper left. Regions guide visual inspection; they are not exact visibility masks.

| Rejected-cluster baseline | Frame-only result | Observation |
| --- | --- | --- |
| [Rear-oblique](../../../../captures/hair-colour-2026-09-29/posterior-cluster-v1/neutral/casual-rear-oblique-medium-brown.png) | [Rear-oblique](../../../../captures/hair-colour-2026-09-29/ribbon-frame-v1/neutral/casual-rear-oblique-medium-brown.png) | Near the predicted x460–485, y465–500 region, narrow visible bands rearrange. The broader angular stack at x425–510, y400–540 still reads as disconnected pieces. I cannot establish a convincing clean-flow gain. |
| [Back](../../../../captures/hair-colour-2026-09-29/posterior-cluster-v1/neutral/casual-back-medium-brown.png) | [Back](../../../../captures/hair-colour-2026-09-29/ribbon-frame-v1/neutral/casual-back-medium-brown.png) | Some local crossing and brightness patterns change around x410–495, y455–545. The central patch, exposed upper backing, and low tongue remain. |
| [Right profile](../../../../captures/hair-colour-2026-09-29/posterior-cluster-v1/neutral/casual-right-profile-medium-brown.png) | [Right profile](../../../../captures/hair-colour-2026-09-29/ribbon-frame-v1/neutral/casual-right-profile-medium-brown.png) | The silhouette and overall impression are essentially unchanged. Diagonal bands across the more vertical side fall, approximately x205–400, y320–460, and broken crown edges around x300–425, y105–175 remain well outside the targeted lower posterior frame region. |

The visible local change establishes that this frame affects the rendered arrangement. It does not establish that excessive frame turn was the principal cause of the remaining patch, or that reducing the numeric angle is itself an appearance success. No new root seam is sufficiently clear in these views to justify an additional normal or seed adjustment.

## Controls and numerical result

The [source](../../../../tools/critic/bob-ribbon-frame-candidate.mjs) pins the input hash and transports the previous width axis successively across adjacent centreline tangent pairs. It changes only card449's non-root ribbon positions and their derived normals. Its original root-width skew is retained, and root-ring normals remain authored.

[Candidate report](../../../../captures/hair-colour-2026-09-29/ribbon-frame-v1/candidate-report.json):

- Ring2-to-ring3 width-axis turn: 69.8385° → 8.7426°.
- Maximum candidate adjacent width-axis turn: 15.2691°.
- Maximum centre difference: 0.00000186 mm.
- Maximum full-width difference: 0.00007087 mm.

[Numerical audit](../../../../captures/hair-colour-2026-09-29/ribbon-frame-v1/numerical-checks.json) correctly compares against posterior-cluster-v1, not the accepted asset. It reports 32 changed positions and normals, zero noncandidate live-vertex change, unchanged root rings and other attributes, and zero selected-card rest-body intersections. Its maximum live-versus-rest difference is 0.001921 mm; median groom arc remains 142.875 mm.

Across all three pairs, recorded clock, lighting changes, and applied color match. Only hair positions, velocities, and vertices differ within the recorded fixed state. FrameId/grain frame are 98, jitter index 5 of 31, history width 900. Capture status is `captured`, with empty errors.

The experiment holds centre paths and widths effectively fixed, so it is useful evidence about the frame mechanism. It is not a pure shading experiment: geometry, occlusion, and moved-vertex normals change together. Rest-body checks do not qualify moving contacts, hair/hair overlap, or the entire groom. The unmodified broad coverage arrangement from the rejected cluster is intentionally retained.

## Actionable finding: inspect the authoring flow before another geometry candidate

**Actual mismatch:** the frame result still contains the concentrated posterior stack, while the profile shows diagonal crossings and crown discontinuities far outside the five-card patch. Earlier root ablation also exposed a smoother backing and removed a low tongue, demonstrating another distinct contributor. One local patch cannot yet explain this distributed pattern.

### Alternative A — replace only the posterior coverage patch

Construct a deliberate local replacement, assigning inner coverage and outer flowing locks together and holding the surrounding groom fixed. Use the existing rear witnesses as acceptance regions. Replace the implicated geometry rather than overlaying a broad curtain.

**Tradeoff:** bounded authoring scope and a directly reviewable appearance goal. However, it will leave the profile and crown defects, can hide a common generation problem, and risks the broad panels, repeated teeth, and reopened slots already documented in the [September 13 studies](../../../HAIR-SHAPE-STUDIES-2026-09-13.md). A patch is a plausible eventual implementation unit; it is not currently a sufficient diagnosis.

### Alternative B — inspect the original authoring flow across a few representative cards first (recommended)

Trace one posterior root witness, one longer diagonal-card witness, and one crown/side witness through the generation stages. Keep this an inspection of a few fixed cards and stages, not a whole-groom parameter sweep or immediate rewrite.

Concrete source boundaries exist in [hair_cards.py](../../../../tools/figure-pipeline/hair_cards.py):

1. `grow_guide` (around line2508) integrates heading/gravity/curl and projects or attracts points to the body.
2. `draw_into_lock` (around line2015) blends toward a shared lock, then applies further per-point clearance restoration.
3. `ribbon_of` (around line2559) derives each ring's transverse frame from the tangent and radial outward direction, then applies twist and width.
4. `clamp_cards_off_the_body` (around line2780) independently pushes ribbon vertices to clearance and may perform radial rescue.
5. Export and the bob02 post-export fall, hem, and tail-release passes produce the shipped asset. Their required order is documented by [the hair manifest](../../../../assets/hair/manifest.json).

For each chosen card, record centres, both ribbon edges, segment turn, width-axis turn, and clearance displacement immediately before and after the applicable stages. The discriminating question is **where the first large discontinuity appears**. This can separate an already bent guide, a lock/clearance projection, a transverse-frame change, an edge-only clamp, and a later correction. Current source comments describe intended behavior; they are not evidence that a particular stage caused today's defect.

Pin seed/style/settings and establish which source version produced the original fixture before interpreting a reproduction. The known card281 hook predates later corrections; that provenance has not automatically been established for every other witness. The current manifest explicitly warns that direct regeneration omitting bob02's post-export passes restores known defects, so accepted assets must remain untouched.

**Tradeoff:** an extra diagnosis step before another visible candidate, but it can find a shared cause and prevent repeated local repairs. Scope expands to understanding the full authoring sequence, not to rewriting it. Once the first failing stage is demonstrated, the resulting implementation can still be limited to a posterior patch or a narrowly corrected operation.

### Execution status: stage trace deferred

Read-only inspection confirmed that `/opt/homebrew/bin/blender` resolves to `/opt/homebrew/Caskroom/blender/5.2.1/.homebrew-command-wrappers/blender`. That wrapper executes `/Applications/Blender.app/Contents/MacOS/Blender`, but both the application directory and executable are absent. A command wrapper's presence does not establish an available authoring runtime.

The original authoring runtime needs restoration and verification before an executable stage trace. No dependency installation, larger geometry replacement, or additional tiny frame/endpoint pass is planned tonight. The stage boundaries above remain hypotheses to inspect later; this review does not attribute the defect to an unexecuted stage. A separate hair-color product slice can proceed without treating these rejected geometry candidates as accepted assets.

## Stop rule

Archive the rejected cluster and frame diagnostic with their negative visual result intact. Do not interpret reduced geometric angles, zero rest intersections, or unchanged global medians as appearance acceptance. Reopen this local frame only if new evidence identifies a visible defect it can specifically resolve. The next useful evidence is stage attribution, not another small adjustment to these same five curves.
