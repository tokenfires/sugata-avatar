/** Add the local review shortcut to the hub's existing .jump navigation. */
export function mountTodayReview( container ) {
    if ( ! import.meta.env.DEV ) return null;

    const existing = container.querySelector( '[data-today-review]' );
    if ( existing ) return existing;

    const link = container.ownerDocument.createElement( 'a' );
    link.dataset.todayReview = '';
    link.textContent = 'Overnight work · September 29';
    link.href = new URL( '../../docs/evidence/hair-2026-09-29/review.html', import.meta.url ).href;
    container.append( link );
    return link;
}
