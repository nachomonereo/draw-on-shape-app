
import { ThreeElements } from '@react-three/fiber'

declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

export type ShapeType = 'box' | 'sphere' | 'cylinder' | 'torus' | 'cone' | 'capsule' | 'plane' | 'stroke' | 'loft' | 'import' | 'extrusion' | 'image' | 'group' | 'tetrahedron' | 'octahedron';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface MaterialProperties {
  color: string;
  roughness: number;
  metalness: number;
  transmission?: number;
  opacity?: number;
  wireframe?: boolean;
}

export interface StrokeData {
  points: Vector3[];
  thickness: number;
  filled?: boolean; // New property for filled shapes
}

export interface LoftData {
    strokeIdA?: string;
    strokeIdB?: string;
    strokeIds?: string[];
    segments?: number;
}

export interface ExtrusionData {
    pathPoints: Vector3[];
    height: number;
    closed?: boolean;
    extrusionDirection?: Vector3; 
}

export interface ObjectParams {
    width?: number;
    height?: number;
    depth?: number;
    radius?: number;
    radiusTop?: number;
    radiusBottom?: number;
    segments?: number;
    tube?: number;
}

export interface SceneObject {
  id: string;
  layerId: string; 
  parentId?: string; // New: For Grouping
  name: string;
  type: ShapeType;
  visible?: boolean; 
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  material: MaterialProperties;
  strokeData?: StrokeData; 
  loftData?: LoftData; 
  extrusionData?: ExtrusionData; 
  params?: ObjectParams; 
  url?: string; 
  importFormat?: string;
}

export interface Layer {
    id: string;
    name: string;
    visible: boolean;
    locked: boolean;
    type: 'geometry' | 'trace'; 
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}

export interface AIActionResponse {
  explanation: string;
  objectsToAdd: SceneObject[];
  actions?: string[];
}

export interface UserProfile {
    name: string;
}

export interface Project {
    id: string;
    name: string;
    updatedAt: number;
    thumbnail?: string; 
    sceneObjects: SceneObject[];
    layers: Layer[];
}

export interface CameraView {
    id: string;
    name: string;
    position: Vector3;
    target: Vector3;
}
