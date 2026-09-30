# Optional Neutral Studio light

## Result and limits

An optional **Neutral** light is ready for the Studio viewer and SDK (`lighting: 'neutral'`). It makes the current charcoal and brown shoes easier to distinguish and removes the strong blue edge on the neck and shoulders. Root and the independent critic inspected the original rendered body and portrait comparisons. See the [independent critique](CRITIQUE.md).

Neutral removes each rig source's hue at the same linear luminance. Light placement, scalar strength and shadow settings are preserved in the matched fresh views. Hair and clothing recipes, geometry, masks and the recorded physical state remain unchanged. It is saved in URLs, downloaded settings and named looks. Kitchen retains its own room lighting.

This is **colour inspection, not colour calibration**. The materials, floor, background and tone mapping retain their own responses. The olive floor becomes more apparent; its recorded albedo is `#968c34`. Neutral does not repair the existing haircut, neckline or clothing fit.

**The exact-image property remains failed.** Of four authored Studio comparisons, both body images match exactly; the casual portrait differs at 380 pixels (maximum 7 channel codes), and the elegant portrait at 225 pixels (maximum 3). No tolerance, cause or renderer repair is inferred. All ten original look/framing combinations match their previous actual CPU light values exactly.

**High-quality live transitions have narrower evidence.** Fresh high-quality Neutral creation and actual ambient-colour uniforms are verified. First frames after a live change retain thin blue colour residue or conspicuous stippling. Some pre-draw shadow projection values also differ after a rebuild. This packet does not establish instantaneous clean transitions, post-draw shadow-projection equality, temporal convergence or all-motion appearance.

## Actual examples

- [Casual, authored Studio](../../../../captures/neutral-studio-2026-09-30-v2/feature-casual-body-studio.png) · [same recipe, Neutral](../../../../captures/neutral-studio-2026-09-30-v2/feature-casual-body-neutral.png)
- [Blouse and skirt, authored Studio](../../../../captures/neutral-studio-2026-09-30-v2/feature-elegant-body-studio.png) · [same recipe, Neutral](../../../../captures/neutral-studio-2026-09-30-v2/feature-elegant-body-neutral.png)
- [Casual Neutral portrait](../../../../captures/neutral-studio-2026-09-30-v2/feature-casual-portrait-neutral.png) · [fresh high-quality Neutral portrait](../../../../captures/neutral-studio-2026-09-30-v2/high-neutral-initial.png)
- [Desktop controls](../../../../captures/neutral-studio-ui-2026-09-30-v2/desktop-neutral-body.png) · [mobile controls](../../../../captures/neutral-studio-ui-2026-09-30-v2/mobile-neutral-controls.png) · [saved look](../../../../captures/neutral-studio-ui-2026-09-30-v2/desktop-neutral-saved.png)

## Implementation and qualification

The candidate was isolated at `/Users/robault/.codex/worktrees/sugata-hair-colours/sugata-avatar`, branch `codex/neutral-studio-2026-09-30`, from main `611e4f4`.

- `LightingRig.colourFor` derives achromatic linear RGB from the installed working-space luminance coefficients, without an eight-bit hex roundtrip. Area lights, shadow halves, optional portrait glint and both hemisphere colours share this path. Each rebuild starts from the authored source colour.
- Avatar owns the choice at creation and live switching; framing retains it. GTAO's separate high-quality ambient uniforms receive both new colours on live updates and report their actual linear components. Neutral reports `calibrated: false`.
- Viewer enums, button and saved description admit Neutral. Existing URL, settings and named-look machinery preserves the choice, with the Kitchen boundary unchanged.
- Seven focused CPU scripts pass: LightingRig 146 checks; Avatar 138 checks; new Neutral checks cover 45 actual source-colour observations plus real Avatar-to-GTAO switching; viewer scenes; preset groups; settings and named collection checks expanded to 96 combinations. Logs are in [checks](checks/).
- The native material packet has 12 fresh balanced images and seven high-quality observations. Four balanced groups have exact recorded geometry, physical state and material equality across their arms. The 28 actual neutral light-colour observations preserve linear source luminance exactly; other recorded fresh light fields match. Fourteen Avatar owners retire with no reported leak.
- The actual UI packet has 16 states, five images and five clean owner retirements. It exercises live Studio/Neutral/Warm, portrait, reload, real JSON download and file-input reopen, named looks, Kitchen and 390-pixel controls without horizontal overflow. Hair and wardrobe settings remain intact.

