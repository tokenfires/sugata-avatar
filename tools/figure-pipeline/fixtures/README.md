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
