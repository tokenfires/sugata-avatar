import { coloursFromSelection } from './showcase-colours.mjs';
import { HAIR_COLOURS } from './showcase-hair-colours.mjs';

// Values describe the saved recipe; fabric, hair shading and light affect its appearance.
export function savedColourRecipe(selection) {
    const values = [];
    for (const [part, hex] of Object.entries(coloursFromSelection(selection) ?? {}))
        values.push({ label: part[0].toUpperCase() + part.slice(1), hex });
    if (selection.hairColour) {
        const name = HAIR_COLOURS.find(colour => colour.hex === selection.hairColour)?.label;
        values.push({ label: `Hair base${name ? ` · ${name}` : ''}`, hex: selection.hairColour });
    }
    if (selection.hairTint) values.push({
        label: `Tint ${Number((selection.hairTint.amount * 100).toFixed(2))}%`, hex: selection.hairTint.colour
    });
    if (!values.length) return null;
    const recipe = document.createElement('div'); recipe.className = 'saved-colour-recipe';
    for (const { label, hex } of values) {
        const chip = document.createElement('span'); chip.className = 'saved-colour-chip';
        const swatch = document.createElement('span'); swatch.className = 'saved-colour-swatch';
        swatch.setAttribute('aria-hidden', 'true'); swatch.style.backgroundColor = hex;
        const text = document.createElement('span'); text.textContent = `${label} ${hex}`;
        chip.append(swatch, text); recipe.append(chip);
    }
    return recipe;
}
