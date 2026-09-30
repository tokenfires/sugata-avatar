# V2 group-definition restoration failure

V2 PID 39248 / exec 6943 ran 22:04:44.681540–22:04:55.466115 UTC and exited 1. Intended domain emission was archived before reconstruction, including all 204 original group names, indices and full per-vertex weight rows. Assigning the new mesh cleared the group collection; the previous loop over existing groups was vacuously true. Restoring the first weight then raised index 4 out of range, size 0. No completed domain band or final fit result exists from V2.

Root selects explicit restoration of every original group definition in its original order before restoring weights. V3 records the collection after mesh assignment, admits only empty or exactly matching definitions, recreates the empty collection, and requires exact name/index equality before any weight addition. Full stored per-vertex weight equality remains required afterward. This repairs reconstruction bookkeeping; domain emission, interpolation, boundary, geometry and qualification contracts are unchanged.

An alternative is to rebuild the geometry in the existing mesh datablock, retaining the group collection automatically. That changes more reconstruction mechanics and requires fresh proofs of topology, attribute removal and corner indexing. The saved-data restoration is smaller and directly checked.

V2 remains failed. V3 uses a fresh output root and retains both earlier failures. Its outcome is not inferred from this source repair.
