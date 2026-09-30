/** Finite, authored colour choices. Garment IDs and coverage remain unchanged. */
export const WARDROBE_STYLES = Object.freeze( [ 'original', 'ecru', 'charcoal' ] );
export function resolveWardrobeStyle( value = 'original' ) {
    if ( !WARDROBE_STYLES.includes( value ) ) {
        throw new TypeError( 'Avatar wardrobe.style must be original, ecru or charcoal.' );
    }
    return value;
}

export const WARDROBE_COLOUR_PARTS = Object.freeze( [ 'top', 'bottom', 'shoes' ] );

/** Copy data, not caller-owned objects or CSS expressions, before any asset allocation. */
export function resolveWardrobeColours( value, style = 'original' ) {
    if ( value === undefined ) return undefined;
    resolveWardrobeStyle( style );
    if ( style === 'original' ) throw new TypeError( 'Avatar wardrobe.colours needs Ecru or Charcoal; Original keeps its imported fabrics.' );
    if ( !value || typeof value !== 'object' || Array.isArray( value ) ||
        ![ Object.prototype, null ].includes( Object.getPrototypeOf( value ) ) ) {
        throw new TypeError( 'Avatar wardrobe.colours must be a plain object with top, bottom or shoes colours.' );
    }
    const descriptors = Object.getOwnPropertyDescriptors( value );
    for ( const key of Reflect.ownKeys( descriptors ) ) {
        const descriptor = descriptors[ key ];
        if ( !WARDROBE_COLOUR_PARTS.includes( key ) || !descriptor.enumerable || !Object.hasOwn( descriptor, 'value' ) ||
            typeof descriptor.value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test( descriptor.value ) ) {
            throw new TypeError( 'Avatar wardrobe.colours accepts only top, bottom and shoes as #RRGGBB data values.' );
        }
    }
    const result = {};
    for ( const part of WARDROBE_COLOUR_PARTS ) if ( Object.hasOwn( descriptors, part ) ) result[ part ] = descriptors[ part ].value.toLowerCase();
    return Object.keys( result ).length ? Object.freeze( result ) : undefined;
}
