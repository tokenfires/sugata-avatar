# Retained method declarations and unresolved artifact writer

The exact six earlier-returned host locators below are copied from retained12e3a2 output, not a new source query:

108:     for (const button of document.querySelectorAll('[data-open-look], [data-download-look]')) button.disabled = !collectionAvailable() || button.dataset.unavailable === 'true';
297: function currentConfiguration() {
303: function downloadBlob(blob, filename) {
311: function saveLook() {
366: function viewLook() {
373: async function copyLook() {

Retained selected IAB documentation (read from sugataImportDocLines, no new browser selection, page, API probe or fetch):
173: waitForEvent(event: "download", options?: WaitForEventOptions): Promise<PlaywrightDownload>; // Wait for the next download to complete; call before clicking its download control.
227: interface PlaywrightDownload {
228:   path(options: { timeoutMs?: number }): Promise<null | string>; // Return the local path to the downloaded file, if available.
229: }
231: interface PlaywrightFileChooser {
232:   isMultiple(): boolean;
233:   setFiles(files: FileChooserFiles, options: { timeoutMs?: number }): Promise<void>;
234: }

The browser API documents screenshot() returning Uint8Array. The CUA tool entry instructions expose nodeRepl.write and nodeRepl.emitImage for output and say “Use only APIs described in the tool instructions or returned documentation.” The selected documentation supplied no fs.readFile/writeFile declarations or explicit artifact filesystem support/permission. METHOD proposes standard Node artifact I/O in CUA, separating it from UI control, but that is a proposal/inference, not a witnessed permitted writer here. No filesystem import/probe or screenshot was tried. This is a bounded evidence gap, not proof the runtime lacks file I/O or a general ban on standard Node outside this surface.

The actual download/path declaration gap is settled by retained documentation; artifact writer remains unqualified under this exact method. Root must not admit the proposed import/fs writer solely because Node exposes it elsewhere. No alternative transport/capture/export method, extra metadata/reference hunt, source edit or fixture/browser/capture entry is attempted. Keep34caseCPU A and guarded candidate. Critic should independently close the method at its supported scope with source/tool-contract witness and two alternatives.
