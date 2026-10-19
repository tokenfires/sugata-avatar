# Catalogue suggestion Try — worth decision

**B — do not prepare a new Try action in this nomination.** The explicit suggestion-card button is absent, but an adequate explicit outfit route already exists. The demonstrated marginal benefit does not justify another UI/transaction/proof/capture slice now.

The retained desktop REQUEST.jpg shows “Blouse + skirt” at roughly x868–1225, y418–505, directly beneath the two Outfit choices at y149–191. The card says to use those buttons. The whole mobile image likewise shows both choices at y210–252 and repeats the instruction above Dismiss at y550–591. These historical images establish an understandable existing path, not current runtime behavior.

Current source corroborates that design. showcase-outfit-suggestions.mjs:25–27 supplies the same guidance and Dismiss; :39–50 only requests and explains a choice. showcase.js:71–83 builds the suggestion catalogue from SHOWCASE_OUTFITS and returns label/reason. showcase-presets.mjs:13–16 contains exactly the same two supported recipes displayed by the buttons. showcase.js:440 wires those buttons to changeOutfit; :279–294 guards dressing, disables controls while busy and reports failure. Thus “no Try in the card” is not “no explicit way to try the proposed outfit.”

A card-local Try would remove a small amount of label matching/navigation and could share the existing outfit-specific action. It also needs new selected-recipe binding, disabled/stale/failure/focus behavior and preservation evidence. openLook (:316–335) is a separate settings/navigation operation, so it should not be assumed equivalent to changing only clothes. I have not demonstrated unsafe reuse, measured user friction or inspected every draft/colour preservation path; those are limits, not invented defects.

Two alternatives: retain Request/read/Dismiss plus the adjacent named Outfit controls, avoiding additional API/UI ownership with no loss of supported outfits; or prepare a direct action that delegates to the existing guarded outfit change, reducing navigation but requiring fresh interaction/state qualification. For this two-choice panel I select the first. The reviewed evidence supplies insufficient additional decision value for the second now.

This is a value refusal, not a source/runtime/appearance failure. No implementation, test, browser observation, capture iteration or renamed retry follows. The original/current wardrobe assets, saved-look/Undo/JSON/colour/cut semantics, all closed methods, constructor HOLD, checklist and broad roadmap remain unchanged.

pending_edits=false.
