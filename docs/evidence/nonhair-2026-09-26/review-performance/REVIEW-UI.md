# Static timing review QA

The review wording matches the sealed 240-sample result and keeps the key limits visible: stepped pass sums are not FPS, CPU observation overhead is uncalibrated, metrics overlap, and one headless workload is not representative-build or exclusive-system qualification. Evidence links resolve to exact local package files. The new Today card describes a measured study and explicitly disclaims live frame rate and a performance budget. The initial check preserved both pages. A later spacing-only correction is described below; the Today portal remains unchanged.

`review-ui.mjs` has a CPU-only preflight and an explicit root-owned browser mode. Preflight verifies the package/HTML hashes, bounded language, relative targets, absence of page scripts/canvas, original PNG dimensions and a 14-file source binding. No server/browser/renderer starts in preflight. The original preflight-v1 is retained; final preflight-v2 also includes the bodyless-favicon response guard and awaits all body reads before closing each viewport context.

The native run serves only the bound static pages/artifacts through its own ephemeral HTTP server. It does not use or stop the persistent 5173 service and does not import an Avatar into a page. Desktop 1440×1000 and mobile 390×844 use DPR 1 for UI screenshots, not the performance pilot's DPR 2. Each checks the five-card portal's two/one-column layout and actual timing-link navigation, document width, exact table values, at least 13px data type, text containment, original image decoding/aspect, all six sequential keyboard links, reverse focus and Enter navigation to the actual PNG. The desktop case also verifies exact HTTP bytes for every review evidence link. Warnings, errors, unexpected requests or source changes reject. Eight screenshots cover portal, timing page, table and keyboard state in both sizes; failed checks attempt a failure screenshot before cleanup.

This is focused UI evidence, not comprehensive accessibility, real touch-device, new renderer or performance qualification. The first HTML completed the root-owned browser run and screenshot inspection. The spacing-only successor also passed a fresh static UI run; no native performance rerun was involved.

Final prepared controller SHA-256: `dafd83bec06ad5cce616de0a68eea649e184a844f6d3c91f1d9cf883c7902d6a`.

Prepared Today portal SHA-256: `ad4d875dfe35e2bd8eaea36fc0d7623e43f188f914fca72d89dff14364548c8e`.

Current CPU result: `captures/review-performance-2026-09-26/review-ui-preflight-v3/report.json`, binding the spacing-corrected HTML and updated pilot package receipt.

Root executed the following command for the completed editorial successor:

```sh
node docs/evidence/nonhair-2026-09-26/review-performance/review-ui.mjs --run captures/review-performance-2026-09-26/review-ui-native-v2
```

The fresh output retains the exact served sources, actual response hashes, DOM/font/focus measurements, screenshots, errors and final source seal. It refuses overwrite. Any later portal edit requires another fresh CPU preflight before interpreting that run's changed source binding.

## Completed first UI run and editorial successor

Root completed `review-ui-native-v1` with 8 checks, 8 screenshots and zero errors. Report SHA-256 is `ba8a4b4fb9582d4854beb80fd2552a14fb424b94822b0749e0b1c1ce9627dbf0`. The lossless package under `review-ui/native-v1/` retains report/seal, the exact controller, both original HTML files, original pilot package receipt, selected host sources and all eight original screenshots. Package receipt SHA-256: `f5234cecf9a65ff5088fcda7436037133504322971f189a2451f86a874e95a31`.

Independent inspection of both tables, full timing pages and Today pages found no clipping, broken layout or missing images. Mobile table columns are compact but readable. The mobile SVG axis labels are small; the plot is a trend overview and the readable table carries the precise numeric summary. These checks are not comprehensive accessibility qualification.

The first timing HTML had joined prose/numbers such as “across240”, “All240” and “observed18render and2compute”. Root requested an editorial correction. The source generator `package-pilot-v1.mjs` was updated and run into a fresh temporary directory; only regenerated `review.html` and the package receipt's review/generator hashes were adopted. Removing whitespace from the old and new HTML yields exactly the same bytes. Every other artifact mapping, including raw samples, summary values, native report and PNG, is unchanged. `review-editorial-v2.json` retains this proof. This is a readability correction, not a new timing result.

