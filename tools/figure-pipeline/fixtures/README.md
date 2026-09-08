# Original bob02/g050 regression fixture

`bob02-g050-original.glb` is the unmodified original Blender-exported bob02/g050 groom.
It was preserved from `captures/hair-fall-2026-09-08/original-g050.glb` before the fall and
hem corrections. The capture directory is local evidence; this Git LFS fixture makes the
same original input available across clones.

- Size: 3,326,952 bytes.
- SHA256: `25376e139cd498bf2bdb36dfdc6df80cb8f5f4ec026ca033ca2dd1cae23913d4`.
- Exact LFS tracking rule: repository `.gitattributes`.

The default `hair_fall.selftest.mjs` transforms this original. The default
`hair_hem.selftest.mjs` first generates a temporary fall-stage output from it, then runs the
complete hem tests, including real tangent-channel transport. Temporary outputs are removed
when tests finish. Neither default test reads the mutable shipped hair asset, and both verify
the fixture hash. Explicit input arguments remain supported.

Keep this fixture unchanged. Fetch its Git LFS content after cloning; a pointer file will fail
the hash check. Later stages retain their own geometry calibration and idempotence checks.
