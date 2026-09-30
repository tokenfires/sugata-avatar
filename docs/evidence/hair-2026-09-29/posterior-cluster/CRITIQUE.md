# Independent critique: posterior-cluster-v1

Reviewed September 29, 2026, using captures dated September 30 UTC. Reviewer: hair_critic. Direct image inspection and read-only source/numeric analysis; no reviewer browser or GPU job.

## Decision

**Reject posterior-cluster-v1 as an appearance improvement.** Preserve its exact bytes and records as a diagnostic. It has not earned motion qualification or incorporation into the default asset. The successful card281 nape candidate is separate and remains unchanged.

Candidate SHA-256: `de567a6307eea68731a6ad25467bf1c5c7840c4635941aec7dd9e6a8842155d4`.

The five-card removal confirms that the selected cards contribute to the lower diagonal crossing. Redirecting their centre paths reduces that crossing but concentrates broad, angular ribbons in one posterior strip. This does not achieve the reference's coherent curved downward flow.

## Actual visual witnesses

Coordinates refer to the original 900 × 868 PNGs, origin at upper left. These are approximate regions for direct inspection, not pixel-level ownership labels.

| Evidence | Observation |
| --- | --- |
| [Original rear-oblique](../../../../captures/hair-colour-2026-09-29/attribution-v1/casual-rear-oblique-medium-brown.png) → [five-card ablation](../../../../captures/hair-colour-2026-09-29/long-cluster-ablation-v1/casual-rear-oblique-medium-brown.png) | Removing cards 276, 285, 322, 380, and 449 reduces bands crossing approximately x330–515, y390–550. Other crossings and the root-layer tongue remain. |
| [Candidate rear-oblique](../../../../captures/hair-colour-2026-09-29/posterior-cluster-v1/neutral/casual-rear-oblique-medium-brown.png) | A concentrated vertical angular stack appears around x425–510, y400–540. The transition into this strip remains visibly disconnected from the surrounding paths. |
| [Back ablation](../../../../captures/hair-colour-2026-09-29/long-cluster-ablation-v1/casual-back-medium-brown.png) → [candidate back](../../../../captures/hair-colour-2026-09-29/posterior-cluster-v1/neutral/casual-back-medium-brown.png) | The candidate replaces some diagonal coverage with a crowded central/lower strip, approximately x405–495, y410–545. It does not make the full rear flow coherent. |
| [Candidate right profile](../../../../captures/hair-colour-2026-09-29/posterior-cluster-v1/neutral/casual-right-profile-medium-brown.png) | The surviving diagonal paths, segmented rear surface, and hooked endpoint remain evident. These were not all targeted by this candidate. The hook's presence is expected because the candidate is independent of the successful card281 experiment. |

All five images above were directly inspected. The narrower claim that some lower diagonal bands decreased is supported. A claim that the bob now has a clean posterior shape is not supported.

## Controls and numerical limits

Both ablation views exactly match the original attribution capture's fixed state, clock, applied material color, and lighting changes. The ablation removes 160 triangles and retains the cap.

For all three candidate views, the only changed fixed-state fields are hair positions, velocities, and vertices. Clock and applied color match the baseline; report status is `captured`, with no recorded errors. The numerical audit reports 160 changed position vertices and normals, preserved root rings and other attributes, zero noncandidate live-vertex displacement, and zero selected-card/body rest intersections. Median groom arc remains 142.875 mm. Minimum changed-vertex signed rest clearance is 5.738 mm.

These checks establish isolation and sampled rest-body behavior. They do not assess hair/hair overlap, establish all-motion clearance, or override the visible appearance failure. An unchanged global median arc can coexist with major changes to five local paths.

See [candidate report](../../../../captures/hair-colour-2026-09-29/posterior-cluster-v1/candidate-report.json) and [numerical checks](../../../../captures/hair-colour-2026-09-29/posterior-cluster-v1/numerical-checks.json).

## Source witnesses: centre paths alone are an incomplete model

The [recipe](../../../../tools/critic/bob-posterior-cluster-candidate.mjs) preserves each root ring and original tip height. Lines 31–38 place the five guide curves in their roots' posterior sectors. Lines 40–47 rotate each ring's original offset independently from its source tangent to its new tangent. This preserves width magnitudes and can retain substantial source roll variation. It is not sequential parallel transport of one coherent ribbon frame.