Updated HTML SHA-256: `db5d49d7cf408d68b0b220c6517d331a2089269b104db55bb7f9f1df1dce9399`.

Updated pilot receipt SHA-256: `4c9db722d42f961900f7f5120ca76f6d8f9548d26009abca94e8d9bd0d556f4b`.

Generator SHA-256: `462b7e8ee1327fcc16b7884c2745a425b2f571c2454cd22bd71da993b21b1f39`.

The same reviewed UI controller remains unchanged. CPU preflight-v3 and the full archive-only pilot verifier pass. Root completed fresh static UI v2; the original performance capture was not repeated.


## Completed editorial UI run

Root completed `review-ui-native-v2` with 8 checks, 8 screenshots and zero errors. All 14 bound source files remained exact. The compact lossless package is `review-ui/native-v2/`; the prior version remains unchanged under `review-ui/native-v1/`.

Report SHA-256: `c4d908abe1bef963b7f0f74a67a537e9caec7f83798bc65c9528aa15b69c1a57`.

Package receipt SHA-256: `44adfc4d48d9a8c08e1a118295a070710f6c3b7d19987d13736c08432c264d2d`.

CPU verification checked all 17 packaged artifacts, both lossless decoded JSON hashes, all 8 original PNGs, the report/seal binding and all 14 current source hashes. The desktop/mobile portal and table PNGs are byte-identical to the previously reviewed first run. The corrected full timing pages and both keyboard plates were independently inspected from the original v2 screenshots: prose spacing is clear, the image link has a visible focus outline, and no clipping or missing image was found. Small mobile chart labels remain an explicitly recorded limitation; exact summary values are available in the readable table.

The focused static review is accepted. See [the visual verdict](review-ui/VISUAL-VERDICT.md). This closes the review-page task, not a new renderer, live-FPS, touch-device or comprehensive accessibility qualification. No browser or GPU run was started during packaging.


## Final warning-boundary wording and static v3

The critic requested one precise correction: the six warnings occurred **before timestamp collection**, while diagnostic tracing was already active. Only that phrase changed in the generator, live HTML, result interpretation and README. The current pilot receipt updates its HTML artifact and generator provenance hash; all other native artifact mappings and bytes remain exact. Prior static archives were not rewritten, and the bound `startup-policy.mjs` remains untouched.

Root completed `review-ui-native-v3` with 8 checks, 8 original screenshots and zero errors. All 14 bound sources remained exact. The lossless final packet is `review-ui/native-v3/`; its report SHA-256 is `12a74452467e83264d56ded3e824dd8d764f040580e54b58ba69ad0524867af9` and receipt SHA-256 is `436253ac7d5d23e1e3e238053134473860dd16192f0c4d976c54b51ae7bed799`.

Final timing HTML SHA-256: `049dcd7ced70e9416f9784000625141ff577862afcb7fc1e9cd3728cacec306c`.

Final pilot receipt SHA-256: `49cb9a27ae5980e93fff5b910671f43f0f01d7858dde4c7296b367fb28933430`.

The final desktop/mobile full timing and keyboard screenshots were independently inspected. The corrected boundary is readable; the pages remain contained and keyboard focus visible. Both table and Today images are byte-identical to the previously reviewed originals. The small mobile plot-label limitation remains recorded in the visual verdict. CPU verification checked all 17 final packaged artifacts, both decoded JSON hashes, all 8 original PNGs, all 14 current sources, report/seal agreement, the exact phrase-only HTML difference and unchanged timing artifact mappings. No native performance run or browser launch occurred during this packaging.

Completed root command:

```sh
node docs/evidence/nonhair-2026-09-26/review-performance/review-ui.mjs --run captures/review-performance-2026-09-26/review-ui-native-v3
```
