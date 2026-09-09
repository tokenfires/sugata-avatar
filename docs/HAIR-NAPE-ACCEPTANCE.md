# G050 inner-nape acceptance evidence

The calibrated nine-curtain domain clears the measured opaque nape defect while preserving the other 487 chains in matched captures. Evidence now covers the original 22 paired poses and 85 additional forest poses. The measured groom and body match the installed g050 assets from integration commit `c871ed9`. Strict whole-body clearance and continuous filtered visibility remain open.

The selected cards are 188, 193, 198, 201, 202, 211, 217, 223 and 272. Their 2076-triangle domain retains the original 1872 neck/shoulder triangles and adds 204 triangles selected from dominant neck skin influences. The other 487 cards retain the original domain. Earlier broad-domain and fixed outward-displacement failures remain valid evidence; this result does not rehabilitate them.

| Check | Original paired proof | Additional forest proof |
| --- | --- | --- |
| Captured poses | 13 natural over 12 s; 9 nod+ over 4 s | 17 each: nod−, yaw±, tilt±; 8 s per arm |
| Opaque texel-center evaluations | 20,354,620; zero negative beyond 0.1 mm | 78,642,850; zero negative beyond 0.1 mm |
| Minimum opaque sample clearance | +1.079 mm | +2.428 mm |
| Selected-nine full-body pairs | Five retained upper-card pairs in six nod+ poses; opacity qualified | Zero in every pose |
| Face / selected nape domain | Zero pairs | Zero pairs |
| Other-chain comparison | All 487 centers, velocities and GPU vertices exact in all 22 poses | Exact in all 17 matched nod− poses; yaw/tilt have no matched baseline in this batch |
| Full cap positions | Exact in all paired poses | Exact in matched nod− |
| Ribbon/body pair identities | 136 instances removed; none added | Nod−: 392 removed; none added |
| Roots / halfwidth / authored cut | Preserved | Preserved |
| Minimum complete first-span norm margin (rounded) | +3.672 mm | +2.430 mm |

The strict full-body gate still fails. The broader yaw arms retain only root-layer pairs. Nod− and tilt also retain cap and outside-group curtain contacts. Reverse nod proves those outside-group contacts and link metrics are exactly inherited from the original domain. Its original-neck residuals belong to cards 281/395 at span 0; card 395 has an original-domain fixed-root norm-volume conflict and a 0.928 mm link error. Tilt+ reaches 1.370 mm (22.37%) on card 214; tilt− reaches 1.124 mm (21.67%) on root-layer card 31. Both are outside the selected nine, but no matched tilt baseline is claimed.

Within the selected nine, reverse nod's maximum link error is 0.190363 mm on card 272 span 1 (1.69% of its 11.247 mm rest length). Its matched chain maximum was already 0.186634 mm in the baseline. The baseline nine-group maximum was 0.231078 mm; the largest individual chain-max increase is 0.078123 mm on card 217. These are measured limits, not a declaration of exact length preservation or a newly invented tolerance.

The original 22-pose proof retains root contacts, 20–30 nod cap pairs and the five upper 217/272 pairs. The five upper-card pairs have zero alpha in their base crossing footprints; higher-mip bounds for 272 remain qualified. The broader reports likewise preserve every root/cap/curtain pair even when base-atlas alpha is low. No opacity exception turns the strict geometric gate into a pass.

Opacity checks enumerate every alpha > .5 texel center in all selected UV triangles at decoded base and CPU box mip 1–3. They use actual GPU ribbons and the full same-frame posed body, including wholly buried samples. Counts include shared diagonal samples and repeated reset poses. They do not certify continuous filtered visibility or actual screen LOD; nearest-normal sign is a local diagnostic. Caps use explicitly labeled renderer-equivalent CPU skin/morph. Matched final nod− rear and side views show no obvious new broad ledge, while diagonal card layers and uneven nape ends remain visible.

The forest implementation packs both independent BVHs into three buffers and restores one all-496 stage per substep. Its separate 720-frame control preserves final centers, velocities, rebuilt vertices, head matrix and step count exactly. Serialized update-to-GPU median improves 22.0→15.1 ms, p95 23.3→16.7 ms; fully allocated storage is 35 buffers / 7,177,952 bytes and returns to zero after disposal. Timestamp readback, rAF and compositor waits are excluded. This is not a general interactive 60 FPS claim.

The 85-pose capture batch records raw candidate start/end hashes and actual transformed owner/data responses. A separate two-state follow-up captures all three actual served forest dependency responses. That qualification does not retroactively rewrite the historical provenance. Geometry and opacity results remain explicitly tied to their recorded source bytes.

Evidence and replay:

- [Compact ledger](evidence/hair-nape-acceptance-2026-09-09.json) retains both proof scopes, hashes and measured limits.
- [Original analysis](../captures/bob01-g050-nape-acceptance-2026-09-09/README.md) and [original paired captures](../captures/bob01-g050-nape-motion-2026-09-09/README.md) preserve the 22-pose result.
- [Broader forest analysis](../captures/bob01-g050-forest-acceptance-2026-09-09/README.md) contains full geometry/opacity reports, matched nod− comparison, qualified smoke and source snapshots. Its verifier binds results to the recorded frame hashes.
- [Broader captures](../captures/bob01-g050-forest-motion-2026-09-09/README.md) retain 104 states and 80 orientation views: 85 candidate, 17 baseline and two qualified smoke states.
- [Forest timing ledger](evidence/hair-body-contact-forest-frame-cost-2026-09-09.json) records the independent optimization control.

Archives are local ignored evidence. Tracked ledgers preserve their identities; missing archives remain unavailable, never an assumed passed rerun. The original 22-pose exhaustive proof was not repeated for the broader checker extension.
