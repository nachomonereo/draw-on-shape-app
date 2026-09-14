import React, { useState, useRef, useEffect } from 'react';
import { X, Check } from 'lucide-react';

interface ColorPickerModalProps {
    isOpen: boolean;
    initialColor: string;
    title?: string;
    onClose: () => void;
    onColorSelect: (color: string) => void;
}

const MODA_PALETTE = [
    { name: 'Moda-1', color: '#D9D7D8' },
    { name: 'Moda-2', color: '#8FB6D9' },
    { name: 'Moda-3', color: '#5185A6' },
    { name: 'Moda-4', color: '#F2B441' },
    { name: 'Moda-5', color: '#A6450D' },
    { name: 'White', color: '#FFFFFF' },
    { name: 'Dark Gray', color: '#334155' },
    { name: 'Black', color: '#0F172A' },
    { name: 'Red', color: '#EF4444' },
    { name: 'Green', color: '#10B981' },
    { name: 'Blue', color: '#3B82F6' },
    { name: 'Purple', color: '#8B5CF6' }
];

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
    
    let r = 0, g = 0, b = 0;
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

export const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
    isOpen,
    initialColor,
    title = 'Selector de Color',
    onClose,
    onColorSelect
}) => {
    const [currentColor, setCurrentColor] = useState(initialColor || '#5185A6');
    const [hsv, setHsv] = useState(() => hexToHsv(initialColor || '#5185A6'));

    useEffect(() => {
        if (isOpen) {
            const valid = initialColor && initialColor.startsWith('#') ? initialColor : '#5185A6';
            setCurrentColor(valid);
            setHsv(hexToHsv(valid));
        }
    }, [isOpen, initialColor]);

    const isDraggingHue = useRef(false);
    const isDraggingSV = useRef(false);
    const hueRingRef = useRef<HTMLDivElement>(null);
    const svSquareRef = useRef<HTMLDivElement>(null);

    const updateHueFromCoords = (clientX: number, clientY: number) => {
        if (!hueRingRef.current) return;
        const rect = hueRingRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = clientX - cx;
        const dy = clientY - cy;
        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        let deg = (angle + 90 + 360) % 360;
        setHsv(prev => {
            const next = { ...prev, h: deg };
            const hex = hsvToHex(next.h, next.s, next.v);
            setCurrentColor(hex);
            onColorSelect(hex);
            return next;
        });
    };

    const updateSVFromCoords = (clientX: number, clientY: number) => {
        if (!svSquareRef.current) return;
        const rect = svSquareRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
        const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
        const s = (x / rect.width) * 100;
        const v = (1 - (y / rect.height)) * 100;
        setHsv(prev => {
            const next = { ...prev, s, v };
            const hex = hsvToHex(next.h, next.s, next.v);
            setCurrentColor(hex);
            onColorSelect(hex);
            return next;
        });
    };

    useEffect(() => {
        const handleMove = (e: MouseEvent | TouchEvent) => {
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            if (isDraggingHue.current) updateHueFromCoords(clientX, clientY);
            if (isDraggingSV.current) updateSVFromCoords(clientX, clientY);
        };
        const handleUp = () => {
            isDraggingHue.current = false;
            isDraggingSV.current = false;
        };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchmove', handleMove);
        window.addEventListener('touchend', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleUp);
        };
    }, []);

    if (!isOpen) return null;

    const hueRadius = 78;
    const angleRad = ((hsv.h - 90) * Math.PI) / 180;
    const hueX = Math.cos(angleRad) * hueRadius;
    const hueY = Math.sin(angleRad) * hueRadius;
    const svX = (hsv.s / 100) * 80;
    const svY = (1 - hsv.v / 100) * 80;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs select-none animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl p-6 shadow-2xl border border-gray-100 flex flex-col items-center gap-4 w-72 max-w-[90vw] relative animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between w-full pb-2 border-b border-gray-100">
                    <span className="text-xs font-bold text-gray-800 tracking-wide uppercase">{title}</span>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="relative w-48 h-48 flex items-center justify-center my-1">
                    <div 
                        ref={hueRingRef}
                        onMouseDown={(e) => { isDraggingHue.current = true; updateHueFromCoords(e.clientX, e.clientY); }}
                        onTouchStart={(e) => { isDraggingHue.current = true; updateHueFromCoords(e.touches[0].clientX, e.touches[0].clientY); }}
                        className="absolute inset-0 rounded-full cursor-crosshair shadow-xs border border-gray-100"
                        style={{ 
                            background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
                            mask: 'radial-gradient(transparent 58px, black 59px)',
                            WebkitMask: 'radial-gradient(transparent 58px, black 59px)'
                        }}
                    />
                    <div 
                        className="absolute w-5 h-5 bg-white border-2 border-white rounded-full shadow-md pointer-events-none z-10"
                        style={{ 
                            top: `calc(50% + ${hueY}px - 10px)`, 
                            left: `calc(50% + ${hueX}px - 10px)`,
                            boxShadow: '0 0 4px rgba(0,0,0,0.3)'
                        }}
                    />

                    <div 
                        ref={svSquareRef}
                        onMouseDown={(e) => { isDraggingSV.current = true; updateSVFromCoords(e.clientX, e.clientY); }}
                        onTouchStart={(e) => { isDraggingSV.current = true; updateSVFromCoords(e.touches[0].clientX, e.touches[0].clientY); }}
                        className="absolute w-20 h-20 shadow-inner cursor-crosshair z-0 rounded-lg overflow-hidden border border-black/10"
                        style={{ backgroundColor: `hsl(${hsv.h}, 100%, 50%)` }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                        <div 
                            className="absolute w-3 h-3 bg-transparent border-2 border-white rounded-full shadow-xs pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
                            style={{ top: `${svY}px`, left: `${svX}px`, boxShadow: '0 0 2px rgba(0,0,0,0.5)' }}
                        />
                    </div>
                </div>

                <div className="w-full space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full border border-gray-200 shadow-xs" style={{ backgroundColor: currentColor }} />
                            <span className="text-xs font-mono font-bold text-gray-700 uppercase">{currentColor}</span>
                        </div>
                        <button
                            onClick={onClose}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs"
                        >
                            <Check size={13} />
                            <span>Listo</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-6 gap-1.5 pt-2 border-t border-gray-100">
                        {MODA_PALETTE.map(c => (
                            <button
                                key={c.color}
                                onClick={() => {
                                    setCurrentColor(c.color);
                                    setHsv(hexToHsv(c.color));
                                    onColorSelect(c.color);
                                }}
                                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 shadow-2xs ${
                                    currentColor.toLowerCase() === c.color.toLowerCase() ? 'border-blue-600 scale-105' : 'border-white'
                                }`}
                                style={{ backgroundColor: c.color }}
                                title={c.name}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

