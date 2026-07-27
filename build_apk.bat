@echo off
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.12.7-hotspot"
set "ANDROID_HOME=C:\Users\junayed\AppData\Local\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%PATH%"

cd /d "e:\truecaller project\flutter_app"
echo Running flutter build apk --release...
"C:\Users\junayed\Downloads\Compressed\flutter_windows_3.24.0-stable\flutter\bin\flutter.bat" build apk --release

if exist "build\app\outputs\flutter-apk\app-release.apk" (
    copy /y "build\app\outputs\flutter-apk\app-release.apk" "..\releases\CallerID-v1.0.0-release.apk"
    echo SUCCESS: Built and updated releases\CallerID-v1.0.0-release.apk
    cd /d "e:\truecaller project"
    "C:\Program Files\Git\cmd\git.exe" add -f releases/CallerID-v1.0.0-release.apk
    "C:\Program Files\Git\cmd\git.exe" commit -m "build: Overwrite older release file with genuine compiled installable Android release APK package"
    "C:\Program Files\Git\cmd\git.exe" push
) else (
    echo ERROR: APK compilation failed.
)
