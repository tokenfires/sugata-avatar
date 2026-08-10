# 姿 Sugata

A body for an AI — a real-time WebGPU avatar with affect-driven full-body embodiment, built so any
agent can embed an embodied version of itself.

## Start here

```bash
npm install
npm run dev
```

Then open **<http://localhost:5173/>**. That is the testbed hub: every page in the project, what
each one is for, and which gate proves it. Start at **alive** — the acceptance page, and the one
every objective gate and every blind-judge plate is captured from.

The hub is generated from `packages/testbed/pages.js`, and `packages/testbed/pages.selftest.mjs`
holds it to the filesystem and to the build config in both directions, so a page added without a
card fails a gate rather than quietly going missing.

## The commands

| | |
|---|---|
| `npm run dev` | The hub and every page, at <http://localhost:5173/>. |
| `npm run selftests` | **Every gate in the repo**, one line each, with the tree state at both ends. Exit code is the number that failed. Slow — the browser-driven gates are most of it. |
| `npm run critic` | The seven objective image gates (G1–G7) over a captured plate. |
| `npm run verify:glb` | Structural verification of every shipped GLB. |
| `npm run build:pages` | Builds **all** pages. Plain `npm run build` compiles only `index.html`, vite's default single entry, so a broken import anywhere else passes it. |
| `npm run figure` | Rebuilds the figure and wardrobe artefacts through Blender. Slow, and it moves sha256-bearing gate inputs. |
| `npm run spikes` | The spike pages under `tools/spikes/`, which live outside the dev root and need their own config. |

A single gate is a plain node file with no test runner:

```bash
node packages/core/src/wardrobe/shadow.selftest.mjs
```

## Where things are

| | |
|---|---|
| `packages/core/` | The library. `figure/ material/ render/ motion/ affect/ voice/ wardrobe/` |
| `packages/testbed/` | The pages. `index.html` is the hub; `alive.html` is the acceptance page. |
| `tools/critic/` | The measurement harness — objective gates, blind A/B pairing, capture. |
| `tools/figure-pipeline/` | Blender-side asset build and GLB verification. |
| `assets/` | Built artefacts. Gitignored; rebuild with `npm run figure`. |
| `reference/` | Comparison imagery. **Gitignored, never committed, never shipped.** |

## The documents, and the order to read them

1. **`docs/BRIEF.md`** — the original request, verbatim, plus the requirements derived from it.
   When any other document disagrees with this one, this one wins.
2. **`docs/PUNCHLIST.md`** — every item, its gate, and what was measured. The working document.
3. **`docs/LEARNINGS.md`** — what went wrong and what it cost. Part 1 is verification lessons,
   Part 3 is commands known to work.
4. **`docs/OPEN-REQUESTS.md`** — the cross-file request ledger, adjudicated by its own gate.
5. **`docs/research/`** — sourced reference numbers. Every constant in a gate traces to one of these.

## How this repository is built

Two rules carry most of the weight, and both are there because they were learned expensively:

**A gate that has never failed is not known to work.** Every gate here has a *red proof* — the
defect reintroduced at source, the gate observed going red, the tree restored byte-identically.
A gate with no red proof is decorative.

**Structural correctness is not visual correctness.** Every selftest proves numbers; none of them
can tell you whether a face is legible. That is why there is a browsercheck page per subsystem and
why the critic loop is blind: the harshest reviews in this project came from judges who did not
know which image was ours.
