# Saved static capture data and collection review

```json
{
  "immutableOpinion": {
    "schema": "sugata.artist-turnaround-board.saved-data-review.v1",
    "reviewer": "fresh_source_critic",
    "sealedUTC": "2026-10-20T14:46:26.828176+00:00",
    "pid": 29419,
    "decision": "A_SAVED_DATA_AND_SCOPED_COLLECTION_CONSISTENT",
    "scope": "Only the frozen first three static screenshots and their saved admission, DOM, source, ownership and collection evidence. No screenshot pixels were viewed or decoded.",
    "visualAcceptance": "NOT_DECIDED_BY_THIS_REVIEW",
    "canonicalAdoption": "NOT_ADMITTED; canonical board remains the byte-identical baseline.",
    "worth": "The existing three records are worth handing to the independent image critic/root once. The second narrow article observation supplies distinct targeted-card coverage. These data do not warrant another capture.",
    "findings": [
      {
        "id": "D1",
        "witness": "CAPTURE-ADMISSION.json sequence; owned-tab.json; desktop/narrow-olive/narrow-mara observation JSON; ACTUAL-CALLS.md steps1-5; SERVED-SOURCE.json",
        "finding": "Recorded acquisition and three fixed observations follow the admitted candidate URLs and viewport order. The candidate and the two original resources match the bound bytes; source association is supported by the saved HTTP200/local-body comparisons.",
        "explanation": "Admission predates entry, ID19 is recorded before later page work, and the ordered screenshot timestamps lie between entry and cleanup. No source substitution or additional screenshot is represented in this frozen set. This is documentary collection evidence, not an independent complete live-call trace.",
        "alternatives": [
          {
            "choice": "Retain these exact first records for the separate visual judgment.",
            "tradeoff": "Useful existing evidence; subjective visual acceptance remains outstanding."
          },
          {
            "choice": "Defer adoption if documentary provenance is considered insufficient.",
            "tradeoff": "Preserves uncertainty and the existing board; this nomination supplies no recapture or replacement."
          }
        ]
      },
      {
        "id": "D2",
        "witness": "All three *-DOM.json records, original PNG headers and JPEG SOF headers; desktop/olive/Mara target rectangles listed below",
        "finding": "Both images are recorded complete with natural1536x1024 in every DOM record; target images/cards stay within the recorded horizontal bounds and each targeted card is fully vertically present in its intended viewport. JPEG headers are1280x900,390x844,390x844 and total233874B.",
        "explanation": "The saved scalar bounds support layout coverage and readiness, while the narrow olive view leaves part of the Mara neighbor offscreen and the narrow Mara view puts that second card wholly in view. Header/DOM evidence cannot establish legibility, pleasing presentation, actual pixels, or unchanged artwork appearance.",
        "alternatives": [
          {
            "choice": "Use the desktop plus both fixed narrow records for their declared distinct coverage.",
            "tradeoff": "Covers both narrow article positions without treating offscreen neighboring content as a defect."
          },
          {
            "choice": "Leave the baseline board in place pending visual judgment of these same bytes.",
            "tradeoff": "Delays delivery without inventing pixel acceptance or requesting more captures."
          }
        ]
      },
      {
        "id": "D3",
        "witness": "CLEANUP.json, BASELINE-TABS.json, initial-viewport.json, ACTUAL-CALLS.md step5, saved source and baseline hashes",
        "finding": "Saved cleanup records successful viewport.reset and tab.close returns, owned tab19 absent in the single recorded final inventory, and original tab objects1/2/3 unchanged. Recorded entry-through-cleanup152.453s is within360s. The canonical board is still baseline.",
        "explanation": "This satisfies the admitted scoped tab-collection evidence. No post-reset DOM dimensions are saved, so the review claims the reset return rather than independently measured restored dimensions; it makes no generic process/GPU retirement or hard-memory guarantee.",
        "alternatives": [
          {
            "choice": "Accept this scoped saved collection and carry its limits into closure.",
            "tradeoff": "Matches the declared ownership contract without asserting unobserved system retirement."
          },
          {
            "choice": "Mark unmeasured system-wide resource state unknown while withholding adoption if that exceeds the consumer need.",
            "tradeoff": "Conservative but does not negate the documented owned-tab close or authorize a new probe."
          }
        ]
      }
    ],
    "nextAction": "Root may complete the separate actual-image review of these exact three JPEGs and then decide delivery under the existing source contract. No new capture, browser action, candidate change or canonical adoption is admitted here.",
    "rootCurrentOpinionsRead": false,
    "pending_edits": false
  },
  "canonicalOpinionSHA256": "095b6b509aff6c69feeb5828add6f2f3e2fa0c214cd3e319388059416fb56d31"
}
```

