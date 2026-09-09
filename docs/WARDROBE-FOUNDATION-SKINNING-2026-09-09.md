# Foundation skinning and sock fit follow-up — 2026-09-09

The committed g050 mask correction remains unchanged. A separate investigation confirms a
small foundation-only skin sliver in one exterior view at 4 s. Neither of the two bounded fit
pilots below passes acceptance, so neither changes a shipping asset.

## Foundation coverage: an exterior witness

The two failing GROIN normal rays, body vertices 4787/4788, are UV-seam duplicates at one
location. Independent four-weight skinning reproduces the captured positions within 0.054 µm.
The authored rays hit the briefs/boxers about 2.14 mm away, but the actual 0/4 s rays miss even
with a ±150 mm range. This is a posed geometry result, not a coordinate or ray-start error.

The first GPU probe used a camera **0.560 mm inside the body**. Its ID/depth instrumentation
was valid, but its 689 matching target pixels cannot prove exterior exposure. The original
archive is preserved; the separate exterior archive explicitly supersedes that interpretation.

A 384-direction CPU search found three clear exterior candidates. The selected camera is
outside the body AABB, 219.838 mm from the body, and has a clear near-plane frustum. Its first
two-sided body/foundation center-ray hit is front-facing body triangle 12294 at 0.4 m. At the
unchanged 4 s pose, native fragment evaluation leaves **58 matching body pixels**, including
**56 robust interior pixels**, among 225 projected target pixels. The other pixels are correctly
occluded by briefs or nearer body surfaces. Maximum world/depth correspondence errors are
0.416478/0.206045 µm. Ordinary beauty shows a small skin sliver along the foundation edge in
this low oblique view. This establishes one pose/view, not a general visibility envelope.

Body/foundation positions, normals, indices and masks, rig matrices and hair physical state
match the saved source exactly; the diagnostic draws advance nothing and have no runtime
errors. The separate 500×600 instrumented MRT uses the same camera/projection as the
1000×1200 ordinary beauty. Instrumented pixels are not used as temporal appearance evidence.

## Rejected local skin-weight transfer

One pilot transfers nearest body-triangle weights over the failed vertex fan with one feather
ring, keeping coincident seam weights equal. It changes 48 briefs and 39 boxer vertices, and
preserves every non-skin byte, including all calibrated masks. Both 0 s rays recover at about
2.167 mm, but both 4 s rays still fail. Local normals rotate more than 90 degrees relative to
baseline and minimum triangle area ratios fall to 0.23–0.40. These are orientation/area
warnings, not individually proven self-intersections. Exact changed-region body intersection
counts remain zero before/after at both poses. No GPU trial or second candidate was run.

The bake first copies and subdivides the body with interpolated skin weights, then offsets and
relaxes the shell. The original witness already has the matching body vertex's weights;
neighboring weights are body-edge averages. Nearest final-surface donors shift that field
across the nonplanar gusset. The largest pelvis-weight change is 6.89 percentage points.
A future repair must preserve correspondence through the offset, triangulation and deformation;
simply spreading this failed weight transfer farther is not supported by the result.

## Rejected sock-only fit

One fixed inward-direction fit moves 147 upper sock vertices horizontally within a nominal
5.5 mm bound. All Y values, shoe/sole vertices, seam agreement and sock vertices at or below
the 105.020 mm shoe top remain exact. Sock/trouser triangle pairs fall from 284 to 10, but
sock/body pairs rise from 252 to 259: seven new body pairs, plus three new cuff pair identities.
Self-intersection counts remain zero and no affected triangle flips.

The broad calf triangle 3193 has an original interior body margin of only +0.254 mm despite
feasible corner rays. The candidate reaches −0.669 mm. At the cuff, moving an upper corner
rotates triangles spanning the fixed interface and creates contacts below it. Three original
cuff pairs are on completely unchanged triangles. These whole-triangle failures reject this
single fit; they do not prove every possible horizontal surface fit impossible. No candidate
GLB, regenerated normals or GPU trial was produced. Removing the socks also requires a real
partition of the combined footwear/body mask; a layer exception would conceal that problem.

## Regression and evidence boundaries

The existing wardrobe suite passes **50 assertions** and the authored-pose coverage/transition
suite passes **25 assertions** after the mask correction. The latter enumerates wardrobe states
at its authored pose; its green result is not an all-motion coverage certificate. Its two logs
and exact test sources are preserved separately from the immutable 46-file promotion archive.

All four follow-up archives below were independently rehashed by root. They are local capture
archives; compact findings are tracked here, while the large captures remain ignored by git.

| Archive under `captures/` | Files | Bytes | Manifest SHA-256 |
| --- | ---: | ---: | --- |
| `wardrobe-foundation-ray-2026-09-09` | 113 | 48,499,136 | `fb8da916e73a2940475da2022ea9ff119b2bae2595bce448dca9c05314a2edda` |
| `wardrobe-foundation-exterior-2026-09-09` | 109 | 51,284,092 | `77e4dcb623cd002663831a6fc23b6da1c202c946065ab3f9d24d0d0f32f57261` |
| `wardrobe-foundation-skin-pilot-2026-09-09` | 17 | 13,231,562 | `5759b7bd06af0e4833fcb118f96bbab0a3cb65a6b6ac83fab910d3b4aca92096` |
| `wardrobe-sock-fit-2026-09-09` | 25 | 27,330,749 | `76355501856ac1701f8659f88e4b962e87de03ae249b858a8ee529322e8401e6` |
| `wardrobe-mask-regressions-2026-09-09` | 4 | 121,603 | `610f64c9ad080fe28d39f1806e53555399495a48796092f6874c8fdd3ed2de81` |
