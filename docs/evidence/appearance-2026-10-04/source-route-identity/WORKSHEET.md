# Body asset-address worksheet

Two exact GET responses at19:36:37UTC identify a usable bodyfile address on the retained local review server. No asset parse, viewer change or appearance qualification.

| Predeclared address | HTTP | Content type | Actual bytes | Body identity |
| --- | ---: | --- | ---: | --- |
| http://127.0.0.1:5173/assets/wardrobe/body/g050.glb | 200 | text/html | 7501 | Wrong: actual HTML app page |
| http://127.0.0.1:5173/@fs/Users/robault/GitHub/sugata-avatar/assets/wardrobe/body/g050.glb | 200 | model/gltf-binary | 11916776 | Exact original body bytes |

First responseSHA364c81c24da47ab282d4423f13c2c9b5a44725d0bbb7e9eb3011503c2f570812 matches the previous native refusal's recorded response. Its actual retained body begins with an HTML doctype/Viteclient and the testbed app title; this is an observed content identity, not inferred from size. SecondSHAfc4445c95ed3f423734ff272ee78ebb44d762a8f16edb94b26039de7a8a96b3a matches original assets/wardrobe/body/g050.glb; root independently compares all returned bytes with that file. Exact complete raw responses are retained with full header pairs in JOB.json.

The current server config uses packages/testbed as app root and allows the repository root. Retain the verified @fs address only for this specific body on this server; no general route portability, deployed asset addressing, bra/briefs identity, skeleton/morph/pose/fit or GPU appearance is proved. A future viewer/three-layer trial needs its own exact input/route/source admission and actual image review. Original refused native trial stays frozen.

[Job and headers](JOB.json), [first raw HTML response](response-0.bin), [exact returned body](response-1.bin), [plan](PLAN.md), [independent result](RESULT.md), [root](ROOT-RESULT.json) and [receipt/checkpoint](RECEIPT.md) retain recovery. No additional request or source serving edit follows this worksheet.
