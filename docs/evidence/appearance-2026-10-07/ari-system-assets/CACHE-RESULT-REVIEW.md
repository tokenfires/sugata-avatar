# Independent cache result: metadata pass; dependency inquiry worth doing

Reviewed at 2026-10-08T00:47:54.641171+00:00. The sole recorded cache copy completed exit0/no timeout, worker83683/wrapper83682,00:45:26.415077–00:45:26.601521UTC. CACHE records280737770 bytes and SHA256 b542127a8e25547c7c29c19f2d1d2adb9a664c80396ecd694095dbc8028a0107. CACHE-WRAPPER/PLAN argv and start/result PIDs/times agree. Planned source metadata, CACHE.source_before and source_after match exactly in size+mtime; worker elapsed0.1246555 seconds. Root full preflight read00:45:26.358840 preceded launch. No network transfer, extraction or native invocation belongs to this operation.

I independently read complete stored cache/job/start/root-readback records and programmatically checked every one of the517 stored manifest member records for normalized path uniqueness/safety, regular/directory/omitted modes, directory-name agreement and file/parent conflicts. Sums match298739872 declared uncompressed bytes; all counts/digest/required_matches agree with CACHE. Manifest stores compression types0/8 and CRC fields, not a CRC-content test. Encryption flags are checked by the bound source before success but not separately stored in the manifest, so this is no critic raw-ZIP flag audit. I did not open/read/stat/hash either archive or any archive member.

Exact required member witnesses are unique non-directory entries:

- eyes/high-poly/high-poly.mhclo,72490 declared bytes.
- teeth/teeth_base/teeth_base.mhclo,263220.
- tongue/tongue01/tongue01.mhclo,2113.
- eyebrows/eyebrow001/eyebrow001.mhclo,9141.
- eyelashes/eyelashes01/eyelashes01.mhclo,2265.

These resolve the five named pack-member metadata gaps without changing the selected installed data roots. They do not qualify the MHClO contents, referenced geometry/material/texture/weights or complete native authoring source. No LICENSE/README member appears in the stored member list; this does not itself contradict the actual publisher table's five CC0 rows, and it does not replace per-asset header/license examination. Root's ROOT-CACHE-RESULT records independently hashing source and owned copy to the same streamed digest; I verified that record's association, not the archive hashes myself. Original source opens only rb in preserved source; size/mtime equality alone is not universal byte preservation proof, though root's separate two-file digest check supplies acquired-byte equality. Cached origin remains explicit; current-server-byte identity is false/unverified.

The next bounded textual dependency inquiry is worth doing: it can decide whether this exact cached candidate is complete and license-consistent for the five face owners before extraction/use. The present witness is five unique MHClO names plus uninspected contents and no top-level license/readme. A: read only the five MHClO headers/directives, follow their OBJ/material/weights references, MHMat texture/blend-material references and OBJ mtllib references against the exact pinned member list; cap50 textual members/10MB, preserve exact selected text identities, stop on unknown/missing/ambiguous references or conflicting license headers. This gives a concrete closure decision without geometry decode/extraction/native work, at the cost of bounded member decompression/text inspection. B: hold this candidate and request an explicitly complete approved canonical face-input/dependency/license set; avoids member-content inquiry but needs a source-owner selection and delays usable native source. Prefer A after root writes/verifies an exact textual reader/plan; this review admits worth, not an unreviewed content reader or extraction.

Admitted result is local-cache copy and ZIP central-directory metadata only. No API/body/rig/geometry/fit/expression/appearance acceptance follows. Official page CC0 rows are retained publisher evidence; all later dependencies and complete body/helper/auxiliary/rest-bind/rig/export duties remain separate obligations. No source/result discrepancy found, and no rerun is needed. Preserve earlier preflights and original/runtime/frozen assets. Candidate remains ignored/local; no Git or off-machine archive backup is claimed.

Exact reviewed stored text bindings:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| CACHE-PLAN.json | 1843 | f45c3bae6f3741a837bc70c9bbd3dbc0df43301e339d87388ce99ccf13c510ca |
| cache_acquire.py | 5548 | 0d8e1b3f34b9bef6fa0a2b63010b478477cfcf87c94cc9c8b6fc42b3e0bcc654 |
| CACHE-PREFLIGHT.md | 5305 | d853cf34fe56b3543f64280585f8e0c9e8b59262aafdad48f41f2455495883e2 |
| ROOT-CACHE-PREFLIGHT.json | 448 | 4a3f39ed593e434533a17e3326a99e61bcd8e60f17d96e3813e5ffd811c58031 |
| CACHE-start.json | 535 | 9e0f938cb116512db45892cb370038a055fb70a79ff39f15f7568f724481123b |
| CACHE-WRAPPER-start.json | 272 | 01d5dc0bb5574f31a0fd02c9301121468d7e568324ebd34d933ea99ea653a2b1 |
| CACHE.json | 1405 | 671348ff9a9e0d7c69545e0825d4cf48c0f71421905be7752231f550f892dc17 |
| CACHE-WRAPPER.json | 361 | b7c9b69b80a190451df630c17e7af4a65539e1d30aa1ec34c67a25487905a99c |
| ZIP-MANIFEST.json | 106320 | c55bcea4d98ee45d3ea9a9ba67a80a60bbec201e3c18abbd75c9b8b05aafde8a |
| ROOT-CACHE-RESULT.json | 395 | afe483b1499999301926a4bd1678abfeb993f5da16971db29b873ad24f793e88 |
