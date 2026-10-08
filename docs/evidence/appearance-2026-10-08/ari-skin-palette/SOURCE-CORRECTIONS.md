# Before the sole palette attempt

Critic found the inherited render-domain functions need global math.isfinite, while palette.py initially did not import math. Root adds the stdlib import before execution (alternative explicit renderer namespace is unnecessary machinery). No native failure occurred.

Root also adds actual native guards for fixed Float32 multiplier, MULTIPLY/Fac1/clamp state, exact two owned RGB links, five-node count and unlinked parameter inputs. Full observed clone is persisted before those gates, rather than relying only on setter statements or warm-state self equality. Original material link comparison canonicalizes link multisets; raw snapshots still retain the actual route records. No palette/geometry/texture/threshold variant or native attempt.

Actual native DATA-slot/material/polygon-index routing is now guarded and retained in BEFORE; unchanged polygon indices plus declared cloned material are required throughout. Actual evaluated/render-domain skin slot and every polygon index are observed before saving and after fresh opening, rather than inferring evaluated material ownership from object slot names alone. No new palette/geometry or native attempt.
