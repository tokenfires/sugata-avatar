// Candidate only: static references; the existing page owns every palette action.
const STYLES = [['ecru', 'Ecru'], ['charcoal', 'Charcoal'], ['original', 'Original']];
const OUTFITS = {
    casual: { label: 'Tee + denim', reference: 'Everyday reference · chin-length cut' },
    elegant: { label: 'Blouse + skirt', reference: 'After hours reference · long cut' }
};

/** Static reference actions forward to the three unchanged canonical style buttons.
 * references: six bundled {outfit, style, src} records; no fetch or storage owner.
 * update() receives the ACTUAL attached outfit, independently of starting preset.
 */
export function mountPaletteReferences(fieldset, references) {
    if (fieldset?.tagName !== 'FIELDSET' || !Array.isArray(references) || references.length !== 6)
        throw new Error('Palette references require the existing style fieldset and six images.');
    if (fieldset.querySelectorAll('[data-style]').length !== 3 ||
        STYLES.some(([style]) => fieldset.querySelectorAll(`[data-style="${style}"]`).length !== 1))
        throw new Error('Keep one canonical control for each palette.');
    const entries = new Map();
    for (const item of references) {
        if (!Object.hasOwn(OUTFITS, item.outfit) || !STYLES.some(([style]) => style === item.style) ||
            typeof item.src !== 'string' || !item.src || entries.has(`${item.outfit}/${item.style}`))
            throw new Error('Unsupported or duplicate palette reference.');
        entries.set(`${item.outfit}/${item.style}`, item);
    }
    const details = document.createElement('details'); details.className = 'palette-references';
    const summary = document.createElement('summary'); summary.textContent = 'Compare palettes';
    const note = document.createElement('p'); note.className = 'palette-reference-note';
    note.textContent = 'Studio, full-look references. Your scene, framing and cut stay as selected.';
    details.append(summary, note);
    const groups = new Map();
    for (const [outfit, descriptor] of Object.entries(OUTFITS)) {
        const group = document.createElement('div'); group.className = 'palette-reference-group'; group.hidden = true;
        const caption = document.createElement('p'); caption.className = 'palette-reference-caption';
        caption.textContent = `${descriptor.label} · ${descriptor.reference}`;
        const grid = document.createElement('div'); grid.className = 'palette-reference-grid';
        grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', `${descriptor.label} palette references`);
        for (const [style, label] of STYLES) {
            const button = document.createElement('button'); button.type = 'button';
            button.className = 'palette-reference'; button.dataset.referenceStyle = style;
            button.setAttribute('aria-pressed', 'false');
            button.addEventListener('click', () => {
                const canonical = fieldset.querySelector(`[data-style="${style}"]`);
                // Native click respects canonical/fieldset disablement and the existing same-style guard.
                canonical?.click();
            });
            button.setAttribute('aria-label', `Apply ${label} palette — ${descriptor.label}. Studio full-look reference.`);
            const image = document.createElement('img'); image.loading = 'lazy'; image.decoding = 'async';
            image.alt = `${descriptor.label} in ${label}, shown as a full look in Studio`; image.draggable = false;
            const missing = document.createElement('span'); missing.className = 'palette-reference-missing';
            missing.textContent = 'Reference unavailable'; missing.hidden = true;
            image.addEventListener('error', () => { image.hidden = true; missing.hidden = false; });
            image.addEventListener('load', () => { image.hidden = false; missing.hidden = true; });
            image.src = entries.get(`${outfit}/${style}`).src;
            const text = document.createElement('span'); text.className = 'palette-reference-label';
            const name = document.createElement('strong'); name.textContent = label;
            const action = document.createElement('span'); action.textContent = 'Apply palette';
            text.append(name, action); button.append(image, missing, text); grid.append(button);
        }
        group.append(caption, grid); details.append(group); groups.set(outfit, group);
    }
    fieldset.append(details);
    return Object.freeze({
        update(outfit, style) {
            if (!groups.has(outfit) || !STYLES.some(([id]) => id === style))
                throw new Error('No references for this attached outfit/palette.');
            for (const [id, group] of groups) group.hidden = id !== outfit;
            for (const button of details.querySelectorAll('[data-reference-style]'))
                button.setAttribute('aria-pressed', String(button.dataset.referenceStyle === style));
        }
    });
}
