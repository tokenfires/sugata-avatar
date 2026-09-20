# Independent surface forest regression

The forest shares three GPU query buffers across independently bounded body domains. It preserves each domain's triangle set, boundary masks, posed history, BVH root/range and cached seed range. It allows one all-chain contact stage per substep instead of consecutive full stages for separate chain groups. The existing single-domain owner/query path remains selected for calibrations without explicit multiple domains, including g025.

Run the portable CPU/GPU gate and both versioned Avatar contracts:

```sh
node packages/core/src/motion/HairSurface.forest.selftest.mjs
node packages/core/src/motion/HairSurface.forest.selftest.mjs --gpu --report=/tmp/forest-query.json
node packages/core/src/Avatar.hair-contact.gpu.selftest.mjs --report=/tmp/legacy-avatar.json
node packages/core/src/Avatar.hair-forest.gpu.selftest.mjs --report=/tmp/forest-avatar.json
```

Coordinate actual WebGPU runs with other GPU work. All test imports and required fixtures are tracked; ignored captures and scratch implementation files are unnecessary for these commands.

The query gate passes nine groups, including five CPU groups. It checks all per-chain headers, relocated topology, all 54 differing masks on shared source triangles, transactional posed/history packing, invalid partition/source/mask rejection, and idempotent retirement without taking ownership of borrowed patches. A small GPU rejection witness deliberately omits `forChain`: it must lose exactly the second surface's four active contacts. The properly routed stage retains all eight.

The larger GPU control checks **43,200 point/segment queries and 108 historical rows** across three poses, three interpolation values, cold/warm/cross-domain seeds, and both original/original and original/nape forests. Returned ordered IDs are global forest addresses; only those addresses are normalized for per-domain comparison. Canonical source IDs, boundaries and all floating-point channels remain unchanged. The compiled query uses exactly eight storage bindings.

**Twenty fresh physical trajectories** cover two all-496-chain captured states, 16 regular or 64 reset passes, and five arrangements: original single surface, separate original/original stages, original/original forest, separate original/nape stages, and original/nape forest. The original-only arrangements match independent historical single-domain outputs. Widened forest outputs match the independent two-domain owner. Centers, velocities, rebuilt ribbons, planes, parameters and cache diagnostics must match fixed historical digests, not merely another arm running today's code. Every arrangement returns GPU resources to its starting baseline.

The new compressed supplement is **742,841 bytes**, SHA-256 `f75108c376ad10777be777b4270b2340cdf7174aa97e0e52d02b8912fc3f19b8`. It reuses the already tracked 630,216-byte cache fixture. CPU-consumed rest offsets and head transforms preserve Float64 precision; GPU-consumed arrays remain Float32. These fresh 16/64 trajectories have different velocity-finalizer semantics from the earlier cache goldens, which remain covered by their own test.

## Versioned Avatar goldens

The original `avatar-hair-contact-canonical.json` remains byte-for-byte unchanged. Its command explicitly routes the immutable legacy g050 calibration fixture `hair-body-contact-g050-legacy-v1.data.mjs`, exercising the current single-domain owner/shaders with the original calibration. Its eight groups still pass.

Expanded nape geometry changes hair centers and ribbons at both canonical poses, so treating the old golden as the new calibration's target would be incorrect. The separate `avatar-hair-forest-canonical-v2.json` comes from a complete independently routed two-domain owner captured before production forest promotion. Its provenance retains exact source, calibration, served instrumentation and report hashes. It includes velocity digests. The production forest command uses the real promoted registry/dispatcher and must match this independent golden at 0 and 0.1 seconds. No production owner or calibration module is routed in that command; only the reproducibly generated corrected groom is served at its canonical asset URL.

The new Avatar test passes eight groups: both canonical poses, all 496 native skin roots under four proper transforms, scale refusal/resume before submission, repeated same-renderer hairstyle/identity rebuilds, retired update/read guards, pending browser-digest disposal, exact groom hashes, and stable sources with zero browser errors. Fully exercised nape contact observes **35 storage buffers / 7,177,952 bytes**; bob02 and uncalibrated g000 observe **8 / 980,096**; off/disposal returns buffers, bytes and compute pipelines to zero. Root-center, rebuilt midpoint and width invariants are tested; static edge positions remain diagnostics because the ribbon frame follows its changed first-span tangent.

See [the compact evidence ledger](evidence/hair-surface-forest-2026-09-09.json). Exact reports/logs/source snapshots are preserved under ignored `captures/body-surface-forest-portable-2026-09-09/`. The prior frozen-candidate lifecycle and independent canonical control are under `captures/body-surface-forest-avatar-2026-09-09/`.

These tests make no performance, appearance, full-body, scalp, garment or all-bake clearance claim. Stored domain totals are not the anatomical union. Broader motion/opacity acceptance and frame cost are separate evidence. Exact golden hashes require a reviewed engine/arithmetic/calibration contract change; never regenerate them automatically from the implementation under test.
