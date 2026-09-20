#!/usr/bin/env node
/** Reproduce the reviewed bob01/g050 v9 + card101 connector + lower card80/423 side-fall rest shape.
 * This is a pinned post-export calibration, not a generic haircut or runtime collision solver.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { BufferAttribute, BufferGeometry } from 'three';
import { readGlb, readPrimitive } from '../lut-bake/glb.mjs';
import { encodeGlb, geometryFingerprint, sha256, updateMovedFrames } from './hair_fall.mjs';
import { measureHairSurface, DEFAULT_FACE_BOUNDS } from './hair_surface.mjs';
import { deriveCardGroom } from '../../packages/core/src/motion/HairDynamics.js';

const STAMP = 'sugataHairLongFall';
export const LONG_FALL_DATA_SHA256 = '5c05a9703bcd1d35d86fd8862461cf53ff15e3861b83cfb22033c06d42ef779e';
const data = fs.readFileSync( new URL( './fixtures/bob01-g050-long-fall-v2.json', import.meta.url ) );
if ( sha256( data ) !== LONG_FALL_DATA_SHA256 ) throw new Error( 'Long-fall calibration data changed; revalidate before generating an asset.' );
const freeze = object => { if ( object && typeof object === 'object' ) { Object.values( object ).forEach( freeze ); Object.freeze( object ); } return object; };
export const LONG_FALL_CALIBRATION = freeze( JSON.parse( data ) );
const floatHash = values => sha256( Buffer.from( new Float32Array( values ).buffer ) );
const point = ( values, i ) => Array.from( values.slice( i * 3, i * 3 + 3 ) );
const smooth = fraction => { const t = Math.max( 0, Math.min( 1, fraction ) ); return t * t * ( 3 - 2 * t ); };
const c = LONG_FALL_CALIBRATION;
const correctedCards = [ ...c.cards.map( entry => entry.card ), ...c.sideFall.cards ].sort( ( a,b ) => a-b );
function attributesOf( glb ) { return glb.json.meshes.find( mesh => mesh.name === 'hair_bob01' ).primitives[ 0 ].attributes; }
function geometryOf( primitive ) {
    const g = new BufferGeometry();
    g.setAttribute( 'position', new BufferAttribute( new Float32Array( primitive.positions ), 3 ) );
    g.setIndex( new BufferAttribute( new Uint32Array( primitive.indices ), 1 ) ); return g;
}
function writeAttribute( glb, index, values ) {
    const a = glb.json.accessors[ index ], v = glb.json.bufferViews[ a.bufferView ];
    if ( a.componentType !== 5126 || a.type !== 'VEC3' || a.sparse || values.length !== a.count * 3 ) throw new Error( 'Long fall requires the calibrated dense Float32 geometry.' );
    const base = ( v.byteOffset ?? 0 ) + ( a.byteOffset ?? 0 ), stride = v.byteStride ?? 12;
    const min = [ Infinity,Infinity,Infinity ], max = [ -Infinity,-Infinity,-Infinity ];
    for ( let i = 0; i < a.count; i ++ ) for ( let k = 0; k < 3; k ++ ) {
        const value = values[ i * 3 + k ]; if ( ! Number.isFinite( value ) ) throw new Error( 'Non-finite long-fall output.' );
        glb.bin.writeFloatLE( value, base + i * stride + k * 4 ); min[ k ] = Math.min( min[ k ], value ); max[ k ] = Math.max( max[ k ], value );
    }
    if ( a.min ) a.min = min; if ( a.max ) a.max = max;
}
function payloadHash( glb ) {
    const json = structuredClone( glb.json );
    if ( json.asset?.extras ) delete json.asset.extras[ STAMP ];
    return sha256( encodeGlb( { ...glb, json } ) );
}
function expectedStamp() {
    return { calibration: c.id, calibrationDataSha256: LONG_FALL_DATA_SHA256, sourceSha256: c.sourceSha256,
        bodySha256: c.bodySha256, sourceGeometry: c.sourceGeometry, bodyGeometry: c.bodyGeometry,
        outputGeometry: c.outputGeometry, outputPayloadSha256: c.outputPayloadSha256,
        reproducedCandidateSha256: c.targetCandidateSha256, status: 'rest-shape reproduction; dynamic correction and tip-flare review pending' };
}
export function measureLongFallSurface( primitive, body ) {
    const bounds = { min: [ Infinity,Infinity,Infinity ], max: [ -Infinity,-Infinity,-Infinity ] };
    for ( let i = 0; i < primitive.positions.length; i ++ ) { const k = i % 3; bounds.min[ k ] = Math.min( bounds.min[ k ], primitive.positions[ i ] - .001 ); bounds.max[ k ] = Math.max( bounds.max[ k ], primitive.positions[ i ] + .001 ); }
    // The box encloses every hair vertex; clipping here cannot omit any hair/body crossing.
    const all = measureHairSurface( primitive, body, { headBounds: bounds, faceBounds: DEFAULT_FACE_BOUNDS } );
    const curtainIndices = [], curtainTriangleIds = [];
    for ( let t = 0; t < primitive.indices.length; t += 3 ) {
        const tri = Array.from( primitive.indices.slice( t, t + 3 ) );
        if ( tri.every( i => i >= c.capVertices + c.rootCards * 34 && i < c.capVertices + c.fringeStart * 34 ) ) { curtainIndices.push( ...tri ); curtainTriangleIds.push( t / 3 ); }
    }
    const curtains = measureHairSurface( { ...primitive, indices: curtainIndices }, body, { headBounds: bounds, faceBounds: DEFAULT_FACE_BOUNDS } );
    return { method: 'All hair triangles including caps against authored body; enclosing hair AABB broad phase; no alpha filtering.',
        allBody: all.head, face: all.face, movableCurtains: { ...curtains.head,
            cards: curtains.head.cards.map( card => card + c.rootCards ),
            examples: curtains.head.examples.map( example => ( { ...example, hairTriangle: curtainTriangleIds[ example.hairTriangle ], card: example.card === null ? null : example.card + c.rootCards } ) ) },
        strictAllBodyPass: all.head.pairs === 0, facePass: all.face.pairs === 0, movableCurtainsPass: curtains.head.pairs === 0,
        limitation: 'Original bob01 card ranges are diagnostic only. Remaining root-layer crossings are not exempted from strictAllBodyPass. No shell crossings excludes neither containment nor later motion collisions.' };
}

function validateFrozenSurface( surface ) {
    if ( surface.face.pairs !== 0 || surface.movableCurtains.pairs !== 0 || surface.allBody.pairs !== 67 || JSON.stringify( surface.allBody.cards ) !== '[68]' ) throw new Error( 'Frozen candidate triangle adjudication changed; review before producing an asset.' );
    return surface;
}

/** Read-only: return new bytes/report. Exact file hashes reject other bodies, metadata or skin data. */
export function transformHairLongFall( inputFile, bodyFile ) {
    const sourceBytes = fs.readFileSync( inputFile ), bodyBytes = fs.readFileSync( bodyFile );
    if ( sha256( bodyBytes ) !== c.bodySha256 ) throw new Error( 'Body file is not the calibrated figure_g050 source. Other bakes require separate measurements.' );
    const glb = readGlb( inputFile ), primitive = readPrimitive( glb, 'hair_bob01' ), body = readPrimitive( readGlb( bodyFile ), 'base.001' );
    if ( geometryFingerprint( body ) !== c.bodyGeometry ) throw new Error( 'Calibrated body geometry changed.' );
    const stamp = glb.json.asset?.extras?.[ STAMP ];
    if ( stamp !== undefined ) {
        const expected = expectedStamp();
        if ( ! stamp || Object.keys( stamp ).length !== Object.keys( expected ).length || Object.entries( expected ).some( ( [ key,value ] ) => stamp[ key ] !== value ) || geometryFingerprint( primitive ) !== c.outputGeometry || payloadHash( glb ) !== c.outputPayloadSha256 ) throw new Error( 'Long-fall stamp or corrected payload changed. Refusing a second deformation.' );
        return { bytes: sourceBytes, report: { calibration: c.id, alreadyApplied: true, inputSha256: sha256( sourceBytes ), outputSha256: sha256( sourceBytes ), stamp, surface: validateFrozenSurface( measureLongFallSurface( primitive, body ) ) } };
    }
    if ( sha256( sourceBytes ) !== c.sourceSha256 || geometryFingerprint( primitive ) !== c.sourceGeometry ) throw new Error( 'Input is not the immutable original bob01/g050 source. Fetch the Git LFS fixture; do not rename another bake or reuse a correction.' );
    const geometry = geometryOf( primitive );
    try {
        const groom = deriveCardGroom( geometry );
        if ( groom.chainCount !== c.cardCount || groom.pointsPerChain !== c.rings || groom.cardVertexBase !== c.capVertices ) throw new Error( 'Calibrated original bob01 layout changed.' );
        const positions = geometry.attributes.position.array, movedVertices = [];
        // Replay the measured search outcome instead of rerunning an adaptive clearance search.
        for ( const { card,anchor,push,drape,mode } of c.cards ) {
            const radial = [ anchor[0],0,anchor[2]-c.headCentreZ ], length = Math.hypot( ...radial );
            for ( let k=0;k<3;k++ ) radial[k] /= length || 1;
            for ( let ring=0;ring<c.rings;ring++ ) {
                const old = point( groom.restCentres, card*c.rings+ring ), halfY = Math.abs( groom.restOffsets[(card*c.rings+ring)*3+1] );
                const t = smooth( ( anchor[1]-old[1]-halfY ) / c.transition ); let target;
                if ( mode === 'preserve-path' ) target = [ old[0]+radial[0]*push*t,old[1],old[2]+radial[2]*push*t ];
                else if ( mode === 'rear-drape' ) target = [ old[0]*(1-t)+(anchor[0]+radial[0]*push)*t,old[1],old[2]*(1-t)+(anchor[2]+radial[2]*push)*t-drape*smooth((1.48-old[1])/.12) ];
                else { const sx=Math.sign(anchor[0])||1,sz=Math.sign(anchor[2])||1; target=[old[0]*(1-t)+sx*Math.max(sx*old[0],sx*(anchor[0]+radial[0]*push))*t,old[1],old[2]*(1-t)+sz*Math.max(sz*old[2],sz*(anchor[2]+radial[2]*push))*t]; }
                for(let side=0;side<2;side++){const vertex=c.capVertices+(card*c.rings+ring)*2+side;for(let k=0;k<3;k++)positions[vertex*3+k]+=target[k]-old[k];movedVertices.push(vertex);}
            }
        }
        const frames = updateMovedFrames( geometry, primitive, movedVertices );
        if ( floatHash( positions ) !== c.v9.positionsSha256 || floatHash( frames.normals ) !== c.v9.normalsSha256 ) throw new Error( 'Frozen v9 calibration no longer reproduces its reviewed geometry.' );
        const normals = new Float32Array( frames.normals ), card = c.connector.card, start = c.connector.startRing, end = c.connector.endRing;
        const center = ( array, ring ) => { const i=(c.capVertices+(card*c.rings+ring)*2)*3;return[0,1,2].map(k=>(array[i+k]+array[i+k+3])/2); };
        const a=center(primitive.positions,start),previous=center(primitive.positions,start-1),b=center(positions,end),height=a[1]-b[1];
        const slope=[0,1,2].map(k=>(a[k]-previous[k])/(previous[1]-a[1])*height);
        for(let ring=0;ring<c.rings;ring++){
            const old=center(primitive.positions,ring),t=Math.max(0,Math.min(1,(a[1]-old[1])/height));
            const h00=2*t*t*t-3*t*t+1,h10=t*t*t-2*t*t+t,h01=-2*t*t*t+3*t*t;
            const target=ring<=start?old:[0,1,2].map(k=>k===1?old[1]:h00*a[k]+h10*slope[k]+h01*b[k]);
            for(let side=0;side<2;side++){const vi=c.capVertices+(card*c.rings+ring)*2+side;for(let k=0;k<3;k++)positions[vi*3+k]=primitive.positions[vi*3+k]+target[k]-old[k];}
        }
        geometry.deleteAttribute( 'normal' ); geometry.computeVertexNormals();
        for(let ring=0;ring<c.rings;ring++)for(let side=0;side<2;side++){const vi=c.capVertices+(card*c.rings+ring)*2+side;for(let k=0;k<3;k++)normals[vi*3+k]=ring<start?primitive.normals[vi*3+k]:geometry.attributes.normal.array[vi*3+k];}
        if ( floatHash( positions ) !== c.connectorStage.positionsSha256 || floatHash( normals ) !== c.connectorStage.normalsSha256 ) throw new Error( 'Card101 connector stage no longer matches the reviewed intermediate.' );
        // The two authored lower guides crossed the front of the throat while remaining outside
        // the body. Keep their upper paths and cut heights, then end on their originating side.
        for ( const card of c.sideFall.cards ) {
            const start=c.sideFall.startRing, end=c.sideFall.endRing;
            const center = ring => { const i=(c.capVertices+(card*c.rings+ring)*2)*3;return[0,1,2].map(k=>(primitive.positions[i+k]+primitive.positions[i+k+3])/2); };
            const a=center(start), previous=center(start-1), tip=center(end), height=a[1]-tip[1];
            const slope=[0,1,2].map(k=>(a[k]-previous[k])/(previous[1]-a[1])*height), targetTip=[a[0],tip[1],tip[2]];
            for ( let ring=start+1;ring<=end;ring++ ) {
                const old=center(ring), t=(a[1]-old[1])/height;
                const h00=2*t**3-3*t*t+1,h10=t**3-2*t*t+t,h01=-2*t**3+3*t*t;
                const target=[0,1,2].map(k=>k===1?old[k]:h00*a[k]+h10*slope[k]+h01*targetTip[k]);
                for(let side=0;side<2;side++){const vi=c.capVertices+(card*c.rings+ring)*2+side;for(let k=0;k<3;k++)positions[vi*3+k]=primitive.positions[vi*3+k]+target[k]-old[k];}
            }
        }
        geometry.computeVertexNormals();
        for(const card of c.sideFall.cards)for(let ring=c.sideFall.startRing;ring<c.rings;ring++)for(let side=0;side<2;side++){const vi=c.capVertices+(card*c.rings+ring)*2+side;for(let k=0;k<3;k++)normals[vi*3+k]=geometry.attributes.normal.array[vi*3+k];}
        const attributes = attributesOf( glb ); writeAttribute( glb, attributes.POSITION, positions ); writeAttribute( glb, attributes.NORMAL, normals );
        // Empty extras is part of the canonical candidate payload after removing its scratch tag.
        glb.json.asset.extras = { ...glb.json.asset.extras };
        const corrected = readPrimitive( glb, 'hair_bob01' );
        if ( floatHash( corrected.positions ) !== c.outputPositionsSha256 || floatHash( corrected.normals ) !== c.outputNormalsSha256 || geometryFingerprint( corrected ) !== c.outputGeometry || payloadHash( glb ) !== c.outputPayloadSha256 ) throw new Error( 'Long-fall result differs from the exact frozen side-fall candidate. No output written.' );
        const surface = validateFrozenSurface( measureLongFallSurface( corrected, body ) );
        glb.json.asset.extras[ STAMP ] = expectedStamp(); const bytes = encodeGlb( glb );
        const changed = deriveCardGroom( geometry );
        return { bytes, report: { calibration: c.id, calibrationDataSha256: LONG_FALL_DATA_SHA256, alreadyApplied: false,
            inputSha256: sha256(sourceBytes), bodySha256: sha256(bodyBytes), outputSha256:sha256(bytes), outputGeometry:c.outputGeometry,
            outputPositionsSha256:c.outputPositionsSha256, outputNormalsSha256:c.outputNormalsSha256,
            reproducedCandidateSha256:c.targetCandidateSha256, metadataDifference:'Scratch-stage tags replaced by the portable provenance stamp; all other candidate payload bytes are identical after removing the stamp.',
            correctedCards:correctedCards.length, cards:correctedCards, surface,
            arcLengthChangesMm:correctedCards.map(card=>({card,before:groom.arcLengths[card]*1000,after:changed.arcLengths[card]*1000,delta:(changed.arcLengths[card]-groom.arcLengths[card])*1000})),
            limits:['Preserves all vertex Y values/cut, ring width vectors within Float32 rounding, root positions, caps and root-layer/fringe geometry. Normals follow the accepted whole-card v9 recompute and the card101 connector and card80/423 side-fall rules.',
                'Static movable-curtain and face shell tests pass; 67 unchanged root-layer card68 body crossings remain and strictAllBodyPass is false.',
                'Rest correction changes guide arc lengths and therefore the existing solver compliance reference. Tip flare and dynamic collision failure remain pending; no motion or frame-time claim.','Only this exact bob01/g050 source and body are calibrated. Other filenames and added attributes are refused.'] } };
    } finally { geometry.dispose(); }
}
function aliases( a,b ) {
    if ( path.resolve(a)===path.resolve(b) ) return true;
    if ( fs.existsSync(a)&&fs.existsSync(b) ){const x=fs.statSync(a),y=fs.statSync(b);return x.dev===y.dev&&x.ino===y.ino;}return false;
}
export function validateLongFallPaths( { input,body,output,report } ) {
    if ( [input,body,output].some(p=>typeof p!=='string'||!p) ) throw new Error('Input, body and separate output paths are required.');
    if ( aliases(output,body) ) throw new Error('Output must never overwrite the body.');
    if ( aliases(input,output) ) throw new Error('In-place mutation refused; use a separate output.');
    if ( report && [input,body,output].some(p=>aliases(p,report)) ) throw new Error('Report path must be separate from all assets.');
    for(const p of [output,report].filter(Boolean))if(fs.existsSync(p))throw new Error('Output/report exists; use a new evidence path.');
}
/** Stage every file before publishing. Exclusive links never replace existing destinations. */
function writeAtomicFiles( files ) {
    const staged=[],published=[];
    try {
        for(const[destination,bytes]of files){fs.mkdirSync(path.dirname(destination),{recursive:true});const temp=path.join(path.dirname(destination),`.hair-long-fall-${randomUUID()}.tmp`);const fd=fs.openSync(temp,'wx');staged.push({destination,temp});try{fs.writeFileSync(fd,bytes);}finally{fs.closeSync(fd);}}
        for(const entry of staged){fs.linkSync(entry.temp,entry.destination);published.push(entry);}
    } catch(error) {
        for(const entry of published){if(aliases(entry.destination,entry.temp))fs.unlinkSync(entry.destination);}throw error;
    } finally {for(const entry of staged)if(fs.existsSync(entry.temp))fs.unlinkSync(entry.temp);}
}
export function runHairLongFall( options ) {
    validateLongFallPaths(options);const result=transformHairLongFall(options.input,options.body);
    const files=[[options.output,result.bytes]];if(options.report)files.push([options.report,JSON.stringify(result.report,null,2)+'\n']);writeAtomicFiles(files);return result.report;
}
export function parseLongFallArgs( args ) {
    const options={};for(let i=0;i<args.length;i++){
        const flag=args[i];if(flag==='--help'&&args.length===1)return null;
        if(!['--input','--body','--output','--report'].includes(flag)||Object.hasOwn(options,flag.slice(2)))throw new Error(`Unknown or duplicate argument ${flag}.`);
        if(!args[i+1]||args[i+1].startsWith('--'))throw new Error(`${flag} requires a path.`);options[flag.slice(2)]=path.resolve(args[++i]);
    }for(const key of ['input','body','output'])if(!options[key])throw new Error(`--${key} is required.`);return options;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
    try{const options=parseLongFallArgs(process.argv.slice(2));if(options===null)console.log('node tools/figure-pipeline/hair_long_fall.mjs --input original-bob01-g050.glb --body figure_g050.glb --output new-candidate.glb [--report report.json]');else{const r=runHairLongFall(options);console.log(`${r.alreadyApplied?'Already reproduced':'Reproduced g050 rest candidate'}: ${options.output}\nsha256 ${r.outputSha256}\nStrict whole-body clearance: ${r.surface.strictAllBodyPass?'pass':'fail'} (${r.surface.allBody.pairs} pairs remain)`);}}
    catch(error){console.error(`hair_long_fall: ${error.message}`);process.exitCode=1;}
}
