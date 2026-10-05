# Declared body and shoe source map

The existing `g050` body and low-shoe files have explicit scene, mesh, skin and accessor routes. This worksheet makes those routes inspectable before an original boot source is authored. It establishes declarations only; anatomical foot surfaces, a shared physical frame and wearable fit remain unverified.

| Exact file | Default scene root | Mesh owner | Mesh | Skin | Ordered joints |
| --- | --- | --- | --- | --- | --- |
| `assets/wardrobe/body/g050.glb` | node 60 | node 53 `Human` | mesh 0 `base.001` | skin 0 | 53 |
| `assets/wardrobe/shoes01/g050.glb` | node 54 | node 53 `Human.shoes01` | mesh 0 `shoes01` | skin 0 | 53 |

The body also declares six other mesh owners. Sharing a skin that includes foot labels does not make their surfaces feet. Both files declare `foot_l` node 44 at joint ordinal 47 and `foot_r` node 48 at ordinal 51. These are zero-based skin-joint ordinals; vertex joint values refer to that ordered array, rather than directly to node IDs. Names and matching literal local transforms do not establish anatomical or bind-world correspondence.

For primitive 0, body POSITION/JOINTS_0/WEIGHTS_0/indices accessors are 6/9/10/11; shoes are 0/3/4/5. Their declared vertex counts are 14517 and 1846. Inverse-bind descriptors are body 101 and shoe 6, each declaring 53 MAT4 entries. No accessor values were decoded, transformed, selected or measured.

[Body routes](body.routes.json), [shoe routes](shoes01.routes.json), [manifest route](manifest-route.json) and [root's direct source comparison](ROOT-DECLARATIONS.json) retain exact IDs and declarations. The complete original JSON chunks are preserved, with their byte hashes, in [body declarations](body.declarations.json) and [shoe declarations](shoes01.declarations.json). The manifest calls these assets plumbing stand-ins and declares only `g050`; its provenance statements were not newly audited.

The sole [CPU job](CPU-JOB.json) completed in 0.051 seconds, child 22468 exit 0/reaped. Root compared the saved JSON chunks and selected routes directly with the pinned original GLBs. [Independent result](RESULT.json) and [root close](ROOT-CLOSE.json) record the decision and next-study limit. No producer replay, BIN-data inquiry, import, geometry change, pose, browser/GPU/render/capture or asset promotion occurred.

Root and critic retain this declaration worksheet. The critic declines a bare joint-name-driven vertex-subset inquiry: a new study must own the exact source, reference frame and foot/interface responsibility first. Preparing that contract could make a physical-source question testable; moving to another outstanding character goal would conserve effort while leaving this interface open. No decoder or constructor is admitted by this result.

One current [Khronos glTF 2 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) response is retained in [PRIMARY.json](PRIMARY.json). The reviewed passages concern node transforms, accessor descriptors, skin-joint ordering and GLB containers. This worksheet is not a complete glTF conformance audit.

The isolated [boot artist sheet](../ankle-boot-design-proposal/README.md) remains perspective design vocabulary. It supplies no metric last, shaft/sole/heel construction, pairing, foot interface, rig or motion qualification. Accepted assets, original references, the 13 scoped checklist entries and all 10 broad AAA goals remain unchanged.
