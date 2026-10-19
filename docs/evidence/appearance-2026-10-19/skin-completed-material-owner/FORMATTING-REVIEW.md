# Frozen evidence formatting review

A: preserve the exact reviewed evidence with a filename/line/type-scoped documentary exception. This is not a source, proof or adoption logic exception.

The complete recorded staged check exits 2; the separate canonical/candidate/checkpoint check exits 0. My independent byte inspection confirms the exact findings:

- CANDIDATE.diff:6,14,16,19,21,25,28,64,66,70,85,88,93,98 contain the single-space unified-diff context prefix; :98 is also the terminal context blank. The complete saved diff still equals the original→adopted canonical diff exactly.
- ADOPTION-PLAN.md:14 is the extra terminal empty line in the exact reviewed 3,676-byte plan.
- PROOF-OUTPUT.txt:1–155 retain the unchanged CRLF endings from the collected TTY output: 4,683 bytes, SHA256 dff619e0…c302. These are raw evidence bytes, not new source whitespace.

The original two-file nomination and FORMATTING-ROOT-FIRST finding prose describe a narrower historical scope. The actual full output includes all three files; the final exception must name all three. Do not describe the full check as passing. Its diagnostics contain exactly these 171 findings and no other filename.

Canonical and candidate are byte-identical at the tested 803522f2… hash. Their actual text and both current checkpoint documents have no trailing horizontal whitespace or extra terminal blank lines. This mechanical inspection does not rerun or broaden the prior CPU qualification.

Alternative A preserves these exact artifact bytes and explicitly records the nonzero full check and narrow exception, maintaining raw-output identity, valid diff representation and all historical bindings. Alternative B normalizes whitespace in a new documentary epoch with retained originals and reviewed mappings; this improves a generic text check but changes bound evidence, destroys literal raw-output equality if substituted, and adds no behavioral value. I prefer A.

No frozen file was trimmed, no prior pair changed, and no target check/import/evaluation, proof, native/GPU work or commit occurred. No pending edits.
