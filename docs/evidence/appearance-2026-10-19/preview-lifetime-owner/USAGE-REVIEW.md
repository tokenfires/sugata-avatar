# Usage review — B on the illustrative failure path

The API and qualification prose are accurately limited, and the three local proof links resolve. Hold this exact guide for one documentation issue; the unchanged source and actual 24-case proof retain their A verdict.

**D1 — The example hides cleanup failures when preparation fails.** USAGE lines 25 and 35 keep the owner local and return it only on success. Lines 36–39 call `owner.close(error)`, discard its snapshot and rethrow the original error. The host therefore cannot inspect this owner's failure record on that path, despite line 15 explicitly requiring inspection of `failures` and `parentDetach`.

This matters because the real implementation deliberately contains disposer, parent-detachment and abort failures while continuing cleanup (module 33–56); `close` returns their inspection snapshot instead of throwing them. The actual proof's failed-release cases support that behavior. There is no actual client or observed resource leak here: the defect is the handoff example losing access to its own cleanup evidence.

Alternative A is an explicitly bounded, nonthrowing host diagnostic callback that receives the close snapshot before rethrowing the original error. This is a small example change, but requires a clear rule preventing diagnostic errors from masking the original failure. Alternative B is to let the host create and retain the owner, pass it into preparation, and inspect/close it on both outcomes. This makes lifetime responsibility clearer, at the cost of a slightly longer illustration. B is the cleaner documentary choice.

The rest of the guide correctly distinguishes lifetime-wide identity capacity, data waits from owned resources, synchronous callbacks, attempted versus physical release, and future-client qualification. Its job, version, 24-case count and local time/RSS samples match the accepted packet. No new execution, retrieval, client adoption or closed preview repair is needed to resolve D1.

Only this review and its receipt were written. The original guide, source, proof and prior reviews remain unchanged; no pending edits.
