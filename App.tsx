
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Icons } from './components/IconComponents';
import { SceneCanvas, SceneExportRef, CameraAction } from './components/Scene';
import ChatPanel from './components/ChatPanel';
import PropertiesPanel from './components/PropertiesPanel';
import LayersPanel from './components/LayersPanel';
import RadialPalette, { BrushPreset } from './components/RadialPalette';
import { SceneObject, ShapeType, ChatMessage, Vector3, Layer, UserProfile, Project, CameraView, SceneComponent } from './types';
import { generate3DContent } from './services/geminiService';
import { generateBlobGeometry } from './services/blobService';
import { ProjectsPanel } from './components/ProjectsPanel';
import { ExportPNGModal } from './components/ExportPNGModal';
import { saveOrShareFile } from './utils/downloadHelper';
import { Language, getTranslation } from './utils/translations';
import { App as CapApp } from '@capacitor/app';
import { User, Save, FileText, LayoutTemplate, Copy, Check, Pen } from 'lucide-react';
import * as THREE from 'three';

const generateId = () => Math.random().toString(36).substr(2, 9);

const INITIAL_LAYERS: Layer[] = [
    { id: 'layer-geo-1', name: 'Geometry', visible: true, locked: false, type: 'geometry' },
    { id: 'layer-trace-1', name: 'Traces', visible: true, locked: false, type: 'trace' }
];

const DEFAULT_MAT_COLOR = '#E0E0E0'; // Light Grey default, never black

const INITIAL_SCENE: SceneObject[] = [
    {
        id: '1',
        layerId: 'layer-geo-1',
        name: 'Base Block',
        type: 'box',
        visible: true,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        material: { color: DEFAULT_MAT_COLOR, roughness: 0.5, metalness: 0.1, opacity: 0.5 }, 
        params: { width: 4, height: 4, depth: 4 } 
    }
];

const simplifyPoints = (points: Vector3[]): Vector3[] => {
    if (points.length < 3) return points;
    const activeTolerance = 0.002; 
    const result = [points[0]];
    let last = points[0];
    for (let i = 1; i < points.length; i++) {
        const p = points[i];
        const dist = Math.sqrt(Math.pow(p.x - last.x, 2) + Math.pow(p.y - last.y, 2) + Math.pow(p.z - last.z, 2));
        if (dist > activeTolerance) { result.push(p); last = p; }
    }
    const lastPoint = points[points.length - 1];
    if (result[result.length - 1] !== lastPoint) result.push(lastPoint);
    return result;
}

// Chaikin's Algorithm for curve smoothing
const smoothPoints = (points: Vector3[], iterations: number = 2): Vector3[] => {
    if (points.length < 3) return points;
    
    let current = points;
    
    for (let k = 0; k < iterations; k++) {
        const next: Vector3[] = [current[0]];
        for (let i = 0; i < current.length - 1; i++) {
            const p0 = current[i];
            const p1 = current[i + 1];
            
            // 0.75 * p0 + 0.25 * p1
            next.push({
                x: 0.75 * p0.x + 0.25 * p1.x,
                y: 0.75 * p0.y + 0.25 * p1.y,
                z: 0.75 * p0.z + 0.25 * p1.z
            });
            
            // 0.25 * p0 + 0.75 * p1
            next.push({
                x: 0.25 * p0.x + 0.75 * p1.x,
                y: 0.25 * p0.y + 0.75 * p1.y,
                z: 0.25 * p0.z + 0.75 * p1.z
            });
        }
        next.push(current[current.length - 1]);
        current = next;
    }
    return current;
};

// -- Simplified Toolbar Item without local Tooltip --

