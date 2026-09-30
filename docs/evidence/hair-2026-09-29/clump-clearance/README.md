# Two-card source clearance diagnostic

**The geometric mechanism is confirmed; the groom remains experimental.** Returning the pre-clearance clump blend for cards322/449 removes their sharp guide bends while the original final body clamp remains enabled. The actual images show a small local rearrangement, with the wider rear disorder still prominent. No accepted asset changes.

| Fresh accepted control | Two-card source intervention |
| --- | --- |
| ![Control rear oblique](../../../../captures/bob-clump-clearance-v1/control/casual-rear-oblique-medium-brown.png) | ![Source intervention rear oblique](../../../../captures/bob-clump-clearance-v1/neutral/casual-rear-oblique-medium-brown.png) |

## Intervention

The [exact source trace](../authoring-trace/README.md) established that card322's largest bend enters through guide clearance; card449 is another strong witness. The diagnostic `probe-bob-clump-clearance.py` calls original `draw_into_lock` with `body=None` only for these two cards, retaining the original blend, RNG draws, ribbon construction and final vertex clamp. This is a mechanism ablation, not a production proposal to remove clearance constraints.

`isolate-bob-clump-clearance.mjs` verifies that all other rebuilt card/cap vertices and normals match the preserved original, and transplants only these two source outputs onto the accepted post-export groom. Both UV sets, skin weights and joints are identical. The source exporter changes ten selected triangle records; this re-triangulation is preserved and measured explicitly.

Candidate SHA256: `32e767725cf9c1f3e752e906d5f481fd0f0db03720575c1eb1a31762f0786da9`.

| Scoped measurement | Result |
| --- | --- |
| Changed positions / normals |42 /44|
| Changed triangle records |10, all within selected cards|
| Card322 maximum finite guide bend |53.84°→6.36°|
| Card449 maximum finite guide bend |63.33°→17.06°|
| Independent selected rest triangle/body pairs |0 across64triangles|
| Minimum selected rest vertex clearance |3.750mm|
| Other live vertices in all three captured views |Exact match|
| Maximum selected live displacement |23.093mm|

Root rings may change as part of this source intervention. Zero selected rest crossings do not qualify motion, garments, hair-hair contact or the whole groom. The bend statistic is not an appearance score.

## Native comparison and limits

Fresh control and candidate each have back, rear-oblique and right-profile images, medium-brown diagnostic material and neutralized light chromaticity. All recorded nongeometry controls match, including camera, rig, time, renderer clocks, material and lights. Only whole-groom geometry/velocity hashes are excluded from equality because the selected cards changed. Other live vertex arrays match exactly.

Root inspected actual candidate back/rear-oblique images and the fresh rear-oblique control. The [independent critic](CRITIQUE.md) inspected all three matched views and rejects adoption: a small pale triangular region appears in the back view, ownership unproven, while the wider crossing structure remains. Root selected one separately frozen posterior support-envelope prototype over a wider application of the same clearance-stage bypass. No more local card passes are justified.

Reports and source snapshots pin commands, PIDs, times and hashes. See [summary](summary.json), [archive manifest](archive-manifest.json) and [recovery checkpoint](../../../OVERNIGHT-2026-09-29.md). Raw captures remain local and ignored by Git.
