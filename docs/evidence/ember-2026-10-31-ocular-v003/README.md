# Ember ocular v003 — readable iris retained, finish unaccepted

October 31, 2026 (America/Los_Angeles). Owner: chat `01a194ba-ffd1-7841-b0cd-2d40e0ac1924`. [Source attribution](../ember-2026-10-31-ocular-attribution/README.md) established dark red/brown input across both eyes, including the right annulus with zero sampled pupil texels. A small inner-left pupil overlap remains unresolved. No UV correction was justified.

**Decision:** root and independent critic viewed all four actual witnesses and retain v003 as a partial readability improvement. Dark pupils, olive/amber annuli and dark outer edges are now distinct; off-white sclera survives. The annulus is too uniformly pale/green and looks flat relative to portrait2. Fine radial detail and convincing corneal depth remain unaccepted. No further colour/exposure sweep or correction belongs to this slice.

- [Front/reference/warm](front-reference.jpg), draw1, smile .3409697180754864: matched 512-square canvas/camera/expression/light against v002, with different page viewport/layout.
- [Angle/reference/neutral](angle-neutral.jpg), draw3, smile .261196718093633: matched v002 angle state.
- [Front/gaze-left/neutral](gaze-left.jpg), draw5, gaze weights .6.
- [Front/gaze-right/neutral](gaze-right.jpg), draw6, gaze weights .6.

At both gaze endpoints root and critic see coherent pupil/annulus displacement without an obvious detached disc or broken edge. These stills do not qualify continuous motion, all gaze ranges, refraction correctness or pupil animation. Gaze presets reset the smile and part the mouth; they do not measure an expression improvement. Likeness remains unaccepted and the face still reads tense/blank compared with the reference's cheek-linked smile. Hair remains missing; mouth/speech clearance remains unqualified.

## Isolated implementation

The v003 page uses a frozen local copy of `EyeMaterial.js` with only two import relocations and one new iris-input block. The shared material is unchanged. The unmodified frozen PNG's refracted sample luminance modulates an authored amber-to-olive pigment using sqrt(L/.015), clamped .45–1.4. Coverage excludes exact black and fades over radial .84–1.0; the iris input is exactly original at radius >=1, not throughout that fade. Caustic, limbal optics, sclera settings and mapping remain unchanged. The v002 post-albedo tint/lift is removed rather than stacked. No raster image was altered or generated.

All 12 preflight inputs rehash unchanged, including v001/v002, GLB, fit, shared materials, rig, portraits and lockfile. New page/material syntax and diff checks passed; browser completed all intended renders without an error. Exact hashes are in [preservation.json](preservation.json). Four original browser JPEGs were saved with .jpg extensions after checking their encoding; no image edits/retakes. One candidate and four captures consumed.

The current chat initially had no retained review tab; one fresh supported symbolic-iab tab opened successfully and completed the v002 render before navigation to v003. No persistence prerequisite, reset, stale-tab cleanup, private transport or native fallback. The gaze selector's exact text locator missed once; the observed `pose` control selected successfully. No extra capture occurred. Left front/reference/warm draw8 for handoff.

Timer remains PAUSED, service preserved, no owned native/fitting job. Next is the compact human-directed brow/lash correction, separately preflighted; cheek/chin/dimple/lid/lower-lip/smile creases remain structural work. Preserve all versions and the full AAA/representation/wardrobe/coupled-fit/performance/VTuber/Mii roadmap. FaceBuilder/Core remains an external authoring dependency, with no new trial or purchase action.
