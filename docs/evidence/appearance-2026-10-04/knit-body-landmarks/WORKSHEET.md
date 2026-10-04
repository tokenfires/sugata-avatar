# Body-only registration worksheet

Status: **incompatible**. Held-out limits fail: negative-X-cuff, positive-X-cuff

Initial source-scene skeletal origins only. Artist choices define the references and limits. This is not a fitted garment or a worn/avatar appearance result.

## Source owner

Selection: first eligible primitive in saved default-scene traversal; all candidates retained in worksheet.json.

`{"nodeIndex": 53, "meshIndex": 0, "primitiveIndex": 0, "skinIndex": 0, "nodeName": "Human", "selection": "first eligible saved-scene primitive, no live runtime object claim"}`

## Declared landmarks

| Role | Source mean (artist units) | Literal joint / node | Origin (m) | Artist offset (m) | Target (m) |
| --- | --- | --- | --- | --- | --- |
| neck | [0.0, 0.75, 0.0] | neck_01 / 39 | [0.0, 1.413631730798614, 0.005130273575210731] | [0, 0.02, 0] | [0.0, 1.433631730798614, 0.005130273575210731] |
| hem | [0.0, 0.0, 0.0] | pelvis / 51 | [0.0, 0.8738863462358448, 0.013216651186851827] | [0, -0.05, 0] | [0.0, 0.8238863462358448, 0.013216651186851827] |
| negative-X-cuff | [-0.75, 0.6, 0.0] | hand_r / 34 | [-0.4530948557759919, 1.0155319980738875, 0.18322858378187776] | [0, 0, 0] | [-0.4530948557759919, 1.0155319980738875, 0.18322858378187776] |
| positive-X-cuff | [0.75, 0.6, 0.0] | hand_l / 15 | [0.4530948557759919, 1.0155319980738875, 0.18322858378187776] | [0, 0, 0] | [0.4530948557759919, 1.0155319980738875, 0.18322858378187776] |

## Fixed comparison

Identity rotation. Neck/hem Y spans set one uniform scale; translation anchors the neck.

Metres per artist unit: `0.8129938460836922`.

Translation (m): `[0.0, 0.8238863462358448, 0.005130273575210731]`.

| Held-out role | Mapped mean (m) | Residual (mm) | Limit (mm) | Pass |
| --- | --- | --- | --- | --- |
| hem | [0.0, 0.8238863462358448, 0.005130273575210731] | 8.086378 | 50.0 | True |
| negative-X-cuff | [-0.6097453845627692, 1.3116826538860602, 0.005130273575210731] | 379.425364 | 50.0 | False |
| positive-X-cuff | [0.6097453845627692, 1.3116826538860602, 0.005130273575210731] | 379.425364 | 50.0 | False |

Missing or ambiguous inputs and any failed limit close this fixed proposal. No alternative scale/offset/rotation or retry is applied.

Exact vertex IDs, raw source rows, matching joint ordinals, matrices, operands and gates are retained in [worksheet.json](worksheet.json).

Open: upper bra/briefs and foundation-frame agreement, body-contact surfaces, all-layer coverage, skin/morph/restPose/stage, relaxed worn geometry, physical cloth, material finish and motion.
