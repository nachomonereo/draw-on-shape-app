import { Project, SceneComponent } from '../types';

const DB_NAME = 'DrawOnShapeDB';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_COMPONENTS = 'components';

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
            reject(new Error('IndexedDB not supported'));
            return;
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
                db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_COMPONENTS)) {
                db.createObjectStore(STORE_COMPONENTS, { keyPath: 'id' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function saveProjectToDB(project: Project): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_PROJECTS, 'readwrite');
            const store = tx.objectStore(STORE_PROJECTS);
            const req = store.put(project);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.warn('saveProjectToDB failed, will rely on localStorage fallback:', e);
    }
}

export async function getAllProjectsFromDB(): Promise<Project[]> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_PROJECTS, 'readonly');
            const store = tx.objectStore(STORE_PROJECTS);
            const req = store.getAll();
            req.onsuccess = () => {
                const list = (req.result as Project[]) || [];
                list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                resolve(list);
            };
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.warn('getAllProjectsFromDB failed, fallback to localStorage:', e);
        return [];
    }
}

export async function deleteProjectFromDB(id: string): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_PROJECTS, 'readwrite');
            const store = tx.objectStore(STORE_PROJECTS);
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.warn('deleteProjectFromDB failed:', e);
    }
}

export async function saveAllComponentsToDB(components: SceneComponent[]): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_COMPONENTS, 'readwrite');
            const store = tx.objectStore(STORE_COMPONENTS);
            store.clear();
            for (const comp of components) {
                store.put(comp);
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.warn('saveAllComponentsToDB failed:', e);
    }
}

export async function getAllComponentsFromDB(): Promise<SceneComponent[]> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_COMPONENTS, 'readonly');
            const store = tx.objectStore(STORE_COMPONENTS);
            const req = store.getAll();
            req.onsuccess = () => {
                const list = (req.result as SceneComponent[]) || [];
                list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                resolve(list);
            };
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.warn('getAllComponentsFromDB failed:', e);
        return [];
    }
}
