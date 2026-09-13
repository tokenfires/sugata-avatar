# Exact original-card history qualification — 2026-09-09

**September 13 update:** the owned runtime integration is now implemented; see [current qualification and limits](HAIR-RENDER-HISTORY-2026-09-13.md). The prototype evidence below remains historical.

The frozen V3 prototype substantially improves moving-hair clarity without changing the physical
hair state. Its bounded pixel-velocity oracle, resource checks and paired appearance tests pass.
**It cannot ship unchanged:** all three ordinary live lookbook PNG clicks fail its requirement
that every beauty call freshly render the scene. Production still uses the held-velocity path.

## What was measured

The owner borrows final card edges read-only, owns one padded vec3 history array, and records
matched previous/current unjittered model-view-projection matrices at the groom's actual beauty
draw. It computes current-minus-previous projected NDC coordinates for original cards. Caps keep
the existing material path; no exact cap or camera-facing follower history is claimed. Physics
equations, contact queries, substeps and final ribbon rebuilding remain unchanged.

History is copied synchronously after a successful fresh beauty submission, before another
update can run. The owner checks source write/reset epochs, main-pass and groom callbacks,
material/camera/scene identities and retirement. V3 intentionally refuses cached scene reuse,
debug views and ambiguous transactions. That strict boundary made a useful prototype but is
incompatible with the live export flow.

## Independent pixel velocity

The nine paired states cover seed/reset, two deformations, camera-only and object-only motion,
draw-only reuse, object return, and two physics updates before one beauty. All saved physical
arrays and observed model/view/jittered/unjittered matrices match exactly between arms. The
oracle uses independently observed matrices and saved Float32 vertices, not owner-reported MVPs.

The separate 307×547 MRT instrument replaces only the normal output with card ID, local
coordinate and view depth. Native stochastic coverage and depth select the visible surface.
Pixels are selected by geometry/ID/depth before inspecting velocity. Ambiguous edges, multiple
triangle matches and triangles whose Float32 projection interval spans raster grid cells are
excluded. This is a bounded interior-pixel proof, not every pixel or every GPU adapter.

Independent controls establish actual half-float conversion toward zero and 1/256-pixel screen
vertex snapping on this backend. Nine RGBA32F barycentric controls include thin, clipped,
ordinary and reflected triangles. Outward Float32 projection intervals cover fused/unfused
arithmetic and are tested over 32,768 trials. These controls explain earlier mismatches; they
do not widen the velocity acceptance bound, which remains **1.01 half ULP + 2e−6 NDC per axis**.

All **380,263 stable-raster candidate pixels** pass across the nine states. The three required
held-history deformation controls fail at every eligible pixel: 48,192 / 47,047 / 39,369.
The final static/draw-only/reset card output is zero. Earlier row-stride, unsnapped-raster and
ambiguous-grid failures remain archived, as does the unsuccessful broad interval method.
Instrumented images establish numerical correspondence; they are not beauty evidence.

## Uninstrumented appearance, lifetime and cost

Two four-second motions use 240 fixed 1/60 s updates each, with 48 initial zero-time draws.
Each arm records nine moving states and settled front/side/rear views after 80 draw-only
frames per view: 48 ordinary images, 18 moving parity pairs and six settled parity pairs.
All complete saved physical states and observed camera matrices match exactly; errors are zero.
Root and independent review find clearer fringe, cheek-side locks and tips during motion.
Settled views retain the same crown facets and layered rear geometry. Skin/eye artifacts remain.
Still images at 30-frame intervals cannot certify every transient ghost or animation flicker.

Three remove/reinstall cycles return counted storage, pipeline, builder, program and uniform
resources exactly to baseline. The owner adds **269,824 storage bytes and one compute pipeline**.
Source retirement and reattachment retirement both reach zero hair storage/compute resources.
Weak JavaScript bind-group objects are not directly enumerated. A stale historical report field
is explicitly distinguished from actual zero live storage. The PNG decoder's initial property
error was corrected by CPU replay of the preserved GPU data; no GPU result was rerun to hide it.

Separate TAAU-on ABBA runs use 64 warm and 240 measured fixed-step natural frames each.
Update-to-queue-completion wall medians are hold **24.6 / 22.7 ms** and candidate **22.3 / 23.6 ms**;
p95 values are hold **38.6 / 34.1 ms** and candidate **32.7 / 33.8 ms**. CPU submission medians
are 3.2 ms and 3.3 ms respectively. No consistent whole-frame penalty or benefit is resolved
above variance. This does not establish 60 FPS or a negative rendering cost. Render timestamp
ranges overlap, so their sum is not presented as total GPU time. Other agents stayed idle for
timing, but user-visible applications remained open.

## The actual export blocker and next boundary

A fresh-rAF export succeeds and preserves state. A same-task `Avatar.update(0)` followed by
`showcase.saveImage()` fails before encoding. More decisively, three normal Playwright clicks
on the live lookbook all report the same cached-scene refusal and produce no download. Existing
UI catches it correctly; absence of page errors is not an export pass.

The next integration must distinguish a cached redraw from a failed fresh transaction. A cached
redraw should not copy current, possibly unrendered solver vertices or advance the stored MVP.
An explicit Stage-owned transaction can keep the one-buffer fast path for ordinary fresh beauty
frames, while invalidating/reseeding after debug/direct-pass/resize/temporal changes or failure.
Exact continuity across a debug-rendered scene consumed later from cache requires a separate
pending snapshot; that broader two-slot capability is not established by this qualification.

## Frozen evidence

Root independently rehashed every payload in both archives. The exact prototype SHA-256 is
`2c71da25ea4446f7ec9063e662e27531e7c39a192ddb880b9ec14efb3a466cf8`; routed dynamics is
`657c9f8740411e750039c4f994955f53c1988dc51cf98ac74a892790063f2525`.
All files below are under `captures/orbit-card-history-2026-09-09/` and remain local ignored evidence.

| Archive | Payloads | Bytes | Manifest SHA-256 |
| --- | ---: | ---: | --- |
| `raster-evidence-v4` | 86 | 83,412,234 | `9fe8d2884ea7f5b74bfde63c498bbd10a85db52fc70fbe4d9a96b09c824f6ff7` |
| `qualification-v5` | 75 | 44,477,371 | `5fe290953950104e85245be9e0962563fd6352c5b147ebea75469a693e41e075` |

The V5 ledger enumerates seven explicitly hashed hair/history-critical sources, with additional
lookbook hashes for export. Broader dependencies rely on the coordinated source freeze; no
complete transitive source census is claimed for this prototype. Earlier scheduling tests and
the original [render-history audit](HAIR-RENDER-HISTORY-2026-09-09.md) remain separate evidence.
