# Foundation runtime and outfit review — September 30

## Result

**The exact experimental band fails replacement qualification.** It retains the cleaner casual neckline and smoother exposed outline in the inspected movement keyframes, but introduces large grey patches through the elegant blouse. All four audited runtime body poses also contain foundation/body triangle crossings. Preserve the static improvement and the failures together; accepted assets remain unchanged.

Use the [interactive comparison](review.html) to select an outfit and scrub the original recorded images. Read the [independent image critique](CAPTURE-CRITIQUE.md), [capture contract](PLAN.md) and [source review](SOURCE-REVIEW.md). The [independent body critique](CLEARANCE-CRITIQUE.md) reproduces the transverse witness with a separate segment/triangle calculation, solid angles and five ray casts.

## Exact capture

Candidate SHA256 `3793206f8f7a95a632705b02756bff9c35c5a934f266dc6bd790d076278671cd`; shipped control `4a3366377087bbfb2d5779ba4d6f5de09735e1810ae4ea9b6a22e11d3aee0d79`. Six fresh actual-loader owners cover both assets in exposed foundation, casual and elegant. Each runs720 ordinary updates at60Hz, preserving the recorded default seed, motion layers, bob02, Original materials and Neutral light. Images are retained every12updates:61 per owner, plus one terminal rear still each, totaling372 original PNGs. Four full CPU-skinned snapshots per owner total24.

All paired recorded motion states, non-foundation geometry, lighting, camera, recipe and time match exactly. Loaded GLB hashes verify. Six owners close without recorded errors or resource leaks. Warnings remain in the report. Rear views use renderer draws only; full before/after geometry, rig and morphs remain exact, with physical-state differences confined to camera. The independent critic verified all image/snapshot hashes and inspected30 original keyframes/rears. Root inspected the candidate keyframes and relevant shipped comparisons. This is not inspection of every intermediate frame.

| Outfit | Shipped drawn foundation triangles | Candidate drawn triangles | Observed outcome |
| --- | ---: | ---: | --- |
| Exposed foundation | 22,090 | 15,401 | Cleaner broad outline; fine hem marks persist. |
| Casual | 327 | 0 | Grey neckline islands removed; the hidden band is not visually qualified by this outfit. |
| Elegant | 284 | 1,024 | Two large grey chest patches absent from shipped control. |

The elegant failure is already present in [candidate step0](../../../../captures/foundation-domain-motion-2026-09-30-v1/band-elegant/frame-0000.png), around x110–185/y583–663 and x278–341/y582–657, versus [shipped step0](../../../../captures/foundation-domain-motion-2026-09-30-v1/shipped-elegant/frame-0000.png). It persists at the other three inspected times. Images and retained-face counts motivate attribution; they alone do not establish ownership of each pixel or geometric crossing with the blouse.

## Complete triangle audit at four runtime times

Full candidate and body arrays, full indices, rig and time are exact across all three outfits at each declared time. One shared audit therefore covers those exact full surfaces. Source-rest welding produces a closed, oriented, connected body with zero posed seam separation at each time. This topology check does not prove absence of body self-overlap.

| Update / time | Candidate triangles | Body-crossing triangles | Centroids with absolute winding >0.5 | Any parity ray inside | Ambiguous parity |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 / 0s | 15,401 | 436 | 963 | 837 | 0 |
| 240 / 4s | 15,401 | 429 | 1,003 | 853 | 0 |
| 480 / 8s | 15,401 | 433 | 1,044 | 892 | 0 |
| 720 / 12s | 15,401 | 431 | 1,004 | 859 | 0 |

All four strict-exterior predicates fail. `status: audited` records completion; `allFourStatesExterior: false` is the result. Winding and parity totals differ and remain separately recorded. The12 analytical helper controls pass. Local negative vertex sample counts include duplicate corners and are not unique defect counts.

One concrete step0 witness is band triangle26 versus full-body triangle2215. Their transverse intersection is at `[-0.17625693250849414, 1.2244314947201507, 0.03441576946725638]` metres. Band triangle26's centroid winding is1 and all five nonambiguous parity rays classify it inside. Its sampled local normal signed minimum is−0.839949205mm. This supports a real failed runtime geometry witness; it does not identify the cause or assign a visible pixel defect.

The earlier source-rest audit remains a pass on its own exact inputs. Runtime step0 already contains relaxed-standing and motion-layer initialization; it is not that source rest pose. Four CPU-skinned poses are not GPU readback, continuous collision checking, all gestures, transported chest coverage or all-view appearance. Body clearance also cannot establish compatibility with an outer blouse.

## Decisions

1. Preserve the exact candidate and close this qualification attempt without height, offset, mask, seed or pose tuning.
2. Select a separate [frozen-frame elegant attribution](../foundation-elegant-attribution/PLAN.md). A foundation diffuse tag, drawn-surface ray ordering, mask provenance and exact implicated triangle comparisons can establish a narrower mechanism before any repair. The alternative is a deliberately restricted foundation/casual lead with shipped elegant retained; that cannot qualify a shared replacement and still leaves runtime body fit unresolved.
3. Body/runtime mismatch needs separate attribution before construction changes. The current observations do not decide between rest/bind/skin correspondence, pose deformation or another mechanism.

## Commands, ownership and recovery

- Capture: `node tools/critic/foundation-domain-motion.mjs > tmp/foundation-domain-motion-sep30/capture-v1.log 2>&1`. PID7526 / exec45617,22:50:14.648–22:52:23.362UTC. Report SHA256 `24071200867f77630521e51202fe3c9de6069173cee905d0a5ecda713176953b`.
- Full four-time audit: `node tools/critic/foundation-domain-motion-clearance.mjs 24071200867f77630521e51202fe3c9de6069173cee905d0a5ecda713176953b > tmp/foundation-domain-motion-sep30/clearance-v1.log 2>&1`. PID8037 / exec9217,22:53:40.041–23:12:43.162UTC,exit0 with failed qualification. Report SHA256 `1e22fbe045b34606fdcced937b2442eb9b8785ece4da5d3e7497193019fe5e0f`.
- Gallery: `node tools/critic/foundation-motion-gallery.mjs > tmp/foundation-domain-motion-sep30/gallery-v1.log 2>&1`. PID10619 / exec52877,23:11:54.272–23:11:58.055UTC. Report SHA256 `e8fc14c97e5507ef97d701a87f2190b6077b600e19881a0113acb3f16f818fe8`. All15 declared outfit/time/rear selections load, playback advances and pauses, desktop1440/mobile390 have no horizontal overflow or recorded browser/HTTP errors. Root inspected both actual screenshots. Playback waits for image loads and is not a realtime performance measurement.

All three owned jobs exited and their temporary browsers/servers closed. The existing review server remains available on5173. No native runtime is mounted. Latest account check permits ordinary use,48% weekly used and62,500 granted credits intact. No accepted asset, paid setting, model, reset credit or remote publication changed.

## Frozen local packet

The [archive manifest](archive-manifest.json) preserves730files /609,964,357bytes across the closed motion, full-audit and gallery roots. Manifest SHA256 `3f8a5ec51f09a57f6b0ac7c19d6cf346a46dd41ba6a12089f632acd5b83e2f0a`. Original inputs, images, full snapshots, before/after rear receipts and logs are read-only. This is a local archive, not an off-machine backup.

Independent critique SHA256s: image `8fdcb9b99b2d22f90a53bbaf3ac61f2273c671f7ac0d11610d78fda13af7a6ed`; clearance `fe15a2a12d8ac3a2d6120b4446961b0c6ae45891be137090e1556d3ac0e5a92c`.
