## 3\. Aborting ongoing activities

Though promises do not have a built-in aborting mechanism, many APIs using them require abort
semantics. `AbortController` is meant to support these requirements by providing an
`abort()` method that toggles the state of a corresponding `AbortSignal` object.
The API which wishes to support aborting can accept an `AbortSignal` object, and use its state to
determine how to proceed.

APIs that rely upon `AbortController` are encouraged to respond to `abort()`
by rejecting any unsettled promise with the `AbortSignal`’s [abort reason](https://dom.spec.whatwg.org/#abortsignal-abort-reason).

A hypothetical `doAmazingness({ ... })` method could accept an `AbortSignal` object
to support aborting as follows:



```javascript
const controller = new AbortController();
const signal = controller.signal;

startSpinner();

doAmazingness({ ..., signal })
  .then(result => ...)
  .catch(err => {
    if (err.name == 'AbortError') return;
    showUserErrorMessage();
  })
  .then(() => stopSpinner());

// …

controller.abort();
```

`doAmazingness` could be implemented as follows:



```javascript
function doAmazingness({signal}) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();

    // Begin doing amazingness, and call resolve(result) when done.
    // But also, watch for signals:
    signal.addEventListener('abort', () => {
      // Stop doing amazingness, and:
      reject(signal.reason);
    });
  });
}
```

APIs that do not return promises can either react in an equivalent manner or opt to not surface
the `AbortSignal`’s [abort reason](https://dom.spec.whatwg.org/#abortsignal-abort-reason) at all. `addEventListener()` is an
example of an API where the latter made sense.

APIs that require more granular control could extend both `AbortController` and
`AbortSignal` objects according to their needs.

### 3.1. Interface `AbortController`

```
[Exposed=*]
interface AbortController {
  constructor();

  [SameObject] readonly attribute AbortSignal signal;

  undefined abort(optional any reason);
};
```

`controller = new AbortController()`Returns a new controller whose `signal` is set to a newly
 created `AbortSignal` object.


 `controller . signal`Returns the `AbortSignal` object associated with this object.


 `controller . abort(reason)`Invoking this method will store reason in this object’s `AbortSignal`’s
 [abort reason](https://dom.spec.whatwg.org/#abortsignal-abort-reason), and signal to any observers that the associated activity is to be
 aborted. If reason is undefined, then an "`AbortError`" `DOMException`
 will be stored.



An `AbortController` object has an associated signal (an
`AbortSignal` object).

The
`new AbortController()`
constructor steps are:

1. Let signal be a new `AbortSignal` object.



2. Set [this](https://webidl.spec.whatwg.org/#this)’s [signal](https://dom.spec.whatwg.org/#abortcontroller-signal) to signal.


The `signal` getter steps are to return
[this](https://webidl.spec.whatwg.org/#this)’s [signal](https://dom.spec.whatwg.org/#abortcontroller-signal).

The `abort(reason)` method steps are
to [signal abort](https://dom.spec.whatwg.org/#abortcontroller-signal-abort) on [this](https://webidl.spec.whatwg.org/#this) with reason if it is given.

To signal abort on an `AbortController`controller with an optional reason, [signal abort](https://dom.spec.whatwg.org/#abortsignal-signal-abort) on
controller’s [signal](https://dom.spec.whatwg.org/#abortcontroller-signal) with reason if it is given.

### 3.2. Interface `AbortSignal`

```
[Exposed=*]
interface AbortSignal : EventTarget {
  [NewObject] static AbortSignal abort(optional any reason);
  [Exposed=(Window,Worker), NewObject] static AbortSignal timeout([EnforceRange] unsigned long long milliseconds);
  [NewObject] static AbortSignal _any(sequence<AbortSignal> signals);

  readonly attribute boolean aborted;
  readonly attribute any reason;
  undefined throwIfAborted();

  attribute EventHandler onabort;
};
```

`AbortSignal . abort(reason)`Returns an `AbortSignal` instance whose [abort reason](https://dom.spec.whatwg.org/#abortsignal-abort-reason) is set to
 reason if not undefined; otherwise to an "`AbortError`" `DOMException`.


 `AbortSignal . any(signals)`Returns an `AbortSignal` instance which will be aborted once any of signals is
 aborted. Its [abort reason](https://dom.spec.whatwg.org/#abortsignal-abort-reason) will be set to whichever one of signals
 caused it to be aborted.


 `AbortSignal . timeout(milliseconds)`Returns an `AbortSignal` instance which will be aborted in milliseconds
 milliseconds. Its [abort reason](https://dom.spec.whatwg.org/#abortsignal-abort-reason) will be set to a
 "`TimeoutError`" `DOMException`.


 `signal . aborted`Returns true if signal’s `AbortController` has signaled to abort; otherwise false.


 `signal . reason`Returns signal’s [abort reason](https://dom.spec.whatwg.org/#abortsignal-abort-reason).


 `signal . throwIfAborted()`Throws signal’s [abort reason](https://dom.spec.whatwg.org/#abortsignal-abort-reason), if signal’s
 `AbortController` has signaled to abort; otherwise, does nothing.



An `AbortSignal` object has an associated abort reason (a
JavaScript value), which is initially undefined.

An `AbortSignal` object has associated abort algorithms, (a
[set](https://infra.spec.whatwg.org/#ordered-set) of algorithms which are to be executed when it is [aborted](https://dom.spec.whatwg.org/#abortsignal-aborted)),
which is initially empty.

The [abort algorithms](https://dom.spec.whatwg.org/#abortsignal-abort-algorithms) enable APIs with complex
requirements to react in a reasonable way to `abort()`. For example, a given API’s
[abort reason](https://dom.spec.whatwg.org/#abortsignal-abort-reason) might need to be propagated to a cross-thread environment, such as a
service worker.

An `AbortSignal` object has a dependent (a boolean), which is
initially false.

An `AbortSignal` object has associated source signals (a weak
[set](https://infra.spec.whatwg.org/#ordered-set) of `AbortSignal` objects that the object is dependent on for its
[aborted](https://dom.spec.whatwg.org/#abortsignal-aborted) state), which is initially empty.

An `AbortSignal` object has associated dependent signals (a weak
[set](https://infra.spec.whatwg.org/#ordered-set) of `AbortSignal` objects that are dependent on the object for their
[aborted](https://dom.spec.whatwg.org/#abortsignal-aborted) state), which is initially empty.

* * *

The static `abort(reason)` method steps
are:

1. Let signal be a new `AbortSignal` object.



2. Set signal’s [abort reason](https://dom.spec.whatwg.org/#abortsignal-abort-reason) to reason if it is given;
    otherwise to a new "`AbortError`" `DOMException`.



3. Return signal.



The static `timeout(milliseconds)` method
steps are:

1. Let signal be a new `AbortSignal` object.



2. Let global be signal’s [relevant global object](https://html.spec.whatwg.org/multipage/webappapis.html#concept-relevant-global).



3. [Run steps after a timeout](https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#run-steps-after-a-timeout) given global, "`AbortSignal-timeout`",
    milliseconds, and the following step:




1. [Queue a global task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-global-task) on the [timer task source](https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#timer-task-source) given global to
       [signal abort](https://dom.spec.whatwg.org/#abortsignal-signal-abort) given signal and a new
       "`TimeoutError`" `DOMException`.



For the duration of this timeout, if signal has any event listeners registered for
its `abort` event, there must be a strong reference from global to
signal.



4. Return signal.


The static `any(signals)` method
steps are to return the result of [creating a dependent abort signal](https://dom.spec.whatwg.org/#create-a-dependent-abort-signal) from signals
using `AbortSignal` and the [current realm](https://tc39.es/ecma262/#current-realm).

The `aborted` getter steps are to return true if [this](https://webidl.spec.whatwg.org/#this)
is [aborted](https://dom.spec.whatwg.org/#abortsignal-aborted); otherwise false.

The `reason` getter steps are to return [this](https://webidl.spec.whatwg.org/#this)’s
[abort reason](https://dom.spec.whatwg.org/#abortsignal-abort-reason).

The `throwIfAborted()` method steps are to throw [this](https://webidl.spec.whatwg.org/#this)’s
[abort reason](https://dom.spec.whatwg.org/#abortsignal-abort-reason), if [this](https://webidl.spec.whatwg.org/#this) is [aborted](https://dom.spec.whatwg.org/#abortsignal-aborted).

This method is primarily useful for when functions accepting `AbortSignal`s want to throw (or
return a rejected promise) at specific checkpoints, instead of passing along the `AbortSignal`
to other methods. For example, the following function allows aborting in between each attempt to
poll for a condition. This gives opportunities to abort the polling process, even though the
actual asynchronous operation (i.e., `await func()`) does not
accept an `AbortSignal`.



```javascript
async function waitForCondition(func, targetValue, { signal } = {}) {
  while (true) {
    signal?.throwIfAborted();

    const result = await func();
    if (result === targetValue) {
      return;
    }
  }
}
```

The `onabort` attribute is an
[event handler IDL attribute](https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-idl-attributes) for the `onabort` [event handler](https://html.spec.whatwg.org/multipage/webappapis.html#event-handlers), whose [event handler event type](https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-event-type) is
`abort`.

Changes to an `AbortSignal` object represent the wishes of the corresponding
`AbortController` object, but an API observing the `AbortSignal` object can choose to ignore
them. For instance, if the operation has already completed.

* * *

An `AbortSignal` object is aborted when its
[abort reason](https://dom.spec.whatwg.org/#abortsignal-abort-reason) is not undefined.

To add an algorithm algorithm to an `AbortSignal`
object signal:

1. If signal is [aborted](https://dom.spec.whatwg.org/#abortsignal-aborted), then return.



2. [Append](https://infra.spec.whatwg.org/#set-append) algorithm to signal’s
    [abort algorithms](https://dom.spec.whatwg.org/#abortsignal-abort-algorithms).


To remove an algorithm algorithm from an
`AbortSignal`signal, [remove](https://infra.spec.whatwg.org/#list-remove) algorithm from
signal’s [abort algorithms](https://dom.spec.whatwg.org/#abortsignal-abort-algorithms).

To signal abort, given an `AbortSignal` object signal and
an optional reason:

1. If signal is [aborted](https://dom.spec.whatwg.org/#abortsignal-aborted), then return.



2. Set signal’s [abort reason](https://dom.spec.whatwg.org/#abortsignal-abort-reason) to reason if it is given;
    otherwise to a new "`AbortError`" `DOMException`.



3. Let dependentSignalsToAbort be a new [list](https://infra.spec.whatwg.org/#list).



4. [For each](https://infra.spec.whatwg.org/#list-iterate) dependentSignal of signal’s
    [dependent signals](https://dom.spec.whatwg.org/#abortsignal-dependent-signals):


1. If dependentSignal is not [aborted](https://dom.spec.whatwg.org/#abortsignal-aborted):


      1. Set dependentSignal’s [abort reason](https://dom.spec.whatwg.org/#abortsignal-abort-reason) to signal’s
          [abort reason](https://dom.spec.whatwg.org/#abortsignal-abort-reason).



      2. [Append](https://infra.spec.whatwg.org/#list-append) dependentSignal to
          dependentSignalsToAbort.
5. [Run the abort steps](https://dom.spec.whatwg.org/#run-the-abort-steps) for signal.



6. [For each](https://infra.spec.whatwg.org/#list-iterate) dependentSignal of dependentSignalsToAbort,
    [run the abort steps](https://dom.spec.whatwg.org/#run-the-abort-steps) for dependentSignal.


To run the abort steps for an `AbortSignal`signal:

1. [For each](https://infra.spec.whatwg.org/#list-iterate) algorithm of signal’s
    [abort algorithms](https://dom.spec.whatwg.org/#abortsignal-abort-algorithms): run algorithm.



2. [Empty](https://infra.spec.whatwg.org/#list-empty) signal’s [abort algorithms](https://dom.spec.whatwg.org/#abortsignal-abort-algorithms).



3. [Fire an event](https://dom.spec.whatwg.org/#concept-event-fire) named `abort` at signal.


To create a dependent abort signal from a list of `AbortSignal` objects
signals, using signalInterface, which must be either `AbortSignal` or an
interface that inherits from it, and a realm:

1. Let resultSignal be a [new](https://webidl.spec.whatwg.org/#new) object implementing
    signalInterface using realm.



2. [For each](https://infra.spec.whatwg.org/#list-iterate) signal of signals: if signal is
    [aborted](https://dom.spec.whatwg.org/#abortsignal-aborted), then set resultSignal’s [abort reason](https://dom.spec.whatwg.org/#abortsignal-abort-reason) to
    signal’s [abort reason](https://dom.spec.whatwg.org/#abortsignal-abort-reason) and return resultSignal.



3. Set resultSignal’s [dependent](https://dom.spec.whatwg.org/#abortsignal-dependent) to true.



4. [For each](https://infra.spec.whatwg.org/#list-iterate) signal of signals:


1. If signal’s [dependent](https://dom.spec.whatwg.org/#abortsignal-dependent) is false:


      1. [Append](https://infra.spec.whatwg.org/#set-append) signal to resultSignal’s
          [source signals](https://dom.spec.whatwg.org/#abortsignal-source-signals).



      2. [Append](https://infra.spec.whatwg.org/#set-append) resultSignal to signal’s
          [dependent signals](https://dom.spec.whatwg.org/#abortsignal-dependent-signals).
2. Otherwise, [for each](https://infra.spec.whatwg.org/#list-iterate) sourceSignal of signal’s
       [source signals](https://dom.spec.whatwg.org/#abortsignal-source-signals):


      1. Assert: sourceSignal is not [aborted](https://dom.spec.whatwg.org/#abortsignal-aborted) and not
          [dependent](https://dom.spec.whatwg.org/#abortsignal-dependent).



      2. [Append](https://infra.spec.whatwg.org/#set-append) sourceSignal to resultSignal’s
          [source signals](https://dom.spec.whatwg.org/#abortsignal-source-signals).



      3. [Append](https://infra.spec.whatwg.org/#set-append) resultSignal to sourceSignal’s
          [dependent signals](https://dom.spec.whatwg.org/#abortsignal-dependent-signals).
5. Return resultSignal.


#### 3.2.1. Garbage collection

A non- [aborted](https://dom.spec.whatwg.org/#abortsignal-aborted) [dependent](https://dom.spec.whatwg.org/#abortsignal-dependent)`AbortSignal` object must not be
garbage collected while its [source signals](https://dom.spec.whatwg.org/#abortsignal-source-signals) is non-empty and it has registered event
listeners for its `abort` event or its [abort algorithms](https://dom.spec.whatwg.org/#abortsignal-abort-algorithms) is non-empty.

### 3.3. Using `AbortController` and `AbortSignal` objects in APIs

Any web platform API using promises to represent operations that can be aborted must adhere to
the following:

- Accept `AbortSignal` objects through a `signal` dictionary member.


- Convey that the operation got aborted by rejecting the promise with `AbortSignal` object’s
   [abort reason](https://dom.spec.whatwg.org/#abortsignal-abort-reason).


- Reject immediately if the `AbortSignal` is already [aborted](https://dom.spec.whatwg.org/#abortsignal-aborted), otherwise:


- Use the [abort algorithms](https://dom.spec.whatwg.org/#abortsignal-abort-algorithms) mechanism to observe changes to the `AbortSignal`
   object and do so in a manner that does not lead to clashes with other observers.



The method steps for a promise-returning method `doAmazingness(options)`
could be as follows:



1. Let global be [this](https://webidl.spec.whatwg.org/#this)’s [relevant global object](https://html.spec.whatwg.org/multipage/webappapis.html#concept-relevant-global).



2. Let p be [a new promise](https://webidl.spec.whatwg.org/#a-new-promise).



3. If options\["`signal`"\] [exists](https://infra.spec.whatwg.org/#map-exists):


1. Let signal be options\["`signal`"\].



2. If signal is [aborted](https://dom.spec.whatwg.org/#abortsignal-aborted), then [reject](https://webidl.spec.whatwg.org/#reject) p with signal’s
       [abort reason](https://dom.spec.whatwg.org/#abortsignal-abort-reason) and return p.



3. [Add the following abort steps](https://dom.spec.whatwg.org/#abortsignal-add) to signal:


      1. Stop doing amazing things.



      2. [Reject](https://webidl.spec.whatwg.org/#reject) p with signal’s [abort reason](https://dom.spec.whatwg.org/#abortsignal-abort-reason).
4. Run these steps [in parallel](https://html.spec.whatwg.org/multipage/infrastructure.html#in-parallel):


1. Let amazingResult be the result of doing some amazing things.



2. [Queue a global task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-global-task) on the amazing task source given global to [resolve](https://webidl.spec.whatwg.org/#resolve) p
       with amazingResult.
5. Return p.



APIs not using promises should still adhere to the above as much as possible.

