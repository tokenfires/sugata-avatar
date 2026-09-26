// Executes native CPU Backend UID/accessor methods. No renderer, device, browser or GPU.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import Backend from '../../../../node_modules/three/src/renderers/common/Backend.js';
import TimestampQueryPool from '../../../../node_modules/three/src/renderers/common/TimestampQueryPool.js';
const backend=new Backend(),info={frame:42,render:{frameCalls:0},compute:{frameCalls:0}};backend.renderer={info};
const array=[{isComputeNode:true,id:17}], node={isComputeNode:true,id:18};
// Mirrors only the counter increment read directly at Renderer.js:2740 before its native UID call.
const uid=context=>{info.compute.frameCalls++;backend.updateTimeStampUID(context);return backend.getTimestampUID(context);};
const first=uid(array),second=uid(array),single=uid(node);
assert.equal(first,'r:0:undefined:f42');assert.equal(second,first);assert.equal(single,'c:3:18:f42');
backend.timestampQueryPool.render=new TimestampQueryPool();backend.timestampQueryPool.compute=new TimestampQueryPool();
backend.timestampQueryPool.compute.timestamps.set(first,1.25);
assert.equal(backend.hasTimestampQuery(first),false,'Prefix-based backend accessor checks the wrong pool.');
assert.equal(backend.timestampQueryPool.compute.hasTimestampQuery(first),true);
assert.equal(backend.timestampQueryPool.compute.getTimestamp(first),1.25);
info.frame++;info.render.frameCalls=0;info.compute.frameCalls=0;
const next=uid([{isComputeNode:true,id:17}]);assert.notEqual(next,first);
const files=['node_modules/three/src/renderers/common/Backend.js','node_modules/three/src/renderers/common/Renderer.js','node_modules/three/src/renderers/common/TimestampQueryPool.js',
    'node_modules/three/build/three.webgpu.js','packages/core/src/Avatar.js','packages/core/src/motion/HairDynamics.js','packages/core/src/render/CardRenderHistory.js'];
const sourceHashes=Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const result={groups:3,firstArrayUID:first,repeatedArrayUID:second,singleNodeUID:single,nextFrameArrayUID:next,
    evidence:'Actual native Backend UID/accessor execution with modeled Renderer counter sequence; not native Renderer.compute or GPU execution.',
    currentDefaultSource:'Avatar calls dynamics.update once; HairDynamics batches both fixed substeps plus rebuild into one renderer.compute(array); CardRenderHistory submits one separate single-node compute after draw.',
    limit:'Multiple array submissions with unchanged render.frameCalls and Three frame collide; unchanged native IDs remain rejected. No UID rewriting.',sourceHashes};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result,null,2));
