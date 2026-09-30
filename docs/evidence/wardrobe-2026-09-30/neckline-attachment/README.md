# Local neckline attachment: declared closure stops at the lower hem

The read-only study found **no admissible attachment cycle under its declared rule**. It grew from 240 faces to 1,219 of the shirt's 2,524 faces and reached the lower hem. Both sleeve openings remained untouched. No shape was constructed, no asset changed, and no appearance improvement is claimed.

This closes this particular method without changing its seed, numerical guard or growth rule. It does not establish that every possible local repair or different attachment contract is impossible.

## Why this study was run

The actual Neutral portrait still shows grey foundation islands beside the collar. The prior diffuse-tag/ray evidence identifies retained bra there. The rejected raised-neckline candidate improves the front but leaves exposed foundation and hollow side openings in the obliques. Its fixed vertex 312 lies inside the full body, so that fixed attachment cannot produce an entirely exterior patch.

The [plan](PLAN.md) therefore asked whether the existing mesh contains a usable replacement boundary with a completely clear retained-side incident strip. It used the exact accepted garment and recorded pose, not the rejected displacement. The full body is the containment target; only actually retained foundation triangles are separation targets.

## Exact observations

| Check | Result |
| --- | --- |
| Original and current Neutral snapshot | Exact equality of garment, body, retained foundations and rig |
| Complete body | 26,756 triangles; closed, oriented, one connected component; posed weld separation 0 |
| Source shirt vertex links | 1,209 cycles and 102 paths; no invalid link |
| Seed | Prior 234 faces plus the complete star of vertex 312: 240 faces |
| Monotone growth | 19 recorded iterations; 1,273 unique fixed-side faces classified |
| Final region | 1,219 faces; reached four edges of the lower hem |
| Obstruction reasons | 531 faces at contact/crossing/near contact; 478 with inside/ambiguous/inconsistent centroid containment; categories can overlap |
| Retained foundations | Bra: 327 triangles, no growth trigger. Briefs: 0 drawn triangles, explicitly empty with null distance |
| Predicate controls | Existing 12 distance/containment cases and six segment/triangle cases passed |

A first-iteration witness is garment face **190** crossing full-body face **15494** at `[0.0731588772, 1.2800292888, 0.1240983566]`. The original rejection control still puts raw vertex **312** inside the body by winding and all five unambiguous parity rays.

The terminal supplement identifies lower-hem edges `159:287`, `550:691`, `550:910`, and `159:945`, incident to faces **245, 948, 1717 and 1784**. All four entered in the final simultaneous addition. Their world heights are approximately 0.904–0.910 m, on the 40-edge lower opening. The two 21-edge sleeve loops were not reached. Root's initial spoken guess of a sleeve was corrected immediately when this exact terminal receipt became available.

## Interpretation and decision log

1. **Empty target:** the critic found that the saved briefs have no drawn triangles. Chosen: explicit empty receipts at every query stage. Alternative: omit empty meshes from geometry queries and maintain a separate inventory. Full briefs were never substituted.
2. **Topology:** explicit vertex-link checks prevent treating a pinch as a manifold patch. Simple-cycle, connectivity and Euler checks alone would be harder to audit. The source shirt and seed links were also independently inspected by the critic.
3. **Result:** preserve the failed closure. No widening radius, changed tolerance, alternative seed or repeated run follows.
4. **Scope:** these full-body contact counts are **not visible-defect counts**. `Wardrobe.js` documents that the accepted suit intersects masked body regions and uses `_HIDE_*` / `_UNDER_*` to suppress covered surfaces. A read-only index lookup confirms that witness body face 15494 is masked. Among the 531 stored contact/near-contact witnesses, 485 nearest target faces are masked and 46 are drawn. These are nearest-target labels only: they do not rule out additional drawn-surface crossings. This study deliberately required a full-body-exterior attachment. It cannot silently switch to a mask-aware rendering contract and call the same gate passed.
5. **Next choice:** root accepts the [independent critique](CRITIQUE.md) and chooses the distinct lower-cut foundation coverage-feasibility study. Preserve the existing independent chest targets, outer/body masks and accepted assets; identify band, strap and mixed boundary triangles before construction. A broader bodice is the larger alternative, and is not proved necessary. Critique SHA-256: `e90656e756e6d5a78351c23395559d96a0670bbf36b37b1909d60080df233ee4`. No new collar candidate or appearance pass was produced here.

## Commands, ownership and recovery

```sh
node tools/figure-pipeline/neckline_attachment_inventory.mjs > tmp/wardrobe-sep30/neckline-attachment-v1.log 2>&1
node tools/figure-pipeline/neckline_attachment_terminal.mjs
```

- Inventory PID **30693**, root exec session **13030**, started **2026-09-30T19:52:49.777Z**, finished **19:53:20.090Z**, exit 0. An unsuccessful search result is retained as data, not a script crash.
- Inventory report SHA-256: `6e2fb1fea5470e73188a68f67c9c5d48eacf33663eabb7c3e3c2ee7b6db6b0ca`.
- Terminal supplement PID **34640**, completed **19:55:25.018Z**. Report SHA-256: `3c36860ff0fa5b843e08b0e0082d7f62e478474a1677a330fd3e040d37213b37`.
- The [summary](summary.json) binds exact observations and images. The [archive manifest](archive-manifest.json) inventories **36 files / 38,651,069 bytes**, including copied inputs, source dependencies, original images and both reports. Manifest SHA-256: `78e2682fd927b3fed322dad8e72c6efe06683ae3b4409bafbac570374ff3f1c8`. Both new raw roots are read-only. This is local preservation, not an off-machine backup.
- No CPU, browser, native or GPU job from this packet remains live. Preserve the existing review server on port 5173.

The floating-point methods apply to one recorded pose. They are not interval proofs, physical fabric margins, all-motion qualification or an exhaustive boundary search. No actual candidate render exists for this read-only study; the source images remain the evidence for the visible defect.
