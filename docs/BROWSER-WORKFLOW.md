# Supported browser workflow for Ember review

Robert explicitly adopted this workaround on October 31, 2026 and resumed Ember construction in chat `01a193eb-3cc7-75c2-bf83-e68f83443490`. It supersedes older instructions that require uninterrupted cross-message control before work can proceed. Robert will close stale tabs manually.

For a local review, confirm the intended server is responding. A refused HTTP connection is a server-availability problem, distinct from a stale browser-control handle; restore the project's existing authorized review service when appropriate.

1. Use the supported CUA interface and symbolic `iab`. Use a retained handle when healthy; do not treat historical numeric browser IDs as permanent routing information.
2. If the retained handle fails with `browser.user is unavailable`, open ONE fresh tab at the intended local review URL with `cua.createBrowserTab('iab', url, ...)`. This is authorized recovery, not grounds for an indefinite work stop.
3. Confirm actual live AX/DOM access and a completed render report. Restore the explicitly intended view, expression, lighting and review state using visible controls. A fresh tab starts at page defaults; do not silently compare unmatched states. Inventory or HTTP 200 alone does not establish visual access or quality.
4. Continue the authorized bounded work once live control works. Preserve evidence and review budgets. Use handoff marking when the tab is needed in a later turn, while accepting that the next turn may need a fresh tab again.
5. Do not repeatedly try closing/rebinding stale tabs. In the controlled test both stale-handle close and fresh binding failed, while the new tab worked. Robert will close the stale tabs manually. Cleanup is not a prerequisite to progress.
6. If the ONE fresh-tab recovery also fails, record the concrete error and stop that browser operation. Do not loop resets/reopens, bypass permissions, use private transports or invoke the previously denied native-app fallback.

The server was healthy and fresh-tab read/input control was repeatedly demonstrated. Persistent session control and the exact app/tool defect remain unresolved. This workaround is not an appearance acceptance.

[Exact experiments](evidence/ember-2026-10-31-appearance-v001/FRESH-CHAT-RESULT.md) · [Current Ember work](EMBER-AVATAR-NEXT.md).
