
// @ts-nocheck
import React, { useRef, useState, useEffect, useMemo, Suspense, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Canvas, useThree, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, TransformControls, Grid, Environment, ContactShadows, Line, useCursor, Box, PerspectiveCamera, OrthographicCamera, Outlines } from '@react-three/drei';
import * as THREE from 'three';
// @ts-ignore
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
// @ts-ignore
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
// @ts-ignore
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
// @ts-ignore
import { Rhino3dmLoader } from 'three/examples/jsm/loaders/3DMLoader';
import { SceneObject, Vector3, CameraView } from '../types';
import { Language } from '../utils/translations';
import gsap from 'gsap';

export interface SceneExportRef {
    exportSTL: () => Promise<Blob>;
    exportGLB: () => Promise<Blob>;
    exportDXF: () => Promise<Blob>;
    getScreenshot: (format?: 'image/png' | 'image/jpeg', scaleMultiplier?: number, transparent?: boolean) => string;
    getCameraState: () => { position: Vector3, target: Vector3 };
}

export type CameraAction = { type: string; view?: CameraView };

interface SceneProps {
    language?: Language;
    objects: SceneObject[];
    visibleLayerIds: string[];
    selectedIds: string[];
    lockedLayerIds: string[];
    onSelect: (idOrIds: string | string[] | null) => void;
    onLassoSelect: (ids: string[]) => void;
    onTransform: (id: string, updates: Partial<SceneObject>) => void;
    onTransformMultiple?: (updates: { id: string; updates: Partial<SceneObject> }[]) => void;
    onTransformStart: () => void; 
    onTransformEnd: () => void;
    mode: 'translate' | 'rotate' | 'scale';
    isDrawingMode: boolean;
    activeTool: 'select' | 'brush' | 'eraser' | 'draw-plane' | 'lasso' | 'shapes' | 'view' | 'loft' | 'loft-step-1' | 'loft-step-2' | 'pipette';
    eraserMode: 'object' | 'partial';
    eraserSize?: number;
    currentBrushColor: string;
    currentBrushSize: number;
    currentBrushSmoothing: number; // New Prop
    
    // Updated Symmetry Props
    isSymmetryEnabled: boolean;
    symmetryX: number; // Legacy prop kept for compatibility
    symmetryAxis?: 'x' | 'y' | 'z';
    symmetryPosition?: Vector3;

    // Geometry Visibility
    areGeometryVisible?: boolean;

    // Scene Environment & Helpers
    isGridVisible?: boolean;
    backgroundColor?: string;
    onPickColorAndThickness?: (color: string, thickness?: number) => void;

    onStrokeComplete: (points: Vector3[], strokeCamDir?: THREE.Vector3) => void;
    onErase?: (id: string) => void;
    onPartialErase?: (id: string, point: Vector3, radius: number) => void;
    onCameraDirectionUpdate: (dir: Vector3) => void;
    
    cameraAction: CameraAction | null;
    onCameraActionHandled: () => void;
    
    fitViewTrigger?: number; 
    isoViewTrigger?: number; 

    onUndo?: () => void;
    onRedo?: () => void;
    
    // Lasso & FOV feedback
    onLassoPointsChange?: (points: { x: number; y: number }[]) => void;
    onFOVDisplayChange?: (text: string | null) => void;

    // Export Ref
    exportRef?: React.Ref<SceneExportRef>;
}

// Helper to generate DXF String
const generateDXF = (objects: SceneObject[], threeGroup: THREE.Group) => {
    let s = "";
    // Header
    s += "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n";
    // Tables (Layers)
    s += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n1\n";
    // Default Layer
    s += "0\nLAYER\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS\n0\n";
    s += "ENDTAB\n0\nENDSEC\n";
    
    // Entities
    s += "0\nSECTION\n2\nENTITIES\n";

    // 1. Process Strokes as POLYLINE (Analytic / Vector data)
    objects.forEach(obj => {
        if (!obj.visible) return;
        
        // Transform setup
        const pos = new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z);
        const rot = new THREE.Euler(obj.rotation.x, obj.rotation.y, obj.rotation.z);
        const scale = new THREE.Vector3(obj.scale.x, obj.scale.y, obj.scale.z);

        if (obj.type === 'stroke' && obj.strokeData) {
            // Write POLYLINE header
            s += "0\nPOLYLINE\n";
            s += `8\n${obj.name.replace(/\s+/g, '_')}\n`; // Layer Name
            s += "66\n1\n"; // Entities follow
            s += "70\n8\n"; // 3D Polyline flag
            s += `10\n0.0\n20\n0.0\n30\n0.0\n`; // Origin

            // Write Vertices
            obj.strokeData.points.forEach(p => {
                const v = new THREE.Vector3(p.x, p.y, p.z);
                // Apply Transform
                v.applyEuler(rot).multiply(scale).add(pos);
                
                s += "0\nVERTEX\n";
                s += `8\n${obj.name.replace(/\s+/g, '_')}\n`;
                s += "70\n32\n"; // 3D Vertex flag
                s += `10\n${v.x.toFixed(4)}\n`;
                s += `20\n${v.y.toFixed(4)}\n`;
                s += `30\n${v.z.toFixed(4)}\n`;
            });

            s += "0\nSEQEND\n";
        }
        else {
            // For Meshes (Box, Sphere, Imported, Blob, etc.), we need the actual geometry from Three.js
            // Find the object in the group
            let meshObject: THREE.Mesh | null = null;
            threeGroup.traverse((child) => {
                if (child.userData?.id === obj.id && (child as THREE.Mesh).isMesh) {
                    meshObject = child as THREE.Mesh;
                } else if (child.userData?.id === obj.id && child.type === 'Group') {
                    // It might be a group containing meshes (like GLB import)
                    child.traverse((sub) => {
                         if ((sub as THREE.Mesh).isMesh) meshObject = sub as THREE.Mesh; // Naive: grab first mesh
                    });
                }
            });

            if (meshObject) {
                const mesh = meshObject as THREE.Mesh;
                const geom = mesh.geometry;
                
                // Ensure we have world matrix applied geometry
                const matrixWorld = mesh.matrixWorld;
                
                // Get position attribute
                const posAttr = geom.attributes.position;
                const indexAttr = geom.index;

                if (posAttr) {
                    // Helper to get world v
                    const getV = (idx: number) => {
                        const v = new THREE.Vector3();
                        v.fromBufferAttribute(posAttr, idx);
                        v.applyMatrix4(matrixWorld);
                        return v;
                    };

                    const writeFace = (a: number, b: number, c: number) => {
                        const v1 = getV(a);
                        const v2 = getV(b);
                        const v3 = getV(c);
                        
                        s += "0\n3DFACE\n";
                        s += `8\n${obj.name.replace(/\s+/g, '_')}\n`;
                        s += `10\n${v1.x.toFixed(4)}\n20\n${v1.y.toFixed(4)}\n30\n${v1.z.toFixed(4)}\n`;
                        s += `11\n${v2.x.toFixed(4)}\n21\n${v2.y.toFixed(4)}\n31\n${v2.z.toFixed(4)}\n`;
                        s += `12\n${v3.x.toFixed(4)}\n22\n${v3.y.toFixed(4)}\n32\n${v3.z.toFixed(4)}\n`;
                        s += `13\n${v3.x.toFixed(4)}\n23\n${v3.y.toFixed(4)}\n33\n${v3.z.toFixed(4)}\n`; // 3DFace repeats 3rd point for triangle
                    };

                    if (indexAttr) {
                        for (let i = 0; i < indexAttr.count; i += 3) {
                            writeFace(indexAttr.getX(i), indexAttr.getY(i), indexAttr.getZ(i));
                        }
                    } else {
                        for (let i = 0; i < posAttr.count; i += 3) {
                            writeFace(i, i+1, i+2);
                        }
                    }
                }
            }
        }
    });

    s += "0\nENDSEC\n0\nEOF\n";
    return s;
};

// Scene Exporter Component (Internal to Canvas)
const SceneExporter = forwardRef<SceneExportRef, { objects: SceneObject[], objectsGroupRef: React.RefObject<THREE.Group>, backgroundColor?: string }>(({ objects, objectsGroupRef, backgroundColor }, ref) => {
    const { gl, scene, camera, controls } = useThree();

    const buildExportScene = () => {
        const exportScene = new THREE.Scene();
        if (!objectsGroupRef.current) return exportScene;

        objects.forEach(obj => {
            if (!obj.visible) return;

            const pos = new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z);
            const rot = new THREE.Euler(obj.rotation.x, obj.rotation.y, obj.rotation.z);
            const scale = new THREE.Vector3(obj.scale.x, obj.scale.y, obj.scale.z);

            if (obj.type === 'stroke' && obj.strokeData && obj.strokeData.points.length >= 2) {
                try {
                    const pts = obj.strokeData.points.map(p => new THREE.Vector3(p.x, p.y, p.z));
                    const curve = new THREE.CatmullRomCurve3(pts);
                    const thickness = Math.max(0.01, (obj.strokeData.thickness || 0.05) * 0.5);
                    const tubeGeom = new THREE.TubeGeometry(curve, Math.max(10, pts.length * 3), thickness, 8, false);
                    const mat = new THREE.MeshStandardMaterial({ color: obj.material.color || '#000000', roughness: 0.5 });
                    const tubeMesh = new THREE.Mesh(tubeGeom, mat);
                    tubeMesh.position.copy(pos);
                    tubeMesh.rotation.copy(rot);
                    tubeMesh.scale.copy(scale);
                    exportScene.add(tubeMesh);
                } catch (err) {
                    console.warn("Failed to create tube mesh for stroke:", err);
                }
            } else {
                objectsGroupRef.current!.traverse((child) => {
                    if (child.userData?.id === obj.id) {
                        if ((child as THREE.Mesh).isMesh) {
                            const m = child as THREE.Mesh;
                            if (m.geometry && m.geometry.attributes && m.geometry.attributes.position) {
                                const clonedMesh = m.clone();
                                clonedMesh.applyMatrix4(m.matrixWorld);
                                exportScene.add(clonedMesh);
                            }
                        } else if (child.type === 'Group' || child.type === 'Object3D') {
                            child.traverse((sub) => {
                                if ((sub as THREE.Mesh).isMesh) {
                                    const m = sub as THREE.Mesh;
                                    if (m.geometry && m.geometry.attributes && m.geometry.attributes.position) {
                                        const clonedMesh = m.clone();
                                        clonedMesh.applyMatrix4(m.matrixWorld);
                                        exportScene.add(clonedMesh);
                                    }
                                }
                            });
                        }
                    }
                });
            }
        });

        return exportScene;
    };

    useImperativeHandle(ref, () => ({
        exportSTL: async () => {
            // @ts-ignore
            const { STLExporter } = await import('three/examples/jsm/exporters/STLExporter');
            const exporter = new STLExporter();
            const exportScene = buildExportScene();
            const result = exporter.parse(exportScene, { binary: true });
            return new Blob([result], { type: 'application/octet-stream' });
        },
        exportGLB: async () => {
            // @ts-ignore
            const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter');
            const exporter = new GLTFExporter();
            const exportScene = buildExportScene();

            return new Promise((resolve, reject) => {
                exporter.parse(
                    exportScene,
                    (result: any) => {
                        if (result instanceof ArrayBuffer) {
                            resolve(new Blob([result], { type: 'model/gltf-binary' }));
                        } else {
                            const output = JSON.stringify(result, null, 2);
                            resolve(new Blob([output], { type: 'model/gltf+json' }));
                        }
                    },
                    (err: any) => reject(err),
                    { binary: true }
                );
            });
        },
        exportDXF: async () => {
            if (!objectsGroupRef.current) throw new Error("No objects");
            const dxfString = generateDXF(objects, objectsGroupRef.current);
            return new Blob([dxfString], { type: 'application/dxf' });
        },
        getScreenshot: (format, scaleMultiplier = 1, transparent = false) => {
            const currentPixelRatio = gl.getPixelRatio();
            const currentSize = new THREE.Vector2();
            gl.getSize(currentSize);
            const origClearColor = new THREE.Color();
            const origClearAlpha = gl.getClearAlpha();
            gl.getClearColor(origClearColor);

            try {
                // Limit maximum render dimensions to safe mobile WebGL limits (<= 4096px)
                const maxDim = Math.min(gl.capabilities.maxTextureSize || 4096, 4096);
                let targetW = Math.round(currentSize.x * (scaleMultiplier || 1));
                let targetH = Math.round(currentSize.y * (scaleMultiplier || 1));
                if (targetW > maxDim || targetH > maxDim) {
                    const ratio = Math.min(maxDim / targetW, maxDim / targetH);
                    targetW = Math.round(targetW * ratio);
                    targetH = Math.round(targetH * ratio);
                }

                if (scaleMultiplier > 1) {
                    gl.setSize(targetW, targetH, false);
                    if (camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera) {
                        camera.updateProjectionMatrix();
                    }
                }
                if (transparent) {
                    gl.setClearColor(0x000000, 0);
                } else {
                    gl.setClearColor(new THREE.Color(backgroundColor || '#ffffff'), 1);
                }

                gl.render(scene, camera);
                const dataUrl = gl.domElement.toDataURL(format || 'image/png');
                if (!dataUrl || dataUrl === 'data:,' || dataUrl.length < 50) {
                    throw new Error("Canvas render output is empty or failed to capture");
                }
                return dataUrl;
            } finally {
                // Restore original dimensions and clear color
                gl.setSize(currentSize.x, currentSize.y, false);
                gl.setPixelRatio(currentPixelRatio);
                gl.setClearColor(origClearColor, origClearAlpha);
                if (camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera) {
                    camera.updateProjectionMatrix();
                }
                gl.render(scene, camera);
            }
        },
        getCameraState: () => {
             const ctrl = controls as any;
             return {
                 position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
                 target: { x: ctrl.target.x, y: ctrl.target.y, z: ctrl.target.z }
             };
        }
    }));
    return null;
});

