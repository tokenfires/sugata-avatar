import assert from 'node:assert/strict';

export function patch(source,arm) {
  assert.ok(['identity','attachment-only','copy-lock'].includes(arm));
  if(arm==='identity')return source;
  const target=/(this\._resolveRenderTarget\s*=\s*new RenderTarget\(\s*1\s*,\s*1\s*,\s*\{)([\s\S]*?)(\}\s*\)\s*;)/g;
  assert.equal([...source.matchAll(target)].length,1,'Expected one unpatched resolve target');
  let result=source.replace(target,(_,start,options,end)=>{
    assert.match(options,/type:\s*HalfFloatType/);
    assert.doesNotMatch(options,/count\s*:/);
    return start+options.trimEnd().replace(/,$/,'')+', count: 2 '+end;
  });
  if(arm==='copy-lock'){
    const copy=/renderer\.copyTextureToTexture\(\s*this\._resolveRenderTarget\.texture\s*,\s*this\._historyRenderTarget\.texture\s*\)\s*;/g;
    assert.equal([...result.matchAll(copy)].length,1,'Expected one color-history copy');
    result=result.replace(copy,match=>match+'\nrenderer.copyTextureToTexture( this._resolveRenderTarget.textures[ 1 ], this._historyRenderTarget.textures[ 1 ] );');
  }
  return result;
}
