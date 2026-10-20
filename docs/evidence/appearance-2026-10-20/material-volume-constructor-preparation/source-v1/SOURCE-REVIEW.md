# Independent complete inert source/workload review

```json
{
  "sourceDecision": {
    "scope": "Complete exact inert constructor and workload source; no execution or feasibility acceptance",
    "decision": "B / HOLD: exact current complete workload does not qualify for a first trial",
    "source_worker_assessment": "The whole worker implements the declared full method; this read found no independently blocking worker-method defect, but this is a static review rather than a proof or actual-data result.",
    "blocking_findings": [
      "F1: finalization can discard durable terminal cleanup/reap evidence when hashing fails or reaches the total deadline",
      "F2: combined resource accounting omits the supervisor and final observed output totals do not enforce the sampled threshold"
    ],
    "next_fixed_technical_trial_worth": "Conditionally yes, once a complete corrected source/workload qualifies independently and at root: a single full-grid numerical-only trial can answer actual native-field/canonical-topology/parent eligibility and finite completion questions without substituting image or fit credit. The present exact source is not admitted.",
    "one_static_correction_worth": "A for one coherent inert supervisor-accounting/finalization correction before the unchanged 13:15 UTC source cutoff, preserving constructor.py, arrays, numerical predicates, grid, roles, caps and no-image scope. Fresh whole source/workload and root gates remain necessary; no iterative rescue or trial follows this review.",
    "root_or_other_critic_current_opinion_read": false,
    "pending_edits": false,
    "sealed_utc": "2026-10-20T12:31:21.326954+00:00",
    "seal_pid": 97197
  },
  "canonical_sha256": "1dd81b7f92d0f98d536beb6e7e7f7df556e02d443389234680731263117a6b87",
  "canonical_encoding": "UTF-8 JSON, sorted keys, separators comma/colon, ensure_ascii=false, no terminal LF"
}
```

B/HOLD applies to the complete proposed source, not to the ambition or to a measured failure of the geometry. No constructor, AST, import, payload/archive decode, native API, test, mesh, export, render or image operation was performed by this review. The one new file is this review. No current root source opinion or other critic review was semantically read; CHOICES-REVIEW.md and the older implementation snapshot were opaque full-byte hash checks only. README's statement that an earlier choices review allowed preparation was encountered as provenance, not used as a complete-source verdict.

## Blocking workload findings

**F1 — terminal collection evidence is not durable independently of successful hashing.** Witness: run_once.py40–50 makes every digest raise after TOTAL_DEADLINE; 205–208 requests stop at wall thresholds; 230–279 constructs the failure, cleanup, wait/reap and remaining-group result only in memory. At 281–286, all final file hashes are computed before either terminal collection.json or owner.json is written. The catch at 287–289 prints a traceback and sets exit code2, but does not persist that terminal state. Thus a total-deadline event during collection, an output-inventory/hash read failure, or another exception in that block can leave the previous saved owner.json at RUNNING even after a positively reaped worker. This is a literal reachable control-flow defect, not a prediction that the trial would time out. It conflicts with PREPARATION-PLAN.md24's positive retirement/error evidence and IMPLEMENTATION.md17/21's explicit collection ownership and bounded post-threshold shutdown/collection. A failed exit and stderr are useful, but do not preserve the cleanup facts that the source already obtained.

Two reasonable alternatives: (1) atomically save a minimal terminal failure/cleanup/reap receipt before optional artifact hashing, then perform a separately finite collection phase and atomically extend it with complete hashes or an explicit incomplete-hashing status; this retains durable facts but adds a small reviewed finalization state machine. (2) after any hashing/deadline failure, persist a hash-incomplete terminal receipt with the already-known identities, cleanup and reap observations, and require an explicitly owned bounded root collection before any later action; this is simpler but cannot claim complete artifact collection or numerical eligibility from an unfinished receipt. Neither alternative licenses a retry or changes geometry.

**F2 — the declared combined resource budget and the final observed output sample are not fully enforced.** Witness: PREPARATION-PLAN.md24 calls for 4GiB sampled combined owned-process RSS and full workload ownership. run_once.py149–150 knows the supervisor PID/PGID, but 186–196 enrolls only the separate worker PGID and sums only those members. The supervisor is excluded from that RSS sum. At 197–210 the live worker loop checks sampled output bytes; after worker exit, 281–284 obtains a new final file total but does not check it against LIMITS or update peak_output. Additional writes at 285–286 also occur after the live check. An observed final over-budget total can therefore accompany COLLECTED_NUMERICAL_ONLY. Sampled ceilings may overshoot between observations, as accurately disclosed in IMPLEMENTATION.md15/21; that limitation does not justify ignoring an actual final observation or labeling worker-only RSS as the combined workload.

