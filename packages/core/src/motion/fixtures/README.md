# HairSurface regression fixture

`hair-surface-v1.json.gz` is a 299,048-byte gzip JSON fixture with SHA-256 `59065083b8a547d6f0e93bd9eec2020087e1389e08eb5511e16ca5da7d3dd578`. The selftest pins that digest before decoding. No ignored capture directory is needed to run it.

It retains independent frozen-v2 outputs for 512 synthetic nearest queries and 320 static queries across the five existing body bakes, packed array hashes for those bakes, and two actual saved g050 world-space patches (frames 0000/0420) with 128 selected hair queries and endpoint/materialized-midpoint results. It includes only patch data needed for this CPU gate; full portraits/hair captures are omitted. Original edge masks were upgraded with the existing v2 incident-boundary vertex bits. Captured positions and normals were unchanged.

The JSON records the prior module SHA, source capture SHA values and the existing tracked anatomy fixture SHA. Static body geometry is read from checked-in figure assets and its file hashes are verified. This fixture preserves a regression baseline; it does not accept an anatomical contact domain or hairstyle. Update it only with an explicit comparison to the prior proof, not by regenerating expected results from a changed production implementation.

## Core segment/contact primitives

`hair-surface-primitives.json` (SHA-256 `681ec9e452ed7fc2515615e0eafecfefbd164033a7d1ace80f773a4b2b18c129`) preserves 20 original and 15 near-parallel inputs, with source fixture/capture hashes. `hair-segment-oracle.mjs` is the independent CPU feature oracle from the frozen audit, with only its header updated; the selftest cross-checks it against 300 deterministic Three point/triangle convex minima. `hair-segment-v1-control.txt` retains only the historical segment-parameter function for an isolated browser rejection control. The normal rejection control changes only the old numerical threshold in the served test response. None is imported by production modules; no captures directory is needed to run the regression.

## Avatar canonical contact golden

`avatar-hair-contact-canonical.json` (SHA-256 `8855a92fbf452b279b1f7fade2aecb39da63ca7a750044814572ec44348e2e36`) retains exact array hashes for the original core nod smoke at0/.1seconds, before the bind-aware transform integration. It records the old capture/source/asset hashes. The Avatar WebGPU selftest reproduces its corrected groom from the tracked original LFS fixture and the portable long-fall tool; no ignored captures are loaded at runtime. Canonical GPU bit identity is deliberately stricter than the independent native-root geometric tolerance and must not be automatically rebaselined on a different engine or device.

## Triangle-bound predecessor parity

`hair-triangle-bounds-adversarial.json` (SHA-256 `949c1681e282a1e70f36062989822fa8557ed0c2b236fe091786e94648bc80c4`) preserves the exact original 18 adversarial records. They have 17 unique names/geometries because the zero-origin ULP record is repeated; the duplicate is not independent coverage. Combined with the existing 35 primitive inputs, four seed states and selected moving-panel alphas, they produce 732 additional direct-point/segment queries. The source-control helper removes exactly the two promoted guards from served production source to make a distinct predecessor. The portable gate fails when production guards are absent or only partly installed. See `docs/HAIR-SURFACE-BOUNDS.md` for reproduction and limits.
