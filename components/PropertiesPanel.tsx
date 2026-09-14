
import React, { useState } from 'react';
import { SceneObject, Vector3 } from '../types';
import { Copy, Trash2, Sparkles } from 'lucide-react';
import { ColorPickerModal } from './ColorPickerModal';
import { Language } from '../utils/translations';

interface PropertiesPanelProps {
    object: SceneObject | null;
    onChange: (id: string, updates: Partial<SceneObject>) => void;
    onDelete: (id: string) => void;
    onDuplicate?: (id: string) => void;
    selectedCount: number;
    language?: Language;
    onActivatePipette?: () => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ 
    object, 
    onChange, 
    onDelete, 
    onDuplicate, 
    selectedCount,
    language = 'es',
    onActivatePipette
}) => {
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const isEn = language === 'en';
    
    if (selectedCount > 1) {
         return (
            <div className="p-4 h-full flex flex-col items-center justify-center text-gray-400 text-sm text-center">
                <p className="font-bold text-gray-600">{selectedCount} {isEn ? 'items selected' : 'elementos seleccionados'}</p>
                <p className="text-xs mt-2">{isEn ? 'Use the bottom toolbar to group or transform.' : 'Usa la barra inferior para agrupar o transformar.'}</p>
            </div>
        );
    }

    if (!object) {
        return (
            <div className="p-4 text-gray-400 text-sm text-center">
                {isEn ? 'Select an object.' : 'Selecciona un objeto.'}
            </div>
        );
    }

    const updateMaterial = (key: keyof SceneObject['material'], value: any) => {
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

        // Chaikin's corner cutting algorithm (simple iteration)
        const newPoints: Vector3[] = [];
        newPoints.push(points[0]);
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i];
            const p1 = points[i+1];
            newPoints.push({
                x: 0.75 * p0.x + 0.25 * p1.x,
                y: 0.75 * p0.y + 0.25 * p1.y,
                z: 0.75 * p0.z + 0.25 * p1.z
            });
            newPoints.push({
                x: 0.25 * p0.x + 0.75 * p1.x,
                y: 0.25 * p0.y + 0.75 * p1.y,
                z: 0.25 * p0.z + 0.75 * p1.z
            });
        }
        newPoints.push(points[points.length-1]);
        
        onChange(object.id, {
            strokeData: { ...object.strokeData, points: newPoints }
        });
    };

    const smoothExtrusion = () => {
        if (object.type !== 'extrusion' || !object.extrusionData?.pathPoints) return;
        const points = object.extrusionData.pathPoints;
        if (points.length < 3) return;

        const newPoints: Vector3[] = [];
        newPoints.push(points[0]);
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i];
            const p1 = points[i+1];
            newPoints.push({
                x: 0.75 * p0.x + 0.25 * p1.x,
                y: 0.75 * p0.y + 0.25 * p1.y,
                z: 0.75 * p0.z + 0.25 * p1.z
            });
            newPoints.push({
                x: 0.25 * p0.x + 0.75 * p1.x,
                y: 0.25 * p0.y + 0.75 * p1.y,
                z: 0.25 * p0.z + 0.75 * p1.z
            });
        }
        newPoints.push(points[points.length-1]);
        
        onChange(object.id, {
            extrusionData: { ...object.extrusionData, pathPoints: newPoints }
        });
    };

    const renderParametricInputs = () => {
        let fields: {label: string, key: string, min?: number, max?: number, step?: number, isExtrusion?: boolean}[] = [];
        
        if (object.type === 'box' || object.type === 'plane') {
            fields = [
                { label: isEn ? 'Width' : 'Ancho', key: 'width', min: 0.5, max: 100, step: 0.5 },
                { label: isEn ? 'Height' : 'Altura', key: 'height', min: 0.5, max: 100, step: 0.5 },
            ];
            if (object.type === 'box') fields.push({ label: isEn ? 'Depth' : 'Profundidad', key: 'depth', min: 0.5, max: 100, step: 0.5 });
        } else if (object.type === 'sphere') {
            fields = [{ label: isEn ? 'Radius' : 'Radio', key: 'radius', min: 0.5, max: 50, step: 0.5 }];
        } else if (object.type === 'cylinder' || object.type === 'cone' || object.type === 'capsule') {
            fields = [
                { label: isEn ? 'Radius' : 'Radio', key: 'radius', min: 0.5, max: 50, step: 0.5 },
                { label: isEn ? 'Height' : 'Altura', key: 'height', min: 0.5, max: 100, step: 0.5 },
            ];
        } else if (object.type === 'torus') {
            fields = [
                { label: isEn ? 'Radius' : 'Radio', key: 'radius', min: 0.5, max: 50, step: 0.5 },
                { label: isEn ? 'Tube' : 'Tubo', key: 'tube', min: 0.1, max: 10, step: 0.1 },
            ];
        } else if (object.type === 'tetrahedron' || object.type === 'octahedron') {
             fields = [{ label: isEn ? 'Radius' : 'Radio', key: 'radius', min: 0.5, max: 50, step: 0.5 }];
        } else if (object.type === 'loft') {
            fields = [{ label: isEn ? 'Segments' : 'Segmentos', key: 'segments', min: 2, max: 100, step: 1 }];
        } else if (object.type === 'extrusion') {
            fields = [{ label: isEn ? 'Wall Height' : 'Altura', key: 'height', min: 0.5, max: 50, step: 0.5, isExtrusion: true }];
        }

        if (fields.length === 0 && object.type !== 'stroke' && object.type !== 'extrusion') return null;

        return (
            <div className="space-y-4 pt-2">
                <label className="text-xs text-yellow-600 font-bold uppercase tracking-wider">{isEn ? 'Geometry' : 'Geometría'}</label>
                
                {object.type === 'stroke' && (
                     <div className="space-y-3">
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>{isEn ? 'Thickness' : 'Grosor'}</span>
                                <span className="font-mono">{object.strokeData?.thickness.toFixed(2)}</span>
                            </div>
                            <input 
                                type="range" 
                                min={0.01} max={0.5} step={0.01}
                                value={object.strokeData?.thickness || 0.05}
                                onChange={(e) => onChange(object.id, { strokeData: { ...object.strokeData!, thickness: parseFloat(e.target.value) } })}
                                className="w-full accent-yellow-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                        <button 
                            onClick={smoothStroke}
                            className="w-full py-2 px-3 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                            title={isEn ? "Smooth stroke curve" : "Suavizar trazo"}
                        >
                            <Sparkles size={14} />
                            <span>{isEn ? 'Smooth Stroke' : 'Suavizar Trazo'}</span>
                            <span className="text-[10px] font-mono text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded-full">
                                {object.strokeData?.points.length || 0} pts
                            </span>
                        </button>
                    </div>
                )}

                {object.type === 'extrusion' && object.extrusionData?.pathPoints && (
                    <button 
                        onClick={smoothExtrusion}
                        className="w-full py-2 px-3 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs mt-1"
                        title={isEn ? "Smooth extrusion curve" : "Suavizar curva de extrusión"}
                    >
                        <Sparkles size={14} />
                        <span>{isEn ? 'Smooth Curve' : 'Suavizar Curva'}</span>
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

    return (
        <div className="p-4 space-y-6 text-black h-full overflow-y-auto select-none">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <div className="flex flex-col">
                    <h3 className="font-bold uppercase text-xs tracking-wider text-gray-800 truncate w-32">{object.name}</h3>
                    <span className="text-[10px] text-gray-400 font-mono">{object.type}</span>
                </div>
                <div className="flex gap-2">
                     {onDuplicate && (
                        <button onClick={() => onDuplicate(object.id)} className="text-gray-500 hover:text-blue-600 p-1.5 rounded-md hover:bg-blue-50 transition-colors" title={isEn ? "Duplicate" : "Duplicar"}>
                            <Copy size={14} />
                        </button>
                     )}
                    <button onClick={() => onDelete(object.id)} className="text-gray-500 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition-colors" title={isEn ? "Delete" : "Eliminar"}>
                       <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {renderParametricInputs()}

            {/* Material Section */}
            <div className="space-y-4 pt-2 border-t border-gray-100">
                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">{isEn ? 'Style' : 'Estilo'}</label>
                
                {/* Opacity - Capped at 1.0 (100% Solid) */}
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>{isEn ? 'Opacity' : 'Opacidad'}</span>
                        <span className="font-mono">{Math.round((object.material.opacity !== undefined ? object.material.opacity : 1.0) * 100)}%</span>
                    </div>
                    <input 
                        type="range" 
                        min="0.1" 
                        max="1.0" 
                        step="0.05"
                        value={object.material.opacity ?? 1.0}
                        onChange={(e) => updateMaterial('opacity', parseFloat(e.target.value))}
                        className="w-full accent-yellow-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                {/* Color */}
                 <div className="flex items-center justify-between mt-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                     <span className="text-xs text-gray-600">{isEn ? 'Base Color' : 'Color Base'}</span>
                     <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 font-mono uppercase">{object.material.color}</span>
                        <button 
                            type="button"
                            onClick={() => setIsColorPickerOpen(true)}
                            className="w-7 h-7 rounded-full border-2 border-white shadow-sm cursor-pointer hover:scale-105 transition-transform"
                            style={{ backgroundColor: object.material.color }}
                            title={isEn ? "Select Color" : "Seleccionar Color"}
                        />
                    </div>
                </div>

                <ColorPickerModal 
                    isOpen={isColorPickerOpen}
                    initialColor={object.material.color}
                    title={isEn ? "Object Color" : "Color del Objeto"}
                    language={language}
                    onClose={() => setIsColorPickerOpen(false)}
                    onColorSelect={(color) => updateMaterial('color', color)}
                    onActivatePipette={onActivatePipette}
                />
            </div>
            
            <div className="pt-4 mt-auto">
                 <p className="text-[10px] text-gray-300 text-center italic">
                    {isEn ? "Use gizmo on screen to transform." : "Usa el gumball para mover, rotar y escalar."}
                 </p>
            </div>
        </div>
    );
};

export default PropertiesPanel;
