# Preview lifetime owner

`tools/artist-preview-lifetime.mjs` is a small terminal owner for future artist previews. The actual module passed one targeted Node 26.9.0 run of 24 deterministic scenarios. Existing viewers have not adopted it, and browser, Three.js, GPU and physical resource release remain unqualified.

Import `createPreviewLifetime` and `PreviewClosedError` from the module using the relative path appropriate to the new caller. Create one owner per preview. Its default lifetime capacity is 64 distinct resource identities; an explicit integer limit may be 1–64. Releasing a resource does not reclaim a capacity slot or permit its identity to be registered again.

## Protocol

- `waitData(promiseOrValue)` observes data settlement and checks closure afterward. It also consumes supplied rejections when called after closure. It cannot cancel an arbitrary promise or force pending input to settle. Route every later allocation and publication through the same owner.
- `create(syncFactory, syncDisposer, label)` invokes a factory only while open, registers its new object or function, and attempts release once. If the factory reenters `close`, its completed object is released and is never returned to the caller. A factory's private partial allocation before it throws remains the factory's responsibility.
- `publish(syncCallback)` checks closure before calling and before returning. Callback effects already started cannot be undone; external registration, DOM attachment or scene mutation needs a separately designed removal/rollback contract.
- `checkpoint()` refuses further work after closure. A same-realm `parentSignal` closes the owner on normal abort notification; an already aborted parent starts closed.
- `release(value)` attempts a known resource once and propagates its actual disposer error, including `undefined`. Unknown, repeated and during-close releases return false.
- `close(reason)` commits irreversible closure before callbacks, removes its exact parent listener, signals its own abort, and attempts remaining releases in reverse registration order. It records failures and continues. Repeated calls preserve the first reason and perform no new release attempts.
- `inspect()` returns copied, frozen state and failure entries. `pendingReleases: 0` means every registered release was attempted; it does not mean the underlying resources were physically freed. Check `failures` and `parentDetach` explicitly.

Callbacks are trusted and synchronous. Data promises are separate from resource factories. Native Promise resource results are refused; arbitrary thenables, asynchronous disposal, hostile signal replacement, foreign-realm signals and hidden allocations are outside this contract. The bounded identity map retains resource references until the owner itself becomes unreachable. These limits matter before a future real client is admitted.

## Illustrative future caller

This example is documentation, not an installed or executed client. `loadData`, `makeResource`, `attach` and their resource-removal responsibilities must be designed and qualified for that client.

```js
async function preparePreview({ loadData, makeResource, attach, parentSignal }) {
    const owner = createPreviewLifetime({ parentSignal });
    try {
        owner.checkpoint();
        const data = await owner.waitData(loadData(owner.signal));
        const resource = owner.create(
            () => makeResource(data),
            value => value.dispose(),
            'preview-resource'
        );
        owner.publish(() => attach(resource));
        return owner;
    } catch (error) {
        owner.close(error);
        throw error;
    }
}
```

The host must retain the owner and call `close` when the preview ends. A cancellation signal helps only when the receiving API observes it. The [DOM Standard's abort section](https://dom.spec.whatwg.org/#aborting-ongoing-activities) informed this distinction; it does not prescribe or certify this custom ownership API. The exact retrieved section and research receipt are retained beside this guide.

## Qualification and recovery

The sole actual job is `0e78c7`, exit 0, PID 20841, October 19 at 17:52:30.374 UTC. [PROOF-REPORT.json](PROOF-REPORT.json) retains all 24 actual external traces; [PROOF-TOOL.json](PROOF-TOOL.json) and [PROOF-STDOUT.txt](PROOF-STDOUT.txt) retain the tool status and unchanged returned text. Tests import the actual shared implementation and assert error identities before recording each completed case. Object identities themselves are not serialized in the report.

Measured post-import time was 2.693792 ms and sampled RSS was 45,973,504 bytes. These are local samples, not startup, peak-memory, performance or physical-cleanup certification. No test rerun, browser capture, client adoption or closed trouser-source repair belongs to this packet. A future consumer needs its own complete source and actual integration qualification.
