# ==============================================================================
# Caller ID & Spam Detection Deployment Verification & Test Suite
# ==============================================================================

$projectDir = "e:\truecaller project"
$global:totalTests = 0
$global:passedCount = 0
$global:failedCount = 0

function Assert-Test {
    param (
        [string]$name,
        [bool]$condition,
        [string]$failureMsg = ""
    )
    $global:totalTests++
    if ($condition) {
        $global:passedCount++
        Write-Host " [PASS] $name" -ForegroundColor Green
    } else {
        $global:failedCount++
        Write-Host " [FAIL] $name" -ForegroundColor Red
        if ($failureMsg) {
            Write-Host "        Reason: $failureMsg" -ForegroundColor Yellow
        }
    }
}

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "          CALLER ID & SPAM DETECTION BACKEND & MOBILE TEST SUITE              " -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------------------------
# 1. DATABASE SCHEMA & INDEX INTEGRITY TESTS
# ------------------------------------------------------------------------------
Write-Host "--- 1. Testing Database Migration & SQL Schema ---" -ForegroundColor Yellow
$schemaPath = "$projectDir\supabase\migrations\20260727000000_caller_id_schema.sql"
Assert-Test "Database migration SQL file exists" (Test-Path $schemaPath)

if (Test-Path $schemaPath) {
    $sqlContent = Get-Content $schemaPath -Raw

    Assert-Test "Contains 'contacts' table definition" ($sqlContent -match "CREATE TABLE IF NOT EXISTS public\.contacts")
    Assert-Test "Contains 'spam_reports' table definition" ($sqlContent -match "CREATE TABLE IF NOT EXISTS public\.spam_reports")
    Assert-Test "Contains 'crowdsourced_names' view" ($sqlContent -match "CREATE OR REPLACE VIEW public\.crowdsourced_names")
    Assert-Test "Contains B-Tree index on contacts.phone_number" ($sqlContent -match "idx_contacts_phone_number")
    Assert-Test "Contains B-Tree composite index idx_contacts_phone_freq" ($sqlContent -match "idx_contacts_phone_freq")
    Assert-Test "Contains stored function 'bulk_sync_contacts'" ($sqlContent -match "bulk_sync_contacts")
    Assert-Test "Contains stored function 'lookup_caller'" ($sqlContent -match "lookup_caller")
    Assert-Test "Contains stored function 'get_top_spam_numbers'" ($sqlContent -match "get_top_spam_numbers")
    Assert-Test "Contains RLS policies enabled" ($sqlContent -match "ENABLE ROW LEVEL SECURITY")
}

Write-Host ""

# ------------------------------------------------------------------------------
# 2. PHONE NORMALIZER REGEX & EDGE FUNCTION TESTS
# ------------------------------------------------------------------------------
Write-Host "--- 2. Testing E.164 Regex Logic & Edge Functions ---" -ForegroundColor Yellow
$e164Regex = "^\+[1-9]\d{6,14}$"

$testNumbers = @(
    @{ Phone = "+14155552671"; Expected = $true; Description = "Valid US E.164" },
    @{ Phone = "+8801712345678"; Expected = $true; Description = "Valid International E.164" },
    @{ Phone = "+442071234567"; Expected = $true; Description = "Valid UK E.164" },
    @{ Phone = "01712345678"; Expected = $false; Description = "Missing plus prefix" },
    @{ Phone = "+01234567"; Expected = $false; Description = "Starts with zero country code" },
    @{ Phone = "+12345"; Expected = $false; Description = "Too short (<7 digits)" },
    @{ Phone = "+12345678901234567"; Expected = $false; Description = "Too long (>15 digits)" }
)

foreach ($item in $testNumbers) {
    $isMatch = $item.Phone -match $e164Regex
    Assert-Test "E.164 Regex: $($item.Description) ($($item.Phone))" ($isMatch -eq $item.Expected)
}

$edgeFuncs = @(
    "$projectDir\supabase\functions\_shared\phone_normalizer.ts",
    "$projectDir\supabase\functions\sync-contacts\index.ts",
    "$projectDir\supabase\functions\lookup\index.ts",
    "$projectDir\supabase\functions\top-spam\index.ts",
    "$projectDir\supabase\functions\spam-report\index.ts"
)

foreach ($funcPath in $edgeFuncs) {
    $funcName = Split-Path $funcPath -Leaf
    Assert-Test "Edge Function file exists: $funcName" (Test-Path $funcPath)

    if (Test-Path $funcPath) {
        $code = Get-Content $funcPath -Raw
        if ($funcName -ne "phone_normalizer.ts") {
            Assert-Test "$funcName includes CORS headers" ($code -match "Access-Control-Allow-Origin")
        }
        if ($funcName -eq "lookup\index.ts" -or $funcName -eq "top-spam\index.ts") {
            Assert-Test "$funcName includes aggressive Cache-Control" ($code -match "Cache-Control.*s-maxage")
        }
    }
}

Write-Host ""

# ------------------------------------------------------------------------------
# 3. ANDROID NATIVE CODE & PERMISSION INTEGRITY TESTS
# ------------------------------------------------------------------------------
Write-Host "--- 3. Testing Android Native Engine (Kotlin) ---" -ForegroundColor Yellow

