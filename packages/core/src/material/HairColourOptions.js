/** Optional creation-time sRGB colour. Omission keeps the exact derived material default. */
export function resolveHairColour(value) {
    if (value === undefined) return null;
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value))
        throw new TypeError('Avatar hairColour must be a six-digit sRGB colour such as #765344.');
    return value.toLowerCase();
}
