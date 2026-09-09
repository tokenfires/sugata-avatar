# HairDynamics contact factory

`createHairDynamics({renderer, geometry, contactFactory})` accepts an optional synchronous extension. This is a submission and ownership boundary; Avatar does not install a body-contact implementation yet. Omitting the option preserves the existing solver, bob02 path, raw compute export and diagnostic `submit: 'perkernel'` behavior. No hair asset, solver equation, uniform default or collider geometry changes here.

A factory receives a shallow-frozen private context:

```js
{
  renderer, groom,
  positionBuffer, velocityBuffer, restLengthBuffer,
  substepSeconds, maxSubstepsPerFrame
}
```

The three storage nodes and their attributes are **borrowed**. They do not become public solver fields. Positions and velocities are world-space; rest lengths are authored per-segment lengths. Use the supplied timestep and substep cap. The renderer, source geometry, body mesh and skeleton remain caller-owned; contact must not dispose them or any borrowed solver storage. Do not rewrite rest data or submit work from the factory.

The returned object must supply four synchronous methods:

```js
{
  prepare({substeps, reset}) { /* snapshot/refit/upload body once */ },
  nodesFor(substep) { return [/* owned Three ComputeNodes for this substep */]; },
  dispose() { /* release only contact-owned nodes/buffers */ },
  report() { return { /* synchronous, read-only diagnostics */ }; }
}
```

The solver binds these methods to the returned owner. `solver.contactReport()` forwards its report, returns `null` when contact is absent, and refuses a retired solver. Reports do not expose a supported route to submit kernels or mutate private buffers. `prepare` and `nodesFor` must not recursively update/reset the solver; their only work is preparing the contact owner's own state/nodes.

The caller updates body world matrices, skeleton and morph pose before `solver.update(deltaSeconds)`. Only frames with at least one solver substep invoke `prepare`, exactly once and before head substep matrices are filled. The first/reset frame still owes one placement step when delta is zero. Other zero-step frames neither prepare nor submit, so their body pose must not replace the last submitted pose history. `reset: true` tells the contact owner to collapse history and omit its velocity-finalization node; the solver does not infer which contact node is a velocity finalizer.

For two substeps the single renderer batch is:

```text
solve[0], ...contact.nodesFor(0), solve[1], ...contact.nodesFor(1), rebuild
```

Each returned array may be empty. Its entries must be real ComputeNodes; use distinct per-substep stages/caches and keep them owned by contact. There is exactly one final ribbon rebuild. Contact refuses the diagnostic per-kernel submission option. With contact enabled, `computeNodesFor()` throws an explicit “use update” error because the raw export cannot provide a fresh submitted-body history. The existing no-contact raw path is unchanged.

The optional factory must be a function and cannot be a declared async function; validation happens before groom derivation or solver allocation. Returned methods and values must also be synchronous. Promise/thenable results are errors. An invalid async extension remains responsible for anything it allocates after yielding: the synchronous solver cannot cancel that work.

Ownership transfers only when the factory returns an owner. A factory that fails before returning must release its own partial stages/shared resources in its own catch/finally. When an owner has been returned but validation fails, the solver calls its available disposer and releases all solver resources. Factory failure also releases the solver's five kernels and eight storage attributes. No-contact constructor behavior before this extension point is unchanged.

A preparation, node-selection or submission failure retires the contact-enabled solver; partially advanced body history must not be retried as though submission succeeded. Cleanup first retires the public handle, then attempts contact disposal, every solver kernel and every solver storage attribute even if another cleanup throws. A single cleanup error is rethrown; multiple errors use `AggregateError`. Construction/preparation failures preserve the original error together with cleanup failure. Repeated disposal does nothing, including after an error. Existing readback retirement checks are retained.

Three r185's `renderer._attributes?.delete(attribute)` remains the existing private compatibility dependency for owned GPU storage: ComputeNode disposal releases pipelines/bindings but does not delete the storage attribute's buffer and strong memory-map entry. No manager before initialization or after renderer teardown means there is no live manager-owned allocation to delete. Real deletion errors remain visible. A contact implementation must follow the same ownership rule for its own storage without deleting a shared surface buffer once per stage.

## Verification and limits

```sh
node packages/core/src/motion/HairDynamics.contact.selftest.mjs
node packages/core/src/motion/HairDynamics.contact.selftest.mjs --gpu
node packages/core/src/motion/HairDynamics.selftest.mjs --quick
node packages/core/src/motion/HairDynamics.disposal.selftest.mjs
```

The focused CPU cases exercise actual TSL node construction with a renderer spy: factory refusal/failure, reset and no-step history, head-fill ordering, one batch, returned node validation, disposal order, partial cleanup failures, retirement and pre-init/renderer-shutdown handling. The optional WebGPU cases use a synthetic contact owner that observes or shifts a single root. They verify each contact sees its own solved/interpolated pose, the final rebuild sees the final correction, observation preserves all baseline positions/velocities/vertices bit-for-bit, and contact plus solver resources return to baseline. The synthetic shift intentionally changes a pinned root only as an ordering witness; it is not a body-contact method.

These gates do not accept a contact calibration, body-surface algorithm, final hairstyle, full-body clearance, dynamic appearance or performance budget. Those require a separately implemented owner, actual calibrated bakes and whole-ribbon motion/render evidence. No body-contact modules are imported from ignored captures or tools, and Avatar activation is a separate integration step.
