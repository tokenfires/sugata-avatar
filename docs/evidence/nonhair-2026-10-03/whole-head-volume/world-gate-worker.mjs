/** CPU-only world crossing worker. Parent owns timeout, termination and durable receipt. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {workerData,parentPort,threadId} from 'node:worker_threads';
import {measureHairSurface} from '../../../../tools/figure-pipeline/hair_surface.mjs';
const started=new Date().toISOString(),sha=b=>createHash('sha256').update(b).digest('hex');
try{
 const bytes=fs.readFileSync(workerData.worldPath);if(sha(bytes)!==workerData.worldSHA256)throw Error('World bytes changed before CPU gate');
 if(sha(fs.readFileSync('tools/figure-pipeline/hair_surface.mjs'))!==workerData.helperSHA256)throw Error('Intersection helper changed');
 const world=JSON.parse(bytes),all={min:[-Infinity,-Infinity,-Infinity],max:[Infinity,Infinity,Infinity]};
 const crossings=measureHairSurface(world.proposal,world.body,{headBounds:all,faceBounds:all,epsilon:1e-9,exampleLimit:10});
 parentPort.postMessage({pid:process.pid,threadId,command:'supervised world crossing worker on exact hidden actual posed arrays',started,finished:new Date().toISOString(),worldSHA256:workerData.worldSHA256,helperSHA256:workerData.helperSHA256,crossings,pass:crossings.head.pairs===0});
}catch(e){parentPort.postMessage({pid:process.pid,threadId,started,finished:new Date().toISOString(),pass:false,error:e.stack??String(e),worldSHA256:workerData.worldSHA256,helperSHA256:workerData.helperSHA256});}