// IMPROVED SELECTION BOX: Renders in World Space to avoid offset issues
const SelectionBox: React.FC<{ object: THREE.Object3D | null }> = ({ object }) => {
    const box = useMemo(() => new THREE.Box3(), []);
    const size = useMemo(() => new THREE.Vector3(), []);
    const center = useMemo(() => new THREE.Vector3(), []);
    const [visible, setVisible] = useState(false);

    useFrame(() => {
        if (object) {
            // Get World AABB
            box.setFromObject(object);
            if (!box.isEmpty()) {
                box.getSize(size);
                box.getCenter(center);
                setVisible(true);
                return;
            }
        }
        setVisible(false);
    });

    if (!object || !visible) return null;

    return (
        <group position={[center.x, center.y, center.z]}>
            {/* Box Helper - Renders ON TOP (depthTest=false) */}
            <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(size.x, size.y, size.z)]} />
                <lineBasicMaterial color="#F2B441" depthTest={false} toneMapped={false} linewidth={3} transparent opacity={1.0} />
            </lineSegments>
            {/* Corner Markers for better visibility */}
             <mesh position={[size.x/2, size.y/2, size.z/2]}>
                 <boxGeometry args={[0.08, 0.08, 0.08]} />
                 <meshBasicMaterial color="#F2B441" depthTest={false} toneMapped={false} />
             </mesh>
             <mesh position={[-size.x/2, -size.y/2, -size.z/2]}>
                 <boxGeometry args={[0.08, 0.08, 0.08]} />
                 <meshBasicMaterial color="#F2B441" depthTest={false} toneMapped={false} />
             </mesh>
        </group>
    );
};

// -- Symmetry Plane Visual Component --
const SymmetryPlane: React.FC<{ 
    enabled: boolean; 
    axis: 'x' | 'y' | 'z'; 
    position: Vector3; 
    isSelected: boolean;
    onSelect: () => void; 
}> = ({ enabled, axis, position, isSelected, onSelect }) => {
    const planeRef = useRef<THREE.Mesh>(null);
    const planeArgs: [number, number] = [20, 20];
    const rotation: [number, number, number] = axis === 'x' ? [0, Math.PI / 2, 0] : axis === 'y' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    
    if (!enabled) return null;

    return (
        <mesh 
            ref={planeRef}
            position={[position.x, position.y, position.z]}
            rotation={rotation}
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
        >
            <planeGeometry args={planeArgs} />
            <meshBasicMaterial color={isSelected ? "#5185A6" : "#8FB6D9"} transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
            <lineSegments>
                <edgesGeometry args={[new THREE.PlaneGeometry(...planeArgs)]} />
                <lineBasicMaterial color={isSelected ? "#5185A6" : "#8FB6D9"} transparent opacity={0.5} />
            </lineSegments>
        </mesh>
    );
};

const ImageComponent = React.forwardRef<THREE.Mesh, { data: SceneObject; isSelected: boolean; isLocked: boolean; onSelect: (e:any) => void }>(({ data, isSelected, isLocked, onSelect }, ref) => {
    const texture = useLoader(THREE.TextureLoader, data.url || '');
    const localRef = useRef<THREE.Mesh>(null);
    useImperativeHandle(ref, () => localRef.current!);

    return (
        <mesh 
            ref={localRef}
            onClick={!isLocked ? onSelect : undefined} 
            userData={{ id: data.id, type: 'image', layerId: data.layerId }}
            position={[data.position.x, data.position.y, data.position.z]}
            rotation={[data.rotation.x, data.rotation.y, data.rotation.z]}
            scale={[data.scale.x, data.scale.y, data.scale.z]}
        >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={texture} transparent={true} opacity={data.material.opacity ?? 0.8} side={THREE.DoubleSide} />
        </mesh>
    );
});

