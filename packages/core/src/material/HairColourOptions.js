import { Color } from 'three';

/** Optional creation-time sRGB colour. Omission keeps the exact derived material default. */
export function resolveHairColour(value) {
    if (value === undefined) return null;
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value))
        throw new TypeError('Avatar hairColour must be a six-digit sRGB colour such as #765344.');
    return value.toLowerCase();
}

/** Keep the editable base/tint recipe; no tint is the existing exact colour path. */
export function resolveHairTint(value, baseColour) {
    if (value === undefined) return null;
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).length !== 2 || !Object.hasOwn(value, 'colour') || !Object.hasOwn(value, 'amount'))
        throw new TypeError('Avatar hairTint must contain only colour and amount.');
    const colour = resolveHairColour(value.colour);
    if (colour === null || typeof value.amount !== 'number' || !Number.isFinite(value.amount) || value.amount < 0 || value.amount > 1)
        throw new TypeError('Avatar hairTint requires a six-digit colour and an amount from 0 to 1.');
    if (typeof baseColour !== 'string') throw new TypeError('Avatar hairTint requires an explicit hairColour base.');
    return Object.freeze({colour, amount: value.amount});
}

export function sameHairTint(a, b) {
    return (a ?? null) === (b ?? null) || !!(a && b && a.colour === b.colour && a.amount === b.amount);
}

/** Linear RGB blend, quantized once to the material's existing six-digit sRGB input. */
export function mixedHairColour(baseColour, tint) {
    if (!tint || tint.amount === 0) return baseColour;
    if (tint.amount === 1) return tint.colour;
    return '#' + new Color(baseColour).lerp(new Color(tint.colour), tint.amount).getHexString();
}

export function hairColourLinear(hex) {
    return new Color(hex).toArray();
}
