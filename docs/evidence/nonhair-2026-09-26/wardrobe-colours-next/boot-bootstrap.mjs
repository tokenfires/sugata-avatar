// Node-only capture-local Vite transform. Serve real HTTP, keeping native client injection.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const sha=s=>createHash('sha256').update(s).digest('hex');

export function startupHTMLTransform(pageName) {
    assert.ok(['showcase','portrait'].includes(pageName));
    const source=fs.readFileSync(path.join(ROOT,'packages/testbed/src',pageName+'.html'),'utf8');
    const tag=`<script type="module" src="./${pageName}.js"></script>`;
    assert.equal(source.split(tag).length,2,'Require exactly the native main module.');
    const deferred=source.replace(tag,'<!-- Colour capture defers exactly the original module startup. -->');
    const receipt={originalSHA256:sha(source),deferredSHA256:sha(deferred),requests:[],
        policy:'Capture-local Vite pre-transform changes one main module tag; normal network HTML response and Vite client injection remain native.'};
    return {deferred,receipt,plugin:{name:'source-bound-colour-startup',transformIndexHtml:{order:'pre',handler(html,context){
        const url=new URL(context.originalUrl??context.path,'http://capture.invalid');
        if(context.path!==`/src/${pageName}.html`||!url.searchParams.has('capture'))return;
        assert.equal(html,source,'Native HTML changed before capture transform.');
        receipt.requests.push({path:context.path,originalUrl:context.originalUrl,originalSHA256:sha(html)});
        return deferred;
    }}}};
}

export async function startReviewProbeServer({pageName,port=5391}) {
    const transform=startupHTMLTransform(pageName);
    const server=await createServer({configFile:path.join(ROOT,'vite.config.js'),plugins:[transform.plugin],
        server:{port,strictPort:false,hmr:false,watch:{ignored:['**']}},logLevel:'error'});
    try {await server.listen();}catch(error){await server.close();throw error;}
    return {baseUrl:server.resolvedUrls.local[0].replace(/\/$/,''),bootstrap:transform.receipt,
        deferredHTML:transform.deferred,close:()=>server.close()};
}
