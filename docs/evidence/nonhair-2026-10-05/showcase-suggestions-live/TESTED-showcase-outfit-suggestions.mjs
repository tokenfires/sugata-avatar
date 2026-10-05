/** Read-only disclosure. The caller owns selection; this view owns DOM/listeners only. */
export function mountOutfitSuggestions(container, request, {id = 'outfit-suggestions'} = {}) {
    const document = container?.ownerDocument;
    if (!document || typeof request !== 'function' || !/^[a-z][a-z0-9-]*$/.test(id) || document.getElementById(id))
        throw new Error('Outfit suggestions need a container, callback and unique id.');
    const node = (tag, text) => {
        const element = document.createElement(tag);
        if (text !== undefined) element.textContent = text;
        return element;
    };
    const details = node('details'); details.id = id; details.className = 'outfit-suggestions';
    const summary = node('summary', 'Suggest an outfit');
    const note = node('p', 'Find the closest match from these clothing studies. Suggestions leave your current look in place.');
    const label = node('label', 'How formal?'); label.htmlFor = `${id}-formality`;
    const select = node('select'); select.id = label.htmlFor;
    for (const [value, text] of [[1, '1 · Most casual'], [2, '2'], [3, '3'], [4, '4'], [5, '5 · Most formal']]) {
        const option = node('option', text); option.value = String(value); select.append(option);
    }
    select.value = '3';
    const ask = node('button', 'Request suggestion'); ask.type = 'button'; ask.className = 'secondary';
    const inputs = node('div'); inputs.className = 'outfit-suggestion-inputs'; inputs.append(label, select, ask);
    const card = node('section'); card.className = 'outfit-suggestion-card'; card.hidden = true;
    card.setAttribute('aria-label', 'Outfit suggestion');
    const title = node('h3'), reason = node('p');
    const guidance = node('p', 'Use the Outfit buttons above if you want to change clothes.');
    const dismiss = node('button', 'Dismiss suggestion'); dismiss.type = 'button'; dismiss.className = 'secondary';
    card.append(title, reason, guidance, dismiss);
    const feedback = node('p'); feedback.className = 'outfit-suggestion-feedback';
    feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite'); feedback.setAttribute('aria-atomic', 'true');
    details.append(summary, note, inputs, card, feedback); container.append(details);
    let unavailable = true, disposed = false;
    const ready = 'Request a suggestion to compare the available outfits.';
    function clear(message = ready, returnFocus = false) {
        if (disposed) return;
        const hadFocus = card.contains(document.activeElement);
        card.hidden = true; title.textContent = reason.textContent = ''; feedback.textContent = message;
        if ((returnFocus || hadFocus) && !unavailable && !ask.disabled) ask.focus({preventScroll: true});
    }
    function onRequest() {
        if (disposed || unavailable || ask.disabled || container.closest('fieldset')?.disabled) return;
        try {
            const choice = request({formality: Number(select.value)});
            if (typeof choice?.label !== 'string' || !choice.label.trim() || typeof choice.reason !== 'string' || !choice.reason.trim())
                throw new Error('A suggestion needs a label and explanation.');
            title.textContent = choice.label; reason.textContent = choice.reason; card.hidden = false;
            feedback.textContent = `Suggested ${choice.label}. Your current look is unchanged.`;
        } catch (error) {
            clear('Suggestions are unavailable right now. Your current look stays the same.');
            console.warn('Outfit suggestion unavailable:', error);
        }
    }
    const onDismiss = () => clear('Suggestion dismissed. Your current look is unchanged.', true);
    const onEdit = () => clear('Formality changed. Request a new suggestion.');
    ask.addEventListener('click', onRequest); dismiss.addEventListener('click', onDismiss); select.addEventListener('change', onEdit);
    select.disabled = ask.disabled = dismiss.disabled = true; feedback.textContent = 'Preparing outfit suggestions…';
    return Object.freeze({
        setDisabled(value) {
            if (disposed) return;
            const wasUnavailable = unavailable; unavailable = !!value;
            select.disabled = ask.disabled = dismiss.disabled = unavailable;
            if (unavailable) clear('Outfit suggestions are unavailable while your look is being prepared.');
            else if (wasUnavailable) clear();
        },
        invalidate: () => clear(),
        dispose() {
            if (disposed) return;
            disposed = true;
            ask.removeEventListener('click', onRequest); dismiss.removeEventListener('click', onDismiss); select.removeEventListener('change', onEdit);
            details.remove();
        }
    });
}
