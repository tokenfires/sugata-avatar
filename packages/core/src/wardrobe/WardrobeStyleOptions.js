/** Finite, authored colour choices. Garment IDs and coverage remain unchanged. */
export const WARDROBE_STYLES = Object.freeze( [ 'original', 'ecru', 'charcoal' ] );
export function resolveWardrobeStyle( value = 'original' ) {
    if ( !WARDROBE_STYLES.includes( value ) ) {
        throw new TypeError( 'Avatar wardrobe.style must be original, ecru or charcoal.' );
    }
    return value;
}
