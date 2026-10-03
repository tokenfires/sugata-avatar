# Independent boundary placement and native registration critique

**Verdict:** accept the single proposal as reviewable illustrative opening/part placement on posed g050. The cyan role is an upper opening/framing intent with complementary temple exposure; amber is separate off-center part-flow intent. Both eyes and medial brows remain below the proposed opening. This advances a visual design decision, but does not accept these chords as a physical hairline, a complete open/backing partition, guide geometry or a finished hairstyle. The current whole groom visibly crosses the intended opening.

Reviewed final `BOUNDARY-DECISION.md`, SHA256 `9e93bda736419d93ad2b6cbf1485d350194215ccf167aac3c0c1ad5a7acda47e`, the plan/authoring contract, actual32-landmark JSON and locked capture source/report. Its acceptance scope and stated limitations agree with this review.

## Actual original images viewed

Independently viewed all ten900×868 originals in `captures/hair-boundary-2026-10-02-v1`: `front-full-{beauty,A,B}.png`, `front-bare-{beauty,A,B}.png`, `left-bare-{beauty,A}.png`, `right-bare-{beauty,B}.png`. All actual hashes agree with the report. Also reviewed the original R2/R3 and native/concept originals earlier in this same bounded sequence; no new image was generated or browser opened by the critic.

`front-full-beauty.png` has frontal fringe/short groups in approximately `[300,220,485,340]`. In `front-full-A/B.png`, cyan crosses above those retained groups; a line drawn over them is not proof of target openness. `front-bare-A/B.png` makes the two complementary openings and shared medial-brow readability easy to assess. Bare views are recorded whole-hair-hidden diagnostics; full context includes all34fringe cards. The annotated screenshots also include existing Showcase HTML labels/buttons; the exact-canvas equality claim concerns the underlying WebGPU canvas, not equality of annotated PNGs to raw canvas PNGs.

The amber stroke is compressed into approximately `[330,130,370,185]` in frontA. Its rearward placement becomes understandable across the crown in `left-bare-A.png` (roughly `[410,120,595,180]`), with the corresponding B relationship in `right-bare-B.png`. These coordinate boxes identify witnesses, not target masks or fitted pixel coordinates. R2 supplies unequal face framing and an open central forehead; R3 supplies connected rounded side flow, not a frontal two-eye occlusion target.

## Independent arithmetic and source controls

[verify-boundary-pose.py](verify-boundary-pose.py) and [boundary-independent.json](boundary-independent.json) independently decode pinned GLB inputs and reproduce:

- All77 actual runtime corner POSITION/JOINTS and normalized,float32-stored WEIGHTS, plus each of the13 active morph POSITION delta arrays/names. Installed GLTFLoader's weight normalization is accounted for; raw GLB-weight equality was not falsely required.
- All22 live and archived capture-source pins, the author's seven source pins and all ten image hashes.
- Every recorded triangle/index/barycentric relationship,rest point,projection distance and all96 displayed corner→world→barycentric→camera/NDC/pixel records. Maximum rest residual2.22e−16m,world-corner2.22e−16m,bary-world4.44e−16m,NDC2.22e−15 and pixel9.6634e−13px. This independently uses plain matrix arithmetic, not Three's getVertexPosition/project methods.
- Matching recorded body matrices,bones/inverses,bind state,morphs,clock and configuration across views; front full/bare camera equality. Runtime influences are actually nonzero, so the earlier morph-before-skin registration correction was consequential.

The capture source asserts exact underlying canvas/state before/after each SVG arm. The critic verifies that actual source assertion and saved source/image/report pins; no independent reconstruction of hidden canvas pixels from annotated screenshot PNGs is claimed. Receipt status has zero errors,explicit avatar retirement and actual page/browser/server closures. Native backend is WebGPU; serialized adapter `{}` does not identify hardware.

## Findings, responsibility and alternatives

**1. Mirrored intent is not exact geometric mirroring.** Actual opening[5] in both orientations projects to triangle1451 at `[-0.001944653685,1.631447418063,0.118988021327]`; independent rest mirror residual is3.88930737mm. The maximum wanted-to-surface projection18.82510651mm also moves the requested central point materially. These facts were caught before capture and are now explicitly disclosed. AlternativeA retains this fixed proposal as complementary illustrative intent and judges actual projected points, preserving the bounded review. AlternativeB requires exact geometric mirroring under a later explicit correspondence/authoring contract, offering a stronger symmetry promise at additional work. No point was retuned in this slice; A is accepted here.

**2. Chords/open endpoints cannot admit coverage construction.** Source landmarks and bare-head images show individually body-bound points, open temple endpoints and straight illustrative joins. They do not label a continuous closed surface region. AlternativeA next authors a topology-aware continuous path with declared temple joins and face-open/backing side semantics, using these landmarks as illustrative input. It can resolve an independent domain and change fixed-cap admission, but adds closure work and still leaves guide mass/length/width unsolved. AlternativeB first declares a finite joint visible-guide envelope/objective owning part,crown and asymmetrical framing, then a separate backing/attachment contract. It addresses the actual fringe/opening mismatch directly but needs broader explicit variables,bounds and whole-groom fit/motion obligations. Neither is admitted by this packet.

**3. A frontal amber cluster alone is an incomplete part-direction witness.** FrontA's compressed stroke can appear like a short kink; the oblique actual images establish the intended continuation over the head. AlternativeA retains the existing front+oblique images together in any review, giving depth context with no extra capture. AlternativeB relies on explicit3D anchor/segment records for method design, reducing view dependence but making visual style decisions harder. Use A for review and the records for future geometry work; do not fit another stroke from pixels.

Both source-preflight control gaps were repaired before the single native run: actual runtime corner pose inputs are now saved, and each cleanup closure is caught independently before saving status. No critical control defect remains in this completed illustrative packet.

NextA is worth one bounded authoring step only if a concrete independently labeled surface domain changes the fixed-cap/guide responsibility decision. A decorative tracing of current cap/guide coverage or another general shape specification adds no admission value; stop it and choose a finite guide objective under B. Preserve closed source recovery/local methods, accepted assets and whole-groom future qualification, including known card58 contact.

## Exact critic receipt

```sh
python3 docs/evidence/appearance-2026-10-02/front-design/verify-boundary-pose.py > docs/evidence/appearance-2026-10-02/front-design/boundary-independent.json
```

Exit0; recorded start `2026-10-03T04:40:29.261907+00:00`,finish `04:40:29.299024+00:00`,PID30351. Interpreter `/opt/homebrew/opt/python@3.14/bin/python3.14`,Python `3.14.7 (main, Aug  5 2026, 10:29:49) [Clang 21.0.0 (clang-2100.1.1.101)]`,NumPy2.4.6. Verifier SHA256 `121b0b4d7f44a8359ee0a70648a6c26507028f5d82bd8d79900018cb62a21959`; receipt `2124b917a00a0c6597c99fe6af624b9c8e4469569063d9908d036c7b13d0353b`; native report `3a9d2349ae7fe0ea315eb2888c9ef3fec993396da3bc4d93fe951f9a6745cc0f`.

The first critic invocation failed before body input computation because the selected generic decoder needed its `struct` import; corrected that reader import and reran unchanged inputs. No nearest-face solve, geometry construction,target fitting or capture was executed by critic. Generic and sparse decoding helper hashes are retained in the receipt; their older audits were not run. All critic commands completed; no critic-owned job remains.