The canonical opinion hash is SHA256 of UTF-8 `json.dumps(immutableOpinion, sort_keys=True, separators=(",", ":"), ensure_ascii=False)`, without a terminal newline. This is a saved-data/source-association judgment, not an actual-image acceptance or a performance measurement.

## Actual evidence and limits

The whole OBSERVATION-HANDOFF and all required admission, owner, baseline-tab, initial-viewport, cleanup, served-source, three observation, three DOM and three AX records were read. AX text is explicitly a diff, so it is not presented as a complete current accessibility tree. ACTUAL-CALLS.md was read whole only after the parent offered it as additional non-opinion execution provenance. The candidate and contract semantics were reused from my earlier complete source/workload read after their fresh byte pins matched. SOURCE-IMAGE-REVIEW.md and SOURCE-REVIEW.md were hashed opaquely, not opened; WORKLOAD-REVIEW.md is my preceding complete review. Both original PNGs and all three JPEGs were streamed for bytes/hash and headers only; no image pixels, thumbnail, crop, renderer, CUA, browser, network or new target operation was used.

The required admission contains earlier original-image/source approvals. Encountering those provenance fields is disclosed: this is not a claim of blindness to those prior approvals. No current root data/image opinion or current screenshot critic opinion was read, and this decision relies on the saved actual records rather than those approval labels.

Admission was sealed at14:34:54.866592UTC. ADMISSION.used and owned-tab record entry at14:35:21.475Z, returned tab19 at14:35:21.830Z. Exact candidate root URL is `http://127.0.0.1:5173/@fs/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/artist-turnaround-board/candidate.html`. The three observations use only `#turnarounds`, `#turnaround-olive`, `#turnaround-mara` in that order. Their end times are14:36:12.763Z,14:37:00.120Z,14:37:22.527Z. Cleanup began14:37:53.751Z and ended14:37:53.928Z:152.453seconds from entry, below360seconds and the14:45 entry ceiling. Each documentary operation reports a wall below30seconds; those tool walls are not end-to-end target timing or a guarantee of all internal activity.

| Frozen JPEG | Header dimensions | Bytes | Target card/image evidence |
| --- | --- | ---: | --- |
| desktop.jpg |1280x900|132718| Olive card x52,y99.78125,w576,h710.7578125 and Mara card x652 with the same y/w/h are wholly in the viewport. Images x53/x653,y186.875,w574,h382.6640625. |
| narrow-olive.jpg |390x844|49528| Olive card x20,y0.109375,w350,h669.59375; image x21,y82.953125,w348,h232. Both wholly in view. Mara neighbor extends below the viewport. |
| narrow-mara.jpg |390x844|51628| Mara card x20,y0.203125,w350,h669.59375; image x21,y83.046875,w348,h232. Both wholly in view. Olive neighbor is above the viewport. |

All DOM document widths equal the respective viewport width, all card/image horizontal edges lie within that width, and all six recorded image instances have `complete=true` and natural1536x1024 with the exact two bound original paths. The original PNG headers also report1536x1024. Desktop section y=-0.109375 is a slight clipped outer section boundary; the two relevant cards/images themselves meet the stated coverage. This review does not inflate that fact into an assertion that every section-edge pixel is visible. JPEG SOF markers identify8bit/3component frames; the three JPEG bytes total233874, below8MiB each and20MiB aggregate. Header checks are not a pixel/content validation.

Saved DOM captions/links point to the respective unchanged original PNG, ARTIST-HANDOFF and existing board item. Narrow DOM records do not include a title field and the AX files are partial diffs; I do not claim a complete narrow accessibility snapshot. The unchanged candidate source supplies its headings, while actual readability and presentation remain for the image critic.

CLEANUP records independent successful reset/close returns and no errors. Its single final remainingTabs array exactly equals BASELINE-TABS, including IDs1/2/3, browser3, provider IDs, titles and URLs; owned19 is absent. `initial-viewport.json` is1280x720, but no post-reset DOM measurement exists. Therefore only the successful reset return is established. The saved ACTUAL-CALLS step5 explicitly records one final inventory; no universal call-history or operating-system/process/GPU release conclusion follows. The saved memory admission reports a fresh1GiB floor check and an unmeasured100-500MiB static-tab estimate; this audit does not turn either into a hard usage bound.

SERVED-SOURCE is a saved metadata association observed14:39:50.049839UTC after cleanup: five HTTP200 resources and exact local-byte equality for candidate, two originals and two handoff texts. I made no fresh HTTP request. This supplements the matching candidate source URL and DOM original paths; it is not a continuous server-state proof. Canonical docs/ARTIST-WARDROBE.html is freshly19252B/SHA780b63375e9d4f6d4c5582b93660b939042eed9f1a337586fb9d5507c1ab8804, equal to baseline, so no adoption is credited.

