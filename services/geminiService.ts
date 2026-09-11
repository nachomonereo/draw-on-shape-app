
import { GoogleGenAI, Type } from "@google/genai";
import { SceneObject, ChatMessage, AIActionResponse } from "../types";

const parseJSON = (text: string) => {
    try {
        let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("Failed to parse JSON from Gemini:", e);
        return null;
    }
};

const sceneObjectSchema = {
  type: Type.OBJECT,
  properties: {
    explanation: {
        type: Type.STRING,
        description: "Brief explanation of generated geometry."
    },
    objectsToAdd: {
      type: Type.ARRAY,
      description: "List of primitive objects for blocking OR imports. STRICT SCALE: 1 unit = 1 meter. Max size 5.",
      items: {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['box', 'sphere', 'cylinder', 'torus', 'cone', 'capsule', 'tetrahedron', 'octahedron', 'import'] },
            url: { type: Type.STRING, description: "URL for 'import' type objects (GLB/STL)." },
            position: { 
                type: Type.OBJECT, 
                properties: { x: {type: Type.NUMBER}, y: {type: Type.NUMBER}, z: {type: Type.NUMBER} },
                required: ['x', 'y', 'z']
            },
            rotation: { 
                type: Type.OBJECT, 
                properties: { x: {type: Type.NUMBER}, y: {type: Type.NUMBER}, z: {type: Type.NUMBER} },
                required: ['x', 'y', 'z']
            },
            scale: { 
                type: Type.OBJECT, 
                properties: { x: {type: Type.NUMBER}, y: {type: Type.NUMBER}, z: {type: Type.NUMBER} },
                required: ['x', 'y', 'z']
            },
            material: {
                type: Type.OBJECT,
                properties: {
                    color: { type: Type.STRING },
                    roughness: { type: Type.NUMBER },
                    metalness: { type: Type.NUMBER }
                },
                required: ['color', 'roughness', 'metalness']
            }
        },
        required: ['name', 'type', 'position', 'rotation', 'scale', 'material']
      }
    }
  },
  required: ['explanation', 'objectsToAdd']
};

export const generate3DContent = async (
  prompt: string, 
  currentScene: SceneObject[]
): Promise<AIActionResponse | null> => {
    if (!process.env.API_KEY) {
        console.error("API Key is missing");
        return { explanation: "Error: API Key missing.", objectsToAdd: [] };
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Updated prompt with Working URLs to prevent 404s
    const contextPrompt = `
    You are an AI assistant for "Draw on Shape", a 3D blocking and sculpting tool.
    Goal: Interpret user requests to insert/create 3D objects or blocking geometry.

    USER INTENT:
    - If the user says "Insert a cow", "Create a table", "Building", or "Car", you MUST generate a HIGH FIDELITY result.
    - GENERATE GEOMETRY: Prefer creating complex shapes by combining multiple primitives (Constructive Solid Geometry approach) over importing, unless the object is extremely specific (like a specific car model).
    - "Blob" or "Organic" requests: Use many overlapping spheres or capsules.
    
    SCALE GUIDELINES:
    - 1 Unit = 1 Meter approx.
    - Keep objects proportional.
    
    DIGITAL ASSET LIBRARY (Use these specific URLs for 'import' type ONLY if complex mesh is needed):
    - Car / Truck: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb'
    - Tree: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoxTextured/glTF-Binary/BoxTextured.glb'
    - Bunny: 'https://raw.githubusercontent.com/pmndrs/drei-assets/master/stls/stanford_bunny.stl'
    - Robot: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/RiggedFigure/glTF-Binary/RiggedFigure.glb'
    - Helmet: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb'
    - Fox: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Fox/glTF-Binary/Fox.glb'
    - Duck: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb'
    
    IMPORTANT - SHAPE COMPOSITION:
    - Use Non-Uniform Scaling to distort primitives.
    - COMPOSE: Build objects from parts. E.g., a Chair = 4 cylinder legs + 1 box seat + 1 box back.
    - Example (Cow): 
      1. Box (Body) scaled {x:7.5, y:5, z:4}.
      2. Cylinder (Legs) scaled thin.
      3. Sphere (Head).
    
    STRICT RULES:
    1. COLORS: NEVER USE BLACK (#000000). Use bright or pastel colors.
    2. OPACITY: Use 0.5 for all geometry to ensure transparency.
    3. POSITION: Place objects near (0,0,0) or adjacent to existing objects. Avoid overlapping perfectly.
    4. MAX OBJECTS: Generate up to 20 primitives to represent the object complexity. Detail is good.

    Current State: ${currentScene.length} objects in scene.
    Request: "${prompt}"

    Generate the geometry configuration.
    `;

    try {
        const response = await ai.models.generateContent({
            // Upgrade to gemini-3.1-pro-preview for complex 3D blocking tasks
            model: 'gemini-3.1-pro-preview',
            contents: contextPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: sceneObjectSchema
            }
        });

        if (response.text) {
            const data = parseJSON(response.text) as AIActionResponse;
            // Removed downscale logic to correct object scales
            return data;
        }
        return null;
    } catch (error) {
        console.error("Gemini API Error:", error);
        throw error;
    }
};

export const askTutor = async (question: string): Promise<string> => {
    if (!process.env.API_KEY) return "Configure your API Key.";
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: question,
            config: { systemInstruction: "You are an expert in 3D topology and sketching." }
        });
        return response.text || "Error.";
    } catch (e) {
        return "Error connecting to AI.";
    }
};
