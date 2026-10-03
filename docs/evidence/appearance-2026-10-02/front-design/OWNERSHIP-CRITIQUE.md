# Backing and visible-guide ownership — source review

**Worth this bounded interface step; it changes a concrete candidate packaging decision. A second skinned backing primitive cannot retain the current Avatar guide dynamics without runtime ownership work.** A separately authored backing component packed into the single geometry's prefix is a source-compatible interface possibility under the conditions below. Neither possibility establishes shape, fit, coverage or motion feasibility. This critic review began at `03:14Z` and completed before `03:29Z`; no builder, geometry calculation, native capture or generation ran.

The design witness remains the actual fringe-hidden native front and one accepted contextual concept: disconnected forehead panels/crown fan versus joined part-to-side flow, open face and rounded crown. The five [visible criteria](README.md) are not a texture-fitting mask or permission to change protected records. Full character/wardrobe/expression scope and the closed mesh-follow/pullback/tuning lines remain intact.

## 1. More primitives are more runtime meshes

**Actual source:** installed `GLTFLoader.js:3810–3935` creates one Three mesh per primitive and returns a Group when there is more than one. A skinned mesh definition makes each triangle primitive a SkinnedMesh. `Avatar.js:3378–3442` gathers all SkinnedMeshes, rebinds each by bone name and reparents them to `hairRoot`. However `buildHairDynamics():3587–3597` explicitly returns null for `meshes.length !== 1`, leaving the whole groom rigid. The loader does render multiple skinned meshes; it does not preserve their guide simulation. One glTF mesh containing two primitives still triggers this branch.

Material ownership is also shared: `Avatar.js:3455–3465` takes the alpha texture only from `skinned[0].material?.map`; `HairMaterial.js:4041–4074` assigns one material to every selected mesh. A second embedded material/alpha sheet is not independently honored. Avatar explicitly reparents only collected SkinnedMeshes. A separate ordinary backing node outside their retained subtrees is omitted; an ordinary descendant could remain incidentally, but that is no explicit backing API or automatic head-skinning contract.

**A:** author backing as disconnected prefix geometry inside the existing one-primitive SkinnedMesh and shared material. Retains the current solver interface, but couples its atlas/shading and index layout to the groom.

**B:** add explicit backing/guide roles in Avatar: choose the guide mesh for dynamics/history/frame, independently configure/rebind the backing and own its material/retirement. Clearer roles and independent texture coordinates, but real loader, reporting, colour/tint, shadow/velocity and lifecycle work. No source change is admitted by this review.

## 2. Single geometry requires prefix backing and a final card block

**Actual source:** `HairDynamics.js:192–243` selects the modal even connected-component size, checks contiguous equal-sized components and one unbroken ring-major card block. `:902–906` treats every vertex at or after `cardVertexBase` as a simulated card vertex, without an upper bound. `HairCardFrame.js:10–16` and `CardRenderHistory.js:169–177` require total position count equal to the prefix plus card count. Therefore simply appending backing after cards is incompatible with the existing pipeline. Welding backing to cards changes the components; a backing fragment matching the modal 34-vertex size would be classified as a card.

Read-only GLB JSON inspection confirms exact inward lead `8c458428551ca546d2aac511dec3b516067d53050de9663a563b9884a4ae5fe7` has one mesh, one triangle primitive, six attributes each with17,516 entries, and51,000 indices. This metadata read did not recompute connectivity or run the groom parser. The earlier frozen source decomposition supplies the current652-vertex cap prefix and496×34 card records.

**A:** reauthor within the existing cap-prefix slots while preserving their count and all card indices; keep disconnected backing, the two-edge17-ring card block last, and protected card attributes/indices exact. Narrowest packaging boundary, but a fixed cap layout may limit the desired backing/part surface and needs a declared authoring method.

**B:** enlarge or replace the prefix while retaining the final ring-major card block. More backing topology freedom, but it deliberately changes card absolute indices and requires a record-correspondence/reindexing preservation contract. Equal authored protected attributes after mapping would not mean the original index/BIN records stayed exact. Do not silently choose either layout.

## 3. Backing is a UV/material role, not an opaque mesh label

**Actual source:** Avatar sets `cardRoots={capStripEnd:1/8,fadeLength:.18}`. `HairMaterial.js:3726–3731` bypasses root fade only where UV0 U is below1/8; sampled atlas alpha still multiplies coverage. `:3156–3160` uses flow-sheet B for cap root occlusion and UV0 V for cards. `:3948` uses flow RG for strand direction, `:2976` depth R for bundle depth, and `:4015` UV1 X for lock tilt. `:3889–3938` derives a local across/along frame from the UV Jacobian; a constant/degenerate UV is not a meaningful continuous strand map.

