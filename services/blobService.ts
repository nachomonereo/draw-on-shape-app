
import * as THREE from 'three';
import { SceneObject, Vector3 } from '../types';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';

// --- SDF FUNCTIONS (Local Space) ---

const sdSphere = (p: THREE.Vector3, radius: number) => {
    return p.length() - radius;
};

const sdBox = (p: THREE.Vector3, size: THREE.Vector3) => {
    const d = new THREE.Vector3(
        Math.abs(p.x) - size.x / 2,
        Math.abs(p.y) - size.y / 2,
        Math.abs(p.z) - size.z / 2
    );
    return Math.min(Math.max(d.x, Math.max(d.y, d.z)), 0.0) + d.max(new THREE.Vector3(0,0,0)).length();
};

const sdCylinder = (p: THREE.Vector3, height: number, radius: number) => {
    const d = Math.sqrt(p.x * p.x + p.z * p.z) - radius;
    const dy = Math.abs(p.y) - height / 2;
    return Math.min(Math.max(d, dy), 0.0) + new THREE.Vector2(Math.max(d, 0), Math.max(dy, 0)).length();
};

const sdCapsule = (p: THREE.Vector3, height: number, radius: number) => {
    const halfH = height / 2;
    const pa = new THREE.Vector3(p.x, p.y - Math.max(Math.min(p.y, halfH), -halfH), p.z);
    return pa.length() - radius;
};

