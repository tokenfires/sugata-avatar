/** Small completion/error readers shared by the existing request paths; no transport policy. */
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
export function completionDiagnostic(payload) {
    return {
        finishReason: typeof payload?.choices?.[0]?.finish_reason === 'string'
            ? payload.choices[0].finish_reason.slice(0, 40) : null,
        completionTokens: count(payload?.usage?.completion_tokens),
        reasoningTokens: count(payload?.usage?.completion_tokens_details?.reasoning_tokens)
    };
}

/** Bounded plain text, for textContent only. Never reads a model's reasoning channel. */
export function boundedDetail(value) {
    return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 320);
}

/** Keep the HTTP failure even if its optional error body cannot be read or decoded. */
export async function httpErrorDetail(response) {
    const prefix = `HTTP ${response.status}`;
    try {
        let text = '';
        if (response.body?.getReader) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let remaining = 4096;
            try {
                while (remaining > 0) {
                    const {done, value} = await reader.read();
                    if (done) break;
                    const chunk = value.subarray(0, remaining);
                    text += decoder.decode(chunk, {stream: true});
                    remaining -= chunk.length;
                }
                text += decoder.decode();
            } finally {
                void reader.cancel().catch(() => {});
                reader.releaseLock();
            }
        } else if (typeof response.text === 'function') {
            text = (await response.text()).slice(0, 4096);
        }
        let message = '';
        try {
            const body = JSON.parse(text);
            message = typeof body?.error === 'string' ? body.error
                : typeof body?.error?.message === 'string' ? body.error.message
                : typeof body?.message === 'string' ? body.message : '';
        } catch {
            // HTML and incomplete JSON from a gateway are not useful model advice.
            if (!/^[\s]*[<{\[]/.test(text)) message = text;
        }
        const detail = boundedDetail(message);
        return detail ? `${prefix}: ${detail}` : prefix;
    } catch (error) {
        return error?.name === 'AbortError' ? `${prefix} (error details timed out or were cancelled)` : prefix;
    }
}
