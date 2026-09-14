
import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Pipette } from 'lucide-react';

export interface BrushPreset {
    id: string;
    color: string;
    thickness: number;
}

interface RadialPaletteProps {
    color: string;
    thickness: number;
    smoothing: number;
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

// -- Color Helpers --
const hsvToHex = (h: number, s: number, v: number) => {
    h = Math.max(0, Math.min(360, h));
    s = Math.max(0, Math.min(100, s));
    v = Math.max(0, Math.min(100, v));

    const h_norm = h / 360;
    const s_norm = s / 100;
    const v_norm = v / 100;

    const i = Math.floor(h_norm * 6);
    const f = h_norm * 6 - i;
    const p = v_norm * (1 - s_norm);
    const q = v_norm * (1 - f * s_norm);
    const t = v_norm * (1 - (1 - f) * s_norm);
    
    let r=0, g=0, b=0;
    switch (i % 6) {
        case 0: r = v_norm; g = t; b = p; break;
        case 1: r = q; g = v_norm; b = p; break;
        case 2: r = p; g = v_norm; b = t; break;
        case 3: r = p; g = q; b = v_norm; break;
        case 4: r = t; g = p; b = v_norm; break;
        case 5: r = v_norm; g = p; b = q; break;
    }

    const toHex = (x: number) => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const hexToHsv = (hex: string) => {
    hex = hex.replace('#', '');
    let r = 0, g = 0, b = 0;
    if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    }
    r /= 255; g /= 255; b /= 255;
    
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max === min) {
        h = 0;
    } else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h * 360, s: s * 100, v: v * 100 };
};

