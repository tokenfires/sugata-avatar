import { resolveWardrobeColours } from '../../core/src/wardrobe/WardrobeStyleOptions.js';

// Keep page selections flat: settings URL serialization must never stringify a nested object.
export const COLOUR_FIELDS = Object.freeze({ top: 'topColor', bottom: 'bottomColor', shoes: 'shoesColor' });
export function coloursFromSelection(selection) {
    const values = {};
    for (const [part, field] of Object.entries(COLOUR_FIELDS))
        if (selection[field] !== undefined) values[part] = selection[field];
    return resolveWardrobeColours(Object.keys(values).length ? values : undefined, selection.style);
}
export function selectionWithColours(selection, colours) {
    const result = { ...selection };
    for (const field of Object.values(COLOUR_FIELDS)) delete result[field];
    const canonical = resolveWardrobeColours(colours, selection.style);
    for (const [part, field] of Object.entries(COLOUR_FIELDS)) if (canonical?.[part]) result[field] = canonical[part];
    return result;
}
export function colourSelectionFromParams(params, selection) {
    const result = { ...selection };
    for (const field of Object.values(COLOUR_FIELDS)) {
        if (params.getAll(field).length > 1) throw new Error(`Duplicate ${field} selection.`);
        if (params.has(field)) result[field] = params.get(field);
    }
    return selectionWithColours(result, coloursFromSelection(result));
}
export function writeColourParams(params, selection) {
    const canonical = selectionWithColours(selection, coloursFromSelection(selection));
    for (const field of Object.values(COLOUR_FIELDS)) {
        if (canonical[field] === undefined) params.delete(field);
        else params.set(field, canonical[field]);
    }
}
export function customColourLabel(selection) {
    const colours = coloursFromSelection(selection);
    return colours ? `Custom colours: ${Object.keys(colours).join(', ')}` : '';
}
