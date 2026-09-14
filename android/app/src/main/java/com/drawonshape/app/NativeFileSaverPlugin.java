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

    private static final String TEMP_FILE_NAME = "drawonshape_pending_export.tmp";

    private File getTempFile() {
        return new File(getContext().getCacheDir(), TEMP_FILE_NAME);
    }

    @PluginMethod
    public void appendChunk(PluginCall call) {
        String chunk = call.getString("chunk", "");
        Boolean isFirst = call.getBoolean("isFirst", false);

        try {
            byte[] bytes;
            try {
                bytes = Base64.decode(chunk, Base64.DEFAULT);
            } catch (Exception ex) {
                bytes = Base64.decode(chunk, Base64.NO_PADDING | Base64.DEFAULT);
            }

            File file = getTempFile();
            if (Boolean.TRUE.equals(isFirst) && file.exists()) {
                file.delete();
            }

            try (FileOutputStream fos = new FileOutputStream(file, !Boolean.TRUE.equals(isFirst))) {
                fos.write(bytes);
                fos.flush();
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error appending chunk: " + e.getMessage());
        }
    }

    @PluginMethod
    public void startSaveDialog(PluginCall call) {
        String fileName = call.getString("fileName", "export.png");
        String mimeType = call.getString("mimeType", "*/*");

        File file = getTempFile();
        if (!file.exists() || file.length() == 0) {
            call.reject("No data prepared for export");
            return;
        }

        try {
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
            call.reject("Failed to open save dialog: " + e.getMessage());
        }
    }

    @PluginMethod
    public void saveFile(PluginCall call) {
        String fileName = call.getString("fileName", "export.png");
        String base64Data = call.getString("base64Data", "");
        String mimeType = call.getString("mimeType", "*/*");

        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("No data provided");
            return;
        }

        try {
            if (base64Data.contains(",")) {
                base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
            }
            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);

            File file = getTempFile();
            if (file.exists()) file.delete();
            try (FileOutputStream fos = new FileOutputStream(file)) {
                fos.write(bytes);
                fos.flush();
            }

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
            call.reject("SaveFile error: " + e.getMessage());
        }
    }

    @ActivityCallback
    public void pickerCallback(PluginCall call, ActivityResult result) {
        if (call == null) {
            call = getSavedCall();
        }

        File file = getTempFile();

        if (result != null && result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            Uri targetUri = result.getData().getData();
            if (targetUri == null) {
                cleanUpTempFile();
                if (call != null) call.reject("No destination selected");
                return;
            }

            if (!file.exists()) {
                if (call != null) call.reject("Export data file was lost");
                return;
            }

            try (FileInputStream fis = new FileInputStream(file);
                 OutputStream os = getContext().getContentResolver().openOutputStream(targetUri)) {

                if (os == null) {
                    cleanUpTempFile();
                    if (call != null) call.reject("Cannot write to selected location");
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
                if (call != null) call.resolve(ret);
            } catch (Exception e) {
                cleanUpTempFile();
                if (call != null) call.reject("Error saving file to chosen location: " + e.getMessage());
            }
        } else {
            // User cancelled or pressed back
            cleanUpTempFile();
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("cancelled", true);
            if (call != null) call.resolve(ret);
        }
    }

    private void cleanUpTempFile() {
        try {
            File f = getTempFile();
            if (f.exists()) f.delete();
        } catch (Exception ignored) {}
    }
}