const ExtrusionComponent = React.forwardRef<THREE.Mesh, { data: SceneObject; isSelected: boolean; isLocked: boolean; onSelect: (e:any) => void }>(({ data, isSelected, isLocked, onSelect }, ref) => {
    const { material, extrusionData } = data;
    const localRef = useRef<THREE.Mesh>(null);
    useImperativeHandle(ref, () => localRef.current!);

    const geometry = useMemo(() => {
        if (!extrusionData || extrusionData.pathPoints.length < 2) return null;
        const pts = extrusionData.pathPoints.map(p => new THREE.Vector3(p.x, p.y, p.z));
        const height = extrusionData.height || 2;
        const extDir = extrusionData.extrusionDirection 
            ? new THREE.Vector3(extrusionData.extrusionDirection.x, extrusionData.extrusionDirection.y, extrusionData.extrusionDirection.z).normalize()
            : new THREE.Vector3(0, 1, 0);

        const vertices: number[] = []; 
        const indices: number[] = []; 
        const uvs: number[] = [];
        
        let totalLen = 0; 
        const dists = [0];
        for (let i = 1; i < pts.length; i++) { 
            const d = pts[i].distanceTo(pts[i-1]); 
            totalLen += d; 
            dists.push(totalLen); 
        }
        if (totalLen === 0) totalLen = 1;

        const halfH = height / 2;
        for (let i = 0; i < pts.length; i++) {
            const p = pts[i];
            const pBottom = p.clone().sub(extDir.clone().multiplyScalar(halfH));
            const pTop = p.clone().add(extDir.clone().multiplyScalar(halfH));

            vertices.push(pBottom.x, pBottom.y, pBottom.z);
            vertices.push(pTop.x, pTop.y, pTop.z);
            
            const u = dists[i] / totalLen; 
            uvs.push(u, 0); 
            uvs.push(u, 1);
            
            if (i < pts.length - 1) { 
                const base = i * 2; 
                indices.push(base, base + 2, base + 1); 
                indices.push(base + 1, base + 2, base + 3); 
            }
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geom.setIndex(indices); 
        geom.computeVertexNormals();
        return geom;
    }, [extrusionData]);
    
    if (!geometry) return null;
    return (
        <mesh ref={localRef} geometry={geometry} onClick={!isLocked ? onSelect : undefined} userData={{ id: data.id, type: 'extrusion', layerId: data.layerId }} 
            position={[data.position.x, data.position.y, data.position.z]}
            rotation={[data.rotation.x, data.rotation.y, data.rotation.z]}
            scale={[data.scale.x, data.scale.y, data.scale.z]}
            castShadow receiveShadow>
             {(() => {
                 const isSolid = (material.opacity ?? 1) >= 0.99;
                 return (
                     <meshStandardMaterial 
                         color={material.color} 
                         roughness={0.5} 
                         metalness={0.1} 
                         transparent={!isSolid} 
                         opacity={material.opacity ?? 1} 
                         depthWrite={isSolid} 
                         side={THREE.DoubleSide} 
                     />
                 );
             })()}
             {isSelected && (
                 <Outlines thickness={0.06} color="#FACC15" screenspace={false} opacity={1} transparent={false} angle={0} />
             )}
        </mesh>
    );
});

const LoftComponent = React.forwardRef<THREE.Mesh, { data: SceneObject; allObjects: SceneObject[]; isSelected: boolean; isLocked: boolean; onSelect: (e:any) => void }>(({ data, allObjects, isSelected, isLocked, onSelect }, ref) => {
    const localRef = useRef<THREE.Mesh>(null);
    useImperativeHandle(ref, () => localRef.current!);

    const geometry = useMemo(() => {
        try {
            if (!data.loftData) return null;
            const ids = data.loftData.strokeIds || (data.loftData.strokeIdA && data.loftData.strokeIdB ? [data.loftData.strokeIdA, data.loftData.strokeIdB] : []);
            if (!ids || ids.length < 2) return null;

            const strokes = ids
                .map(id => allObjects.find(o => o.id === id))
                .filter((s): s is SceneObject => !!s && !!s.strokeData?.points && s.strokeData.points.length >= 2);

            if (strokes.length < 2) return null;

            const segments = data.loftData.segments || 50;
            const sampledCurves: THREE.Vector3[][] = [];

            for (const stroke of strokes) {
                const sPos = new THREE.Vector3(stroke.position.x, stroke.position.y, stroke.position.z);
                const sRot = new THREE.Euler(stroke.rotation.x, stroke.rotation.y, stroke.rotation.z);
                const sScale = new THREE.Vector3(stroke.scale.x, stroke.scale.y, stroke.scale.z);
                const strokeMatrix = new THREE.Matrix4().compose(sPos, new THREE.Quaternion().setFromEuler(sRot), sScale);

                const pts = stroke.strokeData!.points.map(p => new THREE.Vector3(p.x, p.y, p.z).applyMatrix4(strokeMatrix));
                const curve = new THREE.CatmullRomCurve3(pts);
                const resampled = curve.getPoints(segments);
                if (resampled.length !== segments + 1) return null;
                sampledCurves.push(resampled);
            }

            const vertices: number[] = [];
            const indices: number[] = [];
            const uvs: number[] = [];

            let vertexOffset = 0;
            for (let c = 0; c < sampledCurves.length - 1; c++) {
                const curveA = sampledCurves[c];
                const curveB = sampledCurves[c + 1];

                const baseVertex = vertexOffset;
                for (let i = 0; i <= segments; i++) {
                    vertices.push(
                        curveA[i].x - data.position.x, 
                        curveA[i].y - data.position.y, 
                        curveA[i].z - data.position.z
                    );
                    vertices.push(
                        curveB[i].x - data.position.x, 
                        curveB[i].y - data.position.y, 
                        curveB[i].z - data.position.z
                    );

                    const u = i / segments;
                    const vA = c / (sampledCurves.length - 1);
                    const vB = (c + 1) / (sampledCurves.length - 1);
                    uvs.push(u, vA);
                    uvs.push(u, vB);

                    if (i < segments) {
                        const b = baseVertex + i * 2;
                        indices.push(b, b + 2, b + 1);
                        indices.push(b + 1, b + 2, b + 3);
                    }
                }
                vertexOffset += (segments + 1) * 2;
            }

            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            geom.setIndex(indices);
            geom.computeVertexNormals();
            return geom;
        } catch (e) {
            console.error("Loft geometry generation error:", e);
            return null;
        }
    }, [data.loftData, data.position.x, data.position.y, data.position.z, allObjects]);

    if (!geometry) return null;
    const isSolid = (data.material.opacity ?? 1) >= 0.99;
    return (
        <mesh ref={localRef} geometry={geometry} onClick={!isLocked ? onSelect : undefined} userData={{ id: data.id, type: 'loft', layerId: data.layerId }}
             position={[data.position.x, data.position.y, data.position.z]}
             rotation={[data.rotation.x, data.rotation.y, data.rotation.z]}
             scale={[data.scale.x, data.scale.y, data.scale.z]}
             castShadow receiveShadow>
             <meshStandardMaterial color={data.material.color} roughness={0.5} metalness={0.1} transparent={!isSolid} opacity={data.material.opacity ?? 1} depthWrite={isSolid} side={THREE.DoubleSide} />
             {isSelected && (
                 <Outlines thickness={0.06} color="#FACC15" screenspace={false} opacity={1} transparent={false} angle={0} />
             )}
        </mesh>
    );
});

// Component to handle filled interior of a stroke
const FilledStrokeMesh = ({ points, color, opacity }: { points: number[][], color: string, opacity: number }) => {
    const geometry = useMemo(() => {
        if (points.length < 3) return null;
        const geom = new THREE.BufferGeometry();
        const vertices: number[] = [];
        let cx = 0, cy = 0, cz = 0;
        points.forEach(p => { cx += p[0]; cy += p[1]; cz += p[2]; });
        cx /= points.length; cy /= points.length; cz /= points.length;
        vertices.push(cx, cy, cz);
        points.forEach(p => vertices.push(p[0], p[1], p[2]));
        const indices: number[] = [];
        const centerIdx = 0;
        for (let i = 1; i < points.length; i++) { indices.push(centerIdx, i, i + 1); }
        indices.push(centerIdx, points.length, 1);
        geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geom.setIndex(indices);
        return geom;
    }, [points]);
    if (!geometry) return null;
    const isSolid = opacity >= 0.99;
    return (
        <mesh geometry={geometry}>
            <meshBasicMaterial 
                color={color} 
                side={THREE.DoubleSide} 
                transparent={!isSolid} 
                opacity={opacity}
                depthWrite={isSolid}
                depthTest={true}
                polygonOffset={true}
                polygonOffsetFactor={1}
                polygonOffsetUnits={1}
            />
        </mesh>
    );
};

const StrokeComponent = React.forwardRef<THREE.Group, { data: SceneObject; isSelected: boolean; isLocked: boolean; onSelect: (e:any) => void }>(({ data, isSelected, isLocked, onSelect }, ref) => {
    const localRef = useRef<THREE.Group>(null);
    useImperativeHandle(ref, () => localRef.current!);

    if (!data.strokeData || data.strokeData.points.length < 2) return null;
    const points = useMemo(() => data.strokeData!.points.map(p => [p.x, p.y, p.z] as [number, number, number]), [data.strokeData]);
    const isSolid = (data.material.opacity ?? 1) >= 0.99;
    
    return (
        <group ref={localRef} onClick={!isLocked ? onSelect : undefined} userData={{ id: data.id, type: 'stroke', layerId: data.layerId }}
            position={[data.position.x, data.position.y, data.position.z]}
            rotation={[data.rotation.x, data.rotation.y, data.rotation.z]}
            scale={[data.scale.x, data.scale.y, data.scale.z]}
        >
            {/* Outline highlight in vivid yellow - rendered with renderOrder 1 to prevent flickering */}
            {isSelected && (
                <Line 
                    points={points} 
                    color="#FACC15" 
                    lineWidth={data.strokeData.thickness * 1.5 + 0.03} 
                    opacity={1} 
                    transparent={false} 
                    depthTest={true} 
                    depthWrite={false}
                    renderOrder={1} 
                    worldUnits 
                />
            )}
            <Line 
                points={points} 
                color={data.material.color} 
                lineWidth={data.strokeData.thickness} 
                opacity={data.material.opacity ?? 1} 
                transparent={!isSolid} 
                depthTest={true} 
                depthWrite={isSolid} 
                renderOrder={2} 
                worldUnits 
            />
            {data.strokeData.filled && <FilledStrokeMesh points={points} color={data.material.color} opacity={data.material.opacity ?? 1} />}
        </group>
    );
});

// --- IMPORT COMPONENT SPLIT (STL / GLB / 3DM) ---

// Error Boundary for Suspense Loaders
const ModelError: React.FC<{error: any}> = ({error}) => {
    console.warn("Failed to load model:", error);
    return (
        <mesh>
            <boxGeometry args={[1,1,1]} />
            <meshBasicMaterial color="red" wireframe />
        </mesh>
    )
}

const SafeLoader = ({ children }: { children?: React.ReactNode }) => {
    return (
        <Suspense fallback={<mesh><boxGeometry /><meshBasicMaterial color="gray" wireframe /></mesh>}>
            {children}
        </Suspense>
    )
}

const STLModel = forwardRef<THREE.Mesh, { url: string; data: SceneObject; isSelected: boolean }>(({ url, data, isSelected }, ref) => {
    try {
        const geom = useLoader(STLLoader, url);
        const geometry = useMemo(() => {
            const c = geom.clone();
            c.center();
            c.computeVertexNormals(); 
            c.computeBoundingSphere();
            if (c.boundingSphere && c.boundingSphere.radius > 0) {
                const r = c.boundingSphere.radius;
                if (r > 8 || r < 0.5) {
                    const targetRadius = 3.5;
                    const scaleFactor = targetRadius / r;
                    c.scale(scaleFactor, scaleFactor, scaleFactor);
                }
            }
            return c;
        }, [geom]);
        
        return (
            <mesh ref={ref} geometry={geometry} castShadow receiveShadow>
                <meshStandardMaterial 
                    color={data.material?.color || "#E0E0E0"} 
                    roughness={0.6} 
                    metalness={0.1} 
                    transparent={true} 
                    opacity={data.material?.opacity ?? 0.75} 
                    side={THREE.DoubleSide} 
                />
                {isSelected && <Outlines thickness={0.05} color="#FACC15" screenspace={false} />}
            </mesh>
        );
    } catch (e) {
        return <ModelError error={e} />;
    }
});

const OBJModel = forwardRef<THREE.Group, { url: string; data: SceneObject; isSelected: boolean }>(({ url, data, isSelected }, ref) => {
    try {
        const obj = useLoader(OBJLoader, url);
        const normalizedObj = useMemo(() => {
            const clone = obj.clone(true);
            
            // Neutral base geometry material without textures to allow sketching on top
            const neutralMat = new THREE.MeshStandardMaterial({
                color: data.material?.color || '#E0E0E0',
                roughness: 0.6,
                metalness: 0.1,
                transparent: true,
                opacity: data.material?.opacity ?? 0.75,
                side: THREE.DoubleSide
            });

            clone.traverse((child: any) => {
                if (child.isMesh) {
                    child.material = neutralMat;
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.geometry) {
                        child.geometry.computeVertexNormals();
                    }
                }
            });

            // Center and scale to fit viewport comfortably
            const bbox = new THREE.Box3().setFromObject(clone);
            const center = new THREE.Vector3();
            bbox.getCenter(center);
            clone.position.sub(center);

            const size = new THREE.Vector3();
            bbox.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 10 || maxDim < 0.5) {
                const scaleFactor = 6.0 / (maxDim || 1);
                clone.scale.multiplyScalar(scaleFactor);
            }

            return clone;
        }, [obj, data.material?.color, data.material?.opacity]);

        return (
            <group ref={ref}>
                <primitive object={normalizedObj} />
                {isSelected && <ModelOutlines object={normalizedObj} color="#FACC15" thickness={0.05} />}
            </group>
        );
    } catch (e) {
        return <ModelError error={e} />;
    }
});

import { createPortal } from '@react-three/fiber';

// Helper to apply Outlines to all meshes in a group
const ModelOutlines = ({ object, color = "yellow", thickness = 0.05 }: { object: THREE.Object3D, color?: string, thickness?: number }) => {
    const [meshes, setMeshes] = useState<THREE.Mesh[]>([]);
    
    useEffect(() => {
        const list: THREE.Mesh[] = [];
        object.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) list.push(child as THREE.Mesh);
        });
        setMeshes(list);
    }, [object]);

    return (
        <>
            {meshes.map(mesh => createPortal(
                <Outlines thickness={thickness} color={color} screenspace={false} opacity={1} transparent={false} angle={0} />,
                mesh
            ))}
        </>
    );
};

const GLTFModel = forwardRef<THREE.Group, { url: string; data: SceneObject; isSelected: boolean }>(({ url, data, isSelected }, ref) => {
    try {
        const gltf = useLoader(GLTFLoader, url);
        const { gl } = useThree();
        
        const scene = useMemo(() => {
            const s = gltf.scene.clone();
            
            // Apply material overrides (optional) but RESPECT TEXTURES
            s.traverse((child: any) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material.map) {
                        child.material.map.anisotropy = gl.capabilities.getMaxAnisotropy();
                        child.material.map.minFilter = THREE.LinearMipmapLinearFilter;
                        child.material.map.magFilter = THREE.LinearFilter;
                        child.material.color.set(0xffffff); 
                    } else {
                        child.material.color.set(data.material.color);
                    }
                }
            });
            // Center GLTF to its local origin so the Gumball is centered directly on the model
            const bbox = new THREE.Box3().setFromObject(s);
            const center = new THREE.Vector3();
            bbox.getCenter(center);
            s.position.sub(center);

            return s;
        }, [gltf, data.material.color, isSelected, gl]);

        return (
            <group ref={ref}>
                <primitive object={scene} />
                {isSelected && <ModelOutlines object={scene} />}
            </group>
        );
    } catch (e) {
        return <ModelError error={e} />;
    }
});

const RhinoModel = forwardRef<THREE.Group, { url: string; data: SceneObject; isSelected: boolean }>(({ url, data, isSelected }, ref) => {
    try {
        // Rhino3dmLoader typically needs a WASM file. In a CDN environment, we must point to it.
        const object = useLoader(Rhino3dmLoader, url, (loader) => {
            // Point to jsdelivr for the rhino3dm library (WASM)
            loader.setLibraryPath('https://cdn.jsdelivr.net/npm/rhino3dm@8.0.0/');
        });

        const scene = useMemo(() => {
            // Clone to allow independent instances
            const s = object.clone();
            s.traverse((child: any) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    // Rhino objects often come with specific materials. 
                    // We apply our override color only if it lacks a texture, OR if we want to force uniformity.
                    // For drawing purposes, ensuring it's a mesh is key.
                    if (!child.material.map) {
                        child.material.color.set(data.material.color);
                        child.material.transparent = true;
                        child.material.opacity = data.material.opacity ?? 0.8;
                    }
                }
            });

            // Center Rhino model to its local origin so the Gumball is centered directly on the model
            const bbox = new THREE.Box3().setFromObject(s);
            const center = new THREE.Vector3();
            bbox.getCenter(center);
            s.position.sub(center);

            return s;
        }, [object, data.material.color, data.material.opacity, isSelected]);

        return (
            <group ref={ref}>
                <primitive object={scene} />
                {isSelected && <ModelOutlines object={scene} />}
            </group>
        );
    } catch(e) {
        return <ModelError error={e} />;
    }
});


// -- Group Component --
const GroupComponent = React.forwardRef<THREE.Group, { data: SceneObject; isSelected: boolean; isLocked: boolean; onSelect: (e: any) => void; children?: React.ReactNode }>(({ data, isSelected, isLocked, onSelect, children }, ref) => {
    const localRef = useRef<THREE.Group>(null);
    useImperativeHandle(ref, () => localRef.current!);

    return (
        <group
            ref={localRef}
            userData={{ id: data.id, type: 'group', layerId: data.layerId }}
            position={[data.position.x, data.position.y, data.position.z]}
            rotation={[data.rotation.x, data.rotation.y, data.rotation.z]}
            scale={[data.scale.x, data.scale.y, data.scale.z]}
            onClick={(e) => {
                if (!isLocked) {
                    e.stopPropagation();
                    onSelect(data.id);
                }
            }}
        >
            {children}
        </group>
    );
});

