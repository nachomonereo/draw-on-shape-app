import React, { useState } from 'react';
import { Icons } from './IconComponents';
import { Layer, SceneObject } from '../types';
import { ChevronRight, ChevronDown, FolderInput, Plus, ChevronLeft } from 'lucide-react';
import { Language } from '../utils/translations';

interface LayersPanelProps {
    layers: Layer[];
    objects: SceneObject[]; 
    activeLayerId: string;
    areGeometryLayersVisible: boolean; 
    onToggleGlobalGeometry: () => void; 
    onLayerSelect: (id: string) => void;
    onToggleVisibility: (id: string) => void;
    onToggleLock: (id: string) => void;
    onAddLayer: (type: 'geometry' | 'trace') => void;
    onDeleteLayer: (id: string) => void;
    onRenameLayer: (id: string, newName: string) => void;
    onDeleteObject: (id: string) => void;
    onSelectObject: (id: string) => void;
    onToggleObjectVisibility: (id: string) => void;
    selectedIds?: string[];
    onMoveObjectsToLayer?: (objectIds: string[], targetLayerId: string) => void;
    onCollapse?: () => void;
    language?: Language;
}

const LayersPanel: React.FC<LayersPanelProps> = ({ 
    layers, objects, activeLayerId, areGeometryLayersVisible, onToggleGlobalGeometry,
    onLayerSelect, onToggleVisibility, onToggleLock, onAddLayer, onDeleteLayer, onRenameLayer, 
    onDeleteObject, onSelectObject, onToggleObjectVisibility, selectedIds = [],
    onMoveObjectsToLayer, onCollapse, language = 'en'
}) => {
    const isEn = language === 'en';
    // 2 Dedicated Tabs: 'geometry' and 'trace'
    const [activeTab, setActiveTab] = useState<'geometry' | 'trace'>('geometry');
    const [expandedLayerIds, setExpandedLayerIds] = useState<string[]>([]);
    const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
    const [tempName, setTempName] = useState('');

    const toggleExpand = (layerId: string) => {
        setExpandedLayerIds(prev => 
            prev.includes(layerId) 
                ? prev.filter(id => id !== layerId) 
                : [...prev, layerId]
        );
    };

    const startEditing = (layer: Layer) => {
        setEditingLayerId(layer.id);
        setTempName(layer.name);
    };

    const saveName = () => {
        if (editingLayerId && tempName.trim()) {
            onRenameLayer(editingLayerId, tempName.trim());
        }
        setEditingLayerId(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') saveName();
        if (e.key === 'Escape') setEditingLayerId(null);
    };

    // Filter layers strictly by active tab
    const tabLayers = layers.filter(l => l.type === activeTab);
    const geoCount = layers.filter(l => l.type === 'geometry').length;
    const traceCount = layers.filter(l => l.type === 'trace').length;

    return (
        <div className="flex flex-col h-full text-black font-sans bg-white select-none">
            {/* Top 2 Tabs Header */}
            <div className="p-3 border-b border-gray-100 bg-white">
                <div className="flex items-center gap-1.5 mb-3">
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 rounded-xl flex-1">
                        <button
                            onClick={() => setActiveTab('geometry')}
                            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                                activeTab === 'geometry'
                                    ? 'bg-white text-blue-600 shadow-xs'
                                    : 'text-gray-500 hover:text-gray-800'
                            }`}
                        >
                            <Icons.Box size={14} />
                            <span>{isEn ? 'Geometry' : 'Geometría'}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-500 font-mono">
                                {geoCount}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveTab('trace')}
                            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                                activeTab === 'trace'
                                    ? 'bg-white text-yellow-600 shadow-xs'
                                    : 'text-gray-500 hover:text-gray-800'
                            }`}
                        >
                            <Icons.Brush size={14} />
                            <span>{isEn ? 'Strokes' : 'Trazos'}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-yellow-50 text-yellow-600 font-mono">
                                {traceCount}
                            </span>
                        </button>
                    </div>

                    {onCollapse && (
                        <button
                            onClick={onCollapse}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors shrink-0"
                            title={isEn ? "Minimize panel" : "Minimizar panel"}
                        >
                            <ChevronLeft size={16} />
                        </button>
                    )}
                </div>

                {/* Sub-toolbar per Tab */}
                {activeTab === 'geometry' ? (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                {isEn ? 'Geometry Layers' : 'Capas de Geometría'}
                            </span>
                            <button 
                                onClick={() => onAddLayer('geometry')} 
                                className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-bold transition-colors shadow-2xs"
                                title={isEn ? "Add Geometry Layer" : "Añadir Capa de Geometría"}
                            >
                                <Plus size={14} />
                                <span>{isEn ? 'New Layer' : 'Nueva Capa'}</span>
                            </button>
                        </div>
                        <button 
                            onClick={onToggleGlobalGeometry}
                            className={`w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide border transition-all ${
                                areGeometryLayersVisible 
                                    ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-2xs' 
                                    : 'bg-gray-100 text-gray-400 border-gray-200'
                            }`}
                        >
                            {areGeometryLayersVisible ? <Icons.Eye size={13} /> : <Icons.EyeOff size={13} />}
                            {areGeometryLayersVisible 
                                ? (isEn ? 'Geometry Visible' : 'Geometría Visible') 
                                : (isEn ? 'Geometry Hidden' : 'Geometría Oculta')}
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                            {isEn ? 'Stroke Layers' : 'Capas de Trazo'}
                        </span>
                        <button 
                            onClick={() => onAddLayer('trace')} 
                            className="flex items-center gap-1 px-2.5 py-1 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 rounded-lg text-xs font-bold transition-colors shadow-2xs"
                            title={isEn ? "Add Stroke Layer" : "Añadir Capa de Trazo"}
                        >
                            <Plus size={14} />
                            <span>{isEn ? 'New Layer' : 'Nueva Capa'}</span>
                        </button>
                    </div>
                )}
            </div>
            
            {/* Layers List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {tabLayers.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 space-y-2">
                        <p className="text-xs">{isEn ? 'No layers in this tab' : 'No hay capas en esta pestaña'}</p>
                        <button
                            onClick={() => onAddLayer(activeTab)}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold"
                        >
                            {isEn ? '+ Create first layer' : '+ Crear primera capa'}
                        </button>
                    </div>
                ) : (
                    tabLayers.slice().reverse().map((layer) => {
                        const layerObjects = objects.filter(o => o.layerId === layer.id);
                        const isGeo = layer.type === 'geometry';
                        const isExpanded = expandedLayerIds.includes(layer.id);
                        const objectCount = layerObjects.length;
                        const isLayerActive = activeLayerId === layer.id;
                        const selectedInLayer = layerObjects.filter(o => selectedIds.includes(o.id));
                        const hasSelectedObjects = selectedInLayer.length > 0;
                        
                        return (
                            <div 
                                key={layer.id} 
                                className={`rounded-xl overflow-hidden border shadow-2xs transition-all ${
                                    hasSelectedObjects 
                                        ? 'bg-amber-50/50 border-amber-300 ring-2 ring-amber-300/60' 
                                        : 'bg-white border-gray-100'
                                }`}
                            >
                                <div 
                                    onClick={() => onLayerSelect(layer.id)}
                                    className={`flex items-center gap-1.5 p-2.5 cursor-pointer transition-colors border-l-3 
                                        ${hasSelectedObjects
                                            ? 'bg-amber-100/60 border-amber-500'
                                            : isLayerActive 
                                                ? (isGeo ? 'bg-blue-50/70 border-blue-500' : 'bg-yellow-50/70 border-yellow-500') 
                                                : 'hover:bg-gray-50 border-transparent'
                                        }`}
                                >
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); toggleExpand(layer.id); }}
                                        className="p-1 text-gray-400 hover:text-black rounded"
                                    >
                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </button>

                                    <div className="flex items-center gap-0.5">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                                            className={`p-1 rounded ${layer.visible ? 'text-gray-500 hover:text-gray-800' : 'text-gray-300'}`}
                                            title={layer.visible ? (isEn ? "Hide layer" : "Ocultar capa") : (isEn ? "Show layer" : "Mostrar capa")}
                                        >
                                            {layer.visible ? <Icons.Eye size={14} /> : <Icons.EyeOff size={14} />}
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onToggleLock(layer.id); }}
                                            className={`p-1 rounded ${layer.locked ? 'text-red-500' : 'text-gray-300 hover:text-gray-600'}`}
                                            title={layer.locked ? (isEn ? "Unlock layer" : "Desbloquear capa") : (isEn ? "Lock layer" : "Bloquear capa")}
                                        >
                                            {layer.locked ? <Icons.Lock size={14} /> : <Icons.Unlock size={14} />}
                                        </button>
                                    </div>
                                    
                                    <div className="flex-1 flex items-center justify-between min-w-0 ml-1">
                                        <div className="flex flex-col flex-1 mr-2">
                                            {editingLayerId === layer.id ? (
                                                <input 
                                                    type="text"
                                                    value={tempName}
                                                    onChange={(e) => setTempName(e.target.value)}
                                                    onBlur={saveName}
                                                    onKeyDown={handleKeyDown}
                                                    autoFocus
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-xs font-bold text-gray-900 bg-white border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none w-full"
                                                />
                                            ) : (
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span 
                                                        onDoubleClick={(e) => { e.stopPropagation(); startEditing(layer); }}
                                                        className={`text-xs truncate select-none ${hasSelectedObjects ? 'font-black text-amber-900' : isLayerActive ? 'font-bold text-gray-900' : 'text-gray-600'}`}
                                                        title={isEn ? "Double click to rename" : "Doble clic para renombrar"}
                                                    >
                                                        {layer.name}
                                                    </span>
                                                    {hasSelectedObjects && (
                                                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 font-bold tracking-tight shrink-0 shadow-2xs">
                                                            {selectedInLayer.length} {isEn ? 'sel' : 'sel'}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            <span className="text-[10px] text-gray-400 font-mono mt-0.5">
                                                {objectCount} {objectCount === 1 ? (isEn ? 'object' : 'objeto') : (isEn ? 'objects' : 'objetos')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action: Move Selected Elements to this Layer (Icon only) */}
                                    {selectedIds.length > 0 && onMoveObjectsToLayer && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onMoveObjectsToLayer(selectedIds, layer.id);
                                            }}
                                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold flex items-center justify-center transition-colors border border-indigo-200/60 shadow-2xs shrink-0"
                                            title={isEn ? `Move ${selectedIds.length} selected items to this layer` : `Mover los ${selectedIds.length} elementos seleccionados a esta capa`}
                                        >
                                            <FolderInput size={15} />
                                        </button>
                                    )}

                                    {layers.length > 1 && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onDeleteLayer(layer.id); }}
                                            className="p-1.5 text-gray-300 hover:text-red-500 transition-colors ml-1 rounded"
                                            title={isEn ? "Delete layer" : "Eliminar capa"}
                                        >
                                            <Icons.Delete size={14} />
                                        </button>
                                    )}
                                </div>

                                {/* Expanded Objects List */}
                                {isExpanded && layerObjects.length > 0 && (
                                    <div className="border-t border-gray-100 bg-gray-50/60">
                                        {layerObjects.map(obj => {
                                            const isObjSelected = selectedIds.includes(obj.id);
                                            return (
                                                <div 
                                                    key={obj.id} 
                                                    onClick={() => onSelectObject(obj.id)}
                                                    className={`flex items-center gap-2 py-1.5 px-3 pl-7 text-[11px] group transition-colors border-b border-gray-100/60 last:border-0 ${
                                                        isObjSelected ? 'bg-amber-100/70 text-amber-900 font-bold border-l-2 border-l-amber-500' : 'hover:bg-white text-gray-600'
                                                    }`}
                                                >
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onToggleObjectVisibility(obj.id); }}
                                                        className={`p-0.5 rounded ${obj.visible !== false ? 'text-gray-400 hover:text-gray-700' : 'text-gray-300'}`}
                                                    >
                                                        {obj.visible !== false ? <Icons.Eye size={11} /> : <Icons.EyeOff size={11} />}
                                                    </button>

                                                    <div 
                                                        className="w-2.5 h-2.5 rounded-full border border-black/10 shadow-2xs shrink-0" 
                                                        style={{ backgroundColor: obj.material?.color || '#000' }}
                                                    />

                                                    <span className={`flex-1 truncate ${obj.visible === false ? 'text-gray-400 italic' : ''}`}>
                                                        {obj.parentId ? '↳ ' : ''}{obj.name}
                                                    </span>
                                                    
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); onDeleteObject(obj.id); }}
                                                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1"
                                                        title="Eliminar elemento"
                                                    >
                                                        <Icons.Close size={12} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default LayersPanel;