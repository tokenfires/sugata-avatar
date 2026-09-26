// Node entry point. Uses an already fresh, ready captured Portrait; never launches a browser.
// This deliberately stateful numerical witness is separate from the six appearance clips.
import { fileURLToPath } from 'node:url';

export async function runNativeLifecycle( page ) {
    return page.evaluate( async ( urls ) => {
        const { ExpressionStudyArm } = await import( urls.study );
        const runtime = await import( urls.runtime );
        const a = window.portrait.avatar, gaze = a.layers.gaze;
        const receipt = { completed: false, checks: [], scope: 'One native owner lifecycle witness; B and C run separately. No appearance judgment.' };
        let owner = null;
        const check = ( condition, message ) => { if ( !condition ) throw Error( message ); };
        const save = ( name, detail = {} ) => receipt.checks.push( { name, clock: a.clockSeconds, frame: a.stack.frame,
            owner: owner?.report() ?? null, policy: gaze.policyEnabled, hasHold: !!gaze.targetHold,
            hasFade: !!gaze.pointAimRelease, ...detail } );
        const noLayers = () => a.stack.layers.every( layer => !layer.name.startsWith( 'expressionStudy' ) );
        try {
            receipt.initial = await runtime.setup();
            a.feel( runtime.PAD );
            await runtime.step( 150 );
            const priorPolicy = gaze.policyEnabled;
            owner = new ExpressionStudyArm( a, { arm: 'B' } );
            owner.start( a.stage.camera );
            await runtime.step( 60 );
            const held = owner.gazeHold;
            check( held.active && held.hasPointTarget, 'B did not acquire the actual calibrated native hold' );
            save( 'B current native calibrated hold', { point: structuredClone( gaze.pointAimOutput ) } );

            const timeline = [ { viseme: 'aa', startTime: .2, duration: .15 }, { viseme: 'PP', startTime: .5, duration: .15 } ];
            const speechPlan = { synthetic: true, durationSeconds: .8, words: [
                { text: 'A', startTime: .2, endTime: .35, stressed: false },
                { text: 'pause', startTime: .5, endTime: .65, stressed: true }
            ] };
            // Keep the real reflex/gesture side effects. The identical target is reapplied,
            // and the speech promise is only awaited after native manual time has advanced.
            const speechPromise = a.say( 'A pause.', { timeline, speechPlan } );
            a.feel( runtime.PAD );
            const schedule = { timeline: structuredClone( a.viseme.schedule.timeline ), windows: structuredClone( a.viseme.schedule.windows ),
                lead: a.viseme.schedule.leadSeconds, start: a.viseme.schedule.audioStartTime };
            const peaks = { viseme_aa: 0, viseme_PP: 0 }, intendedPeaks = { viseme_aa: 0, viseme_PP: 0 }, speechSamples = [];
            let speakingFrames = 0;
            for ( let i = 0; i < 60; i++ ) {
                await runtime.step();
                check( held.active && owner.phase === 'attending', 'Ordinary native say/viseme activity superseded B' );
                if ( a.viseme.speaking ) speakingFrames++;
                const channels = {};
                for ( const name of Object.keys( peaks ) ) {
                    const channel = a.stack.morphChannels.get( name ), meshes = [];
                    a.figure.root.traverse( mesh => {
                        const index = mesh.morphTargetDictionary?.[ name ];
                        if ( index !== undefined ) meshes.push( { mesh: mesh.name, value: mesh.morphTargetInfluences[ index ] } );
                    } );
                    channels[ name ] = { intended: a.figure.getMorph( name ), committed: channel?.committed ?? null, meshes,
                        writers: channel?.writerNames.map( ( name, index ) => ( { name, value: channel.writerValues[ index ] } ) ) ?? [] };
                    peaks[ name ] = Math.max( peaks[ name ], channel?.committed ?? 0 );
                    intendedPeaks[ name ] = Math.max( intendedPeaks[ name ], a.figure.getMorph( name ) );
                }
                speechSamples.push( { step: i + 1, clock: a.clockSeconds, speaking: a.viseme.speaking, channels } );
            }
            // Preserve diagnosis before any gate can stop this run. Figure.getMorph is the
            // direct-path intended state; the native stack commits to actual mesh influences.
            receipt.speech = { timeline, speechPlan, schedule, speakingFrames, peaks, intendedPeaks, samples: speechSamples,
                pendingUtterance: a.utterance === null ? null : { endsAt: a.utterance.endsAt, clock: a.clockSeconds } };
            check( a.utterance === null, 'Native speech has not reached its end; refuse to await an advancing clock' );
            const outcome = await speechPromise;
            receipt.speech.outcome = outcome;
            check( outcome.outcome === 'finished', `Native say outcome was ${ outcome.outcome }` );
            check( speakingFrames > 0, 'Native VisemeLayer never reported speaking' );
            check( peaks.viseme_aa > .3, `Native committed aa peak was ${ peaks.viseme_aa }, expected above .3` );
            check( peaks.viseme_PP > .5, `Native committed PP peak was ${ peaks.viseme_PP }, expected above .5` );
            for ( const sample of speechSamples ) for ( const [ name, channel ] of Object.entries( sample.channels ) ) {
                check( channel.meshes.length > 0, `No live meshes carry ${ name }` );
                check( channel.meshes.every( mesh => mesh.value === channel.committed ), `Live ${ name } mesh weight differs from the committed stack at speech step ${ sample.step }` );
            }
            save( 'B survives native say and real mouth motion', { timeline, speechPlan, schedule, speakingFrames, peaks, outcome } );

            const newer = gaze.holdTarget( { yawDegrees: -5, pitchDegrees: 0 }, { predicted: true } );
            await runtime.step();
            check( !held.active && newer.active && owner.phase === 'idle', 'B did not retire for a newer native owner' );
            owner.dispose(); owner = null;
            check( newer.active && noLayers(), 'Older study disposal changed the newer hold or leaked a study layer' );
            newer.release();
            check( gaze.policyEnabled === priorPolicy, 'New native hold failed to restore the original policy' );
            save( 'B cannot reclaim or release a newer hold' );

            owner = new ExpressionStudyArm( a, { arm: 'B' } ); owner.start( a.stage.camera );
            await runtime.step( 32 );
            const startEnvelope = owner.envelope, fade = owner.gazeHold;
            owner.cancel(); check( fade.pointFading && gaze.policyEnabled === priorPolicy, 'B cancel did not hand release back to native gaze' );
            await runtime.step( 9 );
            check( owner.envelope > 0 && owner.envelope < startEnvelope && fade.pointFading, 'B cancel did not decay continuously' );
            save( 'B onset cancel has an owned native fade' );
            await runtime.step( 11 ); check( owner.phase === 'idle' && !fade.pointFading && !gaze.pointAimRelease, 'B cancel leaked its fade' );
            owner.start( a.stage.camera ); await runtime.step(); owner.control.enabled = false; await runtime.step();
            check( owner.phase === 'idle' && !gaze.targetHold, 'Disabled B retained ownership' );
            owner.control.enabled = true; await runtime.step(); check( owner.phase === 'idle', 'Enabled B resurrected' );
            save( 'B disable and re-enable retire without resurrection' );
            owner.start( a.stage.camera ); gaze.reset(); await runtime.step();
            check( owner.phase === 'idle' && !gaze.targetHold, 'Native gaze reset retained B' );
            save( 'B native gaze reset retires its token' );
            owner.dispose(); owner = null; check( noLayers(), 'B disposal left study layers' );

            owner = new ExpressionStudyArm( a, { arm: 'C' } ); owner.start(); await runtime.step( 60 );
            let report = owner.report();
            check( report.channels.eyeWideLeft.actualAdmitted < 0 || report.channels.eyeWideRight.actualAdmitted < 0, 'C native witness did not attenuate actual expression output' );
            const beforeGaze = { envelope: owner.envelope, expression: a.expression };
            gaze.lookAt( { yawDegrees: -10 } ); await runtime.step();
            check( owner.phase === 'attending' && owner.envelope === beforeGaze.envelope && a.expression === beforeGaze.expression && !owner.gazeHold, 'Unrelated native gaze superseded C' );
            save( 'C current expression readback and independent gaze ownership' );
            a.expression.enabled = false;
            await runtime.step(); report = owner.report();
            for ( const c of Object.values( report.channels ) ) check( c.expression === 0 && c.actualAdmitted === 0, 'C read disabled expression output' );
            save( 'C disabled native expression has zero correction' );
            a.expression.enabled = true; await runtime.step();
            check( owner.report().channels.eyeWideLeft.expression > 0, 'C did not resume current expression readback' );
            owner.cancel(); await runtime.step( 20 ); check( owner.phase === 'idle', 'C cancellation did not end' );
            owner.start(); await runtime.step(); owner.control.enabled = false; await runtime.step();
            check( owner.phase === 'idle', 'Disabled C did not retire' );
            owner.control.enabled = true; await runtime.step(); check( owner.phase === 'idle', 'Enabled C resurrected' );
            save( 'C cancel and control disable retire without resurrection' );
            owner.start(); await runtime.step( 40 ); owner.dispose();
            check( noLayers(), 'C disposal leaked study layers' );
            await runtime.step();
            for ( const name of [ 'eyeWideLeft', 'eyeWideRight' ] ) check( !a.stack.morphChannels.get( name ).writerNames.includes( 'expressionStudyEyeWide' ), 'Disposed C still writes on the next native commit' );
            save( 'C disposal restores ordinary native ownership on next commit' );
            owner = null;
            receipt.completed = true;
        } catch ( error ) {
            receipt.error = { name: error.name, message: error.message, stack: error.stack };
        } finally {
            a.expression.enabled = true;
            owner?.dispose();
            receipt.noStudyLayers = noLayers();
            receipt.final = await runtime.finish();
        }
        return receipt;
    }, { study: '/@fs' + fileURLToPath( new URL( './ExpressionStudyArm.mjs', import.meta.url ) ),
        runtime: '/@fs' + fileURLToPath( new URL( './capture-runtime.mjs', import.meta.url ) ) } );
}
