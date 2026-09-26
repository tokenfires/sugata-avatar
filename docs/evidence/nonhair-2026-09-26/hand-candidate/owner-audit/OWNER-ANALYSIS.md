# Native candidate ownership analysis

The fixed +4° rest family/common native cap0 candidate passes the scoped ownership audit for the sealed `candidate-primary-v3` trace:721 states,109 geometry snapshots and12,257 owner records. This is a real rebound native pose/budget change, not an arm-output filter. Seven owners change and52 of53 skinning-palette bones change. The result does not establish clearance, appearance, all-motion fit or production acceptance.

`owner-comparison-v3.json` SHA `920c17c32ceaa66cd48c3d205eba283e17c4944f1078f306c6393fe139f77b7d` binds the exact executed scripts, candidate report `34305cf143306ae7818c159159e2eb7aa1514992da696cc8a27b948467b0b877`, manifest `a4bd27fcef48d9efb2cdcd71d7df3c2523d4e2b2416e6002a834c56efa382515`, and accepted primary-v4 A report `bb12301ca0fd0db5097ad8fe6221498228612c2fcd314dac4377ca686d22a74e`. Both complete state archives and all218 compressed/decoded geometry archives were independently verified, together with1,586 candidate and1,562 reference frozen files. Geometry work here checks bindings, topology, masks and world-joint changes; intersection/corridor analysis is separate.

The initial audit attempt stopped on a reporting-schema mismatch: A's command envelopes contain extra label/PAD/sampling metadata while the candidate stores `{step,actual}`. The exact attempted script and explanation remain in `audit-native-owners.schema-attempt1.mjs`/`audit-schema-correction.json`. The completed audit compares every actual command payload and step exactly. No native capture or acceptance criterion was changed.

## Preserved and changed owners

Clocks, stack frames, commands, actual gesture schedules, all owner names/order/weights/enabled states and every recorded owner PRNG state are exact.24,514 raw-versus-effective comparisons pass across both traces. No stale contribution is substituted for null. Ten owners are entirely exact: `attentionControl`, `breath`, `idle`, `attentionPose`, `gazeHead`, `pupil`, `expression`, `viseme`, `blink`, `attentionSmile`.

| Changed owner | Changed native output | Changed frames | Maximum absolute component delta |
| --- | --- | --- | ---: |
| BodyIdle | Both upper arms, forearms, hands; rotations only |0–720 (721) |0.0010106967 |
| HandIdle | All30 finger-joint rotations |0–720 (721) |3.73887e-10 |
| Sway | Pelvis, spine01/02/03, neck, both thigh/calf/foot/ball rotations; pelvis/foot offsets |1–720 (720) |rotation5.45877e-5; offset1.08632e-5m |
| Posture | Both upper-arm rotations only |2–433 and458–720 (695) |0.10245525 |
| Gesture | Both upper-arm/forearm rotations; three null-to-current output events also expose its zero offsets |56–140,227–313,418–492,593–681 (336) |rotation0.09162043 |
| Gaze | All eight eyeLook channels |651 frames; exact per-channel ranges in receipt |3.05349e-5 |
| FacialIdle | Blink/Squint/Wide L/R and InnerUp/OuterUp L/R only |2–5,9–15,415–460 (57) |2.59154e-6 |

Quaternion components, morph weights and metre offsets have different meanings; those maxima are not angular or clearance measures. A missing contribution has no numeric delta against null. Gesture's zero-offset presence at the three threshold events is therefore recorded as presence change, not as movement. Channel ordering otherwise remains exact.

BodyIdle binds arm rest frames; HandIdle measures finger rest frames/hinges (`BodyIdle.js:384–398,688–708`; `HandIdle.js:301–310,670–716`). Their recorded layer PRNG states remain exact, while native output is conjugated through new frames. Avatar also retains its native Sway-to-BodyIdle weight-shift relay (`Avatar.js:1558`; `BodyIdle.js:355–380`); this audit does not invent an independently retained callback/cache trace. Tiny HandIdle differences are retained exactly. Posture's positive-spread rest-frame differences already occur before the inward cap activates; only its two arm rotations change. Original PAD, activation input telemetry, raw prescribed spread, approach/head/knee fields and centre-of-pressure output remain exact.

One native budget bind at stackframe0 measures available left/right budgets0.24748154376866854/0.2782859612853101rad, then sets **both effective budgets to0**. The exact three authored pose hashes and four load calls are verified. From step458, native shared left/right arm spread is0 while accepted A remains inward. Each of721 telemetry frames reports the actual unfiltered native result. This is intentionally different from the earlier B accumulator-suppression experiment.

## Gesture output lifetime and sampled-input timing

Native yield is1 whenever the candidate's gesture is active. The original schedule, envelope, hand and sampled extent remain exact; larger arm motion follows the common cap's actual shared telemetry. Native Gesture returns output on336 candidate frames versus333 reference frames. Only steps492,593 and681 differ in return status:

