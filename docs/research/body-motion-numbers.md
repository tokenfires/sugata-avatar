# Body motion — implementable numbers

Researched 2026-08-06 from primary literature. These are the constants Phase 3 (motion) and
Phase 5 (affect→posture) are built from. Caveats and source disagreements are flagged inline —
**read them before trusting a sign convention.**

---

## 1. 🎯 The single most important design signal

**GRETA expressivity evaluation** (Hartmann, Mancini & Pelachaud, AAMAS 2005, N=52):
forced-choice discrimination of which expressivity parameter was modified.

**Overall accuracy: 43.1%.** Per-parameter hit rates:

| Parameter | Hits | Reads reliably? |
|---|---|---|
| **Temporal Extent** (velocity) | 104/141 | ✅ **yes** |
| **Spatial Extent** (amplitude) | 77/106 | ✅ **yes** |
| Fluidity | 42/124 | ❌ no |
| Power | 42/130 | ❌ no |
| Repetition | 35/125 | ❌ no |
| Overall Activation | 20/116 | ❌ no |

**Only amplitude and speed read reliably. The other four are confused with each other.**

**Consequence for us: spend the expressive budget on Spatial Extent and Temporal Extent.**
Fluidity/Power/Repetition are worth implementing as low-cost modulation, but do not spend
engineering effort tuning them and do not expect a critic to perceive them. This is the kind of
finding that saves a phase of wasted work.

All six parameters are floats on **[−1, +1]**, 0 = unmodulated. Repetition is discrete {0,1,2}.
Experiments sample at 0.25 steps (9 levels).

## 2. 🚩 No quantified PAD → body mapping exists in the literature

Searched thoroughly. Ball & Breese (2000), MAX (Becker 2004) and GRETA all describe the
coupling **qualitatively only** — no coefficients, no tables.

**We are building one.** The two published sources to derive it from:

- **Coulson's Table 4 betas** — the closest thing to a dominance/openness → joint-angle mapping.
- **Wallbott's three movement-quality scales** — the closest thing to an arousal → body mapping.

Do not let a search result convince you a PAD-to-degrees table exists. It does not.

---

## 3. Emotion → posture: Coulson (2004)

*J. Nonverbal Behavior* 28(2):117–139. 7 DOF (weight transfer + 6 joint rotations), 176
postures × 3 viewpoints, 6-AFC, chance 16.7%.

**Table 1 — joint rotations, degrees.** Right-handed, origin at joint centre, positive = forward.
Shoulder ad/abduct is relative to arm raised out to the side at shoulder level: **negative =
arms above shoulder level (abduction), positive = arms toward trunk (adduction)**.

| Emotion | Abdomen twist | Chest bend | Head bend | Shoulder ad/abduct | Shoulder swing | Elbow bend | Weight |
|---|---|---|---|---|---|---|---|
| Anger | 0 | 20, 40 | −20, 25 | −60, −80 | 45, 90 | 50, 110 | Forwards |
| Disgust | −25, −50 | −20, 0 | −20 | −60, −80 | −25, 45 | 0, 50 | Backwards |
| Fear | 0 | 20, 40 | 25, 50, −20 | −60 | 45, 90 | 50, 110 | Backwards, Neutral |
| Happiness | 0 | 0, −20 | 0, −20 | 50 | 0, 45 | 0, 50 | Forwards, Neutral |
| Sadness | 0, −25 | 0, 20 | 25, 50 | −60, −80 | 0 | 0 | Backwards, Neutral |
| Surprise | 0 | −20 | 25, 50 | 50 | −25, 0, 45 | 0, 50 | Backwards |

🚩 **Verify sign conventions visually in our rig before trusting either table.** Three problems
in the published paper:
1. Posture counts don't reconcile for **fear** (level product = 48 vs printed 24) or **surprise**
   (product = 12 vs printed 24). A level list is mis-set or truncated.
2. **Shoulder-swing signs are inverted between Table 1 and Table 4** (−90/−45/+25 vs +90/+45/−25).
   Magnitudes agree.
3. Figure 2's exemplar labels are offset by one row.

**Recognition ceilings — this matters for what we can expect a critic to read:**

| Emotion | Best single posture | Note |
|---|---|---|
| Happiness | 95% (rear) | reads best from front |
| Sadness | 95% (side) | most robust across viewpoints (r = .64–.79) |
| Anger | 90% (front) | reads best from front |
| Surprise | 71% (side) | |
| Fear | 67% | worse from front |
| **Disgust** | **43%** | 🚩 **no disgust posture reached 50% from any viewpoint** |

