# Readiness guard correction

This run correctly initialized native cards, but stopped before saving any image because the
new driver compared the calibrated absolute exposure (2.04) with the scene's relative multiplier
(2.4), and read the clock from an absent `motion.clockSeconds` property. The native record proves
the intended recipe was active and `motion.timeSeconds` was zero. The corrected driver checks
`avatar.lighting.exposure` and its complete scene scales against the scene definition, plus
`avatar.clockSeconds` and the motion clock. Use `clothed-verified` for actual visual evidence.
