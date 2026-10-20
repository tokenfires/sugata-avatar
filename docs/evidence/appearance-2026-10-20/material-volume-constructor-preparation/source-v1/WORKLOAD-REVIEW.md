```json
{
  "sourceWorkloadDecision": {
    "verdict": "B_FULL_SOURCE_WORKLOAD",
    "constructorStatus": "HOLD_UNEXECUTED",
    "nextFixedTechnicalTrialWorthDoing": false,
    "sourceQualified": false,
    "executionAdmitted": false,
    "rationale": "The complete proposed method is present as inert source, but the supervisor does not meet its own terminal-evidence and cleanup-failure contracts. These prospective control-flow defects prevent source/workload A. They are not observed native, numerical, geometry, resource or image failures.",
    "findings": [
      {
        "id": "F1",
        "severity": "blocking",
        "title": "Expired work deadline can suppress both terminal records",
        "sourceWitness": "run_once.py:40–50,277–289; IMPLEMENTATION.md:17,21; PREPARATION-PLAN.md:24.",
        "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/run_once.py",
        "explanation": "digest() raises whenever TOTAL_DEADLINE has expired. The finally block then computes final_outputs by calling digest() for each ordinary output before it attempts either collection.json or the final owner.json. If the deadline is already expired, or expires during this hashing, the handler only prints a traceback and sets exit_code=2. Neither terminal write is attempted, so an earlier RUNNING owner record can remain after the worker was collected. This is a deliberate deadline branch, not an unavoidable hypothetical disk failure; the described allowance for cleanup after the stop threshold does not bypass digest's expired work deadline. The outer tool could still expose a nonzero exit, but it does not supply the promised durable terminal state/collection evidence.",
        "staticTrace": "TOTAL_DEADLINE exceeded → final output digest raises → except287–289 → exit2, with collection.json/final owner.json writes285–286 skipped.",
        "alternatives": [
          {
            "choice": "In a separately authorized future source contract, separate a minimal terminal status/cleanup receipt from optional final hashing, with independent guarded writes and explicit incomplete-hash status.",
            "tradeoff": "Keeps failure/ownership facts available when expensive evidence is incomplete, but does not grant complete output qualification."
          },
          {
            "choice": "Keep this packet unexecuted at HOLD unless a fully bounded independent final-collection phase, with its own truthful deadline/error records, can be supplied and freshly reviewed.",
            "tradeoff": "Avoids a trial with a self-disabled evidence path, at the cost of deferring the native volume question. No extra collection budget or source revision is admitted here."
          }
        ]
      },
      {
        "id": "F2",
        "severity": "blocking",
        "title": "Caught cleanup failure is not sticky in the final result",
        "sourceWitness": "run_once.py:214–229,237–276; IMPLEMENTATION.md:17.",
        "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/run_once.py",
        "explanation": "After the normal path sets COLLECTED_NUMERICAL_ONLY and exit_code=0, the unconditional finally cleanup still performs process inventories. An inventory/signal/wait exception in either cleanup pass is caught at261–262 and merely appended as cleanup_error. If a later inventory is empty and the direct child is reaped, the final check270 does not demote status or exit_code. Consequently collection.json can retain a successful status/exit0 alongside a cleanup_error. That contradicts the stated contract that unknown identity or cleanup failure is an explicit collection failure. No such exception has actually occurred; this is a reachable static success-retention path.",
        "staticTrace": "normal numerical result → status success/exit0 → one cleanup inventory raises → cleanup_error appended → final inventory empty/reaped → no failure assignment → successful collection retained.",
        "alternatives": [
          {
            "choice": "In a separately authorized future source contract, make any cleanup/identity error a sticky collection failure while preserving the underlying numerical result only as unqualified data.",
            "tradeoff": "Matches the conservative stated policy, but may refuse a packet whose later process snapshot looks clear."
          },
          {
            "choice": "Withhold this trial and require a newly explicit terminal policy that distinguishes completed positive collection from any remaining cleanup work before the source can be considered again.",
            "tradeoff": "Avoids silently relaxing the failure contract or signaling after completion, but leaves the constructor on HOLD. No policy/source change or retry is authorized by this review."
          }
        ]
      }
    ],
    "methodAssessment": {
      "sourceInputs": "constructor.py148–198 binds all seven normative source hashes and exactly the four NPY schemas/raw hashes, with archive owners matching the sealed metadata. Source payloads were not reread by this critic.",
      "sourcePrerequisites": "201–320 implements simplicial edge/component/link/Euler checks and exact nonzero chain volume. Their passage is unobserved and does not establish embedded/simple-solid or physical inside.",
      "columns": "323–423 explicitly retains q64/q32 stations, inclusive rational projected bounds, all original triangles, exact barycentric/degenerate-segment ambiguity, sorted proper crossings and XYZ degree/parity classification. The filter remains a candidate filter, not nearest-hit substitution.",
      "nativeMetricAndCuts": "426–525 retains reported U0/radius/range/U1, every exact reported-distance tie, index-registration diagnostics, complete region masks, exact matching cut vectors, exact boundary proof and fixed saturated cuts. No native/API behaviour is empirically qualified.",
      "clippingAndIdentity": "528–752 implements all seven affine sampled constraints, exact Fraction intersections, cut-face adjacency/orientation, minimal positive support and active-ID identity with record equality, internal-face opposite-owner cancellation, complete facet labels and canonical fan checks across the full declared tetra count.",
      "eligibilityParentsExport": "755–942 owns material/INNER/OUTER topology and opening/role/plane checks, ordered finishing parents, conservative pure-torso-reference pocket guides with exact barycentric witnesses, explicit unbuilt children, and exact-to-F64-to-F32 export with flip/collapse checks. Parent construction IDs have an explicit export map. These are source observations, not saved-data or fit results.",
      "workload": "Work/record caps and lossless gzip metric sharding are explicit; a cap refuses rather than drops records. 900/1200-second thresholds, sampled worker-group RSS/output observations and CPU/per-file limits do not establish runtime feasibility, peak allocation headroom, universal descendant retirement or all-I/O deadlines. The supervisor's worker-group RSS sum195–196 does not itself include its own process or transient ps observer; no broader aggregate/peak claim is earned.",
      "imageScope": "The expressly no-image technical scope is coherent as a source choice only. Numerical representation, finishing-parent, physical and appearance states must remain distinct; no image or physical/artist success exists."
    },
    "limits": [
      "Both programmes wholly read as inert text: constructor.py1000lines/44918B and run_once.py294lines/14814B. No import, evaluation, tests, AST or native/API entry by this critic.",
      "Current CONTRACT, IMPLEMENTATION, PREPARATION-PLAN and all sealed audit texts were wholly read; prior own CHOICES-REVIEW and byte-identical preserved implementation text are reused after fresh hashes. All 13 handoff pins plus manifest self are bound.",
      "Audit documents are attributed records. Their native version, four-member decode and old primary API observations were not replayed; nested source archives, members, binaries and primary-body targets were not opened or rehashed here.",
      "ADMISSION.json and trial-001 are absent at the exact metadata check. No source edits, payload decode, geometry/field/grid/tet construction, capture/render/image, browser/GPU or external request.",
      "No root/other critic current opinion file was read. The critic communicated these exact two concerns before root's message of independent agreement; that subsequent agreement is disclosed and is not the basis of the findings.",
      "Preserve source bytes and all nine normative files. No patch, new observer, wrapper repair, partial probe or trial follows. Any later action requires a separate explicit authorization and full gate; this review itself advises no current execution.",
      "Full roadmap, earlier closures, original/default/accepted/frozen/ignored assets and constructor HOLD remain intact."
    ],
    "pending_edits": false,
    "sealedUTC": "2026-10-20T12:28:24.132701+00:00",
    "pid": 96727
  },
  "canonicalOpinionSHA256": "a9e3a16a9e0355ff21aab6dd0b4d8b264effa94d8382cb13ce2bd2cb71d21d0c"
}
```