## Read and verification chronology

-219939: whole manifest, exit0,14:40:47UTC/PID28761,1849 output tokens, not truncated.
-8102eb: whole admission/used/owner/baseline/viewport/cleanup/served-source records, exit0,2373 tokens, not truncated.
-f2759a: whole three observation/DOM/AX sets, exit0,4276 tokens, not truncated.
-0e3c69: bounded ordinary standard-library metadata audit at14:42:45.156508UTC/PID28980, exit0. All25+2 bindings matched;1MiB streams; JPEG SOF/PNG header only; saved DOM scalar bounds/order/URLs/resources/cleanup arithmetic.14/15second soft/hard CPU budget; actualCPU0.003324s/wall0.003363958s/maxRSS22446080B. No target, source import/evaluation, geometry or image decode.
-ab88e3: whole optional ACTUAL-CALLS3010B/eeb4975d3df6bd3b716b6374298e522b237055d4e85d981f8f788ee444bd5c69, exit0,14:44:30.075512UTC/PID29205,813 tokens, not truncated. The record reports operation walls0.5670s/0.2105s/0.1761s/0.1509s/0.1860s; these are attributed saved provenance, not newly observed performance.
-Prior complete source/contract reads were4b33da/3ecea0; my preceding workload seal456a80 and stable readback761977. Their semantic reuse is limited to the freshly matching candidate/contract/current own workload review, not other reviewers' judgments.
-This seal process reverified all27 bindings plus manifest, optional operation provenance and the canonical baseline using ordinary streamed SHA256 and exact lengths. It writes only this review with exclusive creation/fsync. Exact seal/write and final readback chunk IDs and the final review bytes/SHA are reported to root after the tool returns; no ID is invented in advance. No command returned a live session.

No inconsistency requiring repair was found. The alternatives and tradeoffs for all three decision-bearing findings are frozen in the first JSON. This review reserves no new capture or experiment and changes no source, image, accepted/default/original/frozen asset, canonical board, checklist, phase order, roadmap, previous closure or material-volume HOLD.

## Final literal bindings