const RadialPalette: React.FC<RadialPaletteProps> = ({ 
    color, 
    thickness, 
    smoothing, 
    onColorChange, 
    onThicknessChange, 
    onSmoothingChange,
    presets,
    onPresetsChange,
    onActivatePipette,
    isPipetteActive
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [hsv, setHsv] = useState({ h: 0, s: 0, v: 0 });
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
    const hueRingRef = useRef<HTMLDivElement>(null);
    const svSquareRef = useRef<HTMLDivElement>(null);
    const isDraggingHue = useRef(false);
    const isDraggingSV = useRef(false);

    useEffect(() => {
        if (!isDraggingHue.current && !isDraggingSV.current) {
            setHsv(hexToHsv(color));
        }
    }, [color]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleUp = () => {
            isDraggingHue.current = false;
            isDraggingSV.current = false;
        };

        const handleMove = (e: MouseEvent | TouchEvent) => {
            if (!isOpen) return;
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

            if (isDraggingHue.current && hueRingRef.current) {
                e.preventDefault();
                const rect = hueRingRef.current.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const dx = clientX - centerX;
                const dy = clientY - centerY;
                let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
                if (angle < 0) angle += 360;
                
                setHsv(prev => {
                    const next = { ...prev, h: angle };
                    onColorChange(hsvToHex(next.h, next.s, next.v));
                    return next;
                });
            }

            if (isDraggingSV.current && svSquareRef.current) {
                e.preventDefault();
                const rect = svSquareRef.current.getBoundingClientRect();
                const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

                setHsv(prev => {
                    const next = { ...prev, s: x * 100, v: (1 - y) * 100 };
                    onColorChange(hsvToHex(next.h, next.s, next.v));
                    return next;
                });
            }
        };

        if (isOpen) {
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleUp);
            window.addEventListener('touchmove', handleMove, { passive: false });
            window.addEventListener('touchend', handleUp);
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleUp);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen, onColorChange]);

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
    };

    const deleteBrush = (id: string) => {
        setBrushes(prev => prev.filter(b => b.id !== id));
    };

    // Calculate Hue Handle Position (Outer Ring)
    const ringRadius = 70;
    const hueRad = (hsv.h - 90) * (Math.PI / 180);
    const hueX = Math.cos(hueRad) * ringRadius;
    const hueY = Math.sin(hueRad) * ringRadius;

    // Calculate SV Handle Position (Inner Square)
    const squareSize = 80;
    const svX = (hsv.s / 100) * squareSize;
    const svY = (1 - (hsv.v / 100)) * squareSize;

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
                title="Brush Settings"
            >
                 {/* Inner Ring representing Thickness - NOW WHITE */}
                 <div 
                    className="rounded-full shadow-sm transition-all duration-100 ease-out bg-white"
                    style={{ width: `${centerSize}px`, height: `${centerSize}px` }}
                />
            </div>

            {/* The Palette Popover */}
            <div className={`absolute bottom-24 left-0 z-20 flex flex-col items-center gap-3 transition-all duration-200 origin-bottom-left ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'}`}>
                 <div className="bg-white/95 backdrop-blur-xl rounded-full shadow-2xl p-6 border border-gray-100 flex flex-col items-center gap-4 w-64 relative">
                    
                    {/* Iro.js Style Color Picker */}
                    <div className="relative w-48 h-48 flex items-center justify-center">
                        
                        {/* Hue Ring (Outer) */}
                        <div 
                            ref={hueRingRef}
                            onMouseDown={() => isDraggingHue.current = true}
                            onTouchStart={() => isDraggingHue.current = true}
                            className="absolute inset-0 rounded-full cursor-crosshair shadow-sm border border-gray-100"
                            style={{ 
                                background: `conic-gradient(red, yellow, lime, cyan, blue, magenta, red)`,
                                mask: 'radial-gradient(transparent 58px, black 59px)',
                                WebkitMask: 'radial-gradient(transparent 58px, black 59px)'
                            }}
                        />
                        {/* Hue Handle */}
                        <div 
                            className="absolute w-5 h-5 bg-white border-2 border-white rounded-full shadow-md pointer-events-none z-10"
                            style={{ 
                                top: `calc(50% + ${hueY}px - 10px)`, 
                                left: `calc(50% + ${hueX}px - 10px)`,
                                boxShadow: '0 0 4px rgba(0,0,0,0.3)'
                            }}
                        />

                        {/* SV Square (Inner) */}
                        <div 
                            ref={svSquareRef}
                            onMouseDown={() => isDraggingSV.current = true}
                            onTouchStart={() => isDraggingSV.current = true}
                            className="absolute w-20 h-20 shadow-inner cursor-crosshair z-0 rounded-md overflow-hidden"
                            style={{ backgroundColor: `hsl(${hsv.h}, 100%, 50%)` }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                            <div 
                                className="absolute w-3 h-3 bg-transparent border-2 border-white rounded-full shadow-sm pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
                                style={{ top: `${svY}px`, left: `${svX}px`, boxShadow: '0 0 2px rgba(0,0,0,0.5)' }}
                            />
                        </div>
                    </div>

                    {/* Controls Container */}
                    <div className="w-full px-2 space-y-3">
                        {/* Thickness Slider */}
                        <div>
                            <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase mb-1">
                                <span>Size</span>
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

                        {/* Smoothing Slider (New) */}
                        <div>
                            <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase mb-1">
                                <span>Smoothing</span>
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
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Colors</span>
                            {onActivatePipette && (
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        onActivatePipette();
                                    }}
                                    className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-bold transition-all ${
                                        isPipetteActive 
                                            ? 'bg-moda-3 text-white shadow-sm' 
                                            : 'bg-blue-50 text-moda-3 hover:bg-blue-100'
                                    }`}
                                    title="Pipeta: Copiar color y grosor de cualquier elemento de la escena"
                                >
                                    <Pipette size={12} />
                                    <span>Pipeta</span>
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2 px-1 justify-center">
                            {MODA_PALETTE.map(p => (
                                <button
                                    key={p.name}
                                    onClick={() => onColorChange(p.color)}
                                    className="w-6 h-6 rounded-full border border-gray-200 shadow-sm hover:scale-110 transition-transform"
                                    style={{ backgroundColor: p.color }}
                                    title={p.name}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Saved Brushes Grid */}
                    <div className="w-full pt-2 border-t border-gray-100">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Presets</span>
                            <button onClick={saveBrush} className="flex items-center gap-1 text-[10px] bg-gray-100 text-gray-700 px-2 py-1 rounded-full hover:bg-gray-200 font-bold transition-colors">
                                <Plus size={10} /> Add
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto px-1 justify-center">
                            {activeBrushes.length === 0 && <span className="text-[10px] text-gray-300 italic">No saved brushes</span>}
                            {activeBrushes.map(brush => {
                                const previewSize = Math.max(4, Math.min(16, (brush.thickness / MAX_BRUSH) * 16));
                                return (
                                    <div key={brush.id} className="relative group">
                                        <button 
                                            onClick={() => loadBrush(brush)}
                                            className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:shadow-md transition-all"
                                        >
                                            <div 
                                                className="rounded-full" 
                                                style={{ backgroundColor: brush.color, width: `${previewSize}px`, height: `${previewSize}px` }} 
                                            />
                                        </button>
                                        <button 
                                            onClick={() => deleteBrush(brush.id)}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3 h-3 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={8} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default RadialPalette;
