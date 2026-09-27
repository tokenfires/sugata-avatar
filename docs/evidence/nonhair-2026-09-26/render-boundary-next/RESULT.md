# Two unchanged views — first observed disagreement at temporal resolve

The declared two-control collection completed once, with both owners retired and no browser
or GPU errors. **Exact PNG equality failed.** This is a completed diagnostic, not a renderer
fix, colour-feature qualification or asset promotion. Do not rerun this pair to seek equality.

All four observed scene attachments are byte-identical, including their native row padding.
The first differing observed boundary is TAAU resolve; its post-copy history colour is exactly
the same as that owner's resolve. Downstream bloom and grade targets also differ.

| Observed boundary | Changed logical texels | Changed bytes |
| --- | ---: | ---: |
| Scene output | 0 / 247,676 | 0 |
| Scene diffuse colour | 0 / 247,676 | 0 |
| Scene normal | 0 / 247,676 | 0 |
| Scene velocity | 0 / 247,676 | 0 |
| Temporal resolve | 166 / 570,276 | 362 |
| Temporal history after copy | 166 / 570,276 | 362 |
| Bloom final mip composite | 4,681 / 142,352 | 4,707 |
| Bloom first vertical blur | 82 / 142,352 | 99 |
| Encoded grade before RCAS | 2,451 / 570,276 | 2,619 |
| Encoded grade after RCAS | 4,061 / 570,276 | 4,374 |

These are exact stored bits, without float conversion or a new tolerance. The original
657×868 PNGs differ in 170 of 570,276 decoded pixels, 213 RGBA channel values, with maximum
absolute difference 5/255. Their alpha channels match. See `png-comparison-v4.json` for exact
hashes and the decoded-PNG bounds. Native texture-copy coordinates and PNG coordinates are
not assumed interchangeable.

Root and independent critic viewed both original images. They show the same clothed composition
and no discernible intentional change at normal display size. That visual observation does not
replace the failed equality criterion. Full native pose, camera, topology, masks, morphs and
physical state hashes match; indexed reset/settle/export histories match. All target owners,
descriptors, material graph, counters and camera values remain unchanged during the readbacks.
The eight retained warnings comprise the same four per owner: missing optional facial bones,
one zero-index draw, and two inline-TSL return warnings. Neither owner records an error.

This localizes disagreement to the observed temporal output or its **unobserved inputs/history**.
It does not prove a defect in TAAU arithmetic. Prior history colour, history lock, current and
previous depth, earlier frame attachments, and some temporal matrix uniforms were not captured.
Equal final scene buffers cannot establish equality of those inputs. The three earlier failed
attempts were recorder/inventory mistakes: a nonexistent balanced-tier AO target, an assumed
separate pre-bloom target, and a filename validator that rejected actual `diffuseColor` casing.
Each rejection remains preserved; none is evidence of a renderer defect.

The lossless packet `native-v4-evidence/` contains all 1,658 native files, including 20 raw
readbacks, 1,494 source archives, 138 distinct served bodies, both original PNGs, report and
collection seal. Receipt SHA256:
`6d225d56200c73b353174e966b68fd1a9b5a247d33ecce35659844a50322bdf6`.
Run `python3 docs/evidence/nonhair-2026-09-26/render-boundary-next/verify-native-v4.py` to replay
all artifact hashes and independently extract/count the exact logical bytes. The collection seal
explicitly retains `imageAdmission:false`, `causalAdmission:false`, `featureQualified:false`.

The source-bound protocol is in `PLAN.md`, code review in `CODE-CRITIQUE.md`, and actual native
review in `NATIVE-CRITIQUE.md`. No accepted asset, shader, dependency, hair behavior or product
default changed. A next investigation needs a separately declared witness for the missing
temporal inputs; extra settling, capture retries and threshold changes do not follow from this
result.
