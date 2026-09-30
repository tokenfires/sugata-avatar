import { resolveWardrobeColours, WARDROBE_COLOUR_PARTS } from '../../core/src/wardrobe/WardrobeStyleOptions.js';

/** Unchecked draft values have no material meaning, including a picker's initial swatch. */
export function coloursFromDraft(draft, style) {
    const selected = {};
    for (const part of WARDROBE_COLOUR_PARTS) if (draft[part].enabled) selected[part] = draft[part].value;
    return resolveWardrobeColours(Object.keys(selected).length ? selected : undefined, style);
}
export const sameColours = (a, b) => WARDROBE_COLOUR_PARTS.every(part => a?.[part] === b?.[part]);

/** Page-owned draft only. The page remains the navigation, Avatar and applied-options owner. */
export function mountColourControls(container, onApply) {
    const fieldset = container.querySelector('fieldset'), apply = container.querySelector('[data-apply-colours]');
    const reset = container.querySelector('[data-reset-colours]'), feedback = container.querySelector('[data-colour-feedback]');
    const guidance = container.querySelector('[data-colour-guidance]');
    const rows = Object.fromEntries(WARDROBE_COLOUR_PARTS.map(part => {
        const row = container.querySelector(`[data-colour-part="${part}"]`);
        return [part, { enabled: row.querySelector('[type=checkbox]'), text: row.querySelector('[type=text]'),
            picker: row.querySelector('[type=color]'), current: row.querySelector('[data-current-colour]') }];
    }));
    let actual = null, unavailable = true, signature = null, notice = '';
    const draft = () => Object.fromEntries(Object.entries(rows).map(([part, row]) => [part,
        { enabled: row.enabled.checked, value: row.text.value }]));
    function refresh() {
        const disabled = unavailable || !actual || actual.style === 'original';
        fieldset.disabled = disabled;
        guidance.textContent = actual?.style === 'original' ? 'Choose Ecru or Charcoal to mix colours. Original keeps its imported fabrics.' :
            'Enable a part, then pick a tint or enter #RRGGBB. Apply opens a fresh preview; motion and orbit restart.';
        for (const row of Object.values(rows)) {
            row.text.disabled = row.picker.disabled = disabled || !row.enabled.checked;
            row.text.setAttribute('aria-invalid', String(row.enabled.checked && !/^#[0-9a-fA-F]{6}$/.test(row.text.value)));
        }
        let changed = false, error = null;
        try { changed = !sameColours(coloursFromDraft(draft(), actual?.style), actual?.colours); }
        catch { error = 'Enter a six-digit hex colour for each enabled part, for example #617a70.'; }
        apply.disabled = disabled || !!error || !changed;
        reset.disabled = disabled || Object.entries(rows).every(([part, row]) =>
            row.enabled.checked === !!actual?.colours?.[part] && row.text.value === (actual?.colours?.[part] ?? ''));
        feedback.textContent = error ?? (changed ? 'Draft only. Your preview and saved settings still use the applied colours.' : notice || 'Showing the applied colours.');
    }
    function resetDraft() {
        for (const [part, row] of Object.entries(rows)) {
            row.enabled.checked = !!actual?.colours?.[part];
            row.text.value = actual?.colours?.[part] ?? '';
            // A picker proposal is never read by Apply until a real input/change event copies it.
            row.picker.value = actual?.colours?.[part] ?? '#808080';
        }
        refresh();
    }
    const edited = () => { notice = ''; refresh(); };
    const resetAppliedDraft = () => { notice = ''; resetDraft(); };
    for (const row of Object.values(rows)) {
        row.enabled.addEventListener('change', edited);
        row.text.addEventListener('input', () => {
            if (/^#[0-9a-fA-F]{6}$/.test(row.text.value)) row.picker.value = row.text.value;
            edited();
        });
        const pick = () => { if (!row.picker.disabled) { row.text.value = row.picker.value; edited(); } };
        row.picker.addEventListener('input', pick); row.picker.addEventListener('change', pick);
    }
    reset.addEventListener('click', resetAppliedDraft);
    apply.addEventListener('click', () => {
        if (apply.disabled || fieldset.disabled) return;
        try { onApply(coloursFromDraft(draft(), actual.style)); }
        catch (error) { feedback.textContent = error.message; }
    });
    return Object.freeze({
        update({ style, outfit, colours }) {
            const canonical = resolveWardrobeColours(colours, style);
            const next = JSON.stringify({ style, outfit, colours: canonical });
            const changedOutfit = actual && actual.outfit !== outfit;
            actual = { style, outfit, colours: canonical };
            for (const [part, row] of Object.entries(rows)) row.current.textContent = canonical?.[part] ??
                (part === 'bottom' && style === 'charcoal' && outfit === 'casual' ? 'Source fabric colour' : 'Base palette');
            if (next !== signature) {
                notice = changedOutfit ? 'Draft reset for this outfit. Applied Top, Bottom and Shoes colours follow their parts.' : '';
                signature = next; resetDraft();
            }
            else refresh();
        },
        setDisabled(value) { unavailable = value; refresh(); },
        reset: resetAppliedDraft
    });
}
