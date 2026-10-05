# Temporary runtime controller withheld

The official index supplies an exact Blender5.2.2 arm64 package and matching publisher digest, but this controller is unrun. The independent [source review](SOURCE-RESULT.md) and [root readback](ROOT-REVIEW.json) identify two real cleanup gaps: additional mounted entities lack full ownership, and process-collection exceptions can bypass detach/accounting. No package was downloaded, mounted or executed.

A CPU-only test of the parsed process-cleanup function starts two of four planned fixture cases and exits1 with PermissionError. The [retained stderr](PROCESS-OWNERSHIP.stderr.txt) is copied exactly from tool1ad9ca; the test never imported or invoked the complete controller. Both recorded descendants83596/83598 are absent in two later literal ps observers; their leaders were waited before the failed function. The cause of the permission result is unproved.

Original and corrected-but-rejected controller bytes remain isolated. A separate repair needs fresh worth and a complete ownership contract for actual attached-image provenance, independent cleanup attempts, and observed process-group state. The artist runtime goal remains undelivered; source compatibility, character appearance, wearable fit and the full AAA roadmap remain open.
