/** Add the local review shortcut to the hub's existing .jump navigation. */
export function mountTodayReview( container ) {
    if ( ! import.meta.env.DEV ) return null;

    const existing = container.querySelector( '[data-today-review]' );
    if ( existing ) return existing;

    const link = container.ownerDocument.createElement( 'a' );
    link.dataset.todayReview = '';
    link.textContent = 'Today’s work · September 26';
    link.href = new URL( '../../docs/evidence/nonhair-2026-09-26/review.html', import.meta.url ).href;
    container.append( link );
    return link;
}
