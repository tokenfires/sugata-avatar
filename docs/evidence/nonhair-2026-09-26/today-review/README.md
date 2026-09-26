# Today's review entry point

The local hub now opens a focused September 26 landing page with the current Wardrobe and
Portrait demos, the qualified Kitchen comparison, the isolated expression study and the hand
candidate comparison. The earlier hand-motion diagnosis stays reachable. Current work and
experiments have explicit labels. Existing catalogue destinations remain unchanged.

The shortcut is development-only: its URL resolves from the module location to the repository's
local evidence page. It does not hard-code this user's home directory or port. The production
all-page build removes the shortcut, because those repository-local evidence/capture paths are
not a published deployment. All 18 configured pages build; the catalogue's 92 assertions pass.
A scan of built JavaScript finds no Today’s work label, shortcut marker or evidence-page URL.

## Actual browser verification

`native-v3/report.json` SHA256 `8752136a5c7dd38f703c18fce52e7f0dd493cfabf1b3f094fdab7034582852a1`
passes four groups with no page, console, HTTP or failed-request errors:

- Hub shortcut, keyboard skip link and section navigation.
- Desktop 1440×1000 and mobile 390×844 layout with no horizontal page overflow.
- All four comparison routes, including the real two-column candidate and three-column earlier
  diagnostic galleries beyond their landing stubs. The expression gallery's actual runtime title
  and three loaded columns are checked.
- Both live links initialize actual WebGPU avatars serially. Real navigation invokes each page's
  existing non-persisted pagehide cleanup. Observed Avatar retirement reports no retained handles
  and zero renderer counters for both.

The 16 bound source files and two hash-verified native screenshots are copied into `native-v3`.
Root directly inspected the same final desktop/mobile landing layout from native-v2. The page is
readable at both widths, with visible status labels, clear actions and no cropped card contents.
These are navigation/layout/lifecycle observations, not appearance, performance, fit or complete
resource-reclamation proof. In particular, zeroed renderer counters do not measure OS reclamation;
the separate Stage DPR-listener lifecycle issue remains a different slice.

## Preserved failed checks and corrections

A source audit corrected the initial unlaunched probe before native work: the expression title
changes on initialization; an Avatar-only dispose call would leave Portrait's page RAF alive;
and the old diagnostic link needed to open its actual gallery. The final probe observes the
existing complete pagehide retirement and also records console/failed-request errors.

Native-v1 passed the four functional groups but failed its error gate on a console404. A separate
read-only native CDP/console-location reproduction identified `http://127.0.0.1:5173/favicon.ico`.
Both hand landing stubs lacked an explicit icon; adding the existing pages' `data:,` icon pattern
removed that missing request. The old report and exact producer are retained.

Native-v2 again passed all four functional groups but retained one `net::ERR_ABORTED` request for
the root document. Its cause was not established. The successor explicitly waits for complete
cross-document page loads and records main-frame navigation times plus failed-request metadata;
no error is filtered or suppressed. Native-v3 is a fresh clean run. Native-v2 remains a failed
error gate, not silently reclassified as successful.
