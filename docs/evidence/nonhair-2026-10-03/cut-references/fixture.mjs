// HTML-only fixture. Declared cut state and canonical event spy; no Avatar import.
import { mountCutReferences } from './showcase-cut-references.mjs';
import './showcase-cut-references.css';
const fieldset = document.getElementById('hair-cut-controls');
const refs = mountCutReferences(fieldset, [
    {cut: 'bob02', src: '/src/cut-references/chin-length.png'},
    {cut: 'bob01', src: '/src/cut-references/long.png'}
]);
let cut = 'bob02';
const events = [];
function update(next) {
    cut = next;
    for (const button of fieldset.querySelectorAll('[data-cut]'))
        button.setAttribute('aria-pressed', String(button.dataset.cut === cut));
    refs.update(cut);
}
for (const button of fieldset.querySelectorAll('[data-cut]'))
    button.addEventListener('click', event => { events.push({cut: button.dataset.cut, trusted: event.isTrusted}); update(button.dataset.cut); });
update(cut); fieldset.disabled = false;
window.cutFixture = {events, update, state: () => cut};