const ImportedMeshComponent = React.forwardRef<THREE.Object3D, { data: SceneObject; isSelected: boolean; isLocked: boolean; onSelect: (e: any) => void }>(({ data, isSelected, isLocked, onSelect }, ref) => {
    const localRef = useRef<THREE.Object3D>(null);
    useImperativeHandle(ref, () => localRef.current!);
    
    const format = (data.importFormat || data.name.split('.').pop() || '').toLowerCase();
    const urlLower = data.url?.toLowerCase() || '';
    const isGLTF = format === 'glb' || format === 'gltf' || urlLower.endsWith('.glb') || urlLower.endsWith('.gltf');
    const isRhino = format === '3dm' || urlLower.endsWith('.3dm');
    const isOBJ = format === 'obj' || urlLower.endsWith('.obj');
    
    // Simple URL validation to fail fast
    if (!data.url || data.url.includes('undefined')) {
         return <mesh><boxGeometry /><meshBasicMaterial color="red" /></mesh>;
    }

    useFrame((state) => {
        if (!localRef.current) return;
        const dist = state.camera.position.distanceTo(localRef.current.position);
        const fadeStart = 20;
        const fadeEnd = 60;
        let factor = 1;
        if (dist > fadeStart) {
            factor = Math.max(0.1, 1 - (dist - fadeStart) / (fadeEnd - fadeStart));
        }
        
        localRef.current.traverse((child: any) => {
            if (child.isMesh && child.material) {
                const base = data.material.opacity ?? 0.8;
                const target = base * factor;
                if (Array.isArray(child.material)) {
                    child.material.forEach((m: any) => {
                        if (Math.abs(m.opacity - target) > 0.01) {
                            m.opacity = target;
                            m.transparent = true;
                        }
                    });
                } else {
                    if (Math.abs(child.material.opacity - target) > 0.01) {
                        child.material.opacity = target;
                        child.material.transparent = true;
                    }
                }
            }
        });
    });

    return (
        <group 
            ref={localRef}
            onClick={!isLocked ? onSelect : undefined} 
            userData={{ id: data.id, type: data.type, layerId: data.layerId }} 
            position={[data.position.x, data.position.y, data.position.z]} 
            rotation={[data.rotation.x, data.rotation.y, data.rotation.z]} 
            scale={[data.scale.x, data.scale.y, data.scale.z]}
        >
            <SafeLoader>
                {isGLTF 
                    ? <GLTFModel url={data.url} data={data} isSelected={isSelected} />
                    : isRhino
                        ? <RhinoModel url={data.url} data={data} isSelected={isSelected} />
                        : isOBJ
                            ? <OBJModel url={data.url} data={data} isSelected={isSelected} />
                            : <STLModel url={data.url} data={data} isSelected={isSelected} />
                }
            </SafeLoader>
        </group>
    );
});

const MeshComponent = React.forwardRef<THREE.Mesh, { data: SceneObject; isSelected: boolean; isLocked: boolean; onSelect: (e: any) => void }>(({ data, isSelected, isLocked, onSelect }, ref) => {
    const { position, rotation, scale, type, material, params } = data;
    const localRef = useRef<THREE.Mesh>(null);
    useImperativeHandle(ref, () => localRef.current!);
    
    const geometry = useMemo(() => {
        switch (type) {
            case 'box': return new THREE.BoxGeometry(params?.width || 1, params?.height || 1, params?.depth || 1);
            case 'sphere': return new THREE.SphereGeometry(params?.radius || 0.5, 32, 32);
            case 'cylinder': return new THREE.CylinderGeometry(params?.radius || 0.5, params?.radius || 0.5, params?.height || 1, 32);
            case 'cone': return new THREE.ConeGeometry(params?.radius || 0.5, params?.height || 1, 32);
            case 'capsule': return new THREE.CapsuleGeometry(params?.radius || 0.5, params?.height || 1, 4, 16);
            case 'torus': return new THREE.TorusGeometry(params?.radius || 0.5, params?.tube || 0.2, 16, 50);
            case 'tetrahedron': return new THREE.TetrahedronGeometry(params?.radius || 1);
            case 'octahedron': return new THREE.OctahedronGeometry(params?.radius || 1);
            case 'plane': return new THREE.PlaneGeometry(params?.width || 2, params?.height || 2);
            default: return new THREE.BoxGeometry();
        }
    }, [type, params]);

    useFrame((state) => {
        if (!localRef.current) return;
        const dist = state.camera.position.distanceTo(localRef.current.position);
        const fadeStart = 20;
        const fadeEnd = 60;
        let factor = 1;
        if (dist > fadeStart) {
            factor = Math.max(0.1, 1 - (dist - fadeStart) / (fadeEnd - fadeStart));
        }
        
        const mat = localRef.current.material as THREE.MeshStandardMaterial;
        if (mat) {
             const base = data.material.opacity ?? 0.8;
             const target = base * factor;
             if (Math.abs(mat.opacity - target) > 0.01) {
                 mat.opacity = target;
                 mat.transparent = true;
             }
        }
    });

    return (
        <mesh 
            ref={localRef}
            geometry={geometry}
            onClick={!isLocked ? onSelect : undefined}
            userData={{ id: data.id, type: data.type, layerId: data.layerId }}
            position={[position.x, position.y, position.z]}
            rotation={[rotation.x, rotation.y, rotation.z]}
            scale={[scale.x, scale.y, scale.z]}
            castShadow
            receiveShadow
        >
             {(() => {
                 const isSolid = (material.opacity ?? 1) >= 0.99;
                 return (
                     <meshStandardMaterial 
                         color={material.color} 
                         roughness={material.roughness} 
                         metalness={material.metalness} 
                         transparent={!isSolid} 
                         opacity={material.opacity ?? 1}
                         depthWrite={isSolid}
                         side={THREE.DoubleSide}
                     />
                 );
             })()}
            {isSelected && (
                <Outlines thickness={0.05} color="yellow" screenspace={false} opacity={1} transparent={false} angle={0} />
            )}
        </mesh>
    );
});

// Helper for Chaikin curve smoothing in Vector3
const smoothVector3Points = (points: THREE.Vector3[], iterations: number = 2): THREE.Vector3[] => {
    if (points.length < 3) return points;
    let current = points;
    for (let k = 0; k < iterations; k++) {
        const next: THREE.Vector3[] = [current[0]];
        for (let i = 0; i < current.length - 1; i++) {
            const p0 = current[i];
            const p1 = current[i + 1];
            next.push(new THREE.Vector3(0.75 * p0.x + 0.25 * p1.x, 0.75 * p0.y + 0.25 * p1.y, 0.75 * p0.z + 0.25 * p1.z));
            next.push(new THREE.Vector3(0.25 * p0.x + 0.75 * p1.x, 0.25 * p0.y + 0.75 * p1.y, 0.25 * p0.z + 0.75 * p1.z));
        }
        next.push(current[current.length - 1]);
        current = next;
    }
    return current;
};

// Gesture Handler Component
interface GestureHandlerProps {
    onSnapView: () => void;
    onAdjustFOV: (delta: number) => void;
    controlsRef: any;
    isDrawingMode?: boolean;
    activeTool?: string;
}

const GestureHandler = ({ onSnapView, onAdjustFOV, controlsRef, isDrawingMode, activeTool }: GestureHandlerProps) => {
    const { gl } = useThree();
    const threeFingerStart = useRef<number | null>(null);
    const tapCandidate = useRef<{ time: number; x: number; y: number; moved: boolean } | null>(null);
    const lastTapTime = useRef<number>(0);
    const lastTapPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const hadMultiTouch = useRef<boolean>(false);
    
    useEffect(() => {
        const el = gl.domElement;
        
        const handleTouchStart = (e: TouchEvent) => {
            const touchCount = e.touches.length;

            if (touchCount > 1) {
                // Multi-touch cancel single-finger tap
                hadMultiTouch.current = true;
                tapCandidate.current = null;
                lastTapTime.current = 0;

                if (touchCount === 3) {
                    if (controlsRef?.current) controlsRef.current.enabled = false;
                    threeFingerStart.current = e.touches[0].clientY;
                }
                return;
            }

            // Exactly 1 touch
            hadMultiTouch.current = false;

            // Only allow view snapping in select or view tool, NOT while drawing/erasing/lasso
            if (isDrawingMode || (activeTool && activeTool !== 'select' && activeTool !== 'view')) {
                tapCandidate.current = null;
                lastTapTime.current = 0;
                return;
            }

            const touch = e.touches[0];
            tapCandidate.current = {
                time: Date.now(),
                x: touch.clientX,
                y: touch.clientY,
                moved: false
            };
        };
        
        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 1 && tapCandidate.current) {
                const touch = e.touches[0];
                const dist = Math.hypot(touch.clientX - tapCandidate.current.x, touch.clientY - tapCandidate.current.y);
                // Strict movement threshold: > 6px cancels tap (it's orbit / pan)
                if (dist > 6) {
                    tapCandidate.current.moved = true;
                    tapCandidate.current = null;
                }
            } else if (e.touches.length === 3 && threeFingerStart.current !== null) {
                e.preventDefault();
                e.stopPropagation(); // Consume event for FOV / lens adjustment
                const delta = threeFingerStart.current - e.touches[0].clientY;
                onAdjustFOV(delta);
                threeFingerStart.current = e.touches[0].clientY;
            } else if (e.touches.length > 1) {
                hadMultiTouch.current = true;
                tapCandidate.current = null;
            }
        };
        
        const handleTouchEnd = (e: TouchEvent) => {
            if (hadMultiTouch.current || e.touches.length > 0) {
                tapCandidate.current = null;
                if (e.touches.length === 0) hadMultiTouch.current = false;
                if (threeFingerStart.current !== null && e.touches.length < 3) {
                    threeFingerStart.current = null;
                    if (controlsRef?.current) controlsRef.current.enabled = true;
                }
                return;
            }

            if (tapCandidate.current && !tapCandidate.current.moved) {
                const now = Date.now();
                const duration = now - tapCandidate.current.time;
                // Quick deliberate tap (< 180ms)
                if (duration >= 30 && duration <= 180) {
                    const tapX = tapCandidate.current.x;
                    const tapY = tapCandidate.current.y;
                    const timeSinceLastTap = now - lastTapTime.current;
                    const distFromLastTap = Math.hypot(tapX - lastTapPos.current.x, tapY - lastTapPos.current.y);

                    // 1-finger double tap in rapid succession (between 60ms and 260ms, < 14px)
                    if (timeSinceLastTap >= 60 && timeSinceLastTap <= 260 && distFromLastTap < 14) {
                        onSnapView();
                        lastTapTime.current = 0;
                    } else {
                        lastTapTime.current = now;
                        lastTapPos.current = { x: tapX, y: tapY };
                    }
                } else {
                    lastTapTime.current = 0;
                }
            } else {
                lastTapTime.current = 0;
            }
            tapCandidate.current = null;

            if (threeFingerStart.current !== null && e.touches.length < 3) {
                threeFingerStart.current = null;
                if (controlsRef?.current) controlsRef.current.enabled = true;
            }
        };

        const handleTouchCancel = () => {
            tapCandidate.current = null;
            lastTapTime.current = 0;
            hadMultiTouch.current = false;
            if (threeFingerStart.current !== null) {
                threeFingerStart.current = null;
                if (controlsRef?.current) controlsRef.current.enabled = true;
            }
        };

        el.addEventListener('touchstart', handleTouchStart, { passive: false });
        el.addEventListener('touchmove', handleTouchMove, { passive: false });
        el.addEventListener('touchend', handleTouchEnd);
        el.addEventListener('touchcancel', handleTouchCancel);
        
        return () => {
            el.removeEventListener('touchstart', handleTouchStart);
            el.removeEventListener('touchmove', handleTouchMove);
            el.removeEventListener('touchend', handleTouchEnd);
            el.removeEventListener('touchcancel', handleTouchCancel);
            if (controlsRef?.current) controlsRef.current.enabled = true;
        };
    }, [onSnapView, onAdjustFOV, gl, controlsRef, isDrawingMode, activeTool]);
    
    return null;
};

