#!/usr/bin/env node
/**
 * Pinned original-to-composed bob01/g025 rest calibration. This is a measured
 * single-bake recipe, not a generic hair fitter or runtime/installation approval.
 * Formula stages retain the experiment's arithmetic; five bounded contact repairs
 * retain calibrated Float32 positions and validate their immediate source slices.
 * Every intermediate POSITION/NORMAL pair and the complete final GLB are pinned.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { BufferAttribute, BufferGeometry, Matrix4, Vector3 } from 'three';
import { readGlb, readPrimitive } from '../lut-bake/glb.mjs';
import { encodeGlb, sha256 } from './hair_fall.mjs';
import { measureHairSurface } from './hair_surface.mjs';
import { calibrationForBake, decodeBounds, CALIBRATION_SHA256 } from '../critic/portrait-calibration.mjs';
import { deriveCardGroom, createHairDynamics } from '../../packages/core/src/motion/HairDynamics.js';

export const G025_RECIPE_SHA256 = 'bbb1c0bd7e222877878484e25c45c62f518dcce63e80913863e44d8e59b7ba94';
const recipeBytes = fs.readFileSync( new URL( './fixtures/bob01-g025-composed-rest-v1.json', import.meta.url ) );
if ( sha256( recipeBytes ) !== G025_RECIPE_SHA256 ) throw new Error( 'g025 rest calibration changed; revalidate before replay.' );
const freeze = value => { if ( value && typeof value === 'object' ) { Object.values( value ).forEach( freeze ); Object.freeze( value ); } return value; };
export const G025_RECIPE = freeze( JSON.parse( recipeBytes ) );
export const G025_ORIGINAL = fileURLToPath( new URL( './fixtures/bob01-g025-original.glb', import.meta.url ) );
export const G025_BODY = fileURLToPath( new URL( '../../assets/figures/figure_g025.glb', import.meta.url ) );
const c = G025_RECIPE, CAP = 652, RINGS = 17, CARDS = 496;
const point = ( p, i ) => Array.from( p.slice( i * 3, i * 3 + 3 ) );
const center = ( p, card, ring ) => { const i = ( CAP + card * 34 + ring * 2 ) * 3; return [ 0,1,2 ].map( k => ( p[ i+k ] + p[ i+k+3 ] ) / 2 ); };
const floatHash = p => sha256( Buffer.from( new Float32Array( p ).buffer ) );
const smooth = x => { const t = Math.max( 0, Math.min( 1, x ) ); return t*t*(3-2*t); };
const geometryOf = p => new BufferGeometry().setAttribute( 'position', new BufferAttribute( new Float32Array( p.positions ), 3 ) ).setIndex( new BufferAttribute( new Uint32Array( p.indices ), 1 ) );
const cardVertices = card => Array.from( { length: 34 }, ( _, i ) => CAP + card * 34 + i );

function refreshNormals( state, indices, vertices ) {
    const geometry = geometryOf( { positions: state.positions, indices } );
    try {
        geometry.computeVertexNormals();
        for ( const v of vertices ) for ( let k=0; k<3; k++ ) state.normals[v*3+k] = geometry.attributes.normal.array[v*3+k];
    } finally { geometry.dispose(); }
}
function verifyStage( name, state, stages ) {
    const actual = { positionSha256: floatHash( state.positions ), normalSha256: floatHash( state.normals ) }, expected = c.stages[name];
    if ( actual.positionSha256 !== expected.positionSha256 || actual.normalSha256 !== expected.normalSha256 ) throw new Error( `g025 ${name} stage differs: ${JSON.stringify(actual)}` );
    stages.push( { name, ...actual, calibratedFileSha256: expected.fileSha256 } );
}

// Connectors use the original multiplication order; later side-fall probes used exponentiation.
// Keeping that distinction preserves the measured Float32 payload at every intermediate gate.
function hermite( state, source, card, start, endpoint, { restorePrefix = false, power = false } = {} ) {
    const a = center( source, card, start ), previous = center( source, card, start-1 ), height = a[1]-endpoint[1];
    if ( height <= 0 || previous[1] <= a[1] ) throw new Error( 'Invalid calibrated connector height.' );
    const slope = a.map( ( v,k ) => (v-previous[k])/(previous[1]-a[1])*height );
    for ( let ring = restorePrefix ? 0 : start+1; ring < RINGS; ring++ ) {
        const old = center( source, card, ring ); let t = (a[1]-old[1])/height;
        if ( restorePrefix ) t = Math.max( 0, Math.min( 1, t ) );
        else if ( t<0 || t>1 ) throw new Error( 'Calibrated side-fall extrapolates.' );
        const h00 = power ? 2*t**3-3*t*t+1 : 2*t*t*t-3*t*t+1;
        const h10 = power ? t**3-2*t*t+t : t*t*t-2*t*t+t;
        const h01 = power ? -2*t**3+3*t*t : -2*t*t*t+3*t*t;
        const target = ring <= start ? old : old.map( (v,k) => k===1 ? v : h00*a[k]+h10*slope[k]+h01*endpoint[k] );
        for ( let side=0; side<2; side++ ) for ( const k of restorePrefix ? [0,1,2] : [0,2] ) {
            const i = (CAP+card*34+ring*2+side)*3+k;
            state.positions[i] = source[i]+target[k]-old[k];
        }
    }
}

function replay( original ) {
    const state = { positions: new Float32Array(original.positions), normals: new Float32Array(original.normals) }, stages = [];
    const geometry = geometryOf( original ), groom = deriveCardGroom( geometry ); geometry.dispose();
    if ( groom.chainCount!==CARDS || groom.pointsPerChain!==RINGS || groom.cardVertexBase!==CAP ) throw new Error( 'g025 source topology changed.' );
    const p = c.fall.parameters, contacts = new Set(c.fall.originalBodyContactCards), failed = new Set(c.fall.failedCards);
    const selected = new Map(c.fall.selections.map(entry=>[entry.card,entry])), refreshed = [];
    for ( let card=78; card<462; card++ ) {
        const points = Array.from({length:RINGS},(_,r)=>point(groom.restCentres,card*RINGS+r));
        const offsets = Array.from({length:RINGS},(_,r)=>point(groom.restOffsets,card*RINGS+r));
        if ( points[16][1]>=p.releaseY-p.transition ) continue;
        let anchor=null;
        if ( points[0][1]<=p.releaseY ) anchor=points[0];
        else for(let r=1;r<RINGS;r++) if(points[r][1]<=p.releaseY&&points[r-1][1]>p.releaseY){const t=(points[r-1][1]-p.releaseY)/(points[r-1][1]-points[r][1]);anchor=points[r-1].map((v,k)=>v+(points[r][k]-v)*t);break;}
        if(!anchor)continue;
        const posterior=anchor[2]<p.rearSplitZ;
        if(posterior&&!contacts.has(card))continue;
        const reenters=points.some(x=>x[1]<p.releaseY-p.transition&&x[2]>p.faceZ&&(anchor[0]*x[0]<0||Math.abs(x[0])<Math.abs(anchor[0])-p.inwardExcursion));
        if((anchor[2]<p.frontZ||Math.abs(anchor[0])<p.sideX)&&!reenters&&!contacts.has(card))continue;
        if(failed.has(card))continue; // Measured first-stage failures retain their source geometry.
        const abrupt=points.some((x,r)=>r&&x[1]<p.abruptNeckY&&Math.hypot(...x.map((v,k)=>v-points[r-1][k]))>p.abruptLength);
        const preserve=!reenters&&!abrupt&&(anchor[2]<p.frontZ||Math.abs(anchor[0])<p.sideX), radial=[anchor[0],0,anchor[2]-p.headCentreZ],length=Math.hypot(...radial);
        for(let k=0;k<3;k++)radial[k]/=length||1;
        const entry=selected.get(card);let push=0;
        for(let i=0;i<(entry?.outwardSteps??0);i++)push+=p.outwardStep;
        if(entry&&(entry.mode!==(preserve?'preserve-path':posterior?'rear-fall':'front-outward')||JSON.stringify(entry.anchor)!==JSON.stringify(anchor)))throw Error('g025 fall classification changed.');
        let maxMove=0;
        for(let r=0;r<RINGS;r++){
            const x=points[r],t=r===0?0:smooth((anchor[1]-x[1]-Math.abs(offsets[r][1]))/p.transition);let target;
            if(preserve)target=[x[0]+radial[0]*push*t,x[1],x[2]+radial[2]*push*t];
            else if(posterior)target=[x[0]*(1-t)+(anchor[0]+radial[0]*push)*t,x[1],x[2]*(1-t)+(anchor[2]+radial[2]*push)*t];
            else{const sx=Math.sign(anchor[0])||1,sz=Math.sign(anchor[2]-p.rearSplitZ)||1;target=[x[0]*(1-t)+sx*Math.max(sx*x[0],sx*(anchor[0]+radial[0]*push))*t,x[1],x[2]*(1-t)+(p.rearSplitZ+sz*Math.max(sz*(x[2]-p.rearSplitZ),sz*(anchor[2]+radial[2]*push-p.rearSplitZ)))*t];}
            const delta=target.map((v,k)=>v-x[k]);maxMove=Math.max(maxMove,Math.hypot(...delta));
            for(let side=0;side<2;side++)for(let k=0;k<3;k++)state.positions[(CAP+card*34+r*2+side)*3+k]+=delta[k];
        }
        if(maxMove>1e-9){if(!entry)throw Error('Uncalibrated fall selection.');refreshed.push(...cardVertices(card));}
    }
    refreshNormals(state,original.indices,refreshed);verifyStage('fall',state,stages);

    // Restore the rear101 connector and replay the five bounded contact repairs.
    const rear=c.contacts.rearConnector;
    hermite(state,original.positions,rear.card,rear.startRing,rear.endpoint,{restorePrefix:true});
    for(const patch of c.contacts.localPatches){const offset=(CAP+patch.card*34)*3;if(floatHash(state.positions.slice(offset,offset+102))!==patch.inputPositionSha256)throw Error('Local contact patch source changed.');state.positions.set(patch.positions,offset);}
    refreshNormals(state,original.indices,c.contacts.normalCards.flatMap(cardVertices));verifyStage('contacts',state,stages);

    // The root44 isolation resets the prior contact edit before its measured support.
    const rootCard=c.root.card,a=center(original.positions,rootCard,c.root.reversalStart),side=Math.sign(a[0]);
    for(let r=0;r<RINGS;r++){const old=center(original.positions,rootCard,r),dx=r>c.root.reversalStart?side*Math.max(0,side*(a[0]-old[0])):0;for(let s=0;s<2;s++)for(let k=0;k<3;k++){const i=(CAP+rootCard*34+r*2+s)*3+k;state.positions[i]=original.positions[i]+(k===0?dx:0);}}
    refreshNormals(state,original.indices,cardVertices(rootCard));verifyStage('rootReversal',state,stages);
    const witness=c.root.supportWitness,amplitude=(witness.bodyZ+.0005-witness.point[2])/witness.point[3];
    for(let r=0;r<RINGS;r++)for(let s=0;s<2;s++)state.positions[(CAP+rootCard*34+r*2+s)*3+2]+=amplitude*smooth((r-11)/5);
    refreshNormals(state,original.indices,cardVertices(rootCard));verifyStage('rootSupport',state,stages);

    // Two independently attributed neckline stages preserve each own upper prefix.
    for(const[name,entries]of[['sideFall',c.sideFall],['actualBands',c.actualBands]]){
        const source=new Float32Array(state.positions),normalVertices=[];
        for(const[key,start]of Object.entries(entries)){const card=Number(key),a=center(source,card,start),tip=center(source,card,16);hermite(state,source,card,start,[a[0],tip[1],tip[2]],{power:true});for(let r=start;r<RINGS;r++)normalVertices.push(CAP+card*34+r*2,CAP+card*34+r*2+1);}
        refreshNormals(state,original.indices,normalVertices);verifyStage(name,state,stages);
    }
    // The final composition adds only card131 to the validated neckline geometry.
    const neckline={positions:new Float32Array(state.positions),normals:new Float32Array(state.normals)};
    hermite(state,original.positions,131,c.connector131.start,c.connector131.endpoint,{restorePrefix:true});
    const normalVertices=[];for(let r=0;r<RINGS;r++)for(let s=0;s<2;s++){const vi=CAP+131*34+r*2+s;if(r<c.connector131.start)for(let k=0;k<3;k++)state.normals[vi*3+k]=original.normals[vi*3+k];else normalVertices.push(vi);}
    refreshNormals(state,original.indices,normalVertices);verifyStage('composition',state,stages);
    return {state,stages,neckline};
}

function writeAttribute(glb,index,values){const a=glb.json.accessors[index],v=glb.json.bufferViews[a.bufferView];if(a.componentType!==5126||a.type!=='VEC3'||a.sparse||values.length!==a.count*3)throw Error('Unsupported calibrated attribute.');const base=(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??12,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<a.count;i++)for(let k=0;k<3;k++){const value=values[i*3+k];if(!Number.isFinite(value))throw Error('Nonfinite output.');glb.bin.writeFloatLE(value,base+i*stride+k*4);min[k]=Math.min(min[k],value);max[k]=Math.max(max[k],value);}if(a.min)a.min=min;if(a.max)a.max=max;}
const median = a => [...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
function solverReport(original,neckline,final){const geometries=[original,neckline,final].map(geometryOf),grooms=geometries.map(deriveCardGroom),medians=grooms.map(g=>median(g.arcLengths)),bones=calibrationForBake('g025').landmarks;try{const fits=geometries.map(geometry=>{const d=createHairDynamics({renderer:{},geometry});try{d.setHeadMatrix(new Matrix4(),new Matrix4(),new Matrix4());const f=d.fitColliders({shoulderLeft:new Vector3(...bones.clavicleLeftBind),shoulderRight:new Vector3(...bones.clavicleRightBind)});return{...f,skullCentre:f.skullCentre.toArray()};}finally{d.dispose();}});return{order:['original','neckline','composition'],medianArcsMm:medians.map(x=>x*1000),fits,card131:grooms.map((g,i)=>({arcMm:g.arcLengths[131]*1000,compliance:Math.min(3,Math.max(.3,medians[i]/g.arcLengths[131]))}))};}finally{geometries.forEach(g=>g.dispose());}}
function surfaceReport(hair,body){const all=measureHairSurface(hair,body,{headBounds:{min:[-2,-2,-2],max:[2,3,2]},faceBounds:decodeBounds(calibrationForBake('g025').proposed.face),exampleLimit:100000}),curtains=all.head.examples.filter(x=>x.card!==null&&x.card>=78&&x.card<462);if(all.face.pairs||curtains.length||all.head.pairs!==251||JSON.stringify(all.head.cards)!=='[2,3,50,66]')throw Error('Composed g025 authored surface changed.');return{face:all.face,allBody:all.head,movableCurtainPairs:curtains.length,strictAllBodyPass:false};}

export function transformHairLongFallG025(inputFile=G025_ORIGINAL,bodyFile=G025_BODY){
    const bytes=fs.readFileSync(inputFile),bodyBytes=fs.readFileSync(bodyFile),inputHash=sha256(bytes);
    if(sha256(bodyBytes)!==c.bodySha256||CALIBRATION_SHA256!==c.anatomySha256)throw Error('Wrong g025 body or anatomy calibration.');
    if(inputHash!==c.originalSha256&&inputHash!==c.outputSha256)throw Error('Input is neither immutable original g025 nor the exact composed output.');
    const glb=readGlb(inputFile),original=readPrimitive(glb,'hair_bob01'),body=readPrimitive(readGlb(bodyFile),'base.001');
    if(inputHash===c.outputSha256)return{bytes,report:{alreadyApplied:true,outputSha256:inputHash,surface:surfaceReport(original,body)}};
    const {state,stages,neckline}=replay(original),attributes=glb.json.meshes.find(m=>m.name==='hair_bob01').primitives[0].attributes;
    if(attributes.TANGENT!==undefined)throw Error('Uncalibrated tangent channel.');
    const changed=new Set();let allYExact=true,capsExact=true,fringeExact=true,root0Exact=true,maxWidthError=0,other495Exact=true;
    for(let vi=0;vi<original.vertexCount;vi++){const card=Math.floor((vi-CAP)/34),ring=Math.floor((vi-CAP)%34/2);for(let k=0;k<3;k++){const i=vi*3+k;if(state.positions[i]!==original.positions[i]){changed.add(card);if(k===1)allYExact=false;if(vi<CAP)capsExact=false;if(card>=462)fringeExact=false;if(ring===0)root0Exact=false;}if(card!==131&&(state.positions[i]!==neckline.positions[i]||state.normals[i]!==neckline.normals[i]))other495Exact=false;}}
    for(let card=0;card<CARDS;card++)for(let r=0;r<RINGS;r++){const i=(CAP+card*34+r*2)*3;maxWidthError=Math.max(maxWidthError,Math.hypot(...[0,1,2].map(k=>(state.positions[i+k+3]-state.positions[i+k])-(original.positions[i+k+3]-original.positions[i+k]))));}
    if(!allYExact||!capsExact||!fringeExact||!root0Exact||!other495Exact||maxWidthError>1e-7)throw Error('Composed preservation guard failed.');
    writeAttribute(glb,attributes.POSITION,state.positions);writeAttribute(glb,attributes.NORMAL,state.normals);glb.json.asset.extras={sugataHairG025Composition:c.stamp};
    const output=encodeGlb(glb);if(sha256(output)!==c.outputSha256||sha256(glb.bin)!==c.outputBinSha256)throw Error('Exact composed GLB/BIN payload differs.');
    return{bytes:output,report:{calibration:c.id,recipeSha256:G025_RECIPE_SHA256,alreadyApplied:false,inputSha256:inputHash,bodySha256:c.bodySha256,outputSha256:c.outputSha256,outputBinSha256:c.outputBinSha256,stages,preservation:{allYExact,capsExact,fringeExact,root0Exact,other495Exact,maxFullWidthVectorErrorMm:maxWidthError*1000,changedSourceCards:[...changed].sort((a,b)=>a-b)},solver:solverReport(original,{...original,...neckline},{...original,...state}),surface:surfaceReport({...original,...state},body),limits:c.limits}};
}
function aliases(a,b){if(path.resolve(a)===path.resolve(b))return true;if(fs.existsSync(a)&&fs.existsSync(b)){const x=fs.statSync(a),y=fs.statSync(b);return x.dev===y.dev&&x.ino===y.ino;}return false;}
export function writeG025Rest({input=G025_ORIGINAL,body=G025_BODY,output,report}){
    if(!output||!report||[input,body].some(p=>aliases(p,output)||aliases(p,report))||aliases(output,report))throw Error('Separate source/body/output/report paths required.');
    if(fs.existsSync(output)||fs.existsSync(report))throw Error('Refusing existing output or report.');
    const result=transformHairLongFallG025(input,body),files=[[output,result.bytes],[report,Buffer.from(JSON.stringify(result.report,null,2)+'\n')]],staged=[],published=[];
    try{for(const[destination,bytes]of files){fs.mkdirSync(path.dirname(destination),{recursive:true});const temporary=path.join(path.dirname(destination),`.g025-rest-${randomUUID()}.tmp`);fs.writeFileSync(temporary,bytes,{flag:'wx'});staged.push({destination,temporary});}for(const item of staged){fs.linkSync(item.temporary,item.destination);published.push(item.destination);}}catch(error){for(const p of published)fs.unlinkSync(p);throw error;}finally{for(const item of staged)if(fs.existsSync(item.temporary))fs.unlinkSync(item.temporary);}
    return result.report;
}
if(process.argv[1]&&fs.existsSync(process.argv[1])&&fs.realpathSync(process.argv[1])===fileURLToPath(import.meta.url)){const args=process.argv.slice(2);if(args.length!==2)throw Error('Usage: node hair_long_fall_g025.mjs separate-output.glb separate-report.json');const report=writeG025Rest({output:args[0],report:args[1]});console.log(JSON.stringify({outputSha256:report.outputSha256,facePairs:report.surface.face.pairs,movableCurtainPairs:report.surface.movableCurtainPairs,strictAllBodyPass:false}));}