Two concrete measurements expose why another endpoint adjustment would be a weak next step:

1. **Card276 is broad relative to its new path.** Its arc changes from 65.752 mm to 29.943 mm while widths remain 24.95–35.46 mm. The maximum width exceeds the new arc length. Other selected paths also shorten while preserving broad widths.
2. **Card449 retains a sharp transverse turn.** The angle between its width axes at rings 2 and 3 is 92.20° in the source and 69.84° in the candidate. Those candidate centres project near (468.6,466.9) and (469.3,470.4) in rear-oblique. The candidate centreline's maximum segment turn is only 21.42°, so centreline smoothness alone does not describe this ribbon. This is a geometric witness; occlusion and alpha mean it is not proof that this one frame change causes every visible facet.

Candidate tip centres for cards 276, 285, 380, and 449 concentrate within roughly x457–472 in the rear-oblique view. Their broad widths overlap around this narrow range. The new evidence calls for investigating ribbon frames and coverage, not shifting these same five endpoints back and forth.

### Reproduce the frame/width measurements

From the repository root, this read-only Python calculation uses archived geometry. A width axis is the right vertex minus the left vertex for a ring. The packed geometry excludes the cap; each card has 17 rings and two vertices per ring.

```python
import json, math
from pathlib import Path

base = Path('captures/hair-colour-2026-09-29')
paths = {
    'source': base / 'attribution-v1/casual-back-geometry.json',
    'candidate': base / 'posterior-cluster-v1/neutral/casual-back-geometry.json',
}
def sub(a, b):
    return [x-y for x, y in zip(a, b)]
def length(v):
    return sum(x*x for x in v) ** .5
def angle(a, b):
    cosine = sum(x*y for x, y in zip(a, b)) / (length(a)*length(b))
    return math.degrees(math.acos(max(-1, min(1, cosine))))

for label, path in paths.items():
    g = json.loads(path.read_text())
    for card in [276, 449]:
        centres = [g['restCentres'][(card*17+r)*3:(card*17+r+1)*3]
                   for r in range(17)]
        axes = []
        for r in range(17):
            k = (card*17+r)*6
            axes.append(sub(g['restVertices'][k+3:k+6],
                            g['restVertices'][k:k+3]))
        widths = [length(v)*1000 for v in axes]
        arc = sum(length(sub(b, a)) for a, b in zip(centres, centres[1:]))*1000
        print(label, card, 'arc mm', arc, 'width range mm', min(widths), max(widths),
              'ring2-to-ring3 width angle', angle(axes[2], axes[3]))
```

## Two concrete alternatives

### A. One frame-only diagnostic on card449 — recommended bounded next probe

Use the rejected candidate as the input. Freeze its centreline and per-ring width magnitudes. Preserve the root ring, then construct a smoothly transported width frame instead of independently rotating each source offset. Leave the other four redirected cards and all remaining geometry unchanged.

**Prediction:** reduced local angular folding near rear-oblique x460–485, y465–500. Require actual visible improvement in that region; reduced width-axis turn by itself is not enough. This probe does not claim to fix the broad cluster overlap.

**Tradeoff:** narrow, interpretable mechanism test with minimal scope, but limited potential appearance gain. It can fail visually because the card is occluded or because overlap and alpha dominate. A successful local result would establish only that local mechanism.

### B. Replace the five-card cluster as a deliberately designed coverage patch

Assign inner coverage and outer flowing locks explicitly; design widths, spacing, transverse frames, and paths together. Keep the surrounding groom fixed. Replace the implicated patch rather than placing another broad curtain over it.

**Prediction:** coherent downward coverage through the targeted lower posterior region without concentrating multiple broad ribbons in the same strip.

**Tradeoff:** directly addresses the observed footprint problem, but introduces more authoring choices and qualification work. The [earlier curtain studies](../../../HAIR-SHAPE-STUDIES-2026-09-13.md) already document flat panels, repeated teeth, and reopened slots. Those outcomes are explicit rejection conditions here, not reasons for another global width, length, or curtain sweep.

Neither alternative warrants changing the accepted asset or the frozen nape-guide-v1 candidate. Do not repeat or reverse the current five-curve placement recipe without new discriminating evidence.
