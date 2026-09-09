# Original bob02/g050 regression fixture

`bob02-g050-original.glb` is the unmodified original Blender-exported bob02/g050 groom.
It was preserved from `captures/hair-fall-2026-09-08/original-g050.glb` before the fall, hem and
tail corrections. The capture directory is local evidence; this Git LFS fixture makes the
same original input available across clones.

- Size: 3,326,952 bytes.
- SHA256: `25376e139cd498bf2bdb36dfdc6df80cb8f5f4ec026ca033ca2dd1cae23913d4`.
- Exact LFS tracking rule: repository `.gitattributes`.

The default `hair_fall.selftest.mjs` transforms this original. The default
`hair_hem.selftest.mjs` first generates a temporary fall-stage output from it, then runs the
complete hem tests, including real tangent-channel transport. The default
`hair_tail_release.selftest.mjs` generates both fall and hem outputs before testing the calibrated
twelve-card tail clearance stage, including a real tangent channel through all three transforms.
Temporary outputs are removed when tests finish. No default test reads the mutable shipped hair
asset or ignored motion captures, and all three verify the fixture hash. The fall and hem selftests
also accept explicit input arguments.

Keep this fixture unchanged. Fetch its Git LFS content after cloning; a pointer file will fail
the hash check. Later stages retain their own geometry calibration and idempotence checks.

## Original bob01/g050 and long-fall calibration

`bob01-g050-original.glb` is the immutable original long-bob export copied from
`captures/long-bob-2026-09-08/originals/g050.glb`. It is separately tracked by Git LFS so replacing
an installed groom cannot change the default regression input.

- Size: 3,326,956 bytes.
- SHA256: `98ca6c23b9e0431b36437f386a39b961f1d4e296d58a5cab7cb519044caaea9c`.
- Body: exact authored figure_g050, SHA256
  `b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14`.

`bob01-g050-long-fall-v1.json` preserves the previous v9 plus card101 connector calibration.
The active `bob01-g050-long-fall-v2.json` extends it with the measured card80/423 side-fall revision:
their authored lower paths crossed the front of the throat despite clearing the body shell.
It records source experiment hashes and exact intermediate/final geometry and payload fingerprints.
`hair_long_fall.mjs` pins the active JSON's bytes. Default tests rebuild from the original fixture,
check the wrong-side-tip counterfactual and anchored prefixes, and verify exact payload reproduction,
protected attributes, shell rejection, the remaining strict root-layer failure, deterministic and
idempotent output, tamper rejection and atomic ownership. They do not need ignored captures.

Keep the original fixture and both reviewed calibration records immutable. Another body bake,
export, added attribute or shape revision requires a separate measured calibration. The active
candidate leaves rear-tip review, static card68 crossings and posed root-layer/motion acceptance
pending. Neither the tool nor its tests installs an asset.
