// Node-side document transformation only; caller retains/hash-binds both exact response bodies.
export function injectShowcaseBootEntry(html,{documentURL,entryURL}) {
 const document=new URL(documentURL),entry=new URL(entryURL,document);
 if(document.pathname!=='/src/showcase.html'||entry.origin!==document.origin||entry.search||entry.hash||!entry.pathname.endsWith('/wardrobe-colours-next/showcase-boot-entry.mjs'))throw new Error('Unexpected diagnostic document/entry URL');
 const tag='<script type="module" src="./showcase.js"></script>';
 if(html.split(tag).length!==2)throw new Error('Expected exactly one original Showcase module entry');
 // A quoted, same-origin encoded URL is required; no arbitrary markup/attribute interpolation.
 if(/["<>]/.test(entry.href))throw new Error('Unsafe diagnostic entry URL');
 return html.replace(tag,`<script type="module" src="${entry.href}"></script>`);
}