| Step | A shoulder angle | Candidate shoulder angle | Existing threshold |
| --- | ---: | ---: | ---: |
|492 |0.02409473262643264° |0.06884209321837896° |0.05° |
|593 |0.026270189503224427° |0.07505768429492694° |0.05° |
|681 |0.01943502177979423° |0.05552863365655494° |0.05° |

Each mismatch passes the frozen helper's exact native-radian equation on **both** actual traces. No threshold was loosened. Equal-status frames keep their original strict status comparison; Gesture samples affect before the end-of-frame report, so later PAD is not treated as its exact earlier input. The qualified mismatches use inputs whose native recorded extent and equation agree exactly. All other owner statuses are exact.

`Gesture.js:794–837,987–999` keys yield to limited left-arm spread, then applies the strict negligible-angle test. Applied-angle telemetry can retain the last beat while inactive, so the report's continuously changed yield/angle fields from458–720 do not imply continuously returned output. The receipt keeps actual statuses and raw/null contributions separately.

## Sway, head and foot effects are real and bounded here

All36 arm/hand/finger palette bones differ across0–720. The additional changed bones are pelvis; spine01/02/03; both clavicles; neck/head; both thigh/calf/foot/ball. These16 start at step1. Right foot/ball palette values happen to be exact at582 and differ at every other positive step. `Root` remains exact throughout. Thus there is no hidden36-bone assumption. The complete names, ranges and first witnesses are retained.

Sway's fresh BodyMass/pendulum/stance/foot measurements include arms (`Sway.js:1663–1670,2337–2372,2544–2570`; `BodyMass.js:109–128`). The same authored Sway-chain deltas can yield different native responses after shoulder initialization. The initial retained matrices independently show a roughly+0.3054mm vertical COM shift; the saved step1 head matrix also differs. Those earlier receipts remain unchanged with the explicit step1 addendum. Internal Sway calibration caches were not retained, so their exact numerical causal decomposition is not claimed.

The109 actual world-matrix samples bound recorded joint-position differences:

| Joint | Maximum displacement from A | Step |
| --- | ---: | ---: |
| Pelvis |0.0110595mm |416 |
| Head |0.00540271mm |210 |
| Left/right foot |0.000476095 /0.000330576mm |418 /141 |
| Left/right ball |0.00141988 /0.00119986mm |418 /120 |
| Left/right hand |174.0947 /185.4505mm |648 /466 |

Foot/ball differences are explicit native downstream effects, supported by Sway's stance/sole compensation, released yaw and toe-lift paths (`3041–3090,3134–3210`). Small sampled joint displacement does not prove sole contact or no slip. Hand displacement reflects rest, cap and native gesture changes together, not the4° rest edit in isolation. No other changed owner is unexplained by the declared binding/telemetry dependency graph; this graph is not an isolated causal experiment on each internal cache.

Gaze reads previous committed external head motion for VOR (`Gaze.js:1063–1077,1931–2007`), so its own unchanged `gazeHead` contribution does not freeze eye output. FacialIdle reads current eye pitch for lids/up-brows (`FacialIdle.js:594–628,651–663`). Exactly the eight Gaze and nine FacialIdle allowed channels change. All other morph writers remain exact even on the same final names. Independent ordered folding reproduces all89 actual body morph values in both traces at all721 frames: raw writer epsilon admission precedes weighting; ordered sums clamp without a final epsilon. The651 changed final vectors contain only the17 declared channels; the largest final delta is3.05349e-5.

All five mesh topologies and accepted drawn masks remain exact: body, bra, briefs, casual suit, shoes. Actual loader bytes, camera/projection/view, sampled time/step and source paths are bound. Disposal restores both owned descriptors, retires the real native observer, and reports no leaks/errors/lost descriptors or remaining renderer memory. This validates one clean terminal lifecycle, not later reuse.

Reproduction, with a fresh output path:

```sh
node docs/evidence/nonhair-2026-09-26/hand-candidate/owner-audit/audit-native-owners.mjs \
  captures/hand-candidate-2026-09-26/candidate-primary-v3 \
  docs/evidence/nonhair-2026-09-26/hand-candidate/owner-audit/owner-comparison-replay.json \
  a4bd27fcef48d9efb2cdcd71d7df3c2523d4e2b2416e6002a834c56efa382515
```

The exact audit files are retained and hash-bound;14 CPU control groups are in `CPU-v2.json`. Native update guards and frozen source identity support unchanged implementations, not instruction-level tracing. Per-owner recorded PRNG seed/state/spare-Gaussian values are exact; unrecorded private fork-stream/cache state is not independently certified. Ordinary renders and the parent's independent geometry analysis must decide whether this candidate is useful. No production source, accepted asset, mask or hair behavior was changed by this audit.
