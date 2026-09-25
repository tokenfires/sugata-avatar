# Historical hair-reference observations

These source comments were archived on September 22, 2026 because their inputs
are absent and their producer commands cannot reproduce them on this checkout.
They are historical claims, **not currently verified measurements**. We withdraw
them from the live source's verified claims rather than report missing evidence
as success or weaken `quoted-numbers`. The reference operator's synthetic tests
still run; its artifact-dependent clauses explicitly report when they stand down.
No scientific threshold or numerical comparison was changed.

The first block requires the external SHIFT UP / SIE reference plate. The second
requires the missing `captures/hair-r27-pedestal` archive. Supplying the original
inputs to `hair-reference.selftest.mjs` remains the way to reassess these values.

```text
/**
 * ⚠️ §2.1's FRINGE RECT IS NOT ALL HAIR, and this changes what its numbers mean. The contamination
 * is two patches of lit FOREHEAD SKIN showing through the fringe tips, and §2.1's own published p99
 * hex `#96757e` (R150 G117 B126) is that skin. So the rect's p95 — and therefore its p95/p50 of
 * 4.936 — is a skin-to-hair ratio wearing a hair-contrast label.
 *
 * 🔴 THE CONTAMINATION LIVES IN X, NOT IN Y, AND AN EARLIER VERSION OF THIS COMMENT HAD IT BACKWARDS.
 * It claimed "769 of the 771 lie below y = 570". Re-derived twice, independently: of the top 5% the
 * y-histogram in 10 px bands is {550: 2, 560: 58, 570: 97, 580: 141, 590: 192, 600: 280}, so only
 * **60 lie below y = 570 and 710 lie at or above it**. The x-histogram is where the structure is —
 * 616 in x ∈ [1520,1560], 140 in x ∈ [1660,1680], 14 in x ∈ [1640,1660].
 *
 * 🚩 SO `fringe rect, hair only` IS NOT SKIN-EXCLUDED AND MUST NOT BE QUOTED AS IF IT WERE. It cuts
 * the rect in Y — the axis the contamination does not live in — and keeps 60 of the contaminated
 * pixels rather than 2. It is a smaller rect, not a cleaner population. **The reference fringe has
 * no published hair-only dynamic range and this tool does not produce one**; cutting in X is the
 * repair and nobody has done it. `whole-hair` below is the mask to compare our groom against.
 *
 * @claim 60 :: node tools/critic/hair-reference.selftest.mjs :: fringe top-5% below y=570 #1
 * @claim 710 :: node tools/critic/hair-reference.selftest.mjs :: fringe top-5% at or above y=570 #1
 * @claim 616 :: node tools/critic/hair-reference.selftest.mjs :: fringe top-5% in x 1520-1560 #1
 */
  // 🔴 FILTER 3 IS WORTH 0.5719 -> 0.2854 ON THE SCATTER-0 ARM'S p95 (encoded luma, 257,215 px
  // before and 235,564 after), re-derived here from `captures/hair-r27-pedestal/trapg-s0.png`.
  // An earlier version of this comment said "0.5668 -> 0.1932 … the whole difference between
  // reproducing §9.2 and not". **0.1932 is §9.2's PUBLISHED value, from a DIFFERENT CAPTURE**, and
  // this filter does not land on it — it lands 47.7% above it. The filter matters and its size is
  // real; what it cannot do is close a cross-capture gap, and hair.md §9.6 says in as many words
  // that cross-session plates are not comparable on this build.
  //
  // @claim 0.2854 :: node tools/critic/hair-reference.selftest.mjs :: filter 3, scatter-0 p95 #1
```
