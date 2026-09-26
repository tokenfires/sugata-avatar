# Rejected UI run and response-evidence repair

The first native UI attempt stopped after two completed groups. It is **rejected and partial**. The original report/controller/manifest are preserved unchanged in `rejected-ui-native-v1/`; its `receipt.json` binds the originals in `captures/wardrobe-palette-references-2026-09-26/ui-native-v1/`. Report SHA-256: `efa39fedb62d7f7bad6aac037f11ba52b4abe3b6227e7336500752464299dca1`.

The preserved report contains six `response.body: Response body is unavailable for redirect responses` exceptions during Kitchen navigation. Its handler omitted URL/status/header metadata on failure. Therefore those six exact HTTP statuses and chains are **unknown**, and cannot be reconstructed honestly from the retained report. The earlier “redirect” description repeated the tool's error text, not a verified HTTP classification.

Installed Playwright `coreBundle.js:13125–13130` deliberately refuses `internalBody()` for every status300–399, including304. Pinned Vite static-serving code `node.js:20310–20313` returns304 with no body when the request's If-None-Match matches the asset ETag. A read-only HTTP witness against the existing development server fetched the actual qualified Ecru reference PNG as200 with its exact expected SHA, then obtained304/zero bytes using that returned ETag. The witness is `rejected-ui-native-v1/http-cache-witness.json`; it demonstrates current server semantics, not the lost native statuses. No browser/GPU was launched for this diagnosis.

The repaired controller now records the HTTP status, Location, ETag/Last-Modified, actual conditional request headers, method/resource type, request IDs and redirect ancestry for each bound response. It classifies:

- **200:** hash the actual successful body against the same manifest-bound asset or one of the six qualified PNGs.
- **304:** require an earlier observed200 body for the exact same URL in this run, its expected digest, and exact agreement between the current request's If-None-Match and the earlier response's ETag. Reject a Location, redirect ancestry, absent prior bytes, different validator or different expected bytes. Record explicit revalidation provenance instead of pretending another body was read.
- **301/302/303/307/308:** require a Location resolving to the same source-bound file on the exact server origin, preserving query semantics and refusing self-loops. Retain each actual request-chain edge, require the full chain to terminate in an actual hash-checked200 response, and reject unbound targets or unresolved chains. A redirect receives no fabricated body hash.

Other bound statuses reject. Unbound true redirects reject. Module `?import`/`?url` responses remain distinct from image bytes. No route, native cache, page source, product assets or browser launch flag changes.

Eight meaningful CPU controls cover successful-body classification, admissible304, missing prior bytes, changed validators/digests,304 carrying redirect ancestry, admissible same-file alias redirects, cross-origin/file/query/self redirects, missing/unbound Location and partial206 responses. `ui-response-policy-cpu-v2.json` binds the executed current controller. These are metadata-policy controls, not a substitute for a fresh native UI run.

The old native run observed two owners: the initial owner retired through real navigation; the partially reached Kitchen owner retired through the explicit synthetic cleanup fixture. Both receipts show disposed=true, no leaked handles and every recorded native memory counter zero. The `cleanupFailure` field repeats the response-binding assertion after cleanup; it is not a recorded nonzero disposal counter. The required eight-owner lifecycle and later mobile/JSON/named-look scenarios were **not completed**.

Fresh v3 controller/manifest/preflight are ready for independent review. All remaining native assertions, including exact eight-owner retirement completeness, remain unchanged. Root owns the next serial run; no native result is claimed here.

## Hashes

- `docs/evidence/nonhair-2026-09-26/next-visual-audit/ui-probe.mjs` — `939a2ae572d3bcee185f68c6e3e4e3fe5e682a3238a80e3618a729591348edc7`
- `docs/evidence/nonhair-2026-09-26/next-visual-audit/ui-manifest-v3.json` — `e16d33023e3bec88897adb0505320c2f4955411ec451ea042a77a8f7b65ee524`
- `docs/evidence/nonhair-2026-09-26/next-visual-audit/ui-preflight-v3/report.json` — `3fd6e55d49b5818e76a979cf8f8b17880c3c2ecba591e9ba07569036e3ba7fe4`
- `docs/evidence/nonhair-2026-09-26/next-visual-audit/ui-response-policy-cpu-v2.json` — `de15abe2b6e0054797e3a7243d9bee4a755a7d78591ce8595b62695a1d5c51e5`
- `docs/evidence/nonhair-2026-09-26/next-visual-audit/rejected-ui-native-v1/http-cache-witness.json` — `f26566234dd531a6983579fe45023e74ca20df5e2a9c3aabc074579e045f063b`
- `node_modules/vite/dist/node/chunks/node.js` — `2b4bf92e357f655bbcc69e08c4a6dd187ef1068412afd65bae9180f687b36912`
- `/Users/robault/.npm/_npx/361ceb562f3b3235/node_modules/playwright-core/lib/coreBundle.js` — `6be5c2ea035554e9b184b1dbc7aa5e7f1fb428dd1b5c202022858dcfae9bee27`

## Second rejected native run and retained-validator correction

The v3 controller's actual native UI v2 run is also rejected and partial: three completed groups, three admitted ready records and four observed retirements. Its exact report/controller/manifest are retained unchanged in `rejected-ui-native-v2/`. This time HTTP metadata establishes the failure precisely. The flow/depth PNGs had hash-verified200 responses142/143 with ETags, followed by hash-verified200 responses306/307 and460/461 with no ETag. Later304 requests614/615 carried the original exact If-None-Match. The old map had replaced the earlier response with the most recent headerless response, so its evidence lookup failed. No missing body hash, product failure or changed asset was observed. The run still does not complete the eight-owner/mobile/roundtrip qualification.

The v4 controller retains each actual hash-verified200 record per exact URL and selects a previous record only when its own recorded ETag matches the current conditional request and its digest matches the bound asset. A later headerless response receives no inherited header. The receipt points to the selected earlier actual response ID. Exact extracted records are retained as `validator-sequence.json`; the ninth CPU group exercises both observed sequences plus headerless-only, unseen-validator and cross-URL rejection. Other response/redirect/native gates remain unchanged.

Each requested screenshot now also saves the unchanged viewport framing beside the full-page image, without additional interactions or native updates. This provides a readable sticky-preview layout witness. Source admission remains distinct from native completion.

- `ui-probe.mjs` — `1979b81b43e0d38673f3d0c0ee45c4d8dc5fe468168a44ba39cd2fdfc3712faf`
- `ui-manifest-v4.json` — `373f9c605455a16e6c99b8cc8c0203adb1463e17ca308661b6eb189612517299`
- `report.json` — `8af924235aceea1d25a2d50d43cdc98d871d2902365cfd4634e9582d39ae0a7e`
- `ui-response-policy-cpu-v3.json` — `593445396eec9e0387bc65d1fe59603cc1bdb59ecf75595fb6b2a7d775a83304`
- `receipt.json` — `e3b01415dd9fd1ad980f0ce584335a1d1174bee7a309dd88f1cfc2868eb37844`
- `validator-sequence.json` — `748ed0d3a2846554fd8cdb8e160ac678f78f2fda8ba881d443fed2e1278c51fb`
