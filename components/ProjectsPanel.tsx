import React, { useState, useEffect, useRef } from 'react';
import { SceneObject, Layer, Project, SceneComponent } from '../types';
import { Icons } from './IconComponents';
import { ChevronDown, Package, Library, Upload, Plus, Download, Trash2, FolderPlus, Hand, Undo2, RotateCw, PenTool, Eye, SlidersHorizontal } from 'lucide-react';
import { v4 as generateId } from 'uuid';
import { Language, getTranslation } from '../utils/translations';
import { saveOrShareFile } from '../utils/downloadHelper';

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
    
    // Component Library Props
    components?: SceneComponent[];
    onInsertComponent?: (comp: SceneComponent) => void;
    onDeleteComponent?: (id: string) => void;
    onExportComponent?: (comp: SceneComponent) => void;
    onImportComponent?: (file: File) => void;
    onSaveSelectionAsComponent?: () => void;
    selectedCount?: number;
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
    onLanguageChange,
    components = [],
    onInsertComponent,
    onDeleteComponent,
    onExportComponent,
    onImportComponent,
    onSaveSelectionAsComponent,
    selectedCount = 0
}) => {
    const [panelTab, setPanelTab] = useState<'projects' | 'components'>('projects');
    const [projects, setProjects] = useState<Project[]>([]);
    const [projectName, setProjectName] = useState('');
    const [notification, setNotification] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [showGesturesGuide, setShowGesturesGuide] = useState(false);
    const componentFileInputRef = useRef<HTMLInputElement>(null);
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

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && onImportComponent) {
            onImportComponent(file);
            showToast(isEn ? `User Object imported: ${file.name}` : `User Object importado: ${file.name}`);
        }
        if (e.target) e.target.value = '';
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col font-sans select-none overflow-hidden animate-in fade-in duration-200">
            {/* Header Toolbar */}
            <div className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onClose} 
                        className="p-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-full transition-colors"
                        title={t('backToApp')}
                    >
                        <Icons.Close size={22} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">
                                {panelTab === 'projects' ? t('savedProjects') : (isEn ? 'User Objects Library' : 'Biblioteca de User Objects')}
                            </h1>
                        </div>
                        <p className="text-xs text-gray-500 font-medium">
                            {panelTab === 'projects' 
                                ? t('internalStorageDesc') 
                                : (isEn ? 'Reusable external 3D User Objects (chairs, tables, fixtures) across all projects' : 'User Objects 3D reutilizables entre múltiples proyectos')}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Main Section Switcher */}
                    <div className="flex items-center bg-gray-100 p-1 rounded-2xl border border-gray-200">
                        <button
                            onClick={() => setPanelTab('projects')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                panelTab === 'projects' 
                                    ? 'bg-white shadow-xs text-blue-600' 
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <Icons.Box size={14} />
                            <span>{isEn ? 'Projects' : 'Proyectos'}</span>
                        </button>
                        <button
                            onClick={() => setPanelTab('components')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                panelTab === 'components' 
                                    ? 'bg-white shadow-xs text-indigo-600' 
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <Package size={14} />
                            <span>User Objects</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-600 font-mono">
                                {components.length}
                            </span>
                        </button>
                    </div>

                    {/* Language Switcher */}
                    {onLanguageChange && (
                        <div className="flex items-center bg-gray-100 p-1 rounded-2xl border border-gray-200">
                            <button 
                                type="button"
                                onClick={() => onLanguageChange('es')}
                                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${language === 'es' ? 'bg-white shadow-xs text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
                                title="Español"
                            >
                                ES
                            </button>
                            <button 
                                type="button"
                                onClick={() => onLanguageChange('en')}
                                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${language === 'en' ? 'bg-white shadow-xs text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
                                title="English"
                            >
                                EN
                            </button>
                        </div>
                    )}

                    {panelTab === 'projects' ? (
                        <>
                            {/* Guardar Proyecto Form */}
                            <div className="hidden sm:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl p-1 pr-1.5">
                                <input 
                                    type="text"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    placeholder={t('projectNamePlaceholder')}
                                    className="bg-transparent border-none px-3 py-1.5 text-xs font-medium outline-none w-44 text-gray-800"
                                />
                                <button 
                                    onClick={handleSaveCurrentProject}
                                    className="bg-moda-3 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-blue-700 transition-colors"
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
                                className="bg-yellow-500 hover:bg-yellow-600 text-white px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                            >
                                <Icons.Add size={15} />
                                <span>{t('newProject')}</span>
                            </button>
                        </>
                    ) : (
                        <div className="flex items-center gap-2">
                            {/* Guardar Selección como User Object */}
                            <button
                                onClick={() => {
                                    if (onSaveSelectionAsComponent) {
                                        onSaveSelectionAsComponent();
                                    }
                                }}
                                disabled={selectedCount === 0}
                                className={`px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                                    selectedCount > 0 
                                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                }`}
                                title={selectedCount > 0 ? (isEn ? `Save selection (${selectedCount} obj) as User Object` : `Guardar selección (${selectedCount} obj) como User Object`) : (isEn ? "Select objects in the scene" : "Selecciona objetos en la escena")}
                            >
                                <FolderPlus size={15} />
                                <span>{isEn ? 'Save as User Object' : 'Guardar como User Object'}</span>
                            </button>

                            {/* Importar User Object (.json) */}
                            <input 
                                ref={componentFileInputRef}
                                type="file" 
                                accept=".json" 
                                onChange={handleFileInputChange} 
                                className="hidden" 
                            />
                            <button
                                onClick={() => componentFileInputRef.current?.click()}
                                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-gray-200"
                                title={isEn ? "Import User Object .json file" : "Importar archivo .json de User Object"}
                            >
                                <Upload size={14} />
                                <span>{isEn ? 'Import' : 'Importar .json'}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Notification Bar */}
            {notification && (
                <div className="bg-green-500 text-white text-xs font-bold px-6 py-2.5 text-center shadow-inner animate-in slide-in-from-top-2">
                    {notification}
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                <div className="max-w-7xl mx-auto space-y-6">
                    {panelTab === 'projects' ? (
                        <>
                            {/* Accordion: Guía de Gestos Táctiles */}
                            <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden transition-all">
                                <button 
                                    onClick={() => setShowGesturesGuide(!showGesturesGuide)}
                                    className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-gray-50/80 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm border border-amber-100/80">
                                            <Hand size={16} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider">
                                                    {isEn ? 'Touch Gestures & Controls Guide' : 'Guía de Gestos Táctiles y Controles'}
                                                </h3>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                                    {isEn ? 'Info' : 'Información'}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-gray-500 mt-0.5">
                                                {isEn 
                                                    ? 'Orthographic views, lens fuga, multi-touch orbiting, and stylus' 
                                                    : 'Vistas ortográficas sin perspectiva, distancia focal/fuga, giro con dedos y lápiz'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`text-gray-400 transition-transform duration-200 ${showGesturesGuide ? 'rotate-180' : ''}`}>
                                        <ChevronDown size={18} />
                                    </div>
                                </button>

                                {showGesturesGuide && (
                                    <div className="p-5 pt-3 border-t border-gray-200/70 bg-white/60 animate-in fade-in slide-in-from-top-1 duration-150">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                            {/* 1 Finger Double Tap: Canonical Orthographic Views */}
                                            <div className="p-3.5 bg-white rounded-2xl border border-gray-200/90 shadow-2xs flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0 border border-amber-100">
                                                    <span className="font-mono text-xs font-bold">2×</span>
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-900">
                                                        {isEn ? '1-Finger Double Tap' : '1 Dedo: Doble Tap'}
                                                    </h4>
                                                    <div className="text-[11px] font-bold text-amber-600 mb-0.5">
                                                        {isEn ? 'Orthogonal Views (No Perspective)' : 'Vistas Ortográficas (Sin Perspectiva)'}
                                                    </div>
                                                    <p className="text-[11px] text-gray-500 leading-snug">
                                                        {isEn 
                                                            ? 'Snaps camera to the nearest canonical view (Top, Bottom, Front, Back, Right, Left) in flat orthographic projection.' 
                                                            : 'Alinea la cámara a la vista más cercana (Superior, Inferior, Frontal, Posterior, Derecha, Izquierda) totalmente ortográfica, sin fuga.'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* 3 Fingers Drag: Camera Lens / FOV */}
                                            <div className="p-3.5 bg-white rounded-2xl border border-gray-200/90 shadow-2xs flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0 border border-purple-100">
                                                    <Eye size={16} />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-900">
                                                        {isEn ? '3-Fingers Vertical Drag' : '3 Dedos: Deslizar Vertical'}
                                                    </h4>
                                                    <div className="text-[11px] font-bold text-purple-600 mb-0.5">
                                                        {isEn ? 'Camera Lens / Fuga (FOV)' : 'Lente de Cámara y Fuga (FOV)'}
                                                    </div>
                                                    <p className="text-[11px] text-gray-500 leading-snug">
                                                        {isEn 
                                                            ? 'Slide 3 fingers up or down to adjust focal length/perspective (24mm, 50mm, 85mm).' 
                                                            : 'Desliza 3 dedos hacia arriba o abajo para regular la fuga y distancia focal (Gran angular, 50mm, Teleobjetivo).'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* UI Arrow Buttons: Undo / Redo */}
                                            <div className="p-3.5 bg-white rounded-2xl border border-gray-200/90 shadow-2xs flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-100">
                                                    <Undo2 size={16} />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-900">
                                                        {isEn ? 'Screen Undo / Redo Buttons' : 'Deshacer / Rehacer en Pantalla'}
                                                    </h4>
                                                    <div className="text-[11px] font-bold text-blue-600 mb-0.5">
                                                        {isEn ? 'Exclusively via UI Buttons' : 'Exclusivo en Botones de Flechas'}
                                                    </div>
                                                    <p className="text-[11px] text-gray-500 leading-snug">
                                                        {isEn 
                                                            ? 'To prevent accidental touch triggers, undo & redo are controlled strictly through the interface arrow buttons (up to 20 steps).' 
                                                            : 'Para evitar toques accidentales de los dedos, deshacer y rehacer se activan exclusivamente desde las flechas de la interfaz (máximo 20 pasos).'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Finger Orbiting */}
                                            <div className="p-3.5 bg-white rounded-2xl border border-gray-200/90 shadow-2xs flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-xs shrink-0 border border-gray-200">
                                                    <RotateCw size={16} />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-900">
                                                        {isEn ? '1 or 2 Fingers Drag' : 'Dedos: Deslizar en Pantalla'}
                                                    </h4>
                                                    <div className="text-[11px] font-bold text-gray-600 mb-0.5">
                                                        {isEn ? 'Orbit 3D Scene' : 'Orbitar y Rotar Cámara 3D'}
                                                    </div>
                                                    <p className="text-[11px] text-gray-500 leading-snug">
                                                        {isEn 
                                                            ? 'Orbit freely with fingers or mouse. Orbiting away from an orthogonal view smoothly restores 3D perspective.' 
                                                            : 'Orbita libremente con los dedos o ratón. Al rotar fuera de una vista ortográfica regresa fluidamente a la perspectiva 3D.'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Stylus / Pen */}
                                            <div className="p-3.5 bg-white rounded-2xl border border-gray-200/90 shadow-2xs flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold text-xs shrink-0 border border-rose-100">
                                                    <PenTool size={16} />
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
                                                            ? 'Draws directly on shapes or space, selects, and moves gizmo without moving the camera.' 
                                                            : 'Dibuja con precisión, selecciona geometrías o usa el gumball sin mover la cámara.'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Projects Grid Header */}
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
                                            className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-2xs hover:shadow-xl transition-all duration-300 flex flex-col group"
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

                                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <span className="bg-white text-gray-900 px-4 py-2 rounded-full font-bold text-xs shadow-lg flex items-center gap-1.5 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                                        <Upload size={14} />
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
                                                        <span>{new Date(project.updatedAt).toLocaleString(language === 'en' ? 'en-US' : 'es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                                        <span className="bg-gray-100 px-2 py-0.5 rounded-full text-gray-600 font-mono text-[10px]">
                                                            {project.sceneObjects.length} obj
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                                    <button 
                                                        onClick={() => {
                                                            onLoadProject(project);
                                                            onClose();
                                                        }}
                                                        className="bg-moda-3 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs hover:bg-blue-700 transition-colors flex items-center gap-1 shadow-2xs"
                                                    >
                                                        <Upload size={13} />
                                                        <span>{t('open')}</span>
                                                    </button>

                                                    <div className="flex items-center gap-1">
                                                        <button 
                                                            onClick={async () => {
                                                                const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
                                                                const safeName = project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                                                                await saveOrShareFile(blob, `${safeName}.drawonshape.json`, 'application/json');
                                                            }}
                                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                                                            title={isEn ? "Export (.drawonshape.json)" : "Exportar (.drawonshape.json)"}
                                                        >
                                                            <Download size={14} />
                                                        </button>

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
                        </>
                    ) : (
                        /* User Objects Library Grid */
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                                        {isEn ? 'Saved User Objects' : 'User Objects Guardados'} ({components.length})
                                    </h2>
                                </div>
                            </div>

                            {components.length === 0 ? (
                                <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-3xl space-y-4 max-w-md mx-auto">
                                    <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                                        <Package size={32} />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-base font-bold text-gray-800">
                                            {isEn ? 'No User Objects in library' : 'No hay User Objects en la biblioteca'}
                                        </h3>
                                        <p className="text-xs text-gray-400 max-w-sm mx-auto">
                                            {isEn 
                                                ? 'Select a group or objects in your scene (such as a chair, table, or fixture) and save it as a User Object to reuse across any project.' 
                                                : 'Selecciona un grupo o figuras en tu escena (por ejemplo una silla, mesa o lámpara) y guárdalo como User Object para reutilizarlo cuando quieras.'}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                    {components.map((comp) => (
                                        <div 
                                            key={comp.id}
                                            className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-2xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between"
                                        >
                                            <div className="p-5 flex items-start gap-3.5">
                                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-base shrink-0 border border-indigo-100">
                                                    <Package size={22} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-bold text-gray-900 text-sm truncate">
                                                        {comp.name}
                                                    </h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold">
                                                            {comp.objects.length} obj
                                                        </span>
                                                        <span className="text-[11px] text-gray-400">
                                                            {new Date(comp.createdAt).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4 pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                                                <button
                                                    onClick={() => {
                                                        if (onInsertComponent) {
                                                            onInsertComponent(comp);
                                                            onClose();
                                                        }
                                                    }}
                                                    className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                                                    title={isEn ? "Insert this User Object into the current scene" : "Insertar este User Object en la escena actual"}
                                                >
                                                    <Plus size={14} />
                                                    <span>{isEn ? 'Insert User Object' : 'Insertar User Object'}</span>
                                                </button>

                                                {onExportComponent && (
                                                    <button
                                                        onClick={() => onExportComponent(comp)}
                                                        className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                                                        title="Exportar archivo .json"
                                                    >
                                                        <Download size={15} />
                                                    </button>
                                                )}

                                                {onDeleteComponent && (
                                                    <button
                                                        onClick={() => {
                                                            if (window.confirm(isEn ? `Delete User Object "${comp.name}"?` : `¿Eliminar el User Object "${comp.name}"?`)) {
                                                                onDeleteComponent(comp.id);
                                                            }
                                                        }}
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                                        title="Eliminar de la biblioteca"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
