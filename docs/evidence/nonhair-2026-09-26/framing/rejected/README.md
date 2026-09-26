# Rejected framing candidates

- `first-pass/` and `diagnostic/`: using rounded CSS client width/height for fitting lost about 0.09 CSS pixels of the specified 16-pixel gutter on standalone mobile portrait. The actual renderer aspect differs slightly because temporal antialiasing uses rounded scene-target dimensions. The revised helper uses the camera's actual aspect and observes subsequent aspect changes. No tolerance was loosened.
- `full-card-envelope/`: this corrected candidate passed both bob02 pages, mobile fitting, real drag/wheel/reset, resize roundtrips and active attention continuity. It then correctly failed the requirement to preserve bob01 desktop composition: fitting every raw card vertex reduced desktop zoom to about 0.803. Long lower cards extend outside the accepted close portrait crop. This candidate is not accepted as preserving desktop framing.

The original direct-navigation baseline is separately retained in `../baseline/`. Neither failure qualifies hair appearance or asset changes; all asset bytes remained unchanged.
