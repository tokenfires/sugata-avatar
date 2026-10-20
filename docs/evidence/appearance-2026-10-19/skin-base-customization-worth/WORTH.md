# Independent skin-base customization worth review

Sealed 2026-10-20T03:16:28.136455+00:00 before ROOT-FIRST.json or any root worth opinion. Immutable worthDecision canonical SHA256: `bc71022dbfa4b5ea7e9ecc9d986cc31e7f30eda1472e5343acda40b8095633b6`. A means complete proposal preparation only.

## Immutable worthDecision

```json
{
  "sealedAtUTC": "2026-10-20T03:16:28.136455+00:00",
  "decision": "A",
  "nextCompleteContractWorthPreparing": true,
  "admissionScope": "Complete isolated source/settings/workload/artist proposal preparation only. No implementation, material/API edit, test, render or current appearance qualification.",
  "consumer": "A person can deliberately choose and restore an independent skin base-colour choice alongside hair and clothing, and compare the complete clothed character under declared appearance conditions. It is not a perceived-identity or demographic control.",
  "reason": "The exact inspected construction/settings route has an actionable source-integration gap for this consumer: its material factory builds albedo/tint colour explicitly and exposes a complete tuning-uniform list without a separate skin-base input; the inspected Avatar construction call forwards maps only; the complete settings reader explicitly normalizes hair and wardrobe colours but shows no explicit skin-base field. That is sufficient to prepare a complete proposal for this specific route, while neither full Avatar API nor helper implementations nor debug skin page were inspected. Global feature/API absence is not established and is not this A. The proposal must establish a complete supported path before implementation can be considered.",
  "findings": [
    {
      "finding": "Independent base-colour intent has no explicit integration point in the inspected material-construction path.",
      "sourceWitnesses": [
        {
          "path": "packages/core/src/material/SkinMaterial.js",
          "lines": "983-985,1019-1051,1088-1112",
          "observation": "Factory merges defaults/options.settings; creates named scatter/transmission/lip/cavity/thin-tissue nodes; attaches albedoMap and applies the region map when present; complete skinUniforms enumeration exposes these controls but no independent general skin-base term."
        },
        {
          "path": "packages/core/src/material/SkinMaterial.js",
          "lines": "1131-1171, especially1167-1169",
          "observation": "Complete applyRegionMap uses region-driven local tint and thinTint and assigns colorNode from texture(albedoMap).rgb multiplied by those terms. The code expression, rather than the comment global claim, is the source witness."
        },
        {
          "path": "packages/core/src/Avatar.js",
          "lines": "3052-3057",
          "observation": "The contained skin-factory call passes albedoMap/curvatureMapUrl/cavityMapUrl/regionMapUrl, with no settings or explicit independent base-colour argument at this call."
        }
      ],
      "explanation": "Simply promising a general material.color picker is not an owned solution for the shown region/albedo colourNode path. Preparing the intended colour semantics and end-to-end admission/persistence/default/visual responsibilities has concrete value before anyone edits material or UI. This does not prove absence of a setter or another route outside the windows.",
      "alternatives": [
        {
          "choice": "Prepare a complete independently authored base-colour/source/settings/artist contract for this shown route.",
          "tradeoff": "Can make a useful customization choice concrete while forcing texture-detail, colour-space, neutral/default, cavity/subsurface and complete-character appearance duties to be owned; adds preparation work and no capability yet."
        },
        {
          "choice": "Leave the current texture-driven skin and existing controls untouched; select another complete-character responsibility.",
          "tradeoff": "Avoids an unproven control and any interaction with skin shading, but provides no independently authored base-colour choice through the shown route."
        }
      ]
    },
    {
      "finding": "Existing local material tints and scattering parameters cannot be presented as an already-qualified general skin-base control.",
      "sourceWitnesses": [
        {
          "path": "packages/core/src/material/SkinMaterial.js",
          "lines": "380-388,435-446,448-476",
          "observation": "The relevant defaults subset distinguishes cavityAlbedo/cavityChroma, thin-tissue depth/tint and lipTint; thinTissueDepthMillimetres is0 and lipTint is identity. Associated comments record their intended local/scattering roles and historical limitations; comments are not current pixels."
        },
        {
          "path": "packages/core/src/material/SkinMaterial.js",
          "lines": "1033-1039,1096-1101,1152-1169",
          "observation": "Factory nodes retain separate lip/cavity/thin terms; complete region wiring drives thinTint from the green-channel thickness and lip tint from thresholded region.b before albedo multiplication."
        }
      ],
      "explanation": "A base-colour customization contract must own the relation to existing texture/local modulation and cavity/scatter parameters instead of silently repurposing a local term or reviving the historical mask/thickness approach. No present skin appearance defect, physical correctness or bit-identical visual result was observed.",
      "alternatives": [
        {
          "choice": "Require the future proposal to explicitly author a separate base-colour meaning with neutral restoration and bounded material/appearance invariants.",
          "tradeoff": "Preserves the meaning of local controls and makes review possible, but may prove too complex or visually unsuccessful and then must stop."
        },
        {
          "choice": "Retain current material semantics and prioritize authored complete-character/skin assets before any customization extension.",
          "tradeoff": "Keeps shading assumptions intact and focuses quality work, while deferring the proposed independent user choice."
        }
      ]
    },
    {
      "finding": "The supported settings round-trip for a new choice is not owned by the inspected reader and needs explicit contract responsibility.",
      "sourceWitnesses": [
        {
          "path": "packages/testbed/src/showcase-settings.mjs",
          "lines": "20-49",
          "observation": "Complete selectionFromConfiguration explicitly resolves hairColour/hairTint, wardrobe selection/colours, frame/scene/light, then derives expected options via optionsForShowcase and compares normalized configuration."
        },
        {
          "path": "packages/testbed/src/showcase-settings.mjs",
          "lines": "7-17,52-74",
          "observation": "sameOptions rejects unexpected fields relative to expected; read settings caps bytes and parses JSON; URL restoration iterates canonical selection and special-cases hairTint. Imported helpers are outside this review."
        }
      ],
      "explanation": "The inspected file shows no explicit skin-base normalization/persistence duty. Because imported expected/canonical helpers were not read, this is not proof that every skin field is rejected or that saved/exported settings globally omit it. It is a concrete responsibility a complete future contract must settle before promising a supported feature.",
      "alternatives": [
        {
          "choice": "Make parsing/validation/canonical saved/export/URL/default compatibility and artist comparison one complete next proposal.",
          "tradeoff": "Can preserve user choices consistently; requires broader future source authority under a new exact contract before any edit."
        },
        {
          "choice": "Defer the control and preserve current complete-look settings unchanged.",
          "tradeoff": "Avoids persistence ambiguity and unsupported field promises, while leaving the proposed customization consumer unanswered."
        }
      ]
    }
  ],
  "coverageLimits": [
    "SKIN_DEFAULTS294-490 is only a relevant property/comment subset; no claim about its full object.",
    "SkinMaterial960-1220 contains complete createSkinMaterial983-1112 and applyRegionMap1131-1171, but not complete SkinNodeMaterial/source module; adjacent helpers at boundaries may be partial.",
    "Avatar2990-3105 contains the complete shown skin call and local try/catch, not all swapFigure or public Avatar API.",
    "showcase-settings1-74 is the complete file; imported helpers and UI/SDK setters remain uninspected. skin.js was not opened; no additional locator was run.",
    "Full-file bytes were hashed for pins only; semantic source reads were confined to the four exact ranges.",
    "Historical/material comments do not establish current pixels, physical measurements, global repository absence or runtime success."
  ],
  "priorityAndClosures": "A does not inherently conflict with complete-character priority: its consumer is a whole clothed character comparison plus usable consistent settings, not an isolated slider milestone. The future complete proposal must own colour intent, texture/local-colour preservation, colour-space/subsurface/cavity/default/persistence and unchanged accepted assets, plus separately admitted whole-image/resource duties. This nomination cannot reopen material-owner/lifetime, observer/capture/transport/source rescue, geometry or Ari constructor holds. If any such repair is required to qualify it, stop instead of treating A as permission. Full Phase1/AAA/representation/wardrobe/expression/coupled-fit/motion/performance then VTuber/Mii goals remain open.",
  "nextAction": "Root whole-read this stable worth pair and independently verify the four exact window/fullfile/document pins and reasoning. If root independently agrees A, prepare one complete bounded source/settings/workload/artist contract only; no implementation or graphics follows from this decision.",
  "rootWorthOpinionReadBeforeSeal": false
}
```

