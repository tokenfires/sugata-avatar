// Capture-local only: original loader bytes, one unpublished fresh Figure, no runtime writer.
const requireValue=(ok,label)=>{if(!ok)throw Error(label);};
const clone=x=>structuredClone(x);
const byteView=a=>new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
export async function digestArray(a){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',byteView(a)))).map(v=>v.toString(16).padStart(2,'0')).join('');}
function sameBytes(a,b){const x=byteView(a),y=byteView(b);return x.length===y.length&&x.every((v,i)=>v===y[i]);}
function arrayCopy(a){requireValue(ArrayBuffer.isView(a)&&!(a instanceof DataView)&&Array.from(a).every(Number.isFinite),'Expected finite typed attribute');return a.slice();}
const sameDescriptor=(a,b)=>!!a&&!!b&&['value','get','set','configurable','enumerable','writable'].every(k=>a[k]===b[k]);
function geometrySnapshot(figure){
 const entries=[];
 figure.root.traverse(o=>{if(o.isMesh){
  const g=o.geometry;requireValue(g&&g.attributes&&g.morphAttributes,'Expected owned mesh geometry');
  const attrs=Object.entries(g.attributes).map(([name,a])=>({name,a,array:a.array,values:arrayCopy(a.array),version:a.version,itemSize:a.itemSize,normalized:a.normalized}));
  const morphs=Object.entries(g.morphAttributes).flatMap(([name,list])=>list.map((a,i)=>({name,i,a,array:a.array,values:arrayCopy(a.array),version:a.version,itemSize:a.itemSize,normalized:a.normalized})));
  entries.push({o,g,attrs,morphs,index:g.index,indexArray:g.index?.array,indexValues:g.index?arrayCopy(g.index.array):null,
   material:o.material,skeleton:o.skeleton,position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray(),
   weights:o.morphTargetInfluences?.slice()??null,dictionary:clone(o.morphTargetDictionary??null),
   range:{...g.drawRange},groups:clone(g.groups),userData:clone(g.userData),relative:g.morphTargetsRelative,
   bounds:clone([g.boundingBox,g.boundingSphere]),bind:o.bindMatrix?.toArray()??null,inverseBind:o.bindMatrixInverse?.toArray()??null,
   skeletonBones:o.skeleton?.bones?.slice()??null,palette:o.skeleton?.boneMatrices?.slice()??null,inverses:o.skeleton?.boneInverses?.map(m=>m.toArray())??null});
 }});return entries;
}
export function exactValues(a,b,label='Exact value mismatch'){
 if(typeof a==='number'||typeof b==='number'){requireValue(typeof a==='number'&&typeof b==='number'&&!Number.isNaN(a)&&!Number.isNaN(b)&&Object.is(a,b),label);return;}
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object'){requireValue(Object.is(a,b),label);return;}
 const ak=Object.keys(a),bk=Object.keys(b);requireValue(ak.length===bk.length&&ak.every((k,i)=>k===bk[i]),label+' keys');for(const k of ak)exactValues(a[k],b[k],label+'.'+k);
}
const exact=exactValues;
function checkUnselected(figure,before,body,p,n){
 const meshes=[];figure.root.traverse(o=>{if(o.isMesh)meshes.push(o);});requireValue(meshes.length===before.length,'Mesh inventory changed');
 for(let i=0;i<before.length;i++){
  const b=before[i],o=meshes[i],g=o.geometry;requireValue(o===b.o&&g===b.g&&o.material===b.material&&o.skeleton===b.skeleton,'Native mesh ownership changed');
  exact(Object.keys(g.attributes),b.attrs.map(x=>x.name),'Attribute inventory changed');exact(Object.entries(g.morphAttributes).flatMap(([name,list])=>list.map((a,i)=>[name,i])),b.morphs.map(x=>[x.name,x.i]),'Morph inventory changed');
  for(const rec of [...b.attrs,...b.morphs]){
   const a=rec.i===undefined?g.attributes[rec.name]:g.morphAttributes[rec.name][rec.i];requireValue(a===rec.a&&a.array===rec.array,'Attribute owner changed');
   const selected=o===body&&rec.i===undefined&&(rec.name==='position'||rec.name==='normal');
   const expected=selected?(rec.name==='position'?p:n):rec.values;
   requireValue(sameBytes(a.array,expected),'Unexpected attribute bytes: '+o.name+'/'+rec.name);
   requireValue(a.itemSize===rec.itemSize&&a.normalized===rec.normalized&&a.version===rec.version+(selected?1:0),'Attribute metadata changed');
  }
  requireValue(g.index===b.index&&g.index?.array===b.indexArray&&(!b.index||sameBytes(g.index.array,b.indexValues)),'Topology changed');
  exact(o.position.toArray(),b.position,'Mesh position changed');exact(o.quaternion.toArray(),b.quaternion,'Mesh rotation changed');exact(o.scale.toArray(),b.scale,'Mesh scale changed');
  exact(o.morphTargetInfluences??null,b.weights,'Morph influence changed');exact(o.morphTargetDictionary??null,b.dictionary,'Morph dictionary changed');
  exact(g.drawRange,b.range,'Mask draw range changed');exact(g.groups,b.groups,'Groups changed');exact(g.userData,b.userData,'Geometry user data changed');exact([g.boundingBox,g.boundingSphere],b.bounds,'Geometry bounds changed');requireValue(g.morphTargetsRelative===b.relative,'Morph relativity changed');
  exact(o.bindMatrix?.toArray()??null,b.bind,'Bind matrix changed');exact(o.bindMatrixInverse?.toArray()??null,b.inverseBind,'Inverse bind changed');
  requireValue((o.skeleton?.bones??[]).length===(b.skeletonBones??[]).length&&(o.skeleton?.bones??[]).every((bone,j)=>bone===b.skeletonBones[j]),'Skeleton bone ownership changed');
  requireValue(!b.palette||sameBytes(o.skeleton.boneMatrices,b.palette),'Bone palette changed');exact(o.skeleton?.boneInverses?.map(m=>m.toArray())??null,b.inverses,'Bone inverses changed');
 }
}

/** Install before original Avatar creation. Happy-path release never disposes the returned owner. */
export async function installFreshTipWidthFigure(Figure,{expectedURL,weight,pristinePositions,pristineNormals,positions,normals,pins}){
 requireValue(Figure&&typeof Figure.load==='function'&&Figure.load.length===1,'Native Figure.load signature changed');
 const descriptor=Object.getOwnPropertyDescriptor(Figure,'load');requireValue(descriptor?.value===Figure.load&&descriptor.configurable&&descriptor.writable,'Unsupported native loader descriptor');const original=Figure.load;
 requireValue(typeof expectedURL==='string'&&expectedURL.length>0,'Expected URL required');
 requireValue([-1,0,1].includes(weight),'Diagnostic endpoint required');
 exact(Object.keys(pins).sort(),['pristinePositions','pristineNormals','positions','normals'].sort(),'Exact array pins required');
 const arrays={pristinePositions,pristineNormals,positions,normals},privateArrays={},expectedPins=clone(pins);
 for(const [name,array]of Object.entries(arrays)){
  requireValue(array instanceof Float32Array&&array.length===14517*3&&Array.from(array).every(Number.isFinite),'Expected finite full body Float32 '+name);
  privateArrays[name]=array.slice();requireValue(await digestArray(privateArrays[name])===expectedPins[name],'Array source drift: '+name);
 }
 if(weight===0){requireValue(sameBytes(privateArrays.positions,privateArrays.pristinePositions)&&sameBytes(privateArrays.normals,privateArrays.pristineNormals),'Zero must be exact');}
 requireValue(sameDescriptor(Object.getOwnPropertyDescriptor(Figure,'load'),descriptor),'Native loader descriptor changed during input admission');
 const receipt={weight,expectedURL,pins:expectedPins,calls:0,state:'installed',published:false,disposedUnpublished:0,events:[],failure:null};let returned=null;
 const installed={...descriptor,value:wrappedLoad};
 function restore(){
  const current=Object.getOwnPropertyDescriptor(Figure,'load');
  if(sameDescriptor(current,installed)){Object.defineProperty(Figure,'load',descriptor);receipt.events.push('descriptor-restored');return;}
  requireValue(sameDescriptor(current,descriptor),'Foreign Figure.load descriptor; not overwritten');
 }
 async function invoke(receiver,args){
  requireValue(receipt.state==='installed'&&receipt.calls===0,'Fresh Figure adapter cannot be reused');receipt.calls++;receipt.state='loading';
  try{
   requireValue(receiver===Figure&&args.length===1&&args[0]===expectedURL,'Unexpected Figure.load invocation');
   returned=await Reflect.apply(original,receiver,args);receipt.events.push('native-return');
   requireValue(sameDescriptor(Object.getOwnPropertyDescriptor(Figure,'load'),installed),'Figure.load ownership changed during load');
   requireValue(returned&&typeof returned.dispose==='function'&&returned.root&&Array.isArray(returned.meshes),'Expected fresh native Figure');
   const body=returned.body,p=body?.geometry?.attributes?.position,n=body?.geometry?.attributes?.normal;
   requireValue(returned.meshes.includes(body)&&returned.meshes.length===7,'Expected seven Figure meshes');
   requireValue(p&&n&&!p.isInterleavedBufferAttribute&&!n.isInterleavedBufferAttribute&&p.itemSize===3&&n.itemSize===3&&!p.normalized&&!n.normalized,'Writable body attribute ownership');
   requireValue(body.geometry.attributes.tangent===undefined,'Unexpected tangent owner');
   requireValue(p.array instanceof Float32Array&&n.array instanceof Float32Array&&sameBytes(p.array,privateArrays.pristinePositions)&&sameBytes(n.array,privateArrays.pristineNormals),'Loaded body differs from admitted pristine arrays');
   requireValue(p.array!==n.array&&!returned.root.parent,'Expected private unpublished Figure');
   const before=geometrySnapshot(returned),nodes=[];returned.root.traverse(o=>nodes.push({o,parent:o.parent,position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray(),matrix:o.matrix.toArray(),world:o.matrixWorld.toArray()}));
   const figureOwners={body:returned.body,root:returned.root,skeleton:returned.skeleton,meshes:returned.meshes.slice(),registry:returned.morphRegistry};
   receipt.meshes=before.map(x=>({name:x.o.name,attributes:x.attrs.map(a=>a.name),morphs:x.morphs.length}));
   p.array.set(privateArrays.positions);n.array.set(privateArrays.normals);p.needsUpdate=true;n.needsUpdate=true;
   checkUnselected(returned,before,body,privateArrays.positions,privateArrays.normals);
   receipt.actual={positions:await digestArray(p.array),normals:await digestArray(n.array)};exact(receipt.actual,{positions:expectedPins.positions,normals:expectedPins.normals},'Applied output digest');
   checkUnselected(returned,before,body,privateArrays.positions,privateArrays.normals);
   requireValue(returned.body===figureOwners.body&&returned.root===figureOwners.root&&returned.skeleton===figureOwners.skeleton&&returned.morphRegistry===figureOwners.registry&&returned.meshes.length===figureOwners.meshes.length&&returned.meshes.every((m,i)=>m===figureOwners.meshes[i]),'Figure ownership changed');
   const actualNodes=[];returned.root.traverse(o=>actualNodes.push(o));requireValue(actualNodes.length===nodes.length&&actualNodes.every((o,i)=>o===nodes[i].o),'Scene node inventory changed');
   for(const r of nodes){requireValue(r.o.parent===r.parent,'Parent ownership changed');exact(r.o.position.toArray(),r.position,'Node position changed');exact(r.o.quaternion.toArray(),r.quaternion,'Node quaternion changed');exact(r.o.scale.toArray(),r.scale,'Node scale changed');exact(r.o.matrix.toArray(),r.matrix,'Node local matrix changed');exact(r.o.matrixWorld.toArray(),r.world,'Node world matrix changed');}
   restore();receipt.state='returned';receipt.published=true;receipt.events.push('returned-to-native-avatar');return returned;
  }catch(error){
   const failures=[error];receipt.failure=String(error);receipt.state='failed';
   // Native success followed by our rejection is outside Avatar.swapFigure's cleanup try.
   if(returned&&!receipt.published){receipt.disposedUnpublished++;try{returned.dispose();receipt.events.push('unpublished-native-disposed');}catch(e){failures.push(e);receipt.events.push('unpublished-disposal-failed:'+String(e));}}
   try{restore();}catch(e){failures.push(e);receipt.events.push('restore-refused:'+String(e));}
   throw failures.length===1?error:new AggregateError(failures,'Fresh Figure admission and cleanup failed');
  }
 }
 function wrappedLoad(url){return invoke(this,arguments);}
 try{Object.defineProperty(Figure,'load',installed);requireValue(sameDescriptor(Object.getOwnPropertyDescriptor(Figure,'load'),installed)&&Figure.load.length===1,'Loader installation failed');}
 catch(e){if(sameDescriptor(Object.getOwnPropertyDescriptor(Figure,'load'),installed))Object.defineProperty(Figure,'load',descriptor);throw e;}
 return Object.freeze({
  report:()=>clone(receipt),
  release(){requireValue(receipt.state!=='loading','Cannot release an in-flight Figure');restore();if(receipt.state==='installed')receipt.state='released';return clone(receipt);},
  assertAttached(avatar){requireValue(receipt.state==='returned'&&receipt.published&&avatar?.figure===returned&&avatar.figure.body===returned.body&&!avatar.disposed,'Expected actual attached candidate owner');return clone(receipt);}
 });
}