The actual generator `hair_cards.py:2605–2676` maps cap UVs around the whorl into strip0, and `:2680–2740` places shells before cards with per-vertex cap UV1 and per-card constant guide UV1. Its comment that interpolated cap lock shading is hidden underneath cards is an assumption to reconsider if backing becomes visibly responsible for the new part/crown. `hair_texture.py:125–126,562–566` imposes cap-strip coverage, not uniform alpha1 at every sampled location. Neither cap classification nor an atlas mean proves the independent scalp-coverage target.

**A:** retain one shared material and deliberately author backing UV0 within the cap strip with meaningful direction/root/depth correspondence and UV1 semantics. Lowest runtime scope, but its visible flow and actual coverage need qualification; inherited polar flow is not automatically the new part target.

**B:** declare a separate backing material/texture-coordinate role and its intended visibility. More freedom for continuous part/coverage authoring, with explicit colour/tint/shadow/velocity/resource ownership work and later interface validation. This is a broader runtime contract, not a free primitive addition.

A related guide boundary must remain explicit: `HairCardFrame.js:17–30` requires constant two U columns, uniform atlas widths and V equal to ring/(rings−1). One changed guide map can disable smoothing for the entire groom through its optional derivative fallback (`:78–86`). Preserve that layout if keeping the current smooth-frame behavior; alternatively deliberately admit the derivative fallback/new frame contract and assess its appearance. Shader acceptance alone would not preserve the same shading path.

## 4. Protected authored records do not freeze protected motion

**Actual source:** `HairDynamics.js:516–534` computes a median arc over all cards and divides it by each card's arc for compliance. Changing editable-guide lengths can therefore change compliance on protected guides even when their positions/UV/skin records are equal. This does not show that protected geometry must change; it limits the promise made by record preservation.

**A:** define preservation as exact authored records plus unchanged runtime implementation, and later qualify the whole groom's resulting motion/visible envelope. Enables meaningful editable-guide authoring without claiming identical protected trajectories.

**B:** additionally require unchanged compliance inputs/output for protected guides, constraining the candidate's global arc distribution or deliberately introducing a separate runtime policy. Stronger behavioral preservation, but materially constrains design or expands runtime work. Do not silently freeze a median constant or retune stiffness to satisfy it.

## Bounded conclusion

Use the single-primitive prefix route as the narrow interface candidate to examine next; stop short of declaring it feasible or selecting new topology/root/UV degrees. A backing-only edit cannot by itself establish the concept's visible guide continuity. The next concrete contract must state which cap and visible-guide records may change, what exactly338-card preservation means, the independent intended hairline/coverage domain, and how the shared atlas/frame responsibilities will be met. If that cannot be stated without incidental primitive ownership or unspecified UV semantics, declare explicit role/runtime work under alternative B before construction. No broad colour packet follows merely to label existing grey uncertainty.

## Exact source receipt

| Read source | SHA256 |
| --- | --- |
| `packages/core/src/Avatar.js` | `fdbe49aec99f9c718bde269b5e434cda07af1504ea8df386a634714cea112b18` |
| `packages/core/src/motion/HairDynamics.js` | `bacd260ab768277b4efa9345c990e58a133c3c97f6b683ecf1674cc3588de1bc` |
| `packages/core/src/material/HairMaterial.js` | `cc91af01db7fe50565780dbb7263311a1523732197270bf309e013558ee8a613` |
| `packages/core/src/render/HairCardFrame.js` | `c2af67e5ff6ca002a52d84de2a02919be55b11f863abc920e48fb29a0981ec83` |
| `packages/core/src/render/CardRenderHistory.js` | `3b67d5621c0a2f3084f5c23032bc73e1618e49efcc54dcc8f7ec96ac64869d2f` |
| `tools/figure-pipeline/hair_cards.py` | `6a9392de61d52953e35543b6aa4b39ac9817cac2f1c5f032177aeae1456baaca` |
| `tools/figure-pipeline/hair_texture.py` | `1e6962000651b8eab1d8d3c931259960f7889af1a0c7b3caac54357840279f64` |
| Installed `node_modules/three/examples/jsm/loaders/GLTFLoader.js` | `97642d720f16cc9a0c9844934198e4d0c023bea8e89576d0f7545d03b2d103d2` |

Commands were source/document searches and reads, exact-byte hashes and a JSON-only GLB metadata read. No source/asset byte changed; the critic authored only this separate critique. These source predicates are not an executed candidate or native behavior receipt.