const ToolbarItem = ({ 
    active, 
    onClick, 
    icon: Icon, 
    children, 
    tooltipText,
    isSeparate,
    onHover,
    onLeave
}: { 
    active: boolean; 
    onClick: () => void; 
    icon: any; 
    children?: React.ReactNode; 
    tooltipText?: string; 
    isSeparate?: boolean;
    onHover: (text: string) => void;
    onLeave: () => void;
}) => {
    const handleMouseEnter = () => {
        if (tooltipText) onHover(tooltipText);
    };

    const handleMouseLeave = () => {
        onLeave();
    };

    return (
        <div className="relative flex flex-col items-center" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            {/* Submenu expanding UPWARDS */}
            {active && children && (
                <div className="absolute bottom-full mb-4 p-1.5 bg-white rounded-xl shadow-xl border border-gray-100 flex gap-2 animate-in slide-in-from-bottom-4 fade-in duration-200 z-50">
                    {children}
                </div>
            )}
            
            <button 
                onClick={onClick}
                className={`p-3 rounded-xl transition-all duration-200 ${
                    active 
                    ? (isSeparate ? 'bg-moda-3 text-white shadow-lg scale-110' : 'bg-moda-4 text-white shadow-md scale-105') 
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
            >
                {Icon ? <Icon size={24} strokeWidth={active ? 2.5 : 2} /> : null}
            </button>
        </div>
    );
};


export default function App() {
    const [user, setUser] = useState<UserProfile>({ name: 'Draw on Shape' });
    const [projectName, setProjectName] = useState("Untitled Project");
    const [isEditingName, setIsEditingName] = useState(false);
    
    // Language State ('es' | 'en')
    const [language, setLanguage] = useState<Language>(() => {
        return (localStorage.getItem('draw_on_shape_lang') as Language) || 'es';
    });

    const handleLanguageChange = (newLang: Language) => {
        setLanguage(newLang);
        localStorage.setItem('draw_on_shape_lang', newLang);
    };

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showProjectsModal, setShowProjectsModal] = useState(false);
    const [showExportPNGModal, setShowExportPNGModal] = useState(false);
    const [showUI, setShowUI] = useState(true);
    const [history, setHistory] = useState<SceneObject[][]>([INITIAL_SCENE]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [layers, setLayers] = useState<Layer[]>(INITIAL_LAYERS);
    const [activeLayerId, setActiveLayerId] = useState<string>('layer-trace-1');
    const [sceneObjects, setSceneObjects] = useState<SceneObject[]>(INITIAL_SCENE);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectionMode, setSelectionMode] = useState<'replace' | 'add' | 'subtract' | 'lasso'>('replace');
    const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
    
    // Tools
    const [activeTool, setActiveTool] = useState<'select' | 'brush' | 'eraser' | 'draw-plane' | 'lasso' | 'shapes' | 'view' | 'loft-step-1' | 'loft-step-2' | 'pipette'>('brush'); 
    const [previousTool, setPreviousTool] = useState<'brush' | 'select'>('brush');
    const [eraserMode, setEraserMode] = useState<'object' | 'partial'>('partial'); 

    // Background Color & Grid
    const [backgroundColor, setBackgroundColor] = useState<string>('#ffffff');
    const [isGridVisible, setIsGridVisible] = useState<boolean>(true);
    const [isBgMenuOpen, setIsBgMenuOpen] = useState(false);

    // Brush Presets
    const [brushPresets, setBrushPresets] = useState<BrushPreset[]>([
        { id: '1', color: '#000000', thickness: 0.05 },
        { id: '2', color: '#ef4444', thickness: 0.08 },
        { id: '3', color: '#3b82f6', thickness: 0.03 },
        { id: '4', color: '#10b981', thickness: 0.12 },
        { id: '5', color: '#f59e0b', thickness: 0.05 }
    ]); 
    
    // Instruction Banner & Toast Notification State
    const [instruction, setInstruction] = useState<string | null>(null);
    const [hoverInfo, setHoverInfo] = useState<string | null>(null); // New Global Hover State
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const showNotification = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => {
            setToastMessage(prev => prev === msg ? null : prev);
        }, 3500);
    };

    const [isStrokeFilled, setIsStrokeFilled] = useState(false); 
    
    // Loft State
    const [loftSelection, setLoftSelection] = useState<string[]>([]); 
    
    // Camera Views
    const [cameraAction, setCameraAction] = useState<CameraAction | null>(null);
    const [savedViews, setSavedViews] = useState<CameraView[]>([]);

    // Symmetry State
    const [isSymmetryEnabled, setIsSymmetryEnabled] = useState(false);
    const [symmetryAxis, setSymmetryAxis] = useState<'x' | 'y' | 'z'>('x');
    const [symmetryPosition, setSymmetryPosition] = useState<Vector3>({ x: 0, y: 0, z: 0 });
    const [isSymmetryMenuOpen, setIsSymmetryMenuOpen] = useState(false); 

    // Global Geometry Visibility
    const [areGeometryVisible, setAreGeometryVisible] = useState(true);

    // Guide State REMOVED

    const [brushColor, setBrushColor] = useState('#000000');  
    // Updated Default Brush Size
    const [brushSize, setBrushSize] = useState(0.05);
    // NEW: Brush Smoothing (0 - 0.95)
    const [brushSmoothing, setBrushSmoothing] = useState(0.0); 
    // Eraser Size
    const [eraserSize, setEraserSize] = useState(0.2);
    
    const capturedCameraDir = useRef<Vector3>({x:0, y:0, z:1});
    const [showChat, setShowChat] = useState(false); 
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [isAiLoading, setIsAiLoading] = useState(false); 

    const fileInputRef = useRef<HTMLInputElement>(null);
    const projectLoadRef = useRef<HTMLInputElement>(null);
    const projectImportRef = useRef<HTMLInputElement>(null); 
    
    const exportRef = useRef<SceneExportRef>(null);

    const sceneObjectsRef = useRef(sceneObjects);
    const historyRef = useRef<SceneObject[][]>([INITIAL_SCENE]);
    const historyIndexRef = useRef<number>(0);

    // Helper to ensure Ref and State stay in sync
    const updateSceneState = (newObjects: SceneObject[]) => {
        sceneObjectsRef.current = newObjects;
        setSceneObjects(newObjects);
    };

    // Component Library State
    const [customComponents, setCustomComponents] = useState<SceneComponent[]>(() => {
        try {
            const saved = localStorage.getItem('draw_on_shape_components_v1');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    const saveComponentsToStorage = (list: SceneComponent[]) => {
        try {
            localStorage.setItem('draw_on_shape_components_v1', JSON.stringify(list));
            setCustomComponents(list);
        } catch (e) {
            console.error("Failed to save components to localStorage", e);
        }
    };

    const handleSaveSelectionAsComponent = () => {
        if (selectedIds.length === 0) {
            showNotification(language === 'en' ? "Select an object or group first" : "Selecciona un objeto o grupo primero");
            return;
        }

        const currentObjs = sceneObjectsRef.current;
        const allTargetIds = new Set<string>();
        const collectIds = (id: string) => {
            allTargetIds.add(id);
            currentObjs.filter(o => o.parentId === id).forEach(child => collectIds(child.id));
        };
        selectedIds.forEach(id => collectIds(id));

        const componentObjs = currentObjs.filter(o => allTargetIds.has(o.id));
        if (componentObjs.length === 0) return;

        const defaultName = componentObjs.find(o => o.type === 'group')?.name || `Componente ${customComponents.length + 1}`;
        const inputName = window.prompt(
            language === 'en' ? "Enter component name:" : "Introduce el nombre del componente:",
            defaultName
        );
        if (!inputName || !inputName.trim()) return;

        const newComp: SceneComponent = {
            id: generateId(),
            name: inputName.trim(),
            createdAt: Date.now(),
            objects: componentObjs
        };

        const updated = [newComp, ...customComponents];
        saveComponentsToStorage(updated);
        showNotification(language === 'en' ? `Component '${newComp.name}' saved to library!` : `¡Componente '${newComp.name}' guardado en la biblioteca!`);
    };

    const handleInsertComponent = (comp: SceneComponent) => {
        if (!comp.objects || comp.objects.length === 0) return;

        const idMap = new Map<string, string>();
        comp.objects.forEach(o => idMap.set(o.id, generateId()));
        const targetLayerId = ensureActiveLayerType('geometry');

        const clonedObjs: SceneObject[] = comp.objects.map(obj => {
            const newId = idMap.get(obj.id) || generateId();
            const newParentId = obj.parentId ? idMap.get(obj.parentId) : undefined;
            return {
                ...obj,
                id: newId,
                parentId: newParentId,
                layerId: targetLayerId,
                position: {
                    x: obj.position.x + (Math.random() * 0.4 - 0.2),
                    y: obj.position.y,
                    z: obj.position.z + (Math.random() * 0.4 - 0.2)
                }
            };
        });

        const newAllObjects = [...sceneObjectsRef.current, ...clonedObjs];
        updateSceneState(newAllObjects);
        addToHistory(newAllObjects);

        const rootNewIds = clonedObjs.filter(o => !o.parentId).map(o => o.id);
        setSelectedIds(rootNewIds);
        handleToolChange('select');

        showNotification(language === 'en' ? `Component '${comp.name}' inserted!` : `¡Componente '${comp.name}' insertado!`);
    };

    const handleDeleteComponent = (id: string) => {
        const updated = customComponents.filter(c => c.id !== id);
        saveComponentsToStorage(updated);
        showNotification(language === 'en' ? "Component removed" : "Componente eliminado");
    };

    const handleExportComponent = async (comp: SceneComponent) => {
        try {
            const jsonStr = JSON.stringify(comp, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const sanitizedName = comp.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
            const res = await saveOrShareFile(blob, `${sanitizedName}_component.json`, 'application/json');
            if (res.success) {
                showNotification(language === 'en' ? `Exported ${sanitizedName}` : `Componente exportado correctamente`);
            }
        } catch (e: any) {
            console.error("Export component error:", e);
            showNotification(language === 'en' ? "Failed to export component" : "Error al exportar componente");
        }
    };

    const handleImportComponent = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const parsed = JSON.parse(text);
                if (parsed && parsed.objects && Array.isArray(parsed.objects)) {
                    const importedComp: SceneComponent = {
                        id: generateId(),
                        name: parsed.name || file.name.replace(/\.json$/i, ''),
                        createdAt: Date.now(),
                        objects: parsed.objects
                    };
                    const updated = [importedComp, ...customComponents];
                    saveComponentsToStorage(updated);
                    showNotification(language === 'en' ? `Component '${importedComp.name}' imported!` : `¡Componente '${importedComp.name}' importado!`);
                } else {
                    alert(language === 'en' ? "Invalid component JSON file" : "Archivo JSON de componente no válido");
                }
            } catch (err) {
                console.error("Failed to parse component JSON", err);
                alert(language === 'en' ? "Could not read component file" : "No se pudo leer el archivo de componente");
            }
        };
        reader.readAsText(file);
    };

    const handleMoveObjectsToLayer = (objectIds: string[], targetLayerId: string) => {
        const targetLayer = layers.find(l => l.id === targetLayerId);
        if (!targetLayer) return;

        const currentObjs = sceneObjectsRef.current;
        const allTargetIds = new Set<string>();
        const collectIds = (id: string) => {
            allTargetIds.add(id);
            currentObjs.filter(o => o.parentId === id).forEach(child => collectIds(child.id));
        };
        objectIds.forEach(id => collectIds(id));

        const updated = currentObjs.map(obj => {
            if (allTargetIds.has(obj.id)) {
                return { ...obj, layerId: targetLayerId };
            }
            return obj;
        });

        updateSceneState(updated);
        addToHistory(updated);
        showNotification(language === 'en' 
            ? `${objectIds.length} element(s) moved to "${targetLayer.name}"` 
            : `${objectIds.length} elemento(s) movidos a "${targetLayer.name}"`);
    };

    const handleColorChange = (newColor: string) => {
        setBrushColor(newColor);
        if (selectedIds.length > 0) {
            const currentObjs = sceneObjectsRef.current;
            const allTargetIds = new Set<string>();
            const collectIds = (id: string) => {
                allTargetIds.add(id);
                currentObjs.filter(o => o.parentId === id).forEach(child => collectIds(child.id));
            };
            selectedIds.forEach(id => collectIds(id));

            const updated = currentObjs.map(obj => {
                if (allTargetIds.has(obj.id)) {
                    return {
                        ...obj,
                        material: {
                            ...obj.material,
                            color: newColor
                        }
                    };
                }
                return obj;
            });

            updateSceneState(updated);
            addToHistory(updated);
        }
    };

    const handleActivatePipette = () => {
        if (activeTool !== 'pipette') {
            setPreviousTool(activeTool === 'select' ? 'select' : 'brush');
            setActiveTool('pipette');
            setInstruction(language === 'en' ? "Tap any stroke or object to copy color & thickness" : "Toca cualquier trazo u objeto para copiar color y grosor");
        } else {
            setActiveTool(previousTool || 'brush');
            setInstruction(null);
        }
    };

    const handlePickColorAndThickness = (color: string, thickness?: number) => {
        setBrushColor(color);
        if (typeof thickness === 'number' && thickness > 0) {
            setBrushSize(thickness);
        }

        if (selectedIds.length > 0) {
            handleColorChange(color);
        }

        showNotification(
            thickness 
                ? (language === 'en' ? `Color ${color} & thickness ${thickness.toFixed(2)} copied!` : `¡Color ${color} y grosor ${thickness.toFixed(2)} copiados!`)
                : (language === 'en' ? `Color ${color} copied!` : `¡Color ${color} copiado!`)
        );
        setActiveTool(previousTool || 'brush');
        setInstruction(null);
    };

    const handleTransformMultiple = (updatesList: { id: string; updates: Partial<SceneObject> }[]) => {
        const sourceObjects = sceneObjectsRef.current;
        const updateMap = new Map(updatesList.map(u => [u.id, u.updates]));
        const newObjects = sourceObjects.map(obj => {
            const u = updateMap.get(obj.id);
            if (u) {
                return { ...obj, ...u };
            }
            return obj;
        });
        sceneObjectsRef.current = newObjects;
        setSceneObjects(newObjects);
    };

    // --- TOOL SWITCHING LOGIC ---
    const handleToolChange = (newTool: typeof activeTool) => {
        // If switching TO drawing tools (Brush, Eraser, Draw Plane), clear selection
        if (newTool === 'brush' || newTool === 'eraser' || newTool === 'draw-plane' || newTool === 'loft-step-1') {
            setSelectedIds([]);
        }
        setActiveTool(newTool);
        setInstruction(null);
        setLoftSelection([]);
        // Ensure default selection mode is replace when switching back to select
        if (newTool === 'select') {
            setSelectionMode('replace');
        }
    };

    // Cancel tool helper
    const cancelCurrentTool = () => {
        setInstruction(null);
        setLoftSelection([]);
        if (activeTool === 'loft-step-1' || activeTool === 'loft-step-2') {
            handleToolChange('select');
        }
    };

    const normalizeObjectCenter = (obj: SceneObject): SceneObject => {
        if (obj.type === 'stroke' && obj.strokeData && obj.strokeData.points.length > 0) {
            const pts = obj.strokeData.points;
            let minX = Infinity, minY = Infinity, minZ = Infinity;
            let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
            pts.forEach(p => {
                minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
                minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
            });
            const cx = (minX + maxX) / 2;
            const cy = (minY + maxY) / 2;
            const cz = (minZ + maxZ) / 2;
            if (Math.hypot(cx, cy, cz) > 0.01) {
                const rot = new THREE.Euler(obj.rotation.x, obj.rotation.y, obj.rotation.z);
                const q = new THREE.Quaternion().setFromEuler(rot);
                const offset = new THREE.Vector3(cx * obj.scale.x, cy * obj.scale.y, cz * obj.scale.z).applyQuaternion(q);
                return {
                    ...obj,
                    position: { x: obj.position.x + offset.x, y: obj.position.y + offset.y, z: obj.position.z + offset.z },
                    strokeData: {
                        ...obj.strokeData,
                        points: pts.map(p => ({ x: p.x - cx, y: p.y - cy, z: p.z - cz }))
                    }
                };
            }
        } else if (obj.type === 'extrusion' && obj.extrusionData && obj.extrusionData.pathPoints.length > 0) {
            const pts = obj.extrusionData.pathPoints;
            let minX = Infinity, minY = Infinity, minZ = Infinity;
            let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
            pts.forEach(p => {
                minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
                minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
            });
            const cx = (minX + maxX) / 2;
            const cy = (minY + maxY) / 2;
            const cz = (minZ + maxZ) / 2;
            if (Math.hypot(cx, cy, cz) > 0.01) {
                const rot = new THREE.Euler(obj.rotation.x, obj.rotation.y, obj.rotation.z);
                const q = new THREE.Quaternion().setFromEuler(rot);
                const offset = new THREE.Vector3(cx * obj.scale.x, cy * obj.scale.y, cz * obj.scale.z).applyQuaternion(q);
                return {
                    ...obj,
                    position: { x: obj.position.x + offset.x, y: obj.position.y + offset.y, z: obj.position.z + offset.z },
                    extrusionData: {
                        ...obj.extrusionData,
                        pathPoints: pts.map(p => ({ x: p.x - cx, y: p.y - cy, z: p.z - cz }))
                    }
                };
            }
        }
        return obj;
    };

    const MAX_HISTORY_STEPS = 12;

    const addToHistory = (newObjects: SceneObject[]) => {
        const normalized = newObjects.map(normalizeObjectCenter);
        const curIndex = historyIndexRef.current;
        let newHistory = historyRef.current.slice(0, curIndex + 1);
        newHistory.push(normalized);

        // Keep maximum 12 steps in history to avoid memory bloat and app crashing
        if (newHistory.length > MAX_HISTORY_STEPS) {
            newHistory = newHistory.slice(newHistory.length - MAX_HISTORY_STEPS);
        }

        historyRef.current = newHistory;
        historyIndexRef.current = newHistory.length - 1;
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        updateSceneState(normalized);
    };

    const undo = useCallback(() => {
        const curIndex = historyIndexRef.current;
        if (curIndex > 0) {
            const prevIndex = curIndex - 1;
            historyIndexRef.current = prevIndex;
            setHistoryIndex(prevIndex);
            updateSceneState(historyRef.current[prevIndex]);
            showNotification("Deshacer (Ctrl+Z)");
        }
    }, []);

    const redo = useCallback(() => {
        const curIndex = historyIndexRef.current;
        if (curIndex < historyRef.current.length - 1) {
            const nextIndex = curIndex + 1;
            historyIndexRef.current = nextIndex;
            setHistoryIndex(nextIndex);
            updateSceneState(historyRef.current[nextIndex]);
            showNotification("Rehacer");
        }
    }, []);

    // Global Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Escape)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                redo();
            } else if (e.key === 'Escape') {
                cancelCurrentTool();
                setSelectedIds([]);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    // Android Hardware Back Button Handler
    useEffect(() => {
        const backListener = CapApp.addListener('backButton', () => {
            if (showProjectsModal) {
                setShowProjectsModal(false);
                return;
            }
            if (isMenuOpen) {
                setIsMenuOpen(false);
                return;
            }
            if (selectedIds.length > 0) {
                setSelectedIds([]);
                return;
            }
            if (historyIndexRef.current > 0) {
                undo();
                return;
            }
        });

        return () => {
            backListener.then(h => h.remove());
        };
    }, [showProjectsModal, isMenuOpen, selectedIds, undo]);

    const ensureActiveLayerType = (type: 'geometry' | 'trace'): string => {
        const cur = layers.find(l => l.id === activeLayerId);
        if (cur && cur.type === type) return activeLayerId;
        const exist = layers.find(l => l.type === type);
        if (exist) { setActiveLayerId(exist.id); return exist.id; }
        const nL: Layer = { id: generateId(), name: type === 'geometry' ? 'Geometry' : 'Traces', visible: true, locked: false, type };
        setLayers(p => [nL, ...p]); setActiveLayerId(nL.id); return nL.id;
    };

    const handleDeleteObject = (id: string) => {
        const newObjects = sceneObjects.filter(o => o.id !== id);
        addToHistory(newObjects);
        if (selectedIds.includes(id)) setSelectedIds([]);
    };

    const handleUpdateObject = (id: string, updates: Partial<SceneObject>, saveToHistory: boolean = true) => {
        // Always source from Ref to avoid stale closures during rapid events
        const sourceObjects = sceneObjectsRef.current;

        const newObjects = sourceObjects.map(obj => {
            if (obj.id === id) {
                return { ...obj, ...updates };
            }
            return obj;
        });

        if (saveToHistory) {
            addToHistory(newObjects);
        } else {
            // Live update: Update ref synchronously, then trigger render
            sceneObjectsRef.current = newObjects;
            setSceneObjects(newObjects);
        }
    };

    const handleStrokeComplete = (points: Vector3[], strokeCamDir?: THREE.Vector3) => {
        if (points.length < 2) return;
        const targetId = activeTool === 'draw-plane' ? ensureActiveLayerType('geometry') : ensureActiveLayerType('trace');
        if (layers.find(l => l.id === targetId)?.locked) return;

        // Apply Chaikin smoothing if smoothing is enabled
        let processedPoints = points;
        if (brushSmoothing > 0) {
            // Iterations based on smoothing factor (0-1 -> 1-3 iterations)
            const iterations = Math.max(1, Math.floor(brushSmoothing * 3));
            processedPoints = smoothPoints(points, iterations);
        }
        
        const simplified = simplifyPoints(processedPoints);
        
        // Compute geometric center so Gumball/Gizmo is centered right on the drawn stroke/shape
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        simplified.forEach(p => {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
            minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
        });
        const center = {
            x: (minX + maxX) / 2,
            y: (minY + maxY) / 2,
            z: (minZ + maxZ) / 2
        };
        const centeredPoints = simplified.map(p => ({
            x: p.x - center.x,
            y: p.y - center.y,
            z: p.z - center.z
        }));

        // "3D Guide" creates 'extrusion' type (Draw Wall logic)
        const isGuide = activeTool === 'draw-plane';
        
        let pathLength = 0;
        for (let i = 1; i < simplified.length; i++) {
            const p1 = new THREE.Vector3(simplified[i-1].x, simplified[i-1].y, simplified[i-1].z);
            const p2 = new THREE.Vector3(simplified[i].x, simplified[i].y, simplified[i].z);
            pathLength += p1.distanceTo(p2);
        }
        const proportionalDepth = Math.max(1.5, pathLength * 0.8);
        
        const camDir = strokeCamDir || capturedCameraDir.current || new THREE.Vector3(0, 0, 1);

        const nS: SceneObject = { 
            id: generateId(), 
            layerId: targetId, 
            name: isGuide ? 'Curve Guide' : (isStrokeFilled ? 'Filled Shape' : 'Stroke'), 
            type: isGuide ? 'extrusion' : 'stroke', 
            visible: true, 
            position: center,
            rotation: {x:0, y:0, z:0}, 
            scale: {x:1, y:1, z:1}, 
            material: { color: isGuide ? '#F2B441' : brushColor, roughness: 0.5, metalness: 0.1, opacity: isGuide ? 0.8 : 1 }, 
            strokeData: isGuide ? undefined : { points: centeredPoints, thickness: brushSize, filled: isStrokeFilled }, 
            extrusionData: isGuide ? { pathPoints: centeredPoints, height: proportionalDepth, extrusionDirection: { x: camDir.x, y: camDir.y, z: camDir.z } } : undefined 
        };

        let toAdd = [nS];
        if (isSymmetryEnabled && activeTool === 'brush') {
            const symCenter = { 
                x: symmetryAxis === 'x' ? 2 * symmetryPosition.x - center.x : center.x,
                y: symmetryAxis === 'y' ? 2 * symmetryPosition.y - center.y : center.y,
                z: symmetryAxis === 'z' ? 2 * symmetryPosition.z - center.z : center.z
            };
            const symPoints = centeredPoints.map(p => ({ 
                x: symmetryAxis === 'x' ? -p.x : p.x,
                y: symmetryAxis === 'y' ? -p.y : p.y,
                z: symmetryAxis === 'z' ? -p.z : p.z
            }));
            toAdd.push({
                ...nS, 
                id: generateId(), 
                name: 'Stroke (Mirror)', 
                position: symCenter, 
                strokeData: { points: symPoints, thickness: brushSize, filled: isStrokeFilled }
            });
        }
        addToHistory([...sceneObjects, ...toAdd]);
        if (activeTool === 'draw-plane') { setSelectedIds([nS.id]); handleToolChange('select'); }
    };

    const handlePartialErase = (id: string, hitPoint: Vector3, radius: number) => {
        const obj = sceneObjects.find(o => o.id === id);
        if (!obj || obj.type !== 'stroke' || !obj.strokeData) return;

        const objPos = new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z);
        const objRot = new THREE.Euler(obj.rotation.x, obj.rotation.y, obj.rotation.z);
        const objScale = new THREE.Vector3(obj.scale.x, obj.scale.y, obj.scale.z);

        const matrix = new THREE.Matrix4().compose(objPos, new THREE.Quaternion().setFromEuler(objRot), objScale);
        const inverseMatrix = matrix.invert();
        const worldHit = new THREE.Vector3(hitPoint.x, hitPoint.y, hitPoint.z);
        const localHit = worldHit.applyMatrix4(inverseMatrix);
        
        const maxScale = Math.max(0.001, Math.max(obj.scale.x, Math.max(obj.scale.y, obj.scale.z)));
        
        // CORRECTION: Use the direct radius instead of multiplying by 15.
        // This makes the destruction zone match the visual cursor size.
        const localEraseRadius = radius / maxScale; 

        const originalPoints = obj.strokeData.points;
        const newSegments: Vector3[][] = [];
        let currentSegment: Vector3[] = [];

        for (const p of originalPoints) {
            const dist = Math.sqrt(Math.pow(p.x - localHit.x, 2) + Math.pow(p.y - localHit.y, 2) + Math.pow(p.z - localHit.z, 2));
            if (dist > localEraseRadius) { currentSegment.push(p); } 
            else { if (currentSegment.length > 1) { newSegments.push(currentSegment); } currentSegment = []; }
        }
        if (currentSegment.length > 1) newSegments.push(currentSegment);

        if (newSegments.length === 0) { handleDeleteObject(id); } 
        else if (newSegments.length === 1 && newSegments[0].length === originalPoints.length) { return; } 
        else {
            const newObjects = newSegments.map((seg, idx) => ({ ...obj, id: idx === 0 ? obj.id : generateId(), strokeData: { ...obj.strokeData!, points: seg } }));
            const others = sceneObjects.filter(o => o.id !== id);
            addToHistory([...others, ...newObjects]);
        }
    };

    const handleFillObject = (id: string, color: string) => {
        const obj = sceneObjects.find(o => o.id === id);
        if (!obj) return;
        const updated = { ...obj, material: { ...obj.material, color } };
        handleUpdateObject(id, updated);
    };

    const getRootParentId = (id: string, objects: SceneObject[]): string => {
        let current = objects.find(o => o.id === id);
        while (current && current.parentId) {
            const parent = objects.find(o => o.id === current.parentId);
            if (parent) {
                current = parent;
            } else {
                break;
            }
        }
        return current ? current.id : id;
    };

    const duplicateHierarchy = (rootId: string, currentObjects: SceneObject[]) => {
        const rootObj = currentObjects.find(o => o.id === rootId);
        if (!rootObj) return { newObjects: [], newRootId: null };

        const idMap = new Map<string, string>();
        const newObjects: SceneObject[] = [];

        const descendants: SceneObject[] = [];
        const collectDescendants = (parentId: string) => {
            currentObjects.forEach(o => {
                if (o.parentId === parentId) {
                    descendants.push(o);
                    collectDescendants(o.id);
                }
            });
        };
        collectDescendants(rootId);

        idMap.set(rootId, generateId());
        descendants.forEach(d => idMap.set(d.id, generateId()));

        const newRootId = idMap.get(rootId)!;
        const rootOffset = rootObj.parentId ? { x: 0, y: 0, z: 0 } : { x: 0.5, y: 0, z: 0.5 };

        const newRootObj: SceneObject = {
            ...rootObj,
            id: newRootId,
            name: `${rootObj.name} (Copy)`,
            position: {
                x: rootObj.position.x + rootOffset.x,
                y: rootObj.position.y + rootOffset.y,
                z: rootObj.position.z + rootOffset.z
            }
        };
        newObjects.push(newRootObj);

        descendants.forEach(d => {
            const newDId = idMap.get(d.id)!;
            const newParentId = idMap.get(d.parentId!) || newRootId;
            newObjects.push({
                ...d,
                id: newDId,
                parentId: newParentId,
                name: `${d.name}`
            });
        });

        return { newObjects, newRootId };
    };

    const handleObjectSelect = (idOrIds: string | string[] | null) => {
        // STRICT DESELECTION IF NULL
        if (idOrIds === null) {
             setSelectedIds([]);
             return;
        }

        if (idOrIds === 'symmetry-plane') {
            setSelectedIds(['symmetry-plane']);
            setTransformMode('translate');
            return;
        }

        // --- MULTI-CURVE LOFT LOGIC ---
        if (activeTool === 'loft-step-1' || activeTool === 'loft-step-2') {
            const clickedId = Array.isArray(idOrIds) ? idOrIds[0] : idOrIds;
            const targetObj = sceneObjects.find(o => o.id === clickedId);
            
            if (!targetObj || targetObj.type !== 'stroke') {
                return;
            }

            let newSelection = [...loftSelection];
            if (newSelection.includes(clickedId)) {
                newSelection = newSelection.filter(id => id !== clickedId);
            } else {
                newSelection.push(clickedId);
            }

            setLoftSelection(newSelection);
            setSelectedIds(newSelection);
            setActiveTool('loft-step-2');
            setInstruction(`Loft: ${newSelection.length} curvas seleccionadas (Toca más o pulsa ✓)`);
            return;
        }

        // Guard: Do not allow selecting objects unless selection tool, lasso or loft is active
        if (activeTool !== 'select' && activeTool !== 'lasso' && activeTool !== 'loft-step-1' && activeTool !== 'loft-step-2') {
            return;
        }

        // --- MULTI-SELECT LOGIC FOR TOUCH/MOUSE ---
        const currentObjs = sceneObjectsRef.current;
        const resolveId = (id: string) => getRootParentId(id, currentObjs);

        if (Array.isArray(idOrIds)) {
            const rootIds = Array.from(new Set(idOrIds.map(resolveId)));
            setSelectedIds(rootIds);
        } else {
            const rootId = resolveId(idOrIds);
            if (selectionMode === 'add') {
                 if (!selectedIds.includes(rootId)) {
                     setSelectedIds([...selectedIds, rootId]);
                 }
            } else if (selectionMode === 'subtract') {
                 setSelectedIds(selectedIds.filter(id => id !== rootId));
            } else {
                 // Replace Mode
                 setSelectedIds([rootId]);
            }
        }
    };

    // Project Internal Saving
    const STORAGE_KEY = 'draw_on_shape_projects_v1';

    const saveProjectInternal = (customName?: string) => {
        try {
            const nameToUse = customName || projectName || "Sin Título";
            let thumbnail = '';
            if (exportRef.current) {
                try {
                    thumbnail = exportRef.current.getScreenshot('image/png') || '';
                } catch (e) {
                    console.warn("Thumbnail capture failed", e);
                }
            }

            const data = localStorage.getItem(STORAGE_KEY);
            let projectsList: Project[] = data ? JSON.parse(data) : [];

            const existingIdx = projectsList.findIndex(p => p.name.toLowerCase() === nameToUse.toLowerCase());
            
            const camState = exportRef.current?.getCameraState?.();

            const updatedProject: Project = {
                id: existingIdx >= 0 ? projectsList[existingIdx].id : generateId(),
                name: nameToUse,
                updatedAt: Date.now(),
                thumbnail,
                sceneObjects: sceneObjectsRef.current,
                layers,
                savedViews: savedViews,
                cameraState: camState,
                brushSettings: {
                    color: brushColor,
                    size: brushSize,
                    smoothing: brushSmoothing,
                    presets: brushPresets
                },
                backgroundColor: backgroundColor,
                isGridVisible: isGridVisible
            };

            if (existingIdx >= 0) {
                projectsList[existingIdx] = updatedProject;
            } else {
                projectsList.unshift(updatedProject);
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(projectsList));
            setIsMenuOpen(false);
            showNotification(`¡Proyecto '${nameToUse}' guardado internamente!`);
        } catch (e) {
            console.error("Internal save error:", e);
            showNotification("Error al guardar en memoria interna");
        }
    };

    // Project Name Handling
    const handleNewProject = () => {
        if (confirm("¿Crear un nuevo proyecto? Los cambios no guardados se perderán.")) {
            updateSceneState(INITIAL_SCENE);
            setLayers(INITIAL_LAYERS);
            historyRef.current = [INITIAL_SCENE];
            historyIndexRef.current = 0;
            setHistory([INITIAL_SCENE]);
            setHistoryIndex(0);
            setProjectName("Untitled Project");
            setSavedViews([]);
            setBackgroundColor('#ffffff');
            setIsGridVisible(true);
            setIsMenuOpen(false);
            showNotification("Nuevo proyecto iniciado");
        }
    };

    const handleSaveProject = async () => {
        try {
            const camState = exportRef.current?.getCameraState?.();
            const projectData: Project = { 
                id: generateId(),
                sceneObjects: sceneObjectsRef.current, 
                layers, 
                version: 1.0, 
                name: projectName,
                savedViews: savedViews,
                cameraState: camState,
                brushSettings: {
                    color: brushColor,
                    size: brushSize,
                    smoothing: brushSmoothing,
                    presets: brushPresets
                },
                backgroundColor: backgroundColor,
                isGridVisible: isGridVisible
            };
            const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
            const safeName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const filename = `${safeName}-${Date.now()}.json`;
            const res = await saveOrShareFile(blob, filename, 'application/json');
            setIsMenuOpen(false);
            if (res.cancelled) {
                showNotification(language === 'en' ? "Save cancelled" : "Guardado cancelado");
            } else if (res.success) {
                showNotification(language === 'en' ? "Project exported as JSON!" : "¡Proyecto exportado como JSON!");
            }
        } catch (e) {
            console.error("Save failed", e);
            alert("No se pudo guardar el proyecto.");
        }
    };

    const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target?.result as string);
                if (data.sceneObjects && data.layers) {
                    updateSceneState(data.sceneObjects);
                    setLayers(data.layers);
                    historyRef.current = [data.sceneObjects];
                    historyIndexRef.current = 0;
                    setHistory([data.sceneObjects]);
                    setHistoryIndex(0);
                    if (data.name) setProjectName(data.name);
                    if (data.savedViews) setSavedViews(data.savedViews);
                    if (data.cameraState) {
                        setCameraAction({
                            type: 'set',
                            view: {
                                id: 'loaded-view',
                                name: 'Loaded View',
                                position: data.cameraState.position,
                                target: data.cameraState.target,
                                fov: data.cameraState.fov || 45
                            }
                        });
                    }
                    if (data.brushSettings) {
                        if (data.brushSettings.color) setBrushColor(data.brushSettings.color);
                        if (data.brushSettings.size) setBrushSize(data.brushSettings.size);
                        if (typeof data.brushSettings.smoothing === 'number') setBrushSmoothing(data.brushSettings.smoothing);
                        if (data.brushSettings.presets) setBrushPresets(data.brushSettings.presets);
                    }
                    if (data.backgroundColor) setBackgroundColor(data.backgroundColor);
                    if (typeof data.isGridVisible === 'boolean') setIsGridVisible(data.isGridVisible);
                    showNotification(`¡Proyecto '${data.name || file.name}' cargado!`);
                }
            } catch (err) { console.error("Failed to load", err); alert("Archivo inválido"); }
        };
        reader.readAsText(file);
        setIsMenuOpen(false);
    };

    const handleInsertProject = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target?.result as string);
                if (data.sceneObjects) {
                    const importedObjects: SceneObject[] = data.sceneObjects;
                    const groupId = generateId();
                    const groupLayer = ensureActiveLayerType('geometry');
                    const idMap = new Map<string, string>();
                    importedObjects.forEach(o => idMap.set(o.id, generateId()));
                    
                    const groupObj: SceneObject = {
                        id: groupId,
                        layerId: groupLayer,
                        name: data.name || file.name.replace('.json', '') || 'Imported Group',
                        type: 'group',
                        visible: true,
                        position: { x: 0, y: 0, z: 0 },
                        rotation: { x: 0, y: 0, z: 0 },
                        scale: { x: 1, y: 1, z: 1 },
                        material: { color: '#ffffff', roughness: 0.5, metalness: 0, opacity: 1 }
                    };

                    const processedObjects = importedObjects.map(obj => ({
                        ...obj,
                        id: idMap.get(obj.id)!,
                        parentId: obj.parentId ? idMap.get(obj.parentId) || groupId : groupId,
                        layerId: groupLayer
                    }));

                    addToHistory([...sceneObjects, groupObj, ...processedObjects]);
                    setSelectedIds([groupId]);
                    handleToolChange('select');
                    setTransformMode('translate');
                    showNotification("Elementos insertados en la escena");
                }
            } catch (err) { console.error("Failed to insert", err); alert("Archivo inválido"); }
        };
        reader.readAsText(file);
        setIsMenuOpen(false);
    };

    const handleExport = async (format: 'stl' | 'glb' | 'dxf') => {
        if (!exportRef.current) {
            alert("El exportador aún no está cargado.");
            return;
        }
        try {
            const ext = format;
            const safeName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'model';
            const defaultName = `${safeName}.${ext}`;
            const chosenName = prompt(
                language === 'en' ? `Enter file name for ${format.toUpperCase()} export:` : `Nombre del archivo para exportar ${format.toUpperCase()}:`,
                defaultName
            );
            if (chosenName === null) return;
            const finalName = chosenName.trim() || defaultName;

            showNotification(language === 'en' ? `Exporting ${format.toUpperCase()}...` : `Generando exportación ${format.toUpperCase()}...`);
            let blob: Blob;
            let mime = '';
            if (format === 'stl') {
                blob = await exportRef.current.exportSTL();
                mime = 'application/octet-stream';
            } else if (format === 'glb') {
                blob = await exportRef.current.exportGLB();
                mime = 'model/gltf-binary';
            } else {
                blob = await exportRef.current.exportDXF();
                mime = 'application/dxf';
            }
            const fullFilename = finalName.endsWith(`.${ext}`) ? finalName : `${finalName}.${ext}`;
            const res = await saveOrShareFile(blob, fullFilename, mime);
            setIsMenuOpen(false);
            if (res.cancelled) {
                showNotification(language === 'en' ? "Export cancelled" : "Exportación cancelada");
            } else if (res.success) {
                showNotification(language === 'en' ? `File ${fullFilename} exported successfully!` : `¡Archivo ${fullFilename} exportado con éxito!`);
            }
        } catch (e) {
            console.error("Export error:", e);
            alert((language === 'en' ? "Error exporting scene: " : "Error al exportar la escena: ") + (e as Error).message);
        }
    };

    const handleSaveView = () => {
        if (!exportRef.current) return;
        const state = exportRef.current.getCameraState();
        const newView: CameraView = {
            id: generateId(),
            name: `View ${savedViews.length + 1}`,
            position: state.position,
            target: state.target
        };
        setSavedViews(prev => [...prev, newView]);
    };

    const handleExportSnapshot = () => {
        if (!exportRef.current) {
            alert(language === 'en' ? "Exporter is not ready yet." : "El exportador aún no está listo.");
            return;
        }
        setShowExportPNGModal(true);
    };

    const performExportSnapshot = async (options: { multiplier: number; transparent: boolean; format: 'image/png' | 'image/jpeg'; quality: number; filename?: string }) => {
        if (!exportRef.current) return;
        try {
            showNotification(language === 'en' ? `Generating snapshot (${Math.round(options.multiplier * 100)}%)...` : `Generando captura (${Math.round(options.multiplier * 100)}%)...`);
            const dataUrl = exportRef.current.getScreenshot(options.format, options.multiplier, options.transparent);
            const safeName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'drawing';
            const ext = options.format === 'image/png' ? 'png' : 'jpg';
            const filename = options.filename || `${safeName}-${Math.round(options.multiplier * 100)}pct.${ext}`;
            const res = await saveOrShareFile(dataUrl, filename, options.format);
            if (res.cancelled) {
                showNotification(language === 'en' ? "Export cancelled" : "Exportación cancelada");
            } else if (res.success) {
                showNotification(language === 'en' ? `Image ${filename} exported successfully!` : `¡Imagen ${filename} exportada con éxito!`);
            }
        } catch (e) {
            console.error("Snapshot failed", e);
            alert((language === 'en' ? "Error exporting image: " : "Error al exportar la imagen: ") + (e as Error).message);
        }
    };

    const handleChatSubmit = async (text: string) => {
        const userMsg: ChatMessage = { id: generateId(), role: 'user', text };
        setChatMessages(prev => [...prev, userMsg]);
        setIsAiLoading(true);

        try {
            const result = await generate3DContent(text, sceneObjects);
            if (result && result.objectsToAdd.length > 0) {
                const layerId = ensureActiveLayerType('geometry');
                const newObjects: SceneObject[] = result.objectsToAdd.map(obj => ({ ...obj, id: generateId(), layerId, visible: true, material: {...obj.material, opacity: 0.8} }));
                addToHistory([...sceneObjects, ...newObjects]);
                setSelectedIds(newObjects.map(o => o.id));
                handleToolChange('select');
                setChatMessages(prev => [...prev, { id: generateId(), role: 'model', text: result.explanation || "Done." }]);
            } else {
                setChatMessages(prev => [...prev, { id: generateId(), role: 'model', text: result?.explanation || "Could not generate." }]);
            }
        } catch (error) {
            setChatMessages(prev => [...prev, { id: generateId(), role: 'model', text: "Error." }]);
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleGroup = () => {
        if (selectedIds.length < 2) return;
        const selectedObjs = sceneObjects.filter(o => selectedIds.includes(o.id));
        if (selectedObjs.length < 2) return;

        const groupId = generateId();
        // Inherit layer from first selected object to avoid hiding if geometry layer is disabled
        const layerId = selectedObjs[0].layerId || ensureActiveLayerType('geometry');
        
        let avgX = 0, avgY = 0, avgZ = 0;
        selectedObjs.forEach(o => { 
            avgX += o.position.x; 
            avgY += o.position.y; 
            avgZ += o.position.z; 
        });
        const center = { 
            x: avgX / selectedObjs.length, 
            y: avgY / selectedObjs.length, 
            z: avgZ / selectedObjs.length 
        };

        const groupObj: SceneObject = { 
            id: groupId, 
            layerId, 
            name: 'Group', 
            type: 'group', 
            visible: true, 
            position: center, 
            rotation: { x: 0, y: 0, z: 0 }, 
            scale: { x: 1, y: 1, z: 1 }, 
            material: { color: '#ffffff', roughness: 0.5, metalness: 0, opacity: 1 } 
        };

        const newObjects = sceneObjects.map(o => { 
            if (selectedIds.includes(o.id)) { 
                return { 
                    ...o, 
                    parentId: groupId, 
                    position: { 
                        x: o.position.x - center.x, 
                        y: o.position.y - center.y, 
                        z: o.position.z - center.z 
                    } 
                }; 
            } 
            return o; 
        });

        addToHistory([...newObjects, groupObj]);
        setSelectedIds([groupId]);
        handleToolChange('select');
        showNotification(language === 'en' ? "Objects grouped" : "Objetos agrupados");
    };

    const handleUngroup = () => {
        const groupsToUngroup = selectedIds.filter(id => sceneObjects.find(o => o.id === id)?.type === 'group');
        if (groupsToUngroup.length === 0) return;
        let newObjects = [...sceneObjects];
        let newSelection: string[] = [];

        groupsToUngroup.forEach(groupId => {
            const groupObj = newObjects.find(o => o.id === groupId);
            if (!groupObj) return;

            const groupEuler = new THREE.Euler(groupObj.rotation.x, groupObj.rotation.y, groupObj.rotation.z);
            const groupQuaternion = new THREE.Quaternion().setFromEuler(groupEuler);
            const groupScale = new THREE.Vector3(groupObj.scale.x, groupObj.scale.y, groupObj.scale.z);
            const groupPos = new THREE.Vector3(groupObj.position.x, groupObj.position.y, groupObj.position.z);

            newObjects = newObjects.map(o => { 
                if (o.parentId === groupId) { 
                    newSelection.push(o.id);

                    const childPos = new THREE.Vector3(o.position.x, o.position.y, o.position.z);
                    childPos.multiply(groupScale);
                    childPos.applyQuaternion(groupQuaternion);
                    childPos.add(groupPos);

                    const childEuler = new THREE.Euler(o.rotation.x, o.rotation.y, o.rotation.z);
                    const childQuat = new THREE.Quaternion().setFromEuler(childEuler);
                    childQuat.premultiply(groupQuaternion);
                    const finalEuler = new THREE.Euler().setFromQuaternion(childQuat);

                    return { 
                        ...o, 
                        parentId: groupObj.parentId || undefined, 
                        position: { x: childPos.x, y: childPos.y, z: childPos.z },
                        rotation: { x: finalEuler.x, y: finalEuler.y, z: finalEuler.z },
                        scale: {
                            x: o.scale.x * groupObj.scale.x,
                            y: o.scale.y * groupObj.scale.y,
                            z: o.scale.z * groupObj.scale.z
                        }
                    }; 
                } 
                return o; 
            });
            newObjects = newObjects.filter(o => o.id !== groupId);
        });

        addToHistory(newObjects);
        setSelectedIds(newSelection);
        showNotification(language === 'en' ? "Objects ungrouped" : "Objetos desagrupados");
    };

    const handleAddObject = (type: ShapeType) => {
        const layerId = ensureActiveLayerType('geometry');
        const n: SceneObject = {
            id: generateId(),
            layerId,
            name: `New ${type}`,
            type,
            visible: true,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            // Max Opacity 0.5 for transparency
            material: { color: DEFAULT_MAT_COLOR, roughness: 0.5, metalness: 0.1, opacity: 0.5 },
            params: type === 'box' ? { width: 2, height: 2, depth: 2 } :
                    type === 'sphere' ? { radius: 1.5 } :
                    type === 'cylinder' || type === 'cone' ? { radius: 1, height: 3 } :
                    type === 'torus' ? { radius: 1.5, tube: 0.4 } :
                    type === 'capsule' ? { radius: 1, height: 3 } :
                    type === 'tetrahedron' ? { radius: 2 } :
                    type === 'octahedron' ? { radius: 2 } :
                    type === 'plane' ? { width: 5, height: 5 } : {}
        };
        addToHistory([...sceneObjects, n]);
        setSelectedIds([n.id]);
        handleToolChange('select');
    };

    const handleDuplicateObject = (id: string) => {
        const currentObjs = sceneObjectsRef.current;
        const rootId = getRootParentId(id, currentObjs);
        const { newObjects, newRootId } = duplicateHierarchy(rootId, currentObjs);
        if (!newRootId || newObjects.length === 0) return;

        addToHistory([...currentObjs, ...newObjects]);
        setSelectedIds([newRootId]);
        handleToolChange('select'); 
        setTransformMode('translate');
    };



    const executeLoft = () => {
        if (loftSelection.length < 2) {
            showNotification(language === 'en' ? "Select at least 2 curves for Loft" : "Selecciona al menos 2 curvas para crear un Loft");
            return;
        }

        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        let hasPts = false;

        const strokes = loftSelection
            .map(id => sceneObjects.find(s => s.id === id))
            .filter((s): s is SceneObject => !!s && !!s.strokeData?.points && s.strokeData.points.length >= 2);

        strokes.forEach(stroke => {
            const pos = stroke.position;
            stroke.strokeData!.points.forEach(p => {
                const wx = p.x + pos.x;
                const wy = p.y + pos.y;
                const wz = p.z + pos.z;
                minX = Math.min(minX, wx); maxX = Math.max(maxX, wx);
                minY = Math.min(minY, wy); maxY = Math.max(maxY, wy);
                minZ = Math.min(minZ, wz); maxZ = Math.max(maxZ, wz);
                hasPts = true;
            });
        });

        const center = hasPts ? {
            x: (minX + maxX) / 2,
            y: (minY + maxY) / 2,
            z: (minZ + maxZ) / 2
        } : { x: 0, y: 0, z: 0 };

        const o: SceneObject = { 
            id: generateId(), 
            layerId: ensureActiveLayerType('geometry'), 
            name: `Loft (${loftSelection.length} curvas)`, 
            type: 'loft', 
            visible: true, 
            position: center, 
            rotation: { x: 0, y: 0, z: 0 }, 
            scale: { x: 1, y: 1, z: 1 }, 
            material: { color: brushColor, roughness: 0.5, metalness: 0.1, opacity: 1 }, 
            loftData: { 
                strokeIdA: loftSelection[0], 
                strokeIdB: loftSelection[1], 
                strokeIds: loftSelection,
                segments: 30 
            }
        };

        addToHistory([...sceneObjects, o]);
        setLoftSelection([]);
        handleToolChange('select');
        setSelectedIds([o.id]);
        setInstruction(null);
        showNotification(language === 'en' ? "Loft surface generated successfully!" : "¡Superficie Loft generada con éxito!");
    };

    const startLoftTool = () => {
        setInstruction("Selecciona curvas en orden para el Loft");
        handleToolChange('loft-step-1');
        setLoftSelection([]);
    };

    return (
        <div className="flex h-screen w-screen bg-white overflow-hidden font-sans text-black select-none">
            {/* FILE INPUTS */}
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={e => { 
                    const f = e.target.files?.[0]; 
                    if (f) { 
                        const url = URL.createObjectURL(f); 
                        const ext = f.name.split('.').pop()?.toLowerCase() || '';
                        const n: SceneObject = { 
                            id: generateId(), 
                            layerId: ensureActiveLayerType('geometry'), 
                            name: f.name.substring(0, 20), 
                            type: 'import', 
                            importFormat: ext,
                            visible: true, 
                            position: {x:0,y:0,z:0}, 
                            rotation: ext === 'stl' ? {x:-Math.PI/2,y:0,z:0} : {x:0,y:0,z:0}, 
                            scale: {x:1,y:1,z:1}, 
                            material: { color: '#E0E0E0', roughness: 0.6, metalness: 0.1, opacity: 0.75 }, 
                            url 
                        }; 
                        addToHistory([...sceneObjects, n]); 
                        setSelectedIds([n.id]); 
                        handleToolChange('select'); 
                        showNotification(language === 'en' ? `Model "${f.name}" loaded` : `Modelo "${f.name}" cargado`);
                    } 
                    e.target.value = '';
                }} 
                accept=".obj,.stl,.glb,.gltf,.3dm" 
                style={{display:'none'}} 
            />
            <input type="file" ref={projectLoadRef} onChange={handleLoadProject} accept=".json" style={{ display: 'none' }} />
            <input type="file" ref={projectImportRef} onChange={handleInsertProject} accept=".json" style={{ display: 'none' }} />

            {/* TOAST NOTIFICATION POPUP */}
            {toastMessage && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-full shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4 fade-in font-bold text-xs pointer-events-none">
                    <Check size={16} />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* UNIFIED TOP STATUS BAR: INSTRUCTIONS OR HOVER INFO */}
            {showUI && (instruction || hoverInfo) && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 pointer-events-none animate-in slide-in-from-top-4 fade-in">
                    <div className="bg-gray-900/90 text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-md">
                        {instruction ? (
                            <>
                                <Icons.Info size={18} className="text-moda-4" />
                                <span className="text-sm font-semibold tracking-wide">{instruction}</span>
                                {(activeTool === 'loft-step-1' || activeTool === 'loft-step-2') && loftSelection.length >= 2 && (
                                    <button 
                                        onClick={executeLoft}
                                        className="ml-2 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold transition-colors pointer-events-auto flex items-center gap-1 shadow"
                                    >
                                        <Check size={13} />
                                        <span>Finalizar</span>
                                    </button>
                                )}
                                <button 
                                    onClick={cancelCurrentTool}
                                    className="ml-2 hover:bg-gray-700 p-1 rounded-full transition-colors pointer-events-auto text-gray-400 hover:text-white"
                                    title="Cancelar"
                                >
                                    <Icons.Close size={14} />
                                </button>
                            </>
                        ) : (
                            <span className="text-xs font-bold tracking-wide uppercase">{hoverInfo}</span>
                        )}
                    </div>
                </div>
            )}

            {showUI && (
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2 animate-in fade-in duration-200">
                     {/* Project Name Button */}
                     <div className="flex items-center gap-2 bg-white rounded-full px-1 py-1 border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors">
                         <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 rounded-full hover:bg-gray-100 text-moda-4" title="Menú principal">
                            <Icons.DrawOnShape size={20} />
                         </button>
                         
                         <div className="flex flex-col px-1">
                             {isEditingName ? (
                                 <input 
                                    type="text" 
                                    value={projectName} 
                                    onChange={(e) => setProjectName(e.target.value)}
                                    onBlur={() => setIsEditingName(false)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingName(false); }}
                                    autoFocus
                                    className="text-sm font-bold bg-transparent outline-none w-32"
                                 />
                             ) : (
                                 <button 
                                    onClick={() => setIsEditingName(true)}
                                    className="text-sm font-bold text-gray-800 hover:text-moda-3 transition-colors text-left flex items-center gap-1 group"
                                 >
                                     {projectName}
                                     <Pen size={10} className="opacity-0 group-hover:opacity-100 text-gray-400" />
                                 </button>
                             )}
                             <span className="text-[10px] text-gray-400 font-mono -mt-0.5">by {user.name}</span>
                         </div>
                     </div>

                     {/* Direct Proyectos Button */}
                     <button 
                         onClick={() => setShowProjectsModal(true)} 
                         className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-blue-50 text-xs font-bold text-moda-3 rounded-full border border-gray-200 shadow-sm transition-all active:scale-95 cursor-pointer"
                         title="Mis Proyectos"
                     >
                         <Icons.Save size={16} />
                         <span>Proyectos</span>
                     </button>

                     {isMenuOpen && (
                         <div className="absolute top-14 left-0 w-60 bg-white rounded-xl shadow-xl border border-gray-200 p-2 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-200">
                            <button onClick={() => saveProjectInternal()} className="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-50 text-xs text-left font-bold text-moda-3 bg-blue-50/50"><Icons.Save size={14} /> Guardar Proyecto (Interno)</button>
                            <button onClick={() => { setIsMenuOpen(false); setShowProjectsModal(true); showNotification("Galería de proyectos cargada"); }} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 text-xs text-left"><Icons.Save size={14} /> Mis Proyectos (Galería)</button>
                            <hr className="border-gray-100 my-1" />
                            <button onClick={handleNewProject} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 text-xs text-left"><Icons.File size={14} /> Nuevo Proyecto</button>
                            <button onClick={handleSaveProject} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 text-xs text-left"><Icons.Upload size={14} /> Exportar Archivo JSON (Externo)</button>
                            <button onClick={() => { projectLoadRef.current?.click(); setIsMenuOpen(false); showNotification("Selecciona archivo JSON a abrir"); }} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 text-xs text-left"><Icons.Upload size={14} /> Abrir Archivo JSON</button>
                            <button onClick={() => { projectImportRef.current?.click(); setIsMenuOpen(false); showNotification("Selecciona archivo JSON a insertar"); }} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 text-xs text-left"><Icons.Add size={14} /> Insertar Archivo JSON</button>
                            <hr className="border-gray-100 my-1" />
                            <button onClick={() => { setIsMenuOpen(false); handleExportSnapshot(); }} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 text-xs text-left"><Icons.Export size={14} /> Exportar Imagen (PNG / JPG)</button>
                            <button onClick={() => handleExport('stl')} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 text-xs text-left"><Icons.Export size={14} /> Exportar STL (Mesh)</button>
                            <button onClick={() => handleExport('glb')} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 text-xs text-left"><Icons.Box size={14} /> Exportar GLB (Mesh)</button>
                            <button onClick={() => handleExport('dxf')} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 text-xs text-left text-moda-3 font-bold bg-blue-50"><Icons.DrawOnShape size={14} /> Exportar DXF (Polilínea)</button>
                            <hr className="border-gray-100 my-1" />
                            <button onClick={() => { fileInputRef.current?.click(); setIsMenuOpen(false); showNotification(language === 'en' ? "Select 3D model (OBJ, STL, GLB, 3DM)" : "Selecciona archivo 3D (OBJ, STL, GLB, 3DM)"); }} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 text-xs text-left"><Icons.Upload size={14} /> {language === 'en' ? 'Import 3D Model (OBJ, STL)' : 'Importar Modelo 3D (OBJ, STL)'}</button>
                         </div>
                     )}
                     <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm mt-2 w-fit">
                        <button onClick={undo} disabled={historyIndex === 0} className="p-2 disabled:opacity-20 hover:bg-gray-50 rounded"><Icons.Undo size={16} /></button>
                        <button onClick={redo} disabled={historyIndex === history.length - 1} className="p-2 disabled:opacity-20 hover:bg-gray-50 rounded"><Icons.Redo size={16} /></button>
                     </div>
                </div>
            )}

            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                 {showUI && (
                     <div className="bg-white/80 backdrop-blur rounded-full px-3 py-1.5 flex gap-2 border border-gray-200 shadow-sm items-center animate-in fade-in duration-200">
                        <div className="flex gap-1">
                             <button onClick={() => { handleToolChange('select'); setTransformMode('translate'); }} className={`p-1.5 rounded-full ${transformMode === 'translate' && activeTool === 'select' ? 'text-moda-4 bg-yellow-50' : 'text-gray-400 hover:text-gray-600'}`} title="Mover"><Icons.Move size={17} /></button>
                             <button onClick={() => { handleToolChange('select'); setTransformMode('rotate'); }} className={`p-1.5 rounded-full ${transformMode === 'rotate' && activeTool === 'select' ? 'text-moda-4 bg-yellow-50' : 'text-gray-400 hover:text-gray-600'}`} title="Rotar"><Icons.Rotate size={17} /></button>
                             <button onClick={() => { handleToolChange('select'); setTransformMode('scale'); }} className={`p-1.5 rounded-full ${transformMode === 'scale' && activeTool === 'select' ? 'text-moda-4 bg-yellow-50' : 'text-gray-400 hover:text-gray-600'}`} title="Escalar"><Icons.Scale size={17} /></button>
                        </div>
                        <div className="w-[1px] h-5 bg-gray-200" />
                        {/* Grid Visibility Toggle */}
                        <button 
                            onClick={() => {
                                setIsGridVisible(!isGridVisible);
                                showNotification(!isGridVisible ? "Rejilla activada" : "Rejilla oculta");
                            }} 
                            className={`p-1.5 rounded-full transition-colors ${isGridVisible ? 'text-moda-3 font-bold bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}
                            title={isGridVisible ? "Ocultar Rejilla" : "Mostrar Rejilla"}
                        >
                            <Icons.Grid size={17} />
                        </button>
                        {/* Background Color Popover */}
                        <div className="relative">
                            <button 
                                onClick={() => setIsBgMenuOpen(!isBgMenuOpen)} 
                                className="w-6 h-6 rounded-full border border-gray-300 shadow-sm flex items-center justify-center p-0.5 hover:scale-105 transition-transform"
                                style={{ backgroundColor: backgroundColor }}
                                title="Color de Fondo"
                            >
                                <div className="w-full h-full rounded-full border border-black/10" />
                            </button>
                            {isBgMenuOpen && (
                                <div className="absolute top-9 right-0 bg-white rounded-xl shadow-xl border border-gray-200 p-2.5 flex flex-col gap-2 z-50 min-w-[140px] animate-in fade-in zoom-in-95">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase px-1 tracking-wider">Fondo 3D</div>
                                    <div className="grid grid-cols-4 gap-1.5 px-1">
                                        {[
                                            { color: '#ffffff', name: 'Blanco' },
                                            { color: '#f1f5f9', name: 'Gris' },
                                            { color: '#1e293b', name: 'Pizarra' },
                                            { color: '#090d16', name: 'Negro' }
                                        ].map(bg => (
                                            <button
                                                key={bg.color}
                                                onClick={() => { setBackgroundColor(bg.color); setIsBgMenuOpen(false); }}
                                                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${backgroundColor.toLowerCase() === bg.color.toLowerCase() ? 'border-blue-500 scale-110 shadow' : 'border-gray-200'}`}
                                                style={{ backgroundColor: bg.color }}
                                                title={bg.name}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-1.5 px-1 pt-1.5 border-t border-gray-100">
                                        <input 
                                            type="color" 
                                            value={backgroundColor} 
                                            onChange={(e) => setBackgroundColor(e.target.value)} 
                                            className="w-5 h-5 rounded border-0 cursor-pointer p-0"
                                        />
                                        <span className="text-[11px] font-mono text-gray-600 uppercase">{backgroundColor}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                     </div>
                 )}
                 <button onClick={() => setShowUI(!showUI)} className={`p-2.5 rounded-full border bg-white shadow-sm transition-colors ${!showUI ? 'bg-yellow-50 text-moda-4 border-yellow-200' : 'text-gray-400'}`} title={showUI ? "Ocultar interfaz" : "Mostrar interfaz"}><LayoutTemplate size={20} /></button>
            </div>

            {showUI && (
                <div className="absolute left-4 top-28 bottom-32 w-64 z-10 pointer-events-none animate-in slide-in-from-left-4 duration-300">
                    <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-2xl h-full shadow-xl overflow-hidden pointer-events-auto">
                        <LayersPanel 
                            layers={layers} 
                            objects={sceneObjects} 
                            activeLayerId={activeLayerId} 
                            areGeometryLayersVisible={areGeometryVisible} 
                            onToggleGlobalGeometry={() => setAreGeometryVisible(!areGeometryVisible)} 
                            onLayerSelect={setActiveLayerId} 
                            onToggleVisibility={id => setLayers(layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l))} 
                            onToggleLock={id => setLayers(layers.map(l => l.id === id ? { ...l, locked: !l.locked } : l))} 
                            onAddLayer={t => { const n:Layer = {id:generateId(), name:`Layer ${layers.length+1}`, visible:true, locked:false, type:t}; setLayers([n, ...layers]); setActiveLayerId(n.id); }} 
                            onDeleteLayer={id => { if (layers.length > 1) { setLayers(layers.filter(l => l.id !== id)); addToHistory(sceneObjects.filter(o => o.layerId !== id)); if (activeLayerId === id) setActiveLayerId(layers[0].id); } }} 
                            onRenameLayer={(id, n) => setLayers(layers.map(l => l.id === id ? { ...l, name: n } : l))} 
                            onDeleteObject={id => addToHistory(sceneObjects.filter(o => o.id !== id))} 
                            onSelectObject={id => { setSelectedIds([id]); handleToolChange('select'); }} 
                            onToggleObjectVisibility={id => setSceneObjects(sceneObjects.map(o => o.id === id ? {...o, visible: o.visible===false} : o))} 
                            selectedIds={selectedIds} 
                            onMoveObjectsToLayer={handleMoveObjectsToLayer}
                        />
                    </div>
                </div>
            )}

            <div className="absolute inset-0 z-0">
                <SceneCanvas 
                    objects={sceneObjects} visibleLayerIds={layers.filter(l => l.visible).map(l => l.id)} selectedIds={selectedIds} lockedLayerIds={layers.filter(l => l.locked).map(l => l.id)} onSelect={handleObjectSelect} onLassoSelect={(ids) => { setSelectedIds(ids); handleToolChange('select'); }} 
                    onTransform={(id, u) => { 
                        if (id === 'symmetry-plane') { 
                            setSymmetryPosition(u.position as Vector3); 
                        } else { 
                            // Skip history during live drag, update state + ref directly
                            handleUpdateObject(id, u, false);
                        } 
                    }} 
                    onTransformMultiple={handleTransformMultiple}
                    onTransformStart={()=>{}} 
                    onTransformEnd={() => { 
                        if (!selectedIds.includes('symmetry-plane')) {
                            // Commit the final state from Ref to History
                            addToHistory(sceneObjectsRef.current);
                        }
                    }} 
                    mode={transformMode} isDrawingMode={activeTool === 'brush' || activeTool === 'eraser' || activeTool === 'draw-plane' || (activeTool === 'select' && selectionMode === 'lasso') || activeTool === 'lasso'} activeTool={(activeTool === 'select' && selectionMode === 'lasso') ? 'lasso' : (activeTool === 'shapes' || activeTool === 'view' ? 'select' : activeTool)} eraserMode={eraserMode} eraserSize={eraserSize}
                    currentBrushColor={brushColor} 
                    currentBrushSize={brushSize} 
                    currentBrushSmoothing={brushSmoothing} // Pass new prop
                    isSymmetryEnabled={isSymmetryEnabled} symmetryX={symmetryPosition.x} symmetryAxis={symmetryAxis} symmetryPosition={symmetryPosition} areGeometryVisible={areGeometryVisible} onStrokeComplete={handleStrokeComplete} onErase={id => handleDeleteObject(id)} onPartialErase={handlePartialErase} onCameraDirectionUpdate={d => { capturedCameraDir.current = d; }} onUndo={undo} onRedo={redo}
                    cameraAction={cameraAction}
                    onCameraActionHandled={() => setCameraAction(null)}
                    exportRef={exportRef}
                    backgroundColor={backgroundColor}
                    isGridVisible={isGridVisible}
                    onPickColorAndThickness={handlePickColorAndThickness}
                />
            </div>

            {showUI && (activeTool === 'brush' || activeTool === 'draw-plane' || activeTool === 'eraser' || selectedIds.length > 0 || activeTool === 'pipette') && (
                 <div className="absolute bottom-20 left-20 z-50 animate-in fade-in duration-200">
                    <RadialPalette 
                        color={brushColor} 
                        thickness={brushSize} 
                        smoothing={brushSmoothing}
                        onColorChange={handleColorChange} 
                        onThicknessChange={setBrushSize} 
                        onSmoothingChange={setBrushSmoothing}
                        presets={brushPresets}
                        onPresetsChange={setBrushPresets}
                        onActivatePipette={handleActivatePipette}
                        isPipetteActive={activeTool === 'pipette'}
                    />
                </div>
            )}
            
            {showUI && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 pointer-events-none animate-in fade-in duration-200">
                    <div className="pointer-events-auto flex flex-col items-center gap-4">
                        {selectedIds.length > 0 && (
                            <div className="flex items-center gap-2 animate-in slide-in-from-bottom-2 bg-white/95 backdrop-blur p-1.5 rounded-full shadow-xl border border-gray-200">
                                 {selectedIds.length > 1 && (
                                     <button onClick={handleGroup} className="px-3.5 py-1.5 rounded-full hover:bg-gray-100 text-xs font-bold flex items-center gap-1 text-gray-700"><Icons.Group size={14} /> Agrupar</button>
                                 )}
                                 {selectedIds.some(id => sceneObjects.find(o => o.id === id)?.type === 'group') && (
                                     <button onClick={handleUngroup} className="px-3.5 py-1.5 rounded-full hover:bg-blue-50 text-moda-3 text-xs font-bold flex items-center gap-1"><Icons.Group size={14} /> Desagrupar</button>
                                 )}
                                 <button 
                                     onClick={handleSaveSelectionAsComponent} 
                                     className="px-3.5 py-1.5 rounded-full hover:bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                                     title="Guardar como componente reusable en la biblioteca"
                                 >
                                     <Icons.Package size={14} /> 
                                     <span>Guardar Componente</span>
                                 </button>
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                             {/* MAIN TOOLBAR */}
                             <div className="flex bg-white/90 backdrop-blur rounded-2xl p-2 border border-gray-200 shadow-xl items-center gap-3 relative z-20">
                                <ToolbarItem active={activeTool === 'select' || activeTool === 'lasso'} onClick={() => { handleToolChange('select'); setSelectionMode('replace'); }} icon={activeTool === 'lasso' ? Icons.Lasso : Icons.Select} tooltipText="Select & Transform" onHover={setHoverInfo} onLeave={() => setHoverInfo(null)}>
                                    <div className="flex bg-gray-100 rounded-lg p-0.5">
                                        <button onClick={() => { handleToolChange('select'); setSelectionMode('replace'); }} className={`p-1.5 rounded ${activeTool === 'select' && selectionMode === 'replace' ? 'bg-white shadow text-black' : 'text-gray-400'}`} title="Click Select"><Icons.Select size={16} /></button>
                                        <button onClick={() => { handleToolChange('select'); setSelectionMode('lasso'); }} className={`p-1.5 rounded ${activeTool === 'select' && selectionMode === 'lasso' ? 'bg-white shadow text-black' : 'text-gray-400'}`} title="Lasso Select"><Icons.Lasso size={16} /></button>
                                    </div>
                                    <div className="w-[1px] h-6 bg-gray-200 mx-1" />
                                    <div className="flex bg-gray-100 rounded-lg p-0.5">
                                        <button onClick={() => setSelectionMode('add')} className={`p-1.5 rounded ${selectionMode === 'add' ? 'bg-white shadow text-black' : 'text-gray-400'}`} title="Add"><Icons.Plus size={16} /></button>
                                        <button onClick={() => setSelectionMode('subtract')} className={`p-1.5 rounded ${selectionMode === 'subtract' ? 'bg-white shadow text-black' : 'text-gray-400'}`} title="Subtract"><Icons.Minus size={16} /></button>
                                    </div>
                                </ToolbarItem>
                                <div className="h-6 w-[1px] bg-gray-200" />
                                <ToolbarItem active={activeTool === 'brush'} onClick={() => { handleToolChange('brush'); setLoftSelection([]); setInstruction(null); }} icon={Icons.Brush} tooltipText="Draw Strokes" onHover={setHoverInfo} onLeave={() => setHoverInfo(null)}>
                                    <div className="flex items-center gap-2 px-2 py-1">
                                        <button 
                                            onClick={() => setIsStrokeFilled(!isStrokeFilled)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${isStrokeFilled ? 'bg-yellow-100 border-yellow-300 text-yellow-700 shadow-sm' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}
                                            title="Toggle Fill"
                                        >
                                            <Icons.FillShape size={14} className={isStrokeFilled ? 'fill-current' : ''} />
                                            <span>Fill</span>
                                        </button>
                                    </div>
                                </ToolbarItem>
                                 <ToolbarItem active={activeTool === 'eraser'} onClick={() => { handleToolChange('eraser'); setEraserMode('partial'); setLoftSelection([]); setInstruction(null); }} icon={Icons.Eraser} tooltipText="Eraser" onHover={setHoverInfo} onLeave={() => setHoverInfo(null)}>
                                     <div className="flex flex-col gap-2 p-1 min-w-[140px]">
                                         <div className="flex bg-gray-100 rounded-lg p-0.5">
                                             <button onClick={() => setEraserMode('partial')} className={`p-1.5 flex-1 flex items-center justify-center rounded ${eraserMode === 'partial' ? 'bg-white shadow text-black' : 'text-gray-400'}`} title="Borrador Parcial"><Icons.Eraser size={16} /></button>
                                             <button onClick={() => setEraserMode('object')} className={`p-1.5 flex-1 flex items-center justify-center rounded ${eraserMode === 'object' ? 'bg-white shadow text-black' : 'text-gray-400'}`} title="Borrar Objeto Completo"><Icons.Delete size={16} /></button>
                                         </div>
                                         {eraserMode === 'partial' && (
                                             <div className="flex flex-col gap-1 px-1">
                                                 <div className="flex justify-between items-center text-[10px] font-bold text-gray-400">
                                                     <span>GROSOR</span>
                                                     <span className="text-gray-600 font-mono">{(eraserSize * 10).toFixed(1)}</span>
                                                 </div>
                                                 <input 
                                                     type="range" 
                                                     min="0.05" 
                                                     max="1.5" 
                                                     step="0.05" 
                                                     value={eraserSize} 
                                                     onChange={(e) => setEraserSize(parseFloat(e.target.value))}
                                                     className="w-full accent-red-500 cursor-pointer h-1.5 bg-gray-200 rounded-lg appearance-none" 
                                                 />
                                             </div>
                                         )}
                                     </div>
                                 </ToolbarItem>
                                
                                <div className="h-6 w-[1px] bg-gray-200" />
                                <ToolbarItem 
                                     active={activeTool === 'pipette'} 
                                     onClick={handleActivatePipette} 
                                     icon={Icons.Pipette} 
                                     tooltipText="Pipeta (Copiar Color y Grosor)" 
                                     onHover={setHoverInfo} 
                                     onLeave={() => setHoverInfo(null)}
                                 />
                                 
                                 <div className="h-6 w-[1px] bg-gray-200" />
                                
                                {/* GUIDE TOOLS REMOVED */}
                                
                                <ToolbarItem active={isSymmetryEnabled} onClick={() => { setIsSymmetryEnabled(!isSymmetryEnabled); }} icon={Icons.Symmetry} tooltipText="Symmetry Options" onHover={setHoverInfo} onLeave={() => setHoverInfo(null)}>
                                    <div className="flex items-center gap-2 px-2">
                                        <span className="text-[10px] font-bold text-gray-400">AXIS</span>
                                        <div className="flex bg-gray-100 rounded-lg p-0.5">
                                            {(['x', 'y', 'z'] as const).map(axis => (
                                                <button key={axis} onClick={(e) => { e.stopPropagation(); setSymmetryAxis(axis); setIsSymmetryEnabled(true); }} className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold uppercase ${symmetryAxis === axis && isSymmetryEnabled ? 'bg-white shadow text-moda-3' : 'text-gray-400 hover:text-gray-600'}`}>{axis}</button>
                                            ))}
                                        </div>
                                    </div>
                                </ToolbarItem>
                                
                                <ToolbarItem 
                                    active={activeTool === 'view'} 
                                    // Toggle Logic: If active, turn off.
                                    onClick={() => activeTool === 'view' ? handleToolChange('select') : handleToolChange('view')} 
                                    icon={Icons.View}
                                    tooltipText="Camera Views"
                                    onHover={setHoverInfo} onLeave={() => setHoverInfo(null)}
                                >
                                    <div className="flex flex-col gap-1 p-1 min-w-[200px]">
                                        <div className="flex justify-between items-center px-2 py-1">
                                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Presets</div>
                                            <button onClick={() => handleToolChange('select')} className="text-gray-400 hover:text-gray-600" title="Close"><Icons.Close size={14}/></button>
                                        </div>
                                        <div className="grid grid-cols-4 gap-1 p-1">
                                            <button onClick={() => setCameraAction({type: 'reset'})} className="p-2 hover:bg-gray-100 rounded text-red-500 hover:text-red-700 transition-colors" title="Reset View"><Icons.Reset size={14} /></button>
                                            <button onClick={() => setCameraAction({type: 'front'})} className="p-2 hover:bg-gray-100 rounded text-gray-600 text-[10px] font-bold text-center">Front</button>
                                            <button onClick={() => setCameraAction({type: 'right'})} className="p-2 hover:bg-gray-100 rounded text-gray-600 text-[10px] font-bold text-center">Right</button>
                                            <button onClick={() => setCameraAction({type: 'top'})} className="p-2 hover:bg-gray-100 rounded text-gray-600 text-[10px] font-bold text-center">Top</button>
                                        </div>

                                        <div className="h-[1px] bg-gray-100 my-1" />
                                        
                                        <div className="flex justify-between items-center px-2 py-1">
                                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">My Views</div>
                                            <button onClick={handleSaveView} className="text-[10px] text-moda-3 font-bold hover:bg-blue-50 px-2 py-0.5 rounded transition-colors">+ Save View</button>
                                        </div>
                                        
                                        <div className="max-h-32 overflow-y-auto space-y-0.5 px-1">
                                            {savedViews.length === 0 && <div className="text-[10px] text-gray-300 italic px-2">No saved views yet</div>}
                                            {savedViews.map(view => (
                                                <div key={view.id} className="flex items-center justify-between group hover:bg-gray-50 rounded p-1">
                                                    <button onClick={() => setCameraAction({ type: 'custom', view })} className="text-xs text-left flex-1 text-gray-700 hover:text-black truncate">
                                                        {view.name}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="h-[1px] bg-gray-100 my-1" />
                                        
                                        <button 
                                            onClick={handleExportSnapshot}
                                            className="w-full text-xs font-bold text-gray-600 hover:text-moda-3 hover:bg-blue-50 p-2 rounded flex items-center gap-2 justify-center transition-colors"
                                        >
                                            <Icons.Export size={14} /> Export Snapshot (PNG)
                                        </button>
                                    </div>
                                </ToolbarItem>
                             </div>

                             {/* SEPARATED SHAPES (CREATE) BUTTON */}
                             <div className="flex bg-white/90 backdrop-blur rounded-2xl p-2 border border-gray-200 shadow-xl items-center relative z-20">
                                 <ToolbarItem 
                                    active={activeTool === 'shapes' || activeTool === 'draw-plane' || activeTool === 'loft-step-1' || activeTool === 'loft-step-2'} 
                                    onClick={() => { handleToolChange('shapes'); }} 
                                    icon={Icons.Shapes} 
                                    tooltipText="Create Geometry"
                                    isSeparate={true}
                                    onHover={setHoverInfo} onLeave={() => setHoverInfo(null)}
                                 >
                                     <div className="flex gap-1">
                                         <button onClick={() => { handleAddObject('box'); handleToolChange('select'); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600" title="Cubo"><Icons.Box size={18} /></button>
                                         <button onClick={() => { handleAddObject('cylinder'); handleToolChange('select'); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600" title="Cilindro"><Icons.Cylinder size={18} /></button>
                                         <button onClick={() => { handleAddObject('sphere'); handleToolChange('select'); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600" title="Esfera"><Icons.Circle size={18} /></button>
                                         <button onClick={() => { handleAddObject('plane'); handleToolChange('select'); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600" title="Plano (Cuadrado)"><Icons.Square size={18} /></button>
                                         <button 
                                             onClick={() => { handleToolChange('draw-plane'); setInstruction("Dibujar curva para Plano (Curve Guide)"); }} 
                                             className={`p-2 rounded-lg ${activeTool === 'draw-plane' ? 'bg-blue-50 text-moda-3' : 'hover:bg-gray-100 text-gray-600'}`} 
                                             title="Plano (Curve Guide)"
                                         >
                                             <Icons.Spline size={18} />
                                         </button>
                                         <button 
                                             onClick={startLoftTool} 
                                             className={`p-2 rounded-lg ${activeTool === 'loft-step-1' || activeTool === 'loft-step-2' ? 'bg-blue-50 text-moda-3' : 'hover:bg-gray-100 text-gray-600'}`} 
                                             title="Loft"
                                         >
                                             <Icons.Loft size={18} />
                                         </button>
                                     </div>
                                 </ToolbarItem>
                              </div>
                         </div>

                     </div>
                 </div>
            )}

            {showUI && selectedIds.length === 1 && !showChat && selectedIds[0] !== 'symmetry-plane' && (
                <div className="absolute right-4 bottom-32 w-64 bg-white/95 backdrop-blur border border-gray-200 rounded-2xl z-10 shadow-xl overflow-hidden">
                    <PropertiesPanel object={sceneObjects.find(o => o.id === selectedIds[0]) || null} onChange={handleUpdateObject} onDelete={handleDeleteObject} onDuplicate={handleDuplicateObject} selectedCount={1} />
                </div>
            )}
            
            {/* PROJECTS & COMPONENT LIBRARY MODAL */}
            <ProjectsPanel 
                isOpen={showProjectsModal}
                onClose={() => setShowProjectsModal(false)}
                currentObjects={sceneObjects}
                currentLayers={layers}
                language={language}
                onLanguageChange={handleLanguageChange}
                onCaptureThumbnail={() => exportRef.current?.getScreenshot('image/png') || ''}
                components={customComponents}
                onInsertComponent={handleInsertComponent}
                onDeleteComponent={handleDeleteComponent}
                onExportComponent={handleExportComponent}
                onImportComponent={handleImportComponent}
                onSaveSelectionAsComponent={handleSaveSelectionAsComponent}
                selectedCount={selectedIds.length}
                onLoadProject={(proj) => {
                    updateSceneState(proj.sceneObjects);
                    setLayers(proj.layers);
                    historyRef.current = [proj.sceneObjects];
                    historyIndexRef.current = 0;
                    setHistory([proj.sceneObjects]);
                    setHistoryIndex(0);
                    if (proj.name) setProjectName(proj.name);
                    if (proj.savedViews) setSavedViews(proj.savedViews);
                    if (proj.cameraState) {
                        setCameraAction({
                            type: 'set',
                            view: {
                                id: 'loaded-view',
                                name: 'Loaded View',
                                position: proj.cameraState.position,
                                target: proj.cameraState.target,
                                fov: proj.cameraState.fov || 45
                            }
                        });
                    }
                    if (proj.brushSettings) {
                        if (proj.brushSettings.color) setBrushColor(proj.brushSettings.color);
                        if (proj.brushSettings.size) setBrushSize(proj.brushSettings.size);
                        if (typeof proj.brushSettings.smoothing === 'number') setBrushSmoothing(proj.brushSettings.smoothing);
                        if (proj.brushSettings.presets) setBrushPresets(proj.brushSettings.presets);
                    }
                    if (proj.backgroundColor) setBackgroundColor(proj.backgroundColor);
                    if (typeof proj.isGridVisible === 'boolean') setIsGridVisible(proj.isGridVisible);
                    showNotification(language === 'en' ? `Project '${proj.name}' loaded!` : `¡Proyecto '${proj.name}' cargado!`);
                }}
                onNewProject={() => {
                    updateSceneState(INITIAL_SCENE);
                    setLayers(INITIAL_LAYERS);
                    historyRef.current = [INITIAL_SCENE];
                    historyIndexRef.current = 0;
                    setHistory([INITIAL_SCENE]);
                    setHistoryIndex(0);
                    setProjectName("Untitled Project");
                    setSavedViews([]);
                    setBackgroundColor('#ffffff');
                    setIsGridVisible(true);
                    showNotification(language === 'en' ? "New project started" : "Nuevo proyecto iniciado");
                }}
            />

            {/* EXPORT PNG / JPG MODAL */}
            <ExportPNGModal 
                isOpen={showExportPNGModal}
                onClose={() => setShowExportPNGModal(false)}
                onExport={performExportSnapshot}
                defaultFilename={projectName}
                language={language}
            />
        </div>
    );
}