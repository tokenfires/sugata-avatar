// Shared frame attribution instrument; the page and its gate must enumerate the same state.
export function frameSubjectState( stage = globalThis.sugata.stage ) {
    const subjects = { renderer: stage.renderer, scene: stage.scene, camera: stage.camera,
        drawingBufferSize: stage.drawingBufferSize, renderParticipants: stage.renderParticipants };
    const state = {};

    const excludedReason = ( propertyPath ) => {

        // three mints a fresh uuid per instance, so it differs on every load and would report the
        // whole instrument as noise. Same reason `textureIdentity` in alive.js refuses to use it.
        if ( propertyPath.endsWith( '.uuid' ) ) return 'a fresh uuid is minted per instance, every load';

        // TAAU calls `camera.setViewOffset` before each frame and `camera.clearViewOffset` after it,
        // which disables the offset and leaves the last Halton sample sitting in these two fields.
        // Measured over two loads of ?bare&freeze&seed=1: offsetX -0.125 / 0.375, offsetY -0.2778 /
        // 0.0556, and they are the ONLY two of the 183 properties that move. They record which
        // frame the screenshot landed on, and nothing a toggle could set survives in them, because
        // the next frame overwrites both.
        if ( propertyPath === 'camera.view.offsetX' || propertyPath === 'camera.view.offsetY' ) {

            return 'the temporal resolve rewrites it every frame; it records the frame, not the configuration';

        }

        // StageScenePass invalidates its history for each draw outside Stage.draw.
        // This monotonic counter records how many startup frames ran, not configuration.
        if ( propertyPath === 'renderParticipants.epoch' ) return 'render invalidation counter; startup frame count';

        return null;

    };

    const roundedNumber = ( value ) => {

        if ( Number.isFinite( value ) === false ) return String( value );

        // `Number` on the fixed form rather than the fixed form itself, so 100 stays "100" and the
        // -2.8e-17 that `lookAt` leaves in a matrix collapses onto the 0 in the other plate's.
        return String( Number( value.toFixed( 6 ) ) );

    };

    const describe = ( value ) => {

        if ( value === null ) return 'null';
        if ( typeof value === 'number' ) return roundedNumber( value );
        if ( typeof value === 'boolean' || typeof value === 'string' ) return String( value );
        if ( typeof value === 'function' ) return null;
        if ( Array.isArray( value ) ) return `array(${ value.length })`;
        if ( value instanceof Set ) return `set(${ value.size })`;
        if ( typeof value !== 'object' ) return String( value );

        if ( value.isColor === true ) return `color:${ value.getHexString() }`;

        if ( typeof value.toArray === 'function' ) {

            try {

                const numbers = value.toArray();

                if ( Array.isArray( numbers ) ) {

                    const described = numbers
                        .map( ( entry ) => typeof entry === 'number' ? roundedNumber( entry ) : String( entry ) );

                    return `${ value.constructor?.name ?? '?' }(${ described.join( ',' ) })`;

                }

            } catch {

                // not a value object after all — fall through to the type name
            }

        }

        return `object:${ value.constructor?.name ?? '?' }`;

    };

    /** A member carrying nothing but scalars is configuration; anything holding an object is machinery. */
    const isConfigurationBag = ( value ) => {

        if ( value === null || typeof value !== 'object' || Array.isArray( value ) ) return false;
        if ( typeof value.toArray === 'function' ) return false;

        for ( const key of Object.keys( value ) ) {

            const inner = value[ key ];
            if ( inner !== null && typeof inner === 'object' ) return false;

        }

        return true;

    };

    const record = ( propertyPath, value ) => {

        if ( value === undefined ) return;

        const reason = excludedReason( propertyPath );

        if ( reason !== null ) {

            state[ `excluded:${ propertyPath }` ] = reason;
            return;

        }

        const described = describe( value );

        if ( described !== null ) state[ propertyPath ] = described;

    };

    for ( const [ label, subject ] of Object.entries( subjects ) ) {

        const seen = new Set();

        for ( const key of Object.keys( subject ).sort() ) {

            seen.add( key );

            const propertyPath = `${ label }.${ key }`;
            let value;

            try {

                value = subject[ key ];

            } catch {

                state[ propertyPath ] = 'threw';
                continue;

            }

            record( propertyPath, value );

            let bag = false;

            try {

                bag = isConfigurationBag( value );

            } catch {

                bag = false;

            }

            if ( bag === false ) continue;

            for ( const inner of Object.keys( value ).sort() ) {

                try {

                    record( `${ propertyPath }.${ inner }`, value[ inner ] );

                } catch {

                    state[ `${ propertyPath }.${ inner }` ] = 'threw';

                }

            }

        }

        let prototype = Object.getPrototypeOf( subject );

        while ( prototype !== null && prototype !== Object.prototype ) {

            for ( const key of Object.getOwnPropertyNames( prototype ).sort() ) {

                if ( seen.has( key ) ) continue;

                const descriptor = Object.getOwnPropertyDescriptor( prototype, key );

                if ( descriptor === undefined || typeof descriptor.get !== 'function' ) continue;

                seen.add( key );

                try {

                    record( `${ label }.get:${ key }`, subject[ key ] );

                } catch {

                    state[ `${ label }.get:${ key }` ] = 'threw';

                }

            }

            prototype = Object.getPrototypeOf( prototype );

        }

    }

    // Not a property of any subject, and the one piece of render state that lives on the canvas:
    // `?scale` is applied with `setSize`, so this is where a resolution confound would show.
    const canvas = stage.renderer.domElement;

    state[ 'renderer.canvasPixels' ] = `${ canvas.width }x${ canvas.height }`;

    // THE SUBJECT LIST, CLOSED. Every object-valued member of the Stage, by identity. Two jobs: the
    // gate checks this inventory against WALKED_SUBJECTS + UNWALKED_SUBJECTS, so a new member is a
    // red gate rather than a silent hole; and an identity is itself a weak state check — `?grade=0`
    // shows up here as `stage.grade` disappearing, which is how the post stack gets any coverage at
    // all from an instrument that does not walk it.
    for ( const key of Object.keys( stage ).sort() ) {

        const member = stage[ key ];

        if ( member === null || typeof member !== 'object' ) continue;

        state[ `stage.${ key }` ] = `object:${ member.constructor?.name ?? '?' }`;

    }

    return state;

}
