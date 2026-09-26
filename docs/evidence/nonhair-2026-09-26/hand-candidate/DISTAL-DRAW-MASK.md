# Accepted-mask hypothesis: refuted for the retained distal region

Every one of the **3,909 left / 3,907 right distal faces is drawn** in A/B/C at steps 0, 455, 637 and 720. All **3,166 legacy hand/finger faces per side** remain drawn. Full topology and draw-index arrays are identical across all twelve snapshots for the body and every captured worn mesh. The accepted body draw-index SHA-256 is `baac2d814038af4b263c6bf1c854a3e0d2cf5575d81ab3ace99e32fa23008c8e`.

In particular, the A455 proximal sleeve-limiting query faces **16009 left** and **2803 right** are drawn at every checked step, including initialization. Their limiting garment targets are casual faces **1202** and **1250**, also drawn. The receipt records the exact face IDs, posed coordinates, mask membership, and actual limiting pair for each pose and side.

Consequently the full-distal and drawn-distal query sets are exactly equal, in the same order. Their certificate inputs and results are identical. The operator was not needlessly rerun, and no alternate visible-face pass is claimed. Full-distal clothing clearance remains unproven, including the A455 20-left / 32-right failing faces.

**Drawn does not mean visible on screen.** A submitted skin triangle may be occluded by its sleeve under the normal depth test. This audit refutes intentional body-mask removal as the explanation; it does not establish visible clipping, nor turn an unproven outward corridor into contact. No source face, mask, garment, margin or pose was changed.

Reproduction: `node docs/evidence/nonhair-2026-09-26/hand-candidate/audit-distal-draw-mask.mjs`, using a fresh output directory in an isolated copy of the same capture inputs. The helper checks frozen source topology and hashes, all required face memberships and cross-pose mask equality, then writes a fresh receipt. Existing output is never overwritten.

Receipt: `distal-draw-mask-v1.json`, SHA-256 **`9bc392840b30cfbc6070dcc7df2286fc0b346e539bb2d7182ee7bb3e48dee8f0`**. It binds the retained primary report, exact twelve snapshot archives, original source-defined regions, completed v3 geometry diagnostic and executed helper source. No GPU work occurred.
