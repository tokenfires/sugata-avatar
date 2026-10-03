# Independent saved-entry export review

## Value and source preflight

**Worth the bounded slice; final source admits one native probe.** I directly viewed the existing V2 originals `captures/saved-colour-recipe-2026-10-02-candidate-v2/desktop-recipes.png` and `mobile-recipes.png`. Supported rows offer Open/Rename/Remove; the desktop canvas shows Sage violet while Rose teal is separately saved. `showcase.js:252–269` downloads `currentConfiguration()` from the active avatar. The saved Open handler and `openLook()` navigate to the other recipe. Consequently exporting Rose teal previously required replacing the active preview.

**A — selected:** a fourth row Download JSON action with a two-column layout, strict supported-entry validation, expected-item refusal and saved-name filename. Small interface cost; preserves the current preview during backup.

**B:** retain Open then the global settings download. Three actions and less row height, but every other recipe backup interrupts the current view. The actual source/images make A useful without a renderer or storage migration.

The new handler rereads through `SavedLooks.open()`, validates the original configuration with the existing strict selector, refuses a changed displayed entry, and downloads the saved configuration without calling an avatar setter, navigation or storage writer. Unsupported/removed entries refuse before download. Prefixing the sanitized name, replacing path-invalid characters and stripping trailing dots/spaces provides the declared portable filename. Existing collection availability and the unavailable flag gate the action. Copying Open's descriptions includes actual colour recipe text. Two-column DOM order is Open/Rename then Download JSON/Remove.

## Two preflight corrections, both accepted

**Accessible name:** the first source had visible `Download JSON` with `aria-label="Download settings for saved look …"`, omitting JSON. This is a demonstrated source mismatch; a voice user sees a label that the programmatic name does not retain. The primary [W3C label-in-name explanation](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html) supports keeping visible label text in the accessible name.

**A — accepted:** `Download JSON for saved look ${item.name}`, preserving the existing description. Minimal change and visible-label prefix retained.

**B:** stable `aria-labelledby` references to the button text and row name. Avoids a duplicated label string, but adds DOM-ID wiring. Root accepted A and I independently reread the corrected source before native execution. No speech software/platform accessibility tree was exercised by this preflight.

**Observer admission:** the initial `saved-look-export-ui.mjs` set `status = passed` before a finally block that appended cleanup failures without changing status/exit. A retirement failure could therefore yield a false passing receipt. This is a source failure path, not an assertion that a cleanup failure actually occurred.

**A — accepted:** accumulate retirement/browser-close errors, then force failed before the final receipt save; exit nonzero after a cleanup refusal. Small reporting change, no additional product behavior.

**B:** separate behavior and cleanup outcomes with both required for admission. More reporting wiring. Root accepted A; I independently inspected the final catch/finally ordering and confirmed it cannot retain passed status after accumulated cleanup errors.

## Final preflight receipt

At `2026-10-03T02:48:33Z`, product SHA256 pins were `showcase.js: 4b7fc2ed318fbd39a6b9de263a59674ec950f97683b998a2385ed5ba693d2c5c`, `showcase.html: 51eef6cfaa595accb4ace95143eeb9954568fa1f839fc55b5b48e946f9ef5348`; observer `24d14488e1747816b1115ba9d5532af4d36194719f69d8b043df5beb239bb213`.

The source probe covers three actual downloads including Original and a Unicode/path-character name, unchanged owner/configuration/URL/storage, disabled unsupported entry, stale/deleted no-download refusals, mobile grid/keyboard order and an actual downloaded-file reopen. Complete-list images at both widths make all row actions inspectable. No demonstrated source blocker remains. Actual output-byte, native UI and cleanup verification is still pending; preflight is not a final behavior pass. Root owns the single GPU/browser probe; the critic did not edit product or execute it.

## Completed native postflight

**Accept the supported-entry export slice. No demonstrated remaining actionable defect.** The actual report SHA256 is `686cf9e902b8ba9e82074d3c05fceb9868f4faf44ce080f3a7d684404f1e462e`, PID37757, `2026-10-03T02:49:20.842Z–02:49:30.119Z`. It completed with passed status, zero errors, twelve warnings and two explicit clean retirement observations (`disposed: true`, `leaked: []`). The warning multiset exactly equals the preceding saved-colour V2 report: three existing rig fallbacks, three zero-index draw warnings and six inline-TSL warnings. This observation does not qualify the rig or those older warnings as resolved.

