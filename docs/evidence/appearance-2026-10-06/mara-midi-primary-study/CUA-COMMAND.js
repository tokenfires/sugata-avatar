let maraMidiSourceTrace = { requested_utc: new Date().toISOString(), owner: 'root', source_url: 'https://media.cos.com/assets/001/bb/32/bb328fe70e823658611939c53f0b90ca11e449fe_xxl-1.jpg?imwidth=2160', screenshot_attempts: 0, errors: [], backend_pid: 'unavailable' };
let maraMidiSourceTab;
let maraMidiSourceClock = Date.now();
try {
    maraMidiSourceTrace.before_tabs = await collectionBrowser.tabs.list();
    maraMidiSourceTab = await collectionBrowser.tabs.new();
    maraMidiSourceTrace.owned_tab = maraMidiSourceTab.id;
    maraMidiSourceTrace.navigation_requested = new Date().toISOString();
    await maraMidiSourceTab.goto(maraMidiSourceTrace.source_url);
    maraMidiSourceTrace.navigation_returned = new Date().toISOString();
    maraMidiSourceTrace.dom = await maraMidiSourceTab.playwright.domSnapshot();
    if (Date.now() - maraMidiSourceClock >= 40000) throw new Error('Capture budget expired before first screenshot');
    maraMidiSourceTrace.screenshot_attempts++;
    let maraMidiSourceBytes = await maraMidiSourceTab.screenshot({ fullPage: true });
    maraMidiSourceTrace.captured_utc = new Date().toISOString();
    let maraMidiSourceExt = maraMidiSourceBytes[0] === 255 && maraMidiSourceBytes[1] === 216 ? 'jpg' : maraMidiSourceBytes[0] === 137 && maraMidiSourceBytes[1] === 80 ? 'png' : 'bin';
    maraMidiSourceTrace.image_path = '/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-06/mara-midi-primary-study/source-first.' + maraMidiSourceExt;
    maraMidiSourceTrace.image_bytes = maraMidiSourceBytes.length;
    await collectionFs.writeFile(maraMidiSourceTrace.image_path, maraMidiSourceBytes, { flag: 'wx' });
    await nodeRepl.emitImage(maraMidiSourceBytes);
} catch (error) {
    maraMidiSourceTrace.errors.push({ phase: 'first-source-image', name: error.name, message: error.message });
} finally {
    maraMidiSourceTrace.cleanup_requested = new Date().toISOString();
    try {
        if (maraMidiSourceTab) { await maraMidiSourceTab.close(); maraMidiSourceTrace.closed_tab = maraMidiSourceTab.id; maraMidiSourceTrace.closed_utc = new Date().toISOString(); }
    } catch (error) { maraMidiSourceTrace.errors.push({ phase: 'owned-tab-close', name: error.name, message: error.message }); }
    maraMidiSourceTrace.returned_utc = new Date().toISOString();
    maraMidiSourceTrace.elapsed_ms = Date.now() - maraMidiSourceClock;
    maraMidiSourceTrace.after_tabs = await collectionBrowser.tabs.list();
    await collectionFs.writeFile('/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-06/mara-midi-primary-study/NATIVE-TRACE.json', JSON.stringify(maraMidiSourceTrace, null, 2) + '\n', { flag: 'wx' });
    nodeRepl.write(maraMidiSourceTrace);
}
