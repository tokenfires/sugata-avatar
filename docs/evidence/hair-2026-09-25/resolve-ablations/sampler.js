import {Fn,uint} from 'three/tsl';
// Counter-based experiment, not a production sampler. Unsigned operations wrap at 32 bits.
// The PCG permutation is the one used by installed three/src/nodes/math/Hash.js.
// Take exactly the high 24 bits before float conversion, preventing rounding to threshold 1.
export const thresholdNode=Fn(([pixel,id,counter])=>{
  const seed=pixel.x.bitXor(pixel.y.mul(uint(0x9e3779b9)))
    .bitXor(id.mul(uint(0x85ebca6b))).bitXor(counter.mul(uint(0xc2b2ae35)));
  const state=seed.mul(uint(747796405)).add(uint(2891336453));
  const word=state.shiftRight(state.shiftRight(uint(28)).add(uint(4))).bitXor(state).mul(uint(277803737));
  return word.shiftRight(uint(22)).bitXor(word).shiftRight(uint(8)).toFloat().mul(1/16777216).max(1e-6);
});
export function thresholdCPU(x,y,id,counter){
  const seed=(x^Math.imul(y,0x9e3779b9)^Math.imul(id,0x85ebca6b)^Math.imul(counter,0xc2b2ae35))>>>0;
  const state=(Math.imul(seed,747796405)+2891336453)>>>0;
  const word=Math.imul((state>>>((state>>>28)+4))^state,277803737)>>>0;
  return Math.max(((word>>>22)^word)>>>8,16777216e-6)/16777216;
}
