# Independent corrected-source review

**Source association passes; rendering remains stopped.** The original SOURCE-REVIEW is preserved. I independently checked the corrected whole XML/JSON and the exact targeted delta without rendering, editing source or executing the generator.

Removing only `data-role="hem"` from `profile-H-R-turn` restores the original SVG SHA-256 exactly. Reverting that node's attribute/inherited role, rebuilding role memberships and restoring the old source hash makes every JSON field equal to the preserved preflight-input JSON. Removing the single metadata setter from draw.py restores its original hash. Geometry, text, style/layout, choices and side conventions are unchanged. There are 154 unique nodes/nine categories; shell29/hem12 now includes the profile turn.

The original finding and two alternatives remain in SOURCE-REVIEW: explicit hem ownership (adopted) versus a documented shell-owned context guide (weaker cross-view hem editing). Root's first global-attribute-removal assertion was an observer error; targeted source verification resolves it, without altering drawing geometry.

This check occurred after the fixed first-image cutoff. It does not admit a late render or qualify drawing appearance/readability. Root records zero renderer attempts; no PNG/render/failure output exists. The source remains isolated, unqualified and unpromoted. No native/body/fit/sewing/mechanics/runtime credit follows.

Exact checked identities:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| corrected SVG | 14858 | `3c1ef27a98e6d9e031b1898669ed676c833fdefc9d36586720f9aa8ad27cd0a4` |
| corrected JSON | 71588 | `a9b3d190f1dd2b2365de718815ec0186cb1977f6cefac1ea2ff6af4337b3405e` |
| corrected draw.py | 14515 | `47f3911afad0e69eea248179bc8367b78ddb5bc7f81716b55f5e40d46cdd8008` |
| SOURCE-CHECK | 1118 | `7c515429290362ca516a1b04d29358ce271ab872f75fe0c9cbc614b96736347d` |
| STOP | 977 | `8607eb8210c3dc733d0bd1a48a99f4366e3870939092f087113fd4b9defd8170` |
| preserved SOURCE-REVIEW | 4348 | `50f558763b68e5775ebfd1194f8a35a1a68d1c7379993600cd0522df31346184` |