I independently hashed all380 live source entries, all four copied product/validator source files and both the current/copied observer. They match the report and preflight pins. I read the actual observer assertions and the corrected final status/cleanup path; no browser or observer rerun was performed.

The actual downloaded files were independently compared byte-for-byte with two-space-indented saved configurations plus a final newline, and passed the existing `readShowcaseSettings()` importer in a separate data-only Node invocation:

| File | Actual bytes | Actual SHA256 | Recipe observation |
| --- | ---: | --- | --- |
| `rose-settings.json` | 596 | `f7f0a8a185420c01de71f12a1ad8ae1fa7f2e524f64f748ba73f5f15b392f0e2` | Saved Rose teal: tint `#239c88`, top `#b78383`, shoes `#623c28`. |
| `original-settings.json` | 431 | `47d10564ca032ea512266fc8c6db7e6d9fced0f33fe543d77c2e61fae5a78c17` | Saved entry named Original: no hair-colour/tint or garment-colour override; its recorded Ecru wardrobe remains. |
| `portable-name-settings.json` | 596 | `f7f0a8a185420c01de71f12a1ad8ae1fa7f2e524f64f748ba73f5f15b392f0e2` | Same complete Rose recipe under the Unicode/path-character name. |

Independent character-by-character filename normalization agrees with all actual suggested names, including `sugata-Rose teal.json` and `sugata-日常 - -soft-- -rose- - -- -.json`. Japanese characters remain; the tested illegal path characters and trailing dots/spaces are removed/replaced as declared.

The report's original storage string recomputes to `62906d4c8bd7adfd8e722660adc81829d2f183fe8aff5cc07323ee4999a60ebd`. The independently reconstructed stale fixture (Rose tint amount0.6) hashes to `0055dae191a41f8bf35c17eb04eea9e0232b20bb1351db4037f08ff82d0232f2`; the subsequent removed-Original fixture hashes to `b96c3991be106e10aa40ab98e80dfac74e7cfc15e2a9165f8d652fd1c5db25fd`. These match the native guard receipts. Three successful download events remain three after disabled unsupported/stale/removed attempts. The observer checks both stale and removed error text and unchanged storage at each refusal. A separate call to the actual validator rejects the stored future configuration.

Before explicitly reopening a file, the native observations retain the original avatar owner, original Sage-violet configuration, URL and complete storage string. The Rose file is different from that active configuration, so this is a meaningful saved-recipe export check. The subsequent real file-input navigation restores the complete Rose configuration while retaining the then-current collection. All three files passed the data importer; only Rose received the native file-input/render roundtrip.

## Actual originals viewed and scope

I directly viewed and independently hashed every original under `captures/saved-look-export-2026-10-02-v1`:

- `desktop-saved-export.png`, 1440×1000, hash `b00845b8db873777b8864f76981ece1103709a1ac8c2502c28cccfe0b8219948`.
- `desktop-saved-export-complete-list.png`, **371×1187**, hash `2a013fc058f4ab0f64a753fc4b2503e22c8cb2f4d831a19840d72a9a8928888a`.
- `mobile-saved-export.png`, 390×844, hash `ae56a6c4fd5ac4b82a55f9ffe202996708b9f094e3ebedd5ad50f4ca5a3a3ad6`.
- `mobile-saved-export-complete-list.png`, **344×1187**, hash `cca453a45cd7a02063f08d042c01de4a9e1cbe9c565309649ccafb2ebf967e59`.

The report's `viewport` field on complete-list records describes the browser viewport, not those images' dimensions; the actual PNG headers above establish their dimensions. Complete-list originals show all five rows, clear two-column actions and visibly disabled future Open/Download actions. The Unicode name stays within the panel. Actual mobile first-row button bounds are167.609375×44px, within390px; rows pair Open/Rename and Download JSON/Remove. Source/native checks find no horizontal document overflow. The captured native Tab assertions cover Open→Rename→Download JSON→Remove in the first supported row.

All five recorded download names contain the visible “Download JSON” prefix and saved name. Every download description matches its row's Open description, including colour recipes where present and the unavailable explanation for Future look. These DOM values and actual pixels establish this bounded interface result; speech software and a platform accessibility tree were not exercised.

Screenshots were collected before direct downloads. The native owner/configuration/URL/storage checks establish preserved viewing settings without reopening; they are not a post-download pixel-equality, arbitrary orbit/attention-state or motion qualification. The feature covers supported recipes only, and does not export an entire collection or unsupported future formats. This is a complete result under the declared slice. No extra capture or retest is warranted by the evidence.
