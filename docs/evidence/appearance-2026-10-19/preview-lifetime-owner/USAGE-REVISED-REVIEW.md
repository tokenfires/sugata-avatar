# Revised usage review — A, documentation only

The revised guide resolves D1. USAGE line 21 explicitly makes the host create and retain the owner before preparation; line 24 receives that owner instead of hiding a local one. Line 42 requires inspection and preservation of `failures` and `parentDetach` on both successful closure and rejection, alongside the original operation error. Thus the catch path at 35–37 can keep the original error without making the cleanup record inaccessible.

I independently reconstructed the revised guide from the retained original using exactly the three declared text changes. All other bytes and all links are unchanged. The original 4,950-byte guide is preserved as USAGE-ORIGINAL.md; the first documentary B pair remains exact and resolves its historical USAGE pin through that snapshot. The helper, selftest and sole actual proof also remain byte-identical.

The illustrative sequence still checks closure before invoking the loader, awaits data through the owner, creates resources synchronously and guards publication. Its host duties and separately unqualified attachment/removal behavior are explicit. Job, version, 24-case count and time/RSS statements agree with the already accepted proof, and its three local proof links resolve.

No further actionable documentary issue was found. Retain the revised guide as the usage handoff for the tested local utility. This does not implement a host diagnostic path, adopt a preview client, qualify DOM/Three/GPU/physical release, reopen the closed trouser viewer or add appearance/roadmap credit. No additional execution or retrieval is needed.

Only this revised review and receipt were written; no pending edits.
