import assert from 'node:assert/strict';
export const fields={current:'currentColor',mean:'mean',history:'historyColor',clipped:'clippedHistoryColor',locked:'lockedHistoryColor'};
export function patch(source,field){
  if(field==='identity')return source;
  assert.ok(fields[field]);
  const replace=(pattern,replacement)=>{
    assert.equal([...source.matchAll(new RegExp(pattern.source,'g'))].length,1,pattern.source);
    source=source.replace(pattern,replacement);
  };
  replace(/(this\._resolveRenderTarget\s*=\s*new RenderTarget\(\s*1\s*,\s*1\s*,\s*\{)([\s\S]*?)(\}\s*\)\s*;)/,(_,start,options,end)=>{
    assert.doesNotMatch(options,/count\s*:/);assert.match(options,/type:\s*HalfFloatType/);
    return start+options.trimEnd().replace(/,$/,'')+', count: 3 '+end;
  });
  replace(/const outputNode\s*=\s*outputStruct\(\s*colorOutput\s*,\s*lockOutput\s*\)\s*;/,
    'const diagnosticOutput = property("vec4");\nconst outputNode = outputStruct(colorOutput, lockOutput, diagnosticOutput);');
  replace(/colorOutput\.assign\(\s*output\s*\)\s*;/,
    `diagnosticOutput.assign(${fields[field]});\ncolorOutput.assign(output);`);
  replace(/colorOutput\.assign\(\s*this\.beautyNode\.sample\(\s*uv\(\s*\)\s*\)\s*\)\s*;/,
    match=>match+'\ndiagnosticOutput.assign(this.beautyNode.sample(uv()));');
  // Original color history copy must remain the only history texture copy.
  assert.equal([...source.matchAll(/renderer\.copyTextureToTexture\([^;]*this\._historyRenderTarget[^;]*;/g)].length,1);
  return source;
}
