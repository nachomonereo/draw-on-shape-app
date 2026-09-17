
import React, { useState } from 'react';
import { SceneObject, Vector3 } from '../types';
import { Copy, Trash2, Sparkles, FolderPlus, Ungroup, Pipette } from 'lucide-react';
import { ColorPickerModal } from './ColorPickerModal';
import { Language } from '../utils/translations';

interface PropertiesPanelProps {
    object: SceneObject | null;
    selectedIds?: string[];
    allObjects?: SceneObject[];
    onChange: (id: string, updates: Partial<SceneObject>, saveToHistory?: boolean) => void;
    onSelectedThicknessChange?: (thickness: number, saveToHistory?: boolean) => void;
    onSelectedOpacityChange?: (opacity: number, saveToHistory?: boolean) => void;
    onSelectedColorChange?: (color: string) => void;
    onSmoothSelected?: () => void;
    onDelete: (idOrIds: string | string[]) => void;
    onDuplicate?: (id: string) => void;
    onGroup?: () => void;
    onUngroup?: () => void;
    selectedCount: number;
    language?: Language;
    onActivatePipette?: () => void;
}

const getDescendants = (parentId: string, list: SceneObject[]): SceneObject[] => {
    let result: SceneObject[] = [];
    const directChildren = list.filter(o => o.parentId === parentId);
    for (const child of directChildren) {
        result.push(child);
        result = result.concat(getDescendants(child.id, list));
    }
    return result;
};

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ 
    object, 
    selectedIds = [],
    allObjects = [],
    onChange, 
    onSelectedThicknessChange,
    onSelectedOpacityChange,
    onSelectedColorChange,
    onSmoothSelected,
    onDelete, 
    onDuplicate, 
    onGroup,
    onUngroup,
    selectedCount,
    language = 'en',
    onActivatePipette
}) => {
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const isEn = language === 'en';
    
    // Multi-object selection panel
    if (selectedCount > 1) {
        const selectedObjects = allObjects.filter(o => selectedIds.includes(o.id));
        const allTargetIds = new Set<string>();
        const collectIds = (id: string) => {
            allTargetIds.add(id);
            allObjects.filter(o => o.parentId === id).forEach(c => collectIds(c.id));
        };
        selectedIds.forEach(id => collectIds(id));

        const allTargetObjects = allObjects.filter(o => allTargetIds.has(o.id));
        const strokeElements = allTargetObjects.filter(o => o.type === 'stroke' && o.strokeData);
        const currentThickness = strokeElements.length > 0 ? (strokeElements[0].strokeData?.thickness || 0.05) : 0.05;
        const currentColor = selectedObjects[0]?.material?.color || '#000000';
        const currentOpacity = selectedObjects[0]?.material?.opacity ?? 1.0;

        return (
            <div className="p-4 space-y-5 text-black h-full overflow-y-auto select-none">
                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                    <div className="flex flex-col">
                        <h3 className="font-bold uppercase text-xs tracking-wider text-gray-800">
                            {selectedCount} Items Selected
                        </h3>
                        <span className="text-[10px] text-gray-400 font-mono">
                            {strokeElements.length > 0 ? `${strokeElements.length} stroke(s) included` : 'Multiple elements'}
                        </span>
                    </div>
                    <div className="flex gap-1.5">
                        {onGroup && (
                            <button 
                                onClick={onGroup} 
                                className="text-gray-500 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors" 
                                title="Group selected elements"
                            >
                                <FolderPlus size={15} />
                            </button>
                        )}
                        <button 
                            onClick={() => onDelete(selectedIds)} 
                            className="text-gray-500 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors" 
                            title="Delete selected elements"
                        >
                            <Trash2 size={15} />
                        </button>
                    </div>
                </div>

                {/* Multi-stroke thickness control */}
                {strokeElements.length > 0 && (
                    <div className="space-y-3 pt-1">
                        <label className="text-xs text-yellow-600 font-bold uppercase tracking-wider">Stroke Geometry</label>
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>Stroke Thickness</span>
                                <span className="font-mono">{currentThickness.toFixed(2)}</span>
                            </div>
                            <input 
                                type="range" 
                                min={0.01} max={0.5} step={0.01}
                                value={currentThickness}
                                onChange={(e) => onSelectedThicknessChange?.(parseFloat(e.target.value), false)}
                                onPointerUp={(e) => onSelectedThicknessChange?.(parseFloat((e.target as HTMLInputElement).value), true)}
                                className="w-full accent-yellow-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                            {onSmoothSelected && (
                                <button 
                                    onClick={onSmoothSelected}
                                    className="py-2 px-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                                    title="Smooth all selected stroke curves"
                                >
                                    <Sparkles size={13} />
                                    <span>Smooth ({strokeElements.length})</span>
                                </button>
                            )}
                            {onActivatePipette && (
                                <button 
                                    onClick={onActivatePipette}
                                    className="py-2 px-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-gray-200 shadow-2xs"
                                    title="Match Style: Copy color and thickness from another stroke"
                                >
                                    <Pipette size={13} />
                                    <span>Match Style</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Multi-material controls */}
                <div className="space-y-3 pt-2 border-t border-gray-100">
                    <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Style</label>
                    
                    {/* Opacity */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>Opacity</span>
                            <span className="font-mono">{Math.round(currentOpacity * 100)}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="0.1" 
                            max="1.0" 
                            step="0.05"
                            value={currentOpacity}
                            onChange={(e) => onSelectedOpacityChange?.(parseFloat(e.target.value), false)}
                            onPointerUp={(e) => onSelectedOpacityChange?.(parseFloat((e.target as HTMLInputElement).value), true)}
                            className="w-full accent-yellow-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>

                    {/* Color */}
                    <div className="flex items-center justify-between mt-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="text-xs text-gray-600">Base Color</span>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 font-mono uppercase">{currentColor}</span>
                            <button 
                                type="button"
                                onClick={() => setIsColorPickerOpen(true)}
                                className="w-7 h-7 rounded-full border-2 border-white shadow-sm cursor-pointer hover:scale-105 transition-transform"
                                style={{ backgroundColor: currentColor }}
                                title="Select Color"
                            />
                        </div>
                    </div>

                    <ColorPickerModal 
                        isOpen={isColorPickerOpen}
                        initialColor={currentColor}
                        title="Selection Color"
                        language="en"
                        onClose={() => setIsColorPickerOpen(false)}
                        onColorSelect={(color) => onSelectedColorChange?.(color)}
                        onActivatePipette={onActivatePipette}
                    />
                </div>

                <div className="pt-2 mt-auto">
                    <p className="text-[10px] text-gray-400 text-center italic">
                        Use the 3D Gizmo on screen to transform.
                    </p>
                </div>
            </div>
        );
    }

    if (!object) {
        return (
            <div className="p-4 text-gray-400 text-sm text-center">
                Select an object.
            </div>
        );
    }

    const isGroup = object.type === 'group';
    const descendants = isGroup ? getDescendants(object.id, allObjects) : [];
    const groupStrokes = descendants.filter(d => d.type === 'stroke' && d.strokeData);
    const groupFirstStroke = groupStrokes.length > 0 ? groupStrokes[0] : null;
    const groupStrokeThickness = groupFirstStroke?.strokeData?.thickness || 0.05;

    const updateMaterial = (key: keyof SceneObject['material'], value: any) => {
        if (isGroup) {
            if (key === 'color' && onSelectedColorChange) {
                onSelectedColorChange(value);
                return;
            }
            if (key === 'opacity' && onSelectedOpacityChange) {
                onSelectedOpacityChange(value, true);
                return;
            }
        }
        onChange(object.id, {
            material: { ...object.material, [key]: value }
        });
    };

    const updateParams = (key: string, value: number) => {
        onChange(object.id, {
            params: { ...object.params, [key]: value }
        });
    };
    
    const updateExtrusion = (key: string, value: number) => {
        onChange(object.id, {
            extrusionData: { ...object.extrusionData!, [key]: value }
        });
    };

    const smoothStroke = () => {
        if (object.type !== 'stroke' || !object.strokeData) return;
        const points = object.strokeData.points;
        if (points.length < 3) return;

        const newPoints = points.map((p, idx) => {
            if (idx === 0 || idx === points.length - 1) return p;
            const prev = points[idx - 1];
            const next = points[idx + 1];
            return {
                x: 0.25 * prev.x + 0.5 * p.x + 0.25 * next.x,
                y: 0.25 * prev.y + 0.5 * p.y + 0.25 * next.y,
                z: 0.25 * prev.z + 0.5 * p.z + 0.25 * next.z,
            };
        });
        
        onChange(object.id, {
            strokeData: { ...object.strokeData, points: newPoints }
        });
    };

    const smoothExtrusion = () => {
        if (object.type !== 'extrusion' || !object.extrusionData?.pathPoints) return;
        const points = object.extrusionData.pathPoints;
        if (points.length < 3) return;

        const newPoints = points.map((p, idx) => {
            if (idx === 0 || idx === points.length - 1) return p;
            const prev = points[idx - 1];
            const next = points[idx + 1];
            return {
                x: 0.25 * prev.x + 0.5 * p.x + 0.25 * next.x,
                y: 0.25 * prev.y + 0.5 * p.y + 0.25 * next.y,
                z: 0.25 * prev.z + 0.5 * p.z + 0.25 * next.z,
            };
        });
        
        onChange(object.id, {
            extrusionData: { ...object.extrusionData, pathPoints: newPoints }
        });
    };

    const renderParametricInputs = () => {
        // GROUP OBJECT WITH STROKES
        if (isGroup) {
            if (groupStrokes.length === 0) return null;
            return (
                <div className="space-y-4 pt-2">
                    <label className="text-xs text-yellow-600 font-bold uppercase tracking-wider">Group Strokes</label>
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>Stroke Thickness</span>
                                <span className="font-mono">{groupStrokeThickness.toFixed(2)}</span>
                            </div>
                            <input 
                                type="range" 
                                min={0.01} max={0.5} step={0.01}
                                value={groupStrokeThickness}
                                onChange={(e) => onSelectedThicknessChange?.(parseFloat(e.target.value), false)}
                                onPointerUp={(e) => onSelectedThicknessChange?.(parseFloat((e.target as HTMLInputElement).value), true)}
                                className="w-full accent-yellow-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                        {onSmoothSelected && (
                            <button 
                                onClick={onSmoothSelected}
                                className="w-full py-2 px-3 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                                title="Smooth all stroke curves in this group"
                            >
                                <Sparkles size={14} />
                                <span>Smooth Group Strokes</span>
                                <span className="text-[10px] font-mono text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded-full">
                                    {groupStrokes.length}
                                </span>
                            </button>
                        )}
                    </div>
                </div>
            );
        }

        let fields: {label: string, key: string, min?: number, max?: number, step?: number, isExtrusion?: boolean}[] = [];
        
        if (object.type === 'box' || object.type === 'plane' || object.type === 'image') {
            fields = [
                { label: 'Width', key: 'width', min: 0.5, max: 100, step: 0.5 },
                { label: 'Height', key: 'height', min: 0.5, max: 100, step: 0.5 },
            ];
            if (object.type === 'box') fields.push({ label: 'Depth', key: 'depth', min: 0.5, max: 100, step: 0.5 });
        } else if (object.type === 'sphere') {
            fields = [{ label: 'Radius', key: 'radius', min: 0.5, max: 50, step: 0.5 }];
        } else if (object.type === 'cylinder' || object.type === 'cone' || object.type === 'capsule') {
            fields = [
                { label: 'Radius', key: 'radius', min: 0.5, max: 50, step: 0.5 },
                { label: 'Height', key: 'height', min: 0.5, max: 100, step: 0.5 },
            ];
        } else if (object.type === 'torus') {
            fields = [
                { label: 'Radius', key: 'radius', min: 0.5, max: 50, step: 0.5 },
                { label: 'Tube', key: 'tube', min: 0.1, max: 10, step: 0.1 },
            ];
        } else if (object.type === 'tetrahedron' || object.type === 'octahedron') {
             fields = [{ label: 'Radius', key: 'radius', min: 0.5, max: 50, step: 0.5 }];
        } else if (object.type === 'loft') {
            fields = [{ label: 'Segments', key: 'segments', min: 2, max: 100, step: 1 }];
        } else if (object.type === 'extrusion') {
            fields = [{ label: 'Wall Height', key: 'height', min: 0.5, max: 50, step: 0.5, isExtrusion: true }];
        }

        if (fields.length === 0 && object.type !== 'stroke' && object.type !== 'extrusion') return null;

        return (
            <div className="space-y-4 pt-2">
                <label className="text-xs text-yellow-600 font-bold uppercase tracking-wider">Geometry</label>
                
                {object.type === 'stroke' && (
                     <div className="space-y-3">
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>Thickness</span>
                                <span className="font-mono">{object.strokeData?.thickness.toFixed(2)}</span>
                            </div>
                            <input 
                                type="range" 
                                min={0.01} max={0.5} step={0.01}
                                value={object.strokeData?.thickness || 0.05}
                                onChange={(e) => onChange(object.id, { strokeData: { ...object.strokeData!, thickness: parseFloat(e.target.value) } }, false)}
                                onPointerUp={(e) => onChange(object.id, { strokeData: { ...object.strokeData!, thickness: parseFloat((e.target as HTMLInputElement).value) } }, true)}
                                className="w-full accent-yellow-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={smoothStroke}
                                className="py-2 px-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-colors shadow-2xs"
                                title="Smooth stroke curve"
                            >
                                <Sparkles size={13} />
                                <span>Smooth</span>
                            </button>
                            {onActivatePipette && (
                                <button 
                                    onClick={onActivatePipette}
                                    className="py-2 px-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-colors border border-gray-200 shadow-2xs"
                                    title="Match Style: Copy color and thickness from another stroke"
                                >
                                    <Pipette size={13} />
                                    <span>Match Style</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {object.type === 'extrusion' && object.extrusionData?.pathPoints && (
                    <button 
                        onClick={smoothExtrusion}
                        className="w-full py-2 px-3 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs mt-1"
                        title="Smooth extrusion curve"
                    >
                        <Sparkles size={14} />
                        <span>Smooth Curve</span>
                        <span className="text-[10px] font-mono text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded-full">
                            {object.extrusionData.pathPoints.length} pts
                        </span>
                    </button>
                )}

                {fields.map(field => (
                    <div key={field.key} className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>{field.label}</span>
                            <span className="font-mono">
                                {/* @ts-ignore */}
                                {field.isExtrusion ? object.extrusionData?.[field.key]?.toFixed(1) : object.params?.[field.key]?.toFixed(1)}
                            </span>
                        </div>
                        <input 
                            type="range" 
                            min={field.min || 1} max={field.max || 500} step={field.step || 1}
                            /* @ts-ignore */
                            value={field.isExtrusion ? (object.extrusionData?.[field.key] || 1) : (object.params?.[field.key] || 1)}
                            onChange={(e) => {
                                if (field.isExtrusion) updateExtrusion(field.key, parseFloat(e.target.value));
                                else updateParams(field.key, parseFloat(e.target.value));
                            }}
                            className="w-full accent-yellow-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                ))}
            </div>
        );
    };

    const effectiveColor = isGroup 
        ? (object.material?.color || groupFirstStroke?.material?.color || '#000000')
        : (object.material?.color || '#000000');

    const effectiveOpacity = object.material?.opacity ?? 1.0;

    return (
        <div className="p-4 space-y-6 text-black h-full overflow-y-auto select-none">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <div className="flex flex-col">
                    <h3 className="font-bold uppercase text-xs tracking-wider text-gray-800 truncate w-32">{object.name}</h3>
                    <span className="text-[10px] text-gray-400 font-mono">
                        {isGroup ? `Group • ${descendants.length} elements` : object.type}
                    </span>
                </div>
                <div className="flex gap-1.5">
                    {isGroup && onUngroup && (
                        <button 
                            onClick={onUngroup} 
                            className="text-gray-500 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors" 
                            title="Ungroup elements"
                        >
                            <Ungroup size={15} />
                        </button>
                    )}
                    {onDuplicate && (
                        <button 
                            onClick={() => onDuplicate(object.id)} 
                            className="text-gray-500 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors" 
                            title="Duplicate"
                        >
                            <Copy size={15} />
                        </button>
                    )}
                    <button 
                        onClick={() => onDelete(object.id)} 
                        className="text-gray-500 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors" 
                        title="Delete"
                    >
                       <Trash2 size={15} />
                    </button>
                </div>
            </div>

            {renderParametricInputs()}

            {/* Material Section */}
            <div className="space-y-4 pt-2 border-t border-gray-100">
                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Style</label>
                
                {/* Opacity */}
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>Opacity</span>
                        <span className="font-mono">{Math.round(effectiveOpacity * 100)}%</span>
                    </div>
                    <input 
                        type="range" 
                        min="0.1" 
                        max="1.0" 
                        step="0.05"
                        value={effectiveOpacity}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (isGroup && onSelectedOpacityChange) {
                                onSelectedOpacityChange(val, false);
                            } else {
                                updateMaterial('opacity', val);
                            }
                        }}
                        onPointerUp={(e) => {
                            const val = parseFloat((e.target as HTMLInputElement).value);
                            if (isGroup && onSelectedOpacityChange) {
                                onSelectedOpacityChange(val, true);
                            } else {
                                onChange(object.id, { material: { ...object.material, opacity: val } }, true);
                            }
                        }}
                        className="w-full accent-yellow-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                {/* Color */}
                 <div className="flex items-center justify-between mt-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                     <span className="text-xs text-gray-600">Base Color</span>
                     <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 font-mono uppercase">{effectiveColor}</span>
                        <button 
                            type="button"
                            onClick={() => setIsColorPickerOpen(true)}
                            className="w-7 h-7 rounded-full border-2 border-white shadow-sm cursor-pointer hover:scale-105 transition-transform"
                            style={{ backgroundColor: effectiveColor }}
                            title="Select Color"
                        />
                    </div>
                </div>

                <ColorPickerModal 
                    isOpen={isColorPickerOpen}
                    initialColor={effectiveColor}
                    title={isGroup ? "Group Color" : "Object Color"}
                    language="en"
                    onClose={() => setIsColorPickerOpen(false)}
                    onColorSelect={(color) => {
                        if (isGroup && onSelectedColorChange) {
                            onSelectedColorChange(color);
                        } else {
                            updateMaterial('color', color);
                        }
                    }}
                    onActivatePipette={onActivatePipette}
                />
            </div>
            
            <div className="pt-4 mt-auto">
                 <p className="text-[10px] text-gray-400 text-center italic">
                    Use gizmo on screen to transform.
                 </p>
            </div>
        </div>
    );
};

export default PropertiesPanel;
