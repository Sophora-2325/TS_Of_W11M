param([switch]$SkipBuild, [switch]$CodeOnly)
$ErrorActionPreference = 'Stop'
$taskSource = Split-Path $PSScriptRoot -Parent
$taskTarget = 'D:\STOR\STOR-Android'
# Copy only source/deliverables. Do not copy caches or delete destination files.
Get-ChildItem -LiteralPath $taskSource -File -Recurse -Force |
    Where-Object { $_.FullName -notmatch '\\(\.gradle|\.kotlin|\.cache|\.signing|build|\.git)\\' } |
    ForEach-Object {
        $taskRelative = [IO.Path]::GetRelativePath($taskSource, $_.FullName)
        $taskDestination = Join-Path $taskTarget $taskRelative
        New-Item -ItemType Directory -Force -Path (Split-Path $taskDestination -Parent) | Out-Null
        Copy-Item -LiteralPath $_.FullName -Destination $taskDestination -Force
    }
Write-Output "Project sources copied to $taskTarget"
if (-not $SkipBuild) {
    New-Item -ItemType Directory -Force -Path (Join-Path $taskTarget 'evidence') | Out-Null
    $env:JAVA_HOME = 'D:\Android Studio\jbr'
    Push-Location -LiteralPath $taskTarget
    try {
        $taskBuildTasks = if ($CodeOnly) { @(':app:assembleDebug', ':app:lintDebug') } else {
            @(':app:testDebugUnitTest', ':app:assembleDebug', ':app:assembleDebugAndroidTest', ':app:lintDebug')
        }
        $taskLog = if ($CodeOnly) { 'evidence\p3-build.txt' } else { 'evidence\build.txt' }
        & .\gradlew.bat --no-daemon @taskBuildTasks --console=plain 2>&1 |
            Tee-Object -FilePath (Join-Path $taskTarget $taskLog)
        $taskExit = $LASTEXITCODE
    } finally { Pop-Location }
    exit $taskExit
}
