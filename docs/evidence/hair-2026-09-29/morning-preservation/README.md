# Morning preservation and local links

The final read-only preservation check verifies 25 prior manifests, covering **24,135 unique files / 24,621,016,869 bytes**. Both accepted bob assets and the figure asset match their recorded hashes. All six original Downloads images and their local reference copies match the reference index.

- [Successful preservation report](../../../../captures/bob-morning-preservation-v2/report.json)
- [Local link check](../../../../captures/bob-morning-links-v1/report.json): 905 explicit local targets across 50 documents resolve; one external destination was skipped. Heading fragments, dynamic links and semantic intent are outside this file-existence check.
- [Receipt manifest](archive-manifest.json)

Preservation v1 verified every raw archive file, then failed because its new checker accidentally used the figure's expected hash for the separate wardrobe-body path. Original capture reports identify `assets/figures/figure_g050.glb` as the correct pinned figure. The unchanged v1 failure/source are preserved; v2 corrects that path, rechecks all archives and completes successfully. This is an instrument correction, not a changed acceptance hash or asset repair.

Sessions 68997 / PID 60604 (v1) and 61626 / PID 60855 (v2) are complete and collected. No new rendering or body oracle ran. These receipts establish local byte preservation, not visual acceptance or an off-machine backup. The original images/readbacks remain in ignored local capture directories; the tracked manifests cannot reconstruct missing files.
