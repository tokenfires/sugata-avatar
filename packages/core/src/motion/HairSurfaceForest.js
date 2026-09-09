/** Independent BVH forest in the existing three query arrays.
 * Borrowed patches retain independent topology, boundary masks, histories and ownership.
 */
const invalid=message=>{throw Error(message);};
const integer=(n,name,max=0xffffffff)=>{if(!Number.isInteger(n)||n<0||n>max)invalid('Invalid '+name);return n;};
const finite=(a,n,name)=>{if(!(a instanceof Float32Array)||a.length!==n||!a.every(Number.isFinite))invalid('Invalid '+name);};
export function packForest(inputs,{chainCount}){
 integer(chainCount,'chain count',1000000);if(!chainCount||!Array.isArray(inputs)||!inputs.length)invalid('Nonempty domains required');
 let V=0,N=0,T=0;const ids=new Set(),assigned=new Set();
 const domains=inputs.map(({id,patch,motion,chains})=>{
  if(typeof id!=='string'||!id||ids.has(id))invalid('Unique domain ID required');ids.add(id);
  if(!patch||!motion||!Array.isArray(chains)||!chains.length)invalid('Invalid domain');
  for(const c of chains){integer(c,'chain',chainCount-1);if(assigned.has(c))invalid('Overlapping chain partition');assigned.add(c);}
  const vc=patch.positions.length/4,nc=patch.meta.length/4,tc=patch.triangles.length/4;
  for(const [x,n]of [[vc,'vertices'],[nc,'nodes'],[tc,'triangles']])if(!integer(x,n)||x>0x00ffffff)invalid('Invalid '+n);
  if(!(patch.meta instanceof Uint32Array)||!(patch.triangles instanceof Uint32Array)||!(patch.boundaryMasks instanceof Uint32Array)||patch.boundaryMasks.length!==tc)invalid('Invalid topology arrays');
  if(patch.meta[0]!==nc)invalid('Invalid root escape');
  for(let i=0;i<nc;i++){
   const [escape,first,count,right]=patch.meta.subarray(i*4,i*4+4);
   if(escape<=i||escape>nc||count&&first+count>tc||!count&&(right<=i+1||right>=escape))invalid('Invalid local BVH range');
  }
  for(let t=0;t<tc;t++){
   if(patch.triangles[t*4+3]>0x00ffffff||patch.boundaryMasks[t]>63)invalid('Invalid packed source/mask');
   for(let k=0;k<3;k++)if(patch.triangles[t*4+k]>=vc)invalid('Invalid local triangle vertex');
  }
  const d={id,patch,motion,chains:[...chains],vertexStart:V,vertexCount:vc,nodeStart:N,nodeEnd:N+nc,triangleStart:T,triangleEnd:T+tc};V+=vc;N+=nc;T+=tc;return d;
 });
 if(assigned.size!==chainCount)invalid('Incomplete chain partition');
 for(const [v,n]of [[V*4,'vertex address'],[N*2,'bounds address'],[N+T+chainCount,'topology address']])integer(v,n);
 const vertices=new Float32Array(V*16),bounds=new Float32Array(N*8),topology=new Uint32Array((N+T+chainCount)*4);
 const chainHeadersOffset=N+T;
 for(const d of domains){
  const {patch:p,nodeStart:ns,triangleStart:ts,vertexStart:vs}=d;
  for(let i=0;i<p.meta.length/4;i++){
   const [escape,first,count,right]=p.meta.subarray(i*4,i*4+4);
   // Unused interior first/leaf right retain their zero convention for exact inverse relocation.
   topology.set([escape+ns,count?first+ts:first,count,count?right:right+ns],(ns+i)*4);
  }
  for(let t=0;t<p.triangles.length/4;t++){
   const [a,b,c,source]=p.triangles.subarray(t*4,t*4+4);
   topology.set([a+vs,b+vs,c+vs,((source<<8)|p.boundaryMasks[t])>>>0],(N+ts+t)*4);
  }
  for(const chain of d.chains)topology.set([d.nodeStart,d.nodeEnd,d.triangleStart,d.triangleEnd],(chainHeadersOffset+chain)*4);
 }
 const stagingVertices=new Float32Array(vertices.length),stagingBounds=new Float32Array(bounds.length);let disposed=false;
 const live=()=>{if(disposed)invalid('Forest pack is disposed');};
 const update=()=>{
  live();
  // All input validation and staging complete before publishing either dynamic array.
  for(const d of domains){
   const {patch:p,motion:m,vertexStart:vs,vertexCount:vc,nodeStart:ns,nodeEnd:ne}=d;
   const arrays=[p.positions,p.normals,m.previousPositions,m.previousNormals];
   for(let block=0;block<4;block++){finite(arrays[block],vc*4,'vertex history');stagingVertices.set(arrays[block],(block*V+vs)*4);}
   finite(m.unionBoundsMin,(ne-ns)*4,'bounds min');finite(m.unionBoundsMax,(ne-ns)*4,'bounds max');
   for(let i=0;i<m.unionBoundsMin.length;i++)if(i%4<3&&m.unionBoundsMin[i]>m.unionBoundsMax[i])invalid('Inverted bounds');
   stagingBounds.set(m.unionBoundsMin,ns*4);stagingBounds.set(m.unionBoundsMax,(N+ns)*4);
  }
  vertices.set(stagingVertices);bounds.set(stagingBounds);
 };
 update();
 return{vertices,bounds,topology,domains,V,N,T,chainCount,chainHeadersOffset,update,
  headerForChain(chain){live();integer(chain,'chain',chainCount-1);return Array.from(topology.subarray((chainHeadersOffset+chain)*4,(chainHeadersOffset+chain+1)*4));},
  dispose(){disposed=true;},get disposed(){return disposed;}};
}
