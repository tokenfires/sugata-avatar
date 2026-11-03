// One bounded inspection of retained v045. No deformation or hair simulation.
export function installTurntable({canvas,prepare,draw,fail}) {
  const $=id=>document.getElementById(id);
  const state={active:false,running:false,degrees:0,lastSequence:null};
  const durationMs=18000,maxFrames=450,maxVideoBytes=12*1024*1024;
  let stopRequested=false,recordingUrl=null;
  const controls=[...document.querySelectorAll('[data-witness],#hair-shadow-toggle,#inspection-angle,#play-inspection,#record-inspection')];
  const lock=locked=>{for(const el of controls)el.disabled=locked;$('stop-inspection').disabled=!locked;};
  const configure=()=>{prepare();state.active=true;};
  const nextFrame=ms=>new Promise(resolve=>setTimeout(resolve,Math.max(0,ms)));
  function updateSummary(){
    $('motion-report').value=JSON.stringify({durationMs,maxFrames,maxVideoBytes,...state,
      qualification:'Whole-figure turntable; fixed expression and warm studio lighting. Hair is rigidly attached. This does not qualify hair dynamics, gaze, speech or likeness.'},null,2);
  }
  state.stop=()=>{stopRequested=true;};
  $('inspection-angle').onchange=async()=>{
    if(state.running)return;
    configure();state.degrees=Number($('inspection-angle').value);
    await draw();updateSummary();
  };
  async function play(record){
    if(state.running)return;
    let recorder,stream,recordingDone,recordingError=null,byteCount=0;
    const chunks=[];
    try{
      configure();state.degrees=0;stopRequested=false;
      state.running=true;state.lastSequence=null;lock(true);
      if(!await draw())throw Error('Initial inspection frame unavailable');
      if(record){
        const mime=['video/webm;codecs=vp8','video/webm;codecs=vp9','video/webm'].find(type=>MediaRecorder.isTypeSupported(type));
        if(!mime||!canvas.captureStream)throw Error('Browser canvas recording unavailable');
        stream=canvas.captureStream(24);
        recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:2500000});
        recordingDone=new Promise(resolve=>{recorder.onstop=resolve;});
        recorder.ondataavailable=e=>{
          byteCount+=e.data.size;
          if(byteCount>maxVideoBytes){recordingError=Error('Inspection recording exceeded 12 MiB');stopRequested=true;chunks.length=0;}
          else if(!recordingError&&e.data.size)chunks.push(e.data);
        };
        recorder.onerror=()=>{recordingError=Error('Canvas recorder failed');stopRequested=true;};
        recorder.start(1000);
      }
      const started=performance.now();let frames=0,maxCroppedVertices=0,maxRootResidualM=0;
      let minDegrees=360,maxDegrees=0,renderTotalMs=0;
      while(!stopRequested&&frames<maxFrames){
        const elapsed=performance.now()-started;
        if(elapsed>25000)throw Error('Inspection exceeded 25-second wall limit');
        const t=Math.min(1,elapsed/durationMs);
        state.degrees=360*t;
        const renderStart=performance.now(),frame=await draw();
        renderTotalMs+=performance.now()-renderStart;
        if(!frame)throw Error('Inspection frame failed');
        frames++;
        maxCroppedVertices=Math.max(maxCroppedVertices,frame.hairBounds.croppedVertices);
        maxRootResidualM=Math.max(maxRootResidualM,frame.rootResidualM);
        minDegrees=Math.min(minDegrees,state.degrees);maxDegrees=Math.max(maxDegrees,state.degrees);
        if(t===1)break;
        await nextFrame(1000/24-(performance.now()-renderStart));
      }
      state.lastSequence={frames,elapsedSeconds:(performance.now()-started)/1000,complete:!stopRequested&&maxDegrees===360,
        minDegrees,maxDegrees,maxCroppedVertices,maxRootResidualM,meanRenderMs:renderTotalMs/frames,
        recorded:record,recordingBytes:0,geometry:'Exact retained v045',
        sampling:'Elapsed-time progression, capped at 24 rendered frames per second; not a performance benchmark'};
      if(recorder){
        recorder.stop();await recordingDone;
        if(recordingError)throw recordingError;
        const blob=new Blob(chunks,{type:recorder.mimeType});
        if(recordingUrl)URL.revokeObjectURL(recordingUrl);
        recordingUrl=URL.createObjectURL(blob);
        $('save-inspection').href=recordingUrl;$('save-inspection').hidden=false;
        $('recording-preview').src=recordingUrl;$('recording-preview').hidden=false;
        state.lastSequence.recordingBytes=blob.size;
      }
      $('motion-status').textContent=state.lastSequence.complete
        ?'Inspection complete · 360° · draft with rigid hair'
        :'Inspection stopped · partial draft';
    }catch(error){
      if(recorder&&recorder.state!=='inactive'){recorder.stop();await recordingDone;}
      fail(error);
      $('motion-status').textContent='Inspection failed: '+error.message;
    }finally{
      for(const track of stream?.getTracks()??[])track.stop();
      state.running=false;lock(false);updateSummary();
    }
  }
  $('play-inspection').onclick=()=>void play(false);
  $('record-inspection').onclick=()=>void play(true);
  $('stop-inspection').onclick=()=>{stopRequested=true;};
  updateSummary();return state;
}