**Disgust cannot be conveyed by posture alone.** It must come from the face. Design accordingly —
don't waste effort on a disgust posture and don't let a critic's failure to read it count against
the body system.

**Coulson's verbal summary, which is what we actually implement:**
- **Anger** — head backward, no backward chest bend, no abdominal twist, arms raised forward and up, weight forward or backward.
- **Fear** — head backward, no twist, forearms raised, weight backward or forward; chest bend and upper-arm position irrelevant.
- **Happiness** — head backward, no forward chest movement, arms above shoulder level, straight elbows, weight irrelevant.
- **Sadness** — **the only emotion with forward head bend**, plus forward chest bend, no twist, arms at side of trunk.
- **Surprise** — backward head and chest bend, any abdominal twist, arms raised with straight forearms.

Confusions fit a 2-D circumplex (Stress-1 = 0.08) with **happiness and surprise co-located**.

## 4. Movement quality → arousal: Wallbott (1998)

*Eur. J. Soc. Psychol.* 28:879–896. Three quality scales rated 1–3. **Directly usable as
arousal-like gains.**

| Emotion | Activity | Expansiveness | **Dynamics/energy** |
|---|---|---|---|
| Hot anger | 2.00 | **2.00** | **2.73** |
| Elated joy | **2.19** | 1.94 | 2.13 |
| Terror | 1.94 | 1.38 | 2.00 |
| Despair | 1.81 | 1.50 | 1.88 |
| Shame | 1.75 | 1.06 | 1.38 |
| Interest | 1.75 | 1.25 | 1.75 |
| Cold anger | 1.69 | 1.44 | 1.69 |
| Fear | 1.63 | 1.13 | 1.69 |
| Disgust | 1.56 | 1.00 | 1.25 |
| Pride | 1.56 | 1.25 | 1.50 |
| Happiness | 1.50 | 1.06 | 1.19 |
| Boredom | 1.44 | 1.00 | 1.19 |
| Sadness | 1.25 | 1.06 | **1.00** |
| Contempt | 1.06 | 1.06 | 1.31 |
| **F** | 4.60 | 7.64 | **14.10** |

🎯 **Dynamics/energy has by far the largest between-emotion F (14.10) and the widest spread —
1.00 (sadness) to 2.73 (hot anger), a 2.7× range.** This is our primary arousal gain.

Note this converges with the GRETA finding: dynamics/energy is Wallbott's origin for GRETA's
**Power** parameter, which did *not* read reliably in isolation — but as a *gain on amplitude and
speed* it is strongly emotion-discriminative. Apply it as a multiplier, not as a standalone channel.

Discriminant analysis: **54% correct classification of 14 emotions vs 7% chance.** Best: shame 81%,
elated joy 69%, hot anger 67%. Worst: despair, terror, pride (38%).

Low-frequency but emotion-specific: arms upward → elated joy; index-finger pointing → hot anger;
shoulders backward → disgust.

## 5. Laban components → emotion: Melzer et al. (2019)

*Front. Psychol.* 10:1389. Odds ratios, component present vs absent. **Movers were instructed only
in LMA components — no emotional intent** — which makes these unusually clean.

| Emotion | Component | OR |
|---|---|---|
| Happy | **Rhythmicity** | **34.64** |
| Happy | **Spread** | **23.42** |
| Happy | Jump | 15.29 |
| Happy | Free + Light | 15.48 |
| Happy | Rotation | 12.68 |
| Happy | Up and Rise | 10.94 |
| Anger | **Sudden** | **9.42** |
| Anger | Strong | 3.74 |
| Anger | Advance | 3.20 |
| Anger | Direct | 1.56 |
| Sad | **Head-drop** | **7.60** |
| Sad | Sink | 2.47 |
| Sad | Passive Weight | 1.64 |
| Fear | Twist and Back | 3.06 |
| Fear | Retreat | 2.65 |
| Fear | Condense and Enclose | **0.77 — decreases fear** |

Recognition: happiness 81.3%, sadness 78.5%, neutral 67.4%, fear 51.1%, anger 47.2%. Overall 67.3%.

🚩 **Cross-emotion leakage to design around:** Condense-and-Enclose reads as **sadness** (OR 4.14),
Bind reads as **anger** (OR 3.75), and **all four anger components actively suppress fear readings**
(ORs 0.21–0.50). So a "scared" pose built from condensing will read as sad, and anger and fear are
not a simple continuum.

---

## 6. Breathing

### Rate

🚩 **The clinical "12–20 brpm" is a convention, not measured data** — repeated without primary
support across StatPearls, RCP 2017, RCUK 2015.

