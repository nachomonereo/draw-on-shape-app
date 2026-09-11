import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface NativeFileSaverPlugin {
    saveFile(options: {
        fileName: string;
        base64Data: string;
        mimeType: string;
    }): Promise<{ success: boolean; uri?: string; cancelled?: boolean }>;
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

            // PRIMARY: Android Storage Access Framework (SAF) folder picker ("Guardar en...")
            try {
                const res = await NativeFileSaver.saveFile({
                    fileName: filename,
                    base64Data,
                    mimeType
                });

                if (res.cancelled) {
                    return { success: false, cancelled: true };
                }

                if (res.success && res.uri) {
                    return { success: true, path: res.uri };
                }
            } catch (pluginErr) {
                console.warn("NativeFileSaver failed, falling back to Share sheet:", pluginErr);
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
            }
        } catch (e) {
            console.error("Capacitor save/share error:", e);
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
                const response = await fetch(blobOrDataUrl);
                const blob = await response.blob();
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
    let url: string;
    let createdUrl = false;
    if (typeof blobOrDataUrl === 'string') {
        url = blobOrDataUrl;
    } else {
        url = URL.createObjectURL(blobOrDataUrl);
        createdUrl = true;
    }

    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        document.body.removeChild(a);
        if (createdUrl) URL.revokeObjectURL(url);
    }, 1500);

    return { success: true };
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const res = reader.result as string;
            const base64 = res.includes(',') ? res.split(',')[1] : res;
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
