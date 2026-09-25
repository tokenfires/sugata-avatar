import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {patch} from './route.mjs';

export async function install(page,out) {
  const arm=process.env.LOCK_ARM??'identity';
  assert.ok(['identity','copy-lock'].includes(arm));
  const routes=[],snapshots=[];
  fs.mkdirSync(out,{recursive:true});
  const sha=data=>createHash('sha256').update(data).digest('hex');
  await page.route(/\/(?:three_addons_tsl_display_TAAUNode__js|TAAUNode)\.js(?:\?|$)/,async route=>{
    const response=await route.fetch(),before=await response.text(),after=patch(before,arm);
    routes.push({url:route.request().url(),arm,beforeSHA256:sha(before),afterSHA256:sha(after)});
    fs.writeFileSync(path.join(out,'original-served.js'),before);
    fs.writeFileSync(path.join(out,'candidate-served.js'),after);
    await route.fulfill({response,body:after});
  });
  page.__auditLock=async label=>{
    const audit=await page.evaluate(async ({modulePath})=>{
      const {auditHalf,unpackHalfReadback}=await import(modulePath);
      const {stage,session}=globalThis.sugata;
      const renderer=stage.renderer,resolved=stage.temporal.node.passNode;
      if(resolved?.constructor.name!=='TAAUNode'||stage.temporal.sharpenNode!==null)throw Error('Unexpected resolve owner/sharpen path');
      const targets=[['color',resolved._resolveRenderTarget,0],['historyColor',resolved._historyRenderTarget,0],
        ...(resolved._resolveRenderTarget.textures.length===2?[['lock',resolved._resolveRenderTarget,1]]:[]),
        ['historyLock',resolved._historyRenderTarget,1]];
      const result={stats:stage.stats,frameId:renderer._nodes.nodeFrame.frameId,
        captureTime:renderer._nodes.nodeFrame.time,owner:resolved.constructor.name,
        hairMaterialType:session.hairMaterial.type,phase:session.hairMaterial.hairDitherPhase,
        defect:session.hairMaterial.hairDitherStep,hasInner:!!session.hairMaterial.hairDitherInnerOffset,targets:[],copies:{}};
      let color,lock;
      for(const [name,rt,index] of targets){
        const texture=rt.textures[index];
        const raw=await renderer.readRenderTargetPixelsAsync(rt,0,0,rt.width,rt.height,index);
        const {data,strideBytes,paddingBytes}=unpackHalfReadback(raw,rt.width,rt.height);
        // Full-target finite/lock statistics; ROI equals the whole target for this pipeline audit.
        const values=auditHalf(data,rt.width,rt.height,{x0:0,x1:rt.width,y0:0,y1:rt.height}).whole;
        result.targets.push({name,width:rt.width,height:rt.height,attachments:rt.textures.length,
          type:texture.type,gpuFormat:renderer.backend.get(texture).texture?.format,strideBytes,paddingBytes,values});
        if(name==='color')color=data;if(name==='lock')lock=data;
        const source=name==='historyColor'?color:name==='historyLock'?lock:null;
        if(source){let differences=0;for(let i=0;i<data.length;i++)if(data[i]!==source[i])differences++;result.copies[name]=differences;}
      }
      return result;
    },{modulePath:'/@fs'+path.resolve('tmp/hair-sep25/lock-runtime/half-audit.mjs')});
    assert.equal(audit.stats.backend,'webgpu');assert.equal(audit.stats.temporalAA,'taau');
    assert.equal(audit.stats.resolutionScale,.66);assert.equal(audit.captureTime,0);
    assert.equal(audit.hasInner,false);assert.equal(audit.phase,0);assert.equal(audit.defect,null);
    assert.equal(audit.targets.find(t=>t.name==='color').attachments,arm==='identity'?1:2);
    assert.equal(audit.copies.historyColor,0);
    if(arm==='copy-lock')assert.equal(audit.copies.historyLock,0);
    for(const t of audit.targets){
      assert.equal(t.gpuFormat,'rgba16float');assert.equal(t.type,1016);
      assert.equal(t.values.nan+t.values.infinity,0);
      if(arm==='identity'&&t.name==='historyLock')assert.equal(t.values.finiteMax,0);
    }
    snapshots.push({label:label??'reference-'+snapshots.length,...audit});
    fs.writeFileSync(path.join(out,'pipeline.json'),JSON.stringify({arm,routes,snapshots},null,2)+'\n');
  };
  return async()=>{
    assert.equal(routes.length,1);
    await page.__auditLock('startup');
    console.log('ACTUAL PIPELINE '+JSON.stringify({arm,routes,stats:snapshots[0].stats,attachments:snapshots[0].targets.map(t=>[t.name,t.attachments])}));
  };
}

export function saveMasks(out,name,raster,regions) {
  const serial={raster,regions:Object.fromEntries(Object.entries(regions).map(([key,value])=>[key,Buffer.from(value).toString('base64')]))};
  fs.writeFileSync(path.join(out,name+'-masks.json.gz'),gzipSync(JSON.stringify(serial),{level:9}));
}
