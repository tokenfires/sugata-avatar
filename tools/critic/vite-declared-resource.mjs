/** POSIX/macOS Vite URL identity for an explicitly declared file; no HTTP/IO. */
import path from 'node:path';
import assert from 'node:assert/strict';

export function qualifyDeclaredViteResource(resourceUrl, expectedFile, {origin, repoRoot, devRoot}) {
    const p=path.posix, absolute=value=>typeof value==='string'&&value.startsWith('/')&&p.normalize(value)===value&&!value.includes('\\');
    assert.ok(absolute(repoRoot)&&absolute(devRoot)&&absolute(expectedFile),'Canonical POSIX absolute paths required');
    const inside=(file,root)=>file.startsWith(root+'/');
    assert.ok(inside(devRoot,repoRoot)&&inside(expectedFile,repoRoot),'Declared repository file required');
    const url=new URL(resourceUrl);
    assert.equal(url.origin,origin,'Declared origin required');
    assert.ok(!url.username&&!url.password,'Ordinary resource URL required');
    assert.ok(!/%(?:2f|5c|00|25)/i.test(url.pathname),'Encoded separator/NUL/second decoding unsupported');
    const decoded=decodeURIComponent(url.pathname);
    assert.ok(!decoded.includes('\\'),'POSIX route required');
    assert.ok(!decoded.startsWith('/@')||decoded.startsWith('/@fs/'),'Virtual route unsupported');
    const pathname=p.normalize(decoded);
    // Vite outside-root producer uses path.posix.join(FS_PREFIX,id). Compare
    // this known URL to a declared file rather than stripping into an IO path.
    const filesystem=p.join('/@fs/',expectedFile);
    const devFile=inside(expectedFile,devRoot)?'/'+p.relative(devRoot,expectedFile):null;
    const rootIndex=expectedFile===p.join(devRoot,'index.html')&&pathname==='/';
    assert.ok(pathname===filesystem||(devFile!==null&&pathname===devFile)||rootIndex,'URL does not bind to declared file');
    return {file:expectedFile,route:rootIndex?'declared-index':pathname===filesystem?'filesystem':'dev-root',query:url.search,fragment:url.hash,fragmentNeedsValidation:url.hash!==''};
}
