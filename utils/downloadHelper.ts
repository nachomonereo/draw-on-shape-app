import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface NativeFileSaverPlugin {
    appendChunk(options: { chunk: string; isFirst: boolean }): Promise<{ success: boolean }>;
    startSaveDialog(options: { fileName: string; mimeType: string }): Promise<{ success: boolean; uri?: string; cancelled?: boolean }>;
    saveFile(options: { fileName: string; base64Data: string; mimeType: string }): Promise<{ success: boolean; uri?: string; cancelled?: boolean }>;
}

const NativeFileSaver = registerPlugin<NativeFileSaverPlugin>('NativeFileSaver');

export async function saveOrShareFile(
    blobOrDataUrl: Blob | string,
    filename: string,
    mimeType: string
): Promise<{ success: boolean; path?: string; cancelled?: boolean }> {
    // 1. Native Capacitor (Android device / tablet)
    if (Capacitor.isNativePlatform()) {
        try {
            let base64Data: string;
            if (typeof blobOrDataUrl === 'string') {
                base64Data = blobOrDataUrl.includes(',') ? blobOrDataUrl.split(',')[1] : blobOrDataUrl;
            } else {
                base64Data = await blobToBase64(blobOrDataUrl);
            }
            base64Data = base64Data.trim().replace(/\s+/g, '');

            // PRIMARY: Android Storage Access Framework (SAF) folder picker with safe chunking
            // Chunk size: 256KB to avoid Android Binder TransactionTooLargeException
            try {
                const CHUNK_SIZE = 256 * 1024;
                for (let i = 0; i < base64Data.length; i += CHUNK_SIZE) {
                    const chunk = base64Data.slice(i, i + CHUNK_SIZE);
                    await NativeFileSaver.appendChunk({ chunk, isFirst: i === 0 });
                }

                const res = await NativeFileSaver.startSaveDialog({
                    fileName: filename,
                    mimeType
                });

                if (res.cancelled) {
                    return { success: false, cancelled: true };
                }

                if (res.success && res.uri) {
                    return { success: true, path: res.uri };
                }
            } catch (pluginErr) {
                console.warn("NativeFileSaver chunked save failed, falling back to Share sheet:", pluginErr);
            }

            // FALLBACK 1: Save to Cache directory and open Share sheet with file attachment
            try {
                const savedFile = await Filesystem.writeFile({
                    path: filename,
                    data: base64Data,
                    directory: Directory.Cache,
                    recursive: true
                });

                await Share.share({
                    title: filename,
                    files: [savedFile.uri],
                    dialogTitle: `Guardar ${filename}`
                });

                return { success: true, path: savedFile.uri };
            } catch (shareErr) {
                console.warn("Share sheet fallback failed:", shareErr);
                throw new Error("No se pudo guardar ni compartir el archivo en este dispositivo: " + (shareErr as Error).message);
            }
        } catch (e) {
            console.error("Capacitor save/share error:", e);
            throw e;
        }
    }

    // 2. Web with File System Access API (allows folder + name picker dialog in Chromium browsers)
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
        try {
            const ext = filename.split('.').pop() || '';
            const fileHandle = await (window as any).showSaveFilePicker({
                suggestedName: filename,
                types: [
                    {
                        description: ext ? `${ext.toUpperCase()} File` : 'Export File',
                        accept: { [mimeType]: ext ? [`.${ext}`] : [] }
                    }
                ]
            });
            const writableStream = await fileHandle.createWritable();
            if (typeof blobOrDataUrl === 'string') {
                const blob = dataUrlToBlob(blobOrDataUrl);
                await writableStream.write(blob);
            } else {
                await writableStream.write(blobOrDataUrl);
            }
            await writableStream.close();
            return { success: true };
        } catch (pickerErr: any) {
            if (pickerErr.name === 'AbortError') {
                // User cancelled the file picker dialog
                return { success: false, cancelled: true };
            }
            console.warn("showSaveFilePicker failed, falling back to download link:", pickerErr);
        }
    }

    // 3. Fallback standard browser download link
    const blob = typeof blobOrDataUrl === 'string' ? dataUrlToBlob(blobOrDataUrl) : blobOrDataUrl;
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 2000);

    return { success: true };
}

function dataUrlToBlob(dataUrlOrBase64: string): Blob {
    if (!dataUrlOrBase64.startsWith('data:')) {
        const u8arr = Uint8Array.from(atob(dataUrlOrBase64), c => c.charCodeAt(0));
        return new Blob([u8arr]);
    }
    const arr = dataUrlOrBase64.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
    const bstr = atob(arr[1] || arr[0]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const res = reader.result as string;
            const base64 = res.includes(',') ? res.split(',')[1] : base64;
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
