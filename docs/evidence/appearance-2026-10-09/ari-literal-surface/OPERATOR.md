# Explicit four-boundary surface definition

This document defines the operation used by this proposed recipe. It claims no novelty, implementation of a named upstream method or equivalence to the earlier unowned source. The prior PDF inquiry remains closed. All statements below concern real vector algebra under the stated assumptions, not floating-point/mesh behavior or garment fit.

Let u,v∈[0,1]. L(v) and R(v) are respectively left and right boundary curves; B(u) and T(u) are bottom and top curves. All four are continuous vector-valued functions in the same world frame. Require exact shared corner identities:

```
P00 = L(0) = B(0)
P10 = R(0) = B(1)
P01 = L(1) = T(0)
P11 = R(1) = T(1)

Q(u,v) = (1-u)(1-v)P00 + u(1-v)P10
       + (1-u)vP01       + uvP11

S(u,v) = (1-u)L(v) + uR(v) + (1-v)B(u) + vT(u) - Q(u,v)
```

The two directional boundary blends count the corner blend twice, so the definition subtracts one copy. The formulas and operand orientations above are authoritative; no library/API or similarly named method supplies unspecified behavior.

## Boundary and corner proof for every parameter

At u=0:

```
Q(0,v) = (1-v)P00 + vP01
S(0,v) = L(v) + (1-v)B(0) + vT(0) - Q(0,v)
       = L(v)
```

At u=1:

```
Q(1,v) = (1-v)P10 + vP11
S(1,v) = R(v) + (1-v)B(1) + vT(1) - Q(1,v)
       = R(v)
```

At v=0:

```
Q(u,0) = (1-u)P00 + uP10
S(u,0) = (1-u)L(0) + uR(0) + B(u) - Q(u,0)
       = B(u)
```

At v=1:

```
Q(u,1) = (1-u)P01 + uP11
S(u,1) = (1-u)L(1) + uR(1) + T(u) - Q(u,1)
       = T(u)
```

Each equality follows by the four shared-corner identities, for every value of the remaining parameter. Consequently S(0,0)=P00, S(1,0)=P10, S(0,1)=P01 and S(1,1)=P11; either incident boundary gives the same corner. This is an all-parameter algebraic identity, not a finite sample test.

Continuous segmented rails are permitted when each adjoining segment has exactly the same endpoint and its interval/reparameterization is explicit. Such a rail is continuous at its knots; the sums/products above preserve continuity. No derivative/tangent/C1 continuity, injectivity, nonfolding or positive area follows. A corner mismatch or discontinuous segment invalidates the assumptions and refuses authoring/admission, rather than silently relaxing equality or fitting the boundary.

## Future implementation responsibilities

World rail owners, direction/reversal, all corner references and finite sample refinements must be separately literal and source-checked. A future constructor evaluates F64 interiors, uses one canonical stored boundary sample for every welded edge reference (with explicit boundary return rather than relying on cancellation roundoff), and casts final coordinates once under a fixed precision gate. That policy needs its own source/preflight and actual buffer/hash verification; this proof is not a floating-point implementation test. No controls, curve samples, arrays or mesh have been evaluated here.

An independently literal lining uses the same operator only with its own compatible rail/corner records. A main-rim bridge has separate parameter/orientation ownership; this operator does not supply thickness or lining separation. Full body/self/lining contacts, coverage, occupancy, winding, nonfolding, pose and appearance remain unqualified. All old refused geometry and scope limits stay preserved.

A: retain this literal rule and, only after independent proof review, author one fixed compatible shared-rail world recipe. More precise ownership, no automatic physical pass. B: use an explicitly ruled/raglan/independent asset recipe or hold architecture; different edge/style responsibilities and no guaranteed fit cure. Stop any missing corner/boundary identity before coordinates or constructor; no old harmonic/source-loop/normal/phase/ease/lighting rescue or additional source chain.
