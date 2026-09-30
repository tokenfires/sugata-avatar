# Custom wardrobe colours: implementation handoff

Implemented in the isolated `codex/custom-colours-2026-09-26` worktree based on `31d797e`. Independent source review and native rendering/UI qualification are pending. No browser, GPU, Vite server, build, dependency installation, accepted asset change or main-checkout write was performed by this implementation task.

Ecru and Charcoal now accept optional immutable `wardrobe.colours` values for `top`, `bottom` and `shoes`. Only complete six-digit hex strings are accepted and normalized to lowercase. Original rejects a supplied object before asset loading; absent overrides preserve old option/report shapes. The existing qualified GLB loader, colour regions, source-luminance detail, normal/AO, roughness, masks and resource owner remain in place. Socks keep the base-palette tint. Colour metadata is copied into the fixed Wardrobe owner and copied/frozen on appearance readback.

The Wardrobe page adds a collapsed Mix colours draft with per-part enablement, explicit hex/picker selection and Apply. An untouched picker does not invent a colour, including Charcoal's source-textured denim. Apply creates a fresh owned preview. Settings and saved looks derive colours from actual attachment, not the draft. Choosing a whole palette clears custom colours even when its base is already selected; the unchanged three canonical palette buttons still own reference actions. Custom combinations do not mark a whole-palette reference as an exact current look. Mixed outfit changes retain applied logical-part colours and reset drafts; existing preset navigation behavior remains, with applied colour fields explicitly carried.

URL selection uses flat `topColor`, `bottomColor`, `shoesColor`. The settings format remains bare Avatar options and the local saved-look envelope remains version 1. Old combinations retain their serialized configuration shapes. New settings accept normalized hex case and reject unsupported fields. Old applications can retain a new unsupported saved entry but are not promised to render it.

## CPU evidence

`implementation-cpu-v1/source-handoff.json` binds 17 implementation/test/API files and the focused result set. Its SHA-256 is `1bea808a96b0d5cc41ba394205661a2932a174b710107a1f79c610710a2efd3e`.

The current source receipt is `source-handoff-v2.json`, SHA `08dd9c675c3f9d7bc1e0f4e53adcdd33f1801d9d45f9e873cbc88d150462f8b1`. A small follow-up preserves the outfit-change draft-reset notice through the next availability refresh. Only the draft controller and its focused test changed; all six settings/draft groups pass again, including that event sequence. The original receipt and logs remain intact.

| Check | Result |
| --- | --- |
| Colour admission, data safety, Original early refusal | 3 groups |
| Real GLB material graphs, geometry/masks/cache and disposal | 7 groups |
| Existing Avatar wardrobe integration | 13 groups |
| Existing wardrobe regression | 51 assertions |
| Existing Avatar public API | 138 assertions |
| Showcase presets | 4 groups |
| Existing settings, including 72 configurations | 4 groups |
| Existing saved collection, including 72 configurations | 5 groups |
| Custom settings/URL/named-look/draft behavior | 6 groups |
| Changed/new JavaScript syntax; whitespace diff check | Passed |

The first recorded suite run stopped the existing wardrobe regression when its Fedora test encountered one remaining local LFS pointer. The failed log and incomplete receipt are retained, not overwritten. After verifying that file's exact pointer SHA/size against existing main-checkout bytes and hydrating only the isolated copy, the sole failed suite was rerun: all 51 assertions passed. `hydration-retry.json` binds that recovery; it does not claim a product repair. Other required local GLBs were likewise hydrated from exact existing bytes. Asset status, unstaged content diff and staged content diff are empty. The intentionally untracked `node_modules` symlink remains outside the commit.

During test development, a material-graph assertion first looked only for scalar constant nodes. Actual Three inspection showed tint literals are vector constants; the oracle now checks the actual linear RGB vector. No production material change was made for that test correction.

The real-GLB CPU tests stub image decoding. They verify bytes, material graph ownership, map references and disposal; they do not establish rendered fabric appearance. The small draft event fixture runs the real controller against minimal controls and does not claim browser fieldset inheritance, keyboard focus, responsive layout or native lifetime coverage. The root coordinator owns matched native colour images and actual interaction/disposal checks before integration acceptance.