// Scene Content Manager
const SceneContent = ({ 
    language = 'es',
    objects, visibleLayerIds, selectedIds, lockedLayerIds, onSelect, onLassoSelect, onTransform, onTransformMultiple, onTransformStart, onTransformEnd,
    mode, isDrawingMode, activeTool, eraserMode, eraserSize = 0.2, currentBrushColor, currentBrushSize, currentBrushSmoothing, 
    isSymmetryEnabled, symmetryX, symmetryAxis = 'x', symmetryPosition = {x:0,y:0,z:0},
    areGeometryVisible, onStrokeComplete, onErase, onPartialErase,
    cameraAction, onCameraActionHandled, exportRef,
    onCameraDirectionUpdate, onUndo, onRedo, fitViewTrigger, isoViewTrigger,
    objectsGroupRef, onLassoPointsChange, onFOVDisplayChange,
    isGridVisible = true, backgroundColor = '#ffffff', onPickColorAndThickness
}: SceneProps & { objectsGroupRef: React.RefObject<THREE.Group> }) => {
    const { scene, camera, gl, raycaster, pointer } = useThree();
    const currentPoints = useRef<THREE.Vector3[]>([]);
    const isDrawing = useRef(false);
    const canvasRef = useRef<HTMLCanvasElement>(gl.domElement);
    const [previewPath, setPreviewPath] = useState<THREE.Vector3[]>([]);
    const [targetObject, setTargetObject] = useState<THREE.Object3D | null>(null);
    
    // Lasso State
    const [lassoPoints, setLassoPoints] = useState<{x:number, y:number}[]>([]);
    const isLassoing = useRef(false);

    // Eraser visual cursor position in 3D
    const [eraserCursorPos, setEraserCursorPos] = useState<THREE.Vector3 | null>(null);
    const fovTimerRef = useRef<any>(null);

    // Camera Controls
    const controlsRef = useRef<any>(null);
    const transformControlsRef = useRef<any>(null);
    const isTransformingRef = useRef(false);
    const [camType, setCamType] = useState<'perspective' | 'orthographic'>('perspective');
    const [cameraFov, setCameraFov] = useState(45);
    const [orthoZoom, setOrthoZoom] = useState(40);

    // Automatically transition back to perspective view when the user begins orbiting in 3D
    useEffect(() => {
        const controls = controlsRef.current;
        if (!controls) return;
        const handleOrbitStart = () => {
            if (camType === 'orthographic') {
                setCamType('perspective');
            }
        };
        controls.addEventListener('start', handleOrbitStart);
        return () => {
            controls.removeEventListener('start', handleOrbitStart);
        };
    }, [camType]);

    // Orbit Controls: Only allow orbiting with fingers (touch) or mouse.
    // Pen / stylus is strictly for drawing, selecting, or transforming.
    useEffect(() => {
        const dom = gl.domElement;
        const onCapturePointerDown = (e: PointerEvent) => {
            if (e.pointerType === 'pen') {
                if (controlsRef.current) {
                    controlsRef.current.enabled = false;
                }
            } else if (!isTransformingRef.current) {
                if (controlsRef.current) {
                    controlsRef.current.enabled = true;
                }
            }
        };
        const onCapturePointerUp = (e: PointerEvent) => {
            if (e.pointerType !== 'pen' && !isTransformingRef.current && controlsRef.current) {
                controlsRef.current.enabled = true;
            }
        };
        dom.addEventListener('pointerdown', onCapturePointerDown, { capture: true });
        window.addEventListener('pointerup', onCapturePointerUp, { capture: true });
        return () => {
            dom.removeEventListener('pointerdown', onCapturePointerDown, { capture: true });
            window.removeEventListener('pointerup', onCapturePointerUp, { capture: true });
        };
    }, [gl.domElement]);

    // Gumball / TransformControls dragging listener: disable OrbitControls completely during transform
    useEffect(() => {
        const tc = transformControlsRef.current;
        if (!tc) return;
        const handleDragging = (event: any) => {
            isTransformingRef.current = !!event.value;
            if (controlsRef.current) {
                controlsRef.current.enabled = !event.value;
            }
        };
        tc.addEventListener('dragging-changed', handleDragging);
        return () => {
            tc.removeEventListener('dragging-changed', handleDragging);
        };
    }, [targetObject, mode]);

    // Update target object for TransformControls (Single Selection)
    useEffect(() => {
        if (selectedIds.length === 1 && objectsGroupRef.current) {
            const obj = objectsGroupRef.current.children.find(c => c.userData.id === selectedIds[0]);
            setTargetObject(obj || null);
        } else {
            setTargetObject(null);
        }
    }, [selectedIds, objects]);

    // Multi-selection Centroid & Transform Proxy
    const multiCentroid = useMemo(() => {
        if (selectedIds.length <= 1) return null;
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        let count = 0;
        selectedIds.forEach(id => {
            const obj = objects.find(o => o.id === id);
            if (obj && obj.position) {
                minX = Math.min(minX, obj.position.x);
                minY = Math.min(minY, obj.position.y);
                minZ = Math.min(minZ, obj.position.z);
                maxX = Math.max(maxX, obj.position.x);
                maxY = Math.max(maxY, obj.position.y);
                maxZ = Math.max(maxZ, obj.position.z);
                count++;
            }
        });
        if (count === 0) return null;
        return new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
    }, [selectedIds, objects]);

    const multiProxyMeshRef = useRef<THREE.Mesh>(null);
    const multiTransformControlsRef = useRef<any>(null);
    const initialCentroidRef = useRef<THREE.Vector3 | null>(null);
    const initialMultiPositionsRef = useRef<Map<string, { x: number; y: number; z: number }>>(new Map());

    useEffect(() => {
        if (multiProxyMeshRef.current && multiCentroid && !isTransformingRef.current) {
            multiProxyMeshRef.current.position.copy(multiCentroid);
        }
    }, [multiCentroid]);

    useEffect(() => {
        const mtc = multiTransformControlsRef.current;
        if (!mtc) return;
        const handleDragging = (event: any) => {
            isTransformingRef.current = !!event.value;
            if (controlsRef.current) {
                controlsRef.current.enabled = !event.value;
            }
        };
        mtc.addEventListener('dragging-changed', handleDragging);
        return () => {
            mtc.removeEventListener('dragging-changed', handleDragging);
        };
    }, [selectedIds]);

    // Gesture Callbacks: Snap to Closest Canonical View in 100% Orthographic Projection (Sin Perspectiva)
    const handleSnapView = useCallback(() => {
        const controls = controlsRef.current;
        if (!controls) return;
        
        const target = controls.target ? controls.target.clone() : new THREE.Vector3(0, 0, 0);

        // If already in orthographic, double tap smoothly returns to perspective view
        if (camType === 'orthographic') {
            setCamType('perspective');
            camera.up.set(0, 1, 0);
            if (controls.object) controls.object.up.set(0, 1, 0);
            controls.update();
            if (onFOVDisplayChange) {
                onFOVDisplayChange(language === 'en' ? 'Perspective View' : 'Vista en Perspectiva');
                if (fovTimerRef.current) clearTimeout(fovTimerRef.current);
                fovTimerRef.current = setTimeout(() => onFOVDisplayChange(null), 1800);
            }
            return;
        }

        const relPos = camera.position.clone().sub(target);
        const dist = Math.max(relPos.length(), 6);
        const dir = relPos.clone().normalize();
        
        const views = [
            { nameEn: 'Top View', nameEs: 'Vista Superior', dir: new THREE.Vector3(0, 1, 0), pos: new THREE.Vector3(0, dist, 0.0001), up: new THREE.Vector3(0, 0, -1) },
            { nameEn: 'Bottom View', nameEs: 'Vista Inferior', dir: new THREE.Vector3(0, -1, 0), pos: new THREE.Vector3(0, -dist, -0.0001), up: new THREE.Vector3(0, 0, 1) },
            { nameEn: 'Front View', nameEs: 'Vista Frontal', dir: new THREE.Vector3(0, 0, 1), pos: new THREE.Vector3(0, 0, dist), up: new THREE.Vector3(0, 1, 0) },
            { nameEn: 'Back View', nameEs: 'Vista Posterior', dir: new THREE.Vector3(0, 0, -1), pos: new THREE.Vector3(0, 0, -dist), up: new THREE.Vector3(0, 1, 0) },
            { nameEn: 'Right View', nameEs: 'Vista Derecha', dir: new THREE.Vector3(1, 0, 0), pos: new THREE.Vector3(dist, 0, 0), up: new THREE.Vector3(0, 1, 0) },
            { nameEn: 'Left View', nameEs: 'Vista Izquierda', dir: new THREE.Vector3(-1, 0, 0), pos: new THREE.Vector3(-dist, 0, 0), up: new THREE.Vector3(0, 1, 0) },
        ];
        
        let bestView = views[0];
        let maxDot = -Infinity;
        views.forEach(v => {
            const dot = dir.dot(v.dir);
            if (dot > maxDot) {
                maxDot = dot;
                bestView = v;
            }
        });
        
        const destPos = target.clone().add(bestView.pos);

        const visibleHeight = 2 * dist * Math.tan(THREE.MathUtils.degToRad(cameraFov / 2));
        const matchingZoom = gl.domElement.clientHeight / Math.max(visibleHeight, 0.1);
        setOrthoZoom(matchingZoom);

        if (onFOVDisplayChange) {
            const label = language === 'en' 
                ? `${bestView.nameEn} • Orthographic`
                : `${bestView.nameEs} • Ortográfica`;
            onFOVDisplayChange(label);
            if (fovTimerRef.current) clearTimeout(fovTimerRef.current);
            fovTimerRef.current = setTimeout(() => onFOVDisplayChange(null), 2000);
        }

        controls.enabled = false;
        gsap.to(camera.position, {
            x: destPos.x,
            y: destPos.y,
            z: destPos.z,
            duration: 0.35,
            ease: "power2.out",
            onUpdate: () => {
                camera.lookAt(target);
            },
            onComplete: () => {
                camera.up.copy(bestView.up);
                camera.lookAt(target);
                if (controls.object) {
                    controls.object.up.copy(bestView.up);
                    controls.target.copy(target);
                    controls.update();
                }
                setCamType('orthographic');
                controls.enabled = true;
            }
        });
    }, [camera, cameraFov, gl, onFOVDisplayChange, camType, language]);

    const handleToggleCamera = useCallback(() => {
        setCamType(prev => prev === 'perspective' ? 'orthographic' : 'perspective');
    }, []);

    const handleAdjustFOV = useCallback((delta: number) => {
        // Adjusting focal length / fuga automatically operates in perspective view
        if (camType === 'orthographic') {
            setCamType('perspective');
        }

        if (camera instanceof THREE.PerspectiveCamera) {
            const oldFov = camera.fov;
            // Dragging up (delta > 0) -> wider lens (more perspective/fuga, higher FOV)
            // Dragging down (delta < 0) -> telephoto lens (flatter/less fuga, lower FOV)
            let newFov = oldFov + delta * 0.12;
            newFov = Math.max(16, Math.min(100, newFov));

            if (Math.abs(newFov - oldFov) > 0.05) {
                // DOLLY ZOOM COMPENSATION:
                // Keep the framing of the object constant while changing the lens fuga!
                const controls = controlsRef.current;
                const target = controls ? controls.target : new THREE.Vector3(0, 0, 0);
                const currentDist = camera.position.distanceTo(target);

                if (currentDist > 0.05) {
                    const oldHalfTan = Math.tan(THREE.MathUtils.degToRad(oldFov / 2));
                    const newHalfTan = Math.tan(THREE.MathUtils.degToRad(newFov / 2));
                    const newDist = currentDist * (oldHalfTan / newHalfTan);

                    const dir = new THREE.Vector3().subVectors(camera.position, target).normalize();
                    camera.position.copy(target).addScaledVector(dir, newDist);
                    if (controls) controls.update();
                }

                camera.fov = newFov;
                camera.updateProjectionMatrix();
                setCameraFov(newFov);

                // 35mm sensor equivalent focal length
                const focal = Math.round(18 / Math.tan(THREE.MathUtils.degToRad(newFov / 2)));
                let lensDesc = 'Lente Normal (50mm)';
                if (focal <= 20) lensDesc = 'Ultra Gran Angular • Máxima Fuga';
                else if (focal <= 28) lensDesc = 'Gran Angular • Fuga Pronunciada';
                else if (focal <= 45) lensDesc = 'Angular Moderado';
                else if (focal <= 65) lensDesc = 'Lente Normal (50mm)';
                else if (focal <= 105) lensDesc = 'Retrato • Menor Fuga';
                else lensDesc = 'Teleobjetivo • Perspectiva Plana';

                if (onFOVDisplayChange) {
                    onFOVDisplayChange(`Lente: ${focal}mm • ${lensDesc}`);
                    if (fovTimerRef.current) clearTimeout(fovTimerRef.current);
                    fovTimerRef.current = setTimeout(() => onFOVDisplayChange(null), 1800);
                }
            }
        } else if (camera instanceof THREE.OrthographicCamera) {
            let newZoom = camera.zoom + delta * 0.05;
            newZoom = Math.max(0.5, Math.min(100, newZoom));
            camera.zoom = newZoom;
            camera.updateProjectionMatrix();

            if (onFOVDisplayChange) {
                onFOVDisplayChange(`Zoom: ${newZoom.toFixed(1)}x`);
                if (fovTimerRef.current) clearTimeout(fovTimerRef.current);
                fovTimerRef.current = setTimeout(() => onFOVDisplayChange(null), 1500);
            }
        }
    }, [camera, camType, onFOVDisplayChange]);

    // Apply Camera Actions with Orthographic Mode for Canonical Views
    useEffect(() => {
        if (!cameraAction || !controlsRef.current) return;
        
        const controls = controlsRef.current;
        const duration = 0.8; 
        const dist = 14;

        const setOrthoForAction = (viewName: string) => {
            const visibleHeight = 2 * dist * Math.tan(THREE.MathUtils.degToRad(cameraFov / 2));
            setOrthoZoom(gl.domElement.clientHeight / Math.max(visibleHeight, 0.1));
            if (onFOVDisplayChange) {
                onFOVDisplayChange(`${viewName} • Ortográfica (Sin Fuga)`);
                if (fovTimerRef.current) clearTimeout(fovTimerRef.current);
                fovTimerRef.current = setTimeout(() => onFOVDisplayChange(null), 2000);
            }
        };

        if (cameraAction.type === 'reset') {
             setCamType('perspective');
             gsap.to(camera.position, { x: 10, y: 10, z: 10, duration, ease: "power2.inOut", onUpdate: () => controls.update() });
             gsap.to(controls.target, { x: 0, y: 0, z: 0, duration, ease: "power2.inOut" });
        } else if (cameraAction.type === 'top') {
             camera.up.set(0, 0, -1);
             setOrthoForAction('Vista Superior (Top)');
             gsap.to(camera.position, { x: 0, y: dist, z: 0.001, duration, ease: "power2.inOut", onUpdate: () => controls.update(), onComplete: () => setCamType('orthographic') });
             gsap.to(controls.target, { x: 0, y: 0, z: 0, duration, ease: "power2.inOut" });
        } else if (cameraAction.type === 'front') {
             camera.up.set(0, 1, 0);
             setOrthoForAction('Vista Frontal (Front)');
             gsap.to(camera.position, { x: 0, y: 0, z: dist, duration, ease: "power2.inOut", onUpdate: () => controls.update(), onComplete: () => setCamType('orthographic') });
             gsap.to(controls.target, { x: 0, y: 0, z: 0, duration, ease: "power2.inOut" });
        } else if (cameraAction.type === 'right') {
             camera.up.set(0, 1, 0);
             setOrthoForAction('Vista Derecha (Right)');
             gsap.to(camera.position, { x: dist, y: 0, z: 0, duration, ease: "power2.inOut", onUpdate: () => controls.update(), onComplete: () => setCamType('orthographic') });
             gsap.to(controls.target, { x: 0, y: 0, z: 0, duration, ease: "power2.inOut" });
        } else if (cameraAction.type === 'custom' && cameraAction.view) {
             const v = cameraAction.view;
             gsap.to(camera.position, { x: v.position.x, y: v.position.y, z: v.position.z, duration, ease: "power2.inOut", onUpdate: () => controls.update() });
             gsap.to(controls.target, { x: v.target.x, y: v.target.y, z: v.target.z, duration, ease: "power2.inOut" });
        }
        
        onCameraActionHandled();
    }, [cameraAction, camera, cameraFov, gl, onCameraActionHandled, onFOVDisplayChange]);

    useFrame(() => {
        if (onCameraDirectionUpdate && camera) {
            const dir = new THREE.Vector3();
            camera.getWorldDirection(dir);
            onCameraDirectionUpdate(dir);
        }
    });

    // --- DEDICATED SCREEN-TO-3D CURVE GUIDE DRAWING (Draws anywhere on screen, no geometry required) ---
    useEffect(() => {
        if (activeTool !== 'draw-plane') return;

        const dom = gl.domElement;
        const originalCursor = dom.style.cursor;
        dom.style.cursor = 'crosshair';

        const getRayPoint = (clientX: number, clientY: number) => {
            const rect = dom.getBoundingClientRect();
            const mouse = new THREE.Vector2(
                ((clientX - rect.left) / rect.width) * 2 - 1,
                -((clientY - rect.top) / rect.height) * 2 + 1
            );
            const ray = new THREE.Raycaster();
            ray.setFromCamera(mouse, camera);

            const cPos = camera.position.clone();
            const vForward = new THREE.Vector3();
            camera.getWorldDirection(vForward);
            const d = controlsRef.current ? cPos.distanceTo(controlsRef.current.target) : 10;
            const O_p = cPos.clone().addScaledVector(vForward, d);
            const N_p = vForward.clone();

            const D_ray = ray.ray.direction.clone().normalize();
            const denom = D_ray.dot(N_p);
            if (Math.abs(denom) > 1e-6) {
                const t = O_p.clone().sub(cPos).dot(N_p) / denom;
                return cPos.clone().addScaledVector(D_ray, t);
            }
            return O_p.clone();
        };

        const onDown = (e: PointerEvent) => {
            if (e.button !== 0) return;

            if (controlsRef.current) controlsRef.current.enabled = false;
            isDrawing.current = true;
            const pt = getRayPoint(e.clientX, e.clientY);
            currentPoints.current = [pt];
            setPreviewPath([pt]);
        };

        const onMove = (e: PointerEvent) => {
            if (!isDrawing.current) return;

            const pt = getRayPoint(e.clientX, e.clientY);
            const lastP = currentPoints.current[currentPoints.current.length - 1];
            if (!lastP || lastP.distanceTo(pt) > 0.03) {
                currentPoints.current.push(pt);
                setPreviewPath([...currentPoints.current]);
            }
        };

        const onUp = (e: PointerEvent) => {
            if (!isDrawing.current) return;
            isDrawing.current = false;
            if (controlsRef.current) controlsRef.current.enabled = true;

            let finalPoints = currentPoints.current;
            if (finalPoints.length >= 2) {
                if (currentBrushSmoothing >= 0.8) {
                    // Straight line between start and end
                    finalPoints = [finalPoints[0], finalPoints[finalPoints.length - 1]];
                } else if (currentBrushSmoothing > 0.05) {
                    const iters = Math.max(1, Math.floor(currentBrushSmoothing * 4));
                    finalPoints = smoothVector3Points(finalPoints, iters);
                    try {
                        const curve = new THREE.CatmullRomCurve3(finalPoints);
                        finalPoints = curve.getPoints(Math.max(20, finalPoints.length * 2));
                    } catch (err) {
                        console.warn("CatmullRom smoothing fallback:", err);
                    }
                } else {
                    try {
                        const curve = new THREE.CatmullRomCurve3(finalPoints);
                        finalPoints = curve.getPoints(Math.max(20, finalPoints.length * 2));
                    } catch (err) {
                        console.warn("CatmullRom fallback:", err);
                    }
                }
                const cameraDir = new THREE.Vector3();
                camera.getWorldDirection(cameraDir);
                onStrokeComplete(finalPoints, cameraDir);
            }
            currentPoints.current = [];
            setPreviewPath([]);
        };

        dom.addEventListener('pointerdown', onDown);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);

        return () => {
            dom.style.cursor = originalCursor;
            dom.removeEventListener('pointerdown', onDown);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            if (controlsRef.current) controlsRef.current.enabled = true;
        };
    }, [activeTool, camera, gl, onStrokeComplete, currentBrushSmoothing]);

    // --- DEDICATED CAD WINDOW / CROSSING BOX SELECTION LISTENER ---
    const selectionStartRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        if (activeTool !== 'lasso') return;

        const dom = gl.domElement;
        const originalCursor = dom.style.cursor;
        dom.style.cursor = 'crosshair';

        const onDown = (e: PointerEvent) => {
            if (e.button !== 0) return;

            if (controlsRef.current) controlsRef.current.enabled = false;
            isLassoing.current = true;
            selectionStartRef.current = { x: e.clientX, y: e.clientY };
            const pt = { x: e.clientX, y: e.clientY };
            setLassoPoints([pt, pt, pt, pt]);
            if (onLassoPointsChange) onLassoPointsChange([pt, pt, pt, pt]);
        };

        const onMove = (e: PointerEvent) => {
            if (!isLassoing.current || !selectionStartRef.current) return;

            const start = selectionStartRef.current;
            const current = { x: e.clientX, y: e.clientY };
            // Rectangular CAD selection box: Top-Left, Top-Right, Bottom-Right, Bottom-Left
            const pts = [
                { x: start.x, y: start.y },
                { x: current.x, y: start.y },
                { x: current.x, y: current.y },
                { x: start.x, y: current.y }
            ];
            setLassoPoints(pts);
            if (onLassoPointsChange) onLassoPointsChange(pts);
        };

        const onUp = (e: PointerEvent) => {
            if (!isLassoing.current || !selectionStartRef.current) return;
            isLassoing.current = false;
            if (controlsRef.current) controlsRef.current.enabled = true;

            const start = selectionStartRef.current;
            const end = { x: e.clientX, y: e.clientY };
            selectionStartRef.current = null;

            const minX = Math.min(start.x, end.x);
            const maxX = Math.max(start.x, end.x);
            const minY = Math.min(start.y, end.y);
            const maxY = Math.max(start.y, end.y);
            const isWindowSelection = end.x >= start.x; // Left to right = Window (dashed, strictly inside)

            // Ignore tiny micro-clicks (< 5px)
            if (maxX - minX < 5 && maxY - minY < 5) {
                setLassoPoints([]);
                if (onLassoPointsChange) onLassoPointsChange([]);
                return;
            }

            const rect = dom.getBoundingClientRect();
            const toScreen = (worldPos: THREE.Vector3) => {
                const p = worldPos.clone().project(camera);
                return {
                    x: (p.x * 0.5 + 0.5) * rect.width + rect.left,
                    y: (-(p.y * 0.5) + 0.5) * rect.height + rect.top,
                    inFrustum: p.z >= -1 && p.z <= 1
                };
            };

            const isPointInside = (x: number, y: number) => x >= minX && x <= maxX && y >= minY && y <= maxY;

            const selected: string[] = [];
            objects.forEach(obj => {
                if (!obj.visible) return;

                if (obj.type === 'stroke' && obj.strokeData?.points) {
                    const objPos = new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z);
                    const sPoints = obj.strokeData.points.map(p => toScreen(new THREE.Vector3(p.x + objPos.x, p.y + objPos.y, p.z + objPos.z)));
                    if (sPoints.length === 0) return;

                    if (isWindowSelection) {
                        // Left to right: ALL points must be strictly inside the window
                        if (sPoints.every(s => s.inFrustum && isPointInside(s.x, s.y))) {
                            selected.push(obj.id);
                        }
                    } else {
                        // Right to left: ANY point inside OR bounding box overlaps
                        const anyInside = sPoints.some(s => s.inFrustum && isPointInside(s.x, s.y));
                        if (anyInside) {
                            selected.push(obj.id);
                        } else {
                            const strokeMinX = Math.min(...sPoints.map(p => p.x));
                            const strokeMaxX = Math.max(...sPoints.map(p => p.x));
                            const strokeMinY = Math.min(...sPoints.map(p => p.y));
                            const strokeMaxY = Math.max(...sPoints.map(p => p.y));
                            if (strokeMinX <= maxX && strokeMaxX >= minX && strokeMinY <= maxY && strokeMaxY >= minY) {
                                selected.push(obj.id);
                            }
                        }
                    }
                } else {
                    const objPos = new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z);
                    const hx = (obj.params?.width || obj.scale.x || 1) * 0.5;
                    const hy = (obj.params?.height || obj.scale.y || 1) * 0.5;
                    const hz = (obj.params?.depth || obj.scale.z || 1) * 0.5;
                    const corners = [
                        toScreen(new THREE.Vector3(objPos.x - hx, objPos.y - hy, objPos.z - hz)),
                        toScreen(new THREE.Vector3(objPos.x + hx, objPos.y - hy, objPos.z - hz)),
                        toScreen(new THREE.Vector3(objPos.x - hx, objPos.y + hy, objPos.z - hz)),
                        toScreen(new THREE.Vector3(objPos.x + hx, objPos.y + hy, objPos.z - hz)),
                        toScreen(new THREE.Vector3(objPos.x - hx, objPos.y - hy, objPos.z + hz)),
                        toScreen(new THREE.Vector3(objPos.x + hx, objPos.y - hy, objPos.z + hz)),
                        toScreen(new THREE.Vector3(objPos.x - hx, objPos.y + hy, objPos.z + hz)),
                        toScreen(new THREE.Vector3(objPos.x + hx, objPos.y + hy, objPos.z + hz))
                    ];
                    const sCenter = toScreen(objPos);

                    if (isWindowSelection) {
                        // Window: ALL 8 corners must be strictly inside
                        if (corners.every(c => c.inFrustum && isPointInside(c.x, c.y))) {
                            selected.push(obj.id);
                        }
                    } else {
                        // Crossing: ANY corner, center inside or bounding box overlaps
                        const anyCorner = corners.some(c => c.inFrustum && isPointInside(c.x, c.y));
                        const centerIn = sCenter.inFrustum && isPointInside(sCenter.x, sCenter.y);
                        const oMinX = Math.min(...corners.map(c => c.x));
                        const oMaxX = Math.max(...corners.map(c => c.x));
                        const oMinY = Math.min(...corners.map(c => c.y));
                        const oMaxY = Math.max(...corners.map(c => c.y));
                        const bboxOverlaps = oMinX <= maxX && oMaxX >= minX && oMinY <= maxY && oMaxY >= minY;

                        if (anyCorner || centerIn || bboxOverlaps) {
                            selected.push(obj.id);
                        }
                    }
                }
            });

            if (selected.length > 0) {
                onLassoSelect(selected);
            }
            setLassoPoints([]);
            if (onLassoPointsChange) onLassoPointsChange([]);
        };

        dom.addEventListener('pointerdown', onDown);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);

        return () => {
            dom.style.cursor = originalCursor;
            dom.removeEventListener('pointerdown', onDown);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            if (controlsRef.current) controlsRef.current.enabled = true;
            if (onLassoPointsChange) onLassoPointsChange([]);
        };
    }, [activeTool, camera, gl, objects, onLassoSelect, onLassoPointsChange]);

    const handlePointerDown = useCallback((e: any) => {
        // Handled by dedicated screen listeners
        if (activeTool === 'draw-plane' || activeTool === 'lasso') return;

        // --- STYLUS ONLY DRAWING CHECK ---
        const isDrawingTool = activeTool === 'brush' || activeTool === 'eraser';
        
        // If drawing tool is active, but input is TOUCH (finger), ignore drawing and allow navigation (OrbitControls)
        if (isDrawingTool && e.pointerType === 'touch') {
            return; 
        }

        // Prevent drawing if interacting with Gizmo or non-drawing tools
        if (mode !== 'translate' && mode !== 'rotate' && mode !== 'scale') {
             // allow
        } else if (selectedIds.length > 0 && activeTool === 'select') {
             return; 
        }

        // --- PIPETTE / COLOR & THICKNESS SAMPLER ---
        if (activeTool === 'pipette') {
            const hits = raycaster.intersectObjects(scene.children, true);
            const validHits = hits.filter(h => h.object.type === 'Mesh' && h.object.userData?.id !== 'symmetry-plane');
            if (validHits.length > 0) {
                let curr: THREE.Object3D | null = validHits[0].object;
                let foundObj: SceneObject | undefined;
                while (curr && curr !== scene) {
                    if (curr.userData?.id) {
                        foundObj = objects.find(o => o.id === curr.userData.id);
                        if (foundObj) break;
                    }
                    curr = curr.parent;
                }
                if (foundObj) {
                    const color = foundObj.material?.color || '#000000';
                    const thickness = (foundObj.type === 'stroke' && foundObj.strokeData) ? foundObj.strokeData.thickness : undefined;
                    if (onPickColorAndThickness) {
                        onPickColorAndThickness(color, thickness);
                    }
                    return;
                }
                const mesh = validHits[0].object as THREE.Mesh;
                if (mesh.material) {
                    const mat: any = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
                    if (mat && mat.color) {
                        const hex = '#' + mat.color.getHexString();
                        if (onPickColorAndThickness) {
                            onPickColorAndThickness(hex, undefined);
                        }
                    }
                }
            }
            return;
        }

        // --- BRUSH / ERASER START ---
        if (activeTool === 'brush') {
            const hits = raycaster.intersectObjects(scene.children, true);
            const geometryHits = hits.filter(h => h.object.type === 'Mesh' && h.object.userData?.id !== 'symmetry-plane');
            
            if (geometryHits.length === 0) return; // STRICT: DO NOT DRAW if no geometry hit

            let point = geometryHits[0].point.clone();
            point.addScaledVector(raycaster.ray.direction, -0.01);

            isDrawing.current = true;
            currentPoints.current = [point];
            setPreviewPath([point]);
            if (controlsRef.current) controlsRef.current.enabled = false;
        } else if (activeTool === 'eraser') {
             if (eraserMode === 'object') return;
             isDrawing.current = true;
             if (controlsRef.current) controlsRef.current.enabled = false;
        }

    }, [activeTool, scene, raycaster, mode, selectedIds, eraserMode, camera, objects, onPickColorAndThickness]);

    const handlePointerMove = useCallback((e: any) => {
        if (activeTool === 'draw-plane' || activeTool === 'lasso') return;

        // Update eraser visual cursor position
        if (activeTool === 'eraser') {
            const hits = raycaster.intersectObjects(scene.children, true);
            if (hits.length > 0) {
                setEraserCursorPos(hits[0].point);
            } else {
                const vForward = new THREE.Vector3();
                camera.getWorldDirection(vForward);
                const d = controlsRef.current ? camera.position.distanceTo(controlsRef.current.target) : 10;
                const planeOrigin = camera.position.clone().addScaledVector(vForward, d);
                const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(vForward.clone().negate(), planeOrigin);
                const pt = new THREE.Vector3();
                raycaster.ray.intersectPlane(plane, pt);
                setEraserCursorPos(pt);
            }

            if (isDrawing.current && eraserMode === 'partial' && onPartialErase) {
                const strokeHits = hits.filter(h => h.object.parent?.userData?.type === 'stroke');
                if (strokeHits.length > 0) {
                    const actualRadius = eraserSize || currentBrushSize || 0.2;
                    onPartialErase(strokeHits[0].object.parent!.userData.id, strokeHits[0].point, actualRadius); 
                }
            }
            return;
        } else {
            if (eraserCursorPos) setEraserCursorPos(null);
        }

        // --- STYLUS ONLY CHECK FOR DRAG ---
        const isDrawingTool = activeTool === 'brush';
        if (isDrawingTool && e.pointerType === 'touch') {
            return; 
        }

        if (!isDrawing.current) return;

        if (activeTool === 'brush') {
             const hits = raycaster.intersectObjects(scene.children, true);
             const geometryHits = hits.filter(h => h.object.type === 'Mesh' && h.object.userData?.id !== 'symmetry-plane');
             
             if (geometryHits.length === 0) return;

             let point = geometryHits[0].point.clone();
             point.addScaledVector(raycaster.ray.direction, -0.01);
             
             if (currentBrushSmoothing > 0 && currentPoints.current.length > 0) {
                 const last = currentPoints.current[currentPoints.current.length - 1];
                 point.lerp(last, currentBrushSmoothing);
             }
             
             const lastP = currentPoints.current[currentPoints.current.length - 1];
             if (lastP.distanceTo(point) > 0.05) {
                 currentPoints.current.push(point);
                 setPreviewPath([...currentPoints.current]); 
             }
        }

    }, [activeTool, raycaster, scene, eraserMode, onPartialErase, currentBrushSmoothing, eraserSize, currentBrushSize, eraserCursorPos, camera]);

    const handlePointerUp = useCallback(() => {
        if (activeTool === 'draw-plane' || activeTool === 'lasso') return;

        if (isDrawing.current) {
            if (activeTool === 'brush') {
                 let finalPoints = currentPoints.current;
                 const cameraDir = new THREE.Vector3();
                 camera.getWorldDirection(cameraDir);
                 onStrokeComplete(finalPoints, cameraDir);
            }
            isDrawing.current = false;
            currentPoints.current = [];
            setPreviewPath([]);
            if (controlsRef.current) controlsRef.current.enabled = true;
        }
    }, [activeTool, onStrokeComplete, camera]);

    // Background Deselect
    const handleMiss = (e: any) => {
        // Ensure we are in Select Mode and NOT drawing or interacting with gizmo
        if (activeTool === 'select' && !isDrawing.current && !isLassoing.current) {
            // Check if the click was truly on empty space (not captured by other elements)
             // Passing null triggers the strict deselection in parent
            onSelect(null);
        }
    };

    const selectedObject = selectedIds.length === 1 ? objects.find(o => o.id === selectedIds[0]) : null;

    return (
        <>
            <color attach="background" args={[backgroundColor || '#ffffff']} />
            <GestureHandler 
                onSnapView={handleSnapView} 
                onAdjustFOV={handleAdjustFOV}
                controlsRef={controlsRef}
                isDrawingMode={isDrawingMode}
                activeTool={activeTool}
            />
            
            {camType === 'perspective' && (
                <PerspectiveCamera 
                    makeDefault 
                    position={[camera.position.x || 10, camera.position.y || 10, camera.position.z || 10]} 
                    fov={cameraFov} 
                />
            )}
            {camType === 'orthographic' && (
                <OrthographicCamera 
                    makeDefault 
                    position={[camera.position.x || 10, camera.position.y || 10, camera.position.z || 10]} 
                    up={[camera.up.x, camera.up.y, camera.up.z]}
                    zoom={orthoZoom} 
                />
            )}

            <group ref={objectsGroupRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerMissed={handleMiss}>
                {/* 3D GROUND GRID */}
                {isGridVisible !== false && (
                    <Grid
                        position={[0, -0.01, 0]}
                        args={[100, 100]}
                        cellSize={0.5}
                        cellThickness={0.8}
                        cellColor="#94a3b8"
                        sectionSize={2.5}
                        sectionThickness={1.2}
                        sectionColor="#64748b"
                        fadeDistance={40}
                        fadeStrength={1.5}
                        infiniteGrid
                    />
                )}
                
                <SymmetryPlane 
                    enabled={isSymmetryEnabled} 
                    axis={symmetryAxis} 
                    position={symmetryPosition} 
                    isSelected={selectedIds.includes('symmetry-plane')}
                    onSelect={() => onSelect('symmetry-plane')}
                />

                {/* RENDER OBJECTS */}
                {objects.map(obj => {
                    // Only render root objects (no parent) here. Children are rendered by GroupComponent.
                    if (obj.parentId) return null;

                    if (obj.type === 'group') {
                        const children = objects.filter(c => c.parentId === obj.id);
                        const hasVisibleChild = children.length === 0 
                            ? visibleLayerIds.includes(obj.layerId)
                            : children.some(c => visibleLayerIds.includes(c.layerId) && (c.type === 'stroke' || areGeometryVisible));
                        if (!hasVisibleChild) return null;
                    } else {
                        if (!visibleLayerIds.includes(obj.layerId)) return null;
                        if (obj.type !== 'stroke' && !areGeometryVisible) return null;
                    }

                    const isSelected = selectedIds.includes(obj.id);
                    const isLocked = lockedLayerIds.includes(obj.layerId);
                    
                    const getRootParentId = (id: string, allObjs: SceneObject[]): string => {
                        let current = allObjs.find(o => o.id === id);
                        while (current && current.parentId) {
                            const parent = allObjs.find(o => o.id === current.parentId);
                            if (parent) {
                                current = parent;
                            } else {
                                break;
                            }
                        }
                        return current ? current.id : id;
                    };

                    const renderObject = (o: SceneObject) => {
                        const rootId = getRootParentId(o.id, objects);
                        const isSel = selectedIds.includes(rootId) || selectedIds.includes(o.id);
                        const isLock = lockedLayerIds.includes(o.layerId);
                        
                        const props = {
                            key: o.id,
                            data: o,
                            isSelected: isSel,
                            isLocked: isLock,
                            onSelect: (idOrEvent: any) => {
                                if (!isLock) {
                                    if (activeTool === 'pipette') {
                                        if (idOrEvent && typeof idOrEvent !== 'string' && idOrEvent.stopPropagation) {
                                            idOrEvent.stopPropagation();
                                        }
                                        const color = o.material?.color || '#000000';
                                        const thickness = (o.type === 'stroke' && o.strokeData) ? o.strokeData.thickness : undefined;
                                        if (onPickColorAndThickness) {
                                            onPickColorAndThickness(color, thickness);
                                        }
                                        return;
                                    }
                                    if (typeof idOrEvent === 'string') {
                                        if (activeTool === 'select' || activeTool === 'lasso' || activeTool === 'loft-step-1' || activeTool === 'loft-step-2') {
                                            onSelect(getRootParentId(idOrEvent, objects));
                                        }
                                    } else {
                                        idOrEvent.stopPropagation();
                                        if (activeTool === 'eraser' && eraserMode === 'object') {
                                            if (onErase) onErase(rootId);
                                        } else if (activeTool === 'select' || activeTool === 'lasso' || activeTool === 'loft-step-1' || activeTool === 'loft-step-2') {
                                            onSelect(rootId);
                                        }
                                    }
                                }
                            }
                        };

                        if (o.type === 'group') {
                            const children = objects.filter(child => {
                                if (child.parentId !== o.id) return false;
                                if (!visibleLayerIds.includes(child.layerId)) return false;
                                if (child.type !== 'stroke' && !areGeometryVisible) return false;
                                return true;
                            });
                            return (
                                <GroupComponent {...props}>
                                    {children.map(child => renderObject(child))}
                                </GroupComponent>
                            );
                        }
                        if (o.type === 'import') return <ImportedMeshComponent {...props} />;
                        if (o.type === 'image') return <ImageComponent {...props} />;
                        if (o.type === 'stroke') return <StrokeComponent {...props} />;
                        if (o.type === 'loft') return <LoftComponent {...props} allObjects={objects} />;
                        if (o.type === 'extrusion') return <ExtrusionComponent {...props} />;
                        return <MeshComponent {...props} />;
                    };

                    return renderObject(obj);
                })}
            </group>

            {/* PREVIEW LINE */}
            {previewPath.length > 1 && (
                <Line points={previewPath as any} color={activeTool === 'draw-plane' ? '#F2B441' : currentBrushColor} lineWidth={currentBrushSize} opacity={0.6} transparent depthTest={false} worldUnits />
            )}

            {/* SYMMETRY PREVIEW */}
            {isSymmetryEnabled && previewPath.length > 1 && (activeTool === 'brush') && (
                 <Line 
                    points={previewPath.map((p: THREE.Vector3) => {
                         const sym = p.clone();
                         if (symmetryAxis === 'x') sym.x = 2 * symmetryPosition.x - sym.x;
                         if (symmetryAxis === 'y') sym.y = 2 * symmetryPosition.y - sym.y;
                         if (symmetryAxis === 'z') sym.z = 2 * symmetryPosition.z - sym.z;
                         return sym;
                    }) as any} 
                    color={currentBrushColor} 
                    lineWidth={currentBrushSize} 
                    opacity={0.3} 
                    transparent 
                    depthTest={false} 
                    worldUnits 
                />
            )}

            {/* TRANSFORM CONTROLS - ONLY VISIBLE IF SELECT TOOL IS ACTIVE */}
            {targetObject && activeTool === 'select' && selectedObject && !lockedLayerIds.includes(selectedObject.layerId) && (
                <group key={selectedObject.id}>
                    <TransformControls 
                        ref={transformControlsRef}
                        object={targetObject} 
                        mode={mode} 
                        onMouseDown={() => {
                            isTransformingRef.current = true;
                            if (controlsRef.current) controlsRef.current.enabled = false;
                            onTransformStart();
                        }}
                        onMouseUp={() => {
                            isTransformingRef.current = false;
                            onTransformEnd();
                        }}
                        onChange={(e: any) => {
                            if (e?.target?.object) {
                                const o = e.target.object;
                                let rotX = o.rotation.x;
                                let rotY = o.rotation.y;
                                let rotZ = o.rotation.z;

                                if (mode === 'rotate') {
                                    const snapTo90 = (rad: number) => {
                                        const deg = THREE.MathUtils.radToDeg(rad);
                                        const nearest90 = Math.round(deg / 90) * 90;
                                        if (Math.abs(deg - nearest90) < 6.0) {
                                            return THREE.MathUtils.degToRad(nearest90);
                                        }
                                        return rad;
                                    };
                                    rotX = snapTo90(rotX);
                                    rotY = snapTo90(rotY);
                                    rotZ = snapTo90(rotZ);
                                    o.rotation.set(rotX, rotY, rotZ);
                                }

                                onTransform(selectedObject.id, {
                                    position: { x: o.position.x, y: o.position.y, z: o.position.z },
                                    rotation: { x: rotX, y: rotY, z: rotZ },
                                    scale: { x: o.scale.x, y: o.scale.y, z: o.scale.z }
                                });
                            }
                        }}
                        size={0.8}
                    />
                </group>
            )}

            {/* MULTI-OBJECT TRANSFORM CONTROLS (GUMBALL) */}
            {selectedIds.length > 1 && activeTool === 'select' && multiCentroid && (
                <group key="multi-transform-group">
                    <mesh ref={multiProxyMeshRef} position={[multiCentroid.x, multiCentroid.y, multiCentroid.z]} visible={false}>
                        <boxGeometry args={[0.01, 0.01, 0.01]} />
                        <meshBasicMaterial transparent opacity={0} />
                    </mesh>
                    <TransformControls 
                        ref={multiTransformControlsRef}
                        object={multiProxyMeshRef} 
                        mode={mode} 
                        onMouseDown={() => {
                            isTransformingRef.current = true;
                            if (controlsRef.current) controlsRef.current.enabled = false;
                            if (multiProxyMeshRef.current) {
                                initialCentroidRef.current = multiProxyMeshRef.current.position.clone();
                                const map = new Map<string, { x: number; y: number; z: number }>();
                                selectedIds.forEach(id => {
                                    const obj = objects.find(o => o.id === id);
                                    if (obj && obj.position) map.set(id, { ...obj.position });
                                });
                                initialMultiPositionsRef.current = map;
                            }
                            onTransformStart();
                        }}
                        onMouseUp={() => {
                            isTransformingRef.current = false;
                            initialCentroidRef.current = null;
                            initialMultiPositionsRef.current.clear();
                            onTransformEnd();
                        }}
                        onChange={() => {
                            if (multiProxyMeshRef.current && onTransformMultiple) {
                                if (!initialCentroidRef.current) {
                                    initialCentroidRef.current = multiProxyMeshRef.current.position.clone();
                                    const map = new Map<string, { x: number; y: number; z: number }>();
                                    selectedIds.forEach(id => {
                                        const obj = objects.find(o => o.id === id);
                                        if (obj && obj.position) map.set(id, { ...obj.position });
                                    });
                                    initialMultiPositionsRef.current = map;
                                }
                                const cur = multiProxyMeshRef.current.position;
                                const dx = cur.x - initialCentroidRef.current.x;
                                const dy = cur.y - initialCentroidRef.current.y;
                                const dz = cur.z - initialCentroidRef.current.z;
                                const updates = selectedIds.map(id => {
                                    const obj = objects.find(o => o.id === id);
                                    const init = initialMultiPositionsRef.current.get(id) || (obj?.position ? { ...obj.position } : { x: 0, y: 0, z: 0 });
                                    return {
                                        id,
                                        updates: {
                                            position: {
                                                x: init.x + dx,
                                                y: init.y + dy,
                                                z: init.z + dz
                                            }
                                        }
                                    };
                                });
                                onTransformMultiple(updates);
                            }
                        }}
                        size={0.8}
                    />
                </group>
            )}

             {/* SYMMETRY PLANE TRANSFORM */}
             {selectedIds.includes('symmetry-plane') && activeTool === 'select' && (
                 <TransformControls 
                    key="sym-plane-ctrl"
                    mode="translate"
                    onMouseDown={onTransformStart}
                    onMouseUp={onTransformEnd}
                    onChange={(e: any) => {
                        if (e?.target?.object) {
                            const o = e.target.object;
                            onTransform('symmetry-plane', {
                                position: { x: o.position.x, y: o.position.y, z: o.position.z }
                            });
                        }
                    }}
                 >
                     <mesh position={[symmetryPosition.x, symmetryPosition.y, symmetryPosition.z]} visible={false} />
                 </TransformControls>
             )}

            
             {/* SELECTION BOXES REMOVED - Elements are highlighted directly with crisp yellow outlines/lines */}

            {/* VISUAL ERASER CURSOR */}
            {activeTool === 'eraser' && eraserCursorPos && (
                <mesh position={eraserCursorPos} quaternion={camera.quaternion}>
                    <ringGeometry args={[(eraserSize || currentBrushSize || 0.2) * 0.92, eraserSize || currentBrushSize || 0.2, 32]} />
                    <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} transparent opacity={0.8} depthTest={false} />
                </mesh>
            )}

            <OrbitControls ref={controlsRef} makeDefault minPolarAngle={0} maxPolarAngle={Math.PI} enableDamping dampingFactor={0.1} />
            
            {/* 100% OFFLINE STUDIO LIGHTING RIG (Zero network fetch / No potsdamer_platz_1k.hdr error / No tainted canvas) */}
            <ambientLight intensity={0.75} />
            <hemisphereLight args={['#ffffff', '#475569', 0.65]} />
            <directionalLight position={[15, 25, 15]} intensity={1.1} castShadow />
            <directionalLight position={[-15, 15, -15]} intensity={0.45} />
            <directionalLight position={[0, -10, 0]} intensity={0.2} />
            
            <SceneExporter ref={exportRef} objects={objects} objectsGroupRef={objectsGroupRef} backgroundColor={backgroundColor} />
        </>
    );
};

