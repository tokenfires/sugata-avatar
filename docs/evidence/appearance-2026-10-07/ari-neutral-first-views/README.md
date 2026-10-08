# First neutral source images — October 7

Six unchanged first renders provide a neutral comparison control before Ari’s shape recipe. Root viewed all six at original resolution: front/profile/rear directions are confirmed, full-body crowns/hands/feet remain visible, and head views preserve the crown/face/ears while cropping the shoulders. No obvious detached auxiliary face mesh is visible. Pale, soft skin under this diagnostic lighting limits fine material and eye judgments; this is not final appearance approval.

[Six-view gallery](review.html) · [Exact render result](RENDER-RESULT.json) · [Independent image review](IMAGE-REVIEW.md) · [Root result verification](ROOT-RESULT.json).

The usable improvement is the first actual source image baseline. The bounded question is whether silhouette, material visibility or gross face seating exposes a defect that must precede Ari’s ten-target candidate. The contract admits one six-image CPU job, maximum 180 seconds, and closes by 04:00 UTC. It forbids retakes, renderer tuning, geometry/Ari weights/pose changes, source resaving and export. [Plan](PLAN.json), [worth](WORTH.md), [source preflight](SOURCE-PREFLIGHT.md) and [root preflight](ROOT-PREFLIGHT.json) precede execution. The review caught a frozen-helper bytecode write risk; the final script disables Python bytecode before importing that helper. No native job ran before the completed preflight. Closed lips conceal the teeth and tongue; their visual seating and behavior remain unqualified despite the saved numerical associations.

## Exact source and command

Readonly source: `../ari-neutral-native-source/work/neutral-source-logged.blend`, 11,983,694 bytes, SHA256 `6ed771b71a99ac8a5cf9c717fef5364ac0a427763e601fecffa984bafd4f53eb`. Warm source receipt SHA256 `3cc2c2be835b034b81c4c855d4433244a132ce9b0546469d7d4246b055fea7c9`. Render script SHA256 `5f282f96de8c5fc315999443291cd5938f3619caef7c206ab67c559ea066060d`; scene helper SHA256 `82b10908efaf576d6cd6763fc7a6d557604eb45c9f7e4652359c4da69b5c9f21`. Full output hashes, cameras, bounds and dimensions are recorded in the result; root independently rehashes all six PNGs and the source/script/helper, and confirms the raw log result equals the saved JSON.

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --offline-mode \
  /Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-07/ari-neutral-native-source/work/neutral-source-logged.blend \
  --python-exit-code 1 \
  --python /Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-07/ari-neutral-first-views/render_views.py
```

The Python wrapper uses Popen with the exact argument array, records its native PID, and allows 180 seconds before TERM then KILL after five more seconds. [Job](JOB.json): wrapper73697/native73698, 2026-10-08T03:40:15.445318–03:40:27.068216 UTC, exit0, no timeout. Unified session1559 is collected complete. The six PNGs total 2,289,204 bytes. [Raw log](render.log) is preserved unchanged. Cycles CPU, sixteen threads/samples, seed0, AgX exposure0/gamma1, transparent RGBA, fixed world/three area lights; OPENIMAGEDENOISE with actual GPU flag false. Body views are768×1024; head views768×768. All body projected bounds pass the 4% margin gate. Head crops are deliberate and assessed from the images, not the full-body projection numbers.

The exact loaded source signature matches the warm receipt before rendering; recorded source owner state matches afterward. The physical source SHA remains unchanged after the job. This checks the recorded scene owner state, not universal native I/O or all hidden renderer state. The source was never saved by this process.

## Limits and next decision

This is a newly constructed neutral MPFB lineage, not Ari’s completed shape. No ten-target recipe, hair, wardrobe, cornea derivative, helper bake, GLB export, expression-motion, garment fit or broad roadmap acceptance follows. No render retake is admitted. Accepted assets, original references, frozen evidence and unrelated worktrees remain preserved. The full AAA roadmap and nineteen scoped/ten broad-open checklist stay intact.

Independent and root image review agree: retain the six originals for scoped neutral comparison. Three explicit limits each retain two alternatives and their tradeoffs: soft material/eye detail, empty space above the head, and hidden mouth parts. Root fully reads the stable 5,062-byte handoff, verifies all eleven image/execution bindings, rehashes the physical source and independently reads the exact builder bake/export source cited by the critic. [Root image/source readback](ROOT-IMAGE-READBACK.json). The first attempted handoff read preceded its save and returned missing; the complete successful readback follows before the 04:00 UTC closeout.

Next proposed work is a separately bounded complete native-to-derived-export association audit before applying Ari’s coupled body recipe. Critic and root find that worthwhile: helper baking mutates topology and export explicitly resets morphs and chooses skin/axis flags, so a neutral derivative can separate conversion errors from target effects. No visible blocking defect requires a retake. This packet does not authorize or launch that next native job. Vite825 and the ACTIVE ten-minute recovery remain retained; the sole render job is complete. The gallery and all six images are served byte-identically by the existing loopback service; opening its Codex browser panel is queued while the chat is hidden. No browser capture or appearance claim based on HTTP availability follows. No purchase/reset, model/subscription/dependency/global preference change, push, publication or other project action occurred. Human check-in or pause takes precedence.
