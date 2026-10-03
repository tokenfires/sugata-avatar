# Independent critique — saved colour recipes

**Approve the bounded saved-list display improvement.** The chips distinguish garment and tint choices that the existing summaries hide. The source changes display only; saved recipe, storage envelope, avatar owner and assets remain the same in the recorded workflow. This does not improve the haircut or garment fit.

No browser or GPU job was launched by the critic. I read the four actual source files, the preserved instrument and both raw reports, and directly viewed all four original screenshots:

- `captures/saved-colour-recipe-2026-10-02-baseline-v1/desktop-recipes.png`
- `captures/saved-colour-recipe-2026-10-02-baseline-v1/mobile-recipes.png`
- `captures/saved-colour-recipe-2026-10-02-candidate-v1/desktop-recipes.png`
- `captures/saved-colour-recipe-2026-10-02-candidate-v1/mobile-recipes.png`

## Visible result and value

The baseline Sage violet and Rose teal entries have identical descriptions. In the candidate desktop image, Sage violet exposes sage Top `#617a70`, dark Shoes `#252a30`, Brown Hair base `#413934` and purple Tint `35% #8063ac`; Rose teal exposes rose Top `#b78383`, brown Shoes `#623c28`, the same Brown base and teal Tint `35% #239c88`. The visible coloured squares and labels distinguish them before navigation.

The candidate mobile image shows both entries' chips wrapping into two readable rows above their existing actions. Zero tint shows Bottom `#444c69`, custom Hair base `#765344` and retained Tint `0% #ffffff`. Original has no fabricated colour chips. The unavailable future entry remains unavailable. The visible candidate image does not include the future entry's full action row at the viewport bottom; its disabled Open state is recorded in the report rather than visually established by that mobile crop.

The gain is useful for browsing a small collection and costs little implementation complexity. Native thumbnails would communicate the complete appearance better, but require storage/capture ownership and stale-image handling. The chosen input swatches are an appropriate first step, with the source's fabrics/light note retaining their appearance boundary.

## Independent recomputation

I recomputed both report SHA-256 values and all four image hashes from disk:

- Baseline report: `db6a56fb71a7db09a23eadab684060f544dc1c0998680232b2b38674912d9005`.
- Candidate report: `f5c64cc03bfc46d59b2998b77557de3c4144faa115cb54626505a2265a2db1ad`.

The baseline/candidate source inventories contain 378/380 entries. Independently hashing every candidate entry against the current file produces zero mismatches. Only `showcase.html`, `showcase.js`, new `showcase-saved-colours.mjs` and new `showcase-saved-colours.css` differ between inventories. All listed asset hashes consequently agree.

The stored envelope hashes match across phases: `26c12261d378aa87a5b15ac22c729ccc0e8801f731f3d23d7218a9cc5e6ef0c8`. I independently declared expected label/hex pairs for the three customized rows and verified all 11 recorded chips' text, exact RGB swatch values and `aria-hidden=true` flags. Original and unavailable entries have no chips; only unavailable Open is disabled. The saved Open state retains Rose teal's `#239c88` tint at `.35` and its `#b78383`/`#623c28` garment inputs.

Both reports are passed with zero errors, 12 recorded warnings each and two retirements each reporting `disposed: true`, `leaked: []`. The preserved instrument asserts unchanged storage/configuration/owner during collection rendering and viewport change, no horizontal overflow at 390px, and keyboard Tab from Open to Rename. These are bounded native UI observations, not broad browser or assistive-technology qualification. No exact-image equality claim is required or established.

## Small accessibility follow-up

**Source-established limitation:** `showcase.js` still sets Open's `aria-describedby` to the legacy description only. The new static chip labels are accessible as ordinary text, but a user navigating directly between Open buttons receives the same colour-ambiguous legacy descriptions. The baseline/candidate desktop pair shows the old description remaining verbatim while the new distinction lives only in the separate chips. No screen reader was exercised, so this is an accessible-description contract finding rather than an observed spoken failure.

**A:** assign the recipe container an id and append it to Open's `aria-describedby`. This exposes the existing exact chip text on button focus with little source change; the longer description is the tradeoff.

**B:** incorporate exact colour values into the original description. This leaves one accessible description but duplicates detailed values visually unless the chip/text layout is revised.

This is worthwhile polish, not a blocker for the approved static-list display. Any source follow-up needs its own source/DOM receipt; V1 captures describe the source they actually recorded.

## Remaining limits

Swatches represent saved inputs, not calibrated material output. Tint percentages use the existing two-decimal summary convention; the original saved amount remains intact. The screenshot pair is not normalized for vertical scroll, because the extra chips increase list height. No before/after avatar pixel comparison, motion, performance, new shade fidelity, broader wardrobe range or screen-reader behavior follows from this packet.

## Separate V2 accessibility receipt

**Approve V2. The identified description omission is resolved in the recorded DOM contract.** Root chose A: each recipe receives `saved-recipe-${item.id}`, and customized entries' Open buttons now reference both the existing description and that recipe container. Entries without chips retain their existing single description. The V1 review and hashes above remain unchanged.

I directly viewed the actual V2 `desktop-recipes.png` and `mobile-recipes.png` under `captures/saved-colour-recipe-2026-10-02-candidate-v2`, read the preserved V2 source/instrument/report, and independently recomputed:

- Report SHA-256: `34ad69a509134e92c20d81d9d8bd25ab57a4f0b462cde981e2f1c42320a6d98a`.
- Both image hashes agree with the report and are byte-identical to the V1 candidate images. The V2 source change therefore has no visible layout regression in these frames.
- Every current candidate source hash agrees with V2; only `showcase.js` differs from the V1 candidate manifest.
- For all five entries, the recorded `openDescription` exactly equals the legacy description plus the recipe text where present. Both distinct tint hues, all explicit garment values, and the retained 0% tint now occur in those referenced texts. Original and unavailable entries retain only their appropriate existing descriptions.
- The stored envelope hash and reopened Rose teal configuration agree with V1. The V2 report is passed with zero errors, 12 warnings and two clean reported retirements.

No demonstrated accessibility issue remains from this review. The receipt is a DOM ID/reference-and-text observation, not an accessibility-tree dump or actual screen-reader speech test. The concatenated `textContent` report is not evidence of how a screen reader separates or pronounces the labels. I did not launch a browser/GPU job or edit product source.
