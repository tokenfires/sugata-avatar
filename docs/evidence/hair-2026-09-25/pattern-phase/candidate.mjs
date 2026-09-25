import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const INNER_STEP = Math.SQRT2 - 1;
const frac = x => x - Math.floor(x);
export const innerValue = (frame, phase = 0, defect = null) =>
  frac(((defect === 'frozen-dither' ? 0 : frame) + phase) * INNER_STEP);

export function patch(source, arm) {
  assert.ok(['zero', 'candidate'].includes(arm));
  function replaceOnce(pattern, replacement) {
    assert.equal([...source.matchAll(new RegExp(pattern.source, 'g'))].length, 1, pattern.source);
    source = source.replace(pattern, replacement);
  }
  replaceOnce(/function hairDitherThresholdNode\(\s*offset\s*\)/,
    'function hairDitherThresholdNode(offset, inner)');
  replaceOnce(/return interleavedGradientNoise\(\s*screenCoordinate\.xy\s*\)\.add\(\s*offset\s*\)\.fract\(\)\.clamp\(\s*1e-6,\s*1\s*\);/,
    'return float(52.9829189).mul(screenCoordinate.xy.dot(vec4(0.06711056, 0.00583715, 0, 0).xy).add(inner).fract()).fract().add(offset).fract().clamp(1e-6, 1);');
  replaceOnce(/material\.alphaTestNode = hairDitherThresholdNode\(\s*material\.hairDitherOffset\s*\);/,
    `material.hairDitherInnerOffset = uniform(0).setGroup(renderGroup).onRenderUpdate((frame) => {
      const index = (material.hairDitherStep === 'frozen-dither' ? 0 : frame.frameId) + material.hairDitherPhase;
      const value = index * ${INNER_STEP};
      return ${arm === 'zero' ? '0' : 'value - Math.floor(value)'};
    });
    material.alphaTestNode = hairDitherThresholdNode(material.hairDitherOffset, material.hairDitherInnerOffset);`);
  return source + `\nglobalThis.__patternPhaseArm = ${JSON.stringify(arm)};\n`;
}

export async function install(page, out) {
  const arm = process.env.PATTERN_ARM ?? 'baseline';
  assert.ok(['baseline', 'zero', 'candidate'].includes(arm));
  const routes = [];
  if (arm !== 'baseline') {
    await page.route(/\/HairOIT\.js(?:\?|$)/, async route => {
      const response = await route.fetch();
      const before = await response.text();
      const after = patch(before, arm);
      const sha = s => createHash('sha256').update(s).digest('hex');
      routes.push({url: route.request().url(), beforeSHA256: sha(before), afterSHA256: sha(after)});
      await route.fulfill({response, body: after});
    });
  }
  return async () => {
    const phase = Number(process.env.PATTERN_PHASE ?? 0);
    const defect = process.env.PATTERN_DEFECT ?? null;
    assert.ok(Number.isFinite(phase));
    assert.ok([null, 'frozen-dither', 'white-dither'].includes(defect));
    const actual = await page.evaluate(({phase, defect}) => {
      const {stage, session} = globalThis.sugata;
      session.hairMaterial.hairDitherPhase = phase;
      session.hairMaterial.hairDitherStep = defect;
      return {arm: globalThis.__patternPhaseArm ?? 'baseline', stats: stage.stats,
        backend: stage.renderer.backend?.isWebGPUBackend,
        hasInner: !!session.hairMaterial.hairDitherInnerOffset,
        phase: session.hairMaterial.hairDitherPhase, defect: session.hairMaterial.hairDitherStep};
    }, {phase, defect});
    assert.equal(actual.arm, arm);
    assert.equal(actual.backend, true);
    assert.equal(actual.stats.temporalAA, 'taau');
    assert.equal(actual.stats.resolutionScale, 0.66);
    assert.equal(actual.hasInner, arm !== 'baseline');
    assert.equal(routes.length, arm === 'baseline' ? 0 : 1);
    fs.writeFileSync(path.join(out, 'pipeline.json'), JSON.stringify({actual, routes}, null, 2) + '\n');
    console.log('ACTUAL PIPELINE ' + JSON.stringify(actual));
  };
}
