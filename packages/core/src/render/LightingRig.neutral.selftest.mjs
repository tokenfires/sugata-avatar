import assert from 'node:assert/strict';
import {Color, ColorManagement, PerspectiveCamera, Scene, Texture, Vector3} from 'three/webgpu';
import {texture} from 'three/tsl';
import {LightingRig} from './LightingRig.js';
import {createGroundTruthOcclusion} from './GTAO.js';
import {Avatar, resolveLightingOption} from '../Avatar.js';

const coefficients=ColorManagement.getLuminanceCoefficients(new Vector3());
const luminance=c=>c.r*coefficients.x+c.g*coefficients.y+c.b*coefficients.z;
let sources=0;
function neutral(actual, authored){
    const expected=luminance(authored);
    assert.equal(actual.r,actual.g);assert.equal(actual.g,actual.b);
    assert.ok(Math.abs(actual.r-expected)<1e-15);
    assert.ok(Math.abs(luminance(actual)-expected)<1e-15);sources++;
}
function compare(a,b){
    assert.deepEqual(a.placements,b.placements);
    for(let i=0;i<a.units.length;i++){
        const x=a.units[i],y=b.units[i];
        for(const kind of ['area','shadowCaster']) if(x[kind]){
            neutral(y[kind].color,x[kind].color);
            assert.equal(y[kind].intensity,x[kind].intensity);
            assert.deepEqual(y[kind].matrixWorld.toArray(),x[kind].matrixWorld.toArray());
            assert.equal(y[kind].castShadow,x[kind].castShadow);
        }
    }
    assert.equal(a.glintLight!==null,a.preset==='portrait');
    assert.equal(b.glintLight!==null,a.glintLight!==null);
    if(a.glintLight){neutral(b.glintLight.color,a.glintLight.color);assert.equal(b.glintLight.intensity,a.glintLight.intensity);}
    neutral(b.ambientLight.color,a.ambientLight.color);neutral(b.ambientLight.groundColor,a.ambientLight.groundColor);
    assert.equal(b.ambientLight.intensity,a.ambientLight.intensity);
    const x=a.describeAmbient(),y=b.describeAmbient();
    assert.equal(typeof x.skyColour,'number');assert.ok(y.skyColour.isColor);
    assert.deepEqual(y.skyColour.toArray(),b.ambientLight.color.toArray());
    assert.deepEqual(y.groundColour.toArray(),b.ambientLight.groundColor.toArray());
    assert.equal(y.intensity,x.intensity);
}
for(const preset of ['portrait','body']){
    const options={preset,overrides:{glint:{irradiance:.05,colour:0x965ca3}}};
    const a=new LightingRig(options),b=new LightingRig({...options,neutralColours:true});
    a.attachTo(new Scene(),null);b.attachTo(new Scene(),null);
    const aim={focus:new Vector3(.1,1.6,-.2),subjectHeightMetres:preset==='portrait'?.42:1.87,cameraPosition:new Vector3(.3,1.6,1)};
    a.aimAt(aim);b.aimAt(aim);compare(a,b);
    a.setPreset(preset==='portrait'?'body':'portrait');b.setPreset(preset==='portrait'?'body':'portrait');compare(a,b);
    b.rebuild();compare(a,b);
    b.neutralColours=false;b.rebuild();
    assert.deepEqual(a.describeLive(),b.describeLive());assert.deepEqual(a.describeAmbient(),b.describeAmbient());
    for(let i=0;i<a.units.length;i++)assert.deepEqual(a.units[i].area.color.toArray(),b.units[i].area.color.toArray());
    assert.deepEqual(a.ambientLight.groundColor.toArray(),b.ambientLight.groundColor.toArray());
    if(a.glintLight)assert.deepEqual(a.glintLight.color.toArray(),b.glintLight.color.toArray());
    a.dispose();b.dispose();
}
console.log(`PASS ${sources} actual neutral light colours preserve linear luminance across both framings and rebuilds; authored return exact`);

// Construct the real composite without a renderer, then drive the real Avatar setter.
const tex=new Texture(),node=texture(tex),base=new LightingRig().describeAmbient();
const composite=createGroundTruthOcclusion({camera:new PerspectiveCamera(),gbuffer:{depthNode:node,node:()=>node},ambient:base});
const live=Object.create(Avatar.prototype);
Object.assign(live,{lighting:resolveLightingOption('studio'),frameMode:'portrait',skyEnvironment:null,interiorEnvironment:null,environment:null,eyes:null,tierSettings:{shadows:true},focus:new Vector3(0,1.6,0),framedHeightMetres:.42,stage:{camera:{position:new Vector3(.2,1.6,1)},ambientOcclusion:composite},lights:new LightingRig({ambient:false})});
live.lights.attachTo(new Scene(),null);
const authored={sky:composite.describe().skyLinear,ground:composite.describe().groundLinear};
for(const look of ['neutral','warm','studio','neutral','studio']){
    live.setLighting(look);const desc=composite.describe(),ambient=live.lights.describeAmbient();
    assert.equal(live.lights.neutralColours,look==='neutral');assert.equal(live.lights.ambientLight,null);
    assert.deepEqual(desc.skyLinear,new Color(ambient.skyColour).toArray());
    assert.deepEqual(desc.groundLinear,new Color(ambient.groundColour).toArray());
    assert.equal(desc.intensity,ambient.intensity);
    if(look==='neutral'){
        neutral(new Color().fromArray(desc.skyLinear),new Color().fromArray(authored.sky));
        neutral(new Color().fromArray(desc.groundLinear),new Color().fromArray(authored.ground));
    } else {assert.deepEqual(desc.skyLinear,authored.sky);assert.deepEqual(desc.groundLinear,authored.ground);}
}
live.lights.dispose();composite.dispose();tex.dispose();
console.log('PASS real Avatar live switching refreshes real GTAO linear colour uniforms and restores authored ambient');
