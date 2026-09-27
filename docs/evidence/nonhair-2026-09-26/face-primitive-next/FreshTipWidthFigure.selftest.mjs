import assert from 'node:assert/strict';
import {Group,Mesh,BufferGeometry,BufferAttribute,MeshBasicMaterial} from 'three';
import {installFreshTipWidthFigure,digestArray,exactValues} from './FreshTipWidthFigure.mjs';
let groups=0;
async function group(label,fn){await fn();console.log('PASS '+label);groups++;}
async function fixture(weight=-1){
 const pristinePositions=new Float32Array(14517*3),pristineNormals=new Float32Array(14517*3);for(let i=0;i<14517;i++){pristinePositions[i*3]=i/10000;pristineNormals[i*3+2]=1;}
 const positions=pristinePositions.slice(),normals=pristineNormals.slice();if(weight!==0){positions[0]=Math.fround(.001*weight);normals[0]=Math.fround(.1*weight);}
 const arrays={pristinePositions,pristineNormals,positions,normals},pins=Object.fromEntries(await Promise.all(Object.entries(arrays).map(async([k,a])=>[k,await digestArray(a)])));
 const root=new Group(),meshes=[];let disposed=0;const geometryDisposals=[];
 for(let i=0;i<7;i++){
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(i===0?pristinePositions.slice():new Float32Array([0,0,0,1,0,0,0,1,0]),3));
  g.setAttribute('normal',new BufferAttribute(i===0?pristineNormals.slice():new Float32Array([0,0,1,0,0,1,0,0,1]),3));
  g.setAttribute('_HIDE',new BufferAttribute(new Uint8Array(g.attributes.position.count),1));g.setIndex([0,1,2]);
  g.morphAttributes.position=[new BufferAttribute(new Float32Array(g.attributes.position.array.length),3)];g.morphTargetsRelative=true;
  g.addEventListener('dispose',()=>geometryDisposals.push(i));const m=new Mesh(g,new MeshBasicMaterial());m.name='mesh'+i;root.add(m);meshes.push(m);
 }
 const figure={root,meshes,body:meshes[0],dispose(){disposed++;for(const m of meshes){m.geometry.dispose();m.material.dispose();}}};
 class FakeFigure{static async load(url){assert.equal(this,FakeFigure);assert.equal(url,'/body.glb');return figure;}}
 return {Figure:FakeFigure,figure,args:{expectedURL:'/body.glb',weight,...arrays,pins},get disposed(){return disposed;},geometryDisposals};
}
await group('Native-shaped signature and exact fresh assignment preserve all real Three attribute owners',async()=>{
 const f=await fixture(),original=f.Figure.load,descriptor=Object.getOwnPropertyDescriptor(f.Figure,'load');const p=f.figure.body.geometry.attributes.position,n=f.figure.body.geometry.attributes.normal;
 const adapter=await installFreshTipWidthFigure(f.Figure,f.args);assert.equal(f.Figure.load.length,1);const loaded=await f.Figure.load('/body.glb');assert.equal(loaded,f.figure);assert.equal(f.Figure.load,original);assert.deepEqual(Object.getOwnPropertyDescriptor(f.Figure,'load'),descriptor);
 assert.equal(loaded.body.geometry.attributes.position,p);assert.equal(loaded.body.geometry.attributes.normal,n);assert.deepEqual(p.array,f.args.positions);assert.deepEqual(n.array,f.args.normals);assert.equal(p.version,1);assert.equal(n.version,1);assert.equal(f.disposed,0);
 adapter.assertAttached({figure:loaded,disposed:false});adapter.release();assert.equal(f.disposed,0);loaded.dispose();assert.equal(f.disposed,1);assert.equal(f.geometryDisposals.length,7);
});
await group('Zero assignment is byte exact; arrays are private from caller mutation after installation',async()=>{
 const f=await fixture(0),expected=f.args.positions.slice(),adapter=await installFreshTipWidthFigure(f.Figure,f.args);f.args.positions.fill(99);f.args.pristinePositions.fill(99);
 const loaded=await f.Figure.load('/body.glb');assert.deepEqual(loaded.body.geometry.attributes.position.array,expected);assert.equal(adapter.report().weight,0);loaded.dispose();
});
await group('Hash, arity, zero and readonly-descriptor negatives leave factory unmodified',async()=>{
 let f=await fixture(),original=f.Figure.load;await assert.rejects(()=>installFreshTipWidthFigure(f.Figure,{...f.args,pins:{...f.args.pins,positions:'bad'}}),/source drift/);assert.equal(f.Figure.load,original);
 f=await fixture();await assert.rejects(()=>installFreshTipWidthFigure(f.Figure,{...f.args,weight:0}),/Zero must be exact/);
 f=await fixture();f.Figure.load=async()=>f.figure;await assert.rejects(()=>installFreshTipWidthFigure(f.Figure,f.args),/signature/);
 f=await fixture();Object.defineProperty(f.Figure,'load',{writable:false});await assert.rejects(()=>installFreshTipWidthFigure(f.Figure,f.args),/descriptor/);
});
await group('Wrong URL is rejected before native loading and restores the descriptor',async()=>{
 const f=await fixture(),original=f.Figure.load,a=await installFreshTipWidthFigure(f.Figure,f.args);await assert.rejects(()=>f.Figure.load('/wrong.glb'),/Unexpected/);assert.equal(f.Figure.load,original);assert.equal(f.disposed,0);assert.equal(a.report().calls,1);
});
await group('Native factory rejection is preserved with no fabricated owner retirement',async()=>{
 const f=await fixture();f.Figure.load=async function load(url){throw Error('native loader failure');};const original=f.Figure.load,a=await installFreshTipWidthFigure(f.Figure,f.args);
 await assert.rejects(()=>f.Figure.load('/body.glb'),/native loader failure/);assert.equal(f.Figure.load,original);assert.equal(f.disposed,0);assert.equal(a.report().disposedUnpublished,0);
});
await group('Returned-owner precheck failure disposes exactly once before rejecting and restores descriptor',async()=>{
 const f=await fixture(),original=f.Figure.load;f.figure.body.geometry.attributes.position.array[0]=91;const a=await installFreshTipWidthFigure(f.Figure,f.args);
 await assert.rejects(()=>f.Figure.load('/body.glb'),/Loaded body/);assert.equal(f.disposed,1);assert.equal(f.Figure.load,original);assert.equal(a.report().disposedUnpublished,1);a.release();assert.equal(f.disposed,1);assert.equal(f.geometryDisposals.length,7);
});
await group('Foreign descriptor during original await is preserved and unpublished Figure retired',async()=>{
 const f=await fixture();let resume;f.Figure.load=function load(url){return new Promise(r=>{resume=r;});};const a=await installFreshTipWidthFigure(f.Figure,f.args),pending=f.Figure.load('/body.glb');
 const foreign=async function load(url){};f.Figure.load=foreign;resume(f.figure);await assert.rejects(()=>pending,AggregateError);assert.equal(f.Figure.load,foreign);assert.equal(f.disposed,1);assert.ok(a.report().events.some(e=>e.startsWith('restore-refused:')));
});
await group('Same-wrapper descriptor metadata theft is never overwritten; unpublished owner retired',async()=>{
 const f=await fixture();let resume;f.Figure.load=function load(url){return new Promise(r=>{resume=r;});};const a=await installFreshTipWidthFigure(f.Figure,f.args),pending=f.Figure.load('/body.glb');
 const current=Object.getOwnPropertyDescriptor(f.Figure,'load'),foreign={...current,enumerable:!current.enumerable};Object.defineProperty(f.Figure,'load',foreign);resume(f.figure);await assert.rejects(()=>pending,AggregateError);assert.deepEqual(Object.getOwnPropertyDescriptor(f.Figure,'load'),foreign);assert.equal(f.disposed,1);assert.equal(a.report().published,false);
});
await group('Factory replacement during asynchronous input hashing is detected before installation',async()=>{
 const f=await fixture(),pending=installFreshTipWidthFigure(f.Figure,f.args),foreign=async function load(url){};f.Figure.load=foreign;await assert.rejects(()=>pending,/during input admission/);assert.equal(f.Figure.load,foreign);assert.equal(f.disposed,0);
});
await group('Live equality distinguishes signed zero and refuses NaN instead of JSON coercion',async()=>{
 exactValues({a:[0,null,Infinity]},{a:[0,null,Infinity]});assert.throws(()=>exactValues([0],[-0]));assert.throws(()=>exactValues([NaN],[null]));assert.throws(()=>exactValues([NaN],[NaN]));
});
await group('Disposal errors aggregate with primary admission failure, without double retirement',async()=>{
 const f=await fixture();f.figure.body.geometry.setAttribute('tangent',new BufferAttribute(new Float32Array(14517*4),4));let count=0;f.figure.dispose=()=>{count++;throw Error('cleanup failed');};const a=await installFreshTipWidthFigure(f.Figure,f.args);
 await assert.rejects(()=>f.Figure.load('/body.glb'),e=>e instanceof AggregateError&&e.errors.length===2&&String(e.errors[0]).includes('tangent')&&String(e.errors[1]).includes('cleanup failed'));a.release();assert.equal(count,1);assert.equal(a.report().published,false);
});
await group('Release, reentrancy and captured-wrapper reuse refuse further native mutation',async()=>{
 let f=await fixture(),a=await installFreshTipWidthFigure(f.Figure,f.args),wrapper=f.Figure.load;a.release();await assert.rejects(()=>wrapper.call(f.Figure,'/body.glb'),/cannot be reused/);assert.equal(f.disposed,0);
 f=await fixture();let resume;f.Figure.load=function load(url){return new Promise(r=>{resume=r;});};a=await installFreshTipWidthFigure(f.Figure,f.args);wrapper=f.Figure.load;const pending=wrapper.call(f.Figure,'/body.glb');assert.throws(()=>a.release(),/in-flight/);await assert.rejects(()=>wrapper.call(f.Figure,'/body.glb'),/cannot be reused/);resume(f.figure);await pending;await assert.rejects(()=>wrapper.call(f.Figure,'/body.glb'),/cannot be reused/);assert.equal(f.disposed,0);assert.throws(()=>a.assertAttached({figure:{}}),/actual attached/);f.figure.dispose();
});
console.log(JSON.stringify({groups,passed:true,nativeRuns:0}));
