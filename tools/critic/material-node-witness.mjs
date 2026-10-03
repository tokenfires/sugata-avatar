/** Read-only bounded installed Node graph; records actual wrappers, operand edges and values. */
export function materialNodeWitness(root) {
  if (!root?.isNode) throw Error('Missing actual active material node');
  const ids = new Map(), nodes = [];
  function visit(n) {
    if (ids.has(n)) return ids.get(n);
    if (nodes.length >= 512) throw Error('Material graph witness bound exceeded');
    const id = nodes.length; ids.set(n, id);
    const r = {id, type:n.type, nodeType:n.nodeType ?? null, name:n.name ?? null,
      op:n.op ?? null, method:n.method ?? null, scope:n.scope ?? null, edges:[]};
    nodes.push(r);
    const v=n.value;
    if (v?.isColor) r.value={kind:'color',linear:v.toArray(),hex:v.getHexString()};
    else if (typeof v==='number'||typeof v==='boolean') r.value=v;
    else if (v?.isTexture) r.value={kind:'texture',name:v.name,width:v.image?.width??null,height:v.image?.height??null};
    else if(v?.isVector2||v?.isVector3||v?.isVector4) r.value={kind:'vector',data:v.toArray()};
    else if(v!==undefined&&v!==null) throw Error('Unrecorded material-node value kind '+n.type);
    // Installed Node._getChildren owns its public property/index inventory and avoids cycles.
    for (const {property,index,childNode} of n._getChildren())
      r.edges.push({property,index:index??null,to:visit(childNode)});
    return id;
  }
  visit(root); return nodes;
}
