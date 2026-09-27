# Rejected transport diagnostic, with corrected offline interpretation

The native run remains rejected. Its controller wrongly required all six default GLBs to be consumed through Three FileLoader. The captured source and bundle establish that casual/ecru’s casual outfit and shoes instead use `WardrobeStyles.loadFragment`: fetch, `Response.arrayBuffer`, exact styled-asset validation, then `GLTFLoader.parseAsync`. The body, bra, briefs and groom use FileLoader. No product/build correction was required.

`analysis.json` and `receipt.json` record the separate offline correction. All six application-consumed ArrayBuffer hashes match the frozen GLBs. Four original FileLoader reader groups each finish once, with exact complete byte totals. Every one of the 80 original network requests has a finished terminal; all 67 HTTP bodies and all 13 supplied-Blob image hashes plus exact parent HTTP bytes validate. The original 13 pending blob admission flags remain untouched: the controller threw before its admission loop.

For the groom, browser-time read completion is 909.9000000059605 ms, the ArrayBuffer fulfills at 913.3000000119209 ms, and its hash completes at 915.1000000238419 ms. Its original HTTP request also finishes, with a matching direct CDP body hash. Browser, CDP and host clocks are uncalibrated domains and are not compared across domains. No network failure terminal occurred in this run.

No JavaScript abort/stream-cancel/reader-cancel entry point was observed during installation. This successful instrumented startup does not explain the earlier intermittent aborted request, establish absence of internal browser cancellation, or prove observer-free behavior. Auxiliary Promise observers can affect scheduling and rejection bookkeeping. The original source-bound report and controller are preserved losslessly here; `analysis.json` does not issue a native completion seal.

One owner retired once, with zero tracked renderer memory and no leaked handles. No Rename interactions ran. The first startup plate is not a warmed visual workload, hair qualification or performance evidence.

The offline script is `../analyze-transport-v1.mjs`; it requires the exact raw capture and fresh output. Its shared classifier has six focused actual-fixture/hostile groups in `../native-consumption.selftest.mjs`.
