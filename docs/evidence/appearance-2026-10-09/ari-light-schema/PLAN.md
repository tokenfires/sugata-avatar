# Supported Blender 5.2 lighting ownership

Fresh slice, 2026-10-09 13:20–13:50 UTC. Prepare by 13:35; sole runtime probe must start by 13:40. Deadlines stop investigation, then receipt/checkpoint only.

Usable improvement: a reusable, version-bound ownership schema for the exact three frozen AREA lights, with observed fields and optional representation recorded before guards. Question: which supported scalar fields and optional node-tree representation does installed Blender 5.2.2 actually return for factory-created lights with the frozen position/power/colour/size? This changes whether a NEW first-image contract can be responsibly prepared.

Preferred A: one at-most-30s factory background process creates only the three exact lights, reads type/energy/colour/shape/size/normalize/exposure and applicable influence fields, records actual legacy getter and optional node tree, bounded graph if present, and records expected/observed before individual assertions. No use_nodes setter and no inference of tree existence. Repeat read-only state snapshot proves stability within this process. Alternative B: source-only ownership description, no runtime confidence and no first capture admission.

First unexpected type/scalar/non-empty unsupported node representation/version stops, without rescue or retry. No rendering, geometry/archive decode, source blend open, save, cold reopen, capture, material/camera/style change or fit census. Factory startup avoids installed extensions. Three AREA objects are transient, no persistent Blender preferences.

Primary-source inquiry: at most two official 5.2 API pages (Light + AreaLight); reuse already saved Light reference first. Independent critic worth and full source preflight before probe; root verifies full handoff and returned values. No capture is admitted in this slice. Preserve exact candidate/source/display, accepted assets, original references, frozen evidence, unrelated jobs/worktrees, Vite and ACTIVE automation. Broader AAA/character/expression/representation/bomber/rig/morph/motion/materialUV/export/runtime goals remain open; 2189 body/36 self crossing pairs and coverage/occupancy unknown remain unchanged.
