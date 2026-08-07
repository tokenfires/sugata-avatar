# Affect, lipsync, gaze and animation — verified research

Researched 2026-08-06. Repo stats verified via GitHub/npm APIs. ⚠️ marks unverified or contested.

---

## 0. 🚩 Licensing landmines — resolve before writing affect code

| Resource | Licence | Consequence |
|---|---|---|
| **NRC-VAD v2.1** | **Non-commercial.** "You may not rent or license the use of the lexicon." | 🚩 **Directly hits our Tier-1 reflex affect design.** NRC sells a perpetual commercial licence — email saif.mohammad@nrc-cnrc.gc.ca. **Budget this early or pick an alternative.** |
| **Warriner et al. (2013)** | CC BY-**NC**-ND 3.0 | Same problem. |
| **openSMILE** | Open-source version explicitly non-commercial | Moot — no JS/WASM port exists anyway. |
| **Live2D Expandable Application** | **20% of revenue or $1.89/sale, whichever is higher**, plus mandatory pre-release approval | By itself a sufficient argument for the 3D/VRM path. |
| **VADER** | **MIT** ✅ | Its rule layer is usable and its `compound` is a well-calibrated valence estimate. |
| **pitchy** | **0BSD** ✅ | The only unencumbered piece of the prosody stack. |

**Consequence for Tier 1:** VADER (MIT) gives valence cleanly. Arousal is the gap. Options: license NRC-VAD commercially, derive arousal from acoustics only (defensible — see §4), or build a small open VAD lexicon. **Decide before Phase 5.**

---

## 1. Emotion representation

### The architecture: OCC → discrete label + intensity → PAD → mood

ALMA (Gebhard 2005), EMA, FAtiMA and WASABI all converge on this shape. **Discrete labels are the right *interface*; PAD is the right *state variable*** — it interpolates, decays and blends, which categories cannot.

Note that Barrett, Adolphs, Marsella et al. (2019) demolished reliable *inference* of emotion from facial configuration — **but we do expression production, not recognition.** Prototypical configurations remain the most legible signals available.

### ALMA OCC→PAD table (axes −1.0…1.0) — directly usable

| Emotion | P | A | D | | Emotion | P | A | D |
|---|---|---|---|---|---|---|---|---|
| Admiration | 0.5 | 0.3 | −0.2 | | Hate | −0.6 | 0.6 | 0.3 |
| Anger | −0.51 | 0.59 | 0.25 | | Hope | 0.2 | 0.2 | −0.1 |
| Disliking | −0.4 | 0.2 | 0.1 | | Joy | 0.4 | 0.2 | 0.1 |
| Disappointment | −0.3 | 0.1 | −0.4 | | Liking | 0.40 | 0.16 | −0.24 |
| Distress | −0.4 | −0.2 | −0.5 | | Love | 0.3 | 0.1 | 0.2 |
| Fear | −0.64 | 0.60 | −0.43 | | Pity | −0.4 | −0.2 | −0.5 |
| FearsConfirmed | −0.5 | −0.3 | −0.7 | | Pride | 0.4 | 0.3 | 0.3 |
| Gloating | 0.3 | −0.3 | −0.1 | | Relief | 0.2 | −0.3 | 0.4 |
| Gratification | 0.6 | 0.5 | 0.4 | | Remorse | −0.3 | 0.1 | −0.6 |
| Gratitude | 0.4 | 0.2 | −0.3 | | Reproach | −0.3 | −0.1 | 0.4 |
| HappyFor | 0.4 | 0.2 | 0.2 | | Resentment | −0.2 | −0.3 | −0.2 |
| Hope | 0.2 | 0.2 | −0.1 | | Satisfaction | 0.3 | −0.2 | 0.4 |
| | | | | | Shame | −0.3 | 0.1 | −0.6 |

Eight mood octants: Exuberant/Bored, Dependent/Disdainful, Relaxed/Anxious, Docile/Hostile.
Mood strength = distance from origin, max norm √3.

**ALMA time constants** — directly relevant to a continuity/affect architecture:
- Emotion decay: 20 s, linear, 500 ms period
- **Mood return to default: 20 minutes**
- Usual mood change time: 10 minutes
- Affect recomputed every 500 ms

### 🎯 WASABI threshold-and-saturate — the anti-mush mechanism

```
w = (1 − (d − Δ)/(Φ − Δ)) · i      where Φ > Δ
```

`d` = Euclidean distance from current PAD point to the emotion's anchor, `Δ` = saturation
threshold, `Φ` = activation threshold. **A radial basis function over PAD space with a dead zone.**

> **This is the direct answer to "how do I map a continuous affect vector to AUs without mush."
> Do NOT linearly blend all emotions weighted by proximity — that produces the average face,
> which *is* the mush. Gate with a threshold so only 1–2 emotions are ever active, and saturate
> so near-anchor movement doesn't flicker.**

WASABI anchors (−100…100) with base intensity: Angry (80,80,100) 0.75 · Annoyed (−50,0,100) 0.75 ·
Bored (0,−80,100) 0.75 · Depressed (0,−80,−100) 0.75 · **Fearful (−80,80,−100) 0.25** ·
Happy (80,80,±100) *and* (50,0,±100) 0.75 · Sad (−50,0,−100) 0.75 · **Surprised (10,80,±100) 0.0**.

Two details worth stealing: **happiness occupies four regions** (Ekman has one positive emotion,
so it must cover all of +P), and **base intensity 0.0 means the emotion cannot fire from affect
drift alone — cognition must trigger it.** Surprise is inherently event-driven. Fear at 0.25 is
"reluctant."

### 🎯 Dominance is NOT readable from a static face

Arellano et al. (AMDO 2014), **n=109**, 216 generated images, SAM ratings. Pleasure was reliably
identified, arousal mostly (except negative arousal), **dominance not at all**. Their conclusion:
*pleasure and arousal are expressible in the face; dominance is manifested during interaction.*

> **Dominance must be carried by posture, gaze policy, interruption behaviour and gesture
> amplitude — never by the face. This is a structural argument for full-body, and a place where
> Live2D cannot compete at all.**

### PAD → AU activation functions (Arellano, validated perceptually)

