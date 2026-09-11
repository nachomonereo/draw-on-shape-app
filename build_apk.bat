@echo off
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set ANDROID_HOME=C:\Users\nacho\AppData\Local\Android\Sdk
set ANDROID_SDK_ROOT=C:\Users\nacho\AppData\Local\Android\Sdk

echo Syncing web build to Capacitor Android...
call npx cap copy android

echo Building fresh APK using Android Studio JDK 21...
cd android
call gradlew.bat assembleDebug --rerun-tasks
cd ..

if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
    copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "DrawOnShape.apk"
    echo ==========================================
    echo SUCCESS: Fresh APK generated at DrawOnShape.apk
    echo ==========================================
) else (
    echo ==========================================
    echo FAILED: APK build failed.
    echo ==========================================
)
