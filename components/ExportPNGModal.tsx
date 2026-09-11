import React, { useState, useEffect } from 'react';
import { Icons } from './IconComponents';
import { Language } from '../utils/translations';

interface ExportPNGModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: (options: {
        multiplier: number;
        transparent: boolean;
        format: 'image/png' | 'image/jpeg';
        quality: number;
        filename?: string;
    }) => void;
    defaultFilename: string;
    language?: Language;
}

export const ExportPNGModal: React.FC<ExportPNGModalProps> = ({
    isOpen,
    onClose,
    onExport,
    defaultFilename,
    language = 'es'
}) => {
    const isEn = language === 'en';
    const [scaleMultiplier, setScaleMultiplier] = useState<number>(1);
    const [transparentBg, setTransparentBg] = useState<boolean>(false);
    const [format, setFormat] = useState<'image/png' | 'image/jpeg'>('image/png');
    const [filename, setFilename] = useState<string>('project-capture');

    useEffect(() => {
        if (isOpen) {
            const base = (defaultFilename || 'project-capture').replace(/\.[^/.]+$/, '').trim();
            setFilename(base || 'project-capture');
        }
    }, [isOpen, defaultFilename]);

    if (!isOpen) return null;

    const baseWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const baseHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const targetWidth = Math.round(baseWidth * scaleMultiplier);
    const targetHeight = Math.round(baseHeight * scaleMultiplier);

    const handleConfirm = () => {
        const cleanName = filename.trim().replace(/[^a-zA-Z0-9_\- ]/g, '') || 'drawing-export';
        const ext = format === 'image/png' ? 'png' : 'jpg';
        onExport({
            multiplier: scaleMultiplier,
            transparent: transparentBg && format === 'image/png',
            format,
            quality: 0.95,
            filename: `${cleanName}.${ext}`
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
            <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-50 text-moda-3 rounded-xl">
                            <Icons.Export size={18} />
                        </div>
                        <div>
                            <h2 className="font-extrabold text-base text-gray-900">{isEn ? 'Export Image' : 'Exportar Imagen'}</h2>
                            <p className="text-xs text-gray-500">{isEn ? 'Save screenshot in high resolution' : 'Guardar captura de pantalla en alta resolución'}</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <Icons.Close size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    {/* File Name Input */}
                    <div>
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide block mb-1.5">
                            {isEn ? 'File Name' : 'Nombre del Archivo'}
                        </label>
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 focus-within:border-moda-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                            <input 
                                type="text" 
                                value={filename} 
                                onChange={(e) => setFilename(e.target.value)} 
                                placeholder={isEn ? "Enter file name..." : "Nombre del archivo..."}
                                className="w-full bg-transparent text-xs font-semibold text-gray-800 outline-none"
                            />
                            <span className="text-xs font-mono font-bold text-gray-400 shrink-0">
                                .{format === 'image/png' ? 'png' : 'jpg'}
                            </span>
                        </div>
                    </div>

                    {/* Resolution / Scale Multiplier */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                                {isEn ? 'Quality / Size' : 'Calidad / Tamaño'}
                            </label>
                            <span className="text-xs font-mono font-bold text-moda-3 bg-blue-50 px-2 py-0.5 rounded-full">
                                {Math.round(scaleMultiplier * 100)}% ({targetWidth} × {targetHeight} px)
                            </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { mult: 1, label: '100%', desc: isEn ? 'Screen' : 'Pantalla' },
                                { mult: 2, label: '200%', desc: 'HD 2X' },
                                { mult: 3, label: '300%', desc: 'QHD 3X' },
                                { mult: 4, label: '400%', desc: 'Ultra 4X' }
                            ].map(opt => (
                                <button
                                    key={opt.mult}
                                    type="button"
                                    onClick={() => setScaleMultiplier(opt.mult)}
                                    className={`p-2.5 rounded-2xl border flex flex-col items-center justify-center transition-all ${
                                        scaleMultiplier === opt.mult
                                            ? 'border-moda-3 bg-blue-50/70 text-moda-3 shadow-sm font-bold'
                                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                    }`}
                                >
                                    <span className="text-sm">{opt.label}</span>
                                    <span className="text-[10px] opacity-75">{opt.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Format Selection */}
                    <div>
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide block mb-2">
                            {isEn ? 'Image Format' : 'Formato de Imagen'}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setFormat('image/png')}
                                className={`p-2.5 rounded-2xl border text-xs font-bold transition-all ${
                                    format === 'image/png'
                                        ? 'border-moda-3 bg-blue-50/70 text-moda-3 shadow-sm'
                                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                }`}
                            >
                                PNG {isEn ? '(Lossless)' : '(Sin pérdidas)'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setFormat('image/jpeg');
                                    setTransparentBg(false);
                                }}
                                className={`p-2.5 rounded-2xl border text-xs font-bold transition-all ${
                                    format === 'image/jpeg'
                                        ? 'border-moda-3 bg-blue-50/70 text-moda-3 shadow-sm'
                                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                }`}
                            >
                                JPEG {isEn ? '(Compressed)' : '(Comprimido)'}
                            </button>
                        </div>
                    </div>

                    {/* Transparent Background Toggle (PNG only) */}
                    {format === 'image/png' && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                            <div>
                                <div className="text-xs font-bold text-gray-800">{isEn ? 'Transparent Background' : 'Fondo Transparente'}</div>
                                <div className="text-[11px] text-gray-500">{isEn ? 'Hide white background and keep alpha channel' : 'Ocultar el fondo blanco y dejar canal alfa'}</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setTransparentBg(!transparentBg)}
                                className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                                    transparentBg ? 'bg-moda-3' : 'bg-gray-300'
                                }`}
                            >
                                <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                                    transparentBg ? 'translate-x-5' : 'translate-x-0'
                                }`} />
                            </button>
                        </div>
                    )}

                    {/* File info notice */}
                    <div className="text-[11px] text-gray-400 bg-gray-50/80 p-2.5 rounded-xl border border-gray-100 flex items-center gap-2">
                        <Icons.Info size={14} className="text-gray-400 shrink-0" />
                        <span>{isEn ? 'Destination folder and name can be chosen directly upon saving.' : 'Podrás elegir la carpeta de destino y el nombre al guardar el archivo.'}</span>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                    >
                        {isEn ? 'Cancel' : 'Cancelar'}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="px-5 py-2 bg-moda-3 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95"
                    >
                        <Icons.Export size={14} />
                        <span>{isEn ? 'Save / Export' : 'Guardar Imagen'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};