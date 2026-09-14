import React, { useState, useRef, useEffect } from 'react';
import { X, Check, Pipette } from 'lucide-react';
import iro from '@jaames/iro';
import { Language } from '../utils/translations';

interface ColorPickerModalProps {
    isOpen: boolean;
    initialColor?: string;
    color?: string;
    title?: string;
    language?: Language;
    onClose: () => void;
    onColorSelect?: (color: string) => void;
    onChange?: (color: string) => void;
    onActivatePipette?: () => void;
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

export const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
    isOpen,
    initialColor,
    color,
    title,
    language = 'en',
    onClose,
    onColorSelect,
    onChange,
    onActivatePipette
}) => {
    const defaultColor = color || initialColor || '#5185A6';
    const [currentColor, setCurrentColor] = useState(defaultColor);
    const iroContainerRef = useRef<HTMLDivElement>(null);
    const pickerRef = useRef<any>(null);
    const isSelfChange = useRef<boolean>(false);

    const notifyChange = (hex: string) => {
        if (onColorSelect) onColorSelect(hex);
        if (onChange) onChange(hex);
    };

    // When modal opens or initialColor changes, sync currentColor
    useEffect(() => {
        if (isOpen) {
            const chosen = color || initialColor || '#5185A6';
            const valid = chosen.startsWith('#') ? chosen : '#5185A6';
            setCurrentColor(valid);
        }
    }, [isOpen, color, initialColor]);

    // Mount iro.js ColorPicker when modal opens
    useEffect(() => {
        if (!isOpen || !iroContainerRef.current) return;

        // Clean previous DOM content if any
        iroContainerRef.current.innerHTML = '';

        const chosen = currentColor || color || initialColor || '#5185A6';
        const startColor = chosen.startsWith('#') ? chosen : '#5185A6';

        try {
            const picker = new (iro.ColorPicker as any)(iroContainerRef.current, {
                width: 200,
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
                const hex = c.hexString;
                setCurrentColor(hex);
                notifyChange(hex);
                setTimeout(() => {
                    isSelfChange.current = false;
                }, 50);
            });

            pickerRef.current = picker;
        } catch (err) {
            console.error("Failed to initialize iro.ColorPicker:", err);
        }

        return () => {
            if (iroContainerRef.current) {
                iroContainerRef.current.innerHTML = '';
            }
            pickerRef.current = null;
        };
    }, [isOpen]);

    // Update picker color when external color changes (e.g. from palette click)
    useEffect(() => {
        if (pickerRef.current && !isSelfChange.current && currentColor) {
            try {
                if (pickerRef.current.color && pickerRef.current.color.hexString.toLowerCase() !== currentColor.toLowerCase()) {
                    pickerRef.current.color.set(currentColor);
                }
            } catch (_) {}
        }
    }, [currentColor]);

    const handleSelectPaletteColor = (paletteColor: string) => {
        setCurrentColor(paletteColor);
        if (pickerRef.current) {
            try {
                if (pickerRef.current.color && pickerRef.current.color.hexString.toLowerCase() !== paletteColor.toLowerCase()) {
                    pickerRef.current.color.set(paletteColor);
                }
            } catch (_) {}
        }
        notifyChange(paletteColor);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs select-none animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl p-5 shadow-2xl border border-gray-100 flex flex-col items-center gap-3 w-72 max-w-[92vw] relative animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between w-full pb-2 border-b border-gray-100">
                    <span className="text-xs font-bold text-gray-800 tracking-wide uppercase">
                        {title || (language === 'en' ? 'Color Picker' : 'Selector de Color')}
                    </span>
                    <div className="flex items-center gap-1">
                        {onActivatePipette && (
                            <button 
                                type="button"
                                onClick={() => {
                                    onClose();
                                    onActivatePipette();
                                }}
                                className="p-1.5 rounded-full text-moda-3 hover:bg-blue-50 transition-colors"
                                title={language === 'en' ? "Eyedropper: Pick color from 3D scene" : "Pipeta: Copiar color de la escena"}
                            >
                                <Pipette size={15} />
                            </button>
                        )}
                        <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* iro.js Color Wheel Mount Container */}
                <div className="flex justify-center items-center my-1">
                    <div ref={iroContainerRef} className="iro-picker-container" />
                </div>

                {/* Bottom Color Bar & Done Button */}
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
                            <span>{language === 'en' ? 'Done' : 'Listo'}</span>
                        </button>
                    </div>

                    {/* Moda Palette Swatches */}
                    <div className="grid grid-cols-6 gap-1.5 pt-2 border-t border-gray-100">
                        {MODA_PALETTE.map(c => (
                            <button
                                key={c.color}
                                onClick={() => handleSelectPaletteColor(c.color)}
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
