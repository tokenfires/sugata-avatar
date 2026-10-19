// Pure preparation shared by the real viewer and the declared CPU checks.
export function assertOpen(isClosed){if(isClosed())throw new Error('Closed continuation');}
export async function prepareInputs(bytes,digest,isClosed){
  assertOpen(isClosed);
  const meshSha=await digest(bytes);assertOpen(isClosed);
  if(meshSha!=='0e0460f465cd7c4570abd4510be9a8ba45cb0c3fc7983fa8e22e3e7e56e67fb1')throw new Error('Mesh bytes changed');
  const mesh=JSON.parse(new TextDecoder().decode(bytes));
  if(mesh.positions.length!==1102||mesh.quads.length!==1056)throw new Error('Mesh count changed');
  const positions=new Float32Array(mesh.positions.flat());
  const indices=new Uint16Array(mesh.quads.flatMap(q=>[q[0],q[1],q[2],q[0],q[2],q[3]]));
  const positionSha=await digest(positions);assertOpen(isClosed);
  const indexSha=await digest(indices);assertOpen(isClosed);
  return {positions,indices,meshSha,positionSha,indexSha};
}
