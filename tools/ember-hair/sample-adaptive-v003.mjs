// Seven-point adaptive selector. Retains0.350mm error; max64 intervals within existing geometry budget.
import {Vector3, Line3} from 'three';

export function sampleAdaptive(curve,controlCount,end,toleranceM,guard){
  const need=(ok,message)=>{if(!ok)throw Error(message);};
  need(Number.isInteger(controlCount)&&controlCount>=8&&controlCount<=12,'Sampler control count');
  need(Number.isFinite(end)&&end>0&&end<=1&&toleranceM===.00035,'Sampler endpoint or tolerance changed');
  const maxSegments=64,maxEvaluations=2048,cache=new Map();let evaluations=0;
  function at(q){
    need(Number.isFinite(q)&&q>=0&&q<=end,'Sampler parameter outside ribbon');
    if(cache.has(q))return cache.get(q);
    need(++evaluations<=maxEvaluations,'Sampler evaluation ceiling');guard();
    const point=curve.getPoint(q);need(point.toArray().every(Number.isFinite),'Non-finite sampled curve');
    cache.set(q,point);return point;
  }
  function interval(lo,hi,fractions){
    const chord=new Line3(at(lo),at(hi));let maxErrorM=-1,worst=null;
    for(const fraction of fractions){const q=lo+(hi-lo)*fraction,point=at(q);
      const nearest=chord.closestPointToPoint(point,true,new Vector3()),error=point.distanceTo(nearest);
      if(error>maxErrorM){maxErrorM=error;worst={q,fraction,point:point.toArray(),chordPoint:nearest.toArray()};}}
    return {lo,hi,maxErrorM,worst};
  }
  const scoreProbes=[.125,.25,.375,.5,.625,.75,.875],validationProbes=[.125,.25,.375,.5,.625,.75,.875];
  const knots=[0];for(let k=1;k<controlCount-1;k++){const q=k/(controlCount-1);if(q<end)knots.push(q);}knots.push(end);
  const intervals=knots.slice(0,-1).map((lo,i)=>interval(lo,knots[i+1],scoreProbes));let subdivisions=0;
  for(;;){
    guard();let wi=0;
    for(let k=1;k<intervals.length;k++)if(intervals[k].maxErrorM>intervals[wi].maxErrorM)wi=k;
    if(intervals[wi].maxErrorM<=toleranceM||intervals.length>=maxSegments)break;
    const {lo,hi}=intervals[wi],mid=(lo+hi)/2;
    intervals.splice(wi,1,interval(lo,mid,scoreProbes),interval(mid,hi,scoreProbes));subdivisions++;
  }
  const parameters=[intervals[0].lo,...intervals.map(i=>i.hi)];let worst=null;
  for(let i=0;i<parameters.length-1;i++){
    const value=interval(parameters[i],parameters[i+1],validationProbes);
    if(worst===null||value.maxErrorM>worst.maxErrorM)worst={index:i,...value};
  }
  need(parameters.length-1<=maxSegments&&parameters[0]===0&&parameters.at(-1)===end&&
    parameters.every((q,i)=>i===0||q>parameters[i-1]),'Invalid adaptive parameter list');
  // Validation failure stops this build. It never triggers a different selector or extra subdivision.
  need(worst.maxErrorM<=toleranceM,'Adaptive sampled chord error exceeds fixed limit: '+JSON.stringify(worst));
  return {parameters,segments:intervals.length,subdivisions,evaluations,maxEvaluations,
    maxSampledErrorM:worst.maxErrorM,worst,scoreProbes,validationProbes,
    continuousBoundCertified:false};
}
