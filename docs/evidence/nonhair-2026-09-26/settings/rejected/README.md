# Rejected mobile capture

The first-pass mobile plate resized a frozen `?capture` page and took a screenshot without a manual render afterward. The canvas retained its desktop projection while its CSS box narrowed, making the avatar look stretched. This image is retained as capture-harness evidence only and must not support product appearance or mobile-restoration claims.

The corrected harness manually steps after viewport changes and asserts that the camera aspect matches the canvas client aspect. It also opens a fresh mobile page and restores the Original saved JSON through the native file chooser before checking the actual attached configuration and selected controls. The current parent `report.json` and mobile plates supersede this first pass.

`first-pass-report.json` records the rejected pass and its source hashes. The product source did not change during this correction.