Full-source/workload verdict: **B / constructor HOLD**. The exact technical trial is not worth executing under this packet. Complete inert method coverage and historical input/version audits do not cure the terminal-evidence defects. Both alternatives per finding are unadmitted future policy/ownership choices; the current programmes remain unchanged and unrun.

```json
{
  "evidence": {
    "operations": [
      {
        "job": "d04ba0",
        "exit": 0,
        "pid": 95601,
        "utc": "2026-10-20T12:22:47.811285Z",
        "coverage": "Whole SOURCE-HANDOFF, current IMPLEMENTATION and all294 supervisor lines."
      },
      {
        "job": "258334",
        "exit": 0,
        "pid": 95644,
        "utc": "2026-10-20T12:23:05.238766Z",
        "coverage": "constructor.py1–260, exact source pin/1000line count."
      },
      {
        "job": "835b11",
        "exit": 0,
        "pid": 95655,
        "utc": "2026-10-20T12:23:13.650696Z",
        "coverage": "constructor.py261–540."
      },
      {
        "job": "ada3f5",
        "exit": 0,
        "pid": 95671,
        "utc": "2026-10-20T12:23:19.725931Z",
        "coverage": "constructor.py541–800."
      },
      {
        "job": "80783f",
        "exit": 0,
        "pid": 95683,
        "utc": "2026-10-20T12:23:25.557645Z",
        "coverage": "constructor.py801–1000."
      },
      {
        "job": "c469fd",
        "exit": 0,
        "pid": 95721,
        "utc": "2026-10-20T12:23:47.848890Z",
        "coverage": "Whole SOURCE-FILE-PINS, ARCHIVE-OWNERS, FOUR-MEMBER-PREFLIGHT, RUNTIME-PREFLIGHT, AST-PARSE and README; all13 handoff pins verified."
      },
      {
        "job": "d3b93f",
        "exit": 0,
        "pid": 96377,
        "utc": "2026-10-20T12:26:47.706650Z",
        "coverage": "Whole unchanged CONTRACT315lines and PREPARATION-PLAN33lines; all13 pins; exact ADMISSION/trial absence."
      }
    ],
    "errors": [],
    "chronology": "Independent source concerns were sent to root after complete programme/audit reads and before root's confirming message. No current root-opinion file was accessed. No target job has been created.",
    "pending_edits": false
  },
  "freshBindings": [
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/PREPARATION-PLAN.md",
      "bytes": 8609,
      "sha256": "3e3b35a3295e237d4d1d05d61d1cb0afcf011b718f2ed45bc0d2c2dd2145c6a8"
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/IMPLEMENTATION.md",
      "bytes": 6749,
      "sha256": "9f3b8ea4c218ff78e8bc549899860b6a598f54010eaf7413d25d9543db303502"
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/constructor.py",
      "bytes": 44918,
      "sha256": "7f96e5a632fb4cd68a08e94e9bda1e8db556e998c8a4531f19a429e77f3fca2e"
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/run_once.py",
      "bytes": 14814,
      "sha256": "4b035b6b175913bf4d3fd31a81754e76aab14e1fb22caeb1ec1e2ad2219da0e7"
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/SOURCE-FILE-PINS.json",
      "bytes": 2631,
      "sha256": "7203bda28710dbb0620fe4651ae17260c4eeca29091fbb63f959e4636a7c41b0"
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/ARCHIVE-OWNERS.json",
      "bytes": 1338,
      "sha256": "432ff88073dc210f6cd301a655098be85d1cfe6884a696f7479c98f36f2d7563"
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/FOUR-MEMBER-PREFLIGHT.json",
      "bytes": 2567,
      "sha256": "7992ae450bd80b0a2c6f062e4d9adf943d60ba40e16e15bb58dc604c4c3a6296"
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/RUNTIME-PREFLIGHT.json",
      "bytes": 1327,
      "sha256": "cd52d24d14b008dbdcb5de8410a65d4fddff26d2199bb4c46ed79ca50dbd7d3c"
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/AST-PARSE.json",
      "bytes": 616,
      "sha256": "d34d59a5b11b710013851a9db9a0e6a4e4ee55f075be3730fb669bc3e99ae6a2"
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/README.md",
      "bytes": 3519,
      "sha256": "0ef525e0f605dbd7865944967755b9ced1f0f80d5ab130c022a659bcbaf22314"
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/CHOICES-REVIEW.md",
      "bytes": 8824,
      "sha256": "6d43f4e0d2fa11133a49171e0a20c1b460fb407cd2ffd97c0a590352bd3deda0"
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/IMPLEMENTATION.choices-reviewed.md",
      "bytes": 5463,
      "sha256": "c59b4ba7eadae3ca287d0f5527c6d7eab48561ad938c5c417dd31e4505fb7e7f"
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-10/ari-volume-owner-revision/CONTRACT.json",
      "bytes": 17528,
      "sha256": "974c1cbd3ad811717aec75069f8a2c696aaacf2a8c5631599d8244914d1a7fcf"
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/SOURCE-HANDOFF.json",
      "bytes": 3593,
      "sha256": "2469cbcbd4eaf517ca90aada608cef8de28ab09e613abd30751660721fe24b16"
    }
  ],
  "bindingCount": 14,
  "ADMISSION_absent": true,
  "trial_001_absent": true,
  "pending_edits": false
}
```

