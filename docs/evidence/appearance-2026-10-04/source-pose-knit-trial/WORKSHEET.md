# First actual sweater topology refusal

The fixed artist volume constructs a sampled exterior, but its first manifold check refuses an edge shared by four quads. A manifold cloth surface allows at most two faces along an interior edge. No cut openings, smoothing, exported garment or candidate image follows.

The exact edge is [432,433], from world metres (−0.36,1.17,−2.7755575615628914e−17) to (−0.36,1.17,0.014999999999999986), length0.015000000000000013m. Actual incident face IDs are408,409,485,486. The edge lies in the new negative-X sleeve elbow region; no body asset, rig or fit defect is implied.

Four cells surround that edge in XY at k11:

| y cell / x cell | i15 | i16 |
| --- | --- | --- |
| j20 | Outside; saved field bits0 | Inside; negative-sleeve bits2 |
| j19 | Inside; negative-sleeve bits2 | Outside; saved field bits0 |

The two inside cells meet along the edge rather than a face. The boundary therefore has four incident quads there. Root independently rebuilds complete6624quad incidence and all grid-coordinate/face-adjacency records; all115200 stored field bits agree with19022 occupied cells. The complete sampled exterior has13228 edges with two faces and10 with four; the first witness is sufficient to reject it.

[Independent 60-digit witness](ROOT-FIELD-WITNESS.json) recomputes the four decisive negative-sleeve memberships from their saved binary64 centres and literal controls, without importing/rerunning the author. The two outside cells are beyond the first frustum's end and before the second frustum's start. This supports a concrete segment/cell responsibility problem; it does not measure physical drape or body clearance. Other source or whole-field predicates are not independently re-evaluated by that four-cell check.

[Complete original RAW](RAW.json), [author refusal](AUTHOR-JOB.json), [root full-record check](ROOT-OBSERVATION.json), [external process/log inventory](RUN-PROCESS.json) and [receipt](RECEIPT.md) preserve actual operands. This is readable failure evidence, not an accepted garment. Keep the original source reference and complete outfit concept. No grid, radius, cut, field or smoothing retune follows. A future geometry proposal needs a different explicitly connected surface representation and fresh independent worth/source review.
