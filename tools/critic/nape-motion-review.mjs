// Build a local review interface from unmodified captured frames and projected geometric witnesses.
import fs from 'node:fs';
import path from 'node:path';
import {Matrix4,Vector3} from 'three';
const base='captures/nape-motion-v2';
const reports=['baseline','candidate'].map(arm=>JSON.parse(fs.readFileSync(`${base}/${arm}-rear-oblique-brown/report.json`)));
const audits=['baseline','candidate'].map(arm=>JSON.parse(fs.readFileSync(`${base}/${arm}-rear-oblique-brown/numerical-checks.json`)));
const overlays=reports.map((r,i)=>{
 const camera=new Matrix4().fromArray(r.setup.camera).invert(),projection=new Matrix4().fromArray(r.setup.projection),v=new Vector3();
 const project=p=>{v.fromArray(p).applyMatrix4(camera).applyMatrix4(projection);return [(v.x+1)*r.setup.canvas[0]/2,(1-v.y)*r.setup.canvas[1]/2];};
 const row=audits[i].rows.find(x=>x.frame===255),screen=row.selectedScreen;
 const point=(ring,side)=>screen.slice((ring*2+side)*3,(ring*2+side)*3+2).join(',');
 let svg='';
 for(let ring=0;ring<17;ring++)svg+=`<polyline points="${point(ring,0)} ${point(ring,1)}" stroke="#6be1ff" stroke-width="1" fill="none"/>`;
 for(const side of [0,1])svg+=`<polyline points="${Array.from({length:17},(_,ring)=>point(ring,side)).join(' ')}" stroke="#6be1ff" stroke-width="1" fill="none"/>`;
 for(const ex of row.crossings){const points=ex.points.map(project);svg+=`<polyline points="${points.map(p=>p.join(',')).join(' ')}" stroke="#ff4768" stroke-width="3" fill="none"/>`;for(const p of points)svg+=`<circle cx="${p[0]}" cy="${p[1]}" r="2" fill="#ff4768"/>`;}
 return svg;
});
const summary=audits.map(a=>a.summary);
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Nape motion comparison</title>
<style>body{font:16px system-ui;background:#101310;color:#e9ede2;max-width:1600px;margin:24px auto;padding:0 20px}h1{font:38px Georgia}p{max-width:95ch;line-height:1.5}.controls{display:flex;flex-wrap:wrap;align-items:center;gap:15px;margin:24px 0}button,input,select{font:inherit}button{padding:9px 16px}input[type=range]{flex:1;min-width:220px}main{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0}.plate{position:relative}.plate img{width:100%;display:block}.plate svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}figcaption{padding:12px;background:#20271e}.status{color:#eac590}a{color:#c5dfa1}@media(max-width:650px){main{grid-template-columns:1fr}}</style>
<h1>One nape card, during movement</h1><p class="status">Candidate remains experimental. Both arms cross the body surface at the sampled upward tilt. Fewer crossings do not constitute a clearance pass.</p>
<p>Same head sequence, body, camera, material, lights, renderer clock and fitted collision proxies. Only card281 geometry changes. This is a head-only diagnostic on the clothed Showcase, sampled at20images/second; other motion layers are disabled. The final2seconds show return/recovery, without a settling gate.</p>
<div class="controls"><button id="play">Play</button><label for="frame">Frame</label><input id="frame" type="range" min="0" max="185" value="85"><output id="time"></output><button id="witness">Upward-tilt witness</button><label><input type="checkbox" id="overlay"> Show geometry at frame255</label></div>
<main>${['baseline','candidate'].map((arm,i)=>`<figure><div class="plate"><img id="image${i}" alt="${arm} actual captured frame"><svg id="overlay${i}" viewBox="0 0 900 868" hidden>${overlays[i]}</svg></div><figcaption><strong>${arm==='baseline'?'Accepted source geometry':'Frozen short nape candidate'}</strong><br>Frame255: ${audits[i].rows.find(x=>x.frame===255).triangleBodyPairs} triangle/body pairs; minimum sampled vertex clearance ${audits[i].rows.find(x=>x.frame===255).minimumVertexClearanceMm.toFixed(2)}mm.</figcaption></figure>`).join('')}</main>
<p>Cyan traces the selected card's actual GPU triangle edges; red marks the first retained intersection witnesses projected with the same camera. The overlay does not model occlusion or alpha and cannot alone prove visible clipping. Turn it off to inspect the original rendered images. Root-frame deformation peaks atframe210; a larger angle alone is not an appearance defect.</p>
<p><a href="../../docs/evidence/hair-2026-09-29/authored-attribution/README.md">Original attribution and static evidence</a> · <a href="baseline-rear-oblique-brown/numerical-checks.json">Baseline numerical witnesses</a> · <a href="candidate-rear-oblique-brown/numerical-checks.json">Candidate numerical witnesses</a></p>
<script>const names=['baseline','candidate'],range=document.querySelector('#frame'),label=document.querySelector('#time'),overlay=document.querySelector('#overlay');let timer=null;function draw(){const f=Number(range.value)*3;label.value=f+' / 555 · '+(f/60).toFixed(2)+'s';names.forEach((arm,i)=>{document.querySelector('#image'+i).src=arm+'-rear-oblique-brown/frames/'+String(f).padStart(4,'0')+'.png';document.querySelector('#overlay'+i).style.display=overlay.checked&&f===255?'block':'none';});}range.oninput=draw;overlay.onchange=draw;document.querySelector('#witness').onclick=()=>{range.value=85;draw();};document.querySelector('#play').onclick=()=>{if(timer){clearInterval(timer);timer=null;}else timer=setInterval(()=>{range.value=(Number(range.value)+1)%186;draw();},50);document.querySelector('#play').textContent=timer?'Pause':'Play';};draw();</script></html>`;
fs.writeFileSync(path.join(base,'review.html'),html);
console.log(`${base}/review.html`);
