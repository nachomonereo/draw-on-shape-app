import React, { useState, useEffect } from 'react';
import { SceneObject, Layer, Project } from '../types';
import { Icons } from './IconComponents';
import { ChevronDown } from 'lucide-react';
import { v4 as generateId } from 'uuid';
import { Language, getTranslation } from '../utils/translations';

interface ProjectsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    currentObjects: SceneObject[];
    currentLayers: Layer[];
    onLoadProject: (project: Project) => void;
    onNewProject: () => void;
    onCaptureThumbnail?: () => string;
    language?: Language;
    onLanguageChange?: (lang: Language) => void;
}

const STORAGE_KEY = 'draw_on_shape_projects_v1';

export const ProjectsPanel: React.FC<ProjectsPanelProps> = ({
    isOpen,
    onClose,
    currentObjects,
    currentLayers,
    onLoadProject,
    onNewProject,
    onCaptureThumbnail,
    language = 'es',
    onLanguageChange
}) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [projectName, setProjectName] = useState('');
    const [notification, setNotification] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [showGesturesGuide, setShowGesturesGuide] = useState(false);
    const isEn = language === 'en';

    const t = (key: Parameters<typeof getTranslation>[1], params?: Record<string, string>) => getTranslation(language, key, params);

    useEffect(() => {
        if (isOpen) {
            loadProjectsFromStorage();
        }
    }, [isOpen]);

    const loadProjectsFromStorage = () => {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                const parsed: Project[] = JSON.parse(data);
                setProjects(parsed.sort((a, b) => b.updatedAt - a.updatedAt));
            }
        } catch (e) {
            console.error("Failed to load projects from localStorage", e);
        }
    };

    const saveProjectsToStorage = (updatedList: Project[]) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
            setProjects(updatedList.sort((a, b) => b.updatedAt - a.updatedAt));
        } catch (e) {
            console.error("Failed to save projects to localStorage", e);
        }
    };

    const showToast = (msg: string) => {
        setNotification(msg);
        setTimeout(() => setNotification(null), 3000);
    };

    const handleSaveCurrentProject = () => {
        const defaultName = `${language === 'en' ? 'Project' : 'Proyecto'} ${projects.length + 1}`;
        const nameToUse = projectName.trim() || defaultName;
        let thumbUrl = '';
        if (onCaptureThumbnail) {
            try {
                thumbUrl = onCaptureThumbnail();
            } catch (err) {
                console.warn("Could not capture thumbnail", err);
            }
        }

        const newProject: Project = {
            id: generateId(),
            name: nameToUse,
            updatedAt: Date.now(),
            thumbnail: thumbUrl,
            sceneObjects: currentObjects,
            layers: currentLayers
        };

        const updated = [newProject, ...projects];
        saveProjectsToStorage(updated);
        setProjectName('');
        showToast(t('projectSaved', { name: nameToUse }));
    };

    const handleDeleteProject = (id: string, name: string) => {
        if (window.confirm(t('deleteConfirm', { name }))) {
            const updated = projects.filter(p => p.id !== id);
            saveProjectsToStorage(updated);
            showToast(t('projectDeleted', { name }));
        }
    };

    const handleStartRename = (project: Project) => {
        setEditingId(project.id);
        setEditingName(project.name);
    };

    const handleConfirmRename = (id: string) => {
        if (!editingName.trim()) return;
        const updated = projects.map(p => p.id === id ? { ...p, name: editingName.trim(), updatedAt: Date.now() } : p);
        saveProjectsToStorage(updated);
        setEditingId(null);
        showToast(t('projectRenamed'));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col font-sans select-none overflow-hidden animate-in fade-in duration-200">
            {/* Header Toolbar */}
            <div className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onClose} 
                        className="p-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-full transition-colors"
                        title={t('backToApp')}
                    >
                        <Icons.Close size={22} />
                    </button>
                    <div>
                        <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">{t('savedProjects')}</h1>
                        <p className="text-xs text-gray-500 font-medium">{t('internalStorageDesc')}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Language Switcher */}
                    {onLanguageChange && (
                        <div className="flex items-center bg-gray-100 p-1 rounded-2xl border border-gray-200">
                            <button 
                                type="button"
                                onClick={() => onLanguageChange('es')}
                                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${language === 'es' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
                                title="Español"
                            >
                                ES
                            </button>
                            <button 
                                type="button"
                                onClick={() => onLanguageChange('en')}
                                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${language === 'en' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
                                title="English"
                            >
                                EN
                            </button>
                        </div>
                    )}

                    {/* Guardar Proyecto Form */}
                    <div className="hidden sm:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl p-1 pr-1.5">
                        <input 
                            type="text"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            placeholder={t('projectNamePlaceholder')}
                            className="bg-transparent border-none px-3 py-1.5 text-xs font-medium outline-none w-48 text-gray-800"
                        />
                        <button 
                            onClick={handleSaveCurrentProject}
                            className="bg-moda-3 text-white px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-blue-700 transition-colors"
                        >
                            <Icons.Save size={14} />
                            <span>{t('saveCurrent')}</span>
                        </button>
                    </div>

                    {/* Nuevo Proyecto Button */}
                    <button 
                        onClick={() => {
                            if (window.confirm(t('newProjectConfirm'))) {
                                onNewProject();
                                onClose();
                            }
                        }}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                        <Icons.Add size={16} />
                        <span>{t('newProject')}</span>
                    </button>
                </div>
            </div>

            {/* Notification Bar */}
            {notification && (
                <div className="bg-green-500 text-white text-xs font-bold px-6 py-2.5 text-center shadow-inner animate-in slide-in-from-top-2">
                    {notification}
                </div>
            )}

            {/* Mobile Save Form */}
            <div className="sm:hidden p-4 border-b border-gray-100 bg-gray-50 flex gap-2">
                <input 
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder={t('projectNamePlaceholder')}
                    className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium outline-none"
                />
                <button 
                    onClick={handleSaveCurrentProject}
                    className="bg-moda-3 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1"
                >
                    <Icons.Save size={14} />
                    <span>{t('save')}</span>
                </button>
            </div>

            {/* Projects Gallery */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-white">
                <div className="max-w-6xl mx-auto space-y-6">
                    {/* Collapsible Gestures & Controls Info Menu */}
                    <div className="bg-gray-50/80 border border-gray-200 rounded-3xl overflow-hidden transition-all shadow-xs">
                        <button 
                            type="button"
                            onClick={() => setShowGesturesGuide(!showGesturesGuide)}
                            className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-gray-100/70 transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-2xl bg-blue-50 text-moda-3 flex items-center justify-center font-extrabold shadow-xs">
                                    <Icons.Info size={18} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xs sm:text-sm font-extrabold text-gray-900">
                                            {isEn ? 'Gestures & Shortcuts Guide' : 'Guía de Gestos y Atajos Táctiles'}
                                        </h3>
                                        <span className="text-[10px] font-bold uppercase bg-blue-100/70 text-blue-700 px-2 py-0.5 rounded-full">
                                            {isEn ? 'Controls' : 'Controles'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-500">
                                        {isEn ? 'Touch controls, stylus, double-tap shortcuts and camera actions' : 'Controles con dedos, lápiz stylus, atajos de doble tap y cámara'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-gray-400">
                                <span className="text-xs font-bold hidden sm:inline text-gray-500">
                                    {showGesturesGuide ? (isEn ? 'Hide Guide' : 'Ocultar') : (isEn ? 'Show Guide' : 'Ver Gestos')}
                                </span>
                                <div className={`p-1.5 rounded-full bg-white border border-gray-200 transition-transform duration-200 ${showGesturesGuide ? 'rotate-180' : 'rotate-0'}`}>
                                    <ChevronDown size={14} className="text-gray-600" />
                                </div>
                            </div>
                        </button>

                        {showGesturesGuide && (
                            <div className="p-5 pt-3 border-t border-gray-200/70 bg-white/60 animate-in fade-in slide-in-from-top-1 duration-150">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                    {/* 1 Finger Double Tap */}
                                    <div className="p-3.5 bg-white rounded-2xl border border-gray-200/90 shadow-xs flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0 border border-amber-100">
                                            👆×2
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-900">
                                                {isEn ? '1-Finger Double Tap' : '1 Dedo: Doble Tap'}
                                            </h4>
                                            <div className="text-[11px] font-bold text-amber-600 mb-0.5">
                                                {isEn ? 'Focus & Align Camera' : 'Enfocar y Alinear Cámara'}
                                            </div>
                                            <p className="text-[11px] text-gray-500 leading-snug">
                                                {isEn 
                                                    ? 'Snaps camera to the nearest view axis (Front, Top, Right) with clean perspective.' 
                                                    : 'Alinea y encuadra la cámara al eje más cercano (Frontal, Superior o Lateral).'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* 2 Fingers Double Tap */}
                                    <div className="p-3.5 bg-white rounded-2xl border border-gray-200/90 shadow-xs flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-100">
                                            ✌️×2
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-900">
                                                {isEn ? '2-Fingers Double Tap' : '2 Dedos: Doble Tap'}
                                            </h4>
                                            <div className="text-[11px] font-bold text-blue-600 mb-0.5">
                                                {isEn ? 'Undo (Ctrl + Z)' : 'Deshacer (Ctrl + Z)'}
                                            </div>
                                            <p className="text-[11px] text-gray-500 leading-snug">
                                                {isEn 
                                                    ? 'Reverts the last drawn stroke, geometry or action (up to 12 steps).' 
                                                    : 'Deshace el último trazo, figura agregada o transformación realizada (hasta 12 pasos).'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* 3 Fingers Double Tap */}
                                    <div className="p-3.5 bg-white rounded-2xl border border-gray-200/90 shadow-xs flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-100">
                                            🖐️×2
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-900">
                                                {isEn ? '3-Fingers Double Tap' : '3 Dedos: Doble Tap'}
                                            </h4>
                                            <div className="text-[11px] font-bold text-emerald-600 mb-0.5">
                                                {isEn ? 'Redo (Ctrl + Y)' : 'Rehacer (Ctrl + Y)'}
                                            </div>
                                            <p className="text-[11px] text-gray-500 leading-snug">
                                                {isEn 
                                                    ? 'Reapplies the previous undone step.' 
                                                    : 'Vuelve a aplicar la última acción deshecha del historial.'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* 3 Fingers Drag */}
                                    <div className="p-3.5 bg-white rounded-2xl border border-gray-200/90 shadow-xs flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0 border border-purple-100">
                                            🖐️↕️
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-900">
                                                {isEn ? '3-Fingers Vertical Drag' : '3 Dedos: Deslizar Vertical'}
                                            </h4>
                                            <div className="text-[11px] font-bold text-purple-600 mb-0.5">
                                                {isEn ? 'Camera Lens / FOV' : 'Lente de Cámara y Fuga'}
                                            </div>
                                            <p className="text-[11px] text-gray-500 leading-snug">
                                                {isEn 
                                                    ? 'Slide 3 fingers up or down to adjust focal length/perspective.' 
                                                    : 'Desliza 3 dedos hacia arriba o abajo para regular la fuga/focal de la lente.'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Finger Orbiting */}
                                    <div className="p-3.5 bg-white rounded-2xl border border-gray-200/90 shadow-xs flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-xs shrink-0 border border-gray-200">
                                            👆🔄
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-900">
                                                {isEn ? '1 or 2 Fingers Drag' : 'Dedos: Deslizar en Pantalla'}
                                            </h4>
                                            <div className="text-[11px] font-bold text-gray-600 mb-0.5">
                                                {isEn ? 'Orbit 3D Scene' : 'Orbitar y Rotar Cámara'}
                                            </div>
                                            <p className="text-[11px] text-gray-500 leading-snug">
                                                {isEn 
                                                    ? 'Orbit freely with fingers or mouse. Stylus is locked to drawing.' 
                                                    : 'Orbita libremente con los dedos o ratón. El lápiz queda aislado del giro.'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Stylus / Pen */}
                                    <div className="p-3.5 bg-white rounded-2xl border border-gray-200/90 shadow-xs flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold text-xs shrink-0 border border-rose-100">
                                            ✏️✨
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-900">
                                                {isEn ? 'Stylus / Pen' : 'Lápiz Óptico (Stylus)'}
                                            </h4>
                                            <div className="text-[11px] font-bold text-rose-600 mb-0.5">
                                                {isEn ? 'Draw & Transform Only' : 'Dibujar, Seleccionar y Mover'}
                                            </div>
                                            <p className="text-[11px] text-gray-500 leading-snug">
                                                {isEn 
                                                    ? 'Draws directly on shapes or space, selects, and moves gizmo without orbiting.' 
                                                    : 'Dibuja con precisión, selecciona geometrías o usa el gumball sin mover la cámara.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                            {t('myProjects')} ({projects.length})
                        </h2>
                    </div>

                    {projects.length === 0 ? (
                        <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-3xl space-y-4 max-w-md mx-auto">
                            <div className="w-16 h-16 bg-blue-50 text-moda-3 rounded-full flex items-center justify-center mx-auto">
                                <Icons.Box size={32} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-gray-800">{t('noProjectsTitle')}</h3>
                                <p className="text-xs text-gray-400 mt-1">{t('noProjectsDesc')}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {projects.map((project) => (
                                <div 
                                    key={project.id}
                                    className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group"
                                >
                                    {/* Thumbnail Image */}
                                    <div 
                                        onClick={() => {
                                            onLoadProject(project);
                                            onClose();
                                        }}
                                        className="relative h-44 bg-gray-50 border-b border-gray-100 overflow-hidden cursor-pointer flex items-center justify-center"
                                    >
                                        {project.thumbnail ? (
                                            <img 
                                                src={project.thumbnail} 
                                                alt={project.name} 
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center gap-2 text-gray-300 group-hover:text-moda-3 transition-colors">
                                                <Icons.Box size={40} />
                                                <span className="text-[10px] font-mono uppercase">Preview 3D</span>
                                            </div>
                                        )}

                                        {/* Hover Overlay Button */}
                                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="bg-white text-gray-900 px-4 py-2 rounded-full font-bold text-xs shadow-lg flex items-center gap-1.5 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                                <Icons.Upload size={14} />
                                                <span>{t('openProject')}</span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* Card Info */}
                                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                        <div>
                                            {editingId === project.id ? (
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="text"
                                                        value={editingName}
                                                        onChange={(e) => setEditingName(e.target.value)}
                                                        className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold text-gray-900 outline-none"
                                                        autoFocus
                                                        onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmRename(project.id); }}
                                                    />
                                                    <button 
                                                        onClick={() => handleConfirmRename(project.id)}
                                                        className="text-xs font-bold text-green-600 hover:bg-green-50 px-2 py-1 rounded"
                                                    >
                                                        OK
                                                    </button>
                                                </div>
                                            ) : (
                                                <h3 
                                                    onClick={() => handleStartRename(project)}
                                                    className="font-bold text-gray-900 text-sm truncate hover:text-moda-3 cursor-pointer transition-colors"
                                                    title="Haz clic para renombrar"
                                                >
                                                    {project.name}
                                                </h3>
                                            )}

                                            <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1 font-medium">
                                                <span>{new Date(project.updatedAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                                <span className="bg-gray-100 px-2 py-0.5 rounded-full text-gray-600 font-mono text-[10px]">
                                                    {project.sceneObjects.length} obj
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                            <button 
                                                onClick={() => {
                                                    onLoadProject(project);
                                                    onClose();
                                                }}
                                                className="bg-moda-3 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs hover:bg-blue-700 transition-colors flex items-center gap-1 shadow-sm"
                                            >
                                                <Icons.Upload size={13} />
                                                <span>{t('open')}</span>
                                            </button>

                                            <div className="flex items-center gap-1">
                                                <button 
                                                    onClick={() => handleStartRename(project)}
                                                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                                                    title={t('rename')}
                                                >
                                                    <Icons.DrawOnShape size={14} />
                                                </button>

                                                <button 
                                                    onClick={() => handleDeleteProject(project.id, project.name)}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                                    title={t('delete')}
                                                >
                                                    <Icons.Delete size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
