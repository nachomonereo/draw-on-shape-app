package com.drawonshape.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "NativeFileSaver")
public class NativeFileSaverPlugin extends Plugin {

    private File pendingTempFile = null;

    @PluginMethod
    public void saveFile(PluginCall call) {
        String fileName = call.getString("fileName", "export");
        String base64Data = call.getString("base64Data", "");
        String mimeType = call.getString("mimeType", "*/*");

        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("No data provided");
            return;
        }

        try {
            // Remove data URL header if present (e.g. data:image/png;base64,...)
            if (base64Data.contains(",")) {
                base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
            }

            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
            cleanUpTempFile();

            pendingTempFile = new File(getContext().getCacheDir(), "pending_export_" + System.currentTimeMillis());
            try (FileOutputStream fos = new FileOutputStream(pendingTempFile)) {
                fos.write(bytes);
                fos.flush();
            }

            // Launch SAF ACTION_CREATE_DOCUMENT to let user select destination folder
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);

            String normalizedMime = mimeType;
            if (normalizedMime == null || normalizedMime.isEmpty() || normalizedMime.equals("application/octet-stream") || !normalizedMime.contains("/")) {
                normalizedMime = "*/*";
            }
            intent.setType(normalizedMime);
            intent.putExtra(Intent.EXTRA_TITLE, fileName);

            startActivityForResult(call, intent, "pickerCallback");
        } catch (Exception e) {
            cleanUpTempFile();
            call.reject("Failed to initiate export: " + e.getMessage());
        }
    }

    @ActivityCallback
    private void pickerCallback(PluginCall call, ActivityResult result) {
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            Uri targetUri = result.getData().getData();
            if (targetUri == null) {
                cleanUpTempFile();
                call.reject("No destination selected");
                return;
            }

            if (pendingTempFile == null || !pendingTempFile.exists()) {
                cleanUpTempFile();
                call.reject("Temporary file missing");
                return;
            }

            try (FileInputStream fis = new FileInputStream(pendingTempFile);
                 OutputStream os = getContext().getContentResolver().openOutputStream(targetUri)) {

                if (os == null) {
                    cleanUpTempFile();
                    call.reject("Cannot write to the selected destination");
                    return;
                }

                byte[] buffer = new byte[8192];
                int read;
                while ((read = fis.read(buffer)) != -1) {
                    os.write(buffer, 0, read);
                }
                os.flush();

                cleanUpTempFile();
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("uri", targetUri.toString());
                call.resolve(ret);
            } catch (Exception e) {
                cleanUpTempFile();
                call.reject("Error writing file: " + e.getMessage());
            }
        } else {
            // User cancelled the file picker dialog
            cleanUpTempFile();
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("cancelled", true);
            call.resolve(ret);
        }
    }

    private void cleanUpTempFile() {
        if (pendingTempFile != null && pendingTempFile.exists()) {
            try {
                pendingTempFile.delete();
            } catch (Exception ignored) {}
            pendingTempFile = null;
        }
    }
}
