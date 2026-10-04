/** Creation-time artist choice; omission retains the existing skin material defaults. */
export function resolveSkinFinish( value ) {

    if ( value === undefined ) return 'original';
    if ( value !== 'original' && value !== 'reduced-sheen' ) {

        throw new TypeError( 'Avatar skinFinish must be original or reduced-sheen.' );

    }
    return value;

}

/** Only the second-lobe weight changes; regional and second-lobe roughness stay untouched. */
export function skinFinishMaterialOptions( finish ) {

    return resolveSkinFinish( finish ) === 'original'
        ? {}
        : { settings: { secondLobeWeight: 0.12 } };

}
