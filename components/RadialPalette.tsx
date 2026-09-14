import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Pipette } from 'lucide-react';
import iro from '@jaames/iro';
import { Language } from '../utils/translations';

export interface BrushPreset {
    id: string;
    color: string;
    thickness: number;
}

interface RadialPaletteProps {
    color: string;
    thickness: number;
    smoothing: number;
    language?: Language;
    onColorChange: (color: string) => void;
    onThicknessChange: (size: number) => void;
    onSmoothingChange: (smooth: number) => void;
    presets?: BrushPreset[];
    onPresetsChange?: (presets: BrushPreset[]) => void;
    onActivatePipette?: () => void;
    isPipetteActive?: boolean;
}

const MODA_PALETTE = [
    { name: 'Moda-1', color: '#D9D7D8' },
    { name: 'Moda-2', color: '#8FB6D9' },
    { name: 'Moda-3', color: '#5185A6' },
    { name: 'Moda-4', color: '#F2B441' },
    { name: 'Moda-5', color: '#A6450D' },
];

export const RadialPalette: React.FC<RadialPaletteProps> = ({ 
    color, 
    thickness, 
    smoothing, 
    language = 'en',
    onColorChange, 
    onThicknessChange, 
    onSmoothingChange,
    presets,
    onPresetsChange,
    onActivatePipette,
    isPipetteActive
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [localSavedBrushes, setLocalSavedBrushes] = useState<BrushPreset[]>([]);
    
    const activeBrushes = presets !== undefined ? presets : localSavedBrushes;
    const setBrushes = (updater: (prev: BrushPreset[]) => BrushPreset[]) => {
        if (onPresetsChange) {
            onPresetsChange(updater(activeBrushes));
        } else {
            setLocalSavedBrushes(updater);
        }
    };
    
    const containerRef = useRef<HTMLDivElement>(null);
    const iroContainerRef = useRef<HTMLDivElement>(null);
    const pickerRef = useRef<any>(null);
    const isSelfChange = useRef<boolean>(false);

    // Initialize iro.js ColorPicker when popover opens
    useEffect(() => {
        if (!isOpen || !iroContainerRef.current) return;

        iroContainerRef.current.innerHTML = '';

        try {
            const startColor = color && color.startsWith('#') ? color : '#5185A6';
            const picker = new (iro.ColorPicker as any)(iroContainerRef.current, {
                width: 175,
                color: startColor,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                layout: [
                    {
                        component: (iro.ui as any).Wheel,
                        options: {}
                    },
                    {
                        component: (iro.ui as any).Slider,
                        options: {
                            sliderType: 'value'
                        }
                    }
                ]
            });

            // Use 'input:change' which ONLY fires on user gestures (NOT on programmatic picker.color.set)
            picker.on('input:change', (c: any) => {
                isSelfChange.current = true;
                onColorChange(c.hexString);
                setTimeout(() => {
                    isSelfChange.current = false;
                }, 50);
            });

            pickerRef.current = picker;
        } catch (err) {
            console.error("Failed to initialize iro picker in RadialPalette:", err);
        }

        return () => {
            if (iroContainerRef.current) {
                iroContainerRef.current.innerHTML = '';
            }
            pickerRef.current = null;
        };
    }, [isOpen]);

    // Synchronize external color prop changes with iro.ColorPicker
    useEffect(() => {
        if (pickerRef.current && !isSelfChange.current && color) {
            try {
                if (pickerRef.current.color && pickerRef.current.color.hexString.toLowerCase() !== color.toLowerCase()) {
                    pickerRef.current.color.set(color);
                }
            } catch (_) {}
        }
    }, [color]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen]);

    const saveBrush = () => {
        const newPreset: BrushPreset = {
            id: Math.random().toString(36).substr(2, 9),
            color,
            thickness
        };
        setBrushes(prev => [...prev, newPreset]);
    };

    const loadBrush = (preset: BrushPreset) => {
        onColorChange(preset.color);
        onThicknessChange(preset.thickness);
        if (pickerRef.current) {
            try {
                pickerRef.current.color.set(preset.color);
            } catch (_) {}
        }
    };

    const deleteBrush = (id: string) => {
        setBrushes(prev => prev.filter(b => b.id !== id));
    };

    // Visualization
    const MIN_BRUSH = 0.01;
    const MAX_BRUSH = 0.5;
    const MIN_PX = 4;
    const MAX_PX = 40;
    const safeThickness = Math.max(MIN_BRUSH, Math.min(MAX_BRUSH, thickness));
    const sizeRatio = (safeThickness - MIN_BRUSH) / (MAX_BRUSH - MIN_BRUSH);
    const centerSize = MIN_PX + sizeRatio * (MAX_PX - MIN_PX);

    return (
        <div ref={containerRef} className="relative flex items-center justify-center select-none pointer-events-auto">
            {/* Center Trigger Button */}
            <div 
                className="relative z-30 flex items-center justify-center cursor-pointer active:scale-95 transition-transform rounded-full shadow-xl border-4 border-white ring-1 ring-gray-200 overflow-hidden"
                onClick={() => setIsOpen(!isOpen)}
                style={{ width: '72px', height: '72px', backgroundColor: color }}
                title={language === 'en' ? "Brush Settings" : "Ajustes de Pincel"}
            >
                 {/* Inner Ring representing Thickness */}
                 <div 
                    className="rounded-full shadow-sm transition-all duration-100 ease-out bg-white"
                    style={{ width: `${centerSize}px`, height: `${centerSize}px` }}
                />
            </div>

            {/* The Palette Popover */}
            <div className={`absolute bottom-24 left-0 z-20 flex flex-col items-center gap-3 transition-all duration-200 origin-bottom-left ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'}`}>
                 <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-5 border border-gray-100 flex flex-col items-center gap-3 w-64 relative">
                    
                    {/* Official iro.js Color Wheel */}
                    <div className="flex justify-center items-center my-1">
                        <div ref={iroContainerRef} className="iro-picker-container" />
                    </div>

                    {/* Controls Container */}
                    <div className="w-full px-2 space-y-3">
                        {/* Thickness Slider */}
                        <div>
                            <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase mb-1">
                                <span>{language === 'en' ? 'Size' : 'Tamaño'}</span>
                                <span className="font-mono text-gray-600">{thickness.toFixed(2)}</span>
                            </div>
                            <input 
                                type="range" 
                                min={MIN_BRUSH} 
                                max={MAX_BRUSH} 
                                step={0.01}
                                value={thickness}
                                onChange={(e) => onThicknessChange(parseFloat(e.target.value))}
                                className="w-full accent-gray-800 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        {/* Smoothing Slider */}
                        <div>
                            <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase mb-1">
                                <span>{language === 'en' ? 'Smoothing' : 'Suavizado'}</span>
                                <span className="font-mono text-gray-600">{Math.round(smoothing * 100)}%</span>
                            </div>
                            <input 
                                type="range" 
                                min={0} 
                                max={0.95} 
                                step={0.05}
                                value={smoothing}
                                onChange={(e) => onSmoothingChange(parseFloat(e.target.value))}
                                className="w-full accent-blue-500 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Colors */}
                    <div className="w-full pt-2 border-t border-gray-100">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">{language === 'en' ? 'Colors' : 'Colores'}</span>
                            {onActivatePipette && (
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        onActivatePipette();
                                    }}
                                    className={`p-1.5 rounded-full transition-all ${
                                        isPipetteActive 
                                            ? 'bg-moda-3 text-white shadow-sm' 
                                            : 'bg-blue-50 text-moda-3 hover:bg-blue-100'
                                    }`}
                                    title={language === 'en' ? "Eyedropper: Pick color & size" : "Pipeta: Copiar color y grosor"}
                                >
                                    <Pipette size={14} />
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2 px-1 justify-center">
                            {MODA_PALETTE.map(p => (
                                <button
                                    key={p.name}
                                    onClick={() => {
                                        onColorChange(p.color);
                                        if (pickerRef.current) {
                                            try { pickerRef.current.color.set(p.color); } catch (_) {}
                                        }
                                    }}
                                    className="w-6 h-6 rounded-full border border-gray-200 shadow-sm hover:scale-110 transition-transform"
                                    style={{ backgroundColor: p.color }}
                                    title={p.name}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Presets List */}
                    <div className="w-full pt-2 border-t border-gray-100">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">{language === 'en' ? 'Saved Brushes' : 'Pinceles Guardados'}</span>
                            <button 
                                onClick={saveBrush}
                                className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium transition-colors"
                            >
                                <Plus size={10} /> {language === 'en' ? 'Save' : 'Guardar'}
                            </button>
                        </div>
                        
                        {activeBrushes.length === 0 ? (
                            <div className="text-[10px] text-gray-400 text-center py-2 italic">
                                {language === 'en' ? 'No saved brushes' : 'Sin pinceles guardados'}
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto px-1 py-1">
                                {activeBrushes.map(b => (
                                    <div 
                                        key={b.id}
                                        className="group relative flex items-center justify-center p-1 bg-gray-50 border border-gray-200 rounded-full hover:border-gray-400 cursor-pointer transition-all"
                                        onClick={() => loadBrush(b)}
                                        title={`${language === 'en' ? 'Size' : 'Tamaño'}: ${b.thickness}`}
                                    >
                                        <div 
                                            className="w-4 h-4 rounded-full"
                                            style={{ backgroundColor: b.color }}
                                        />
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); deleteBrush(b.id); }}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={8} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default RadialPalette;
