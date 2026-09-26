# Independent source review: named browser-local looks

Reviewer: `/root/critic`, 2026-09-26. Static/CPU review; rendered/native acceptance is pending.

**Verdict: ready for the focused native/UI gate.** No source blocker was found in the collection helper or current Showcase integration. This is a page-local bookmark collection, not identity/agency persistence or a new fit qualification.

I independently reran all five `showcase-collection.selftest.mjs` groups, including 72 canonical supported configuration roundtrips. Names remain outside Avatar options. Names are rendered with `textContent`, empty/control-character/overlong names are rejected, normalized duplicate names are refused, and the list is capped at twelve. Unsupported configurations remain visible and removable; malformed collection metadata blocks writes and preserves stored bytes.

Every mutation rereads storage and checks the raw stored value again before writing. Removal verifies that the clicked record has not changed. Undo requires the exact unchanged post-removal collection, so it cannot discard another tab's intervening additions or rename. This is useful stale-write protection, not an atomic simultaneous-tab merge guarantee. Quota/access failures are surfaced and have no in-memory persistence fallback. The storage key is separate from wardrobe agency.

The UI obtains the actual attached configuration before saving. Saved Open revalidates the latest record and reuses strict settings restoration and existing navigation ownership. Save/Remove/Undo only affect storage and collection DOM; they do not reset the Avatar, camera, clock or attention. Collection controls participate in busy/image-save/failure guards, and persisted-page restoration refreshes the list without clearing unrelated work.

One implementation distinction from the initial plan: a collection read failure clears its displayed rows and labels the collection Unavailable. Stored bytes and the current Avatar are preserved; previously displayed collection rows are not cached for viewing. Describe that behavior accurately rather than claiming cached-list preservation. A failed quota write followed by a successful read still shows the existing stored list.

The native gate must still prove actual attached look restoration across reload, origin/context persistence, storage-event refresh, safe failure display, metadata operations preserving the current view, and useful keyboard/mobile layout. The section is intentionally collapsed; its native screenshots and interaction flow determine final usability acceptance.

Signed: independent critic agent `/root/critic`.
