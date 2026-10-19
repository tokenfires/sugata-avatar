# Skin map failure ownership — worth

**A for a narrowly scoped inert candidate and proof preparation only.** No code edit, test/import, reference retrieval or runtime action is admitted.

F1 is a concrete source ownership gap. `createSkinMaterial` retains curvature at949–951, awaits region at957–959, then cavity at969–971. If region rejects, the earlier curvature has no cleanup path; if cavity rejects, both earlier maps have no cleanup path. Nodes and material are constructed only afterward976–999, with the completed material returned at1066. `loadDataMap` rejects at1284 without returning those earlier handles.

The actual core caller does not close that gap. `Avatar.js3048–3057` leaves local `skin=null` until the awaited call fulfills. Its catch3082–3090 disposes `skin` only if assigned, then the figure. Figure309–324 traverses the already loaded scene’s geometry/materials; the independently loaded map locals were never attached to it. Avatar’s outer create catch993–1004 and disposeShading3835–3854 can retire their published owners, not these inaccessible acquisition locals. The core call search finds this Avatar caller and the factory declaration only.

This proves absent logical disposal attempts, not permanent heap retention, actual GPU uploads/leak, visible skin damage or measured memory savings. The borrowed figure albedo is separately supplied atAvatar3053 and only assigned to the new material after acquisition atSkinMaterial1001; a failure-only fix must not release that borrowed resource or redesign successful shading.

Alternative A: prepare a small acquisition transaction with focused tests driving the actual candidate `createSkinMaterial`/`loadDataMap` path. Second/third-load failure should attempt every earlier owned map’s disposal, preserve the initiating failure and cleanup diagnostics, protect borrowed albedo and retain unchanged successful settings/ownership. This directly improves a current load-failure protocol, with modest source/test risk and no physical-release proof. Alternative B: defer to a broader material/asset ownership refactor. It avoids another reliability slice but leaves this precise failed-acquisition responsibility unowned. The first is worth preparing at this bounded scope.

All11 manifest rows match. Figure exists at the stated path; the missing nomination is the incorrect `artist-preview-lifetime-owner` closure path. The actual `preview-lifetime-owner/README.md` is separately pinned without modifying INPUTS. Its fake-resource proof is not current skin-client qualification and need not be replayed or adopted.

A fresh complete candidate/import/dependency/test/resource/output/collection source gate and root verification remain mandatory before one CPU proof. No shader, texture/default, image, native, appearance, performance or broad-roadmap promotion. Pending edits: false.
