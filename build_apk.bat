@echo off
set JAVA_HOME=C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%
set ANDROID_HOME=C:\Users\nacho\AppData\Local\Android\Sdk
set ANDROID_SDK_ROOT=C:\Users\nacho\AppData\Local\Android\Sdk

echo Syncing web build to Capacitor Android...
call npx cap copy android

echo Building fresh APK using Microsoft OpenJDK 21 LTS...
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
