# Converse failure diagnostics — September 13, 2026

Converse now explains why a reply or expression request failed. Reaching the output-token limit,
exceeding the deadline, an HTTP rejection, an unreadable server response and invalid model output
have distinct explanations. Expand **Why this request failed** for the affected request, bounded
server message, HTTP status, completion status, reported token counts and configured limits.
Missing counts stay unknown. Successful setup/retry clears the obsolete details.

The supported installed model remains `qwen3-4b-instruct-2507-mlx`, verified in six live turns earlier
today. This repair uses controlled responses and sends no new model inference. It does not change
the selected model, strict schemas, 300/200-token reply/expression ceilings, four-second turn
deadlines, 30-second setup deadlines, temperature policy or reasoning controls. Open-ended text and
emotion quality remain experimental. See `CONVERSE-2026-09-13.md` for actual model evidence.

## Request behavior

Both request paths retain completion metadata and reject `finish_reason: length` before accepting
even parseable JSON. Affect previously discarded that status, mislabeled truncated reasoning as
unparseable, and could accept a clipped but syntactically valid expression. Setup now rejects
truncated affect transport; an HTTP-successful, non-truncated affect warm-up still does not certify
expression semantics. Actual appraisals continue to validate before changing the avatar.

Valid whole JSON in `reasoning_content` remains supported when `content` is empty. Arbitrary
reasoning prose and rejected model field values are excluded from diagnostic text. Server error
messages are shown as literal text, never HTML. Native HTTP error bodies are read up to 4,096 bytes,
with bounded retained text; unavailable/invalid details preserve the known HTTP status. The
existing request deadline bounds a stalled body read. No separate transport framework was added.

Reply failure releases the composer for retry. Expression failure keeps the local response and
identifies the expression request in the details. Invalid HTTP-200 JSON is a protocol-response
failure, not an assertion that the server is unreachable. Failed replies do not enter
conversation history, and explicit model selection remains required.

## Independent review and qualification

The critic proved three gaps in the first candidate, supplied two alternatives for each, and
recommended the implemented direct corrections:

- A known HTTP rejection was relabeled timeout when its optional error body stalled. Keep the
  HTTP failure and make its known status visible.
- Validation details repeated rejected values from either completion channel. Return field/type
  or failure-category descriptions without those values.
- Malformed outer HTTP-200 JSON became an unreachable-server message. Distinguish invalid response
  syntax while preserving socket and abort handling.

The critic independently verified all three corrections in **26 CPU controls**, with exact green
source snapshots and separate preserved red evidence. It recommends acceptance of the bounded repair.

The original candidate's passing browser report and all independent red snapshots are retained;
they do not qualify the final repair. The final controlled browser run passes **32 groups** on the
real WebGPU page, including setup, reply/appraisal truncation and deadlines, malformed envelopes,
invalid values, literal server markup, reasoning-JSON compatibility, retry and page retirement.
No unexpected JavaScript/GPU errors were recorded. Desktop and mobile details were visually checked.

Focused offline results: **11 diagnostic-contract groups, 60 LMStudioClient assertions, 54
AppraisalAffect assertions and five model-discovery groups pass**. These include real CPU abort
timers and native Response/ReadableStream cases. The client gate's optional live probe was disabled
explicitly for the recorded final run. All-page build and the catalogue check are recorded with
the archived evidence. These checks do not establish model latency distributions or emotional
understanding; the existing visual and repository-wide known failures remain separate.

## Recovery

Portable tests: `packages/testbed/src/converse-diagnostics.selftest.mjs` and the expanded
`converse.gpu.selftest.mjs`. The latter intercepts all model discovery/completion requests unless
its explicit read-only live-discovery option is used. It does not send inference to LM Studio.

Raw evidence: `captures/converse-diagnostics-2026-09-13/`. It contains initial/final browser
reports and images, final CPU/build logs, final source snapshots and the critic's separate red/green
records. Tracked summary and hashes: `docs/evidence/converse-diagnostics-2026-09-13*.json`.

The hair studies were separately checkpointed in `22f87f2`; no experimental curtain or follower
is included in this functional repair.

Final raw archive: **67 files /11,295,928 bytes**, re-read and hash-verified. Manifest SHA-256:
`0eece66830977e37328318f929af01a9c81d0d89700fe67a5162c360e6565e3e`.
The owned preview was refreshed and HTTP/module-verified at10:19PDT (session22450).
