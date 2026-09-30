import { resolveHairColour } from '../../core/src/material/HairColourOptions.js';

// Authored starting shades, not dye products. The material and room determine the rendered result.
export const HAIR_COLOURS = Object.freeze([
    ['Black', '#151217'], ['Brown', '#413934'], ['Auburn', '#4c3028'], ['Blonde', '#c7aa71'],
    ['Red', '#aa4029'], ['Grey', '#89868b'], ['White', '#e4dfd6']
].map(([label, hex]) => Object.freeze({label, hex})));

export function hairColourLabel(hex) {
    return hex ? HAIR_COLOURS.find(c => c.hex === hex)?.label ?? hex : 'Original hair';
}
export function hexToHsl(hex) {
    const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const [r, g, b] = rgb, max = Math.max(...rgb), min = Math.min(...rgb), d = max - min;
    const l = (max + min) / 2;
    const h = d === 0 ? 0 : (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) / 6;
    return {h, s: d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), l};
}
export function hslToHex({h, s, l}) {
    const a = s * Math.min(l, 1 - l);
    const channel = n => {
        const k = (n + h * 12) % 12;
        return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
    };
    return '#' + channel(0) + channel(8) + channel(4);
}

/** Local draft until Apply; navigation owns the fresh Avatar and preserves the other selections. */
export function mountHairColours(container, apply) {
    const shade = container.querySelector('#hair-shade'), picker = container.querySelector('#hair-colour');
    const lightness = container.querySelector('#hair-lightness'), amount = container.querySelector('#hair-lightness-value');
    const code = container.querySelector('#hair-colour-value'), status = container.querySelector('#hair-colour-status');
    const button = container.querySelector('#apply-hair-colour');
    for (const colour of HAIR_COLOURS) shade.add(new Option(colour.label, colour.hex), shade.options[shade.options.length - 1]);
    let applied = null, draft = null, hsl = hexToHsl('#765344');
    function refresh() {
        container.querySelector('#hair-tint-controls').hidden = draft === null;
        picker.disabled = lightness.disabled = draft === null;
        if (draft !== null) picker.value = draft;
        lightness.value = String(Math.round(hsl.l * 100)); amount.textContent = `${lightness.value}%`;
        code.textContent = draft ?? 'Original';
        button.disabled = draft === applied;
        status.textContent = draft === applied ? `Applied: ${hairColourLabel(applied)}` : 'Colour ready to apply';
    }
    shade.addEventListener('change', () => {
        draft = shade.value === 'original' ? null : shade.value === 'custom' ? picker.value : resolveHairColour(shade.value);
        if (draft !== null) hsl = hexToHsl(draft);
        refresh();
    });
    picker.addEventListener('input', () => { draft = resolveHairColour(picker.value); hsl = hexToHsl(draft); shade.value = 'custom'; refresh(); });
    lightness.addEventListener('input', () => { hsl.l = Number(lightness.value) / 100; draft = hslToHex(hsl); shade.value = 'custom'; refresh(); });
    button.addEventListener('click', () => { if (draft !== applied) apply(draft); });
    return { load(hex) {
        applied = draft = hex ?? null;
        shade.value = draft === null ? 'original' : HAIR_COLOURS.some(c => c.hex === draft) ? draft : 'custom';
        if (draft !== null) hsl = hexToHsl(draft);
        refresh();
    } };
}
