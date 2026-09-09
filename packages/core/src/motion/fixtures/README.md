# HairSurface regression fixture

`hair-surface-v1.json.gz` is a 299,048-byte gzip JSON fixture with SHA-256 `59065083b8a547d6f0e93bd9eec2020087e1389e08eb5511e16ca5da7d3dd578`. The selftest pins that digest before decoding. No ignored capture directory is needed to run it.

It retains independent frozen-v2 outputs for 512 synthetic nearest queries and 320 static queries across the five existing body bakes, packed array hashes for those bakes, and two actual saved g050 world-space patches (frames 0000/0420) with 128 selected hair queries and endpoint/materialized-midpoint results. It includes only patch data needed for this CPU gate; full portraits/hair captures are omitted. Original edge masks were upgraded with the existing v2 incident-boundary vertex bits. Captured positions and normals were unchanged.

The JSON records the prior module SHA, source capture SHA values and the existing tracked anatomy fixture SHA. Static body geometry is read from checked-in figure assets and its file hashes are verified. This fixture preserves a regression baseline; it does not accept an anatomical contact domain or hairstyle. Update it only with an explicit comparison to the prior proof, not by regenerating expected results from a changed production implementation.