- **AU12** (lip corner puller) — **pure valence**: 0 for p<0, `2.0p` for p∈[0,0.5), 1.0 above.
- **AU15** (lip corner depressor): 0 for p>0, `−2.0p` for p∈(−0.5,0], 1.0 below.
- **AU5** (upper lid raiser) — **pure arousal**: 0 for a≤0.1, `(a−0.1)/0.7` for a∈(0.1,0.8), 1.0 above.
- **AU25** (lips part) — pure arousal: 0 below 0.3, `(a−0.3)/0.4` for a∈(0.3,0.7), 1.0 above.
- **AU26** (jaw drop): 0 below 0.35, `(a−0.35)/0.25` for a∈(0.35,0.6), 1.0 above.
- **AU43** (eye closure) — negative arousal: `a/(−0.6)` for a∈(−0.6,0), 1.0 below.
- **AU10** (upper lip raiser) — **pure dominance**, this is contempt: `2.0(d−0.5)` for d>0.5.
- **AU6** (cheek raiser): `2.0(d+0.25)` for d∈(−0.25,0.25), `4.0(0.5−d)` for d∈[0.25,0.5], 1.0 above.
- **AU1** (inner brow raiser), −P−D: `−4.0d` for d∈(−0.25,0], 1.0 below −0.25.
- **AU4** (brow lowerer), −P+D: piecewise on both P and D.

Validated per-mood AU sets: Exuberant 6,5,12,25,26 · Bored 1,2,4,15,43 · Docile 1,2,12,43 ·
Hostile 4,10,5,15,25,26 · Anxious 1,2,4,5,15,25,26 · Relaxed 6,12,43 · Dependent 1,2,5,12,25,26 ·
Disdainful 4,15,43.

### ARKit ↔ FACS

Best table: [Melinda Ozel's cheat sheet](https://melindaozel.com/arkit-to-facs-cheat-sheet/) (she's
a FACS coder and notes "there are many mistranslations out there").

🚩 **ARKit has no equivalent for AU11, AU13, AU23, AU38, AU39.** **AU23 (lip tightener) is a
notable loss — one of anger's most discriminative AUs.** If anger must read strongly, author a
custom `mouthTighten` shape.

### 🎯 The blendshape combination problem, and the one rule that fixes most of it

Linear blending of overlapping blendshapes produces double-transform / off-model artifacts.
Film rigs use 1000+ shapes; even stylized characters need 200–300, mostly correctives.

Mitigations by cost-effectiveness:

1. **Region segmentation** — brow / eye / mid-face / mouth-jaw blend independently.
2. 🎯 **Reserve the mouth for lipsync.** Emotion drives brow/eye/cheek; the mouth gets an
   **additive corner offset** (AU12/AU15) on top of the viseme, **never a competing absolute
   target. This single rule eliminates most emotion×speech mush.**
3. Correctives only for pairs we actually ship (~8 anchors × 15 visemes; author the handful that break).
4. Threshold + saturate (WASABI) so we never blend more than 2 emotions.

three.js note: morph targets live in a `DataArrayTexture` — **no 8-morph limit**, bounded by
`maxTextureSize` and VRAM. Compare **Live2D FREE's cap of 30 parameters / 3 blend shapes.**

---

## 2. Text/prosody → affect

### The modality split

> **Valence lives in the text. Arousal lives in the acoustics.**

Two independent confirmations. Yildirim et al. (ICSLP 2004): discriminant accuracy from acoustics
alone — energy 55.4% (best single feature), F0 50.9%, F0+energy 64.7%, all features 67.0%; **human
listeners 68.3%**, and the classifier makes the *same* mistakes (angry→happy 42, happy→angry 31).
Their conclusion: conventional acoustic parameters are ineffective for valence. Wagner et al.
(IEEE TPAMI 2023) reach CCC .638 for valence **by covertly learning linguistic information**.

Mean F0: neutral 188 Hz (SD 49) → angry 233 (84) → happy 237 (83). High arousal lifts F0
**~45–49 Hz ≈ +3.7 semitones**, and **F0 SD nearly doubles — variability is the stronger cue.**

GeMAPS % change from neutral (RAVDESS) — **loudness is the dominant arousal carrier by a wide margin**:

| Emotion | F0 mean | F0 std | Loudness | Jitter |
|---|---|---|---|---|
| Anger | +20.7% | +24.6% | **+365.5%** | +46.8% |
| Fear | +25.3% | −7.6% | +208.0% | +28.3% |
| Joy | +18.4% | +12.5% | +165.1% | +22.4% |
| Surprise | +18.7% | **+44.6%** | +98.8% | **+87.2%** |
| Sadness | +7.7% | +2.2% | +34.3% | +30.3% |

🚩 **Skip jitter/shimmer.** They're voice-*pathology* measures: fragile in real time, inconsistent
in the emotion literature (a 38-study review finds increase, decrease, *and* no effect), and
**meaningless on vocoder output** where the TTS controls them.

### Pooling word VAD → sentence VAD

