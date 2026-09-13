# 姿 Sugata

**A body for an AI.** Real-time WebGPU avatar that feels what it reads and moves its whole body to show it.

![The avatar with its instrumentation open](docs/images/instrumented.png)

## One call

```js
import { Avatar } from './packages/core/src/Avatar.js';

const avatar = await Avatar.create( { canvas: document.getElementById( 'stage' ) } );
```

That is the whole setup. The figure comes back breathing at 15 to 16 breaths a minute, blinking on a
Poisson schedule, running saccades with real main-sequence velocities, and shifting its weight the
way a standing person does.

```js
avatar.feel( 'angry', 0.9 );          // the face and the whole body
await avatar.say( 'I am glad you came back.' );
await avatar.setIdentity( { gender: 0.2 } );
```

## Emotion reaches the body, not just the face

Most avatars emote from the eyebrows up. This one uses all three PAD axes, so anger and fear separate
where a face cannot separate them.

| `feel()` | trunk | arms | dominance |
|---|---:|---:|---:|
| `'angry'` | **+17.99°** forward | −38.32° drawn in | +0.91 |
| `{ pleasure: −0.9, arousal: 0.8, dominance: −0.8 }` | **−3.53°** back | 0° | −0.78 |
| `'happy'` | 0° | **+25.43°** open | +1.00 |

Anger and fear carry identical pleasure and identical arousal. Only dominance tells them apart, and
the trunk goes opposite ways. Those numbers are measured off the rig, not authored.

## Talk to it

Point it at any OpenAI-compatible endpoint and it appraises what you say, feels it, and answers.

```bash
npm run dev
# open http://localhost:5173/src/converse.html with LM Studio running
```

Affect arrives in two tiers. A lexicon and prosody pass runs in under a millisecond so the face moves
before the sentence finishes. An LLM pass follows about a second later and blends in, so the
correction settles instead of popping.

## It is one figure, at any point between

<img src="docs/images/body.png" width="46%" alt="Full body, dressed"> <img src="docs/images/portrait.png" width="46%" alt="Portrait detail">

`gender` is continuous from 0 to 1. Skin is pre-integrated subsurface scattering with a baked
curvature map, dual-lobe specular and a tiled micro-normal. Eyes are two nested shells with real
corneal refraction. The wardrobe layers garments, hides covered geometry, and retains the selected
foundation when an outer outfit is removed. Current fit and coverage limits are recorded with each study.

## Requirements

- **A browser with WebGPU.** WebGL2 runs at a reduced tier and the API reports which one it chose.
- **Node `^20.19 || >=22.12`** and `git-lfs`. The figure bakes are 232 MB of LFS objects. Clone
  without LFS and you get pointer files, not a body.
- **An OpenAI-compatible LLM endpoint** for the conversation page only. Everything else runs offline.

```bash
git lfs install
git clone https://github.com/tokenfires/sugata-avatar.git
cd sugata-avatar && npm install && npm run dev
```

## Status

The runtime combines skin, eyes, lighting, blink, gaze, breath, sway, affect-driven posture,
gestures, IK and supplied viseme timelines. Opt-in wardrobe and `avatar.dress()` now work through
the public `Avatar` runtime on the midpoint g050 body. Detailed identity sculpting remains in
dedicated modules/testbed pages. Real TTS and microphone input remain open. `say()` without a supplied timeline does not animate
speech on its own.

The **portrait study** puts expressions, lighting, camera control and two haircuts on one page.
Run `npm run dev`, then open `/src/portrait.html`. The chin-length `bob02` falls alongside the
cheeks with its shake preserved. The original long `bob01` now has a corrected g050 shape and
nape contact path, verified across the recorded motion poses. Other bob01 bakes retain their
existing shapes. Broad card patches, mottled highlights and some contacts outside the corrected
regions remain; finer strand rendering is still an experiment.

A [viewer-attention study](docs/EYE-CONTACT-STUDY-2026-09-13.md) now compares the current
gesture with gentle and full eye-focus candidates in synchronized recordings. They remain
experimental; the live Portrait keeps its separately qualified attention action.

The **wardrobe lookbook** at `/src/showcase.html` offers two actual g050 starting looks, live
outfit changes, coordinated Ecru/Charcoal/Original palettes, orbit and framing controls, and PNG
image or JSON settings downloads. [Colour choices](docs/WARDROBE-COLOURWAYS-2026-09-13.md) survive saved settings. It uses
existing stand-in clothes, with remaining fit and styling work. See the [lookbook guide](docs/SHOWCASE-2026-09-09.md)
and [wardrobe API](docs/WARDROBE-AVATAR-2026-09-09.md).

For current work, start with the [Sunday checkpoint](docs/RESUMED-2026-09-13.md) and
[product direction](docs/PRODUCT-ROADMAP.md).
The [September 8 restart](docs/RESTART-2026-09-08.md) records the active checkout and partial
recovery from the old iCloud location. Older hair checkpoints are historical experiments,
not the current recommendation.

`npm run selftests` runs the full gate suite; declared failures live in
[`docs/RED-GATES.md`](docs/RED-GATES.md). The restart checked the affected runtime and browser paths,
not the entire suite, and does not claim a clean full-suite result.

## Documentation

| | |
|---|---|
| [`docs/OVERNIGHT-2026-09-08.md`](docs/OVERNIGHT-2026-09-08.md) | Current progress, accepted changes, experiments and remaining work |
| [`docs/RESTART-2026-09-08.md`](docs/RESTART-2026-09-08.md) | Active checkout, recovery boundary and initial portrait verification |
| [`docs/SHOWCASE-2026-09-09.md`](docs/SHOWCASE-2026-09-09.md) | Actual clothing combinations, view controls and image/settings export |
| [`docs/WORK-SESSION-2026-09-08.md`](docs/WORK-SESSION-2026-09-08.md) | Hair correction, renderer repairs, verified results and remaining visual work |
| [`docs/API.md`](docs/API.md) | The full `Avatar` surface, options, and limits |
| [`docs/BRIEF.md`](docs/BRIEF.md) | The original request, verbatim |
| [`docs/PUNCHLIST.md`](docs/PUNCHLIST.md) | Every item and its acceptance gate |
| [`docs/LEARNINGS.md`](docs/LEARNINGS.md) | What went wrong and what it cost |
| [`docs/research/`](docs/research/) | The sourced constants everything is built on |

## Licence

Code is [MIT](LICENSE). The base mesh and its ARKit blendshapes come from MPFB2 and are CC0. No
reference imagery is included in this repository.

Built with [Claude Code](https://claude.com/claude-code).
