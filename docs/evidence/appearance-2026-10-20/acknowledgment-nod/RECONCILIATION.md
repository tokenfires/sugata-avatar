# Nod source reconciliation

```json
{
  "verdict": "B_HOLD_EXACT_SOURCE_PACKET_UNRUN",
  "sealedUTC": "2026-10-20T14:04:55.888333+00:00",
  "pid": 11326,
  "reason": "The acquired browser identity is not durably recorded before the long readiness path, and final accounting/receipt errors can suppress or contradict the promised independent terminal summary.",
  "supersedesAdmissionAssessment": "The original SOURCE-REVIEW A is preserved unchanged as a historical opinion; it must not support current admission.",
  "currentPermission": "No CPU selftest, native collector, correction, retry, new observer or successor under this nomination.",
  "scope": "Prospective source/collection contract defects only; no actual process, motion, video or appearance failure was observed.",
  "rootOpinionExposure": "Root disclosed its inert B preference before this reconciliation. This is a source-witness reconciliation, not a blind independent review."
}
```

Canonical opinion SHA256: `4c1ca7ff1b4c889de18f7d3868f7240bdd55b5573e9ed791c76d69c73cdb1239` (sorted-key compact UTF-8 JSON, no terminal LF).

**B/HOLD is warranted under this exact complete-source contract.** My original A was too permissive: I treated reported failure/unknown and ordinary cleanup as adequate without enforcing these narrower durable-ownership and independent-terminal duties. The original review stays byte-identical. This reconciliation changes the admission assessment, not the source or any observed result. The useful gesture/action design and supported Playwright API route do not cure these collection defects.

**F1 — known browser identity is not durable before the long fallible workload.** Collector40 writes owner-start with only the Node PID. At44 the actual browser ChildProcess/PID is acquired and45 attaches its close listener, but it remains in memory until save('ready') at62, after connect, context/page creation, navigation, up to90s readiness, evaluations and screenshot. If the Node owner is externally interrupted or fatally lost in this post-handle interval, root's promised exact known-browser retirement check lacks that acquired browser identity. Ordinary finally81–87 can handle ordinary exceptions; it does not fill a missing durable identity after loss of the parent. This is narrower than the contract's honestly unexposed startup-before-handle limitation: the handle has already returned. No browser death from parent death or actual orphan is inferred.

Two alternatives/tradeoffs: (1) an otherwise separately authorized source design could immediately persist the already-acquired browser identity/phase before page work, with an explicit failure/outer-recovery rule; that improves recoverability but changes source and adds a fallible I/O gate, so it is unavailable here. (2) retain this exact packet inert and close it; this forgoes the immediate motion answer but respects current ownership and no-correction boundaries. Choose(2), with no PID census, wrapper, probe or alternate observer.

**F2 — final receipt/accounting failures can contradict or suppress terminal evidence.** At106, a successful report.json write can contain A_COLLECTION_ONLY before the subsequent terminal.json write fails and demotes only the in-memory status. Unless the independent over-budget branch107 is entered, the earlier success receipt is not demoted. More directly, totalBytes() at107 is outside the protected inventory103 and receipt catches106/109. An enumeration/stat/type exception there exits before compact stdout111 and explicit exit assignment112. An uncaught-error nonzero tool return would help root refuse the run, but does not implement the SOURCE-CONTRACT promise of independent best-effort terminal attempts plus compact summary. “Best effort” permits unsuccessful writes; it does not make an avoidably coupled control-flow path independent. This is a literal prospective branch witness, not an assertion that storage failure occurred.

Two alternatives/tradeoffs: (1) a separately authorized complete design could carry sticky final failure across sinks, attempt demotion of an earlier success receipt, and protect compact summary/exit determination independently of final accounting; that improves consistency but adds source/terminal-path complexity and is a prohibited correction here. (2) close this nomination with the exact unexecuted evidence and make no collector-success claim; this leaves motion unqualified but preserves first-source-failure/no-correction semantics. Choose(2). No atomic persistence, hard native-stall or universal descendant guarantee is being demanded or inferred.

These are complete-source blockers before either declared target entry. Running only the apparently useful CPU proof would still violate this nomination's first-source-refusal rule. No next experiment or repair under this contract is worthwhile/admitted; checkpoint the inert B without a renamed source/observer successor. All prior closures, assets/defaults, full roadmap and human/cadence boundaries persist.

## Actual reconciliation scope

`fd5774`, exit0, PID11191, 2026-10-20T14:03:54.281073Z: whole WORKLOAD-REVIEW read, including the two exact witnesses. The collector/contract had already been wholly read at the immutable source epoch; this reconciliation reuses those exact bytes and introduces no new source investigation. Root's message disclosed its current B choice before this read; that exposure is explicit in the immutable opinion above. Root's separate current opinion file was not opened.

Only the following five source/document bindings were freshly byte/hash checked for this reconciliation. The old source review remains unchanged. No execution, import, test, browser, native/API call, network, image, source edit or extra file is performed. Only RECONCILIATION.md is written.

```json
[
  {
    "path": "tools/critic/acknowledgment-nod.mjs",
    "bytes": 11485,
    "sha256": "d2376007b00a6e15e0dfcb0b3f15b11f5536dea0e6ed1f59850829237b33ef9f"
  },
  {
    "path": "docs/evidence/appearance-2026-10-20/acknowledgment-nod/SOURCE-CONTRACT.md",
    "bytes": 7954,
    "sha256": "6f28bd765c9efa4c9f787681e2ba404761cd94408cc4e801884841715bfbb135"
  },
  {
    "path": "docs/evidence/appearance-2026-10-20/acknowledgment-nod/SOURCE-HANDOFF.json",
    "bytes": 3244,
    "sha256": "72d3f0f79cb632b048e56a00da3bf76697b5b42680adc9b29c4cc6711220a0b6"
  },
  {
    "path": "docs/evidence/appearance-2026-10-20/acknowledgment-nod/SOURCE-REVIEW.md",
    "bytes": 16767,
    "sha256": "e6f436337ce272f0b14a20a8e68fd1906e9bac974b55efe33e70f9106d4f3c02"
  },
  {
    "path": "docs/evidence/appearance-2026-10-20/acknowledgment-nod/WORKLOAD-REVIEW.md",
    "bytes": 18897,
    "sha256": "dc4a82ea61c289927337c54b8453f51cfab80a45df28c760574584ab15679032"
  }
]
```

`pending_edits=false`. Whole readback, canonical-opinion verification and unchanged-input hashes follow before reporting stable delivery.