export const SceneCanvas = (props: SceneProps) => {
    const objectsGroupRef = useRef<THREE.Group>(null);
    const [screenLassoPoints, setScreenLassoPoints] = useState<{ x: number; y: number }[]>([]);
    const [fovBadgeText, setFovBadgeText] = useState<string | null>(null);

    return (
        <div className="relative w-full h-full" style={{ backgroundColor: props.backgroundColor || '#ffffff' }}>
            <Canvas dpr={[1, 2]} gl={{ preserveDrawingBuffer: true, antialias: true }}>
                <SceneContent 
                    {...props} 
                    objectsGroupRef={objectsGroupRef} 
                    onLassoPointsChange={(pts) => {
                        setScreenLassoPoints(pts);
                        if (props.onLassoPointsChange) props.onLassoPointsChange(pts);
                    }}
                    onFOVDisplayChange={(txt) => {
                        setFovBadgeText(txt);
                        if (props.onFOVDisplayChange) props.onFOVDisplayChange(txt);
                    }}
                />
            </Canvas>

            {/* CAD BOX SELECTION 2D SCREEN OVERLAY */}
            {props.activeTool === 'lasso' && screenLassoPoints.length > 1 && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
                    <polygon
                        points={screenLassoPoints.map(p => `${p.x},${p.y}`).join(' ')}
                        fill={screenLassoPoints[1] && screenLassoPoints[1].x >= screenLassoPoints[0].x ? "rgba(59, 130, 246, 0.12)" : "rgba(37, 99, 235, 0.22)"}
                        stroke="#2563eb"
                        strokeWidth="2"
                        strokeDasharray={screenLassoPoints[1] && screenLassoPoints[1].x >= screenLassoPoints[0].x ? "6 4" : "none"}
                    />
                </svg>
            )}

            {/* CAMERA FOV / LENS FLOATING BADGE */}
            {fovBadgeText && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-black/75 backdrop-blur text-white px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide shadow-lg border border-white/20 animate-in fade-in zoom-in-95 pointer-events-none">
                    {fovBadgeText}
                </div>
            )}
        </div>
    );
};
