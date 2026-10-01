# Linked entry into colour editors

## Proved problem

The day review's “Try clothing colours” and “Edit hair colours” links target `#mix-colours` and `#hair-colours`. A fresh native baseline confirms both details panels remain closed at desktop 1440×1000 and mobile 390×844, with hidden editing fields. The mobile hair screenshot shows the closed Hair colour summary followed by unrelated framing/scene controls. No product change preceded this observation.

Baseline command: `node tools/critic/showcase-section-entry.mjs captures/showcase-section-entry-baseline-2026-09-30-v1 > tmp/showcase-section-entry-sep30/baseline-v1.log 2>&1`.

PID 17072 / exec session 83475 completed 23:55:27.455–23:55:41.358 UTC, exit 0. Four fresh owners use the existing declared frame-99 preparation at zero motion time and all dispose without reported leaks. Native browser closes; main review server PID 2323 remains available. Four original screenshots, source receipts, actual loaded GLB hashes and report are retained.

## Alternatives and selected change

- **A, selected:** recognize only the two colour-editor fragments, open the intended panel and focus its summary after controls are ready and on later fragment navigation. Keep the current configuration and other panels/drafts intact. This completes the review link's promised entry, with a small navigation-only product change.
- **B:** keep navigation unchanged and tell readers to open the collapsed section after arrival. This needs less product code but retains the extra discovery step demonstrated by the baseline.

Use the idle attached worktree on `codex/showcase-editor-entry-2026-09-30`, based on `4a1c823`. No rendering, hair, garment, shader, settings-schema or asset change. A summary is the focus target so Tab proceeds naturally into its editor; opening a section does not choose or apply a colour. Unknown or malformed fragments do nothing. Ordinary URLs remain collapsed. The feature must not reopen a section simply because a colour Apply reloads an unrelated page.

## Qualification

Observe the actual review link queries: body framing for Mix colours, portrait for Hair colour. The baseline instrument originally proposed portrait for both; critic alternative A selects actual queries, while B would label that narrower section-only observation. A was applied before launch.

Fresh candidate desktop/mobile entry must show the target open, keyboard focus at its summary and editing controls on screen without horizontal overflow. Compare complete settings to baseline, not pixels. Exercise an ordinary no-fragment URL, unknown and malformed fragments, in-page navigation between both editors, keyboard progression, and an unsaved draft surviving a fragment change. Confirm no new Avatar owner, clock advance or settings mutation for fragment-only transitions. Preserve snapshots of the actual controls, raw state and disposal receipts.

Root serializes captures. Independent critic reviews source and original screenshots with concrete examples and two alternatives per actionable finding. Existing exact-image failure and all appearance/fit limits remain. If the bounded change regresses navigation or ownership, retain it unintegrated rather than retuning captures.
