export function decodeHalf(bits) {
  const sign = bits & 0x8000 ? -1 : 1;
  const exponent = (bits >>> 10) & 31, fraction = bits & 1023;
  if (exponent === 31) return fraction ? NaN : sign * Infinity;
  return exponent === 0 ? sign * 2 ** -24 * fraction
    : sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

const values = Float64Array.from({length:65536},(_,i)=>decodeHalf(i));
export function auditHalf(data,width,height,bounds) {
  if (!(data instanceof Uint16Array) || data.length !== width*height*4) throw Error('Expected tightly packed RGBA16F');
  const make = () => ({pixels:0,components:0,nan:0,infinity:0,nonfinitePixels:0,
    finiteMin:null,finiteMax:null,redFinite:0,redMean:null,redZeros:0});
  const whole=make(),roi=make(); let wholeSum=0,roiSum=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const included=x>=bounds.x0&&x<bounds.x1&&y>=bounds.y0&&y<bounds.y1;
    whole.pixels++;whole.components+=4;
    if(included){roi.pixels++;roi.components+=4;}
    let bad=false;
    for(let c=0;c<4;c++) {
      const bits=data[(y*width+x)*4+c],v=values[bits];
      if((bits&0x7c00)===0x7c00) {
        const kind=bits&1023?'nan':'infinity';
        whole[kind]++;if(included)roi[kind]++;bad=true;
      } else {
        whole.finiteMin=whole.finiteMin===null?v:Math.min(whole.finiteMin,v);
        whole.finiteMax=whole.finiteMax===null?v:Math.max(whole.finiteMax,v);
        if(included){roi.finiteMin=roi.finiteMin===null?v:Math.min(roi.finiteMin,v);roi.finiteMax=roi.finiteMax===null?v:Math.max(roi.finiteMax,v);}
        if(c===0){whole.redFinite++;wholeSum+=v;if(v===0)whole.redZeros++;
          if(included){roi.redFinite++;roiSum+=v;if(v===0)roi.redZeros++;}}
      }
    }
    if(bad){whole.nonfinitePixels++;if(included)roi.nonfinitePixels++;}
  }
  whole.redMean=whole.redFinite?wholeSum/whole.redFinite:null;
  roi.redMean=roi.redFinite?roiSum/roi.redFinite:null;
  return {whole,roi};
}