There is **no canonical published algorithm.** The best documented recipe is
[sentimentr](https://github.com/trinker/sentimentr), and its key trick transfers:
**`δ = c′/√n`** — weighted cluster sum over the **square root** of sentence length, not the mean.
Mean pooling crushes long sentences toward zero.

**Asymmetric recipe:**
- **Valence** — √n-normalised signed sum with shifter handling, or just VADER `compound`.
- **Arousal** — **max, or mean of top-k (k≈3).** Arousal is unsigned; mean-pooling one intense
  word among nine calm ones gives "calm," which is wrong — **the intense word *is* the content.**

### Browser prosody extraction

- **Meyda** (MIT, 1.7k★, dormant but stable) — RMS, ZCR, spectral centroid/flatness/flux/rolloff,
  loudness, MFCC. **No pitch detector.**
- **pitchy** (**0BSD**) — McLeod Pitch Method, returns `[pitchHz, clarity]`. 🎯 **Clarity is the
  voiced/unvoiced gate** — reject <0.8–0.9 rather than smoothing garbage.
- 🚩 Use an **`AudioWorkletNode`, not `AnalyserNode`** — deterministic 128-sample blocks on the
  audio thread vs. a smoothed snapshot at the mercy of rAF jank. 1024-window/256-hop is plenty;
  affect envelopes move at 100 ms–1 s, not phoneme rate.
- **Normalise per-voice.** Absolute Hz is meaningless across voices.

**The shortcut is correct, not a compromise.** RMS + F0(mean, std) + clarity-gated voicing captures
~97% of the available acoustic signal. We already know valence from text, and synthesized audio is
clean and single-speaker.

### Latency

| Approach | Added latency |
|---|---|
| **Inline tags in the generation stream** | **~0 ms — and they arrive *ahead* of audio** |
| Lexicon hash lookup | <1 ms |
| Local DistilBERT-class in-browser (transformers.js WASM) | ~25–45 ms |
| Second LLM pass | +100–400 ms (off critical path only) |

🚩 **WASM beats WebGPU for small single-pass models** — `all-MiniLM-L6-v2` INT8 on an M2:
**WASM 8–12 ms vs WebGPU 15–25 ms**, plus a 1–5 s shader-compilation cold start. Ship WASM.

**Turn-taking norm** (Stivers et al., *PNAS* 2009, 10 languages): **modal response offset 0 ms in
every language**, cross-language mean +208 ms, all variation inside a ~250 ms band. Beyond ~500 ms
a gap reads as hesitation — which is *pragmatically meaningful*, not merely slow.

🚩 **The field ships at 750–1700 ms** (independent measurement across 10M+ production minutes)
against a human norm of 200 ms. **Our avatar layer is not the constraint** — but never add
expression latency *in series*; run affect inference in parallel with or ahead of synthesis.

⚠️ **Hume AI's Expression Measurement API shut down 14 June 2026.** Any design note assuming it is stale.

---

## 3. Lipsync

### Viseme sets

**Oculus/Meta OVRLipSync — 15**: `sil PP FF TH DD kk CH SS nn RR aa E ih oh ou`.

🚩 **Naming gotcha:** the last three are `ih/oh/ou` in Oculus naming, but **Ready Player Me, VRM
and TalkingHead all ship `viseme_I / viseme_O / viseme_U`.** Normalise at the boundary.

**Azure — 22 IDs**, with **separate IDs for diphthongs** (aʊ, ɔɪ, aɪ) which OVR lacks. Needs a
22→15 collapse table. **VRM's built-in set is only 5** (`aa ih ou ee oh`).

### The shipping options

**Azure TTS viseme events — strongest.** `VisemeReceived` with `AudioOffset`. Three payloads
including **3D blend shapes at 60 FPS, 55 floats/frame, in exactly ARKit's 52 order + head/eye roll**.
🎯 **Frames arrive batched *ahead* of the corresponding audio chunk** — Microsoft's own instruction
is to render each group immediately *before* its audio. That is the correct sign (see §3.3).

**ElevenLabs — character-level alignment only. No visemes, no phonemes.** You must run your own
G2P over their character timings.

**The sleeper picks** — low-latency streaming TTS *with* phoneme timings, so we skip G2P entirely
and need only a phoneme→viseme table:
- **Cartesia** `add_phoneme_timestamps` → IPA-like phonemes + start/end, on SSE *and* WebSocket.
- **Inworld TTS** `phoneticDetails` — IPA phone + timing + **a viseme symbol per phone**.

🎯 **HeadTTS** ([met4citizen](https://github.com/met4citizen/HeadTTS), 167★, MIT) runs
**Kokoro-82M ONNX in-browser via WebGPU/WASM** and returns `words[], wtimes[], wdurations[],
visemes[], vtimes[], phonemes[]` — **the scheduler's missing input, free, client-side, no eSpeak,
no GPL.** Strong candidate for our TTS layer.

**Rhubarb** — offline only, complete WAVE file input, ~70–80% unattended accuracy. WASM port exists
but is 30★ and self-labelled beta. **NVIDIA Audio2Face-3D** — open sourced Sept 2025, ARKit output,
but **no browser execution** (C++/CUDA or gRPC); server-side microservice only.

⚠️ `wav2arkit_cpu`'s model card says "1.8 MB" — **the real download is ~404 MB** (external weights).
Hard blocker for cold start.

### JS libraries — verified

| Library | ★ | Last push | npm/mo | Licence | Technique |
|---|---|---|---|---|---|
| **TalkingHead** | 1,460 | 2026-06-02 | 28,816 | MIT | Rule-based G2P → 15 visemes → ARKit |
| wLipSync | 80 | 2026-08-06 | 29,850 | MIT | **MFCC via WASM + AudioWorklet** |
| wawa-lipsync | 206 | 2025-11-07 | 12,946 | MIT | FFT → 7 bands → 4-state FSM (v0.0.2, pre-1.0) |

⚠️ **AnimaSync** appears in search results but **404s and is absent from GitHub search. Treat as deleted.**

### Coarticulation — TalkingHead's 3-key envelope

A working poor-man's Cohen–Massaro dominance function:

```
anticipation  min(60 ms, 2d/3)   — onset BEFORE nominal
attack        min(25 ms, d/2)    — fast, "pops open"
release       min(60 ms, d/2)    — slower, "closes smoothly"
max viseme duration 200 ms; repeated identical visemes merged at 0.7× duration
PP and FF peak at 0.9; everything else peaks at 0.6
```

### 🎯 AV-sync asymmetry — the design rule

**ITU-R BT.1359-1**: detectability **+45 ms audio lead / −125 ms audio lag**; acceptability
+90/−185 ms.

> **Humans tolerate audio *lagging* the mouth ~3× more than audio *leading* it.** Real-world sound
> always arrives after sight, so the perceptual system has a visual-first prior.
> **Always err toward animating early.**

This is why Azure's "render blendshapes before the audio chunk" is correct, and why **a purely
reactive FFT analyser — structurally one frame late and unable to anticipate — is the perceptually
worst-case architecture.**

⚠️ Correction worth propagating: the widely-repeated "150 ms visual lead" is real **only for
utterance-initial preparatory gestures**, not continuous speech, where synchrony is much tighter
(closing phase −20 to −80 ms).

---

## 4. Gaze, blink, micro-motion

Primary source: **Ruhland et al. (2015)**, *Computer Graphics Forum* 34(6) — *the* reference.

### Saccades

- **Main sequence**: 10° ≈ 300°/s; 30° ≈ 500°/s, duration <100 ms. Saturation beyond 15–20°.
- **Most natural saccades are 5–10°, duration 30–40 ms** — about one frame at 30 Hz.
- Latency ~200 ms. **Minimum intersaccadic interval ~150 ms.** Fixation durations **exponentially distributed**.
- **Microsaccades: 1–2/s, mean amplitude 30 arcmin, duration 25 ms.** Implement these.
- **Skip drift and tremor** — tremor is 50–100 Hz at <0.01°, below any display's resolution.
- Symmetric bell velocity profiles are fine; asymmetry is invisible to observers.

### 🎯 Blinks — where Live2D ships it backwards

Rates (Doughty's meta-study): reading 1.4–14.4/min · primary gaze 8.0–21.0/min ·
**conversation 10.5–32.5/min**. Baseline ~20/min. **Increased visual attention lowers blink rate;
working-memory engagement raises it** — and blink rate is a marker of central dopamine function,
making it a literature-backed channel for "cognitive effort" in an AI avatar.

**Kinematics — most implementations get this wrong:**
- Complete blink 100–400 ms. **Closing 50–100 ms; opening 150–300 ms.**
- **Downphase velocity ≈ 2× upphase.** Non-uniform within a single blink.
- Poisson process, but often co-occurring with gaze-shift onset, especially saccades >30°.

🚩 **Live2D's SDK default is 0.1 s close / 0.15 s open — the reverse of the human profile.**
Trutoiu et al. (*ACM TAP* 2011) found data-driven blinks **with full eyelid closure** are
consistently rated more natural; partial-closure blinks read as wrong.

> **Getting the asymmetry right is nearly free and beats the entire VTuber baseline on this channel.**

### Eye-head coordination

- **VOR latency 7–15 ms, gain ≈ 1.0.** Trivial: counter-rotate eyes by the head's rotation.
- Head recruitment threshold **15–20°** (graphics implementations use 10–15°).
- **Reactive**: eyes first (~200 ms), head 20–50 ms later.
- 🎯 **Predictable: head begins ~100 ms *before* the eye saccade.** A cheap, lovely tell — an avatar
  that knows where it's about to look moves its head first, and that reads as **intent rather than reaction.**
- **Head speed is an expressive channel; saccade speed is not** (subjects can voluntarily modulate
  head velocity, not saccade velocity).
- **Andrist et al.**: the *amount of head alignment* in a gaze shift changes perceived character —
  more head → affiliative, higher rapport; less head → referential, better learning. **One scalar, two social registers.**
- Smooth pursuit: latency 80–130 ms, breaks down above 30°/s. Rarely worth implementing.

### Gaze in conversation

- Listening: gaze away ~10%. Speaking: gaze away ~29%.
- Speakers look at listeners ~50% during fluent speech, **only 20.3% during hesitant speech.**
- **"Mutual-break" is the dominant turn-taking pattern**: speaker looks at listener at utterance
  end → momentary mutual gaze → listener breaks it and begins speaking.
- Speakers avert gaze during filled pauses — **gaze aversion is a speech-planning signal.**
- 🎯 **BEAT's rule, literature-faithful: gaze AWAY at THEME (70%), gaze TOWARD at RHEME (73%).**

⚠️ TalkingHead ships eye-contact probability 0.2 listening / 0.5 speaking, which **inverts** the
Kendon/Argyle finding. Use BEAT's.

### Pupil

Task-evoked response is only **~0.1 mm** above baseline — real but visually negligible.
Emotional-arousal dilation is larger (full range 2–8 mm). Ruhland reports viewers identify a
"scared" avatar at **75% accuracy from eye cues alone.**

> **Exaggerate well past physiological amplitude.** It's one blendshape or one UV scale, and it is
> the single most "alive" micro-detail per line of code.

### Head motion as visual prosody

Munhall et al. (*Psych. Science* 2004): head motion correlates with F0 and amplitude across all
6 DOF, **averaging r ≈ 0.63** in read speech, with **~64% correspondence between head nods/tilts
and pitch accents.** Subjects correctly identified **more syllables** when natural head motion was present.

⚠️ In natural conversation the correlations are much weaker than in read speech — **don't over-fit
a direct F0→head mapping.** A talking head with *plausible* head motion is rated more natural even
when uncorrelated with content.

---

## 5. Body

### Gesture-speech timing

**McNeill's phonological synchrony rule**: a gesture precedes or ends at, but **does not follow**,
the phonological peak syllable. Phase structure: preparation → pre-stroke hold → **stroke** →
post-stroke hold → retraction. **Only the stroke is obligatory.**

- **Stroke duration: mean 0.38 s, SD 0.14 s.**
- Perceptual tolerance ±600 ms, but **recall declines sharply after 400 ms** of stroke delay.
- **Rhythmic co-speech arm movement: 1.36 Hz whole-arm, 1.44 Hz wrist.** Acoustic amplitude and F0
  peaks occur just before maximum extension, within ~200 ms.
- 🎯 **Mass matters**: whole-arm movement raised F0 **+3.5 Hz** and amplitude +0.215 z (p<0.0001);
  wrist-only was much weaker. **A shoulder-driven beat should perturb the voice; a wrist flick shouldn't.**

> **Design rule: stroke onset 0–200 ms BEFORE stressed-syllable onset, never after. ~380 ms of
> stroke. Preparation therefore starts 400–600 ms before the target word — which means we need TTS
> word/phoneme timings ahead of playback.**

**Gesture rates**: cartoon narration 7.98 representational gestures/100 words (~13/min);
social-dilemma discussion 2.84/100 words (~4.6/min). **~3× spread driven by task register, not
personality.** Add beats (~50% of all gestures) → **~9–26 gestures/min**.

### BEAT's rules — still the best cheap generator

Cassell, Vilhjálmsson & Bickmore (SIGGRAPH 2001). Produces an utterance in **500–1000 ms**, less
than a natural inter-turn pause.

| Generator | Rule |
|---|---|
| **Beat** | Each RHEME with ≥1 NEW node → beat on the OBJECT phrase. Lowest priority, so beats survive only where nothing else claims the DOF. |
| **Surprising-Feature Iconic** | RHEME OBJECTs with atypical KB feature values get an iconic gesture. (Gestures depicting a feature *absent* from speech occurred **80%** of the time for surprising features.) |
| **Contrast** | Contrasted objects get beats; **exactly two** get the two-handed contrastive gesture. |
| **Eyebrow flash** | Raise brows during RHEME OBJECTs. |
| **Gaze** | THEME away 70%, RHEME toward 73%. |

Behavior Selection = per-DOF conflict resolution + **a priority threshold that is the
personality/energy knob**. Complexity O(Nd²), Nd < 10.

Modern successor: Torshizi, Hensel, Shapiro & Marsella, **AAMAS 2025** — LLM-driven gesture
selection, a direct descendant of BEAT's rules. **This is the pattern to copy.**

### 🎯 The web-native BML stack — the sleeper finding

**UPF-GTI ships a maintained three.js BML realizer.** Essentially undiscussed and directly usable:

| Repo | ★ | Last commit | What |
|---|---|---|---|
| [upf-gti/eBMLController](https://github.com/upf-gti/eBMLController) | 1 | 2025-12-15 | JS library driving three.js avatars from extended BML. Apache-2.0. Ships `BehaviourPlanner`, `CharacterController`, `body/GeometricArmIK`, `head/FacialController`. |
| [upf-gti/performs](https://github.com/upf-gti/performs) | 13 | 2026-06-10 | The realizer app. MIT. Importable as a module, three.js only. |
| [upf-gti/retargeting-threejs](https://github.com/upf-gti/retargeting-threejs) | **44** | 2026-04-13 | Humanoid retargeting solver. Apache-2.0. |
| [upf-gti/IK-threejs](https://github.com/upf-gti/IK-threejs) | 23 | 2025-12-22 | **CCD + FABRIK + hybrid with real joint constraints.** MIT. |

Concrete units worth lifting: `shoulderRaise` [−1,1] where **1 = 30°**; `elbowRaise` **1 = 90°**;
40+ named body-relative locations; `DIRECTED` motion default 0.2 m; `CIRCULAR` default radius
0.05 m; `FINGERPLAY` default 3 osc/s. **`faceEmotion` already accepts `"valaro": [valence, arousal]`** —
a VA input path is wired in. Block composition: MERGE / APPEND / REPLACE.

**BML 1.0 sync points** (`start, ready, strokeStart, stroke, strokeEnd, relax, end`) are McNeill's
phase structure made schedulable. ⚠️ The spec wiki last updated 2020; no 2.0. Design reference, not a standard.

🚩 Classic realizers are all dead ends for us: **SmartBody** community fork 3★ last pushed 2023;
**Virtual Human Toolkit** alive but Unity + USC-RL licence; **Greta/VIB** Java + Ogre, GPL-3.0.
**None run in a browser.**

### ML co-speech gesture — the honest answer

🚩 **Nobody has run one of these in a browser.** Verified negative across `gh search code`
(0 hits for `"DiffuseStyleGesture onnx"`, `"EMAGE onnx export"`, `'"gesture" "onnxruntime-web"'`),
the HuggingFace model+Spaces API, and npm.

**GestureLSM** (ICCV 2025, ~114 MB int8, 8 steps @ 0.039 s/frame) is the only plausible port —
but that's datacenter-GPU; expect **5–20× penalty** through WebGPU+JS, putting 8-step sampling at
~1.5–6 s/frame. **You'd generate in chunks ahead of playback, not per frame.**
Estimate **2–4 weeks to something, 2–3 months to good.** 🚩 Rule out MambaTalk/DiM-Gestor —
**Mamba selective-scan has no ONNX op and no WebGPU kernel.**

⚠️ **Nobody "won" GENEA 2023** — the organisers state it is not a competition and never published
the team↔condition mapping. The [continuous leaderboard](https://genea-workshop.github.io/leaderboard/)
is the real answer:

| System | Realism Elo | Align % | FGD |
|---|---|---|---|
| Motion capture | 1118 | 73.9 | 0 |
| **Seamless (Meta, 3,950 h)** | **1112** | **75.1** | 4.743 |
| Semantic Gesticulator | 1056 | 57.3 | **0.473** |
| DiffuseStyleGesture | 684 | 60.9 | 7.11 |

🚩 **FGD does not rank like humans do** — the best-FGD system ranks 5th; DiffuseStyleGesture has
2nd-best alignment and ranks *last*. **Don't optimise FGD.** And **Meta's Seamless, on 3,950 h vs
everyone's ~25 h, essentially matches mocap. Data scale is beating architecture.**

🎯 **Do the retrieval thing instead.** **TRiMM** is the only hard latency number in the literature:
**120 FPS, 0.15 s/sentence on an RTX 3060**, achieved by *retrieval over a library of atomic
actions*, not generation. Generate a motion library offline on our own GPU, retrieve and blend at
runtime — sub-100 ms today with zero ONNX work.

### BAP — posture coding that beats static pose

Dael, Mortillaro & Scherer. 67 movements → 16 factors explaining 73% of variance. **Codes *action*,
not static pose**, which suits us better than Coulson:

| Emotion | Factor | Loading | Prop. |
|---|---|---|---|
| **Anger** | Forward whole-body movement | **+1.96** | 100% |
| | Illustrative action | +0.88 | 100% |
| | Symmetrical up-down arm action (reduced) | −1.67 | 30% |
| **Fear** | Backward whole-body movement | **+1.46** | 30% |
| | Knee movement | +1.77 | 60% |
| **Joy** | Head tilted up averted, eyes closed | **+2.07** | 40% |
| | Symmetrical up-down arm action | +1.17 | 70% |
| **Sadness** | Arms held in front (reduced) | −1.08 | 60% |

Read directly: **anger = forward lean + restrained symmetric arms + rigid knees; fear = backward
retreat + head aversion + knee activation; joy = broad symmetric arms + head up + asymmetry;
sadness = arms drawn in.** An approach/avoidance axis crossed with an arousal axis — **exactly the
dominance channel the face cannot carry.**

### three.js animation stack — verified

🎯 **Bone masking, from `PropertyMixer` source:** normal blend accumulates **per property binding
(per bone track)**; if `cumulativeWeight < 1` the remainder blends toward the **saved bind value**.
Additive accumulates into a separate register with no normalisation.

> **three.js has no AvatarMask API, but because normalisation is per-bone, bone masking is achieved
> by filtering `clip.tracks` by bone name before constructing the action.** Clean, supported, one line.
> ⚠️ The `_propertyBindings`/`_interpolants` hack circulating on the forum touches private fields and will break.

⚠️ **Real gotcha:** if the base clip has tracks for *every* bone, a masked overlay blends against it
rather than replacing it. Author the base without the overlay's bones, or set the overlay to weight 1 there.

**IK options:**

| Option | Status |
|---|---|
| `CCDIKSolver` (in-tree) | ✅ Maintained. ⚠️ **`iteration` default is 1 in code, docs claim 5 — trust the code.** Per-chain **`blendFactor`** is new and important (blend IK against an animated pose rather than overriding). |
| [upf-gti/IK-threejs](https://github.com/upf-gti/IK-threejs) | ✅ **Best option.** FABRIK + CCD, one API, real `JOINTTYPES.{OMNI, HINGE, BALLSOCKET}` constraints. MIT. |
| [closed-chain-ik-js](https://github.com/gkjohnson/closed-chain-ik-js) | ✅ 293★, 2026-08-02, Apache-2.0. Robotics-grade, heavier than needed. |
| jsantell/THREE.IK | 🚩 **Stale — last commit 2021-10-27, npm from 2018.** Do not adopt. |
| `ikjs`, `fullik`, `three-fullik` | 🚩 **Do not exist on npm.** |

**No off-the-shelf browser full-body IK exists.** Build as: analytic two-bone per limb +
constrained CCD/FABRIK for the spine + look-at for head/eyes. Don't reach for a general solver.

⚠️ **`SkeletonUtils.retarget()` produces inverted feet / backward hands on Mixamo rigs** (it assumes
matching bind poses). The good path is official: three-vrm's `loadMixamoAnimation.js` —
`q' = parentRestWorldRotation · q · restWorldRotation⁻¹`, hip position scaled by height ratio. ~90 lines. Copy it.

---

## 6. VTuber / Live2D baseline

### What Live2D actually is

PSD art → ArtMesh → Deformers → **~40 standard parameters** — that is the entire expressive
vocabulary of a standard rig. `ParamAngleX/Y/Z` are **hard-capped ±30°**.

**Keyforms are the trick and the cost**: a parameter stores *artist-authored per-vertex mesh states*
at each key. 3×3 keys = **9 hand-drawn forms.** Combinatorial artist labor.

**Free liveliness values worth stealing** — breath uses five deliberately **co-prime** sine cycles
so it never visibly loops:

```
ParamAngleX     peak 15.0  cycle  6.5345
ParamAngleY     peak  8.0  cycle  3.5345
ParamAngleZ     peak 10.0  cycle  5.5345
ParamBodyAngleX peak  4.0  cycle 15.5345
ParamBreath     peak  0.5  cycle  3.2345   offset 0.5
```

### Where it breaks — our attack surface

Rotation hard-capped ±30° · no true 3D head turn (yaw is lateral vertex displacement + a redrawn
far-eye; nose/ear parallax is *painted*) · fixed camera, no parallax or novel viewpoints · no body,
no legs, no locomotion · **no hands or fingers** (discrete part swaps — cannot point at anything
continuously) · discrete pose switching via opacity cross-fade · fixed baked lighting · **new outfit
= new rig from scratch, no retargeting** · rig-only commissions $100–2,000, full art+rig
$2,000–5,000+, 2–3 weeks.

**Free 3D wins by construction**: novel viewpoints · true yaw past 30° including profile ·
perspective and parallax · full body, hands, fingers · dynamic lighting and shadow · continuous
poses · retargeting and shared motion libraries · **true convergent gaze** (VRM 1.0 `lookAt` models
convergence via asymmetric inner/outer range maps; Live2D's `ParamEyeBallX/Y` is a flat 2D shift
with **no convergence and no head parallax**) · unlimited expressions · **no licence, no revenue
share, no approval gate**.

### 🎯 The strategic perceptual findings

**AlterEcho** (Tang, Zhu & Popescu, IEEE ISMAR 2021), **N = 315** — deliberately *loosens*
performer↔avatar coupling, generating expressive nonverbal animation automatically.
**Rated significantly higher than both plain motion capture and VMagicMirror.**

> **Procedurally generated, semantically-driven nonverbal behaviour beats faithful tracking on
> perceived expressiveness. Every product surveyed is a *tracker*. We have the intent/affect stream
> natively; AlterEcho had to infer it. That is the opening.**

**Kätsyri et al. (2015)**: the naive uncanny-valley hypothesis was supported in **1 of 8** studies,
and Mori's movement-amplification prediction found **no consistent support** — but **perceptual
mismatch was well supported** (feature inconsistency 4/4).

> **The risk is internal inconsistency, not 3D and not realism.** A consistently stylized avatar is
> largely immune; a stylized avatar with one photoreal element is squarely in the valley.

**Zell et al. (2015)**, *ACM TOG* 34(6): **shape is dominant for perceived realism AND for perceived
intensity of facial expressions; material is key for appeal.** "Realism alone is a bad predictor for
appeal, eeriness, or attractiveness." **Expressive punch is bought with geometry, not shading** —
and the cheap-to-render choice is also the appealing one.

**Ruhland, Zibrek & McDonnell (2015)** — the single most useful result for this project:
participants reliably differentiated personality traits conveyed **only through eye gaze, blinks and
head movement**, and **this was robust across character realism.** The expressive signal lives in
that channel and survives stylization intact.

⚠️ **Garau et al. (2003)**: higher-realism avatars with inferred conversational gaze improved
perceived quality, but **the lower-realism avatar was made *worse* by inferred gaze.**
**Match gaze sophistication to visual fidelity.**

**Hyde et al. (2014)**: auditory expressiveness magnitude relates positively to both recognition
accuracy and rated intensity. **The voice carries recognition accuracy that facial animation cannot
substitute for.**

**Schwind et al. (2018)**: eye tracking across ~75 characters — **users fixate the eyes first**,
before assessing any other feature.

⚠️ **No rigorous head-to-head perceptual study of 2D vs 3D VTuber avatars exists.**

### The 2026 bar

**Warudo** (0.15.0, 2026-06-30, SIGGRAPH 2024 Real-Time Live!) is the checklist. Its decisive
architectural move: **its own mocap and animation pipeline is implemented in the same node-graph
users edit — there is no privileged internal layer.**

⚠️ **The niche is contested, not empty.** Warudo already embeds a browser with a bidirectional
JS↔blueprint bridge (`window.WARUDO_API`), and 3tene V PRO **ships an MCP server** (June 2026).

Notably, Warudo's `Body Rotation Type = Inverted` **by default, explicitly "to mimic Live2D models
and achieve a more anime look"** — it is already reverse-engineering Live2D's read.

---

## 7. Secondary physics

### VRM spring bones — spec, and two things to know before copying

Verlet, root→descendant:
```
inertia   = (currentTail − prevTail) * (1.0 − dragForce)
stiffness = dt * parentWorldRot * initialLocalRot * boneAxis * stiffnessForce
external  = dt * gravityDir * gravityPower
nextTail  = normalize(currentTail + inertia + stiffness + external − worldPos) * boneLength + worldPos
```

🚩 **1. The stiffness term is a constant-magnitude pull, not Hookean.** It adds
`boneAxis * stiffness * dt` regardless of displacement. There is no `k·x` and no separate damping
coefficient — damping is entirely `(1 − dragForce)`.

🚩 **2. It is framerate-dependent by construction.** Stiffness and gravity scale by `dt`;
**inertia does not.** Velocity retention is `(1−d)` *per frame* — `(1−d)^60` at 60 Hz vs
`(1−d)^144` at 144 Hz. **Same file, visibly deader hair on a high-refresh monitor.**

> 🎯 **A fixed 60 Hz timestep with max 2–3 substeps is a free win.** three-vrm is the outlier with
> *none* — Dynamic Bone, MMDPhysics and Magica Cloth all do it. This alone makes us look consistent
> on a 144 Hz monitor where three-vrm-based competitors look dead.

**`center`** evaluates inertia in another node's space — **support it from day one; it's what stops
hair exploding when the avatar walks.**

### Performance — real numbers

three-vrm PR #1539 optimisation, avg `vrm.update()`: VRM1_Constraint_Twist 658 → **145.7 µs**;
AvatarSample_C 1.0 ms → **415.2 µs**; Zonko_VRM 3.2 ms → **200.1 µs**.

> **A modern VRoid-class avatar costs ~0.1–0.5 ms/frame for spring bones — 1–3% of a 16.6 ms budget.**

Bone counts from real `.vrm` files: **~35–90 spring-driven transforms**, chains 3–6 joints,
colliders 22–28. **The dominant cost is `joints × colliders` = 460–1,400 checks/frame** — multiplicative.

🚩 **VRChat's PC "Excellent" budget is 16 affected transforms / 32 collision checks; "Poor" is
256/512. Stock VRoid avatars at 460–1,362 checks blow past "Poor" by 2–3×.** Pruning which collider
groups each chain references is the single highest-leverage optimisation available.

### 🎯 The best UX idea in the survey, which VRM lacks

**Unity Dynamic Bone** gives every scalar a matching **`AnimationCurve` distribution** evaluated
along **normalized chain depth** — root stiff, tips floppy, from one control. *This is why VRoid
emits near-identical numbers on every joint: it has to.*

Dynamic Bone's semantics are also cleaner than VRM's: *elasticity* = restoring lerp (the actual
spring); *stiffness* = a hard clamp on max off-rest deviation (a limit, not a force);
*damping* = velocity retention; *inert* = how much root world motion the particle ignores.

### Real VRoid values — de-facto industry defaults

| Group | stiffness | dragForce | gravityPower | hitRadius |
|---|---|---|---|---|
| **Bust** | **0.75** | **0.05** | 0 | 0.02 |
| Skirt / Sleeve | 0.5 | **0.05** | 0 | 0.02 |
| **Hair** | 0.4–1.0 | **0.4** | 0 / 0.1 | 0.005–0.026 |

🎯 **The pattern:** soft tissue and cloth get **very low drag (0.05 → 95% velocity retained/frame)
with moderate-high stiffness and zero gravity**; hair gets **8× the drag.** Deliberate — bust/skirt
want a fast, under-damped, quickly-settling *ring* around rest that gravity must not drag down;
hair wants a slower, over-damped drape.

**Jiggle-bone starting point: `stiffness 0.75 / drag 0.05 / gravity 0 / hitRadius 0.02`.**

⚠️ **`gravityPower` is 0 on almost everything.** Turning gravity on for hair is the classic way to
get droop that never recovers. ⚠️ Every chain's terminal joint carries inert values — ignore them
when reverse-engineering files.

**Facial soft tissue: no shipping VTuber pipeline runs physics on the face.** Blendshapes plus at
most a couple of jaw/cheek spring bones.

### Cloth — XPBD, and the substeps finding

**[Small Steps in Physics Simulation](https://mmacklin.com/smallsteps.pdf)** (SCA '19) is the more
important paper than XPBD itself: *"a single large time step with n constraint solver iterations is
less effective than n smaller time steps, each with a single iteration."*

| Scene | Config | Result |
|---|---|---|
| Cloth 150k particles | 1 substep × 30 iters | 12.4 ms, visible stretching |
| same | **30 substeps × 1 iter** | 13.5 ms, far stiffer |
| Cloth per-frame | 40 iters 1.8 ms vs 40 substeps 2.4 ms | **+33% cost for ~2 orders of magnitude less error** |

⚠️ Two caveats: the Δt² reduction applies to *positional* error only, and *"due to the Δt² term we
can run into the limits of single precision"* — **keep the avatar near the origin.**

Müller's calibration number: **6400 triangles at >30 fps on a phone, in plain JS** — roughly
50k particle-substeps/frame.

**Realistic budgets** (2–4 ms inside 16.6 ms): plain JS with typed arrays and zero allocation
**~5,000–10,000 particles at 10 substeps**. ⚠️ WASM+SIMD "10–15×" claims compare against naive
object-allocating JS; against a warm-JIT typed-array kernel, XPBD is **memory-bound, not ALU-bound**
— realistic gain **~1.5–3×**. WebGPU compute: 50k–150k desktop, but ⚠️ **the real cost is readback,
not throughput** — keep everything GPU-resident.

> **A single avatar's garment or hair is 1k–8k particles. That fits comfortably in plain JS.**

🚩 **There is no maintained three.js cloth library to adopt.** `three-cloth`, `threejs-cloth`,
`cloth-simulation` **do not exist on npm**. `cannon-es` has **no cloth or soft body** and is frozen
(last commit 2024-01-06). **Rapier will never help** — deformables issue open ~5 years, the
PhysX-5-style cloth request was closed in 2022, and the roadmap is robotics and GPU rigid bodies.

🚩 **Do not build on the three.js ammo path.** 2026-06-12 PR #33786 *"Remove ammo.js examples"* was
**merged** — *"couldn't figure it out. Decided to archive the examples instead."* Reverted the next
day only via CDN loading. **The maintainers wanted ammo gone and kept it because someone found a workaround.**

**Jolt is the strongest off-the-shelf option and is underrated** — `jolt-physics` **1.1.0, published
2026-07-11 (it left 0.x — a real stability signal)**. Its `.idl` has **137 `SoftBody` references**
including **`Skinned` + `InvBind`** (soft-body vertices bound to a skeleton — *exactly* what an
avatar needs) and **`RodStretchShear` + `RodBendTwist`** (Cosserat rods — **hair**).
⚠️ Manual memory management, *"nothing is cleaned up automatically"* — real leak risk in a
long-running session. ⚠️ three.js's Jolt addon has **zero** soft-body support; use `jolt-physics` directly.

⚠️ **WebGPU compute does NOT fall back to WebGL2** — the automatic fallback covers *rendering* only.
**If the cloth solver is a TSL compute kernel, Firefox users get nothing. Plan a CPU solver as the
fallback, not a renderer fallback.**

---

## 8. 🎯 Cross-cutting architecture

Three findings from different streams converge on one design:

### 1. The affect signal must flow forward, never be recovered backward

- Inline tags arrive ~0 ms and *ahead* of audio
- Azure blendshapes arrive batched *before* their audio chunk
- AV-sync tolerance is asymmetric at +45/−125 ms — **early is 3× safer than late**
- Gesture strokes must precede the stressed syllable by 0–200 ms, so preparation starts 400–600 ms early

> **Every timing constraint in this research points the same direction. A reactive architecture that
> analyses output audio is fighting all four.**

### 2. Split the affect estimate twice

**By modality:** valence from text, arousal from acoustics.
**By channel:** pleasure and arousal → the face; **dominance → posture, gaze policy and gesture
amplitude**, because dominance is not readable from a static face.

### 3. Smooth, don't switch

Never let a single utterance drive the rig. **Asymmetric exponential smoothing — fast attack
~150–250 ms, slow decay ~1.5–3 s** — buys robustness for free and reads as emotional inertia.
ALMA's much slower mood layer (10-min change, 20-min return) sits above it.

> **That two-timescale structure is what makes a character feel continuous rather than reactive.**

### Suggested build order

1. **Ocular + idle layer alone**, on a static neutral face — blinks with correct asymmetry,
   saccades on the main sequence, VOR, gaze policy, breathing, sway. **Highest perceptual return,
   needs no affect pipeline at all.**
2. **Viseme timeline interface** — `{viseme, startTime, duration}[]` scheduled against
   `AudioContext.currentTime`. **Prototype the envelope blender against a canned timeline with no
   TTS attached.** Scheduling with drift correction is exactly the race-prone category that deserves
   a standalone harness.
3. **PAD + WASABI thresholded activation → AU set → ARKit weights**, mouth reserved for lipsync.
4. **Body**: base stance crossfade ← additive breathing ← additive sway ← additive affect tone ←
   additive gesture strokes. Bone-mask by filtering `clip.tracks`.
5. **Spring bones with a fixed timestep** plus depth-distribution curves.
6. **Only then** cloth or ML gesture.

---

## 9. 🎯 The 10 things that most make an avatar feel alive

Ranked by perceptual impact **per unit of engineering effort**.

1. **Blinks with correct asymmetric profile and full closure.** ~30 lines. Live2D ships this
   backwards — beat the entire VTuber baseline in an afternoon. **Best ratio on the list.**
2. **Always-on procedural idle** — breathing + micro head motion on co-prime cycles. A day.
   A perfectly still avatar reads as dead within ~2 seconds.
3. **Saccades on the main sequence with real fixation statistics.** Half a day. Users fixate the
   eyes *first*, so error here is maximally visible.
4. **Conversational gaze policy** (not just gaze motion) — BEAT's THEME/RHEME rule. A day.
   Personality is reliably conveyed by gaze + blinks + head alone, **robust across realism.**
5. **Eye-head coordination with VOR, and head-leads-eye on predicted targets.** ~50 lines.
6. **Reserve the mouth for lipsync.** One architectural rule, near-zero code, eliminates the largest
   single source of mush.
7. **Lipsync from TTS-provided timing, scheduled early, with overlapping envelopes.** A few days.
   Getting the *sign* right matters more than getting the phonemes right.
8. **Spring bones with fixed timestep and depth-distributed parameters.** A few days.
   ~0.1–0.5 ms/frame.
9. **Postural sway, weight shifts, affect-driven posture.** A week, mostly authoring poses.
   **Where dominance finally becomes visible.**
10. **Pupil dilation exaggerated past physiology.** An hour. Ranks 10th only because it's subtle
    enough that people won't consciously notice — which is exactly why it belongs.

**Deliberately below the line:** ML co-speech gesture (do retrieval instead), cloth simulation
(spring bones cover the perceptually important motion), photoreal rendering beyond consistency
(shape drives expression intensity, not shading), webcam/mocap tracking (we have the intent stream natively).

---

## Corrections to propagate

- **Hume AI Expression Measurement API shut down 14 June 2026.**
- **NRC EmoLex ships 14,154 terms, not 14,182** (the wrong number is on the NRC site, Wikipedia, and
  hundreds of papers). **NRC-VAD v2.1 is −1…+1, not 0–1** — the NRC page still describes v1.
- **Nobody won GENEA 2023**, and **FGD does not rank like humans do.**
- **`CCDIKSolver.iteration` default is 1 in code, not 5 as documented.**
- **three-vrm's `dragForce` default is 0.4, not the spec's 0.5.**
