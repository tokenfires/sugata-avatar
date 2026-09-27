// Restrict native channel labels to one ASCII filename component without changing their case.
export function claimArtifactLabel(label,seen) {
 if(typeof label!=='string'||label.length===0||/[^A-Za-z0-9-]/.test(label))throw Error('Unsafe readback artifact label');
 if(!(seen instanceof Set))throw Error('Owned label set required');
 if(seen.has(label))throw Error('Duplicate readback artifact label');
 seen.add(label);return label;
}
