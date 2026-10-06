let maraSkirtTrace = { requested_utc: new Date().toISOString(), owner: 'root', source_url: 'http://127.0.0.1:5173/@fs/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-06/mara-midi-technical-design/review.html', screenshot_attempts: 0, errors: [], backend_pid: 'unavailable' };
let maraSkirtTab;
let maraSkirtClock = Date.now();
try {
    maraSkirtTrace.before_tabs = await collectionBrowser.tabs.list();
    maraSkirtTab = await collectionBrowser.tabs.new();
    maraSkirtTrace.owned_tab = maraSkirtTab.id;
    maraSkirtTrace.navigation_requested = new Date().toISOString();
    await maraSkirtTab.goto(maraSkirtTrace.source_url);
    maraSkirtTrace.navigation_returned = new Date().toISOString();
    maraSkirtTrace.page_url = await maraSkirtTab.url();
    maraSkirtTrace.dom = await maraSkirtTab.playwright.domSnapshot();
    maraSkirtTrace.readiness = await maraSkirtTab.playwright.evaluate(() => {
        const images = Array.from(document.querySelectorAll('main img'));
        const img = images[0];
        const rect = img?.getBoundingClientRect();
        return { image_count: images.length, complete: img?.complete, source: img?.src, natural_width: img?.naturalWidth, natural_height: img?.naturalHeight, rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null, page_width: document.documentElement.scrollWidth, page_height: document.documentElement.scrollHeight };
    });
    if (maraSkirtTrace.readiness.image_count !== 1 || !maraSkirtTrace.readiness.complete || maraSkirtTrace.readiness.natural_width !== 1440 || maraSkirtTrace.readiness.natural_height !== 1040 || !maraSkirtTrace.readiness.source.endsWith('/skirt.svg')) throw new Error('First observed source image was not ready');
    if (Date.now() - maraSkirtClock >= 40000) throw new Error('Capture budget expired before first screenshot');
    maraSkirtTrace.screenshot_attempts++;
    let maraSkirtBytes = await maraSkirtTab.screenshot({ fullPage: true });
    maraSkirtTrace.captured_utc = new Date().toISOString();
    let maraSkirtExt = maraSkirtBytes[0] === 255 && maraSkirtBytes[1] === 216 ? 'jpg' : maraSkirtBytes[0] === 137 && maraSkirtBytes[1] === 80 ? 'png' : 'bin';
    maraSkirtTrace.image_path = '/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-06/mara-midi-first-native/first-sheet.' + maraSkirtExt;
    maraSkirtTrace.image_bytes = maraSkirtBytes.length;
    await collectionFs.writeFile(maraSkirtTrace.image_path, maraSkirtBytes, { flag: 'wx' });
    await nodeRepl.emitImage(maraSkirtBytes);
    maraSkirtTrace.console = await maraSkirtTab.dev.logs({ levels: ['error', 'warn'], limit: 20 });
} catch (error) {
    maraSkirtTrace.errors.push({ phase: 'first-whole-sheet', name: error.name, message: error.message });
} finally {
    maraSkirtTrace.cleanup_requested = new Date().toISOString();
    try {
        if (maraSkirtTab) { await maraSkirtTab.close(); maraSkirtTrace.closed_tab = maraSkirtTab.id; maraSkirtTrace.closed_utc = new Date().toISOString(); }
    } catch (error) { maraSkirtTrace.errors.push({ phase: 'owned-tab-close', name: error.name, message: error.message }); }
    maraSkirtTrace.returned_utc = new Date().toISOString();
    maraSkirtTrace.elapsed_ms = Date.now() - maraSkirtClock;
    maraSkirtTrace.after_tabs = await collectionBrowser.tabs.list();
    await collectionFs.writeFile('/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-06/mara-midi-first-native/NATIVE-TRACE.json', JSON.stringify(maraSkirtTrace, null, 2) + '\n', { flag: 'wx' });
    nodeRepl.write(maraSkirtTrace);
}
