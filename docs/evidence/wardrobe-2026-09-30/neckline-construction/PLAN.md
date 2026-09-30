# Raised crew-neck construction — one isolated shape study

## New contract and reason

The current accepted44 images establish bra exposure at both side/front neckline islands. The left sample also has near-front cloth behind bra. The original rim is a continuous 20-edge loop, but several rear rim vertices have negative local normal-signed distances from the full body in authored rest (vertex 889: -8.53 mm). This is a nearest-surface sign witness, not a volumetric containment proof. The old 34-group support froze that region and cannot establish joint vest/bra clearance. This study replaces that support contract explicitly; old results and gates remain closed and unchanged.

The desired appearance is a slightly higher, continuous crew neckline that covers the foundation edges and blends broadly into the shoulders/chest. Start with the exact accepted44 garment, preserving its existing topology. This is one deliberately simple shape observation, not an iterative clearance solve or an asset promotion.

## Declared construction

- Recover original positional welds at 1e-7 m and the established 20-point rim. Use shortest source-edge distance from that rim. Allow all groups inside 80 mm geodesic distance to move, including the former rear guard. Keep groups at/beyond 80 mm exactly fixed. Require identical joints and weights within each weld.
- At each moving group, apply a 12 mm upward displacement plus 4 mm along its normalized mean source vertex normal, multiplied by quintic falloff `1 - (6t^5 - 15t^4 + 10t^3)`, where `t = distance / 80 mm`. These are authored design amounts selected before seeing a candidate; no sweep or subsequent retuning in this study.
- Keep the existing 20 rim points, topology, source triangle IDs, all 2377 vertex slots, UVs, joints, skin weights, bind transforms, materials, textures, body and foundation masks. No lining metadata, geometry deletion or foundation edit. Recompute incident vertex normals within original smoothing partitions; preserve normals outside the affected partition support. Preserve trousers and all other assets.
- Export at most one isolated Float32 GLB after integrity checks: finite data, displacement <=20 mm, exact protected bytes, no separated welds, no flipped/degenerate affected triangles. For this intentionally larger shape change, reject export if any affected face has area ratio outside [0.25,4] or orientation dot <=0.25. These are construction sanity bounds, not the old fitting thresholds and not appearance or clearance acceptance.

## Review and stop

Render the exact bytes through the real owner/loader against accepted44 at front, both 45-degree obliques and rear, with the same body, camera, lights and Brown hair. Root serializes captures and the independent critic reads actual originals. Record model/asset hashes, errors and disposal. The first scope is static shape usefulness: continuous neckline, reduced foundation exposure and smooth shoulder transition. Whole-surface body/bra/vest contact and new coverage/motion qualification are still required before any promotion; a good picture cannot pass those gates.

Retain both successes and defects, including any back-face gaps exposed by the new shape. Do not add lining or soften an acceptance rule after seeing this candidate. If this coarse 20-point deformation remains faceted, exposes foundation or creates poor collar form, close it as a shape study and consider explicit replacement topology/binding or a separate compatible foundation. Do not repeat parameter adjustments under this plan.
