# GPU capture V1: missing favicon; bounded instrument repair

V1 PID 6641 / session 97068 ran 18:33:25.846–18:33:30.854 UTC and collected all 11 readbacks and eight images. Its strict no-console-error gate failed on a browser 404 message. Original report SHA256 `32563e6d2bb31c22a514862c445749f16647e8b78d249fbecb6472fb7ac7872d` remains failed. Cleanup released five private storage attributes and closed browser/temp service.

The initially captured message omitted its request location, so root did not assume a cause. A separate initial-page-load diagnostic, `node tools/critic/eight-influence-network-diagnostic.mjs`, PID 9254 / session 90671, recorded CDP Log and Network events without invoking any compute case or drawing a candidate. It reproduced the browser network error at **http://localhost:5301/favicon.ico**, status 404. Its original report is `captures/skeleton-full-influences-network-2026-09-30-v1/report.json`.

Two repairs:

1. **Chosen:** give this standalone diagnostic HTML an explicit empty data-URL favicon, preventing the unintended default request. Preserve the strict no-error gate.
2. **Alternative:** add an actual favicon resource to the temporary served app. This also resolves the missing request but changes shared testbed content unnecessarily for this standalone probe.

V2 changes only that HTML icon declaration, the new refused-if-existing output root and console-error location recording; it additionally binds this recovery note. The GPU kernel, prepared geometry/weights/matrices, nine clean cases, two negatives, cameras, material method and thresholds are unchanged. Compare prepared-input hashes and kernel-source hashes after collection. Original V1 outputs/source remain intact. This is instrument recovery from an identified missing resource, not skinning retuning or acceptance-threshold relaxation.
