# Exact query-input cache regression

Run the portable stage checks and the existing Avatar integration gate:

```sh
node packages/core/src/motion/HairSurface.cache.selftest.mjs
node packages/core/src/motion/HairSurface.cache.selftest.mjs --gpu --report=/tmp/hair-query-cache.json
node packages/core/src/Avatar.hair-contact.gpu.selftest.mjs --report=/tmp/avatar-hair-cache.json
```

The cache is an optional stage feature, `cacheQueryInputs: false` by default. The calibrated body-contact owner enables it. An enabled stage requires every submitted batch to begin with `snapshotNode`; its surface, interpolation alpha and contact metadata must stay fixed throughout that batch. Snapshot invalidates all cached inputs. This preserves the default direct `queryNode` path and prevents results from one body pose or batch leaking into another.

The first metadata block remains unchanged. Two extra vec4 blocks per contact store previous A/valid and previous B/reused in the existing metadata binding, retaining eight query bindings and six stage-owned buffers. A point query compares B's Float32 bits; a segment compares A and B. A hit retains the plane, parameter, nearest triangle ID and active bit. It reports zero actual triangle/node traversals and sets an explicit reuse flag. A reused inactive query is therefore distinct from a fresh root-bound rejection.

The portable gate requires this public contract explicitly. It cannot pass against an older stage that silently ignores the option. Four CPU groups cover option validation, metadata preservation, buffer/binding counts, default-off behavior, immutable fixture provenance and idempotent disposal before renderer initialization.

Four WebGPU groups include eleven generated input/invalidation cases and a default-off query before any snapshot. They verify exact repeats, point-B-only reuse, a one-ULP change, actual positive/negative-zero bits, both snapshot invalidation write ranges, and changed body pose or interpolation alpha with identical query points. Cache-off and cache-on must produce identical collision results, and the changed-pose controls must actually change their planes.

The compressed fixture retains two fixed all-496-chain inputs (`v6-0420` and `adaptive-live-0720`) plus independent pre-cache output hashes at 16 and 64 passes. Both modes must match those saved hashes for centers, velocities, planes, parameters and nearest-ID/active; matching each other alone is insufficient. Traversal counts intentionally differ and are checked against the reuse flag. The stage gate does not duplicate ribbon-rebuild math: the existing Avatar test separately verifies actual rebuilt vertices, native root transforms, scale refusal and resource ownership.

The fixture is **630,216 bytes**, SHA-256 `ed0114b9edf108e8af67a4e4e7f47575743ba823c7635b70d05efd2b2a379109`. It preserves groom offsets as Float64 before the existing CPU radius calculation, and preserves the consumed Float32/Uint32 GPU inputs. Quantizing those offsets first would change the input contract. No ignored captures or scratch module is imported by the portable test. Goldens must not be regenerated automatically from a changed implementation.

The first promoted-source run passed **eight portable groups and eight Avatar integration groups**. Stage `6fca962e` and owner `fd0b5284` retained exact canonical nod output and the same-renderer 35/8/0 buffer transitions. Fully exercised contact uses 35 storage buffers, 7,008,144 bytes and 21 solver/contact compute pipelines. Off/disposal and retirement during 14 pending geometry digests return resources to baseline. Browser errors were empty and imported source hashes remained stable. These runs precede the separate g025 registry activation.

See the [compact regression evidence](evidence/hair-surface-cache-2026-09-09.json) and the separate [720-frame cost and physical-parity evidence](evidence/hair-body-contact-input-cache-2026-09-09.json). Full regression reports and verified source snapshots are under ignored `captures/query-input-cache-portable-2026-09-09/`. This regression makes no timing, all-body clearance, all-bake clearance or appearance claim.