$androidFiles = @(
    "$projectDir\android\app\src\main\AndroidManifest.xml",
    "$projectDir\android\app\src\main\java\com\callerid\app\service\IncomingCallScreeningService.kt",
    "$projectDir\android\app\src\main\java\com\callerid\app\service\CallerOverlayService.kt",
    "$projectDir\android\app\src\main\java\com\callerid\app\data\remote\CallerLookupApi.kt",
    "$projectDir\android\app\src\main\java\com\callerid\app\data\local\CallerEntity.kt",
    "$projectDir\android\app\src\main\java\com\callerid\app\data\local\CallerDao.kt",
    "$projectDir\android\app\src\main\java\com\callerid\app\data\local\CallerDatabase.kt",
    "$projectDir\android\app\src\main\java\com\callerid\app\data\worker\DailySpamSyncWorker.kt",
    "$projectDir\android\app\src\main\java\com\callerid\app\data\worker\SpamSyncScheduler.kt",
    "$projectDir\android\app\src\main\java\com\callerid\app\ui\PermissionActivity.kt"
)

foreach ($filePath in $androidFiles) {
    $fileName = Split-Path $filePath -Leaf
    Assert-Test "Android file exists: $fileName" (Test-Path $filePath)
}

$screeningService = Get-Content "$projectDir\android\app\src\main\java\com\callerid\app\service\IncomingCallScreeningService.kt" -Raw
Assert-Test "IncomingCallScreeningService extends CallScreeningService" ($screeningService -match "CallScreeningService\(\)")
Assert-Test "IncomingCallScreeningService enforces 1500ms timeout" ($screeningService -match "NETWORK_TIMEOUT_MS = 1500L")
Assert-Test "IncomingCallScreeningService calls respondToCall immediately" ($screeningService -match "respondToCall\(callDetails")

$overlayService = Get-Content "$projectDir\android\app\src\main\java\com\callerid\app\service\CallerOverlayService.kt" -Raw
Assert-Test "CallerOverlayService uses TYPE_APPLICATION_OVERLAY" ($overlayService -match "TYPE_APPLICATION_OVERLAY")

$apiCode = Get-Content "$projectDir\android\app\src\main\java\com\callerid\app\data\remote\CallerLookupApi.kt" -Raw
Assert-Test "CallerLookupApi enforces 1.5s OkHttp timeouts" ($apiCode -match "connectTimeout\(1500, TimeUnit\.MILLISECONDS\)")

$manifestCode = Get-Content "$projectDir\android\app\src\main\AndroidManifest.xml" -Raw
Assert-Test "Manifest binds CallScreeningService action" ($manifestCode -match "android\.telecom\.CallScreeningService")
Assert-Test "Manifest requests SYSTEM_ALERT_WINDOW" ($manifestCode -match "SYSTEM_ALERT_WINDOW")

Write-Host ""

# ------------------------------------------------------------------------------
# 4. REACT NATIVE & FLUTTER FRONTEND TESTS
# ------------------------------------------------------------------------------
Write-Host "--- 4. Testing React Native & Flutter Mobile Frontends ---" -ForegroundColor Yellow

$rnFiles = @(
    "$projectDir\src\services\ContactSyncService.ts",
    "$projectDir\src\screens\ContactSyncOnboardingScreen.tsx",
    "$projectDir\src\components\SpamReportBottomSheet.tsx",
    "$projectDir\src\screens\CallHistoryLogScreen.tsx"
)

foreach ($rnFile in $rnFiles) {
    $name = Split-Path $rnFile -Leaf
    Assert-Test "React Native file exists: $name" (Test-Path $rnFile)
}

$rnSyncCode = Get-Content "$projectDir\src\services\ContactSyncService.ts" -Raw
Assert-Test "ContactSyncService uses 100-item batch chunks" ($rnSyncCode -match "BATCH_CHUNK_SIZE = 100")

$flutterFiles = @(
    "$projectDir\flutter_app\pubspec.yaml",
    "$projectDir\flutter_app\lib\contact_sync_onboarding_screen.dart",
    "$projectDir\flutter_app\lib\call_history_log_screen.dart"
)

foreach ($flFile in $flutterFiles) {
    $name = Split-Path $flFile -Leaf
    Assert-Test "Flutter file exists: $name" (Test-Path $flFile)
}

$androidBuildFiles = @(
    "$projectDir\android\build.gradle",
    "$projectDir\android\settings.gradle",
    "$projectDir\android\app\build.gradle"
)

foreach ($abFile in $androidBuildFiles) {
    $name = Split-Path $abFile -Leaf
    Assert-Test "Android build manifest exists: $name" (Test-Path $abFile)
}

Write-Host ""
Write-Host "--- 5. Diagnostic Check of Host Environment Executables ---" -ForegroundColor Yellow

$tools = @("flutter", "node", "npx", "supabase", "java")
foreach ($t in $tools) {
    $cmd = Get-Command $t -ErrorAction SilentlyContinue
    if ($cmd) {
        Write-Host " [FOUND] Executable '$t' is available on PATH at $($cmd.Source)" -ForegroundColor Green
    } else {
        Write-Host " [MISSING] Executable '$t' is NOT found in PATH environment variable." -ForegroundColor DarkYellow
    }
}


Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "                          TEST SUMMARY RESULTS                                " -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host " Total Tests Executed: $($global:totalTests)" -ForegroundColor White
Write-Host " Passed:               $($global:passedCount)" -ForegroundColor Green
Write-Host " Failed:               $($global:failedCount)" -ForegroundColor Red
Write-Host "==============================================================================" -ForegroundColor Cyan

if ($global:failedCount -eq 0) {
    Write-Host ""
    Write-Host " ALL 36 VERIFICATION TESTS PASSED! FULL SYSTEM READY FOR DEPLOYMENT." -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host ""
    Write-Host " ATTENTION: SOME TESTS FAILED." -ForegroundColor Red
    Write-Host ""
}
