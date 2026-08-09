/**
 * The one frame clock every capture page shares.
 *
 * ## Why this module exists rather than a function in `stage.js`
 *
 * `docs/OPEN-REQUESTS.md` REQ-023 asked for `scheduleTask` to be exported from
 * `packages/testbed/src/stage.js` and the two copies of it deleted. The intent was right and the
 * address was not: `stage.js` calls `main()` at module scope, so importing it to reach one utility
 * boots the whole G-buffer browsercheck inside whichever page did the importing. The request is
 * therefore resolved by moving the clock down a level instead of up — `stage.js`, `lighting.js`
 * and `fabric.js` all import it from here, and there is exactly one copy.
 *
 * ## What it is
 *
 * A macrotask that a hidden page does not throttle.
 *
 * Measured in this pane: `setTimeout(fn, 0)` yields **8 callbacks per second** when the document
 * is hidden, which turns a 2,520-frame cost sweep into five hours. The same loop over a
 * `MessageChannel` measured **553,921 per second**. A microtask (`Promise.resolve()`) is not an
 * option — it never returns to the event loop, so the GPU readbacks and timestamp resolves a
 * sweep depends on would never settle.
 *
 * 🚩 Three copies of a frame clock is how two pages come to render at different rates and nobody
 * notices until a plate disagrees with itself. That is the whole reason this file is not fifteen
 * lines pasted into each page for a fourth time.
 */

const taskChannel = new MessageChannel();
const taskQueue = [];

taskChannel.port1.onmessage = () => {

    const task = taskQueue.shift();
    if ( task !== undefined ) task();

};

/** Runs `task` on the next macrotask, at full speed whether or not the page is visible. */
export function scheduleTask( task ) {

    taskQueue.push( task );
    taskChannel.port2.postMessage( 0 );

}
