# REQ-064 — pre-registration, written before the first measurement

**Date:** 2026-08-23 · **Filed at:** `98bfc73` (tree clean) · **Status:** REGISTERED, UNMEASURED

This document is written **before any arm is rendered**. Everything below is fixed. If the
measurement wants a different threshold afterwards, the answer is a new registration for the *next*
decision, not a substitution here — `pre-registration-binds-the-registrant`, learned the hard way on
2026-08-22 when I tried to move my own bar in the conservative direction and the deciding agent
refused.

---

## 1. What REQ-064 actually is, and the two errors in its own entry

REQ-064 asks for a light near the view axis so the retroreflective TRT lobe has a geometry to fire
in. Two things in the entry are wrong and are corrected here rather than inherited.

### 1a. 🔴 The change clause names the wrong constant, and it is a FRAME ERROR

> `change:` Add a small, low-irradiance practical on the CAMERA AXIS to the portrait preset — a
> fifth placement at `azimuthDegrees` equal to `CAMERA_AZIMUTH_DEGREES`

`CAMERA_AZIMUTH_DEGREES = 12` lives in `packages/core/src/Avatar.js:233` and is the **camera's yaw
in the character frame** — `docs/PROGRESS.md:838` says it "puts the camera on the character's left".

`LightingRig.js`'s `azimuthDegrees` is a different frame. Its own docstring (line 265) says azimuth
is measured "from the direction of the CAMERA: 0° is a light sitting at the camera", and
`solve()` confirms it in code rather than comment — line 2288 builds the placement direction on the
`toCamera` basis vector:

```js
_direction
    .copy( toCamera ).multiplyScalar( Math.cos( azimuth ) * Math.cos( elevation ) )
    .addScaledVector( right, Math.sin( azimuth ) * Math.cos( elevation ) )
```

**So the camera axis is `azimuthDegrees: 0`, and `12` is 12° off it.** Implemented as written,
REQ-064 would place the glint off-axis for no reason and lose part of the peak it exists to reach.
`D_TRT = exp(17 cos φ − 16.78)`, evaluated rather than estimated:

| φ (deg) | D_TRT | note |
|---:|---:|---|
| 0 | 1.2461e+0 | the camera axis — the peak |
| 12 | 8.5943e-1 | what REQ-064 literally asks for |
| 42 | 1.5819e-2 | the key |
| 168 | 3.0965e-15 | the rim |
| 180 | 2.1357e-15 | the decoy arm below |

**The literal reading throws away 31.0% of the lobe's own distribution peak.** The lobe is
`exp(17 cos φ)`-sharp; 12° is not "near enough" to a term with that exponent, which is precisely the
property that makes this lobe worth aiming at in the first place.

`tools/critic/hair-lightpath.mjs:945` is where the error became invisible — *"12 is
`CAMERA_AZIMUTH_DEGREES`, read from the repo rather than picked"* — a sentence that made a frame
collision look like rigour. The measured arms are still valid as **near-axis** arms; what is void is
the justification of the number.

⚠️ This does NOT invalidate R26's or hair.md §9.4's figures. They measured a light 12° off the view
axis and that is what they should be quoted as.

### 1b. 🔴 The change clause asks for a FIFTH AREA LIGHT, which the rig cannot afford

`MAX_AREA_LIGHTS = 4` and `placements()` **throws** above it. Portrait already spends all four (key,
fill, rim, kicker). The budget is measured rather than stylistic — `docs/PROGRESS.md`: 4 lights at
3.604 ms, 8 at 7.421 ms, so **~0.954 ms per area light** against a whole hair budget of 1.870 ms.

A fifth `RectAreaLight` is therefore not affordable and REQ-064 as literally filed is un-shippable.

**It is affordable as a `DirectionalLight`**, and that is the form registered here:

- `MAX_AREA_LIGHTS` counts `placements`, which are all `RectAreaLight`s. A directional light is not
  in that array and does not hit the ceiling.
- `HairMaterial.js:50` records that a lighting model overriding `direct()` sees the **punctual**
  lights and that the panels go through `directRectArea()`. Both paths are implemented. A
  `DirectionalLight` is punctual, so it arrives through `direct()`, which already exists.
- It costs a dot product, not an LTC integration over a panel.
- `LightingRig.js:276` already defines authored `irradiance` "in the same units `DirectionalLight`"
  uses, so no new unit convention is introduced. `intensity = irradiance × exposure`, with no solid
  angle to divide by.

---

## 2. Why this is not the null I built last time

On 2026-08-22 I designed a 2×2 whose arms could not produce the effect the shipped BSDF is
incapable of making. The check that would have caught it, applied here:

**Can this change move the thing it is measured on?** Yes, and by a stated mechanism:

- TRT is `absorbTRT = pow(colour, 0.8/cosθ_d)` — **the only shipped lobe that multiplies by the
  hair's own colour.** R is pure Fresnel and takes the light's colour (measured R/B 1.031); TT ships
  at `weightTT = 0` and was closed on 2026-08-22.
- TRT's azimuthal distribution `exp(17 cos φ − 16.78)` is `2.136e-15` at the rim and `1.2461`
  on-axis — a factor of **5.8e14**. The lobe is not weak here, it is *unlit*.
