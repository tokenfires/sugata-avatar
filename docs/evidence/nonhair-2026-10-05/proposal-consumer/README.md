# Showcase suggestion ownership

**Use a read-only catalogue suggestion; defer an agency consumer in Showcase.** Root independently checked the actual caller, storage and lifecycle source. This is an ownership decision, not a rendered or implemented feature.

| Responsibility | Actual witness | Chosen contract |
| --- | --- | --- |
| Clothing | `showcase.js:253–267` calls `avatar.dress`; `Avatar.js:2441–2471` owns requests and race handling. | Suggestions never dress. Existing outfit controls retain clothing authority. |
| Live owner | `Avatar.js:3061–3078,3138,3826–3830` constructs, replaces and disposes Wardrobe. | Resolve the current live wardrobe for every synchronous request; borrow it only during that request. |
| Agency | Showcase imports and constructs Avatar and SavedLooks, with no WardrobeAgency construction in its current complete source. | Do not claim an existing agency, pin or agent preference. |
| Persistence | `WardrobeAgency.js:203–209,324–325,542–557,626–628` defaults to browser storage and records preferences. | Do not construct a default-profile agency or store. SavedLooks keeps its existing authority. |
| Pin/apply | `WardrobeAgency.js:280–296,347–386,391–409` can dress or change mode. | No pin, wake, consider, confirm, mode change or fabricated user/mood context. |
| Recipes | `showcase-presets.mjs:13–18` has two explicit clothing studies and the retained foundation. CatalogueDresser validates against the live policy. | Supply those existing recipes to choose/explain, clearly identified as authored catalogue suggestions. No fit, weather or mood claim. |
| UI lifetime | Showcase has busy/save/failure gates, refresh and pagehide/pageshow handling. | Disable while unavailable; invalidate the card on a real outfit change/refresh; dispose only owned DOM/listeners. Keep bfcache state functional. |

Alternative A is a small reusable read-only view with an explicit synchronous caller callback. It delivers an application seam without inventing persistent authority; it does not record an agent preference. Alternative B is a newly owned ephemeral agency with explicit synchronization and store lifetime. That would record preferences, but adds a second authority and a larger lifecycle contract. Choose A for the next separately reviewed slice; preserve full wardrobe-agency integration and fit goals as outstanding.

The earlier isolated agency preview remains qualified within its own session. No UI, asset, browser, store, profile or executable source changed here. A new implementation requires a fresh bounded plan, critic worth/source review and root verification; nothing in this packet admits it.
