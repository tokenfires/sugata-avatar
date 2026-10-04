import assert from 'node:assert/strict';
import { Group, Mesh } from 'three';
import { AVATAR_DEFAULTS, Avatar, shippedAmbientFractionOfKey } from '../Avatar.js';
import { EXPOSURE_CALIBRATION } from '../render/LightingRig.js';
import { createSkinMaterial } from './SkinMaterial.js';
import { skinFinishMaterialOptions } from './SkinFinishOptions.js';

// CPU contract/factory tests. No browser, adapter, draw, pixel or live rebuild qualification.
const canvas = { getContext() { throw new Error( 'GPU setup reached' ); } };
const originalBuild = Avatar.prototype.build;
assert.equal( AVATAR_DEFAULTS.skinFinish, 'original' );
let builds = 0;
let defaultSettings;
Avatar.prototype.build = async function () { builds++; };
try {

    for ( const value of [ null, 0.12, false, '', 'soft', 'Original', {}, [] ] ) {

        await assert.rejects( Avatar.create( { canvas, skinFinish: value } ), /skinFinish.*original.*reduced-sheen/ );

    }
    assert.equal( builds, 0, 'invalid choices must fail before construction' );
    for ( const choice of [ undefined, 'original', 'reduced-sheen' ] ) {

        const avatar = await Avatar.create( { canvas, skinFinish: choice } );
        assert.equal( avatar.skinFinish, choice ?? 'original' );
        assert.deepEqual( avatar.report().skin, {
            requestedFinish: choice ?? 'original', attached: false,
            clearcoat: null, clearcoatRoughness: null, settings: null
        } );
        const material = await createSkinMaterial( {
            ...skinFinishMaterialOptions( avatar.skinFinish ),
            curvatureMapUrl: null, regionMapUrl: null, cavityMapUrl: null
        } );
        assert.equal( material.clearcoat, choice === 'reduced-sheen' ? 0.12 : 0.34 );
        assert.equal( material.clearcoatRoughness, 0.24 );
        assert.equal( material.skinSettings.secondLobeWeight, material.clearcoat );
        assert.equal( material.skinSettings.secondLobeRoughness, material.clearcoatRoughness );
        if ( defaultSettings === undefined ) defaultSettings = { ...material.skinSettings };
        assert.deepEqual( material.skinSettings, {
            ...defaultSettings, secondLobeWeight: choice === 'reduced-sheen' ? 0.12 : 0.34
        }, 'every other construction setting must retain the default' );
        avatar.skin = material;
        const body = new Mesh();
        body.material.dispose();
        body.material = material;
        avatar.figure = { body, root: new Group().add( body ), dispose() { body.geometry.dispose(); } };
        assert.equal( avatar.report().skin.attached, true );
        assert.equal( avatar.report().skin.clearcoat, material.clearcoat );
        material.clearcoat = 0.2;
        assert.equal( avatar.report().skin.clearcoat, 0.2, 'read actual fields rather than the request' );
        material.clearcoat = material.skinSettings.secondLobeWeight;
        body.material = null;
        assert.deepEqual( avatar.report().skin, {
            requestedFinish: choice ?? 'original', attached: false,
            clearcoat: null, clearcoatRoughness: null, settings: null
        }, 'an orphan material must not report as the current body' );
        body.material = material;
        avatar.lights = {
            exposure: EXPOSURE_CALIBRATION, ambientFractionOfKey: shippedAmbientFractionOfKey(),
            units: [], describeAmbient: () => ( { attached: true } ), describeLive: () => [], dispose() {}
        };
        assert.equal( avatar.report().scene.lighting.calibrated, choice !== 'reduced-sheen' );
        avatar.lights.exposure *= 2;
        assert.equal( avatar.report().scene.lighting.calibrated, false );
        avatar.lights.exposure = EXPOSURE_CALIBRATION;
        avatar.lighting = { ...avatar.lighting, look: 'neutral' };
        assert.equal( avatar.report().scene.lighting.calibrated, false );
        avatar.dispose();
        assert.equal( avatar.report().skin.attached, false );
        assert.equal( avatar.report().skin.clearcoat, null );
        assert.deepEqual( avatar.report().disposal.leaked, [] );

    }
    assert.equal( builds, 3 );
    assert.deepEqual( skinFinishMaterialOptions( 'original' ), {}, 'original must omit factory overrides' );
    console.log( 'PASS skin finish: early input refusal, default factory parity, active owner reporting, calibration and disposal; no native pixels/rebuild claim.' );

} finally {

    Avatar.prototype.build = originalBuild;

}