Best modern population data — **KORA-FF4 (2025), n = 2,224 adults**, RR from 5-min resting ECG:

| Statistic | brpm |
|---|---|
| Median | **15.80** |
| IQR | 3.16 |
| 5th percentile | 12.06 |
| 95th percentile | 20.06 |

By age: 39–48 y **15.62**; 49–58 y 15.26; 59–68 y 15.80; 69–78 y 16.15; 79–88 y 17.01.

**Our resting default: ~15–16 brpm ≈ 0.25–0.27 Hz. Not 12.**

**Under acute stress** (Kaplan 2023, n=55, PASAT stressor): reactivity tertiles **−1.29, +4.02,
+9.17 brpm** over baseline. So **+4 to +9 brpm ≈ 20–25 brpm** for acute arousal.

**Maximal exercise** (Blackie 1991, n=231): **RRmax 36.1 ± 9.2 brpm** — note the textbook "40–50"
is not what maximal testing measures.

### Amplitude — 🚩 far smaller than intuition suggests

Takashima (2017), VICON motion capture, tidal breathing, **sitting**, mean marker excursion in **mm**:

| Site | Cranio-caudal | Medio-lateral | Antero-posterior |
|---|---|---|---|
| Anterior pulmonary rib cage | 1.94 | −0.34 | **1.91** |
| Anterior abdominal rib cage | 2.58 | 0.26 | **2.81** |
| Left abdominal rib cage | 2.19 | 0.96 | 2.11 |
| **Anterior abdomen** | 0.93 | 0.32 | **4.79** |
| Left abdomen | 0.58 | 0.55 | 1.59 |

🎯 **At rest the ribcage surface moves ~2–3 mm AP; the belly moves ~5 mm AP.** Tidal volume
0.56 ± 0.20 L sitting. **Sitting more than doubles ribcage AP motion vs supine** (1.91 vs 0.69 mm).

Compartment split during tidal breathing: **rib cage 47.9%, abdomen 52.1%** (Tamiya 2021, n=48).
Under load the ribcage share rises to 74–78%.

Full deep-breath chest circumference change: **~2–5 cm** (sources disagree; Ile-Ife n=428 gives
upper thoracic 2.6 ± 1.4 cm men / 2.2 ± 1.2 cm women, other clinical sources say 3–6 cm).

**Design consequence: idle breathing must be a ~2–5 mm displacement, not a visible heave.**
Over-animating breathing is a classic tell. Scale up with arousal toward the deep-breath range.

### Timing

Measured at rest (n=47 supine): **Ti/Ttot = 0.365**, Te = 2.5 s, Vt = 417 mL →
**I:E ≈ 1:1.74**, not the clinically-quoted 1:2. Expiration lengthens disproportionately as rate falls.

### Prior art

Zordan et al., *Breathe Easy* (SCA 2004 / *Graphical Models* 2006) — physically-simulated torso,
diaphragm and intercostals driven by sinusoids, active contraction **60–80% of rest contraction
length**, cites **13–17 brpm** as average. Breath-space sweep spans 0.5 s/breath (panting) to
4.5 s/breath = **13–120 brpm**. Paradoxical breathing (abdomen deactivated) halves tidal volume
~800 → ~400 mL. **Laughter modelled as 5 Hz expiratory pulses.**

---

## 7. Postural sway

### Frequency content — Quijoux et al. (2021), *Physiological Reports* 9:e15067

**Protocol, force-plate column:** N = 76, **60 s** per trial, three recordings averaged,
instruction *"stand as still as possible"*, arms at sides, eyes fixating a target, feet at 20°
with heels 10 cm apart. Wii-board column: N = 133, 25 s.

| Measure | WBB ML | WBB AP | Plate ML | Plate AP |
|---|---|---|---|---|
| **Frequency mode (Hz)** | 0.32 | **0.25** | 0.33 | 0.27 |
| **f50 median power (Hz)** | 0.42 | 0.37 | 0.43 | 0.42 |
| Mean frequency (Hz) | 0.52 | 0.56 | 0.39 | 0.42 |
| Centroidal frequency (Hz) | 0.65 | 0.69 | 0.61 | 0.66 |
| **f95 (Hz)** | 1.16 | **1.33** | 1.09 | 1.23 |
| RMS distance (cm) | 0.40 | 0.66 | 0.30 | 0.49 |
| Mean velocity (cm/s) | 0.83 | 1.60 | 0.50 | 0.87 |
| Mean velocity resultant (cm/s) | 1.97 | — | 1.10 | — |