Two reasonable alternatives: (1) explicitly record and include the live supervisor identity/RSS with the owned worker group, and apply a finite final resource observation before success with receipt-overhead accounting; this preserves the stated combined budget but requires careful finalization ordering. (2) explicitly narrow the 4GiB measurement to the worker group and separately own a finite supervisor/collection budget and final-output refusal rule; this makes the measurement truthful but changes the current combined-workload contract and needs a fresh complete gate. Neither option is a hard kernel RSS guarantee or a universal escaped-descendant proof.

These two findings are one coherent supervisor accounting/finalization completion, independent of the numerical constructor. It is useful to complete that static correction once within the original cutoff, then re-review the complete exact source. If it cannot be completed and qualified there, preserve the current unrun source at HOLD.

## Whole worker and workload assessment

The method is materially complete in literal source: constructor.py148–198 pins all seven sources and admits only the four exact NPY members; 201–320 owns full-source opposed-edge/link/component/Euler and exact signed-volume prerequisites. The exact projected closed-box filter and all-hit XYZ chains are at 348–412; it includes both projected bounds, tests every retained candidate exactly, and conservatively refuses ambiguous columns. This is the convex-combination filter justified in IMPLEMENTATION.md9, not a nearest-ray replacement. Native reported U0/radius/U1, full range registration/ties, cut-vector agreement, boundary-first classification, all sampled fields and full node count are at 426–525. The actual raw source buffers were not decoded by me; the fresh-bound four-member audit records their shapes, raw hashes, finite/range/selector checks, not new native behavior or a geometric proof.

Exact rational clipping and adjacency-derived outward cut cycles appear at 528–609; canonical minimal positive supports, all active inequality IDs, occurrence equality, complete polygon label union and opposite two-owner cancellation at 629–685; canonical convex fans at 687–707. The complete shared lattice enumeration is at 710–752, including the exact 11,099,520 count and only a valid single-inequality strictly-empty shortcut. No reduced lattice or favorable triangle label replaces the declared method. The whole topology/opening/bridge/world-plane gates are at 755–802; pure-torso full-facet pocket-guide ownership and exact endpoints/barycentrics at 805–881; all finishing parents and zipper ordering at 884–906. Export at 909–942 retains exact/F64/F32 records, construction/export mapping and refuses F32 fan collapse/flip. A static read cannot certify numerical completion or the absence of every implementation defect.

constructor.py945–1000 keeps source, topology, parent and export failures out of numerical eligibility, with stage/reason and no appearance/fit/default promotion. Its stream-close/final-receipt exceptions may themselves yield a missing worker receipt; run_once.py221–227 then fails the job rather than accepting partial output. The supervisor validates a future finite admission, exact programs/inputs/runtime and two reviews at 88–133; the exclusive trial-001 fuse precedes the sole new-session worker. Its identity checks, bounded observer, sampled thresholds, direct unreaped-child TERM/KILL path and final remaining-group/reap checks are at 167–276. These are useful ownership mechanisms. I do not extend them to unobserved escaped/reparented descendants, hard aggregate RSS/output limits, or a kernel wall limit. A future root launch must still collect its actual external tool/session return; this review creates neither ADMISSION.json nor a trial reservation.

The literal cap declarations remain 900s worker wall /1200s total stop threshold, 900/905s worker CPU and256MiB per-file only after worker Python starts, 4GiB sampled RSS /2GiB sampled output, and the exact work/record/vertex/facet/triangle caps. The runtime audit's Blender5.2.2 and Python pins match the constants in run_once.py14–17; this review did not re-execute or hash the runtime binaries. Frozen runtime/API metadata does not establish native API success. All1,901,380nodes and11,099,520tetrahedra remain required for a whole result. Counts or caps reached incompletely cannot qualify a partial result.

A later fixed technical trial is worth considering only after the complete source/workload qualifies. Its useful consumer is numerical source/field/topology/parent evidence for the coupled material representation; physical all-body/all-material/self contact, coverage, occupancy, rig/morph/pose, finished pocket construction, source-mesh images and full artist acceptance remain UNKNOWN and separately owed. The explicit no-image scope in IMPLEMENTATION.md13 and constructor.py957/983–985 prevents numerical-only promotion. Full roadmap, phase order, AAA ambitions, all prior closures, material-volume HOLD, and accepted/default/original/frozen/ignored/October10 assets remain unchanged.

## Read and seal chronology

