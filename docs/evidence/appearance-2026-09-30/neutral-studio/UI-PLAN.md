# Neutral Studio actual UI qualification

Use the unchanged candidate inventory from completed nativeV2reportSHA5f1c1bae5f713ff7718c2331a4027d1eb28459d6b307e0a50447fddc0672eb1c. Execute `node tools/critic/neutral-studio-ui.mjs`; freshraw`captures/neutral-studio-ui-2026-09-30-v1`. The scenarios/clock/ownership contract are in CAPTURE-PLAN.md's UI follow-up.

Independent preflight found that the observer expected `light=studio` in the URL, while the actual product canonicalizer removes that default. ChosenalternativeA: assert nullforStudio and explicitvalueforotherlights, retaining canonicalization coverage. AlternativeB: resolveURLsemantically, accepting equivalent spellings but losing canonicalization coverage. Corrected observerbeforefirstUIexecution; productunchanged.

## V2 observer recovery

V1 PID65774/session57992 ran19:11:50.711–19:12:09.725UTC, reportSHA0ff1035a9602102af33014433dc005a3dfd54ebed86d773aa6e2b2ab564912c4. It restored the named Neutral look exactly atstate13, then incorrectly required its description to appear in innerText while Savedlooks was collapsed after navigation. Allfiveowners retired withno reportedleaks; browser/tempserverclosed.

Chosen correction: explicitly open Savedlooks before requiring its visible NeutralStudio description. Alternative: read hidden textContent, which checks stored DOMlabel but not what a user can see. No productsourcechange. Freshraw`captures/neutral-studio-ui-2026-09-30-v2`; preserve V1 report,13states,threeimages,download andobserver.

The separate nativehigh immediate frames remain bounded observations. Root agrees with the critic to retain first-frame colour residue/stipple limits; freshhighNeutral portrait and actuallinearuniformswitching pass their respective scopes. No temporalconvergence, instantaneous-clean-switch or colour-calibration claim. A separate fixedpost-switchtime-series is the alternative if futurework needs that contract; no light/materialretune or epochsearch is justified here.