## Exact coverage and verification

All four exact source ranges were freshly verified against both manifest text and range/fullfile byte hashes, then wholly emitted with line numbers in separate bounded outputs: SkinMaterial294-490, SkinMaterial960-1220, Avatar2990-3105 and complete showcase-settings1-74. No range or owner was expanded. The first combined PLAN/manifest emission was truncated; PLAN was reread wholly and all four ranges were separately wholly re-emitted. Manifest metadata was fully exposed separately; no truncated display is treated as complete source reading.

Whole current checklist was reread at8886bytes /8081b2052d17f95064c298213f4df54e5c3b3211c4ecbc2c0e8c0a28973995ab. Roadmap whole prior reads are reused only after fresh32741byte/b63372b0c777000675838af499ddccc4b14ffdac2b6c5d4d35cdc5e66b2c2264 pin equality. No links followed. Full prior roadmap readbacks were331c03 andd2ffc7. The updated checklist still lists23scopedchecked and10broadopen; this review changes neither.

No current pixel/physical claim or globalAPI/feature-absence claim follows. No source/asset edit, product import/eval/execution, fixture/test, image/decode/native/GPU/browser/capture/network or source/observer/lifetime rescue occurred. Small Python utilities only read/hash/write permitted metadata; no project module was imported or run. Only WORTH.md and CRITIC-RECEIPT.json are written. All accepted/default/original/frozen/ignored assets, prior closures/AriHOLD, unrelated worktree and full roadmap stay preserved. Existing recovery/server state is not changed or freshly claimed verified. Deadline03:29:23.002837UTC without extension; humancheck-in/pausewins.

## Chronology

Independent seal completed03:16:28.136455UTC, chunkf2df2b; whole initial pair readbacks2a8d22/cdf7a5 followed. ROOT-FIRST.json was first wholly read03:16:51.412798UTC, chunkf8cb5c, after both. Root opinion pin:5,048bytes /53c1df8f23ec4c0c73b51b03a2ac8e96d06daa92b9bd7c9942b9a0393c875e9c. No other root worth opinion was read.

Both independently A for complete scoped contract preparation only, with the same colourNode/construction/settings witnesses and coverage/closure limits. Root records no current actionable defects; my findings describe future ownership duties and scoped integration gaps, not proved runtime or appearance defects. Immutable worthDecision and canonical bc71022dbfa4b5ea7e9ecc9d986cc31e7f30eda1472e5343acda40b8095633b6 hash remain unchanged.

Finalized 2026-10-20T03:17:29.839937+00:00, pending_edits=false. Final whole stable readback and fresh four-window/fullfile/document/seal verification follow. Root must wholly read this pair and independently verify; no preparation implementation or other target work is performed here.
