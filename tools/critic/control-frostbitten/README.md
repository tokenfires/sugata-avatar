# The frostbitten control

**What this answers:** for eleven rounds the hair phase produced a genuine, sourced, red-proven
finding every time and the picture never moved. Each round changed the groom AND the shading and
then measured the result, so no round was attributable — and underneath that, **no control had ever
been built.** A known-good hair asset had never been through this judging path, so nobody could say
whether the judges were reporting our defects or reporting the bar.

This puts a second, independent, competent hair renderer through the identical path.

## The other renderer

[`Scthe/frostbitten-hair-webgpu`](https://github.com/Scthe/frostbitten-hair-webgpu) — MIT, a
standalone WebGPU re-implementation of Frostbite's published hair system (Tafuri, *Every Strand
Counts*, SIGGRAPH 2019). 11.4k strands × 16 points, 171k segments, a compute software rasterizer
with **analytic** coverage (`alpha = 1 − |interpW.x·2 − 1|` across the projected strand width) and
strict front-to-back OIT.

It is the strongest possible control precisely because of what it does NOT have: **no cards, no
alpha texture, no mip chain, no dither, no TAA.** Every one of our three structural suspects is
absent from it by construction, so anything a judge still complains about cannot be caused by them.

**It is deliberately NOT vendored.** The code is MIT, but the Sintel hair and meshes it renders are
BlendSwap-licensed under their own separate terms, and this library's rule is that it consumes what
a user legally acquires and never bundles.

## Reproducing it

```
git clone --depth 1 https://github.com/Scthe/frostbitten-hair-webgpu.git
cd frostbitten-hair-webgpu && deno install
```

Two patches, and only two — the repo targets Deno 1.x and Deno 2 removed the `window` global:

- `src/constants.ts:27` — `window.Deno !== undefined` → `(globalThis as any).Deno !== undefined`
- `src/stats.ts:59-60` — `if (window && window.document)` → `if (typeof document !== "undefined")`,
  and `window.document.getElementById` → `document.getElementById`

Then copy `index.control.ts` in beside its own `src/index.deno.ts` and run it. One frame, ~2 s.

```
export FB_DIR=/path/to/frostbitten-hair-webgpu
cp index.control.ts "$FB_DIR/src/"
cd "$FB_DIR" && DENO_NO_PACKAGE_JSON=1 OUT=./portrait.png CZ=1.07 CY=1.47 PITCH=0 \
  deno run --allow-read=. --allow-write=. --allow-env --unstable-webgpu src/index.control.ts
```

⚠️ **Do not use the hosted demo for this.** It renders at 0.01 fps in an embedded browser (119 s a
frame) and dat.GUI's colour widgets do not take programmatic values, so neither the colour nor the
background can be controlled. The headless path is the instrument.

## What the control changes, and what it must not

Four things, listed in `index.control.ts` beside the code that does them. Lights, shadows, AO,
fibre radius, lobe weights, roughness and the strand file are the author's and are untouched.

| | change | why |
|---|---|---|
| Viewport | 1280×720 → **720×900** | our portrait plate size |
| Background | cyan gradient → flat **RGB(20,22,26)** | measured off our own plate's four corners |
| Hair colour | RGB(119,43,119)/(76,0,255) → warm dark brown | ⚠️ **the demo default is literally purple.** Left in, it hands a judge the same word five of our own judges reached for, for a completely unrelated reason, and the control proves nothing. Deliberately NOT our own `#1A0E0C` either — matching it would smuggle our colour result into the control |
| Props | collision ball + axis gizmo off | scene furniture. The gizmo draws unconditionally in FINAL mode, so it is removed by giving it zero length rather than by patching the renderer |

**The background had to be solved, not set.** Feeding `(20,22,26)` produced `(74,80,90)` on the
plate: the value is written to an HDR target and then travels a tonemap and an sRGB-format store.
`solve-bg.mjs` bisects the measured corner pixel to `(4.53125, 4.984375, 5.890625)`, which lands as
exactly `(20,22,26)`. Both arms then measure identical at the corner — which is the point, because
a backdrop that differs by even a few counts is a provenance tell a judge can use.

## Running the judging

```
FB_DIR=/path/to/frostbitten-hair-webgpu node control-blind.mjs
```

Two arms, PNG metadata stripped, in randomly-named directories, with the answer key written
**outside the judged tree entirely** — not one level above it the way `blind_ab.mjs` does. A judge
here is a subagent with a shell, and "above the images" is one `ls ..` away from being no blind at
all.

Each judge sees ONE arm, is never told the other exists, and is given the round-23 hair brief
verbatim except that it reads two PNGs instead of launching the dev server. `MOTION` is dropped —
the headless path renders a single frame — and it is dropped from **both** arms, which is what makes
it a deviation rather than a confound.

`crop.mjs` and `compose.mjs` are here rather than in `tools/critic/` because they exist to look at
these two arms side by side. `crop.mjs` is nearest-neighbour on purpose: a strand has to be looked
at as pixels, not as a resampled impression of pixels.

## The result

See `docs/CHECKPOINT.md` §2. In one line: **six of six judges said "not same-tier", including all
three shown the published reference implementation of Frostbite's hair system.**
