const CUTS = [['bob02', 'Chin-length bob'], ['bob01', 'Long bob']];

/** Fixed captured views forward to the existing cut owner. No recipe or Avatar owner. */
export function mountCutReferences(fieldset, references) {
    if (fieldset?.tagName !== 'FIELDSET' || references.length !== 2 ||
        CUTS.some(([cut]) => fieldset.querySelectorAll(`[data-cut="${cut}"]`).length !== 1))
        throw new Error('Cut references require the two existing cut controls.');
    const entries = new Map(references.map(item => [item.cut, item.src]));
    if (entries.size !== 2 || CUTS.some(([cut]) => typeof entries.get(cut) !== 'string' || !entries.get(cut)))
        throw new Error('Both fixed cut references are required.');
    const details = document.createElement('details'); details.className = 'cut-references';
    const summary = document.createElement('summary'); summary.textContent = 'Compare cuts';
    const note = document.createElement('p'); note.className = 'cut-reference-note';
    note.textContent = 'Fixed Portrait views in Neutral Studio, with the same outfit and lavender tint. Your colours and view may differ. Images include their captured controls.';
    const grid = document.createElement('div'); grid.className = 'cut-reference-grid';
    grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', 'Fixed hair cut references');
    for (const [cut, label] of CUTS) {
        const card = document.createElement('div'); card.className = 'cut-reference-card';
        const button = document.createElement('button'); button.type = 'button';
        button.className = 'cut-reference'; button.dataset.referenceCut = cut;
        button.setAttribute('aria-label', `Choose ${label}. Fixed Portrait reference.`);
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => fieldset.querySelector(`[data-cut="${cut}"]`).click());
        const window = document.createElement('span'); window.className = 'cut-reference-window';
        const image = document.createElement('img'); image.alt = ''; image.draggable = false;
        image.loading = 'lazy'; image.decoding = 'async'; image.width = 1440; image.height = 2060;
        const missing = document.createElement('span'); missing.className = 'cut-reference-missing';
        missing.textContent = 'Reference unavailable'; missing.hidden = true;
        image.addEventListener('error', () => { image.hidden = true; missing.hidden = false; });
        image.addEventListener('load', () => { image.hidden = false; missing.hidden = true; });
        image.src = entries.get(cut); window.append(image, missing);
        const name = document.createElement('span'); name.className = 'cut-reference-label'; name.textContent = label;
        button.append(window, name);
        const original = document.createElement('a'); original.href = entries.get(cut);
        original.target = '_blank'; original.rel = 'noopener'; original.className = 'cut-reference-original';
        original.textContent = 'Open larger reference ↗';
        original.setAttribute('aria-label', `Open larger ${label} reference in a new tab`);
        card.append(button, original); grid.append(card);
    }
    details.append(summary, note, grid); fieldset.append(details);
    return Object.freeze({update(cut) {
        if (!CUTS.some(([id]) => id === cut)) throw new Error('Unknown attached cut.');
        for (const button of grid.querySelectorAll('[data-reference-cut]'))
            button.setAttribute('aria-pressed', String(button.dataset.referenceCut === cut));
    }});
}
