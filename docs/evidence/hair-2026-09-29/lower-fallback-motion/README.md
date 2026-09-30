# Inward bob curve: moving qualification with exact inner-card restoration

The experimental candidate retains the modest inward lower contour in the sampled actual images. Its 338 selected cards clear the body in all 556 recorded head states and 721 ordinary states. This remains an experimental lead; the accepted asset is unchanged.

| Protocol | States | Triangle/body pairs | Negative vertices | Minimum clearance |
| --- | ---: | ---: | ---: | --- |
| Head turns and tilts | 556 | 0 | 0 | 0.078130750 mm, frame255/card123/ring16/side1 |
| Ordinary motion | 721 | 0 | 0 | 2.311099401 mm |

Candidate: `captures/bob-lower-fallback-v1/candidate.glb`, SHA256 `8c458428551ca546d2aac511dec3b516067d53050de9663a563b9884a4ae5fe7`. Control: side-v3 `bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9`. [Static construction and critique](../lower-fallback/README.md) record the exact restoration of19 inner cards from the control after the preceding lower-v1 head failure.

## Actual-image evidence

- [Head comparison and 20fps preview](../../../../captures/lower-fallback-head-v1/review.html).
- [Ordinary comparison and 20fps preview](../../../../captures/lower-fallback-ordinary-v1/review.html).
- [Independent critique](CRITIQUE.md).
- Root sampled head90/150/210/255/315/360/435/555 plus231/234, ordinary0/120/240/351/354/357/396/480/720, and front372/373/375. The modest inward contour persists, without a newly obvious stepped ledge in these views. Existing crown breaks and rough ends remain.
- Front373 has a small candidate-only dash near x507–519/y342–347. It is a localized exception, not evidence that the whole front has improved. Camera replay proves exact same-arm physical geometry over all556 states, so the alternate view does not introduce another simulation.

## Reproducibility and limits

`tools/critic/bob-lower-fallback-motion.mjs` owns matched native WebGPU capture. The reports preserve exact command parameters, process IDs, times, routed asset hashes, every60Hz geometry state and every20Hz PNG. Six captures include both arms/profile protocols and both front repeats, with extra front frame373. Sources are snapshotted. Body audit commands use `audit-envelope-motion.mjs --directory=...`; both full candidate audits completed and sessions10196/86931 were collected. The prior side control audits are reused only after exact all-state physical replay and source/snapshot validation.

Paired setup, clock, body, pose, rig, capsule and skull values match. Untouched cards can still respond differently through the shared groom: maximum displacement6.635651mm at head373/card494 and0.539634mm at ordinary397/card238. The existing root40 edge rotation at353→354 remains; its anchored midpoint does not establish a detachment.

The head margin is only0.078131mm. No robustness margin, all-motion, garment, hair/hair, alpha-coverage, between-update or final style acceptance is claimed. The338-card body check excludes the remaining158 cards, including fringe494. Numerical clearance supports actual images; it does not qualify appearance by itself.

`archive-bob-lower-fallback-motion.py` froze **5,057 files, 5,694,655,330 bytes and1,236 PNGs** across five roots at10:48:54UTC. [Summary](summary.json) and [manifest](archive-manifest.json) retain source pins and all file hashes. Native page checks cover desktop1440/mobile390, image loading, navigation and advancing video; root viewed the head mobile capture. The captured overview still accurately labels the rejected lower-v1 experiment. Raw evidence is local/ignored, not an off-machine backup. Do not append to frozen roots.

## Decision

Retain this candidate as the scoped experimental lead. Keep the side control, rejected lower-v1 and accepted asset. Use the separate front layer evidence for one coherent front-flow prototype; do not tune simulation stiffness from the displacement metric or hide the small head margin.
