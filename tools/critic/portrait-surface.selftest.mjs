#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Matrix4, Vector3 } from 'three';
import { measurePortraitSurface, CALIBRATED_BODY_SHA256 } from './portrait-surface.mjs';
import { readGlb, readPrimitive } from '../lut-bake/glb.mjs';
import { calibrationForBake, captureRegion, captureAnatomy } from './portrait-calibration.mjs';
import { measureNeckShoulder, originalBob01Parts } from './portrait-surface.mjs';
import { CAPTURE_REGION } from './portrait-clearance.mjs';

// Tiny real triangle captures test evidence integrity without requiring ignored browser files.
const directory = fs.mkdtempSync( path.join( os.tmpdir(), 'sugata-pose-integrity-' ) );
const body = [ -.02,1.48,.08, .02,1.48,.08, 0,1.54,.08 ];
const hair = [ 0,1.49,.07, 0,1.49,.09, 0,1.52,.08 ];
const translate = ( values, offset ) => values.map( ( value, i ) => value + offset[ i % 3 ] );
let checks = 0;
function check( name, test ) { test(); checks ++; console.log( `PASS ${ name }` ); }
function capture( { clear = false, shift = [ 0,0,0 ], matrixShift = shift, stopped = false, missing = false, errors = [] } = {} ) {
    const report = { options: { seconds: 1, fps: 1, stride: 1 }, errors,
        descriptor: { cardVertexBase: 0, cardVertexCount: 3, cardIndices: [ 0,1,2 ] },
        samples: [ { frame: 0, time: 0 }, { frame: 1, time: stopped ? 0 : 1 } ] };
    fs.writeFileSync( path.join( directory, 'report.json' ), JSON.stringify( report ) );
    for ( let frame = 0; frame < 2; frame ++ ) {
        const file = path.join( directory, `frame-000${ frame }.json` );
        if ( missing && frame === 1 ) { fs.rmSync( file, { force: true } ); continue; }
        const vertices = clear ? translate( hair, [ .06,0,0 ] ) : hair;
        fs.writeFileSync( file, JSON.stringify( { time: stopped ? 0 : frame,
            verticesSpace: 'world', vertexBase: 0, vertices: translate( vertices, shift ),
            bodyPositions: translate( body, shift ), bodyIndices: [ 0,1,2 ],
            headMatrix: new Matrix4().makeTranslation( ...matrixShift ).toArray() } ) );
    }
}
// These tiny synthetic fixtures exercise metadata adjudication, not real-body clearance.
const read = file => JSON.parse( fs.readFileSync( path.join( directory, file ), 'utf8' ) );
function mutate( file, change ) { const value = read( file ); change( value ); fs.writeFileSync( path.join( directory, file ), JSON.stringify( value ) ); }
function modernCapture( { style = 'bob01', clear = true } = {} ) {
    capture( { clear } );
    const runtime = () => ( { identity: { gender: .5, bake: 'figure_g050' },
        hair: { style, loadedStyle: style, bake: 'figure_g050', attached: true, solver: { chains: 1 } } } );
    mutate( 'report.json', report => {
        Object.assign( report.options, { hair: style, bake: 'g050', url: `http://localhost/src/portrait.html?capture&hair=${ style }` } );
        report.region = { ...CAPTURE_REGION, bodySha256: CALIBRATED_BODY_SHA256 };
        report.sourceHashes = { body: CALIBRATED_BODY_SHA256, groom: 'a'.repeat( 64 ) };
        report.loadedAssets = [ { url: 'http://localhost/body.glb', sha256: report.sourceHashes.body },
            { url: 'http://localhost/groom.glb', sha256: report.sourceHashes.groom } ];
        report.descriptor.report = runtime();
    } );
    for ( let frame = 0; frame < 2; frame ++ ) mutate( `frame-000${ frame }.json`, state => { state.report = runtime(); } );
}
const sourceBody=bake=>readPrimitive(readGlb(new URL(`../../assets/figures/figure_${bake}.glb`,import.meta.url)), 'base.001');
function calibratedCapture(bake,{shoulderCrossing=false,shift=[0,0,0]}={}){
    modernCapture();const c=calibrationForBake(bake),m=sourceBody(bake),gender=Number(bake.slice(1))/100;
    // A small triangle in the head region ensures a nonempty face comparison even when clear.
    let vertices=[-.6,c.proposed.face.min[1]+.02,c.proposed.face.min[2]+.03,-.59,c.proposed.face.min[1]+.02,c.proposed.face.min[2]+.03,-.6,c.proposed.face.min[1]+.03,c.proposed.face.min[2]+.03];
    let indices=[0,1,2];
    if(shoulderCrossing){
        const t=c.neckPatchTriangleIds.find(t=>[0,1,2].every(k=>m.positions[m.indices[t*3+k]*3+1]<c.proposed.face.min[1]-.02));
        const [a,b,d]=[0,1,2].map(k=>new Vector3().fromArray(m.positions,m.indices[t*3+k]*3));
        const center=a.clone().add(b).add(d).multiplyScalar(1/3),normal=b.clone().sub(a).cross(d.clone().sub(a)).normalize();
        const triangle=[center.clone().addScaledVector(normal,.001),center.clone().addScaledVector(normal,-.001),center.clone().lerp(a,.2)];
        vertices.push(...triangle.flatMap(p=>p.toArray()));indices.push(3,4,5);
    }
    const runtime={identity:{gender,bake:`figure_${bake}`},hair:{style:'bob01',loadedStyle:'bob01',bake:`figure_${bake}`,attached:true,solver:{chains:1}}};
    mutate('report.json',r=>{Object.assign(r.options,{bake,url:`http://localhost/?hair=bob01&bake=${bake}&gender=${gender}`});r.region={...captureRegion(bake),bodySha256:c.hashes.file};r.anatomy=captureAnatomy(bake);r.sourceHashes.body=c.hashes.file;r.loadedAssets[0].sha256=c.hashes.file;r.descriptor.report=runtime;r.descriptor.cardVertexCount=vertices.length/3;r.descriptor.cardIndices=indices;r.descriptor.bodyGeometryHashes=r.anatomy.geometryHashes;});
    for(let frame=0;frame<2;frame++)mutate(`frame-000${frame}.json`,r=>{r.report=runtime;r.vertices=translate(vertices,shift);r.bodyPositions=translate(Array.from(m.positions),shift);r.bodyIndices=Array.from(m.indices);r.headMatrix=new Matrix4().makeTranslation(...shift).toArray();});
}
try {
    check( 'a complete intersecting capture rejects both measured poses', () => {
        capture(); const result = measurePortraitSurface( directory );
        assert.equal( result.gate.pass, false ); assert.deepEqual( result.results.map( p => p.face.pairs ), [ 1,1 ] );
    } );
    check( 'a complete clear capture passes with nonempty calibrated geometry', () => {
        capture( { clear: true } ); const result = measurePortraitSurface( directory );
        assert.equal( result.gate.pass, true ); assert.ok( result.results.every( p => p.selectedHairTriangles && p.selectedBodyTriangles ) );
        assert.equal( result.calibration.status, 'legacy-unattested' );
    } );
    check( 'matching world/head translations preserve the intersection verdict', () => {
        capture( { shift: [ 2,3,-4 ] } ); const result = measurePortraitSurface( directory );
        assert.equal( result.gate.pass, false ); assert.deepEqual( result.results.map( p => p.face.pairs ), [ 1,1 ] );
    } );
    check( 'mismatched head coordinates cannot pass by emptying the selection', () => {
        capture( { matrixShift: [ 0,10,0 ] } ); assert.throws( () => measurePortraitSurface( directory ), /Empty calibrated comparison/ );
    } );
    check( 'a stopped clock cannot certify a completed duration', () => {
        capture( { clear: true, stopped: true } ); assert.throws( () => measurePortraitSurface( directory ), /clock does not match/ );
    } );
    check( 'a missing measured frame cannot certify a complete capture', () => {
        capture( { clear: true, missing: true } ); assert.throws( () => measurePortraitSurface( directory ), /frame files/ );
    } );
    check( 'reported rendering errors prevent a geometry certificate', () => {
        capture( { clear: true, errors: [ 'GPU failure' ] } ); assert.throws( () => measurePortraitSurface( directory ), /Capture has errors/ );
    } );
    check( 'both attested g050 styles retain clear and crossing geometric verdicts', () => {
        for ( const style of [ 'bob01', 'bob02' ] ) for ( const clear of [ true, false ] ) {
            modernCapture( { style, clear } ); const result = measurePortraitSurface( directory );
            assert.equal( result.gate.pass, clear ); assert.equal( result.calibration.status, 'attested-g050' );
            assert.equal( result.calibration.hair, style ); assert.equal( result.calibration.bodySha256, CALIBRATED_BODY_SHA256 );
            assert.deepEqual( result.results.map( p => p.face.pairs ), clear ? [ 0,0 ] : [ 1,1 ] );
        }
    } );
    check( 'changed, partial, unknown or unsupported regions cannot produce a pass', () => {
        for ( const change of [ r => { r.minY = 1.5; }, r => { r.maxY = 1.6; }, r => { r.minZ = .09; },
            r => { r.bake = 'g100'; }, r => { r.gender = 1; }, r => { r.calibration = 'unreviewed'; },
            r => { delete r.bodySha256; }, r => { r.minX = -.01; } ] ) {
            modernCapture(); mutate( 'report.json', r => change( r.region ) );
            assert.throws( () => measurePortraitSurface( directory ), /region\/body calibration/ );
        }
    } );
    check( 'a different body cannot inherit calibration even when all recorded hashes agree', () => {
        modernCapture(); mutate( 'report.json', r => {
            r.region.bodySha256 = r.sourceHashes.body = r.loadedAssets[ 0 ].sha256 = 'b'.repeat( 64 );
        } );
        assert.throws( () => measurePortraitSurface( directory ), /region\/body calibration/ );
        modernCapture(); mutate( 'report.json', r => { r.sourceHashes.body = 'b'.repeat( 64 ); } );
        assert.throws( () => measurePortraitSurface( directory ), /source hashes/ );
    } );
    check( 'missing, duplicate or inconsistent loaded responses are rejected', () => {
        for ( const change of [ r => { delete r.loadedAssets; }, r => { r.loadedAssets.pop(); },
            r => { r.loadedAssets.push( r.loadedAssets[ 1 ] ); }, r => { r.loadedAssets[ 0 ].sha256 = 'b'.repeat( 64 ); },
            r => { r.sourceHashes.groom = 'wrong'; } ] ) {
            modernCapture(); mutate( 'report.json', change );
            assert.throws( () => measurePortraitSurface( directory ), /provenance|exactly one loaded|source hashes/ );
        }
    } );
    check( 'descriptor selection and every frame must attest the requested live groom', () => {
        const changes = [ r => { r.hair.loadedStyle = 'bob02'; }, r => { r.hair.attached = false; },
            r => { r.hair.bake = 'figure_g100'; }, r => { r.identity.gender = 1; }, r => { r.hair.solver = null; } ];
        for ( const file of [ 'report.json', 'frame-0001.json' ] ) for ( const change of changes ) {
            modernCapture(); mutate( file, r => change( file === 'report.json' ? r.descriptor.report : r.report ) );
            assert.throws( () => measurePortraitSurface( directory ), /runtime selection disagrees/ );
        }
        modernCapture(); mutate( 'frame-0001.json', r => { delete r.report; } );
        assert.throws( () => measurePortraitSurface( directory ), /runtime selection disagrees/ );
    } );
    check( 'URL conflicts and unsupported explicit selection fail replay validation', () => {
        for ( const change of [ o => { o.url = 'http://localhost/?hair=bob02'; }, o => { o.hair = 'bob03'; },
            o => { o.bake = 'g100'; }, o => { o.url = 'http://localhost/?hair=bob01&gender=1'; } ] ) {
            modernCapture(); mutate( 'report.json', r => change( r.options ) );
            assert.throws( () => measurePortraitSurface( directory ), /contradicts|selection|calibration/ );
        }
    } );
    check( 'partial new metadata cannot fall back to the historical unattested path', () => {
        for ( const change of [ r => { r.region = null; }, r => { r.loadedAssets = []; },
            r => { r.options.hair = 'bob01'; }, r => { r.options.bake = 'g050'; }, r => { r.sourceHashes = { body: CALIBRATED_BODY_SHA256 }; } ] ) {
            capture( { clear: true } ); mutate( 'report.json', change );
            assert.throws( () => measurePortraitSurface( directory ), /region\/body calibration/ );
        }
    } );
    check('all five attested correspondence captures replay with exact body topology and separate gates',()=>{
        for(const bake of ['g000','g025','g050','g075','g100']){
            calibratedCapture(bake);const r=measurePortraitSurface(directory);assert.equal(r.gate.pass,true);assert.equal(r.gate.neckShoulderPass,true);assert.equal(r.calibration.status,'attested-correspondence-v1');assert.equal(r.calibration.bake,bake);assert.equal(r.results[0].neckShoulder.selectedBodyTriangles,1872);
        }
    });
    check('posed shoulder crossings reject a face-clear capture and follow body translation',()=>{
        for(const shift of [[0,0,0],[2,3,-4]]){
            calibratedCapture('g000',{shoulderCrossing:true,shift});const r=measurePortraitSurface(directory);assert.equal(r.gate.facePass,true);assert.equal(r.gate.neckShoulderPass,false);assert.equal(r.gate.pass,false);assert.ok(r.results[0].neckShoulder.pairs>0);
        }
        const r=read('frame-0000.json'),d=read('report.json').descriptor;
        const before=measureNeckShoulder(r.vertices,d.cardIndices,r.bodyPositions,r.bodyIndices,'g000');
        const moved=measureNeckShoulder(r.vertices,d.cardIndices,translate(r.bodyPositions,[0,-.5,0]),r.bodyIndices,'g000');
        assert.ok(before.pairs>0);assert.equal(moved.pairs,0);
    });
    check('new anatomy reports cannot inherit mismatched bounds, source hashes or topology',()=>{
        for(const change of [r=>{delete r.anatomy;},r=>{r.anatomy.headBounds.min[1]+=.01;},r=>{r.anatomy.neckShoulder.sourceTriangleIdsSha256='b'.repeat(64);},r=>{r.descriptor.bodyGeometryHashes.positionFloat32='b'.repeat(64);}]){
            calibratedCapture('g100');mutate('report.json',change);assert.throws(()=>measurePortraitSurface(directory),/calibration|rest geometry/);
        }
        for(const change of [r=>{r.bodyIndices[0]=r.bodyIndices[1];},r=>{r.bodyIndices[0]+=.5;},r=>{r.bodyPositions.pop();},r=>{r.bodyPositions.push(0,0,0);}]){
            calibratedCapture('g100');mutate('frame-0001.json',change);assert.throws(()=>measurePortraitSurface(directory),/topology|pose arrays/);
        }
    });
    check('original bob01 ranges require observed contiguous ring layout; bob02 stays unclassified',()=>{
        for(const bake of ['g000','g025','g050','g075','g100']){
            const groom=readPrimitive(readGlb(new URL(`../../assets/hair/bob01/${bake}.glb`,import.meta.url)),'hair_bob01');
            const descriptor={chainCount:496,pointsPerChain:17,cardVertexBase:652,cardVertexCount:16864,cardIndices:Array.from(groom.indices).filter((_,i)=>{const t=Math.floor(i/3)*3;return [0,1,2].every(k=>groom.indices[t+k]>=652);}).map(i=>i-652)};
            const parts=originalBob01Parts(descriptor,'bob01');assert.deepEqual(parts.map(p=>p.indices.length/3),[78*32,384*32,34*32]);
            assert.equal(originalBob01Parts(descriptor,'bob02'),null);assert.equal(originalBob01Parts({...descriptor,chainCount:495},'bob01'),null);
            const wrong={...descriptor,cardIndices:[...descriptor.cardIndices]};wrong.cardIndices[0]=34;assert.equal(originalBob01Parts(wrong,'bob01'),null);
        }
        calibratedCapture('g050',{shoulderCrossing:true});const r=measurePortraitSurface(directory);assert.equal(r.results[0].layerBreakdown.status,'unclassified');assert.equal(r.gate.pass,false);
    });
    check('recognized root-layer crossings remain a strict gate failure when curtains and fringe are clear',()=>{
        calibratedCapture('g050',{shoulderCrossing:true});const witness=read('frame-0000.json').vertices.slice(9),groom=readPrimitive(readGlb(new URL('../../assets/hair/bob01/g050.glb',import.meta.url)),'hair_bob01');
        const vertices=Array.from(groom.positions.slice(652*3,(652+16864)*3));for(let i=0;i<16864;i++)vertices[i*3]+=5;
        // Put only original-layout card 0 across a real neck triangle. This is a synthetic posed
        // witness, not a claim that the authored root layer naturally reaches this neck patch.
        const a=new Vector3().fromArray(witness,0),b=new Vector3().fromArray(witness,3),tangent=new Vector3().fromArray(witness,6).sub(a.clone().add(b).multiplyScalar(.5));
        for(let ring=0;ring<17;ring++){a.clone().addScaledVector(tangent,ring/16).toArray(vertices,ring*6);b.clone().addScaledVector(tangent,ring/16).toArray(vertices,ring*6+3);}
        const indices=[];for(let t=0;t<groom.indices.length;t+=3)if([0,1,2].every(k=>groom.indices[t+k]>=652))indices.push(...Array.from(groom.indices.slice(t,t+3)).map(i=>i-652));
        mutate('report.json',r=>Object.assign(r.descriptor,{chainCount:496,pointsPerChain:17,cardVertexBase:652,cardVertexCount:16864,cardIndices:indices}));
        for(let frame=0;frame<2;frame++)mutate(`frame-000${frame}.json`,r=>{r.vertices=vertices;r.vertexBase=652;});
        const r=measurePortraitSurface(directory),groups=r.results[0].layerBreakdown.groups;assert.equal(r.results[0].layerBreakdown.status,'original-bob01-layout-ranges');
        assert.ok(groups[0].neckShoulderPairs>0);assert.equal(groups[1].neckShoulderPairs,0);assert.equal(groups[2].neckShoulderPairs,0);assert.equal(r.gate.neckShoulderPass,false);assert.equal(r.gate.pass,false);
    });
    console.log( `${ checks }/${ checks } portrait surface integrity checks passed` );
} finally { fs.rmSync( directory, { recursive: true, force: true } ); }