export const generateBlobGeometry = async (
    objects: SceneObject[], 
    voxelSize: number = 50, // Resolution of the grid
    smoothingIterations: number = 0 // Not used directly, implicit in Marching Cubes resolution
): Promise<{ geometry: THREE.BufferGeometry, position: Vector3 }> => {
    
    if (objects.length === 0) throw new Error("Empty selection");

    const box = new THREE.Box3();
    
    // 1. Prepare Inverse Matrices & Bounds
    const processedObjects = objects.map(obj => {
        const mesh = new THREE.Object3D();
        mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
        mesh.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);
        mesh.scale.set(obj.scale.x, obj.scale.y, obj.scale.z);
        mesh.updateMatrixWorld();
        
        const inverseMatrix = mesh.matrixWorld.clone().invert();
        
        // Approximate Bounds
        const s = Math.max(obj.scale.x, Math.max(obj.scale.y, obj.scale.z));
        let radius = 1.0;
        
        if (obj.type === 'box') radius = Math.sqrt(Math.pow(obj.params?.width||1,2) + Math.pow(obj.params?.height||1,2) + Math.pow(obj.params?.depth||1,2)) * 0.5 * s;
        else if (obj.type === 'sphere') radius = (obj.params?.radius||0.5) * s;
        else radius = (obj.params?.height || 1) * s; 

        box.expandByPoint(mesh.position.clone().addScalar(radius));
        box.expandByPoint(mesh.position.clone().subScalar(radius));

        return { ...obj, inverseMatrix };
    });

    const center = new THREE.Vector3(); box.getCenter(center);
    const size = new THREE.Vector3(); box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Resolution Control
    const resolution = Math.min(Math.max(voxelSize, 20), 100); // Clamp resolution
    const padding = maxDim * 0.2; 
    const range = maxDim + padding * 2;
    
    const halfRange = range / 2;
    const invRes = range / resolution; 
    
    const pWorld = new THREE.Vector3();
    const pLocal = new THREE.Vector3();

    // Initialize Marching Cubes
    // We use the MarchingCubes object to generate the geometry
    const effect = new MarchingCubes(resolution, new THREE.MeshBasicMaterial(), true, true, 100000);
    effect.position.copy(center);
    effect.scale.set(range/2, range/2, range/2); // MarchingCubes is -1 to 1 local space usually, or 0 to 1? 
    // Actually MarchingCubes in Three.js examples creates a field of size resolution^3
    // and generates geometry in local space.
    
    // Reset the field
    effect.reset();

    // Fill the field
    // The field array in MarchingCubes is a Float32Array of size resolution^3
    // Values > isolation (usually 0.5) are inside.
    
    const isolation = 0.0; // SDF surface is at 0
    
    // We need to map grid coordinates (0..resolution) to world coordinates
    // Grid 0 = center - halfRange
    // Grid resolution = center + halfRange
    
    let iterations = 0;
    const yieldEvery = 5000; // Yield every 5000 voxels to keep UI responsive

    for (let kZ = 0; kZ < resolution; kZ++) {
        for (let kY = 0; kY < resolution; kY++) {
            // Yield to main thread periodically
            if (iterations++ > yieldEvery) {
                iterations = 0;
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            for (let kX = 0; kX < resolution; kX++) {
                
                // World Position of this voxel
                pWorld.set(
                    center.x - halfRange + (kX * invRes),
                    center.y - halfRange + (kY * invRes),
                    center.z - halfRange + (kZ * invRes)
                );

                let d = 10000; 
                
                // Union of all objects (SDF Min)
                for (const obj of processedObjects) {
                    pLocal.copy(pWorld).applyMatrix4(obj.inverseMatrix);
                    let od = 10000;
                    
                    if (obj.type === 'sphere') {
                        od = sdSphere(pLocal, obj.params?.radius || 0.5);
                    }
                    else if (obj.type === 'box') {
                        od = sdBox(pLocal, new THREE.Vector3(obj.params?.width || 1, obj.params?.height || 1, obj.params?.depth || 1));
                    }
                    else if (obj.type === 'cylinder') {
                        od = sdCylinder(pLocal, obj.params?.height || 1, obj.params?.radius || 0.5);
                    }
                    else if (obj.type === 'cone') {
                        od = sdCylinder(pLocal, obj.params?.height || 1, obj.params?.radius || 0.5);
                    }
                    else if (obj.type === 'capsule') {
                        od = sdCapsule(pLocal, obj.params?.height || 1, obj.params?.radius || 0.5);
                    }
                    else if (obj.type === 'torus') {
                        const q = new THREE.Vector2(new THREE.Vector2(pLocal.x, pLocal.z).length() - (obj.params?.radius || 0.5), pLocal.y);
                        od = q.length() - (obj.params?.tube || 0.2);
                    }
                    else {
                        od = sdSphere(pLocal, 0.5); 
                    }
                    
                    d = Math.min(d, od);
                }
                
                // Marching Cubes expects values. 
                // Usually positive = inside? Or > isolation = inside.
                // Our SDF: negative = inside.
                // So we invert D.
                // And we need to scale it to be meaningful for the field.
                // Let's say value = -d. If d is -1 (inside), value is 1. If d is 1 (outside), value is -1.
                // Isolation is 0.
                
                // We use addBall logic style or direct field manipulation
                // effect.field[ index ] = value;
                
                // Index mapping in MarchingCubes.js: x + y * resolution + z * resolution * resolution
                const index = kX + kY * resolution + kZ * resolution * resolution;
                
                // Soften the field for better blobs?
                // SDF is exact distance. 
                effect.field[index] = -d; 
            }
        }
    }

    // Generate geometry
    // isolation = 0.0
    effect.isolation = 0.0;
    
    // This updates the internal geometry
    // We need to force update
    // The update() method in MarchingCubes usually takes time delta, but here we just want to generate
    // Actually, MarchingCubes.js doesn't have a simple "generate" method that returns geometry detached.
    // It maintains its own geometry.
    
    // We can call update() once to fill the buffers?
    // No, update() does animation logic.
    // We need to look at how it generates.
    // It uses 'generateGeometry' internally or similar.
    // Wait, MarchingCubes extends Mesh. It has a geometry property.
    // But the geometry is a BufferGeometry that is updated frame by frame.
    
    // We need to trigger the triangulation.
    // In MarchingCubes.js:
    // this.update = function () { ... }
    // It calls polygonize.
    
    // Let's try calling effect.update() with t=0.
    // However, effect.update() might reset the field if we are not careful.
    // Actually, looking at standard MarchingCubes.js:
    // It has addBall, addPlane etc which modify the field.
    // Then update() uses the field to polygonize.
    // BUT update() also clears the field if enableUvs is false? No.
    // Wait, usually MarchingCubes examples reset() then addBall() then update().
    // We already filled the field manually.
    // We just need to call polygonize? 
    // Accessing private methods is hard.
    
    // Let's assume we can just call update(-1) or something?
    // Actually, we can just copy the logic or use it as is.
    // If we return the geometry from the effect, we must clone it because the effect reuses it.
    
    // Let's try:
    // effect.init(resolution); // if needed
    // ... fill field ...
    // effect.update(); // This should polygonize based on field
    
    // But wait, standard MarchingCubes.js 'update' function might clear the field if 'reset' is called inside.
    // It usually does: if ( this.reset ) this.reset();
    // We should ensure it doesn't reset our manual field.
    // Actually, standard MarchingCubes.js usage is:
    // reset(); fill(); update();
    // But update() is what calls polygonize.
    
    // Let's try to just return the geometry after calling update.
    // We need to make sure we don't rely on the 'update' clearing it.
    // We will NOT call reset() inside the loop.
    
    // Hack: MarchingCubes.js doesn't expose a clean "generate now" API without side effects.
    // However, if we look at the code, 'update' calls 'polygonize'.
    // We can try to call effect.update() and hope it works.
    
    // There is a risk: The geometry created by MarchingCubes is indexed? No, usually non-indexed triangles.
    // And it has a fixed size buffer (maxPolyCount).
    
    // Let's try it.
    
    // Important: We need to scale the result back.
    // MarchingCubes creates geometry in range [-1, 1] or [0, 1]?
    // Usually it fits within the 'scale' of the mesh.
    // If we extract the geometry, it will be in local coordinates of the MarchingCubes mesh.
    // We set effect.scale to (range/2).
    // So the geometry vertices will be normalized.
    
    // Let's try to extract and bake the transform.
    
    // Note: MarchingCubes might not be in the type definitions.
    // We might need @ts-ignore.

    // @ts-ignore
    effect.update();
    
    const geom = effect.geometry.clone();
    
    // The geometry from MarchingCubes is usually reused and has a large buffer.
    // We should compact it?
    // clone() copies the whole buffer.
    // We might want to use BufferGeometryUtils.mergeVertices to clean it up and remove unused attributes.
    // But for now, just clone.
    
    // Transform geometry to world space
    // The effect mesh has position 'center' and scale 'range/2'.
    // We need to apply this transform to the geometry.
    
    geom.scale(range/2, range/2, range/2);
    geom.translate(center.x, center.y, center.z);
    
    return { geometry: geom, position: new THREE.Vector3(0,0,0) };
};