Additive next-worth response to root’s later request, after the original B seal. The sourceWorkloadDecision above remains byte-identical.

```json
{
  "nextPreparationWorth": {
    "question": "Is one coherent static-only correction of these identified source/workload/evidence defects worth doing before13:15UTC?",
    "verdict": "A_ONE_STATIC_TERMINAL_EVIDENCE_CORRECTION_WORTH_PREPARING_ONLY",
    "currentSourceVerdictUnchanged": "B_FULL_SOURCE_WORKLOAD",
    "currentTrialWorthDoing": false,
    "rationale": "Yes, conditionally. The two blockers are concrete prospective terminal-state defects in a new, wholly reviewed but unexecuted worker/supervisor packet. One consolidated correction can change the readiness decision without changing the coupled constructor mathematics, source arrays, grid/cuts, numerical predicates, native metric, controls or image scope. This is not a rescue after a target refusal or permission for a reusable observer/harness cycle.",
    "scope": [
      "Preserve the exact current source/SOURCE-HANDOFF and this B decision as a recoverable historical epoch before any root-authorized correction. Do not rewrite this immutable sourceWorkloadDecision or claim the original source passed.",
      "One coherent static revision only: make terminal status/cleanup evidence independent of expired work hashing, make cleanup/identity failures sticky, and state the resulting finite collection clock/output/error semantics accurately.",
      "Keep all nine normative files and the entire constructor method/input/geometry/parameter/no-image scope unchanged; source/root review must verify that equality and the complete revised control flow. No target, native/API probe, fixture/harness/test or reduced method is implied.",
      "A new complete independent source/workload review and fresh root gate are mandatory after the revision. This next-worth A is neither source A nor execution admission.",
      "Original13:15UTC preparation cutoff and13:30UTC checkpoint remain. If the consolidated correction cannot fully own its remaining terminal duties, retain HOLD rather than patch again or extend the window.",
      "No all-I/O/hard native-stall/universal descendant-retirement guarantees may be inferred; uncollected/unknown outcomes must stay explicit and reconcilable before another job."
    ],
    "witnesses": "F1 run_once.py40–50,280–289 and F2 run_once.py214–276, against IMPLEMENTATION.md17,21; complete source review above.",
    "alternatives": [
      {
        "choice": "Prepare one preserved-epoch, consolidated static terminal-evidence revision and submit the entire revised packet for a fresh full gate.",
        "tradeoff": "Addresses decision-changing readiness defects before any target runs, but may still fail source review and delivers no field or garment result now."
      },
      {
        "choice": "Defer the packet unrun at its current B/HOLD, retaining the method and exact failure-path witnesses.",
        "tradeoff": "Avoids another source preparation cycle while leaving the material-volume constructor question open."
      }
    ],
    "authorization": "Root must decide and explicitly own any correction after whole-reading this handoff. The critic performs no source change or further experiment.",
    "pending_edits": false,
    "sealedUTC": "2026-10-20T12:29:30.901746+00:00",
    "pid": 96857
  },
  "canonicalNextWorthSHA256": "1df9aef8c7a545a5eb1707e7ae7a8efb9949fc630ea60950c6b349cc0e503845",
  "preservedOriginalReviewPrefixBytes": 15305,
  "preservedOriginalReviewPrefixSHA256": "ce0c91b6b0c8f013697e2b93f7bf9b1873db28c834b479abe6933dda22a49f0a"
}
```
