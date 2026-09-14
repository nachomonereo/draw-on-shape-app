export type Language = 'es' | 'en';

export const translations = {
    es: {
        savedProjects: 'Proyectos Guardados',
        internalStorageDesc: 'Memoria Interna • Selecciona un proyecto para abrirlo',
        projectNamePlaceholder: 'Nombre del proyecto...',
        saveCurrent: 'Guardar Actual',
        save: 'Guardar',
        newProject: 'Nuevo Proyecto',
        newProjectConfirm: '¿Crear un nuevo proyecto? Se iniciará un espacio de trabajo limpio.',
        myProjects: 'Mis Proyectos',
        noProjectsTitle: 'No tienes proyectos guardados',
        noProjectsDesc: 'Escribe un nombre arriba y haz clic en "Guardar Actual" para conservar tu diseño 3D.',
        openProject: 'Abrir Proyecto',
        open: 'Abrir',
        rename: 'Renombrar',
        delete: 'Eliminar',
        deleteConfirm: '¿Estás seguro de eliminar el proyecto "{name}"?',
        projectSaved: '¡Proyecto "{name}" guardado en memoria interna!',
        projectDeleted: 'Proyecto "{name}" eliminado.',
        projectRenamed: 'Proyecto renombrado correctamente.',
        backToApp: 'Volver a la aplicación',
        language: 'Idioma',
        exportImage: 'Exportar Imagen (PNG / JPG)',
        exportModalTitle: 'Exportar Imagen 2D',
        exportResolution: 'Resolución de Exportación',
        exportFormat: 'Formato',
        exportTransparent: 'Fondo Transparente',
        exportButton: 'Guardar / Compartir Imagen',
        cancel: 'Cancelar',
        undo: 'Deshacer (Ctrl+Z)',
        redo: 'Rehacer',
        clearScene: 'Limpiar Todo',
        clearSceneConfirm: '¿Estás seguro de borrar toda la escena?',
        brush: 'Pincel',
        eraser: 'Borrador',
        select: 'Seleccionar',
        shapes: 'Formas',
        layers: 'Capas'
    },
    en: {
        savedProjects: 'Saved Projects',
        internalStorageDesc: 'Internal Storage • Select a project to open it',
        projectNamePlaceholder: 'Project name...',
        saveCurrent: 'Save Current',
        save: 'Save',
        newProject: 'New Project',
        newProjectConfirm: 'Create a new project? A clean workspace will be started.',
        myProjects: 'My Projects',
        noProjectsTitle: 'No saved projects',
        noProjectsDesc: 'Type a name above and click "Save Current" to preserve your 3D design.',
        openProject: 'Open Project',
        open: 'Open',
        rename: 'Rename',
        delete: 'Delete',
        deleteConfirm: 'Are you sure you want to delete project "{name}"?',
        projectSaved: 'Project "{name}" saved to internal storage!',
        projectDeleted: 'Project "{name}" deleted.',
        projectRenamed: 'Project renamed successfully.',
        backToApp: 'Back to application',
        language: 'Language',
        exportImage: 'Export Image (PNG / JPG)',
        exportModalTitle: 'Export 2D Image',
        exportResolution: 'Export Resolution',
        exportFormat: 'Format',
        exportTransparent: 'Transparent Background',
        exportButton: 'Save / Share Image',
        cancel: 'Cancel',
        undo: 'Undo (Ctrl+Z)',
        redo: 'Redo',
        clearScene: 'Clear All',
        clearSceneConfirm: 'Are you sure you want to clear the whole scene?',
        brush: 'Brush',
        eraser: 'Eraser',
        select: 'Select',
        shapes: 'Shapes',
        layers: 'Layers'
    }
};

export const getTranslation = (lang: Language, key: keyof typeof translations['en'], params?: Record<string, string>): string => {
    const dict = translations[lang] || translations.en;
    let text = dict[key] || translations.en[key] || key;
    if (params) {
        Object.entries(params).forEach(([k, v]) => {
            text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
        });
    }
    return text;
};
