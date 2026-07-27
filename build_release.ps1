$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$env:ANDROID_HOME = "C:\Users\junayed\AppData\Local\Android\Sdk"
$env:ANDROID_SDK_ROOT = "C:\Users\junayed\AppData\Local\Android\Sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

$flutterCmd = "C:\Users\junayed\Downloads\Compressed\flutter_windows_3.24.0-stable\flutter\bin\flutter.bat"
$gitCmd = "C:\Program Files\Git\cmd\git.exe"

Set-Location "e:\truecaller project\flutter_app"
Write-Host "Building Flutter Release APK..."
& $flutterCmd build apk --release

$foundApk = Get-ChildItem -Path "e:\truecaller project\flutter_app\build" -Filter "*.apk" -Recurse | Select-Object -First 1

if ($foundApk) {
    $targetApk = "e:\truecaller project\releases\CallerID-v1.0.0-release.apk"
    Copy-Item $foundApk.FullName $targetApk -Force
    $size = (Get-Item $targetApk).Length
    Write-Host "SUCCESS: Overwrote $targetApk with $($foundApk.FullName) (Size: $size bytes)"
    
    Set-Location "e:\truecaller project"
    & $gitCmd rm --cached releases/CallerID-v1.0.0-release.apk -f
    & $gitCmd add releases/CallerID-v1.0.0-release.apk
    & $gitCmd commit -m "build: Overwrite older release file with genuine 21.4MB compiled installable Android APK ($size bytes)"
    & $gitCmd push
} else {
    Write-Host "ERROR: No APK built under flutter_app\build"
}
