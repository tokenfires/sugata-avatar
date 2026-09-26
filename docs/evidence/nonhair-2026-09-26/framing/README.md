# Responsive head-region framing — 2026-09-26

Direct, unimported navigation reproduced the crop. On the 390×844 mobile page, showcase portrait's selected head-skin vertices projected to X = −1.139…0.384, outside the visible −1…1 interval. Standalone portrait came within about three pixels of the left boundary. The camera remained 0.90961 m from its target with a nominal 26° field of view while the showcase canvas aspect fell to about 0.549. Full-body framing already fit. `baseline/` preserves six original direct-navigation views and measurements.

The two viewers now share a page-owned projection helper. It measures neutral head skin plus the existing authored card surface at or above the lowest head-skin vertex. Triangle intersections with that plane are included, so slanted card edges remain bounded. The fit derives `camera.zoom` from the actual projection aspect and a 16-CSS-pixel gutter; it keeps camera world position, target, orbit radius limits, lighting and the attention action's sampled point unchanged. It recalculates only after a viewport/aspect change or an explicit framing choice. Reset zoom follows the current viewport, and explicit reset/frame/angle choices clear pending OrbitControls damping through the public update path.

The final `accepted/report.json` records 18 passing native WebGPU browser groups and ten screenshots, with source and asset hashes. An independent post-step `body.getVertexPosition` measurement rereads 4,231 current head-skin vertices; mobile bob02 head X is now −0.693…0.234, and bob01 is −0.599…0.202. These current skin bounds pass the gutters independently of the cached authored-card proxy. Both bobs retain zoom 1 and 26° effective FOV at desktop; full-body projection remains unchanged. At mobile, the final effective FOVs are approximately:

| Viewer | Chin-length bob | Long bob |
| --- | ---: | ---: |
| Portrait | 36.30° | 41.54° |
| Wardrobe portrait | 41.56° | 47.40° |

The wider vertical view is the composition tradeoff for keeping the whole head region visible in a tall, narrow canvas. This changes projection only; it does not move the camera or alter perspective relationships.

The final head-region measurement includes 17,360 original card vertices plus 346 plane intersections for the chin-length bob; 156 lower vertices are excluded. For the long bob it includes 13,877 vertices plus 1,756 intersections; 3,639 lower vertices are excluded. Long lower tails may still leave the close portrait crop. Transparent card borders make this conservative. GPU-deformed hair excursions and all-motion silhouette containment are not qualified.

Actual drag, wheel dolly, reset, damping, Side selection, body/portrait transitions and repeated resize roundtrips passed. Resize retained the same active attention hold, target, expression envelope and clock. Four final zero-time frames verify the projection stabilizes after temporal antialiasing settles the actual render-target aspect. Browser console, page and network errors were empty. The all-page build passed with the existing large-chunk advisory; its output is saved as `accepted/build-pages.log`. Five focused CPU groups plus existing showcase settings/preset checks passed.

`rejected/` preserves two proved alternatives: fitting against rounded CSS aspect lost a fraction of a gutter pixel, and fitting the full long-bob card envelope changed accepted desktop composition. Neither was silently accepted. This slice does not change any hair/body/garment asset, renderer core, lighting or attention implementation, and does not claim garment fit, representative builds, hair quality, performance or AAA appearance.
