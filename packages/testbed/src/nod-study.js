import { Avatar } from '../../core/src/Avatar.js';
import { AcknowledgmentNod } from '../../core/src/motion/AcknowledgmentNod.js';
import { AttentionAction } from '../../core/src/motion/AttentionAction.js';
import { optionsForShowcase } from './showcase-presets.mjs';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const canvas = document.querySelector('#stage'), status = document.querySelector('#status');
const buttons = [...document.querySelectorAll('button')];
let avatar, nod, attention, controls, frame = 0, previous = null, closed = false;
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
const trace = []; let clip = null, recording = null;
function controlsState() {
    const busy = nod?.phase !== 'idle';
    document.querySelector('#nod').disabled = !nod || paused || busy;
    document.querySelector('#cancel').disabled = !nod || !busy;
    document.querySelector('#pause').textContent = paused ? 'Resume motion' : 'Pause motion';
    document.querySelector('#pause').setAttribute('aria-pressed', String(paused));
    document.querySelector('#attention').disabled = !attention || paused;
    const text = paused ? 'Motion paused' : busy ? 'Gesture playing' : 'Ready for a deliberate nod';
    if (status.textContent !== text) status.textContent = text;
}
function dispose() {
    if (closed) return;
    closed = true; cancelAnimationFrame(frame);
    nod?.dispose(); attention?.dispose(); controls?.dispose(); avatar?.dispose();
    for (const b of buttons) b.disabled = true;
}
function fail(error) {
    dispose(); const box = document.querySelector('#error'); box.hidden = false;
    box.textContent = error?.message ?? String(error); status.textContent = 'Study unavailable';
}
function animate(time) {
    if (closed) return;
    const dt = previous === null ? 0 : Math.min((time - previous) / 1000, .05); previous = time;
    try {
        controls.update(); avatar.update(paused ? 0 : dt);
        if (clip) {
            // Finite real RAF trace. A stalled or very slow action fails the collector's timeout.
            trace.push({wallMs: performance.now(), motionTime: avatar.stack.time, ...nod.report()});
            if (trace.length > 360) throw new Error('Temporal trace exceeded its fixed frame cap.');
            if (performance.now() - clip.started >= 2200) { clip.completed = true; clip = null; }
        }
        controlsState(); frame = requestAnimationFrame(animate);
    } catch (error) { fail(error); }
}
addEventListener('pagehide', dispose);
addEventListener('error', e => fail(e.error ?? e.message));
addEventListener('unhandledrejection', e => fail(e.reason));
document.addEventListener('visibilitychange', () => { previous = null; });
try {
    const created = await Avatar.create({canvas, autoStart: false, ...optionsForShowcase({preset:'casual',outfit:'casual',style:'ecru',frame:'portrait',light:'neutral',scene:'studio'})});
    if (closed) created.dispose();
    else {
        avatar = created; nod = new AcknowledgmentNod(avatar); attention = new AttentionAction(avatar);
        controls = new OrbitControls(avatar.stage.camera, canvas);
        controls.target.copy(avatar.focus); controls.target.y += .045; avatar.stage.camera.position.y += .045;
        controls.enablePan = false; controls.enableDamping = false; controls.update();
        await avatar.step(0);
        if (closed) dispose();
        else {
            const r = avatar.report();
            if (!r.hair?.attached || !r.wardrobe?.attached) throw new Error('Wait for the complete clothed look.');
            document.querySelector('#nod').onclick = () => { nod.nod(); controlsState(); };
            document.querySelector('#cancel').onclick = () => { nod.cancel(); controlsState(); };
            document.querySelector('#pause').onclick = () => { paused = !paused; previous = null; controlsState(); };
            document.querySelector('#attention').onclick = () => { attention.lookAtCamera(avatar.stage.camera); controlsState(); };
            for (const b of buttons) b.disabled = false;
            window.nodStudy = {
                avatar, nod, attention, controls, trace,
                get closed() { return closed; },
                record() {
                    if (closed || paused || clip || nod.phase !== 'idle') throw new Error('The study is not ready for its single clip.');
                    if (trace.length) throw new Error('The first temporal record is already consumed.');
                    clip = {started: performance.now(), motionStart: avatar.stack.time, completed: false};
                    recording = clip;
                    const record = clip;
                    return {started: record.started, motionStart: record.motionStart};
                },
                get recording() { return recording ? {...recording} : null; },
                report() { return {nod: nod.report(), attention: attention.report(), paused, closed, recording: recording ? {...recording} : null,
                    trace: trace.slice(), avatar: avatar.report()}; },
                dispose
            };
            controlsState(); frame = requestAnimationFrame(animate);
        }
    }
} catch (error) { fail(error); }
