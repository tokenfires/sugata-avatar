/** Node/test-only source control: add or remove exactly the two reviewed triangle guards.
 * Production tests require the guarded source and compare a route-only predecessor. The
 * unguarded mode exists only to verify extraction round-trips; it is never a passing test target.
 */
import assert from 'node:assert/strict';
const anchor='                const c = positionAt( triangle.z ).toVar();\n';
const end='            };\n            // A cached nearest triangle';
const suffix='\n                } );\n';
function prefix(a,b){return `                const low = min( min( a, b ), c ).toVar(), high = max( max( a, b ), c ).toVar();
                const magnitude = max( max( abs( ${a} ), abs( ${b} ) ), max( abs( low ), abs( high ) ) ).toVar();
                const scale = max( max( magnitude.x, magnitude.y ), max( magnitude.z, 1 ) ).toVar();
                const gap = max( max( low.sub( max( ${a}, ${b} ) ), min( ${a}, ${b} ).sub( high ) ).sub( scale.mul( 8 * 2 ** -23 ) ), vec3( 0 ) ).toVar();
                If( dot( gap, gap ).lessThanEqual( bestDistanceSquared ), () => {\n`;}
export function triangleBoundsSourcePair(source){
    assert.equal(source.split(anchor).length,3,'Expected exactly two query triangle-coordinate anchors');
    const regions=[];let cursor=0;
    for(const [a,b,first] of [['point','point','const weights = triangleBarycentric( point, a, b, c ).toVar();'],['segmentStart','segmentEnd','const coordinates = segmentTriangleCoordinates( segmentStart, segmentEnd, a, b, c ).toVar();']]){
        const start=source.indexOf(anchor,cursor)+anchor.length,finish=source.indexOf(end,start);assert.ok(finish>start,'Missing complete considerTriangle boundary');
        const body=source.slice(start,finish),guard=prefix(a,b),guarded=body.startsWith(guard);
        let plain=body;
        if(guarded){assert.ok(body.endsWith(suffix),'Guard closing boundary changed');const inner=body.slice(guard.length,-suffix.length);assert.ok(inner.split('\n').every(line=>line===''||line.startsWith('    ')),'Guard indentation/body changed');plain=inner.split('\n').map(line=>line.slice(4)).join('\n');}
        assert.ok(plain.startsWith('                '+first),'Unexpected closest-query body or changed guard');
        assert.equal(plain.includes('const gap ='),false,'Unexpected nested triangle guard');
        regions.push({start,finish,guarded,plain,wrapped:guard+plain.split('\n').map(line=>line?'    '+line:'').join('\n')+suffix});cursor=finish;
    }
    assert.equal(regions[0].guarded,regions[1].guarded,'Partial triangle guard installation');
    const variant=key=>{let result=source;for(const region of [...regions].reverse())result=result.slice(0,region.start)+region[key]+result.slice(region.finish);return result;};
    const baseline=variant('plain'),guarded=variant('wrapped');assert.notEqual(baseline,guarded,'Predecessor and guard arms must differ');
    return{mode:regions[0].guarded?'guarded-production':'unguarded-preview',baseline,guarded,guardCount:regions[0].guarded?2:0};
}
