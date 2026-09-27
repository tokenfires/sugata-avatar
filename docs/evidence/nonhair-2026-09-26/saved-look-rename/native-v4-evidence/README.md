# Native v4: functional checks pass, full capture rejected

`report.json.gz` and `manifest.json.gz` decode to the exact original files. `full-native-capture.tar.gz` contains every retained capture file, including all controller/source/build/host snapshots and original images. The receipt records the archive hash and every member's exact decoded bytes/hash. Runtime asset bytes are bound by source hashes; the capture did not duplicate those assets.

Original report SHA: `a4761a4fa035dfeee43018dec4280e5947ecfa7ad864869933fbf56078555b8c`.

- All 9 predeclared functional groups passed; both owners retired cleanly.
- Both owners consumed exact source-bound bytes for all six GLBs.
- 157 of 158 original requests finished; one mobile groom request has a failed terminal.
- The two raw errors are observations of that one request. The controller did not waive it or issue an acceptance seal.
- All 26 supplied-Blob images match the embedded source catalogue. Two mobile groom images lack the required successful original parent HTTP body.
- CDP data events total 3,347,176 decoded bytes and 3,276,800 encoded bytes for the failed request. Native read/consumption totals and hash are complete; those distinct counters are not substituted for one another.

`analysis.json` is a separate, source-bound interpretation; it does not edit the native report. See [the feature result](../RESULT.md) for integration scope and remaining uncertainty. The three loose PNG files are byte-identical originals for direct review.

Run `python3 docs/evidence/nonhair-2026-09-26/saved-look-rename/verify-native-v4.py` from the repository root to verify the lossless packet without extraction or native execution.