```json
{
  "manifest": {
    "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/OBSERVATION-HANDOFF.json",
    "bytes": 7148,
    "sha256": "4e538ac8f5fff74d65d4023d55b3e3752822f22dd3147df5e2c0b947919649fb"
  },
  "boundArtifacts": [
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/candidate.html",
      "bytes": 22349,
      "sha256": "9fd140d9c6aaffffbb0bbcffe3d9d3f4572e16301de634ef92650d09a9cd3170"
    },
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/baseline.html",
      "bytes": 19252,
      "sha256": "780b63375e9d4f6d4c5582b93660b939042eed9f1a337586fb9d5507c1ab8804"
    },
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/CAPTURE-CONTRACT.md",
      "bytes": 7578,
      "sha256": "17637eb4eae9d358021ea329fb8b7c6f5b9bd6875a76de9d5d76674e131d32ef"
    },
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/CAPTURE-ADMISSION.json",
      "bytes": 3531,
      "sha256": "0ae5527799a92c875142bbad809ac0ef33f5b6d5a528cf87dd13117c4493cd6e"
    },
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/ADMISSION.used",
      "bytes": 24,
      "sha256": "789339a2ca0730f8f4c4a6c13a91f30ed1e3bc1fa79e21161ad051fc14bc434f"
    },
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/owned-tab.json",
      "bytes": 265,
      "sha256": "54593560f396bb24397f6ed39e2c8f0b062c32151847f9cd5011febfa15de88e"
    },
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/BASELINE-TABS.json",
      "bytes": 946,
      "sha256": "103112ba416ab4e11c3a07232ba5976f9999b0edeebba16976d2c227318ae295"
    },
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/initial-viewport.json",
      "bytes": 27,
      "sha256": "ce02f346c708f54945c6e625f0fd731e15196e8f77cda87fae8e39f30f538366"
    },
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/CLEANUP.json",
      "bytes": 1314,
      "sha256": "92318a090a9d66f5b10591dff5da3b52c3f12b32facef31ffcff77390d1cb874"
    },
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/SERVED-SOURCE.json",
      "bytes": 1713,
      "sha256": "b4902bab095fab568dac775d8dc014196eafa17107c42b8accb7bae7277cffad"
    },
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/desktop.jpg",
      "bytes": 132718,
      "sha256": "1c62c4d97bae6de2013fc7d6e1aa60a4d1c579b94a90573c075aa84c66fd8f08"
    },
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/desktop-AX.txt",
      "bytes": 1886,
      "sha256": "d4cd1c13ddf87f26a2b16d336048fa2cc3640b26891a04da58800c4e73daf965"
    },
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/desktop-DOM.json",
      "bytes": 3222,
      "sha256": "1fb4bddd3531f7276d5b68f0e43881764f56de083d7fbc66328bdf89ca72c077"
    },
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/desktop-observation.json",
      "bytes": 256,
      "sha256": "22a4b6e878444673e346d7b1fd7272e4c1ae9df16f7f620581ec6d775eba299c"
    },
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/narrow-olive.jpg",
      "bytes": 49528,
      "sha256": "1524e32ab4c30afbbcf27bff23f3f16863d115c0cc47eb97cb010097f909c214"
    },
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/narrow-olive-AX.txt",
      "bytes": 1856,
      "sha256": "07d759c11bb00aa254090556521264738a9b4e727a8ec5f54b9b84ae9919753f"
    },
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/narrow-olive-DOM.json",
      "bytes": 3016,
      "sha256": "8f9b2c95b91cc5c32f607eeeed0a84f2ef0cb935979e4f2bce0a5aad530643d3"
    },
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/narrow-olive-observation.json",
      "bytes": 259,
      "sha256": "4f5661725b9deec1ca050ac9c232e32a17b13a88cae1edc4575e9e52aef006b1"
    },
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/narrow-mara.jpg",
      "bytes": 51628,
      "sha256": "6a8194f41a582bf95aaf708672a19e3996fddcae47df53d2a5ef3ec7036f3922"
    },
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/narrow-mara-AX.txt",
      "bytes": 809,
      "sha256": "7de96c3c3d2faa1d12f1613151ab4c62bf22d6f4b159d6fe0781e7ee640d11aa"
    },
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/narrow-mara-DOM.json",
      "bytes": 3017,
      "sha256": "d8ed516fab9a57a2755f7fe0e0bcbb3646eff2173ee3f32e7434e3ca2fc00a16"
    },
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/narrow-mara-observation.json",
      "bytes": 259,
      "sha256": "236f5db3fd2a7698a718fafd4177680c094e6b1f11d6074fc5062661b213dfc5"
    },
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/SOURCE-IMAGE-REVIEW.md",
      "bytes": 6876,
      "sha256": "89e385e532271419c46dd7905398097cb1678b46416bec7a8131c55827eb9069"
    },
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/SOURCE-REVIEW.md",
      "bytes": 14530,
      "sha256": "cbf0c2f1495c4607e3593fe9dcfe68018043a7201d8a589ffe866241dee33320"
    },
    {
      "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/WORKLOAD-REVIEW.md",
      "bytes": 18257,
      "sha256": "da998f87ecba36aef8a964c1bb0e4290545f5400211ca6784b7cfa122f4dba20"
    }
  ],
  "boundOriginalImages": [
    {
      "path": "docs/evidence/appearance-2026-10-19/masculine-clothed-turnaround/first.png",
      "bytes": 1969289,
      "sha256": "a7019a47790a0a27155e2425c02f7d3d1c7b3157d24a541caa5509e75d72c82d"
    },
    {
      "path": "docs/evidence/appearance-2026-10-19/mara-body-turnaround/first.png",
      "bytes": 1991838,
      "sha256": "32d3a7b9037408fee44ff588c42d5225771a6885d6d911b1352fe76258fc6daa"
    }
  ],
  "boundListCanonicalSHA256": "9fed2f5dd96d2e1bbf257ea3eed0c6b1183a69b355913ed040e97a80608c41dc",
  "optionalOperationProvenance": {
    "path": "docs/evidence/appearance-2026-10-20/artist-turnaround-board/ACTUAL-CALLS.md",
    "bytes": 3010,
    "sha256": "eeb4975d3df6bd3b716b6374298e522b237055d4e85d981f8f788ee444bd5c69"
  },
  "canonicalBoardCurrent": {
    "path": "docs/ARTIST-WARDROBE.html",
    "bytes": 19252,
    "sha256": "780b63375e9d4f6d4c5582b93660b939042eed9f1a337586fb9d5507c1ab8804"
  },
  "freshVerificationUTC": "2026-10-20T14:46:26.828335+00:00",
  "all27ManifestBindingsMatch": true,
  "canonicalBoardEqualsBaseline": true,
  "screenshotsOpaque": true,
  "pixelDecodeOrViewCount": 0,
  "newBrowserOrNetworkCalls": 0,
  "currentRootOrOtherScreenshotDataOpinionAccess": false,
  "pending_edits": false
}
```

pending_edits=false. This complete file is final at seal; the stable whole readback and its external SHA are collection evidence, not an additional opinion.
