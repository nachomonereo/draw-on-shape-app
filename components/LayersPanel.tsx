import React, { useState } from 'react';
import { Icons } from './IconComponents';
import { Layer, SceneObject } from '../types';
import { ChevronRight, ChevronDown } from 'lucide-react';

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
    selectedIds?: string[]; // New prop for multi-select styling
}

const LayersPanel: React.FC<LayersPanelProps> = ({ 
    layers, objects, activeLayerId, areGeometryLayersVisible, onToggleGlobalGeometry,
    onLayerSelect, onToggleVisibility, onToggleLock, onAddLayer, onDeleteLayer, onRenameLayer, onDeleteObject, onSelectObject, onToggleObjectVisibility, selectedIds = []
}) => {
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

    return (
        <div className="flex flex-col h-full text-black font-sans bg-white">
            <div className="p-4 border-b border-gray-100 bg-white">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-gray-400">Layers</h3>
                    <div className="flex gap-1">
                        <button onClick={() => onAddLayer('geometry')} className="p-1 hover:bg-gray-100 rounded text-blue-500 transition-colors" title="Add Geometry Layer">
                            <Icons.Box size={16} />
                        </button>
                         <button onClick={() => onAddLayer('trace')} className="p-1 hover:bg-gray-100 rounded text-yellow-500 transition-colors" title="Add Trace Layer">
                            <Icons.Brush size={16} />
                        </button>
                    </div>
                </div>
                
                <button 
                    onClick={onToggleGlobalGeometry}
                    className={`w-full flex items-center justify-center gap-2 py-1.5 rounded text-[10px] font-bold uppercase tracking-wide border transition-all ${areGeometryLayersVisible ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-gray-100 text-gray-400 border-gray-200'}`}
                >
                    {areGeometryLayersVisible ? <Icons.Eye size={12} /> : <Icons.EyeOff size={12} />}
                    {areGeometryLayersVisible ? 'Geometry Visible' : 'Geometry Hidden'}
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {layers.slice().reverse().map((layer) => {
                    const layerObjects = objects.filter(o => o.layerId === layer.id);
                    const isGeo = layer.type === 'geometry';
                    const isExpanded = expandedLayerIds.includes(layer.id);
                    const objectCount = layerObjects.length;
                    
                    return (
                        <div key={layer.id} className="bg-white rounded-lg overflow-hidden border border-gray-100 shadow-sm">
                            <div 
                                onClick={() => onLayerSelect(layer.id)}
                                className={`flex items-center gap-1 p-2 cursor-pointer transition-colors border-l-2 
                                    ${activeLayerId === layer.id 
                                        ? (isGeo ? 'bg-blue-50 border-blue-400' : 'bg-yellow-50 border-yellow-400') 
                                        : 'hover:bg-gray-50 border-transparent'
                                    }`}
                            >
                                <button 
                                    onClick={(e) => { e.stopPropagation(); toggleExpand(layer.id); }}
                                    className="p-0.5 text-gray-400 hover:text-black rounded"
                                >
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>

                                <div className="flex items-center gap-0.5">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                                        className={`p-1 rounded ${layer.visible ? 'text-gray-400 hover:text-gray-600' : 'text-gray-300'}`}
                                    >
                                        {layer.visible ? <Icons.Eye size={14} /> : <Icons.EyeOff size={14} />}
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onToggleLock(layer.id); }}
                                        className={`p-1 rounded ${layer.locked ? 'text-red-400' : 'text-gray-300 hover:text-gray-500'}`}
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
                                                className="text-xs font-bold text-gray-900 bg-white border border-blue-300 rounded px-1 py-0.5 focus:outline-none w-full"
                                            />
                                        ) : (
                                            <span 
                                                onDoubleClick={(e) => { e.stopPropagation(); startEditing(layer); }}
                                                className={`text-xs truncate leading-none select-none ${activeLayerId === layer.id ? 'font-bold text-gray-900' : 'text-gray-500'}`}
                                                title="Double click to rename"
                                            >
                                                {layer.name}
                                            </span>
                                        )}
                                        <span className="text-[9px] text-gray-300 font-mono mt-0.5">
                                            {objectCount} objects
                                        </span>
                                    </div>
                                    <span className={`text-[8px] px-1 py-0.5 rounded uppercase tracking-wider font-bold ml-1 ${isGeo ? 'bg-blue-100 text-blue-600' : 'bg-yellow-100 text-yellow-600'}`}>
                                        {isGeo ? 'GEO' : 'TRACE'}
                                    </span>
                                </div>

                                {layers.length > 1 && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onDeleteLayer(layer.id); }}
                                        className="p-1 text-gray-300 hover:text-red-400 transition-colors ml-1"
                                    >
                                        <Icons.Delete size={14} />
                                    </button>
                                )}
                            </div>

                            {isExpanded && layerObjects.length > 0 && (
                                <div className="border-t border-gray-50 bg-gray-50/50">
                                    {layerObjects.map(obj => {
                                        const isObjSelected = selectedIds.includes(obj.id);
                                        return (
                                            <div 
                                                key={obj.id} 
                                                onClick={() => onSelectObject(obj.id)}
                                                className={`flex items-center gap-2 py-1.5 px-2 pl-8 text-[10px] group transition-colors border-b border-gray-50 last:border-0 ${isObjSelected ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-white text-gray-500'}`}
                                            >
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onToggleObjectVisibility(obj.id); }}
                                                    className={`p-0.5 rounded ${obj.visible !== false ? 'text-gray-400 hover:text-gray-600' : 'text-gray-300'}`}
                                                >
                                                    {obj.visible !== false ? <Icons.Eye size={10} /> : <Icons.EyeOff size={10} />}
                                                </button>

                                                <div className="w-2 h-2 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: obj.material.color }}></div>
                                                <span className={`flex-1 truncate ${obj.visible === false ? 'text-gray-300 italic' : ''}`}>
                                                    {obj.parentId ? '↳ ' : ''}{obj.name}
                                                </span>
                                                
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onDeleteObject(obj.id); }}
                                                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
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
                })}
            </div>
        </div>
    );
};

export default LayersPanel;