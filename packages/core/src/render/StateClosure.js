/**
 * The whole-state CLOSURE instrument, shared by every render module that has to describe an object
 * three will draw.
 *
 * ## Why this is a module rather than two copies
 *
 * LEARNINGS §1.25t: a gate built from remembered defects cannot cover the next one. The lighting
 * gate failed the same way four rounds running with a different mechanism every time, and the fix
 * was to stop enumerating mechanisms and close over PROPERTIES — ask an object what fields it HAS
 * and require every one of them to be either READ with a value, INERT with a reason, or DERIVED.
 * Anything left over lands in `unclassified` and the gate goes red naming it, **including a field
 * that does not exist yet**. `missing` is the same instrument pointed the other way: a field we say
 * three reads that the object does not have, which is a rename in the dependency presenting as a
 * check quietly comparing `undefined` with `undefined`.
 *
 * `LightingRig.js` invented it for the light graph and `GroundContact.js` needed exactly it for the
 * surface. §1.25 on copies: they drift — and a closure that has drifted is a closure with a hole in
 * it, which is the one defect this instrument exists to make impossible. So it lives here, once,
 * and both files import it.
 *
 * ## What a NODE SPEC is
 *
 * A plain object, declared beside the thing it describes:
 *
 *   read:     string[]                      fields whose VALUE is part of the state
 *   inert:    { [field]: string }           fields that cannot change the picture, with the reason
 *   derived:  { [name]: ( node ) => any }   a property of the node that is not one of its own keys
 *
 * A field's reason is prose on purpose. `parent` is not inert because parents do not matter; it is
 * inert because a `parentIsScene` derived row answers the question the claim actually needs. That
 * distinction only survives if somebody has to write it down.
 */

/** Values reduced to something a gate can compare and print without caring about class. */
export function plainValue( value ) {

    if ( value === undefined || value === null ) return null;
    if ( value.isColor === true ) return value.getHex();
    if ( value.isVector3 === true ) return [ value.x, value.y, value.z ];
    if ( value.isVector2 === true ) return [ value.x, value.y ];
    if ( value.isEuler === true ) return [ value.x, value.y, value.z ];
    if ( value.isQuaternion === true ) return [ value.x, value.y, value.z, value.w ];
    // `Layers` carries no `isLayers` brand, so it is recognised by its shape.
    if ( typeof value.test === 'function' && typeof value.mask === 'number' ) return value.mask;
    if ( value.isTexture === true ) return `texture:${ value.uuid }`;
    if ( value.isObject3D === true ) return [ value.position.x, value.position.y, value.position.z ];

    return value;

}

/**
 * Sweeps ONE node of an object graph: every own key either read with a value or inert with a
 * reason, anything else into `unclassified`, anything declared-read but absent into `missing`.
 *
 * A node handed to this function cannot hide a field, which is the property a hand-written
 * `{ position, rotation, scale, … }` literal does not have however carefully it was written.
 *
 * `prefix` may be empty, which names the fields bare — the right shape when the caller is
 * describing a single object rather than a graph. `LightingRig` passes `shadow.camera` and `target`
 * because a light HAS a graph; `GroundContact` passes nothing because a plane is one node.
 *
 * @param {import('three').Object3D} node
 * @param {string} prefix - key prefix in the returned maps, e.g. `shadow.camera`, or '' for none.
 * @param {{ read: string[], inert: Object<string,string>, derived: Object<string,Function> }} spec
 * @param {{ read: Object, inert: Object, unclassified: string[], missing: string[] }} into
 */
export function classifyNode( node, prefix, spec, into ) {

    const at = ( name ) => ( prefix === '' ? name : `${ prefix }.${ name }` );

    for ( const name of spec.read ) {

        if ( name in node === false ) {

            into.missing.push( at( name ) );
            continue;

        }

        into.read[ at( name ) ] = plainValue( node[ name ] );

    }

    for ( const [ name, why ] of Object.entries( spec.inert ) ) into.inert[ at( name ) ] = why;

    for ( const [ name, derive ] of Object.entries( spec.derived ) ) {

        into.read[ at( name ) ] = derive( node );

    }

    for ( const key of Object.keys( node ) ) {

        if ( spec.read.includes( key ) ) continue;
        if ( key in spec.inert ) continue;

        into.unclassified.push( at( key ) );

    }

}