All reads were inert text or opaque file hashing, with no yielded shell session/job. Whole read output was untruncated. The initial 07df9a command wholly displayed handoff/plan/implementation but exited1 because it also attempted a nonexistent local CONTRACT.json; the exact normative path was then read whole in dfd529 and re-emitted whole with line numbers in9d8021. This was a read-path correction, not a source change. 98ffee counted the1000/294lines only. Full constructor line windows were01677a(1–250),165726(251–500),1cf098(501–750),a293e6(751–1000), all exit0. The exact commands were `nl -ba <constructor.py> | sed -n '<range>p'`. Full supervisor read6a5a33 was `nl -ba <run_once.py>`, exit0. c603a2 wholly emitted SOURCE-FILE-PINS, ARCHIVE-OWNERS, FOUR-MEMBER-PREFLIGHT, RUNTIME-PREFLIGHT, AST-PARSE and README with line numbers and fresh pins. 1efd45 wholly re-emitted IMPLEMENTATION and PREPARATION-PLAN with line numbers. 5738da wholly emitted the handoff and its actual metadata, then exited1 on an audit-script key typo (`files` rather than `pins`); corrected8a7134 verified all13 pinned files match. Neither error evaluated target source. The final seal again freshly verified all13 entries.

The immutable first JSON was sealed in this file at its actual UTC/PID above, before any current root source opinion or other critic semantic read. The canonical hash covers sourceDecision alone in the stated encoding. The seal-write tool chunk and stable whole-readback chunk are reported in the handoff message because a tool's own return ID is only known after that call completes. No post-seal comparison or opinion revision is planned. pending_edits=false means this authored review is final, not that the proposed source qualified.

## Fresh literal bindings at seal

The 13 handoff entries below all matched their full bytes and SHA256. The handoff manifest is additionally bound. Semantic reads are flagged honestly; opaque hash checks do not import another review's judgment. Source archives and linked original documentary bodies were not followed. Four-member/runtime claims above are attributed to their bound audit metadata, not fresh payload/native validation.

```json
{
  "source_handoff": {
    "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/SOURCE-HANDOFF.json",
    "bytes": 3593,
    "sha256": "2469cbcbd4eaf517ca90aada608cef8de28ab09e613abd30751660721fe24b16"
  },
  "fresh_pins": [
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/PREPARATION-PLAN.md",
      "bytes": 8609,
      "sha256": "3e3b35a3295e237d4d1d05d61d1cb0afcf011b718f2ed45bc0d2c2dd2145c6a8",
      "semantic_read": true
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/IMPLEMENTATION.md",
      "bytes": 6749,
      "sha256": "9f3b8ea4c218ff78e8bc549899860b6a598f54010eaf7413d25d9543db303502",
      "semantic_read": true
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/constructor.py",
      "bytes": 44918,
      "sha256": "7f96e5a632fb4cd68a08e94e9bda1e8db556e998c8a4531f19a429e77f3fca2e",
      "semantic_read": true
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/run_once.py",
      "bytes": 14814,
      "sha256": "4b035b6b175913bf4d3fd31a81754e76aab14e1fb22caeb1ec1e2ad2219da0e7",
      "semantic_read": true
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/SOURCE-FILE-PINS.json",
      "bytes": 2631,
      "sha256": "7203bda28710dbb0620fe4651ae17260c4eeca29091fbb63f959e4636a7c41b0",
      "semantic_read": true
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/ARCHIVE-OWNERS.json",
      "bytes": 1338,
      "sha256": "432ff88073dc210f6cd301a655098be85d1cfe6884a696f7479c98f36f2d7563",
      "semantic_read": true
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/FOUR-MEMBER-PREFLIGHT.json",
      "bytes": 2567,
      "sha256": "7992ae450bd80b0a2c6f062e4d9adf943d60ba40e16e15bb58dc604c4c3a6296",
      "semantic_read": true
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/RUNTIME-PREFLIGHT.json",
      "bytes": 1327,
      "sha256": "cd52d24d14b008dbdcb5de8410a65d4fddff26d2199bb4c46ed79ca50dbd7d3c",
      "semantic_read": true
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/AST-PARSE.json",
      "bytes": 616,
      "sha256": "d34d59a5b11b710013851a9db9a0e6a4e4ee55f075be3730fb669bc3e99ae6a2",
      "semantic_read": true
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/README.md",
      "bytes": 3519,
      "sha256": "0ef525e0f605dbd7865944967755b9ced1f0f80d5ab130c022a659bcbaf22314",
      "semantic_read": true
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/CHOICES-REVIEW.md",
      "bytes": 8824,
      "sha256": "6d43f4e0d2fa11133a49171e0a20c1b460fb407cd2ffd97c0a590352bd3deda0",
      "semantic_read": false
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-20/material-volume-constructor-preparation/IMPLEMENTATION.choices-reviewed.md",
      "bytes": 5463,
      "sha256": "c59b4ba7eadae3ca287d0f5527c6d7eab48561ad938c5c417dd31e4505fb7e7f",
      "semantic_read": false
    },
    {
      "path": "/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-10/ari-volume-owner-revision/CONTRACT.json",
      "bytes": 17528,
      "sha256": "974c1cbd3ad811717aec75069f8a2c696aaacf2a8c5631599d8244914d1a7fcf",
      "semantic_read": true
    }
  ],
  "pending_edits": false
}
```