- `sideVisibilityNode = saturate(toLight·toView + 1)`, Karis' slide-47 occlusion, is `1` (maximum)
  for a light on the view axis. The glint is placed exactly where that occlusion cannot suppress it.

So the arms differ in a term that exists, is colour-carrying, and is currently receiving
`exp(−16.78)` of its peak. That is a real lever, not a null.

⚠️ **And the honest counterweight, registered in advance so it cannot be discovered as a surprise:**
on a `#150F17` fibre, `C^(0.8/cosθ_d)` is **0.022**, so TRT peaks near 0.0014 sr⁻¹ *whatever* is
pointed at it. R26 measured TRT reaching **1.30% of the mass** even with a near-axis key. This
change gives a saturated lobe its geometry; it does not make it large. **If the finding is "real,
attributable, and small", that is a PASS of the mechanism and a possible FAIL of the gate below,
and both must be reported.**

---

## 3. 🔴 The failure mode this registration exists to prevent

`LightingRig.js` already measured a near-axis light and recorded why the result was untrustworthy:

> **REQ-064's camera-axis light lands on the FLOOR, not on the band.** […] slide 39's
> multiple-scattering fake carries 65.4% of the groom's rise and its whole angular dependence is a
> wrap-around cosine, so a better geometry feeds the fake before it feeds the lobe.

Both arms that ever cleared the contrast gate (6.030 and 4.291) were measured **with the fake off**.
So the live hazard is: add the light, watch the groom brighten 12.9%, and attribute to TRT a rise
that is mostly the fake being handed a better wrap-around cosine.

**Therefore the gate below is an ATTRIBUTION test, not a magnitude test.** A magnitude threshold
would be a number I picked; an attribution threshold is the actual question.

---

## 4. The registered decision rule

**Mask:** the gated hair mask from `tools/critic/hair-lightpath.mjs` (the one that yielded 207,947
px for R26), held constant across every arm. **NOT** the shipped-minus-nohair difference mask —
`LightingRig.js`'s own ⚠️ records that its p95 is skin the groom shadowed, not a hair pixel
responding to the rig.

**Statistic:** mean CIELAB `C*` of the **top-decile-luma** hair pixels ("the highlight band"),
reported in the encoded domain, with scene-linear radiance printed beside it and the transfer
stated per column. Chroma, because the complaint is colour and *both* prior assessments of REQ-064
used a brightness metric and correctly found it small — `docs/research/pedestal-look-2026-08-22.md`
§3: **"That was the wrong metric."**

Four arms, one factor each, plus a decoy:

| arm | query |
|---|---|
| `shipped` | baseline, fake on, no glint |
| `glint` | fake on, glint on-axis |
| `shipped, fake off` | `hairscatter=0` |
| `glint, fake off` | `hairscatter=0`, glint on-axis |
| `decoy` | glint at `azimuthDegrees: 180`, same irradiance |

### The gates, all three of which must pass to ship

1. **ATTRIBUTION — ≥ 50% of the chroma gain is TRT's.** The gain measured with TRT present must be
   at least twice the gain measured with `hairlobes` excluding TRT, in the shipped configuration
   (fake ON). This is the clause that encodes the 65.4% error.
2. **VISIBILITY FLOOR — ≥ 1.0 encoded code value** of increase in top-decile mean `C*`. Grounded
   rather than picked: below one code value of an 8-bit plate the change cannot be seen, so it
   cannot be the fix for a complaint about how something looks.
3. **COST — the nine-scene gate table, the skin and eye gates, and G2's saturation clause all stay
   green.** `studio` is the calibration reference at `fac62c50d56590fb` and a rig light lands on
   every scene. G2 is already 0.001 inside its bound, so this gate is expected to be the binding
   one.

### The decoy null

The `decoy` arm puts the same light at azimuth 180 — behind the subject, where `D_TRT` is
`2.136e-15`. If the decoy moves top-decile `C*` by **more than half** what the on-axis arm does, the
statistic is reading a brightness change and the whole measurement is void regardless of gates 1–3.

### What is NOT a ship criterion

The groom's overall brightening. R26 measured 12.9% and it is not the question. It is reported and
it decides nothing.

---

## 5. Registered outcomes

- **All three gates pass** → the glint ships in the portrait preset, REQ-064 moves to APPLIED, and
  the nine-scene table is re-baselined in the same commit.
- **Gates 1 and 2 pass, gate 3 fails** → the mechanism is confirmed and the rig cannot afford it.
  REQ-064 takes its own second clause: *"record in the preset's comment that the rig deliberately
  has none and that the secondary hair band is therefore not available on it"* — with the
  measurement attached, so the next reader inherits a closed question rather than an open one.
- **Gate 1 fails** → the gain is the fake, exactly as `LightingRig.js` predicted, and REQ-064 closes
  as REFUTED with the fake named as the thing that ate it.
- **Gate 2 fails alone** → real, attributable, invisible. Closes as CONFIRMED-BUT-BELOW-THRESHOLD,
  and the note says a lighter fibre colour is the precondition, since `C^(0.8/cosθ_d)` = 0.022 is
  the ceiling and it is set by the hair's own colour, not by the rig.
- **The decoy moves** → void; fix the statistic and re-register.

---

## 6. What this does not touch

The harness rewrite (P0) is the next task and is deliberately separate. Nothing here changes
`frame-budget.mjs`, the ribbon path, or the primitive decision.
