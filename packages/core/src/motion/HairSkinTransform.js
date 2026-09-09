/** Exact rigid-head skin transform shared with the material's bind/world convention.
 * The caller supplies the single driving head bone and its captured inverse bind.
 * Matrices are borrowed; returned matrices are stable scratch values, refreshed by update().
 */
import { Matrix4 } from 'three';

// Allows Float32-authored inverse-bind rounding, not an intentional scale/shear setting.
export const HAIR_RIGID_TRANSFORM_TOLERANCE = 1e-5;
const identity = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const isIdentity = matrix => matrix.elements.every((value, index) => value === identity[index]);

export function assertRigidHairTransform(matrix) {
    const e = matrix?.elements, tolerance = HAIR_RIGID_TRANSFORM_TOLERANCE;
    if (!e || e.length !== 16 || !e.every(Number.isFinite)) throw Error('Hair contact requires a finite full skin transform.');
    if (Math.abs(e[3]) > tolerance || Math.abs(e[7]) > tolerance || Math.abs(e[11]) > tolerance || Math.abs(e[15] - 1) > tolerance) {
        throw Error('Hair contact requires an affine full skin transform.');
    }
    for (let a = 0; a < 3; a++) for (let b = a; b < 3; b++) {
        let product = 0;
        for (let k = 0; k < 3; k++) product += e[a * 4 + k] * e[b * 4 + k];
        if (Math.abs(product - (a === b ? 1 : 0)) > tolerance) {
            throw Error('Hair contact requires a unit rigid full skin transform; scale and shear are unsupported.');
        }
    }
    if (matrix.determinant() <= 0) throw Error('Hair contact requires a proper rigid full skin transform; reflection is unsupported.');
    return matrix;
}

export function createHairSkinTransform(mesh, headBone, headBoneInverse) {
    if (!mesh?.isSkinnedMesh || !headBone?.matrixWorld?.isMatrix4 || !headBoneInverse?.isMatrix4) {
        throw Error('A skinned groom, its driving head bone and inverse bind are required.');
    }
    const adjustedBone = new Matrix4(), adjustedInverse = new Matrix4(), worldMatrix = new Matrix4();
    const result = { meshMatrixWorld: mesh.matrixWorld, headBoneMatrixWorld: adjustedBone,
        headBoneInverse: adjustedInverse, worldMatrix };
    return function update({ requireRigid = false } = {}) {
        const bind = mesh.bindMatrix, inverse = mesh.bindMatrixInverse;
        // Identity binds retain the original matrix operands exactly, including their arithmetic
        // grouping in HairDynamics. Nonidentity attached-mode inverse binds must not be dropped.
        if (isIdentity(inverse)) adjustedBone.copy(headBone.matrixWorld);
        else adjustedBone.multiplyMatrices(inverse, headBone.matrixWorld);
        if (isIdentity(bind)) adjustedInverse.copy(headBoneInverse);
        else adjustedInverse.multiplyMatrices(headBoneInverse, bind);
        result.meshMatrixWorld = mesh.matrixWorld;
        worldMatrix.copy(mesh.matrixWorld).multiply(adjustedBone).multiply(adjustedInverse);
        if (requireRigid) assertRigidHairTransform(worldMatrix);
        return result;
    };
}
