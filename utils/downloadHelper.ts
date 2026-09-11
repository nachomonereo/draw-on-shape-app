import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export async function saveOrShareFile(
    blobOrDataUrl: Blob | string,
    filename: string,
    mimeType: string
): Promise<{ success: boolean; path?: string }> {
    // 1. Native Capacitor (Android device / tablet)
    if (Capacitor.isNativePlatform()) {
        try {
            let base64Data: string;
            if (typeof blobOrDataUrl === 'string') {
                base64Data = blobOrDataUrl.includes(',') ? blobOrDataUrl.split(',')[1] : blobOrDataUrl;
            } else {
                base64Data = await blobToBase64(blobOrDataUrl);
            }

            let savedFile;
            try {
                // Save to public Documents directory so it's readily accessible in file managers
                savedFile = await Filesystem.writeFile({
                    path: filename,
                    data: base64Data,
                    directory: Directory.Documents,
                    recursive: true
                });
            } catch (fsErr) {
                console.warn("Could not write to Directory.Documents, fallback to Directory.Cache", fsErr);
                savedFile = await Filesystem.writeFile({
                    path: filename,
                    data: base64Data,
                    directory: Directory.Cache,
                    recursive: true
                });
            }

            // Open native Share sheet allowing the user to pick target app / folder (Drive, Files, WhatsApp, etc.)
            try {
                await Share.share({
                    title: filename,
                    text: `Archivo exportado: ${filename}`,
                    url: savedFile.uri,
                    dialogTitle: `Guardar / Compartir ${filename}`
                });
            } catch (shareErr) {
                console.warn("Share dialog dismissed or not supported:", shareErr);
            }

            return { success: true, path: savedFile.uri };
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
                return { success: false };
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