🎯 **Direct answer for the noise generator: dominant mode 0.25–0.33 Hz, median power ~0.37–0.43 Hz,
95% of power below 1.1–1.3 Hz. Above 2 Hz there is essentially nothing (<2% of energy).**

**AP consistently has 1.5–2× the amplitude, velocity and high-frequency content of ML.** RMS sway
≈ **3–5 mm ML, 5–7 mm AP**; resultant mean velocity **11–20 mm/s** eyes open.

⚠️ Note the ~2× discrepancy between the 25 s Wii-board and 60 s force-plate protocols — recording
duration and hardware matter. Prefer the force-plate column.

⚠️ **Frame-of-reference trap, in the same spirit: both Quijoux cohorts are ELDERLY.** Force-plate
set mean age **71.3 ± 6.5** (N = 76); Wii-board set mean age **78.7 ± 6.7** (N = 133). Read that
together with the last line of this subsection — *sway increases systematically from around age
60* — and the two connect: these numbers **already sit on the far side of that increase**. This
section has been read as young-adult reference values and it is not. The 3–5 mm ML / 5–7 mm AP
figures are an elderly-cohort measurement, not a healthy-young-adult baseline.

🚩 **No young-adult COP RMS in millimetres was found** to substitute. Nothing here is an estimate
of one, and none should be invented — see "Could not obtain" for why Prieto's normative tables,
which would have answered this, are unreachable.

**Design consequence: do not tune a young-adult figure's sway amplitude *up* toward these
numbers.** Treat them as a soft ceiling. *Inference, not cited:* the **frequency** content is
probably far less age-sensitive than the amplitude — the two cohorts are seven years apart in mean
age and agree on the dominant mode to within 0.02 Hz while disagreeing ~2× on RMS distance. So the
0.25–0.33 Hz band is the part of this table to lean on hardest.

Eyes closed (Abrahámová & Hlavačka): SD_AP ≈ **7.3 mm men, 6.0 mm women**; AP velocity 17.6 vs
14.2 mm/s. Vision removal has a large main effect (F = 392.86). Sway increases systematically
**from around age 60**.

### Weight shifts — Duarte & Zatsiorsky (1999), 30 min unconstrained standing

| Pattern | AP interval | AP amplitude | ML interval | ML amplitude |
|---|---|---|---|---|
| **Fidgeting** (fast, returns) | 59 ± 15 s | — | 49 ± 16 s | — |
| **Shifting** (fast, to new region) | 316 ± 292 s | 17 ± 15 mm | 199 ± 148 s | 22 ± 38 mm |
| **Drifting** (slow, continuous) | 319 ± 173 s | — | 529 ± 333 s | — |

Derived rates: **fidget ≈ 1.0/min AP, 1.2/min ML; shift ≈ 0.19/min AP, 0.30/min ML; drift ≈ 0.19
and 0.11/min.**

**The paper's own definitions, verbatim — these are load-bearing and were misread once already:**
- **fidgeting** — *"a fast and large displacement and returning of COP to approximately the same position"*
- **shifting** — *"a fast displacement of the average position of COP from one region to another"*

🎯 **A shift is a change in the SUSTAINED MEAN centre-of-pressure position**, not a transient
excursion. That is exactly what licenses treating a shift as a change in **centre-of-mass**
position, and it is what separates a shift from a fidget — a fidget returns to where it started,
so it moves no mean at all.

⚠️ **The ML shift amplitude is right-skewed, not gaussian: its standard deviation (38 mm) exceeds
its mean (22 mm).** A positive quantity whose SD is nearly twice its mean is not describing a
symmetric spread, it is describing a skew — most shifts small, a few large. Drawing
`abs( gaussian( 22, 38 ) )` returns a mean of **35 mm, 60% too large**, because a third of the
gaussian's mass sits below zero and folding it piles up on the wrong side. The implementation
therefore draws from a **lognormal matched on both reported moments** (`Sway.js drawAmplitude`).
*Inference from the same reasoning, not from the paper:* AP (17 ± 15 mm) is skewed too, though
only mildly, since its SD merely equals its mean.

🚩 **Limits of this entry.** Duarte & Zatsiorsky's full text is paywalled; both quoted definitions
are taken from the **PubMed abstract**. In particular the pattern-detection window over which
"average position" is computed could not be checked, so the boundary between a long fidget and a
short shift is not pinned down here.

### Long unconstrained standing — Bates, McGregor & Alexander (2021)

"Prolonged standing behaviour in people with joint hypermobility syndrome", *BMC Musculoskelet
Disord* 22:1005 (PMC8638551). **Normal-flexibility control group, N = 22**, **15 minutes** standing
on two Kistler plates, **explicitly told they could change position as they wished**, watching a
documentary. Outcome measures are defined as the **standard deviation of COP**, with ±1.5 s around
each detected fidget excised.

