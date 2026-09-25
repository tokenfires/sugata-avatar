import assert from 'node:assert/strict';
export const fields={'no-clip':'clippedHistoryColor','no-lock':'lockedHistoryColor'};
export function patch(source,arm){
  if(arm==='identity')return source;
  assert.ok(Object.hasOwn(fields,arm));
  assert.doesNotMatch(source,/SUGATA_RESOLVE_ABLATION/);
  const pattern=arm==='no-clip'
    ? /const clippedHistoryColor\s*=\s*clipAABB\(\s*mean\.clamp\(\s*minColor\s*,\s*maxColor\s*\)\s*,\s*historyColor\s*,\s*minColor\s*,\s*maxColor\s*\)\s*;/
    : /const lockedHistoryColor\s*=\s*mix\(\s*clippedHistoryColor\s*,\s*historyColor\s*,\s*lock\s*\)\s*;/;
  assert.equal([...source.matchAll(new RegExp(pattern.source,'g'))].length,1);
  const replacement=arm==='no-clip'
    ? 'const clippedHistoryColor = historyColor; // SUGATA_RESOLVE_ABLATION no-clip'
    : 'const lockedHistoryColor = clippedHistoryColor; // SUGATA_RESOLVE_ABLATION no-lock';
  return source.replace(pattern,replacement);
}
