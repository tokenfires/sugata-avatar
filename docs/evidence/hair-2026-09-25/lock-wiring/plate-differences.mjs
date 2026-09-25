import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {decodePng} from '../../../tools/critic/png.mjs';
import {patch} from './route.mjs';
const root='tmp/hair-sep25/lock-wiring',out=root+'/captures';
const sha=b=>createHash('sha256').update(b).digest('hex');
const original=fs.readFileSync(out+'/original-served.js','utf8');
for(const arm of ['identity','attachment-only','copy-lock'])
  assert.equal(patch(original,arm),fs.readFileSync(`${out}/${arm}-served.js`,'utf8'));
const report=JSON.parse(fs.readFileSync(out+'/report.json','utf8'));
const rows=[];
for(const r of report.results.filter(r=>r.config.wiring==='copy-lock'))for(const c of r.checkpoints){
  const key=`taau-${r.config.name}-p${r.config.phase}-n${c.count}`;
  const before=fs.readFileSync(`${out}/identity-${key}.png`),after=fs.readFileSync(`${out}/copy-lock-${key}.png`);
  const a=decodePng(before),b=decodePng(after);
  assert.equal(a.width,256);assert.equal(a.height,256);
  const metric=(roi)=>{
    let n=0,changed=0,squares=0,max=0;
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
      if(roi&&!(x>=72&&x<184&&y>=72&&y<184))continue;
      const i=(y*256+x)*4,delta=Math.abs(Math.round(a.pixels[i]*255)-Math.round(b.pixels[i]*255));
      n++;if(delta)changed++;squares+=delta*delta;max=Math.max(max,delta);
    }
    return {pixels:n,changedPixels:changed,rmsCodeValues:Math.sqrt(squares/n),maxCodeValues:max};
  };
  rows.push({name:key,beforeSHA256:sha(before),afterSHA256:sha(after),whole:metric(false),roi:metric(true)});
}
fs.writeFileSync(root+'/plate-differences.json',JSON.stringify(rows,null,2)+'\n');
console.log('PASS: all served modules equal their declared source patches; 21 full-image/ROI comparisons recorded.');
for(const row of rows.filter(r=>r.name.includes('half')&&!r.name.includes('blend')&&r.name.endsWith('n512')))console.log(row.name,row.whole,row.roi);
