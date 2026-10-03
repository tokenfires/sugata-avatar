# Qualified symbolic cell-fan contract

[topology.json](topology.json) names 8,091 point evaluations and 16,000 oriented cell-owned fan faces. It contains no positions or native geometry. [Plan](PLAN.md), [root decision](ROOT-DECISION.md), [independent critic](CRITIC-POSTFLIGHT.md) and [exact receipt](RECEIPT.md) explain the qualification and its limits.

The graph passes complete ownership, unique-face, edge-incidence, connectivity, boundary and vertex-link checks. A separate evaluator must consume these exact definitions and faces and the unchanged canonical interface, evaluate each record once and retain one Float32 result per index. Finite areas, normals, self/body contact, actual attachment and rendered appearance remain untested. No candidate or default asset is promoted.
