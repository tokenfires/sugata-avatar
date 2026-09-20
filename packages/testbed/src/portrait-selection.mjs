// The portrait selects authored body bakes. Keep this browser-safe so capture tools share it.
export const PORTRAIT_BAKES = Object.freeze( { g000: 0, g025: .25, g050: .5, g075: .75, g100: 1 } );
export function portraitSelection( params, explicitBake = null ) {
    for ( const key of [ 'bake', 'gender' ] ) if ( params.getAll( key ).length > 1 ) throw new Error( `Duplicate URL ${ key } selection.` );
    const urlBake = params.get( 'bake' ), genderText = params.get( 'gender' );
    for ( const bake of [ explicitBake, urlBake ] ) if ( bake !== null && ! Object.hasOwn( PORTRAIT_BAKES, bake ) ) throw new Error( `Unsupported body bake ${ bake }; use ${ Object.keys( PORTRAIT_BAKES ).join( ', ' ) }.` );
    if ( explicitBake !== null && urlBake !== null && explicitBake !== urlBake ) throw new Error( '--bake contradicts the URL bake selection.' );
    const gender = genderText === null ? null : Number( genderText );
    if ( genderText !== null && ( genderText.trim() === '' || ! Object.values( PORTRAIT_BAKES ).includes( gender ) ) ) throw new Error( 'Portrait gender must be an authored value: 0, 0.25, 0.5, 0.75 or 1.' );
    const bake = explicitBake ?? urlBake ?? ( gender === null ? 'g050' : Object.keys( PORTRAIT_BAKES ).find( key => PORTRAIT_BAKES[ key ] === gender ) );
    if ( gender !== null && gender !== PORTRAIT_BAKES[ bake ] ) throw new Error( 'Body bake contradicts the URL gender selection.' );
    return { bake, gender: PORTRAIT_BAKES[ bake ] };
}

export function validatePortraitHair( hair, bake ) {
    if ( ! [ 'bob01', 'bob02' ].includes( hair ) ) throw new Error( 'Portrait hair must be bob01 or bob02.' );
    if ( hair === 'bob02' && bake !== 'g050' ) throw new Error( 'bob02 is authored only for g050; select bob01 for other body bakes.' );
}
