import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {startupHTMLTransform} from './bootstrap.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const transform=startupHTMLTransform('showcase'),source=fs.readFileSync(path.join(root,'packages/testbed/src/showcase.html'),'utf8');
const handle=transform.plugin.transformIndexHtml.handler;
assert.equal(handle(source,{path:'/src/showcase.html',originalUrl:'/src/showcase.html'}),undefined);
assert.equal(handle(source,{path:'/src/portrait.html',originalUrl:'/src/portrait.html?capture'}),undefined);
assert.throws(()=>handle(source+' changed',{path:'/src/showcase.html',originalUrl:'/src/showcase.html?capture'}),/Native HTML changed/);
const cacheDir=fs.mkdtempSync(path.join(os.tmpdir(),'sugata-startup-html-'));
// Real local HTTP/Vite transformation only. Isolate the optimizer cache from root's active GPU page.
const server=await createServer({configFile:path.join(root,'vite.config.js'),cacheDir,plugins:[transform.plugin],
    server:{port:0,strictPort:false,hmr:false,watch:{ignored:['**']}},logLevel:'silent'});
try {
    await server.listen();const base=server.resolvedUrls.local[0];
    const response=await fetch(new URL('src/showcase.html?capture',base));assert.equal(response.status,200);const html=await response.text();
    assert.equal(transform.receipt.requests.length,1);
    assert.equal((html.match(/src="\/@vite\/client"/g)??[]).length,1,'Native Vite client injection remains.');
    assert.equal(html.includes('<script type="module" src="./showcase.js"></script>'),false);
    assert.ok(html.includes('Performance diagnostic defers exactly the original module startup.'));
    const ordinary=await fetch(new URL('src/showcase.html',base));const originalHTML=await ordinary.text();
    assert.equal(ordinary.status,200);assert.ok(originalHTML.includes('<script type="module" src="./showcase.js"></script>'));
    assert.equal(transform.receipt.requests.length,1,'Ordinary page not intercepted.');
    console.log(JSON.stringify({groups:3,captureScopedAndStaleHTMLRefusal:true,nativeNetworkHTMLAndViteClientInjection:true,ordinaryPagePreserved:true,
        scope:'CPU local HTTP only; no browser, GPU, WebSocket permission or shader qualification.'}));
} finally {await server.close();fs.rmSync(cacheDir,{recursive:true});}