Source and asset inventories, raw states, original images and failed observers are preserved. The [local raw archive](archive.json) contains 901 files / 90,899,193 bytes; manifest SHA-256 `04a13c62b612f694cc9be9af960574b35f88f1ed397088c4ae81be22817c15bd`. Raw files are read-only. These ignored captures are not an off-machine backup. These inventories bound the recorded state; they are not a claim that every renderer variable was observed.

## Exact jobs and outputs

All times below are UTC on September 30. Temporary browsers and port-5301 servers were closed. Main review Vite PID 2323 on port 5173 was retained.

| Job | Command | PID / exec session | Interval | Result / report SHA-256 |
| --- | --- | --- | --- | --- |
| CPU defaults | `node tools/critic/neutral-studio-defaults.mjs` | 49067 / completed directly | 19:00:53 | 10 exact states; `129119b69547f513e9fabe2a84c3f075e1334fe2b1e734c448ae244a7da8f486` |
| Native V1 | `node tools/critic/neutral-studio-capture.mjs` | 58081 / 72613 | 19:06:49.631–19:06:55.227 | Failed observer asset assertion; `a97c85f58445f37f92957813f0c4db42e19bfa55b5b94cff901eb60e434278d2` |
| Native V2 | same command, separately pinned observer | 60765 / 80290 | 19:08:33.791–19:09:28.592 | Captured; `5f1c1bae5f713ff7718c2331a4027d1eb28459d6b307e0a50447fddc0672eb1c` |
| UI V1 | `node tools/critic/neutral-studio-ui.mjs` | 65774 / 57992 | 19:11:50.711–19:12:09.725 | Failed observer collapsed-panel assertion; `0ff1035a9602102af33014433dc005a3dfd54ebed86d773aa6e2b2ab564912c4` |
| UI V2 | same command, separately pinned observer | 69971 / 63109 | 19:14:32.445–19:14:57.187 | Captured; `6b37721654d150db7212119770d461323e6582b6bce2f107d8c6e40df1dac671` |

The raw roots are `captures/neutral-studio-defaults-2026-09-30-v1`, `captures/neutral-studio-2026-09-30-v1`, `captures/neutral-studio-2026-09-30-v2`, and the corresponding `neutral-studio-ui-2026-09-30-v1/v2`. Use each root's preserved observer to recover its exact executed version. Current tool files refuse to overwrite their completed output roots.

## Decision log

1. **Persist an optional Neutral look.** The actual blue shoe and neck highlights supported a colour-inspection option. A transient inspection toggle was the alternative: smaller state surface, but saved views would not reproduce it. Existing artistic looks stay available.
2. **Conserve source luminance in linear RGB.** Avoid tint removal through rounded sRGB hex. Actual direct, hemisphere and high-quality composite values support the implementation; material colours are not retuned.
3. **Correct observer assumptions using actual source evidence.** The test initially assumed a body glint; the native observer expected the standalone figure; the UI expected an explicit default URL and visible text in a collapsed panel. Their corrections and alternatives are documented in the [capture plan](CAPTURE-PLAN.md), [V2 recovery](CAPTURE-V2.md) and [UI plan](UI-PLAN.md). Failed outputs remain preserved. Product code did not change to satisfy those incorrect assertions.
4. **Update matrices before state observation.** The critic identified potentially stale world transforms immediately after rebuilding lights. Synchronous scene/camera updates keep draw count fixed; a post-draw snapshot was the alternative.
5. **Keep high transition limits.** The critic supplied actual residue/stipple examples and differing shadow-projection values. Retain the bounded creation/uniform evidence here. A later fixed post-switch series is the alternative if convergence or shadow lifecycle qualification becomes necessary; no epoch search or material tweak follows.
6. **Preserve failed screenshot repeatability.** Numerically identical recorded state does not establish pixel equality. The two portrait failures remain visible beside the two exact body observations.

## Recovery and next work

No native or solver job from this packet remains live. The independent critique and local integration receipt are the promotion authority for the bounded feature. Preserve the accepted assets and all frozen evidence. Return to a separately chosen appearance or roadmap improvement; do not repeat the closed hair, neckline or exact-image trials to manufacture a pass.
