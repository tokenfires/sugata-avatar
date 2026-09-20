import { boundedDetail } from '../../core/src/affect/CompletionDiagnostics.js';

/** Read-only discovery. A listed ID is not proof that a chat model is loaded or compatible. */
export async function discoverModels({ endpoint, fetchImpl = globalThis.fetch, timeoutMs = 8000 }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetchImpl(`${endpoint.replace(/\/+$/, '')}/v1/models`, { signal: controller.signal });
        if (!response.ok) return { ok: false, reason: 'http', detail: `HTTP ${response.status}` };
        const payload = await response.json();
        if (!Array.isArray(payload?.data)) return { ok: false, reason: 'format', detail: 'Expected a model list.' };
        const models = [...new Set(payload.data.filter(m => typeof m?.id === 'string' && m.id.trim()).map(m => m.id))];
        return { ok: true, models };
    } catch (error) {
        return { ok: false, reason: controller.signal.aborted ? 'timeout' : 'transport', detail: String(error.message ?? error) };
    } finally {
        clearTimeout(timer);
    }
}

/** Concise guidance, with the request's measured limit when available. */
export function connectionHelp(failure) {
    const reason = typeof failure === 'string' ? failure : failure?.reason;
    const diagnostic = typeof failure === 'object' ? failure?.diagnostic : null;
    if (reason === 'timeout') {
        const ms = diagnostic?.timeoutMs;
        const duration = Number.isFinite(ms) && ms > 0 ? ` within ${ms / 1000} seconds` : ' in time';
        return `LM Studio did not finish${duration}. Check that the selected model is loaded and idle, then retry. A faster model may be needed.`;
    }
    if (reason === 'truncated') return 'The model reached this request’s output limit before completing it. Try a non-thinking chat model, or adjust its thinking settings in LM Studio and reconnect.';
    if (reason === 'http') return 'LM Studio rejected this request. Open the failure details for its message, then check the selected model and its settings.';
    if (reason === 'transport') return 'Cannot reach LM Studio’s local server. Check that it is running on port 1234, then refresh the model list and reconnect.';
    if (reason === 'invalid-response') return 'LM Studio returned a response Converse could not read. Retry, and check the server’s error log if this repeats.';
    if (reason === 'no-channel') return 'The model returned no answer. Retry, or choose another chat model and connect again.';
    if (reason === 'unparseable') return 'The model answered in a format Converse could not read. Retry, or choose another chat model that supports structured responses.';
    return 'The model’s response did not meet Converse’s requirements. Retry, or choose another chat model and connect again.';
}

/** Display only bounded diagnostic fields, never the model's answer or reasoning prose. */
export function formatRequestDiagnostic(failure, requestName = 'Request') {
    const d = failure?.diagnostic ?? {};
    const lines = [`${requestName}: ${boundedDetail(failure?.reason ?? 'unavailable')}`];
    if (failure?.detail) lines.push(boundedDetail(failure.detail));
    if (Number.isInteger(d.httpStatus) && d.httpStatus >= 100 && d.httpStatus <= 599) lines.push(`Server status: HTTP ${d.httpStatus}`);
    if (d.finishReason) lines.push(`Completion status: ${boundedDetail(d.finishReason)}`);
    if (Number.isSafeInteger(d.completionTokens) && d.completionTokens >= 0) lines.push(`Output tokens: ${d.completionTokens}`);
    if (Number.isSafeInteger(d.reasoningTokens) && d.reasoningTokens >= 0) lines.push(`Of those, LM Studio reported reasoning tokens: ${d.reasoningTokens}`);
    if (Number.isSafeInteger(d.tokenLimit) && d.tokenLimit > 0) lines.push(`Requested output limit: ${d.tokenLimit} tokens`);
    if (Number.isFinite(d.timeoutMs) && d.timeoutMs > 0) lines.push(`Request time limit: ${d.timeoutMs / 1000} seconds`);
    return lines.join('\n');
}
