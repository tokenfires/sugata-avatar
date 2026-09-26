# Candidate v2 stop: independent Gesture-status review

September 26, 2026. Signed: `/root/critic`.

**Admit the narrow native-status comparison for the next source-frozen run with the same candidate pose and cap.** The failed v2 remains incomplete. This correction explains a status invariant; it does not qualify fit or appearance and changes no production or native threshold.

I independently read the hash-bound failing step 492 and accepted A's matching state. The candidate returns a Gesture contribution while A returns null. Timing, schedule, activation, phase, owner configuration and every owner's PRNG state agree. Native applied posture yields are 1 and 0.35 respectively. Recomputing the exported native envelope, amplitude response and yield in the exact native multiplication order gives:

| Trace | Shoulder radians | Native result |
| --- | ---: | --- |
| Accepted A | 0.00042053241671895046 | null |
| Candidate | 0.0012015211906255725 | contribution |

The unchanged native strict cutoff is `0.05 * (Math.PI / 180)`, or 0.0008726646259971648 radians. Both the shoulder and elbow degree telemetry reproduce exactly. Native Gesture writes that telemetry before its threshold return, so a null returned contribution can legitimately retain a small nonzero applied value. The failed report is `72533663f9f19b15a79114391f6559010fb4d35afdf1b71b603fc657a23bf02b`; its 493 partial states and explicit failing state remain evidence, not a 721-frame qualification.

Reviewed helper: `candidate-gesture-status.mjs`, SHA256 `a06be870a54dccdee5e858824acd3b4aac92b024e7b19a3bc70cd58a0829c8d8`. Reviewed selftest: `781ae3f478144eb249438c282ec0c3b0c580f39422564ce8504bde153c37b49d`. I independently ran all seven groups successfully. They include all 493 actual partial states, with only step 492 using an exception; false status and metadata/PRNG/source cases; next-double angle rejection; and real native update at adjacent representable timestamps straddling the cutoff. The below/above timestamps were 0.9666178816406292 and 0.9666178816406293 seconds.

The helper permits a difference only for Gesture and only when both observed decisions are independently reproduced by the exact source-bound active interval, envelope, yield, amplitude and radian threshold. It preserves raw/null observations and rejects filtered, disabled, malformed or fabricated records. All non-Gesture statuses, owner metadata, random states, schedules, clocks, live affect PAD and effective extent remain exact between traces. Native amplitude 1 is admitted and checked by the frozen A guard; the new ready receipt also reads and checks actual native Gesture configuration.

Equal statuses retain their existing admission rule and explicitly report `formulaChecked:false`. This is necessary because post-frame affect telemetry can be newer than the state Gesture sampled, as the retained prefix demonstrates. The helper does not falsely claim a full native equation reconstruction for those frames. If a later different status cannot be reproduced from the retained inputs, it must fail rather than widen the exception.

The controller integration invokes this comparator before morph admission, records the actual status differences, and removes only the duplicate blanket status equality check. The separate owner-specific morph policy, raw/effective equality, camera, topology, source, clock and cleanup gates remain in place. No threshold tolerance, pose change or extra gesture amplitude was introduced. Numerical, owner and rendered review of a completed native run is still required before any candidate acceptance.
