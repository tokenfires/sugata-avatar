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

export function connectionHelp(reason) {
    if (reason === 'timeout') return 'LM Studio took too long to respond. Check that your selected chat model is loaded, then try Connect again.';
    if (reason === 'transport' || reason === 'http') return 'Check that LM Studio’s local server is running on port 1234, then refresh the model list. If it is running, check that the selected model is available.';
    return 'This model did not return the structured reply Converse needs. Try Connect again or choose another chat model.';
}