| Measure (NF controls) | Median (IQR) |
|---|---|
| **AP sway** (SD of COP) | **16.32 mm** (10.34–28.75) |
| **ML sway** (SD of COP) | **16.87 mm** (9.58–66.5) |
| Sway area (95% ellipse) | 48.31 cm² |
| Fidgets > 50% bodyweight | 0.26 /min |
| Fidgets 25–50% BW | 0.7 /min |
| Fidgets 10–25% BW | 2.39 /min |

🎯 **The anisotropy INVERTS.** Over a long unconstrained window ML (16.87) ≥ AP (16.32) — a ratio
of **~1.03** — where quiet stance is emphatically **AP 1.5–2× ML**. That is Duarte's larger and
more frequent *lateral* weight-shift process asserting itself once the window is long enough to
contain it.

**Design consequence: the AP > ML anisotropy is a claim about the balance band alone, and must
never be gated on a composite trace.** A composite ratio that wanders below 1.0 over a long window
is the model being right, not wrong. Gate the anisotropy on the balance component in isolation.

⚠️ **The near-parity is a median, and the ML spread is enormous** — IQR 9.58–66.5 mm against AP's
10.34–28.75, so the ML upper quartile is more than twice the AP one. Read off the IQRs this is not
a tight result: some subjects barely moved laterally at all and some ranged over centimetres.
Treat ~1.0 as *"the anisotropy is gone"*, not as a target ratio to hit.

✅ **Independent corroboration of Duarte's fidget rate:** 2.39 small fidgets/min here against
Duarte's ~1.2/min ML — the same order, with a looser 10%-bodyweight threshold catching more events,
from a different lab two decades later. Together with Cassell's 1.4–1.6/min below, three unrelated
methods land on roughly one postural event per minute.

### Posture shifts at discourse boundaries — Cassell et al. (2001)

70.5 minutes coded, two independent raters, **only shifts both raters flagged were analysed**.

🎯 **The two numbers to steal, which are what Rea actually used:**
- **A posture shift accompanies 26% of discourse boundaries that coincide with a speaker change.**
- **Only 8% of turn boundaries that are *not* discourse boundaries.**

Background rates: intra-segment idle shifting **0.024–0.026 shifts/s ≈ 1.4–1.6/min speaking**,
**0.009/s ≈ 0.54/min listening**. Speaker shifts are ~5× more likely at a turn boundary than
mid-turn. Shifts are more energetic at discourse boundaries in monologue (0.778 vs 0.619).

✅ **Independent convergence worth noting:** Cassell's conversational 1.4–1.6 shifts/min and
Duarte's force-plate ~1/min fidget rate agree closely despite entirely different methods. That
gives real confidence in ~1–1.5 posture events/min as the idle baseline.

**Design consequence: posture shifts must be driven by discourse structure, not a timer.** The
shift lands *at* the topic boundary. That single coupling is a large part of why an avatar reads
as understanding rather than animating.

### Perlin noise for idle motion — Perlin & Goldberg, *Improv* (SIGGRAPH '96)

Coherent noise signals **N0, N1, N2 each on [0.0, 1.0]**, each one octave above the last.
N0 drives the upper arm, N1 the lower arm:

🎯 **~1 Hz upper arm (shoulder), ~2 Hz forearm (elbow), ~4 Hz wrist.**

Each DOF gets a constant angular interval plus the noise interpolant — e.g. `R_UP_ARM` interval
25°–55° driven by N0, so N0 = 0.5 → 40° pitch.

Perlin is explicit that these were chosen because they **looked** natural, and that "frequency
ratios that varied significantly from these did not look natural." He rationalises the 2:1 ratio
by the forearm having about half the mass of the whole arm. Canonical uses he names: balance
micro-motion, eye-blink randomness, gaze wandering — on the argument that **viewers perceive the
statistics of the motion, not the mechanism.**

---

## Could not obtain

- **de Meijer (1989) per-emotion regression weights** — paywalled everywhere. Only the seven
  bipolar dimensions and qualitative associations are in the open record.
- **Prieto et al. (1996) results tables** — the canonical COP normative source; every mirror 403'd.
  Quijoux 2021 uses Prieto's definitions and supplies equivalent numbers.
- **GRETA per-emotion expressivity baseline values** — described as "handcrafted rules," numbers
  never printed.
- **EMOTE emotion→Effort numeric table** — does not exist in the paper; the emotion linkage was
  left to PARSYS/OCC/personality mappings.
