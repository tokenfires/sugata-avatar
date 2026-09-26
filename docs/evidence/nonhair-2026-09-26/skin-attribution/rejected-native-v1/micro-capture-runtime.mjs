// Capture-local owner. No core imports, shader replacement, grade/hair change or product hook.
// Clock policy is the existing alive.js takeOverFrameLoop / collar_capture_browser setup policy.
export const MICRO_CAPTURE = Object.freeze({baseFrame:1000000,settleDraws:64,defaultScale:.25,repeat:48});
const requireValue=(ok,label)=>{if(!ok)throw Error(label);};
const equal=(a,b,label)=>requireValue(JSON.stringify(a)===JSON.stringify(b),label);
function valueOf(value){
 if(value===null||typeof value==='boolean'||typeof value==='string')return value;
 if(typeof value==='number'){requireValue(Number.isFinite(value),'Nonfinite uniform');return value;}
 if(value?.toArray)return value.toArray().map(valueOf);
 if(Array.isArray(value)||ArrayBuffer.isView(value))return Array.from(value,valueOf);
 throw Error('Unsupported uniform value; do not silently omit it');
}
function uniforms(nodes){return Object.fromEntries(Object.entries(nodes).map(([key,node])=>[key,valueOf(node.value)]));}
function withoutMicro(values){const out=structuredClone(values);delete out.skin.microNormalScale;return out;}
export function createMicroCapture(showcase,{microNormalScale}){
 requireValue(microNormalScale===0||microNormalScale===MICRO_CAPTURE.defaultScale,'Only declared A/B strengths');
 const a=showcase.avatar,s=a.stage,r=s.renderer,n=r._nodes?.nodeFrame,skin=a.skin,body=a.figure.body;
 requireValue(!a.disposed&&!a.autoStart&&a.clockSeconds===0,'Fresh paused native owner required');
 requireValue(body.material===skin&&skin?.skinUniforms,'Actual body skin ownership required');
 requireValue(s.viewMode==='beauty'&&s.temporal?.mode==='taau'&&!s.multisampled,'Original balanced TAAU beauty required');
 requireValue(typeof r._animation?.stop==='function'&&r._animation.getAnimationLoop()===null&&typeof n?.update==='function','Idle native renderer clock required');
 requireValue(n.frameId>=0&&Number.isInteger(n.frameId)&&n.frameId<MICRO_CAPTURE.baseFrame,'Boot exceeds unique capture epoch');
 const scale=skin.skinUniforms.microNormalScale,repeat=skin.skinUniforms.microNormalRepeat;
 requireValue(scale?.value===MICRO_CAPTURE.defaultScale&&repeat?.value===MICRO_CAPTURE.repeat,'Current source defaults changed');
 const originalDraw=s.draw,drawDescriptor=Object.getOwnPropertyDescriptor(s,'draw'),uniformNodes={...skin.skinUniforms};
 const gradeNodes=Object.fromEntries(Object.entries(s.grade).filter(([key,node])=>key!=='grainFrame'&&node?.isUniformNode));
 const references={normalNode:skin.normalNode,map:skin.map,roughnessNode:skin.roughnessNode,colorNode:skin.colorNode,grade:s.grade,temporal:s.temporal};
 let closed=false,pending=null,draws=0;const trace=[];
 function materialReceipt(){return {skin:uniforms(skin.skinUniforms),material:Object.fromEntries(['roughness','metalness','ior','clearcoat','clearcoatRoughness','specularIntensity','color','specularColor','emissive','normalScale','opacity','transparent','depthWrite','side'].filter(key=>skin[key]!==undefined).map(key=>[key,valueOf(skin[key])])),grade:uniforms(gradeNodes),gradeStatic:{toneCurveName:s.grade.toneCurveName,sharpness:s.grade.sharpness,rebuiltGrainDefect:s.grade.rebuiltGrainDefect},exposure:r.toneMappingExposure};}
 const initialUniforms=materialReceipt(),otherUniforms=withoutMicro(initialUniforms);
 function live(){
  requireValue(!closed&&!a.disposed&&a.clockSeconds===0,'Capture owner retired or motion clock changed');
  requireValue(a.skin===skin&&body.material===skin&&s.renderer===r&&r._nodes.nodeFrame===n,'Native owner was rebound');
  for(const [key,node]of Object.entries(uniformNodes))requireValue(skin.skinUniforms[key]===node,'Skin uniform owner changed: '+key);
  requireValue(Object.keys(skin.skinUniforms).length===Object.keys(uniformNodes).length,'Skin uniform inventory changed');
  for(const [key,node]of Object.entries(gradeNodes))requireValue(s.grade[key]===node,'Grade uniform owner changed: '+key);
  for(const [key,node]of Object.entries(references))requireValue((key==='grade'||key==='temporal'?s:skin)[key]===node,'Material/render graph changed: '+key);
  equal(withoutMicro(materialReceipt()),otherUniforms,'Non-study uniform changed');
  requireValue(scale.value===microNormalScale,'Study uniform changed unexpectedly');
 }
 function clock(){return {frameId:n.frameId,time:n.time,deltaTime:n.deltaTime,clock:a.clockSeconds,temporal:s.temporal.frameEpoch(),grainFrame:s.grade.grainFrame.value,draws};}
 const before={nodeFrame:{frameId:n.frameId,time:n.time,deltaTime:n.deltaTime},clock:a.clockSeconds,temporal:s.temporal.frameEpoch(),grainFrame:s.grade.grainFrame.value,uniforms:initialUniforms};
 function wrappedDraw(...args){
  live();requireValue(pending!==null,'Unindexed native draw refused');
  requireValue(n.frameId===MICRO_CAPTURE.baseFrame+draws+1&&n.time===0&&n.deltaTime===0,'Renderer epoch drift before draw');
  const phase=pending,beforeDraw=clock();pending=null;
  const result=originalDraw.apply(this,args);draws++;
  live();const after=clock();
  requireValue(after.temporal.jitterIndex===draws%after.temporal.jitterPeriod,'Temporal resolve did not advance exactly once');
  requireValue(after.temporal.historyWidth===s.canvas.width,'Temporal history output width mismatch');
  requireValue(after.grainFrame===n.frameId%4096,'Actual grade grain phase mismatch');
  trace.push({phase,before:beforeDraw,after});return result;
 }
 // All validation precedes the only study material mutation. On setup failure restore our fields.
 try{
  scale.value=microNormalScale;r._animation.stop();n.frameId=MICRO_CAPTURE.baseFrame;n.time=0;n.deltaTime=0;n.lastTime=undefined;
  s.temporal.resetFrameEpoch();const reset=s.temporal.frameEpoch();
  requireValue(reset.jitterIndex===0&&reset.historyWidth===1,'Native temporal reset failed');
  s.draw=wrappedDraw;
 }catch(error){scale.value=MICRO_CAPTURE.defaultScale;if(s.draw===wrappedDraw){if(drawDescriptor)Object.defineProperty(s,'draw',drawDescriptor);else delete s.draw;}throw error;}
 const reset=clock();
 function begin(phase){live();requireValue(s.draw===wrappedDraw,'Capture draw ownership lost');requireValue(pending===null,'Prior indexed draw not consumed');
  requireValue(n.frameId===MICRO_CAPTURE.baseFrame+draws,'Uncontrolled renderer increment');
  n.update();n.time=0;n.deltaTime=0;r.info.frame=n.frameId;
  requireValue(n.frameId===MICRO_CAPTURE.baseFrame+draws+1,'Native node frame did not advance once');pending=phase;
 }
 return {
  setup:{before,reset,uniforms:materialReceipt(),policy:'Original native startup; one common capture epoch/history reset;64 public zero-delta updates; one indexed native Save image draw. No production cadence claim.'},
  async settle(){requireValue(draws===0,'Settle only once');for(let i=0;i<MICRO_CAPTURE.settleDraws;i++){await new Promise(requestAnimationFrame);begin('settle');await showcase.step(0);requireValue(pending===null,'Public step did not draw');}await r.backend.device.queue.onSubmittedWorkDone();return this.receipt();},
  prepareExport(){requireValue(draws===MICRO_CAPTURE.settleDraws,'Export only after declared settle');begin('native-save-image');},
  receipt(){live();return {clock:clock(),uniforms:materialReceipt(),trace:structuredClone(trace),pending};},
  releaseForRetirement(){requireValue(!closed,'Capture already retired');requireValue(s.draw===wrappedDraw,'Do not restore another owner\'s draw');
   const receipt={draws,pending,clock:clock(),uniforms:materialReceipt(),trace:structuredClone(trace)};
   if(drawDescriptor)Object.defineProperty(s,'draw',drawDescriptor);else delete s.draw;
   scale.value=MICRO_CAPTURE.defaultScale;closed=true;
   return {...receipt,drawRestored:s.draw===originalDraw,uniformRestored:scale.value===MICRO_CAPTURE.defaultScale,clockPolicy:'Stopped renderer and reset temporal history are intentionally not resumed; immediate native Avatar teardown must follow.'};
  }
 };
}
