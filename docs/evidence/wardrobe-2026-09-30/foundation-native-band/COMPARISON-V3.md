# Comparator V3 — actual retained faces and loader weight storage

V2 PID 17158 ran 20:48:24.688–20:48:27.243 UTC before two further critic findings arrived. Its bone conversion is corrected, but its casual face inventory used any unmasked corner rather than all unmasked corners, and its weights used ideal float64 normalization rather than GLTFLoader's stored float32 normalized values. The V2 packet is preserved read-only; its report SHA256 is `b2c5697f9b0dd7cdc71de20caec418dcfb9656a473875f2f6f75f3a57a3cc7a4`. It is not labelled a complete runtime correspondence pass.

V3 uses the actual Wardrobe rule (any hidden corner removes a triangle), and the existing export bridge's loader convention (reciprocal L1, multiply, float32 storage before blending). It adds those exact implementation sources to the pins. Geometry, native data, poses, thresholds, independent coverage and candidate bytes remain unchanged. There is no native rerun.

The construction control's position, normal, UV and four-weight arrays exactly match the accepted bra. The critic independently confirmed equal oriented triangle multisets with different order. Accepted masks include later changes from `wardrobe_under_masks.mjs`, so V3 compares the pinned original authoring fixture arrays and reports actual added/lost visible faces. Root chooses to preserve the band's newly inherited masks (alternative A). The SHIPPED original is the visual baseline. Rebuilt control is a construction control with an explicit mask difference; it is not represented as a matched dressed product control. Reapplying the old calibration to this differently cut mesh is not authorized by the observation.

This is the final bounded observer correction before independent review and visual evidence. Any remaining disagreement is retained and diagnosed without a candidate parameter search.

The deliberately displaced negative control is interpretable only when its clean pose parent passes. V3 records this dependency and cannot report a detected control against a failed parent.
